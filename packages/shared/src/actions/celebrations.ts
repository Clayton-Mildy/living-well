// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or small celebration; the front desk requests, management confirms.
// A request by management is confirmed at once. Editing a confirmed one at the front desk sends it back for confirmation. Families hear only when it is confirmed.
import type { Draft } from 'immer';
import type { Celebration, CelebrationKind, ClubState, HM, ISODate, Invoice, User } from '../types';
import { defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { emailInvoice } from './emails';
import { primaryContact } from '../rules/core';
import { addDays } from '../util';
import { CELEBRATION_GUESTS_MAX, CELEBRATION_KINDS, celebrationIsPast, checkCelebrationSlot } from '../rules/celebrations';
import { dm, hm, int, isoDate, obj, oneOf, str } from '../rules/mgmtParse';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
const finMgmt = (u: User) => hasRole(u, 'finance', 'mgmt');
/** Round 14: the activity team prepares a birthday too (Prepare on its Today); what it asks for is requested, like the front desk's. */
const canRequest = (u: User) => hasRole(u, 'lobby', 'activity', 'mgmt');
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
    can: canRequest,
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
      c.decidedBy = ctx.actor;
      c.decidedAt = ctx.nowDT;
      if (i.status === 'declined' && i.reason) c.declineReason = i.reason;
      const name = shortOf(d, c.memberId);
      ctx.feed({ icon: 'cake', key: i.status === 'confirmed' ? 'celeb.feed.confirmed' : 'celeb.feed.declined', memberId: c.memberId, params: { name, date: dm(c.date) } });
      ctx.notify({ toRoles: ['lobby'], kind: i.status === 'confirmed' ? 'celeb.notif.decided' : 'celeb.notif.declined', params: { name, title: c.title, date: dm(c.date), status: i.status }, link: '/venue?tab=celebrations', memberId: c.memberId });
      if (i.status === 'confirmed') tellFamily(d, c, ctx);
    },
  }),
  // ----- round 16: charges (free by default) and their own invoice -----
  defineAction<{ celebrationId: string; item: string; amount: number }>({
    name: 'celebration.addCharge',
    can: lobbyOrMgmt,
    parse: (raw) => { const o = obj(raw); return { celebrationId: id80(o.celebrationId, 'celebrationId'), item: str(o.item, 60, { required: true, field: 'item' }), amount: int(o.amount, 1_000, 100_000_000, 'amount') }; },
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      open(c, ctx);
      c.charges ??= [];
      c.charges.push({ id: ctx.id('cc'), item: i.item, amount: i.amount });
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
      if (ch!.invoiceId) ctx.fail('err.charged');
      c.charges = c.charges!.filter((x) => x.id !== i.chargeId);
    },
  }),
  defineAction<{ celebrationId: string }>({
    name: 'celebration.issueInvoice',
    can: finMgmt,
    parse: (raw) => ({ celebrationId: id80(obj(raw).celebrationId, 'celebrationId') }),
    run(d, i, ctx) {
      const c = celebration(d, i.celebrationId, ctx);
      if (c.status === 'declined' || c.status === 'cancelled') ctx.fail('celeb.err.decided', { status: c.status });
      const todo = (c.charges ?? []).filter((x) => !x.invoiceId);
      if (!todo.length) ctx.fail('err.nothingToBill');
      const m = requireMember(d, c.memberId, ctx);
      const payer = primaryContact(S(d), m.id);
      if (!payer) ctx.fail('err.noPayer');
      const prefix = `CEL-${ctx.today.slice(2, 4)}${ctx.today.slice(5, 7)}-`;
      const n = Object.keys(d.invoices).filter((k) => k.startsWith(prefix)).length + 1;
      const number = prefix + String(n).padStart(3, '0');
      const inv: Invoice = {
        id: number, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, number, memberId: m.id, payerFamilyId: payer!.id, kind: 'manual', issueDate: ctx.today, dueDate: addDays(ctx.today, 7),
        lines: todo.map((x) => ({ id: `cel-${x.id}`, kind: 'celebration' as const, label: 'inv.line.celebration', params: { item: x.item, title: c.title }, qty: 1, unit: x.amount, amount: x.amount })),
        va: m.billing.va, xero: 'awaitingPayment', reminders: [], callNotes: [],
      };
      d.invoices[number] = inv;
      for (const x of todo) x.invoiceId = number;
      emailInvoice(d, ctx, number);
      ctx.notify({ toUsers: [payer!.id], kind: 'celeb.notif.invoiced', params: { name: shortOf(d, m.id), number, title: c.title }, link: '/billing', memberId: m.id, ref: { type: 'invoice', id: number } });
      ctx.result.invoiceId = number;
    },
  }),
];

/** The member's family hears once the club has said yes (never about a request). */
function tellFamily(d: Draft<ClubState>, c: Draft<Celebration>, ctx: Ctx) {
  const users = familyUserIds(d, c.memberId);
  if (!users.length) return;
  ctx.notify({ toUsers: users, kind: 'celeb.notif.family', params: { name: shortOf(d, c.memberId), title: c.title, date: dm(c.date), from: c.from }, link: '/calendar', memberId: c.memberId });
}
