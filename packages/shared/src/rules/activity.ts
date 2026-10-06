// Activity area selectors: the day's plan and Now/Next, camera context and face opt-out, daily-log helpers, photo library.
// Pure functions over ClubState; no clock reads (callers pass `date` and `nowMin`).
import type { Activity, CalendarEvent, ClubState, DailyLog, DT, HM, ISODate, Lang, Member, Message, Photo, Room, ScheduleCell, Slot, Staff } from '../types';
import { dayStatus, isPendingRow, memberName } from './core';
import { lobbyGroups, attId } from './attendance';
import { sessionsOn } from './kitchen';
import { addDays, live, sortBy, toMin } from '../util';

/** Length of one activity session; a session is "Now" from its start until start + SESSION_MIN. */
export const SESSION_MIN = 75;
/** Daily logs can be written for today and this many days back. */
export const LOG_BACK_DAYS = 7;
/** The fixed rows of every club day (lunch and tea are not part of the editable schedule). */
export const FIXED_SLOTS: { kind: 'lunch' | 'tea'; time: HM; roomId: string }[] = [
  { kind: 'lunch', time: '12:00', roomId: 'room-dining' },
  { kind: 'tea', time: '15:00', roomId: 'room-lounge' },
];
/** Stored activity text when a photo is taken outside any session. */
export const GENERAL_ACTIVITY = 'Club activities';

// ---------- names (nameId in Indonesian mode when present) ----------
export const activityName = (a: Pick<Activity, 'name' | 'nameId'> | undefined, lang: Lang) => (a ? (lang === 'id' && a.nameId ? a.nameId : a.name) : '');
export const roomName = (r: Pick<Room, 'name' | 'nameId'> | undefined, lang: Lang) => (r ? (lang === 'id' && r.nameId ? r.nameId : r.name) : '');

// ---------- today's plan, Now / Next ----------
export interface SessionItem { kind: 'session'; time: HM; slot: Slot; cell: ScheduleCell; activity?: Activity; room?: Room; staff?: Staff }
export interface FixedItem { kind: 'lunch' | 'tea'; time: HM; room?: Room }
export type PlanItem = SessionItem | FixedItem;

/** The day's plan: scheduled sessions (empty slots are skipped) plus lunch and tea. Empty on closed days, weekends and outings. */
export function dayPlan(s: ClubState, date: ISODate): PlanItem[] {
  const st = dayStatus(s, date);
  if (!st.open || st.outing) return [];
  const items: PlanItem[] = [];
  for (const x of sessionsOn(s, date)) {
    if (!x.cell) continue;
    items.push({ kind: 'session', time: x.slot, slot: x.slot, cell: x.cell, activity: s.activities[x.cell.activityId], room: s.rooms[x.cell.roomId], staff: s.staff[x.cell.staffId] });
  }
  for (const f of FIXED_SLOTS) items.push({ kind: f.kind, time: f.time, room: s.rooms[f.roomId] });
  return sortBy(items, (x) => x.time);
}

export interface NowNext {
  /** now: a session is running; next: the next session has not started; done: all sessions are over; none: nothing scheduled. */
  phase: 'now' | 'next' | 'done' | 'none';
  /** The running or next session (the hero card). */
  current?: SessionItem;
  /** Items still to come (start after now), without the hero session. */
  later: PlanItem[];
}
export function nowNext(s: ClubState, date: ISODate, nowMin: number): NowNext {
  const plan = dayPlan(s, date);
  const sessions = plan.filter((x): x is SessionItem => x.kind === 'session');
  const current = sessions.find((x) => toMin(x.time) + SESSION_MIN > nowMin);
  const phase: NowNext['phase'] = !sessions.length ? 'none' : !current ? 'done' : nowMin >= toMin(current.time) ? 'now' : 'next';
  return { phase, current, later: plan.filter((x) => x !== current && toMin(x.time) > nowMin) };
}

export interface CurAct {
  kind: 'session' | 'outing' | 'general';
  phase?: NowNext['phase'];
  session?: SessionItem;
  outing?: CalendarEvent;
  /** English name stored on photos (`Photo.activity`). */
  name: string;
}
/** What the camera tags photos with: the running or next session, else the last one of the day, else the outing, else general. */
export function curAct(s: ClubState, date: ISODate, nowMin: number): CurAct {
  const st = dayStatus(s, date);
  if (st.open && st.outing) return { kind: 'outing', outing: st.outing, name: st.outing.title };
  const plan = dayPlan(s, date);
  const sessions = plan.filter((x): x is SessionItem => x.kind === 'session');
  const nn = nowNext(s, date, nowMin);
  const session = nn.current ?? sessions[sessions.length - 1];
  if (session) return { kind: 'session', phase: nn.phase, session, name: session.activity?.name ?? GENERAL_ACTIVITY };
  return { kind: 'general', name: GENERAL_ACTIVITY };
}

