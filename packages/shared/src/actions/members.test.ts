// Members actions: gating per role, flagged health edits, afterApprove, validation, end and reactivate, notes, dates.
// The club is drop-in: nothing is booked or expected, Flex counts visits, and an extra day comes from check-ins.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, live, lobbyGroups, planOn, membershipStatus, type ClubState, type User } from '../index';
import { faceConsent, faceReady, FILTERS, filterCounts, matchesQuery, memberRows as rows2, memberStatus, isNewMember, nextMemberId, finalInvoiceFor } from '../rules/members';

const T = '2026-10-21';
const T2 = '2026-10-22';
const clock = { today: T, nowMin: 600 };
const clock2 = { today: T2, nowMin: 600 };
const seed = () => buildSeed();
const who = (c: ReturnType<typeof buildSeed>, id: string): User => getUser(c, id)!;
let seq = 0;
const run = (s: ClubState, name: string, input: unknown, user: User, ck = clock) => execute(s, name, input, user, ck, `t${++seq}`);

const newMember = (over: Record<string, unknown> = {}) => ({
  title: 'Oma', name: 'Siti Rahma', dob: '1946-03-12', address: 'Jl. Test 1', usualArrival: '10:00', plan: 'flex', start: '2026-10-26',
  contact: { name: 'Rudi Rahma', phone: '0812 5550 1234', relation: 'son', primary: true },
  health: { conditions: ['High blood pressure'], food: ['shellfish'], meds: [{ name: 'Amlodipine', dose: '5 mg', timing: 'morningHome' }] },
  docs: ['ktp'], consent: { data: true, face: true }, ...over,
});

