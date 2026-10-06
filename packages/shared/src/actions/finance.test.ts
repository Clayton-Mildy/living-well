// Finance actions: invoice run, invoices, payments, refunds, Xero, budget, receipts, vendor invoices.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, systemUser, projectForFamily, live, invoiceStatus, balanceOf, paidOn, accountCredit, invoiceTotal, budgetWeek, updatesFor, dueDateFor, type Attendance, type ClubState } from '../index';
import { runPlan, paymentsBoard, billingBoard, budgetWeekOf, availableCredit, creditApplied, invoiceVa, bankVa, groupVa, refundableOn, dtMinutes, nextRunPeriod, budgetRange, invoicePeriod, payerOf } from '../rules/finance';

const T = '2026-10-21';
const NOW = 600; // 10:00
const at = (today: string, nowMin = NOW) => ({ today, nowMin });
const clubs = buildSeed();
let n = 0;

/** A little world: current state, run actions as any demo user, optionally at another date/time. */
function world(start: ClubState = buildSeed().citra) {
  let s = start;
  const w = {
    get s() { return s; },
    set(next: ClubState) { s = next; },
    /** The demo user as the current state sees them (so a test can switch app access on). */
    who: (uid: string) => getUser({ citra: s }, uid)!,
    /** The driver and housekeeping have no app access until People switches it on. */
    withAccess(uid: string) { s = { ...s, staff: { ...s.staff, [uid]: { ...s.staff[uid], appAccess: true } } }; return w; },
    run(name: string, input: unknown, uid: string, clock = at(T)) {
      const r = execute(s, name, input, w.who(uid), clock, `t${++n}`);
      s = r.state;
      return r;
    },
    tick(clock = at(T)) {
      const r = execute(s, 'jobs.tick', {}, systemUser('citra'), clock, `t${++n}`);
      s = r.state;
      return r;
    },
    status: (id: string, today = T) => invoiceStatus(s, s.invoices[id], today),
    fail: (name: string, input: unknown, uid: string, code: string, clock = at(T)) => {
      expect(() => execute(s, name, input, w.who(uid), clock, `t${++n}`)).toThrow(code);
    },
  };
  return w;
}
/** A check-in on `date` (one visit). Inserted directly: the lobby's check-in action belongs to another area. */
function withVisit(s: ClubState, memberId: string, date: string, time = '10:05'): ClubState {
  const id = `${date}:${memberId}`;
  const a: Attendance = { id, clubId: 'citra', createdAt: `${date}T${time}`, createdBy: 'staff:s1', memberId, date, checkIn: { at: time, by: 'staff:s1', method: 'face' }, queueAdds: [], dismissed: [], edits: [{ at: `${date}T${time}`, by: 'staff:s1', what: 'checkIn' }] };
  return { ...s, attendance: { ...s.attendance, [id]: a } };
}
/** Oma Lina has 10 visits on 1–20 Oct (her Flex quota); today's check-in (21 Oct) is her 11th: one extra day, billed on November's invoice. */
const withLinaExtra = (s: ClubState) => withVisit(s, 'm1', '2026-10-21');
const issueNov = (w: ReturnType<typeof world>) => w.run('run.issue', { period: '2026-11', early: true }, 's10');

