// KC round 7: insights. How intensely members come to the club: overall (when it is busy), per plan (a trend per plan, the visit rate, the people in each plan
// and how Flex members spend their monthly quota) and per person. Pure rules over the attendance rows: members drop in on any open day, so there is nothing
// "expected" to compare with.
// A day counts once it is over: today is left out until `todayDone` (a half-finished day would pull every average down).
import type { ClubState, HM, ISODate, Plan } from '../types';
import { activeOn, isOpen, isPendingRow, openDaysInMonth, planOn } from './core';
import { attOf, flexMonth } from './attendance';
import { lastVisits } from './members';
import { addDays, addMonths, diffDays, dow, live, sortBy, toHM, toMin, weekStart, ym } from '../util';

// ---------- periods ----------
export type PeriodKey = 'thisMonth' | 'lastMonth' | 'last3' | 'last6' | 'custom';
export const PERIOD_KEYS: PeriodKey[] = ['thisMonth', 'lastMonth', 'last3', 'last6', 'custom'];
export interface InsightPeriod { from: ISODate; to: ISODate }

const lastOfMonth = (m: string): ISODate => addDays(`${addMonths(m, 1)}-01`, -1);
/** A custom period put right: swapped dates turned round, nothing after today. */
export function clampPeriod(p: InsightPeriod, today: ISODate): InsightPeriod {
  let from = p.from <= p.to ? p.from : p.to, to = p.from <= p.to ? p.to : p.from;
  if (to > today) to = today;
  if (from > to) from = to;
  return { from, to };
}
/** Set one end of a custom period; the other end follows when they would cross (From is never after To). */
export function editPeriod(p: InsightPeriod, part: 'from' | 'to', date: ISODate, today: ISODate): InsightPeriod {
  if (!date) return p;
  return clampPeriod(part === 'from' ? { from: date, to: date > p.to ? date : p.to } : { from: date < p.from ? date : p.from, to: date }, today);
}
/**
 * The dates a period key stands for (calendar months; "Last 3 months" is this month and the two before it). 'custom' is the From and To the reader
 * picked (`custom`, kept to today; without one it is the same as Last 3 months).
 */
export function periodFor(key: PeriodKey, today: ISODate, custom?: InsightPeriod | null): InsightPeriod {
  const m = ym(today);
  if (key === 'custom') return custom ? clampPeriod(custom, today) : periodFor('last3', today);
  if (key === 'thisMonth') return { from: `${m}-01`, to: today };
  if (key === 'lastMonth') { const p = addMonths(m, -1); return { from: `${p}-01`, to: lastOfMonth(p) }; }
  return { from: `${addMonths(m, key === 'last3' ? -2 : -5)}-01`, to: today };
}
/** Months ('YYYY-MM') a period touches, oldest first. */
export function monthsOf(p: InsightPeriod): string[] {
  const out: string[] = [];
  for (let m = ym(p.from); m <= ym(p.to); m = addMonths(m, 1)) out.push(m);
  return out;
}

// ---------- the hours the heat map covers ----------
export const HEAT_FIRST = 8;
export const HEAT_LAST = 16;
/** 08 … 16: nine hour columns (the club is open 08:30 to 16:30). */
export const HEAT_HOURS: number[] = Array.from({ length: HEAT_LAST - HEAT_FIRST + 1 }, (_, i) => HEAT_FIRST + i);
/** Mon … Fri → 0 … 4; weekends -1. */
export const weekdayIdx = (d: ISODate): number => { const w = dow(d); return w >= 1 && w <= 5 ? w - 1 : -1; };

/** The open days a period covers up to today (today only once the day is over). */
export function observedDays(s: ClubState, period: InsightPeriod, today: ISODate, todayDone = false): ISODate[] {
  const out: ISODate[] = [];
  const to = period.to < today ? period.to : today;
  for (let d = period.from; d <= to; d = addDays(d, 1)) {
    if (d === today && !todayDone) continue;
    if (isOpen(s, d)) out.push(d);
  }
  return out;
}

