// Family Today (round 8): small pure helpers for the day strip, the day's progress, the list's label and the notification titles.
// Everything reads family-visible data only (it builds on the selectors in rules/family).
import type { ClubState, DailyLog, HM, ISODate } from '../types';
import { nextOpenDay } from './core';
import { bestPhotoOf, familyPhotosOn, visitDays, type DayStory, type LunchAmount, type StripDay, type TlItem, type TlState } from './family';

/**
 * The day strip: today and the last days one of `who` came before it, `n` days in all (today always shows, even on a closed day or a day they stayed home, so
 * "today" is always there), plus the day being read when it is older than that. Oldest first. Each day carries its best picture and photo count; `visited` is
 * true when any of `who` checked in. KC round 10 ("only show the days the member is active on"): a day the club was open but nobody came is left out.
 */
/** `withPlan` (KC round 9): the next open day after today goes last, so families can look at tomorrow's plan (marked `plan`). */
export function openDayStrip(s: ClubState, who: string[], today: ISODate, selected?: ISODate, n = 6, withPlan = false): StripDay[] {
  const visits = new Set<ISODate>();
  for (const id of who) for (const d of visitDays(s, id, today)) visits.add(d);
  const dates = new Set<ISODate>([today]);
  for (const d of Array.from(visits).filter((x) => x < today).sort().reverse()) { if (dates.size >= n) break; dates.add(d); }
  if (selected && selected <= today) dates.add(selected);
  const out: StripDay[] = Array.from(dates).sort().map((date) => ({ date, visited: visits.has(date), photo: bestPhotoOf(s, who, date), count: familyPhotosOn(s, who, date).length }));
  if (withPlan) out.push({ date: planDay(s, today), visited: false, photo: null, count: 0, plan: true });
  return out;
}
/** KC round 9: the day the family can look ahead to — the next open club day after today (tomorrow on a weekday, Monday after a Friday). */
export const planDay = (s: ClubState, today: ISODate): ISODate => nextOpenDay(s, today);

/**
 * How far the day has got along its steps, 0 to 1: up to the step happening now, else up to the last one that is done (every step done is 1).
 * Drives the line on the hero's icon rail and the thin bar under a parent's row.
 */
export function railFill(states: TlState[]): number {
  if (!states.length) return 0;
  let at = states.indexOf('now');
  if (at < 0) at = states.lastIndexOf('done');
  if (at < 0) return 0;
  return states.length === 1 ? 1 : at / (states.length - 1);
}

export type ListKind = 'next' | 'today' | 'thatDay' | 'wasOn' | 'plan';
/**
 * What the day's list is called: "Next" while something is still to come today, "Today" once a visit is over, "That day" for an earlier day the member came,
 * "What was on" for a day they did not come.
 */
export function listKind(isToday: boolean, visited: boolean, items: Pick<TlItem, 'state'>[], future = false): ListKind {
  if (future) return 'plan'; // KC round 9: the day ahead — the plan
  if (isToday && items.some((i) => i.state !== 'done')) return 'next';
  if (!visited) return 'wasOn';
  return isToday ? 'today' : 'thatDay';
}

/** The steps the list shows: what is still to come under "Next", else the whole day without the arrival (the hero already says when). */
export function listItems(kind: ListKind, items: TlItem[]): TlItem[] {
  return kind === 'next' ? items.filter((i) => i.state !== 'done') : items.filter((i) => i.kind !== 'arrival');
}

// ---------- the daily log on Today (round 8b; round 8d: every round, in one order) ----------
export type MoodKey = NonNullable<DailyLog['mood']>;
/** One activity session of the day and how the member took part in it, from the approved log (null = not marked yet). */
export interface DigestSession { id: string; time: HM; activityId: string; took: 'joined' | 'satOut' | null }
/**
 * One day's approved log boiled down for Today's "Daily log", round by round: how much lunch was eaten, EACH session of the day with its mark, the mood, and the
 * log itself when the team wrote a note (null = that round has no approved entry yet). `joined` / `satOut` are the activity ids of the marked sessions (session
 * order, each once). Read from a `DayStory`, so a family only ever sees what is approved. `any` is true when at least one round has something.
 */
export interface DayDigest { lunch: LunchAmount | null; sessions: DigestSession[]; joined: string[]; satOut: string[]; mood: MoodKey | null; note: DailyLog | null; any: boolean }
export function dayDigest(story: DayStory): DayDigest {
  const log = story.log;
  const sessions: DigestSession[] = story.sessions.map((x) => ({ id: x.id, time: x.time, activityId: x.activityId, took: x.took }));
  const joined: string[] = [];
  const satOut: string[] = [];
  for (const x of sessions) {
    const into = x.took === 'joined' ? joined : x.took === 'satOut' ? satOut : null;
    if (into && !into.includes(x.activityId)) into.push(x.activityId);
  }
  const mood = log?.mood ?? null;
  const lunch = story.lunch?.amount ?? null;
  const note = log?.note ? log : null;
  return { lunch, sessions, joined, satOut, mood, note, any: !!(mood || lunch || joined.length || satOut.length || note) };
}

export type LogBlock =
  /** a parent who came: every round (lunch, each session, mood, the team's note), the ones with nothing yet marked as not logged */
  | { kind: 'day'; memberId: string; digest: DayDigest }
  /** today, the member has not come yet: the newest note the team wrote, from an earlier day */
  | { kind: 'older'; memberId: string; log: DailyLog };
/**
 * What the "Daily log" shows, one block per parent. A parent who came (or has anything logged) gets all the rounds in the same order: Lunch, Activities, Mood, Note,
 * and a round nobody has approved yet reads as not logged. Today before the member arrives falls back to `older[i]`, the newest written note; a day a parent did not
 * come has no block, so a day nobody came has no section. `stories[i]` and `older[i]` belong to the same member.
 */
export function dailyLogBlocks(stories: DayStory[], isToday: boolean, older: (DailyLog | undefined)[] = []): LogBlock[] {
  const out: LogBlock[] = [];
  stories.forEach((st, i) => {
    const digest = dayDigest(st);
    if (st.visited || digest.any) out.push({ kind: 'day', memberId: st.memberId, digest });
    else if (isToday && older[i]?.note) out.push({ kind: 'older', memberId: st.memberId, log: older[i]! });
  });
  return out;
}

export type NoticeKind = 'arrived' | 'home' | 'photos' | 'note' | 'health' | 'billing' | 'survey' | 'document' | 'kitchen' | 'calendar' | 'plan' | 'club';
/** Which kind of news a notification is, for the family sheet's title and icon (the text itself comes from the notification's own key). */
export function noticeKind(kind: string): NoticeKind {
  if (/checkedIn/.test(kind)) return 'arrived';
  if (/checkedOut/.test(kind)) return 'home';
  if (/newPhoto|newVideo|newMedia|lunchPhoto|photosReview/.test(kind)) return 'photos';
  if (/logSaved|logUpdated/.test(kind)) return 'note';
  if (/^health\./.test(kind)) return 'health';
  if (/invoice|^finance\.|paymentReceived|extraVisit/i.test(kind)) return 'billing';
  if (/survey/.test(kind)) return 'survey';
  if (/docRequested/.test(kind)) return 'document';
  if (/^kitchen\./.test(kind)) return 'kitchen';
  if (/^cal\./.test(kind)) return 'calendar';
  if (/plan|leave|renewals\./i.test(kind)) return 'plan';
  return 'club';
}
