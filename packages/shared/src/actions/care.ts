// Care actions: daily logs, and the moderation of stored photos (retag, hide, restore, remove). Activity teachers and management; the nurse may also write daily logs.
// Taking photos and the management review (approve / reject) live in photos.ts.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { ClubState, DailyLog, ISODate, Slot } from '../types';
import { DomainError, defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { namesOf, notifyPhotoFamilies } from './photos';
import { isPendingRow } from '../rules/core';
import { LUNCH_AMOUNTS, NORMAL_LOG, SESSION_MARKS, attendedOn, joinedOf, logDateOk, logId, logsOn, roundsOf, type LunchAmount, type SessionMark } from '../rules/activity';
import { fmtDMY } from '../rules/calendar';
import { attId } from '../rules/attendance';
import { uniq } from '../util';
import { LOG_KEYS, approvedVersion } from '../rules/approvals';
import { clearApproval, markPending, needsApproval, priorOf } from './approvalGate';

const logWriters = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'activity', 'nurse', 'mgmt');
const photoWriters = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'activity', 'mgmt');

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  return r.data;
}
const isoDate = z.string().refine((s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
});

// ---------- daily log ----------
// KC round 7: the log is filled in rounds. `log.mark` marks lunch / a session / mood for many members at once (one tap per person); `log.save` writes
// the Mood & notes round of one member (mood, communicative, content, the note for the family and the staff note). Every part can be saved alone.
const moodEnum = z.enum(['cheerful', 'calm', 'quiet', 'agitated']);
const lunchEnum = z.enum(LUNCH_AMOUNTS);
const markEnum = z.enum(SESSION_MARKS);
const slotEnum = z.enum(['10:30', '13:30']);
const logSchema = z.object({
  memberId: z.string().min(1),
  date: isoDate,
  mood: moodEnum.optional(),
  lunch: lunchEnum.optional(),
  joined: z.enum(['yes', 'satOut']).optional(),
  communicative: z.enum(['normal', 'withdrawn']).optional(),
  content: z.enum(['normal', 'low']).optional(),
  note: z.string().trim().max(600).default(''),
  staffNote: z.string().trim().max(600).optional(),
});
export type LogInput = z.infer<typeof logSchema>;
/** "unsettled" is the label of the stored mood 'agitated'; accept either spelling. */
const withMood = (raw: unknown) => (raw && typeof raw === 'object' && (raw as { mood?: unknown }).mood === 'unsettled' ? { ...(raw as object), mood: 'agitated' } : raw);

/**
 * Create or update the log row with the Mood & notes round. Returns whether it was an edit of an already saved round.
 * A log written by anyone but management waits for approval: families neither see it nor hear about it until management approves
 * (an edit of an approved log keeps showing the last approved values). Management's own logs are approved at once.
 */
function writeLog(d: Draft<ClubState>, ctx: Ctx, i: LogInput): 'created' | 'edited' {
  const id = logId(i.memberId, i.date);
  const found = d.dailyLogs[id];
  const prev = found && !found.deletedAt ? found : undefined;
  const gated = needsApproval(ctx);
  let kind: 'created' | 'edited' = 'created';
  let before: Record<string, unknown> | undefined;
  let seen = false; // the family has (had) an approved version of this round
  if (prev) {
    kind = prev.status === 'saved' && prev.mood !== undefined ? 'edited' : 'created'; // a row that only has lunch or a session marked is a new Mood & notes entry
    before = priorOf(prev, LOG_KEYS);
    seen = approvedVersion(prev, LOG_KEYS)?.mood !== undefined;
    if (i.mood !== undefined) prev.mood = i.mood;
    if (i.lunch !== undefined) prev.lunch = i.lunch;
    if (i.communicative !== undefined) prev.communicative = i.communicative;
    if (i.content !== undefined) prev.content = i.content;
    prev.note = i.note;
    if (i.staffNote !== undefined) { if (i.staffNote) prev.staffNote = i.staffNote; else delete prev.staffNote; }
    prev.status = 'saved';
    if (kind === 'edited') prev.edits.push({ at: ctx.nowDT, by: ctx.user.id });
    else prev.by = ctx.user.id;
  } else {
    const row: DailyLog = {
      id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: i.memberId, date: i.date, note: i.note, status: 'saved', by: ctx.user.id, edits: [],
      ...(i.mood !== undefined ? { mood: i.mood } : {}), ...(i.lunch !== undefined ? { lunch: i.lunch } : {}), ...(i.communicative !== undefined ? { communicative: i.communicative } : {}),
      ...(i.content !== undefined ? { content: i.content } : {}), ...(i.staffNote ? { staffNote: i.staffNote } : {}),
    };
    d.dailyLogs[id] = row;
  }
  const row = d.dailyLogs[id];
  // `joined` follows the session marks; only a log without sessions (older logs, days with no session) takes it as given
  const j = joinedOf(row.sessions);
  if (j) row.joined = j; else if (i.joined !== undefined) row.joined = i.joined;
  const name = shortOf(d, i.memberId);
  if (gated) markPending(row, ctx, before);
  else {
    clearApproval(row);
    const to = familyUserIds(d, i.memberId);
    if (to.length && row.mood !== undefined) ctx.notify({ toUsers: to, kind: seen ? 'activity.notif.logUpdated' : 'activity.notif.logSaved', params: { name }, link: '/today', memberId: i.memberId, ref: { type: 'dailyLog', id } });
  }
  ctx.feed({ icon: 'edit_note', key: kind === 'edited' ? 'activity.feed.logEdited' : 'activity.feed.log', params: { name, date: fmtDMY(i.date) }, memberId: i.memberId });
  return kind;
}
function checkLogDay(ctx: Ctx, date: ISODate) {
  if (!logDateOk(ctx.today, date)) ctx.fail('activity.err.dateRange');
}
function requireAttended(d: Draft<ClubState>, ctx: Ctx, memberId: string, date: ISODate) {
  requireMember(d, memberId, ctx);
  if (!d.attendance[attId(date, memberId)]?.checkIn) ctx.fail('activity.err.notAttended', { name: shortOf(d, memberId) });
}

