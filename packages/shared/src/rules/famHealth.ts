// Round 8, the family Health tab, Health history and a parent's profile: what the family may read of a member's health checks, per measurement.
// Pure and language-free (the screens pick the words). A family only ever sees approved readings (readingForFamily), graded against the member's
// own limits first, then the club's (limitsFor, passed in as L), so a grade here matches the one on the nurse's screen.
import type { ClubState, Health, HealthLimits, ISODate, Reading } from '../types';
import { bpStatus, gluStatus, pulseStatus, readingsOf, spo2Status, tempStatus, weightStatus } from './health';
import { NORMAL_BANDS } from './healthStation';
import { readingForFamily } from './approvals';
import { addDays, addMonths, daysInMonth, dow, ym } from '../util';

export type HMetric = 'bp' | 'pulse' | 'spo2' | 'temp' | 'glucose' | 'weight' | 'grip';
/** The order of the metric chips on the history page. */
export const HIST_METRICS: HMetric[] = ['bp', 'pulse', 'spo2', 'temp', 'glucose', 'weight', 'grip'];
/** The four tiles under the blood pressure on the Health tab. */
export const TILE_METRICS: HMetric[] = ['pulse', 'spo2', 'glucose', 'weight'];
/** The six small tiles on a parent's profile. */
export const PROFILE_METRICS: HMetric[] = ['bp', 'pulse', 'spo2', 'temp', 'glucose', 'weight'];
export const METRIC_UNIT: Record<HMetric, string> = { bp: 'mmHg', pulse: 'bpm', spo2: '%', temp: '°C', glucose: 'mg/dL', weight: 'kg', grip: 'kg' };
const FIELD: Record<Exclude<HMetric, 'bp'>, 'pulse' | 'spo2' | 'temp' | 'glucose' | 'weight' | 'grip'> = { pulse: 'pulse', spo2: 'spo2', temp: 'temp', glucose: 'glucose', weight: 'weight', grip: 'grip' };
const DECIMALS: Record<HMetric, 0 | 1> = { bp: 0, pulse: 0, spo2: 0, temp: 1, glucose: 0, weight: 1, grip: 1 };
export const isMetric = (v: unknown): v is HMetric => typeof v === 'string' && (HIST_METRICS as string[]).includes(v);

/** The readings a family may see for a member, oldest first (one waiting for the club's approval is left out). */
export function familyReadings(s: ClubState, memberId: string): Reading[] {
  return readingsOf(s, memberId).map(readingForFamily).filter((r): r is Reading => !!r);
}

/** Does the reading carry this measurement (a blood pressure needs both numbers). */
export const hasMetric = (r: Reading, m: HMetric): boolean => (m === 'bp' ? r.sys != null && r.dia != null : r[FIELD[m]] != null);
/** The one number plotted for a reading: the upper number for blood pressure. */
export const metricNumber = (r: Reading, m: HMetric): number => (m === 'bp' ? r.sys! : (r[FIELD[m]] as number));
/** "124/76", "76", "36.4", "54.8": the number as read out, without its unit. */
export const metricText = (r: Reading, m: HMetric): string => (m === 'bp' ? `${r.sys}/${r.dia}` : DECIMALS[m] ? metricNumber(r, m).toFixed(1) : String(Math.round(metricNumber(r, m))));
/** Readings that carry the measurement, newest last. */
export const readingsWith = (rs: Reading[], m: HMetric): Reading[] => rs.filter((r) => hasMetric(r, m));
export const latestOf = (rs: Reading[], m: HMetric): Reading | undefined => readingsWith(rs, m).pop();
/** The measurements that have at least one reading, in chip order. */
export const metricsWithData = (rs: Reading[]): HMetric[] => HIST_METRICS.filter((m) => rs.some((r) => hasMetric(r, m)));

/** How a reading grades on one measurement. Weight is judged against the previous weight and shows nothing unless it moved; grip has no grade. */
export function metricStatus(r: Reading, m: HMetric, L: HealthLimits, prevWeight?: number): Health | null {
  switch (m) {
    case 'bp': return bpStatus(r.sys!, r.dia!, L);
    case 'pulse': return pulseStatus(r.pulse!, L);
    case 'spo2': return spo2Status(r.spo2!, L);
    case 'temp': return tempStatus(r.temp!, L);
    case 'glucose': return gluStatus(r.glucose!, L);
    case 'weight': { const st = weightStatus(r.weight!, prevWeight, L); return st === 'normal' ? null : st; }
    default: return null;
  }
}

