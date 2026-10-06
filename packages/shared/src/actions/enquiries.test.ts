import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, systemUser, guestsOn, live, updatesFor, actionItems, DomainError, type ClubState, type MembershipForm } from '../index';

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
const fullForm = (over: Partial<MembershipForm> = {}): Partial<MembershipForm> => ({
  title: 'Oma', name: 'Rosa Santoso', dob: '1946-03-09', address: 'Jl. Melati 5, Jakarta', contact: { name: 'Dina Santoso', relation: 'daughter', phone: '+6281255501234' }, nanny: null,
  docs: { ktp: true, nannyKtp: false, healthInfo: false }, conditions: ['Diabetes'], meds: [{ name: 'Metformin', dose: '500 mg', timing: 'lunchClub' }], food: ['peanuts'], drugs: ['sulfa', 'other:latex'], mobility: 'walker',
  diet: ['lowSalt', 'softFood'], consent: { data: true, face: false }, signature: { svgPath: 'M10 10 L 40 40', at: '', by: '' }, ...over,
});

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

describe('the membership form', () => {
  const sys = (s: ClubState) => systemUser(s.clubId);
  const pub = (s: ClubState, name: string, input: unknown) => execute(s, name, input, sys(s), clock, mid());

  it('send creates a request with a deterministic token and the link path; resending reuses it', () => {
    const a = seed().citra, b = seed().citra;
    const r1 = execute(a, 'form.send', { target: { type: 'enquiry', id: 'e3' } }, user({ citra: a }, 's1'), clock, 'mfix');
    const r2 = execute(b, 'form.send', { target: { type: 'enquiry', id: 'e3' } }, user({ citra: b }, 's1'), clock, 'mfix');
    expect(r1.result.token).toBe(r2.result.token);
    expect(r1.result.link).toBe(`/form/${r1.result.token}`);
    const f = live(r1.state.formRequests).find((x) => x.token === r1.result.token)!;
    expect(f).toMatchObject({ status: 'sent', target: { type: 'enquiry', id: 'e3' }, sentTo: '+6281190342215' });
    expect(r1.state.enquiries.e3.formToken).toBe(f.token);
    const again = run(r1.state, 'form.send', { target: { type: 'enquiry', id: 'e3' } }, 's1');
    expect(again.result.token).toBe(f.token);
    expect(live(again.state.formRequests)).toHaveLength(live(r1.state.formRequests).length);
    fails(a, 'form.send', { target: { type: 'enquiry', id: 'e1' } }, 's1', 'enq.err.formReady');
    fails(a, 'form.send', { target: { type: 'enquiry', id: 'nope' } }, 's1', 'err.notFound');
    expect(() => run(a, 'form.send', { target: { type: 'enquiry', id: 'e3' } }, 's8')).toThrow('err.forbidden');
  });
  it('a form can also be sent to an existing member (the primary contact gets it)', () => {
    const s = seed().citra;
    const r = run(s, 'form.send', { target: { type: 'member', id: 'm1' } }, 's1');
    const f = live(r.state.formRequests).find((x) => x.token === r.result.token)!;
    expect(f).toMatchObject({ target: { type: 'member', id: 'm1' }, sentTo: '+6281210904471', status: 'sent' });
  });
  it('public actions run as the system user and check the token', () => {
    const s = seed().citra;
    const open = pub(s, 'form.open', { token: 'b4c9e5' });
    expect(Object.values(open.state.formRequests).find((f) => f.token === 'b4c9e5')!.status).toBe('opened');
    expect(() => run(s, 'form.open', { token: 'b4c9e5' }, 's9')).toThrow('err.forbidden');
    expect(() => pub(s, 'form.open', { token: 'nope' })).toThrow('err.forbidden');
    expect(() => run(s, 'form.submit', { token: 'b4c9e5', data: fullForm() }, 's1')).toThrow('err.forbidden');
  });
  it('drafts save step by step and drop anything invalid', () => {
    const s = seed().citra;
    const r = pub(s, 'form.saveDraft', { token: 'b4c9e5', step: 3, draft: { name: '  Leo  ', food: ['peanuts', 'rocks'], hack: 1, signature: { svgPath: '<script>', at: '', by: '' }, mobility: 'jetpack', dob: '31/02/1940' } });
    const f = Object.values(r.state.formRequests).find((x) => x.token === 'b4c9e5')!;
    expect(f).toMatchObject({ status: 'draft', step: 3, draft: { name: 'Leo', food: ['peanuts'], dob: '', signature: null } });
    expect((f.draft as Record<string, unknown>).hack).toBeUndefined();
    expect(f.draft!.mobility).toBeUndefined();
  });
  it('submit needs the required answers and then marks the form ready; it is locked afterwards', () => {
    const s = seed().citra;
    const tok = 'b4c9e5';
    const bad = (data: Partial<MembershipForm>, code: string) => { try { pub(s, 'form.submit', { token: tok, data }); throw new Error('should fail'); } catch (e) { expect((e as DomainError).code).toBe(code); } };
    bad(fullForm({ name: '' }), 'form.err.name');
    bad(fullForm({ dob: '' }), 'form.err.dob');
    bad(fullForm({ dob: '2030-01-01' }), 'form.err.dob');
    bad(fullForm({ contact: { name: 'Dina', relation: 'daughter', phone: '12' } }), 'form.err.phone');
    bad(fullForm({ nanny: undefined }), 'form.err.nanny');
    bad(fullForm({ nanny: { name: ' ' } }), 'form.err.nannyName');
    bad(fullForm({ mobility: undefined }), 'form.err.mobility');
    bad(fullForm({ consent: { data: false, face: true } }), 'form.err.consent');
    bad(fullForm({ signature: null }), 'form.err.signature');
    const r = pub(s, 'form.submit', { token: tok, data: fullForm() });
    const f = Object.values(r.state.formRequests).find((x) => x.token === tok)!;
    expect(f.status).toBe('submitted');
    expect(f.submittedAt).toBe('2026-10-21T10:00');
    expect(f.data).toMatchObject({ name: 'Rosa Santoso', dob: '1946-03-09', mobility: 'walker', consent: { data: true, face: false }, drugs: ['sulfa', 'other:latex'], signature: { by: 'Dina Santoso', at: '2026-10-21T10:00' } });
    expect(f.draft).toBeUndefined();
    expect(() => pub(r.state, 'form.saveDraft', { token: tok, step: 1, draft: {} })).toThrow('form.err.locked');
    expect(() => pub(r.state, 'form.submit', { token: tok, data: fullForm() })).toThrow('form.err.locked');
    // the lobby sees it as ready to review
    expect(actionItems(r.state, user({ citra: r.state }, 's1'), T, 600).some((i) => i.kind === 'notif.act.formReady' && i.params.name === 'Opa Leo Gunadi')).toBe(true);
  });
  it('a lead\'s form is not approved on its own: approving means joining (plan and first day), so there is no approved lead without a member', () => {
    const s = seed().citra;
    fails(s, 'form.approve', { formId: 'fr-e1' }, 's1', 'enq.err.approveViaJoin');
    fails(s, 'form.approve', { formId: 'fr-e1' }, 's9', 'enq.err.approveViaJoin');
    expect(s.formRequests['fr-e1'].status).toBe('submitted'); // nothing changed
    fails(s, 'form.approve', { formId: 'fr-e5' }, 's9', 'enq.err.notReady'); // not submitted yet
    // joining is what approves it
    const joined = run(s, 'enquiry.convert', { enquiryId: 'e1', plan: 'gold', start: '2026-10-26' }, 's9');
    expect(joined.state.formRequests['fr-e1']).toMatchObject({ status: 'approved', reviewedBy: 'staff:s9' });
    expect(joined.state.enquiries.e1).toMatchObject({ stage: 'joined', memberId: 'm47' });
    expect(actionItems(joined.state, user({ citra: joined.state }, 's1'), T, 600).some((i) => i.kind === 'notif.act.formReady')).toBe(false);
    expect(actionItems(s, user({ citra: s }, 's1'), T, 600).some((i) => i.kind === 'notif.act.formReady')).toBe(true);
  });
  it('return for changes and let the family fix it', () => {
    const s = seed().citra;
    const ret = run(s, 'form.return', { formId: 'fr-e1', note: 'Please add the KTP photo' }, 's9');
    const f = ret.state.formRequests['fr-e1'];
    expect(f).toMatchObject({ status: 'returned', returnNote: 'Please add the KTP photo', step: 6 });
    expect(f.data).toBeUndefined();
    expect(f.draft?.name).toBe('Siu Lan Tjandra');
    fails(s, 'form.return', { formId: 'fr-e1', note: ' ' }, 's1', 'err.invalid');
    const fixed = execute(ret.state, 'form.submit', { token: 'f7e1a2', data: { ...f.draft, docs: { ktp: true, nannyKtp: true, healthInfo: true } } }, systemUser('citra'), clock, mid());
    expect(fixed.state.formRequests['fr-e1']).toMatchObject({ status: 'submitted' });
    expect(fixed.state.formRequests['fr-e1'].returnNote).toBeUndefined();
  });
  it("an existing member's form changes documents and consent only after management approves", () => {
    const s = seed().citra;
    const sent = run(s, 'form.send', { target: { type: 'member', id: 'm46' } }, 's1');
    const token = sent.result.token as string;
    const sub = execute(sent.state, 'form.submit', { token, data: fullForm({ docs: { ktp: true, nannyKtp: false, healthInfo: true }, consent: { data: true, face: false } }) }, systemUser('citra'), clock, mid());
    const before = JSON.stringify(sub.state.members.m46.consents);
    expect(JSON.stringify(sub.state.members.m46.consents)).toBe(JSON.stringify(s.members.m46.consents));
    const cr = live(sub.state.changeRequests).find((c) => c.action === 'form.applyMember')!;
    expect(cr).toMatchObject({ kind: 'approval', status: 'pending', section: 'docsConsent', target: { type: 'member', id: 'm46' }, submittedBy: 'family:f1' });
    expect(cr.changes.map((c) => c.field)).toEqual(['documents', 'consents']);
    // a lobby user cannot approve it (it goes through Reviews); management can
    fails(sub.state, 'form.approve', { formId: Object.values(sub.state.formRequests).find((f) => f.token === token)!.id }, 's1', 'enq.err.inReviews');
    const ok = run(sub.state, 'review.approve', { crId: cr.id }, 's9');
    const m = ok.state.members.m46;
    expect(m.consents.find((c) => c.kind === 'face')).toMatchObject({ granted: false, via: 'form', byName: 'Dina Santoso' });
    expect(m.consents.find((c) => c.kind === 'data')?.granted).toBe(true);
    expect(m.documents.find((d) => d.type === 'healthInfo')).toMatchObject({ status: 'onFile', via: 'form' });
    expect(JSON.stringify(m.consents)).not.toBe(before);
    expect(Object.values(ok.state.formRequests).find((f) => f.token === token)!.status).toBe('approved');
    expect(ok.state.changeRequests[cr.id].status).toBe('approved');
  });
});

