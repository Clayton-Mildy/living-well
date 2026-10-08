// KC round 7: the front desk's month-end membership follow-up (renewals). See rules/renewals.ts.
//   followUp.record { memberId, month, outcome, note?, leaveMonths?, lastDay?, endReason? }
// Caca (lobby), finance and management record what the family answered for the coming month. "Continue", "no answer" and "call back" never need approval.
// A change (upgrade, downgrade, leave, stop) recorded by anyone but management waits in the Approvals hub (actions/approvals.ts, type 'renewals') and applies
// from the 1st once approved; management's own record applies at once. Families only hear about it once it is applied.
import type { Draft } from 'immer';
import type { Actor, ClubState, EndReason, FollowUp, FollowUpOutcome, ISODate, Member, YM } from '../types';
import { defineAction, DomainError, hasRole, type ActionDef, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { clearApproval, markPending, needsApproval } from './approvalGate';
import { addPlanEntry, applyEnding, obj, oneOf, txt } from './members';
import { addLeave } from './membership';
import { planName } from './planRequests';
import { currentMembership, isPendingRow, membershipStatus, planOn } from '../rules/core';
import { feeOf, issueDateOf, priceOn } from '../rules/billing';
import { END_REASONS, isISO } from '../rules/members';
import {
  FOLLOW_UP_OUTCOMES, defaultLastDay, followUpId, followUpOf, isApplied, isChange, lastDayOfMonth, leaveMonthsCheck, planAfter, renewalMembers,
} from '../rules/renewals';
import { LEAVE_MAX_MONTHS } from '../rules/leave';
import { addMonths, monthStart, rp, ym } from '../util';

export interface RecordInput {
  memberId: string;
  month: YM;
  outcome: FollowUpOutcome;
  note?: string;
  leaveMonths?: YM[];
  lastDay?: ISODate;
  endReason?: EndReason;
}

const bad = (code: string, params?: Record<string, string | number>): never => { throw new DomainError(code, params); };
const ymOf = (v: unknown): YM => (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : bad('err.invalid'));

/** The change a follow-up asks for fits the member today: throws the reason it does not. `asOf` is the day the family gave notice (leave deadline). */
export function checkChange(s: ClubState, m: Member, f: Pick<FollowUp, 'month' | 'outcome' | 'leaveMonths' | 'lastDay'>, today: ISODate, asOf: ISODate = today): void {
  const first = monthStart(f.month);
  const cur = currentMembership(m);
  if (!cur || membershipStatus(m, today) === 'ended') bad('members.err.alreadyEnded');
  if (f.outcome === 'upgrade' || f.outcome === 'downgrade') {
    if (today >= first) bad('renewals.err.started');
    if (planOn(m, first).plan === planAfter(f.outcome)) bad('err.noChanges');
  } else if (f.outcome === 'leave') {
    const months = f.leaveMonths ?? [];
    if (months.some((x) => x !== f.month && x !== addMonths(f.month, 1))) bad('err.invalid');
    const c = leaveMonthsCheck(s, m, months, today, asOf);
    if (!c.ok) bad(c.code, c.params);
  } else if (f.outcome === 'stop') {
    const last = f.lastDay ?? '';
    if (!isISO(last)) bad('members.err.lastDayInvalid');
    if (cur.lastDay) bad('members.err.alreadyEnding');
    if (last < today) bad('members.err.lastDayPast');
    if (last < cur.start) bad('members.err.lastDayBeforeStart');
    if (last > lastDayOfMonth(f.month)) bad('renewals.err.lastDayLate');
  }
}

/** Put the change into the membership: a plan entry from the 1st, the leave months, or the last day. The family is told (a stop is told by the ending itself). */
export function applyChange(d: Draft<ClubState>, f: Draft<FollowUp>, ctx: Ctx, by: Actor): void {
  const m = d.members[f.memberId];
  const first = monthStart(f.month);
  const name = shortOf(d, m.id);
  const to = familyUserIds(d, m.id);
  if (f.outcome === 'upgrade' || f.outcome === 'downgrade') {
    const plan = planAfter(f.outcome);
    addPlanEntry(m, { from: first, plan, by }, ctx.today);
    // a request the family sent from the app for the same plan is answered by this
    for (const r of Object.values(d.planChangeRequests)) if (r.memberId === m.id && r.status === 'pending' && r.to === plan) { r.status = 'applied'; r.decidedBy = ctx.actor; r.decidedAt = ctx.nowDT; }
    if (to.length) ctx.notify({ toUsers: to, kind: 'renewals.notif.plan', params: { name, plan: planName(plan), date: first }, link: '/billing', memberId: m.id });
  } else if (f.outcome === 'leave') {
    const cur = currentMembership(m);
    const months = [...(f.leaveMonths ?? [])].sort();
    for (const mo of months) addLeave(cur, mo, ctx, by, f.note);
    const fee = rp(feeOf(priceOn(d as unknown as ClubState, issueDateOf(d as unknown as ClubState, months[0])), 'leave'));
    if (to.length) {
      if (months.length > 1) ctx.notify({ toUsers: to, kind: 'renewals.notif.leave2', params: { name, from: months[0], to: months[months.length - 1], fee }, link: '/billing', memberId: m.id });
      else ctx.notify({ toUsers: to, kind: 'renewals.notif.leave', params: { name, month: months[0], fee }, link: '/billing', memberId: m.id });
    }
  } else if (f.outcome === 'stop') {
    applyEnding(d, m, { lastDay: f.lastDay!, reason: f.endReason ?? 'familyDecision', note: f.note }, ctx);
  }
}

/** Check and apply a recorded change when management approves it (or records it herself). The family gave notice the day it was recorded. */
export function applyFollowUp(d: Draft<ClubState>, f: Draft<FollowUp>, ctx: Ctx): void {
  const m = d.members[f.memberId];
  if (!m || m.deletedAt) ctx.fail('err.notFound');
  const by: Actor = f.approval?.by ?? ctx.actor;
  const asOf: ISODate = f.approval?.at ? f.approval.at.slice(0, 10) : ctx.today;
  checkChange(d as unknown as ClubState, m as Member, f, ctx.today, asOf);
  applyChange(d, f, ctx, by);
}

const people = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'finance', 'mgmt');

