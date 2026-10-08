// KC round 7: the maths behind TrendChart, kept apart from React so it can be tested. Points sit on a time scale (a date and, when
// known, the time of day), the y range is picked from the data, the nearest point to the pointer is found by x.
import type { HM, ISODate } from '@cp/shared';
import { addDays, daysBetween, toMin } from '@cp/shared/util';

export const MIN_DAY = 1440;
/** a point with no time of day (a count per day) sits at noon: the middle of its day */
export const NOON = 720;

/** the ranges a trend can be looked at over (the same as TrendRange in TrendChart) */
export type RangeKey = '1w' | '1m' | '3m' | '6m' | 'all';
const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '1w': 7, '1m': 30, '3m': 90, '6m': 180 };

/**
 * The first day a range shows, counting back from `today`. `firstDate` is the oldest data there is: no range starts before it
 * (so a member with two weeks of readings sees them across the whole chart on 3M, not squeezed into the right edge), and "All" starts there.
 */
export function rangeFrom(range: RangeKey, today: ISODate, firstDate?: ISODate | null): ISODate {
  const start = range === 'all' ? firstDate ?? addDays(today, -RANGE_DAYS['1m']) : addDays(today, -RANGE_DAYS[range]);
  const from = firstDate && firstDate > start ? firstDate : start;
  return from > today ? today : from;
}

// ----- the date range control: a preset (1M / 3M / 6M / All) or a custom From and To -----
/** a range is one of the presets or a custom window */
export type RangeChoice = RangeKey | 'custom';
export interface DateWindow { from: ISODate; to: ISODate }
/** what a range control holds: the choice, and the custom window while the choice is 'custom' */
export interface RangeValue { choice: RangeChoice; custom: DateWindow | null }
export const rangeValue = (choice: RangeChoice = '3m'): RangeValue => ({ choice, custom: null });

/** A window put right: swapped dates turned round, nothing after today, and (when the data starts inside the window) nothing before the first reading. */
export function clampWindow(w: DateWindow, today: ISODate, firstDate?: ISODate | null): DateWindow {
  let from = w.from <= w.to ? w.from : w.to, to = w.from <= w.to ? w.to : w.from;
  if (to > today) to = today;
  if (from > to) from = to;
  if (firstDate && from < firstDate && firstDate <= to) from = firstDate;
  return { from, to };
}
/** The dates a range value stands for. A preset runs to today; a custom window is as the reader set it (inside the data and today). */
export function windowOf(v: RangeValue, today: ISODate, firstDate?: ISODate | null): DateWindow {
  if (v.choice === 'custom') return v.custom ? clampWindow(v.custom, today, firstDate) : { from: rangeFrom('3m', today, firstDate), to: today };
  return { from: rangeFrom(v.choice, today, firstDate), to: today };
}
/** Switch to a preset or to Custom. Custom starts as the range that was showing (the preset's dates), so nothing jumps. */
export function pickChoice(v: RangeValue, choice: RangeChoice, today: ISODate, firstDate?: ISODate | null): RangeValue {
  if (choice !== 'custom') return v.choice === choice && !v.custom ? v : { choice, custom: null };
  if (v.choice === 'custom' && v.custom) return v;
  return { choice: 'custom', custom: windowOf(v, today, firstDate) };
}
/** Set one end of the custom window; the other end follows when they would cross (From is never after To). */
export function editCustom(v: RangeValue, part: 'from' | 'to', date: ISODate, today: ISODate, firstDate?: ISODate | null): RangeValue {
  if (!date) return v;
  const cur = windowOf(v, today, firstDate);
  const next = part === 'from' ? { from: date, to: date > cur.to ? date : cur.to } : { from: date < cur.from ? date : cur.from, to: date };
  return { choice: 'custom', custom: clampWindow(next, today, firstDate) };
}
export const inWindow = (date: ISODate, w: DateWindow): boolean => date >= w.from && date <= w.to;

