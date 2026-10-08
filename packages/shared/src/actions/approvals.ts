// Management approval hub: approve or reject what non-management staff entered, one action for a whole batch (one patch, one SSE update).
//   approval.approve { type, ids, notify? }      approval.reject { type, ids, reason }
// type: profile (change requests, applied-at-once flags), logs (daily logs + family notes), readings, photos, menu (weekly versions + per-day overrides), stock, renewals (a change the front desk recorded in the month-end follow-up: approving applies it from the 1st).
// Ids that were already handled, are gone or have gone stale (a profile change whose values moved on) are skipped and reported back in `skipped`.
// Families never see an entry before this approves it (rules/approvals.ts, project.ts); the notices that would tell them go out here.
import { z } from 'zod';
import { produce, current, type Draft } from 'immer';
import type { Approval, ClubState, DailyLog, DayMenu, MemberNote, MenuVersion, Photo, Reading, StockRequest } from '../types';
import { DomainError, defineAction, isMgmt, type Ctx } from './framework';
import { familyUserIds, shortOf } from './helpers';
import { acknowledgeChange, approveChange, rejectChange, revertChange } from './review';
import { approvePhotoRows, rejectPhotoRows } from './photos';
import { applyFollowUp } from './renewals';
import { approveStockRow, rejectStockRow } from './kitchen';
import { noticeFamilies } from './health';
import { menuAudience } from '../rules/kitchenOps';
import { DAYMENU_KEYS, LOG_KEYS, NOTE_KEYS, READING_KEYS, isWaiting, snapshotOf, type ApprovalType, APPROVAL_TYPES, type SnapKeys } from '../rules/approvals';
import { uniq } from '../util';

const approveSchema = z.object({ type: z.enum(APPROVAL_TYPES as [ApprovalType, ...ApprovalType[]]), ids: z.array(z.string().min(1)).min(1).max(300), notify: z.boolean().optional() });
const rejectSchema = z.object({ type: z.enum(APPROVAL_TYPES as [ApprovalType, ...ApprovalType[]]), ids: z.array(z.string().min(1)).min(1).max(300), reason: z.string().trim().min(1, 'err.noteRequired').max(240) });

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    if (r.error.issues.some((i) => i.message === 'err.noteRequired' || i.path[0] === 'reason')) throw new DomainError('err.noteRequired'); // a rejection always says why
    throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  }
  return r.data;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const staffIdOfActor = (a: string) => (a.startsWith('staff:') ? a.slice(6) : '');
type Marked = { approval?: Approval };

/** Mark the row's approval as decided; the notices have gone out. */
function decide(a: Draft<Approval>, ctx: Ctx, status: 'approved' | 'rejected', reason?: string) {
  a.status = status;
  a.decidedBy = ctx.actor;
  a.decidedAt = ctx.nowDT;
  delete a.defer;
  if (status === 'approved') { delete a.prev; delete a.proposed; delete a.reason; }
  else if (reason) a.reason = reason;
}
/** A rejected edit puts the row back to the approved values it had; what was proposed is kept for the history. */
function restore(row: Draft<Marked>, keys: SnapKeys) {
  const a = row.approval!;
  if (!a.prev) return;
  a.proposed = snapshotOf(row, keys);
  const r = row as unknown as Record<string, unknown>;
  for (const k of keys) { if (k in a.prev) r[k] = clone(a.prev[k]); else delete r[k]; }
}

/** Dry-run a recipe on a copy of the state: the error code it fails with, or null. Keeps a half-applied failure out of the real draft. */
function tryRun(d: Draft<ClubState>, ctx: Ctx, fn: (x: Draft<ClubState>, c: Ctx) => void): string | null {
  try {
    produce(current(d), (x) => { fn(x, { ...ctx, feed: () => {}, notify: () => {} }); });
    return null;
  } catch (e) {
    return e instanceof DomainError ? e.code : 'err.server';
  }
}

interface Outcome { done: string[]; skipped: string[]; conflicts: string[]; rejectedBy: Map<string, number> }

// ---------- per type ----------
type Handler = (d: Draft<ClubState>, ctx: Ctx, id: string, o: { reason?: string; notify?: boolean }) => 'done' | 'skip' | 'conflict';

