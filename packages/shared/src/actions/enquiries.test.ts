import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, guestsOn, live, updatesFor, actionItems, DomainError, type ClubState } from '../index';

const T = '2026-10-21'; // Wednesday
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const mid = () => `t${++n}`;
const seed = () => buildSeed();
const user = (clubs: Record<string, ClubState>, id: string) => getUser(clubs, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, user({ citra: s }, uid), clk, mid());
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try {
    run(s, name, input, uid, clk);
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const lead = { senior: { title: 'Oma', name: 'Rosa Santoso' }, contact: { name: 'Dina Santoso', relation: 'daughter', phone: '0812 5550 1234' }, source: 'referral' };
/** The signed paper registration form, already uploaded (POST /api/media): the id and the file name. */
const paper = { formMediaId: 'md_testregistrationform01', formFileName: 'registration-form.jpg' };

describe('leads', () => {
  it('lobby and management can add a lead; others cannot', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.create', lead, 's1');
    const id = r.result.enquiryId as string;
    expect(id).toBe('e10');
    const e = r.state.enquiries[id];
    expect(e).toMatchObject({ stage: 'new', senior: { title: 'Oma', name: 'Rosa Santoso' }, contact: { relation: 'daughter', phone: '+6281255501234' } });
    expect(e.next).toEqual({ kind: 'callBack', date: '2026-10-22' });
    expect(updatesFor(r.state, user({ citra: r.state }, 's9')).some((x) => x.kind === 'enq.notif.newLead')).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'enq.feed.leadAdded')).toBe(true);
    expect(() => run(s, 'enquiry.create', lead, 's8')).toThrow('err.forbidden');
    expect(() => run(s, 'enquiry.create', lead, 'f1')).toThrow('err.forbidden');
    fails(s, 'enquiry.create', { ...lead, senior: { title: 'Oma', name: ' ' } }, 's1', 'err.invalid');
    fails(s, 'enquiry.create', { ...lead, contact: { ...lead.contact, phone: '12' } }, 's1', 'err.invalid');
  });
  it('edit changes the lead and keeps booked visit names in step', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.update', { enquiryId: 'e2', senior: { title: 'Bapak', name: 'Yusuf H. Hamid' }, notes: 'Prefers mornings' }, 's1');
    expect(r.state.enquiries.e2.senior.name).toBe('Yusuf H. Hamid');
    expect(r.state.enquiries.e2.notes).toBe('Prefers mornings');
    expect(r.state.guestVisits['g-e2'].name).toBe('Bapak Yusuf H. Hamid');
    const r2 = run(r.state, 'enquiry.update', { enquiryId: 'e2', notes: '' }, 's9');
    expect(r2.state.enquiries.e2.notes).toBeUndefined();
  });
  it('move: forward needs no booking, back drops the trial booking, joined and lost are guarded', () => {
    let s = seed().citra;
    s = run(s, 'enquiry.move', { enquiryId: 'e3', stage: 'visit' }, 's1').state;
    expect(s.enquiries.e3.stage).toBe('visit');
    expect(s.enquiries.e3.next).toEqual({ kind: 'visit' });
    // e1 has a trial booked today: moving it back to a visit cancels the trial
    const back = run(s, 'enquiry.move', { enquiryId: 'e1', stage: 'visit' }, 's1');
    expect(back.state.guestVisits['g-e1'].status).toBe('cancelled');
    expect(guestsOn(back.state, T).map((g) => g.id)).not.toContain('g-e1');
    fails(s, 'enquiry.move', { enquiryId: 'e9', stage: 'new' }, 's1', 'enq.err.reopenFirst');
    fails(s, 'enquiry.move', { enquiryId: 'e3', stage: 'visit' }, 's1', 'err.noChanges');
    fails(s, 'enquiry.move', { enquiryId: 'e3', stage: 'joined' }, 's1', 'err.invalid');
  });
  it('lost, reopen and archive', () => {
    let s = seed().citra;
    const lost = run(s, 'enquiry.markLost', { enquiryId: 'e2', reason: 'price', note: 'Too far' }, 's1');
    expect(lost.state.enquiries.e2).toMatchObject({ stage: 'lost', lost: { reason: 'price', note: 'Too far', prevStage: 'visit' } });
    expect(lost.state.enquiries.e2.next).toBeUndefined();
    expect(lost.state.guestVisits['g-e2'].status).toBe('cancelled');
    s = run(lost.state, 'enquiry.reopen', { enquiryId: 'e2' }, 's9').state;
    expect(s.enquiries.e2.stage).toBe('new');
    expect(s.enquiries.e2.lost).toBeUndefined();
    fails(s, 'enquiry.reopen', { enquiryId: 'e3' }, 's1', 'enq.err.notLost');
    fails(s, 'enquiry.markLost', { enquiryId: 'e3', reason: 'nonsense' }, 's1', 'err.invalid');
    const arch = run(s, 'enquiry.archive', { enquiryId: 'e3' }, 's1');
    expect(arch.state.enquiries.e3.archivedAt).toBe('2026-10-21T10:00');
    const back = run(arch.state, 'enquiry.archive', { enquiryId: 'e3', restore: true }, 's1');
    expect(back.state.enquiries.e3.archivedAt).toBeUndefined();
  });
});

