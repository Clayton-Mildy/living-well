// Calendar and weekly schedule builder selectors: day info for the list / month views, schedule drafts and versions.
// Pure functions over ClubState. Family audiences never see venue clients; trials and visits are staff-only.
import type { ClubState, ExtraSession, HM, ISODate, Lang, ScheduleCell, ScheduleDay, ScheduleVersion, Slot, Staff, Weekday, WeekSlot, YM } from '../types';
import { dayStatus, eventsOn, listName, staffByRole } from './core';
import { guestsOn } from './attendance';
import { WEEK_SLOTS, extrasOn, isWeekSlot, scheduleDayOf, scheduleVersionFor, sessionsOn } from './kitchen';
import { guestOn } from './guests';
import { celebrationsOn } from './celebrations';
import { occasionsInRange } from './occasions';
import { addDays, dow, isWeekday, live, monthDays, sortBy, toHM, toMin } from '../util';

export type CalAudience = 'staff' | 'family';
export type CalKind = 'closed' | 'holiday' | 'outing' | 'venue' | 'celebration' | 'birthday' | 'guest' | 'activity';
export interface DayItem {
  key: string;
  kind: CalKind;
  /** null = all day */
  time: HM | null;
  to?: HM | null;
  /** closed / holiday / outing: the event title; venue: the client (staff only, '' for family); activity: name; guest: the person */
  title: string;
  titleId?: string;
  eventId?: string;
  venueId?: string;
  /** round 12: a celebration (birthday ...) booked for a member; staff also see requested ones, with `note: 'requested'` */
  celebrationId?: string;
  memberId?: string;
  /** round 12, birthday: the age the member turns */
  years?: number;
  guestId?: string;
  enquiryId?: string;
  activityId?: string;
  roomId?: string;
  staffId?: string;
  guestKind?: 'trial' | 'visit';
  /** a venue booking shown to a family: "Private event", no client */
  private?: boolean;
  /** KC round 7, staff only: this session differs from the weekly plan (a one-day change), and the day's note (on the first changed session) */
  changed?: boolean;
  note?: string;
  /** KC round 7: a guest host leads this session (also shown to families: name and what they do only) */
  guest?: { hostId: string; sessionId: string; name: string; what: string };
  /** KC round 7: an extra session of this date (not in the weekly plan); staff see an "Extra" tag, its note rides in `note` (staff only) */
  extra?: boolean;
  /** a pseudo item the day view adds for a slot with no session (never produced by `dayInfo`) */
  empty?: boolean;
}
export type DayState = 'open' | 'closed' | 'holiday' | 'weekend';
export interface DayInfo {
  date: ISODate;
  weekday: number; // 0 = Sunday
  weekend: boolean;
  open: boolean;
  state: DayState;
  items: DayItem[];
  hasOuting: boolean;
  /** KC round 7, staff only: slots of an open day that have no session (`changed`: removed for this day only), so the day view can offer to add one */
  noSession: { slot: WeekSlot; changed: boolean }[];
}
const ORDER: Record<CalKind, number> = { closed: 0, holiday: 1, outing: 2, venue: 3, celebration: 4, birthday: 5, guest: 6, activity: 7 };

