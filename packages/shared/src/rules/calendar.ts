// Calendar and weekly schedule builder selectors: day info for the list / month views, schedule drafts and versions.
// Pure functions over ClubState. Family audiences never see venue clients; trials and visits are staff-only.
import type { ClubState, HM, ISODate, Lang, ScheduleCell, ScheduleVersion, Slot, Staff, Weekday, YM } from '../types';
import { eventsOn, staffByRole } from './core';
import { guestsOn } from './attendance';
import { scheduleVersionFor, sessionsOn } from './kitchen';
import { addDays, dow, isWeekday, live, monthDays, sortBy } from '../util';

export type CalAudience = 'staff' | 'family';
export type CalKind = 'closed' | 'holiday' | 'outing' | 'venue' | 'guest' | 'activity';
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
  guestId?: string;
  enquiryId?: string;
  activityId?: string;
  roomId?: string;
  staffId?: string;
  guestKind?: 'trial' | 'visit';
  /** a venue booking shown to a family: "Private event", no client */
  private?: boolean;
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
}
const ORDER: Record<CalKind, number> = { closed: 0, holiday: 1, outing: 2, venue: 3, guest: 4, activity: 5 };

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
  if (audience === 'staff') {
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
  if (open && !events.some((e) => e.kind === 'outing')) {
    for (const x of sessionsOn(s, date)) {
      if (!x.cell) continue;
      const a = s.activities[x.cell.activityId];
      items.push({ key: 'a:' + x.slot, kind: 'activity', time: x.slot, title: a?.name ?? '', titleId: a?.nameId, activityId: x.cell.activityId, roomId: x.cell.roomId, staffId: x.cell.staffId });
    }
  }
  items.sort((a, b) => ((a.time ?? '00:00') + ORDER[a.kind]).localeCompare((b.time ?? '00:00') + ORDER[b.kind]));
  return { date, weekday: dow(date), weekend, open, state, items, hasOuting: events.some((e) => e.kind === 'outing') };
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
export const SLOTS: Slot[] = ['10:30', '13:30'];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export type Days = ScheduleVersion['days'];
export const DRAFT_ID = 'sched-draft';

export const emptyDays = (): Days => ({ 1: { '10:30': null, '13:30': null }, 2: { '10:30': null, '13:30': null }, 3: { '10:30': null, '13:30': null }, 4: { '10:30': null, '13:30': null }, 5: { '10:30': null, '13:30': null } });
/** Fill missing weekdays/slots with null so every cell exists. */
export function normalizeDays(raw: Partial<Record<number, Partial<Record<Slot, ScheduleCell | null>>>> | undefined): Days {
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
export function changedCells(a: Days, b: Days): { w: Weekday; slot: Slot }[] {
  const out: { w: Weekday; slot: Slot }[] = [];
  for (const w of WEEKDAYS) for (const slot of SLOTS) if (!sameCell(a[w]?.[slot], b[w]?.[slot])) out.push({ w, slot });
  return out;
}
export const daysEqual = (a: Days, b: Days) => changedCells(a, b).length === 0;

export const publishedVersions = (s: ClubState): ScheduleVersion[] =>
  sortBy(live(s.scheduleVersions).filter((v) => v.status === 'published'), (v) => v.effectiveFrom + (v.publishedAt || ''));
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
/** A week can be changed only while it has not started: a published version always starts after today. */
export const weekEditable = (monday: ISODate, today: ISODate): boolean => monday > today;
/** The week a saved draft is for (the Monday on or before its effective date). */
export const draftWeek = (draft: Pick<ScheduleVersion, 'effectiveFrom'>): ISODate => mondayOf(draft.effectiveFrom);

export interface WeekView {
  monday: ISODate;
  dates: ISODate[];
  /** false once the week has started: it shows what ran, and changes start from a later week */
  editable: boolean;
  /** the cells that run this week */
  base: Days;
  /** what the grid shows: the draft when it is for this week, else `base` */
  days: Days;
  changes: { w: Weekday; slot: Slot }[];
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
export const cellKey = (w: Weekday, slot: Slot, c: ScheduleCell) => `${w}|${slot}|${c.activityId}|${c.staffId}|${c.roomId}`;
