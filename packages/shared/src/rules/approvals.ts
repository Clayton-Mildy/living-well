// Management approval of what non-management staff enter (round 5): which entries wait, what families may see meanwhile, counts and history.
// A covered row carries `approval` (types.ts). No mark = approved. Families see only approved content: a brand-new pending entry is hidden, and a
// pending edit of an approved entry shows the last approved values (`approval.prev`) until management decides.
import type { Actor, Approval, ClubState, DailyLog, DayMenu, DT, MemberNote, MenuVersion, Reading } from '../types';
import { live, sortBy } from '../util';
import { allPendingReviews, appliedReviews, pendingPhotos } from './members';
import { READING_FIELDS } from './healthStation';
import { pendingLeave } from './staffLeave';
import { formDoc } from './signing';
import { isPendingRow } from './core';

export type ApprovalType = 'profile' | 'logs' | 'readings' | 'photos' | 'menu' | 'programme' | 'stock' | 'renewals' | 'payments' | 'leave' | 'signing';
/** Tab order of the management Approvals screen. */
export const APPROVAL_TYPES: ApprovalType[] = ['profile', 'logs', 'readings', 'photos', 'menu', 'programme', 'stock', 'renewals', 'payments', 'leave', 'signing'];

// ---------- the mark ----------
export type ApprovalState = 'pending' | 'rejected' | null;
/** What a staff member sees on their own entry: waiting for management, or sent back. Approved (or no mark) = null. */
export const approvalState = (r: { approval?: Approval }): ApprovalState => (r.approval?.status === 'pending' ? 'pending' : r.approval?.status === 'rejected' ? 'rejected' : null);
export const isWaiting = (r: { approval?: Approval }) => r.approval?.status === 'pending';

// ---------- what each kind of row keeps as its approved snapshot ----------
export const LOG_KEYS = ['mood', 'lunch', 'joined', 'communicative', 'content', 'note', 'sessions'] as const;
export const NOTE_KEYS = ['text', 'pinned'] as const;
export const READING_KEYS = [...READING_FIELDS, 'status', 'note', 'noteKeys'] as const;
export const DAYMENU_KEYS = ['lunch', 'soft', 'tea'] as const;
export type SnapKeys = readonly string[];

/** The values of `keys` on a row (absent keys stay absent). */
export function snapshotOf(row: object, keys: SnapKeys): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const r = row as Record<string, unknown>;
  for (const k of keys) if (r[k] !== undefined) out[k] = JSON.parse(JSON.stringify(r[k]));
  return out;
}
/** A copy of the row with the snapshot's values (keys the snapshot lacks are dropped). */
export function withSnapshot<T extends object>(row: T, snap: Record<string, unknown>, keys: SnapKeys): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of keys) { if (k in snap) out[k] = JSON.parse(JSON.stringify(snap[k])); else delete out[k]; }
  return out as T;
}
const bare = <T extends { approval?: Approval }>(row: T): T => (row.approval ? { ...row, approval: undefined } : row);
/**
 * What families keep seeing: the row (approved), its last approved values (an edit waits), or nothing (a new entry waits, or was rejected).
 * The copy carries no approval mark (what a rejected edit proposed is not for families).
 */
export function approvedVersion<T extends { approval?: Approval }>(row: T, keys: SnapKeys = []): T | null {
  const a = row.approval;
  if (!a || a.status === 'approved') return bare(row);
  if (a.status === 'pending') return a.prev ? bare(withSnapshot(row, a.prev, keys)) : null;
  return a.prev ? bare(row) : null; // rejected edit: the row was put back to the approved values
}
/** A day's menu row as families see it: an override that waits shows its previous values; photos and allergy plans are not part of the approval. */
export function approvedDayMenu(row: DayMenu): DayMenu {
  const a = row.approval;
  if (!a) return row;
  return bare(a.status === 'pending' ? withSnapshot(row, a.prev ?? {}, DAYMENU_KEYS) : row);
}