/** Everything that happens on a date, for the list, month and day views. */
export function dayInfo(s: ClubState, date: ISODate, audience: CalAudience = 'staff'): DayInfo {
  const events = eventsOn(s, date);
  const weekend = !isWeekday(date);
  const closed = events.find((e) => e.kind === 'closed');
  const holiday = events.find((e) => e.kind === 'holiday');
  const state: DayState = closed ? 'closed' : holiday ? 'holiday' : weekend ? 'weekend' : 'open';
  const open = state === 'open';
  const items: DayItem[] = [];
  for (const e of events) items.push({ key: 'ev:' + e.id, kind: e.kind, time: e.from ?? null, to: e.to ?? null, title: e.title, titleId: e.titleId, eventId: e.id });
  for (const v of live(s.venueBookings)) {
    if (v.date !== date || v.status !== 'confirmed') continue;
    items.push(audience === 'staff'
      ? { key: 'v:' + v.id, kind: 'venue', time: v.from, to: v.to, title: v.org, venueId: v.id, roomId: v.roomId }
      : { key: 'v:' + v.id, kind: 'venue', time: v.from, to: v.to, title: '', private: true, roomId: v.roomId });
  }
  for (const c of celebrationsOn(s, date, audience === 'staff' ? ['confirmed', 'requested'] : ['confirmed'])) {
    items.push({ key: 'cel:' + c.id, kind: 'celebration', time: c.from, to: c.to, title: c.title, celebrationId: c.id, memberId: c.memberId, roomId: c.roomId, ...(c.status === 'requested' ? { note: 'requested' } : {}) });
  }
  if (audience === 'staff') {
    // round 12: a member's birthday is an all-day item on the day (families see only their own parents', see famCalendar)
    for (const o of occasionsInRange(s, date, date)) if (o.kind === 'birthday') items.push({ key: 'bd:' + o.member.id, kind: 'birthday', time: null, title: listName(o.member), memberId: o.member.id, years: o.years });
    const booked = new Set<string>();
    for (const g of guestsOn(s, date)) {
      booked.add(g.enquiryId);
      items.push({ key: 'g:' + g.id, kind: 'guest', time: g.kind === 'trial' ? null : g.time ?? null, title: g.name, guestId: g.id, enquiryId: g.enquiryId, guestKind: g.kind });
    }
    // leads with a visit or trial on this date that have no guest booking row yet
    for (const e of live(s.enquiries)) {
      if (e.archivedAt || e.stage === 'lost' || e.stage === 'joined' || booked.has(e.id)) continue;
      if ((e.next?.kind === 'visit' || e.next?.kind === 'trial') && e.next.date === date)
        items.push({ key: 'q:' + e.id, kind: 'guest', time: e.next.kind === 'trial' ? null : e.next.time ?? null, title: `${e.senior.title} ${e.senior.name}`, enquiryId: e.id, guestKind: e.next.kind });
    }
  }
  const noSession: DayInfo['noSession'] = [];
  if (open && !events.some((e) => e.kind === 'outing')) {
    const extraNote = new Map(extrasOn(s, date).map((e) => [e.time, e.note]));
    for (const x of sessionsOn(s, date)) {
      if (!x.cell) {
        if (audience === 'staff' && isWeekSlot(x.slot)) noSession.push({ slot: x.slot, changed: slotChanged(s, date, x.slot) });
        continue;
      }
      const a = s.activities[x.cell.activityId];
      const g = guestOn(s, date, x.slot);
      items.push({
        key: 'a:' + x.slot, kind: 'activity', time: x.slot, title: a?.name ?? '', titleId: a?.nameId, activityId: x.cell.activityId, roomId: x.cell.roomId, staffId: x.cell.staffId,
        ...(audience === 'staff' && !x.extra && slotChanged(s, date, x.slot) ? { changed: true } : {}),
        ...(x.extra && audience === 'staff' ? { extra: true, ...(extraNote.get(x.slot) ? { note: extraNote.get(x.slot) } : {}) } : {}), // families see an extra session like any other
        ...(g ? { guest: { hostId: g.host.id, sessionId: g.session.id, name: g.host.name, what: g.host.what } } : {}),
      });
    }
    // the day's note rides on its first changed session (staff only)
    const note = audience === 'staff' ? scheduleDayOf(s, date)?.note : undefined;
    const first = note ? items.filter((i) => i.changed).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0] : undefined;
    if (first && note) first.note = note;
  }
  items.sort((a, b) => ((a.time ?? '00:00') + ORDER[a.kind]).localeCompare((b.time ?? '00:00') + ORDER[b.kind]));
  return { date, weekday: dow(date), weekend, open, state, items, hasOuting: events.some((e) => e.kind === 'outing'), noSession };
}

