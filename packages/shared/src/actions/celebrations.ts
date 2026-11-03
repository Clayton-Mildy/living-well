// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or small celebration; the front desk requests, management confirms.
// A request by management is confirmed at once. Editing a confirmed one at the front desk sends it back for confirmation. Families hear only when it is confirmed.
import type { Draft } from 'immer';
import type { Celebration, CelebrationKind, ClubState, HM, ISODate, User } from '../types';
import { canRun, defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { CELEBRATION_GUESTS_MAX, CELEBRATION_KINDS, celebrationIsPast, checkCelebrationSlot } from '../rules/celebrations';
import { arr, bad, dm, hm, int, isoDate, obj, oneOf, str } from '../rules/mgmtParse';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
/** Round 14: the activity team prepares a birthday too (Prepare on its Today); what it asks for is requested, like the front desk's. */
const canRequest = (u: User) => hasRole(u, 'lobby', 'activity', 'mgmt');
const id80 = (v: unknown, field: string) => str(v, 80, { required: true, field });
const S = (d: Draft<ClubState>) => d as unknown as ClubState;

interface CelIn { memberId: string; kind: CelebrationKind; title: string; date: ISODate; from: HM; to: HM; roomId: string; guests: number; cateringNote?: string; charges?: { item: string; amount: number }[] }
type CelUpdateIn = { celebrationId: string } & Partial<Omit<CelIn, 'memberId'>> & { cateringNote?: string };

/** Round 18: charges listed while the party is made (at most 10; the same item and amount limits as addCharge). */
const CHARGES_MAX = 10;
const parseCharge = (raw: unknown) => { const o = obj(raw); return { item: str(o.item, 60, { required: true, field: 'item' }), amount: int(o.amount, 1_000, 100_000_000, 'amount') }; };
const parseCharges = (v: unknown, field: string) => (Array.isArray(v) && v.length > CHARGES_MAX ? bad(field) : arr(v, parseCharge, CHARGES_MAX));

const common = (o: Record<string, unknown>, partial: boolean) => {
  const out: Partial<CelIn> = {};
  const has = (k: string) => !partial || o[k] !== undefined;
  if (has('kind')) out.kind = oneOf(o.kind, CELEBRATION_KINDS, 'kind');
  if (has('title')) out.title = str(o.title, 120, { required: true, field: 'title' });
  if (has('date')) out.date = isoDate(o.date, 'date');
  if (has('from')) out.from = hm(o.from, 'from');
  if (has('to')) out.to = hm(o.to, 'to');
  if (has('roomId')) out.roomId = id80(o.roomId, 'roomId');
  if (has('guests')) out.guests = int(o.guests, 0, CELEBRATION_GUESTS_MAX, 'guests');
  if (o.cateringNote !== undefined) out.cateringNote = str(o.cateringNote, 200);
  return out;
};
function celebration(d: Draft<ClubState>, id: string, ctx: Ctx): Draft<Celebration> {
  const c = d.celebrations?.[id];
  if (!c || c.deletedAt) ctx.fail('err.notFound');
  return c;
}
/** A celebration that is still open to change: requested or confirmed, and not over. */
function open(c: Draft<Celebration>, ctx: Ctx) {
  if (c.status === 'declined' || c.status === 'cancelled') ctx.fail('celeb.err.decided', { status: c.status });
  if (celebrationIsPast(c, ctx.today, ctx.now)) ctx.fail('mgmt.err.venueDone');
}
const slotOf = (c: { roomId: string; date: ISODate; from: HM; to: HM }) => ({ roomId: c.roomId, date: c.date, from: c.from, to: c.to });

export const celebrationActions = [
  defineAction<CelIn>({
    name: 'celebration.request',
    can: canRequest,
    parse(raw) {
      const o = obj(raw);
      const charges = o.charges === undefined ? [] : parseCharges(o.charges, 'charges');
      return { memberId: id80(o.memberId, 'memberId'), ...common(o, false), ...(charges.length ? { charges } : {}) } as CelIn;
    },
    run(d, i, ctx) {
      // the whole request is refused before anything is made: the activity team asks for a party, not for what it costs. The rule is addCharge's
      // (its role, then the access grid), so a role granted Venue › Edit may list charges here as it may add them after (final review I-2)
      if (i.charges?.length && !canRun('celebration.addCharge', ctx.user, { celebrationId: 'new' }, S(d))) ctx.fail('err.forbidden');
      const m = requireMember(d, i.memberId, ctx);
      const chk = checkCelebrationSlot(S(d), slotOf(i), ctx.today, ctx.now);
      if (!chk.ok) ctx.fail(chk.code, chk.params);
      d.celebrations ??= {};
      const id = ctx.id('cel');
      const byMgmt = isMgmt(ctx.user);
      d.celebrations[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, kind: i.kind, title: i.title, date: i.date, from: i.from, to: i.to, roomId: i.roomId, guests: i.guests,
        ...(i.cateringNote ? { cateringNote: i.cateringNote } : {}), status: byMgmt ? 'confirmed' : 'requested', requestedBy: ctx.actor,
        ...(byMgmt ? { decidedBy: ctx.actor, decidedAt: ctx.nowDT } : {}),
      };
      ctx.result.celebrationId = id;
      for (const x of i.charges ?? []) addChargeTo(d, d.celebrations[id], x.item, x.amount, ctx);
      const name = shortOf(d, m.id);
      ctx.feed({ icon: 'cake', key: byMgmt ? 'celeb.feed.confirmed' : 'celeb.feed.requested', memberId: m.id, params: { name, date: dm(i.date) } });
      if (byMgmt) tellFamily(d, d.celebrations[id], ctx);
      else ctx.notify({ toRoles: ['mgmt'], kind: 'celeb.notif.requested', params: { name, title: i.title, date: dm(i.date) }, link: '/venue?tab=celebrations', memberId: m.id });
    },
  }),
  defineAction<CelUpdateIn>({
    name: 'celebration.update',
    can: lobbyOrMgmt,
    parse(raw) {
      const o = obj(raw);
      return { celebrationId: id80(o.celebrationId, 'celebrationId'), ...common(o, true) };
    },
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      open(c, ctx);
      const slot = { roomId: i.roomId ?? c.roomId, date: i.date ?? c.date, from: i.from ?? c.from, to: i.to ?? c.to };
      if (slot.roomId !== c.roomId || slot.date !== c.date || slot.from !== c.from || slot.to !== c.to) {
        const chk = checkCelebrationSlot(S(d), slot, ctx.today, ctx.now, c.id);
        if (!chk.ok) ctx.fail(chk.code, chk.params);
      }
      if (i.kind !== undefined) c.kind = i.kind;
      if (i.title !== undefined) c.title = i.title;
      if (i.guests !== undefined) c.guests = i.guests;
      if (i.cateringNote !== undefined) {
        if (i.cateringNote) c.cateringNote = i.cateringNote;
        else delete c.cateringNote;
      }
      Object.assign(c, slot);
      const name = shortOf(d, c.memberId);
      if (c.status === 'confirmed' && !isMgmt(ctx.user)) {
        c.status = 'requested';
        delete c.decidedBy;
        delete c.decidedAt;
        ctx.notify({ toRoles: ['mgmt'], kind: 'celeb.notif.requested', params: { name, title: c.title, date: dm(c.date) }, link: '/venue?tab=celebrations', memberId: c.memberId });
      }
      ctx.feed({ icon: 'cake', key: 'celeb.feed.updated', memberId: c.memberId, params: { name, date: dm(c.date) } });
    },
  }),
  defineAction<{ celebrationId: string }>({
    name: 'celebration.cancel',
    can: lobbyOrMgmt,
    parse: (raw) => ({ celebrationId: id80(obj(raw).celebrationId, 'celebrationId') }),
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      open(c, ctx);
      const wasConfirmed = c.status === 'confirmed';
      c.status = 'cancelled';
      dropPendingCharges(d, c);
      const name = shortOf(d, c.memberId);
      ctx.feed({ icon: 'event_busy', key: 'celeb.feed.cancelled', memberId: c.memberId, params: { name, date: dm(c.date) } });
      if (wasConfirmed) {
        const p = { name, title: c.title, date: dm(c.date) };
        // the front desk cancelling tells management; management cancelling a confirmed one tells the member's family (they were told it was booked)
        if (isMgmt(ctx.user)) { const users = familyUserIds(d, c.memberId); if (users.length) ctx.notify({ toUsers: users, kind: 'celeb.notif.cancelled', params: p, link: '/calendar', memberId: c.memberId }); }
        else ctx.notify({ toRoles: ['mgmt'], kind: 'celeb.notif.cancelled', params: p, link: '/venue?tab=celebrations', memberId: c.memberId });
      }
    },
  }),
  defineAction<{ celebrationId: string; status: 'confirmed' | 'declined'; reason?: string }>({
    name: 'celebration.decide',
    can: (u) => isMgmt(u),
    parse(raw) {
      const o = obj(raw);
      const reason = str(o.reason, 200);
      return { celebrationId: id80(o.celebrationId, 'celebrationId'), status: oneOf(o.status, ['confirmed', 'declined'] as const, 'status'), ...(reason ? { reason } : {}) };
    },
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      if (c.status !== 'requested') ctx.fail('celeb.err.decided', { status: c.status });
      if (i.status === 'confirmed') {
        // the slot may have gone (or the day passed) while it waited
        const chk = checkCelebrationSlot(S(d), slotOf(c), ctx.today, ctx.now, c.id);
        if (!chk.ok) ctx.fail(chk.code, chk.params);
      }
      c.status = i.status;
      if (i.status === 'declined') dropPendingCharges(d, c);
      c.decidedBy = ctx.actor;
      c.decidedAt = ctx.nowDT;
      if (i.status === 'declined' && i.reason) c.declineReason = i.reason;
      const name = shortOf(d, c.memberId);
      ctx.feed({ icon: 'cake', key: i.status === 'confirmed' ? 'celeb.feed.confirmed' : 'celeb.feed.declined', memberId: c.memberId, params: { name, date: dm(c.date) } });
      ctx.notify({ toRoles: ['lobby'], kind: i.status === 'confirmed' ? 'celeb.notif.decided' : 'celeb.notif.declined', params: { name, title: c.title, date: dm(c.date), status: i.status }, link: '/venue?tab=celebrations', memberId: c.memberId });
      if (i.status === 'confirmed') tellFamily(d, c, ctx);
    },
  }),
  // ----- round 16: charges (free by default); round 17: each is a pending charge on the member's next monthly invoice -----
  defineAction<{ celebrationId: string; item: string; amount: number }>({
    name: 'celebration.addCharge',
    can: lobbyOrMgmt,
    parse: (raw) => { const o = obj(raw); return { celebrationId: id80(o.celebrationId, 'celebrationId'), item: str(o.item, 60, { required: true, field: 'item' }), amount: int(o.amount, 1_000, 100_000_000, 'amount') }; },
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      open(c, ctx);
      addChargeTo(d, c, i.item, i.amount, ctx);
    },
  }),
  defineAction<{ celebrationId: string; chargeId: string }>({
    name: 'celebration.removeCharge',
    can: lobbyOrMgmt,
    parse: (raw) => { const o = obj(raw); return { celebrationId: id80(o.celebrationId, 'celebrationId'), chargeId: id80(o.chargeId, 'chargeId') }; },
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      const ch = (c.charges ?? []).find((x) => x.id === i.chargeId);
      if (!ch) ctx.fail('err.notFound');
      if (d.pendingCharges[`cel-${ch!.id}`]?.invoiceId) ctx.fail('err.charged');
      delete d.pendingCharges[`cel-${ch!.id}`];
      c.charges = c.charges!.filter((x) => x.id !== i.chargeId);
    },
  }),
];