describe('invoice run', () => {
  it('previews and issues November with Lina’s extra October visit (her 11th)', () => {
    const w = world(withLinaExtra(buildSeed().citra));
    const plan = runPlan(w.s, '2026-11', T);
    expect(plan.early).toBe(true);
    expect(plan.usualDate).toBe('2026-11-15');
    expect(plan.dueDate).toBe('2026-11-27');
    const lina = plan.issue.find((r) => r.member.id === 'm1')!;
    expect(lina.lines.map((l) => l.kind)).toEqual(['plan', 'extraDay']);
    expect(lina.lines[1]).toMatchObject({ qty: 1, amount: 650000, refMonth: '2026-10', dates: ['2026-10-21'] });
    expect(lina.total).toBe(5500000 + 650000);
    expect(plan.issue).toHaveLength(5);

    const r = issueNov(w);
    expect(r.result).toMatchObject({ count: 5, early: true });
    const inv = w.s.invoices['INV-2611-001'];
    expect(inv).toMatchObject({ memberId: 'm1', payerFamilyId: 'f1', kind: 'monthly', period: '2026-11', issueDate: T, dueDate: '2026-11-27', releasedEarly: true, xero: 'awaitingPayment', reminders: [], callNotes: [] });
    expect(invoiceTotal(inv)).toBe(6150000);
    expect(inv.lines.find((l) => l.kind === 'extraDay')?.label).toBe('inv.line.extra');
    expect(w.status('INV-2611-001')).toBe('outstanding');
    expect(Object.keys(w.s.invoices).filter((k) => k.startsWith('INV-2611')).sort()).toEqual(['INV-2611-001', 'INV-2611-002', 'INV-2611-010', 'INV-2611-020', 'INV-2611-046']);
    const run = live(w.s.invoiceRuns).find((x) => x.period === '2026-11')!;
    expect(run.invoiceIds).toHaveLength(5);
    expect(run.early).toBe(true);
  });
  it('without that visit nobody has an extra day: Lina is exactly at her 10', () => {
    const plan = runPlan(world().s, '2026-11', T);
    expect(plan.issue.flatMap((r) => r.lines.map((l) => l.kind))).not.toContain('extraDay');
    expect(plan.total).toBe(5_500_000 + 9_500_000 + 9_500_000 + 5_500_000 + 9_500_000);
  });
  it('Flex pays for visits beyond 10 (Bambang’s 11th); Gold never has extra days', () => {
    // a month later, once October is over: Bambang has 8 visits and comes 3 more times; Hendra (Gold) comes every day he likes
    let s = buildSeed().citra;
    for (const d of ['2026-10-22', '2026-10-23', '2026-10-26']) s = withVisit(s, 'm10', d);
    for (const d of ['2026-10-01', '2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-17', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']) s = withVisit(s, 'm2', d);
    const plan = runPlan(s, '2026-11', '2026-11-16');
    const bambang = plan.issue.find((r) => r.member.id === 'm10')!;
    expect(bambang.lines.map((l) => l.kind)).toEqual(['plan', 'extraDay']);
    expect(bambang.lines[1]).toMatchObject({ qty: 1, amount: 650_000, dates: ['2026-10-26'] });
    expect(plan.issue.find((r) => r.member.id === 'm2')!.lines.map((l) => l.kind)).toEqual(['plan']);
    expect(plan.partialMonth).toBeNull(); // run on 16 Nov: October is over
  });
  it('bills extra days by date: a run released early does not lose the visits that come after it', () => {
    const w = world(withLinaExtra(buildSeed().citra));
    expect(runPlan(w.s, '2026-11', T).partialMonth).toBe('2026-10'); // the preview says so: October is not over
    issueNov(w);
    expect(w.s.invoices['INV-2611-001'].lines.find((l) => l.kind === 'extraDay')?.dates).toEqual(['2026-10-21']);
    // she comes again on Thu 22 and Fri 23 Oct, after the run went out
    w.set(withVisit(withVisit(w.s, 'm1', '2026-10-22'), 'm1', '2026-10-23'));
    const lina = runPlan(w.s, '2026-12', '2026-12-15').issue.find((r) => r.member.id === 'm1')!;
    expect(lina.lines.map((l) => l.kind)).toEqual(['plan', 'extraDay']);
    expect(lina.lines[1]).toMatchObject({ qty: 2, amount: 1_300_000, refMonth: '2026-10', dates: ['2026-10-22', '2026-10-23'] }); // 21 Oct is not billed twice
    w.run('run.issue', { period: '2026-12' }, 's10', at('2026-12-15'));
    expect(w.s.invoices['INV-2612-001'].lines.find((l) => l.kind === 'extraDay')?.dates).toEqual(['2026-10-22', '2026-10-23']);
    // and then nothing is left over for January
    expect(runPlan(w.s, '2027-01', '2027-01-15').issue.find((r) => r.member.id === 'm1')!.lines.map((l) => l.kind)).toEqual(['plan']);
  });
  it('a voided invoice gives its extra days back to the next run', () => {
    const w = world(withLinaExtra(buildSeed().citra));
    issueNov(w);
    expect(runPlan(w.s, '2026-12', '2026-12-15').issue.find((r) => r.member.id === 'm1')!.lines.some((l) => l.kind === 'extraDay')).toBe(false);
    w.run('invoice.void', { invoiceId: 'INV-2611-001', reason: 'Re-issue' }, 's10');
    w.run('run.issue', { period: '2026-11' }, 's10'); // the supplementary run picks Lina up again, extra day and all
    expect(w.s.invoices['INV-2611-001-2'].lines.map((l) => l.kind)).toEqual(['plan', 'extraDay']);
  });
  it('flags an early run (the month before is not over); the run on the 15th and the last day are not flagged', () => {
    const w = world();
    expect(runPlan(w.s, '2026-11', T).partialMonth).toBe('2026-10');
    expect(runPlan(w.s, '2026-11', '2026-11-15').partialMonth).toBeNull();
    expect(runPlan(w.s, '2026-11', '2026-10-31').partialMonth).toBeNull();
  });
  it('gives every invoice its own virtual account, derived from the member’s', () => {
    const w = world();
    issueNov(w);
    const m1 = w.s.members.m1.billing.va;
    const a = w.s.invoices['INV-2611-001'].va;
    expect(a).toBe(invoiceVa(m1, '2026-11'));
    expect(a).toMatch(/^8808\d{12}$/);
    expect(a).not.toBe(m1);
    expect(invoiceVa(m1, '2026-12')).not.toBe(a);
    const fresh = live(w.s.invoices).filter((i) => i.period === '2026-11').map((i) => i.va);
    expect(fresh).toHaveLength(5);
    expect(new Set(fresh).size).toBe(5); // one per invoice, none shared between members
    expect(bankVa('BCA', a)).toBe('3901' + a.slice(4));
    expect(bankVa('Mandiri', a).startsWith('8950')).toBe(true);
    expect(groupVa(bankVa('BCA', a))).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/);
  });
  it('notifies the payers and writes feed entries', () => {
    const w = world();
    issueNov(w);
    const f1 = updatesFor(w.s, getUser(clubs, 'f1')!).filter((x) => x.kind === 'finance.notif.invoiceIssued');
    expect(f1).toHaveLength(2); // Oma Lina and Opa Budi: one each
    expect(f1.map((x) => x.params.number).sort()).toEqual(['INV-2611-001', 'INV-2611-046']);
    expect(updatesFor(w.s, getUser(clubs, 'fm20_0')!).some((x) => x.kind === 'finance.notif.invoiceIssued' && x.params.number === 'INV-2611-020')).toBe(true);
    expect(updatesFor(w.s, getUser(clubs, 'f2')!).some((x) => x.kind === 'finance.notif.invoiceIssued')).toBe(false); // f2 is not a payer
    const feed = Object.values(w.s.activity).filter((a) => a.key === 'finance.feed.invoiceIssued');
    expect(feed).toHaveLength(5);
    expect(feed[0].memberId).toBeTruthy();
  });
  it('is for finance or management only, and only for a sensible period', () => {
    const w = world();
    w.fail('run.issue', { period: '2026-11' }, 's1', 'err.forbidden');
    w.fail('run.issue', { period: '2026-11' }, 'f1', 'err.forbidden');
    w.fail('run.issue', { period: '2027-03' }, 's10', 'finance.err.periodTooFar');
    w.fail('run.issue', { period: 'November' }, 's10', 'err.invalid');
    expect(() => w.run('run.issue', { period: '2026-11' }, 's9')).not.toThrow(); // management too
  });
  it('a second run only picks up what is still unbilled', () => {
    const w = world();
    issueNov(w);
    w.fail('run.issue', { period: '2026-11' }, 's10', 'finance.err.nothingToIssue');
    // voiding one invoice frees that member for a supplementary run
    w.run('invoice.void', { invoiceId: 'INV-2611-020', reason: 'Wrong plan' }, 's10');
    const r = w.run('run.issue', { period: '2026-11' }, 's10');
    expect(r.result.count).toBe(1);
    expect(w.s.invoices['INV-2611-020-2']).toMatchObject({ memberId: 'm20', period: '2026-11' });
    expect(live(w.s.invoiceRuns).filter((x) => x.period === '2026-11')).toHaveLength(2);
  });
  it('rolls the due date: 27 Dec 2026 is a Sunday, so 28 Dec', () => {
    const w = world();
    expect(dueDateFor(w.s, '2026-12')).toBe('2026-12-28');
    const r = w.run('run.issue', { period: '2026-12' }, 's10', at('2026-12-15'));
    expect(r.state.invoices['INV-2612-001']).toMatchObject({ dueDate: '2026-12-28', issueDate: '2026-12-15' });
    expect(r.state.invoices['INV-2612-001'].releasedEarly).toBeUndefined();
    expect(dueDateFor(w.s, '2027-02')).toBe('2027-02-26'); // 27 Feb is a Saturday and 28 Feb a Sunday: back to the Friday
  });
  it('a late run does not make invoices overdue on arrival', () => {
    const w = world();
    const r = w.run('run.issue', { period: '2026-11' }, 's10', at('2026-12-02'));
    expect(r.state.invoices['INV-2611-001'].dueDate >= '2026-12-02').toBe(true);
  });
  it('uses account credit once: a second run does not spend it again', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm46', amount: 10_000_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10');
    expect(accountCredit(w.s, 'm46')).toBe(500_000);
    const plan = runPlan(w.s, '2026-11', T);
    const budi = plan.issue.find((r) => r.member.id === 'm46')!;
    expect(budi.lines.map((l) => l.kind)).toEqual(['plan', 'credit']);
    expect(budi.total).toBe(9_000_000);
    issueNov(w);
    expect(creditApplied(w.s, 'm46')).toBe(500_000);
    expect(availableCredit(w.s, 'm46')).toBe(0);
    expect(runPlan(w.s, '2026-12', '2026-12-15').issue.find((r) => r.member.id === 'm46')!.lines.map((l) => l.kind)).toEqual(['plan']);
    // voiding the invoice gives the credit back
    w.run('invoice.void', { invoiceId: 'INV-2611-046', reason: 'Test' }, 's10');
    expect(availableCredit(w.s, 'm46')).toBe(500_000);
  });
  it('bills pending charges once and releases them when the invoice is voided', () => {
    const base = buildSeed().citra;
    const s: ClubState = { ...base, pendingCharges: { pc1: { id: 'pc1', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s9', memberId: 'm10', amount: 200_000, label: 'Outing lunch' } } };
    const w = world(s);
    issueNov(w);
    expect(w.s.invoices['INV-2611-010'].lines.find((l) => l.id === 'charge-pc1')).toMatchObject({ kind: 'adjustment', amount: 200_000, label: 'Outing lunch' });
    expect(w.s.pendingCharges.pc1.invoiceId).toBe('INV-2611-010');
    w.run('invoice.void', { invoiceId: 'INV-2611-010', reason: 'Re-issue' }, 's10');
    expect(w.s.pendingCharges.pc1.invoiceId).toBeUndefined();
  });
  it('skips members without a billing contact and says so', () => {
    const base = buildSeed().citra;
    const noPayer: ClubState = { ...base, familyLinks: Object.fromEntries(Object.entries(base.familyLinks).filter(([, l]) => l.memberId !== 'm10')) };
    const w = world(noPayer);
    issueNov(w);
    expect(w.s.invoices['INV-2611-010']).toBeUndefined();
    expect(live(w.s.invoiceRuns).find((x) => x.period === '2026-11')!.skipped).toEqual([{ memberId: 'm10', reason: 'noPayer' }]);
  });
  it('the scheduled job issues the run on the issue day, once', () => {
    const w = world();
    // 14 Nov: not yet
    expect(w.tick(at('2026-11-14')).patches).toHaveLength(0);
    // 15 Nov: the job runs it as the system
    const r = w.tick(at('2026-11-15', 480));
    expect(r.patches.length).toBeGreaterThan(0);
    const run = live(w.s.invoiceRuns).find((x) => x.period === '2026-11')!;
    expect(run).toMatchObject({ auto: true, issueDate: '2026-11-15' });
    expect(run.early).toBeUndefined();
    expect(w.s.invoices['INV-2611-001']).toMatchObject({ createdBy: 'system', issueDate: '2026-11-15' });
    // and not again
    expect(w.tick(at('2026-11-15', 490)).patches).toHaveLength(0);
    expect(updatesFor(w.s, getUser(clubs, 'f1')!).some((x) => x.kind === 'finance.notif.invoiceIssued')).toBe(true);
  });
  it('the job does nothing when the month already has a run (today: October)', () => {
    const w = world();
    expect(w.tick(at(T)).patches).toHaveLength(0);
  });
  it('nextRunPeriod: this month once its day has come and no run exists, otherwise next month', () => {
    const w = world();
    expect(nextRunPeriod(w.s, T)).toBe('2026-11'); // October's run exists
    expect(nextRunPeriod(w.s, '2026-11-16')).toBe('2026-11'); // 15th has passed, no November run
    expect(nextRunPeriod(w.s, '2026-11-10')).toBe('2026-12');
  });
});

describe('invoices', () => {
  it('adds a charge or a credit line, and tells the payer', () => {
    const w = world();
    w.run('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'Late pick-up', amount: 150_000 }, 's10');
    expect(w.s.invoices['INV-2610-001'].lines.at(-1)).toMatchObject({ kind: 'adjustment', label: 'Late pick-up', amount: 150_000 });
    expect(invoiceTotal(w.s.invoices['INV-2610-001'])).toBe(5_650_000);
    w.run('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'Goodwill', amount: -250_000 }, 's9');
    expect(w.s.invoices['INV-2610-001'].lines.at(-1)).toMatchObject({ kind: 'credit', amount: -250_000 });
    expect(invoiceTotal(w.s.invoices['INV-2610-001'])).toBe(5_400_000);
    expect(updatesFor(w.s, getUser(clubs, 'f1')!).filter((x) => x.kind === 'finance.notif.adjusted')).toHaveLength(2);
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'x', amount: 0 }, 's10', 'err.invalid');
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-001', label: '', amount: 5 }, 's10', 'err.invalid');
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'x', amount: 5 }, 's1', 'err.forbidden');
    w.fail('invoice.adjust', { invoiceId: 'nope', label: 'x', amount: 5 }, 's10', 'err.notFound');
  });
  it('a credit cannot take the total below what was paid', () => {
    const w = world();
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-002', label: 'Credit', amount: -1_000_000 }, 's10', 'finance.err.creditTooLarge'); // paid in full
    w.run('payment.record', { memberId: 'm1', amount: 4_000_000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10');
    expect(() => w.run('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'Credit', amount: -1_500_000 }, 's10')).not.toThrow(); // 5.5M − 1.5M = 4M = paid
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-001', label: 'Credit', amount: -1 }, 's10', 'finance.err.creditTooLarge');
  });
  it('voids only when nothing is paid, with a reason', () => {
    const w = world();
    w.fail('invoice.void', { invoiceId: 'INV-2610-002', reason: 'Oops' }, 's10', 'finance.err.voidPaid');
    w.fail('invoice.void', { invoiceId: 'INV-2610-020', reason: '  ' }, 's10', 'err.invalid');
    w.fail('invoice.void', { invoiceId: 'INV-2610-020', reason: 'x' }, 's1', 'err.forbidden');
    // part-paid counts as paid
    w.run('payment.record', { memberId: 'm20', amount: 100_000, method: 'cash', invoiceId: 'INV-2610-020' }, 's10');
    w.fail('invoice.void', { invoiceId: 'INV-2610-020', reason: 'x' }, 's10', 'finance.err.voidPaid');
    // unpaid: fine
    w.run('invoice.void', { invoiceId: 'INV-2610-046', reason: 'Member left early' }, 's10');
    expect(w.s.invoices['INV-2610-046'].voided).toMatchObject({ reason: 'Member left early', by: 'staff:s10' });
    expect(w.status('INV-2610-046')).toBe('void');
    expect(balanceOf(w.s, w.s.invoices['INV-2610-046'])).toBe(0);
    w.fail('invoice.void', { invoiceId: 'INV-2610-046', reason: 'again' }, 's10', 'finance.err.alreadyVoid');
    w.fail('invoice.adjust', { invoiceId: 'INV-2610-046', label: 'x', amount: 5 }, 's10', 'finance.err.invoiceVoid');
    w.fail('payment.record', { memberId: 'm46', amount: 5, method: 'cash', invoiceId: 'INV-2610-046' }, 's10', 'finance.err.invoiceVoid');
    // a fully refunded invoice has nothing paid any more: it can be voided
    const w2 = world();
    const p = w2.run('payment.record', { memberId: 'm20', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-020' }, 's10').result.paymentId as string;
    w2.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-020', amount: 9_500_000, reason: 'Wrong member', creditNote: false }, 's10');
    expect(() => w2.run('invoice.void', { invoiceId: 'INV-2610-020', reason: 'Wrong member' }, 's10')).not.toThrow();
  });
  it('sends a reminder: records it and tells the payer', () => {
    const w = world();
    const r = w.run('invoice.remind', { invoiceId: 'INV-2609-020' }, 's10');
    expect(w.s.invoices['INV-2609-020'].reminders).toEqual([{ at: `${T}T10:00`, by: 'staff:s10' }]);
    expect(r.result.to).toBe('Yohana Lim');
    expect(updatesFor(w.s, getUser(clubs, 'fm20_0')!).some((x) => x.kind === 'finance.notif.reminder' && x.params.number === 'INV-2609-020')).toBe(true);
    w.fail('invoice.remind', { invoiceId: 'INV-2610-002' }, 's10', 'finance.err.invoicePaid');
    w.fail('invoice.remind', { invoiceId: 'INV-2609-020' }, 's5', 'err.forbidden');
  });
  it('follows whoever is the primary contact now: who is told, who is shown, who may pay', () => {
    const w = world();
    // Daniel (f2) takes over billing for Oma Lina; Maria keeps Opa Budi
    w.set({ ...w.s, familyLinks: { ...w.s.familyLinks, 'f1:m1': { ...w.s.familyLinks['f1:m1'], primary: false }, 'f2:m1': { ...w.s.familyLinks['f2:m1'], primary: true } } });
    expect(payerOf(w.s, w.s.invoices['INV-2610-001'])?.id).toBe('f2');
    expect(w.s.invoices['INV-2610-001'].payerFamilyId).toBe('f1'); // as it was issued
    expect(payerOf(w.s, w.s.invoices['INV-2610-046'])?.id).toBe('f1');
    const r = w.run('invoice.remind', { invoiceId: 'INV-2610-001' }, 's10');
    expect(r.result.to).toBe('Daniel Wijaya');
    expect(updatesFor(w.s, w.who('f2')).some((x) => x.kind === 'finance.notif.reminder')).toBe(true);
    expect(updatesFor(w.s, w.who('f1')).some((x) => x.kind === 'finance.notif.reminder')).toBe(false);
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 'f1', 'err.forbidden');
    expect(() => w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 'f2')).not.toThrow();
    expect(updatesFor(w.s, w.who('f2')).some((x) => x.kind === 'finance.notif.paid')).toBe(true);
  });
  it('records a call note', () => {
    const w = world();
    w.run('invoice.callNote', { invoiceId: 'INV-2609-020', text: 'Spoke to Yohana, paying on Friday' }, 's10');
    expect(w.s.invoices['INV-2609-020'].callNotes).toEqual([{ at: `${T}T10:00`, by: 'staff:s10', text: 'Spoke to Yohana, paying on Friday' }]);
    w.fail('invoice.callNote', { invoiceId: 'INV-2609-020', text: '   ' }, 's10', 'err.invalid');
  });
});

describe('payments', () => {
  it('a partial payment makes the invoice part paid, the rest makes it paid', () => {
    const w = world();
    expect(w.status('INV-2610-046')).toBe('outstanding');
    const r = w.run('payment.record', { memberId: 'm46', amount: 4_000_000, method: 'bankTransferSgd', ref: 'SG-4471', invoiceId: 'INV-2610-046', foreign: { ccy: 'SGD', amount: 330.5 } }, 's10');
    expect(w.status('INV-2610-046')).toBe('partial');
    expect(balanceOf(w.s, w.s.invoices['INV-2610-046'])).toBe(5_500_000);
    const pay = w.s.payments[r.result.paymentId as string];
    expect(pay).toMatchObject({ memberId: 'm46', method: 'bankTransferSgd', amount: 4_000_000, ref: 'SG-4471', receivedOn: T, receivedAt: '10:00', xero: 'pending', by: 'staff:s10', foreign: { ccy: 'SGD', amount: 330.5 } });
    expect(pay.allocations).toEqual([{ invoiceId: 'INV-2610-046', amount: 4_000_000 }]);
    expect(w.s.invoices['INV-2610-046'].xero).toBe('awaitingPayment'); // not settled yet
    w.run('payment.record', { memberId: 'm46', amount: 5_500_000, method: 'revolut', ref: 'RV-1', invoiceId: 'INV-2610-046' }, 's10');
    expect(w.status('INV-2610-046')).toBe('paid');
    expect(w.s.invoices['INV-2610-046'].xero).toBe('pending'); // settled: Xero hears about it
    expect(paidOn(w.s, 'INV-2610-046')).toBe(9_500_000);
  });
  it('without a chosen invoice the oldest due is paid first; the rest goes on to the next', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm20', amount: 12_000_000, method: 'cash' }, 's10');
    expect(w.status('INV-2609-020')).toBe('paid'); // September, due first
    expect(w.status('INV-2610-020')).toBe('partial');
    expect(balanceOf(w.s, w.s.invoices['INV-2610-020'])).toBe(7_000_000);
  });
  it('a chosen invoice goes first even when an older one is open', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm20', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-020' }, 's10');
    expect(w.status('INV-2610-020')).toBe('paid');
    expect(w.status('INV-2609-020')).toBe('overdue');
  });
  it('an overpayment stays on the account as credit', () => {
    const w = world();
    const r = w.run('payment.record', { memberId: 'm46', amount: 10_000_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10');
    expect(r.result).toMatchObject({ credit: 500_000, allocations: 1 });
    expect(accountCredit(w.s, 'm46')).toBe(500_000);
    expect(w.status('INV-2610-046')).toBe('paid');
  });
  it('validates and checks permissions', () => {
    const w = world();
    w.fail('payment.record', { memberId: 'm46', amount: 1000, method: 'cash' }, 's1', 'err.forbidden');
    w.fail('payment.record', { memberId: 'm46', amount: 1000, method: 'cash' }, 'f1', 'err.forbidden');
    w.fail('payment.record', { memberId: 'm46', amount: 0, method: 'cash' }, 's10', 'err.invalid');
    w.fail('payment.record', { memberId: 'm46', amount: 1000, method: 'bitcoin' }, 's10', 'err.invalid');
    w.fail('payment.record', { memberId: 'm46', amount: 1000, method: 'revolut', foreign: { ccy: 'USD', amount: 3 } }, 's10', 'err.invalid');
    w.fail('payment.record', { memberId: 'nobody', amount: 1000, method: 'cash' }, 's10', 'err.notFound');
    w.fail('payment.record', { memberId: 'm46', amount: 1000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', 'err.notFound'); // someone else's invoice
    w.fail('payment.record', { memberId: 'm2', amount: 1000, method: 'cash', invoiceId: 'INV-2610-002' }, 's10', 'finance.err.invoicePaid');
  });
  it('tells management, the payer and the feed', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm46', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10');
    const mgmt = updatesFor(w.s, getUser(clubs, 's9')!).find((x) => x.kind === 'notif.paymentReceived' && x.params.invoice === 'INV-2610-046');
    expect(mgmt?.params).toMatchObject({ name: 'Maria Wijaya', amount: 'Rp 9.500.000' });
    expect(updatesFor(w.s, getUser(clubs, 'f1')!).some((x) => x.kind === 'finance.notif.paid')).toBe(true);
    expect(Object.values(w.s.activity).some((a) => a.key === 'finance.feed.pay_cash' && a.memberId === 'm46')).toBe(true);
  });
});

describe('payment.simulateVa (DOKU, demo)', () => {
  it('the primary contact pays for both parents: one payment per member', () => {
    const w = world();
    const r = w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001', 'INV-2610-046'], bank: 'Mandiri' }, 'f1');
    expect(r.result.total).toBe(5_500_000 + 9_500_000);
    const pays = (r.result.paymentIds as string[]).map((id) => w.s.payments[id]);
    expect(pays).toHaveLength(2);
    expect(pays.map((p) => p.memberId).sort()).toEqual(['m1', 'm46']);
    for (const p of pays) expect(p).toMatchObject({ method: 'dokuVa', bank: 'Mandiri', by: 'family:f1', receivedOn: T, xero: 'pending' });
    expect(w.status('INV-2610-001')).toBe('paid');
    expect(w.status('INV-2610-046')).toBe('paid');
    // finance and management hear about it; so does the payer
    expect(updatesFor(w.s, getUser(clubs, 's10')!).filter((x) => x.kind === 'notif.paymentReceived')).toHaveLength(3); // + the seeded one
    expect(updatesFor(w.s, getUser(clubs, 's9')!).some((x) => x.kind === 'notif.paymentReceived' && x.params.invoice === 'INV-2610-001')).toBe(true);
    expect(updatesFor(w.s, getUser(clubs, 'f1')!).filter((x) => x.kind === 'finance.notif.paid')).toHaveLength(2);
    expect(Object.values(w.s.activity).filter((a) => a.key === 'finance.feed.pay_dokuVa')).toHaveLength(2);
  });
  it('f1 (primary) may, f2 (not primary) may not, nobody may pay a stranger’s invoice', () => {
    const w = world();
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 'f2', 'err.forbidden');
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-020'], bank: 'BCA' }, 'f1', 'err.forbidden');
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001', 'INV-2610-020'], bank: 'BCA' }, 'f1', 'err.forbidden');
    w.fail('payment.simulateVa', { invoiceIds: ['nope'], bank: 'BCA' }, 'f1', 'err.forbidden');
    w.fail('payment.simulateVa', { invoiceIds: [], bank: 'BCA' }, 'f1', 'err.invalid');
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'HSBC' }, 'f1', 'err.invalid');
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 's1', 'err.forbidden'); // lobby
    expect(() => w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 's10')).not.toThrow(); // finance on a family's behalf
  });
  it('works on the family’s own projected state too (the optimistic run in the browser)', () => {
    const w = world();
    const view = projectForFamily(w.s, 'f1');
    const r = execute(view, 'payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, getUser(clubs, 'f1')!, at(T), 'proj1');
    expect(invoiceStatus(r.state, r.state.invoices['INV-2610-001'], T)).toBe('paid');
    // f2 is not primary in the projection either
    expect(() => execute(projectForFamily(w.s, 'f2'), 'payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, getUser(clubs, 'f2')!, at(T), 'proj2')).toThrow('err.forbidden');
  });
  it('an invoice that is already paid is not paid twice', () => {
    const w = world();
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-010'], bank: 'BCA' }, 'fm10_0', 'finance.err.nothingToPay');
    w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 'f1');
    w.fail('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' }, 'f1', 'finance.err.nothingToPay');
  });
  it('pays only what is left on a part-paid invoice', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm1', amount: 1_000_000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10');
    const r = w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BNI' }, 'f1');
    expect(r.result.total).toBe(4_500_000);
    expect(w.status('INV-2610-001')).toBe('paid');
  });
});

