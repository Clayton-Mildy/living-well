// Care actions: daily logs, and the moderation of stored photos (retag, hide, restore, remove). Activity teachers and management; the nurse may also write daily logs.
// Taking photos and the management review (approve / reject) live in photos.ts.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { ClubState, DailyLog, ISODate } from '../types';
import { DomainError, defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { namesOf, notifyPhotoFamilies } from './photos';
import { isPendingRow } from '../rules/core';
import { NORMAL_LOG, attendedOn, logDateOk, logId, logOf } from '../rules/activity';
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
const logSchema = z.object({
  memberId: z.string().min(1),
  date: isoDate,
  mood: z.enum(['cheerful', 'calm', 'quiet', 'agitated']),
  lunch: z.enum(['all', 'most', 'half', 'little']),
  joined: z.enum(['yes', 'satOut']),
  communicative: z.enum(['normal', 'withdrawn']),
  content: z.enum(['normal', 'low']),
  note: z.string().trim().max(600).default(''),
  staffNote: z.string().trim().max(600).optional(),
});
export type LogInput = z.infer<typeof logSchema>;
/** "unsettled" is the label of the stored mood 'agitated'; accept either spelling. */
const withMood = (raw: unknown) => (raw && typeof raw === 'object' && (raw as { mood?: unknown }).mood === 'unsettled' ? { ...(raw as object), mood: 'agitated' } : raw);

/**
 * Create or update the log row. Returns whether it was an edit of an already saved log.
 * A log written by anyone but management waits for approval: families neither see it nor hear about it until management approves
 * (an edit of an approved log keeps showing the last approved values). Management's own logs are approved at once.
 */
function writeLog(d: Draft<ClubState>, ctx: Ctx, i: LogInput): 'created' | 'edited' {
  const id = logId(i.memberId, i.date);
  const prev = d.dailyLogs[id];
  const gated = needsApproval(ctx);
  let kind: 'created' | 'edited' = 'created';
  let before: Record<string, unknown> | undefined;
  let seen = false; // the family has (had) an approved version of this log
  if (prev && !prev.deletedAt) {
    kind = prev.status === 'saved' ? 'edited' : 'created';
    if (prev.status === 'saved') { before = priorOf(prev, LOG_KEYS); seen = approvedVersion(prev, LOG_KEYS) !== null; }
    prev.mood = i.mood;
    prev.lunch = i.lunch;
    prev.joined = i.joined;
    prev.communicative = i.communicative;
    prev.content = i.content;
    prev.note = i.note;
    if (i.staffNote !== undefined) { if (i.staffNote) prev.staffNote = i.staffNote; else delete prev.staffNote; }
    prev.status = 'saved';
    if (kind === 'edited') prev.edits.push({ at: ctx.nowDT, by: ctx.user.id });
    else prev.by = ctx.user.id;
  } else {
    const row: DailyLog = {
      id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: i.memberId, date: i.date, mood: i.mood, lunch: i.lunch, joined: i.joined,
      communicative: i.communicative, content: i.content, note: i.note, ...(i.staffNote ? { staffNote: i.staffNote } : {}), status: 'saved', by: ctx.user.id, edits: [],
    };
    d.dailyLogs[id] = row;
  }
  const row = d.dailyLogs[id];
  const name = shortOf(d, i.memberId);
  if (gated) markPending(row, ctx, before);
  else {
    clearApproval(row);
    const to = familyUserIds(d, i.memberId);
    if (to.length) ctx.notify({ toUsers: to, kind: seen ? 'activity.notif.logUpdated' : 'activity.notif.logSaved', params: { name }, link: '/today', memberId: i.memberId, ref: { type: 'dailyLog', id } });
  }
  ctx.feed({ icon: 'edit_note', key: kind === 'edited' ? 'activity.feed.logEdited' : 'activity.feed.log', params: { name, date: fmtDMY(i.date) }, memberId: i.memberId });
  return kind;
}
function checkLogDay(ctx: Ctx, date: ISODate) {
  if (!logDateOk(ctx.today, date)) ctx.fail('activity.err.dateRange');
}

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
      requireMember(d, input.memberId, ctx);
      checkLogDay(ctx, input.date);
      if (!d.attendance[attId(input.date, input.memberId)]?.checkIn) ctx.fail('activity.err.notAttended', { name: shortOf(d, input.memberId) });
      const kind = writeLog(d, ctx, input);
      ctx.result.logId = logId(input.memberId, input.date);
      ctx.result.edited = kind === 'edited';
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
      // only members who were here and have no saved log yet; never overwrite a log somebody already wrote
      const todo = attendedOn(view, date).filter((m) => !logOf(view, m.id, date));
      if (!todo.length) ctx.fail('activity.err.nothingToLog');
      for (const m of todo) writeLog(d, ctx, { memberId: m.id, date, ...NORMAL_LOG, note: '' });
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
