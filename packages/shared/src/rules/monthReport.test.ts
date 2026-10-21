// Round 12: the month report (management): money, members, care and mood, pipeline and team, each compared with the period before.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../seed';
import { activeOn } from './core';
import { checkOnList } from './checkOn';
import { invoicePeriod, invoiceViews } from './finance';
import { periodFor } from './insights';
import { monthReport, prevPeriod } from './monthReport';

const T = '2026-10-21';
const s = buildSeed().citra;

describe('month report', () => {
  it('prevPeriod is the same length ending the day before', () => expect(prevPeriod({ from: '2026-10-01', to: '2026-10-21' })).toEqual({ from: '2026-09-10', to: '2026-09-30' }));
  it('an empty period has zeros and nulls, no NaN', () => { const r = monthReport(buildSeed().citra, { from: '2020-01-01', to: '2020-01-31' }, T, 600); expect(r.empty).toBe(true); expect(r.members.visitsPerMember.cur).toBeNull(); expect(r.members.utilisation.cur).toBeNull(); expect(r.care.index.cur).toBeNull(); expect(r.money.billed.cur).toBe(0); expect(JSON.stringify(r)).not.toContain('NaN'); });
  it('September money matches the seed invoices', () => { const r = monthReport(s, periodFor('lastMonth', T), T, 600); const sept = invoiceViews(s, T, true).filter((v) => invoicePeriod(v.inv) === '2026-09'); expect(r.money.billed.cur).toBe(sept.reduce((a, v) => a + v.total, 0)); expect(r.money.extraDays.cur).toBe(sept.flatMap((v) => v.inv.lines).filter((l) => l.kind === 'extraDay').reduce((a, l) => a + l.qty, 0)); });
  it('this month counts Lina as active and the check-on list', () => { const r = monthReport(s, periodFor('thisMonth', T), T, 600); expect(r.members.active.cur).toBe(Object.values(s.members).filter((m) => activeOn(m, T)).length); expect(r.members.checkOn).toBe(checkOnList(s, T).length); expect(r.care.lift.cur).toBeGreaterThan(0); });
});
