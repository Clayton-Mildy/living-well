// Mood marks (round 12): one 1-5 face per moment of a visit (arrival, health check, each activity session, departure).
// Round 14: six moments (the activity team's Morning round and the kitchen's lunch round join them), each face with one fixed meaning (mood.hint.*),
// and the daily mood: the rounded average of a member's marks that day. A mark's id is its natural key, so marking again is an overwrite, never a second row.
import type { Draft } from 'immer';
import type { ClubState, Face, ISODate, MoodMark, MoodMoment, Slot, StaffRole } from '../types';
import type { Ctx } from '../actions/framework';
import { dow, live } from '../util';
import type { InsightPeriod } from './insights';
import { activeOn } from './core';
import { sessionsOn } from './kitchen';
import { attendedOn, logsOn } from './activity';
import { dailyMood, marksOn, moodId } from './moodCore';

export { dailyMood, marksOn, moodId };
import { attId } from './attendance';
import { validReadings } from './health';

/** Best face first, the order they are shown in. */
export const FACES: readonly Face[] = [5, 4, 3, 2, 1];
export const FACE_KEY: Record<Face, string> = { 5: 'mood.face.5', 4: 'mood.face.4', 3: 'mood.face.3', 2: 'mood.face.2', 1: 'mood.face.1' };
/** The moments of a visit in the order they happen (and are listed). */
export const MOOD_MOMENTS: readonly MoodMoment[] = ['arrival', 'health', 'morning', 'lunch', 'activity', 'departure'];
export const HINT_KEY: Record<Face, string> = { 5: 'mood.hint.5', 4: 'mood.hint.4', 3: 'mood.hint.3', 2: 'mood.hint.2', 1: 'mood.hint.1' };
const MOMENTS = MOOD_MOMENTS;

export interface DayArc { arrival?: Face; health?: Face; morning?: Face; lunch?: Face; activity: { slot: Slot; face: Face }[]; departure?: Face; lift: number | null }
/** The day's faces in order; `lift` is departure minus arrival, only when both were marked. */
export function dayArc(s: ClubState, memberId: string, date: ISODate): DayArc {
  const arc: DayArc = { activity: [], lift: null };
  for (const m of marksOn(s, memberId, date)) {
    if (m.moment === 'activity') arc.activity.push({ slot: m.slot ?? m.time, face: m.face });
    else arc[m.moment] = m.face;
  }
  arc.activity.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));
  if (arc.arrival !== undefined && arc.departure !== undefined) arc.lift = arc.departure - arc.arrival;
  return arc;
}

/** Faces still to mark on a date by a role, among the members checked in that day (`total` = the faces expected):
 *  lobby the arrival of everyone in and the departure of those gone home; nurse the health face of everyone with a reading;
 *  activity the morning face of everyone in and a face for each session they joined; kitchen the lunch face of everyone whose lunch is marked. */
