// Management review of customer changes: approve / reject / withdraw (gated) and acknowledge / revert (flagged health edits).
import type { Draft } from 'immer';
import type { ChangeRequest, ClubState } from '../types';
import { defineAction, getAction, isMgmt, collOf, type Ctx, DomainError } from './framework';

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const rowOf = (d: Draft<ClubState>, cr: ChangeRequest) => (d as unknown as Record<string, Record<string, Record<string, unknown>>>)[collOf(cr.target.type)]?.[cr.target.id];
const cr = (d: Draft<ClubState>, id: string, ctx: Ctx) => {
  const x = d.changeRequests[id];
  if (!x) ctx.fail('err.notFound');
  return x;
};
const submitterId = (c: ChangeRequest) => String(c.submittedBy).split(':')[1] || '';

/** Approve a waiting request: apply it (updates) or activate what it created, and tell the sender. Shared with the Approvals hub. */
export function approveChange(d: Draft<ClubState>, c: Draft<ChangeRequest>, ctx: Ctx, opts: { force?: boolean; note?: string } = {}) {
  if (c.status !== 'pending' || c.kind !== 'approval') ctx.fail('err.reviewNotPending');
  const def = getAction(c.action);
  if (c.op === 'create') {
    for (const r of c.createdRows || []) {
      const row = (d as unknown as Record<string, Record<string, { review?: { status: string } }>>)[r.coll]?.[r.id];
      if (row?.review) row.review.status = 'approved';
      if (r.coll === 'familyContacts') (row as unknown as { activatedAt?: string }).activatedAt = ctx.nowDT;
    }
    def?.afterApprove?.(d, c as ChangeRequest, ctx);
  } else {
    const row = rowOf(d, c as ChangeRequest);
    if (!row) ctx.fail('err.notFound');
    const stale = c.changes.filter((ch) => !same(row[ch.field], ch.from));
    if (stale.length && !opts.force) ctx.fail('err.reviewConflict', { fields: stale.map((x) => x.field).join(', ') });
    if (!def) throw new DomainError('err.unknownAction', { name: c.action });
    def.run(d, c.input as never, { ...ctx, actor: c.submittedBy, review: 'none' });
  }
  c.status = 'approved';
  c.reviewedBy = ctx.actor;
  c.reviewedAt = ctx.nowDT;
  if (opts.note) c.note = opts.note;
  ctx.notify({ toUsers: [submitterId(c as ChangeRequest)], kind: 'notif.reviewApproved', params: { section: c.section }, link: c.target.memberId ? `/members/${c.target.memberId}` : '/reviews', memberId: c.target.memberId, ref: { type: 'changeRequest', id: c.id } });
  ctx.feed({ icon: 'task_alt', key: 'feed.reviewApproved', params: { section: c.section }, memberId: c.target.memberId });
}
/** Reject a waiting request with a reason: nothing is applied (a rejected create is cleaned up), and the sender is told why. */
export function rejectChange(d: Draft<ClubState>, c: Draft<ChangeRequest>, ctx: Ctx, note: string) {
  if (c.status !== 'pending' || c.kind !== 'approval') ctx.fail('err.reviewNotPending');
  if (!note?.trim()) ctx.fail('err.noteRequired');
  if (c.op === 'create') {
    for (const r of c.createdRows || []) {
      const row = (d as unknown as Record<string, Record<string, { review?: { status: string }; deletedAt?: string }>>)[r.coll]?.[r.id];
      if (!row) continue;
      if (row.review) row.review.status = 'rejected';
      row.deletedAt = ctx.nowDT;
    }
    getAction(c.action)?.afterReject?.(d, c as ChangeRequest, ctx);
  }
  c.status = 'rejected';
  c.reviewedBy = ctx.actor;
  c.reviewedAt = ctx.nowDT;
  c.note = note.trim();
  ctx.notify({ toUsers: [submitterId(c as ChangeRequest)], kind: 'notif.reviewRejected', params: { section: c.section, note: c.note }, link: c.target.memberId ? `/members/${c.target.memberId}` : '/reviews', memberId: c.target.memberId, severity: 'attention', ref: { type: 'changeRequest', id: c.id } });
}
/** Management has looked at a change that was applied at once (health sections): keep it. */
export function acknowledgeChange(c: Draft<ChangeRequest>, ctx: Ctx) {
  if (c.kind !== 'postReview' || c.status !== 'pending') ctx.fail('err.reviewNotPending');
  c.status = 'acknowledged';
  c.reviewedBy = ctx.actor;
  c.reviewedAt = ctx.nowDT;
}
/** Put a change that was applied at once back to its old values. */
export function revertChange(d: Draft<ClubState>, c: Draft<ChangeRequest>, ctx: Ctx, opts: { force?: boolean; note?: string } = {}) {
  if (c.kind !== 'postReview' || c.status !== 'pending') ctx.fail('err.reviewNotPending');
  const row = rowOf(d, c as ChangeRequest);
  if (!row) ctx.fail('err.notFound');
  const moved = c.changes.filter((ch) => !same(row[ch.field], ch.to));
  if (moved.length && !opts.force) ctx.fail('err.reviewConflict', { fields: moved.map((x) => x.field).join(', ') });
  for (const ch of c.changes) row[ch.field] = JSON.parse(JSON.stringify(ch.from ?? null));
  c.status = 'reverted';
  c.reviewedBy = ctx.actor;
  c.reviewedAt = ctx.nowDT;
  if (opts.note) c.note = opts.note;
  ctx.notify({ toUsers: [submitterId(c as ChangeRequest)], kind: 'notif.reviewReverted', params: { section: c.section }, link: c.target.memberId ? `/members/${c.target.memberId}` : '/reviews', memberId: c.target.memberId, severity: 'attention' });
  ctx.feed({ icon: 'undo', key: 'feed.reviewReverted', params: { section: c.section }, memberId: c.target.memberId });
}