describe('members.create', () => {
  it('lobby: gated. member, contact and link are pending; no bookings; the login is blocked', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember(), who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    const id = r.result.memberId as string;
    expect(id).toBe('m47');
    expect(r.state.members[id].review?.status).toBe('pending');
    const link = Object.values(r.state.familyLinks).find((l) => l.memberId === id)!;
    expect(link.review?.status).toBe('pending');
    expect(r.state.familyContacts[link.familyId].review?.status).toBe('pending');
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    expect(cr).toMatchObject({ op: 'create', section: 'newMember', status: 'pending', target: { type: 'member', id, memberId: id } });
    expect(cr.createdRows?.map((x) => x.coll).sort()).toEqual(['familyContacts', 'familyLinks', 'members']);
    expect(findByPhone({ citra: r.state }, '0812 5550 1234')).toEqual({ ok: false, reason: 'pending' });
    // pending members are listed but never on the lobby board
    expect(lobbyGroups(r.state, '2026-10-26').others.some((x) => x.m.id === id)).toBe(false);
    expect(r.state.activity && Object.values(r.state.activity).some((a) => a.memberId === id && a.key === 'members.feed.created')).toBe(true);
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'notif.reviewSubmitted' && n.toRoles.includes('mgmt'))).toBe(true);
  });

  it('afterApprove: activates the contact, welcomes the family, login works; nothing is booked (members drop in)', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember(), who(c, 's1'));
    const crId = r.result.changeRequestId as string;
    const a = run(r.state, 'review.approve', { crId }, who(c, 's9'));
    const id = r.result.memberId as string;
    expect(a.state.members[id].review?.status).toBe('approved');
    const fid = r.result.familyId as string;
    expect(a.state.familyContacts[fid].activatedAt).toBeTruthy();
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'members.notif.welcome' && n.toUsers.includes(fid))).toBe(true);
    const login = findByPhone({ citra: a.state }, '+62 812-5550-1234');
    expect(login.ok).toBe(true);
    // from the start date the member is on the manual check-in list, and "off" (with the usual arrival as information) until checked in
    expect(lobbyGroups(a.state, '2026-10-26').others.some((x) => x.m.id === id)).toBe(true);
    expect(lobbyGroups(a.state, T).others.some((x) => x.m.id === id)).toBe(false);
    expect(memberStatus(a.state, a.state.members[id], T).key).toBe('upcoming');
    expect(memberStatus(a.state, a.state.members[id], '2026-10-27')).toEqual({ key: 'off', usual: '10:00' });
    expect(isNewMember(a.state.members[id], T)).toBe(true);
  });

  it('reject needs a note and cleans up; the phone is free again', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember(), who(c, 's1'));
    const crId = r.result.changeRequestId as string;
    expect(() => run(r.state, 'review.reject', { crId, note: '' }, who(c, 's9'))).toThrow('err.noteRequired');
    const x = run(r.state, 'review.reject', { crId, note: 'Duplicate' }, who(c, 's9'));
    const id = r.result.memberId as string;
    expect(x.state.members[id].deletedAt).toBeTruthy();
    expect(Object.values(x.state.activity).some((a) => a.memberId === id)).toBe(false);
    expect(Object.values(x.state.notifications).some((n) => n.kind === 'notif.reviewRejected' && n.toUsers.includes('s1'))).toBe(true);
    const again = run(x.state, 'members.create', newMember(), who(c, 's1'));
    expect(again.reviewed).toBe('gate');
  });

  it('management is never gated: active at once, with the welcome', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember(), who(c, 's9'));
    expect(r.reviewed).toBeUndefined();
    const id = r.result.memberId as string;
    expect(r.state.members[id].review).toBeUndefined();
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'members.notif.welcome')).toBe(true);
    expect(findByPhone({ citra: r.state }, '0812 5550 1234').ok).toBe(true);
    expect(Object.keys(r.state.changeRequests).length).toBe(1); // only the seeded one
  });

  it('only the front desk may add members', () => {
    const c = seed();
    for (const u of ['s8', 's5', 's3', 's10', 'f1']) expect(() => run(c.citra, 'members.create', newMember(), who(c, u))).toThrow('err.forbidden');
  });

  it('validation: name, date of birth, contact, mobile, consent, usual arrival (optional), start day', () => {
    const c = seed();
    const go = (over: Record<string, unknown>) => () => run(c.citra, 'members.create', newMember(over), who(c, 's1'));
    expect(go({ name: ' ' })).toThrow('members.err.nameRequired');
    expect(go({ dob: '' })).toThrow('members.err.dobRequired');
    expect(go({ dob: '2026-13-40' })).toThrow('members.err.dobInvalid');
    expect(go({ dob: '2030-01-01' })).toThrow('members.err.dobInvalid');
    expect(go({ dob: '2015-01-01' })).toThrow('members.err.dobInvalid');
    expect(go({ contact: { name: '', phone: '0812 1', relation: 'son' } })).toThrow('members.err.contactRequired');
    expect(go({ contact: { name: 'Rudi', phone: '', relation: 'son' } })).toThrow('members.err.phoneRequired');
    expect(go({ contact: { name: 'Rudi', phone: '12', relation: 'son' } })).toThrow('members.err.phoneInvalid');
    expect(go({ consent: { data: false, face: true } })).toThrow('members.err.consentRequired');
    expect(go({ usualArrival: '25:61' })).toThrow('members.err.arrivalInvalid');
    expect(go({ usualArrival: '07:00' })).toThrow('members.err.arrivalHours');
    expect(go({ usualArrival: '' })).not.toThrow(); // the usual arrival is optional
    expect(go({ start: '2026-10-24' })).toThrow('members.err.startInvalid'); // a Saturday
    expect(go({ start: '2026-10-20' })).toThrow('members.err.startInvalid'); // in the past
    expect(go({ start: '2026-10-30' })).toThrow('err.closedDay'); // closed for training
    expect(go({ contact: { name: 'Maria Again', phone: '+62 812-1090-4471', relation: 'daughter' } })).toThrow('members.err.phoneInUse');
    // no usual days, escorts or transport exist any more; Gold and Flex are just the plan
    const gold = run(c.citra, 'members.create', newMember({ plan: 'gold', usualDays: [1], transport: 'driver', usualArrival: '' }), who(c, 's9')).state.members.m47;
    expect(gold.plans).toEqual([{ from: '2026-10-26', plan: 'gold', by: 'staff:s9' }]);
    expect(gold.usualArrival).toBe('');
    expect(Object.keys(gold).filter((k) => ['transport', 'escortDefaults', 'usualDays'].includes(k))).toEqual([]);
  });

  it('links an existing contact and respects the Primary toggle', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember({ contact: { existingId: 'f1', name: '', phone: '', relation: 'daughter', primary: false } }), who(c, 's9'));
    const id = r.result.memberId as string;
    expect(Object.keys(r.state.familyContacts)).toHaveLength(Object.keys(c.citra.familyContacts).length); // no new contact
    const l = Object.values(r.state.familyLinks).find((x) => x.memberId === id)!;
    expect(l.familyId).toBe('f1');
    expect(l.primary).toBe(false);
  });

  it('spouse is set on the new member and on the partner once approved', () => {
    const c = seed();
    const r = run(c.citra, 'members.create', newMember({ spouseId: 'm2' }), who(c, 's1'));
    expect(r.state.members.m2.spouseId).toBeNull(); // existing records are untouched until approval
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(a.state.members.m2.spouseId).toBe('m47');
  });

  it('dates follow the clock: no hard-coded month', () => {
    const c = seed();
    const ck = { today: '2027-03-10', nowMin: 600 };
    const r = run(c.citra, 'members.create', newMember({ start: '2027-03-15' }), who(c, 's9'), ck);
    expect(r.state.members.m47.memberships).toEqual([{ start: '2027-03-15' }]);
    expect(r.state.members.m47.plans[0].from).toBe('2027-03-15');
    expect(lobbyGroups(r.state, '2027-03-15').others.some((x) => x.m.id === 'm47')).toBe(true);
    expect(memberStatus(r.state, r.state.members.m47, '2027-03-12').key).toBe('upcoming');
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'members.notif.welcome' && JSON.stringify(n.params).includes('15/03/2027'))).toBe(true);
  });
});

