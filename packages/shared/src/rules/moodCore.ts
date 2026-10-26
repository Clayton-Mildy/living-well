// Mood marks, the pieces with no other rule behind them (round 14): the mark id, a member's marks of a day and the daily mood.
// They live apart from rules/mood.ts so rules/activity.ts can use them (rules/mood.ts imports rules/activity.ts); rules/mood.ts re-exports them.
import type { ClubState, Face, ISODate, MoodMark, MoodMoment, Slot } from '../types';
import { live } from '../util';

export const moodId = (date: ISODate, memberId: string, moment: MoodMoment, slot?: Slot) =>
  moment === 'activity' && slot ? `${date}:${memberId}:activity:${slot}` : `${date}:${memberId}:${moment}`;

/** A member's live marks for a date, earliest first. */
export function marksOn(s: ClubState, memberId: string, date: ISODate): MoodMark[] {
  return live(s.moodMarks ?? {})
    .filter((m) => m.memberId === memberId && m.date === date)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The day's mood of one member: the rounded average of that member's marks on that date (never other days or other members), with the marks.
 *  null when nobody marked a face that day (an old log's mood word does not count). */
export function dailyMood(s: ClubState, memberId: string, date: ISODate): { face: Face; marks: MoodMark[] } | null {
  const marks = marksOn(s, memberId, date);
  return marks.length ? { face: meanFace(marks), marks } : null;
}
/** The rounded average face of some marks (one member's marks of one day make the daily mood). */
export const meanFace = (marks: Pick<MoodMark, 'face'>[]): Face => Math.round(marks.reduce((a, m) => a + m.face, 0) / marks.length) as Face;
