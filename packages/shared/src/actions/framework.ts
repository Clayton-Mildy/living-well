// Action framework: pure, deterministic immer recipes shared by the browser (optimistic) and the server (authoritative).
import { produceWithPatches, enablePatches, type Patch, type Draft, original, current, isDraft } from 'immer';
import type { Actor, ClubState, DT, HM, ISODate, Role, StaffRole, User, Notification, ActivityEntry, ChangeRequest, ReviewSection } from '../types';
import { COLLECTIONS } from '../types';
import { toHM } from '../util';

enablePatches();

export class DomainError extends Error {
  constructor(public code: string, public params: Record<string, string | number> = {}) {
    super(code);
  }
}
export type ReviewPolicy = 'none' | 'gate' | 'flag';

export interface Ctx {
  user: User;
  actor: Actor;
  role: Role;
  clubId: string;
  today: ISODate;
  nowMin: number;
  now: HM;
  nowDT: DT;
  mutationId: string;
  /** Deterministic id: same on client and server for the same mutation. */
  id(prefix: string): string;
  fail(code: string, params?: Record<string, string | number>): never;
  /** Append to the club's activity feed (Live today, member History). */
  feed(e: { icon: string; key: string; params?: Record<string, string | number>; memberId?: string }): void;
  /** Store an "update" notification for users and/or roles. */
  notify(n: { toUsers?: string[]; toRoles?: StaffRole[]; kind: string; params?: Record<string, string | number>; link: string; memberId?: string; severity?: Notification['severity']; ref?: Notification['ref'] }): void;
  /** Outputs for the caller (e.g. created ids). */
  result: Record<string, unknown>;
  /** The review policy in force for this run ('none' when replaying an approval). */
  review: ReviewPolicy;
}

export interface ReviewSpec<I> {
  policy: ReviewPolicy | ((input: I, s: ClubState, user: User) => ReviewPolicy);
  section: ReviewSection;
  op: 'create' | 'update' | 'delete';
  /** Target entity for the change request (for updates: the row whose fields change). */
  target: (input: I, s: ClubState) => ChangeRequest['target'];
}

export interface ActionDef<I = any> {
  name: string;
  /** Who may run it. Server enforces; UI uses it to show/hide controls. */
  can: (user: User, input: I, s: ClubState) => boolean;
  /** Validate and normalise input (throw DomainError on bad input). */
  parse?: (input: unknown) => I;
  review?: ReviewSpec<I>;
  run: (draft: Draft<ClubState>, input: I, ctx: Ctx) => void;
  /** After management approves a gated create (e.g. activate family access, book first days). */
  afterApprove?: (draft: Draft<ClubState>, cr: ChangeRequest, ctx: Ctx) => void;
  /** After management rejects a gated create (e.g. move the lead back). */
  afterReject?: (draft: Draft<ClubState>, cr: ChangeRequest, ctx: Ctx) => void;
}
export const defineAction = <I>(def: ActionDef<I>): ActionDef<I> => def;

// ---------- registry ----------
const REGISTRY: Record<string, ActionDef> = {};
export function registerActions(defs: ActionDef[]) {
  for (const d of defs) REGISTRY[d.name] = d;
}
export const getAction = (name: string) => REGISTRY[name];
export const allActions = () => Object.values(REGISTRY);

// ---------- users / roles ----------
export const roleOf = (u: User): Role => (u.kind === 'staff' ? u.staff.role : 'family');
export const actorOf = (u: User): Actor => (u.kind === 'staff' ? `staff:${u.id}` : `family:${u.id}`);
export const isMgmt = (u: User) => u.kind === 'staff' && u.staff.role === 'mgmt';
export const hasRole = (u: User, ...roles: Role[]) => roles.includes(roleOf(u));
export const isStaff = (u: User) => u.kind === 'staff';
export const isFamily = (u: User) => u.kind === 'family';
export const systemUser = (clubId: string): User => ({ kind: 'staff', id: 'system', clubId, clubs: [clubId], staff: { id: 'system', clubId, createdAt: '', createdBy: 'system', name: 'CitraPremier', role: 'mgmt', title: 'System', phone: '', supervisor: true, rateable: false, appAccess: false, active: true, extraClubIds: [], hr: { contract: 'pkwtt', start: '', end: null, signed: true, ktpLast4: '', ktpOnFile: false, salary: 0, allowance: 0, bank: 'BCA', account: '' } } });