export function missingMarks(s: ClubState, date: ISODate, role: StaffRole): { missing: number; total: number } {
  const people = attendedOn(s, date);
  const has = (memberId: string, moment: MoodMoment, slot?: Slot) => { const m = s.moodMarks?.[moodId(date, memberId, moment, slot)]; return !!m && !m.deletedAt; };
  let missing = 0, total = 0;
  const want = (ok: boolean) => { total++; if (!ok) missing++; };
  if (role === 'lobby') {
    for (const m of people) {
      want(has(m.id, 'arrival'));
      if (s.attendance[attId(date, m.id)]?.checkOut) want(has(m.id, 'departure'));
    }
  } else if (role === 'nurse') {
    const read = new Set(validReadings(s).filter((r) => r.date === date && r.memberId).map((r) => r.memberId));
    for (const m of people) if (read.has(m.id)) want(has(m.id, 'health'));
  } else if (role === 'activity') {
    const logs = logsOn(s, date);
    for (const m of people) {
      want(has(m.id, 'morning'));
      for (const [slot, v] of Object.entries(logs.get(m.id)?.sessions ?? {})) if (v === 'joined') want(has(m.id, 'activity', slot));
    }
  } else if (role === 'kitchen') {
    const logs = logsOn(s, date);
    for (const m of people) if (logs.get(m.id)?.lunch !== undefined) want(has(m.id, 'lunch'));
  }
  return { missing, total };
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

export interface MoodInsights {
  byActivity: { activityId: string; avg: number; n: number }[];
  /** Mon … Fri: the average face of the day's marks, null when none */
  byWeekday: (number | null)[];
  byMoment: Record<MoodMoment, number | null>;
  /** average departure minus arrival over visits with both marked */
  lift: number | null;
  /** members whose last three visits (days with an arrival mark) have strictly falling arrival faces, oldest first */
  drops: { memberId: string; faces: Face[] }[];
}

/** Mood over a period: which activities and weekdays lift it, the arrival-to-departure lift, and members whose arrival mood keeps falling. */
export function moodInsights(s: ClubState, period: InsightPeriod, today: ISODate): MoodInsights {
  const to = period.to < today ? period.to : today;
  const marks = live(s.moodMarks ?? {}).filter((m) => m.date >= period.from && m.date <= to);
  const cells = new Map<ISODate, Map<string, string | undefined>>();
  const activityAt = (date: ISODate, slot: string) => {
    let day = cells.get(date);
    if (!day) { day = new Map(sessionsOn(s, date).map((x) => [x.slot, x.cell?.activityId])); cells.set(date, day); }
    return day.get(slot);
  };
  const perActivity = new Map<string, number[]>();
  const perWeekday: number[][] = [[], [], [], [], []];
  const perMoment = Object.fromEntries(MOMENTS.map((k) => [k, []])) as unknown as Record<MoodMoment, number[]>;
  const arrivals = new Map<string, Face>();
  for (const m of marks) {
    perMoment[m.moment].push(m.face);
    const w = dow(m.date);
    if (w >= 1 && w <= 5) perWeekday[w - 1].push(m.face);
    if (m.moment === 'arrival') arrivals.set(`${m.date}:${m.memberId}`, m.face);
    if (m.moment === 'activity') {
      const id = activityAt(m.date, m.slot ?? m.time);
      if (id) perActivity.set(id, [...(perActivity.get(id) ?? []), m.face]);
    }
  }
  const lifts: number[] = [];
  for (const m of marks) {
    const a = m.moment === 'departure' ? arrivals.get(`${m.date}:${m.memberId}`) : undefined;
    if (a !== undefined) lifts.push(m.face - a);
  }
  const byActivity = [...perActivity.entries()]
    .filter(([, f]) => f.length >= 3)
    .map(([activityId, f]) => ({ activityId, avg: avg1(f) as number, n: f.length }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n || (a.activityId < b.activityId ? -1 : 1));
  const visits = new Map<string, { date: ISODate; face: Face }[]>();
  for (const m of marks) if (m.moment === 'arrival') visits.set(m.memberId, [...(visits.get(m.memberId) ?? []), { date: m.date, face: m.face }]);
  const drops: MoodInsights['drops'] = [];
  for (const [memberId, v] of visits) {
    const m = s.members[memberId];
    if (!m || !activeOn(m, today)) continue;
    const last = v.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3).map((x) => x.face);
    if (last.length === 3 && last[0] > last[1] && last[1] > last[2]) drops.push({ memberId, faces: last });
  }
  drops.sort((a, b) => a.faces[2] - b.faces[2] || (a.memberId < b.memberId ? -1 : 1));
  return {
    byActivity,
    byWeekday: perWeekday.map(avg1),
    byMoment: Object.fromEntries(MOMENTS.map((k) => [k, avg1(perMoment[k])])) as MoodInsights['byMoment'],
    lift: avg1(lifts),
    drops,
  };
}
