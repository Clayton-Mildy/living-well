// Round 12: the month report (management). The business view of a period — money, members, care and mood, pipeline and team — with every number
// that has a history compared with the period just before it (same length, ending the day before). Pure rules over the club state.
import type { ClubState, EndReason, ISODate, LostReason, MoodMoment, StaffRole } from '../types';
import { activeOn, currentMembership, isPendingRow } from './core';
import { checkOnList } from './checkOn';
import { invoicePeriod } from './finance';
import { invoiceTotal } from './billing';
import { monthsOf, observedDays, type InsightPeriod } from './insights';
import { onLeaveOn } from './leave';
import { moodStats } from './mood';
import { renewalRows } from './renewals';
import { surveyKind } from './surveys';
import { teamRange } from './tasks';
import { addDays, diffDays, live, sum, toMin } from '../util';

/** A number now and in the period before. `diff` is cur − prev (null when either side is unknown); `good` says which way is good news. */
export interface Delta<T = number> { cur: T; prev: T; diff: T | null; good: 'up' | 'down' | 'none' }
export interface MoneyGroup { billed: Delta; collected: Delta; outstanding: Delta; extraDays: Delta & { amount: Delta }; venueIncome: Delta; refunds: Delta }
export interface MembersGroup { active: Delta; joined: Delta; ended: Delta & { byReason: Record<EndReason, number> }; renewalsKept: Delta; renewalsLost: Delta; onLeave: Delta; checkOn: number; visitsPerMember: Delta<number | null>; utilisation: Delta<number | null> }
export interface CareGroup { index: Delta<number | null>; lift: Delta<number | null>; byMoment: Record<MoodMoment, number | null>; alerts: Delta; watches: Delta; rechecks: Delta; lunchEaten: Delta<number | null> }
export interface PipelineGroup { funnel: { new: number; visit: number; trial: number; joined: number }; conversion: { toVisit: number | null; toTrial: number | null; toJoined: number | null }; lostReasons: Record<LostReason, number>; duties: { role: StaffRole; done: number; total: number }[]; surveys: { family: number | null; venue: number | null } }
export interface MonthReport { period: InsightPeriod; prev: InsightPeriod; money: MoneyGroup; members: MembersGroup; care: CareGroup; pipeline: PipelineGroup; empty: boolean }

export const END_REASONS: EndReason[] = ['movedAway', 'careNeeds', 'careHome', 'passedAway', 'familyDecision', 'unpaid', 'leaveOverrun'];
export const LOST_REASONS: LostReason[] = ['price', 'distance', 'notReady', 'otherPlace', 'health', 'other'];
const KEPT = new Set(['continue', 'upgrade', 'downgrade', 'leave']);

/** The period just before `p`: the same number of days, ending the day before `p.from`. */
export function prevPeriod(p: InsightPeriod): InsightPeriod {
  const to = addDays(p.from, -1);
  return { from: addDays(to, -diffDays(p.from, p.to)), to };
}

const round = (n: number, dp: number) => { const f = 10 ** dp; return Math.round(n * f) / f; };
const ratio = (a: number, b: number, dp = 2): number | null => (b > 0 ? round(a / b, dp) : null);
const avg = (xs: number[]): number | null => (xs.length ? round(sum(xs) / xs.length, 1) : null);
const within = (d: ISODate | undefined, p: InsightPeriod) => !!d && d >= p.from && d <= p.to;

function delta(cur: number, prev: number, good: Delta['good']): Delta;
function delta(cur: number | null, prev: number | null, good: Delta['good']): Delta<number | null>;
function delta(cur: number | null, prev: number | null, good: Delta['good']): Delta<number | null> {
  return { cur, prev, diff: cur === null || prev === null ? null : round(cur - prev, 3), good };
}

/** Everything one period stands for, before it is paired with the period before. */
interface Side {
  billed: number; collected: number; outstanding: number; extraQty: number; extraAmount: number; venueIncome: number; refunds: number;
  active: number; joined: number; ended: number; byReason: Record<EndReason, number>; kept: number; lost: number; onLeave: number;
  visits: number; visitsPerMember: number | null; utilisation: number | null;
  index: number | null; lift: number | null; byMoment: Record<MoodMoment, number | null>; alerts: number; watches: number; rechecks: number; lunchEaten: number | null;
  invoices: number; payments: number; enquiries: number; marks: number; readings: number;
}

