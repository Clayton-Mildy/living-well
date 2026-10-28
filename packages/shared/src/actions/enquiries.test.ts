import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, guestsOn, live, updatesFor, actionItems, DomainError, systemUser, type ClubState } from '../index';
import { enquiryByFormToken, formLinkState, leadFunnel, seniorName } from '../rules/enquiries';

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
  it('a free-text title ("Other") is kept as typed on create and edit; empty or too long is refused', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.create', { ...lead, senior: { title: ' Tante ', name: 'Lily Tan' } }, 's1');
    const e = r.state.enquiries[r.result.enquiryId as string];
    expect(e.senior).toEqual({ title: 'Tante', name: 'Lily Tan' });
    expect(seniorName(e)).toBe('Tante Lily Tan');
    expect(run(r.state, 'enquiry.update', { enquiryId: e.id, senior: { title: 'Nyonya', name: 'Lily Tan' } }, 's1').state.enquiries[e.id].senior.title).toBe('Nyonya');
    fails(s, 'enquiry.create', { ...lead, senior: { title: '', name: 'Lily Tan' } }, 's1', 'enq.err.titleRequired');
    fails(s, 'enquiry.create', { ...lead, senior: { title: 'T'.repeat(21), name: 'Lily Tan' } }, 's1', 'err.invalid');
  });
  it('round 15: source Other keeps where the lead heard of us; another source drops it; over 80 characters is refused', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.create', { ...lead, source: 'other', sourceOther: ' Church group ' }, 's1');
    const id = r.result.enquiryId as string;
    expect(r.state.enquiries[id]).toMatchObject({ source: 'other', sourceOther: 'Church group' });
    // text is only kept with Other, and it is optional
    expect(run(s, 'enquiry.create', { ...lead, sourceOther: 'Church group' }, 's1').state.enquiries[id].sourceOther).toBeUndefined();
    expect(run(s, 'enquiry.create', { ...lead, source: 'other' }, 's1').state.enquiries[id].sourceOther).toBeUndefined();
    const r2 = run(r.state, 'enquiry.update', { enquiryId: id, source: 'instagram' }, 's1');
    expect(r2.state.enquiries[id].source).toBe('instagram');
    expect('sourceOther' in r2.state.enquiries[id]).toBe(false);
    // an edit of the text alone, and of the source back to Other with new text
    const r3 = run(r.state, 'enquiry.update', { enquiryId: id, sourceOther: 'Neighbour' }, 's1');
    expect(r3.state.enquiries[id]).toMatchObject({ source: 'other', sourceOther: 'Neighbour' });
    expect(run(r2.state, 'enquiry.update', { enquiryId: id, source: 'other', sourceOther: 'Radio' }, 's1').state.enquiries[id].sourceOther).toBe('Radio');
    expect('sourceOther' in run(r.state, 'enquiry.update', { enquiryId: id, source: 'other', sourceOther: '' }, 's1').state.enquiries[id]).toBe(false);
    expect(run(s, 'enquiry.create', { ...lead, source: 'other', sourceOther: 'x'.repeat(80) }, 's1').state.enquiries[id].sourceOther).toHaveLength(80);
    fails(s, 'enquiry.create', { ...lead, source: 'other', sourceOther: 'x'.repeat(81) }, 's1', 'err.invalid');
    fails(r.state, 'enquiry.update', { enquiryId: id, sourceOther: 'x'.repeat(81) }, 's1', 'err.invalid');
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
  it('a trial is 2 consecutive days (Rp 450.000): no time, lunch and the health check always included, the kitchen and the nurse are told', () => {
    const s = seed().citra;
    const trial = { enquiryId: 'e5', date: '2026-10-22', food: ['peanuts'], drugs: [], mobility: 'walker', diet: ['softFood'] };
    const r = run(s, 'enquiry.bookTrial', trial, 's1');
    expect(r.state.enquiries.e5).toMatchObject({ stage: 'trial', next: { kind: 'trial', date: '2026-10-22' } });
    expect(r.state.enquiries.e5.next).not.toHaveProperty('time');
    const g = guestsOn(r.state, '2026-10-22').find((x) => x.kind === 'trial')!;
    expect(g).toMatchObject({ lunch: true, healthCheck: true, food: ['peanuts'], mobility: 'walker', diet: ['softFood'], name: 'Opa Leo Gunadi', status: 'booked', date: '2026-10-22' });
    expect(g).not.toHaveProperty('time');
    // the second day follows (the next open day) with the same details; the price is the trial fee of the price list
    expect(r.result).toMatchObject({ days: ['2026-10-22', '2026-10-23'], price: 450000 });
    const g2 = guestsOn(r.state, '2026-10-23').find((x) => x.kind === 'trial')!;
    expect(g2).toMatchObject({ id: `${g.id}-2`, enquiryId: 'e5', lunch: true, healthCheck: true, food: ['peanuts'], status: 'booked', date: '2026-10-23' });
    expect(g2).not.toHaveProperty('time');
    const kitchen = user({ citra: r.state }, 's3');
    const nurse = user({ citra: r.state }, 's8');
    expect(updatesFor(r.state, kitchen).some((x) => x.kind === 'enq.notif.trialLunchAllergy' && x.params.date === '22/10 + 23/10' && !('time' in x.params))).toBe(true);
    expect(updatesFor(r.state, nurse).some((x) => x.kind === 'enq.notif.trialHealth')).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'enq.feed.trialBooked' && a.params.date === '22/10 + 23/10' && !('time' in a.params))).toBe(true);
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
    // and the second day moves with it (Friday 23 → Monday 26)
    expect(guestsOn(moved.state, '2026-10-26').filter((x) => x.kind === 'trial').map((x) => x.id)).toEqual([`${g.id}-2`]);
    expect(guestsOn(moved.state, '2026-10-23').filter((x) => x.kind === 'trial')).toHaveLength(1);
    // a trial still needs a day's notice and an open day; it needs no time, so no hours check
    fails(s, 'enquiry.bookTrial', { ...trial, date: T }, 's1', 'enq.err.tooSoon');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-12-25' }, 's1', 'err.closedDay');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-10-29' }, 's1', 'enq.err.outing');
    fails(s, 'enquiry.bookTrial', { ...trial, date: '2026-10-28' }, 's1', 'enq.err.outing'); // the second day is the outing
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
  it('round 15: with the family\'s signature the form is signed in person (three steps, the lead contact signs); without it there is no signing', () => {
    const s = seed().citra;
    const SIG = 'md_testsignature0001';
    const r = run(s, 'enquiry.convert', { ...input, signatureMediaId: SIG, registration: { nickname: 'Lan' } }, 's9');
    const id = r.result.memberId as string;
    const sig = r.state.members[id].documents.find((d) => d.type === 'membershipForm')!.signing!;
    expect(sig).toMatchObject({ status: 'signed', meterai: 'e', signerId: 'fm47_0', signerName: 'Melinda Tjandra', signatureMediaId: SIG });
    expect(sig.steps.map((x) => [x.status, x.at, x.by])).toEqual([['draft', '2026-10-21T10:00', 'staff:s9'], ['sent', '2026-10-21T10:00', 'staff:s9'], ['signed', '2026-10-21T10:00', 'family:fm47_0']]);
    expect(sig.form).toMatchObject({ name: 'Siu Lan Tjandra', nickname: 'Lan', signer: 'Melinda Tjandra', plan: 'flex' });
    const plain = run(seed().citra, 'enquiry.convert', input, 's9');
    expect(plain.state.members[plain.result.memberId as string].documents.find((d) => d.type === 'membershipForm')!.signing).toBeUndefined();
    // a lobby join waits with the member; the signing is there for the countersign after approval
    const gated = run(seed().citra, 'enquiry.convert', { ...input, signatureMediaId: SIG }, 's1');
    expect(gated.state.members[gated.result.memberId as string].documents.find((d) => d.type === 'membershipForm')!.signing).toMatchObject({ status: 'signed', signerId: 'fm47_0' });
  });
  it('round 15: the signature stands in for the scan: signature only is accepted, neither is refused', () => {
    const s = seed().citra;
    const { formMediaId, formFileName, ...noScan } = input;
    void formMediaId; void formFileName;
    const r = run(s, 'enquiry.convert', { ...noScan, signatureMediaId: 'md_testsignature0001' }, 's9');
    const doc = r.state.members[r.result.memberId as string].documents.find((d) => d.type === 'membershipForm')!;
    expect(doc).toMatchObject({ status: 'requested', signing: { status: 'signed', signerId: 'fm47_0' } });
    expect(doc.mediaId).toBeUndefined();
    fails(s, 'enquiry.convert', noScan, 's9', 'enq.err.formRequired');
    fails(s, 'enquiry.convert', { ...noScan, formMediaId: '  ' }, 's9', 'enq.err.formRequired');
  });
  it('Join keeps a free-text title: the member is "Tante ..." with a female gender', () => {
    const s = seed().citra;
    const made = run(s, 'enquiry.create', { ...lead, senior: { title: 'Tante', name: 'Lily Tan' } }, 's9');
    const id = made.result.enquiryId as string;
    const r = run(made.state, 'enquiry.convert', { ...input, enquiryId: id }, 's9');
    expect(r.state.members[r.result.memberId as string]).toMatchObject({ title: 'Tante', firstName: 'Lily', lastName: 'Tan', gender: 'f' });
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
  it('KC round 6: the application form answers typed in when joining land on the member (date of birth, address, health basics, the form answers)', () => {
    const s = seed().citra;
    const reg = { nickname: 'Oma Siu', marital: 'widowed', city: 'Jakarta Barat', selfCare: true, ids: { guarantor: true } };
    const health = { conditions: ['High blood pressure'], diabetic: true, food: ['shellfish'], foodOther: 'Durian', drugs: ['penicillin', 'other:Codeine'], mobility: 'walker', diet: ['lowSalt'] };
    const m = run(s, 'enquiry.convert', { ...input, dob: '1944-05-02', address: 'Jl. Kenanga 3', health, registration: reg }, 's9').state.members.m47;
    expect(m).toMatchObject({ dob: '1944-05-02', address: 'Jl. Kenanga 3', registration: reg });
    expect(m.health).toMatchObject({ conditions: ['High blood pressure'], diabetic: true, food: ['shellfish'], foodOther: 'Durian', drugs: ['penicillin', 'other:Codeine'], mobility: 'walker', diet: ['lowSalt'], meds: [] });
    fails(s, 'enquiry.convert', { ...input, dob: '2026-11-01' }, 's9', 'members.err.dobInvalid'); // not born yet
    fails(s, 'enquiry.convert', { ...input, registration: { email: 'not an email' } }, 's9', 'members.err.emailInvalid');
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

// KC round 10: the online registration link
describe('online registration link', () => {
  const sys = (s: ClubState, name: string, input: unknown, clk = clock) => execute(s, name, input, systemUser('citra'), clk, mid());
  const draft = (over: Record<string, unknown> = {}) => ({
    title: 'Oma', name: 'Rosa Santoso', dob: '1947-05-02', address: 'Jl. Melati 3', contact: { name: 'Dina Santoso', relation: 'daughter', phone: '0812 5550 1234' }, plan: 'gold',
    health: { conditions: ['Hypertension'], diabetic: false, food: ['peanuts'], foodOther: '', drugs: ['penicillin'], mobility: null, diet: [] },
    registration: { nickname: 'Oma Rosa', nik: '3171 0405 4700 0001', dementia: true, dementiaNote: 'Forgets names', postcode: '12730' }, nanny: { name: 'Mbak Sri', nik: '3171234567890001' }, ktp: { ktp: { mediaId: 'md_testktpmember0001', fileName: 'ktp.jpg' }, nannyKtp: { mediaId: 'md_testktpcarer00001', fileName: 'ktp-carer.jpg' } }, lang: 'id', ...over,
  });
  it('lobby sends a link; the family opens and sends the form as the system; staff then see it on the lead', () => {
    const made = run(seed().citra, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    const sent = run(made.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    const token = sent.result.token as string;
    expect(token.length).toBeGreaterThan(16);
    expect(sent.result.path).toBe('/form/' + token);
    expect(formLinkState(sent.state.enquiries[id].form, `${T}T10:00`)).toBe('sent');
    // sending again keeps the same link
    const again = run(sent.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    expect(again.result.token).toBe(token);
    const opened = sys(again.state, 'enquiry.formOpen', { token });
    expect(formLinkState(opened.state.enquiries[id].form, `${T}T10:00`)).toBe('opened');
    const done = sys(opened.state, 'enquiry.formSubmit', { token, draft: draft() });
    const f = done.state.enquiries[id].form!;
    expect(formLinkState(f, `${T}T10:00`)).toBe('submitted');
    expect(f.filledBy).toBe('Dina Santoso');
    expect(f.draft).toMatchObject({ plan: 'gold', dob: '1947-05-02', registration: { nik: '3171040547000001', dementia: true, dementiaNote: 'Forgets names' }, nanny: { name: 'Mbak Sri', nik: '3171234567890001' }, ktp: { ktp: { mediaId: 'md_testktpmember0001' } }, health: { food: ['peanuts'] }, lang: 'id' });
    expect(enquiryByFormToken(done.state, token)?.id).toBe(id);
    expect(updatesFor(done.state, user({ citra: done.state }, 's1')).some((u) => u.kind === 'enq.notif.formSubmitted')).toBe(true);
    // once sent in, it cannot be sent twice or re-linked
    fails(done.state, 'enquiry.sendForm', { enquiryId: id }, 's1', 'enq.err.formDone');
    expect(() => sys(done.state, 'enquiry.formSubmit', { token, draft: draft() })).toThrow(DomainError);
  });
  it('the online form accepts a free-text title; empty or too long is refused', () => {
    const made = run(seed().citra, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    const sent = run(made.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    const token = sent.result.token as string;
    const done = sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ title: 'Tante' }) });
    expect(done.state.enquiries[id].form!.draft).toMatchObject({ title: 'Tante' });
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ title: '' }) })).toThrow('enq.err.titleRequired');
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ title: 'T'.repeat(21) }) })).toThrow('err.invalid');
  });
  it('only the system submits, a wrong token is not found, an expired link is refused, and a bad answer is rejected', () => {
    const made = run(seed().citra, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    const sent = run(made.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    const token = sent.result.token as string;
    fails(sent.state, 'enquiry.formSubmit', { token, draft: draft() }, 's1', 'err.forbidden');
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token: 'nope', draft: draft() })).toThrow(DomainError);
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ registration: { postcode: '12' } }) })).toThrow(DomainError);
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ nanny: { name: 'Mbak Sri' } }) })).toThrow(DomainError); // a carer needs a NIK
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft({ registration: { nik: '123' } }) })).toThrow(DomainError); // 16 digits
    const late = { today: '2026-11-20', nowMin: 600 };
    expect(formLinkState(sent.state.enquiries[id].form, '2026-11-20T10:00')).toBe('expired');
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft() }, late)).toThrow(DomainError);
    // a fresh link after expiry is a new token
    const renewed = run(sent.state, 'enquiry.sendForm', { enquiryId: id }, 's1', late);
    expect(renewed.result.token).not.toBe(token);
  });
});

