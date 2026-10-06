// Accounts: seed usernames, who needs a username, the system-only action that records one, and what a family user can see.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, systemUser, projectForFamily, accountRows, accountsNeedingUsername, accessState, findAccount, usernameBase, DomainError, type ClubState, type User } from '../index';

const clock = { today: '2026-10-21', nowMin: 605 };
let n = 0;
const clubs = (s: ClubState) => ({ [s.clubId]: s });
const run = (s: ClubState, name: string, input: unknown, user: User) => execute(s, name, input, user, clock, `a${++n}`);
const mgmt = (s: ClubState) => getUser(clubs(s), 's9')!;
const newStaff = (over: Record<string, unknown> = {}) => ({ name: 'Wulan Sari', role: 'housekeeping', title: 'Housekeeping', phone: '0811 2201 7788', hr: { contract: 'pkwtt' }, ...over });

describe('seed usernames', () => {
  it('every staff member and family contact has their lowercase first name, all unique', () => {
    const rows = accountRows(buildSeed());
    expect(rows.map((r) => r.username).sort()).toEqual(['agus', 'caca', 'cynthia', 'daniel', 'dewi', 'dimas', 'dinar', 'ega', 'fransiska', 'joko', 'laras', 'maria', 'siti', 'stephanie', 'yohana', 'yohanes']);
    expect(new Set(rows.map((r) => r.username)).size).toBe(rows.length);
  });
  it('nobody in the seed is waiting for a username', () => {
    expect(accountsNeedingUsername(buildSeed())).toEqual([]);
  });
  it('the seed holds no password or hash', () => {
    expect(JSON.stringify(buildSeed())).not.toMatch(/password|passwordHash|scrypt|citra123/i);
  });
});

describe('who needs a username', () => {
  it('a new staff member with app access, but not one without', () => {
    const s = buildSeed().citra;
    const withAccess = run(s, 'staff.create', newStaff({ appAccess: true }), mgmt(s));
    expect(accountsNeedingUsername(clubs(withAccess.state)).map((a) => a.id)).toEqual([withAccess.result.staffId]);
    const without = run(s, 'staff.create', newStaff(), mgmt(s));
    expect(accountsNeedingUsername(clubs(without.state))).toEqual([]);
    const on = run(without.state, 'staff.setAppAccess', { staffId: without.result.staffId, on: true }, mgmt(s));
    expect(accountsNeedingUsername(clubs(on.state)).map((a) => a.id)).toEqual([without.result.staffId]);
  });
  it('a family contact only once active: pending while the lobby add waits for approval', () => {
    const s = buildSeed().citra;
    const lobby = getUser(clubs(s), 's1')!;
    const r = run(s, 'family.addContact', { memberId: 'm10', name: 'Dewi Purnomo', phone: '0813 4000 1122', relation: 'daughter' }, lobby);
    const fid = r.result.familyId as string;
    expect(accessState(clubs(r.state), fid)).toBe('pending');
    expect(accountsNeedingUsername(clubs(r.state))).toEqual([]);
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, mgmt(s));
    expect(accessState(clubs(a.state), fid)).toBe('ok');
    expect(accountsNeedingUsername(clubs(a.state)).map((x) => x.id)).toEqual([fid]);
  });
  it('access states: ok, no app access, no such account', () => {
    const c = clubs(buildSeed().citra);
    expect(accessState(c, 's1')).toBe('ok');
    expect(accessState(c, 's4')).toBe('noAccess');
    expect(accessState(c, 'nobody')).toBe('none');
    expect(findAccount(c, 'f1')).toMatchObject({ kind: 'family', username: 'maria', clubId: 'citra' });
  });
});

describe('usernameBase', () => {
  it('first word, lowercase letters and digits only', () => {
    expect(usernameBase('Caca')).toBe('caca');
    expect(usernameBase('  Ádám Tóth ')).toBe('adam');
    expect(usernameBase("O'Neil")).toBe('oneil');
    expect(usernameBase('Ng Lee')).toBe('ng');
    expect(usernameBase('')).toBe('user');
    expect(usernameBase('J')).toBe('user');
    expect(usernameBase('Stephanie Gunawan')).toBe('stephanie');
  });
});

describe('account.setUsernames (system only)', () => {
  const made = () => { const s = buildSeed().citra; const r = run(s, 'staff.create', newStaff({ appAccess: true }), mgmt(s)); return { s: r.state, id: r.result.staffId as string }; };
  it('records the username in club state', () => {
    const { s, id } = made();
    const r = run(s, 'account.setUsernames', { assignments: [{ id, username: 'wulan' }] }, systemUser('citra'));
    expect(r.state.staff[id].username).toBe('wulan');
    expect(r.patches.some((p) => p.path[0] === 'staff' && p.path[1] === id && p.path[2] === 'username')).toBe(true);
    expect(accountsNeedingUsername(clubs(r.state))).toEqual([]);
  });
  it('is fixed once set: a second assignment changes nothing, and unknown ids are skipped', () => {
    const { s, id } = made();
    const a = run(s, 'account.setUsernames', { assignments: [{ id, username: 'wulan' }] }, systemUser('citra'));
    const b = run(a.state, 'account.setUsernames', { assignments: [{ id, username: 'other' }, { id: 'ghost', username: 'ghost' }, { id: 's1', username: 'hijack' }] }, systemUser('citra'));
    expect(b.patches).toEqual([]);
    expect(b.state.staff[id].username).toBe('wulan');
    expect(b.state.staff.s1.username).toBe('caca');
  });
  it('can be run by nobody but the server: not management, not staff, not family', () => {
    const { s, id } = made();
    for (const uid of ['s9', 's1', 'f1']) {
      expect(() => run(s, 'account.setUsernames', { assignments: [{ id, username: 'wulan' }] }, getUser(clubs(s), uid)!)).toThrowError(expect.objectContaining({ code: 'err.forbidden' }));
    }
  });
  it('rejects names that are not lowercase letters and digits', () => {
    const { s, id } = made();
    for (const username of ['Wulan', 'wu lan', 'wu-lan', 'a', '']) expect(() => run(s, 'account.setUsernames', { assignments: [{ id, username }] }, systemUser('citra'))).toThrow(DomainError);
    expect(() => run(s, 'account.setUsernames', {}, systemUser('citra'))).toThrow(DomainError);
  });
});

describe('what a family user sees', () => {
  it('their own username only: not the other contacts in the household, not any staff', () => {
    const p = projectForFamily(buildSeed().citra, 'f1');
    expect(p.familyContacts.f1.username).toBe('maria');
    expect(p.familyContacts.f2.username).toBeUndefined();
    expect(Object.values(p.staff).every((x) => x.username === undefined)).toBe(true);
  });
});