describe('refunds', () => {
  const paid = () => {
    const w = world();
    const p = w.run('payment.record', { memberId: 'm1', amount: 5_500_000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10').result.paymentId as string;
    return { w, p };
  };
  it('a partial refund without a credit note re-opens the invoice', () => {
    const { w, p } = paid();
    w.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 1_000_000, reason: 'Absent all month', creditNote: false }, 's10');
    expect(paidOn(w.s, 'INV-2610-001')).toBe(4_500_000);
    expect(invoiceTotal(w.s.invoices['INV-2610-001'])).toBe(5_500_000);
    expect(w.status('INV-2610-001')).toBe('partial');
    expect(refundableOn(w.s, p, 'INV-2610-001')).toBe(4_500_000);
    const rf = live(w.s.refunds)[0];
    expect(rf).toMatchObject({ paymentId: p, invoiceId: 'INV-2610-001', amount: 1_000_000, creditNote: false, reason: 'Absent all month', xero: 'pending' });
  });
  it('with a credit note the invoice stays settled and shrinks by the same amount', () => {
    const { w, p } = paid();
    w.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 1_000_000, reason: 'Absent all month', creditNote: true }, 's9');
    expect(invoiceTotal(w.s.invoices['INV-2610-001'])).toBe(4_500_000);
    expect(paidOn(w.s, 'INV-2610-001')).toBe(4_500_000);
    expect(w.status('INV-2610-001')).toBe('paid');
    expect(w.s.invoices['INV-2610-001'].lines.at(-1)).toMatchObject({ kind: 'credit', label: 'finance.line.creditNote', amount: -1_000_000 });
    expect(w.s.invoices['INV-2610-001'].xero).toBe('pending');
  });
  it('cannot exceed what was paid, counting earlier refunds', () => {
    const { w, p } = paid();
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 5_500_001, reason: 'x', creditNote: false }, 's10', 'finance.err.refundTooMuch');
    w.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 5_000_000, reason: 'x', creditNote: false }, 's10');
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 600_000, reason: 'x', creditNote: false }, 's10', 'finance.err.refundTooMuch');
    w.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 500_000, reason: 'rest', creditNote: false }, 's10'); // the full amount in the end
    expect(paidOn(w.s, 'INV-2610-001')).toBe(0);
    expect(w.status('INV-2610-001')).toBe('outstanding');
  });
  it('needs a reason, an allocation, and finance or management', () => {
    const { w, p } = paid();
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 1, reason: ' ', creditNote: false }, 's10', 'err.invalid');
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-046', amount: 1, reason: 'x', creditNote: false }, 's10', 'finance.err.noAllocation');
    w.fail('refund.record', { paymentId: 'nope', invoiceId: 'INV-2610-001', amount: 1, reason: 'x', creditNote: false }, 's10', 'err.notFound');
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 1, reason: 'x', creditNote: false }, 's1', 'err.forbidden');
    w.fail('refund.record', { paymentId: p, invoiceId: 'INV-2610-001', amount: 1, reason: 'x', creditNote: false }, 'f1', 'err.forbidden');
  });
  it('totals exclude refunds', () => {
    const w = world();
    const r = w.run('payment.simulateVa', { invoiceIds: ['INV-2610-001', 'INV-2610-046'], bank: 'BCA' }, 'f1');
    const [p1, p2] = r.result.paymentIds as string[];
    let b = paymentsBoard(w.s, T);
    expect(b.today).toEqual({ n: 2, sum: 15_000_000 });
    expect(b.month).toEqual({ n: 4, sum: 30_000_000 }); // + Hendra's and Bambang's October payments in the seed
    expect(b.xeroPending).toBe(2);
    w.run('refund.record', { paymentId: p1, invoiceId: w.s.payments[p1].allocations[0].invoiceId, amount: w.s.payments[p1].amount, reason: 'Refund in full', creditNote: false }, 's10');
    b = paymentsBoard(w.s, T);
    expect(b.today.n).toBe(1); // the fully refunded payment no longer counts
    expect(b.today.sum).toBe(w.s.payments[p2].amount);
    expect(b.month.sum).toBe(30_000_000 - 5_500_000);
    expect(b.refunds).toEqual({ n: 1, sum: 5_500_000 });
    expect(b.xeroPending).toBe(3);
  });
});