describe('members.updateDetails', () => {
  it('lobby: gated. nothing changes until approved; approval applies the patch and notifies', () => {
    const c = seed();
    const r = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { name: 'Lina W. Wijaya', address: 'Jl. Baru 5', usualArrival: '10:30' } }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    expect(r.state.members.m1.address).toBe(c.citra.members.m1.address);
    expect(r.state.members.m1.usualArrival).toBe('10:05');
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    expect(cr.changes.map((x) => x.field).sort()).toEqual(['address', 'firstName', 'usualArrival']);
    const a = run(r.state, 'review.approve', { crId: cr.id }, who(c, 's9'));
    expect(a.state.members.m1).toMatchObject({ firstName: 'Lina W.', lastName: 'Wijaya', address: 'Jl. Baru 5', usualArrival: '10:30' });
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'notif.reviewApproved' && n.toUsers.includes('s1'))).toBe(true);
    expect(Object.values(a.state.activity).some((x) => x.memberId === 'm1' && x.key === 'members.feed.details' && (x.params as Record<string, string>).by === 'staff:s1')).toBe(true);
  });

  it('the seeded request (usual arrival of Bapak Bambang) can be approved', () => {
    const c = seed();
    const a = run(c.citra, 'review.approve', { crId: 'cr-seed-1' }, who(c, 's9'));
    expect(a.state.members.m10.usualArrival).toBe('09:30');
  });

  it('management applies at once; nurse, activity, kitchen, finance and family may not', () => {
    const c = seed();
    const r = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. Mgmt 1' } }, who(c, 's9'));
    expect(r.reviewed).toBeUndefined();
    expect(r.state.members.m1.address).toBe('Jl. Mgmt 1');
    for (const u of ['s8', 's5', 's3', 's10', 'f1']) expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'x' } }, who(c, u))).toThrow('err.forbidden');
  });

  it('approval detects a conflict when the record moved on; force applies anyway', () => {
    const c = seed();
    const r = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. A' } }, who(c, 's1'));
    const crId = r.result.changeRequestId as string;
    const moved = run(r.state, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. B' } }, who(c, 's9'));
    expect(() => run(moved.state, 'review.approve', { crId }, who(c, 's9'))).toThrow('err.reviewConflict');
    expect(run(moved.state, 'review.approve', { crId, force: true }, who(c, 's9')).state.members.m1.address).toBe('Jl. A');
  });

  it('a newer edit from the same person supersedes the older pending request', () => {
    const c = seed();
    const a = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. A' } }, who(c, 's1'));
    const b = run(a.state, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. B' } }, who(c, 's1'));
    expect(b.state.changeRequests[a.result.changeRequestId as string].status).toBe('superseded');
    expect(b.state.changeRequests[b.result.changeRequestId as string].status).toBe('pending');
  });

  it('the requester can withdraw; others cannot', () => {
    const c = seed();
    const a = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. A' } }, who(c, 's1'));
    const id = a.result.changeRequestId as string;
    expect(() => run(a.state, 'review.withdraw', { crId: id }, who(c, 's8'))).toThrow('err.forbidden');
    expect(run(a.state, 'review.withdraw', { crId: id }, who(c, 's1')).state.changeRequests[id].status).toBe('withdrawn');
  });

  it('spouse is two-way and replaces an earlier partner; derived fields follow', () => {
    const c = seed();
    const r = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { spouseId: 'm20', title: 'Ibu', dob: '1950-01-01' } }, who(c, 's9'));
    expect(r.state.members.m1).toMatchObject({ spouseId: 'm20', title: 'Ibu', gender: 'f', dob: '1950-01-01' });
    expect(r.state.members.m20.spouseId).toBe('m1');
    expect(r.state.members.m46.spouseId).toBeNull(); // Opa Budi's link to Lina is cleared
    expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { spouseId: 'm1' } }, who(c, 's9'))).toThrow('members.err.spouseInvalid');
    expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { usualArrival: '17:30' } }, who(c, 's9'))).toThrow('members.err.arrivalHours');
    expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { usualArrival: '9am' } }, who(c, 's9'))).toThrow('members.err.arrivalInvalid');
    expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: c.citra.members.m1.address } }, who(c, 's9'))).toThrow('err.noChanges');
  });

  it('the usual arrival is information only: it can be cleared, and never makes anyone "expected"', () => {
    const c = seed();
    const r = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { usualArrival: '' } }, who(c, 's9'));
    expect(r.state.members.m1.usualArrival).toBe('');
    expect(memberStatus(r.state, r.state.members.m1, T)).toEqual({ key: 'off' });
    expect(memberStatus(c.citra, c.citra.members.m1, T)).toEqual({ key: 'off', usual: '10:05' });
    expect(() => run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { usualArrival: '' } }, who(c, 's9'), clock)).not.toThrow();
    // the removed fields are ignored by the patch parser rather than stored
    const old = run(c.citra, 'members.updateDetails', { memberId: 'm1', patch: { address: 'Jl. X', transport: 'driver', escortDefaults: {} } }, who(c, 's9'));
    expect(Object.keys(old.state.members.m1)).not.toContain('transport');
    expect(Object.keys(old.state.members.m1)).not.toContain('escortDefaults');
  });
});

