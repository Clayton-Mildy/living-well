// KC round 7: the front desk's month-end membership follow-up (renewals). Each member is followed up once per coming month.
// Subscriptions run month to month: before the month ends Caca asks every family whether they continue, switch plan, take leave or stop, and records the
// answer (a FollowUp). Round 14: a change that touches the membership (upgrade, downgrade, leave, stop) applies at once, whoever records it (it is dated
// from the 1st), and can be undone until the month starts (actions/renewals.ts); old rows that still wait for management can be decided in the Approvals hub
// (actions/approvals.ts). Leave keeps its own rules (rules/leave.ts): 14 days' notice before the month, at most 2 months.
import type { Actor, ClubState, DT, FamilyContact, FollowUp, FollowUpCall, FollowUpOutcome, ISODate, Member, Plan, Relation, YM } from '../types';
import { addDays, addMonths, live, monthStart, sortBy, ym } from '../util';
import { activeOn, approvedMembers, contactsOfMember, currentMembership, isPendingRow, memberName, membershipStatus, planOn } from './core';
import { issueDateOf } from './billing';
import { LEAVE_MAX_MONTHS, lastDayOfMonth, leaveCheck, leaveDeadline, leaveMonths, leaveRunAround, onLeaveIn, type LeaveCheck } from './leave';
import { activePlans, matchesQuery } from './members';

/** The month the front desk follows up today: the coming month. */
export const renewalMonth = (today: ISODate): YM => addMonths(ym(today), 1);
export const followUpId = (month: YM, memberId: string) => `fu-${month}-${memberId}`;
export function followUpOf(s: ClubState, memberId: string, month: YM): FollowUp | undefined {
  const f = s.followUps?.[followUpId(month, memberId)];
  return f && !f.deletedAt ? f : undefined;
}

// ---------- outcomes ----------
export const FOLLOW_UP_OUTCOMES: FollowUpOutcome[] = ['continue', 'upgrade', 'downgrade', 'switch', 'leave', 'stop', 'noAnswer'];
/** Outcomes that change the membership: someone but management records them, management approves, and they apply from the 1st. */
export const CHANGE_OUTCOMES: FollowUpOutcome[] = ['upgrade', 'downgrade', 'switch', 'leave', 'stop'];
export const isChange = (o: FollowUpOutcome | undefined): boolean => !!o && CHANGE_OUTCOMES.includes(o);
/** An outcome that moves the member to another plan: upgrade (to Gold), downgrade (to Flex) or switch (to a catalogue plan). */
export type PlanOutcome = 'upgrade' | 'downgrade' | 'switch';
export const isPlanOutcome = (o: FollowUpOutcome | undefined): o is PlanOutcome => o === 'upgrade' || o === 'downgrade' || o === 'switch';
/** The plan a plan outcome ends on (`plan` is the follow-up's own plan, used by a switch). */
export const planAfter = (o: PlanOutcome, plan?: Plan): Plan => (o === 'switch' ? plan ?? 'flex' : o === 'upgrade' ? 'gold' : 'flex');
/** The outcome that records a move to `plan`: Gold and Flex keep their upgrade / downgrade, a catalogue plan is a switch. */
export const outcomeFor = (plan: Plan): PlanOutcome => (plan === 'gold' ? 'upgrade' : plan === 'flex' ? 'downgrade' : 'switch');
/** One change the front desk can record: a move to `plan` (an outcome of its own), leave or stop. */
export interface OutcomeChoice { outcome: FollowUpOutcome; plan?: Plan }
/** The changes offered for a member whose plan on the 1st is `plan` (round 14: "continue" and "no answer" are not recorded any more): a move to every other active plan of the catalogue, leave and stop. */
export const outcomeChoices = (s: ClubState, plan: Plan): OutcomeChoice[] => [
  ...activePlans(s).filter((p) => p.id !== plan).map((p): OutcomeChoice => ({ outcome: outcomeFor(p.id), plan: p.id })),
  { outcome: 'leave' }, { outcome: 'stop' },
];

/** A follow-up is decided once the family gave an answer (not "no answer" / "call back") and management did not turn it down. */
export const isDecided = (f: FollowUp | undefined) => !!f?.outcome && f.status !== 'rejected' && f.outcome !== 'noAnswer';
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

