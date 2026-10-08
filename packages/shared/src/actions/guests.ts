// KC round 7: guest hosts (outside teachers and entertainers) and the sessions they lead. See rules/guests.ts.
// Management books a guest host for a date + session; they show as the host in the calendar. KC round 7: the fee becomes a vendor invoice as soon as
// the guest is booked, so finance can pay before the performance (or after); "done" only records that the session took place. The payment state is
// read from that invoice. Changing the booking updates an unpaid invoice; cancelling drops an unpaid one and flags a paid one for finance.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { ClubState, GuestHost, GuestSession, ISODate, Slot } from '../types';
import { DomainError, defineAction, hasRole, type ActionDef, type Ctx } from './framework';
import { parseWith, isoDate, setDayCell, openDayOrFail, effectiveCell, clearDaySlot } from './schedule';
import { activityTeachers, sameCell, weeklyCell } from '../rules/calendar';
import { scheduleDayOf } from '../rules/kitchen';
import { guestInvoiceNumber, guestOn } from '../rules/guests';
import { e164, live, rp } from '../util';

const mgmtOnly = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'mgmt');
type D = Draft<ClubState>;
const slotSchema = z.enum(['10:30', '13:30']);
const kindSchema = z.enum(['teacher', 'entertainer', 'speaker', 'other']);
const fee = z.number().int().min(1).max(100_000_000);
const text = (max: number) => z.string().trim().max(max);

const hostIn = (d: D, id: string, ctx: Ctx): Draft<GuestHost> => {
  const h = d.guestHosts[id];
  if (!h || h.deletedAt) ctx.fail('err.notFound');
  return h;
};
const sessionIn = (d: D, id: string, ctx: Ctx): Draft<GuestSession> => {
  const g = d.guestSessions[id];
  if (!g || g.deletedAt) ctx.fail('err.notFound');
  return g;
};

/** Put the host's activity into the slot for that one day (the weekly plan is untouched). True when that changed the slot, in which case teachers and families were told. */
function placeSession(d: D, ctx: Ctx, o: { date: ISODate; slot: Slot; activityId: string; host: string }): boolean {
  const a = d.activities[o.activityId];
  if (!a || a.deletedAt) ctx.fail('cal.err.badActivity');
  const cur = effectiveCell(d, o.date, o.slot);
  if (cur && cur.activityId === o.activityId) return false;
  const staffId = cur && d.staff[cur.staffId] && !d.staff[cur.staffId].deletedAt ? cur.staffId : activityTeachers(d as unknown as ClubState)[0]?.id;
  if (!staffId) ctx.fail('cal.err.noTeacher');
  setDayCell(d, ctx, {
    date: o.date, slot: o.slot, cell: { activityId: o.activityId, staffId, roomId: a.roomId },
    tell: { kind: 'guests.notif.booked', params: { name: o.host, activity: a.name, date: o.date, slot: o.slot } },
  });
  return true;
}
/** The booking changed the slot's activity for that day: give the slot back to the weekly plan (quietly), unless it was changed again since. */
function releaseSlot(d: D, g: Pick<GuestSession, 'date' | 'slot' | 'activityId'>) {
  const view = d as unknown as ClubState;
  const over = scheduleDayOf(view, g.date)?.slots[g.slot];
  if (over && over.activityId === g.activityId && !sameCell(over, weeklyCell(view, g.date, g.slot))) clearDaySlot(d, g.date, g.slot);
}
const tellTeachers = (ctx: Ctx, kind: string, params: Record<string, string | number>) => ctx.notify({ toRoles: ['activity'], kind, params, link: '/calendar' });

/** The session's fee as a vendor invoice for finance (approved: management booked it). Created at booking, so it can be paid before the performance. */
function invoiceFor(d: D, ctx: Ctx, g: Draft<GuestSession>): string {
  const host = d.guestHosts[g.hostId];
  const supplier = host?.name ?? '';
  const viId = ctx.id('vi');
  const number = guestInvoiceNumber(d as unknown as ClubState, g.date);
  const section = d.budgetSections.activities && !d.budgetSections.activities.deletedAt ? 'activities' : live(d.budgetSections as ClubState['budgetSections'])[0]?.id ?? 'activities';
  d.vendorInvoices[viId] = {
    id: viId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, supplier, number, amount: g.fee, due: g.date, sectionId: section,
    status: 'approved', xero: 'pending', decidedBy: ctx.actor, decidedAt: ctx.nowDT,
  };
  g.vendorInvoiceId = viId;
  ctx.notify({ toRoles: ['finance'], kind: 'guests.notif.toPay', params: { name: supplier, amount: rp(g.fee), number }, link: '/guests' });
  return viId;
}
/** The unpaid invoice of a session, if any (a paid one is never changed). */
const unpaidInvoice = (d: D, g: Pick<GuestSession, 'vendorInvoiceId'>) => {
  const v = g.vendorInvoiceId ? d.vendorInvoices[g.vendorInvoiceId] : undefined;
  return v && !v.deletedAt && v.status !== 'paid' ? v : undefined;
};

