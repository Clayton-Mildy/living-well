// Small shared pieces of the family day story and the monthly memories: mood colours, day wording, names, how much was eaten.
import type { ClubState, DailyLog, ISODate, Member } from '@cp/shared';
import { daysBetween, displayName } from '@cp/shared';
import type { TlItem } from '@cp/shared/rules/family';
import type { TFn } from '../../lib/i18n';

export type Mood = NonNullable<DailyLog['mood']>;
export const MOODS: Mood[] = ['cheerful', 'calm', 'quiet', 'agitated'];
/** Soft, warm colours from the brand's palette (sage for cheerful, never an alarming red for an unsettled day). */
export const MOOD_COLOR: Record<Mood, string> = { cheerful: '#3D6B4F', calm: '#9DB8A5', quiet: '#CDBFA9', agitated: '#C98C6B' };
export const MOOD_INK: Record<Mood, string> = { cheerful: '#FFFFFF', calm: '#24201C', quiet: '#24201C', agitated: '#24201C' };

type Fmt = { fd: (d: string, o: Intl.DateTimeFormatOptions) => string };

/** How much was eaten, as one kind line ("Finished all of lunch"). */
export const lunchWords = (t: TFn, amount: string) => t('family.storyAte_' + amount);

/** "Tuesday" within the last week, else "Tuesday 6 Oct". */
export function dayWord(fmt: Fmt, date: ISODate, today: ISODate): string {
  return daysBetween(date, today) < 7 ? fmt.fd(date, { weekday: 'long' }) : fmt.fd(date, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, '');
}

/** The hero's title (KC, round 8): "Today with Oma Lina", "Yesterday with …", "Oma Lina’s Tuesday", "Tuesday 6 Oct with Oma Lina". */
export function dayTitle(t: TFn, fmt: Fmt, names: string, date: ISODate, today: ISODate): string {
  if (date === today) return t('family.storyTitleToday', { n: names });
  const gap = daysBetween(date, today);
  if (gap === 1) return t('family.storyTitleYesterday', { n: names });
  return t(gap < 7 ? 'family.storyTitleWeek' : 'family.storyTitleOld', { n: names, d: dayWord(fmt, date, today) });
}

/** "Oma Lina", "Oma Lina and Opa Budi", "Oma Lina, Opa Budi and Opa Tan". */
export function namesOf(t: TFn, members: Member[]): string {
  const names = members.map(displayName);
  if (names.length < 2) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1]}`;
}

/** A Material icon for a step of the day (the dots on the hero's rail and on the list's timeline): the activity's own icon for a session. */
const STEP_ICON: Record<string, string> = { arrival: 'how_to_reg', health: 'monitor_heart', outing: 'directions_bus', lunch: 'restaurant', tea: 'local_cafe', home: 'home' };
export const stepIcon = (s: ClubState, it: TlItem): string => (it.kind === 'session' ? s.activities[it.activityId]?.icon || 'interests' : STEP_ICON[it.kind] || 'circle');

/** "Oma", "Oma and Opa", "A, B and C" ; past `max` names the rest are counted ("A, B, C +2"). */
export function listNames(t: TFn, names: string[], max = 3): string {
  if (names.length <= 1) return names[0] || '';
  if (names.length > max) return `${names.slice(0, max).join(', ')} +${names.length - max}`;
  return `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1]}`;
}

/** First letter up (a quiet line that starts a sentence: "Last visit Monday"). */
export const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
