import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, systemUser, live, priceOn, surveyStats, updatesFor, actionItems, liveSurvey, ratingLinkOf, DomainError, type ClubState } from '../index';
import { appFamilies, audienceRecipients, broadcastRecipients, checkVenueSlot, resolveSurveyAudience, surveyMembers, venueClash } from '../rules/mgmt';

const T = '2026-10-21'; // Wednesday
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const mid = () => `c${++n}`;
const seed = () => buildSeed();
const user = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, user(s, uid), clk, mid());
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
/** Run as management of CitraPremier against another clubhouse (the server does the same with the ?club= parameter). */
const onAdina = (adina: ClubState, name: string, input: unknown) => execute(adina, name, input, user(seed().citra, 's9'), clock, mid());
const tick = (s: ClubState, clk: { today: string; nowMin: number }) => execute(s, 'jobs.tick', {}, systemUser(s.clubId), clk, mid());
const booking = { org: 'Yayasan Kasih Bunda choir', contactName: 'Ibu Lusi Tan', phone: '0813 6611 2290', guests: 25, roomId: 'room-music', date: '2026-11-14', from: '13:00', to: '17:00', price: 2500000, deposit: 500000 };

describe('venue', () => {
  it('books any future date, with price and deposit, for management only', () => {
    const s = seed().citra;
    const r = run(s, 'venue.book', booking, 's9');
    const id = r.result.venueId as string;
    expect(id).toBe('v5');
    expect(r.state.venueBookings[id]).toMatchObject({ org: 'Yayasan Kasih Bunda choir', phone: '+6281366112290', guests: 25, status: 'confirmed', price: 2500000, deposit: 500000, createdBy: 'staff:s9' });
    expect(Object.values(r.state.activity).some((a) => a.key === 'mgmt.feed.venueBooked' && a.params.org === 'Yayasan Kasih Bunda choir')).toBe(true);
    // far in the future, not just the next ten days
    expect(run(s, 'venue.book', { ...booking, date: '2027-06-12' }, 's9').state.venueBookings.v5.date).toBe('2027-06-12');
    for (const uid of ['s1', 's8', 's10', 'f1']) expect(() => run(s, 'venue.book', booking, uid)).toThrow('err.forbidden');
    fails(s, 'venue.book', { ...booking, org: '' }, 's9', 'err.invalid');
    fails(s, 'venue.book', { ...booking, guests: 0 }, 's9', 'err.invalid');
    fails(s, 'venue.book', { ...booking, price: -5 }, 's9', 'err.invalid');
    fails(s, 'venue.book', { ...booking, roomId: 'room-kitchen' }, 's9', 'mgmt.err.venueRoom');
  });
  it('clash check: overlapping times in the same room; "Whole club" clashes with every room', () => {
    const s = seed().citra;
    // v1: Whole club, Sat 24 Oct 09:00-13:00
    fails(s, 'venue.book', { ...booking, date: '2026-10-24', roomId: 'room-lounge', from: '12:00', to: '14:00' }, 's9', 'mgmt.err.venueClash');
    expect(run(s, 'venue.book', { ...booking, date: '2026-10-24', roomId: 'room-lounge', from: '13:00', to: '15:00' }, 's9').result.venueId).toBe('v5'); // starts when v1 ends
    // v2: Garden room, Sat 31 Oct 08:00-12:00
    fails(s, 'venue.book', { ...booking, date: '2026-10-31', roomId: 'room-garden-room', from: '11:00', to: '13:00' }, 's9', 'mgmt.err.venueClash');
    expect(run(s, 'venue.book', { ...booking, date: '2026-10-31', roomId: 'room-music', from: '08:00', to: '12:00' }, 's9').state.venueBookings.v5.roomId).toBe('room-music');
    fails(s, 'venue.book', { ...booking, date: '2026-10-31', roomId: 'room-whole', from: '10:00', to: '11:00' }, 's9', 'mgmt.err.venueClash');
    try { run(s, 'venue.book', { ...booking, date: '2026-10-31', roomId: 'room-garden-room', from: '11:00', to: '13:00' }, 's9'); } catch (e) { expect((e as DomainError).params).toMatchObject({ org: 'Bank Prima Nusantara retirees’ morning', from: '08:00', to: '12:00' }); }
    expect(venueClash(s, { roomId: 'room-music', date: '2026-10-24', from: '10:00', to: '11:00' })?.id).toBe('v1');
    // cancelled bookings free the slot
    const cancelled = run(s, 'venue.cancel', { venueId: 'v2' }, 's9').state;
    expect(run(cancelled, 'venue.book', { ...booking, date: '2026-10-31', roomId: 'room-garden-room', from: '11:00', to: '13:00' }, 's9').result.venueId).toBe('v5');
  });
  it('blocked on open club days during club hours, on outings and on closures', () => {
    const s = seed().citra;
    const b = (date: string, from: string, to: string) => ({ ...booking, date, from, to });
    fails(s, 'venue.book', b('2026-10-22', '10:00', '12:00'), 's9', 'mgmt.err.venueClubHours'); // Thursday, club open
    fails(s, 'venue.book', b('2026-10-22', '16:00', '18:00'), 's9', 'mgmt.err.venueClubHours');
    expect(run(s, 'venue.book', b('2026-10-22', '17:00', '20:00'), 's9').result.venueId).toBe('v5');
    expect(run(s, 'venue.book', b('2026-10-22', '06:30', '08:30'), 's9').result.venueId).toBe('v5');
    fails(s, 'venue.book', b('2026-10-29', '18:00', '20:00'), 's9', 'mgmt.err.venueOuting');
    fails(s, 'venue.book', b('2026-10-30', '18:00', '20:00'), 's9', 'mgmt.err.venueClosed');
    expect(run(s, 'venue.book', b('2026-10-25', '09:00', '12:00'), 's9').result.venueId).toBe('v5'); // Sunday
    expect(run(s, 'venue.book', b('2026-12-25', '09:00', '12:00'), 's9').result.venueId).toBe('v5'); // national holiday
    fails(s, 'venue.book', b('2026-10-20', '17:00', '20:00'), 's9', 'mgmt.err.venuePast');
    fails(s, 'venue.book', b(T, '07:00', '08:00'), 's9', 'mgmt.err.venuePast'); // earlier today
    fails(s, 'venue.book', b('2026-11-14', '15:00', '14:00'), 's9', 'mgmt.err.venueTimes');
    fails(s, 'venue.book', b('2026-11-14', '20:00', '23:30'), 's9', 'mgmt.err.venueLate');
    expect(checkVenueSlot(s, { roomId: 'room-lounge', date: '2026-11-14', from: '09:00', to: '12:00' }, T, '10:00').ok).toBe(true);
  });
  it('edit and cancel', () => {
    let s = seed().citra;
    const up = run(s, 'venue.update', { venueId: 'v1', price: 4000000, deposit: null, contactName: 'Ibu Santi W.' }, 's9');
    expect(up.state.venueBookings.v1).toMatchObject({ price: 4000000, contactName: 'Ibu Santi W.' });
    expect(up.state.venueBookings.v1.deposit).toBeUndefined();
    // moving re-checks clashes but ignores itself
    expect(run(s, 'venue.update', { venueId: 'v1', from: '09:30', to: '12:30' }, 's9').state.venueBookings.v1.from).toBe('09:30');
    fails(s, 'venue.update', { venueId: 'v1', date: '2026-10-31' }, 's9', 'mgmt.err.venueClash');
    fails(s, 'venue.update', { venueId: 'v1', date: '2026-10-22', from: '10:00', to: '11:00' }, 's9', 'mgmt.err.venueClubHours');
    // a finished event can still be tidied up (price, notes) but not moved
    expect(run(s, 'venue.update', { venueId: 'v4', price: 3000000 }, 's9').state.venueBookings.v4.price).toBe(3000000);
    fails(s, 'venue.update', { venueId: 'v4', date: '2026-10-18' }, 's9', 'mgmt.err.venuePast');
    const c = run(s, 'venue.cancel', { venueId: 'v1' }, 's9');
    expect(c.state.venueBookings.v1.status).toBe('cancelled');
    s = c.state;
    fails(s, 'venue.cancel', { venueId: 'v1' }, 's9', 'mgmt.err.venueCancelled');
    fails(s, 'venue.update', { venueId: 'v1', price: 1 }, 's9', 'mgmt.err.venueCancelled');
    fails(seed().citra, 'venue.cancel', { venueId: 'v4' }, 's9', 'mgmt.err.venueDone');
    fails(seed().citra, 'venue.cancel', { venueId: 'nope' }, 's9', 'err.notFound');
  });
  it('after the event: ask for a review, record it, create the invoice (simulated)', () => {
    const later = { today: '2026-11-02', nowMin: 10 * 60 };
    const s = seed().citra;
    fails(s, 'venue.askReview', { venueId: 'v1' }, 's9', 'mgmt.err.venueNotDone');
    fails(s, 'venue.recordReview', { venueId: 'v1', stars: 5, text: 'x' }, 's9', 'mgmt.err.venueNotDone');
    const asked = run(s, 'venue.askReview', { venueId: 'v1' }, 's9', later);
    expect(asked.state.venueBookings.v1).toMatchObject({ reviewAskedAt: '2026-11-02T10:00', surveyId: 'svv1' });
    expect(asked.state.venueBookings.v1.ratingToken).toBeTruthy();
    // asking again sends the same link
    expect(run(asked.state, 'venue.askReview', { venueId: 'v1' }, 's9', later).state.venueBookings.v1.ratingToken).toBe(asked.state.venueBookings.v1.ratingToken);
    const rev = run(asked.state, 'venue.recordReview', { venueId: 'v1', stars: 4, text: 'Great morning, thank you' }, 's9', later);
    expect(rev.state.venueBookings.v1.review).toEqual({ stars: 4, text: 'Great morning, thank you' });
    fails(rev.state, 'venue.askReview', { venueId: 'v1' }, 's9', 'mgmt.err.venueReviewed', later);
    fails(s, 'venue.recordReview', { venueId: 'v4', stars: 6, text: '' }, 's9', 'err.invalid', later);
    const inv = run(s, 'venue.createInvoice', { venueId: 'v1' }, 's9');
    expect(inv.state.venueBookings.v1.invoiceRef).toBe('VEN-2610-001');
    fails(inv.state, 'venue.createInvoice', { venueId: 'v1' }, 's9', 'mgmt.err.venueInvoiced');
    expect(updatesFor(inv.state, user(inv.state, 's10')).some((x) => x.kind === 'mgmt.notif.venueInvoice' && x.params.amount === 'Rp 3.500.000')).toBe(true);
    const noPrice = run(s, 'venue.book', { ...booking, price: undefined }, 's9');
    fails(noPrice.state, 'venue.createInvoice', { venueId: 'v5' }, 's9', 'mgmt.err.venuePrice');
  });
});

