// Activity area selectors: the day's plan and Now/Next, camera context and face opt-out, daily-log helpers, photo library.
// Pure functions over ClubState; no clock reads (callers pass `date` and `nowMin`).
import type { Activity, CalendarEvent, ClubState, DailyLog, HM, ISODate, Lang, Member, MoodMark, Photo, Room, ScheduleCell, Slot, Staff } from '../types';
import { dayStatus, isPendingRow, memberName } from './core';
import { lobbyGroups, attId } from './attendance';
import { sessionsOn } from './kitchen';
import { meanFace, moodId } from './moodCore';
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
/** KC round 7: the activity pictures of one session (`Photo.kind === 'activity'`: pictures of the session itself, no member tags), oldest first.
 *  Group and solo photos are member photos for the family Photos tab; they are no longer session pictures. Staff see what is waiting for approval too;
 *  `familyOnly` keeps the pictures families see (approved). Lunch and door-camera pictures are never session pictures. */
export function sessionPhotos(s: ClubState, date: ISODate, activity: Pick<Activity, 'name'> | undefined, opts: { familyOnly?: boolean } = {}): Photo[] {
  if (!activity) return [];
  return sortBy(live(s.photos).filter((p) => p.date === date && p.activity === activity.name && p.kind === 'activity'
    && (opts.familyOnly ? p.visibility === 'visible' : p.visibility === 'visible' || p.visibility === 'pending')), (p) => p.time + p.id);
}

// ---------- activity pictures: adding them, and what the teacher sees of each session ----------
/** Did any of these members check in on the date? (Families see a day's activity pictures only for the days their member came.) */
export const cameOn = (s: Pick<ClubState, 'attendance'>, memberIds: string[], date: ISODate): boolean => memberIds.some((id) => !!s.attendance[attId(date, id)]?.checkIn);
/** The sessions of a day that activity pictures can be added to, one per activity (an activity in both slots counts once), in time order. */
export function pictureSessions(s: ClubState, date: ISODate): SessionItem[] {
  const seen = new Set<string>();
  return dayPlan(s, date).filter((x): x is SessionItem => x.kind === 'session' && !!x.activity && !seen.has(x.activity.name) && !!seen.add(x.activity.name));
}
/** Days an activity picture can be added for: today and up to LOG_BACK_DAYS earlier open days that have a session, newest first. */
export function pictureDays(s: ClubState, today: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 0; i <= LOG_BACK_DAYS; i++) {
    const d = addDays(today, -i);
    if (pictureSessions(s, d).length) out.push(d);
  }
  return out;
}
export type PictureState = 'pending' | 'approved' | 'hidden' | 'rejected';
export interface SessionPicture { photo: Photo; state: PictureState; reason?: string }
/** What the teacher sees on one session: every activity picture of it with its state, oldest first.
 *  Rejected pictures (removed by management with a reason) stay in the list, so the teacher can see why and upload another. A teacher's own removals are gone. */
export function sessionPictures(s: ClubState, date: ISODate, activity: Pick<Activity, 'name'> | undefined): SessionPicture[] {
  if (!activity) return [];
  const out: SessionPicture[] = [];
  for (const p of Object.values(s.photos)) {
    if (p.kind !== 'activity' || p.date !== date || p.activity !== activity.name || p.visibility === 'draft') continue; // a draft is nobody's picture until it is sent
    if (p.deletedAt || p.visibility === 'removed') {
      if (p.visibility === 'removed' && p.moderated && s.staff[p.moderated.by]?.role === 'mgmt') out.push({ photo: p, state: 'rejected', reason: p.moderated.reason });
      continue;
    }
    out.push({ photo: p, state: p.visibility === 'pending' ? 'pending' : p.visibility === 'hidden' ? 'hidden' : 'approved' });
  }
  return sortBy(out, (x) => x.photo.time + x.photo.id);
}

