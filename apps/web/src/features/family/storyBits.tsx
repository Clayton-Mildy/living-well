// Small shared pieces of the family "day story" and the monthly memories (KC round 7): mood colours and words, day wording, titles.
import type { DailyLog, ISODate, Member } from '@cp/shared';
import { daysBetween, memberShort } from '@cp/shared';
import type { DayStory } from '@cp/shared/rules/family';
import type { TFn } from '../../lib/i18n';

export type Mood = NonNullable<DailyLog['mood']>;
export const MOODS: Mood[] = ['cheerful', 'calm', 'quiet', 'agitated'];
/** Soft, warm colours from the brand's palette (sage for cheerful, never an alarming red for an unsettled day). */
export const MOOD_COLOR: Record<Mood, string> = { cheerful: '#3D6B4F', calm: '#9DB8A5', quiet: '#CDBFA9', agitated: '#C98C6B' };
export const MOOD_INK: Record<Mood, string> = { cheerful: '#FFFFFF', calm: '#24201C', quiet: '#24201C', agitated: '#24201C' };

type Fmt = { fd: (d: string, o: Intl.DateTimeFormatOptions) => string };

/** The mood in warm words ("Cheerful and chatty today"). */
export const moodWords = (t: TFn, mood: Mood, isToday: boolean) => {
  const w = t('family.storyMood_' + mood);
  return isToday ? t('family.storyMoodToday', { m: w }) : w;
};
/** How much was eaten, as one kind line ("Finished all of lunch"). */
export const lunchWords = (t: TFn, amount: string) => t('family.storyAte_' + amount);

/** "Tuesday" within the last week, else "Tuesday 6 Oct". */
export function dayWord(fmt: Fmt, date: ISODate, today: ISODate): string {
  return daysBetween(date, today) < 7 ? fmt.fd(date, { weekday: 'long' }) : fmt.fd(date, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, '');
}

/** "Oma Lina", "Oma Lina and Opa Budi", "Oma Lina, Opa Budi and Opa Tan". */
export function namesOf(t: TFn, members: Member[]): string {
  const names = members.map(memberShort);
  if (names.length < 2) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1]}`;
}

/** "Today with Oma Lina", "Yesterday with …", "Oma Lina’s Tuesday", "Tuesday 6 Oct with Oma Lina". */
export function dayTitle(t: TFn, fmt: Fmt, names: string, date: ISODate, today: ISODate): string {
  if (date === today) return t('family.storyTitleToday', { n: names });
  const gap = daysBetween(date, today);
  if (gap === 1) return t('family.storyTitleYesterday', { n: names });
  return t(gap < 7 ? 'family.storyTitleWeek' : 'family.storyTitleOld', { n: names, d: dayWord(fmt, date, today) });
}

/** The hero's title: the day's name, or, on an earlier day the member did not come or the club was closed, a gentle sentence about that. */
export function storyTitle(t: TFn, fmt: Fmt, names: string, story: Pick<DayStory, 'date' | 'state'>, today: ISODate, single: boolean): string {
  if (story.date < today && single) {
    if (story.state.kind === 'away') return t('family.storyDidntCome', { n: names, d: dayWord(fmt, story.date, today) });
    if (story.state.kind === 'closed') return t('family.storyClosedOn', { d: dayWord(fmt, story.date, today) });
  }
  return dayTitle(t, fmt, names, story.date, today);
}

/** An icon-less bronze text link that is a button (a quiet "see that day"). */
export const quietLink = { border: 'none', background: 'transparent', padding: '0 2px', minHeight: 40, color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter' } as const;
