// Mood marks (round 12): one 1-5 face per moment of a visit (arrival, health check, each activity session, departure).
// A mark's id is its natural key, so marking again is an overwrite, never a second row.
import type { Draft } from 'immer';
import type { ClubState, Face, ISODate, MoodMark, MoodMoment, Slot } from '../types';
import type { Ctx } from '../actions/framework';
import { dow, live } from '../util';
import type { InsightPeriod } from './insights';
import { sessionsOn } from './kitchen';

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
  arc.activity.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));
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
  const perMoment: Record<MoodMoment, number[]> = { arrival: [], health: [], activity: [], departure: [] };
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
