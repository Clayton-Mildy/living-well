// The approval gate for entries by non-management staff (daily logs, family notes, readings, the menu). The action keeps its normal effect on
// the row, then marks the row `pending`; families never see a pending entry (rules/approvals.ts, project.ts) and the notices that would
// tell them wait until management approves (actions/approvals.ts). Management's own entries are approved at once and carry no mark.
import type { Approval } from '../types';
import { isMgmt, type Ctx } from './framework';
import { snapshotOf, type SnapKeys } from '../rules/approvals';

/** Entries by anyone but management wait for approval. */
export const needsApproval = (ctx: Ctx) => !isMgmt(ctx.user);

/**
 * What families currently see of a row, to keep while an edit waits. Call before the row changes.
 * An approved row (or one without a mark) is snapshotted; a row that already waits or was sent back keeps its earlier snapshot (none = brand new).
 */
export function priorOf(row: { approval?: Approval }, keys: SnapKeys): Record<string, unknown> | undefined {
  const a = row.approval;
  if (a && a.status !== 'approved') return a.prev;
  return snapshotOf(row, keys);
}

/** Mark the row as waiting for management. `prev` comes from priorOf() (taken before the change). */
export function markPending(row: { approval?: Approval }, ctx: Ctx, prev: Record<string, unknown> | undefined, defer?: Approval['defer']): void {
  const old = row.approval;
  const keep = old && old.status === 'pending' ? old.defer : undefined;
  const merged = keep || defer ? { ...keep, ...defer } : undefined;
  row.approval = { status: 'pending', by: ctx.actor, at: ctx.nowDT, ...(prev ? { prev } : {}), ...(merged ? { defer: merged } : {}) };
}

/** Management wrote or changed the row itself: it is approved, with no mark. */
export function clearApproval(row: { approval?: Approval }): void {
  delete row.approval;
}
