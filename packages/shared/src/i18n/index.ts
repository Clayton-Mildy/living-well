// i18n: flat dotted keys ('lobby.checkIn'). EN is the source of truth; ID must have the same keys (type-checked).
import type { Lang } from '../types';
import { en } from './en';
import { id } from './id';

export type Key = keyof typeof en;
export const DICT: Record<Lang, Record<string, string>> = { en, id };

export function format(s: string, vars?: Record<string, string | number | undefined | null>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}
/** Translate a key (falls back to English, then to the key itself). */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number | undefined | null>) {
  const s = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  return format(s, vars);
}
export const hasKey = (key: string) => key in DICT.en;
export { en, id };