// ---------- one day's numbers ----------
export interface DayCounts {
  /** members active on the date, by the plan they were on that day */
  active: { flex: number; gold: number };
  /** active members checked in by `nowMin` */
  came: number;
  /** came and not checked out by `nowMin` */
  inNow: number;
  /** came and checked out by `nowMin` */
  gone: number;
  /** active members not (yet) checked in: active - came */
  notIn: number;
}
/** KC round 14: the day at a glance. `nowMin` cuts the day off (check-ins and check-outs after it are not counted yet); pass 24 * 60 for a day that is over. */
export function dayCounts(s: ClubState, date: ISODate, nowMin: number): DayCounts {
  const out: DayCounts = { active: { flex: 0, gold: 0 }, came: 0, inNow: 0, gone: 0, notIn: 0 };
  for (const m of live(s.members)) {
    if (!activeOn(m, date)) continue;
    out.active[planOn(m, date).plan]++;
    const a = attOf(s, date, m.id);
    if (!a?.checkIn || toMin(a.checkIn.at) > nowMin) continue;
    out.came++;
    if (a.checkOut && toMin(a.checkOut.at) <= nowMin) out.gone++; else out.inNow++;
  }
  out.notIn = out.active.flex + out.active.gold - out.came;
  return out;
}

// ---------- visits ----------
interface Visit { date: ISODate; memberId: string; plan: Plan; inMin: number; outMin: number | null; wd: number }

function collectVisits(s: ClubState, days: Set<ISODate>): Visit[] {
  const out: Visit[] = [];
  for (const a of live(s.attendance)) {
    if (!a.checkIn || !days.has(a.date)) continue;
    const m = s.members[a.memberId];
    if (!m || m.deletedAt || isPendingRow(m)) continue;
    const inMin = toMin(a.checkIn.at);
    const out0 = a.checkOut ? toMin(a.checkOut.at) : null;
    out.push({ date: a.date, memberId: a.memberId, plan: planOn(m, a.date).plan, inMin, outMin: out0 !== null && out0 >= inMin ? out0 : null, wd: weekdayIdx(a.date) });
  }
  return out;
}
const mean = (a: number[]): number | null => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;
const avgHM = (mins: number[]): HM | null => { const m = mean(mins); return m === null ? null : toHM(m); };
const avgStay = (vs: Visit[]): number | null => { const m = mean(vs.filter((v) => v.outMin !== null).map((v) => v.outMin! - v.inMin)); return m === null ? null : Math.round(m); };
const hourIdx = (min: number) => Math.min(HEAT_LAST, Math.max(HEAT_FIRST, Math.floor(min / 60))) - HEAT_FIRST;