describe('documents, consent and plan (gated)', () => {
  it('setDocuments: lobby gated; approval stores the file with who and when', () => {
    const c = seed();
    const r = run(c.citra, 'members.setDocuments', { memberId: 'm46', docs: [{ type: 'healthInfo', fileName: 'obat.jpg' }] }, who(c, 's1'));
    expect(r.reviewed).toBe('gate');
    expect(r.state.members.m46.documents.find((d) => d.type === 'healthInfo')?.status).toBe('requested');
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(a.state.members.m46.documents.find((d) => d.type === 'healthInfo')).toMatchObject({ status: 'onFile', fileName: 'obat.jpg', on: T, via: 'staff', by: 'staff:s1' });
    expect(() => run(c.citra, 'members.setDocuments', { memberId: 'm46', docs: [{ type: 'nannyKtp', fileName: 'x.jpg' }] }, who(c, 's9'))).toThrow('members.err.noNanny');
  });

  it('setConsent: stored with who and when; the face opt-out drops the stored face', () => {
    const c = seed();
    const r = run(c.citra, 'members.setConsent', { memberId: 'm1', face: false }, who(c, 's9'));
    const face = r.state.members.m1.consents.find((x) => x.kind === 'face')!;
    expect(face).toMatchObject({ granted: false, by: 'staff:s9', byName: 'Ega', via: 'staff' });
    expect(face.at).toBe(`${T}T10:00`);
    expect(faceConsent(r.state.members.m1)).toBe(false);
    expect(r.state.members.m1.face.enrolled).toBe(false);
    expect(faceReady(c.citra.members.m1)).toBe(true);
    expect(faceReady(r.state.members.m1)).toBe(false);
    expect(() => run(c.citra, 'members.setConsent', { memberId: 'm1', data: false }, who(c, 's9'))).toThrow('members.err.consentRequired');
    const g = run(c.citra, 'members.setConsent', { memberId: 'm1', face: false }, who(c, 's1'));
    expect(g.reviewed).toBe('gate');
    expect(faceConsent(g.state.members.m1)).toBe(true);
  });

  it('changePlan: effective date defaults to the 1st of next month; finance is gated; today stays the same', () => {
    const c = seed();
    const r = run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'gold' }, who(c, 's10'));
    expect(r.reviewed).toBe('gate');
    expect(planOn(r.state.members.m1, T).plan).toBe('flex');
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    const m = a.state.members.m1;
    expect(m.plans.map((p) => [p.from, p.plan])).toEqual([['2025-03-03', 'flex'], ['2026-11-01', 'gold']]);
    expect(planOn(m, T).plan).toBe('flex');
    expect(planOn(m, '2026-11-02').plan).toBe('gold');
    expect(Object.keys(planOn(m, '2026-11-02'))).not.toContain('usualDays');
    expect(() => run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'flex', effective: '2026-10-01' }, who(c, 's9'))).toThrow('members.err.effectiveInvalid');
    expect(() => run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'silver' }, who(c, 's9'))).toThrow('members.err.planInvalid');
    expect(() => run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'flex' }, who(c, 's9'))).toThrow('err.noChanges');
    expect(() => run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'gold' }, who(c, 's1'))).toThrow('err.forbidden');
    // next month follows the clock
    const dec = run(c.citra, 'members.changePlan', { memberId: 'm1', plan: 'gold' }, who(c, 's9'), { today: '2026-12-10', nowMin: 600 });
    expect(dec.state.members.m1.plans[1].from).toBe('2027-01-01');
  });

  it('a scheduled change is replaced by a new one; a matching pending request is marked applied', () => {
    const c = seed();
    const a = run(c.citra, 'members.changePlan', { memberId: 'm10', plan: 'gold' }, who(c, 's9'));
    expect(a.state.planChangeRequests['pcr-m10'].status).toBe('applied');
    const b = run(a.state, 'members.changePlan', { memberId: 'm10', plan: 'flex', effective: '2026-11-01' }, who(c, 's9'));
    expect(b.state.members.m10.plans.filter((p) => p.from === '2026-11-01')).toHaveLength(1);
    expect(b.state.members.m10.plans.at(-1)).toMatchObject({ plan: 'flex', from: '2026-11-01' });
  });
});

describe('plan requests', () => {
  it('apply: finance is gated, management applies; the request is closed and the family told', () => {
    const c = seed();
    const r = run(c.citra, 'planChange.apply', { requestId: 'pcr-m10' }, who(c, 's10'));
    expect(r.reviewed).toBe('gate');
    expect(r.state.planChangeRequests['pcr-m10'].status).toBe('pending');
    const a = run(r.state, 'review.approve', { crId: r.result.changeRequestId }, who(c, 's9'));
    expect(a.state.planChangeRequests['pcr-m10']).toMatchObject({ status: 'applied', decidedBy: 'staff:s10' });
    expect(planOn(a.state.members.m10, '2026-11-02').plan).toBe('gold');
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'members.notif.planApplied' && n.toUsers.includes('fm10_0'))).toBe(true);
    const m = run(c.citra, 'planChange.apply', { requestId: 'pcr-m10' }, who(c, 's9'));
    expect(m.reviewed).toBeUndefined();
    expect(m.state.members.m10.plans.at(-1)).toMatchObject({ from: '2026-11-01', plan: 'gold', requestId: 'pcr-m10' });
    expect(() => run(m.state, 'planChange.apply', { requestId: 'pcr-m10' }, who(c, 's9'))).toThrow('members.err.requestNotPending');
    expect(() => run(c.citra, 'planChange.apply', { requestId: 'pcr-m10' }, who(c, 's1'))).toThrow('err.forbidden');
  });

  it('decline: finance is gated (held for management), management declines at once; the family is told', () => {
    const c = seed();
    const r = run(c.citra, 'planChange.decline', { requestId: 'pcr-m10', note: 'Not yet' }, who(c, 's10'));
    expect(r.result.held).toBe(true);
    expect(r.state.planChangeRequests['pcr-m10'].status).toBe('pending');
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    expect(cr).toMatchObject({ action: 'planChange.decline', section: 'plan', status: 'pending', kind: 'approval' });
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'notif.reviewSubmitted' && n.toRoles.includes('mgmt'))).toBe(true);
    const a = run(r.state, 'review.approve', { crId: cr.id }, who(c, 's9'));
    expect(a.state.planChangeRequests['pcr-m10']).toMatchObject({ status: 'declined', decidedBy: 'staff:s10' });
    expect(Object.values(a.state.notifications).some((n) => n.kind === 'members.notif.planDeclined' && n.toUsers.includes('fm10_0'))).toBe(true);
    const m = run(c.citra, 'planChange.decline', { requestId: 'pcr-m10' }, who(c, 's9'));
    expect(m.result.held).toBeUndefined();
    expect(m.state.planChangeRequests['pcr-m10'].status).toBe('declined');
  });
});