describe('visits and trials', () => {
  it('book a visit with a picked time; it shows for staff on that day', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2026-10-22', time: '11:30' }, 's1');
    expect(r.state.enquiries.e3).toMatchObject({ stage: 'visit', next: { kind: 'visit', date: '2026-10-22', time: '11:30' } });
    const g = guestsOn(r.state, '2026-10-22');
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ kind: 'visit', time: '11:30', name: 'Oma Ellen Sutanto', escortName: 'Kevin Sutanto', status: 'booked', enquiryId: 'e3' });
    // rebooking moves the same visit
    const r2 = run(r.state, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2026-10-23', time: '09:00' }, 's9');
    expect(guestsOn(r2.state, '2026-10-22')).toHaveLength(0);
    expect(guestsOn(r2.state, '2026-10-23').map((x) => x.id)).toEqual([g[0].id]);
  });
  it('visits are blocked on weekends, closures, holidays and outings, in the past, and outside club hours', () => {
    const s = seed().citra;
    const book = (date: string, time: string) => ({ enquiryId: 'e3', date, time });
    fails(s, 'enquiry.bookVisit', book('2026-10-24', '10:00'), 's1', 'err.closedDay'); // Saturday
    fails(s, 'enquiry.bookVisit', book('2026-10-30', '10:00'), 's1', 'err.closedDay'); // staff training closure
    fails(s, 'enquiry.bookVisit', book('2026-12-25', '10:00'), 's1', 'err.closedDay'); // Christmas
    fails(s, 'enquiry.bookVisit', book('2026-10-29', '10:00'), 's1', 'enq.err.outing');
    fails(s, 'enquiry.bookVisit', book('2026-10-20', '10:00'), 's1', 'enq.err.past');
    fails(s, 'enquiry.bookVisit', book(T, '09:00'), 's1', 'enq.err.pastTime');
    fails(s, 'enquiry.bookVisit', book('2026-10-22', '17:30'), 's1', 'enq.err.hours');
    fails(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2026-10-22' }, 's1', 'err.invalid');
    expect(run(s, 'enquiry.bookVisit', book(T, '14:30'), 's1').state.enquiries.e3.next?.time).toBe('14:30');
  });
  it('date handling follows the clock, not a fixed month', () => {
    const s = seed().citra;
    const later = { today: '2027-02-03', nowMin: 9 * 60 };
    const r = run(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2027-02-05', time: '10:00' }, 's1', later);
    expect(r.state.guestVisits[Object.keys(r.state.guestVisits).find((k) => k.startsWith('g-e3'))!].date).toBe('2027-02-05');
    fails(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2027-02-02', time: '10:00' }, 's1', 'enq.err.past', later);
  });
  it('a trial is a day pass: a day only, lunch and the health check always included, the kitchen and the nurse are told', () => {
    const s = seed().citra;
    const trial = { enquiryId: 'e5', date: '2026-10-22', food: ['peanuts'], drugs: [], mobility: 'walker', diet: ['softFood'] };
    const r = run(s, 'enquiry.bookTrial', trial, 's1');
    expect(r.state.enquiries.e5).toMatchObject({ stage: 'trial', next: { kind: 'trial', date: '2026-10-22' } });
    expect(r.state.enquiries.e5.next).not.toHaveProperty('time');
    const g = guestsOn(r.state, '2026-10-22').find((x) => x.kind === 'trial')!;
    expect(g).toMatchObject({ lunch: true, healthCheck: true, food: ['peanuts'], mobility: 'walker', diet: ['softFood'], name: 'Opa Leo Gunadi', status: 'booked', date: '2026-10-22' });
    expect(g).not.toHaveProperty('time');
    const kitchen = user({ citra: r.state }, 's3');
    const nurse = user({ citra: r.state }, 's8');
    expect(updatesFor(r.state, kitchen).some((x) => x.kind === 'enq.notif.trialLunchAllergy' && x.params.date === '22/10' && !('time' in x.params))).toBe(true);
    expect(updatesFor(r.state, nurse).some((x) => x.kind === 'enq.notif.trialHealth')).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'enq.feed.trialBooked' && a.params.date === '22/10' && !('time' in a.params))).toBe(true);
    // unknown allergies: the kitchen is asked to find out; the nurse is told in every case
    const unknown = run(s, 'enquiry.bookTrial', { ...trial, food: null }, 's9');
    expect(updatesFor(unknown.state, kitchen).some((x) => x.kind === 'enq.notif.trialLunchUnknown')).toBe(true);
    expect(updatesFor(unknown.state, nurse).some((x) => x.kind === 'enq.notif.trialHealth')).toBe(true);
    // a time, lunch or health check in the input is ignored: nobody can book a trial without lunch or without the check
    const old = run(s, 'enquiry.bookTrial', { ...trial, time: '10:00', lunch: false, healthCheck: false }, 's1');
    const og = guestsOn(old.state, '2026-10-22').find((x) => x.kind === 'trial')!;
    expect(og).toMatchObject({ lunch: true, healthCheck: true });
    expect(og).not.toHaveProperty('time');
    expect(updatesFor(old.state, kitchen).some((x) => x.kind.startsWith('enq.notif.trialLunch'))).toBe(true);
    // rebooking moves the same trial and keeps it without a time
    const moved = run(r.state, 'enquiry.bookTrial', { ...trial, date: '2026-10-23' }, 's9');
    expect(guestsOn(moved.state, '2026-10-22').filter((x) => x.kind === 'trial')).toHaveLength(0);
    const mg = guestsOn(moved.state, '2026-10-23').filter((x) => x.kind === 'trial');
    expect(mg).toHaveLength(1);
    expect(mg[0].id).toBe(g.id);
    expect(mg[0]).not.toHaveProperty('time');
    // a trial still needs a day's notice and an open day; it needs no time, so no hours check
    fails(s, 'enquiry.bookTrial', { ...trial, date: T }, 's1', 'enq.err.tooSoon');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-12-25' }, 's1', 'err.closedDay');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-10-29' }, 's1', 'enq.err.outing');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-10-25' }, 's1', 'err.closedDay');
    fails(s, 'enquiry.bookTrial', { ...trial, date: undefined }, 's1', 'err.invalid');
    fails(s, 'enquiry.bookTrial', { ...trial, food: ['kryptonite'] }, 's1', 'err.invalid');
    expect(() => run(s, 'enquiry.bookTrial', trial, 's5')).toThrow('err.forbidden');
  });
  it('moving a lead back to a visit keeps the trial that is gone; a lead with a trial but no time shows its day as the next step', () => {
    let s = seed().citra;
    s = run(s, 'enquiry.bookTrial', { enquiryId: 'e5', date: '2026-10-22', food: [], drugs: [], mobility: null, diet: [] }, 's1').state;
    expect(s.enquiries.e5.next).toEqual({ kind: 'trial', date: '2026-10-22' });
    const back = run(s, 'enquiry.move', { enquiryId: 'e5', stage: 'visit' }, 's1');
    expect(back.state.enquiries.e5.stage).toBe('visit');
    expect(guestsOn(back.state, '2026-10-22').some((x) => x.kind === 'trial')).toBe(false); // the trial booking was cancelled
    // moving to Trial from New again with a booked trial elsewhere keeps its day and no time
    const reopened = run(run(s, 'enquiry.markLost', { enquiryId: 'e5', reason: 'other', note: '' }, 's1').state, 'enquiry.reopen', { enquiryId: 'e5', stage: 'trial' }, 's1');
    expect(reopened.state.enquiries.e5.stage).toBe('trial');
  });
});