function side(s: ClubState, p: InsightPeriod, today: ISODate, todayDone: boolean): Side {
  // ---------- money ----------
  // invoices belong to a billing month: every month the period touches
  const months = new Set(monthsOf(p));
  const invs = live(s.invoices).filter((i) => !i.voided && months.has(invoicePeriod(i)));
  const extra = invs.flatMap((i) => i.lines).filter((l) => l.kind === 'extraDay');
  const payments = live(s.payments).filter((x) => within(x.receivedOn, p));
  const refunds = live(s.refunds).filter((r) => within(r.createdAt.slice(0, 10), p));
  // what was still owed at the end of the period: invoices issued by then, less what had been paid (and not refunded) by then
  const paidBy = new Map<string, number>();
  for (const x of live(s.payments)) if (x.receivedOn <= p.to) for (const a of x.allocations) paidBy.set(a.invoiceId, (paidBy.get(a.invoiceId) ?? 0) + a.amount);
  for (const r of live(s.refunds)) if (r.createdAt.slice(0, 10) <= p.to) paidBy.set(r.invoiceId, (paidBy.get(r.invoiceId) ?? 0) - r.amount);
  const outstanding = sum(live(s.invoices).filter((i) => !i.voided && i.issueDate <= p.to).map((i) => Math.max(0, invoiceTotal(i) - (paidBy.get(i.id) ?? 0))));
  const venueIncome = sum(live(s.venueBookings).filter((b) => b.status !== 'cancelled' && !!b.invoiceRef && within(b.date, p)).map((b) => b.price ?? 0));

  // ---------- members ----------
  const members = live(s.members).filter((m) => !isPendingRow(m));
  const active = members.filter((m) => activeOn(m, p.to)).length;
  const joined = members.filter((m) => within(currentMembership(m)?.start, p)).length;
  const byReason = Object.fromEntries(END_REASONS.map((k) => [k, 0])) as Record<EndReason, number>;
  let ended = 0;
  for (const m of members) for (const ms of m.memberships) if (within(ms.lastDay, p)) { ended++; if (ms.endReason) byReason[ms.endReason]++; }
  let kept = 0, lost = 0;
  for (const month of months) for (const r of renewalRows(s, month)) {
    const f = r.f;
    if (!f?.outcome || (f.status !== 'done' && f.status !== 'pending')) continue;
    if (KEPT.has(f.outcome)) kept++;
    else if (f.outcome === 'stop') lost++;
  }
  const onLeave = members.filter((m) => onLeaveOn(m, p.to)).length;
  const days = observedDays(s, p, today, todayDone);
  const daySet = new Set(days);
  const known = new Set(members.map((m) => m.id));
  const visits = live(s.attendance).filter((a) => !!a.checkIn && daySet.has(a.date) && known.has(a.memberId)).length;

  // ---------- care ----------
  const dates: ISODate[] = [];
  for (let d = p.from; d <= p.to && d <= today; d = addDays(d, 1)) dates.push(d);
  const mood = moodStats(s, dates);
  const readings = live(s.readings).filter((r) => !r.voided && !!r.memberId && within(r.date, p));
  const logs = live(s.dailyLogs).filter((l) => !!l.lunch && within(l.date, p));

  return {
    billed: sum(invs.map(invoiceTotal)), collected: sum(payments.map((x) => x.amount)), outstanding,
    extraQty: sum(extra.map((l) => l.qty)), extraAmount: sum(extra.map((l) => l.amount)), venueIncome, refunds: sum(refunds.map((r) => r.amount)),
    active, joined, ended, byReason, kept, lost, onLeave,
    visits, visitsPerMember: days.length ? ratio(visits, active, 1) : null, utilisation: ratio(visits, days.length * active),
    index: mood.index, lift: mood.lift,
    byMoment: { arrival: mood.byMoment.arrival.avg, health: mood.byMoment.health.avg, activity: mood.byMoment.activity.avg, departure: mood.byMoment.departure.avg },
    alerts: readings.filter((r) => r.status === 'alert').length, watches: readings.filter((r) => r.status === 'watch').length, rechecks: readings.filter((r) => r.kind === 'recheck').length,
    lunchEaten: ratio(logs.filter((l) => l.lunch === 'all' || l.lunch === 'most').length, logs.length),
    invoices: invs.length, payments: payments.length, enquiries: live(s.enquiries).filter((e) => within(e.createdAt.slice(0, 10), p)).length, marks: mood.n, readings: readings.length,
  };
}

