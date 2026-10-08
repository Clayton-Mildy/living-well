// Lobby attendance actions for a drop-in club: members come on any open day and the lobby checks them in and out.
// A check-in records the time and how it happened (door camera or picked by name); nobody is "expected", and nobody is
// recorded as bringing or collecting. Trial guests (a date, no time) and visit guests (a date and time) are checked in from
// "Also today". None of these are customer-detail edits, so none go through management review.
import type { Draft } from 'immer';
import type { ClubState, GuestVisit, Member } from '../types';
import { DomainError, defineAction, hasRole, type Ctx } from './framework';
import { ensureAttendance, familyUserIds, shortOf, requireMember } from './helpers';
import { activeOn, dayStatus, isPendingRow } from '../rules/core';
import { attId } from '../rules/attendance';
import { priceOn, suspensionOf } from '../rules/billing';
import { onLeaveOn } from '../rules/leave';
import { faceOptedOut, visitInfo } from '../rules/lobby';
import { rp, ym } from '../util';

const lobbyOrMgmt = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'mgmt');
const bad = () => new DomainError('err.invalid');

// ---------- input parsing (unknown extra fields, e.g. an old `escort`, are ignored) ----------
const str = (x: unknown): string => {
  if (typeof x !== 'string' || !x) throw bad();
  return x;
};
const parseMember = (raw: unknown) => ({ memberId: str((raw as { memberId?: unknown })?.memberId) });
const parseGuest = (raw: unknown) => ({ guestId: str((raw as { guestId?: unknown })?.guestId) });
function parseArrival(raw: unknown) {
  const r = raw as { memberId?: unknown; method?: unknown };
  if (r?.method !== 'face' && r?.method !== 'manual') throw bad();
  return { memberId: str(r.memberId), method: r.method as 'face' | 'manual' };
}

/** Soft-delete today's earlier notification about this member (family "checked in/out", or the extra-day note to management and
 *  finance) so an undo leaves no wrong message behind. `time` narrows it to the message that carries that time. */
function retractNotice(d: Draft<ClubState>, ctx: Ctx, memberId: string, kind: 'notif.checkedIn' | 'notif.checkedOut' | 'lobby.notif.extraVisit', time?: string) {
  for (const n of Object.values(d.notifications)) {
    if (!n.deletedAt && n.kind === kind && n.memberId === memberId && n.createdAt.slice(0, 10) === ctx.today && (time === undefined || n.params.time === time)) n.deletedAt = ctx.nowDT;
  }
}

type GuestInput = { guestId: string };
const guestOf = (d: Draft<ClubState>, id: string, ctx: Ctx): Draft<GuestVisit> => {
  const g = d.guestVisits[id];
  if (!g || g.deletedAt) ctx.fail('err.notFound');
  if (g.status === 'cancelled') ctx.fail('lobby.err.guestCancelled');
  return g;
};