// ---------- results ----------
export interface DayCount { date: ISODate; total: number; flex: number; gold: number }
export interface OverallStats {
  visits: number;
  openDays: number;
  /** members per open day (one decimal) */
  avgPerDay: number;
  /** average members per open day, Mon … Fri */
  weekdayAvg: number[];
  /** 0 = Monday … 4 = Friday; null without visits */
  busiestWeekday: number | null;
  /** average members in the club per open day, per hour 08 … 16 */
  hourAvg: number[];
  /** the hour (8 … 16) with the most members in the club on average */
  peakHour: number | null;
  maxDay: DayCount | null;
  /** one entry per open day, quiet days (0) included */
  dailyCounts: DayCount[];
  /** [weekday 0 … 4][hour 0 … 8]: average members present during that hour, over the open days of that weekday */
  presenceHeat: number[][];
  heatMax: number;
  /** arrivals (check-ins) per hour 08 … 16 over the whole period */
  arrivals: number[];
}
/** A week is 5 open days (Mon … Fri): the unit of "visits per member per week". */
export const OPEN_DAYS_PER_WEEK = 5;
/** One member inside one plan: what they did while they were on that plan (a member who changed plan is in both). */
export interface PlanPerson {
  memberId: string;
  /** visits made on this plan */
  visits: number;
  /** open days of the period on which the member was active on this plan */
  activeDays: number;
  /** share of those days they came, 0 … 1; null without an active day */
  rate: number | null;
  /** visits per week of active days (one decimal); 0 without an active day */
  perWeek: number;
  /** the (up to) two weekdays they come on most (0 = Monday), most first */
  usual: number[];
}
export interface PlanStats {
  plan: Plan;
  /** members on this plan for at least one open day of the period (visited or not): the length of `people` */
  members: number;
  visitors: number;
  visits: number;
  /** 0 … 1 of all visits */
  share: number;
  /** visits per member per week: visits / (member-days on this plan / 5), so a member counts for the open days they were active */
  perMemberWeek: number | null;
  /**
   * attendance rate, 0 … 1: of all the open days on which a member of this plan was active, the share on which they came. Pooled over the members, so each
   * counts in proportion to their active open days (someone who joined mid-period is prorated). Null without an active day.
   */
  attendanceRate: number | null;
  /** visits per weekday Mon … Fri */
  weekdays: number[];
  avgArrival: HM | null;
  avgStayMin: number | null;
  /** every member of the plan in the period, in name order (see `sortPeople` for most / fewest visits) */
  people: PlanPerson[];
}
export type TrendGrain = 'day' | 'week';
/** One point of the by-plan trend: the visits of each plan on one open day, or in one (Mon-Sun) week. */
export interface PlanTrendPoint {
  /** the first open day of the bucket (the day itself, or the first observed open day of the week) */
  date: ISODate;
  /** the last open day of the bucket */
  end: ISODate;
  /** open days the bucket covers (a week at the edge of the period, or with a holiday, has fewer than 5) */
  days: number;
  flex: number;
  gold: number;
}
export interface PlanTrend { grain: TrendGrain; points: PlanTrendPoint[] }
export interface PersonStats {
  memberId: string;
  plan: Plan;
  visits: number;
  perMonth: number;
  /** visits per weekday Mon … Fri */
  weekdays: number[];
  /** the (up to) two weekdays this member comes on most, most first */
  usual: number[];
  avgArrival: HM | null;
  avgStayMin: number | null;
  /** the last check-in up to today (not limited to the period) */
  lastVisit: ISODate | null;
  /** visits per month of the period, oldest first (months without visits included) */
  monthly: { month: string; visits: number }[];
  /** arrival time of every visit in the period, in minutes, oldest first */
  arrivals: { date: ISODate; value: number }[];
  /** the last 10 visits, newest first */
  recent: { date: ISODate; in: HM; out: HM | null }[];
}
export interface VisitInsights {
  period: InsightPeriod;
  days: ISODate[];
  overall: OverallStats;
  byPlan: Record<Plan, PlanStats>;
  people: PersonStats[];
  /** visits per plan over time: by day, or by week once the period is longer than `TREND_DAY_MAX` days */
  trend: PlanTrend;
  /** trial day passes in the period (guests, not members): a footnote */
  trials: number;
}