describe('online registration form: saved for later (round 13)', () => {
  const sys = (s: ClubState, name: string, input: unknown, clk = clock) => execute(s, name, input, systemUser('citra'), clk, mid());
  const linked = () => {
    const made = run(seed().citra, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    const sent = run(made.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    return { id, token: sent.result.token as string, state: sent.state };
  };
  const full = (over: Record<string, unknown> = {}) => ({
    title: 'Oma', name: 'Rosa Santoso', dob: '1947-05-02', address: 'Jl. Melati 3', contact: { name: 'Dina Santoso', relation: 'daughter', phone: '0812 5550 1234' }, plan: 'gold',
    health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en', ...over,
  });
  it('formSave stores a half-filled draft with the step and the time, leniently, and moves the link to inProgress', () => {
    const { id, token, state } = linked();
    const r = sys(state, 'enquiry.formSave', { token, step: 2, expect: null, draft: { title: 'Oma', name: 'Rosa', dob: '', address: 'Jl. Me', contact: { name: 'Din', relation: 'daughter', phone: '0812' }, registration: { postcode: '12', nik: '3171' }, nanny: { name: 'Sri', nik: '12' }, lang: 'id' } });
    const f = r.state.enquiries[id].form!;
    expect(f).toMatchObject({ step: 2, savedAt: `${T}T10:00`, openedAt: `${T}T10:00` });
    expect(f.submittedAt).toBeUndefined();
    expect(f.draft).toMatchObject({ name: 'Rosa', address: 'Jl. Me', contact: { name: 'Din', phone: '0812' }, registration: { postcode: '12' }, nanny: { name: 'Sri', nik: '12' }, lang: 'id' });
    expect(formLinkState(f, `${T}T10:30`)).toBe('inProgress');
    expect(r.result.savedAt).toBe(`${T}T10:00`);
    // saving again replaces the draft and the step; a missing step reads as the first
    const again = sys(r.state, 'enquiry.formSave', { token, step: 4, expect: 1, draft: { name: 'Rosa Santoso' } });
    expect(again.state.enquiries[id].form).toMatchObject({ step: 4, draft: { name: 'Rosa Santoso', title: 'Oma' } });
    expect(sys(r.state, 'enquiry.formSave', { token, expect: 1, draft: {} }).state.enquiries[id].form!.step).toBe(1);
  });
  it('a save carries what the page last saw (expect = the save counter); another phone saving in between makes it a conflict and loses nothing', () => {
    const { id, token, state } = linked();
    const a1 = sys(state, 'enquiry.formSave', { token, step: 1, expect: null, draft: { name: 'Rosa A' } });
    expect(a1.state.enquiries[id].form!.rev).toBe(1);
    expect(a1.result.draftRev).toBe(1);
    // phone B saves on top of what A saved
    const b = sys(a1.state, 'enquiry.formSave', { token, step: 2, expect: 1, draft: { name: 'Rosa B' } });
    expect(b.state.enquiries[id].form).toMatchObject({ rev: 2, step: 2, draft: { name: 'Rosa B' } });
    // phone A, still at rev 1, continues: refused, the lead keeps B's draft
    expect(() => sys(b.state, 'enquiry.formSave', { token, step: 2, expect: 1, draft: { name: 'Rosa A longer' } })).toThrow('enq.err.formConflict');
    expect(() => sys(b.state, 'enquiry.formSave', { token, step: 2, expect: null, draft: { name: 'Rosa A offline' } })).toThrow('enq.err.formConflict');
    expect(b.state.enquiries[id].form!.draft!.name).toBe('Rosa B');
    // choosing to keep A's: resend with the counter the lead is at
    const keep = sys(b.state, 'enquiry.formSave', { token, step: 2, expect: 2, draft: { name: 'Rosa A longer' } });
    expect(keep.state.enquiries[id].form).toMatchObject({ rev: 3, draft: { name: 'Rosa A longer' } });
    // two saves in the same minute still differ by the counter
    expect(keep.state.enquiries[id].form!.savedAt).toBe(b.state.enquiries[id].form!.savedAt);
  });
  it('saving what the lead already has changes nothing (no write, no counter bump) and is never a conflict', () => {
    const { id, token, state } = linked();
    const a = sys(state, 'enquiry.formSave', { token, step: 2, expect: null, draft: { name: 'Rosa A' } });
    const same = execute(a.state, 'enquiry.formSave', { token, step: 2, expect: null, draft: { name: 'Rosa A' } }, systemUser('citra'), clock, mid());
    expect(same.patches).toHaveLength(0);
    expect(same.result).toMatchObject({ draftRev: 1, savedAt: `${T}T10:00` });
    expect(same.state.enquiries[id].form!.rev).toBe(1);
    const stepOnly = sys(a.state, 'enquiry.formSave', { token, step: 3, expect: 1, draft: { name: 'Rosa A' } });
    expect(stepOnly.state.enquiries[id].form).toMatchObject({ rev: 2, step: 3 });
  });
  it('a new link after expiry keeps the saved draft, step and counter', () => {
    const { id, token, state } = linked();
    const saved = sys(state, 'enquiry.formSave', { token, step: 3, expect: null, draft: { name: 'Rosa Kept', address: 'Jl. Me' } });
    const late = { today: '2026-11-20', nowMin: 600 };
    const renewed = run(saved.state, 'enquiry.sendForm', { enquiryId: id }, 's1', late);
    const f = renewed.state.enquiries[id].form!;
    expect(f.token).not.toBe(token);
    expect(f).toMatchObject({ step: 3, rev: 1, savedAt: `${T}T10:00`, draft: { name: 'Rosa Kept', address: 'Jl. Me' } });
    expect(formLinkState(f, '2026-11-20T11:00')).toBe('inProgress');
    // a submitted form is never carried over
    const done = sys(saved.state, 'enquiry.formSubmit', { token, draft: full() });
    expect(() => run(done.state, 'enquiry.sendForm', { enquiryId: id }, 's1', late)).toThrow('enq.err.formDone');
  });
  it('formSave notifies nobody and writes the feed once per link', () => {
    const { id, token, state } = linked();
    const a = sys(state, 'enquiry.formSave', { token, step: 1, expect: null, draft: { name: 'Rosa' } });
    const saved = (st: ClubState) => Object.values(st.activity).filter((x) => x.key === 'enq.feed.formSaved');
    expect(saved(a.state)).toHaveLength(1);
    const b = sys(a.state, 'enquiry.formSave', { token, step: 2, expect: 1, draft: { name: 'Rosa S' } });
    expect(saved(b.state)).toHaveLength(1);
    expect(updatesFor(b.state, user({ citra: b.state }, 's1')).some((u) => u.kind === 'enq.notif.formSubmitted')).toBe(false);
    expect(b.state.enquiries[id].form!.submittedAt).toBeUndefined();
  });
  it('only the system saves; a wrong token, a submitted or expired link and a closed lead are refused; a bad shape is invalid', () => {
    const { id, token, state } = linked();
    fails(state, 'enquiry.formSave', { token, step: 1, draft: {} }, 's1', 'err.forbidden');
    expect(() => sys(state, 'enquiry.formSave', { token: 'nope', step: 1, draft: {} })).toThrow(DomainError);
    expect(() => sys(state, 'enquiry.formSave', { token, step: 1, draft: 'x' })).toThrow('err.invalid');
    expect(() => sys(state, 'enquiry.formSave', { token, step: 1, draft: { registration: 5, health: 7 } })).not.toThrow(); // junk fields are cleaned, not fatal
    expect(() => sys(state, 'enquiry.formSave', { token, step: 1, draft: {} }, { today: '2026-11-20', nowMin: 600 })).toThrow('enq.err.formExpired');
    const done = sys(state, 'enquiry.formSubmit', { token, draft: full() });
    expect(() => sys(done.state, 'enquiry.formSave', { token, step: 1, draft: {} })).toThrow('enq.err.formDone');
    const lost = run(state, 'enquiry.markLost', { enquiryId: id, reason: 'price' }, 's1');
    expect(() => sys(lost.state, 'enquiry.formSave', { token, step: 1, draft: {} })).toThrow('enq.err.notOpen');
  });
  it('formSubmit still works after saves and replaces the partial draft', () => {
    const { id, token, state } = linked();
    const saved = sys(state, 'enquiry.formSave', { token, step: 3, expect: null, draft: { name: 'Ros' } });
    const done = sys(saved.state, 'enquiry.formSubmit', { token, draft: full() });
    const f = done.state.enquiries[id].form!;
    expect(formLinkState(f, `${T}T11:00`)).toBe('submitted');
    expect(f.draft).toMatchObject({ name: 'Rosa Santoso', plan: 'gold' });
  });
});

describe('lead history (round 13)', () => {
  const stages = (s: ClubState, id: string) => (s.enquiries[id].history ?? []).map((m) => m.stage + (m.undo ? '*' : ''));
  it('create starts the history with the new move; every stage move, booking, lost and reopen appends one', () => {
    const made = run(seed().citra, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    expect(made.state.enquiries[id].history).toEqual([{ stage: 'new', at: '2026-10-21T10:00', by: 'staff:s1' }]);
    let s = run(made.state, 'enquiry.move', { enquiryId: id, stage: 'visit' }, 's1').state;
    expect(stages(s, id)).toEqual(['new', 'visit']);
    s = run(s, 'enquiry.bookVisit', { enquiryId: id, date: '2026-10-23', time: '11:00' }, 's1').state;
    expect(s.enquiries[id].history!.at(-1)).toMatchObject({ stage: 'visit', date: '2026-10-23', by: 'staff:s1', at: '2026-10-21T10:00' });
    s = run(s, 'enquiry.bookTrial', { enquiryId: id, date: '2026-10-26', food: [], drugs: [], mobility: null, diet: [] }, 's1').state;
    expect(s.enquiries[id].history!.at(-1)).toMatchObject({ stage: 'trial', date: '2026-10-26' });
    s = run(s, 'enquiry.markLost', { enquiryId: id, reason: 'price', note: 'Too dear' }, 's9').state;
    expect(s.enquiries[id].history!.at(-1)).toMatchObject({ stage: 'lost', reason: 'price', by: 'staff:s9' });
    expect(s.enquiries[id].lost?.note).toBe('Too dear');
    s = run(s, 'enquiry.reopen', { enquiryId: id }, 's9').state;
    expect(s.enquiries[id].history!.at(-1)).toMatchObject({ stage: 'new', undo: true });
    const n = s.enquiries[id].history!.length;
    s = run(s, 'enquiry.archive', { enquiryId: id }, 's1').state;
    expect(s.enquiries[id].history).toHaveLength(n); // archiving is not a move
  });
  it('booking the same stage again changes the last move instead of adding a second one', () => {
    let s = seed().citra;
    s = run(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2026-10-23', time: '11:00' }, 's1').state;
    s = run(s, 'enquiry.bookVisit', { enquiryId: 'e3', date: '2026-10-27', time: '14:00' }, 's9').state;
    expect(stages(s, 'e3')).toEqual(['new', 'visit']);
    expect(s.enquiries.e3.history!.at(-1)).toMatchObject({ stage: 'visit', date: '2026-10-27', by: 'staff:s9' });
    s = run(s, 'enquiry.bookTrial', { enquiryId: 'e3', date: '2026-10-26', food: [], drugs: [], mobility: null, diet: [] }, 's1').state;
    s = run(s, 'enquiry.bookTrial', { enquiryId: 'e3', date: '2026-10-27', food: [], drugs: [], mobility: null, diet: [] }, 's1').state;
    expect(stages(s, 'e3')).toEqual(['new', 'visit', 'trial']);
    expect(s.enquiries.e3.history!.at(-1)).toMatchObject({ stage: 'trial', date: '2026-10-27' });
    // e2 (a seeded visit) rebooked: still one visit move
    const e2 = run(seed().citra, 'enquiry.bookVisit', { enquiryId: 'e2', date: '2026-10-27', time: '15:00' }, 's1').state;
    expect(stages(e2, 'e2')).toEqual(['new', 'visit']);
  });
  it('a move back to an earlier stage is an undo move; a lead without a history gets the first move filled in', () => {
    let s = seed().citra;
    delete s.enquiries.e1.history;
    s = run(s, 'enquiry.move', { enquiryId: 'e1', stage: 'visit' }, 's1').state;
    expect(stages(s, 'e1')).toEqual(['new', 'visit*']);
    expect(s.enquiries.e1.history![0]).toMatchObject({ stage: 'new', at: s.enquiries.e1.createdAt, by: s.enquiries.e1.createdBy });
  });
  it('a join by management is a joined move; a lobby join that is rejected or withdrawn leaves an undo move and is not counted', () => {
    const input = { enquiryId: 'e1', plan: 'flex', start: '2026-10-26', ...paper };
    const direct = run(seed().citra, 'enquiry.convert', input, 's9');
    expect(direct.state.enquiries.e1.history!.at(-1)).toMatchObject({ stage: 'joined', by: 'staff:s9' });
    expect(leadFunnel(direct.state, '2026-10-01', '2026-10-31').joined).toBe(1);

    const gated = run(seed().citra, 'enquiry.convert', input, 's1');
    expect(gated.state.enquiries.e1.history!.at(-1)).toMatchObject({ stage: 'joined', by: 'staff:s1' });
    expect(leadFunnel(gated.state, '2026-10-01', '2026-10-31').joined).toBe(0); // waiting for management
    const crId = gated.result.changeRequestId as string;
    const rej = run(gated.state, 'review.reject', { crId, note: 'No' }, 's9').state;
    expect(rej.enquiries.e1.history!.at(-1)).toMatchObject({ stage: 'trial', undo: true, by: 'staff:s9' });
    expect(leadFunnel(rej, '2026-10-01', '2026-10-31').joined).toBe(0);
    const wd = run(gated.state, 'review.withdraw', { crId }, 's1').state;
    expect(wd.enquiries.e1.history!.at(-1)).toMatchObject({ stage: 'trial', undo: true, by: 'staff:s1' });
    const ok = run(gated.state, 'review.approve', { crId }, 's9').state;
    expect(leadFunnel(ok, '2026-10-01', '2026-10-31').joined).toBe(1);
  });
});

describe('plans from the catalogue (round 15)', () => {
  const withPlans = () => {
    const s = structuredClone(seed().citra);
    s.club.settings.plans = [{ id: 'plan_1', name: 'Flex 8', kind: 'days', quota: 8, active: true }, { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false }];
    return s;
  };
  const input = { enquiryId: 'e1', start: '2026-10-26', ...paper };
  it('enquiry.convert accepts an active catalogue plan and refuses a retired or unknown one', () => {
    const s = withPlans();
    const r = run(s, 'enquiry.convert', { ...input, plan: 'plan_1' }, 's9');
    const m = r.state.members[r.result.memberId as string];
    expect(m.plans[0].plan).toBe('plan_1');
    expect(Object.values(r.state.activity).find((a) => a.key === 'enq.feed.joined')?.params).toMatchObject({ plan: 'Flex 8', planId: 'Flex 8' }); // the lead's feed names the plan, not its id
    fails(s, 'enquiry.convert', { ...input, plan: 'plan_2' }, 's9', 'err.invalid');
    fails(s, 'enquiry.convert', { ...input, plan: 'plan_9' }, 's9', 'err.invalid');
  });
  it('the online form takes an active catalogue plan; a retired one is dropped from a saved draft and refused on submit', () => {
    const s = withPlans();
    const sys = (st: ClubState, name: string, inp: unknown) => execute(st, name, inp, systemUser('citra'), clock, mid());
    const made = run(s, 'enquiry.create', lead, 's1');
    const id = made.result.enquiryId as string;
    const sent = run(made.state, 'enquiry.sendForm', { enquiryId: id }, 's1');
    const token = sent.result.token as string;
    const draft = (plan: string) => ({
      title: 'Oma', name: 'Rosa Santoso', dob: '1947-05-02', address: 'Jl. Melati 3', contact: { name: 'Dina Santoso', relation: 'daughter', phone: '0812 5550 1234' }, plan,
      health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en',
    });
    expect(sys(sent.state, 'enquiry.formSave', { token, step: 4, expect: null, draft: draft('plan_1') }).state.enquiries[id].form!.draft).toMatchObject({ plan: 'plan_1' });
    expect(sys(sent.state, 'enquiry.formSave', { token, step: 4, expect: null, draft: draft('plan_2') }).state.enquiries[id].form!.draft!.plan).toBeUndefined();
    expect(sys(sent.state, 'enquiry.formSubmit', { token, draft: draft('plan_1') }).state.enquiries[id].form!.draft).toMatchObject({ plan: 'plan_1' });
    expect(() => sys(sent.state, 'enquiry.formSubmit', { token, draft: draft('plan_2') })).toThrow('err.invalid');
  });
});
