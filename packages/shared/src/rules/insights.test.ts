// KC round 7: visit insights on a small synthetic week (the 5-member seed with its attendance replaced): heat counts, the plan split, Flex buckets and pace.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildCitra } from '../seed/index';
import type { Attendance, ClubState, ISODate } from '../types';
import { openDaysInMonth } from './core';
import { HEAT_HOURS, clampPeriod, editPeriod, flexUsage, monthsOf, periodFor, sortFlexRows, sortPeople, visitInsights } from './insights';

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
  it('arrival and stay averages, and visits per member per month (prorated member-months)', () => {
    expect(byPlan.flex.avgArrival).toBe('09:26'); // 09:00, 09:30, 09:48
    expect(byPlan.flex.avgStayMin).toBe(231); // 210, 90, 392
    expect(byPlan.gold.avgStayMin).toBe(Math.round((300 + 270 + 80 + 70) / 4)); // Tjahjadi never checked out: left out
    const open = openDaysInMonth(WEEK, '2026-10').length;
    expect(byPlan.flex.perMemberMonth).toBe(Math.round((3 / ((2 * 5) / open)) * 10) / 10);
  });
  it('a plan change moves later visits to the new plan', () => {
    const s = produce(WEEK, (d) => { d.members.m1.plans.push({ from: '2026-10-07', plan: 'gold', by: 'staff:s1' }); d.attendance['2026-10-08:m1'] = row('2026-10-08', 'm1', '09:00', '12:00'); });
    const bp = visitInsights(s, P, T).byPlan;
    expect([bp.flex.visits, bp.gold.visits]).toEqual([3, 6]);
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
  // September (finished): Lina has 12 visits (quota 10: two extra days), Bambang 5
  const sep = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16'];
  const S = withRows([...sep.map((d) => row(d, 'm1', '09:00', '15:00')), ...sep.slice(0, 5).map((d) => row(d, 'm10', '09:48', '15:00')), row('2026-09-02', 'm2', '10:00', '15:00')]);
  const u = flexUsage(S, '2026-09', T);
  it('lists the Flex members only, with used, left, extra and the bucket', () => {
    expect(u.current).toBe(false);
    expect(u.rows.map((r) => r.memberId).sort()).toEqual(['m1', 'm10']);
    const lina = u.rows.find((r) => r.memberId === 'm1')!;
    expect([lina.quota, lina.used, lina.left, lina.extra, lina.bucket]).toEqual([10, 12, 0, 2, 'extra']);
    const bambang = u.rows.find((r) => r.memberId === 'm10')!;
    expect([bambang.used, bambang.left, bambang.unused, bambang.bucket]).toEqual([5, 5, 5, 'b4']);
    expect(u.buckets).toEqual({ b0: 0, b4: 1, b7: 0, all: 0, extra: 1 });
    expect([u.visits, u.leftTotal, u.unusedTotal, u.extraTotal, u.quotaTotal]).toEqual([17, 5, 5, 2, 20]);
  });
  it('buckets: 0-3, 4-6, 7-9, all used (exactly the quota), extra days', () => {
    const mk = (n: number) => withRows(sep.slice(0, n).map((d) => row(d, 'm10', '09:00', '15:00')));
    const b = (n: number) => flexUsage(mk(n), '2026-09', T).rows.find((r) => r.memberId === 'm10')!.bucket;
    expect([b(0), b(3), b(4), b(6), b(7), b(9), b(10), b(11)]).toEqual(['b0', 'b0', 'b4', 'b4', 'b7', 'b7', 'all', 'extra']);
  });
  it('pace: cumulative average per Flex member by open day against an even pace; the first-half share', () => {
    expect(u.pace).toHaveLength(openDaysInMonth(S, '2026-09').length);
    expect(u.pace[0]).toMatchObject({ date: '2026-09-01', avg: 1 }); // both came on the 1st
    expect(u.pace[u.pace.length - 1].avg).toBe(8.5); // (12 + 5) / 2
    expect(u.pace[u.pace.length - 1].even).toBe(10);
    expect(u.half).toMatchObject({ first: 16, second: 1, complete: true });
    expect(u.half.firstShare).toBeCloseTo(16 / 17);
  });
  it('the current month projects who will leave visits unused at their own pace, up to yesterday', () => {
    const oct = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const s = withRows([...oct.map((d) => row(d, 'm10', '09:48', '15:00')), row('2026-10-05', 'm1', '09:00', '12:00'), row('2026-10-06', 'm1', '09:00', '12:00')]);
    const cur = flexUsage(s, '2026-10', T);
    expect(cur.current).toBe(true);
    const lina = cur.rows.find((r) => r.memberId === 'm1')!;
    expect(lina.used).toBe(2);
    expect(lina.projected).toBe(3); // 2 visits in 14 open days so far, 7 days to go (the 30th is closed in the seed)
    expect(lina.unused).toBe(7);
    const bambang = cur.rows.find((r) => r.memberId === 'm10')!;
    expect([bambang.projected, bambang.unused]).toEqual([10.5, 0]); // 7 in 14 days: on pace for the whole quota and more
    expect(cur.likelyMembers).toBe(1);
    expect(cur.unusedTotal).toBe(7);
    expect(cur.pace[cur.pace.length - 1].date).toBe('2026-10-20'); // yesterday
    expect(cur.half.complete).toBe(true);
  });
  it('sorts by the most unused first', () => {
    expect(sortFlexRows(S, u.rows, 'unused').map((r) => r.memberId)).toEqual(['m10', 'm1']);
    expect(sortFlexRows(S, u.rows, 'used').map((r) => r.memberId)).toEqual(['m1', 'm10']);
    expect(sortFlexRows(S, u.rows, 'extra')[0].memberId).toBe('m1');
  });
});
