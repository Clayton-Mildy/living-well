// Round 14 seed: the Unpaid list. The roster's overdue invoices (by invoice number) get two earlier calls: the first one a promise to pay in two days (Gabriel,
// yesterday afternoon), the second "no answer" (Caca, two days ago). No random draws; every time is before the demo start. The small seed (tests, e2e) has none.
import type { ClubState, ISODate } from '../../types';
import { invoiceStatus } from '../../rules/billing';
import { unpaidFollowUpId } from '../../rules/unpaid';
import { addDays, live } from '../../util';

export function seedUnpaid(s: ClubState, T: ISODate): void {
  if (!s.members.m51) return; // the roster only
  const overdue = live(s.invoices).filter((i) => invoiceStatus(s, i, T) === 'overdue').sort((a, b) => (a.number < b.number ? -1 : 1));
  const plan = [
    { at: `${addDays(T, -1)}T14:20`, by: 'staff:s10' as const, outcome: 'promised' as const, promisedOn: addDays(T, 2), note: 'The daughter will transfer after her salary comes in.' },
    { at: `${addDays(T, -2)}T11:05`, by: 'staff:s1' as const, outcome: 'noAnswer' as const },
  ];
  overdue.slice(0, plan.length).forEach((inv, i) => {
    const id = unpaidFollowUpId(inv.id);
    s.unpaidFollowUps[id] = { id, clubId: s.clubId, createdAt: plan[i].at, createdBy: plan[i].by, invoiceId: inv.id, memberId: inv.memberId, calls: [plan[i]] };
  });
}