/** The whole report for a period. `todayDone`: the day is over, so today counts too. */
export function visitInsights(s: ClubState, period: InsightPeriod, today: ISODate, opts: { todayDone?: boolean } = {}): VisitInsights {
  const days = observedDays(s, period, today, opts.todayDone);
  const daySet = new Set(days);
  const closeMin = toMin(s.club.settings.close);
  const visits = collectVisits(s, daySet);

  // ----- overall
  const dayCounts = new Map<ISODate, DayCount>(days.map((d) => [d, { date: d, total: 0, flex: 0, gold: 0 }]));
  const openByWd = [0, 0, 0, 0, 0];
  for (const d of days) { const w = weekdayIdx(d); if (w >= 0) openByWd[w]++; }
  const heatSum = [0, 1, 2, 3, 4].map(() => HEAT_HOURS.map(() => 0));
  const arrivals = HEAT_HOURS.map(() => 0);
  const wdVisits = [0, 0, 0, 0, 0];
  for (const v of visits) {
    const c = dayCounts.get(v.date)!;
    c.total++; c[v.plan]++;
    arrivals[hourIdx(v.inMin)]++;
    if (v.wd < 0) continue;
    wdVisits[v.wd]++;
    // present in an hour when the stay overlaps it (a stay with no check-out lasts until closing)
    const out = Math.max(v.outMin ?? closeMin, v.inMin + 1);
    HEAT_HOURS.forEach((h, i) => { if (v.inMin < h * 60 + 60 && out > h * 60) heatSum[v.wd][i]++; });
  }
  const presenceHeat = heatSum.map((row, w) => row.map((n) => (openByWd[w] ? n / openByWd[w] : 0)));
  const hourAvg = HEAT_HOURS.map((_, i) => (days.length ? heatSum.reduce((t, row) => t + row[i], 0) / days.length : 0));
  const weekdayAvg = wdVisits.map((n, w) => (openByWd[w] ? n / openByWd[w] : 0));
  const best = (a: number[]) => { let bi = -1; a.forEach((x, i) => { if (x > 0 && (bi < 0 || x > a[bi])) bi = i; }); return bi; };
  const bw = best(weekdayAvg), bh = best(hourAvg);
  const daily = days.map((d) => dayCounts.get(d)!);
  const maxDay = daily.reduce<DayCount | null>((m, d) => (d.total > 0 && (!m || d.total > m.total) ? d : m), null);
  const overall: OverallStats = {
    visits: visits.length,
    openDays: days.length,
    avgPerDay: days.length ? r1(visits.length / days.length) : 0,
    weekdayAvg, busiestWeekday: bw < 0 ? null : bw,
    hourAvg, peakHour: bh < 0 ? null : HEAT_HOURS[bh],
    maxDay, dailyCounts: daily,
    presenceHeat, heatMax: Math.max(0, ...presenceHeat.flat()),
    arrivals,
  };

  // ----- member-months: a member counts for the open days they were active, each as 1 / the open days of its month, so "visits per month" is a monthly rate
  const monthOpen = new Map<string, number>();
  for (const d of days) { const m = ym(d); if (!monthOpen.has(m)) monthOpen.set(m, 0); }
  for (const m of monthOpen.keys()) {
    let n = 0;
    for (let d = `${m}-01`; ym(d) === m; d = addDays(d, 1)) if (isOpen(s, d)) n++;
    monthOpen.set(m, n || 1);
  }
  const planDays: Record<Plan, number> = { flex: 0, gold: 0 };
  const planCame: Record<Plan, number> = { flex: 0, gold: 0 };
  const memberMonths = new Map<string, number>();
  const lastActive = new Map<string, ISODate>();
  /** per member and plan: the open days they were active on that plan, and on how many of them they came */
  const onPlan = new Map<string, Record<Plan, { days: number; came: number }>>();
  const visitDays = new Set(visits.map((v) => `${v.memberId}|${v.date}`));
  const members = live(s.members).filter((m) => !isPendingRow(m));
  for (const m of members) {
    let mm = 0;
    const mine = { flex: { days: 0, came: 0 }, gold: { days: 0, came: 0 } };
    for (const d of days) {
      if (!activeOn(m, d)) continue;
      mm += 1 / monthOpen.get(ym(d))!;
      const p = planOn(m, d).plan;
      mine[p].days++;
      planDays[p]++;
      if (visitDays.has(`${m.id}|${d}`)) { mine[p].came++; planCame[p]++; }
      lastActive.set(m.id, d);
    }
    onPlan.set(m.id, mine);
    memberMonths.set(m.id, mm);
  }
  const byMember = new Map<string, Visit[]>();
  for (const v of visits) { const a = byMember.get(v.memberId); if (a) a.push(v); else byMember.set(v.memberId, [v]); }
  const usualDays = (wd: number[]) => wd.map((n, i) => ({ n, i })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 2).map((x) => x.i);

  // ----- by plan
  const byPlan = {} as Record<Plan, PlanStats>;
  for (const plan of ['flex', 'gold'] as Plan[]) {
    const vs = visits.filter((v) => v.plan === plan);
    const wd = [0, 0, 0, 0, 0];
    for (const v of vs) if (v.wd >= 0) wd[v.wd]++;
    const people: PlanPerson[] = [];
    for (const m of sortBy(members, (x) => `${x.firstName} ${x.lastName}`)) {
      const mine = (byMember.get(m.id) ?? []).filter((v) => v.plan === plan);
      const { days: activeDays, came } = onPlan.get(m.id)![plan];
      if (!activeDays && !mine.length) continue;
      const pwd = [0, 0, 0, 0, 0];
      for (const v of mine) if (v.wd >= 0) pwd[v.wd]++;
      people.push({
        memberId: m.id, visits: mine.length, activeDays,
        rate: activeDays ? Math.min(1, came / activeDays) : null,
        perWeek: activeDays ? r1(mine.length / (activeDays / OPEN_DAYS_PER_WEEK)) : 0,
        usual: usualDays(pwd),
      });
    }
    byPlan[plan] = {
      plan, members: people.length, visitors: new Set(vs.map((v) => v.memberId)).size, visits: vs.length,
      share: visits.length ? vs.length / visits.length : 0,
      perMemberWeek: planDays[plan] > 0 ? r1(vs.length / (planDays[plan] / OPEN_DAYS_PER_WEEK)) : null,
      attendanceRate: planDays[plan] > 0 ? Math.min(1, planCame[plan] / planDays[plan]) : null,
      weekdays: wd, avgArrival: avgHM(vs.map((v) => v.inMin)), avgStayMin: avgStay(vs), people,
    };
  }

  // ----- per person (everyone active on an open day of the period, so "fewest visits" shows who has not been)
  const last = lastVisits(s, today);
  const months = monthsOf(period);
  const people: PersonStats[] = [];
  for (const m of members) {
    const vs = (byMember.get(m.id) ?? []).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!vs.length && !lastActive.has(m.id)) continue;
    const wd = [0, 0, 0, 0, 0];
    for (const v of vs) if (v.wd >= 0) wd[v.wd]++;
    const usual = usualDays(wd);
    const mm = memberMonths.get(m.id) ?? 0;
    people.push({
      memberId: m.id, plan: planOn(m, lastActive.get(m.id) ?? today).plan, visits: vs.length, perMonth: mm > 0 ? r1(vs.length / mm) : 0,
      weekdays: wd, usual, avgArrival: avgHM(vs.map((v) => v.inMin)), avgStayMin: avgStay(vs), lastVisit: last[m.id] ?? null,
      monthly: months.map((month) => ({ month, visits: vs.filter((v) => ym(v.date) === month).length })),
      arrivals: vs.map((v) => ({ date: v.date, value: v.inMin })),
      recent: vs.slice(-10).reverse().map((v) => ({ date: v.date, in: toHM(v.inMin), out: v.outMin === null ? null : toHM(v.outMin) })),
    });
  }

  const trials = live(s.guestVisits).filter((g) => g.kind === 'trial' && g.status !== 'cancelled' && g.status !== 'noShow' && daySet.has(g.date)).length;
  return { period, days, overall, byPlan, people, trend: planTrend(days, visits), trials };
}

