// Round 14: the Unpaid list (Next month > Unpaid). Every invoice past its due date with something still owed, so the front desk and finance can call the family:
// who is late and by how much, the day the membership goes on hold or stops, and what the last call came to. Nothing about the list is stored but the calls
// (UnpaidFollowUp, one row per invoice, id `uf-${invoiceId}`): an invoice that gets paid (also a payment the front desk recorded that still waits for finance)
// or voided leaves the list at once, because the list is read from the invoices.
import type { Actor, ClubState, DT, ISODate, Invoice, Member, UnpaidFollowUp, UnpaidOutcome } from '../types';
import { balanceOf, invoiceStatus, suspendDatesFor } from './billing';
import { diffDays, live, sortBy } from '../util';

export const unpaidFollowUpId = (invoiceId: string) => `uf-${invoiceId}`;
export type UnpaidCall = UnpaidFollowUp['calls'][number];

export interface UnpaidRow {
  invoice: Invoice;
  member: Member;
  /** what is still owed */
  owed: number;
  /** days since the due date */
  daysLate: number;
  /** first day of the hold */
  suspendOn: ISODate;
  /** the day the membership stops if nothing is paid and the family has not been heard */
  stopOn: ISODate;
  /** the latest call */
  last?: UnpaidCall;
  /** the day promised in the latest call (only while the latest call is a promise) */
  promisedOn?: ISODate;
}

/** Calls on an invoice, oldest first. */
export const callsOn = (s: ClubState, invoiceId: string): UnpaidCall[] => {
  const f = s.unpaidFollowUps?.[unpaidFollowUpId(invoiceId)];
  return f && !f.deletedAt ? sortBy(f.calls, (c) => c.at) : [];
};

/** When anyone last chased this invoice: an Unpaid call, a call note or a reminder (the Billing screen writes the last two); '' = never. */
export const lastContactOn = (r: Pick<UnpaidRow, 'invoice' | 'last'>): string =>
  [r.last?.at ?? '', ...r.invoice.callNotes.map((c) => c.at), ...r.invoice.reminders.map((x) => x.at)].reduce((m, x) => (x > m ? x : m), '');

/** One entry of the sheet's history: a call made on the Unpaid list, or a call note written elsewhere (Billing). */
export type CallEntry = { at: DT; by: Actor; outcome?: UnpaidOutcome; promisedOn?: ISODate; note?: string };
/** Every call about an invoice, newest first: Unpaid calls plus the call notes made outside the list. `unpaid.call` also writes a call note (so the stop rule sees it): that copy has the same time and person as its call and is left out. */
export function callHistory(s: ClubState, invoice: Invoice): CallEntry[] {
  const calls = callsOn(s, invoice.id);
  const notes = invoice.callNotes.filter((n) => !calls.some((c) => c.at === n.at && c.by === n.by)).map((n): CallEntry => ({ at: n.at, by: n.by, note: n.text }));
  return sortBy<CallEntry>([...calls, ...notes], (x) => x.at, -1);
}

/** Overdue invoices with a balance, the ones that need a call first at the top: no call yet or a promise that has passed, then the most days late; rows with a promise still to come last. */
export function unpaidRows(s: ClubState, today: ISODate): UnpaidRow[] {
  const rows: UnpaidRow[] = [];
  for (const invoice of live(s.invoices)) {
    if (invoiceStatus(s, invoice, today) !== 'overdue') continue;
    const member = s.members[invoice.memberId];
    if (!member || member.deletedAt) continue;
    const owed = balanceOf(s, invoice);
    if (owed <= 0) continue;
    const last = callsOn(s, invoice.id).pop();
    const { since, stopOn } = suspendDatesFor(s, invoice);
    rows.push({ invoice, member, owed, daysLate: diffDays(invoice.dueDate, today), suspendOn: since, stopOn, ...(last ? { last } : {}), ...(last?.outcome === 'promised' && last.promisedOn ? { promisedOn: last.promisedOn } : {}) });
  }
  /** 0 = no call or a broken promise, 1 = called, nothing to wait for, 2 = a promise still to come */
  const group = (r: UnpaidRow) => (!r.last || (r.promisedOn && r.promisedOn < today) ? 0 : r.promisedOn ? 2 : 1);
  return rows.sort((a, b) => group(a) - group(b) || b.daysLate - a.daysLate || (a.invoice.number < b.invoice.number ? -1 : 1));
}