export const reviewActions = [
  defineAction<{ crId: string; force?: boolean; note?: string }>({
    name: 'review.approve',
    can: (u) => isMgmt(u),
    run(d, input, ctx) { approveChange(d, cr(d, input.crId, ctx), ctx, input); },
  }),
  defineAction<{ crId: string; note: string }>({
    name: 'review.reject',
    can: (u) => isMgmt(u),
    run(d, input, ctx) { rejectChange(d, cr(d, input.crId, ctx), ctx, input.note); },
  }),
  defineAction<{ crId: string }>({
    name: 'review.withdraw',
    can: (u, input, s) => s.changeRequests[input.crId]?.submittedBy === (u.kind === 'staff' ? `staff:${u.id}` : `family:${u.id}`),
    run(d, input, ctx) {
      const c = cr(d, input.crId, ctx);
      if (c.status !== 'pending') ctx.fail('err.reviewNotPending');
      if (c.op === 'create') {
        for (const r of c.createdRows || []) {
          const row = (d as unknown as Record<string, Record<string, { deletedAt?: string }>>)[r.coll]?.[r.id];
          if (row) row.deletedAt = ctx.nowDT;
        }
        // undo side effects the same way a rejection does (e.g. a lead's join puts the lead back on the board)
        getAction(c.action)?.afterReject?.(d, c as ChangeRequest, ctx);
      }
      c.status = 'withdrawn';
    },
  }),
  defineAction<{ crId: string }>({
    name: 'review.acknowledge',
    can: (u) => isMgmt(u),
    run(d, input, ctx) { acknowledgeChange(cr(d, input.crId, ctx), ctx); },
  }),
  defineAction<{ crId: string; force?: boolean; note?: string }>({
    name: 'review.revert',
    can: (u) => isMgmt(u),
    run(d, input, ctx) { revertChange(d, cr(d, input.crId, ctx), ctx, input); },
  }),
];