describe('Xero (simulated)', () => {
  it('a payment waits in "pending" and the job syncs it about two demo minutes later', () => {
    const w = world();
    const r = w.run('payment.record', { memberId: 'm46', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10', at(T, 600));
    const id = r.result.paymentId as string;
    expect(w.s.payments[id].xero).toBe('pending');
    expect(w.s.invoices['INV-2610-046'].xero).toBe('pending');
    expect(billingBoard(w.s, T).xero.map((v) => v.inv.id)).toEqual(['INV-2610-046']);
    w.tick(at(T, 601)); // one minute: still pending
    expect(w.s.payments[id].xero).toBe('pending');
    expect(w.tick(at(T, 601)).patches).toHaveLength(0);
    w.tick(at(T, 602)); // two minutes
    expect(w.s.payments[id].xero).toBe('synced');
    expect(w.s.invoices['INV-2610-046'].xero).toBe('synced');
    expect(billingBoard(w.s, T).xero).toHaveLength(0);
    expect(dtMinutes(`${T}T10:02`) - dtMinutes(`${T}T10:00`)).toBe(2);
  });
  it('xero.sync flips everything at once', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm46', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10');
    w.run('payment.record', { memberId: 'm20', amount: 1_000_000, method: 'revolut', ref: 'R', invoiceId: 'INV-2610-020' }, 's10');
    expect(paymentsBoard(w.s, T).xeroPending).toBe(2);
    const r = w.run('xero.sync', {}, 's10');
    expect(r.result.synced).toBeGreaterThanOrEqual(3); // two payments + the invoice they settled
    expect(paymentsBoard(w.s, T).xeroPending).toBe(0);
    expect(w.s.invoices['INV-2610-046'].xero).toBe('synced');
    expect(w.s.invoices['INV-2610-020'].xero).toBe('awaitingPayment'); // part paid: still waiting for the rest
    expect(w.run('xero.sync', {}, 's10').patches).toHaveLength(0); // nothing left: no change
    w.fail('xero.sync', {}, 's1', 'err.forbidden');
    w.fail('xero.sync', {}, 'f1', 'err.forbidden');
  });
  it('refunds, approved receipts and approved vendor invoices sync too', () => {
    const w = world();
    const p = w.run('payment.record', { memberId: 'm20', amount: 9_500_000, method: 'cash', invoiceId: 'INV-2610-020' }, 's10').result.paymentId as string;
    w.run('refund.record', { paymentId: p, invoiceId: 'INV-2610-020', amount: 500_000, reason: 'Goodwill', creditNote: true }, 's10');
    const rc = w.run('receipt.add', { date: T, supplier: 'Toko A', amount: 100_000, sectionId: 'fnb', fileName: 'a.jpg' }, 's2').result.receiptId as string;
    w.run('receipt.approve', { id: rc }, 's10');
    w.run('vendorInvoice.approve', { id: 'vi1' }, 's10');
    expect(w.s.receipts[rc].xero).toBe('pending');
    expect(w.s.vendorInvoices.vi1.xero).toBe('pending');
    w.tick(at(T, 603));
    expect(live(w.s.refunds)[0].xero).toBe('synced');
    expect(w.s.receipts[rc].xero).toBe('synced');
    expect(w.s.vendorInvoices.vi1.xero).toBe('synced');
    expect(w.s.invoices['INV-2610-020'].xero).toBe('synced');
  });
});

