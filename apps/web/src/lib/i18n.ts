// useT(): translate dotted keys in the current language; date helpers matching the design (en-GB / id-ID, UTC).
import { useCallback } from 'react';
import { translate, type Lang } from '@cp/shared';
import { useSession } from '../store/session';

type Vars = Record<string, string | number | undefined | null>;
export type TFn = (key: string, vars?: Vars) => string;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
/** Stored params keep ISO dates ('2026-10-27', '2026-11'); show them as 'Tue 27 Oct' / 'November 2026' in the reader's language. */
function readableDates(lang: Lang, vars?: Vars): Vars | undefined {
  if (!vars) return vars;
  let out: Vars | undefined;
  for (const k of Object.keys(vars)) {
    const v = vars[k];
    if (typeof v !== 'string' || !(ISO_DAY.test(v) || ISO_MONTH.test(v))) continue;
    out ??= { ...vars };
    out[k] = ISO_DAY.test(v) ? fds(lang, v) : fmonth(lang, v, true);
  }
  return out || vars;
}
export function useT(): TFn {
  const lang = useSession((s) => s.lang);
  return useCallback<TFn>((key, vars) => translate(lang, key, readableDates(lang, vars)), [lang]);
}
export const useLang = () => useSession((s) => s.lang);

const loc = (lang: Lang) => (lang === 'id' ? 'id-ID' : 'en-GB');
export const fd = (lang: Lang, d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00Z').toLocaleDateString(loc(lang), { timeZone: 'UTC', ...o });
/** "Wednesday 21 October" */
export const fdl = (lang: Lang, d: string) => fd(lang, d, { weekday: 'long', day: 'numeric', month: 'long' });
/** "Wed 21 Oct" */
export const fds = (lang: Lang, d: string) => fd(lang, d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
/** "21 October 2026" */
export const fdy = (lang: Lang, d: string) => fd(lang, d, { day: 'numeric', month: 'long', year: 'numeric' });
/** "October" / "October 2026" */
export const fmonth = (lang: Lang, ym: string, year = false) => fd(lang, ym + '-01', year ? { month: 'long', year: 'numeric' } : { month: 'long' });
export function useFmt() {
  const lang = useLang();
  return { lang, fdl: (d: string) => fdl(lang, d), fds: (d: string) => fds(lang, d), fdy: (d: string) => fdy(lang, d), fmonth: (m: string, y = false) => fmonth(lang, m, y), fd: (d: string, o: Intl.DateTimeFormatOptions) => fd(lang, d, o) };
}