const approveLog = (d: Draft<ClubState>, ctx: Ctx, l: Draft<DailyLog>) => {
  const a = l.approval!;
  // KC round 7: a log fills in round by round; families hear about it once the Mood & notes round is in, not for a lunch or session mark alone
  const edit = !!a.prev && a.prev.mood !== undefined;
  decide(a, ctx, 'approved');
  const to = l.mood !== undefined ? familyUserIds(d, l.memberId) : [];
  if (to.length) ctx.notify({ toUsers: to, kind: edit ? 'activity.notif.logUpdated' : 'activity.notif.logSaved', params: { name: shortOf(d, l.memberId) }, link: '/today', memberId: l.memberId, ref: { type: 'dailyLog', id: l.id } });
};
const approveNote = (d: Draft<ClubState>, ctx: Ctx, n: Draft<MemberNote>) => {
  decide(n.approval!, ctx, 'approved');
  // the new pinned note replaces the one that was pinned
  if (n.pinned) for (const o of Object.values(d.memberNotes)) if (o.memberId === n.memberId && o.visibility === 'family' && o.pinned && o.id !== n.id) o.pinned = false;
};
const approveReading = (d: Draft<ClubState>, ctx: Ctx, r: Draft<Reading>) => {
  const a = r.approval!;
  const defer = a.defer;
  const companion = defer?.companionId ? d.readings[defer.companionId] : undefined;
  decide(a, ctx, 'approved');
  if (companion?.approval) decide(companion.approval, ctx, 'approved');
  if (defer && !a.prev) noticeFamilies(d, ctx, r, { tell: !!defer.tell, share: !!defer.share, overall: defer.overall ?? r.status, companion: companion as Reading | undefined });
};
const rejectReading = (ctx: Ctx, r: Draft<Reading>, reason: string) => {
  const a = r.approval!;
  const companionId = a.defer?.companionId;
  const had = !!a.prev;
  if (had) restore(r, READING_KEYS);
  else r.voided = { at: ctx.nowDT, by: ctx.user.id, reason: 'other', note: reason };
  decide(a, ctx, 'rejected', reason);
  return companionId;
};
const approveVersion = (d: Draft<ClubState>, ctx: Ctx, v: Draft<MenuVersion>) => {
  const notify = !!v.approval!.defer?.notify;
  decide(v.approval!, ctx, 'approved');
  // like management's own publish: the versions for the same date (or later) that were approved give way
  for (const o of Object.values(d.menuVersions)) if (o.id !== v.id && !o.deletedAt && o.status === 'published' && o.effectiveFrom >= v.effectiveFrom && !isWaiting(o)) o.deletedAt = ctx.nowDT;
  if (notify) {
    const families = menuAudience(d as unknown as ClubState, v.effectiveFrom > ctx.today ? v.effectiveFrom : ctx.today);
    if (families.length) ctx.notify({ toUsers: families, kind: 'kitchen.notif.menuPublished', params: { date: v.effectiveFrom }, link: '/today' });
  }
};