describe('budget', () => {
  it('any staff can request; finance and management requests stay pending too', () => {
    const w = world().withAccess('s7');
    for (const uid of ['s5', 's8', 's10', 's9', 's7']) {
      const r = w.run('budget.request', { sectionId: 'operations', item: `Item by ${uid}`, amount: 100_000 }, uid);
      expect(w.s.budgetRequests[r.result.requestId as string]).toMatchObject({ status: 'pending', requestedBy: uid, sectionId: 'operations', weekStart: '2026-10-19', amount: 100_000 });
    }
    w.fail('budget.request', { sectionId: 'operations', item: 'x', amount: 1 }, 'f1', 'err.forbidden');
    w.fail('budget.request', { sectionId: 'nope', item: 'x', amount: 1 }, 's10', 'err.notFound');
    w.fail('budget.request', { sectionId: 'operations', item: '', amount: 1 }, 's10', 'err.invalid');
    w.fail('budget.request', { sectionId: 'operations', item: 'x', amount: -5 }, 's10', 'err.invalid');
  });
  it('the week is Monday to Sunday: a request made on a Sunday belongs to that week', () => {
    const w = world();
    const r = w.run('budget.request', { sectionId: 'fnb', item: 'Sunday shop', amount: 50_000 }, 's2', at('2026-10-25'));
    expect(w.s.budgetRequests[r.result.requestId as string].weekStart).toBe('2026-10-19');
    const r2 = w.run('budget.request', { sectionId: 'fnb', item: 'Monday shop', amount: 50_000 }, 's2', at('2026-10-26'));
    expect(w.s.budgetRequests[r2.result.requestId as string].weekStart).toBe('2026-10-26');
  });
  it('approving moves a request from "waiting" to "committed" and tells the requester', () => {
    const w = world();
    expect(budgetWeekOf(w.s, 'activities', T)).toMatchObject({ spent: 840_000, committed: 0, used: 840_000, left: 1_160_000 });
    w.run('budget.approve', { id: 'b1' }, 's10');
    expect(w.s.budgetRequests.b1).toMatchObject({ status: 'approved', decidedBy: 'staff:s10', decidedAt: `${T}T10:00` });
    expect(budgetWeekOf(w.s, 'activities', T)).toMatchObject({ spent: 840_000, committed: 450_000, used: 1_290_000, left: 710_000 });
    expect(budgetWeek(w.s, 'activities', T).committed).toBe(450_000); // same as the shared selector
    expect(updatesFor(w.s, getUser(clubs, 's5')!).some((x) => x.kind === 'finance.notif.budgetApproved' && x.params.item === 'Angklung tuning')).toBe(true);
    w.fail('budget.approve', { id: 'b1' }, 's10', 'finance.err.notPending');
    w.fail('budget.approve', { id: 'b2' }, 's5', 'err.forbidden');
    w.fail('budget.approve', { id: 'b2' }, 's2', 'err.forbidden');
  });
  it('rejecting needs a note, keeps it, and tells the requester', () => {
    const w = world();
    w.fail('budget.reject', { id: 'b2', note: '' }, 's10', 'err.invalid');
    w.run('budget.reject', { id: 'b2', note: 'Use the usual supplier' }, 's9');
    expect(w.s.budgetRequests.b2).toMatchObject({ status: 'rejected', note: 'Use the usual supplier' });
    expect(budgetWeekOf(w.s, 'fnb', T).committed).toBe(0);
    expect(updatesFor(w.s, getUser(clubs, 's2')!).some((x) => x.kind === 'finance.notif.budgetRejected')).toBe(true);
  });
  it('the requester can edit and cancel while it is pending; nobody else, and not afterwards', () => {
    const w = world().withAccess('s7');
    w.fail('budget.cancel', { id: 'b1' }, 's2', 'err.forbidden'); // someone else's
    w.fail('budget.cancel', { id: 'b1' }, 's10', 'err.forbidden'); // finance rejects instead
    w.fail('budget.edit', { id: 'b1', amount: 1 }, 's2', 'err.forbidden');
    w.run('budget.edit', { id: 'b1', item: 'Angklung tuning and strings', amount: 500_000 }, 's5');
    expect(w.s.budgetRequests.b1).toMatchObject({ item: 'Angklung tuning and strings', amount: 500_000 });
    w.run('budget.edit', { id: 'b1', amount: 480_000 }, 's10'); // finance may edit too
    w.run('budget.cancel', { id: 'b1' }, 's5');
    expect(w.s.budgetRequests.b1.status).toBe('cancelled');
    w.fail('budget.cancel', { id: 'b1' }, 's5', 'finance.err.notPending');
    w.fail('budget.edit', { id: 'b1', amount: 1 }, 's5', 'finance.err.notPending');
    // approved: the requester can no longer pull it back
    w.fail('budget.cancel', { id: 'b3' }, 's7', 'finance.err.notPending');
  });
  it('sets a weekly limit from a Monday on, keeping the history', () => {
    const w = world();
    w.run('budget.setLimit', { sectionId: 'fnb', weekly: 10_000_000, fromWeek: '2026-10-28' }, 's10'); // a Wednesday: starts Monday 26 Oct
    expect(w.s.budgetSections.fnb.limits.at(-1)).toEqual({ fromWeek: '2026-10-26', weekly: 10_000_000 });
    expect(budgetWeekOf(w.s, 'fnb', '2026-10-21').limit).toBe(9_500_000);
    expect(budgetWeekOf(w.s, 'fnb', '2026-10-27').limit).toBe(10_000_000);
    w.run('budget.setLimit', { sectionId: 'fnb', weekly: 9_000_000, fromWeek: '2026-10-26' }, 's9'); // same week: replaced
    expect(w.s.budgetSections.fnb.limits.filter((l) => l.fromWeek === '2026-10-26')).toEqual([{ fromWeek: '2026-10-26', weekly: 9_000_000 }]);
    w.fail('budget.setLimit', { sectionId: 'fnb', weekly: 1, fromWeek: '2026-10-26' }, 's5', 'err.forbidden');
    w.fail('budget.setLimit', { sectionId: 'fnb', weekly: -1, fromWeek: '2026-10-26' }, 's10', 'err.invalid');
    w.fail('budget.setLimit', { sectionId: 'nope', weekly: 1, fromWeek: '2026-10-26' }, 's10', 'err.notFound');
  });
  it('adds and renames sections', () => {
    const w = world().withAccess('s7');
    const r = w.run('budget.addSection', { name: 'Transport', nameId: 'Transportasi', weekly: 1_500_000 }, 's10');
    const id = r.result.sectionId as string;
    expect(w.s.budgetSections[id]).toMatchObject({ name: 'Transport', nameId: 'Transportasi', limits: [{ fromWeek: '2026-10-19', weekly: 1_500_000 }] });
    expect(budgetWeekOf(w.s, id, T)).toMatchObject({ limit: 1_500_000, spent: 0, left: 1_500_000 });
    w.fail('budget.addSection', { name: ' transport ', weekly: 1 }, 's10', 'finance.err.sectionExists');
    w.fail('budget.addSection', { name: 'f&b', weekly: 1 }, 's10', 'finance.err.sectionExists');
    w.fail('budget.addSection', { name: 'X', weekly: 1 }, 's2', 'err.forbidden');
    w.run('budget.renameSection', { id, name: 'Transport and fuel' }, 's9');
    expect(w.s.budgetSections[id].name).toBe('Transport and fuel');
    expect(w.s.budgetSections[id].nameId).toBeUndefined();
    w.fail('budget.renameSection', { id, name: 'Activities' }, 's10', 'finance.err.sectionExists');
    // a request can use the new section straight away
    expect(() => w.run('budget.request', { sectionId: id, item: 'Fuel', amount: 200_000 }, 's7')).not.toThrow();
  });
  it('the seed numbers: spend is receipts, committed is approved requests without a receipt', () => {
    const w = world();
    expect(budgetWeekOf(w.s, 'fnb', T)).toMatchObject({ used: 6_120_000, committed: 0 });
    expect(budgetWeekOf(w.s, 'operations', T)).toMatchObject({ spent: 1_170_000, committed: 250_000, used: 1_420_000 });
    expect(budgetRange(w.s, T)).toEqual({ first: '2026-01-05', last: '2026-10-26' });
    // another week is empty
    expect(budgetWeekOf(w.s, 'fnb', '2026-10-14')).toMatchObject({ weekStart: '2026-10-12', spent: 0, committed: 0, left: 9_500_000 });
  });
  it('a receipt that settles an approved request turns committed into spent: no double count, in any week', () => {
    const w = world().withAccess('s7');
    const r = w.run('receipt.add', { date: '2026-10-20', supplier: 'Bengkel Maju', amount: 240_000, sectionId: 'operations', budgetRequestId: 'b3', fileName: 'nota.jpg' }, 's7');
    expect(budgetWeekOf(w.s, 'operations', T)).toMatchObject({ spent: 1_170_000 + 240_000, committed: 0, used: 1_410_000 });
    // receipted in a later week: the request no longer counts as committed in its own week
    const s2 = { ...w.s, receipts: { ...w.s.receipts, [r.result.receiptId as string]: { ...w.s.receipts[r.result.receiptId as string], date: '2026-10-27' } } };
    expect(budgetWeekOf(s2, 'operations', T).committed).toBe(0);
    expect(budgetWeek(s2, 'operations', T).committed).toBe(250_000); // the shared selector counts it twice
    expect(budgetWeekOf(s2, 'operations', '2026-10-27').spent).toBe(240_000);
    // a rejected receipt un-links the request again
    w.run('receipt.reject', { id: r.result.receiptId, note: 'Wrong nota' }, 's10');
    expect(budgetWeekOf(w.s, 'operations', T)).toMatchObject({ spent: 1_170_000, committed: 250_000 });
  });
  it('week labels are derived from the date: the switcher range follows the clock', () => {
    const w = world();
    expect(budgetRange(w.s, '2026-11-18').last).toBe('2026-11-23');
    expect(budgetWeekOf(w.s, 'fnb', '2026-11-18')).toMatchObject({ weekStart: '2026-11-16', weekEnd: '2026-11-22' });
  });
});