/** The next `count` calendar days from `from`, skipping weekends that have nothing on. */
export function listDays(s: ClubState, from: ISODate, count: number, audience: CalAudience = 'staff'): DayInfo[] {
  const out: DayInfo[] = [];
  for (let i = 0; i < count; i++) {
    const info = dayInfo(s, addDays(from, i), audience);
    if (info.weekend && !info.items.length) continue;
    out.push(info);
  }
  return out;
}

/** The next `count` days that have something to show from `from`: weekends with nothing on are skipped without using up the count (the list view shows 3). */
export function nextDays(s: ClubState, from: ISODate, count: number, audience: CalAudience = 'staff'): DayInfo[] {
  const out: DayInfo[] = [];
  for (let i = 0; i < 60 && out.length < count; i++) {
    const info = dayInfo(s, addDays(from, i), audience);
    if (info.weekend && !info.items.length) continue;
    out.push(info);
  }
  return out;
}

/** Month grid dates, Monday first: leading nulls, then every day of the month. */
export function monthGrid(month: YM): (ISODate | null)[] {
  const days = monthDays(month);
  const lead = (dow(days[0]) + 6) % 7;
  return [...Array(lead).fill(null), ...days];
}

export const fmtDMY = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const KIND_PREFIX = /^(Club closed|Outing|Venue booking|Klub tutup|Jalan-jalan|Pemesanan tempat)\s*:\s*/i;
/** Event title in the current language (Indonesian when known); the "Outing:" / "Club closed:" prefix is dropped because the kind is shown next to it. */
export function eventTitle(e: { title: string; titleId?: string }, lang: Lang, strip = true): string {
  const raw = lang === 'id' && e.titleId ? e.titleId : e.title;
  return strip ? raw.replace(KIND_PREFIX, '') : raw;
}

// ---------- schedule drafts and versions ----------
/** The weekly plan's two session times (extra sessions of a date are not part of it). */
export const SLOTS: WeekSlot[] = WEEK_SLOTS;
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export type Days = ScheduleVersion['days'];
export const DRAFT_ID = 'sched-draft';

export const emptyDays = (): Days => ({ 1: { '10:30': null, '13:30': null }, 2: { '10:30': null, '13:30': null }, 3: { '10:30': null, '13:30': null }, 4: { '10:30': null, '13:30': null }, 5: { '10:30': null, '13:30': null } });
/** Fill missing weekdays/slots with null so every cell exists. */
export function normalizeDays(raw: Partial<Record<number, Partial<Record<WeekSlot, ScheduleCell | null>>>> | undefined): Days {
  const out = emptyDays();
  for (const w of WEEKDAYS) for (const sl of SLOTS) {
    const c = raw?.[w]?.[sl];
    out[w][sl] = c ? { activityId: c.activityId, staffId: c.staffId, roomId: c.roomId } : null;
  }
  return out;
}
export const cloneDays = (d: Days): Days => normalizeDays(d);
export const sameCell = (a: ScheduleCell | null | undefined, b: ScheduleCell | null | undefined) =>
  (!a && !b) || (!!a && !!b && a.activityId === b.activityId && a.staffId === b.staffId && a.roomId === b.roomId);
/** KC round 7: the weekly plan's cell for a date and slot (a one-day change is ignored). */
export function weeklyCell(s: ClubState, date: ISODate, slot: Slot): ScheduleCell | null {
  return isWeekSlot(slot) ? scheduleVersionFor(s, date)?.days[dow(date) as Weekday]?.[slot] ?? null : null; // an extra session is not in the weekly plan
}
/** KC round 7: does a one-day change make this slot differ from the weekly plan? */
export function slotChanged(s: ClubState, date: ISODate, slot: Slot): boolean {
  const over = scheduleDayOf(s, date);
  return !!over && isWeekSlot(slot) && slot in over.slots && !sameCell(over.slots[slot], weeklyCell(s, date, slot));
}
/** KC round 7: can the programme of this day be changed? An open day with no outing, today or later. */
export function dayChangeable(s: ClubState, date: ISODate, today: ISODate): boolean {
  const st = dayStatus(s, date);
  return date >= today && st.open && !st.outing;
}
export function changedCells(a: Days, b: Days): { w: Weekday; slot: WeekSlot }[] {
  const out: { w: Weekday; slot: WeekSlot }[] = [];
  for (const w of WEEKDAYS) for (const slot of SLOTS) if (!sameCell(a[w]?.[slot], b[w]?.[slot])) out.push({ w, slot });
  return out;
}
export const daysEqual = (a: Days, b: Days) => changedCells(a, b).length === 0;