describe('health edits: applied now, reviewed afterwards', () => {
  it('nurse changes an allergy: applies at once and appears as an applied-review request', () => {
    const c = seed();
    const r = run(c.citra, 'members.setAllergies', { memberId: 'm1', food: ['shellfish', 'peanuts'], foodOther: 'kiwi', drugs: ['penicillin', 'other:codeine'] }, who(c, 's8'));
    expect(r.reviewed).toBe('flag');
    expect(r.state.members.m1.health).toMatchObject({ food: ['shellfish', 'peanuts'], foodOther: 'kiwi', drugs: ['penicillin', 'other:codeine'] });
    const cr = r.state.changeRequests[Object.keys(r.state.changeRequests).find((k) => r.state.changeRequests[k].action === 'members.setAllergies')!];
    expect(cr).toMatchObject({ kind: 'postReview', status: 'pending', section: 'allergies' });
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'notif.reviewFlagged')).toBe(true);
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'members.notif.allergies' && n.toRoles.includes('kitchen'))).toBe(true);
    const ack = run(r.state, 'review.acknowledge', { crId: cr.id }, who(c, 's9'));
    expect(ack.state.changeRequests[cr.id].status).toBe('acknowledged');
    const rev = run(r.state, 'review.revert', { crId: cr.id }, who(c, 's9'));
    expect(rev.state.members.m1.health.food).toEqual(['shellfish']);
    expect(rev.state.changeRequests[cr.id].status).toBe('reverted');
  });

  it('management edits skip the review; the lobby may not edit health', () => {
    const c = seed();
    const r = run(c.citra, 'members.setAllergies', { memberId: 'm1', food: [], foodOther: '', drugs: [] }, who(c, 's9'));
    expect(r.reviewed).toBeUndefined();
    expect(Object.keys(r.state.changeRequests)).toEqual(['cr-seed-1']);
    expect(() => run(c.citra, 'members.setAllergies', { memberId: 'm1', food: [], foodOther: '', drugs: [] }, who(c, 's1'))).toThrow('err.forbidden');
    expect(() => run(c.citra, 'members.setMeds', { memberId: 'm1', meds: [] }, who(c, 's5'))).toThrow('err.forbidden');
  });

  it('medicines keep name, dose and timing; ids are stable; empty names are refused', () => {
    const c = seed();
    const r = run(c.citra, 'members.setMeds', { memberId: 'm1', meds: [{ id: 'm1-med1', name: 'Amlodipine', dose: '10 mg', timing: 'morningHome' }, { name: 'Metformin', dose: '500 mg', timing: 'lunchClub' }] }, who(c, 's8'));
    expect(r.state.members.m1.health.meds).toEqual([
      { id: 'm1-med1', name: 'Amlodipine', dose: '10 mg', timing: 'morningHome' },
      { id: 'm1-med3', name: 'Metformin', dose: '500 mg', timing: 'lunchClub' },
    ]);
    expect(() => run(c.citra, 'members.setMeds', { memberId: 'm1', meds: [{ name: ' ', dose: '', timing: 'morningHome' }] }, who(c, 's8'))).toThrow('members.err.medNameRequired');
    expect(() => run(c.citra, 'members.setMeds', { memberId: 'm1', meds: c.citra.members.m1.health.meds }, who(c, 's8'))).toThrow('err.noChanges');
  });

  it('care instructions, conditions, diabetic, mobility and diet (multi)', () => {
    const c = seed();
    const care = run(c.citra, 'members.setCareInstructions', { memberId: 'm1', text: 'Offer tea first.' }, who(c, 's8'));
    expect(care.state.members.m1.care).toMatchObject({ instructions: 'Offer tea first.', by: 'staff:s8' });
    expect(care.reviewed).toBe('flag');
    const h = run(c.citra, 'members.setHealth', { memberId: 'm1', conditions: ['Diabetes', 'Hypertension'], diabetic: true, mobility: 'walker', diet: ['softFood', 'lowSalt'] }, who(c, 's8'));
    expect(h.state.members.m1.health).toMatchObject({ conditions: ['Diabetes', 'Hypertension'], diabetic: true, mobility: 'walker', diet: ['softFood', 'lowSalt'] });
    expect(() => run(c.citra, 'members.setHealth', { memberId: 'm1', conditions: [], diabetic: false, mobility: 'hoverboard', diet: [] }, who(c, 's8')).state.members.m1.health.mobility).not.toThrow();
  });

  it('cognitive status records the editor and the day; teachers may edit it', () => {
    const c = seed();
    const r = run(c.citra, 'members.setCognitive', { memberId: 'm10', summary: 'Mild memory loss; calm today' }, who(c, 's5'));
    expect(r.reviewed).toBe('flag');
    expect(r.state.members.m10.health.cognitive).toEqual({ summary: 'Mild memory loss; calm today', reviewedBy: 's5', reviewedOn: T });
    expect(() => run(c.citra, 'members.setCognitive', { memberId: 'm10', summary: 'x' }, who(c, 's1'))).toThrow('err.forbidden');
    expect(() => run(c.citra, 'members.setAllergies', { memberId: 'm10', food: [], foodOther: '', drugs: [] }, who(c, 's5'))).toThrow('err.forbidden');
    const m = run(c.citra, 'members.setCognitive', { memberId: 'm10', summary: 'Alert' }, who(c, 's9'));
    expect(m.state.members.m10.health.cognitive.reviewedBy).toBe('s9');
  });

  it('a revert conflicts when the record moved on', () => {
    const c = seed();
    const a = run(c.citra, 'members.setHealth', { memberId: 'm1', conditions: ['A'], diabetic: false, mobility: null, diet: [] }, who(c, 's8'));
    const crA = Object.keys(a.state.changeRequests).find((k) => a.state.changeRequests[k].action === 'members.setHealth')!;
    const b = run(a.state, 'members.setMeds', { memberId: 'm1', meds: [{ name: 'Z', dose: '1', timing: 'lunchClub' }] }, who(c, 's8'));
    expect(() => run(b.state, 'review.revert', { crId: crA }, who(c, 's9'))).toThrow('err.reviewConflict');
    expect(run(b.state, 'review.revert', { crId: crA, force: true }, who(c, 's9')).state.changeRequests[crA].status).toBe('reverted');
  });
});