export const renewalActions: ActionDef[] = [
  defineAction<RecordInput>({
    name: 'followUp.record',
    can: people,
    parse: (raw) => {
      const o = obj(raw);
      const outcome = oneOf(o.outcome, FOLLOW_UP_OUTCOMES);
      const note = txt(o.note, 400);
      const out: RecordInput = { memberId: txt(o.memberId, 60), month: ymOf(o.month), outcome, ...(note ? { note } : {}) };
      if (outcome === 'leave') {
        const months = Array.from(new Set((Array.isArray(o.leaveMonths) ? o.leaveMonths : []).map(ymOf))).sort();
        if (!months.length || months.length > LEAVE_MAX_MONTHS) bad('err.invalid');
        out.leaveMonths = months;
      }
      if (outcome === 'stop') {
        const last = txt(o.lastDay, 10);
        if (last && !isISO(last)) bad('members.err.lastDayInvalid');
        if (last) out.lastDay = last;
        out.endReason = o.endReason === undefined || o.endReason === '' ? 'familyDecision' : oneOf(o.endReason, END_REASONS, 'members.err.reasonRequired');
      }
      return out;
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const m = requireMember(d, input.memberId, ctx);
      if (isPendingRow(m)) ctx.fail('err.memberPending');
      if (input.month <= ym(ctx.today) || input.month > addMonths(ym(ctx.today), 12)) ctx.fail('renewals.err.pastMonth');
      if (isApplied(followUpOf(s, m.id, input.month))) ctx.fail('renewals.err.applied');
      if (!renewalMembers(s, input.month).some((x) => x.id === m.id)) ctx.fail('renewals.err.notDue');
      const lastDay = input.outcome === 'stop' ? input.lastDay ?? defaultLastDay(input.month) : undefined;
      if (isChange(input.outcome)) checkChange(s, m as Member, { month: input.month, outcome: input.outcome, leaveMonths: input.leaveMonths, lastDay }, ctx.today);

      d.followUps ??= {};
      const id = followUpId(input.month, m.id);
      const f = d.followUps[id] ?? (d.followUps[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, month: input.month, calls: [], status: 'open' });
      f.calls.push({ at: ctx.nowDT, by: ctx.actor, outcome: input.outcome, ...(input.note ? { note: input.note } : {}) });
      f.outcome = input.outcome;
      if (input.note) f.note = input.note; else delete f.note;
      if (input.outcome === 'leave') f.leaveMonths = input.leaveMonths; else delete f.leaveMonths;
      if (input.outcome === 'stop') { f.lastDay = lastDay; f.endReason = input.endReason ?? 'familyDecision'; } else { delete f.lastDay; delete f.endReason; }

      const name = shortOf(d, m.id);
      if (isChange(input.outcome) && needsApproval(ctx)) {
        // waits for management: nothing changes for the member (or the family) until it is approved
        f.status = 'pending';
        markPending(f, ctx, undefined);
        ctx.result.pending = true;
      } else {
        clearApproval(f);
        if (isChange(input.outcome)) { applyChange(d, f, ctx, ctx.actor); f.status = 'done'; } else f.status = input.outcome === 'continue' ? 'done' : 'open';
      }
      const lm = f.leaveMonths ?? [];
      const key = input.outcome === 'leave' && lm.length > 1 ? 'leave2' : input.outcome;
      ctx.feed({
        icon: 'event_repeat', key: `renewals.feed.${key}`, memberId: m.id,
        params: { name, month: input.month, from: lm[0] ?? input.month, to: lm[lm.length - 1] ?? input.month, date: lastDay ?? input.month },
      });
      ctx.result.followUpId = id;
      ctx.result.status = f.status;
    },
  }),
];