// ---------- faces ----------
/** The member's latest face-recognition consent (null when none is recorded). */
export function faceConsent(m: Member): boolean | null {
  const cs = sortBy(m.consents.filter((c) => c.kind === 'face'), (c) => c.at);
  return cs.length ? cs[cs.length - 1].granted : null;
}
export const faceOptedOut = (m: Member) => faceConsent(m) === false;
/** How a member may be tagged by face: on, opted out, or not enrolled. Opted-out members are still taggable by name. */
export const faceTagging = (m: Member): 'on' | 'optOut' | 'notEnrolled' => (faceOptedOut(m) ? 'optOut' : m.face.enrolled === false ? 'notEnrolled' : 'on');
export const faceSuggestable = (m: Member) => faceTagging(m) === 'on';

/** Members in the club right now (checked in, not yet out), by first name. */
export function inClubMembers(s: ClubState, date: ISODate): Member[] {
  return sortBy(lobbyGroups(s, date).inClub.map((r) => r.m), (m) => m.firstName);
}
/** Faces to pre-tick: members in the club whose face tagging is on. */
export const suggestedFaces = (people: Member[]): string[] => people.filter(faceSuggestable).map((m) => m.id);

// ---------- member search (daily log, camera, tag pickers) ----------
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Members whose name matches every word of the query (title, first and last name; accents and case ignored). An empty query keeps everyone. */
export function searchMembers<M extends Pick<Member, 'title' | 'firstName' | 'lastName'>>(members: M[], query: string): M[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return members;
  return members.filter((m) => {
    const hay = fold(`${memberName(m)} ${m.title} ${m.firstName} ${m.lastName}`);
    return words.every((w) => hay.includes(w));
  });
}

// ---------- daily logs ----------
export const logId = (memberId: string, date: ISODate) => `log-${memberId}-${date}`;
/** Members who were checked in on a date (even if they have left), by first name. */
export function attendedOn(s: ClubState, date: ISODate): Member[] {
  return sortBy(live(s.members).filter((m) => !isPendingRow(m) && !!s.attendance[attId(date, m.id)]?.checkIn), (m) => m.firstName);
}
/** The saved log of a member on a date. */
export function logOf(s: ClubState, memberId: string, date: ISODate): DailyLog | undefined {
  const byId = s.dailyLogs[logId(memberId, date)];
  const hit = byId && !byId.deletedAt ? byId : live(s.dailyLogs).find((l) => l.memberId === memberId && l.date === date);
  return hit && hit.status === 'saved' ? hit : undefined;
}
/** Today or up to LOG_BACK_DAYS days back. */
export const logDateOk = (today: ISODate, date: ISODate) => date <= today && date >= addDays(today, -LOG_BACK_DAYS);
/** Dates the log switcher offers: today, then earlier days in the window that had anyone checked in. Newest first. */
export function logDates(s: ClubState, today: ISODate): ISODate[] {
  const out: ISODate[] = [today];
  for (let i = 1; i <= LOG_BACK_DAYS; i++) {
    const d = addDays(today, -i);
    if (attendedOn(s, d).length) out.push(d);
  }
  return out;
}
/** Present on the date and no saved log yet. */
export const pendingLogMembers = (s: ClubState, date: ISODate): Member[] => attendedOn(s, date).filter((m) => !logOf(s, m.id, date));

export interface CogSummary { base: string; isDefault: boolean; quiet: number; unsettled: number; days: number }
/** Cognitive summary line: the stored summary plus how the last (up to) 10 logged days went. */
export function cogSummary(s: ClubState, m: Member): CogSummary {
  const ls = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && l.status === 'saved'), (l) => l.date).slice(-10);
  const raw = (m.health.cognitive.summary || '').trim();
  const isDefault = !raw || raw === 'Alert and oriented';
  return { base: isDefault ? '' : raw.split(';')[0].trim(), isDefault, quiet: ls.filter((l) => l.mood === 'quiet').length, unsettled: ls.filter((l) => l.mood === 'agitated').length, days: ls.length };
}

export type LogFields = Pick<DailyLog, 'mood' | 'lunch' | 'joined' | 'communicative' | 'content'>;
/** What "normal" means for a member who is not flagged: used for defaults and "Save everyone else as normal". */
export const NORMAL_LOG: LogFields = { mood: 'calm', lunch: 'all', joined: 'yes', communicative: 'normal', content: 'normal' };
/** Which observations differ from the normal defaults, as "field.value" keys (for i18n: activity.opt.<field>.<value>). */
export function logDeviations(l: LogFields): string[] {
  const out: string[] = [];
  for (const k of ['mood', 'lunch', 'joined', 'communicative', 'content'] as const) if (l[k] !== NORMAL_LOG[k]) out.push(`${k}.${l[k]}`);
  return out;
}