/** The parts of a round to set on one member's log: a value sets it, null clears it (undefined leaves it alone). */
interface Marks { lunch?: LunchAmount | null; mood?: DailyLog['mood'] | null; communicative?: DailyLog['communicative'] | null; content?: DailyLog['content'] | null; sessions?: Partial<Record<Slot, SessionMark | null>> }
const SIMPLE_MARKS = ['lunch', 'mood', 'communicative', 'content'] as const;
const logEmpty = (r: DailyLog) => r.mood === undefined && r.lunch === undefined && r.communicative === undefined && r.content === undefined && !r.sessions && r.joined === undefined && !r.note && !r.staffNote;
/**
 * Mark rounds on one member's log (creating the row on the first mark) and send it to approval like any entry by non-management staff.
 * `onlyEmpty` leaves parts that are already marked alone ("mark the rest"). Returns whether anything changed; nothing changed = no row is touched.
 * Families hear nothing from a mark: they are told when the Mood & notes round is saved and approved.
 */
function applyMarks(d: Draft<ClubState>, ctx: Ctx, memberId: string, date: ISODate, m: Marks, onlyEmpty: boolean): boolean {
  const id = logId(memberId, date);
  const found = d.dailyLogs[id];
  const row0 = found && !found.deletedAt ? found : undefined;
  const wanted = (cur: unknown, v: unknown) => v !== undefined && !(onlyEmpty && cur !== undefined) && (v === null ? cur !== undefined : cur !== v);
  const sets = SIMPLE_MARKS.filter((k) => wanted(row0?.[k], m[k]));
  const slots = (Object.keys(m.sessions ?? {}) as Slot[]).filter((k) => wanted(row0?.sessions?.[k], m.sessions![k]));
  if (!sets.length && !slots.length) return false;
  const before = row0 ? priorOf(row0, LOG_KEYS) : undefined;
  if (!row0) {
    d.dailyLogs[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId, date, note: '', status: 'saved', by: ctx.user.id, edits: [] };
  }
  const row = d.dailyLogs[id];
  const r = row as unknown as Record<string, unknown>;
  for (const k of sets) { if (m[k] === null) delete r[k]; else r[k] = m[k]; }
  if (slots.length) {
    const ses: Partial<Record<Slot, SessionMark>> = { ...(row.sessions ?? {}) };
    for (const k of slots) { const v = m.sessions![k]; if (v === null || v === undefined) delete ses[k]; else ses[k] = v; }
    if (Object.keys(ses).length) row.sessions = ses; else delete row.sessions;
    const j = joinedOf(row.sessions);
    if (j) row.joined = j; else delete row.joined;
  }
  row.status = 'saved';
  if (logEmpty(row) && (!needsApproval(ctx) || !before || !Object.keys(before).some((k) => k !== 'note'))) { // cleared back to nothing and families never saw anything of it
    row.deletedAt = ctx.nowDT;
    return true;
  }
  if (needsApproval(ctx)) markPending(row, ctx, before);
  else {
    clearApproval(row);
    const to = row0?.mood === undefined && row.mood !== undefined ? familyUserIds(d, memberId) : []; // management completed the Mood & notes round: the family hears now
    if (to.length) ctx.notify({ toUsers: to, kind: 'activity.notif.logSaved', params: { name: shortOf(d, memberId) }, link: '/today', memberId, ref: { type: 'dailyLog', id } });
  }
  return true;
}

