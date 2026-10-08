// Deterministic date/time/money helpers (UTC maths on club wall-clock strings, as in data.js).
import type { DT, HM, ISODate, YM, Weekday } from './types';

/** The date the seed was written for (a Wednesday). Tests pin the demo to it with CP_DEMO_DATE=2026-10-21. */
export const DEMO_TODAY: ISODate = '2026-10-21';
export const DEMO_START_MIN = 598; // 09:58

export const iso = (d: Date): ISODate => d.toISOString().slice(0, 10);
export const parseDate = (s: ISODate) => new Date(s + 'T00:00:00Z');
export const addDays = (s: ISODate, n: number): ISODate => {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const dow = (s: ISODate) => parseDate(s).getUTCDay(); // 0 Sun … 6 Sat
export const isWeekday = (s: ISODate) => {
  const w = dow(s);
  return w >= 1 && w <= 5;
};
export const asWeekday = (s: ISODate): Weekday | null => (isWeekday(s) ? (dow(s) as Weekday) : null);
export const toMin = (hm: HM) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const toHM = (m: number): HM => {
  const mm = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
};
export const dt = (date: ISODate, hm: HM): DT => `${date}T${hm}`;
export const dtDate = (d: DT): ISODate => d.slice(0, 10);
export const dtTime = (d: DT): HM => d.slice(11, 16);
export const ym = (d: ISODate): YM => d.slice(0, 7);
export const monthStart = (m: YM): ISODate => `${m}-01`;
export const addMonths = (m: YM, n: number): YM => {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const daysInMonth = (m: YM) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
export const monthDays = (m: YM): ISODate[] => Array.from({ length: daysInMonth(m) }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
export const weekStart = (d: ISODate): ISODate => {
  const w = dow(d);
  return addDays(d, w === 0 ? -6 : 1 - w);
};
export const diffDays = (a: ISODate, b: ISODate) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
export const ageOn = (dob: ISODate, on: ISODate) => {
  const [y, m, d] = dob.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return y2 - y - (m2 < m || (m2 === m && d2 < d) ? 1 : 0);
};

/** Rp 5.500.000 (id-ID grouping, as in the design). */
export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
/** Digits with id-ID grouping for inputs: 5500000 -> '5.500.000'. */
export const fmtN = (v: string | number) => {
  const n = String(v).replace(/\D/g, '');
  return n ? (+n).toLocaleString('id-ID') : '';
};
export const parseN = (v: string) => +(String(v).replace(/\D/g, '') || 0);

/** mulberry32, identical to data.js `rng`. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const values = <T>(r: Record<string, T>) => Object.values(r);
export const live = <T extends { deletedAt?: string }>(r: Record<string, T>) => Object.values(r).filter((x) => !x.deletedAt);
export const byId = <T>(r: Record<string, T>, id: string | undefined | null) => (id ? r[id] : undefined);
export const sortBy = <T>(a: T[], key: (x: T) => string | number, dir: 1 | -1 = 1) =>
  a.slice().sort((x, y) => {
    const kx = key(x), ky = key(y);
    return kx < ky ? -dir : kx > ky ? dir : 0;
  });
export const uniq = <T>(a: T[]) => Array.from(new Set(a));
export const sum = (a: number[]) => a.reduce((t, x) => t + x, 0);

/** A WhatsApp chat link (wa.me) for a phone number: its digits, no "+". Empty when there is no number. */
export const waUrl = (phone: string | undefined | null) => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
};

/** Normalise a phone to E.164 digits with a + prefix. Local '0812…' and '812…' become +62812…. */
export const e164 = (raw: string, defaultCc = '62') => {
  const t = String(raw).trim();
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  if (t.startsWith('+')) return '+' + digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith(defaultCc) && digits.length > 10) return '+' + digits;
  return '+' + defaultCc + digits.replace(/^0/, '');
};
/** +6281210904471 -> '+62 812-1090-4471' (display, as in the seed data). */
export const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.startsWith('62')) {
    const r = d.slice(2);
    if (r.startsWith('21')) return `+62 21 ${r.slice(2, 6)} ${r.slice(6)}`;
    return `+62 ${r.slice(0, 3)}-${r.slice(3, 7)}-${r.slice(7)}`;
  }
  return '+' + d;
};

// ---------- the demo day ----------
const FIXED_HOLIDAYS = ['12-25', '01-01']; // the seed's national holidays
/** The demo day: a pinned date (tests), else today in Jakarta, moved to the next open club day on weekends and holidays. */
export function demoDateFor(now: Date, pinned?: string | null): ISODate {
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  let d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  for (let i = 0; i < 7 && (!isWeekday(d) || FIXED_HOLIDAYS.includes(d.slice(5))); i++) d = addDays(d, 1);
  return d;
}
/** The current time of day in Jakarta, in minutes (the demo clock follows real time). */
export function demoNowMinFor(now: Date): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).split(':').map(Number);
  return (h % 24) * 60 + m;
}
/** Whole days from a to b (b - a). */
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