// ---------- visits per plan over time ----------
/** A period of up to this many calendar days (first to last open day) is drawn by day; a longer one, by week. */
export const TREND_DAY_MAX = 35;
/**
 * Visits of each plan per open day (quiet days included), or per Mon-Sun week for a long period (3 to 6 months: a line per day would be a thicket).
 * A week is placed on its first open day inside the period; `days` says how many open days it covers, so a short edge week or a holiday week is not
 * mistaken for a dip. `visits` are the period's visits (each tagged with the plan on the day).
 */
export function planTrend(days: ISODate[], visits: { date: ISODate; plan: Plan }[]): PlanTrend {
  const grain: TrendGrain = days.length && diffDays(days[0], days[days.length - 1]) + 1 > TREND_DAY_MAX ? 'week' : 'day';
  const key = (d: ISODate) => (grain === 'day' ? d : weekStart(d));
  const buckets = new Map<ISODate, PlanTrendPoint>();
  for (const d of days) {
    const b = buckets.get(key(d));
    if (b) { b.end = d; b.days++; } else buckets.set(key(d), { date: d, end: d, days: 1, flex: 0, gold: 0 });
  }
  for (const v of visits) { const b = buckets.get(key(v.date)); if (b) b[v.plan]++; }
  return { grain, points: [...buckets.values()] };
}

export type PersonSort = 'most' | 'fewest' | 'last';
export const PERSON_SORTS: PersonSort[] = ['most', 'fewest', 'last'];
/** The two sorts of a plan's people. */
export const PLAN_SORTS: PersonSort[] = ['most', 'fewest'];
/** Most / fewest visits, or the most recent visit first (when the rows know it); ties by name. */
export function sortPeople<T extends { memberId: string; visits: number; lastVisit?: ISODate | null }>(s: ClubState, people: T[], sort: PersonSort): T[] {
  const name = (p: T) => `${s.members[p.memberId]?.firstName ?? ''} ${s.members[p.memberId]?.lastName ?? ''}`;
  const byName = sortBy(people, name);
  if (sort === 'most') return byName.sort((a, b) => b.visits - a.visits);
  if (sort === 'fewest') return byName.sort((a, b) => a.visits - b.visits);
  return byName.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
}