describe('broadcast', () => {
  it('audiences count real people with a phone, once each', () => {
    const s = seed().citra;
    expect(audienceRecipients(s, 'families', T)).toHaveLength(6);
    expect(audienceRecipients(s, 'enquiries', T).map((r) => r.name)).toEqual(['Melinda Tjandra', 'Ilham Hamid', 'Kevin Sutanto', 'Felicia Gunadi']); // by next step
    expect(audienceRecipients(s, 'staff', T)).toHaveLength(10);
    expect(broadcastRecipients(s, ['families', 'enquiries', 'staff'], T)).toHaveLength(20);
    // a lead that is also a family contact is messaged once
    const dupe = run(s, 'enquiry.create', { senior: { title: 'Opa', name: 'Tio' }, contact: { name: 'Maria W', relation: 'daughter', phone: '+62 812-1090-4471' }, source: 'other' }, 's1').state;
    expect(broadcastRecipients(dupe, ['families', 'enquiries'], T)).toHaveLength(6 + 4);
    // ended members' families and leads that were lost or archived are left out
    const lost = run(s, 'enquiry.markLost', { enquiryId: 'e2', reason: 'price', note: '' }, 's1').state;
    expect(audienceRecipients(lost, 'enquiries', T)).toHaveLength(3);
    expect(audienceRecipients(seed().adina, 'families', T)).toHaveLength(0);
  });
  it('sends now: sent, counted, simulated WhatsApp, in-app updates for people with the app', () => {
    const s = seed().citra;
    const r = run(s, 'broadcast.send', { template: 'closure', message: 'Friday 6 November for maintenance', audiences: ['families', 'staff'] }, 's9');
    const b = r.state.broadcasts[r.result.broadcastId as string];
    expect(b).toMatchObject({ template: 'closure', status: 'sent', recipients: 16, sendAt: '2026-10-21T10:00', sentAt: '2026-10-21T10:00', audiences: ['families', 'staff'] });
    expect(updatesFor(r.state, user(r.state, 'f1')).some((x) => x.kind === 'mgmt.notif.bc_closure' && x.params.text === 'Friday 6 November for maintenance')).toBe(true);
    expect(updatesFor(r.state, user(r.state, 's8')).some((x) => x.kind === 'mgmt.notif.bc_closure')).toBe(true);
    expect(Object.values(r.state.notifications).some((x) => x.toUsers.includes('s7'))).toBe(false); // the driver has no app access
    expect(Object.values(r.state.activity).some((a) => a.key === 'mgmt.feed.broadcast' && a.params.n === 16)).toBe(true);
    fails(s, 'broadcast.send', { template: 'update', message: '  ', audiences: ['families'] }, 's9', 'err.invalid');
    fails(s, 'broadcast.send', { template: 'update', message: 'Hi', audiences: [] }, 's9', 'err.invalid');
    fails(s, 'broadcast.send', { template: 'update', message: 'Hi', audiences: ['pets'] }, 's9', 'err.invalid');
    expect(() => onAdina(seed().adina, 'broadcast.send', { template: 'update', message: 'Hi', audiences: ['families'] })).toThrow('mgmt.err.noRecipients');
    for (const uid of ['s1', 'f1']) expect(() => run(s, 'broadcast.send', { template: 'update', message: 'Hi', audiences: ['families'] }, uid)).toThrow('err.forbidden');
  });
  it('schedule, edit, cancel; a scheduled send fires when the clock passes it (jobs.tick)', () => {
    const s = seed().citra;
    const sched = run(s, 'broadcast.schedule', { template: 'event', message: 'batik museum outing, Thursday 26 November', audiences: ['families'], sendAt: '2026-10-21T15:00' }, 's9');
    const id = sched.result.broadcastId as string;
    expect(sched.state.broadcasts[id]).toMatchObject({ status: 'scheduled', sendAt: '2026-10-21T15:00', recipients: 6 });
    fails(s, 'broadcast.schedule', { template: 'event', message: 'x', audiences: ['families'], sendAt: '2026-10-21T10:00' }, 's9', 'mgmt.err.pastTime');
    fails(s, 'broadcast.schedule', { template: 'event', message: 'x', audiences: ['families'], sendAt: 'tomorrow' }, 's9', 'err.invalid');
    // not yet: nothing happens
    expect(tick(sched.state, { today: T, nowMin: 14 * 60 + 59 }).patches).toHaveLength(0);
    // a new lead joins the audience before it goes out: the count is taken when it fires
    const edited = run(sched.state, 'broadcast.update', { broadcastId: id, message: 'batik museum outing, Thursday 26 November (bus leaves 09:00)', audiences: ['families', 'enquiries'], sendAt: '2026-10-21T15:30' }, 's9');
    expect(edited.state.broadcasts[id]).toMatchObject({ audiences: ['families', 'enquiries'], sendAt: '2026-10-21T15:30', recipients: 10 });
    expect(tick(edited.state, { today: T, nowMin: 15 * 60 + 15 }).patches).toHaveLength(0);
    const fired = tick(edited.state, { today: T, nowMin: 15 * 60 + 31 });
    expect(fired.state.broadcasts[id]).toMatchObject({ status: 'sent', sentAt: '2026-10-21T15:31', recipients: 10 });
    expect(updatesFor(fired.state, user(fired.state, 'f2')).some((x) => x.kind === 'mgmt.notif.bc_event')).toBe(true);
    expect(Object.values(fired.state.activity).some((a) => a.key === 'mgmt.feed.broadcast' && a.at === '2026-10-21T15:31')).toBe(true);
    // firing is once only
    expect(tick(fired.state, { today: T, nowMin: 15 * 60 + 40 }).patches).toHaveLength(0);
    fails(fired.state, 'broadcast.cancel', { broadcastId: id }, 's9', 'mgmt.err.notScheduled');
    fails(fired.state, 'broadcast.update', { broadcastId: id, message: 'late' }, 's9', 'mgmt.err.notScheduled');
    // a scheduled send on a later day goes out when that day's clock passes it
    const nextDay = run(s, 'broadcast.schedule', { template: 'update', message: 'Hello', audiences: ['staff'], sendAt: '2026-10-22T08:00' }, 's9');
    expect(tick(nextDay.state, { today: T, nowMin: 23 * 60 }).patches).toHaveLength(0);
    expect(tick(nextDay.state, { today: '2026-10-22', nowMin: 8 * 60 }).state.broadcasts[nextDay.result.broadcastId as string].status).toBe('sent');
  });
  it('a cancelled schedule never fires', () => {
    const s = seed().citra;
    const sched = run(s, 'broadcast.schedule', { template: 'update', message: 'Hello', audiences: ['families'], sendAt: '2026-10-21T11:00' }, 's9');
    const id = sched.result.broadcastId as string;
    const c = run(sched.state, 'broadcast.cancel', { broadcastId: id }, 's9');
    expect(c.state.broadcasts[id].status).toBe('cancelled');
    expect(tick(c.state, { today: T, nowMin: 12 * 60 }).patches).toHaveLength(0);
    fails(c.state, 'broadcast.cancel', { broadcastId: id }, 's9', 'mgmt.err.notScheduled');
    fails(s, 'broadcast.cancel', { broadcastId: 'bc1' }, 's9', 'mgmt.err.notScheduled'); // already sent in the seed
  });
  it('templates are editable', () => {
    const s = seed().citra;
    const r = run(s, 'template.upsert', { id: 'tpl-update', title: 'News', text: 'Dear {name}, {msg}' }, 's9');
    expect(r.state.club.settings.broadcastTemplates.find((t) => t.id === 'tpl-update')).toMatchObject({ title: 'News', text: 'Dear {name}, {msg}', key: 'update' });
    const add = run(r.state, 'template.upsert', { title: 'Reminder', text: 'Hello {name}, reminder: {msg}' }, 's9');
    expect(add.state.club.settings.broadcastTemplates.at(-1)).toMatchObject({ id: 'tpl-custom-1', key: 'custom', title: 'Reminder' });
    fails(s, 'template.upsert', { id: 'tpl-update', title: 'News', text: 'No placeholder' }, 's9', 'mgmt.err.tplMsg');
    fails(s, 'template.upsert', { id: 'nope', title: 'News', text: '{msg}' }, 's9', 'err.notFound');
    expect(run(add.state, 'template.remove', { id: 'tpl-custom-1' }, 's9').state.club.settings.broadcastTemplates).toHaveLength(3);
    fails(s, 'template.remove', { id: 'tpl-update' }, 's9', 'mgmt.err.tplBuiltIn');
    expect(() => run(s, 'template.upsert', { id: 'tpl-update', title: 'x', text: '{msg}' }, 's1')).toThrow('err.forbidden');
  });
});