export const publishedVersions = (s: ClubState): ScheduleVersion[] =>
  sortBy(live(s.scheduleVersions).filter((v) => v.status === 'published'), (v) => v.effectiveFrom + (v.publishedAt || ''));
// round 14 (B1): what the activity team sent waits for management; none of it is in force (the rules above read published versions and live days only)
/** Weekly versions the activity team sent, waiting for management (newest first). */
export const pendingVersions = (s: ClubState): ScheduleVersion[] => sortBy(live(s.scheduleVersions).filter((v) => v.status === 'pending'), (v) => v.createdAt + v.id, -1);
/** The version management sent back (sending a new one replaces it). */
export const returnedVersion = (s: ClubState): ScheduleVersion | undefined => sortBy(live(s.scheduleVersions).filter((v) => v.status === 'rejected'), (v) => v.createdAt + v.id).pop();
/** A day as its waiting edit would make it (the live day when nothing waits), without the waiting marks. */
export function pendingDayRow(row: ScheduleDay): ScheduleDay {
  const { pending, returned: _r, note: _n, extra: _x, ...rest } = row;
  const p = pending ?? { slots: row.slots, extra: row.extra, note: row.note };
  return { ...rest, slots: p.slots, ...(p.extra?.length ? { extra: p.extra } : {}), ...(p.note ? { note: p.note } : {}) };
}
/** The state with a day as its waiting edit would make it: what the activity team edits, and sees in its day sheets. */
export function withPendingDay(s: ClubState, date: ISODate): ClubState {
  const row = s.scheduleDays?.[date];
  return row && !row.deletedAt && row.pending ? { ...s, scheduleDays: { ...s.scheduleDays, [date]: pendingDayRow(row) } } : s;
}
/** The newest published version: the one the builder starts from. */
export const latestPublished = (s: ClubState): ScheduleVersion | undefined => publishedVersions(s).pop();
export const scheduleDraft = (s: ClubState): ScheduleVersion | undefined => live(s.scheduleVersions).find((v) => v.status === 'draft');
export const builderBase = (s: ClubState): Days => normalizeDays(latestPublished(s)?.days);
/** What the builder shows: the saved draft, else the newest published version. */
export const builderDays = (s: ClubState): Days => normalizeDays((scheduleDraft(s) ?? latestPublished(s))?.days);
/** Published versions that actually apply on some date (a later publish for the same date replaces the earlier one), newest first. */
export function effectiveVersions(s: ClubState): ScheduleVersion[] {
  const byDate = new Map<ISODate, ScheduleVersion>();
  for (const v of publishedVersions(s)) byDate.set(v.effectiveFrom, v);
  return sortBy(Array.from(byDate.values()), (v) => v.effectiveFrom, -1);
}
/** First Monday strictly after `from` (default effective date of a published schedule). */
export function nextMonday(from: ISODate): ISODate {
  let d = addDays(from, 1);
  while (dow(d) !== 1) d = addDays(d, 1);
  return d;
}
/** Staff who may teach: active, role activity. */
export const activityTeachers = (s: ClubState): Staff[] => staffByRole(s, 'activity');

