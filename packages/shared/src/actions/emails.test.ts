// Round 16: the family contact's email and the simulated outbox — the signed contract is "emailed" to the billing contact once the member is active.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, live, projectForFamily, systemUser, toMin, DomainError, type ClubState, type User } from '../index';
import { formDoc } from '../rules/signing';
import { emailsFor } from '../rules/emails';

const T = '2026-10-27';
const clock = { today: T, nowMin: toMin('10:00') };
const seed = buildSeed();
const who = (id: string): User => getUser(seed, id)!;
let n = 0;
const run = (s: ClubState, name: string, input: unknown, user: User) => execute(s, name, input, user, clock, `em${++n}`);
const fails = (s: ClubState, name: string, input: unknown, user: User, code: string) => {
  try { run(s, name, input, user); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
/** Oma Lina's form, countersigned and waiting for the e-Meterai stamp; Maria (f1) is the billing contact */
const countersigned = (s: ClubState) => produce(s, (d) => {
  const doc = formDoc(d.members.m1)!;
  doc.signing = { status: 'countersigned', meterai: 'e', steps: [{ status: 'sent', at: `${T}T09:00`, by: 'staff:s1' }, { status: 'signed', at: `${T}T09:30`, by: 'family:f1' }, { status: 'countersigned', at: `${T}T09:45`, by: 'staff:s9' }], signerId: 'f1' };
});
const stamp = (s: ClubState) => run(s, 'signing.stamp', { memberId: 'm1', serial: 'EM-0001', at: `${T}T10:00` }, systemUser('citra')).state;
const contractMails = (s: ClubState) => live(s.emails).filter((e) => e.kind === 'contract' && e.memberId === 'm1');

describe('the family email', () => {
  it('the front desk saves an email on a contact; a bad one is refused', () => {
    const s = run(seed.citra, 'family.updateContact', { familyId: 'f1', email: 'maria@example.com' }, who('s9')).state;
    expect(s.familyContacts.f1.email).toBe('maria@example.com');
    fails(seed.citra, 'family.updateContact', { familyId: 'f1', email: 'nope' }, who('s9'), 'err.emailInvalid');
  });
});

describe('the contract email', () => {
  it('stamping the form of an active member emails it to the billing contact, once', () => {
    let s = run(seed.citra, 'family.updateContact', { familyId: 'f1', email: 'maria@example.com' }, who('s9')).state;
    s = stamp(countersigned(s));
    expect(contractMails(s)).toHaveLength(1);
    expect(contractMails(s)[0]).toMatchObject({ to: 'maria@example.com', familyId: 'f1', status: 'sent', ref: { type: 'document' } });
    expect(emailsFor(s, contractMails(s)[0].ref)).toHaveLength(1);
  });
  it('with no email on file the row says so', () => {
    const s = stamp(countersigned(produce(seed.citra, (d) => { delete d.familyContacts.f1.email; })));
    expect(contractMails(s)).toMatchObject([{ to: '', status: 'noAddress' }]);
  });
  it('Send again sends another one', () => {
    const s0 = stamp(countersigned(run(seed.citra, 'family.updateContact', { familyId: 'f1', email: 'maria@example.com' }, who('s9')).state));
    const s = run(s0, 'email.resendContract', { memberId: 'm1' }, who('s1')).state;
    expect(contractMails(s)).toHaveLength(2);
  });
  it('another family never sees these emails', () => {
    const s = stamp(countersigned(seed.citra));
    const other = live(s.familyLinks).find((l) => l.memberId !== 'm1' && !live(s.familyLinks).some((x) => x.familyId === l.familyId && x.memberId === 'm1'))!;
    expect(live(projectForFamily(s, other.familyId).emails)).toEqual([]);
    expect(live(projectForFamily(s, 'f1').emails).length).toBe(1);
  });
});

describe('the family edits their own email', () => {
  it('goes to the club for approval; another contact\'s email is not theirs to change', () => {
    const r = run(seed.citra, 'family.updateContact', { familyId: 'f1', email: 'maria@example.com' }, who('f1'));
    expect(r.state.familyContacts.f1.email).toBeUndefined();
    expect(live(r.state.changeRequests).some((c) => c.status === 'pending' && c.action === 'family.updateContact' && c.submittedBy === 'family:f1')).toBe(true);
    fails(seed.citra, 'family.updateContact', { familyId: 'f2', email: 'x@example.com' }, who('f1'), 'err.forbidden');
    fails(seed.citra, 'family.updateContact', { familyId: 'f1', name: 'Someone Else' }, who('f1'), 'err.forbidden');
  });
});