describe('receipts', () => {
  it('any staff can submit a receipt: it counts as spend at once and waits for approval', () => {
    const w = world();
    const r = w.run('receipt.add', { date: T, supplier: 'Toko Batik', amount: 300_000, sectionId: 'activities', fileName: 'nota_2110.jpg' }, 's5');
    const rc = w.s.receipts[r.result.receiptId as string];
    expect(rc).toMatchObject({ status: 'submitted', by: 's5', sectionId: 'activities', amount: 300_000, xero: 'notSent', fileName: 'nota_2110.jpg', date: T });
    expect(budgetWeekOf(w.s, 'activities', T).spent).toBe(840_000 + 300_000);
    // finance and management submit too: still waiting for approval
    for (const uid of ['s10', 's9']) {
      const id = w.run('receipt.add', { date: T, supplier: 'X', amount: 1000, sectionId: 'fnb', fileName: 'x.jpg' }, uid).result.receiptId as string;
      expect(w.s.receipts[id].status).toBe('submitted');
    }
    w.fail('receipt.add', { date: T, supplier: 'X', amount: 1000, sectionId: 'fnb', fileName: 'x.jpg' }, 'f1', 'err.forbidden');
    w.fail('receipt.add', { date: '2026-10-22', supplier: 'X', amount: 1000, sectionId: 'fnb', fileName: 'x.jpg' }, 's5', 'finance.err.futureDate');
    w.fail('receipt.add', { date: T, supplier: 'X', amount: 1000, sectionId: 'nope', fileName: 'x.jpg' }, 's5', 'err.notFound');
    w.fail('receipt.add', { date: T, supplier: 'X', amount: 0, sectionId: 'fnb', fileName: 'x.jpg' }, 's5', 'err.invalid');
    w.fail('receipt.add', { date: 'soon', supplier: 'X', amount: 5, sectionId: 'fnb', fileName: 'x.jpg' }, 's5', 'err.invalid');
  });
  it('keeps the id of the photo taken with the camera, and nothing when there is none', () => {
    const w = world();
    const a = w.run('receipt.add', { date: T, supplier: 'Toko Batik', amount: 300_000, sectionId: 'activities', mediaId: 'md_abcdefghijklmnopqrstuvwx' }, 's5');
    expect(w.s.receipts[a.result.receiptId as string].mediaId).toBe('md_abcdefghijklmnopqrstuvwx');
    const b = w.run('receipt.add', { date: T, supplier: 'Toko Batik', amount: 300_000, sectionId: 'activities' }, 's5');
    expect('mediaId' in w.s.receipts[b.result.receiptId as string]).toBe(false);
  });
  it('picks a supplier from the directory or free text, and defaults the file name from the date', () => {
    const w = world();
    const a = w.run('receipt.add', { date: T, supplier: 'Sayur Segar Kemang', directoryId: 'd6', amount: 500_000, sectionId: 'fnb' }, 's2');
    expect(w.s.receipts[a.result.receiptId as string]).toMatchObject({ directoryId: 'd6', fileName: 'nota_2110.jpg' });
    const b = w.run('receipt.add', { date: T, supplier: 'Warung Bu Tini', amount: 20_000, sectionId: 'fnb', fileName: 'warung.jpg' }, 's2');
    expect(w.s.receipts[b.result.receiptId as string].directoryId).toBeUndefined();
    w.fail('receipt.add', { date: T, supplier: 'X', directoryId: 'nope', amount: 5, sectionId: 'fnb' }, 's2', 'err.notFound');
  });
  it('only an approved request of the same section that nobody has receipted can be linked', () => {
    const w = world().withAccess('s7');
    const ok = { date: T, supplier: 'X', amount: 200_000, sectionId: 'operations', budgetRequestId: 'b3', fileName: 'x.jpg' };
    w.fail('receipt.add', { ...ok, budgetRequestId: 'b1' }, 's7', 'finance.err.requestNotLinkable'); // pending, and another section
    w.fail('receipt.add', { ...ok, sectionId: 'fnb' }, 's7', 'finance.err.requestNotLinkable');
    w.run('receipt.add', ok, 's7');
    w.fail('receipt.add', ok, 's7', 'finance.err.requestNotLinkable'); // already receipted
  });
  it('finance approves: Xero pending, submitter told; or rejects with a note: no longer spent', () => {
    const w = world();
    const id = w.run('receipt.add', { date: T, supplier: 'Toko Batik', amount: 300_000, sectionId: 'activities', fileName: 'n.jpg' }, 's5').result.receiptId as string;
    w.fail('receipt.approve', { id }, 's5', 'err.forbidden');
    w.fail('receipt.approve', { id }, 's2', 'err.forbidden');
    w.run('receipt.approve', { id }, 's10');
    expect(w.s.receipts[id]).toMatchObject({ status: 'approved', decidedBy: 'staff:s10', xero: 'pending' });
    expect(updatesFor(w.s, getUser(clubs, 's5')!).some((x) => x.kind === 'finance.notif.receiptApproved')).toBe(true);
    w.fail('receipt.approve', { id }, 's10', 'finance.err.notPending');
    const id2 = w.run('receipt.add', { date: T, supplier: 'Toko Salah', amount: 50_000, sectionId: 'activities', fileName: 'n2.jpg' }, 's5').result.receiptId as string;
    w.fail('receipt.reject', { id: id2, note: '' }, 's9', 'err.invalid');
    w.run('receipt.reject', { id: id2, note: 'Not a club expense' }, 's9');
    expect(w.s.receipts[id2]).toMatchObject({ status: 'rejected', note: 'Not a club expense' });
    expect(budgetWeekOf(w.s, 'activities', T).spent).toBe(840_000 + 300_000);
    expect(updatesFor(w.s, getUser(clubs, 's5')!).some((x) => x.kind === 'finance.notif.receiptRejected')).toBe(true);
  });
  it('your own receipt can be voided while it waits; finance can void any; others cannot', () => {
    const w = world();
    const id = w.run('receipt.add', { date: T, supplier: 'A', amount: 10_000, sectionId: 'fnb', fileName: 'a.jpg' }, 's2').result.receiptId as string;
    w.fail('receipt.void', { id }, 's5', 'err.forbidden');
    w.run('receipt.void', { id }, 's2');
    expect(w.s.receipts[id].voidedAt).toBe(`${T}T10:00`);
    expect(budgetWeekOf(w.s, 'fnb', T).spent).toBe(6_120_000);
    w.fail('receipt.void', { id }, 's2', 'err.notFound'); // already void
    const id2 = w.run('receipt.add', { date: T, supplier: 'B', amount: 10_000, sectionId: 'fnb', fileName: 'b.jpg' }, 's2').result.receiptId as string;
    w.run('receipt.approve', { id: id2 }, 's10');
    w.fail('receipt.void', { id: id2 }, 's2', 'err.forbidden'); // approved: no longer yours to pull back
    expect(() => w.run('receipt.void', { id: id2 }, 's10')).not.toThrow(); // finance can
  });
  it('edits: the submitter while it waits (and after a rejection, which sends it again); finance any time', () => {
    const w = world();
    const id = w.run('receipt.add', { date: T, supplier: 'A', amount: 10_000, sectionId: 'fnb', fileName: 'a.jpg' }, 's2').result.receiptId as string;
    w.run('receipt.edit', { id, amount: 12_000, supplier: 'Sayur Segar Kemang', directoryId: 'd6' }, 's2');
    expect(w.s.receipts[id]).toMatchObject({ amount: 12_000, supplier: 'Sayur Segar Kemang', directoryId: 'd6' });
    w.fail('receipt.edit', { id, amount: 1 }, 's5', 'err.forbidden');
    w.run('receipt.reject', { id, note: 'Amount?' }, 's10');
    w.run('receipt.edit', { id, amount: 11_500 }, 's2');
    expect(w.s.receipts[id]).toMatchObject({ status: 'submitted', amount: 11_500 });
    expect(w.s.receipts[id].note).toBeUndefined();
    w.run('receipt.approve', { id }, 's10');
    w.fail('receipt.edit', { id, amount: 1 }, 's2', 'finance.err.alreadyApproved');
    w.run('receipt.edit', { id, amount: 11_000, directoryId: null }, 's10');
    expect(w.s.receipts[id]).toMatchObject({ status: 'approved', amount: 11_000 });
    expect(w.s.receipts[id].directoryId).toBeUndefined();
  });
});

