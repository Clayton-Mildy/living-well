// Round 14: unpaid.call records one call about an overdue invoice (promised, paid, disputed, no answer).
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, toMin, DomainError, type ClubState } from '../index';
import { unpaidFollowUpId, unpaidRows } from '../rules/unpaid';

const T = '2026-10-21';
const clock = { today: T, nowMin: toMin('10:00') };
const OLD = 'INV-2609-020';
const base = buildSeed().citra;
let n = 0;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, input: unknown, uid: string) => execute(s, 'unpaid.call', input, as(s, uid), clock, `unp${++n}`);
const fails = (s: ClubState, input: unknown, uid: string, code: string) => {
  try { run(s, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected unpaid.call to fail with ${code}`);
};

describe('unpaid.call', () => {
  it('the first call creates the follow-up row, later calls append to it', () => {
    let r = run(base, { invoiceId: OLD, outcome: 'noAnswer' }, 's1');
    const f = r.state.unpaidFollowUps[unpaidFollowUpId(OLD)];
    expect(f).toMatchObject({ invoiceId: OLD, memberId: 'm20', calls: [{ outcome: 'noAnswer', by: 'staff:s1' }] });
    r = run(r.state, { invoiceId: OLD, outcome: 'promised', promisedOn: '2026-10-23', note: 'Daughter pays Friday' }, 's10');
    const g = r.state.unpaidFollowUps[unpaidFollowUpId(OLD)];
    expect(g.calls).toHaveLength(2);
    expect(g.calls[1]).toMatchObject({ outcome: 'promised', promisedOn: '2026-10-23', note: 'Daughter pays Friday', by: 'staff:s10' });
    expect(unpaidRows(r.state, T)[0]).toMatchObject({ promisedOn: '2026-10-23', last: { outcome: 'promised' } });
  });

  it('front desk, finance and management may call; a promise needs a date that is today or later', () => {
    for (const uid of ['s1', 's10', 's9']) run(base, { invoiceId: OLD, outcome: 'disputed', note: 'Says it was paid' }, uid);
    fails(base, { invoiceId: OLD, outcome: 'promised' }, 's1', 'unpaid.err.promiseDate');
    fails(base, { invoiceId: OLD, outcome: 'promised', promisedOn: '2026-10-20' }, 's1', 'unpaid.err.promiseDate');
    run(base, { invoiceId: OLD, outcome: 'promised', promisedOn: T }, 's1'); // today counts
  });

  it('a date only goes with "promised"', () => {
    const r = run(base, { invoiceId: OLD, outcome: 'noAnswer', promisedOn: '2026-10-25' }, 's1');
    expect(r.state.unpaidFollowUps[unpaidFollowUpId(OLD)].calls[0].promisedOn).toBeUndefined();
  });

  it('a family user and the kitchen are refused; an unknown, paid or voided invoice cannot be called about', () => {
    for (const uid of ['f1', 's2', 's5', 's8']) {
      try { run(base, { invoiceId: OLD, outcome: 'noAnswer' }, uid); throw new Error('allowed'); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe('err.forbidden'); }
    }
    fails(base, { invoiceId: 'nope', outcome: 'noAnswer' }, 's1', 'err.notFound');
    fails(base, { invoiceId: OLD, outcome: 'maybe' }, 's1', 'err.invalid');
    const voided = produce(base, (d) => { d.invoices[OLD].voided = { at: `${T}T09:00`, by: 'staff:s10', reason: 'wrong' }; });
    fails(voided, { invoiceId: OLD, outcome: 'noAnswer' }, 's1', 'finance.err.invoiceVoid');
    const paid = run(base, { invoiceId: OLD, outcome: 'noAnswer' }, 's10').state;
    const settled = execute(paid, 'payment.record', { memberId: 'm20', method: 'cash', amount: 3_950_000, invoiceId: OLD }, as(paid, 's10'), clock, 'unp-pay').state;
    fails(settled, { invoiceId: OLD, outcome: 'noAnswer' }, 's1', 'finance.err.invoicePaid');
  });
});