describe('surveys', () => {
  const draft = { title: 'November check-in', questions: ['team', 'comment'], teamStaffIds: ['s1', 's8', 's5'] };
  const ALL = ['f1', 'f2', 'fm10_0', 'fm20_0', 'fm2_0', 'fm2_1']; // every family contact with the app (sorted by id)
  it('create a draft with a team picked from staff, edit it, then send to every family with the app', () => {
    const s = seed().citra;
    const c = run(s, 'survey.create', draft, 's9');
    const id = c.result.surveyId as string;
    // the draft already shows who it would go to (everyone with the app is the default)
    expect(c.state.surveys[id]).toMatchObject({ status: 'draft', title: 'November check-in', questions: ['team', 'comment'], custom: [], teamStaffIds: ['s1', 's8', 's5'], audience: { mode: 'all' }, recipients: ALL });
    expect(c.result.recipients).toBe(6);
    const up = run(c.state, 'survey.update', { surveyId: id, title: 'November check-in 2', teamStaffIds: ['s1', 's3'], questions: ['team', 'recommend'] }, 's9');
    expect(up.state.surveys[id]).toMatchObject({ title: 'November check-in 2', teamStaffIds: ['s1', 's3'], questions: ['team', 'recommend'], audience: { mode: 'all' }, recipients: ALL });
    fails(s, 'survey.create', { ...draft, teamStaffIds: ['s99'] }, 's9', 'err.invalid');
    fails(s, 'survey.create', { ...draft, teamStaffIds: [] }, 's9', 'mgmt.err.teamRequired');
    fails(s, 'survey.create', { ...draft, title: ' ' }, 's9', 'err.invalid');
    expect(run(s, 'survey.create', { title: 'Quick', questions: ['comment'], teamStaffIds: ['s1'] }, 's9').state.surveys.sv2.teamStaffIds).toEqual([]); // no team question, no team
    expect(resolveSurveyAudience(s, undefined, T)).toEqual(ALL);
    const sent = run(up.state, 'survey.send', { surveyId: id }, 's9');
    expect(sent.state.surveys[id]).toMatchObject({ status: 'live', sentOn: T, recipients: ALL });
    expect(sent.result.recipients).toBe(6);
    expect(sent.state.surveys.sv1).toMatchObject({ status: 'closed', closedOn: T }); // the current survey closes when a new one is sent
    fails(sent.state, 'survey.update', { surveyId: id, title: 'x' }, 's9', 'mgmt.err.notDraft');
    fails(sent.state, 'survey.send', { surveyId: id }, 's9', 'mgmt.err.notDraft');
    expect(() => run(s, 'survey.create', draft, 's5')).toThrow('err.forbidden');
    // recipients are the families with the app: none in an empty clubhouse
    const empty = onAdina(seed().adina, 'survey.create', { title: 'Opening', questions: ['comment'], teamStaffIds: [] });
    expect(() => onAdina(empty.state, 'survey.send', { surveyId: empty.result.surveyId })).toThrow('mgmt.err.noRecipients');
    expect(run(c.state, 'survey.delete', { surveyId: id }, 's9').state.surveys[id].deletedAt).toBeDefined();
  });
  it('choose recipients: all families, the families of chosen members, or chosen contacts; the count follows while it is a draft', () => {
    const s = seed().citra;
    const make = (audience: unknown, state = s) => run(state, 'survey.create', { ...draft, audience }, 's9');
    // members: Oma Lina (m1) has Maria and Daniel; Cynthia and Stephanie are Opa Hendra's (m2)
    const byMembers = make({ mode: 'members', memberIds: ['m1'] });
    expect(byMembers.state.surveys.sv2).toMatchObject({ audience: { mode: 'members', memberIds: ['m1'] }, recipients: ['f1', 'f2'] });
    expect(byMembers.result.recipients).toBe(2);
    // a contact of two chosen members counts once
    expect(make({ mode: 'members', memberIds: ['m1', 'm46', 'm1'] }).state.surveys.sv2.recipients).toEqual(['f1', 'f2']);
    expect(make({ mode: 'members', memberIds: ['m2', 'm10'] }).state.surveys.sv2.recipients).toEqual(['fm10_0', 'fm2_0', 'fm2_1']);
    // chosen contacts
    const byContacts = make({ mode: 'contacts', contactIds: ['fm20_0', 'f1', 'f1'] });
    expect(byContacts.state.surveys.sv2).toMatchObject({ audience: { mode: 'contacts', contactIds: ['fm20_0', 'f1'] }, recipients: ['f1', 'fm20_0'] });
    // the draft can be edited: switch the audience and the count follows
    const edited = run(byContacts.state, 'survey.update', { surveyId: 'sv2', audience: { mode: 'all' } }, 's9');
    expect(edited.state.surveys.sv2.recipients).toEqual(ALL);
    expect(run(edited.state, 'survey.update', { surveyId: 'sv2', audience: { mode: 'members', memberIds: ['m20'] } }, 's9').state.surveys.sv2.recipients).toEqual(['fm20_0']);
    // a title-only update keeps the audience
    expect(run(byMembers.state, 'survey.update', { surveyId: 'sv2', title: 'Renamed' }, 's9').state.surveys.sv2).toMatchObject({ title: 'Renamed', audience: { mode: 'members', memberIds: ['m1'] }, recipients: ['f1', 'f2'] });
    // sending goes to the chosen people only, and the response rate counts them
    const sent = run(byMembers.state, 'survey.send', { surveyId: 'sv2' }, 's9');
    expect(sent.state.surveys.sv2).toMatchObject({ status: 'live', recipients: ['f1', 'f2'] });
    expect(sent.result.recipients).toBe(2);
    expect(sent.state.surveys.sv1.status).toBe('closed');
    const answered = run(sent.state, 'survey.answer', { surveyId: 'sv2', overall: 4, team: { s1: 5 }, recommend: true, comment: '' }, 'f1');
    expect(surveyStats(answered.state, answered.state.surveys.sv2)).toMatchObject({ answered: 1, recipients: 2, rate: 50 });
    expect(() => run(sent.state, 'survey.answer', { surveyId: 'sv2', overall: 4 }, 'fm20_0')).toThrow('err.forbidden'); // not chosen
    // nobody chosen: it can be saved as a draft but not sent
    const none = make({ mode: 'members', memberIds: [] });
    expect(none.state.surveys.sv2.recipients).toEqual([]);
    fails(none.state, 'survey.send', { surveyId: 'sv2' }, 's9', 'mgmt.err.noRecipients');
    // validation
    fails(s, 'survey.create', { ...draft, audience: { mode: 'everyone' } }, 's9', 'err.invalid');
    fails(s, 'survey.create', { ...draft, audience: { mode: 'members', memberIds: ['m999'] } }, 's9', 'err.invalid');
    fails(s, 'survey.create', { ...draft, audience: { mode: 'contacts', contactIds: ['nobody'] } }, 's9', 'err.invalid');
    fails(s, 'survey.create', { ...draft, audience: 'all' }, 's9', 'err.invalid');
    fails(byMembers.state, 'survey.update', { surveyId: 'sv2', audience: { mode: 'contacts', contactIds: ['nobody'] } }, 's9', 'err.invalid');
    // only people who can use the app can be chosen
    const noApp = { ...s, familyLinks: { ...s.familyLinks, 'fm2_1:m2': { ...s.familyLinks['fm2_1:m2'], appAccess: false } } };
    expect(appFamilies(noApp, T).map((c) => c.id)).not.toContain('fm2_1');
    fails(noApp, 'survey.create', { ...draft, audience: { mode: 'contacts', contactIds: ['fm2_1'] } }, 's9', 'mgmt.err.contactNoApp');
    expect(resolveSurveyAudience(noApp, { mode: 'members', memberIds: ['m2'] }, T)).toEqual(['fm2_0']);
    expect(() => run(s, 'survey.update', { surveyId: 'sv1', audience: { mode: 'all' } }, 's5')).toThrow('err.forbidden');
  });
  it('recipients are worked out again when a draft is sent (people who got the app since are included)', () => {
    let s = seed().citra;
    s = run(s, 'survey.create', draft, 's9').state;
    expect(s.surveys.sv2.recipients).toHaveLength(6);
    // a new family with the app arrives after the draft was saved
    s = { ...s, familyContacts: { ...s.familyContacts, fnew: { ...s.familyContacts.f1, id: 'fnew', name: 'New Contact', firstName: 'New' } }, familyLinks: { ...s.familyLinks, 'fnew:m1': { ...s.familyLinks['f1:m1'], id: 'fnew:m1', familyId: 'fnew', primary: false } } };
    expect(run(s, 'survey.send', { surveyId: 'sv2' }, 's9').state.surveys.sv2.recipients).toHaveLength(7);
  });
  it('members to choose from: active members with at least one family contact who has the app', () => {
    const s = seed().citra;
    expect(surveyMembers(s, T).map((m) => m.id).sort()).toEqual(['m1', 'm10', 'm2', 'm20', 'm46'].sort());
    expect(surveyMembers(seed().adina, T)).toEqual([]);
  });
  it('a family answers once; response rate counts the chosen families; team ratings are limited to the survey team', () => {
    let s = seed().citra;
    s = run(s, 'survey.create', { ...draft, questions: ['overall', 'team', 'comment'], audience: { mode: 'contacts', contactIds: ['f1', 'fm2_0', 'fm10_0', 'fm20_0'] } }, 's9').state;
    s = run(s, 'survey.send', { surveyId: 'sv2' }, 's9').state;
    const ans = { surveyId: 'sv2', overall: 5, team: { s1: 5, s8: 4, s3: 1 }, recommend: true, comment: 'Lovely team' };
    const r = run(s, 'survey.answer', ans, 'f1');
    expect(r.state.surveyResponses['sr-sv2-f1']).toMatchObject({ familyId: 'f1', overall: 5, team: { s1: 5, s8: 4 }, comment: 'Lovely team', on: T });
    expect(r.state.surveyResponses['sr-sv2-f1'].recommend).toBeNull(); // not asked
    expect(surveyStats(r.state, r.state.surveys.sv2)).toMatchObject({ answered: 1, recipients: 4, rate: 25 });
    fails(r.state, 'survey.answer', ans, 'f1', 'mgmt.err.alreadyAnswered');
    expect(() => run(s, 'survey.answer', ans, 'fm2_1')).toThrow('err.forbidden'); // not a recipient
    expect(() => run(s, 'survey.answer', ans, 's9')).toThrow('err.forbidden');
    fails(s, 'survey.answer', { ...ans, overall: 0 }, 'f1', 'err.invalid');
    // the old survey is closed
    fails(s, 'survey.answer', { ...ans, surveyId: 'sv1' }, 'f1', 'mgmt.err.notLive');
    // closing
    const closed = run(r.state, 'survey.close', { surveyId: 'sv2' }, 's9');
    expect(closed.state.surveys.sv2).toMatchObject({ status: 'closed', closedOn: T });
    fails(closed.state, 'survey.close', { surveyId: 'sv2' }, 's9', 'mgmt.err.notLive');
    // the family sees a survey to answer until they do
    const f1 = user(s, 'f1');
    expect(actionItems(s, f1, T, 600).some((i) => i.kind === 'notif.act.survey')).toBe(true);
    expect(actionItems(r.state, user(r.state, 'f1'), T, 600).some((i) => i.kind === 'notif.act.survey')).toBe(false);
    expect(actionItems(s, user(s, 'fm2_1'), T, 600).some((i) => i.kind === 'notif.act.survey')).toBe(false); // not chosen, nothing to answer
  });
});