// ---------- context ----------
export interface ClockInfo {
  today: ISODate;
  nowMin: number;
}
export function makeCtx(user: User, clubId: string, clock: ClockInfo, mutationId: string, review: ReviewPolicy = 'none'): Ctx {
  let n = 0;
  const pending: { feed: Parameters<Ctx['feed']>[0][]; notify: Parameters<Ctx['notify']>[0][] } = { feed: [], notify: [] };
  const now = toHM(clock.nowMin);
  const ctx: Ctx & { _pending: typeof pending } = {
    user,
    actor: user.id === 'system' ? 'system' : actorOf(user),
    role: roleOf(user),
    clubId,
    today: clock.today,
    nowMin: clock.nowMin,
    now,
    nowDT: `${clock.today}T${now}`,
    mutationId,
    id: (prefix) => `${prefix}_${mutationId}_${++n}`,
    fail: (code, params) => {
      throw new DomainError(code, params);
    },
    feed: (e) => pending.feed.push(e),
    notify: (x) => pending.notify.push(x),
    result: {},
    review,
    _pending: pending,
  };
  return ctx;
}

function flushSideEffects(draft: Draft<ClubState>, ctx: Ctx) {
  const p = (ctx as Ctx & { _pending: { feed: Parameters<Ctx['feed']>[0][]; notify: Parameters<Ctx['notify']>[0][] } })._pending;
  for (const e of p.feed) {
    const id = ctx.id('act');
    draft.activity[id] = { id, clubId: ctx.clubId, at: ctx.nowDT, actor: ctx.actor, action: 'feed', memberId: e.memberId, icon: e.icon, key: e.key, params: e.params || {} } as ActivityEntry;
  }
  for (const x of p.notify) {
    const id = ctx.id('nt');
    draft.notifications[id] = {
      id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, toUsers: x.toUsers || [], toRoles: x.toRoles || [], kind: x.kind, params: x.params || {},
      severity: x.severity || 'info', action: false, link: x.link, ref: x.ref, memberId: x.memberId, readBy: [ctx.user.id],
    } as Notification;
  }
  p.feed = [];
  p.notify = [];
}

// ---------- execution ----------
export interface ExecResult {
  state: ClubState;
  patches: Patch[];
  inverse: Patch[];
  result: Record<string, unknown>;
  reviewed?: 'gate' | 'flag';
}

const getPath = (obj: unknown, path: (string | number)[]) => path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string | number, unknown>)[k]), obj);

/** Field-level changes on one row from a list of patches (for change requests). */
export function changesFor(before: ClubState, patches: Patch[], coll: string, id: string) {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  const seen = new Set<string>();
  for (const p of patches) {
    if (p.path[0] !== coll || p.path[1] !== id || p.path.length < 3) continue;
    const field = String(p.path[2]);
    if (seen.has(field) || ['createdAt', 'createdBy', 'review'].includes(field)) continue;
    seen.add(field);
    out.push({ field, from: getPath(before, [coll, id, field]), to: undefined });
  }
  return out;
}

/**
 * Run an action against a club state. Applies the review policy:
 *  - none: run as is
 *  - gate (non-management): updates/deletes become a pending ChangeRequest (state unchanged except the request);
 *          creates run but every created row is marked pending
 *  - flag: run as is, then record a post-review ChangeRequest
 */
