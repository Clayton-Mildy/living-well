// Text for the occasions of the week (round 12): "Opa Budi turns 80 on Friday", "Oma Hana: 1 year with the club on Friday". Shared by Arrivals, the family's Today and the profile.
import type { Occasion } from '@cp/shared/rules/occasions';
import type { ISODate, Lang } from '@cp/shared';
import { diffDays } from '@cp/shared';
import { fd, type TFn } from './i18n';

/** The weekday of a date in the reader's language ("Friday" / "Jumat"); "today" is the caller's job (the line keys have a today form). */
export const weekdayOf = (lang: Lang, date: ISODate) => fd(lang, date, { weekday: 'long' });

/** One line for an occasion. `name` is how the reader calls the member (staff: listName, family: displayName). */
export function occasionLine(t: TFn, lang: Lang, o: Occasion, today: ISODate, name: string): string {
  const now = o.date === today;
  // a week or more ahead (the two-week list) a weekday alone would be ambiguous: "Mon 2 Nov"
  const far = diffDays(today, o.date) >= 7;
  const vars = { name, n: o.years, day: now ? '' : far ? fd(lang, o.date, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '') : weekdayOf(lang, o.date) };
  if (o.kind === 'birthday') return t(now ? 'occasions.turnsToday' : 'occasions.turns', vars);
  return t(`occasions.${o.years === 1 ? 'years1' : 'yearsN'}${now ? 'Today' : ''}`, vars);
}
/** "birthday Friday" / "birthday today" for the profile hero. */
export const birthdayHint = (t: TFn, lang: Lang, date: ISODate, today: ISODate) =>
  date === today ? t('occasions.heroBirthdayToday') : t('occasions.heroBirthday', { day: weekdayOf(lang, date) });