// ---------- status and next step (KC round 8d: the list shows both in their own columns) ----------
/** What the status column says: the family's answer, or "not contacted yet" / "no answer" / "asked in the app" / "management did not approve". */
export type RenewalStatusKey = FollowUpOutcome | 'new' | 'asked' | 'rejected';
/** Same order as `stateOf`: a record waiting for management or already decided wins, then what the family asked in the app, then the open ones. */
export function renewalStatus(r: Pick<RenewalRow, 'f' | 'asked'>): RenewalStatusKey {
  if ((r.f?.status === 'pending' || r.f?.status === 'done') && r.f.outcome) return r.f.outcome;
  if (r.asked) return 'asked';
  if (r.f?.status === 'rejected') return 'rejected';
  return r.f?.outcome ?? 'new';
}

/** What to do now for a row, in words (the web app picks the sentence): call · call again · ask again (turned down) · waiting for approval · answer a plan request · or what starts when. */
export type RenewalNextKind = 'call' | 'callAgain' | 'askAgain' | 'approval' | 'answerRequest' | 'renews' | 'planFrom' | 'leaveFrom' | 'lastDay' | 'none';
export interface RenewalNext { kind: RenewalNextKind; /** the day a plan change or leave starts, the day the plan renews, or the last day */ date?: ISODate; /** the plan a switch ends on */ plan?: Plan; /** calls so far (callAgain) */ calls?: number }
/** The next step for a member in `month`, as of `today`. A month that has started is a read-only log: nothing left to do. */
export function renewalNext(r: Pick<RenewalRow, 'f' | 'asked'>, month: YM, today: ISODate): RenewalNext {
  if (month <= ym(today)) return { kind: 'none' };
  const f = r.f;
  const first = monthStart(month);
  if (f?.status === 'pending') return { kind: 'approval' };
  if (f?.status === 'done' && f.outcome) {
    switch (f.outcome) {
      case 'upgrade': case 'downgrade': case 'switch': return { kind: 'planFrom', date: first, plan: planAfter(f.outcome, f.plan) };
      case 'leave': return { kind: 'leaveFrom', date: monthStart(f.leaveMonths?.[0] ?? month) };
      case 'stop': return { kind: 'lastDay', date: f.lastDay ?? defaultLastDay(month) };
      default: return { kind: 'renews', date: first };
    }
  }
  if (r.asked) return r.asked === 'plan' ? { kind: 'answerRequest' } : { kind: 'leaveFrom', date: first };
  if (f?.status === 'rejected') return { kind: 'askAgain' };
  if (f?.outcome === 'noAnswer') return { kind: 'callAgain', calls: f.calls.length };
  return { kind: 'call' };
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

// ---------- changes (round 14: the Next month screen lists what was recorded, newest first) ----------
export interface ChangeRow {
  memberId: string;
  outcome: FollowUpOutcome;
  /** the plan a switch ends on (also set on a plan change recorded elsewhere) */
  plan?: Plan;
  /** the day the change starts: the 1st for a plan switch, the first leave month's 1st, the day after a stop's last day */
  from: ISODate;
  /** who recorded it (a plan entry made before round 14 may not say when) */
  by?: Actor;
  at?: DT;
  /** the leave months of a leave */
  leaveMonths?: YM[];
  /** the month has not started: the change can still be undone */
  canUndo: boolean;
  /** recorded elsewhere (the profile, a family request finance applied, a stop): shown, but undone where it was made */
  readOnly?: boolean;
}
/**
 * The changes for `month`, newest first: the follow-ups recorded for it (applied at once; a row that still waits for management is not one yet), and, read-only,
 * the changes recorded elsewhere that take effect in that month and no follow-up covers: a plan entry from the 1st (members.changePlan, planChange.apply),
 * leave months (membership.requestLeave), and a stop whose first day away falls in the month (members.end).
 */
export function changeRows(s: ClubState, month: YM, today: ISODate): ChangeRow[] {
  const first = monthStart(month);
  const rows: ChangeRow[] = [];
  const applied = Object.values(s.followUps ?? {}).filter((f) => !f.deletedAt && isApplied(f) && !!f.outcome);
  for (const f of applied) {
    if (f.month !== month) continue;
    const last = f.calls[f.calls.length - 1];
    const from = f.outcome === 'leave' ? monthStart(f.leaveMonths?.[0] ?? month) : f.outcome === 'stop' ? addDays(f.lastDay ?? defaultLastDay(month), 1) : first;
    rows.push({ memberId: f.memberId, outcome: f.outcome!, ...(isPlanOutcome(f.outcome) ? { plan: planAfter(f.outcome, f.plan) } : {}), from, by: last?.by ?? f.createdBy, at: last?.at ?? f.createdAt, ...(f.leaveMonths ? { leaveMonths: f.leaveMonths } : {}), canUndo: today < first });
  }
  for (const m of Object.values(s.members)) {
    if (m.deletedAt || isPendingRow(m)) continue;
    const mine = applied.filter((f) => f.memberId === m.id);
    // a plan switch from the 1st (not a new member's first plan, not the same plan again)
    const i = m.plans.findIndex((p) => p.from === first);
    if (i > 0 && m.plans[i].plan !== m.plans[i - 1].plan) {
      const p = m.plans[i];
      if (!mine.some((f) => f.month === month && isPlanOutcome(f.outcome) && planAfter(f.outcome, f.plan) === p.plan)) {
        const req = p.requestId ? s.planChangeRequests?.[p.requestId] : undefined;
        const at = req?.decidedAt;
        rows.push({ memberId: m.id, outcome: outcomeFor(p.plan), plan: p.plan, from: first, by: p.by, ...(at ? { at } : {}), canUndo: false, readOnly: true });
      }
    }
    for (const ms of m.memberships ?? []) {
      // leave months in the month
      const lv = (ms.leaves ?? []).find((l) => l.month === month);
      if (lv && !mine.some((f) => f.outcome === 'leave' && (f.leaveMonths ?? []).includes(month))) {
        rows.push({ memberId: m.id, outcome: 'leave', from: first, by: lv.by, at: lv.at, leaveMonths: [month], canUndo: false, readOnly: true });
      }
      // a stop: the first day away falls in the month
      if (ms.lastDay && ym(addDays(ms.lastDay, 1)) === month && !mine.some((f) => f.outcome === 'stop' && f.lastDay === ms.lastDay)) {
        rows.push({ memberId: m.id, outcome: 'stop', from: addDays(ms.lastDay, 1), ...(ms.endedBy ? { by: ms.endedBy } : {}), ...(ms.endedAt ? { at: ms.endedAt } : {}), canUndo: false, readOnly: true });
      }
    }
  }
  const at = (r: ChangeRow) => r.at ?? '';
  return rows.sort((a, b) => (at(a) === at(b) ? (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : a.outcome < b.outcome ? -1 : 1) : at(a) < at(b) ? 1 : -1));
}

// ---------- next month, member by member (round 15, R5: the Members tab) ----------
export interface NextMonthRow {
  member: Member;
  /** the plan today, and the plan on the 1st (null once the membership stops before then) */
  planNow: Plan;
  planNext: Plan | null;
  /** the last day, for a stop (the row shows the date) */
  lastDay?: ISODate;
  /** continues: nothing recorded, it carries on · plan: a plan switch from the 1st · leave: leave in the month · stop: the last day falls in the month (or before the 1st) */
  status: 'continues' | 'plan' | 'leave' | 'stop';
}
/**
 * Every member and what next month holds for them, in the Members page order (first and last name): the members active on the 1st (a new member whose plan starts then included), plus those a
 * recorded stop ends before it. Someone who has already ended, is still waiting for approval or starts later is not listed. A stop wins over leave, leave over a
 * plan switch; the changes themselves are recorded as follow-ups or on the profile (`changeRows`), and all of them are on the member's plans and memberships.
 */
export function nextMonthPlans(s: ClubState, today: ISODate): NextMonthRow[] {
  const month = renewalMonth(today);
  const first = monthStart(month);
  const rows: NextMonthRow[] = [];
  for (const m of approvedMembers(s)) {
    const cur = currentMembership(m);
    if (!cur || membershipStatus(m, today) === 'ended') continue;
    const stops = !!cur.lastDay && cur.lastDay <= lastDayOfMonth(month);
    if (!activeOn(m, first) && !(stops && cur.lastDay! < first)) continue;
    const planNow = planOn(m, today).plan;
    const planNext = planOn(m, first).plan;
    const status: NextMonthRow['status'] = stops ? 'stop' : onLeaveIn(m, month) ? 'leave' : planNext !== planNow ? 'plan' : 'continues';
    // a stop on or after the 1st still has the plan on the 1st (they are in the club until the last day); one before it has none
    rows.push({ member: m, planNow, planNext: stops && cur.lastDay! < first ? null : planNext, ...(stops ? { lastDay: cur.lastDay } : {}), status });
  }
  return sortBy(rows, (r) => r.member.firstName + r.member.lastName); // the Members page order
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