/** A charge on a celebration, and its pending charge on the member's next monthly invoice (used by addCharge and by request). */
function addChargeTo(d: Draft<ClubState>, c: Draft<Celebration>, item: string, amount: number, ctx: Ctx) {
  c.charges ??= [];
  const chargeId = ctx.id('cc');
  c.charges.push({ id: chargeId, item, amount });
  const pid = `cel-${chargeId}`;
  d.pendingCharges[pid] = { id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: c.memberId, amount, label: 'inv.line.birthday', params: { item }, source: { type: 'celebration', id: c.id } };
}

/** Round 17: a party that did not happen bills nothing: its charges still waiting for a run go (any already on an invoice stay). */
function dropPendingCharges(d: Draft<ClubState>, c: Draft<Celebration>) {
  for (const x of c.charges ?? []) {
    const p = d.pendingCharges[`cel-${x.id}`];
    if (p && !p.invoiceId) delete d.pendingCharges[`cel-${x.id}`];
  }
}

/** The member's family hears once the club has said yes (never about a request). */
function tellFamily(d: Draft<ClubState>, c: Draft<Celebration>, ctx: Ctx) {
  const users = familyUserIds(d, c.memberId);
  if (!users.length) return;
  ctx.notify({ toUsers: users, kind: 'celeb.notif.family', params: { name: shortOf(d, c.memberId), title: c.title, date: dm(c.date), from: c.from }, link: '/calendar', memberId: c.memberId });
}