describe('members.requestDocument', () => {
  it('lobby requests a missing document: ungated, the primary family contact is told', () => {
    const c = seed();
    const r = run(c.citra, 'members.requestDocument', { memberId: 'm46', type: 'healthInfo' }, who(c, 's1'));
    expect(r.reviewed).toBeUndefined();
    expect(r.state.members.m46.documents.find((d) => d.type === 'healthInfo')).toMatchObject({ status: 'requested', by: 'staff:s1' });
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'members.notif.docRequested' && n.toUsers.includes('f1'))).toBe(true);
    expect(() => run(c.citra, 'members.requestDocument', { memberId: 'm1', type: 'ktp' }, who(c, 's1'))).toThrow('members.err.alreadyOnFile');
    expect(() => run(c.citra, 'members.requestDocument', { memberId: 'm46', type: 'healthInfo' }, who(c, 's8'))).toThrow('err.forbidden');
  });
});

describe('end, cancel ending and reactivate', () => {
  /** Oma Lina (Flex, 10 of 10 October visits used by the 20th) visits on the 21st and 22nd: two extra days. */
  const withExtras = () => {
    const c = seed();
    const a = run(c.citra, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, who(c, 's1'));
    expect(a.result.extra).toBe(true);
    const b = run(a.state, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, who(c, 's1'), clock2);
    return { c, s: b.state };
  };

  it('management only; the last day must be an open club day, today or later', () => {
    const c = seed();
    for (const u of ['s1', 's8', 's10', 'f1']) expect(() => run(c.citra, 'members.end', { memberId: 'm1', lastDay: '2026-10-28', reason: 'movedAway' }, who(c, u))).toThrow('err.forbidden');
    const go = (lastDay: string, reason = 'movedAway') => () => run(c.citra, 'members.end', { memberId: 'm1', lastDay, reason }, who(c, 's9'));
    expect(go('2026-10-20')).toThrow('members.err.lastDayPast');
    expect(go('2026-10-24')).toThrow('err.closedDay'); // Saturday
    expect(go('2026-10-30')).toThrow('err.closedDay'); // closed for training
    expect(go('')).toThrow('members.err.lastDayRequired');
    expect(go('2026-10-28', 'because')).toThrow('members.err.reasonRequired');
  });

  it('sets the last day, stays active until then (still on the check-in list that day), is read-only after', () => {
    const c = seed();
    const r = run(c.citra, 'members.end', { memberId: 'm1', lastDay: '2026-10-26', reason: 'careHome', note: 'Moving' }, who(c, 's9'));
    const cur = r.state.members.m1.memberships.at(-1)!;
    expect(cur).toMatchObject({ start: '2025-03-03', lastDay: '2026-10-26', endReason: 'careHome', endNote: 'Moving', endedBy: 'staff:s9' });
    expect(r.result.cancelledBookings).toBeUndefined(); // nothing is booked, so nothing is cancelled
    expect(membershipStatus(r.state.members.m1, '2026-10-26')).toBe('ending');
    expect(lobbyGroups(r.state, '2026-10-26').others.some((x) => x.m.id === 'm1')).toBe(true);
    expect(lobbyGroups(r.state, '2026-10-27').others.some((x) => x.m.id === 'm1')).toBe(false);
    expect(membershipStatus(r.state.members.m1, '2026-10-27')).toBe('ended');
    expect(memberStatus(r.state, r.state.members.m1, '2026-10-27')).toEqual({ key: 'ended', on: '2026-10-26' });
    expect(() => run(r.state, 'members.end', { memberId: 'm1', lastDay: '2026-10-28', reason: 'careHome' }, who(c, 's9'))).toThrow('members.err.alreadyEnding');
    expect(Object.values(r.state.notifications).some((n) => n.kind === 'members.notif.ending' && n.toUsers.includes('f1'))).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.memberId === 'm1' && a.key === 'members.feed.ending')).toBe(true);
    // a pending plan change request for the member is closed
    const m10 = run(c.citra, 'members.end', { memberId: 'm10', lastDay: '2026-10-28', reason: 'movedAway' }, who(c, 's9'));
    expect(m10.state.planChangeRequests['pcr-m10'].status).toBe('declined');
  });

  it('final invoice covers only the extra visits no invoice has billed yet, by date; open invoices are untouched', () => {
    const { c, s } = withExtras();
    const openBefore = live(s.invoices).filter((i) => i.memberId === 'm1').map((i) => [i.id, JSON.stringify(i.lines)]);
    const r = run(s, 'members.end', { memberId: 'm1', lastDay: '2026-10-29', reason: 'movedAway' }, who(c, 's9'), clock2);
    const fin = live(r.state.invoices).filter((i) => i.memberId === 'm1' && i.kind === 'final');
    expect(fin).toHaveLength(1);
    expect(fin[0].lines).toHaveLength(1);
    expect(fin[0].lines[0]).toMatchObject({ kind: 'extraDay', qty: 2, unit: 650000, amount: 1300000, refMonth: '2026-10', dates: [T, T2] });
    expect(fin[0].number).toBe('INV-2610-001-F');
    expect(fin[0].dueDate).toBe('2026-11-12');
    expect(r.result.finalInvoice).toEqual({ number: 'INV-2610-001-F', total: 1300000 });
    // the monthly invoices are exactly as they were (they stay payable)
    expect(live(r.state.invoices).filter((i) => i.memberId === 'm1' && i.kind === 'monthly').map((i) => [i.id, JSON.stringify(i.lines)])).toEqual(openBefore);
    // those two days are now billed: nothing more to put on a final invoice
    const ending = r.state.members.m1;
    expect(finalInvoiceFor(r.state, ending, '2026-10-29', T2)).toBeNull();
    // a later extra visit before the last day is not on any invoice yet, so it would be
    const later = run(r.state, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, who(c, 's1'), { today: '2026-10-23', nowMin: 600 });
    const more = finalInvoiceFor(later.state, later.state.members.m1, '2026-10-29', '2026-10-23');
    expect(more?.lines).toHaveLength(1);
    expect(more?.lines[0]).toMatchObject({ kind: 'extraDay', qty: 1, amount: 650000, dates: ['2026-10-23'] });
    // a member with no extra visits gets no final invoice
    const none = run(c.citra, 'members.end', { memberId: 'm46', lastDay: '2026-10-28', reason: 'movedAway' }, who(c, 's9'));
    expect(live(none.state.invoices).some((i) => i.memberId === 'm46' && i.kind === 'final')).toBe(false);
    expect(live(run(c.citra, 'members.end', { memberId: 'm1', lastDay: '2026-10-29', reason: 'movedAway' }, who(c, 's9')).state.invoices).some((i) => i.kind === 'final')).toBe(false); // 10 of 10 visits: no extras
    // the same maths is available to the dialog preview
    expect(finalInvoiceFor(s, { ...s.members.m1, memberships: [{ ...s.members.m1.memberships[0], lastDay: '2026-10-29' }] }, '2026-10-29', T2)?.lines[0].amount).toBe(1300000);
  });

  it('cancel ending voids the unpaid final invoice; reactivating an ended member appends a period', () => {
    const { c, s } = withExtras();
    const r = run(s, 'members.end', { memberId: 'm1', lastDay: '2026-10-26', reason: 'movedAway' }, who(c, 's9'), clock2);
    expect(live(r.state.invoices).some((i) => i.kind === 'final' && i.memberId === 'm1' && !i.voided)).toBe(true);
    const back = run(r.state, 'members.cancelEnding', { memberId: 'm1' }, who(c, 's9'), clock2);
    expect(back.state.members.m1.memberships.at(-1)!.lastDay).toBeUndefined();
    expect(live(back.state.invoices).filter((i) => i.kind === 'final' && i.memberId === 'm1').every((i) => !!i.voided)).toBe(true);
    // the voided invoice no longer counts as billing those days
    expect(finalInvoiceFor(back.state, back.state.members.m1, '2026-10-29', T2)?.lines[0].qty).toBe(2);
    expect(() => run(back.state, 'members.cancelEnding', { memberId: 'm1' }, who(c, 's9'))).toThrow('members.err.notEnding');
    // later: the member has ended; reactivate
    const later = { today: '2026-11-02', nowMin: 600 };
    expect(membershipStatus(r.state.members.m1, '2026-11-02')).toBe('ended');
    const re = run(r.state, 'members.reactivate', { memberId: 'm1' }, who(c, 's9'), later);
    expect(re.state.members.m1.memberships).toHaveLength(2);
    expect(re.state.members.m1.memberships[1]).toEqual({ start: '2026-11-02' });
    expect(re.state.members.m1.memberships[0].start).toBe('2025-03-03'); // member since is kept
    expect(lobbyGroups(re.state, '2026-11-02').others.some((x) => x.m.id === 'm1')).toBe(true);
    expect(Object.values(re.state.notifications).some((n) => n.kind === 'members.notif.reactivated' && n.toUsers.includes('f1'))).toBe(true);
    expect(() => run(r.state, 'members.reactivate', { memberId: 'm1' }, who(c, 's9'))).toThrow('members.err.notEnded');
    expect(() => run(r.state, 'members.reactivate', { memberId: 'm1' }, who(c, 's1'), later)).toThrow('err.forbidden');
    // an ended record is read-only
    expect(() => run(r.state, 'members.updateDetails', { memberId: 'm1', patch: { address: 'x' } }, who(c, 's9'), later)).toThrow('members.err.memberEnded');
  });
});