describe('vendor invoices', () => {
  const add = { supplier: 'Ikan Laut Jaya', directoryId: 'd7', number: 'ILJ-2610-77', amount: 3_200_000, due: '2026-11-05', sectionId: 'fnb' };
  it('adds, edits, approves, marks paid; paid ones stay on record', () => {
    const w = world();
    const id = w.run('vendorInvoice.add', add, 's10').result.vendorInvoiceId as string;
    expect(w.s.vendorInvoices[id]).toMatchObject({ ...add, status: 'toApprove', xero: 'notSent' });
    w.run('vendorInvoice.edit', { id, amount: 3_250_000, due: '2026-11-07' }, 's9');
    expect(w.s.vendorInvoices[id]).toMatchObject({ amount: 3_250_000, due: '2026-11-07' });
    w.fail('vendorInvoice.markPaid', { id }, 's10', 'finance.err.notApproved');
    w.run('vendorInvoice.approve', { id }, 's10');
    expect(w.s.vendorInvoices[id]).toMatchObject({ status: 'approved', xero: 'pending', decidedBy: 'staff:s10' });
    w.fail('vendorInvoice.approve', { id }, 's10', 'finance.err.notPending');
    w.run('vendorInvoice.markPaid', { id }, 's10');
    expect(w.s.vendorInvoices[id]).toMatchObject({ status: 'paid', paidOn: T, paidBy: 'staff:s10' });
    w.fail('vendorInvoice.delete', { id }, 's10', 'finance.err.vendorPaid');
    w.fail('vendorInvoice.edit', { id, amount: 1 }, 's10', 'finance.err.vendorPaid');
  });
  it('rejects with a note, deletes, and does not allow the same number twice for a supplier', () => {
    const w = world();
    w.fail('vendorInvoice.reject', { id: 'vi1', note: '' }, 's10', 'err.invalid');
    w.run('vendorInvoice.reject', { id: 'vi1', note: 'Quantities do not match the delivery' }, 's10');
    expect(w.s.vendorInvoices.vi1).toMatchObject({ status: 'rejected', note: 'Quantities do not match the delivery' });
    w.run('vendorInvoice.edit', { id: 'vi1', amount: 7_000_000 }, 's10'); // corrected: back in the queue
    expect(w.s.vendorInvoices.vi1.status).toBe('toApprove');
    w.fail('vendorInvoice.add', { ...add, supplier: 'Sayur Segar Kemang', number: 'inv/ssk/1023' }, 's10', 'finance.err.duplicateInvoice');
    w.run('vendorInvoice.delete', { id: 'vi1' }, 's10');
    expect(live(w.s.vendorInvoices).map((v) => v.id)).toEqual(['vi2']);
    w.fail('vendorInvoice.delete', { id: 'vi1' }, 's10', 'err.notFound');
  });
  it('is for finance and management', () => {
    const w = world();
    for (const uid of ['s1', 's2', 's5', 's8', 'f1']) {
      w.fail('vendorInvoice.add', add, uid, 'err.forbidden');
      w.fail('vendorInvoice.approve', { id: 'vi1' }, uid, 'err.forbidden');
      w.fail('vendorInvoice.markPaid', { id: 'vi2' }, uid, 'err.forbidden');
      w.fail('vendorInvoice.delete', { id: 'vi1' }, uid, 'err.forbidden');
    }
    w.fail('vendorInvoice.add', { ...add, due: '31 Oct' }, 's10', 'err.invalid');
    w.fail('vendorInvoice.add', { ...add, sectionId: 'nope' }, 's10', 'err.notFound');
    w.fail('vendorInvoice.approve', { id: 'nope' }, 's10', 'err.notFound');
  });
});