describe('joining a lead', () => {
  const input = { enquiryId: 'e1', plan: 'flex', start: '2026-10-26' };

  it('management joins a lead at once: every form field lands on the member, the contact can sign in', () => {
    const s = seed().citra;
    const r = run(s, 'enquiry.convert', input, 's9');
    expect(r.reviewed).toBeUndefined();
    const id = r.result.memberId as string;
    expect(id).toBe('m47');
    const m = r.state.members[id];
    expect(m).toMatchObject({
      title: 'Oma', firstName: 'Siu Lan', lastName: 'Tjandra', gender: 'f', dob: '1944-02-14', address: 'Jl. Kemang Selatan VIII no. 21, Jakarta Selatan', nanny: { name: 'Mbak Wati' }, usualArrival: '10:00',
    });
    expect(m.review).toBeUndefined();
    expect(m.memberships).toEqual([{ start: '2026-10-26' }]);
    expect(m.plans).toEqual([{ from: '2026-10-26', plan: 'flex', by: 'staff:s9' }]); // members come on any open day: no usual days
    expect(m.health).toMatchObject({ conditions: ['High blood pressure'], food: ['shellfish'], drugs: ['penicillin'], mobility: 'walkingStick', diet: [], diabetic: false });
    expect(m.health.meds).toEqual([{ id: 'm47-med1', name: 'Amlodipine', dose: '5 mg', timing: 'morningHome' }]);
    expect(m.documents.map((d) => [d.type, d.status])).toEqual([['ktp', 'onFile'], ['nannyKtp', 'onFile'], ['membershipForm', 'onFile'], ['healthInfo', 'onFile']]);
    expect(m.consents.map((c) => [c.kind, c.granted, c.via, c.byName])).toEqual([['data', true, 'form', 'Melinda Tjandra'], ['face', true, 'form', 'Melinda Tjandra']]);
    expect('escortDefaults' in m || 'transport' in m).toBe(false); // no escorts and no transport defaults
    expect(m.billing.va).toMatch(/^8808\d{12}$/);
    const c = r.state.familyContacts.fm47_0;
    expect(c).toMatchObject({ name: 'Melinda Tjandra', firstName: 'Melinda', phone: '+6281277812290' });
    expect(r.state.familyLinks['fm47_0:m47']).toMatchObject({ familyId: 'fm47_0', memberId: 'm47', relation: 'daughter', primary: true, appAccess: true });
    expect(r.state.enquiries.e1).toMatchObject({ stage: 'joined', memberId: 'm47', next: { kind: 'starts', date: '2026-10-26' } });
    expect(r.state.formRequests['fr-e1'].status).toBe('approved');
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
    expect(cr.createdRows?.map((x) => x.coll).sort()).toEqual(['familyContacts', 'familyLinks', 'members']);
    expect(r.state.members.m47.review).toEqual({ status: 'pending', crId });
    expect(r.state.familyContacts.fm47_0.review?.status).toBe('pending');
    expect(r.state.enquiries.e1.stage).toBe('joined');
    expect(r.state.enquiries.e1.prevStage).toBe('trial');
    expect(r.state.formRequests['fr-e1']).toMatchObject({ status: 'approved', reviewedBy: 'staff:s1' }); // approving the form and joining are one step
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
    // the form is not left approved without a member: it is ready to review again
    expect(rej.state.formRequests['fr-e1'].status).toBe('submitted');
    expect(rej.state.formRequests['fr-e1'].reviewedBy).toBeUndefined();
    expect(actionItems(rej.state, user({ citra: rej.state }, 's1'), T, 600).some((i) => i.kind === 'notif.act.formReady')).toBe(true);
    expect(rej.state.members.m47.deletedAt).toBeDefined();
    expect(getUser({ citra: rej.state }, 'fm47_0')).toBeNull();
    expect(updatesFor(rej.state, user({ citra: rej.state }, 's1')).some((x) => x.kind === 'notif.reviewRejected')).toBe(true);
  });
  it('face opt-out and missing form details are respected', () => {
    let s = seed().citra;
    s = execute(s, 'form.send', { target: { type: 'enquiry', id: 'e3' } }, user({ citra: s }, 's1'), clock, mid()).state;
    const token = s.enquiries.e3.formToken!;
    s = execute(s, 'form.submit', { token, data: fullForm({ name: 'Ellen Sutanto', contact: { name: 'Kevin Sutanto', relation: 'grandchild', phone: '0811 9034 2215' }, nanny: { name: 'Mbak Ani' }, docs: { ktp: false, nannyKtp: false, healthInfo: true } }) }, systemUser('citra'), clock, mid()).state;
    const r = run(s, 'enquiry.convert', { enquiryId: 'e3', plan: 'gold', start: '2026-10-26' }, 's9');
    const m = r.state.members[r.result.memberId as string];
    expect(m.consents.find((c) => c.kind === 'face')?.granted).toBe(false);
    expect(m.health).toMatchObject({ diabetic: true, diet: ['lowSalt', 'softFood'], drugs: ['sulfa', 'other:latex'], food: ['peanuts'], mobility: 'walker' });
    expect(m.documents.find((d) => d.type === 'ktp')?.status).toBe('requested');
    expect(m.documents.find((d) => d.type === 'nannyKtp')?.status).toBe('requested');
    expect(m.plans[0]).toMatchObject({ plan: 'gold', from: '2026-10-26' });
    expect(r.state.familyLinks[`${r.result.familyId}:${m.id}`].relation).toBe('grandchild');
  });
  it('a lead without a form still becomes a member, and an existing contact is linked instead of duplicated', () => {
    let s = seed().citra;
    s = run(s, 'enquiry.create', { ...lead, contact: { ...lead.contact, phone: '+62 812-1090-4471' } }, 's1').state; // Maria's number
    const r = run(s, 'enquiry.convert', { enquiryId: 'e10', plan: 'gold', start: '2026-10-26' }, 's9');
    const m = r.state.members[r.result.memberId as string];
    expect(m).toMatchObject({ title: 'Oma', firstName: 'Rosa', lastName: 'Santoso', dob: null, address: null, consents: [] });
    expect(m.documents.every((d) => d.status === 'requested')).toBe(true);
    expect(r.result.familyId).toBe('f1');
    expect(live(r.state.familyContacts)).toHaveLength(live(s.familyContacts).length);
    expect(r.state.familyLinks[`f1:${m.id}`]).toMatchObject({ primary: true, appAccess: true });
  });
  it('validation: start must be an open day today or later; lost and archived leads cannot join', () => {
    const s = seed().citra;
    fails(s, 'enquiry.convert', { ...input, start: '2026-10-24' }, 's9', 'err.closedDay');
    fails(s, 'enquiry.convert', { ...input, start: '2026-10-20' }, 's9', 'enq.err.startPast');
    fails(s, 'enquiry.convert', { ...input, enquiryId: 'e9' }, 's9', 'enq.err.notOpen');
    fails(s, 'enquiry.convert', { enquiryId: 'e1', plan: 'flex' }, 's9', 'err.invalid'); // a start date is needed, but no usual days
    fails(s, 'enquiry.convert', { ...input, plan: 'platinum' }, 's9', 'err.invalid');
    expect(() => run(s, 'enquiry.convert', input, 's8')).toThrow('err.forbidden');
    expect(() => run(s, 'enquiry.convert', input, 'f1')).toThrow('err.forbidden');
  });
});