export function execute(state: ClubState, name: string, rawInput: unknown, user: User, clock: ClockInfo, mutationId: string, opts: { forceReview?: ReviewPolicy } = {}): ExecResult {
  const def = getAction(name);
  if (!def) throw new DomainError('err.unknownAction', { name });
  const input = def.parse ? def.parse(rawInput) : rawInput;
  if (!def.can(user, input, state)) throw new DomainError('err.forbidden', { name });
  let policy: ReviewPolicy = opts.forceReview ?? 'none';
  if (!opts.forceReview && def.review && !isMgmt(user)) {
    policy = typeof def.review.policy === 'function' ? def.review.policy(input, state, user) : def.review.policy;
  }
  const ctx = makeCtx(user, state.clubId, clock, mutationId, policy);

  if (policy === 'gate' && def.review && def.review.op !== 'create') {
    // dry run to compute the proposed changes, then store only the request
    const target = def.review.target(input, state);
    const [dryNext, dry] = produceWithPatches(state, (d) => { def.run(d, input, { ...ctx, review: 'none', feed: () => {}, notify: () => {} }); });
    const changes = changesFor(state, dry, collOf(target.type), target.id).map((c) => ({ ...c, to: getPath(dryNext, [collOf(target.type), target.id, c.field]) }));
    if (!changes.length) throw new DomainError('err.noChanges');
    const [next, patches, inverse] = produceWithPatches(state, (d) => {
      // a newer edit to the same section by the same person supersedes their pending request
      for (const cr of Object.values(d.changeRequests)) {
        if (cr.status === 'pending' && cr.section === def.review!.section && cr.target.id === target.id && cr.submittedBy === ctx.actor) cr.status = 'superseded';
      }
      const crId = ctx.id('cr');
      d.changeRequests[crId] = { id: crId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: 'approval', op: def.review!.op, action: name, input, section: def.review!.section, target, changes, status: 'pending', submittedBy: ctx.actor } as ChangeRequest;
      ctx.result.changeRequestId = crId;
      ctx.notify({ toRoles: ['mgmt'], kind: 'notif.reviewSubmitted', params: { who: nameOfUser(user), section: def.review!.section }, link: '/reviews', memberId: target.memberId, severity: 'attention', ref: { type: 'changeRequest', id: crId } });
      flushSideEffects(d, ctx);
    });
    return { state: next, patches, inverse, result: ctx.result, reviewed: 'gate' };
  }

  const [next, patches, inverse] = produceWithPatches(state, (d) => {
    def.run(d, input, ctx);
    flushSideEffects(d, ctx);
  });
  if (policy === 'gate' && def.review) {
    // pending create: mark every created primary row as pending review
    const created = patches.filter((p) => p.op === 'add' && p.path.length === 2 && (COLLECTIONS as readonly string[]).includes(String(p.path[0])) && ['members', 'familyContacts', 'familyLinks'].includes(String(p.path[0])));
    const target = def.review.target(input, next);
    const [next2, patches2, inverse2] = produceWithPatches(next, (d) => {
      const crId = ctx.id('cr');
      for (const p of created) {
        const row = (d as unknown as Record<string, Record<string, { review?: unknown }>>)[String(p.path[0])][String(p.path[1])];
        if (row) row.review = { status: 'pending', crId };
      }
      d.changeRequests[crId] = { id: crId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: 'approval', op: 'create', action: name, input, section: def.review!.section, target, changes: [], createdRows: created.map((p) => ({ coll: String(p.path[0]), id: String(p.path[1]) })), status: 'pending', submittedBy: ctx.actor } as ChangeRequest;
      ctx.result.changeRequestId = crId;
      ctx.notify({ toRoles: ['mgmt'], kind: 'notif.reviewSubmitted', params: { who: nameOfUser(user), section: def.review!.section }, link: '/reviews', memberId: target.memberId, severity: 'attention', ref: { type: 'changeRequest', id: crId } });
      flushSideEffects(d, ctx);
    });
    return { state: next2, patches: [...patches, ...patches2], inverse: [...inverse2, ...inverse], result: ctx.result, reviewed: 'gate' };
  }
  if (policy === 'flag' && def.review) {
    const target = def.review.target(input, state);
    const changes = changesFor(state, patches, collOf(target.type), target.id).map((c) => ({ ...c, to: getPath(next, [collOf(target.type), target.id, c.field]) }));
    if (changes.length) {
      const [next2, patches2, inverse2] = produceWithPatches(next, (d) => {
        const crId = ctx.id('cr');
        d.changeRequests[crId] = { id: crId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: 'postReview', op: def.review!.op, action: name, input, section: def.review!.section, target, changes, status: 'pending', submittedBy: ctx.actor } as ChangeRequest;
        ctx.notify({ toRoles: ['mgmt'], kind: 'notif.reviewFlagged', params: { who: nameOfUser(user), section: def.review!.section }, link: '/reviews', memberId: target.memberId, severity: 'attention', ref: { type: 'changeRequest', id: crId } });
        flushSideEffects(d, ctx);
      });
      return { state: next2, patches: [...patches, ...patches2], inverse: [...inverse2, ...inverse], result: ctx.result, reviewed: 'flag' };
    }
  }
  return { state: next, patches, inverse, result: ctx.result };
}

export const collOf = (type: ChangeRequest['target']['type']) =>
  ({ member: 'members', familyContact: 'familyContacts', familyLink: 'familyLinks', enquiry: 'enquiries', document: 'members' })[type];

export function nameOfUser(u: User) {
  return u.kind === 'staff' ? u.staff.knownAs || u.staff.name : u.contact.name;
}

/** Touched rows from patches: [collection, id] pairs plus whether the club row changed. */
export function touchedRows(patches: Patch[]) {
  const rows = new Map<string, Set<string>>();
  let club = false;
  for (const p of patches) {
    const c = String(p.path[0]);
    if (c === 'club') { club = true; continue; }
    if (!(COLLECTIONS as readonly string[]).includes(c) || p.path.length < 2) continue;
    if (!rows.has(c)) rows.set(c, new Set());
    rows.get(c)!.add(String(p.path[1]));
  }
  return { rows, club };
}

export { original, current, isDraft };
export type { Patch };