export interface MetricRow {
  r: Reading;
  /** the number plotted (upper number for blood pressure) */
  value: number;
  /** blood pressure: the lower number */
  low?: number;
  text: string;
  /** null = recorded only (weight that did not move much, grip) */
  status: Health | null;
}
/** Every reading of one measurement with its grade, oldest first. */
export function metricRows(rs: Reading[], m: HMetric, L: HealthLimits): MetricRow[] {
  let prevW: number | undefined;
  return readingsWith(rs, m).map((r) => {
    const status = metricStatus(r, m, L, prevW);
    if (m === 'weight') prevW = r.weight;
    return { r, value: metricNumber(r, m), low: m === 'bp' ? r.dia : undefined, text: metricText(r, m), status };
  });
}

/** The shaded normal range of a chart, from the member's own limits (weight and grip have none). */
export function bandOf(m: HMetric, L: HealthLimits): { from: number; to: number } | undefined {
  switch (m) {
    case 'bp': return { from: L.sysLow.watch ?? L.sysLow.alert ?? NORMAL_BANDS.bp[0], to: (L.sysHigh.watch ?? L.sysHigh.alert ?? NORMAL_BANDS.bp[1] + 1) - 1 };
    case 'pulse': return { from: L.pulseLow.watch ?? L.pulseLow.alert ?? NORMAL_BANDS.pulse[0], to: L.pulseHigh.watch ?? L.pulseHigh.alert ?? NORMAL_BANDS.pulse[1] };
    case 'spo2': return { from: L.spo2Low.watch ?? L.spo2Low.alert ?? NORMAL_BANDS.spo2[0], to: 100 };
    case 'temp': return { from: L.tempLow.watch ?? NORMAL_BANDS.temp[0], to: Math.round(((L.tempHigh.watch ?? L.tempHigh.alert ?? 37.5) - 0.1) * 10) / 10 };
    case 'glucose': return { from: L.gluLow.watch ?? L.gluLow.alert ?? NORMAL_BANDS.glucose[0], to: L.gluHigh.watch ?? L.gluHigh.alert ?? NORMAL_BANDS.glucose[1] };
    default: return undefined;
  }
}

/** The average of a set of rows as text ("124/76", "76", "54.8"); '' for none. */
export function averageText(rows: MetricRow[], m: HMetric): string {
  if (!rows.length) return '';
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  if (m === 'bp') return `${Math.round(avg(rows.map((x) => x.value)))}/${Math.round(avg(rows.map((x) => x.low ?? 0)))}`;
  const a = avg(rows.map((x) => x.value));
  return DECIMALS[m] ? a.toFixed(1) : String(Math.round(a));
}

export interface ReadingPart { metric: HMetric; text: string; status: Health | null }
export interface ReadingSummary {
  r: Reading;
  /** every measurement the reading carries, in chip order (blood pressure first) */
  parts: ReadingPart[];
  /** the worst grade among the parts; null when none of them is graded (grip) */
  status: Health | null;
}
const WORST: Record<Health, number> = { normal: 0, watch: 1, alert: 2 };
/** The worst grade of a set of parts; null when none of them is graded. */
const worstOf = (parts: ReadingPart[]): Health | null => {
  const graded = parts.map((x) => x.status).filter((x): x is Health => !!x);
  return graded.length ? graded.reduce((a, b) => (WORST[b] > WORST[a] ? b : a)) : null;
};
/** Everything reading `i` of `rs` (oldest first) measured, graded; `order` picks the measurements and their order. Weight is graded against the weight before it. */
function partsAt(rs: Reading[], i: number, L: HealthLimits, order: HMetric[] = HIST_METRICS): ReadingPart[] {
  const r = rs[i];
  const parts: ReadingPart[] = [];
  for (const metric of order) {
    if (!hasMetric(r, metric)) continue;
    let prev: number | undefined;
    if (metric === 'weight') for (let j = i - 1; j >= 0 && prev == null; j--) prev = rs[j].weight ?? undefined;
    parts.push({ metric, text: metricText(r, metric), status: metricStatus(r, metric, L, prev) });
  }
  return parts;
}
/**
 * The newest `n` readings the family may see (newest first), each with all it measured and its worst grade: the desktop "latest readings" list. Weight is graded
 * against the weight before it, like the history page.
 */
