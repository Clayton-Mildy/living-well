// Staff leave (KC round 13): any staff member asks for days off (5 a year, open club days only, inside one calendar year); management approves or declines.
// Approval writes one `leave` StaffTime row per open day, so the team and duty views see who is away. Management decides its own request (one manager in the club).
import type { Draft } from 'immer';
import type { ClubState, LeaveRequest, User } from '../types';
import { defineAction, isMgmt, isStaff, type Ctx } from './framework';
import { staffTimeId } from '../rules/mgmt';
import { leaveBalance, leaveDates } from '../rules/staffLeave';
import { bad, bool, dm, isoDate, obj, str } from '../rules/mgmtParse';

const mgmtOnly = (u: User) => isMgmt(u);
const id80 = (v: unknown, field: string) => str(v, 80, { required: true, field });
const S = (d: Draft<ClubState>) => d as unknown as ClubState;

function request(d: Draft<ClubState>, id: string, ctx: Ctx): Draft<LeaveRequest> {
  const r = d.leaveRequests?.[id];
  if (!r || r.deletedAt) ctx.fail('err.notFound');
  return r;
}
const nameOf = (d: Draft<ClubState>, staffId: string) => d.staff[staffId]?.knownAs || d.staff[staffId]?.name.split(' ')[0] || staffId;
/** Write the `leave` rows of an approved request, never over a worked / sick / off row that is already there. */
function putRows(d: Draft<ClubState>, r: LeaveRequest, ctx: Ctx) {
  for (const date of leaveDates(S(d), r.from, r.to)) {
    const id = staffTimeId(r.staffId, date);
    const cur = d.staffTime[id];
    if (cur && !cur.deletedAt && cur.kind !== 'leave') continue; // a worked, sick or day-off row stays as it is; the request is still approved
    d.staffTime[id] = { id, clubId: ctx.clubId, createdAt: cur?.createdAt ?? ctx.nowDT, createdBy: cur?.createdBy ?? ctx.actor, staffId: r.staffId, date, kind: 'leave' };
  }
}
function clearRows(d: Draft<ClubState>, r: LeaveRequest, ctx: Ctx) {
  for (const date of leaveDates(S(d), r.from, r.to)) {
    const row = d.staffTime[staffTimeId(r.staffId, date)];
    if (row && !row.deletedAt && row.kind === 'leave') row.deletedAt = ctx.nowDT;
  }
}

/**
 * Approve or decline one waiting request: the balance is checked again, an approval writes the `leave` rows, the requester is told.
 * Used by `leave.decide` (People → Leave) and by the Approvals list (`approval.approve` / `approval.reject` with type `leave`), so they never disagree.
 * Fails with `err.notFound`, `people.err.leaveDecided` (not waiting any more) or `people.err.leaveTooMany` (the balance no longer covers it).
 */
export function decideLeave(d: Draft<ClubState>, ctx: Ctx, requestId: string, approve: boolean, note?: string): void {
  const r = request(d, requestId, ctx);
  if (r.status !== 'pending') ctx.fail('people.err.leaveDecided');
  const name = nameOf(d, r.staffId);
  if (approve) {
    // the balance is checked again: other days may have been approved since it was asked
    const b = leaveBalance(S(d), r.staffId, Number(r.from.slice(0, 4)), r.id);
    if (r.days > b.left) ctx.fail('people.err.leaveTooMany', { left: b.left });
    r.status = 'approved';
    putRows(d, r, ctx);
  } else r.status = 'declined';
  r.decidedBy = ctx.actor;
  r.decidedAt = ctx.nowDT;
  if (!approve && note) r.note = note;
  ctx.feed({ icon: 'beach_access', key: approve ? 'people.feed.leaveApproved' : 'people.feed.leaveDeclined', params: { name, from: dm(r.from) } });
  if (d.staff[r.staffId] && r.staffId !== ctx.user.id)
    ctx.notify({ toUsers: [r.staffId], kind: approve ? 'people.notif.leaveApproved' : 'people.notif.leaveDeclined', params: { from: r.from, days: r.days, note: approve ? '' : note ?? '' }, link: '/today', severity: 'attention' });
}

export const staffLeaveActions = [
  defineAction<{ from: string; to: string; reason: string }>({
    name: 'leave.request',
    can: isStaff,
    parse(raw) {
      const o = obj(raw);
      const from = isoDate(o.from, 'from');
      const to = isoDate(o.to, 'to');
      if (to < from) bad('to');
      const reason = str(o.reason, 200);
      if (!reason) bad('reason', 'people.err.leaveReason');
      return { from, to, reason };
    },
    run(d, i, ctx) {
      const staffId = ctx.user.id;
      if (!d.staff[staffId] || d.staff[staffId].deletedAt) ctx.fail('err.notFound');
      if (i.from < ctx.today) ctx.fail('people.err.leavePast');
      if (i.from.slice(0, 4) !== i.to.slice(0, 4)) ctx.fail('people.err.leaveYear');
      const days = leaveDates(S(d), i.from, i.to).length;
      if (!days) ctx.fail('people.err.leaveNoDays');
      const mine = Object.values(d.leaveRequests ?? {}).filter((r) => !r.deletedAt && r.staffId === staffId && (r.status === 'pending' || r.status === 'approved'));
      if (mine.some((r) => r.from <= i.to && r.to >= i.from)) ctx.fail('people.err.leaveOverlap');
      const b = leaveBalance(S(d), staffId, Number(i.from.slice(0, 4)));
      if (days > b.left - b.waiting) ctx.fail('people.err.leaveTooMany', { left: Math.max(0, b.left - b.waiting) });
      d.leaveRequests ??= {};
      const id = ctx.id('lv');
      d.leaveRequests[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, staffId, from: i.from, to: i.to, days, reason: i.reason, status: 'pending' };
      ctx.result.requestId = id;
      ctx.feed({ icon: 'beach_access', key: 'people.feed.leaveAsked', params: { name: nameOf(d, staffId), from: dm(i.from), days } });
    },
  }),
  defineAction<{ requestId: string; approve: boolean; note?: string }>({
    name: 'leave.decide',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      const note = str(o.note, 200);
      return { requestId: id80(o.requestId, 'requestId'), approve: bool(o.approve), ...(note ? { note } : {}) };
    },
    run(d, i, ctx) { decideLeave(d, ctx, i.requestId, i.approve, i.note); },
  }),
  defineAction<{ requestId: string }>({
    name: 'leave.cancel',
    // the requester while it waits; management also after approval, until the leave starts
    can: (u, input, s) => {
      if (isMgmt(u)) return true;
      const r = s.leaveRequests?.[input?.requestId];
      return isStaff(u) && !!r && r.staffId === u.id && r.status === 'pending';
    },
    parse: (raw) => ({ requestId: id80(obj(raw).requestId, 'requestId') }),
    run(d, i, ctx) {
      const r = request(d, i.requestId, ctx);
      if (r.status !== 'pending' && r.status !== 'approved') ctx.fail('people.err.leaveDecided');
      if (r.status === 'approved') {
        if (r.from <= ctx.today) ctx.fail('people.err.leaveStarted');
        clearRows(d, r, ctx);
      }
      r.status = 'cancelled';
      ctx.feed({ icon: 'beach_access', key: 'people.feed.leaveCancelled', params: { name: nameOf(d, r.staffId), from: dm(r.from) } });
      if (r.staffId !== ctx.user.id && d.staff[r.staffId]) ctx.notify({ toUsers: [r.staffId], kind: 'people.notif.leaveCancelled', params: { from: r.from, days: r.days }, link: '/today', severity: 'attention' });
    },
  }),
];
