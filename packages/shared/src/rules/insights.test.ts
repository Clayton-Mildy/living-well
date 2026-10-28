// KC round 7: insights on a small synthetic week (the 5-member seed with its attendance replaced): heat counts, the plan split and rates, the trend per plan,
// the people of each plan, and how Flex members spend their monthly quota.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildCitra } from '../seed/index';
import type { Attendance, ClubState, ISODate } from '../types';
import { flexQuota } from './attendance';
import { addDays, isWeekday } from '../util';
import { HEAT_HOURS, clampPeriod, dayCounts, departuresByHour, editPeriod, flexQuotaReport, memberRangeFor, memberTrend, monthsOf, periodFor, planTrend, sortPeople, visitInsights } from './insights';

const T = '2026-10-21'; // Wednesday
// m1 Lina and m10 Bambang are Flex; m2, m20 and m46 are Gold
const row = (date: ISODate, memberId: string, inAt: string, outAt?: string): Attendance => ({
  id: `${date}:${memberId}`, clubId: 'citra', createdAt: `${date}T${inAt}`, createdBy: 'staff:s1', memberId, date,
  checkIn: { at: inAt, by: 'staff:s1', method: 'manual' }, ...(outAt ? { checkOut: { at: outAt, by: 'staff:s1', method: 'manual' as const } } : {}),
  queueAdds: [], dismissed: [], edits: [],
});
const withRows = (rows: Attendance[]): ClubState => produce(buildCitra(), (d) => { d.attendance = {}; for (const r of rows) d.attendance[r.id] = r; });

// the week of Mon 5 Oct: Lina twice, Hendra three times, Bambang, Tjahjadi (never checked out) and Budi once
const WEEK = withRows([
  row('2026-10-05', 'm1', '09:00', '12:30'), row('2026-10-05', 'm2', '10:00', '15:00'),
  row('2026-10-06', 'm1', '09:30', '11:00'), row('2026-10-06', 'm10', '09:48', '16:20'), row('2026-10-06', 'm2', '10:00', '14:30'), row('2026-10-06', 'm20', '09:38'),
  row('2026-10-07', 'm2', '08:40', '10:00'),
  row('2026-10-09', 'm46', '10:10', '11:20'),
]);
const P = { from: '2026-10-05', to: '2026-10-09' };
const col = (h: number) => HEAT_HOURS.indexOf(h);