describe('survey custom questions', () => {
  const stars = { kind: 'rating', text: 'How was the new menu?', required: true };
  const yn = { kind: 'yesno', text: 'Did Oma enjoy the Thursday outing?', required: false };
  const pick = { kind: 'choice', text: 'Which evening suits the family?', options: ['Friday', 'Saturday', 'Sunday'], required: true };
  const free = { kind: 'text', text: 'What should we cook next month?', required: false };
  const base = { title: 'Menu check', questions: [] as string[], teamStaffIds: [] as string[] };
  const create = (s: ClubState, custom: unknown, extra: object = {}) => run(s, 'survey.create', { ...base, custom, ...extra }, 's9');
  const live2 = (custom: unknown[], extra: object = {}) => run(create(seed().citra, custom, extra).state, 'survey.send', { surveyId: 'sv2' }, 's9').state;
  const answer = (s: ClubState, answers: unknown, extra: object = {}, uid = 'f1') => run(s, 'survey.answer', { surveyId: 'sv2', answers, ...extra }, uid);

  it('a survey can be made of its own questions alone: ids in order, options kept, required flags, no preset asked', () => {
    const c = create(seed().citra, [stars, yn, pick, free]);
    const sv = c.state.surveys[c.result.surveyId as string];
    expect(sv.questions).toEqual([]);
    expect(sv.custom).toEqual([
      { id: 'q1', kind: 'rating', text: 'How was the new menu?', required: true },
      { id: 'q2', kind: 'yesno', text: 'Did Oma enjoy the Thursday outing?', required: false },
      { id: 'q3', kind: 'choice', text: 'Which evening suits the family?', options: ['Friday', 'Saturday', 'Sunday'], required: true },
      { id: 'q4', kind: 'text', text: 'What should we cook next month?', required: false },
    ]);
    // an option list on a question that is not a choice is dropped; the required flag defaults to off; text is trimmed
    expect(create(seed().citra, [{ kind: 'text', text: '  Hello  ', options: ['a', 'b'] }]).state.surveys.sv2.custom).toEqual([{ id: 'q1', kind: 'text', text: 'Hello', required: false }]);
    // presets and custom questions mix; the presets can each be off, including "overall"
    expect(create(seed().citra, [yn], { questions: ['comment', 'overall'] }).state.surveys.sv2).toMatchObject({ questions: ['overall', 'comment'], custom: [{ id: 'q1' }] });
    expect(create(seed().citra, undefined, { questions: ['comment'] }).state.surveys.sv2.custom).toEqual([]);
  });
  it('a survey has to ask something: a preset or a question of its own', () => {
    fails(seed().citra, 'survey.create', { ...base, custom: [] }, 's9', 'mgmt.err.noQuestions');
    fails(seed().citra, 'survey.create', base, 's9', 'mgmt.err.noQuestions');
    const c = create(seed().citra, [yn]).state;
    fails(c, 'survey.update', { surveyId: 'sv2', custom: [] }, 's9', 'mgmt.err.noQuestions');
    expect(run(c, 'survey.update', { surveyId: 'sv2', custom: [], questions: ['comment'] }, 's9').state.surveys.sv2).toMatchObject({ questions: ['comment'], custom: [] });
    expect(run(c, 'survey.update', { surveyId: 'sv2', title: 'x' }, 's9').state.surveys.sv2.custom).toHaveLength(1); // custom left out = unchanged
  });
  it('edit, reorder and remove while it is a draft; ids stay with their question', () => {
    const c = create(seed().citra, [stars, yn, pick]).state;
    const ids = () => (st: ClubState) => st.surveys.sv2.custom!.map((q) => `${q.id}:${q.text.slice(0, 6)}`);
    // reorder: send the list back in a new order with the ids it came with
    const cur = c.surveys.sv2.custom!;
    const re = run(c, 'survey.update', { surveyId: 'sv2', custom: [cur[2], cur[0], cur[1]] }, 's9').state;
    expect(ids()(re)).toEqual(['q3:Which ', 'q1:How wa', 'q2:Did Om']);
    // edit one (same id, new text and kind), remove one, add a new one with a temporary id: it takes the lowest free id
    const up = run(re, 'survey.update', { surveyId: 'sv2', custom: [{ ...cur[2], text: 'Pick a night' }, { id: 'new1', ...free }, { ...cur[1], kind: 'text', text: 'Any thoughts?' }] }, 's9').state;
    expect(up.surveys.sv2.custom).toEqual([
      { id: 'q3', kind: 'choice', text: 'Pick a night', options: ['Friday', 'Saturday', 'Sunday'], required: true },
      { id: 'q1', kind: 'text', text: 'What should we cook next month?', required: false },
      { id: 'q2', kind: 'text', text: 'Any thoughts?', required: false },
    ]);
    // duplicate or invalid ids are renumbered, never kept twice
    const dup = run(re, 'survey.update', { surveyId: 'sv2', custom: [{ id: 'q2', ...yn }, { id: 'q2', ...free }, { id: 'zzz', ...stars }] }, 's9').state;
    expect(dup.surveys.sv2.custom!.map((q) => q.id)).toEqual(['q2', 'q1', 'q3']);
  });
  it('questions are checked: kind, text, 2 to 8 different options, at most 12, objects only', () => {
    const bad = (custom: unknown) => fails(seed().citra, 'survey.create', { ...base, custom }, 's9', 'err.invalid');
    bad([{ kind: 'stars', text: 'x' }]);
    bad([{ kind: 'rating', text: ' ' }]);
    bad([{ kind: 'rating' }]);
    bad(['Do you like it?']);
    bad('q1');
    bad([{ kind: 'choice', text: 'Pick', options: ['Only one'] }]);
    bad([{ kind: 'choice', text: 'Pick' }]);
    bad([{ kind: 'choice', text: 'Pick', options: ['a', 'A'] }]); // the same option twice, ignoring case
    bad([{ kind: 'choice', text: 'Pick', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }]);
    bad([{ kind: 'choice', text: 'Pick', options: ['a', 'b'.repeat(61)] }]);
    bad(Array.from({ length: 13 }, (_, i) => ({ kind: 'yesno', text: `Q${i}` })));
    expect(create(seed().citra, Array.from({ length: 12 }, (_, i) => ({ kind: 'yesno', text: `Q${i}` }))).state.surveys.sv2.custom).toHaveLength(12);
    expect(create(seed().citra, [{ kind: 'choice', text: 'Pick', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }]).state.surveys.sv2.custom![0].options).toHaveLength(8);
  });
  it('only management changes them, and only while the survey is a draft', () => {
    for (const uid of ['s1', 's8', 'f1']) expect(() => run(seed().citra, 'survey.create', { ...base, custom: [yn] }, uid)).toThrow('err.forbidden');
    const sent = live2([stars]);
    fails(sent, 'survey.update', { surveyId: 'sv2', custom: [yn] }, 's9', 'mgmt.err.notDraft');
    fails(sent, 'survey.update', { surveyId: 'sv2', title: 'x' }, 's9', 'mgmt.err.notDraft');
    expect(sent.surveys.sv2.custom).toHaveLength(1);
  });
  it('a family answers every kind; required ones cannot be left out; answers are checked against the kind', () => {
    const s = live2([stars, yn, pick, free]);
    const ok = answer(s, { q1: 4, q2: false, q3: 'Saturday', q4: '  More soto please  ' });
    expect(ok.state.surveyResponses['sr-sv2-f1']).toMatchObject({ familyId: 'f1', overall: 0, recommend: null, comment: '', answers: { q1: 4, q2: false, q3: 'Saturday', q4: 'More soto please' }, on: T });
    expect(Object.values(ok.state.activity).some((a) => a.key === 'mgmt.feed.surveyAnsweredPlain' && a.params.name === 'Maria')).toBe(true);
    // optional ones can be skipped: nothing is stored for them
    expect(answer(s, { q1: 5, q3: 'Friday', q4: '   ' }).state.surveyResponses['sr-sv2-f1'].answers).toEqual({ q1: 5, q3: 'Friday' });
    // required ones: missing, empty or blank
    try { answer(s, { q3: 'Friday' }); throw new Error('should fail'); } catch (e) { expect((e as DomainError).code).toBe('mgmt.err.answerRequired'); expect((e as DomainError).params).toMatchObject({ q: 'How was the new menu?' }); }
    fails(s, 'survey.answer', { surveyId: 'sv2' }, 'f1', 'mgmt.err.answerRequired');
    fails(s, 'survey.answer', { surveyId: 'sv2', answers: { q1: 3, q3: '' } }, 'f1', 'mgmt.err.answerRequired');
    // wrong kind of answer
    for (const a of [{ q1: 6 }, { q1: 0 }, { q1: 2.5 }, { q1: '4' }, { q1: true }, { q2: 'yes' }, { q2: 1 }, { q3: 'Monday' }, { q3: 2 }, { q4: 7 }, { q4: true }]) {
      fails(s, 'survey.answer', { surveyId: 'sv2', answers: { q1: 4, q3: 'Friday', ...a } }, 'f1', 'err.invalid');
    }
    // anything that is not a number, a boolean or a text is refused outright; unknown question ids are dropped
    fails(s, 'survey.answer', { surveyId: 'sv2', answers: { q1: { x: 1 } } }, 'f1', 'err.invalid');
    fails(s, 'survey.answer', { surveyId: 'sv2', answers: [4] }, 'f1', 'err.invalid');
    expect(answer(s, { q1: 4, q3: 'Friday', q9: 'x', zz: 1 }).state.surveyResponses['sr-sv2-f1'].answers).toEqual({ q1: 4, q3: 'Friday' });
    // once only, and only for the families it went to
    fails(ok.state, 'survey.answer', { surveyId: 'sv2', answers: { q1: 4, q3: 'Friday' } }, 'f1', 'mgmt.err.alreadyAnswered');
    expect(() => run(s, 'survey.answer', { surveyId: 'sv2', answers: { q1: 4, q3: 'Friday' } }, 's9')).toThrow('err.forbidden');
  });
  it('the overall rating is only needed when the survey asks for it; a preset question that is on stays as before', () => {
    const s = live2([yn], { questions: ['overall', 'comment'] });
    fails(s, 'survey.answer', { surveyId: 'sv2', answers: {} }, 'f1', 'err.invalid'); // overall asked, not given
    fails(s, 'survey.answer', { surveyId: 'sv2', overall: 7 }, 'f1', 'err.invalid');
    const r = answer(s, { q1: true }, { overall: 4, comment: 'Lovely', recommend: true });
    expect(r.state.surveyResponses['sr-sv2-f1']).toMatchObject({ overall: 4, comment: 'Lovely', recommend: null, answers: { q1: true } });
    expect(Object.values(r.state.activity).some((a) => a.key === 'mgmt.feed.surveyAnswered' && a.params.overall === 4)).toBe(true);
    // a survey of custom questions only: the overall figure stays empty
    const only = answer(live2([stars]), { q1: 5 }, { overall: 5 });
    expect(only.state.surveyResponses['sr-sv2-f1'].overall).toBe(0);
    expect(surveyStats(only.state, only.state.surveys.sv2)).toMatchObject({ answered: 1, overall: 0, overallN: 0 });
  });
  it('results per question: average stars, yes and no, choice counts, written answers newest first', () => {
    let s = live2([stars, yn, pick, free]);
    const a = (st: ClubState, uid: string, answers: object) => answer(st, answers, {}, uid).state;
    s = a(s, 'f1', { q1: 5, q2: true, q3: 'Friday', q4: 'Satay' });
    s = a(s, 'f2', { q1: 4, q2: false, q3: 'Friday', q4: 'Soto' });
    s = a(s, 'fm10_0', { q1: 4, q3: 'Sunday' });
    const st = surveyStats(s, s.surveys.sv2);
    expect(st).toMatchObject({ answered: 3, recipients: 6, rate: 50, overallN: 0 });
    const [r1, r2, r3, r4] = st.custom;
    expect(r1).toMatchObject({ n: 3, avg: 4.3 });
    expect(r2).toMatchObject({ n: 2, yes: 1, no: 1 });
    expect(r3.counts).toEqual([{ option: 'Friday', n: 2 }, { option: 'Saturday', n: 0 }, { option: 'Sunday', n: 1 }]);
    expect(r4.n).toBe(2);
    expect(r4.texts.map((x) => x.text).sort()).toEqual(['Satay', 'Soto']);
    // nobody has answered yet: zero everywhere
    expect(surveyStats(live2([stars, pick]), live2([stars, pick]).surveys.sv2).custom.map((r) => r.n)).toEqual([0, 0]);
  });
  it('older surveys and answers (no custom questions) read and answer as before', () => {
    const s = seed().citra;
    expect(s.surveys.sv1.custom).toBeUndefined();
    expect(surveyStats(s, s.surveys.sv1)).toMatchObject({ rate: 75, answered: 3, custom: [] });
    expect(surveyStats(s, s.surveys.sv1).overall).toBeGreaterThan(0);
    const waiting = s.surveys.sv1.recipients.find((id) => !live(s.surveyResponses).some((r) => r.surveyId === 'sv1' && r.familyId === id))!;
    const r = run(s, 'survey.answer', { surveyId: 'sv1', overall: 4, team: { s1: 5 }, recommend: true, comment: 'Good' }, waiting);
    const resp = r.state.surveyResponses[`sr-sv1-${waiting}`];
    expect(resp).toMatchObject({ overall: 4, recommend: true, comment: 'Good' });
    expect(resp.answers).toBeUndefined(); // no custom questions, nothing extra stored
    // a draft made the old way (presets only) has an empty list of its own questions
    expect(run(s, 'survey.create', { title: 'Old way', questions: ['overall', 'team'], teamStaffIds: ['s1'] }, 's9').state.surveys.sv2).toMatchObject({ questions: ['overall', 'team'], custom: [] });
  });
});

