// Round 16 seed: the family emails the contract and invoices go to (Maria and her brother Daniel, both on Oma Lina and Opa Budi, so the billing can be passed
// between them), Opa Budi's pick-up at his own price, a cake on his birthday party not invoiced yet, and the field trip fee on the seeded outings.
// Fixed values, no random draws; the same for 5 and 45 members.
import type { ClubState, ISODate } from '../../types';
import { live } from '../../util';
import { fmtDMY } from '../../rules/calendar';

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
      s.pendingCharges[id] = { id, clubId: trip.clubId, createdAt: `${trip.date}T15:00:00`, createdBy: 'staff:s1', memberId: m, amount: 250_000, label: `Field trip · ${trip.title} · ${fmtDMY(trip.date)}` };
    }
  }
}
