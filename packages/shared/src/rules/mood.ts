// Mood marks (round 12): one 1-5 face per moment of a visit (arrival, health check, each activity session, departure).
// A mark's id is its natural key, so marking again is an overwrite, never a second row.
import type { Draft } from 'immer';
import type { ClubState, Face, ISODate, MoodMark, MoodMoment, Slot } from '../types';
import type { Ctx } from '../actions/framework';
import { live } from '../util';

/** Best face first, the order they are shown in. */
export const FACES: readonly Face[] = [5, 4, 3, 2, 1];
export const FACE_KEY: Record<Face, string> = { 5: 'mood.face.5', 4: 'mood.face.4', 3: 'mood.face.3', 2: 'mood.face.2', 1: 'mood.face.1' };
const MOMENTS: MoodMoment[] = ['arrival', 'health', 'activity', 'departure'];

export const moodId = (date: ISODate, memberId: string, moment: MoodMoment, slot?: Slot) =>
  moment === 'activity' && slot ? `${date}:${memberId}:activity:${slot}` : `${date}:${memberId}:${moment}`;

/** A member's live marks for a date, earliest first. */
export function marksOn(s: ClubState, memberId: string, date: ISODate): MoodMark[] {
  return live(s.moodMarks ?? {})
    .filter((m) => m.memberId === memberId && m.date === date)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface DayArc { arrival?: Face; health?: Face; activity: { slot: Slot; face: Face }[]; departure?: Face; lift: number | null }
/** The day's faces in order; `lift` is departure minus arrival, only when both were marked. */
export function dayArc(s: ClubState, memberId: string, date: ISODate): DayArc {
  const arc: DayArc = { activity: [], lift: null };
  for (const m of marksOn(s, memberId, date)) {
    if (m.moment === 'activity') arc.activity.push({ slot: m.slot ?? m.time, face: m.face });
    else arc[m.moment] = m.face;
  }
  if (arc.arrival !== undefined && arc.departure !== undefined) arc.lift = arc.departure - arc.arrival;
  return arc;
}

export interface MoodStats {
  index: number | null;
  n: number;
  byMoment: Record<MoodMoment, { avg: number | null; n: number }>;
  lift: number | null;
  liftN: number;
  notMarkedAtDoor: number;
}
const avg1 = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Mood over a set of dates: the average face, per moment, the average arrival-to-departure lift, and visits nobody marked at the door. */
export function moodStats(s: ClubState, dates: ISODate[]): MoodStats {
  const set = new Set(dates);
  const marks = live(s.moodMarks ?? {}).filter((m) => set.has(m.date));
  const byMoment = Object.fromEntries(MOMENTS.map((k) => {
    const f = marks.filter((m) => m.moment === k).map((m) => m.face);
    return [k, { avg: avg1(f), n: f.length }];
  })) as MoodStats['byMoment'];
  const arrivals = new Map(marks.filter((m) => m.moment === 'arrival').map((m) => [`${m.date}:${m.memberId}`, m.face]));
  const lifts: number[] = [];
  for (const m of marks) {
    const a = m.moment === 'departure' ? arrivals.get(`${m.date}:${m.memberId}`) : undefined;
    if (a !== undefined) lifts.push(m.face - a);
  }
  let notMarkedAtDoor = 0;
  for (const a of Object.values(s.attendance)) {
    if (a.deletedAt || !set.has(a.date) || !a.checkIn) continue;
    if (!arrivals.has(`${a.date}:${a.memberId}`)) notMarkedAtDoor++;
  }
  return { index: avg1(marks.map((m) => m.face)), n: marks.length, byMoment, lift: avg1(lifts), liftN: lifts.length, notMarkedAtDoor };
}

/** Upsert a mark for the day (ctx.today): same key, so the row id is the mood id; creation stamps are kept, time/by/face follow the latest. */
export function writeMark(d: Draft<ClubState>, ctx: Ctx, m: { memberId: string; moment: MoodMoment; face: Face; slot?: Slot; readingId?: string }): MoodMark {
  const id = moodId(ctx.today, m.memberId, m.moment, m.slot);
  const old = d.moodMarks[id];
  const row: MoodMark = {
    id, clubId: ctx.clubId, createdAt: old && !old.deletedAt ? old.createdAt : ctx.nowDT, createdBy: old && !old.deletedAt ? old.createdBy : ctx.actor,
    memberId: m.memberId, date: ctx.today, time: ctx.now, moment: m.moment, face: m.face, by: ctx.actor,
    ...(m.moment === 'activity' && m.slot ? { slot: m.slot } : {}), ...(m.readingId ? { readingId: m.readingId } : {}),
  };
  d.moodMarks[id] = row;
  return row;
}

export function clearMark(d: Draft<ClubState>, date: ISODate, memberId: string, moment: MoodMoment, slot?: Slot): void {
  delete d.moodMarks[moodId(date, memberId, moment, slot)];
}