const APPROVE: Record<ApprovalType, Handler> = {
  profile(d, ctx, id) {
    const c = d.changeRequests[id];
    if (!c || c.deletedAt || c.status !== 'pending') return 'skip';
    const run = (x: Draft<ClubState>, k: Ctx) => { const row = x.changeRequests[id]; if (c.kind === 'approval') approveChange(x, row, k); else acknowledgeChange(row, k); };
    const err = tryRun(d, ctx, run);
    if (err) return err === 'err.reviewConflict' ? 'conflict' : 'skip';
    run(d, ctx);
    return 'done';
  },
  logs(d, ctx, id) {
    const l = d.dailyLogs[id];
    if (l) { if (l.deletedAt || !isWaiting(l)) return 'skip'; approveLog(d, ctx, l); return 'done'; }
    const n = d.memberNotes[id];
    if (!n || n.deletedAt || !isWaiting(n)) return 'skip';
    approveNote(d, ctx, n);
    return 'done';
  },
  readings(d, ctx, id) {
    const r = d.readings[id];
    if (!r || r.deletedAt || r.voided || !isWaiting(r)) return 'skip';
    approveReading(d, ctx, r);
    return 'done';
  },
  photos(d, ctx, id, o) {
    const p = d.photos[id];
    if (!p || p.visibility !== 'pending' || p.deletedAt) return 'skip';
    approvePhotoRows(d, ctx, [p as Draft<Photo>], o.notify !== false);
    return 'done';
  },
  menu(d, ctx, id) {
    const v = d.menuVersions[id];
    if (v) { if (v.deletedAt || !isWaiting(v)) return 'skip'; approveVersion(d, ctx, v); return 'done'; }
    const o = d.dayMenus[id];
    if (!o || o.deletedAt || !isWaiting(o)) return 'skip';
    decide(o.approval!, ctx, 'approved');
    return 'done';
  },
  stock(d, ctx, id) {
    const k = d.stockRequests[id];
    if (!k || k.deletedAt || k.status !== 'requested') return 'skip';
    approveStockRow(d, ctx, k as Draft<StockRequest>);
    return 'done';
  },
  // KC round 7: a renewal change (upgrade, downgrade, leave, stop) recorded by the front desk applies from the 1st, and the family hears about it
  renewals(d, ctx, id) {
    const f = d.followUps?.[id];
    if (!f || f.deletedAt || f.status !== 'pending' || !f.approval) return 'skip';
    if (tryRun(d, ctx, (x, k) => applyFollowUp(x, x.followUps[id], k))) return 'conflict'; // no longer fits (the month began, the member already ended…)
    applyFollowUp(d, f, ctx);
    f.status = 'done';
    decide(f.approval, ctx, 'approved');
    ctx.feed({ icon: 'event_repeat', key: 'renewals.feed.approved', params: { name: shortOf(d, f.memberId), month: f.month }, memberId: f.memberId });
    return 'done';
  },
};

const REJECT: Record<ApprovalType, (out: Outcome) => Handler> = {
  profile: () => (d, ctx, id, o) => {
    const c = d.changeRequests[id];
    if (!c || c.deletedAt || c.status !== 'pending') return 'skip';
    const run = (x: Draft<ClubState>, k: Ctx) => { const row = x.changeRequests[id]; if (c.kind === 'approval') rejectChange(x, row, k, o.reason!); else revertChange(x, row, k, { note: o.reason }); };
    const err = tryRun(d, ctx, run);
    if (err) return err === 'err.reviewConflict' ? 'conflict' : 'skip';
    run(d, ctx);
    return 'done';
  },
  logs: (out) => (d, ctx, id, o) => {
    const reason = o.reason!;
    const l = d.dailyLogs[id];
    if (l) {
      if (l.deletedAt || !isWaiting(l)) return 'skip';
      const by = l.approval!.by;
      restore(l, LOG_KEYS);
      decide(l.approval!, ctx, 'rejected', reason);
      note(out, by);
      return 'done';
    }
    const n = d.memberNotes[id];
    if (!n || n.deletedAt || !isWaiting(n)) return 'skip';
    const by = n.approval!.by;
    if (n.approval!.prev) restore(n, NOTE_KEYS); else n.deletedAt = ctx.nowDT; // a brand-new note that was turned down is gone
    decide(n.approval!, ctx, 'rejected', reason);
    note(out, by);
    return 'done';
  },
  readings: (out) => (d, ctx, id, o) => {
    const r = d.readings[id];
    if (!r || r.deletedAt || r.voided || !isWaiting(r)) return 'skip';
    const by = r.approval!.by;
    const companionId = rejectReading(ctx, r, o.reason!);
    const c = companionId ? d.readings[companionId] : undefined;
    if (c?.approval) { c.voided = { at: ctx.nowDT, by: ctx.user.id, reason: 'other', note: o.reason! }; decide(c.approval, ctx, 'rejected', o.reason); }
    note(out, by);
    return 'done';
  },
  photos: () => (d, ctx, id, o) => {
    const p = d.photos[id];
    if (!p || p.visibility !== 'pending' || p.deletedAt) return 'skip';
    rejectPhotoRows(d, ctx, [p as Draft<Photo>], o.reason!);
    return 'done';
  },
  menu: (out) => (d, ctx, id, o) => {
    const v = d.menuVersions[id];
    if (v) {
      if (v.deletedAt || !isWaiting(v)) return 'skip';
      const by = v.approval!.by;
      v.deletedAt = ctx.nowDT; // a turned-down version is gone (the previous menu carries on); it stays in the history
      decide(v.approval!, ctx, 'rejected', o.reason);
      note(out, by);
      return 'done';
    }
    const day = d.dayMenus[id];
    if (!day || day.deletedAt || !isWaiting(day)) return 'skip';
    const by = day.approval!.by;
    day.approval!.prev ??= {};
    restore(day as Draft<DayMenu>, DAYMENU_KEYS);
    decide(day.approval!, ctx, 'rejected', o.reason);
    note(out, by);
    return 'done';
  },
  stock: () => (d, ctx, id, o) => {
    const k = d.stockRequests[id];
    if (!k || k.deletedAt || k.status !== 'requested') return 'skip';
    rejectStockRow(d, ctx, k as Draft<StockRequest>, o.reason!);
    return 'done';
  },
  // KC round 7: nothing was applied, so only the mark changes; the recorder hears why and the member goes back on her to-do list
  renewals: (out) => (d, ctx, id, o) => {
    const f = d.followUps?.[id];
    if (!f || f.deletedAt || f.status !== 'pending' || !f.approval) return 'skip';
    const by = f.approval.by;
    f.status = 'rejected';
    decide(f.approval, ctx, 'rejected', o.reason);
    ctx.feed({ icon: 'event_repeat', key: 'renewals.feed.rejected', params: { name: shortOf(d, f.memberId), month: f.month }, memberId: f.memberId });
    note(out, by);
    return 'done';
  },
};
const note = (out: Outcome, by: string) => { const s = staffIdOfActor(by); if (s) out.rejectedBy.set(s, (out.rejectedBy.get(s) || 0) + 1); };