describe('survey templates, the survey log and venue ratings', () => {
  const later = { today: '2026-11-02', nowMin: 10 * 60 }; // v1 (Sat 24 Oct) is over
  const venueDraft = { kind: 'venue', title: 'Venue rating 2', questions: ['overall', 'comment'], custom: [] };
  const rate = (st: ClubState, input: unknown) => execute(st, 'venue.rate', input, systemUser(st.clubId), later, mid());
  const rateFails = (st: ClubState, input: unknown, code: string) => {
    try { rate(st, input); } catch (e) { expect((e as DomainError).code).toBe(code); return; }
    throw new Error(`expected venue.rate to fail with ${code}`);
  };

  it('templates: save, change, delete; a survey starts from one and copies its questions', () => {
    const s = seed().citra;
    expect(live(s.surveyTemplates).map((t) => `${t.kind}:${t.title}`).sort()).toEqual(['family:Activities feedback', 'family:Lunch and menu', 'family:Monthly family satisfaction', 'venue:Venue rating']);
    const saved = run(s, 'surveyTemplate.save', { title: 'Short check', kind: 'family', questions: ['overall', 'team'], custom: [{ kind: 'yesno', text: 'Happy?' }], teamStaffIds: ['s1'] }, 's9');
    const id = saved.result.templateId as string;
    expect(id).toBe('st5');
    expect(saved.state.surveyTemplates[id]).toMatchObject({ title: 'Short check', kind: 'family', questions: ['overall', 'team'], custom: [{ id: 'q1', kind: 'yesno', text: 'Happy?', required: false }], teamStaffIds: ['s1'], createdBy: 'staff:s9' });
    // changing keeps the id; a template without the team question has no team
    const changed = run(saved.state, 'surveyTemplate.save', { id, title: 'Short check 2', kind: 'family', questions: ['overall'], custom: [{ kind: 'yesno', text: 'Happy?' }], teamStaffIds: ['s1'] }, 's9');
    expect(changed.state.surveyTemplates[id]).toMatchObject({ title: 'Short check 2', questions: ['overall'], teamStaffIds: [] });
    expect(Object.keys(changed.state.surveyTemplates)).toHaveLength(5);
    // a survey made from it: questions copied, its own log starts with "created from"
    const c = run(saved.state, 'survey.create', { templateId: id }, 's9');
    expect(c.state.surveys.sv2).toMatchObject({ title: 'Short check', kind: 'family', templateId: id, questions: ['overall', 'team'], custom: [{ id: 'q1', text: 'Happy?' }], teamStaffIds: ['s1'], status: 'draft', log: [{ what: 'created', by: 'staff:s9', note: 'Short check' }] });
    // what is typed wins over the template; the template is left alone
    expect(run(saved.state, 'survey.create', { templateId: id, title: 'Own title', questions: ['comment'], teamStaffIds: [] }, 's9').state.surveys.sv2).toMatchObject({ title: 'Own title', questions: ['comment'], templateId: id });
    // deleted templates are gone; surveys made from them stay
    const gone = run(c.state, 'surveyTemplate.delete', { id }, 's9').state;
    expect(live(gone.surveyTemplates)).toHaveLength(4);
    expect(gone.surveys.sv2.templateId).toBe(id);
    fails(gone, 'survey.create', { templateId: id }, 's9', 'err.notFound');
    fails(gone, 'surveyTemplate.delete', { id }, 's9', 'err.notFound');
    // KC round 7: the venue rating template is built in: it can't be deleted or turned into a family survey, but its questions can change
    expect(s.surveyTemplates.st4.builtIn).toBe(true);
    fails(s, 'surveyTemplate.delete', { id: 'st4' }, 's9', 'mgmt.err.svTplBuiltIn');
    fails(s, 'surveyTemplate.save', { id: 'st4', title: 'Venue', kind: 'family', questions: ['overall'], custom: [] }, 's9', 'mgmt.err.svTplBuiltIn');
    expect(run(s, 'surveyTemplate.save', { id: 'st4', title: 'Venue rating', kind: 'venue', questions: ['overall', 'comment'], custom: [] }, 's9').state.surveyTemplates.st4).toMatchObject({ questions: ['overall', 'comment'], builtIn: true });
    fails(s, 'surveyTemplate.save', { id: 'st99', title: 'x', kind: 'family', questions: ['comment'], custom: [] }, 's9', 'err.notFound');
    fails(s, 'surveyTemplate.save', { title: 'x', kind: 'family', questions: [], custom: [] }, 's9', 'mgmt.err.noQuestions');
    fails(s, 'surveyTemplate.save', { title: 'x', kind: 'venue', questions: ['comment'], custom: [] }, 's9', 'mgmt.err.venueNeedsOverall');
    fails(s, 'surveyTemplate.save', { title: 'x', kind: 'family', questions: ['team'], custom: [], teamStaffIds: ['s99'] }, 's9', 'err.invalid');
    for (const uid of ['s1', 'f1']) expect(() => run(s, 'surveyTemplate.save', { title: 'x', kind: 'family', questions: ['comment'], custom: [] }, uid)).toThrow('err.forbidden');
  });

  it('one family survey and one venue survey can be live together; sending one kind closes only that kind', () => {
    const s = seed().citra;
    expect(liveSurvey(s)?.id).toBe('sv1');
    expect(liveSurvey(s, 'venue')?.id).toBe('svv1');
    const fam = run(run(s, 'survey.create', { title: 'November', questions: ['comment'], teamStaffIds: [] }, 's9').state, 'survey.send', { surveyId: 'sv2' }, 's9').state;
    expect(fam.surveys.sv1.status).toBe('closed');
    expect(fam.surveys.svv1.status).toBe('live'); // the venue survey is not touched
    expect(fam.surveys.sv1.log!.at(-1)).toMatchObject({ what: 'closed', note: 'replaced', by: 'staff:s9' });
    expect(fam.surveys.sv2.log!.map((l) => l.what)).toEqual(['created', 'sent']);
    expect(fam.surveys.sv2.log!.at(-1)!.note).toBe('6'); // how many families it went to
    const created = run(fam, 'survey.create', venueDraft, 's9');
    expect(created.state.surveys.sv3).toMatchObject({ kind: 'venue', status: 'draft', recipients: [], teamStaffIds: [] });
    const ven = run(created.state, 'survey.send', { surveyId: 'sv3' }, 's9');
    expect(ven.state.surveys.sv3).toMatchObject({ status: 'live', recipients: [], sentOn: T });
    expect(ven.state.surveys.svv1).toMatchObject({ status: 'closed', closedOn: T });
    expect(ven.state.surveys.sv2.status).toBe('live'); // the family survey stays live
    expect(liveSurvey(ven.state)?.id).toBe('sv2');
    expect(liveSurvey(ven.state, 'venue')?.id).toBe('sv3');
    // reopen: the live one of the same kind closes, the log says so
    const re = run(ven.state, 'survey.reopen', { surveyId: 'svv1' }, 's9').state;
    expect(re.surveys).toMatchObject({ svv1: { status: 'live' }, sv3: { status: 'closed' } });
    expect(re.surveys.svv1.closedOn).toBeUndefined();
    expect(re.surveys.svv1.log!.at(-1)).toMatchObject({ what: 'reopened' });
    fails(re, 'survey.reopen', { surveyId: 'svv1' }, 's9', 'mgmt.err.notClosed');
    fails(re, 'survey.reopen', { surveyId: 'sv2' }, 's9', 'mgmt.err.notClosed');
    // editing a draft is one line in the log per person and day
    const e1 = run(created.state, 'survey.update', { surveyId: 'sv3', title: 'A' }, 's9').state;
    const e2 = run(e1, 'survey.update', { surveyId: 'sv3', title: 'B' }, 's9').state;
    expect(e2.surveys.sv3.log!.map((l) => l.what)).toEqual(['created', 'edited']);
    // a venue survey asks for the overall rating and has no team
    fails(s, 'survey.create', { kind: 'venue', title: 'x', questions: ['comment'], custom: [] }, 's9', 'mgmt.err.venueNeedsOverall');
    expect(run(s, 'survey.create', { kind: 'venue', title: 'x', questions: ['overall', 'team'], teamStaffIds: ['s1'], custom: [] }, 's9').state.surveys.sv2).toMatchObject({ questions: ['overall'], teamStaffIds: [] });
    // families never see a venue survey, a renter's answer, or a template
    expect(() => run(s, 'survey.answer', { surveyId: 'svv1', overall: 5 }, 'f1')).toThrow('err.forbidden');
  });

  it('venue rating link: asking sets a link on the booking, the renter answers once through venue.rate (as the system)', () => {
    const s = seed().citra;
    const ask = run(s, 'venue.askReview', { venueId: 'v1' }, 's9', later);
    const b = ask.state.venueBookings.v1;
    expect(b).toMatchObject({ surveyId: 'svv1', reviewAskedAt: '2026-11-02T10:00' });
    expect(b.ratingToken).toMatch(/^[a-z0-9]{20,24}$/);
    expect(ask.result).toMatchObject({ token: b.ratingToken, surveyId: 'svv1' });
    expect(ratingLinkOf(ask.state, b.ratingToken)).toMatchObject({ state: 'open' });
    expect(ratingLinkOf(ask.state, 'nope')).toBeNull();
    expect(ratingLinkOf(ask.state, '')).toBeNull();
    const token = b.ratingToken!;
    const input = { token, name: 'Santi W.', overall: 5, recommend: true, comment: 'Great morning', answers: { q1: true, q2: 'More parking' } };
    // a wrong token, or a signed-in user (even management), cannot answer
    rateFails(ask.state, { ...input, token: 'wrong-token-1234' }, 'err.notFound');
    for (const uid of ['s9', 's1', 'f1']) expect(() => run(ask.state, 'venue.rate', input, uid, later)).toThrow('err.forbidden');
    rateFails(ask.state, { ...input, overall: 0 }, 'err.invalid');
    rateFails(ask.state, { ...input, answers: { q1: 'yes' } }, 'err.invalid');
    const r = rate(ask.state, input);
    expect(r.state.surveyResponses['sr-svv1-v1']).toMatchObject({ familyId: '', venueBookingId: 'v1', respondentName: 'Santi W.', overall: 5, recommend: true, comment: 'Great morning', answers: { q1: true, q2: 'More parking' }, on: '2026-11-02', createdBy: 'system' });
    expect(r.state.venueBookings.v1.review).toEqual({ stars: 5, text: 'Great morning' });
    expect(ratingLinkOf(r.state, token)).toMatchObject({ state: 'answered' });
    expect(surveyStats(r.state, r.state.surveys.svv1)).toMatchObject({ answered: 3, recipients: 4, overallN: 3 }); // two answers and three links in the seed, plus this one
    expect(Object.values(r.state.activity).some((a) => a.key === 'mgmt.feed.venueRated' && a.params.org === 'PT Arunika Farma caregiver seminar')).toBe(true);
    expect(updatesFor(r.state, user(r.state, 's9')).some((x) => x.kind === 'mgmt.notif.venueRated')).toBe(true);
    // one answer per booking
    rateFails(r.state, input, 'mgmt.err.alreadyAnswered');
    fails(r.state, 'venue.askReview', { venueId: 'v1' }, 's9', 'mgmt.err.venueReviewed', later);
    // the name is the booking's contact when left empty; the venue survey's own questions follow their kind
    expect(rate(ask.state, { ...input, name: '' }).state.surveyResponses['sr-svv1-v1'].respondentName).toBe('Ibu Santi Wirjo');
    // a closed survey takes no more answers; asking again points the link at the live one
    const closed = run(ask.state, 'survey.close', { surveyId: 'svv1' }, 's9', later).state;
    expect(ratingLinkOf(closed, token)).toMatchObject({ state: 'closed' });
    rateFails(closed, input, 'mgmt.err.notLive');
  });

  it('asking for a rating with no live venue survey makes one from the venue template and sends it', () => {
    const s = run(seed().citra, 'survey.close', { surveyId: 'svv1' }, 's9').state;
    expect(liveSurvey(s, 'venue')).toBeUndefined();
    const ask = run(s, 'venue.askReview', { venueId: 'v1' }, 's9', later);
    const sv = ask.state.surveys.sv2;
    expect(sv).toMatchObject({ kind: 'venue', status: 'live', title: 'Venue rating', templateId: 'st4', recipients: [], sentOn: '2026-11-02', questions: ['overall', 'recommend', 'comment'] });
    expect(sv.custom!.map((q) => q.text)).toEqual(['Was the room ready on time?', 'What could we do better?']);
    expect(sv.log!.map((l) => l.what)).toEqual(['created', 'sent']);
    expect(ask.state.venueBookings.v1.surveyId).toBe('sv2');
    // a booking whose link went to the closed survey is pointed at the new one when it is asked again
    const old = run(seed().citra, 'venue.askReview', { venueId: 'v1' }, 's9', later).state;
    const reasked = run(run(old, 'survey.close', { surveyId: 'svv1' }, 's9', later).state, 'venue.askReview', { venueId: 'v1' }, 's9', later).state;
    expect(reasked.venueBookings.v1.surveyId).toBe('sv2');
    expect(reasked.venueBookings.v1.ratingToken).toBe(old.venueBookings.v1.ratingToken);
    // keeping a typed review as a fallback
    expect(run(s, 'venue.recordReview', { venueId: 'v1', stars: 4, text: 'By phone' }, 's9', later).state.venueBookings.v1.review).toEqual({ stars: 4, text: 'By phone' });
  });
});

