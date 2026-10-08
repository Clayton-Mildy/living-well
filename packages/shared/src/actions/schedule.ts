// Schedule and calendar actions: weekly schedule drafts and dated versions, closures / holidays / outings, activity and room catalog.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { CalendarEvent, ClubState, ISODate, Member, ScheduleCell, ScheduleDay, Slot, StaffRole, Weekday } from '../types';
import { DomainError, defineAction, hasRole, type Ctx } from './framework';
import { dayStatus, membershipStatus } from '../rules/core';
import { scheduleDayOf, scheduleVersionFor, sessionsOn } from '../rules/kitchen';
import { DRAFT_ID, SLOTS, WEEKDAYS, cellKey, daysEqual, fmtDMY, nextMonday, normalizeDays, publishedCellKeys, sameCell, weeklyCell, type Days } from '../rules/calendar';
import { diffDays, dow, live, uniq } from '../util';
import { mediaIdOf } from './members';

const mgmtOnly = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'mgmt');
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
const daysSchema = z.object({ '1': daySchema, '2': daySchema, '3': daySchema, '4': daySchema, '5': daySchema });
const toDays = (x: z.infer<typeof daysSchema>) => normalizeDays(x as never);

/** Existence checks always; role / active checks only for cells that no published version already has (so old cells stay valid after a teacher or activity changes). */
function validateDays(d: Draft<ClubState>, ctx: Ctx, days: Days) {
  const published = publishedCellKeys(d as unknown as ClubState);
  for (const w of WEEKDAYS) for (const slot of SLOTS) {
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
const slotSchema = z.enum(['10:30', '13:30']);
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
  openDayOrFail(d, ctx, c.date);
  const view = d as unknown as ClubState;
  const weekly = weeklyCell(view, c.date, c.slot);
  const cur = effectiveCell(d, c.date, c.slot);
  if (c.cell) validateCell(d, ctx, c.cell, sameCell(cur, c.cell) || sameCell(weekly, c.cell) || publishedCellKeys(view).has(cellKey(dow(c.date) as Weekday, c.slot, c.cell)));
  const existing = scheduleDayOf(view, c.date);
  const slots: ScheduleDay['slots'] = {};
  for (const sl of SLOTS) if (existing && sl in existing.slots) slots[sl] = existing.slots[sl] ? { ...(existing.slots[sl] as ScheduleCell) } : null;
  const back = sameCell(c.cell, weekly);
  if (back) delete slots[c.slot];
  else slots[c.slot] = c.cell ? { activityId: c.cell.activityId, staffId: c.cell.staffId, roomId: c.cell.roomId } : null;
  const note = c.note === undefined ? existing?.note : c.note?.trim() || undefined;
  const cellChanged = !sameCell(cur, c.cell);
  if (!cellChanged && (note ?? '') === (existing?.note ?? '')) ctx.fail('err.noChanges');
  if (!Object.keys(slots).length) {
    if (!existing) ctx.fail('err.noChanges'); // a note alone on a day that runs as planned
    delete d.scheduleDays[c.date];
  } else d.scheduleDays[c.date] = { id: c.date, clubId: ctx.clubId, createdAt: existing ? existing.createdAt : ctx.nowDT, createdBy: existing ? existing.createdBy : ctx.actor, date: c.date, slots, ...(note ? { note } : {}) };
  if (!cellChanged) return;
  const name = c.cell ? d.activities[c.cell.activityId]?.name ?? '' : '';
  const p: Params = { date: c.date, slot: c.slot, ...(c.cell ? { name } : {}) };
  const key = back ? 'dayBack' : c.cell ? 'dayChanged' : 'dayNoSession';
  if (c.notify !== false) tellDay(d, ctx, c.tell ?? { kind: 'cal.notif.' + key, params: p });
  ctx.feed({ icon: back ? 'event_repeat' : 'edit_calendar', key: 'cal.feed.' + key, params: p });
}
/** Take a slot's one-day change away without telling anyone (a guest booking that changed the slot was cancelled). */
export function clearDaySlot(d: Draft<ClubState>, date: ISODate, slot: Slot) {
  const row = d.scheduleDays[date];
  if (!row || row.deletedAt || !(slot in row.slots)) return;
  delete row.slots[slot];
  if (!Object.keys(row.slots).length) delete d.scheduleDays[date];
}

export const scheduleActions = [
  defineAction<{ days: Days; effectiveFrom?: ISODate }>({
    name: 'schedule.saveDraft',
    can: (u) => mgmtOnly(u), // KC round 6: activity teachers see the schedule but cannot change it
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
        effectiveFrom, status: 'draft', days: input.days, submittedBy: ctx.actor,
      };
    },
  }),
  defineAction<{ effectiveFrom: ISODate; days?: Days; notify?: boolean }>({
    name: 'schedule.publish',
    can: (u) => mgmtOnly(u), // KC round 6: activity teachers see the schedule but cannot change it
    parse: (raw) => {
      const r = parseWith(z.object({ effectiveFrom: isoDate.optional(), days: daysSchema.optional(), notify: z.boolean().optional() }), raw ?? {});
      return { effectiveFrom: r.effectiveFrom ?? '', days: r.days ? toDays(r.days) : undefined, notify: r.notify };
    },
    run(d, input, ctx) {
      const view = d as unknown as ClubState;
      // default: next Monday. Any future date is fine; today and the past keep the schedule they have.
      const effectiveFrom = input.effectiveFrom || nextMonday(ctx.today);
      if (effectiveFrom <= ctx.today) ctx.fail('cal.err.futureOnly');
      const draft = d.scheduleVersions[DRAFT_ID];
      const days: Days = input.days ?? (draft && !draft.deletedAt ? normalizeDays(draft.days as never) : undefined) ?? ctx.fail('cal.err.noDraft');
      validateDays(d, ctx, days);
      const inForce = scheduleVersionFor(view, effectiveFrom);
      if (inForce && daysEqual(normalizeDays(inForce.days as never), days)) ctx.fail('err.noChanges');
      const id = ctx.id('sched');
      d.scheduleVersions[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, effectiveFrom, status: 'published', days, submittedBy: ctx.actor, publishedBy: ctx.actor, publishedAt: ctx.nowDT };
      delete d.scheduleVersions[DRAFT_ID];
      notifyEveryone(d, ctx, { kind: 'cal.notif.schedulePublished', params: { date: fmtDMY(effectiveFrom) } }, input.notify !== false);
      ctx.feed({ icon: 'event_available', key: 'cal.feed.schedulePublished', params: { date: fmtDMY(effectiveFrom) } });
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
    can: (u) => mgmtOnly(u), // like the weekly schedule: management only; teachers see the changed programme
    parse: (raw) =>
      parseWith(z.object({ date: isoDate, slot: slotSchema, cell: cellSchema, note: z.string().trim().max(160).nullish(), notify: z.boolean().optional() }), raw),
    run(d, input, ctx) {
      setDayCell(d, ctx, input);
      ctx.result.date = input.date;
    },
  }),
  defineAction<{ date: ISODate; slot?: Slot; notify?: boolean }>({
    name: 'schedule.resetDay',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(z.object({ date: isoDate, slot: slotSchema.optional(), notify: z.boolean().optional() }), raw),
    run(d, input, ctx) {
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
    },
  }),
];
