// Pure date and time math for DateField, MonthField and TimeField (all UTC, no Date.now, so it is trivial to test).
import { addDays, addMonths, daysInMonth, parseDate } from '@cp/shared';

export type ISODate = string; // 'YYYY-MM-DD'
export type YM = string; // 'YYYY-MM'
export type HM = string; // 'HH:MM'

const p2 = (n: number) => String(n).padStart(2, '0');

/** Monday = 0 … Sunday = 6 (the club's week starts on Monday). */
export const weekdayMon = (d: ISODate) => (parseDate(d).getUTCDay() + 6) % 7;
/** Weeks of a month, Monday first; days outside the month are null. Always whole weeks of 7. */
export function monthGrid(ym: YM): (ISODate | null)[][] {
  const first = `${ym}-01`;
  const lead = weekdayMon(first);
  const n = daysInMonth(ym);
  const cells: (ISODate | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${ym}-${p2(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const inRange = (d: string, min?: string, max?: string) => (!min || d >= min) && (!max || d <= max);
/** Keep a date inside [min, max] (min wins if they cross). */
export function clampDate(d: ISODate, min?: ISODate, max?: ISODate): ISODate {
  if (max && d > max) d = max;
  if (min && d < min) d = min;
  return d;
}
export const dateAllowed = (d: ISODate, o: { min?: ISODate; max?: ISODate; disabledDate?: (d: ISODate) => boolean }) => inRange(d, o.min, o.max) && !o.disabledDate?.(d);
/** Is any day of this month inside [min, max]? (min/max are dates or months) */
export const monthAllowed = (ym: YM, min?: string, max?: string) => (!min || ym >= min.slice(0, 7)) && (!max || ym <= max.slice(0, 7));
export const yearAllowed = (y: number, min?: string, max?: string) => (!min || y >= +min.slice(0, 4)) && (!max || y <= +max.slice(0, 4));

/** Same day number in another month, clamped to that month's length ("31 Jan" + 1 month → "28 Feb"). */
export function shiftMonth(d: ISODate, n: number): ISODate {
  const ym = addMonths(d.slice(0, 7), n);
  return `${ym}-${p2(Math.min(+d.slice(8, 10), daysInMonth(ym)))}`;
}
/** Move the date to another month (or year) of the same day number, clamped. */
export const withMonth = (d: ISODate, ym: YM): ISODate => `${ym}-${p2(Math.min(+d.slice(8, 10), daysInMonth(ym)))}`;
/** What each calendar arrow key does to the highlighted day. Returns null for keys that do nothing. */
export function stepDate(d: ISODate, key: string, shift = false): ISODate | null {
  switch (key) {
    case 'ArrowLeft': return addDays(d, -1);
    case 'ArrowRight': return addDays(d, 1);
    case 'ArrowUp': return addDays(d, -7);
    case 'ArrowDown': return addDays(d, 7);
    case 'Home': return addDays(d, -weekdayMon(d));
    case 'End': return addDays(d, 6 - weekdayMon(d));
    case 'PageUp': return shiftMonth(d, shift ? -12 : -1);
    case 'PageDown': return shiftMonth(d, shift ? 12 : 1);
    default: return null;
  }
}
/** First year of the 12-year page that contains y (… 2016–2027 …). */
export const yearPageStart = (y: number) => Math.floor(y / 12) * 12;

// ---- time ----
export const hmToMin = (hm: HM) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
export const minToHM = (m: number): HM => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
export const timeAllowed = (hm: HM, min?: HM, max?: HM) => (!min || hm >= min) && (!max || hm <= max);
export const isHM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
/** Minutes shown in the minute column: every `step`, plus the current value's own minute when it is off the grid (e.g. 09:58 from the clock). */
export function minuteChoices(step: number, current?: number): number[] {
  const s = Math.max(1, Math.min(60, Math.floor(step) || 5));
  const out: number[] = [];
  for (let m = 0; m < 60; m += s) out.push(m);
  if (current !== undefined && !out.includes(current)) out.push(current);
  return out.sort((a, b) => a - b);
}
/** The first allowed time inside an hour (so choosing "09" before any minute lands on a valid HH:MM), or null when the hour is closed. */
export function firstAllowedInHour(h: number, minutes: number[], min?: HM, max?: HM): HM | null {
  for (const m of minutes) { const hm = `${p2(h)}:${p2(m)}`; if (timeAllowed(hm, min, max)) return hm; }
  return null;
}
