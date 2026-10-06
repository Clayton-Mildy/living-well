// Family plan requests: the primary contact asks to switch plan (Flex ↔ Gold) from the 1st of next month.
// Finance or management applies or declines it from the member's Plan tab (planChange.apply / planChange.decline in members.ts).
import type { ClubState, Plan } from '../types';
import { defineAction, DomainError, type ActionDef } from './framework';
import { currentMembership, isPendingRow, isPrimaryFor, membershipStatus, memberShort, planOn } from '../rules/core';
import { addMonths, live, ym } from '../util';

const obj = (raw: unknown) => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
const planOf = (v: unknown): Plan => {
  if (v !== 'flex' && v !== 'gold') throw new DomainError('err.invalid');
  return v;
};
export const planName = (p: Plan) => (p === 'gold' ? 'Gold' : 'Flex');
/** A family's open request for a member, if any. */
export const pendingPlanRequest = (s: ClubState, memberId: string) => live(s.planChangeRequests).find((r) => r.memberId === memberId && r.status === 'pending');

export const planRequestActions: ActionDef[] = [
  defineAction<{ memberId: string; to: Plan }>({
    name: 'planChange.request',
    can: (u) => u.kind === 'family',
    parse: (raw) => { const o = obj(raw); return { memberId: String(o.memberId ?? '').slice(0, 60), to: planOf(o.to) }; },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const m = s.members[input.memberId];
      if (!m || m.deletedAt || isPendingRow(m)) ctx.fail('err.notFound');
      if (!isPrimaryFor(s, ctx.user.id, m.id)) ctx.fail('err.forbidden');
      if (membershipStatus(m, ctx.today) === 'ended' || currentMembership(m)?.lastDay) ctx.fail('err.planRequestEnding');
      const from = `${addMonths(ym(ctx.today), 1)}-01`;
      if (planOn(m, from).plan === input.to) ctx.fail('err.noChanges');
      if (pendingPlanRequest(s, m.id)) ctx.fail('err.planRequestPending');
      const id = ctx.id('pcr');
      d.planChangeRequests[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, to: input.to, from, status: 'pending' };
      ctx.feed({ icon: 'sell', key: 'feed.planRequested', params: { name: memberShort(m), plan: planName(input.to) }, memberId: m.id });
      ctx.result.requestId = id;
    },
  }),
  defineAction<{ requestId: string }>({
    name: 'planChange.withdraw',
    can: (u) => u.kind === 'family',
    parse: (raw) => ({ requestId: String(obj(raw).requestId ?? '').slice(0, 80) }),
    run(d, input, ctx) {
      const r = d.planChangeRequests[input.requestId];
      if (!r || r.deletedAt) ctx.fail('err.notFound');
      if (r.createdBy !== ctx.actor) ctx.fail('err.forbidden');
      if (r.status !== 'pending') ctx.fail('err.planRequestDone');
      r.deletedAt = ctx.nowDT;
      const m = d.members[r.memberId];
      ctx.feed({ icon: 'sell', key: 'feed.planWithdrawn', params: { name: m ? memberShort(m) : '' }, memberId: r.memberId });
    },
  }),
];
