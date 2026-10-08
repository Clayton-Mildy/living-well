// KC round 7: the front desk's month-end membership follow-up (renewals). Each member is followed up once per coming month.
// Subscriptions run month to month: before the month ends Caca asks every family whether they continue, switch plan, take leave or stop, and records the
// answer (a FollowUp). A change that touches the membership (upgrade, downgrade, leave, stop) waits for management's approval when she records it, then applies
// from the 1st (actions/renewals.ts, actions/approvals.ts). Leave keeps its own rules (rules/leave.ts): 14 days' notice before the month, at most 2 months.
import type { ClubState, FamilyContact, FollowUp, FollowUpCall, FollowUpOutcome, ISODate, Member, Plan, Relation, YM } from '../types';
import { addDays, addMonths, live, monthStart, sortBy, ym } from '../util';
import { approvedMembers, contactsOfMember, currentMembership, isPendingRow, memberName, membershipStatus, planOn } from './core';
import { issueDateOf } from './billing';
import { LEAVE_MAX_MONTHS, lastDayOfMonth, leaveCheck, leaveDeadline, leaveMonths, leaveRunAround, onLeaveIn, type LeaveCheck } from './leave';
import { matchesQuery } from './members';

/** The month the front desk follows up today: the coming month. */
export const renewalMonth = (today: ISODate): YM => addMonths(ym(today), 1);
export const followUpId = (month: YM, memberId: string) => `fu-${month}-${memberId}`;
export function followUpOf(s: ClubState, memberId: string, month: YM): FollowUp | undefined {
  const f = s.followUps?.[followUpId(month, memberId)];
  return f && !f.deletedAt ? f : undefined;
}

// ---------- outcomes ----------
export const FOLLOW_UP_OUTCOMES: FollowUpOutcome[] = ['continue', 'upgrade', 'downgrade', 'leave', 'stop', 'noAnswer', 'callBack'];
/** Outcomes that change the membership: someone but management records them, management approves, and they apply from the 1st. */
export const CHANGE_OUTCOMES: FollowUpOutcome[] = ['upgrade', 'downgrade', 'leave', 'stop'];
export const isChange = (o: FollowUpOutcome | undefined): boolean => !!o && CHANGE_OUTCOMES.includes(o);
/** The outcomes offered for a member: switching goes the one way their plan allows (Flex to Gold, Gold to Flex). */
export const outcomeChoices = (plan: Plan): FollowUpOutcome[] => ['continue', plan === 'flex' ? 'upgrade' : 'downgrade', 'leave', 'stop', 'noAnswer', 'callBack'];
/** The plan an upgrade or a downgrade ends on. */
export const planAfter = (o: 'upgrade' | 'downgrade'): Plan => (o === 'upgrade' ? 'gold' : 'flex');

/** A follow-up is decided once the family gave an answer (not "no answer" / "call back") and management did not turn it down. */
export const isDecided = (f: FollowUp | undefined) => !!f?.outcome && f.status !== 'rejected' && f.outcome !== 'noAnswer' && f.outcome !== 'callBack';
/** A change that went into the membership (applied at once by management, or after approval): it can only be changed on the member's page now. */
export const isApplied = (f: FollowUp | undefined) => !!f && f.status === 'done' && isChange(f.outcome);

// ---------- who ----------
/** Members to follow up for a month: approved, their membership runs into that month and has no last day before it; also anyone already followed up
 *  (a stop that was applied sets a last day before the month, and the member must stay on the log). */
export function renewalMembers(s: ClubState, month: YM): Member[] {
  const first = monthStart(month);
  return approvedMembers(s).filter((m) => {
    if (followUpOf(s, m.id, month)) return true;
    const cur = currentMembership(m);
    return !!cur && cur.start < first && (!cur.lastDay || cur.lastDay >= first);
  });
}

/** The family contact to call: the primary one (an approved link first) with the relation. */
export function renewalContact(s: ClubState, memberId: string): { contact: FamilyContact; relation: Relation } | undefined {
  const cs = contactsOfMember(s, memberId);
  const c = cs.find((x) => !isPendingRow(x.link) && !isPendingRow(x.contact)) ?? cs[0];
  return c ? { contact: c.contact, relation: c.link.relation } : undefined;
}

/** The family already asked for something for this month in the app (or the club recorded it): a plan request from the 1st that waits, or leave for the month. */
export function askedInApp(s: ClubState, m: Member, month: YM): 'plan' | 'leave' | undefined {
  if (onLeaveIn(m, month)) return 'leave';
  const first = monthStart(month);
  if (live(s.planChangeRequests).some((r) => r.memberId === m.id && r.status === 'pending' && r.from === first)) return 'plan';
  return undefined;
}

// ---------- rows ----------
export type RenewalState = 'toDo' | 'waiting' | 'decided';
export const RENEWAL_STATES: RenewalState[] = ['toDo', 'waiting', 'decided'];

/** toDo: nobody reached yet, no answer, call back, or management turned the change down · waiting: a change waits for management · decided: the family's answer is in (or they asked in the app). */
function stateOf(f: FollowUp | undefined, asked: 'plan' | 'leave' | undefined): RenewalState {
  if (f?.status === 'pending') return 'waiting';
  if (f?.status === 'done') return 'decided';
  return asked ? 'decided' : 'toDo';
}