describe('boards', () => {
  it('billing at 21 Oct: 1 overdue, 3 due, paid and Xero lists', () => {
    const w = world();
    const b = billingBoard(w.s, T);
    expect(b.overdue.map((v) => v.inv.id)).toEqual(['INV-2609-020']);
    expect(b.overdue[0]).toMatchObject({ late: 23, balance: 9_500_000 });
    expect(b.due.map((v) => v.inv.id).sort()).toEqual(['INV-2610-001', 'INV-2610-020', 'INV-2610-046']);
    expect(b.paid.map((v) => v.inv.id).sort()).toEqual(['INV-2610-002', 'INV-2610-010']);
    expect(b.nextDue).toBe('2026-10-27');
    expect(b.sums).toEqual({ paid: 15_000_000, due: 5_500_000 + 9_500_000 + 9_500_000, overdue: 9_500_000, xero: 0 });
    expect(invoicePeriod(w.s.invoices['INV-2610-001'])).toBe('2026-10');
  });
  it('part-paid invoices stay in the lists for what is left; overdue stays overdue', () => {
    const w = world();
    w.run('payment.record', { memberId: 'm46', amount: 4_000_000, method: 'cash', invoiceId: 'INV-2610-046' }, 's10');
    let b = billingBoard(w.s, T);
    expect(b.due.find((v) => v.inv.id === 'INV-2610-046')).toMatchObject({ status: 'partial', paid: 4_000_000, balance: 5_500_000 });
    // after the due date the part-paid invoice is overdue for the balance
    b = billingBoard(w.s, '2026-10-29');
    expect(b.overdue.find((v) => v.inv.id === 'INV-2610-046')).toMatchObject({ status: 'overdue', balance: 5_500_000, late: 2 });
  });
});