describe('joining a lead (registration is on paper)', () => {
  const input = { enquiryId: 'e1', plan: 'flex', start: '2026-10-26', ...paper };

  it('there is no online form any more: no form actions, no form requests', () => {
    const s = seed().citra;
    expect('formRequests' in s).toBe(false);
    for (const name of ['form.send', 'form.open', 'form.saveDraft', 'form.submit', 'form.approve', 'form.return', 'form.applyMember']) expect(() => run(s, name, {}, 's9')).toThrow();
    expect(s.enquiries.e1).not.toHaveProperty('formToken');
  });
  it('the signed paper form is required: no file, no member', () => {
    const s = seed().citra;
    fails(s, 'enquiry.convert', { enquiryId: 'e1', plan: 'flex', start: '2026-10-26' }, 's9', 'enq.err.formRequired');
    fails(s, 'enquiry.convert', { ...input, formMediaId: '  ' }, 's9', 'enq.err.formRequired');
    fails(s, 'enquiry.convert', { ...input, formMediaId: 'not-a-media-id' }, 's9', 'err.invalid');
    expect(s.enquiries.e1.stage).toBe('trial');
  });
  it('management joins a lead at once: the lead details land on the member with the paper form on file, the contact can sign in', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.convert', input, 's9');
    expect(r.reviewed).toBeUndefined();
    const id = r.result.memberId as string;
    expect(id).toBe('m47');
    const m = r.state.members[id];
    expect(m).toMatchObject({ title: 'Oma', firstName: 'Siu Lan', lastName: 'Tjandra', gender: 'f', dob: null, address: null, nanny: null, usualArrival: '10:00' });
    expect(m.review).toBeUndefined();
    expect(m.memberships).toEqual([{ start: '2026-10-26' }]);
    expect(m.plans).toEqual([{ from: '2026-10-26', plan: 'flex', by: 'staff:s9' }]); // members come on any open day: no usual days
    expect(m.documents.map((d) => [d.type, d.status])).toEqual([['ktp', 'requested'], ['membershipForm', 'onFile'], ['healthInfo', 'requested']]);
    expect(m.documents.find((d) => d.type === 'membershipForm')).toEqual({
      id: 'm47-doc-form', type: 'membershipForm', status: 'onFile', mediaId: 'md_testregistrationform01', fileName: 'registration-form.jpg', on: T, via: 'staff', by: 'staff:s9',
    });
    expect('escortDefaults' in m || 'transport' in m).toBe(false); // no escorts and no transport defaults
    expect(m.billing.va).toMatch(/^8808\d{12}$/);
    const c = r.state.familyContacts.fm47_0;
    expect(c).toMatchObject({ name: 'Melinda Tjandra', firstName: 'Melinda', phone: '+6281277812290' });
    expect(r.state.familyLinks['fm47_0:m47']).toMatchObject({ familyId: 'fm47_0', memberId: 'm47', relation: 'daughter', primary: true, appAccess: true });
    expect(r.state.enquiries.e1).toMatchObject({ stage: 'joined', memberId: 'm47', next: { kind: 'starts', date: '2026-10-26' } });
    expect('bookings' in r.state).toBe(false); // nothing is booked: the member simply comes on any open day
    // history and welcome message
    expect(Object.values(r.state.activity).some((a) => a.key === 'enq.feed.joined' && a.memberId === 'm47')).toBe(true);
    const fam = user({ citra: r.state }, 'fm47_0');
    expect(fam.kind).toBe('family');
    expect(updatesFor(r.state, fam).some((x) => x.kind === 'enq.notif.welcome')).toBe(true);
    expect(findByPhone({ citra: r.state }, '0812 7781 2290')).toMatchObject({ ok: true });
    // the trial that no longer happens is closed
    expect(r.state.guestVisits['g-e1'].status).toBe('cancelled');
    fails(r.state, 'enquiry.convert', input, 's9', 'enq.err.alreadyMember');
  });
  it('lobby joining is a gated create: pending until management approves; then the contact signs in', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.convert', input, 's1');
    expect(r.reviewed).toBe('gate');
    const crId = r.result.changeRequestId as string;
    const cr = r.state.changeRequests[crId];
    expect(cr).toMatchObject({ kind: 'approval', op: 'create', section: 'conversion', status: 'pending', submittedBy: 'staff:s1', target: { type: 'enquiry', id: 'e1', memberId: 'm47' } });
    expect((cr.input as { formMediaId?: string }).formMediaId).toBe('md_testregistrationform01'); // management sees which file was attached
    expect(cr.createdRows?.map((x) => x.coll).sort()).toEqual(['familyContacts', 'familyLinks', 'members']);
    expect(r.state.members.m47.review).toEqual({ status: 'pending', crId });
    expect(r.state.members.m47.documents.find((d) => d.type === 'membershipForm')).toMatchObject({ status: 'onFile', mediaId: 'md_testregistrationform01', by: 'staff:s1' });
    expect(r.state.familyContacts.fm47_0.review?.status).toBe('pending');
    expect(r.state.enquiries.e1.stage).toBe('joined');
    expect(r.state.enquiries.e1.prevStage).toBe('trial');
    // not signed in yet, can't be checked in
    expect(getUser({ citra: r.state }, 'fm47_0')).toBeNull();
    expect(findByPhone({ citra: r.state }, '0812 7781 2290')).toMatchObject({ ok: false, reason: 'pending' });
    expect(() => run(r.state, 'attendance.checkIn', { memberId: 'm47', method: 'manual' }, 's1')).toThrow();
    expect(actionItems(r.state, user({ citra: r.state }, 's9'), T, 600).some((i) => i.id === 'cr:' + crId)).toBe(true);
    // management approves
    const ok = run(r.state, 'review.approve', { crId }, 's9');
    expect(ok.state.members.m47.review?.status).toBe('approved');
    expect(ok.state.familyContacts.fm47_0.activatedAt).toBe('2026-10-21T10:00');
    expect(getUser({ citra: ok.state }, 'fm47_0')?.kind).toBe('family');
    expect(findByPhone({ citra: ok.state }, '0812 7781 2290')).toMatchObject({ ok: true });
    expect(ok.state.enquiries.e1).toMatchObject({ stage: 'joined', memberId: 'm47' });
    expect(ok.state.enquiries.e1.prevStage).toBeUndefined();
    expect(updatesFor(ok.state, user({ citra: ok.state }, 'fm47_0')).some((x) => x.kind === 'enq.notif.welcome')).toBe(true);
    expect(updatesFor(ok.state, user({ citra: ok.state }, 's1')).some((x) => x.kind === 'notif.reviewApproved')).toBe(true);
  });
  it('a rejected joining puts the lead back where it was', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.convert', input, 's1');
    const crId = r.result.changeRequestId as string;
    const rej = run(r.state, 'review.reject', { crId, note: 'Waiting for the deposit' }, 's9');
    const e = rej.state.enquiries.e1;
    expect(e).toMatchObject({ stage: 'trial', next: { kind: 'trial', date: T } }); // a trial is a day pass: no time
    expect(e.memberId).toBeUndefined();
    expect(e.prevStage).toBeUndefined();
    expect(rej.state.members.m47.deletedAt).toBeDefined();
    expect(getUser({ citra: rej.state }, 'fm47_0')).toBeNull();
    expect(updatesFor(rej.state, user({ citra: rej.state }, 's1')).some((x) => x.kind === 'notif.reviewRejected')).toBe(true);
  });
  it('an existing contact is linked instead of duplicated, and a lead that came in without details still becomes a member', () => {
    let s = seed().citra;
    s = run(s, 'enquiry.create', { ...lead, contact: { ...lead.contact, phone: '+62 812-1090-4471' } }, 's1').state; // Maria's number
    const r = run(s, 'enquiry.convert', { enquiryId: 'e10', plan: 'gold', start: '2026-10-26', ...paper }, 's9');
    const m = r.state.members[r.result.memberId as string];
    expect(m).toMatchObject({ title: 'Oma', firstName: 'Rosa', lastName: 'Santoso', dob: null, address: null, consents: [] });
    expect(m.documents.find((d) => d.type === 'membershipForm')?.mediaId).toBe('md_testregistrationform01');
    expect(r.result.familyId).toBe('f1');
    expect(live(r.state.familyContacts)).toHaveLength(live(s.familyContacts).length);
    expect(r.state.familyLinks[`f1:${m.id}`]).toMatchObject({ primary: true, appAccess: true });
  });
  it('validation: start must be an open day today or later; lost and archived leads cannot join', () => {
    const s = seed().citra;
    fails(s, 'enquiry.convert', { ...input, start: '2026-10-24' }, 's9', 'err.closedDay');
    fails(s, 'enquiry.convert', { ...input, start: '2026-10-20' }, 's9', 'enq.err.startPast');
    fails(s, 'enquiry.convert', { ...input, enquiryId: 'e9' }, 's9', 'enq.err.notOpen');
    fails(s, 'enquiry.convert', { enquiryId: 'e1', plan: 'flex', formMediaId: 'md_testregistrationform01' }, 's9', 'err.invalid'); // a start date is needed
    fails(s, 'enquiry.convert', { ...input, plan: 'platinum' }, 's9', 'err.invalid');
    expect(() => run(s, 'enquiry.convert', input, 's8')).toThrow('err.forbidden');
    expect(() => run(s, 'enquiry.convert', input, 'f1')).toThrow('err.forbidden');
  });
});
