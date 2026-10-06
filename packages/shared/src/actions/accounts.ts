// Accounts: usernames for staff and family contacts. Passwords and hashes never enter club state: they live server-side only.
// The server picks a free username (first name, plus a number if taken) and records it through the system action below,
// so the username lands in club state and is broadcast like any other change.
import type { ClubState } from '../types';
import { defineAction, DomainError, type ActionDef } from './framework';
import { getUser, type Clubs } from '../users';
import { live } from '../util';
import { isPendingRow } from '../rules/core';

/** The demo password every seed account starts with, and what "reset password" sets. Not a secret: it is in the README. */
export const DEFAULT_PASSWORD = 'citra123';
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

export interface AccountRef {
  id: string;
  clubId: string;
  kind: 'staff' | 'family';
  /** full display name (staff) or first name (family contact): where the username comes from */
  name: string;
  username?: string;
}

/** Every staff member and family contact across the clubhouses (the system user excluded). */
export function accountRows(clubs: Clubs): AccountRef[] {
  const out: AccountRef[] = [];
  for (const s of Object.values(clubs)) {
    for (const x of live(s.staff as ClubState['staff'])) if (x.id !== 'system') out.push({ id: x.id, clubId: s.clubId, kind: 'staff', name: x.name, username: x.username });
    for (const x of live(s.familyContacts as ClubState['familyContacts'])) out.push({ id: x.id, clubId: s.clubId, kind: 'family', name: x.firstName || x.name, username: x.username });
  }
  return out;
}
/** The account row for a user id, if any. */
export const findAccount = (clubs: Clubs, id: string): AccountRef | undefined => accountRows(clubs).find((a) => a.id === id);

/** People who can sign in right now (access on, active, approved) but have no username yet. */
export function accountsNeedingUsername(clubs: Clubs): AccountRef[] {
  return accountRows(clubs).filter((a) => !a.username && !!getUser(clubs, a.id));
}

/** Can this account sign in now? 'pending' = a family contact still waiting for management approval; 'none' = no such account. */
export function accessState(clubs: Clubs, id: string): 'ok' | 'pending' | 'noAccess' | 'none' {
  if (getUser(clubs, id)) return 'ok';
  for (const s of Object.values(clubs)) {
    const st = s.staff[id];
    if (st && !st.deletedAt) return 'noAccess';
    const fc = s.familyContacts[id];
    if (fc && !fc.deletedAt) return isPendingRow(fc) ? 'pending' : 'noAccess';
  }
  return 'none';
}

/** Lowercase letters and digits only: the first word of the name, accents dropped. */
export function usernameBase(name: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  const base = first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return base.length >= 2 ? base.slice(0, 24) : 'user';
}
export const USERNAME_RE = /^[a-z0-9]{2,40}$/;

export const accountActions: ActionDef[] = [
  defineAction<{ assignments: { id: string; username: string }[] }>({
    name: 'account.setUsernames',
    // system only: the server runs it after it has reserved the names; no browser can call it
    can: (u) => u.id === 'system',
    parse(raw) {
      const list = (raw as { assignments?: unknown } | null)?.assignments;
      if (!Array.isArray(list)) throw new DomainError('err.invalid');
      return { assignments: list.map((a) => {
        const { id, username } = a as { id: unknown; username: unknown };
        if (typeof id !== 'string' || typeof username !== 'string' || !USERNAME_RE.test(username)) throw new DomainError('err.invalid');
        return { id, username };
      }) };
    },
    run(d, input) {
      for (const a of input.assignments) {
        const row = d.staff[a.id] ?? d.familyContacts[a.id];
        if (!row || row.deletedAt || row.username) continue; // fixed once set
        row.username = a.username;
      }
    },
  }),
];