function pipeline(s: ClubState, p: InsightPeriod, today: ISODate, nowMin: number): PipelineGroup {
  const leads = live(s.enquiries).filter((e) => within(e.createdAt.slice(0, 10), p));
  const came = (kind: 'visit' | 'trial') => new Set(live(s.guestVisits).filter((g) => g.kind === kind && g.status === 'booked' && within(g.date, p) && g.date <= today).map((g) => g.enquiryId)).size;
  const joined = live(s.enquiries).filter((e) => { const m = e.memberId ? s.members[e.memberId] : undefined; return !!m && !m.deletedAt && within(currentMembership(m)?.start, p); }).length;
  const funnel = { new: leads.length, visit: came('visit'), trial: came('trial'), joined };
  const lostReasons = Object.fromEntries(LOST_REASONS.map((k) => [k, 0])) as Record<LostReason, number>;
  // there is no date a lead was lost on: these are the leads opened this period that are lost now
  for (const e of leads) if (e.stage === 'lost' && e.lost) lostReasons[e.lost.reason]++;
  const rated = (kind: 'family' | 'venue') => avg(live(s.surveyResponses).filter((r) => r.overall > 0 && within(r.on, p) && s.surveys[r.surveyId] && surveyKind(s.surveys[r.surveyId]) === kind).map((r) => r.overall));
  return {
    funnel,
    conversion: { toVisit: ratio(funnel.visit, funnel.new), toTrial: ratio(funnel.trial, funnel.new), toJoined: ratio(funnel.joined, funnel.new) },
    lostReasons,
    duties: teamRange(s, p.from, p.to, today, nowMin).map((r) => ({ role: r.role, done: r.done, total: r.total })),
    surveys: { family: rated('family'), venue: rated('venue') },
  };
}

/** The month report for `period` (and the period before it) as of `today` at `nowMin`. */
export function monthReport(s: ClubState, period: InsightPeriod, today: ISODate, nowMin: number): MonthReport {
  const prev = prevPeriod(period);
  const todayDone = nowMin >= toMin(s.club.settings.close);
  const c = side(s, period, today, todayDone), b = side(s, prev, today, todayDone);
  const pl = pipeline(s, period, today, nowMin);
  const empty = !c.visits && !c.invoices && !c.payments && !c.enquiries && !c.marks && !c.readings && !c.joined && !c.ended;
  return {
    period, prev,
    money: {
      billed: delta(c.billed, b.billed, 'up'), collected: delta(c.collected, b.collected, 'up'), outstanding: delta(c.outstanding, b.outstanding, 'down'),
      extraDays: { ...delta(c.extraQty, b.extraQty, 'up'), amount: delta(c.extraAmount, b.extraAmount, 'up') },
      venueIncome: delta(c.venueIncome, b.venueIncome, 'up'), refunds: delta(c.refunds, b.refunds, 'down'),
    },
    members: {
      active: delta(c.active, b.active, 'up'), joined: delta(c.joined, b.joined, 'up'), ended: { ...delta(c.ended, b.ended, 'down'), byReason: c.byReason },
      renewalsKept: delta(c.kept, b.kept, 'up'), renewalsLost: delta(c.lost, b.lost, 'down'), onLeave: delta(c.onLeave, b.onLeave, 'none'),
      checkOn: checkOnList(s, today).length,
      visitsPerMember: delta(c.visitsPerMember, b.visitsPerMember, 'up'), utilisation: delta(c.utilisation, b.utilisation, 'up'),
    },
    care: {
      index: delta(c.index, b.index, 'up'), lift: delta(c.lift, b.lift, 'up'), byMoment: c.byMoment,
      alerts: delta(c.alerts, b.alerts, 'down'), watches: delta(c.watches, b.watches, 'down'), rechecks: delta(c.rechecks, b.rechecks, 'down'),
      lunchEaten: delta(c.lunchEaten, b.lunchEaten, 'up'),
    },
    pipeline: pl,
    empty,
  };
}
