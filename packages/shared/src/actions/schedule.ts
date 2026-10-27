// Schedule and calendar actions: weekly schedule drafts and dated versions, closures / holidays / outings, activity and room catalog.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { CalendarEvent, ClubState, HM, ISODate, Member, ScheduleCell, ScheduleDay, ScheduleVersion, Slot, StaffRole, WeekSlot } from '../types';
import { DomainError, defineAction, hasRole, type Ctx } from './framework';
import { needsApproval } from './approvalGate';
import { clubHoursRental, dayStatus, membershipStatus } from '../rules/core';
import { extrasOn, isWeekSlot, publishDateOf, scheduleDayOf, scheduleVersionFor, sessionsOn } from '../rules/kitchen';
import { ALL_DAYS, DRAFT_ID, SLOTS, cellKey, dayProgrammable, daysEqual, extraTimeIssue, fmtDMY, nextMonday, normalizeDays, pendingDayRow, publishedCellKeys, sameCell, storedDays, weeklyCell, type Days } from '../rules/calendar';
import { guestOn } from '../rules/guests';
import { asWeekday, diffDays, live, sortBy, uniq } from '../util';
import { mediaIdOf } from './members';

const mgmtOnly = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'mgmt');
/** Round 14 (B1): who builds the programme. The activity team does too, but what it changes waits for management (`needsApproval`). */
const builders = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'activity', 'mgmt');
/** Staff roles with a calendar screen. */
const CAL_ROLES: StaffRole[] = ['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt'];