// ---------- Flex: how the monthly quota is spent ----------
/** One Flex member in one calendar month: what they did with the month's quota. */
export interface QuotaMonth {
  memberId: string;
  /** 'YYYY-MM' */
  month: string;
  /** the month's quota (prorated for a partial month, as in `flexQuota`) */
  quota: number;
  /** Flex visits so far (a running month: up to today) */
  used: number;
  /** the month is still running */
  current: boolean;
  /** the date of the visit that used the quota up; null while visits are left */
  ranOut: ISODate | null;
  /** calendar days from the first visit of the month to the one that used the quota up */
  took: number | null;
  /** visits after the quota was gone (billed as extra days) */
  extra: number;
  /** visits of the quota that went unused: only a finished month burns them (always 0 for the running month) */
  burned: number;
}
export interface FlexQuotaReport {
  /** the calendar months the period touches, up to this month */
  months: string[];
  /** member-months with a quota to spend (what the two groups add up to, with `running`) */
  total: number;
  /** reached the quota: newest first. `avgDay`: the average day of the month it ran out (one decimal); `avgDays`: the average days it took from the first visit */
  usedAll: { entries: QuotaMonth[]; avgDay: number | null; avgDays: number | null };
  /** finished months that ended with visits left: most burned first. `burned`: visits left unused, in all; `avgBurned`: per member (month) */
  notAll: { entries: QuotaMonth[]; burned: number; avgBurned: number | null };
  /** the running month: members who still have visits left and have time to use them. Not burned, not listed. */
  running: number;
}
/**
 * How Flex members spend their quota over the calendar months a period touches (the whole month, not only the days inside the period: a quota is
 * monthly). The quota, its proration for a partial month and the plan on each visit come from `flexMonth`. The running month counts as far as today:
 * a member who already used the quota counts as "used it all", the others are `running`, never burned. Months with no quota to spend (prorated to 0) are left out.
 */
export function flexQuotaReport(s: ClubState, period: InsightPeriod, today: ISODate): FlexQuotaReport {
  const months = monthsOf(period).filter((m) => m <= ym(today));
  const usedAll: QuotaMonth[] = [];
  const notAll: QuotaMonth[] = [];
  let running = 0, total = 0;
  for (const month of months) {
    const current = month === ym(today);
    const upTo = current ? today : `${month}-31`;
    const openDays = openDaysInMonth(s, month).filter((d) => d <= upTo);
    for (const m of live(s.members)) {
      if (isPendingRow(m)) continue;
      const fm = flexMonth(s, m, month, today);
      if (fm.quota === null || fm.quota <= 0) continue;
      const dates = fm.visits.filter((d) => d <= upTo && planOn(m, d).plan === 'flex');
      if (!dates.length && !openDays.some((d) => activeOn(m, d))) continue;
      total++;
      const used = dates.length;
      const ranOut = used >= fm.quota ? dates[fm.quota - 1] : null;
      const entry: QuotaMonth = {
        memberId: m.id, month, quota: fm.quota, used, current, ranOut,
        took: ranOut ? diffDays(dates[0], ranOut) : null,
        extra: Math.max(0, used - fm.quota),
        burned: ranOut || current ? 0 : fm.quota - used,
      };
      if (ranOut) usedAll.push(entry);
      else if (current) running++;
      else notAll.push(entry);
    }
  }
  const name = (e: QuotaMonth) => `${s.members[e.memberId]?.firstName ?? ''} ${s.members[e.memberId]?.lastName ?? ''}`;
  const byName = (list: QuotaMonth[]) => sortBy(list, name);
  const burned = notAll.reduce((t, e) => t + e.burned, 0);
  return {
    months, total, running,
    usedAll: {
      entries: byName(usedAll).sort((a, b) => b.ranOut!.localeCompare(a.ranOut!)),
      avgDay: usedAll.length ? r1(mean(usedAll.map((e) => +e.ranOut!.slice(8)))!) : null,
      avgDays: usedAll.length ? r1(mean(usedAll.map((e) => e.took!))!) : null,
    },
    notAll: {
      entries: byName(notAll).sort((a, b) => b.burned - a.burned || b.month.localeCompare(a.month)),
      burned, avgBurned: notAll.length ? r1(burned / notAll.length) : null,
    },
  };
}