describe('prices and club rules', () => {
  it('saves a new price version; changed prices stop being "sample"; invoices already sent keep their amounts', () => {
    const s = seed().citra;
    // the brochure's prices are real; only the extra-day price (not in it) is still a sample
    expect(priceOn(s, T)).toMatchObject({ flex: 2700000, gold: 3950000, extra: 650000, registration: 2500000, trial: 450000, leave: 250000, sample: { flex: false, gold: false, extra: true } });
    const r = run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 700000, from: T }, 's9');
    expect(priceOn(r.state, T)).toMatchObject({ flex: 3000000, gold: 3950000, extra: 700000, registration: 2500000, trial: 450000, leave: 250000, sample: { flex: false, gold: false, extra: false } }); // the fees carry over
    expect(priceOn(r.state, '2026-10-20').flex).toBe(2700000); // before the change
    expect(r.state.invoices['INV-2610-001'].lines[0].amount).toBe(2700000);
    expect(updatesFor(r.state, user(r.state, 's10')).some((x) => x.kind === 'mgmt.notif.pricesChanged')).toBe(true);
    // a second change the same day edits that version
    const r2 = run(r.state, 'prices.set', { flex: 3000000, gold: 4000000, extra: 700000, from: T }, 's9');
    expect(live(r2.state.prices)).toHaveLength(2);
    expect(priceOn(r2.state, T)).toMatchObject({ gold: 4000000, sample: { flex: false, gold: false, extra: false } });
    // effective later
    const later = run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: '2026-12-01' }, 's9');
    expect(priceOn(later.state, T).flex).toBe(2700000);
    expect(priceOn(later.state, '2026-12-01').flex).toBe(3000000);
    fails(s, 'prices.set', { flex: 0, gold: 3950000, extra: 650000, from: T }, 's9', 'err.invalid');
    fails(s, 'prices.set', { flex: 2700000.5, gold: 3950000, extra: 650000, from: T }, 's9', 'err.invalid');
    fails(s, 'prices.set', { flex: -1, gold: 3950000, extra: 650000, from: T }, 's9', 'err.invalid');
    fails(s, 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, from: T }, 's9', 'err.noChanges');
    fails(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: '2026-10-20' }, 's9', 'mgmt.err.pricePast');
    for (const uid of ['s10', 's1', 'f1']) expect(() => run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: T }, uid)).toThrow('err.forbidden');
  });
  it('the registration fee, the 2-day trial and a month of leave are prices too (left out = unchanged)', () => {
    const s = seed().citra;
    const r = run(s, 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, registration: 3000000, trial: 500000, leave: 300000, from: T }, 's9');
    expect(priceOn(r.state, T)).toMatchObject({ registration: 3000000, trial: 500000, leave: 300000, flex: 2700000, sample: { flex: false, gold: false, extra: true } });
    fails(s, 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, registration: 2500000, trial: 450000, leave: 250000, from: T }, 's9', 'err.noChanges'); // all the same
    fails(s, 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, trial: 0, from: T }, 's9', 'err.invalid');
    const onlyLeave = run(s, 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, leave: 260000, from: T }, 's9');
    expect(priceOn(onlyLeave.state, T)).toMatchObject({ registration: 2500000, trial: 450000, leave: 260000 });
  });
  it('the notify toggle: the team is told by default, and not when it is switched off', () => {
    const s = seed().citra;
    const pricesNotes = (st: ClubState) => updatesFor(st, user(st, 's10')).filter((x) => x.kind === 'mgmt.notif.pricesChanged');
    const on = run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: T }, 's9');
    expect(pricesNotes(on.state)).toHaveLength(1);
    expect(pricesNotes(run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: T, notify: true }, 's9').state)).toHaveLength(1);
    const off = run(s, 'prices.set', { flex: 3000000, gold: 3950000, extra: 650000, from: T, notify: false }, 's9');
    expect(pricesNotes(off.state)).toHaveLength(0);
    expect(priceOn(off.state, T).flex).toBe(3000000); // the change itself is the same
    expect(Object.values(off.state.activity).some((x) => x.key === 'mgmt.feed.prices')).toBe(true); // the activity feed still records it
  });
  it('editable rule: Flex visits per month', () => {
    const s = seed().citra;
    const r = run(s, 'club.updateSettings', { flexQuota: 8 }, 's9');
    expect(r.state.club.settings.flexQuota).toBe(8);
    expect(Object.values(r.state.activity).some((x) => x.key === 'mgmt.feed.rules' && x.params?.quota === 8)).toBe(true);
    fails(s, 'club.updateSettings', { flexQuota: 0 }, 's9', 'err.invalid');
    fails(s, 'club.updateSettings', { flexQuota: 24 }, 's9', 'err.invalid');
    fails(s, 'club.updateSettings', { flexQuota: 2.5 }, 's9', 'err.invalid');
    fails(s, 'club.updateSettings', {}, 's9', 'err.invalid');
    fails(s, 'club.updateSettings', { flexQuota: 10 }, 's9', 'err.noChanges');
    expect(() => run(s, 'club.updateSettings', { flexQuota: 8 }, 's10')).toThrow('err.forbidden');
    // the other clubhouse is separate
    const a = onAdina(seed().adina, 'club.updateSettings', { flexQuota: 6 });
    expect(a.state.club.settings.flexQuota).toBe(6);
    expect(s.club.settings.flexQuota).toBe(10);
  });
});