describe('notes', () => {
  it('lobby, nurse, teacher and management add notes; kitchen, finance and family may not', () => {
    const c = seed();
    for (const u of ['s1', 's8', 's5', 's9']) {
      const r = run(c.citra, 'note.add', { memberId: 'm1', visibility: 'staff', text: `by ${u}` }, who(c, u));
      expect(Object.values(r.state.memberNotes).some((n) => n.text === `by ${u}` && n.createdBy === `staff:${u}`)).toBe(true);
    }
    for (const u of ['s3', 's10', 'f1']) expect(() => run(c.citra, 'note.add', { memberId: 'm1', visibility: 'staff', text: 'x' }, who(c, u))).toThrow('err.forbidden');
    expect(() => run(c.citra, 'note.add', { memberId: 'm1', visibility: 'staff', text: '  ' }, who(c, 's1'))).toThrow('err.noteRequired');
  });

  it('only the author or management edit and delete; both are logged', () => {
    const c = seed();
    const a = run(c.citra, 'note.add', { memberId: 'm1', visibility: 'staff', text: 'First' }, who(c, 's1'));
    const id = a.result.noteId as string;
    expect(() => run(a.state, 'note.edit', { noteId: id, text: 'Hacked' }, who(c, 's8'))).toThrow('err.forbidden');
    expect(() => run(a.state, 'note.delete', { noteId: id }, who(c, 's8'))).toThrow('err.forbidden');
    const e = run(a.state, 'note.edit', { noteId: id, text: 'First, edited' }, who(c, 's1'));
    expect(e.state.memberNotes[id]).toMatchObject({ text: 'First, edited', editedBy: 'staff:s1' });
    expect(e.state.memberNotes[id].editedAt).toBe(`${T}T10:00`);
    const m = run(e.state, 'note.edit', { noteId: id, text: 'By management' }, who(c, 's9'));
    expect(m.state.memberNotes[id].editedBy).toBe('staff:s9');
    const d = run(m.state, 'note.delete', { noteId: id }, who(c, 's1'));
    expect(d.state.memberNotes[id].deletedAt).toBeTruthy();
    expect(Object.values(d.state.activity).filter((x) => x.memberId === 'm1' && x.key.startsWith('members.feed.note')).map((x) => x.key).sort()).toEqual(['members.feed.noteDeleted', 'members.feed.noteEdited', 'members.feed.noteEdited', 'members.feed.noteStaff']);
    expect(() => run(d.state, 'note.edit', { noteId: id, text: 'again' }, who(c, 's1'))).toThrow('err.notFound');
  });

  it('one shared note is pinned for the family; a new shared note takes over', () => {
    const c = seed();
    const a = run(c.citra, 'note.add', { memberId: 'm1', visibility: 'family', text: 'Loves the garden walk' }, who(c, 's5'));
    const pinned = (s: ClubState) => live(s.memberNotes).filter((n) => n.memberId === 'm1' && n.visibility === 'family' && n.pinned).map((n) => n.id);
    expect(pinned(a.state)).toEqual([a.result.noteId]);
    const b = run(a.state, 'note.edit', { noteId: 'n-m1-1', pinned: true }, who(c, 's9'));
    expect(pinned(b.state)).toEqual(['n-m1-1']);
    const staff = run(b.state, 'note.add', { memberId: 'm1', visibility: 'staff', text: 'Private' }, who(c, 's5'));
    expect(pinned(staff.state)).toEqual(['n-m1-1']);
  });
});