export const attendanceActions = [
  // Check a member in: any active, approved member on any open day. `result.extra` says whether this visit is an extra Flex day
  // (the 11th visit of a month on Flex): the feed notes it and management and finance are told, for the next month's invoice.
  defineAction<{ memberId: string; method: 'face' | 'manual' }>({
    name: 'attendance.checkIn',
    can: (u) => lobbyOrMgmt(u),
    parse: parseArrival,
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (isPendingRow(m)) ctx.fail('err.memberPending');
      if (!activeOn(m as Member, ctx.today)) ctx.fail('err.memberNotActive');
      // KC round 6 (the brochure's terms): an unpaid invoice past the 1st puts the membership on hold until it is paid, and a month of leave is not a visiting month
      const hold = suspensionOf(d as ClubState, m.id, ctx.today);
      if (hold) ctx.fail('err.suspended', { name: shortOf(d, m.id), number: hold.number, amount: rp(hold.balance) });
      if (onLeaveOn(m as Member, ctx.today)) ctx.fail('err.onLeave', { name: shortOf(d, m.id), month: ym(ctx.today) });
      if (!dayStatus(d as ClubState, ctx.today).open) ctx.fail('err.closedDay');
      if (d.attendance[attId(ctx.today, m.id)]?.checkIn) ctx.fail('err.alreadyCheckedIn');
      if (input.method === 'face' && faceOptedOut(m as Member)) ctx.fail('lobby.err.faceOptOut', { name: shortOf(d, m.id) });
      const visit = visitInfo(d as ClubState, m as Member, ctx.today); // judged before today's visit exists
      ctx.result.extra = visit.extra;
      ctx.result.visit = visit.n;
      const a = ensureAttendance(d, ctx.today, m.id, ctx);
      a.checkIn = { at: ctx.now, by: ctx.actor, method: input.method };
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'checkIn' });
      const pid = ctx.id('p');
      d.photos[pid] = { id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date: ctx.today, time: ctx.now, kind: 'arrival', media: 'photo', activity: 'arrival', memberIds: [m.id], tone: 2, takenBy: ctx.user.id, visibility: 'visible' };
      const name = shortOf(d, m.id);
      ctx.feed({ icon: 'how_to_reg', key: 'feed.checkedIn', params: { name, how: input.method }, memberId: m.id });
      ctx.notify({ toUsers: familyUserIds(d, m.id), kind: 'notif.checkedIn', params: { name, time: ctx.now }, link: '/today', memberId: m.id });
      if (visit.extra) {
        ctx.feed({ icon: 'payments', key: 'lobby.feed.extraVisit', params: { name, n: visit.n }, memberId: m.id });
        ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'lobby.notif.extraVisit', params: { name, n: visit.n, price: rp(priceOn(d as ClubState, ctx.today).extra) }, link: `/members/${m.id}`, memberId: m.id });
      }
      ctx.result.time = ctx.now;
    },
  }),
  defineAction<{ memberId: string }>({
    name: 'attendance.checkOut',
    can: (u) => lobbyOrMgmt(u),
    parse: parseMember,
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx); // no membership check: someone whose last day is today can still be checked out
      const a = d.attendance[attId(ctx.today, input.memberId)];
      if (!a?.checkIn) return ctx.fail('err.notCheckedIn');
      if (a.checkOut) return ctx.fail('err.alreadyCheckedOut');
      a.checkOut = { at: ctx.now, by: ctx.actor, method: 'manual' };
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'checkOut' });
      ctx.feed({ icon: 'home', key: 'feed.checkedOut', params: { name: shortOf(d, input.memberId) }, memberId: input.memberId });
      ctx.notify({ toUsers: familyUserIds(d, input.memberId), kind: 'notif.checkedOut', params: { name: shortOf(d, input.memberId), time: ctx.now }, link: '/today', memberId: input.memberId });
      ctx.result.time = ctx.now;
    },
  }),
  defineAction<{ memberId: string }>({
    name: 'attendance.undoCheckIn',
    can: (u) => lobbyOrMgmt(u),
    parse: parseMember,
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      const a = d.attendance[attId(ctx.today, input.memberId)];
      if (!a?.checkIn) return ctx.fail('err.notCheckedIn');
      if (a.checkOut) return ctx.fail('lobby.err.undoAfterOut', { name: shortOf(d, input.memberId) });
      // void this check-in's arrival photo (newest first)
      const photo = Object.values(d.photos)
        .filter((p) => !p.deletedAt && p.kind === 'arrival' && p.date === ctx.today && p.visibility !== 'removed' && p.memberIds.length === 1 && p.memberIds[0] === input.memberId)
        .sort((x, y) => (x.time < y.time ? 1 : x.time > y.time ? -1 : 0))[0];
      if (photo) { photo.visibility = 'removed'; photo.moderated = { at: ctx.nowDT, by: ctx.user.id, reason: 'undoCheckIn' }; }
      retractNotice(d, ctx, input.memberId, 'notif.checkedIn', a.checkIn.at);
      retractNotice(d, ctx, input.memberId, 'lobby.notif.extraVisit'); // a visit that did not happen is not billed: management and finance are no longer told
      delete a.checkIn;
      delete a.departureAsked;
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'undoCheckIn' });
      ctx.feed({ icon: 'undo', key: 'lobby.feed.undoIn', params: { name: shortOf(d, input.memberId) }, memberId: input.memberId });
    },
  }),
  defineAction<{ memberId: string }>({
    name: 'attendance.undoCheckOut',
    can: (u) => lobbyOrMgmt(u),
    parse: parseMember,
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      const a = d.attendance[attId(ctx.today, input.memberId)];
      if (!a?.checkIn) return ctx.fail('err.notCheckedIn');
      if (!a.checkOut) return ctx.fail('lobby.err.notCheckedOut', { name: shortOf(d, input.memberId) });
      retractNotice(d, ctx, input.memberId, 'notif.checkedOut', a.checkOut.at);
      delete a.checkOut;
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'undoCheckOut' });
      ctx.feed({ icon: 'undo', key: 'lobby.feed.undoOut', params: { name: shortOf(d, input.memberId) }, memberId: input.memberId });
    },
  }),
  defineAction<{ memberId: string }>({
    name: 'attendance.askDeparture',
    can: (u) => lobbyOrMgmt(u),
    parse: parseMember,
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      const a = d.attendance[attId(ctx.today, input.memberId)];
      if (!a?.checkIn) return ctx.fail('err.notCheckedIn');
      if (a.checkOut) return ctx.fail('err.alreadyCheckedOut');
      const hadDismissal = a.dismissed.some((x) => x.kind === 'departure');
      if (a.departureAsked && !hadDismissal) return; // already waiting at the health station
      a.dismissed = a.dismissed.filter((x) => x.kind !== 'departure'); // asking again re-queues a skipped check
      a.departureAsked = { at: ctx.now, by: ctx.actor };
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'departureAsked' });
      ctx.feed({ icon: 'monitor_heart', key: 'lobby.feed.departureAsked', params: { name: shortOf(d, input.memberId) }, memberId: input.memberId });
    },
  }),

  // ---------- trial and visit guests (booked from enquiries: a trial for a date, a visit for a date and time) ----------
  defineAction<GuestInput>({
    name: 'guest.checkIn',
    can: (u) => lobbyOrMgmt(u),
    parse: parseGuest,
    run(d, input, ctx) {
      const g = guestOf(d, input.guestId, ctx);
      if (g.date !== ctx.today) ctx.fail('lobby.err.guestNotToday', { name: g.name });
      if (g.checkIn) ctx.fail('err.alreadyCheckedIn');
      g.status = 'booked'; // a guest marked no-show who turns up after all
      g.checkIn = { at: ctx.now, by: ctx.actor };
      ctx.feed({ icon: g.kind === 'trial' ? 'waving_hand' : 'meeting_room', key: g.kind === 'trial' ? 'lobby.feed.guestTrial' : 'lobby.feed.guestVisit', params: { name: g.name } });
      ctx.result.time = ctx.now;
      ctx.result.healthCheck = g.healthCheck;
    },
  }),
  defineAction<GuestInput>({
    name: 'guest.checkOut',
    can: (u) => lobbyOrMgmt(u),
    parse: parseGuest,
    run(d, input, ctx) {
      const g = guestOf(d, input.guestId, ctx);
      if (!g.checkIn) ctx.fail('err.notCheckedIn');
      if (g.checkOut) ctx.fail('err.alreadyCheckedOut');
      g.checkOut = { at: ctx.now, by: ctx.actor };
      ctx.feed({ icon: 'logout', key: 'lobby.feed.guestOut', params: { name: g.name } });
      ctx.result.time = ctx.now;
    },
  }),
  defineAction<GuestInput>({
    name: 'guest.noShow',
    can: (u) => lobbyOrMgmt(u),
    parse: parseGuest,
    run(d, input, ctx) {
      const g = guestOf(d, input.guestId, ctx);
      if (g.date !== ctx.today) ctx.fail('lobby.err.guestNotToday', { name: g.name });
      if (g.checkIn) ctx.fail('lobby.err.guestArrived', { name: g.name });
      if (g.status === 'noShow') return;
      g.status = 'noShow';
      ctx.feed({ icon: 'person_off', key: 'lobby.feed.guestNoShow', params: { name: g.name } });
    },
  }),
  defineAction<GuestInput>({
    name: 'guest.undoCheckIn',
    can: (u) => lobbyOrMgmt(u),
    parse: parseGuest,
    run(d, input, ctx) {
      const g = guestOf(d, input.guestId, ctx);
      if (!g.checkIn) ctx.fail('err.notCheckedIn');
      if (g.checkOut) ctx.fail('lobby.err.undoAfterOut', { name: g.name });
      delete g.checkIn;
      ctx.feed({ icon: 'undo', key: 'lobby.feed.undoGuest', params: { name: g.name } });
    },
  }),
  defineAction<GuestInput>({
    name: 'guest.undoNoShow',
    can: (u) => lobbyOrMgmt(u),
    parse: parseGuest,
    run(d, input, ctx) {
      const g = guestOf(d, input.guestId, ctx);
      if (g.status !== 'noShow') return;
      g.status = 'booked';
    },
  }),
];
