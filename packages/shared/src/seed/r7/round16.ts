// Round 16 seed: the family emails the contract and invoices go to (Maria and her brother Daniel, both on Oma Lina and Opa Budi, so the billing can be passed
// between them), Opa Budi's pick-up at his own price, a cake on his birthday party (a pending charge for the next invoice), the field trip fee on the seeded outings, and (R7) Ega's staff
// training day waiting for the Owner. Round 20: the past trip day (seedPastTrip, run later from r7/index.ts).
// Fixed values, no random draws; the same for 5 and 45 members.
import type { ClubState, ISODate } from '../../types';
import { addDays, addMonths, DEMO_TODAY, isWeekday, live } from '../../util';
import { attId } from '../../rules/attendance';
import { demoMediaId } from '../demoMedia';
import { FACE_FREE } from './drafts';
import { clubHoursRental, dayStatus } from '../../rules/core';

export function seedRound16(s: ClubState, T: ISODate): void {
  if (s.familyContacts.f1) s.familyContacts.f1.email = 'maria.wijaya@example.com';
  if (s.familyContacts.f2) s.familyContacts.f2.email = 'daniel.wijaya@example.com';
  if (s.members.m46) s.members.m46.pickup = { on: true, price: 450_000 };
  const party = live(s.celebrations || {}).find((c) => c.memberId === 'm46' && c.kind === 'birthday');
  if (party) {
    party.charges = [{ id: 'cc-budi-cake', item: 'Birthday cake (chocolate, no nuts)', amount: 350_000 }];
    // round 17: the cake is a pending charge, billed on the next monthly invoice (the same row celebration.addCharge writes)
    s.pendingCharges['cel-cc-budi-cake'] = { id: 'cel-cc-budi-cake', clubId: party.clubId, createdAt: party.createdAt, createdBy: party.createdBy, memberId: party.memberId, amount: 350_000, label: 'inv.line.birthday', params: { item: 'Birthday cake (chocolate, no nuts)' }, source: { type: 'celebration', id: party.id } };
  }
  for (const e of live(s.calendarEvents)) if (e.kind === 'outing') e.fee = 250_000;
  seedOwnerHoliday(s, T);
}

/**
 * Round 20 fix (I3): a field trip a few days ago, so the demo shows a trip day (family Today, the day strip, trip photos, Who went, the fee on the next bill).
 * Runs after round 17 and 18 (which drop and add visits), so "everyone checked in that day" is the final list. Each is charged on the next invoice at their
 * check-in time, the same rows checkIn writes; the charges wait for the next run like round 16's cake: nothing is moved onto an invoice already issued.
 * Fixed values, no random draws; no visit is added.
 */
export function seedPastTrip(s: ClubState, T: ISODate): void {
  const trip = live(s.calendarEvents).find((e) => e.kind === 'outing' && !e.cancelledAt && e.date < T && e.date >= addDays(T, -7)) ?? addPastTrip(s, T);
  if (!trip) return;
  const came = live(s.attendance).filter((a) => a.date === trip.date && a.checkIn && s.members[a.memberId] && !s.members[a.memberId].deletedAt)
    .sort((a, b) => (a.checkIn!.at < b.checkIn!.at ? -1 : a.checkIn!.at > b.checkIn!.at ? 1 : a.memberId < b.memberId ? -1 : 1));
  trip.wentIds = came.map((a) => a.memberId);
  if (trip.fee) for (const a of came) {
    const id = `trip-${trip.id}-${a.memberId}`;
    s.pendingCharges[id] = { id, clubId: trip.clubId, createdAt: `${trip.date}T${a.checkIn!.at}:00`, createdBy: a.checkIn!.by, memberId: a.memberId, amount: trip.fee, label: 'inv.line.fieldTrip', params: { title: trip.title, date: trip.date }, source: { type: 'event', id: trip.id } };
  }
  seedTripDay(s, trip);
}

/**
 * Round 20 fix (I3): "Taman Mini day trip" on a free open weekday 3–7 days before the anchor (no event, celebration or venue booking in club hours that day), preferring
 * the latest day Oma Lina and Opa Budi both came, then one she came; only members already checked in go, so no visit is added (Flex counts stay as they are). Fixed values, no random draws.
 */