describe('list rules: search, filters, status', () => {
  it('search matches the member, family names and phone numbers in any format', () => {
    const s = seed().citra;
    const find = (q: string) => Object.values(s.members).filter((m) => matchesQuery(s, m, q)).map((m) => m.id).sort();
    expect(find('Laras')).toEqual(['m10']);
    expect(find('laras saputra')).toEqual(['m10']);
    expect(find('0816 1436')).toEqual(['m10']);
    expect(find('+62 816-1436-6582')).toEqual(['m10']);
    expect(find('816143')).toEqual(['m10']);
    expect(find('Wijaya')).toEqual(['m1', 'm46']);
    expect(find('maria')).toEqual(['m1', 'm46']);
    expect(find('zzz')).toEqual([]);
    expect(find('')).toHaveLength(5);
  });

  it('six filters with counts; pending members are listed; ended ones only under Ended', () => {
    const c = seed();
    const rows = rows2(c.citra, T);
    expect(filterCounts(rows)).toEqual({ active: 5, in: 3, att: 2, flex: 2, gold: 3, ended: 0 });
    const r = run(c.citra, 'members.create', newMember(), who(c, 's1'));
    const rows2b = rows2(r.state, T);
    expect(rows2b.find((x) => x.m.id === 'm47')?.st.key).toBe('pending');
    expect(filterCounts(rows2b).active).toBe(6);
    const e = run(c.citra, 'members.end', { memberId: 'm1', lastDay: '2026-10-21', reason: 'movedAway' }, who(c, 's9'));
    const later = rows2(e.state, '2026-10-22');
    expect(later.filter(FILTERS.ended).map((x) => x.m.id)).toEqual(['m1']);
    expect(later.filter(FILTERS.active).map((x) => x.m.id)).not.toContain('m1');
  });

  it('status comes from check-ins: nobody is "expected", a member who has not arrived is simply not here', () => {
    const c = seed();
    const s = c.citra;
    expect(memberStatus(s, s.members.m1, T)).toEqual({ key: 'off', usual: '10:05' });
    expect(memberStatus(s, s.members.m10, T)).toEqual({ key: 'in', at: '09:48' });
    const a = run(s, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, who(c, 's1'));
    expect(memberStatus(a.state, a.state.members.m1, T)).toEqual({ key: 'in', at: '10:00' });
    expect(filterCounts(rows2(a.state, T)).in).toBe(4);
    const o = run(a.state, 'attendance.checkOut', { memberId: 'm1' }, who(c, 's1'), { today: T, nowMin: 900 });
    expect(memberStatus(o.state, o.state.members.m1, T)).toEqual({ key: 'home', at: '15:00' });
    expect(memberStatus(s, s.members.m1, '2026-10-30').key).toBe('closed');
    expect(rows2(s, T).find((r) => r.m.id === 'm1')?.st).toEqual({ key: 'off', usual: '10:05' });
  });

  it('new members are tagged for 30 days only', () => {
    const c = seed();
    const m = run(c.citra, 'members.create', newMember({ start: '2026-10-26' }), who(c, 's9')).state.members.m47;
    expect(isNewMember(m, '2026-10-21')).toBe(true);
    expect(isNewMember(m, '2026-11-24')).toBe(true);
    expect(isNewMember(m, '2026-11-25')).toBe(false);
    expect(isNewMember(c.citra.members.m1, T)).toBe(false);
    expect(nextMemberId(c.citra)).toBe('m47');
  });
});
