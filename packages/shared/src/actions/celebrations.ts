// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or small celebration; the front desk requests, management confirms.
// A request by management is confirmed at once. Editing a confirmed one at the front desk sends it back for confirmation. Families hear only when it is confirmed.
import type { Draft } from 'immer';
import type { Celebration, CelebrationKind, ClubState, HM, ISODate, User } from '../types';
import { defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { CELEBRATION_GUESTS_MAX, CELEBRATION_KINDS, celebrationIsPast, checkCelebrationSlot } from '../rules/celebrations';
import { dm, hm, int, isoDate, obj, oneOf, str } from '../rules/mgmtParse';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
const id80 = (v: unknown, field: string) => str(v, 80, { required: true, field });
const S = (d: Draft<ClubState>) => d as unknown as ClubState;

interface CelIn { memberId: string; kind: CelebrationKind; title: string; date: ISODate; from: HM; to: HM; roomId: string; guests: number; cateringNote?: string }
type CelUpdateIn = { celebrationId: string } & Partial<Omit<CelIn, 'memberId'>> & { cateringNote?: string };

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
    can: lobbyOrMgmt,
    parse(raw) {
      const o = obj(raw);
      return { memberId: id80(o.memberId, 'memberId'), ...common(o, false) } as CelIn;
    },
    run(d, i, ctx) {
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
      const name = shortOf(d, c.memberId);
      ctx.feed({ icon: 'event_busy', key: 'celeb.feed.cancelled', memberId: c.memberId, params: { name, date: dm(c.date) } });
      if (wasConfirmed && !isMgmt(ctx.user)) ctx.notify({ toRoles: ['mgmt'], kind: 'celeb.notif.cancelled', params: { name, title: c.title, date: dm(c.date) }, link: '/venue?tab=celebrations', memberId: c.memberId });
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
      c.decidedBy = ctx.actor;
      c.decidedAt = ctx.nowDT;
      if (i.status === 'declined' && i.reason) c.declineReason = i.reason;
      const name = shortOf(d, c.memberId);
      ctx.feed({ icon: 'cake', key: i.status === 'confirmed' ? 'celeb.feed.confirmed' : 'celeb.feed.declined', memberId: c.memberId, params: { name, date: dm(c.date) } });
      ctx.notify({ toRoles: ['lobby'], kind: 'celeb.notif.decided', params: { name, title: c.title, date: dm(c.date), status: i.status }, link: '/venue?tab=celebrations', memberId: c.memberId });
      if (i.status === 'confirmed') tellFamily(d, c, ctx);
    },
  }),
];

/** The member's family hears once the club has said yes (never about a request). */
function tellFamily(d: Draft<ClubState>, c: Draft<Celebration>, ctx: Ctx) {
  const users = familyUserIds(d, c.memberId);
  if (!users.length) return;
  ctx.notify({ toUsers: users, kind: 'celeb.notif.family', params: { name: shortOf(d, c.memberId), title: c.title, date: dm(c.date), from: c.from }, link: '/calendar', memberId: c.memberId });
}
