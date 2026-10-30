// Round 16: access.set / access.setOwnerApproval are the Owner's alone.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, accessOf, ownerApprovalOn, DomainError, type ClubState } from '../index';

const clock = { today: '2026-10-21', nowMin: 600 };
const base = buildSeed().citra;
let n = 0;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, as(s, uid), clock, `acc${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const OWNER = 's11';

describe('access.set', () => {
  it('Management cannot set access', () => {
    fails(base, 'access.set', { role: 'nurse', key: 'budget', level: 'edit' }, 's9', 'err.forbidden');
  });
  it('the Owner sets a cell, and setting it back to the default removes the entry', () => {
    const a = run(base, 'access.set', { role: 'nurse', key: 'budget', level: 'edit' }, OWNER).state;
    expect(a.club.settings.access?.nurse?.budget).toBe('edit');
    expect(accessOf(a, 'nurse', 'budget')).toBe('edit');
    const b = run(a, 'access.set', { role: 'nurse', key: 'budget', level: 'off' }, OWNER).state;
    expect(b.club.settings.access?.nurse?.budget).toBe('off'); // round 16 fix: nurse/budget has no default, so an explicit Hidden is kept
    const b2 = run(b, 'access.set', { role: 'nurse', key: 'budget', level: 'clear' }, OWNER).state;
    expect(b2.club.settings.access?.nurse).toBeUndefined();
    const b3 = run(run(base, 'access.set', { role: 'lobby', key: 'billing', level: 'edit' }, OWNER).state, 'access.set', { role: 'lobby', key: 'billing', level: 'view' }, OWNER).state;
    expect(b3.club.settings.access?.lobby?.billing).toBeUndefined(); // back to a non-off default
    const c = run(base, 'access.set', { role: 'lobby', key: 'billing', level: 'off' }, OWNER).state;
    expect(c.club.settings.access?.lobby?.billing).toBe('off'); // the default is View, so Hidden is kept
  });
  it('Hidden on a never-set default-off cell is stored and the server then refuses the area', () => {
    const a = run(base, 'access.set', { role: 'lobby', key: 'payments', level: 'off' }, OWNER).state;
    expect(a.club.settings.access?.lobby?.payments).toBe('off');
    fails(a, 'payment.record', { memberId: 'm1', amount: 1000, method: 'other' }, 's1', 'err.viewOnly');
  });
  it('an unknown key, role or level is invalid', () => {
    fails(base, 'access.set', { role: 'nurse', key: 'nope', level: 'edit' }, OWNER, 'err.invalid');
    fails(base, 'access.set', { role: 'nurse', key: 'today', level: 'off' }, OWNER, 'err.invalid');
    fails(base, 'access.set', { role: 'owner', key: 'budget', level: 'edit' }, OWNER, 'err.invalid');
    fails(base, 'access.set', { role: 'nurse', key: 'budget', level: 'max' }, OWNER, 'err.invalid');
  });
});

describe('Approvals access', () => {
  it('Management with Approvals on View cannot decide (round 16 review)', () => {
    const a = run(base, 'access.set', { role: 'mgmt', key: 'reviews', level: 'view' }, OWNER).state;
    fails(a, 'approval.approve', { type: 'logs', ids: ['x'] }, 's9', 'err.viewOnly');
    fails(a, 'approval.reject', { type: 'logs', ids: ['x'], reason: 'no' }, 's9', 'err.viewOnly');
    fails(a, 'review.approve', { crId: 'x' }, 's9', 'err.viewOnly');
  });
});

describe('access.setOwnerApproval', () => {
  it('only the Owner switches it', () => {
    fails(base, 'access.setOwnerApproval', { role: 'mgmt', kind: 'pricing', on: false }, 's9', 'err.forbidden');
    const a = run(base, 'access.setOwnerApproval', { role: 'mgmt', kind: 'pricing', on: false }, OWNER).state;
    expect(ownerApprovalOn(a, 'mgmt', 'pricing')).toBe(false);
    expect(ownerApprovalOn(a, 'mgmt', 'budget')).toBe(true);
    const b = run(a, 'access.setOwnerApproval', { role: 'finance', kind: 'budget', on: true }, OWNER).state;
    expect(ownerApprovalOn(b, 'finance', 'budget')).toBe(true);
    fails(base, 'access.setOwnerApproval', { role: 'mgmt', kind: 'x', on: true }, OWNER, 'err.invalid');
  });
});