function addPastTrip(s: ClubState, T: ISODate) {
  const came = (d: ISODate, m: string) => !!s.attendance[attId(d, m)]?.checkIn;
  const free = (d: ISODate) => isWeekday(d) && dayStatus(s, d).open && dayStatus(s, d).events.length === 0
    && !clubHoursRental(s, d) && !live(s.celebrations || {}).some((c) => c.date === d)
    && live(s.attendance).some((a) => a.date === d && a.checkIn);
  // the latest open weekday 3–7 days back (the open day just before the anchor stays a plain club day: it is "yesterday" in the reports and the tests)
  const days = [3, 4, 5, 6, 7].map((k) => addDays(T, -k)).filter(free);
  const date = days.find((d) => came(d, 'm1') && came(d, 'm46')) ?? days.find((d) => came(d, 'm1')) ?? days[0];
  if (!date) return undefined;
  const id = 'ev-outing-past';
  s.calendarEvents[id] = { id, clubId: s.clubId, createdAt: `${addDays(date, -14)}T10:00`, createdBy: 'staff:s9', date, kind: 'outing', title: 'Taman Mini day trip', titleId: 'Karyawisata Taman Mini', from: '08:30', to: '15:00', fee: 250_000 };
  return s.calendarEvents[id];
}

/** R7: Ega asked to close the club for a staff training day (the first free weekday on or after 14 Dec, moved by whole months with the anchor); it waits for Benjamin, who was told. */
function seedOwnerHoliday(s: ClubState, T: ISODate): void {
  if (!s.staff.s9 || !s.staff.s11) return;
  // moved by whole months with the anchor (the seed's month), so it is mid-December for any anchor in October
  const months = (+T.slice(0, 4) - +DEMO_TODAY.slice(0, 4)) * 12 + (+T.slice(5, 7) - +DEMO_TODAY.slice(5, 7));
  let date = `${addMonths('2026-12', months)}-14`;
  const free = (d: ISODate) => isWeekday(d) && dayStatus(s, d).events.length === 0 && !live(s.venueBookings).some((v) => v.date === d);
  while (!free(date)) date = addDays(date, 1);
  const at = `${addDays(T, -1)}T16:20`;
  const id = 'cr-owner-training';
  const input = { date, kind: 'closed', title: 'Staff training day', titleId: 'Hari pelatihan staf' };
  s.changeRequests[id] = { id, clubId: s.clubId, createdAt: at, createdBy: 'staff:s9', kind: 'approval', op: 'update', action: 'calendarEvent.create', input, section: 'holiday', target: { type: 'club', id: s.clubId }, changes: [], status: 'pending', submittedBy: 'staff:s9' };
  s.notifications['nt-owner-training'] = {
    id: 'nt-owner-training', clubId: s.clubId, createdAt: at, createdBy: 'staff:s9', toUsers: [], toRoles: ['owner'], kind: 'notif.ownerApproval',
    params: { who: 'Ega', whatKey: 'approvals.owner.what.closeAdd', date, title: input.title, name: '', amount: '', what: input.title },
    severity: 'attention', action: false, link: '/reviews', ref: { type: 'changeRequest', id }, readBy: ['s9'],
  };
}

/** Round 20: the trip day is consistent. Whoever is on the trip has a check-in that day (the trip's start, no check-out: they left with the bus), an untagged garden picture
 * of the trip and one face-free group picture tagged to Oma Lina and Opa Budi, both with the trip's title. No meal is set that day. Fixed values, no random draws. */
export function seedTripDay(s: ClubState, trip: { id: string; clubId: string; date: ISODate; title: string; from?: string; wentIds?: string[] }): void {
  const d = trip.date, at = trip.from || '08:30';
  for (const m of trip.wentIds || []) {
    if (s.attendance[attId(d, m)]) continue;
    s.attendance[attId(d, m)] = { id: attId(d, m), clubId: trip.clubId, createdAt: `${d}T${at}`, createdBy: 'staff:s1', memberId: m, date: d, checkIn: { at, by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
  }
  const put = (id: string, time: string, kind: 'group' | 'activity', memberIds: string[], pic: string) => {
    s.photos[id] = { id, clubId: trip.clubId, createdAt: `${d}T${time}`, createdBy: 'staff:s1', date: d, time, kind, media: 'photo', activity: trip.title, memberIds, tone: 1, takenBy: 's1', visibility: 'visible', approved: { at: `${d}T${time}`, by: 's9' }, mediaId: demoMediaId(pic) };
  };
  // round 20 fix: a picture with strangers' faces never carries a member's name (KC round 9, seed/r7/drafts.ts FACE_FREE), so the garden scene is an untagged
  // trip picture (families of everyone on the trip see it, as a session picture) and the one tagged to Oma Lina and Opa Budi is a face-free one (batik hands)
  const both = (trip.wentIds || []).filter((id) => ['m1', 'm46'].includes(id));
  if (trip.wentIds?.length) put('ptrip-seed-1', '11:20', 'activity', [], 'act-garden-2');
  if (both.length) put('ptrip-seed-2', '13:05', 'group', both, FACE_FREE[0]); // a group shot: never the parent's own picture on Today (that is a solo photo or the portrait)
}
