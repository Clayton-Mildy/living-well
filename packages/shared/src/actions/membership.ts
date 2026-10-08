// Leave (cuti), from the brochure's terms: the billing contact asks for a month of leave in the family app (or finance / management record one on the member's
// Plan tab), at the latest 14 days before the end of the month before it. The month costs the leave fee instead of the plan; at most 2 months in a row.
// The family can take a request back until its deadline. After 2 months a member who has not been confirmed back is taken to have resigned (daily job, jobs.ts).
import type { Draft } from 'immer';
import type { Actor, ClubState, Member, Membership, YM } from '../types';
import { defineAction, DomainError, hasRole, isFamily, type ActionDef, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { currentMembership, isPendingRow, isPrimaryFor } from '../rules/core';
import { RETURN_NOTE, leaveCheck, leaveDeadline, leaveNeedsWord, leaveOpen, onLeaveIn } from '../rules/leave';
import { feeOf, priceOn, issueDateOf } from '../rules/billing';
import { rp } from '../util';

const obj = (raw: unknown) => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
const month = (v: unknown): string => {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new DomainError('err.invalid');
  return v;
};
const memberId = (raw: unknown) => String(obj(raw).memberId ?? '').slice(0, 60);
/** Who may ask for, take back or confirm a leave: the member's billing contact, finance and management. */
const people = (u: Parameters<typeof hasRole>[0]) => isFamily(u) || hasRole(u, 'finance', 'mgmt');
const S = (d: unknown) => d as ClubState;
/** Put a leave month (already checked) on the membership's leave list, kept in month order. Also used by the renewals follow-up (actions/renewals.ts). */
export function addLeave(cur: Draft<Membership>, month: YM, ctx: Ctx, by: Actor = ctx.actor, note?: string): void {
  cur.leaves = [...(cur.leaves ?? []), { month, at: ctx.nowDT, by, ...(note ? { note } : {}) }].sort((a, b) => (a.month < b.month ? -1 : 1));
}

export const membershipActions: ActionDef[] = [
  defineAction<{ memberId: string; month: string; note?: string }>({
    name: 'membership.requestLeave',
    can: people,
    parse: (raw) => { const o = obj(raw); const note = typeof o.note === 'string' ? o.note.trim().slice(0, 200) : ''; return { memberId: memberId(raw), month: month(o.month), ...(note ? { note } : {}) }; },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (isPendingRow(m)) ctx.fail('err.memberPending');
      if (isFamily(ctx.user) && !isPrimaryFor(S(d), ctx.user.id, m.id)) ctx.fail('err.forbidden');
      const chk = leaveCheck(S(d), m as Member, input.month, ctx.today);
      if (!chk.ok) ctx.fail(chk.code, chk.params);
      const cur = currentMembership(m);
      addLeave(cur, input.month, ctx, ctx.actor, input.note);
      const params = { name: shortOf(d, m.id), month: input.month, fee: rp(feeOf(priceOn(S(d), issueDateOf(S(d), input.month)), 'leave')) };
      ctx.feed({ icon: 'beach_access', key: 'family.feed.leaveAsked', params: { name: params.name, month: input.month }, memberId: m.id });
      if (isFamily(ctx.user)) ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'family.notif.leaveAsked', params, link: `/health?member=${m.id}&tab=plan`, memberId: m.id });
      else ctx.notify({ toUsers: familyUserIds(d, m.id), kind: 'family.notif.leaveRecorded', params, link: '/billing', memberId: m.id });
      ctx.result.month = input.month;
      ctx.result.deadline = leaveDeadline(input.month);
    },
  }),
  defineAction<{ memberId: string; month: string }>({
    name: 'membership.withdrawLeave',
    can: people,
    parse: (raw) => ({ memberId: memberId(raw), month: month(obj(raw).month) }),
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (isFamily(ctx.user) && !isPrimaryFor(S(d), ctx.user.id, m.id)) ctx.fail('err.forbidden');
      const cur = currentMembership(m);
      if (!cur || !onLeaveIn(m as Member, input.month)) ctx.fail('err.notFound');
      // taken back only while it can still be asked for; after that the month is settled (it goes on the invoice)
      if (!leaveOpen(input.month, ctx.today)) ctx.fail('err.leaveLocked', { deadline: leaveDeadline(input.month), month: input.month });
      cur.leaves = (cur.leaves ?? []).filter((l) => l.month !== input.month || l.note === RETURN_NOTE);
      ctx.feed({ icon: 'event_busy', key: 'family.feed.leaveWithdrawn', params: { name: shortOf(d, m.id), month: input.month }, memberId: m.id });
      if (isFamily(ctx.user)) ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'family.notif.leaveWithdrawn', params: { name: shortOf(d, m.id), month: input.month }, link: `/health?member=${m.id}&tab=plan`, memberId: m.id });
    },
  }),
  // The "word" the terms ask for after 2 months of leave: the member is coming back. Without it the daily job ends the membership at the start of the 3rd month.
  defineAction<{ memberId: string }>({
    name: 'membership.confirmReturn',
    can: people,
    parse: (raw) => ({ memberId: memberId(raw) }),
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (isFamily(ctx.user) && !isPrimaryFor(S(d), ctx.user.id, m.id)) ctx.fail('err.forbidden');
      const w = leaveNeedsWord(m as Member, ctx.today);
      if (!w) return ctx.fail('err.noChanges');
      const cur = currentMembership(m);
      cur.leaves = [...(cur.leaves ?? []), { month: w.after, at: ctx.nowDT, by: ctx.actor, note: RETURN_NOTE }];
      ctx.feed({ icon: 'event_available', key: 'family.feed.leaveReturn', params: { name: shortOf(d, m.id), month: w.after }, memberId: m.id });
      if (isFamily(ctx.user)) ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'family.notif.leaveReturn', params: { name: shortOf(d, m.id), month: w.after }, link: `/health?member=${m.id}&tab=plan`, memberId: m.id });
    },
  }),
];