export function latestReadings(rs: Reading[], L: HealthLimits, n = 6): ReadingSummary[] {
  const out: ReadingSummary[] = [];
  for (let i = rs.length - 1; i >= 0 && out.length < n; i--) {
    const parts = partsAt(rs, i, L);
    if (parts.length) out.push({ r: rs[i], parts, status: worstOf(parts) });
  }
  return out;
}

// ---------- one day's checks (Today's "Health" section) ----------
/** What Today's health section lists of a check, in this order: blood pressure, oxygen, temperature, pulse, then glucose and weight when the monthly check took them. */
export const DAY_METRICS: HMetric[] = ['bp', 'spo2', 'temp', 'pulse', 'glucose', 'weight'];
export interface DayCheck {
  id: string;
  kind: Reading['kind'];
  time: string;
  /** the staff member who took it */
  by: string;
  parts: ReadingPart[];
  /** the worst grade of the parts; null when none is graded */
  status: Health | null;
}
/** The checks a family may read for one member on one day, in time order: every approved reading of that date with its measurements and grade. Empty when there were none. */
export function dayChecks(s: ClubState, memberId: string, date: ISODate, L: HealthLimits): DayCheck[] {
  const rs = familyReadings(s, memberId);
  const out: DayCheck[] = [];
  rs.forEach((r, i) => {
    if (r.date !== date) return;
    const parts = partsAt(rs, i, L, DAY_METRICS);
    if (parts.length) out.push({ id: r.id, kind: r.kind, time: r.time, by: r.takenBy, parts, status: worstOf(parts) });
  });
  return out;
}
/** The worst grade among a day's checks (null for none, or when none is graded). */
export const worstCheck = (checks: DayCheck[]): Health | null => worstOf(checks.map((c) => ({ metric: 'bp' as HMetric, text: '', status: c.status })));

/** The latest blood pressure the family may see and how it grades: what the Health tab's big card shows. */
export function bpHero(rs: Reading[], L: HealthLimits): { r: Reading; status: Health } | undefined {
  const r = latestOf(rs, 'bp');
  return r ? { r, status: bpStatus(r.sys!, r.dia!, L) } : undefined;
}

/** Heights (28 to 100, a percent) of the last `n` upper numbers, oldest first: the small bars under the big card. Fewer than two readings draw nothing. */
export function heroBars(rs: Reading[], n = 14): number[] {
  const vals = readingsWith(rs, 'bp').slice(-n).map((r) => r.sys!);
  if (vals.length < 2) return [];
  const lo = Math.min(...vals), span = Math.max(Math.max(...vals) - lo, 12);
  return vals.map((v) => Math.round(28 + (72 * (v - lo)) / span));
}

// ---------- the date-range picker (Health history, Custom) ----------
/** Cells of a month, Monday first: a null for each empty cell before the 1st, then the days 1..n. */
export function monthCells(month: string): (number | null)[] {
  const lead = (dow(`${month}-01`) + 6) % 7;
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1)];
}
/** The two ends being picked: `pick` says which one the next tap sets. */
export interface RangePick { from: ISODate | null; to: ISODate | null; pick: 'from' | 'to' }
/** One tap on a day: picking From moves on to To (keeping a To that is still after it); picking To earlier than From swaps them round. */
export function pickDay(st: RangePick, day: ISODate): RangePick {
  if (st.pick === 'from') return { from: day, to: st.to && st.to >= day ? st.to : null, pick: 'to' };
  if (st.from && day < st.from) return { from: day, to: st.from, pick: 'from' };
  return { from: st.from, to: day, pick: 'from' };
}
export interface QuickRange { key: 'thisMonth' | 'lastMonth' | 'twoWeeks' | 'since'; from: ISODate; to: ISODate; /** "since": the month it starts in */ month?: string }
/** The shortcuts in the picker. "Since <month>" is the month of the first reading, offered when it is before last month. */
export function quickRanges(today: ISODate, firstDate?: ISODate | null): QuickRange[] {
  const m = ym(today), last = addMonths(m, -1);
  const out: QuickRange[] = [
    { key: 'thisMonth', from: `${m}-01`, to: today },
    { key: 'lastMonth', from: `${last}-01`, to: `${last}-${String(daysInMonth(last)).padStart(2, '0')}` },
    { key: 'twoWeeks', from: addDays(today, -14), to: today },
  ];
  if (firstDate && ym(firstDate) < last) out.push({ key: 'since', from: `${ym(firstDate)}-01`, to: today, month: ym(firstDate) });
  return out;
}