// ---------- the week view: what runs in a given Mon–Fri week, and the draft for it ----------
/** The Monday on or before a date: the Mon–Fri schedule week the date belongs to (a Saturday or Sunday belongs to the week just ended). */
export function mondayOf(d: ISODate): ISODate {
  return addDays(d, -((dow(d) + 6) % 7));
}
/** Monday to Friday of the week starting on `monday`. */
export const weekDates = (monday: ISODate): ISODate[] => WEEKDAYS.map((w) => addDays(monday, w - 1));
/** The cells that actually run in a week: each weekday takes the version in force on that date (a version can start mid-week). */
export function weekDays(s: ClubState, monday: ISODate): Days {
  const out = emptyDays();
  for (const w of WEEKDAYS) {
    const v = scheduleVersionFor(s, addDays(monday, w - 1));
    if (!v) continue;
    const day = normalizeDays(v.days as never)[w];
    out[w] = { '10:30': day['10:30'], '13:30': day['13:30'] };
  }
  return out;
}
/** Published versions in force somewhere in the week, in date order (usually one). */
export function weekVersions(s: ClubState, monday: ISODate): ScheduleVersion[] {
  const seen = new Set<string>();
  const out: ScheduleVersion[] = [];
  for (const date of weekDates(monday)) {
    const v = scheduleVersionFor(s, date);
    if (v && !seen.has(v.id)) { seen.add(v.id); out.push(v); }
  }
  return out;
}
/** KC round 7: a week can be changed until it is over (its Friday has not passed): the current week is editable from today on, and a version published for it starts today. */
export const weekEditable = (monday: ISODate, today: ISODate): boolean => addDays(monday, 4) >= today;
/** KC round 7: in an editable week, a day before today has already happened and stays as it was. */
export const dayEditable = (date: ISODate, today: ISODate): boolean => date >= today;
/** The week a saved draft is for (the Monday on or before its effective date). */
export const draftWeek = (draft: Pick<ScheduleVersion, 'effectiveFrom'>): ISODate => mondayOf(draft.effectiveFrom);

export interface WeekView {
  monday: ISODate;
  dates: ISODate[];
  /** false once the week is over: it shows what ran. The current week is editable from today on (`dayEditable`) */
  editable: boolean;
  /** the cells that run this week */
  base: Days;
  /** what the grid shows: the draft when it is for this week, else `base` */
  days: Days;
  changes: { w: Weekday; slot: WeekSlot }[];
  versions: ScheduleVersion[];
  /** the draft is for this week */
  draftHere: boolean;
  /** an unpublished draft with changes that is for another week */
  otherDraft?: { monday: ISODate; changes: number };
}
/** The weekly schedule for the week starting on `monday`: the version in force, plus the shared draft when it is for this week. */
export function weekView(s: ClubState, monday: ISODate, today: ISODate): WeekView {
  const base = weekDays(s, monday);
  const draft = scheduleDraft(s);
  const dm = draft ? draftWeek(draft) : null;
  const draftHere = !!draft && dm === monday && weekEditable(monday, today);
  const days = draftHere ? normalizeDays(draft!.days as never) : base;
  let otherDraft: WeekView['otherDraft'];
  if (draft && dm && dm !== monday) {
    const n = changedCells(normalizeDays(draft.days as never), weekDays(s, dm)).length;
    if (n) otherDraft = { monday: dm, changes: n };
  }
  return { monday, dates: weekDates(monday), editable: weekEditable(monday, today), base, days, changes: changedCells(days, base), versions: weekVersions(s, monday), draftHere, otherDraft };
}
/** Every weekday cell that appears in some published version: such cells are always valid, even if the teacher or activity changed since. */
export function publishedCellKeys(s: ClubState): Set<string> {
  const keys = new Set<string>();
  for (const v of publishedVersions(s)) {
    const days = normalizeDays(v.days as never);
    for (const w of WEEKDAYS) for (const slot of SLOTS) { const c = days[w][slot]; if (c) keys.add(`${w}|${slot}|${c.activityId}|${c.staffId}|${c.roomId}`); }
  }
  return keys;
}
export const cellKey = (w: Weekday, slot: WeekSlot, c: ScheduleCell) => `${w}|${slot}|${c.activityId}|${c.staffId}|${c.roomId}`;

