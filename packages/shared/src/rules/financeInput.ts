// Input validators for the finance and directory actions. Every one throws DomainError('err.invalid') on bad input.
import { DomainError } from '../actions/framework';

export const bad = (): never => {
  throw new DomainError('err.invalid');
};
export const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : bad());
/** Required text, trimmed, at most `max` characters. */
export const text = (v: unknown, max = 200): string => {
  if (typeof v !== 'string') return bad();
  const t = v.trim();
  return t && t.length <= max ? t : bad();
};
/** Optional text: undefined (or empty) stays undefined. */
export const optText = (v: unknown, max = 200): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return bad();
  const t = v.trim();
  if (!t) return undefined;
  return t.length <= max ? t : bad();
};
/** A positive whole-rupiah amount. */
export const rupiah = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad();
  const n = Math.round(v);
  return n > 0 && n <= 100_000_000_000 ? n : bad();
};
/** A whole-rupiah amount that may be zero (a weekly limit). */
export const rupiahOrZero = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad();
  const n = Math.round(v);
  return n >= 0 && n <= 100_000_000_000 ? n : bad();
};
/** A non-zero whole-rupiah amount: charge (+) or credit (−). */
export const signedRupiah = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad();
  const n = Math.round(v);
  return n !== 0 && Math.abs(n) <= 100_000_000_000 ? n : bad();
};
export const isoDate = (v: unknown): string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return bad();
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : bad();
};
export const yearMonth = (v: unknown): string => (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : bad());
export const oneOf = <T extends string>(v: unknown, list: readonly T[]): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : bad());
export const idList = (v: unknown): string[] => {
  if (!Array.isArray(v) || !v.length || v.length > 200) return bad();
  const ids = v.map((x) => (typeof x === 'string' && x ? x : bad()));
  return Array.from(new Set(ids));
};
/** The row id under any of the usual names (`id`, `requestId`, …): callers in other areas pick their own. */
export const pickId = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of ['id', ...keys]) if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  return bad();
};
export const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