export const logForFamily = (l: DailyLog): DailyLog | null => approvedVersion(l, LOG_KEYS);
export const noteForFamily = (n: MemberNote): MemberNote | null => approvedVersion(n, NOTE_KEYS);
export const readingForFamily = (r: Reading): Reading | null => approvedVersion(r, READING_KEYS);
export const menuVersionForFamily = (v: MenuVersion): MenuVersion | null => approvedVersion(v);

// ---------- what waits ----------
export interface ApprovalItem {
  /** the row id (a change request id for 'profile') */
  id: string;
  type: ApprovalType;
  sub: 'cr' | 'flag' | 'log' | 'note' | 'reading' | 'version' | 'dayMenu' | 'day' | 'stock' | 'photo' | 'renewal' | 'payment' | 'leave' | 'signing';
  at: DT;
  by: Actor;
  memberId?: string;
  /** an edit of something already approved (the family still sees the old values) */
  edit: boolean;
}
const sortNew = (a: ApprovalItem[]) => sortBy(a, (x) => x.at + x.id, -1);

const staffActor = (id: string): Actor => `staff:${id}`;

export function pendingLogs(s: ClubState): ApprovalItem[] {
  const logs = live(s.dailyLogs).filter((l) => l.status === 'saved' && isWaiting(l)).map((l): ApprovalItem => ({ id: l.id, type: 'logs', sub: 'log', at: l.approval!.at, by: l.approval!.by, memberId: l.memberId, edit: !!l.approval!.prev }));
  const notes = live(s.memberNotes).filter((n) => n.visibility === 'family' && isWaiting(n)).map((n): ApprovalItem => ({ id: n.id, type: 'logs', sub: 'note', at: n.approval!.at, by: n.approval!.by, memberId: n.memberId, edit: !!n.approval!.prev }));
  return sortNew([...logs, ...notes]);
}
export const pendingReadings = (s: ClubState): ApprovalItem[] =>
  sortNew(live(s.readings).filter((r) => !r.voided && r.memberId && isWaiting(r) && !r.approval!.companionOf).map((r) => ({ id: r.id, type: 'readings' as const, sub: 'reading' as const, at: r.approval!.at, by: r.approval!.by, memberId: r.memberId!, edit: !!r.approval!.prev })));
export function pendingMenu(s: ClubState): ApprovalItem[] {
  const versions = live(s.menuVersions).filter((v) => v.status === 'published' && isWaiting(v)).map((v): ApprovalItem => ({ id: v.id, type: 'menu', sub: 'version', at: v.approval!.at, by: v.approval!.by, edit: false }));
  const days = live(s.dayMenus).filter((o) => isWaiting(o)).map((o): ApprovalItem => ({ id: o.id, type: 'menu', sub: 'dayMenu', at: o.approval!.at, by: o.approval!.by, edit: !!o.approval!.prev }));
  return sortNew([...versions, ...days]);
}
/** Round 14 (B1): a weekly schedule (`version`) or a day's programme change (`day`, id = the date) the activity team sent, waiting for management. */
export function pendingProgramme(s: ClubState): ApprovalItem[] {
  const versions = live(s.scheduleVersions).filter((v) => v.status === 'pending').map((v): ApprovalItem => ({ id: v.id, type: 'programme', sub: 'version', at: v.createdAt, by: v.submittedBy ?? v.createdBy, edit: false }));
  const days = live(s.scheduleDays ?? {}).filter((d) => d.pending).map((d): ApprovalItem => ({ id: d.id, type: 'programme', sub: 'day', at: d.pending!.at, by: d.pending!.by, edit: true }));
  return sortNew([...versions, ...days]);
}
export const pendingStock = (s: ClubState): ApprovalItem[] =>
  sortNew(live(s.stockRequests).filter((k) => k.status === 'requested').map((k) => ({ id: k.id, type: 'stock' as const, sub: 'stock' as const, at: k.createdAt, by: staffActor(k.requestedBy), edit: false })));