export interface LogComment { id: string; threadId: string; from: Message['from']; fromFamily: boolean; at: DT; text: string; seq: number }
/** Family comments (and staff replies) attached to a daily log: messages whose ref is {dailyLog, logId}. */
export function logComments(s: ClubState, logRowId: string): LogComment[] {
  return sortBy(
    live(s.messages).filter((m) => m.ref?.type === 'dailyLog' && m.ref.id === logRowId),
    (m) => m.at + String(m.seq).padStart(6, '0'),
  ).map((m) => ({ id: m.id, threadId: m.threadId, from: m.from, fromFamily: m.from.startsWith('family:'), at: m.at, text: m.text, seq: m.seq }));
}

// ---------- photos ----------
export interface PhotoFilter { memberId?: string; activity?: string; from?: ISODate; to?: ISODate; visibility?: 'visible' | 'hidden' | 'pending' | 'all' }
/** Photos for the library: everything not removed (including photos still waiting for approval), newest first. */
export function libraryPhotos(s: ClubState, f: PhotoFilter = {}): Photo[] {
  const vis = f.visibility ?? 'all';
  return sortBy(
    live(s.photos).filter(
      (p) =>
        p.visibility !== 'removed' &&
        (vis === 'all' || p.visibility === vis) &&
        (!f.memberId || p.memberIds.includes(f.memberId)) &&
        (!f.activity || photoActivity(p) === f.activity) &&
        (!f.from || p.date >= f.from) &&
        (!f.to || p.date <= f.to),
    ),
    (p) => p.date + p.time,
    -1,
  );
}
/** The activity group a photo belongs to ('arrival' / 'lunch' for the door camera and the kitchen). */
export const photoActivity = (p: Pick<Photo, 'activity' | 'kind'>): string => p.activity || (p.kind === 'arrival' ? 'arrival' : p.kind === 'lunch' ? 'lunch' : GENERAL_ACTIVITY);
export interface PhotoDay { date: ISODate; count: number; groups: { activity: string; photos: Photo[] }[] }
/** Group photos by day (newest day first) and, inside a day, by activity in time order. */
export function photoDays(photos: Photo[]): PhotoDay[] {
  const days = new Map<ISODate, Photo[]>();
  for (const p of photos) (days.get(p.date) || days.set(p.date, []).get(p.date)!).push(p);
  return sortBy(
    Array.from(days.entries()).map(([date, ps]) => {
      const asc = sortBy(ps, (p) => p.time);
      const groups: PhotoDay['groups'] = [];
      for (const p of asc) {
        const a = photoActivity(p);
        const g = groups.find((x) => x.activity === a);
        if (g) g.photos.push(p);
        else groups.push({ activity: a, photos: [p] });
      }
      return { date, count: ps.length, groups };
    }),
    (d) => d.date,
    -1,
  );
}
/** Photos sent today with the camera (solo and group), newest first: the ones already visible to families and the ones waiting for approval. */
export const sentToday = (s: ClubState, date: ISODate): Photo[] =>
  sortBy(live(s.photos).filter((p) => p.date === date && (p.visibility === 'visible' || p.visibility === 'pending') && (p.kind === 'solo' || p.kind === 'group')), (p) => p.time, -1);
/** How many of the given photos (today's solo and group ones, pending included) tag each member. */
export function photoCountByMember(photos: Pick<Photo, 'memberIds'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of photos) for (const id of new Set(p.memberIds)) out[id] = (out[id] ?? 0) + 1;
  return out;
}
/** The solo-photo list order: members with no photo today first, then those who have one (fewest first); each group keeps the order it came in. */
export const sortByPhotoCount = <M extends { id: string }>(members: M[], counts: Record<string, number>): M[] =>
  members.map((m, i) => ({ m, i, n: counts[m.id] ?? 0 })).sort((a, b) => a.n - b.n || a.i - b.i).map((x) => x.m);
/** Photos waiting for management approval, oldest first (the order a reviewer works through). */
export const pendingPhotos = (s: ClubState): Photo[] => sortBy(live(s.photos).filter((p) => p.visibility === 'pending'), (p) => p.date + p.time);
export const isPendingPhoto = (p: Pick<Photo, 'visibility'>) => p.visibility === 'pending';
/** Distinct activity strings in the library (for the filter). */
export const photoActivities = (s: ClubState): string[] => Array.from(new Set(live(s.photos).filter((p) => p.visibility !== 'removed').map(photoActivity))).sort();

/** Deterministic 0–4 tone and small numbers from an id string (no randomness in actions). */
export function hashOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
export const toneOf = (str: string) => hashOf(str) % 5;
/** m:ss for a duration in seconds. */
export const fmtDuration = (sec: number | undefined) => `${Math.floor((sec || 0) / 60)}:${String((sec || 0) % 60).padStart(2, '0')}`;
