// Round 17 (phase 2): access.setRole saves a whole role (menus + the three owner-approval switches); the Owner's alone.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, accessOf, ownerApprovalOn, roleDraft, MENU_KEYS, DomainError, type ClubState } from '../index';

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

/** Saves a role: its effective draft with `levels` / `approvals` changed on top (what the Roles screen sends). */
const save = (s: ClubState, role: Parameters<typeof roleDraft>[1], levels: Record<string, string> = {}, approvals: Record<string, boolean> = {}, uid = OWNER) => {
  const d = roleDraft(s, role);
  return run(s, 'access.setRole', { role, levels: { ...d.levels, ...levels }, approvals: { ...d.approvals, ...approvals } }, uid);
};
const PROOF = { memberId: 'm1', amount: 1000, method: 'cash', proofMediaId: 'md_testproof01', invoiceId: 'INV-2610-001' };

describe('access.setRole', () => {
  it('Front desk with Billing on Edit stores only that cell, who changed it, and tells the role', () => {
    const r = save(base, 'lobby', { billing: 'edit' });
    expect(r.state.club.settings.access?.lobby).toEqual({ billing: 'edit' });
    expect(r.state.club.settings.accessChanged?.lobby).toMatchObject({ by: 's11' });
    expect(r.state.club.settings.accessChanged?.lobby?.at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    const note = Object.values(r.state.notifications).find((n) => n.kind === 'mgmt.access.notif.changed');
    expect(note).toMatchObject({ toRoles: ['lobby'], params: { name: 'Pak Benjamin' } });
    expect(accessOf(r.state, 'lobby', 'billing')).toBe('edit');
  });
  it('saving writes only contacts and drops a directory cell stored before the merge (R3)', () => {
    const s = structuredClone(base);
    s.club.settings.access = { finance: { directory: 'view' }, lobby: { contacts: 'view', directory: 'edit' } };
    const r = save(s, 'lobby', { contacts: 'view' });
    expect(r.state.club.settings.access?.lobby).toEqual({ contacts: 'view' });
    expect(r.state.club.settings.access?.finance).toEqual({ directory: 'view' }); // another role is untouched
    const f = save(s, 'finance', {}); // a lone old View never narrowed Finance's Edit, so nothing is left to store
    expect(f.state.club.settings.access?.finance).toBeUndefined();
    const v = save(s, 'finance', { contacts: 'view' });
    expect(v.state.club.settings.access?.finance).toEqual({ contacts: 'view' });
    expect(accessOf(v.state, 'finance', 'contacts')).toBe('view');
    const back = save(s, 'finance', { contacts: 'edit' });
    expect(back.state.club.settings.access?.finance).toBeUndefined(); // Edit is Finance's default now
  });
  it('Members on Hidden is stored, and Caca can no longer update member details', () => {
    const a = save(base, 'lobby', { members: 'off' }).state;
    expect(a.club.settings.access?.lobby).toEqual({ members: 'off' });
    fails(a, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. Baru 1' } }, 's1', 'err.viewOnly');
  });
  it('saving with every default untouched leaves the grid empty and Caca still records cash from an invoice', () => {
    const a = save(base, 'lobby').state;
    expect(a.club.settings.access?.lobby).toBeUndefined();
    expect(a.club.settings.ownerApproval).toBeUndefined();
    expect(run(a, 'payment.record', PROOF, 's1').result.paymentId).toBeTruthy(); // Payments is never set, so it stays the action's own `can`
  });
  it('round 16\'s explicit Payments off is deleted when saved as off', () => {
    const old = structuredClone(base);
    old.club.settings.access = { lobby: { payments: 'off' } };
    fails(old, 'payment.record', PROOF, 's1', 'err.viewOnly');
    const a = save(old, 'lobby').state;
    expect(a.club.settings.access?.lobby).toBeUndefined();
    expect(run(a, 'payment.record', PROOF, 's1').result.paymentId).toBeTruthy();
  });
  it('a level equal to a non-off default is deleted', () => {
    const old = structuredClone(base);
    old.club.settings.access = { lobby: { billing: 'edit', members: 'view' } };
    const a = save(old, 'lobby', { billing: 'view' }).state;
    expect(a.club.settings.access?.lobby).toEqual({ members: 'view' });
  });
  it('approvals: off is stored for Management, back on deletes it', () => {
    const a = save(base, 'mgmt', {}, { pricing: false }).state;
    expect(a.club.settings.ownerApproval?.mgmt).toEqual({ pricing: false });
    expect(ownerApprovalOn(a, 'mgmt', 'pricing')).toBe(false);
    expect(ownerApprovalOn(a, 'mgmt', 'budget')).toBe(true);
    const b = save(a, 'mgmt', {}, { pricing: true }).state;
    expect(b.club.settings.ownerApproval).toBeUndefined();
    const c = save(base, 'finance', {}, { budget: true }).state;
    expect(ownerApprovalOn(c, 'finance', 'budget')).toBe(true);
    expect(c.club.settings.ownerApproval?.finance).toEqual({ budget: true });
  });
  it('Ega (Management) cannot save a role', () => {
    const d = roleDraft(base, 'nurse');
    fails(base, 'access.setRole', { role: 'nurse', levels: d.levels, approvals: d.approvals }, 's9', 'err.forbidden');
  });
  it('an unknown role, key, level or a missing key is invalid', () => {
    const d = roleDraft(base, 'nurse');
    const ok = { role: 'nurse', levels: d.levels, approvals: d.approvals };
    fails(base, 'access.setRole', { ...ok, role: 'owner' }, OWNER, 'err.invalid');
    fails(base, 'access.setRole', { ...ok, levels: { ...d.levels, nope: 'edit' } }, OWNER, 'err.invalid');
    fails(base, 'access.setRole', { ...ok, levels: { ...d.levels, budget: 'max' } }, OWNER, 'err.invalid');
    fails(base, 'access.setRole', { ...ok, levels: { ...d.levels, today: 'off' } }, OWNER, 'err.invalid');
    fails(base, 'access.setRole', { ...ok, levels: {} }, OWNER, 'err.invalid');
    fails(base, 'access.setRole', { ...ok, approvals: { pricing: true } }, OWNER, 'err.invalid');
  });
  it('the draft covers every menu key', () => {
    expect(Object.keys(roleDraft(base, 'nurse').levels).sort()).toEqual([...MENU_KEYS].sort());
  });
});

describe('Approvals access', () => {
  it('Management with Approvals on View cannot decide (round 16 review)', () => {
    const a = save(base, 'mgmt', { reviews: 'view' }).state;
    fails(a, 'approval.approve', { type: 'logs', ids: ['x'] }, 's9', 'err.viewOnly');
    fails(a, 'approval.reject', { type: 'logs', ids: ['x'], reason: 'no' }, 's9', 'err.viewOnly');
    fails(a, 'review.approve', { crId: 'x' }, 's9', 'err.viewOnly');
  });
});