export interface TimeScale {
  from: ISODate;
  to: ISODate;
  /** whole days on the axis (both ends included) */
  days: number;
  /** pixels of the plot area */
  x0: number;
  x1: number;
  /** is this date inside the axis */
  has: (date: ISODate) => boolean;
  /** x of a date and time of day: the axis runs from the start of `from` to the end of `to` */
  x: (date: ISODate, time?: HM) => number;
}
/** A time axis from the start of `from` to the end of `to` over the pixels x0..x1. Swapped dates are put right. */
export function timeScale(from: ISODate, to: ISODate, x0: number, x1: number): TimeScale {
  const a = from <= to ? from : to, b = from <= to ? to : from;
  const days = daysBetween(a, b) + 1;
  const total = days * MIN_DAY;
  return {
    from: a, to: b, days, x0, x1,
    has: (d) => d >= a && d <= b,
    x: (d, time) => {
      const f = (daysBetween(a, d) * MIN_DAY + (time ? toMin(time) : NOON)) / total;
      return x0 + Math.max(0, Math.min(1, f)) * (x1 - x0);
    },
  };
}

/** the index of the entry of the sorted list `xs` that is nearest to `x` (the earlier one on a tie); -1 for an empty list */
export function nearestIndex(xs: number[], x: number): number {
  if (!xs.length) return -1;
  let lo = 0, hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1; else hi = mid;
  }
  // xs[lo] is the first entry at or after x; its left neighbour may be nearer
  return lo > 0 && x - xs[lo - 1] <= xs[lo] - x ? lo - 1 : lo;
}

export interface SnapTarget { key: string; date: ISODate; time?: HM; x: number }
/** Every moment that has a reading in any series (one per date and time), left to right: what the pointer snaps to. Points outside the axis are left out. */
export function snapTargets(series: { points: { date: ISODate; time?: HM }[] }[], scale: TimeScale): SnapTarget[] {
  const m = new Map<string, SnapTarget>();
  for (const s of series) {
    for (const p of s.points) {
      if (!scale.has(p.date)) continue;
      const key = p.date + '|' + (p.time ?? '');
      if (!m.has(key)) m.set(key, { key, date: p.date, time: p.time, x: scale.x(p.date, p.time) });
    }
  }
  return [...m.values()].sort((a, b) => a.x - b.x || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The y range for some values: padded so dots do not touch the edges. `zero` starts at 0 (counts). */
export function yDomain(values: number[], zero = false): [number, number] {
  if (!values.length) return [0, 1];
  const lo = Math.min(...values), hi = Math.max(...values);
  if (zero) return [0, hi > 0 ? hi * 1.12 : 1];
  const span = hi - lo;
  const pad = span > 0 ? span * 0.18 : Math.max(1, Math.abs(hi) * 0.05);
  return [lo - pad, hi + pad];
}

/** About three round numbers inside lo..hi for the gridlines (`int`: whole numbers only, for counts). */
export function niceTicks(lo: number, hi: number, want = 3, int = false): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const e0 = Math.floor(Math.log10(span / 6)), e1 = Math.ceil(Math.log10(span));
  let best: { step: number; n: number } | null = null;
  for (let e = e0; e <= e1; e++) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * 10 ** e;
      if (int && (step < 1 || step % 1 !== 0)) continue;
      const n = Math.floor(hi / step + 1e-9) - Math.ceil(lo / step - 1e-9) + 1;
      if (n < 2) continue;
      if (!best || Math.abs(n - want) < Math.abs(best.n - want) || (Math.abs(n - want) === Math.abs(best.n - want) && step > best.step)) best = { step, n };
    }
  }
  if (!best) return [lo, hi].map((v) => (int ? Math.round(v) : v));
  const first = Math.ceil(lo / best.step - 1e-9);
  return Array.from({ length: best.n }, (_, i) => Number(((first + i) * best!.step).toFixed(10)));
}

/** the first of each month after `from` up to `to` (month ticks of a long axis) */
export function monthStarts(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  for (let i = 0; i < 600; i++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const d = `${y}-${String(m).padStart(2, '0')}-01`;
    if (d > to) break;
    if (d > from) out.push(d);
  }
  return out;
}

/** `n` dates spread evenly from `from` to `to` (both included): the date labels of a short axis */
export function evenDates(from: ISODate, to: ISODate, n: number): ISODate[] {
  const days = daysBetween(from, to);
  if (n < 2 || days <= 0) return [from];
  const out: ISODate[] = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(from, Math.round((days * i) / (n - 1)));
    if (out[out.length - 1] !== d) out.push(d);
  }
  return out;
}
