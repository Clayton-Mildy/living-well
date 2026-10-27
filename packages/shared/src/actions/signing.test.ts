// Round 14 (D): signing.send, signing.sign, signing.physical and signing.stamp, and the status moves between them.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, systemUser, toMin, DomainError, type ClubState, type User } from '../index';
import { formDoc, signingOf } from '../rules/signing';

const T = '2026-10-27';
const clock = { today: T, nowMin: toMin('10:00') };
const seed = buildSeed();
const base = seed.citra;
const who = (id: string): User => getUser(seed, id)!;
let n = 0;
const run = (s: ClubState, name: string, input: unknown, user: User) => execute(s, name, input, user, clock, `sg${++n}`);
const fails = (s: ClubState, name: string, input: unknown, user: User, code: string) => {
  try { run(s, name, input, user); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const SIG = 'md_testsignature0001';
const sys = systemUser('citra');
const send = (s: ClubState, uid = 's1') => run(s, 'signing.send', { memberId: 'm1' }, who(uid)).state;
const signed = (s: ClubState) => run(s, 'signing.sign', { memberId: 'm1', signatureMediaId: SIG, otp: '123456' }, who('f1')).state;
/** a countersigned e-Meterai form (the countersign action itself is the approvals task) */
const countersigned = (s: ClubState) => produce(signed(send(s)), (d) => {
  const sig = formDoc(d.members.m1)!.signing!;
  sig.status = 'countersigned'; sig.steps.push({ status: 'countersigned', at: `${T}T11:00`, by: 'staff:s9' });
});

describe('signing.send', () => {
  it('lobby sends the form: Sent, steps Draft and Sent, a snapshot of the form, the signer is notified', () => {
    const s = send(base);
    const sig = signingOf(s.members.m1)!;
    expect(sig).toMatchObject({ status: 'sent', meterai: 'e' });
    expect(sig.steps).toEqual([{ status: 'draft', at: `${T}T10:00`, by: 'staff:s1' }, { status: 'sent', at: `${T}T10:00`, by: 'staff:s1' }]);
    expect(sig.form?.signer).toBe('Maria Wijaya');
    expect(formDoc(s.members.m1)?.status).toBe('onFile'); // already on file: left alone
    const note = Object.values(s.notifications).find((x) => x.kind === 'sign.notif.toSign');
    expect(note).toMatchObject({ toUsers: ['f1'], link: '/profile?member=m1&sign=1' });
    expect(Object.values(s.activity).some((x) => x.memberId === 'm1' && x.key === 'members.feed.docRequested')).toBe(true);
  });
  it('the form is a snapshot: editing the member afterwards leaves it unchanged; a resend appends one Sent step and takes a new snapshot', () => {
    const s = send(base);
    const edited = produce(s, (d) => { d.members.m1.address = 'Jl. Baru 9, Jakarta'; });
    expect(signingOf(edited.members.m1)?.form?.address).toBe(signingOf(s.members.m1)?.form?.address);
    expect(signingOf(edited.members.m1)?.form?.address).not.toContain('Baru');
    const again = send(edited, 's9');
    const sig = signingOf(again.members.m1)!;
    expect(sig.steps.map((x) => x.status)).toEqual(['draft', 'sent', 'sent']);
    expect(sig.form?.address).toContain('Baru');
  });
  it('a member with no form on file gets a requested form document', () => {
    const none = produce(base, (d) => { d.members.m1.documents = d.members.m1.documents.filter((x) => x.type !== 'membershipForm'); });
    const s = send(none);
    expect(formDoc(s.members.m1)).toMatchObject({ id: 'm1-doc-form', status: 'requested', signing: { status: 'sent' } });
  });
  it('a nurse and a family user are refused; a signed or stamped form cannot be sent again', () => {
    fails(base, 'signing.send', { memberId: 'm1' }, who('s8'), 'err.forbidden');
    fails(base, 'signing.send', { memberId: 'm1' }, who('f1'), 'err.forbidden');
    fails(signed(send(base)), 'signing.send', { memberId: 'm1' }, who('s1'), 'sign.err.notNow');
    fails(countersigned(base), 'signing.send', { memberId: 'm1' }, who('s9'), 'sign.err.notNow');
  });
  it('without a billing contact it fails with noSigner', () => {
    const none = produce(base, (d) => { for (const l of Object.values(d.familyLinks)) if (l.memberId === 'm1') l.deletedAt = `${T}T08:00`; });
    fails(none, 'signing.send', { memberId: 'm1' }, who('s1'), 'sign.err.noSigner');
  });
});

describe('signing.sign', () => {
  it('the billing contact signs with a drawn signature and 6 digits: Signed, with the signer name and a step', () => {
    const s = signed(send(base));
    const sig = signingOf(s.members.m1)!;
    expect(sig).toMatchObject({ status: 'signed', signerName: 'Maria Wijaya', signatureMediaId: SIG });
    expect(sig.steps.at(-1)).toEqual({ status: 'signed', at: `${T}T10:00`, by: 'family:f1' });
  });
  it('a short code or a missing signature is refused', () => {
    const s = send(base);
    fails(s, 'signing.sign', { memberId: 'm1', signatureMediaId: SIG, otp: '12345' }, who('f1'), 'err.invalid');
    fails(s, 'signing.sign', { memberId: 'm1', signatureMediaId: SIG, otp: '12345a' }, who('f1'), 'err.invalid');
    fails(s, 'signing.sign', { memberId: 'm1', otp: '123456' }, who('f1'), 'err.invalid');
    fails(s, 'signing.sign', { memberId: 'm1', signatureMediaId: 'bad id', otp: '123456' }, who('f1'), 'err.invalid');
  });
  it('signing twice, or before the form is sent, is not now', () => {
    fails(signed(send(base)), 'signing.sign', { memberId: 'm1', signatureMediaId: SIG, otp: '123456' }, who('f1'), 'sign.err.notNow');
    fails(base, 'signing.sign', { memberId: 'm1', signatureMediaId: SIG, otp: '123456' }, who('f1'), 'sign.err.notNow');
  });
  it('another contact of the member, a contact of another member and staff are refused', () => {
    const s = send(base);
    const ok = { memberId: 'm1', signatureMediaId: SIG, otp: '123456' };
    fails(s, 'signing.sign', ok, who('f2'), 'err.forbidden'); // Daniel: linked, but not the billing contact
    fails(s, 'signing.sign', { ...ok, memberId: 'm10' }, who('f1'), 'err.forbidden');
    fails(s, 'signing.sign', ok, who('s1'), 'err.forbidden');
  });
});

describe('signing.stamp', () => {
  const stamp = { memberId: 'm1', serial: 'SIM-EM-0001', at: `${T}T12:00` };
  it('the system stamps a countersigned form: Stamped, the serial, the document on file, the signer told', () => {
    const s = run(countersigned(base), 'signing.stamp', stamp, sys).state;
    const sig = signingOf(s.members.m1)!;
    expect(sig).toMatchObject({ status: 'stamped', meteraiSerial: 'SIM-EM-0001', meterai: 'e' });
    expect(sig.steps.at(-1)).toEqual({ status: 'stamped', at: `${T}T12:00`, by: 'system' });
    expect(formDoc(s.members.m1)).toMatchObject({ status: 'onFile', on: T, via: 'form' });
    expect(Object.values(s.notifications).some((x) => x.kind === 'sign.notif.stamped' && x.toUsers.includes('f1'))).toBe(true);
  });
  it('an ended member does not stop the stamp', () => {
    const ended = produce(countersigned(base), (d) => { const ms = d.members.m1.memberships; ms[ms.length - 1].lastDay = '2026-10-01'; });
    const s = run(ended, 'signing.stamp', stamp, sys).state;
    expect(signingOf(s.members.m1)).toMatchObject({ status: 'stamped', meteraiSerial: 'SIM-EM-0001' });
    expect(formDoc(s.members.m1)?.status).toBe('onFile');
  });
  it('management and the front desk cannot stamp', () => {
    fails(countersigned(base), 'signing.stamp', stamp, who('s9'), 'err.forbidden');
    fails(countersigned(base), 'signing.stamp', stamp, who('s1'), 'err.forbidden');
  });
  it('a form that is not countersigned, or is already stamped, is not now (a second sweep is harmless)', () => {
    fails(signed(send(base)), 'signing.stamp', stamp, sys, 'sign.err.notNow');
    fails(base, 'signing.stamp', stamp, sys, 'sign.err.notNow');
    const done = run(countersigned(base), 'signing.stamp', stamp, sys).state;
    fails(done, 'signing.stamp', { ...stamp, serial: 'SIM-EM-0002' }, sys, 'sign.err.notNow');
    fails(countersigned(base), 'signing.stamp', { ...stamp, serial: '' }, sys, 'err.invalid');
  });
});

describe('signing.physical', () => {
  const scan = { memberId: 'm1', mediaId: 'md_testphysicalscan01', fileName: 'form-signed.jpg' };
  it('management puts the scan on file and the form straight to Stamped (physical)', () => {
    const s = run(base, 'signing.physical', scan, who('s9')).state;
    expect(signingOf(s.members.m1)).toMatchObject({ status: 'stamped', meterai: 'physical', steps: [{ status: 'stamped', at: `${T}T10:00`, by: 'staff:s9' }] });
    expect(formDoc(s.members.m1)).toMatchObject({ status: 'onFile', mediaId: 'md_testphysicalscan01', fileName: 'form-signed.jpg', on: T, via: 'staff' });
  });
  it('the front desk is gated: nothing changes until management approves', () => {
    const r = run(base, 'signing.physical', scan, who('s1'));
    expect(r.reviewed).toBe('gate');
    expect(signingOf(r.state.members.m1)).toBeUndefined();
    expect(formDoc(r.state.members.m1)?.mediaId).toBeUndefined();
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who('s9'));
    expect(signingOf(a.state.members.m1)).toMatchObject({ status: 'stamped', meterai: 'physical' });
    expect(formDoc(a.state.members.m1)?.mediaId).toBe('md_testphysicalscan01');
  });
  it('needs a scan; a nurse and the family are refused', () => {
    fails(base, 'signing.physical', { memberId: 'm1' }, who('s9'), 'err.invalid');
    fails(base, 'signing.physical', scan, who('s8'), 'err.forbidden');
    fails(base, 'signing.physical', scan, who('f1'), 'err.forbidden');
  });
});