const REJECT_LINK: Partial<Record<ApprovalType, string>> = { logs: '/log', readings: '/readings', menu: '/menu', renewals: '/renewals' };

function run(d: Draft<ClubState>, ctx: Ctx, type: ApprovalType, ids: string[], mode: 'approve' | 'reject', o: { reason?: string; notify?: boolean }): Outcome {
  const out: Outcome = { done: [], skipped: [], conflicts: [], rejectedBy: new Map() };
  const handler = mode === 'approve' ? APPROVE[type] : REJECT[type](out);
  for (const id of uniq(ids)) {
    const r = handler(d, ctx, id, o);
    if (r === 'done') out.done.push(id);
    else if (r === 'conflict') out.conflicts.push(id);
    else out.skipped.push(id);
  }
  // each author hears once per batch, with the reason (photos, stock and profile changes tell their senders themselves)
  if (mode === 'reject') for (const [who, n] of out.rejectedBy) if (d.staff[who] && !d.staff[who].deletedAt) ctx.notify({ toUsers: [who], kind: `approvals.notif.rejected.${type}`, params: { n, reason: o.reason! }, link: REJECT_LINK[type] || '/today', severity: 'attention' });
  ctx.result[mode === 'approve' ? 'approved' : 'rejected'] = out.done.length;
  ctx.result.ids = out.done;
  ctx.result.skipped = out.skipped;
  ctx.result.conflicts = out.conflicts;
  return out;
}

export const approvalActions = [
  defineAction<{ type: ApprovalType; ids: string[]; notify?: boolean }>({
    name: 'approval.approve',
    can: (u) => isMgmt(u),
    parse: (raw) => parseWith(approveSchema, raw),
    run: (d, i, ctx) => { run(d, ctx, i.type, i.ids, 'approve', { notify: i.notify }); },
  }),
  defineAction<{ type: ApprovalType; ids: string[]; reason: string }>({
    name: 'approval.reject',
    can: (u) => isMgmt(u),
    parse: (raw) => parseWith(rejectSchema, raw),
    run: (d, i, ctx) => { run(d, ctx, i.type, i.ids, 'reject', { reason: i.reason }); },
  }),
];