export interface RenewalRow {
  m: Member;
  /** the plan going into the month, and the plan on the 1st (the two differ once a change is applied) */
  plan: Plan;
  planOnFirst: Plan;
  contact?: FamilyContact;
  relation?: Relation;
  phone: string;
  f?: FollowUp;
  state: RenewalState;
  /** decided in the app, not by a call: 'plan' (a request from the 1st waits) or 'leave' (leave is on the list for the month) */
  asked?: 'plan' | 'leave';
  /** calls and messages so far */
  calls: number;
  last?: FollowUpCall;
}

/** One row per member to follow up for `month`, by first name. */
export function renewalRows(s: ClubState, month: YM): RenewalRow[] {
  const first = monthStart(month);
  const before = addDays(first, -1);
  const rows = renewalMembers(s, month).map((m): RenewalRow => {
    const f = followUpOf(s, m.id, month);
    const asked = f?.status === 'done' ? undefined : askedInApp(s, m, month);
    const c = renewalContact(s, m.id);
    return {
      m, plan: planOn(m, before).plan, planOnFirst: planOn(m, first).plan, contact: c?.contact, relation: c?.relation, phone: c?.contact.phone ?? '',
      f, state: stateOf(f, asked), asked, calls: f?.calls.length ?? 0, last: f?.calls[f.calls.length - 1],
    };
  });
  return sortBy(rows, (r) => `${r.m.firstName.toLowerCase()}|${r.m.id}`);
}

export interface RenewalCounts { total: number; toDo: number; waiting: number; decided: number; /** answered: everything but the to-do list */ done: number }
export function renewalCounts(rows: RenewalRow[]): RenewalCounts {
  const n = (st: RenewalState) => rows.filter((r) => r.state === st).length;
  const toDo = n('toDo');
  return { total: rows.length, toDo, waiting: n('waiting'), decided: n('decided'), done: rows.length - toDo };
}
/** The rows of one segment, narrowed by a search (names, family names, phone numbers). */
export function renewalFilter(s: ClubState, rows: RenewalRow[], state: RenewalState, q: string): RenewalRow[] {
  return rows.filter((r) => r.state === state && matchesQuery(s, r.m, q));
}
export const rowName = (r: RenewalRow) => memberName(r.m);

/** How many members of the coming month still have nobody's answer (the bell counts these from the 20th). Management's waiting list is not part of it. */
export function renewalsLeft(s: ClubState, today: ISODate, month: YM = renewalMonth(today)): number {
  return renewalMembers(s, month).filter((m) => {
    const f = followUpOf(s, m.id, month);
    return stateOf(f, f?.status === 'done' ? undefined : askedInApp(s, m, month)) === 'toDo';
  }).length;
}

// ---------- dates ----------
export interface RenewalDates {
  /** the last day the family can ask for leave starting in `month` */
  leaveDeadline: ISODate;
  /** that deadline has not passed */
  leaveOpen: boolean;
  /** the first month a leave can still start in (the month itself, else the next) */
  leaveFrom: YM;
  /** when the month's invoice goes out */
  invoice: ISODate;
}
export function renewalDates(s: ClubState, month: YM, today: ISODate): RenewalDates {
  const deadline = leaveDeadline(month);
  let from = month;
  for (let k = 0; k < 3 && today > leaveDeadline(from); k++) from = addMonths(from, 1);
  return { leaveDeadline: deadline, leaveOpen: today <= deadline, leaveFrom: from, invoice: issueDateOf(s, month) };
}

// ---------- leave ----------
/** The months a follow-up of `month` can ask leave for: the month itself and the one after it. */
export const leaveMonthChoices = (month: YM): YM[] => [month, addMonths(month, 1)];
/**
 * Can these months be recorded as leave? Each one has to pass the leave rules (deadline, not already on the list, not ending), and with the months already on
 * the list no run may be longer than 2. `asOf` is the day the family gave notice (the day a pending record was saved), `today` the day it is applied.
 */
export function leaveMonthsCheck(s: ClubState, m: Member, months: YM[], today: ISODate, asOf: ISODate = today): LeaveCheck {
  const chosen = Array.from(new Set(months)).sort();
  if (!chosen.length || chosen.length > LEAVE_MAX_MONTHS) return { ok: false, code: 'err.invalid' };
  for (const mo of chosen) {
    if (mo <= ym(today)) return { ok: false, code: 'err.leaveLate', params: { deadline: leaveDeadline(mo), month: mo } };
    const c = leaveCheck(s, m, mo, asOf < today ? asOf : today);
    if (!c.ok) return c;
  }
  const all = [...leaveMonths(m), ...chosen];
  for (const mo of chosen) if (leaveRunAround(all, mo) > LEAVE_MAX_MONTHS) return { ok: false, code: 'err.leaveMax', params: { max: LEAVE_MAX_MONTHS } };
  return { ok: true };
}

/** The default last day for a stop: the last day of the month before the one being decided. */
export const defaultLastDay = (month: YM): ISODate => addDays(monthStart(month), -1);
export { lastDayOfMonth };
/** Can a follow-up for this member and month still be recorded? The month has not started and nothing was applied yet. */
export function canRecord(s: ClubState, m: Member, month: YM, today: ISODate): boolean {
  if (month <= ym(today) || isApplied(followUpOf(s, m.id, month))) return false;
  return membershipStatus(m, today) !== 'ended';
}
