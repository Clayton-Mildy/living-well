// Round 12: the month report (management): money, members, care and mood, pipeline and team, each compared with the period before.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../seed';
import { activeOn } from './core';
import { checkOnList } from './checkOn';
import { invoicePeriod, invoiceViews } from './finance';
import { periodFor } from './insights';
import { heroTrend, monthReport, prevPeriod } from './monthReport';
import { leadConversion, leadMoves } from './enquiries';

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
  it('the pipeline is what happened in the period, from the lead history, with the conversion of the three months before', () => {
    const p = periodFor('thisMonth', T);
    const f = leadMoves(s, p.from, p.to);
    const c = leadConversion(s, '2026-10');
    const pl = monthReport(s, p, T, 600).pipeline;
    expect(pl.funnel).toEqual({ new: f.opened, visit: f.visit, trial: f.trial, joined: f.joined });
    expect(pl.lostReasons).toEqual(f.lostReasons);
    expect(pl.conversion).toEqual({ toVisit: c.toVisit, toTrial: c.toTrial, toJoined: c.toJoined });
    expect(f.opened).toBe(4); // e1, e2, e3 and e5 were opened in October
    expect(f.lostReasons.otherPlace).toBe(1); // e9 was lost on 8 October
  });
  it('the roster’s joined agrees with the Members group: October 2 joined, 4 opened, 38% of the three months before', () => {
    const r = buildSeed(T, 598, { roster: true }).citra;
    const rep = monthReport(r, periodFor('thisMonth', T), T, 600);
    expect(rep.pipeline.funnel).toMatchObject({ new: 4, joined: 2 });
    expect(rep.pipeline.funnel.joined).toBe(rep.members.joined.cur);
    expect(rep.pipeline.conversion.toJoined).toBe(0.38);
  });

  describe('hero numbers (round 13)', () => {
    const roster = buildSeed(T, 598, { roster: true }).citra;
    it('the four tiles are the groups’ own numbers; conversion is the pipeline’s', () => {
      for (const st of [s, roster]) {
        const r = monthReport(st, periodFor('thisMonth', T), T, 600);
        expect(r.hero.collected).toEqual(r.money.collected);
        expect(r.hero.active).toEqual(r.members.active);
        expect(r.hero.index).toEqual(r.care.index);
        expect(r.hero.conversion.cur).toBe(r.pipeline.conversion.toJoined);
        expect(r.hero.conversion.prev).toBe(leadConversion(st, '2026-09').toJoined);
        expect(r.hero.conversion.diff).toBe(r.hero.conversion.cur === null || r.hero.conversion.prev === null ? null : Math.round((r.hero.conversion.cur - r.hero.conversion.prev) * 1000) / 1000);
        expect(r.hero.conversion.good).toBe('up');
      }
    });
    it('the roster’s October numbers: 38% conversion against the three months before', () => {
      const r = monthReport(roster, periodFor('thisMonth', T), T, 600);
      expect(r.hero.conversion.cur).toBe(0.38);
      expect(r.hero.active.cur).toBe(r.members.active.cur);
      expect(r.hero.collected.cur).toBeGreaterThan(0);
    });
    it('the trend is the six whole months ending with the last whole month on or before the period’s end', () => {
      const six = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
      const tm = heroTrend(roster, periodFor('thisMonth', T), T, 600);
      expect(tm.months).toEqual(six);
      for (const k of ['collected', 'active', 'index', 'conversion'] as const) expect(tm[k]).toHaveLength(6);
      expect(heroTrend(roster, periodFor('lastMonth', T), T, 600).months).toEqual(six);
      expect(heroTrend(roster, { from: '2026-06-01', to: '2026-08-31' }, T, 600).months).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
      expect(heroTrend(roster, { from: '2026-08-10', to: '2026-08-30' }, T, 600).months.at(-1)).toBe('2026-07'); // August is not whole by the 30th
      expect(heroTrend(roster, { from: '2026-10-01', to: '2026-10-31' }, T, 600).months.at(-1)).toBe('2026-09'); // nor is the month today is in
    });
    it('each point is that month’s own figure, collected counted like the group', () => {
      const t = heroTrend(roster, periodFor('thisMonth', T), T, 600);
      const sep = monthReport(roster, { from: '2026-09-01', to: '2026-09-30' }, T, 600);
      expect(t.collected[5]).toBe(sep.money.collected.cur);
      expect(t.active[5]).toBe(sep.members.active.cur);
      expect(t.index[5]).toBe(sep.care.index.cur);
      expect(t.conversion[5]).toBe(leadConversion(roster, '2026-09').toJoined);
      expect(t.conversion[5]).toBe(sep.pipeline.conversion.toJoined);
      expect(t.collected.every((n) => n >= 0)).toBe(true);
    });
    it('an empty period gives nulls and zeros, no NaN', () => {
      const e = buildSeed().citra;
      const r = monthReport(e, { from: '2020-01-01', to: '2020-01-31' }, T, 600);
      expect(r.hero.index.cur).toBeNull();
      expect(r.hero.collected.cur).toBe(0);
      const t = heroTrend(e, { from: '2020-01-01', to: '2020-01-31' }, T, 600);
      expect(t.months).toEqual(['2019-08', '2019-09', '2019-10', '2019-11', '2019-12', '2020-01']);
      expect(t.collected).toEqual([0, 0, 0, 0, 0, 0]);
      expect(JSON.stringify(t)).not.toContain('NaN');
    });
  });
});