const markSchema = z.object({
  date: isoDate,
  memberIds: z.array(z.string().min(1)).min(1).max(120),
  lunch: lunchEnum.nullable().optional(),
  session: z.object({ slot: slotEnum, value: markEnum.nullable() }).optional(),
  mood: moodEnum.nullable().optional(),
  communicative: z.enum(['normal', 'withdrawn']).nullable().optional(),
  content: z.enum(['normal', 'low']).nullable().optional(),
  onlyEmpty: z.boolean().optional(),
}).refine((x) => x.lunch !== undefined || x.session !== undefined || x.mood !== undefined || x.communicative !== undefined || x.content !== undefined);
export type MarkInput = z.infer<typeof markSchema>;

// ---------- photos (taking and reviewing photos is in photos.ts; here the moderation of what is already stored) ----------
const reasonSchema = z.object({ photoId: z.string().min(1), reason: z.string().trim().min(1).max(200) });
const photoIdSchema = z.object({ photoId: z.string().min(1) });
const retagSchema = z.object({ photoId: z.string().min(1), memberIds: z.array(z.string().min(1)).min(1).max(60) });

function photoRow(d: Draft<ClubState>, id: string, ctx: Ctx, allowRemoved = false) {
  const p = d.photos[id];
  if (!p || (!allowRemoved && (p.deletedAt || p.visibility === 'removed'))) ctx.fail('err.notFound');
  return p;
}