// ---------- membership trend (KC round 9: members in and out, by plan) ----------
/** The Membership tab's own ranges: calendar months ("3 months" is this month and the two before it), a year, or a custom From and To. */
export type MemberRangeKey = '3m' | '6m' | '1y' | 'custom';
export const MEMBER_RANGES: MemberRangeKey[] = ['3m', '6m', '1y', 'custom'];
export function memberRangeFor(key: MemberRangeKey, today: ISODate, custom?: InsightPeriod | null): InsightPeriod {
  if (key === 'custom' && custom) return clampPeriod(custom, today);
  const back = key === '6m' ? 5 : key === '1y' ? 11 : 2;
  return { from: `${addMonths(ym(today), -back)}-01`, to: today };
}
export interface PlanCount { gold: number; flex: number }
export interface MemberTrendPoint {
  /** the first and last day of the week or month (cut to the range) */
  start: ISODate;
  end: ISODate;
  /** memberships that started / ended in it, by the plan on that day */
  joined: PlanCount;
  left: PlanCount;
  /** plan switches of members who stayed (a new plan entry while the membership ran) */
  toGold: number;
  toFlex: number;
  /** members active on its last day, by plan */
  active: PlanCount;
}
export interface MemberTrend {
  grain: 'week' | 'month';
  points: MemberTrendPoint[];
  totals: { joined: PlanCount; left: PlanCount; toGold: number; toFlex: number; activeStart: PlanCount; activeEnd: PlanCount };
}
/** Weekly up to about three months (so "3 months" shows its weeks), monthly beyond. */
export const MEMBER_WEEKLY_MAX_DAYS = 100;
const zero = (): PlanCount => ({ gold: 0, flex: 0 });

/** Members in and out over a period: who joined, who left and who switched plan, per week or month, and how many were active by plan. */
export function memberTrend(s: ClubState, period: InsightPeriod, today: ISODate): MemberTrend {
  const to = period.to > today ? today : period.to;
  const from = period.from > to ? to : period.from;
  const grain: MemberTrend['grain'] = diffDays(from, to) + 1 <= MEMBER_WEEKLY_MAX_DAYS ? 'week' : 'month';
  const buckets: { start: ISODate; end: ISODate }[] = [];
  if (grain === 'week') {
    for (let w = weekStart(from); w <= to; w = addDays(w, 7)) buckets.push({ start: w < from ? from : w, end: addDays(w, 6) > to ? to : addDays(w, 6) });
  } else {
    for (const m of monthsOf({ from, to })) { const a = `${m}-01`, b = lastOfMonth(m); buckets.push({ start: a < from ? from : a, end: b > to ? to : b }); }
  }
  const members = live(s.members).filter((m) => !isPendingRow(m));
  const countActive = (date: ISODate): PlanCount => {
    const c = zero();
    for (const m of members) if (activeOn(m, date)) c[planOn(m, date).plan]++;
    return c;
  };
  const points: MemberTrendPoint[] = buckets.map((b) => ({ ...b, joined: zero(), left: zero(), toGold: 0, toFlex: 0, active: countActive(b.end) }));
  const at = (d: ISODate) => points.find((p) => p.start <= d && d <= p.end);
  for (const m of members) {
    for (const ms of m.memberships) {
      const j = at(ms.start);
      if (j) j.joined[planOn(m, ms.start).plan]++;
      if (ms.lastDay && ms.lastDay <= today) { const l = at(ms.lastDay); if (l) l.left[planOn(m, ms.lastDay).plan]++; }
    }
    m.plans.forEach((p, i) => {
      const prev = m.plans[i - 1];
      if (!prev || prev.plan === p.plan || p.from > today) return;
      const b = at(p.from);
      if (!b || !activeOn(m, addDays(p.from, -1))) return; // a member who stayed, not a new membership on another plan
      if (p.plan === 'gold') b.toGold++; else b.toFlex++;
    });
  }
  const sum = (f: (p: MemberTrendPoint) => PlanCount): PlanCount => points.reduce((a, p) => ({ gold: a.gold + f(p).gold, flex: a.flex + f(p).flex }), zero());
  return {
    grain,
    points,
    totals: {
      joined: sum((p) => p.joined), left: sum((p) => p.left),
      toGold: points.reduce((a, p) => a + p.toGold, 0), toFlex: points.reduce((a, p) => a + p.toFlex, 0),
      activeStart: countActive(addDays(from, -1)), activeEnd: points.length ? points[points.length - 1].active : countActive(to),
    },
  };
}
