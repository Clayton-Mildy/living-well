// Round 16 seed: the family emails the contract and invoices go to (Maria and her brother Daniel, both on Oma Lina and Opa Budi, so the billing can be passed
// between them), Opa Budi's pick-up at his own price, a cake on his birthday party not invoiced yet, the field trip fee on the seeded outings, and (R7) Ega's staff
// training day waiting for the Owner.
// Fixed values, no random draws; the same for 5 and 45 members.
import type { ClubState, ISODate } from '../../types';
import { addDays, addMonths, DEMO_TODAY, isWeekday, live } from '../../util';
import { dayStatus } from '../../rules/core';

export function seedRound16(s: ClubState, T: ISODate): void {
  if (s.familyContacts.f1) s.familyContacts.f1.email = 'maria.wijaya@example.com';
  if (s.familyContacts.f2) s.familyContacts.f2.email = 'daniel.wijaya@example.com';
  if (s.members.m46) s.members.m46.pickup = { on: true, price: 450_000 };
  const party = live(s.celebrations || {}).find((c) => c.memberId === 'm46' && c.kind === 'birthday');
  if (party) party.charges = [{ id: 'cc-budi-cake', item: 'Birthday cake (chocolate, no nuts)', amount: 350_000 }];
  for (const e of live(s.calendarEvents)) if (e.kind === 'outing') e.fee = 250_000;
  // a field trip already this month: Oma Lina and Opa Budi went, each charged on the next invoice (the same rows calendarEvent.setWent writes)
  const trip = live(s.calendarEvents).find((e) => e.kind === 'outing' && !e.cancelledAt && e.date <= T && e.date.slice(0, 7) === T.slice(0, 7));
  if (trip) {
    trip.wentIds = ['m1', 'm46'].filter((id) => s.members[id] && !s.members[id].deletedAt);
    for (const m of trip.wentIds) {
      const id = `trip-${trip.id}-${m}`;
      s.pendingCharges[id] = { id, clubId: trip.clubId, createdAt: `${trip.date}T15:00:00`, createdBy: 'staff:s1', memberId: m, amount: 250_000, label: 'inv.line.fieldTrip', params: { title: trip.title, date: trip.date }, source: { type: 'event', id: trip.id } };
    }
  }
  seedOwnerHoliday(s, T);
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
