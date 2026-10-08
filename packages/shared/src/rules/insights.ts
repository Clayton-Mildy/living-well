// KC round 7: visit insights. How intensely members come to the club: overall (when it is busy), per plan, per person and how Flex members spend their
// monthly quota. Pure rules over the attendance rows: members drop in on any open day, so there is nothing "expected" to compare with.
// A day counts once it is over: today is left out until `todayDone` (a half-finished day would pull every average down).
import type { ClubState, HM, ISODate, Plan } from '../types';
import { activeOn, isOpen, isPendingRow, planOn } from './core';
import { flexMonth } from './attendance';
import { lastVisits } from './members';
import { addDays, addMonths, dow, live, sortBy, toHM, toMin, ym } from '../util';

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
export interface PlanStats {
  plan: Plan;
  /** members on this plan for at least one open day of the period (visited or not) */
  members: number;
  visitors: number;
  visits: number;
  /** 0 … 1 of all visits */
  share: number;
  /** visits per member per month (member-months are prorated by open days) */
  perMemberMonth: number | null;
  /** visits per weekday Mon … Fri */
  weekdays: number[];
  avgArrival: HM | null;
  avgStayMin: number | null;
}
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
  const planMonths: Record<Plan, number> = { flex: 0, gold: 0 };
  const planMembers: Record<Plan, Set<string>> = { flex: new Set(), gold: new Set() };
  const memberMonths = new Map<string, number>();
  const lastActive = new Map<string, ISODate>();
  const members = live(s.members).filter((m) => !isPendingRow(m));
  for (const m of members) {
    let mm = 0;
    for (const d of days) {
      if (!activeOn(m, d)) continue;
      const w = 1 / monthOpen.get(ym(d))!;
      mm += w;
      const p = planOn(m, d).plan;
      planMonths[p] += w;
      planMembers[p].add(m.id);
      lastActive.set(m.id, d);
    }
    memberMonths.set(m.id, mm);
  }

  // ----- by plan
  const byPlan = {} as Record<Plan, PlanStats>;
  for (const plan of ['flex', 'gold'] as Plan[]) {
    const vs = visits.filter((v) => v.plan === plan);
    const wd = [0, 0, 0, 0, 0];
    for (const v of vs) if (v.wd >= 0) wd[v.wd]++;
    byPlan[plan] = {
      plan, members: planMembers[plan].size, visitors: new Set(vs.map((v) => v.memberId)).size, visits: vs.length,
      share: visits.length ? vs.length / visits.length : 0,
      perMemberMonth: planMonths[plan] > 0 ? r1(vs.length / planMonths[plan]) : null,
      weekdays: wd, avgArrival: avgHM(vs.map((v) => v.inMin)), avgStayMin: avgStay(vs),
    };
  }

  // ----- per person (everyone active on an open day of the period, so "fewest visits" shows who has not been)
  const last = lastVisits(s, today);
  const months = monthsOf(period);
  const people: PersonStats[] = [];
  const byMember = new Map<string, Visit[]>();
  for (const v of visits) { const a = byMember.get(v.memberId); if (a) a.push(v); else byMember.set(v.memberId, [v]); }
  for (const m of members) {
    const vs = (byMember.get(m.id) ?? []).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!vs.length && !lastActive.has(m.id)) continue;
    const wd = [0, 0, 0, 0, 0];
    for (const v of vs) if (v.wd >= 0) wd[v.wd]++;
    const usual = wd.map((n, i) => ({ n, i })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 2).map((x) => x.i);
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
  return { period, days, overall, byPlan, people, trials };
}

export type PersonSort = 'most' | 'fewest' | 'last';
export const PERSON_SORTS: PersonSort[] = ['most', 'fewest', 'last'];
/** Most / fewest visits (then the longer-absent first among equals), or the most recent visit first; ties by name. */
export function sortPeople(s: ClubState, people: PersonStats[], sort: PersonSort): PersonStats[] {
  const name = (p: PersonStats) => `${s.members[p.memberId]?.firstName ?? ''} ${s.members[p.memberId]?.lastName ?? ''}`;
  const byName = sortBy(people, name);
  if (sort === 'most') return byName.sort((a, b) => b.visits - a.visits);
  if (sort === 'fewest') return byName.sort((a, b) => a.visits - b.visits);
  return byName.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
}