// ---------- upcoming closures (family Today) ----------
export interface UpcomingClosure {
  eventId: string;
  kind: 'closed' | 'holiday';
  /** first and last closed weekday of the event (the same day for a one-day closure; `to` is the event's real last weekday, even past the window) */
  from: ISODate;
  to: ISODate;
  title: string;
  titleId?: string;
}
/**
 * Club closures and holidays that start in the next `days` days (tomorrow onward), soonest first, one row per event, so families hear about
 * them before the day. Today is left out (the family timeline already says the club is closed), and so is an event that has already
 * started. Normal weekends and weekend days of an event are skipped: the club is shut then anyway.
 */
export function upcomingClosures(s: ClubState, today: ISODate, days = 7): UpcomingClosure[] {
  const out: UpcomingClosure[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= days; i++) {
    const date = addDays(today, i);
    const st = dayStatus(s, date);
    if (st.open || st.reason === 'weekend' || !st.event) continue;
    const e = st.event;
    if (seen.has(e.id) || e.date <= today) continue;
    seen.add(e.id);
    let to = e.endDate && e.endDate > date ? e.endDate : date;
    while (to > date && !isWeekday(to)) to = addDays(to, -1);
    out.push({ eventId: e.id, kind: e.kind === 'holiday' ? 'holiday' : 'closed', from: date, to, title: e.title, ...(e.titleId ? { titleId: e.titleId } : {}) });
  }
  return out;
}

// ---------- extra sessions (KC round 7): one-day sessions at any time, beside the two weekly ones ----------
/** Two sessions of a date must start at least this many minutes apart (an extra cannot clash with another session). */
export const MIN_SESSION_GAP = 30;
/** The last start time of an extra session is this many minutes before the club closes. */
export const LAST_START_BEFORE_CLOSE = 30;
/** The starts of the sessions that run on a date (the weekly slots that have a session, and the extras), except `ignore` (the extra being edited). */
export const sessionStarts = (s: ClubState, date: ISODate, ignore?: HM): HM[] => sessionsOn(s, date).filter((x) => !!x.cell && x.slot !== ignore).map((x) => x.slot);
/** Why an extra session cannot start at `time` on `date` (null = fine): outside the club's hours, on a weekly session time, or too close to another session. `ignore` is the extra being moved. */
export function extraTimeIssue(s: ClubState, date: ISODate, time: HM, ignore?: HM): { code: string; params: Record<string, string> } | null {
  const { open, close } = s.club.settings;
  const m = toMin(time);
  const last = toMin(close) - LAST_START_BEFORE_CLOSE;
  if (m < toMin(open) || m > last) return { code: 'cal.err.sessionHours', params: { from: open, to: toHM(last) } };
  if (isWeekSlot(time)) return { code: 'cal.err.sessionFixedTime', params: { time } };
  const near = sessionStarts(s, date, ignore).find((x) => Math.abs(toMin(x) - m) < MIN_SESSION_GAP);
  return near ? { code: 'cal.err.sessionClash', params: { time: near, min: String(MIN_SESSION_GAP) } } : null;
}
/** Is this time an extra session of the date? */
export const isExtraSlot = (s: ClubState, date: ISODate, slot: Slot): boolean => extrasOn(s, date).some((x) => x.time === slot);
/** The extra session of a date at a time. */
export const extraAt = (s: ClubState, date: ISODate, time: HM): ExtraSession | undefined => extrasOn(s, date).find((x) => x.time === time);
/** A start time to offer first when adding an extra session on a date: the first of the usual gaps in the day (11:30, 15:00, 09:00 …) that is free; '' when none is. */
export function suggestExtraTime(s: ClubState, date: ISODate): HM {
  return ['11:30', '15:00', '09:00', '12:30', '14:30', '16:00', '09:45', '10:00'].find((t) => !extraTimeIssue(s, date, t)) ?? '';
}
