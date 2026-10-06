// Resolve signed-in users across clubhouses (dummy login: phone lookup + any 6 digits).
import type { ClubState, User } from './types';
import { e164, live } from './util';
import { isPendingRow } from './rules/core';

export type Clubs = Record<string, ClubState>;

export function getUser(clubs: Clubs, id: string): User | null {
  for (const s of Object.values(clubs)) {
    const st = s.staff[id];
    if (st && !st.deletedAt) {
      if (!st.active || !st.appAccess) return null;
      return { kind: 'staff', id, staff: st, clubId: s.clubId, clubs: [s.clubId, ...st.extraClubIds] };
    }
    const fc = s.familyContacts[id];
    if (fc && !fc.deletedAt) {
      const links = live(s.familyLinks).filter((l) => l.familyId === id && !isPendingRow(l) && l.appAccess);
      if (isPendingRow(fc) || !links.length) return null;
      return { kind: 'family', id, contact: fc, clubId: s.clubId, memberIds: links.map((l) => l.memberId) };
    }
  }
  return null;
}

export type LoginLookup = { ok: true; user: User } | { ok: false; reason: 'unknown' | 'pending' | 'noAccess' };
export function findByPhone(clubs: Clubs, raw: string): LoginLookup {
  const p = e164(raw);
  if (!p) return { ok: false, reason: 'unknown' };
  for (const s of Object.values(clubs)) {
    const st = live(s.staff).find((x) => x.phone === p);
    if (st) {
      const u = getUser(clubs, st.id);
      return u ? { ok: true, user: u } : { ok: false, reason: 'noAccess' };
    }
    const fc = live(s.familyContacts).find((x) => x.phone === p);
    if (fc) {
      if (isPendingRow(fc)) return { ok: false, reason: 'pending' };
      const u = getUser(clubs, fc.id);
      return u ? { ok: true, user: u } : { ok: false, reason: 'noAccess' };
    }
  }
  return { ok: false, reason: 'unknown' };
}
export const canAccessClub = (u: User, clubId: string) => (u.kind === 'staff' ? u.clubs.includes(clubId) : u.clubId === clubId);
