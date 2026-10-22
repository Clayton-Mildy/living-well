// Round 12: the month report (management): money, members, care and mood, pipeline and team, each compared with the period before.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../seed';
import { activeOn } from './core';
import { checkOnList } from './checkOn';
import { invoicePeriod, invoiceViews } from './finance';
import { periodFor } from './insights';
import { monthReport, prevPeriod } from './monthReport';
import { leadFunnel } from './enquiries';

const T = '2026-10-21';
const s = buildSeed().citra;

describe('month report', () => {
  it('prevPeriod is the same length ending the day before', () => expect(prevPeriod({ from: '2026-10-01', to: '2026-10-21' })).toEqual({ from: '2026-09-10', to: '2026-09-30' }));
  it('an empty period has zeros and nulls, no NaN', () => { const r = monthReport(buildSeed().citra, { from: '2020-01-01', to: '2020-01-31' }, T, 600); expect(r.empty).toBe(true); expect(r.members.visitsPerMember.cur).toBeNull(); expect(r.members.utilisation.cur).toBeNull(); expect(r.care.index.cur).toBeNull(); expect(r.money.billed.cur).toBe(0); expect(JSON.stringify(r)).not.toContain('NaN'); });
  it('September money matches the seed invoices', () => { const r = monthReport(s, periodFor('lastMonth', T), T, 600); const sept = invoiceViews(s, T, false).filter((v) => invoicePeriod(v.inv) === '2026-09'); expect(r.money.billed.cur).toBe(sept.reduce((a, v) => a + v.total, 0)); expect(r.money.extraDays.cur).toBe(sept.flatMap((v) => v.inv.lines).filter((l) => l.kind === 'extraDay').reduce((a, l) => a + l.qty, 0)); });
  it('this month counts Lina as active and the check-on list', () => { const r = monthReport(s, periodFor('thisMonth', T), T, 600); expect(r.members.active.cur).toBe(Object.values(s.members).filter((m) => activeOn(m, T)).length); expect(r.members.checkOn).toBe(checkOnList(s, T).length); expect(r.care.lift.cur).toBeGreaterThan(0); });
  it('billed compares whole months that never overlap: a custom Oct 10–21 against September, Oct 1–21 October against September', () => {
    const total = (m: string) => invoiceViews(s, T, false).filter((v) => invoicePeriod(v.inv) === m).reduce((a, v) => a + v.total, 0);
    const mid = monthReport(s, { from: '2026-10-10', to: '2026-10-21' }, T, 600);
    expect(mid.months).toEqual({ cur: ['2026-10'], prev: ['2026-09'] });
    expect(mid.money.billed.prev).toBe(total('2026-09'));
    expect(mid.money.billed.cur).toBe(total('2026-10'));
    const r = monthReport(s, periodFor('thisMonth', T), T, 600);
    expect([r.money.billed.cur, r.money.billed.prev]).toEqual([total('2026-10'), total('2026-09')]);
    // overdue = past its due date at the end of the period: October's invoices (due the 28th) are not in it on the 21st, they are "not yet due"
    const owed = invoiceViews(s, T, false).filter((v) => !v.inv.voided && v.inv.issueDate <= T);
    const left = (pred: (due: string) => boolean) => owed.filter((v) => pred(v.inv.dueDate)).reduce((a, v) => a + v.balance, 0);
    expect(left((d) => d >= T)).toBeGreaterThan(0);
    expect(r.money.outstanding.cur).toBe(left((d) => d < T));
    expect(r.money.notYetDue.cur).toBe(left((d) => d >= T));
    expect(r.money.outstanding.cur).toBeLessThan(r.money.notYetDue.cur);
    expect(monthReport(s, periodFor('last3', T), T, 600).months.prev).toEqual(['2026-05', '2026-06', '2026-07']);
  });
  it('the pipeline is the lead funnel of the period: a cohort, from the lead history', () => {
    const p = periodFor('thisMonth', T);
    const f = leadFunnel(s, p.from, p.to);
    const pl = monthReport(s, p, T, 600).pipeline;
    expect(pl.funnel).toEqual({ new: f.opened, visit: f.visit, trial: f.trial, joined: f.joined });
    expect(pl.lostReasons).toEqual(f.lostReasons);
    expect(pl.conversion.toJoined).toBe(f.opened ? Math.round((f.joined / f.opened) * 100) / 100 : null);
    expect(f.opened).toBe(4); // e1, e2, e3 and e5 were opened in October
  });
});