export function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  return r.data;
}
export const isoDate = z.string().refine((s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Family users with app access to a current member (everyone who should hear about the calendar). */
export function allFamilyUsers(d: Draft<ClubState>, today: ISODate): string[] {
  const out: string[] = [];
  for (const l of live(d.familyLinks as ClubState['familyLinks'])) {
    const m = d.members[l.memberId];
    if (!l.appAccess || (l.review && l.review.status !== 'approved') || !m || m.deletedAt || membershipStatus(m as unknown as Member, today) === 'ended') continue;
    const fc = d.familyContacts[l.familyId];
    if (fc && !fc.deletedAt) out.push(l.familyId);
  }
  return uniq(out);
}
/** Tell the staff roles and every family, unless the publisher switched "notify" off (the change itself still happens and is in the feed). */
function notifyEveryone(d: Draft<ClubState>, ctx: Ctx, n: { kind: string; params: Record<string, string | number>; link?: string }, notify = true) {
  if (!notify) return;
  ctx.notify({ toRoles: CAL_ROLES, toUsers: allFamilyUsers(d, ctx.today), kind: n.kind, params: n.params, link: n.link ?? '/calendar' });
}

// ---------- weekly schedule ----------
const cellSchema = z.object({ activityId: z.string().min(1), staffId: z.string().min(1), roomId: z.string().min(1) }).nullable();
const daySchema = z.object({ '10:30': cellSchema, '13:30': cellSchema });
const daysSchema = z.object({ '1': daySchema, '2': daySchema, '3': daySchema, '4': daySchema, '5': daySchema, '6': daySchema.optional(), '7': daySchema.optional() }); // round 14: Saturday and Sunday are optional
const toDays = (x: z.infer<typeof daysSchema>) => normalizeDays(x as never);

/** Existence checks always; role / active checks only for cells that no published version already has (so old cells stay valid after a teacher or activity changes). */
function validateDays(d: Draft<ClubState>, ctx: Ctx, days: Days) {
  const published = publishedCellKeys(d as unknown as ClubState);
  for (const w of ALL_DAYS) for (const slot of SLOTS) {
    const c = days[w][slot];
    if (c) validateCell(d, ctx, c, published.has(cellKey(w, slot, c)));
  }
}
/** One cell: it must exist; a cell that is new (not already in force) must also be an active activity led by an active activity teacher. */
function validateCell(d: Draft<ClubState>, ctx: Ctx, c: ScheduleCell, known: boolean) {
  const a = d.activities[c.activityId];
  const r = d.rooms[c.roomId];
  const st = d.staff[c.staffId];
  if (!a || a.deletedAt) ctx.fail('cal.err.badActivity');
  if (!r || r.deletedAt) ctx.fail('cal.err.badRoom');
  if (!st || st.deletedAt) ctx.fail('cal.err.badTeacher');
  if (known) return;
  if (st.role !== 'activity') ctx.fail('cal.err.badTeacher');
  if (!a.active) ctx.fail('cal.err.inactiveActivity', { name: a.name });
  if (!st.active) ctx.fail('cal.err.inactiveTeacher', { name: st.knownAs || st.name });
}

// ---------- calendar events ----------
const eventSchema = z.object({
  date: isoDate,
  endDate: isoDate.nullish(),
  kind: z.enum(['closed', 'holiday', 'outing']),
  title: z.string().trim().min(1).max(120),
  titleId: z.string().trim().max(120).nullish(),
  from: hm.nullish(),
  to: hm.nullish(),
  notify: z.boolean().optional(),
});
type EventInput = z.infer<typeof eventSchema>;
const updateSchema = z.object({
  eventId: z.string().min(1),
  date: isoDate.optional(),
  endDate: isoDate.nullish(),
  kind: z.enum(['closed', 'holiday', 'outing']).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  titleId: z.string().trim().max(120).nullish(),
  from: hm.nullish(),
  to: hm.nullish(),
  notify: z.boolean().optional(),
});
type UpdateInput = z.infer<typeof updateSchema>;

/** Validate a complete event and return the fields to store (no undefined values). */
function eventFields(e: EventInput, ctx: Ctx): Pick<CalendarEvent, 'date' | 'kind' | 'title'> & Partial<Pick<CalendarEvent, 'endDate' | 'titleId' | 'from' | 'to'>> {
  if (e.date < ctx.today) ctx.fail('cal.err.pastDate');
  const endDate = e.endDate && e.endDate > e.date ? e.endDate : undefined;
  if (e.endDate && e.endDate < e.date) ctx.fail('cal.err.endBeforeStart');
  if (endDate && diffDays(e.date, endDate) > 90) ctx.fail('cal.err.rangeTooLong');
  let from: string | undefined;
  let to: string | undefined;
  if (e.kind === 'outing' && (e.from || e.to)) {
    if (!e.from || !e.to) ctx.fail('cal.err.timeBoth');
    if (e.from >= e.to) ctx.fail('cal.err.timeOrder');
    from = e.from;
    to = e.to;
  }
  return { date: e.date, kind: e.kind, title: e.title, ...(endDate ? { endDate } : {}), ...(e.titleId ? { titleId: e.titleId } : {}), ...(from && to ? { from, to } : {}) };
}
const dateText = (date: ISODate, endDate?: ISODate) => (endDate ? `${fmtDMY(date)}–${fmtDMY(endDate)}` : fmtDMY(date));

const KIND_ICON = { closed: 'event_busy', holiday: 'flag', outing: 'directions_bus' } as const;

// ---------- one-day changes (KC round 7): "activity can be changed for this week including today, there might be sudden changes in each day" ----------
/** A weekly slot (reset a one-day change) / any session time (a one-day change of a weekly slot or of an extra session). */
const weekSlotSchema = z.enum(['10:30', '13:30']);
type Params = Record<string, string | number>;
export interface DayChange {
  date: ISODate;
  slot: Slot;
  /** the session that runs then; null = no session */
  cell: ScheduleCell | null;
  /** the day's note; undefined keeps it, '' / null removes it */
  note?: string | null;
  notify?: boolean;
  /** replace the default "the activity is now …" message (and who gets it) */
  tell?: { kind: string; params: Params; roles?: StaffRole[]; families?: boolean };
}
/** A one-day change needs an open day with no outing, today or later. */
export function openDayOrFail(d: Draft<ClubState>, ctx: Ctx, date: ISODate) {
  if (date < ctx.today) ctx.fail('cal.err.pastDay');
  const st = dayStatus(d as unknown as ClubState, date);
  if (!st.open) ctx.fail('cal.err.dayClosed');
  if (st.outing) ctx.fail('cal.err.dayOuting');
}
/** Round 14 (B2): the programme of a day can be made on an open day, or on a weekend with nothing programmed yet (its first session opens it). */
function programmableOrFail(d: Draft<ClubState>, ctx: Ctx, date: ISODate) {
  const view = d as unknown as ClubState;
  if (dayProgrammable(view, date, ctx.today)) return;
  const st = dayStatus(view, date);
  const rented = date >= ctx.today && !st.open && st.reason === 'weekend' ? clubHoursRental(view, date) : undefined;
  if (rented) ctx.fail('cal.err.dayRented', { org: rented.org, from: rented.from, to: rented.to }); // a rental in club hours keeps the weekend closed
  openDayOrFail(d, ctx, date);
}
/** The session that runs on a date and slot right now (weekly plan with the one-day changes applied). */
export const effectiveCell = (d: Draft<ClubState>, date: ISODate, slot: Slot): ScheduleCell | null =>
  sessionsOn(d as unknown as ClubState, date).find((x) => x.slot === slot)?.cell ?? null;
/** Tell the activity teachers and every family (or only who `tell` names). */
function tellDay(d: Draft<ClubState>, ctx: Ctx, n: { kind: string; params: Params; roles?: StaffRole[]; families?: boolean }) {
  const families = n.families === false ? [] : allFamilyUsers(d, ctx.today);
  const roles = n.roles ?? ['activity'];
  if (!families.length && !roles.length) return;
  ctx.notify({ toRoles: roles, toUsers: families, kind: n.kind, params: n.params, link: '/calendar' });
}
/**
 * Change one slot of one day, or put it back: the cell is stored in `scheduleDays` (id = date) unless it equals the weekly plan, in which case the
 * slot's change is removed; a day left with no changed slot is deleted. Fails with `err.noChanges` when nothing would change.
 */
export function setDayCell(d: Draft<ClubState>, ctx: Ctx, c: DayChange): void {
  programmableOrFail(d, ctx, c.date);
  if (!isWeekSlot(c.slot)) return setExtraCell(d, ctx, c);
  const slot: WeekSlot = c.slot;
  const view = d as unknown as ClubState;
  const weekly = weeklyCell(view, c.date, slot);
  const cur = effectiveCell(d, c.date, slot);
  if (c.cell) validateCell(d, ctx, c.cell, sameCell(cur, c.cell) || sameCell(weekly, c.cell) || publishedCellKeys(view).has(cellKey(asWeekday(c.date), slot, c.cell)));
  const existing = scheduleDayOf(view, c.date);
  const slots: ScheduleDay['slots'] = {};
  for (const sl of SLOTS) if (existing && sl in existing.slots) slots[sl] = existing.slots[sl] ? { ...(existing.slots[sl] as ScheduleCell) } : null;
  const back = sameCell(c.cell, weekly);
  if (back) delete slots[slot];
  else slots[slot] = c.cell ? { activityId: c.cell.activityId, staffId: c.cell.staffId, roomId: c.cell.roomId } : null;
  const note = c.note === undefined ? existing?.note : c.note?.trim() || undefined;
  const cellChanged = !sameCell(cur, c.cell);
  if (!cellChanged && (note ?? '') === (existing?.note ?? '')) ctx.fail('err.noChanges');
  const extra = existing?.extra?.length ? existing.extra.map(plainExtra) : undefined; // the date's extra sessions stay
  const waiting = waitingOf(existing); // the activity team's edit that waits (and Ega's note) stay beside the live day
  const row = (o: Pick<ScheduleDay, 'slots'> & { note?: string }): ScheduleDay => ({ id: c.date, clubId: ctx.clubId, createdAt: existing ? existing.createdAt : ctx.nowDT, createdBy: existing ? existing.createdBy : ctx.actor, date: c.date, ...o, ...(extra ? { extra } : {}), ...waiting });
  if (!Object.keys(slots).length) {
    if (!existing || (extra && !cellChanged)) ctx.fail('err.noChanges'); // a note alone on a day that runs as planned
    if (extra || Object.keys(waiting).length) d.scheduleDays[c.date] = row({ slots }); // nothing changed in the weekly slots any more: only the extra sessions (or a waiting edit) keep the date
    else delete d.scheduleDays[c.date];
  } else d.scheduleDays[c.date] = row({ slots, ...(note ? { note } : {}) });
  if (!cellChanged) return;
  const name = c.cell ? d.activities[c.cell.activityId]?.name ?? '' : '';
  const p: Params = { date: c.date, slot, ...(c.cell ? { name } : {}) };
  const key = back ? 'dayBack' : c.cell ? 'dayChanged' : 'dayNoSession';
  if (c.notify !== false) tellDay(d, ctx, c.tell ?? { kind: 'cal.notif.' + key, params: p });
  ctx.feed({ icon: back ? 'event_repeat' : 'edit_calendar', key: 'cal.feed.' + key, params: p });
}
const plainExtra = (x: { time: HM; cell: ScheduleCell; note?: string }) => ({ time: x.time, cell: { activityId: x.cell.activityId, staffId: x.cell.staffId, roomId: x.cell.roomId }, ...(x.note ? { note: x.note } : {}) });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** A day's waiting edit and returned note, as plain values to carry onto a rewritten row. */
const waitingOf = (r: ScheduleDay | undefined): Pick<ScheduleDay, 'pending' | 'returned'> => ({ ...(r?.pending ? { pending: clone(r.pending) } : {}), ...(r?.returned ? { returned: clone(r.returned) } : {}) });
/** A row with nothing in it any more (no changed slot, no extra session, nothing waiting) is removed. */
const emptyDay = (r: ScheduleDay) => !Object.keys(r.slots).length && !r.extra?.length && !r.pending && !r.returned;
/** A guest booking can change the activity of an extra session (an extra has no weekly plan to go back to, and no "No session": that is removing it). */
function setExtraCell(d: Draft<ClubState>, ctx: Ctx, c: DayChange): void {
  const row = d.scheduleDays[c.date];
  const x = row && !row.deletedAt ? row.extra?.find((e) => e.time === c.slot) : undefined;
  if (!x || !c.cell) ctx.fail('cal.err.badSlot');
  if (sameCell(x.cell, c.cell)) ctx.fail('err.noChanges');
  validateCell(d, ctx, c.cell, false);
  x.cell = { activityId: c.cell.activityId, staffId: c.cell.staffId, roomId: c.cell.roomId };
  const p: Params = { date: c.date, time: c.slot, name: d.activities[c.cell.activityId]?.name ?? '' };
  if (c.notify !== false) tellDay(d, ctx, c.tell ?? { kind: 'cal.notif.extraChanged', params: p });
  ctx.feed({ icon: 'edit_calendar', key: 'cal.feed.extraChanged', params: p });
}
/** Take a slot's one-day change away without telling anyone (a guest booking that changed the slot was cancelled). */
export function clearDaySlot(d: Draft<ClubState>, date: ISODate, slot: Slot) {
  const row = d.scheduleDays[date];
  if (!row || row.deletedAt || !isWeekSlot(slot) || !(slot in row.slots)) return;
  delete row.slots[slot];
  if (emptyDay(row as ScheduleDay)) delete d.scheduleDays[date];
}

// ---------- round 14 (B1): the activity team's day edits wait for Ega (Ruling 6) ----------
type DayFields = Pick<ScheduleDay, 'slots' | 'extra' | 'note'>;
/** The programme of a day as one comparable value: its changed slots, its extra sessions and its note. */
const dayKey = (f: DayFields | undefined) => JSON.stringify([SLOTS.map((sl) => (f && sl in f.slots ? [sl, f.slots[sl] ? extraCell(f.slots[sl]!) : null] : 0)), (f?.extra ?? []).map(plainExtra), f?.note ?? '']);
/**
 * Run a day edit. Management changes the live day. The activity team's edit waits for management: it runs on the day as the team's waiting edit left it
 * (the live day on the first edit), put in the live day's place so every check sees the day being changed; the outcome is kept in `pending` and the live day
 * goes back as it was. An edit that brings the day back to the live one clears `pending` (Review Focus 5). Notices and the feed wait for the approval.
 */
function editableDay(d: Draft<ClubState>, ctx: Ctx, date: ISODate, edit: (c: Ctx) => void): void {
  if (!needsApproval(ctx)) return edit(ctx);
  const orig = d.scheduleDays[date] ? clone(d.scheduleDays[date] as ScheduleDay) : undefined;
  const liveRow = orig && !orig.deletedAt ? orig : undefined;
  if (liveRow) d.scheduleDays[date] = clone(pendingDayRow(liveRow));
  edit({ ...ctx, feed: () => {}, notify: () => {} });
  const after = d.scheduleDays[date] && !d.scheduleDays[date].deletedAt ? clone(d.scheduleDays[date] as ScheduleDay) : undefined;
  const sent = dayKey(after) !== dayKey(liveRow);
  const { pending: had, returned: _r, ...base } = liveRow ?? { id: date, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date, slots: {} };
  const since = had ? had.base : dayKey(liveRow); // the live day the team started from (kept across its later edits)
  const row: ScheduleDay = { ...base, ...(sent ? { pending: { slots: after?.slots ?? {}, ...(after?.extra?.length ? { extra: after.extra } : {}), ...(after?.note ? { note: after.note } : {}), by: ctx.actor, at: ctx.nowDT, ...(since ? { base: since } : {}) } } : {}) };
  if (!emptyDay(row)) d.scheduleDays[date] = row;
  else if (orig?.deletedAt) d.scheduleDays[date] = orig; // a deleted row stays as it was
  else delete d.scheduleDays[date];
  if (sent && !had) ctx.notify({ toRoles: ['mgmt'], kind: 'cal.notif.dayAsked', params: { date }, link: '/reviews?tab=programme', severity: 'attention' });
  ctx.result.pending = sent;
}
/** Has the live day moved on since the team's waiting edit was made (Ega's own change, a guest booking)? Then approving it would undo that: it is sent back instead. */
export function programmeDayStale(d: Draft<ClubState>, date: ISODate): boolean {
  const row = d.scheduleDays[date];
  return !!row?.pending?.base && row.pending.base !== dayKey(row as ScheduleDay);
}
/** Ega approves a day: the waiting edit becomes the live day; teachers and families hear that the day's programme changed. */
export function approveProgrammeDay(d: Draft<ClubState>, ctx: Ctx, date: ISODate, notify = true): void {
  const row = d.scheduleDays[date];
  const p = clone(row.pending!);
  row.slots = p.slots;
  if (p.extra?.length) row.extra = p.extra; else delete row.extra;
  if (p.note) row.note = p.note; else delete row.note;
  delete row.pending;
  delete row.returned;
  if (emptyDay(row as ScheduleDay)) delete d.scheduleDays[date];
  if (notify) tellDay(d, ctx, { kind: 'cal.notif.dayUpdated', params: { date } });
  ctx.feed({ icon: 'edit_calendar', key: 'cal.feed.dayUpdated', params: { date } });
}
/** Ega sends a day back: the waiting edit goes, her note stays for the team. Returns who sent it. */
export function returnProgrammeDay(d: Draft<ClubState>, ctx: Ctx, date: ISODate, note: string): string {
  const row = d.scheduleDays[date];
  const by = row.pending!.by;
  delete row.pending;
  row.returned = { note, by: ctx.actor, at: ctx.nowDT };
  return by;
}
/** Was another weekly version published after this one was sent (Ega's own, or one she approved)? Then approving it would quietly override that: it is a conflict. */
export function programmeVersionStale(d: Draft<ClubState>, id: string): boolean {
  const v = d.scheduleVersions[id];
  return Object.values(d.scheduleVersions).some((o) => o.id !== id && !o.deletedAt && o.status === 'published' && !!o.publishedAt && o.publishedAt > v.createdAt);
}
/** Ega approves a weekly version: it is published from its date, or from today once that date has passed (Review Focus 5); everyone is told. */
export function approveProgrammeVersion(d: Draft<ClubState>, ctx: Ctx, id: string, notify = true): void {
  const v = d.scheduleVersions[id];
  const from = publishDateOf(v as ScheduleVersion, ctx.today);
  v.status = 'published';
  v.effectiveFrom = from;
  v.publishedBy = ctx.actor;
  v.publishedAt = ctx.nowDT;
  notifyEveryone(d, ctx, { kind: 'cal.notif.schedulePublished', params: { date: fmtDMY(from) } }, notify);
  ctx.feed({ icon: 'event_available', key: 'cal.feed.schedulePublished', params: { date: fmtDMY(from) } });
}

// ---------- extra sessions (KC round 7): "add an extra activity session at any time" on one date ----------
const extraBase = z.object({
  date: isoDate,
  time: hm,
  activityId: z.string().min(1),
  staffId: z.string().min(1),
  roomId: z.string().min(1),
  note: z.string().trim().max(160).nullish(),
  notify: z.boolean().optional(),
});
type ExtraInput = z.infer<typeof extraBase>;
const dayRow = (d: Draft<ClubState>, ctx: Ctx, date: ISODate): Draft<ScheduleDay> => {
  const cur = d.scheduleDays[date];
  if (cur && !cur.deletedAt) return cur;
  d.scheduleDays[date] = { id: date, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date, slots: {} };
  return d.scheduleDays[date];
};
const extraCell = (x: { activityId: string; staffId: string; roomId: string }): ScheduleCell => ({ activityId: x.activityId, staffId: x.staffId, roomId: x.roomId });
/** An extra session cannot move or go away while people are marked in its round, or a guest host is booked for it (it has to be cleared first, nothing is lost silently). */
function extraLocked(d: Draft<ClubState>, ctx: Ctx, date: ISODate, time: HM) {
  if (live(d.dailyLogs as ClubState['dailyLogs']).some((l) => l.date === date && !!l.sessions && time in l.sessions)) ctx.fail('cal.err.sessionMarked', { time });
  const g = guestOn(d as unknown as ClubState, date, time);
  if (g) ctx.fail('cal.err.sessionGuest', { name: g.host.name });
}
const extraParams = (d: Draft<ClubState>, date: ISODate, time: HM, activityId: string): Params => ({ date, time, name: d.activities[activityId]?.name ?? '' });

export const scheduleActions = [
  defineAction<{ days: Days; effectiveFrom?: ISODate }>({
    name: 'schedule.saveDraft',
    can: (u) => builders(u),
    parse: (raw) => {
      const r = parseWith(z.object({ days: daysSchema, effectiveFrom: isoDate.optional() }), raw);
      return { days: toDays(r.days), effectiveFrom: r.effectiveFrom };
    },
    run(d, input, ctx) {
      validateDays(d, ctx, input.days);
      const prev = d.scheduleVersions[DRAFT_ID];
      const effectiveFrom = input.effectiveFrom ?? (prev && !prev.deletedAt ? prev.effectiveFrom : nextMonday(ctx.today));
      d.scheduleVersions[DRAFT_ID] = {
        id: DRAFT_ID, clubId: ctx.clubId, createdAt: prev && !prev.deletedAt ? prev.createdAt : ctx.nowDT, createdBy: prev && !prev.deletedAt ? prev.createdBy : ctx.actor,
        effectiveFrom, status: 'draft', days: storedDays(input.days), submittedBy: ctx.actor,
      };
    },
  }),
  defineAction<{ effectiveFrom: ISODate; days?: Days; notify?: boolean }>({
    name: 'schedule.publish',
    can: (u) => builders(u), // round 14: the activity team's publish is a request: the version waits for Ega
    parse: (raw) => {
      const r = parseWith(z.object({ effectiveFrom: isoDate.optional(), days: daysSchema.optional(), notify: z.boolean().optional() }), raw ?? {});
      return { effectiveFrom: r.effectiveFrom ?? '', days: r.days ? toDays(r.days) : undefined, notify: r.notify };
    },
    run(d, input, ctx) {
      const view = d as unknown as ClubState;
      // default: next Monday. KC round 7: today or any later date is fine (editing this week's plan publishes from today); days before it keep the schedule they have.
      const effectiveFrom = input.effectiveFrom || nextMonday(ctx.today);
      if (effectiveFrom < ctx.today) ctx.fail('cal.err.futureOnly');
      const draft = d.scheduleVersions[DRAFT_ID];
      const days: Days = input.days ?? (draft && !draft.deletedAt ? normalizeDays(draft.days as never) : undefined) ?? ctx.fail('cal.err.noDraft');
      validateDays(d, ctx, days);
      const inForce = scheduleVersionFor(view, effectiveFrom);
      if (inForce && daysEqual(normalizeDays(inForce.days as never), days)) ctx.fail('err.noChanges');
      const id = ctx.id('sched');
      const gated = needsApproval(ctx);
      d.scheduleVersions[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, effectiveFrom, status: gated ? 'pending' : 'published', days: storedDays(days), submittedBy: ctx.actor, ...(gated ? {} : { publishedBy: ctx.actor, publishedAt: ctx.nowDT }) };
      delete d.scheduleVersions[DRAFT_ID];
      for (const v of Object.values(d.scheduleVersions)) if (v.status === 'rejected' && !v.deletedAt) v.deletedAt = ctx.nowDT; // a version Ega sent back is replaced by this one
      if (gated) {
        ctx.notify({ toRoles: ['mgmt'], kind: 'cal.notif.programmeAsked', params: { date: fmtDMY(effectiveFrom) }, link: '/reviews?tab=programme', severity: 'attention' });
        ctx.result.pending = true;
      } else {
        notifyEveryone(d, ctx, { kind: 'cal.notif.schedulePublished', params: { date: fmtDMY(effectiveFrom) } }, input.notify !== false);
        ctx.feed({ icon: 'event_available', key: 'cal.feed.schedulePublished', params: { date: fmtDMY(effectiveFrom) } });
      }
      ctx.result.versionId = id;
      ctx.result.effectiveFrom = effectiveFrom;
    },
  }),

  defineAction<EventInput>({
    name: 'calendarEvent.create',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(eventSchema, raw),
    run(d, input, ctx) {
      const f = eventFields(input, ctx);
      const id = ctx.id('ev');
      d.calendarEvents[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, ...f };
      notifyEveryone(d, ctx, { kind: 'cal.notif.added_' + f.kind, params: { date: dateText(f.date, f.endDate) } }, input.notify !== false);
      ctx.feed({ icon: KIND_ICON[f.kind], key: 'cal.feed.added_' + f.kind, params: { date: dateText(f.date, f.endDate) } });
      ctx.result.eventId = id;
    },
  }),
  defineAction<UpdateInput>({
    name: 'calendarEvent.update',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(updateSchema, raw),
    run(d, input, ctx) {
      const cur = d.calendarEvents[input.eventId];
      if (!cur || cur.deletedAt) ctx.fail('err.notFound');
      if ((cur.endDate || cur.date) < ctx.today) ctx.fail('cal.err.pastEvent');
      const next: EventInput = {
        date: input.date ?? cur.date,
        endDate: input.endDate === undefined ? cur.endDate ?? null : input.endDate,
        kind: input.kind ?? cur.kind,
        title: input.title ?? cur.title,
        titleId: input.titleId === undefined ? cur.titleId ?? null : input.titleId,
        from: input.from === undefined ? cur.from ?? null : input.from,
        to: input.to === undefined ? cur.to ?? null : input.to,
      };
      // a date that already started cannot move into the past; only validate the date when it changes
      const f = eventFields({ ...next, date: next.date < ctx.today && next.date === cur.date ? ctx.today : next.date }, ctx);
      const row = d.calendarEvents[input.eventId];
      row.date = next.date;
      row.kind = f.kind;
      row.title = f.title;
      if (f.endDate) row.endDate = f.endDate; else delete row.endDate;
      if (f.titleId) row.titleId = f.titleId; else delete row.titleId;
      if (f.from && f.to) { row.from = f.from; row.to = f.to; } else { delete row.from; delete row.to; }
      notifyEveryone(d, ctx, { kind: 'cal.notif.changed_' + f.kind, params: { date: dateText(next.date, f.endDate) } }, input.notify !== false);
      ctx.feed({ icon: KIND_ICON[f.kind], key: 'cal.feed.changed_' + f.kind, params: { date: dateText(next.date, f.endDate) } });
    },
  }),
  defineAction<{ eventId: string; notify?: boolean }>({
    name: 'calendarEvent.delete',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(z.object({ eventId: z.string().min(1), notify: z.boolean().optional() }), raw),
    run(d, input, ctx) {
      const cur = d.calendarEvents[input.eventId];
      if (!cur || cur.deletedAt) ctx.fail('err.notFound');
      if ((cur.endDate || cur.date) < ctx.today) ctx.fail('cal.err.pastEvent');
      cur.deletedAt = ctx.nowDT;
      notifyEveryone(d, ctx, { kind: 'cal.notif.removed_' + cur.kind, params: { date: dateText(cur.date, cur.endDate) } }, input.notify !== false);
      ctx.feed({ icon: KIND_ICON[cur.kind], key: 'cal.feed.removed_' + cur.kind, params: { date: dateText(cur.date, cur.endDate) } });
    },
  }),

  defineAction<{ id?: string; name: string; nameId?: string | null; icon?: string; roomId?: string; roomOther?: string; active?: boolean; photoMediaId?: string | null }>({
    name: 'activity.upsert',
    can: (u) => mgmtOnly(u), // KC round 6: activity teachers see the schedule but cannot change it
    parse: (raw) => {
      const r = parseWith(
        z.object({
          id: z.string().min(1).optional(),
          name: z.string().trim().min(1).max(80),
          nameId: z.string().trim().max(80).nullish(),
          icon: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/).optional(),
          roomId: z.string().min(1).optional(),
          /** "Other": a room that is not in the catalog yet, typed as free text. An existing room with that name is reused, otherwise it is added. */
          roomOther: z.string().trim().min(1).max(80).optional(),
          active: z.boolean().optional(),
          /** the activity's picture; null removes it */
          photoMediaId: z.string().nullable().optional(),
        }),
        raw,
      );
      if (!r.roomId && !r.roomOther) throw new DomainError('err.invalid', { field: 'roomId' });
      const photo = r.photoMediaId === undefined ? undefined : r.photoMediaId === null ? null : mediaIdOf(r.photoMediaId);
      if (r.photoMediaId && !photo) throw new DomainError('err.invalid', { field: 'photoMediaId' });
      return { ...r, photoMediaId: photo };
    },
    run(d, input, ctx) {
      let roomId = input.roomId;
      if (input.roomOther) {
        const low = input.roomOther.toLowerCase();
        const same = live(d.rooms as ClubState['rooms']).find((r) => r.name.trim().toLowerCase() === low || (r.nameId || '').trim().toLowerCase() === low);
        if (same) roomId = same.id;
        else {
          roomId = ctx.id('room');
          d.rooms[roomId] = { id: roomId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.roomOther, venue: false };
          ctx.result.roomCreated = true;
        }
      }
      const room = d.rooms[roomId ?? ''];
      if (!room || room.deletedAt) ctx.fail('cal.err.badRoom');
      ctx.result.roomId = room.id;
      const dup = live(d.activities as ClubState['activities']).some((a) => a.id !== input.id && a.name.trim().toLowerCase() === input.name.toLowerCase());
      if (dup) ctx.fail('cal.err.dupName', { name: input.name });
      if (input.id) {
        const a = d.activities[input.id];
        if (!a || a.deletedAt) ctx.fail('err.notFound');
        a.name = input.name;
        if (input.nameId) a.nameId = input.nameId; else delete a.nameId;
        if (input.icon) a.icon = input.icon;
        a.roomId = room.id;
        if (input.active !== undefined) a.active = input.active;
        if (input.photoMediaId) a.photoMediaId = input.photoMediaId; else if (input.photoMediaId === null) delete a.photoMediaId;
        ctx.result.activityId = a.id;
        return;
      }
      const id = ctx.id('actv');
      d.activities[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.name, ...(input.nameId ? { nameId: input.nameId } : {}), icon: input.icon || 'interests', roomId: room.id, active: input.active ?? true, ...(input.photoMediaId ? { photoMediaId: input.photoMediaId } : {}) };
      ctx.result.activityId = id;
    },
  }),
  defineAction<{ id?: string; name: string; nameId?: string | null; venue?: boolean }>({
    name: 'room.upsert',
    can: (u) => mgmtOnly(u),
    parse: (raw) =>
      parseWith(
        z.object({ id: z.string().min(1).optional(), name: z.string().trim().min(1).max(80), nameId: z.string().trim().max(80).nullish(), venue: z.boolean().optional() }),
        raw,
      ),
    run(d, input, ctx) {
      const dup = live(d.rooms as ClubState['rooms']).some((r) => r.id !== input.id && r.name.trim().toLowerCase() === input.name.toLowerCase());
      if (dup) ctx.fail('cal.err.dupName', { name: input.name });
      if (input.id) {
        const r = d.rooms[input.id];
        if (!r || r.deletedAt) ctx.fail('err.notFound');
        r.name = input.name;
        if (input.nameId) r.nameId = input.nameId; else delete r.nameId;
        if (input.venue !== undefined) r.venue = input.venue;
        ctx.result.roomId = r.id;
        return;
      }
      const id = ctx.id('room');
      d.rooms[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.name, ...(input.nameId ? { nameId: input.nameId } : {}), venue: input.venue ?? false };
      ctx.result.roomId = id;
    },
  }),
  // ---------- one-day changes ----------
  defineAction<{ date: ISODate; slot: Slot; cell: ScheduleCell | null; note?: string | null; notify?: boolean }>({
    name: 'schedule.changeDay',
    can: (u) => builders(u), // like the weekly schedule: the activity team's change waits for Ega
    parse: (raw) =>
      parseWith(z.object({ date: isoDate, slot: hm, cell: cellSchema, note: z.string().trim().max(160).nullish(), notify: z.boolean().optional() }), raw),
    run(d, input, ctx) {
      editableDay(d, ctx, input.date, (c) => setDayCell(d, c, input));
      ctx.result.date = input.date;
    },
  }),
  defineAction<ExtraInput>({
    name: 'schedule.addSession',
    can: (u) => builders(u),
    parse: (raw) => parseWith(extraBase, raw),
    run: (d, input, c0) => editableDay(d, c0, input.date, (ctx) => {
      programmableOrFail(d, ctx, input.date);
      const issue = extraTimeIssue(d as unknown as ClubState, input.date, input.time);
      if (issue) ctx.fail(issue.code, issue.params);
      const cell = extraCell(input);
      validateCell(d, ctx, cell, false);
      const row = dayRow(d, ctx, input.date);
      const note = input.note?.trim() || undefined;
      row.extra = sortBy([...(row.extra ?? []).map(plainExtra), { time: input.time, cell, ...(note ? { note } : {}) }], (x) => x.time);
      const p = extraParams(d, input.date, input.time, cell.activityId);
      if (input.notify !== false) tellDay(d, ctx, { kind: 'cal.notif.extraAdded', params: p });
      ctx.feed({ icon: 'more_time', key: 'cal.feed.extraAdded', params: p });
      ctx.result.date = input.date;
      ctx.result.time = input.time;
    }),
  }),
  defineAction<ExtraInput & { toTime?: HM }>({
    name: 'schedule.editSession',
    can: (u) => builders(u),
    parse: (raw) => parseWith(extraBase.extend({ toTime: hm.optional() }), raw),
    run: (d, input, c0) => editableDay(d, c0, input.date, (ctx) => {
      programmableOrFail(d, ctx, input.date);
      const view = d as unknown as ClubState;
      const cur = extrasOn(view, input.date).find((x) => x.time === input.time) ?? ctx.fail('err.notFound');
      const to = input.toTime ?? input.time;
      const moved = to !== input.time;
      if (moved) {
        const issue = extraTimeIssue(view, input.date, to, input.time);
        if (issue) ctx.fail(issue.code, issue.params);
        extraLocked(d, ctx, input.date, input.time);
      }
      const cell = extraCell(input);
      const same = sameCell(cur.cell, cell);
      validateCell(d, ctx, cell, same);
      const note = input.note === undefined ? cur.note : input.note?.trim() || undefined;
      if (!moved && same && (note ?? '') === (cur.note ?? '')) ctx.fail('err.noChanges');
      const row = dayRow(d, ctx, input.date);
      row.extra = sortBy((row.extra ?? []).map((x) => (x.time === input.time ? { time: to, cell, ...(note ? { note } : {}) } : plainExtra(x))), (x) => x.time);
      if (moved || !same) { // a note alone is for staff only: nobody is told
        const p = extraParams(d, input.date, to, cell.activityId);
        if (input.notify !== false) tellDay(d, ctx, { kind: 'cal.notif.extraChanged', params: p });
        ctx.feed({ icon: 'edit_calendar', key: 'cal.feed.extraChanged', params: p });
      }
      ctx.result.date = input.date;
      ctx.result.time = to;
    }),
  }),
  defineAction<{ date: ISODate; time: HM; notify?: boolean }>({
    name: 'schedule.removeSession',
    can: (u) => builders(u),
    parse: (raw) => parseWith(z.object({ date: isoDate, time: hm, notify: z.boolean().optional() }), raw),
    run: (d, input, c0) => editableDay(d, c0, input.date, (ctx) => {
      if (input.date < ctx.today) ctx.fail('cal.err.pastDay');
      const cur = extrasOn(d as unknown as ClubState, input.date).find((x) => x.time === input.time) ?? ctx.fail('err.notFound');
      extraLocked(d, ctx, input.date, input.time);
      const row = d.scheduleDays[input.date];
      const rest = (row.extra ?? []).filter((x) => x.time !== input.time).map(plainExtra);
      if (rest.length) row.extra = rest;
      else {
        delete row.extra;
        if (emptyDay(row as ScheduleDay)) delete d.scheduleDays[input.date];
      }
      const p = extraParams(d, input.date, input.time, cur.cell.activityId);
      if (input.notify !== false) tellDay(d, ctx, { kind: 'cal.notif.extraRemoved', params: p });
      ctx.feed({ icon: 'event_busy', key: 'cal.feed.extraRemoved', params: p });
      ctx.result.date = input.date;
    }),
  }),
  defineAction<{ date: ISODate; slot?: WeekSlot; notify?: boolean }>({
    name: 'schedule.resetDay',
    can: (u) => builders(u),
    parse: (raw) => parseWith(z.object({ date: isoDate, slot: weekSlotSchema.optional(), notify: z.boolean().optional() }), raw),
    run: (d, input, c0) => editableDay(d, c0, input.date, (ctx) => {
      if (input.date < ctx.today) ctx.fail('cal.err.pastDay');
      const changed = SLOTS.filter((sl) => sl in (scheduleDayOf(d as unknown as ClubState, input.date)?.slots ?? {}));
      const slots = input.slot ? [input.slot] : changed;
      if (!slots.length || slots.some((sl) => !changed.includes(sl))) ctx.fail('err.noChanges');
      for (const sl of slots) clearDaySlot(d, input.date, sl);
      const p: Params = input.slot ? { date: input.date, slot: input.slot } : { date: input.date };
      const key = input.slot ? 'dayBack' : 'dayBackAll';
      if (input.notify !== false) tellDay(d, ctx, { kind: 'cal.notif.' + key, params: p });
      ctx.feed({ icon: 'event_repeat', key: 'cal.feed.' + key, params: p });
      ctx.result.date = input.date;
    }),
  }),
];