/** KC round 7: a renewal follow-up whose change (upgrade, downgrade, leave, stop) the front desk recorded and management has yet to approve. */
export const pendingRenewals = (s: ClubState): ApprovalItem[] =>
  sortNew(live(s.followUps ?? {}).filter((f) => f.status === 'pending' && isWaiting(f)).map((f): ApprovalItem => ({ id: f.id, type: 'renewals', sub: 'renewal', at: f.approval!.at, by: f.approval!.by, memberId: f.memberId, edit: false })));
/** Round 13: a cash or transfer payment the front desk recorded, saved waiting for finance or management to confirm. */
export const pendingPayments = (s: ClubState): ApprovalItem[] =>
  sortNew(live(s.payments).filter((p) => isWaiting(p)).map((p): ApprovalItem => ({ id: p.id, type: 'payments', sub: 'payment', at: p.approval!.at, by: p.approval!.by, memberId: p.memberId, edit: false })));
/** Round 13: a staff member's request for days off, waiting for management (same list as People → Leave). */
export const pendingLeaveItems = (s: ClubState): ApprovalItem[] =>
  sortNew(pendingLeave(s).filter((r) => s.staff[r.staffId] && !s.staff[r.staffId].deletedAt).map((r): ApprovalItem => ({ id: r.id, type: 'leave', sub: 'leave', at: r.createdAt, by: staffActor(r.staffId), edit: false })));
/** Round 14 (D): a membership form the billing contact signed, waiting for management to countersign (id = the member). */
export function pendingSigning(s: ClubState): ApprovalItem[] {
  const out: ApprovalItem[] = [];
  for (const m of live(s.members)) {
    if (isPendingRow(m)) continue; // a member still waiting for approval (signed at registration): the countersign follows the approval
    const sig = formDoc(m)?.signing;
    if (sig?.status !== 'signed') continue;
    const step = [...sig.steps].reverse().find((x) => x.status === 'signed');
    out.push({ id: m.id, type: 'signing', sub: 'signing', at: step?.at ?? '', by: step?.by ?? 'system', memberId: m.id, edit: false });
  }
  return sortNew(out);
}
export const pendingPhotoItems = (s: ClubState): ApprovalItem[] =>
  pendingPhotos(s).map((p) => ({ id: p.id, type: 'photos' as const, sub: 'photo' as const, at: p.createdAt, by: staffActor(p.takenBy), memberId: p.memberIds[0], edit: false }));
/** Change requests: gated ones wait for approval; flagged ones were applied at once and wait for a review. */
export const pendingProfile = (s: ClubState): ApprovalItem[] =>
  sortNew([...allPendingReviews(s), ...appliedReviews(s)].map((c) => ({ id: c.id, type: 'profile' as const, sub: c.kind === 'approval' ? ('cr' as const) : ('flag' as const), at: c.createdAt, by: c.submittedBy, memberId: c.target.memberId, edit: c.op !== 'create' })));

export const pendingItems = (s: ClubState, type: ApprovalType): ApprovalItem[] =>
  ({ profile: pendingProfile, logs: pendingLogs, readings: pendingReadings, photos: pendingPhotoItems, menu: pendingMenu, programme: pendingProgramme, stock: pendingStock, renewals: pendingRenewals, payments: pendingPayments, leave: pendingLeaveItems, signing: pendingSigning } as const)[type](s);
export function approvalCounts(s: ClubState): Record<ApprovalType, number> {
  return Object.fromEntries(APPROVAL_TYPES.map((t) => [t, pendingItems(s, t).length])) as Record<ApprovalType, number>;
}
export const approvalTotal = (s: ClubState): number => APPROVAL_TYPES.reduce((n, t) => n + pendingItems(s, t).length, 0);

