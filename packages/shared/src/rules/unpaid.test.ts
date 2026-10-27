// Round 14: the Unpaid list (Next month > Unpaid). Overdue invoices with a balance, ordered by who needs a call first.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, toMin, type ClubState, type Invoice, type UnpaidFollowUp } from '../index';
import { callHistory, lastContactOn, unpaidFollowUpId, unpaidRows } from './unpaid';

const T = '2026-10-21';
const clock = { today: T, nowMin: toMin('10:00') };
const base = buildSeed().citra;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const OLD = 'INV-2609-020'; // Tjahjadi (m20), 3,950,000, due 28 Sep: the one overdue invoice of the small seed

/** another overdue invoice, copied from Tjahjadi's: `due` sets how late it is */
const withOverdue = (s: ClubState, id: string, memberId: string, due: string, patch: Partial<Invoice> = {}): ClubState => produce(s, (d) => {
  d.invoices[id] = { ...JSON.parse(JSON.stringify(d.invoices[OLD])), id, number: id, memberId, dueDate: due, callNotes: [], ...patch };
});
const call = (s: ClubState, invoiceId: string, c: Partial<UnpaidFollowUp['calls'][number]> & { outcome: UnpaidFollowUp['calls'][number]['outcome'] }, at = `${T}T09:00`): ClubState => produce(s, (d) => {
  const id = unpaidFollowUpId(invoiceId);
  const f = d.unpaidFollowUps[id] ?? (d.unpaidFollowUps[id] = { id, clubId: d.clubId, createdAt: at, createdBy: 'staff:s10', invoiceId, memberId: d.invoices[invoiceId].memberId, calls: [] });
  f.calls.push({ at, by: 'staff:s10', ...c });
});
const ids = (s: ClubState, today = T) => unpaidRows(s, today).map((r) => r.invoice.id);

describe('unpaidRows', () => {
  it('lists overdue invoices with a balance, each with its member, what is owed, the days late and the days it acts on', () => {
    const rows = unpaidRows(base, T);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ owed: 3_950_000, daysLate: 23, suspendOn: '2026-10-01', stopOn: '2026-10-03' });
    expect(rows[0].invoice.id).toBe(OLD);
    expect(rows[0].member.id).toBe('m20');
    expect(rows[0].last).toBeUndefined();
    expect(rows[0].promisedOn).toBeUndefined();
  });

  it('an invoice that is not overdue yet, one that is fully paid and a voided one never show', () => {
    expect(ids(base, '2026-09-28')).toEqual([]); // due today: not late yet
    const paid = produce(base, (d) => { d.payments.p1 = { id: 'p1', clubId: d.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s10', memberId: 'm20', method: 'cash', amount: 3_950_000, receivedOn: T, allocations: [{ invoiceId: OLD, amount: 3_950_000 }], xero: { status: 'pending' } } as never; });
    expect(ids(paid)).toEqual([]);
    const voided = produce(base, (d) => { d.invoices[OLD].voided = { at: `${T}T09:00`, by: 'staff:s10', reason: 'wrong' }; });
    expect(ids(voided)).toEqual([]);
  });

  it('a part payment keeps the invoice on the list with what is left', () => {
    const part = produce(base, (d) => { d.payments.p1 = { id: 'p1', clubId: d.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s10', memberId: 'm20', method: 'cash', amount: 1_000_000, receivedOn: T, allocations: [{ invoiceId: OLD, amount: 1_000_000 }], xero: { status: 'pending' } } as never; });
    expect(unpaidRows(part, T)[0].owed).toBe(2_950_000);
  });

  it('a payment waiting for finance still counts: the invoice leaves the list at once', () => {
    const r = execute(base, 'payment.record', { memberId: 'm20', method: 'cash', amount: 3_950_000, invoiceId: OLD }, as(base, 's1'), clock, 'unp-pay');
    expect(ids(r.state)).toEqual([]);
  });

  it('order: no call or a passed promise first, then the most days late, a promise still to come last', () => {
    let s = withOverdue(base, 'INV-A', 'm2', '2026-10-10'); // 11 days late
    s = withOverdue(s, 'INV-B', 'm10', '2026-10-15'); // 6 days late
    s = withOverdue(s, 'INV-C', 'm1', '2026-10-05'); // 16 days late
    expect(ids(s)).toEqual([OLD, 'INV-C', 'INV-A', 'INV-B']);
    // C promised for tomorrow: last; B promised yesterday (broken): back at the top group, by days late
    s = call(s, 'INV-C', { outcome: 'promised', promisedOn: '2026-10-22' });
    s = call(s, 'INV-B', { outcome: 'promised', promisedOn: '2026-10-20' }, '2026-10-19T10:00');
    expect(ids(s)).toEqual([OLD, 'INV-A', 'INV-B', 'INV-C']);
    // A answered "no answer": no promise, so it sits between the open rows and the promised ones, still by days late
    s = call(s, 'INV-A', { outcome: 'noAnswer' });
    expect(ids(s)).toEqual([OLD, 'INV-B', 'INV-A', 'INV-C']);
    expect(unpaidRows(s, T).find((r) => r.invoice.id === 'INV-A')!.last).toMatchObject({ outcome: 'noAnswer' });
    expect(unpaidRows(s, T).find((r) => r.invoice.id === 'INV-C')!.promisedOn).toBe('2026-10-22');
  });

  it('the latest call decides: a later "no answer" drops an earlier promise', () => {
    let s = call(base, OLD, { outcome: 'promised', promisedOn: '2026-10-23' }, '2026-10-19T10:00');
    expect(unpaidRows(s, T)[0].promisedOn).toBe('2026-10-23');
    s = call(s, OLD, { outcome: 'noAnswer' });
    expect(unpaidRows(s, T)[0].promisedOn).toBeUndefined();
  });
});

describe('callHistory and lastContactOn', () => {
  it('an Unpaid call and its invoice call note show once; a note written in Billing shows beside it', () => {
    let s = produce(base, (d) => { d.invoices[OLD].callNotes.push({ at: '2026-10-19T09:00', by: 'staff:s10', text: 'Spoke to the daughter' }); });
    s = execute(s, 'unpaid.call', { invoiceId: OLD, outcome: 'promised', promisedOn: '2026-10-23' }, as(s, 's1'), clock, 'h1').state;
    const h = callHistory(s, s.invoices[OLD]);
    // the seeded note of 29 Sep, the Billing note of 19 Oct, and the call (its own copy as a note is not repeated)
    expect(h.map((x) => [x.at.slice(0, 10), x.outcome ?? 'note'])).toEqual([[T, 'promised'], ['2026-10-19', 'note'], ['2026-09-29', 'note']]);
    expect(h[1].note).toBe('Spoke to the daughter');
  });
  it('the last contact is the newest of an Unpaid call, a call note and a reminder', () => {
    const r = unpaidRows(base, T)[0];
    expect(lastContactOn(r).slice(0, 10)).toBe('2026-09-29'); // the family's word finance wrote down on the invoice
    const s = produce(call(base, OLD, { outcome: 'noAnswer' }, '2026-10-18T09:00'), (d) => { d.invoices[OLD].reminders.push({ at: '2026-10-20T09:00', by: 'staff:s10' }); });
    expect(lastContactOn(unpaidRows(s, T)[0])).toBe('2026-10-20T09:00');
  });
});