describe('periods', () => {
  it('this month runs to today, last month is the whole month, last 3 / 6 reach back to the first of the month', () => {
    expect(periodFor('thisMonth', T)).toEqual({ from: '2026-10-01', to: T });
    expect(periodFor('lastMonth', T)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodFor('last3', T)).toEqual({ from: '2026-08-01', to: T });
    expect(periodFor('last6', '2026-02-10')).toEqual({ from: '2025-09-01', to: '2026-02-10' });
    expect(monthsOf(periodFor('last3', T))).toEqual(['2026-08', '2026-09', '2026-10']);
  });
  it('a custom period is the From and To the reader picked: kept to today, never crossed, and the whole report follows it', () => {
    expect(periodFor('custom', T, { from: '2026-09-07', to: '2026-09-18' })).toEqual({ from: '2026-09-07', to: '2026-09-18' });
    expect(periodFor('custom', T, { from: '2026-10-30', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: T }); // swapped, then cut at today
    expect(periodFor('custom', T)).toEqual(periodFor('last3', T)); // nothing picked yet
    expect(editPeriod({ from: '2026-09-07', to: '2026-09-18' }, 'from', '2026-09-25', T)).toEqual({ from: '2026-09-25', to: '2026-09-25' });
    expect(editPeriod({ from: '2026-09-07', to: '2026-09-18' }, 'to', '2026-09-01', T)).toEqual({ from: '2026-09-01', to: '2026-09-01' });
    expect(clampPeriod({ from: '2026-10-25', to: '2026-12-01' }, T)).toEqual({ from: T, to: T });
    const p = periodFor('custom', T, { from: '2026-10-06', to: '2026-10-07' });
    expect(visitInsights(WEEK, p, T).overall.visits).toBe(5); // Tue 4 + Wed 1
    expect(monthsOf(periodFor('custom', T, { from: '2026-08-20', to: '2026-10-02' }))).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});

describe('overall', () => {
  const { overall: o, days } = visitInsights(WEEK, P, T);
  it('counts visits, open days and the busiest weekday', () => {
    expect(days).toHaveLength(5);
    expect(o.visits).toBe(8);
    expect(o.avgPerDay).toBe(1.6);
    expect(o.dailyCounts.map((d) => d.total)).toEqual([2, 4, 1, 0, 1]);
    expect(o.dailyCounts[1]).toEqual({ date: '2026-10-06', total: 4, flex: 2, gold: 2 });
    expect(o.busiestWeekday).toBe(1); // Tuesday
    expect(o.weekdayAvg).toEqual([2, 4, 1, 0, 1]);
    expect(o.maxDay?.date).toBe('2026-10-06');
  });
  it('heat: members present per weekday and hour (a stay with no check-out lasts to closing; leaving at 10:00 is not present in the 10:00 hour)', () => {
    const tue = o.presenceHeat[1];
    expect(tue[col(8)]).toBe(0);
    expect(tue[col(9)]).toBe(3); // Lina, Bambang, Tjahjadi (Hendra comes at 10:00 sharp)
    expect(tue[col(10)]).toBe(4);
    expect(tue[col(11)]).toBe(3); // Lina left at 11:00
    expect(tue[col(15)]).toBe(2); // Hendra left 14:30
    expect(tue[col(16)]).toBe(2); // Bambang until 16:20, Tjahjadi until closing
    expect(o.presenceHeat[2][col(9)]).toBe(1); // Wed: Hendra 08:40 to 10:00
    expect(o.presenceHeat[2][col(10)]).toBe(0);
    expect(o.presenceHeat[3].every((x) => x === 0)).toBe(true); // Thursday: nobody
    expect(o.heatMax).toBe(4);
  });
  it('peak hour and arrivals per hour', () => {
    expect(o.hourAvg[col(10)]).toBe(1.4); // (2 + 4 + 0 + 0 + 1) / 5
    expect(o.peakHour).toBe(10);
    expect(o.arrivals[col(8)]).toBe(1);
    expect(o.arrivals[col(9)]).toBe(4);
    expect(o.arrivals[col(10)]).toBe(3);
    expect(o.arrivals.reduce((t, x) => t + x, 0)).toBe(8);
  });
  it('today is left out until the day is over; days outside the period are ignored', () => {
    const s = withRows([row(T, 'm1', '09:00'), row('2026-10-20', 'm1', '09:00', '12:00'), row('2026-10-02', 'm1', '09:00', '12:00')]);
    const p = { from: '2026-10-19', to: T };
    expect(visitInsights(s, p, T).overall.visits).toBe(1);
    expect(visitInsights(s, p, T).days).toEqual(['2026-10-19', '2026-10-20']);
    expect(visitInsights(s, p, T, { todayDone: true }).overall.visits).toBe(2);
  });
  it('an empty period has no busiest weekday or peak hour', () => {
    const o2 = visitInsights(withRows([]), P, T).overall;
    expect(o2.visits).toBe(0);
    expect([o2.busiestWeekday, o2.peakHour, o2.maxDay]).toEqual([null, null, null]);
  });
});

describe('by plan', () => {
  const { byPlan } = visitInsights(WEEK, P, T);
  it('splits visits by the plan on the visit date', () => {
    expect([byPlan.flex.visits, byPlan.gold.visits]).toEqual([3, 5]);
    expect(byPlan.flex.share).toBeCloseTo(0.375);
    expect([byPlan.flex.members, byPlan.flex.visitors, byPlan.gold.members, byPlan.gold.visitors]).toEqual([2, 2, 3, 3]);
    expect(byPlan.flex.weekdays).toEqual([1, 2, 0, 0, 0]);
    expect(byPlan.gold.weekdays).toEqual([1, 2, 1, 0, 1]);
  });
  it('arrival and stay averages', () => {
    expect(byPlan.flex.avgArrival).toBe('09:26'); // 09:00, 09:30, 09:48
    expect(byPlan.flex.avgStayMin).toBe(231); // 210, 90, 392
    expect(byPlan.gold.avgStayMin).toBe(Math.round((300 + 270 + 80 + 70) / 4)); // Tjahjadi never checked out: left out
  });
  it('visit rate per plan: visits per member per week, and the share of open days a member came', () => {
    // 5 open days, 2 Flex members (3 visits) and 3 Gold members (5 visits): 10 and 15 member-days = 2 and 3 member-weeks
    expect(byPlan.flex.perMemberWeek).toBe(1.5);
    expect(byPlan.gold.perMemberWeek).toBe(1.7); // 5 / 3 weeks
    expect(byPlan.flex.attendanceRate).toBeCloseTo(3 / 10);
    expect(byPlan.gold.attendanceRate).toBeCloseTo(5 / 15);
    expect(visitInsights(withRows([]), P, T).byPlan.flex).toMatchObject({ perMemberWeek: 0, attendanceRate: 0 });
  });
  it('a member who joined mid-period counts for the open days they were active only (prorated)', () => {
    const s = produce(WEEK, (d) => { d.members.m46.memberships[0].start = '2026-10-08'; }); // active Thu and Fri; came on Fri
    const g = visitInsights(s, P, T).byPlan.gold;
    expect(g.attendanceRate).toBeCloseTo(5 / 12); // 5 + 5 + 2 member-days
    expect(g.perMemberWeek).toBe(2.1); // 5 visits / (12 / 5)
    expect(g.people.find((x) => x.memberId === 'm46')).toMatchObject({ visits: 1, activeDays: 2, rate: 0.5, perWeek: 2.5 });
    const later = produce(WEEK, (d) => { d.members.m46.memberships[0].start = '2026-11-01'; delete d.attendance['2026-10-09:m46']; });
    expect(visitInsights(later, P, T).byPlan.gold.members).toBe(2); // not yet a member: not listed
  });
  it('the people of a plan: visits, rate, visits per week and usual days; most / fewest visits', () => {
    const { flex, gold } = byPlan;
    expect(flex.people.map((x) => x.memberId)).toEqual(['m10', 'm1']); // name order: Bambang, Lina
    expect(flex.people.find((x) => x.memberId === 'm1')).toEqual({ memberId: 'm1', visits: 2, activeDays: 5, rate: 0.4, perWeek: 2, usual: [0, 1] });
    expect(flex.people.find((x) => x.memberId === 'm10')).toMatchObject({ visits: 1, rate: 0.2, usual: [1] });
    expect(gold.people.find((x) => x.memberId === 'm2')).toMatchObject({ visits: 3, rate: 0.6, perWeek: 3 });
    expect(gold.people.find((x) => x.memberId === 'm20')).toMatchObject({ visits: 1, usual: [1] });
    expect(gold.members).toBe(gold.people.length);
    expect(sortPeople(WEEK, gold.people, 'most')[0].memberId).toBe('m2');
    expect(sortPeople(WEEK, gold.people, 'fewest')[2].memberId).toBe('m2');
    expect(sortPeople(WEEK, flex.people, 'most').map((x) => x.memberId)).toEqual(['m1', 'm10']);
  });
  it('someone who changed plan is in both plans, each with what they did there', () => {
    const s = produce(WEEK, (d) => { d.members.m1.plans.push({ from: '2026-10-07', plan: 'gold', by: 'staff:s1' }); d.attendance['2026-10-08:m1'] = row('2026-10-08', 'm1', '09:00', '12:00'); });
    const bp = visitInsights(s, P, T).byPlan;
    expect(bp.flex.people.find((x) => x.memberId === 'm1')).toMatchObject({ visits: 2, activeDays: 2, rate: 1 });
    expect(bp.gold.people.find((x) => x.memberId === 'm1')).toMatchObject({ visits: 1, activeDays: 3 });
    expect([bp.flex.members, bp.gold.members]).toEqual([2, 4]);
  });
  it('a plan change moves later visits to the new plan', () => {
    const s = produce(WEEK, (d) => { d.members.m1.plans.push({ from: '2026-10-07', plan: 'gold', by: 'staff:s1' }); d.attendance['2026-10-08:m1'] = row('2026-10-08', 'm1', '09:00', '12:00'); });
    const bp = visitInsights(s, P, T).byPlan;
    expect([bp.flex.visits, bp.gold.visits]).toEqual([3, 6]);
  });
});

describe('visits per plan over time', () => {
  it('by day for a short period: one point per open day, quiet days included, a count per plan', () => {
    const { trend } = visitInsights(WEEK, P, T);
    expect(trend.grain).toBe('day');
    expect(trend.points.map((x) => [x.date, x.flex, x.gold])).toEqual([['2026-10-05', 1, 1], ['2026-10-06', 2, 2], ['2026-10-07', 0, 1], ['2026-10-08', 0, 0], ['2026-10-09', 0, 1]]);
    expect(trend.points.every((x) => x.days === 1 && x.end === x.date)).toBe(true);
  });
  it('by week once the period is longer than 35 days: Mon-Sun buckets placed on their first open day, with the open days they cover', () => {
    // Wed 2 Sep to Fri 9 Oct, with Mon 14 Sep closed
    const days: string[] = [];
    for (let d = '2026-09-02'; d <= '2026-10-09'; d = addDays(d, 1)) if (isWeekday(d) && d !== '2026-09-14') days.push(d);
    const visits = [
      { date: '2026-09-02', plan: 'flex' as const }, { date: '2026-09-04', plan: 'gold' as const }, { date: '2026-09-07', plan: 'gold' as const }, { date: '2026-09-09', plan: 'gold' as const },
      { date: '2026-09-15', plan: 'flex' as const }, { date: '2026-10-09', plan: 'flex' as const }, { date: '2026-10-09', plan: 'gold' as const },
    ];
    const tr = planTrend(days, visits);
    expect(tr.grain).toBe('week');
    expect(tr.points.map((x) => [x.date, x.end, x.days, x.flex, x.gold])).toEqual([
      ['2026-09-02', '2026-09-04', 3, 1, 1], // the first week starts on a Wednesday
      ['2026-09-07', '2026-09-11', 5, 0, 2],
      ['2026-09-15', '2026-09-18', 4, 1, 0], // the closed Monday: the week is placed on the Tuesday
      ['2026-09-21', '2026-09-25', 5, 0, 0],
      ['2026-09-28', '2026-10-02', 5, 0, 0],
      ['2026-10-05', '2026-10-09', 5, 1, 1],
    ]);
  });
  it('35 calendar days from the first to the last open day is still by day; 36 is by week; no days is an empty trend', () => {
    expect(planTrend(['2026-09-01', '2026-10-05'], []).grain).toBe('day');
    expect(planTrend(['2026-09-01', '2026-10-06'], []).grain).toBe('week');
    expect(planTrend([], [])).toEqual({ grain: 'day', points: [] });
  });
});

describe('per person', () => {
  const { people } = visitInsights(WEEK, P, T);
  const of = (id: string) => people.find((p) => p.memberId === id)!;
  it('everyone active is listed, with zero visits for those who did not come', () => {
    expect(people).toHaveLength(5);
    expect(of('m46').visits).toBe(1);
    expect(visitInsights(withRows([]), P, T).people.every((p) => p.visits === 0)).toBe(true);
  });
  it('visits, usual days (top 2), arrival, stay, last visit, monthly counts and the last visits newest first', () => {
    const hendra = of('m2');
    expect(hendra.visits).toBe(3);
    expect(hendra.usual).toEqual([0, 1]); // one visit each on Mon, Tue and Wed: ties by weekday
    expect(hendra.avgArrival).toBe('09:33'); // 10:00, 10:00, 08:40
    expect(hendra.lastVisit).toBe('2026-10-07');
    expect(hendra.monthly).toEqual([{ month: '2026-10', visits: 3 }]);
    expect(hendra.recent.map((r) => r.date)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
    expect(of('m20').recent[0]).toEqual({ date: '2026-10-06', in: '09:38', out: null });
    expect(of('m1').arrivals).toEqual([{ date: '2026-10-05', value: 540 }, { date: '2026-10-06', value: 570 }]);
    expect(of('m1').plan).toBe('flex');
  });
  it('sorts: most visits, fewest visits, last visit', () => {
    expect(sortPeople(WEEK, people, 'most')[0].memberId).toBe('m2');
    expect(sortPeople(WEEK, people, 'fewest')[4].memberId).toBe('m2');
    expect(sortPeople(WEEK, people, 'last').map((p) => p.memberId)[0]).toBe('m46'); // 9 Oct
  });
  it('trial day passes in the period are counted for the footnote', () => {
    const s = produce(WEEK, (d) => {
      const g = Object.values(d.guestVisits)[0];
      d.guestVisits.t1 = { ...g, id: 't1', kind: 'trial', date: '2026-10-07', status: 'booked' };
      d.guestVisits.t2 = { ...g, id: 't2', kind: 'trial', date: '2026-10-08', status: 'cancelled' };
      d.guestVisits.t3 = { ...g, id: 't3', kind: 'visit', date: '2026-10-08', status: 'booked' };
    });
    expect(visitInsights(s, P, T).trials).toBe(1);
  });
});

describe('Flex quota usage', () => {
  const D = (dates: string[], id: string) => dates.map((d) => row(d, id, '09:00', '15:00'));
  const sep = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16'];
  const oct = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14'];
  // September (finished): Lina has 12 visits (the 10th on the 14th: two extra days), Bambang 5, and Hendra (switched to Flex) 10 visits, the last on the 24th.
  // October (running, today is the 21st): Lina used all 10 by the 14th, Bambang has 3 so far (and a stray row dated after today, not counted).
  const hendra = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-24'];
  const base = withRows([...D(sep, 'm1'), ...D(sep.slice(0, 5), 'm10'), ...D(hendra, 'm2'), ...D(oct, 'm1'), ...D(oct.slice(0, 3), 'm10'), ...D(['2026-10-23'], 'm10'), ...D(['2026-09-02'], 'm20')]);
  const S = produce(base, (d) => { d.members.m2.plans[0].plan = 'flex'; });
  const sepOnly = { from: '2026-09-01', to: '2026-09-30' };
  const r = flexQuotaReport(S, sepOnly, T);
  const of = (list: { memberId: string }[], id: string) => list.find((e) => e.memberId === id)!;

  it('who used it all: when the quota ran out (the visit number `quota`), how long it took from the first visit, and the extra days after', () => {
    expect(r.months).toEqual(['2026-09']);
    expect(r.total).toBe(3); // Gold members have no quota
    expect(r.usedAll.entries.map((e) => e.memberId)).toEqual(['m2', 'm1']); // newest first
    expect(of(r.usedAll.entries, 'm1')).toMatchObject({ month: '2026-09', quota: 10, used: 12, ranOut: '2026-09-14', took: 13, extra: 2, burned: 0, current: false });
    expect(of(r.usedAll.entries, 'm2')).toMatchObject({ used: 10, ranOut: '2026-09-24', took: 23, extra: 0 });
    expect(r.usedAll.avgDay).toBe(19); // (14 + 24) / 2
    expect(r.usedAll.avgDays).toBe(18); // (13 + 23) / 2
  });
  it('who did not: the visits burned (quota - used), in all and per member', () => {
    expect(r.notAll.entries).toHaveLength(1);
    expect(r.notAll.entries[0]).toMatchObject({ memberId: 'm10', quota: 10, used: 5, ranOut: null, took: null, burned: 5, current: false });
    expect([r.notAll.burned, r.notAll.avgBurned, r.running]).toEqual([5, 5, 0]);
    const two = flexQuotaReport(produce(S, (d) => { for (const k of Object.keys(d.attendance)) if (k.endsWith(':m10') && k.slice(0, 10) > '2026-09-02') delete d.attendance[k]; }), sepOnly, T);
    expect(two.notAll.entries[0]).toMatchObject({ used: 2, burned: 8 });
    const zero = flexQuotaReport(produce(S, (d) => { for (const k of Object.keys(d.attendance)) if (k.endsWith(':m10')) delete d.attendance[k]; }), sepOnly, T);
    expect(zero.notAll.entries[0]).toMatchObject({ used: 0, burned: 10 }); // active the whole month, never came: the whole quota burned
    expect(zero.notAll.avgBurned).toBe(10);
  });
  it('the running month counts as far as today: used it all so far is counted, visits left are not burned yet', () => {
    const cur = flexQuotaReport(S, { from: '2026-10-01', to: T }, T);
    expect(cur.months).toEqual(['2026-10']);
    expect(cur.usedAll.entries.map((e) => e.memberId)).toEqual(['m1']);
    expect(cur.usedAll.entries[0]).toMatchObject({ current: true, ranOut: '2026-10-14', took: 13, used: 10, extra: 0 });
    expect(cur.notAll).toEqual({ entries: [], burned: 0, avgBurned: null });
    expect(cur.running).toBe(2); // Bambang (3 so far; the row dated the 23rd is after today) and Hendra (none yet) still have time
    expect(cur.total).toBe(3);
  });
  it('a period counts every calendar month it touches, the whole month; the totals add up over the months', () => {
    const all = flexQuotaReport(S, { from: '2026-09-18', to: T }, T);
    expect(all.months).toEqual(['2026-09', '2026-10']);
    expect(all.usedAll.entries.map((e) => `${e.month}:${e.memberId}`)).toEqual(['2026-10:m1', '2026-09:m2', '2026-09:m1']);
    expect(all.notAll.entries.map((e) => `${e.month}:${e.memberId}`)).toEqual(['2026-09:m10']);
    expect([all.total, all.running]).toEqual([6, 2]);
    expect(all.usedAll.avgDay).toBe(17.3); // (14 + 24 + 14) / 3
    expect(all.usedAll.avgDays).toBe(16.3); // (13 + 23 + 13) / 3
    expect(flexQuotaReport(S, { from: '2026-09-07', to: '2026-09-18' }, T).months).toEqual(['2026-09']);
  });
  it('the quota is prorated for a member who joined mid-month (as in flexQuota); a quota prorated to nothing is not counted', () => {
    const joined = produce(withRows(D(['2026-09-15', '2026-09-16', '2026-09-17'], 'm10')), (d) => { d.members.m10.memberships[0].start = '2026-09-15'; });
    const q = flexQuota(joined, joined.members.m10, '2026-09');
    expect(q).toBeGreaterThan(3);
    expect(q).toBeLessThan(10);
    expect(of(flexQuotaReport(joined, sepOnly, T).notAll.entries, 'm10')).toMatchObject({ quota: q, used: 3, burned: q - 3 }); // Lina (no visits) is there too, with the full 10
    const lastDay = produce(S, (d) => { d.members.m10.memberships[0].start = '2026-09-30'; }); // one active day of the month: round(10 / 22) = 0
    expect(flexQuota(lastDay, lastDay.members.m10, '2026-09')).toBe(0);
    expect(flexQuotaReport(lastDay, sepOnly, T).total).toBe(2); // Lina and Hendra only
  });
  it('no Flex members or no visits: nothing to average', () => {
    const none = flexQuotaReport(withRows([]), { from: '2026-10-01', to: T }, T);
    expect(none.usedAll).toEqual({ entries: [], avgDay: null, avgDays: null });
    expect(none.running).toBe(2);
  });
});


// KC round 9: members in and out by plan (the Membership tab)
describe('memberTrend', () => {
  const by = 'staff:s9' as const;
  const state = produce(buildCitra(), (d) => {
    const keep = ['m1', 'm2', 'm10', 'm20'];
    for (const id of Object.keys(d.members)) if (!keep.includes(id)) delete d.members[id];
    d.members.m1.memberships = [{ start: '2026-09-07' }]; d.members.m1.plans = [{ from: '2026-09-07', plan: 'flex', by }]; // joins on Flex
    d.members.m2.memberships = [{ start: '2025-01-01', lastDay: '2026-10-09', endReason: 'movedAway' }]; d.members.m2.plans = [{ from: '2025-01-01', plan: 'gold', by }]; // leaves on Gold
    d.members.m10.memberships = [{ start: '2025-03-01' }]; d.members.m10.plans = [{ from: '2025-03-01', plan: 'flex', by }, { from: '2026-08-17', plan: 'gold', by }]; // stays, Flex -> Gold
    // ends on Gold, then comes back on Flex after a gap: a leave and a join, not a switch
    d.members.m20.memberships = [{ start: '2025-01-01', lastDay: '2026-08-31' }, { start: '2026-09-14' }]; d.members.m20.plans = [{ from: '2025-01-01', plan: 'gold', by }, { from: '2026-09-14', plan: 'flex', by }];
  });
  it('3 months: weekly, joins / leaves / switches by plan, active at both ends', () => {
    const p = memberRangeFor('3m', T);
    expect(p).toEqual({ from: '2026-08-01', to: T });
    const tr = memberTrend(state, p, T);
    expect(tr.grain).toBe('week');
    expect(tr.points[0].start).toBe('2026-08-01');
    expect(tr.points[tr.points.length - 1].end).toBe(T);
    expect(tr.totals.joined).toEqual({ gold: 0, flex: 2 }); // m1, m20 back
    expect(tr.totals.left).toEqual({ gold: 2, flex: 0 }); // m2, m20
    expect(tr.totals.toGold).toBe(1);
    expect(tr.totals.toFlex).toBe(0);
    expect(tr.totals.activeStart).toEqual({ gold: 2, flex: 1 }); // 31 Jul: m2, m20 Gold; m10 Flex
    expect(tr.totals.activeEnd).toEqual({ gold: 1, flex: 2 }); // m10 Gold; m1, m20 Flex
    const oct9 = tr.points.find((x) => x.start <= '2026-10-09' && '2026-10-09' <= x.end)!;
    expect(oct9.left).toEqual({ gold: 1, flex: 0 });
  });
  it('1 year: monthly, twelve months; custom keeps to today', () => {
    const tr = memberTrend(state, memberRangeFor('1y', T), T);
    expect(tr.grain).toBe('month');
    expect(tr.points).toHaveLength(12);
    expect(tr.points[0].start).toBe('2025-11-01');
    expect(memberRangeFor('custom', T, { from: '2026-09-01', to: '2026-12-31' })).toEqual({ from: '2026-09-01', to: T });
    expect(memberRangeFor('6m', T).from).toBe('2026-05-01');
  });
});

// KC round 14 (A4): today's numbers. Small seed on 21 Oct: Flex m1 and m10, Gold m2, m20 and m46; m20 (09:38), m2 (09:40) and m10 (09:48) are in at 10:00.
describe('dayCounts', () => {
  const s = buildCitra();
  it('10:00: five active (2 Flex, 3 Gold), three came and are still in, nobody gone, two not in', () => {
    expect(dayCounts(s, T, 600)).toEqual({ active: { flex: 2, gold: 3 }, came: 3, inNow: 3, gone: 0, notIn: 2 });
  });
  it('only check-ins and check-outs up to the clock count: m1 arrives at 10:30 and m20 leaves at 09:55', () => {
    const live = produce(s, (d) => {
      d.attendance[`${T}:m20`].checkOut = { at: '09:55', by: 'staff:s1', method: 'manual' };
      d.attendance[`${T}:m1`] = row(T, 'm1', '10:30');
    });
    expect(dayCounts(live, T, 600)).toEqual({ active: { flex: 2, gold: 3 }, came: 3, inNow: 2, gone: 1, notIn: 2 });
    expect(dayCounts(live, T, 660)).toEqual({ active: { flex: 2, gold: 3 }, came: 4, inNow: 3, gone: 1, notIn: 1 });
    const c = dayCounts(live, T, 660);
    expect(c.came).toBe(c.inNow + c.gone);
    expect(c.notIn).toBe(c.active.flex + c.active.gold - c.came);
  });
  it('a past day counts the whole day (nowMin 24:00) and the plan on that day; ended members are not active', () => {
    const past = produce(s, (d) => {
      for (const id of Object.keys(d.attendance)) if (d.attendance[id].date === '2026-10-14') delete d.attendance[id];
      d.attendance['2026-10-14:m1'] = row('2026-10-14', 'm1', '16:00', '16:20');
      d.members.m46.memberships = [{ start: '2025-03-03', lastDay: '2026-10-10' }];
    });
    expect(dayCounts(past, '2026-10-14', 24 * 60)).toEqual({ active: { flex: 2, gold: 2 }, came: 1, inNow: 0, gone: 1, notIn: 3 });
  });
});

// round 15 (1): the check-out shown wherever the check-in is: departures by hour and the average departure
describe('departures', () => {
  // Lina leaves 15:10 and 15:40, Hendra 16:05, Bambang and Budi never checked out
  const OUT = withRows([
    row('2026-10-05', 'm1', '09:00', '15:10'), row('2026-10-06', 'm1', '09:30', '15:40'), row('2026-10-05', 'm2', '10:00', '16:05'),
    row('2026-10-05', 'm10', '09:48'), row('2026-10-09', 'm46', '10:10'),
  ]);
  const r = visitInsights(OUT, P, T);
  it('departures by hour: 15:10 and 15:40 fall in the 15:00 bucket, 16:05 in 16:00; a visit with no check-out counts nowhere', () => {
    expect(r.overall.departures).toHaveLength(HEAT_HOURS.length);
    expect(r.overall.departures[col(15)]).toBe(2);
    expect(r.overall.departures[col(16)]).toBe(1);
    expect(r.overall.departures.reduce((t, x) => t + x, 0)).toBe(3);
    expect(departuresByHour([{ outMin: 15 * 60 + 10 }, { outMin: null }, { outMin: 16 * 60 + 5 }])[col(16)]).toBe(1);
    expect(r.overall.arrivals.reduce((t, x) => t + x, 0)).toBe(5); // all five arrived
  });
  it('the average departure of a plan and of a person: 15:10 and 15:40 average to 15:25; with no check-outs it is null', () => {
    expect(r.byPlan.flex.avgDeparture).toBe('15:25');
    expect(r.byPlan.gold.avgDeparture).toBe('16:05');
    const lina = r.people.find((p) => p.memberId === 'm1')!;
    expect(lina.avgDeparture).toBe('15:25');
    expect(lina.departures).toEqual([{ date: '2026-10-05', value: 15 * 60 + 10 }, { date: '2026-10-06', value: 15 * 60 + 40 }]);
    const bambang = r.people.find((p) => p.memberId === 'm10')!;
    expect(bambang.avgDeparture).toBeNull();
    expect(bambang.departures).toEqual([]);
    const none = visitInsights(withRows([row('2026-10-05', 'm1', '09:00')]), P, T);
    expect(none.byPlan.flex.avgDeparture).toBeNull();
    expect(none.overall.departures.every((x) => x === 0)).toBe(true);
  });
});

describe('By plan groups by catalogue plan (round 15)', () => {
  const by = 'staff:s9' as const;
  /** Lina (m1) is on Flex 8 for the whole week, Hendra (m20) on a plan that has since been retired; a third plan has nobody */
  const world = (): ClubState => {
    const s = produce(WEEK, (d) => {
      d.club.settings.plans = [
        { id: 'plan_1', name: 'Flex 8', nameId: 'Fleks 8', kind: 'days', quota: 8, active: true },
        { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false },
        { id: 'plan_3', name: 'Weekends', kind: 'days', quota: 4, active: true },
      ];
      d.members.m1.plans = [{ from: '2020-01-01', plan: 'plan_1', by }];
      d.members.m20.plans = [{ from: '2020-01-01', plan: 'plan_2', by }];
    });
    return s;
  };
  it('lists Flex, Gold, then each catalogue plan that has members (retired ones too), with its own numbers', () => {
    const r = visitInsights(world(), P, T);
    expect(r.plans).toEqual(['flex', 'gold', 'plan_1', 'plan_2']); // plan_3 has nobody: not shown
    expect(r.byPlan.plan_1).toMatchObject({ plan: 'plan_1', members: 1, visits: 2 }); // Lina came on Mon and Tue
    expect(r.byPlan.plan_2).toMatchObject({ members: 1, visits: 1 }); // Hendra, retired but still has members
    expect(r.byPlan.flex.visits).toBe(1); // Bambang only: Lina is no longer counted under Flex
    expect(r.byPlan.flex.visits + r.byPlan.gold.visits + r.byPlan.plan_1.visits + r.byPlan.plan_2.visits).toBe(r.overall.visits);
    expect(r.people.find((p) => p.memberId === 'm1')!.plan).toBe('plan_1');
    expect(r.trend.points[0]).toMatchObject({ plan_1: 1 });
  });
  it('Flex and Gold only: the same two groups as before', () => {
    const r = visitInsights(WEEK, P, T);
    expect(r.plans).toEqual(['flex', 'gold']);
  });
  it('the quota report can follow one days plan', () => {
    const s = world();
    const onlyFlex = flexQuotaReport(s, { from: '2026-10-01', to: T }, T, 'flex');
    const onlyEight = flexQuotaReport(s, { from: '2026-10-01', to: T }, T, 'plan_1');
    const ids = (r: ReturnType<typeof flexQuotaReport>) => [...r.usedAll.entries, ...r.notAll.entries].map((e) => e.memberId);
    expect(ids(onlyEight)).not.toContain('m10');
    expect(ids(onlyFlex)).not.toContain('m1');
  });
  it('plan switches count by the plan moved to, not its kind', () => {
    const s = produce(world(), (d) => {
      d.members.m10.memberships = [{ start: '2025-03-01' }];
      d.members.m10.plans = [{ from: '2025-03-01', plan: 'flex', by }, { from: '2026-09-14', plan: 'plan_1', by }, { from: '2026-10-05', plan: 'gold', by }];
    });
    const tr = memberTrend(s, memberRangeFor('3m', T), T);
    expect(tr.totals).toMatchObject({ toGold: 1, toFlex: 0, toOther: 1 });
  });
});