export function nowNext(s: ClubState, date: ISODate, nowMin: number): NowNext {
  const plan = dayPlan(s, date);
  const sessions = plan.filter((x): x is SessionItem => x.kind === 'session');
  // KC round 7: extra sessions can overlap a weekly one; when several run, the one that started last is "Now" (else the first one still to start)
  const running = sessions.filter((x) => toMin(x.time) <= nowMin && nowMin < toMin(x.time) + SESSION_MIN);
  const current = running.length ? running[running.length - 1] : sessions.find((x) => toMin(x.time) > nowMin);
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
/** Members whose name matches every word of the query (title, first and last name, nickname; accents and case ignored). An empty query keeps everyone. */
export function searchMembers<M extends Pick<Member, 'title' | 'firstName' | 'lastName' | 'registration'>>(members: M[], query: string): M[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return members;
  return members.filter((m) => {
    const hay = fold(`${memberName(m)} ${m.title} ${m.firstName} ${m.lastName} ${m.registration?.nickname ?? ''}`);
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
/** Present on the date and the notes not in yet (KC round 7: a log may exist with only lunch or a session marked). */
export function pendingLogMembers(s: ClubState, date: ISODate): Member[] {
  const logs = logsOn(s, date);
  return attendedOn(s, date).filter((m) => !notesSaved(logs.get(m.id)));
}

export interface CogSummary { base: string; isDefault: boolean; quiet: number; unsettled: number; days: number }
/** Cognitive summary line: the stored summary plus how the last (up to) 10 visit days with faces went. Round 14: from the daily mood (the faces), not the
 *  old mood word: a day at 3 (Okay) is quiet, a day at 2 or below unsettled. */
export function cogSummary(s: ClubState, m: Member): CogSummary {
  const byDay = new Map<ISODate, MoodMark[]>();
  for (const k of live(s.moodMarks ?? {})) if (k.memberId === m.id) byDay.set(k.date, [...(byDay.get(k.date) ?? []), k]);
  const faces = [...byDay.keys()].sort().slice(-10).map((d) => meanFace(byDay.get(d)!));
  const raw = (m.health.cognitive.summary || '').trim();
  const isDefault = !raw || raw === 'Alert and oriented';
  return { base: isDefault ? '' : raw.split(';')[0].trim(), isDefault, quiet: faces.filter((f) => f === 3).length, unsettled: faces.filter((f) => f <= 2).length, days: faces.length };
}

export type LogFields = { [K in 'mood' | 'lunch' | 'joined' | 'communicative' | 'content']?: NonNullable<DailyLog[K]> };
/** What "normal" means for a member who is not flagged: used for defaults and "Mark the rest". */
export const NORMAL_LOG: Required<LogFields> = { mood: 'calm', lunch: 'all', joined: 'yes', communicative: 'normal', content: 'normal' };
/** Which observations differ from the normal defaults, as "field.value" keys (for i18n: activity.opt.<field>.<value>). Fields not marked yet are left out. */
export function logDeviations(l: LogFields): string[] {
  const out: string[] = [];
  for (const k of ['mood', 'lunch', 'joined', 'communicative', 'content'] as const) { const v = l[k]; if (v !== undefined && v !== NORMAL_LOG[k]) out.push(`${k}.${v}`); }
  return out;
}

// ---------- rounds (KC round 7): each activity session; round 14: the Morning round (faces and notes) replaces mood & notes, and lunch moves to the F&B team ----------
export const LUNCH_AMOUNTS = ['all', 'most', 'half', 'little', 'none'] as const;
export type LunchAmount = (typeof LUNCH_AMOUNTS)[number];
export const SESSION_MARKS = ['joined', 'satOut'] as const;
export type SessionMark = (typeof SESSION_MARKS)[number];
/** The i18n key of what a lunch amount reads like to families and in summaries ("Ate all of lunch", "Didn't eat"). */
export const lunchLabelKey = (v: LunchAmount): string => (v === 'none' ? 'activity.opt.lunch.none' : `family.lunch_${v}`);

/** The time the F&B team's lunch round opens (round 14: `/lunch` shows "Opens at 11:30" before it). */
export const LUNCH_ROUND_OPENS: HM = '11:30';
/** A round of the activity team's daily log: 'morning' (round 14: the morning faces and the notes), or a session's start time ('10:30', '13:30', or the time of an extra session such as '15:00').
 *  'lunch' is the F&B team's round (round 14): it is not one of the daily log's rounds, but its marks count with `roundMarked` / `roundProgress`. */
export type RoundId = 'morning' | 'lunch' | Slot;
export interface Round { id: RoundId; kind: 'session' | 'morning'; time: HM; session?: SessionItem }
/** When the Morning round starts, and until when it is the round the clock opens. */
const MORNING_AT: HM = '09:30';
const MORNING_UNTIL = 11 * 60 + 30;
/** The rounds of a day in time order: the Morning round (from 09:30) and each scheduled session (a slot without a session is skipped; an extra session is a round like any
 *  other). Lunch is not one of them any more (round 14: the kitchen's lunch round, `kitchen.lunchMark`). */
export function roundsOf(s: ClubState, date: ISODate): Round[] {
  const out: Round[] = [{ id: 'morning', kind: 'morning', time: MORNING_AT }];
  const sessions = dayPlan(s, date).filter((x): x is SessionItem => x.kind === 'session');
  for (const x of sessions) out.push({ id: x.slot, kind: 'session', time: x.time, session: x });
  return sortBy(out, (r) => r.time);
}
const roundIdOf = (r: Round | RoundId): RoundId => (typeof r === 'string' ? r : r.id);
/** The round to open by the clock: the Morning round before 11:30, then the latest round that has started (the first session, the second session from 13:30…). */
export function defaultRound(rounds: Round[], nowMin: number): RoundId {
  if (nowMin < MORNING_UNTIL && rounds.some((r) => r.kind === 'morning')) return 'morning';
  let pick = rounds[0];
  rounds.forEach((r) => { if (toMin(r.time) <= nowMin) pick = r; });
  return pick.id;
}
/** The notes of the day are in (Ruling 5): the Morning round's form was saved (communicative and content come with every save; older logs carry the mood word), or a note was written. */
export const notesSaved = (l: Partial<Pick<DailyLog, 'mood' | 'communicative' | 'content' | 'note' | 'staffNote'>> | undefined): boolean =>
  !!l && (l.mood !== undefined || l.communicative !== undefined || l.content !== undefined || !!l.note?.trim() || !!l.staffNote?.trim());
/** A morning face was marked for the member that day. */
export const morningFaced = (s: ClubState, memberId: string, date: ISODate): boolean => { const m = s.moodMarks?.[moodId(date, memberId, 'morning')]; return !!m && !m.deletedAt; };
/** Has this round been marked? An unmarked part is simply missing from the row; the Morning round counts once there is a morning face (`faced`) or the notes are in. */
export function roundMarked(l: Partial<Pick<DailyLog, 'mood' | 'communicative' | 'content' | 'note' | 'staffNote' | 'lunch' | 'sessions'>> | undefined, round: Round | RoundId, faced = false): boolean {
  const id = roundIdOf(round);
  if (id === 'morning') return faced || notesSaved(l);
  if (!l) return false;
  return id === 'lunch' ? l.lunch !== undefined : l.sessions?.[id] !== undefined;
}
/** The saved logs of a date by member id (one pass over the logs; the screens and the progress counts use it instead of `logOf` per member). */
export function logsOn(s: ClubState, date: ISODate): Map<string, DailyLog> {
  const out = new Map<string, DailyLog>();
  for (const l of live(s.dailyLogs)) if (l.date === date && l.status === 'saved' && !out.has(l.memberId)) out.set(l.memberId, l);
  return out;
}
/** How many of the day's attendees have been marked in a round (everyone who checked in counts, also those who already went home). */
export function roundProgress(s: ClubState, date: ISODate, round: Round | RoundId): { marked: number; total: number } {
  const people = attendedOn(s, date);
  const logs = logsOn(s, date);
  const morning = roundIdOf(round) === 'morning';
  return { marked: people.filter((m) => roundMarked(logs.get(m.id), round, morning && morningFaced(s, m.id, date))).length, total: people.length };
}
/** `joined` kept in step with the session marks: yes when any session was joined, satOut when all marked ones were sat out, none while nothing is marked. */
export function joinedOf(sessions: DailyLog['sessions']): DailyLog['joined'] {
  const v = Object.values(sessions ?? {});
  return v.includes('joined') ? 'yes' : v.length ? 'satOut' : undefined;
}

// ---------- photos ----------
export interface PhotoFilter { memberId?: string; activity?: string; /** round 14: 'meals' = the lunch and tea pictures, 'activities' = the group and session pictures (the solo portraits and the door camera's arrival pictures are the family's Portraits) */ kind?: 'meals' | 'activities'; from?: ISODate; to?: ISODate; visibility?: 'visible' | 'hidden' | 'pending' | 'all' }
/** Photos for the library: everything not removed (including photos still waiting for approval), newest first. */
export function libraryPhotos(s: ClubState, f: PhotoFilter = {}): Photo[] {
  const vis = f.visibility ?? 'all';
  return sortBy(
    live(s.photos).filter(
      (p) =>
        p.visibility !== 'removed' &&
        p.visibility !== 'draft' && // KC round 7: a shot nobody has sent is not in the library
        (vis === 'all' || p.visibility === vis) &&
        (!f.memberId || p.memberIds.includes(f.memberId)) &&
        (!f.kind || (f.kind === 'meals' ? p.kind === 'lunch' : p.kind !== 'lunch' && p.kind !== 'arrival' && p.kind !== 'solo')) &&
        (!f.activity || photoActivity(p) === f.activity) &&
        (!f.from || p.date >= f.from) &&
        (!f.to || p.date <= f.to),
    ),
    (p) => p.date + p.time,
    -1,
  );
}
/** The activity group a photo belongs to ('arrival' / 'lunch' for the door camera and the kitchen). */
export const photoActivity = (p: Pick<Photo, 'activity' | 'kind'>): string => p.kind === 'lunch' ? 'lunch' : p.activity || (p.kind === 'arrival' ? 'arrival' : GENERAL_ACTIVITY); // tea photos (activity 'tea') sit in the lunch group
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
export const photoActivities = (s: ClubState): string[] => Array.from(new Set(live(s.photos).filter((p) => p.visibility !== 'removed' && p.visibility !== 'draft').map(photoActivity))).sort();

/** Deterministic 0–4 tone and small numbers from an id string (no randomness in actions). */
export function hashOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
export const toneOf = (str: string) => hashOf(str) % 5;
/** m:ss for a duration in seconds. */
export const fmtDuration = (sec: number | undefined) => `${Math.floor((sec || 0) / 60)}:${String((sec || 0) % 60).padStart(2, '0')}`;