// ---------- history ----------
export interface HistoryItem {
  /** `${type}:${sub}:${id}` */
  key: string;
  id: string;
  type: ApprovalType;
  sub: ApprovalItem['sub'];
  status: 'approved' | 'rejected' | 'acknowledged' | 'reverted' | 'withdrawn' | 'superseded';
  /** when it was sent (or taken), and when management decided */
  at: DT;
  decidedAt: DT;
  by: Actor;
  decidedBy?: Actor;
  reason?: string;
  memberId?: string;
}
/** Decided entries of every type, newest decision first. Rows that were rejected and soft-deleted are included. */
export function approvalHistory(s: ClubState): HistoryItem[] {
  const out: HistoryItem[] = [];
  const add = (x: Omit<HistoryItem, 'key'>) => out.push({ ...x, key: `${x.type}:${x.sub}:${x.id}` });
  const fromMark = (type: ApprovalType, sub: ApprovalItem['sub'], id: string, a: Approval | undefined, memberId?: string) => {
    if (!a || !a.decidedAt || a.status === 'pending') return;
    add({ id, type, sub, status: a.status === 'rejected' ? 'rejected' : 'approved', at: a.at, decidedAt: a.decidedAt, by: a.by, decidedBy: a.decidedBy, reason: a.reason, memberId });
  };
  for (const l of Object.values(s.dailyLogs)) fromMark('logs', 'log', l.id, l.approval, l.memberId);
  for (const n of Object.values(s.memberNotes)) if (n.visibility === 'family') fromMark('logs', 'note', n.id, n.approval, n.memberId);
  for (const r of Object.values(s.readings)) if (!r.approval?.companionOf) fromMark('readings', 'reading', r.id, r.approval, r.memberId ?? undefined);
  for (const v of Object.values(s.menuVersions)) fromMark('menu', 'version', v.id, v.approval);
  for (const f of Object.values(s.followUps ?? {})) fromMark('renewals', 'renewal', f.id, f.approval, f.memberId);
  for (const x of Object.values(s.payments)) fromMark('payments', 'payment', x.id, x.approval, x.memberId);
  // a leave request keeps its decision on the row itself; shown as a mark so it reads like the rest (a cancelled request is not a decision)
  for (const r of Object.values(s.leaveRequests ?? {})) {
    if (r.deletedAt || !r.decidedAt || (r.status !== 'approved' && r.status !== 'declined')) continue;
    fromMark('leave', 'leave', r.id, { status: r.status === 'approved' ? 'approved' : 'rejected', by: staffActor(r.staffId), at: r.createdAt, decidedBy: r.decidedBy, decidedAt: r.decidedAt, reason: r.note });
  }
  for (const o of Object.values(s.dayMenus)) fromMark('menu', 'dayMenu', o.id, o.approval);
  for (const c of Object.values(s.changeRequests)) {
    if (c.status === 'pending' || !c.reviewedAt && !['withdrawn', 'superseded'].includes(c.status)) continue;
    add({ id: c.id, type: 'profile', sub: c.kind === 'approval' ? 'cr' : 'flag', status: c.status as HistoryItem['status'], at: c.createdAt, decidedAt: c.reviewedAt || c.createdAt, by: c.submittedBy, decidedBy: c.reviewedBy, reason: c.note, memberId: c.target.memberId });
  }
  for (const p of Object.values(s.photos)) {
    if (p.approved && p.takenBy !== p.approved.by) add({ id: p.id, type: 'photos', sub: 'photo', status: 'approved', at: p.createdAt, decidedAt: p.approved.at, by: staffActor(p.takenBy), decidedBy: staffActor(p.approved.by), memberId: p.memberIds[0] });
    else if (p.visibility === 'removed' && p.moderated && p.moderated.by !== p.takenBy && s.staff[p.moderated.by]?.role === 'mgmt') add({ id: p.id, type: 'photos', sub: 'photo', status: 'rejected', at: p.createdAt, decidedAt: p.moderated.at, by: staffActor(p.takenBy), decidedBy: staffActor(p.moderated.by), reason: p.moderated.reason, memberId: p.memberIds[0] });
  }
  for (const k of Object.values(s.stockRequests)) {
    if ((k.status === 'approved' || k.status === 'received' || k.status === 'rejected') && k.decidedAt) add({ id: k.id, type: 'stock', sub: 'stock', status: k.status === 'rejected' ? 'rejected' : 'approved', at: k.createdAt, decidedAt: k.decidedAt, by: staffActor(k.requestedBy), decidedBy: k.decidedBy, reason: k.note });
  }
  return sortBy(out, (x) => x.decidedAt + x.key, -1);
}