export const careActions = [
  defineAction<LogInput>({
    name: 'log.save',
    can: (u) => logWriters(u),
    parse: (raw) => parseWith(logSchema, withMood(raw)),
    run(d, input, ctx) {
      checkLogDay(ctx, input.date);
      requireAttended(d, ctx, input.memberId, input.date);
      const kind = writeLog(d, ctx, input);
      ctx.result.logId = logId(input.memberId, input.date);
      ctx.result.edited = kind === 'edited';
      ctx.result.pending = needsApproval(ctx);
    },
  }),
  defineAction<MarkInput>({
    name: 'log.mark',
    can: (u) => logWriters(u),
    parse: (raw) => parseWith(markSchema, withMood(raw)),
    run(d, input, ctx) {
      checkLogDay(ctx, input.date);
      const ids = uniq(input.memberIds);
      for (const id of ids) requireAttended(d, ctx, id, input.date);
      const slot = input.session?.slot;
      if (slot && !roundsOf(d as unknown as ClubState, input.date).some((r) => r.id === slot)) ctx.fail('activity.err.noSession');
      const marks: Marks = {
        ...(input.lunch !== undefined ? { lunch: input.lunch } : {}), ...(input.mood !== undefined ? { mood: input.mood } : {}),
        ...(input.communicative !== undefined ? { communicative: input.communicative } : {}), ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.session ? { sessions: { [input.session.slot]: input.session.value } } : {}),
      };
      const done = ids.filter((id) => applyMarks(d, ctx, id, input.date, marks, !!input.onlyEmpty));
      if (done.length > 1) {
        const names = namesOf(d, done);
        if (input.lunch !== undefined) ctx.feed({ icon: 'restaurant', key: 'activity.feed.markLunch', params: { names, n: done.length } });
        else if (input.session) ctx.feed({ icon: 'groups', key: 'activity.feed.markSession', params: { names, n: done.length, time: input.session.slot } });
        else ctx.feed({ icon: 'edit_note', key: 'activity.feed.markMood', params: { names, n: done.length } });
      }
      ctx.result.marked = done.length;
      ctx.result.memberIds = done;
      ctx.result.pending = needsApproval(ctx);
    },
  }),
  defineAction<{ date: ISODate }>({
    name: 'log.saveAllNormal',
    can: (u) => logWriters(u),
    parse: (raw) => {
      const r = parseWith(z.object({ date: isoDate.optional() }), raw ?? {});
      return { date: r.date ?? '' };
    },
    run(d, input, ctx) {
      const date = input.date || ctx.today;
      checkLogDay(ctx, date);
      const view = d as unknown as ClubState;
      // only members who were here and whose Mood & notes round is not done yet; never overwrite what somebody already marked
      const logs = logsOn(view, date);
      const todo = attendedOn(view, date).filter((m) => logs.get(m.id)?.mood === undefined);
      if (!todo.length) ctx.fail('activity.err.nothingToLog');
      const sessions = Object.fromEntries(roundsOf(view, date).filter((r) => r.kind === 'session').map((r) => [r.id, 'joined' as const]));
      const marks: Marks = { mood: NORMAL_LOG.mood, lunch: NORMAL_LOG.lunch, communicative: NORMAL_LOG.communicative, content: NORMAL_LOG.content, sessions };
      for (const m of todo) applyMarks(d, ctx, m.id, date, marks, true);
      ctx.feed({ icon: 'edit_note', key: 'activity.feed.markMood', params: { names: namesOf(d, todo.map((m) => m.id)), n: todo.length } });
      ctx.result.saved = todo.length;
      ctx.result.memberIds = todo.map((m) => m.id);
      ctx.result.pending = needsApproval(ctx);
    },
  }),

  defineAction<z.infer<typeof retagSchema>>({
    name: 'photo.retag',
    can: (u) => photoWriters(u),
    parse: (raw) => parseWith(retagSchema, raw),
    run(d, input, ctx) {
      const p = photoRow(d, input.photoId, ctx);
      if (p.kind === 'activity') ctx.fail('err.invalid'); // KC round 6: an activity picture is about the session, never tagged with members
      const ids = uniq(input.memberIds);
      for (const id of ids) {
        const m = requireMember(d, id, ctx);
        if (isPendingRow(m)) ctx.fail('err.memberPending');
      }
      const before = new Set<string>(p.memberIds);
      if (ids.length === before.size && ids.every((id) => before.has(id))) ctx.fail('err.noChanges');
      p.memberIds = ids;
      if (p.kind === 'solo' && ids.length > 1) p.kind = 'group';
      if (p.visibility === 'visible') notifyPhotoFamilies(d, ctx, ids.filter((id) => !before.has(id)), { id: p.id, media: p.media });
    },
  }),
  defineAction<z.infer<typeof reasonSchema>>({
    name: 'photo.hide',
    can: (u) => photoWriters(u),
    parse: (raw) => parseWith(reasonSchema, raw),
    run(d, input, ctx) {
      const p = photoRow(d, input.photoId, ctx);
      if (p.visibility === 'pending') ctx.fail('activity.err.photoPending'); // not visible to families yet: nothing to hide (remove it instead)
      if (p.visibility === 'hidden') ctx.fail('activity.err.alreadyHidden');
      p.visibility = 'hidden';
      p.moderated = { at: ctx.nowDT, by: ctx.user.id, reason: input.reason };
      ctx.feed({ icon: 'visibility_off', key: 'activity.feed.photoHidden', params: { names: namesOf(d, p.memberIds) } });
    },
  }),
  defineAction<z.infer<typeof photoIdSchema>>({
    name: 'photo.restore',
    can: (u) => photoWriters(u),
    parse: (raw) => parseWith(photoIdSchema, raw),
    run(d, input, ctx) {
      const p = photoRow(d, input.photoId, ctx, true);
      // what management rejected or removed stays gone for teachers; they can only undo their own removal
      if (p.deletedAt && !isMgmt(ctx.user) && p.moderated && d.staff[p.moderated.by]?.role === 'mgmt') ctx.fail('err.forbidden');
      if (p.visibility === 'pending') {
        if (!p.deletedAt) ctx.fail('activity.err.notHidden');
        // a withdrawn photo that was never approved goes back to the review, not straight to the families
        delete p.deletedAt;
        delete p.moderated;
        return;
      }
      if (p.visibility === 'visible' && !p.deletedAt) ctx.fail('activity.err.notHidden');
      p.visibility = 'visible';
      delete p.moderated;
      delete p.deletedAt;
      ctx.feed({ icon: 'visibility', key: 'activity.feed.photoRestored', params: { names: namesOf(d, p.memberIds) } });
    },
  }),
  defineAction<z.infer<typeof reasonSchema>>({
    name: 'photo.remove',
    can: (u) => photoWriters(u),
    parse: (raw) => parseWith(reasonSchema, raw),
    run(d, input, ctx) {
      const p = photoRow(d, input.photoId, ctx);
      // a photo still waiting for review keeps that state under the soft delete, so undoing the removal returns it to the review
      if (p.visibility !== 'pending') p.visibility = 'removed';
      p.moderated = { at: ctx.nowDT, by: ctx.user.id, reason: input.reason };
      p.deletedAt = ctx.nowDT;
      if (p.visibility === 'removed') ctx.feed({ icon: 'delete', key: 'activity.feed.photoRemoved', params: { names: namesOf(d, p.memberIds) } });
    },
  }),
];