const bankSchema = z.object({ bank: text(40), account: text(40), holder: text(80) });
const saveHostSchema = z.object({
  id: z.string().min(1).optional(),
  name: text(80).min(1),
  kind: kindSchema,
  what: text(80).min(1),
  phone: text(30),
  fee,
  bank: bankSchema.nullish(),
  note: text(300).nullish(),
  active: z.boolean().optional(),
});

export const guestActions: ActionDef[] = [
  defineAction<z.infer<typeof saveHostSchema>>({
    name: 'guest.saveHost',
    can: mgmtOnly,
    parse: (raw) => {
      const r = parseWith(saveHostSchema, raw);
      if (r.phone && r.phone.replace(/\D/g, '').length < 8) throw new DomainError('err.invalid', { field: 'phone' });
      return { ...r, phone: e164(r.phone) };
    },
    run(d, input, ctx) {
      const dup = live(d.guestHosts as ClubState['guestHosts']).some((h) => h.id !== input.id && h.name.trim().toLowerCase() === input.name.toLowerCase());
      if (dup) ctx.fail('guests.err.dupHost', { name: input.name });
      const bank = input.bank && (input.bank.bank || input.bank.account || input.bank.holder) ? { bank: input.bank.bank, account: input.bank.account, holder: input.bank.holder } : undefined;
      if (input.id) {
        const h = hostIn(d, input.id, ctx);
        h.name = input.name;
        h.kind = input.kind;
        h.what = input.what;
        h.phone = input.phone;
        h.fee = input.fee;
        if (bank) h.bank = bank; else delete h.bank;
        if (input.note) h.note = input.note; else delete h.note;
        if (input.active !== undefined) h.active = input.active;
        ctx.result.hostId = h.id;
        return;
      }
      const id = ctx.id('gh');
      d.guestHosts[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.name, kind: input.kind, what: input.what, phone: input.phone, fee: input.fee,
        ...(bank ? { bank } : {}), ...(input.note ? { note: input.note } : {}), active: input.active ?? true,
      };
      ctx.result.hostId = id;
    },
  }),

  defineAction<{ id: string }>({
    name: 'guest.archiveHost',
    can: mgmtOnly,
    parse: (raw) => parseWith(z.object({ id: z.string().min(1) }), raw),
    run(d, input, ctx) {
      const h = hostIn(d, input.id, ctx);
      // a host with a booking still to come stays until it is cancelled or done; their past sessions keep the name
      if (live(d.guestSessions as ClubState['guestSessions']).some((g) => g.hostId === h.id && g.status === 'booked')) ctx.fail('guests.err.hostBooked', { name: h.name });
      h.deletedAt = ctx.nowDT;
    },
  }),

  defineAction<{ hostId: string; date: ISODate; slot: Slot; activityId?: string; fee?: number; note?: string | null }>({
    name: 'guest.book',
    can: mgmtOnly,
    parse: (raw) =>
      parseWith(z.object({ hostId: z.string().min(1), date: isoDate, slot: slotSchema, activityId: z.string().min(1).optional(), fee: fee.optional(), note: text(300).nullish() }), raw),
    run(d, input, ctx) {
      const host = hostIn(d, input.hostId, ctx);
      if (!host.active) ctx.fail('guests.err.hostInactive', { name: host.name });
      openDayOrFail(d, ctx, input.date);
      if (guestOn(d as unknown as ClubState, input.date, input.slot)) ctx.fail('guests.err.slotTaken');
      const activityId = input.activityId ?? effectiveCell(d, input.date, input.slot)?.activityId ?? '';
      if (!activityId) ctx.fail('guests.err.needActivity');
      const changed = placeSession(d, ctx, { date: input.date, slot: input.slot, activityId, host: host.name });
      const id = ctx.id('gs');
      d.guestSessions[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, hostId: host.id, date: input.date, slot: input.slot, activityId, fee: input.fee ?? host.fee, status: 'booked',
        ...(input.note ? { note: input.note } : {}),
      };
      ctx.result.vendorInvoiceId = invoiceFor(d, ctx, d.guestSessions[id]); // finance can pay from now on, before the performance
      const act = d.activities[activityId].name;
      if (!changed) tellTeachers(ctx, 'guests.notif.booked', { name: host.name, activity: act, date: input.date, slot: input.slot });
      ctx.feed({ icon: 'co_present', key: 'guests.feed.booked', params: { name: host.name, date: input.date, slot: input.slot } });
      ctx.result.sessionId = id;
    },
  }),

  defineAction<{ id: string; hostId?: string; date?: ISODate; slot?: Slot; activityId?: string; fee?: number; note?: string | null }>({
    name: 'guest.update',
    can: mgmtOnly,
    parse: (raw) =>
      parseWith(z.object({ id: z.string().min(1), hostId: z.string().min(1).optional(), date: isoDate.optional(), slot: slotSchema.optional(), activityId: z.string().min(1).optional(), fee: fee.optional(), note: text(300).nullish() }), raw),
    run(d, input, ctx) {
      const g = sessionIn(d, input.id, ctx);
      if (g.status !== 'booked') ctx.fail('guests.err.notBooked');
      const host = input.hostId && input.hostId !== g.hostId ? hostIn(d, input.hostId, ctx) : hostIn(d, g.hostId, ctx);
      if (host.id !== g.hostId && !host.active) ctx.fail('guests.err.hostInactive', { name: host.name });
      const date = input.date ?? g.date;
      const slot = input.slot ?? g.slot;
      const activityId = input.activityId ?? g.activityId;
      const moved = date !== g.date || slot !== g.slot;
      const actChanged = activityId !== g.activityId;
      if (moved || actChanged) {
        openDayOrFail(d, ctx, date);
        const other = live(d.guestSessions as ClubState['guestSessions']).find((x) => x.id !== g.id && x.date === date && x.slot === slot && x.status !== 'cancelled');
        if (other) ctx.fail('guests.err.slotTaken');
        releaseSlot(d, g);
      }
      const prev = { hostId: g.hostId, date: g.date, slot: g.slot, activityId: g.activityId, fee: g.fee, note: g.note ?? null };
      let told = false;
      if (moved || actChanged) told = placeSession(d, ctx, { date, slot, activityId, host: host.name });
      g.hostId = host.id;
      g.date = date;
      g.slot = slot;
      g.activityId = activityId;
      if (input.fee !== undefined) g.fee = input.fee;
      if (input.note !== undefined) { if (input.note) g.note = input.note; else delete g.note; }
      if (JSON.stringify(prev) === JSON.stringify({ hostId: g.hostId, date: g.date, slot: g.slot, activityId: g.activityId, fee: g.fee, note: g.note ?? null })) ctx.fail('err.noChanges');
      // an unpaid invoice follows the booking (who, how much, when); a paid one stays as it was
      const v = unpaidInvoice(d, g);
      if (v) { v.supplier = host.name; v.amount = g.fee; v.due = g.date; }
      else if (!g.vendorInvoiceId) invoiceFor(d, ctx, g); // a booking from before invoices were made at booking
      if ((moved || actChanged || host.id !== prev.hostId) && !told) tellTeachers(ctx, 'guests.notif.booked', { name: host.name, activity: d.activities[activityId]?.name ?? '', date, slot });
      ctx.result.sessionId = g.id;
    },
  }),

  defineAction<{ id: string }>({
    name: 'guest.cancel',
    can: mgmtOnly,
    parse: (raw) => parseWith(z.object({ id: z.string().min(1) }), raw),
    run(d, input, ctx) {
      const g = sessionIn(d, input.id, ctx);
      if (g.status !== 'booked') ctx.fail('guests.err.notBooked');
      g.status = 'cancelled';
      releaseSlot(d, g);
      const name = d.guestHosts[g.hostId]?.name ?? '';
      // nothing to pay any more: an unpaid invoice is withdrawn; a paid one stays, and finance is told to ask for the money back
      const v = unpaidInvoice(d, g);
      if (v) { v.status = 'rejected'; v.note = 'Guest session cancelled'; v.decidedBy = ctx.actor; v.decidedAt = ctx.nowDT; }
      else if (g.vendorInvoiceId && d.vendorInvoices[g.vendorInvoiceId]?.status === 'paid') ctx.notify({ toRoles: ['finance', 'mgmt'], kind: 'guests.notif.paidCancelled', params: { name, amount: rp(g.fee) }, link: '/guests' });
      tellTeachers(ctx, 'guests.notif.cancelled', { name, date: g.date, slot: g.slot });
      ctx.feed({ icon: 'event_busy', key: 'guests.feed.cancelled', params: { name, date: g.date, slot: g.slot } });
    },
  }),

  defineAction<{ id: string }>({
    name: 'guest.done',
    can: mgmtOnly,
    parse: (raw) => parseWith(z.object({ id: z.string().min(1) }), raw),
    run(d, input, ctx) {
      const g = sessionIn(d, input.id, ctx);
      if (g.status !== 'booked') ctx.fail('guests.err.notBooked');
      if (g.date > ctx.today) ctx.fail('guests.err.notYet');
      const supplier = d.guestHosts[g.hostId]?.name ?? '';
      g.status = 'done';
      const viId = g.vendorInvoiceId && d.vendorInvoices[g.vendorInvoiceId] && !d.vendorInvoices[g.vendorInvoiceId].deletedAt ? g.vendorInvoiceId : invoiceFor(d, ctx, g);
      ctx.feed({ icon: 'task_alt', key: 'guests.feed.done', params: { name: supplier, date: g.date, slot: g.slot } });
      ctx.result.vendorInvoiceId = viId;
    },
  }),
] as ActionDef[];

