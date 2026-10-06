// Input parsing helpers shared by the management, enquiries and people action modules.
// They throw DomainError('err.invalid') (or a specific code) so the same checks run in the browser (optimistic) and on the server.
import { DomainError } from '../actions/framework';
import type { HM, ISODate } from '../types';
import { e164, parseDate } from '../util';

export const bad = (field?: string, code = 'err.invalid'): never => {
  throw new DomainError(code, field ? { field } : {});
};
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const obj = (v: unknown, field?: string): Record<string, unknown> => (isObj(v) ? v : bad(field));

/** Trimmed string up to `max` characters. Missing values become ''. */
export function str(v: unknown, max = 200, o: { required?: boolean; field?: string } = {}): string {
  if (v === undefined || v === null) {
    if (o.required) bad(o.field);
    return '';
  }
  if (typeof v !== 'string' && typeof v !== 'number') return bad(o.field);
  const s = String(v).trim();
  if (o.required && !s) bad(o.field);
  return s.length > max ? s.slice(0, max) : s;
}
export function oneOf<T extends string>(v: unknown, list: readonly T[], field?: string): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : bad(field);
}
export function int(v: unknown, min: number, max: number, field?: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return bad(field);
  return n;
}
export function num(v: unknown, min: number, max: number, field?: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) return bad(field);
  return n;
}
export const bool = (v: unknown) => v === true;
export function isoDate(v: unknown, field?: string): ISODate {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return bad(field);
  const d = parseDate(v);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? bad(field) : v;
}
export function hm(v: unknown, field?: string): HM {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return bad(field);
  return v;
}
/** Phone normalised to E.164; at least 8 digits. */
export function phone(v: unknown, field = 'phone', required = true): string {
  const raw = str(v, 40);
  if (!raw) return required ? bad(field) : '';
  const p = e164(raw);
  return p.replace(/\D/g, '').length >= 8 ? p : bad(field);
}
export function arr<T>(v: unknown, map: (x: unknown) => T, max = 50): T[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return bad();
  return v.slice(0, max).map(map);
}
export const uniq = <T>(a: T[]) => Array.from(new Set(a));

/** Next numbered id for a collection ('e' -> e10 when e1..e9 exist). Deterministic from the state. */
export function nextNumId(rows: Record<string, unknown>, prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const k of Object.keys(rows)) {
    const m = re.exec(k);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}
/** '2026-10-23' -> '23/10' (language-neutral date for stored notification params). */
export const dm = (d: ISODate) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

/** Small deterministic hash (FNV-1a, 32 bit) as 8 hex characters; used for form link tokens. */
export function hash8(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