// ---------- Flex: how the quota is spent ----------
export type FlexBucket = 'b0' | 'b4' | 'b7' | 'all' | 'extra';
export const FLEX_BUCKETS: FlexBucket[] = ['b0', 'b4', 'b7', 'all', 'extra'];
export interface FlexRow {
  memberId: string;
  quota: number;
  used: number;
  left: number;
  extra: number;
  /** current month: visits expected by month end at the member's own pace; null for a finished month or a member with no days yet */
  projected: number | null;
  /** visits that go unused: the visits left in a finished month; for the current month the quota minus the projection */
  unused: number;
  bucket: FlexBucket;
}
export interface FlexUsage {
  month: string;
  /** the month is still running */
  current: boolean;
  rows: FlexRow[];
  avgQuota: number;
  quotaTotal: number;
  /** Flex visits made (extra days included) */
  visits: number;
  leftTotal: number;
  unusedTotal: number;
  extraTotal: number;
  /** current month: members expected to leave visits unused */
  likelyMembers: number;
  buckets: Record<FlexBucket, number>;
  /** cumulative Flex visits per member (average), by open day, against an even pace to the full quota */
  pace: { date: ISODate; avg: number; even: number }[];
  /** share of the month's Flex visits made on days 1 – 15 and from the 16th; `complete` once the month is past the 15th */
  half: { first: number; second: number; firstShare: number | null; complete: boolean };
}
const bucketOf = (quota: number, used: number, extra: number): FlexBucket =>
  extra > 0 ? 'extra' : quota > 0 && used >= quota ? 'all' : used <= 3 ? 'b0' : used <= 6 ? 'b4' : 'b7';

export function flexUsage(s: ClubState, month: string, today: ISODate, opts: { todayDone?: boolean } = {}): FlexUsage {
  const current = month === ym(today);
  const openDays: ISODate[] = [];
  for (let d = `${month}-01`; ym(d) === month; d = addDays(d, 1)) if (isOpen(s, d)) openDays.push(d);
  // the visits and days that count as lived: up to yesterday, or today once it is over
  const cut = !current ? `${month}-31` : opts.todayDone ? today : addDays(today, -1);
  const elapsed = openDays.filter((d) => d <= cut);
  const remaining = openDays.filter((d) => d > cut);
  const upTo = current ? today : `${month}-31`;
  const rows: FlexRow[] = [];
  const flexDates = new Map<string, ISODate[]>();
  for (const m of live(s.members)) {
    if (isPendingRow(m)) continue;
    const fm = flexMonth(s, m, month, today);
    if (fm.quota === null) continue;
    const mine = fm.visits.filter((d) => planOn(m, d).plan === 'flex');
    if (!mine.length && !openDays.some((d) => d <= upTo && activeOn(m, d))) continue;
    flexDates.set(m.id, mine);
    let projected: number | null = null;
    let unused = fm.left ?? 0;
    if (current) {
      const activeElapsed = elapsed.filter((d) => activeOn(m, d)).length;
      const usedCut = mine.filter((d) => d <= cut).length;
      if (activeElapsed > 0) {
        projected = Math.max(fm.used, usedCut + (usedCut / activeElapsed) * remaining.filter((d) => activeOn(m, d)).length);
        unused = fm.used >= fm.quota ? 0 : Math.max(0, Math.round(fm.quota - projected));
      }
    }
    rows.push({ memberId: m.id, quota: fm.quota, used: fm.used, left: fm.left ?? 0, extra: fm.extra, projected: projected === null ? null : r1(projected), unused, bucket: bucketOf(fm.quota, fm.used, fm.extra) });
  }
  const buckets: Record<FlexBucket, number> = { b0: 0, b4: 0, b7: 0, all: 0, extra: 0 };
  for (const r of rows) buckets[r.bucket]++;
  const avgQuota = rows.length ? rows.reduce((t, r) => t + r.quota, 0) / rows.length : 0;

  // pace: cumulative visits per member on each lived open day, against an even spread of the quota over the month's open days
  const pace = rows.length
    ? elapsed.map((d, i) => ({
        date: d,
        avg: r1([...flexDates.values()].reduce((t, ds) => t + ds.filter((x) => x <= d).length, 0) / rows.length),
        even: r1((avgQuota * (i + 1)) / openDays.length),
      }))
    : [];
  let first = 0, second = 0;
  for (const ds of flexDates.values()) for (const d of ds) if (d <= cut) { if (+d.slice(8) <= 15) first++; else second++; }
  const total = first + second;
  return {
    month, current, rows, avgQuota: r1(avgQuota),
    quotaTotal: rows.reduce((t, r) => t + r.quota, 0),
    visits: rows.reduce((t, r) => t + r.used, 0),
    leftTotal: rows.reduce((t, r) => t + r.left, 0),
    unusedTotal: rows.reduce((t, r) => t + r.unused, 0),
    extraTotal: rows.reduce((t, r) => t + r.extra, 0),
    likelyMembers: current ? rows.filter((r) => r.unused > 0).length : 0,
    buckets, pace,
    half: { first, second, firstShare: total ? first / total : null, complete: !current || +cut.slice(8) > 15 },
  };
}
export type FlexSort = 'unused' | 'used' | 'extra';
export const FLEX_SORTS: FlexSort[] = ['unused', 'used', 'extra'];
/** Members who leave the most unused first (or the most used, or the most extra days); ties by name. */
export function sortFlexRows(s: ClubState, rows: FlexRow[], sort: FlexSort): FlexRow[] {
  const name = (r: FlexRow) => `${s.members[r.memberId]?.firstName ?? ''} ${s.members[r.memberId]?.lastName ?? ''}`;
  const byName = sortBy(rows, name);
  return byName.sort((a, b) => (sort === 'unused' ? b.unused - a.unused || b.left - a.left : sort === 'used' ? b.used - a.used : b.extra - a.extra || b.used - a.used));
}
