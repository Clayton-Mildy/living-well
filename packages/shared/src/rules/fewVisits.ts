// Round 17 (KC, point 9): the few-visits alert. A member who came fewer than 5 days this month is a "potential quitter": the club calls the family before plan changes
// close. Round 18: the alert day is `daysBeforeMonth` (16) days before next month's 1st (15 Nov for December), and the list closes at the stop deadline (1st − stop
// days: 17 Nov). The alert day is never after that close (max of the two), so a later, longer stop notice still leaves the list open for a day. Pure reads; the call
// log is in actions/visitCalls.ts.
import type { ClubState, ISODate, VisitCall, YM } from '../types';
import { addDays, addMonths, live, monthStart, sortBy, ym } from '../util';
import { approvedMembers, currentMembership, membershipStatus } from './core';
import { onLeaveIn } from './leave';
import { noticeDays, noticeDeadline } from './notice';
import { askedInApp, nextMonthPlans } from './renewals';

export const FEW_BELOW_DEFAULT = 5;
export const FEW_DAYS_BEFORE_MONTH_DEFAULT = 16;
export const FEW_DAYS_MAX = 28;
/** The club's few-visits settings: "fewer than `below` visit days", alerted `daysBeforeMonth` days before next month. A round 17 `daysBeforeDeadline` counted from the notice deadline: read as that plus the stop days. */
export const fewVisitsSettings = (s: Pick<ClubState, 'club'>): { below: number; daysBeforeMonth: number } => {
  const f = s.club.settings.fewVisits;
  const days = f?.daysBeforeMonth ?? (f?.daysBeforeDeadline !== undefined ? f.daysBeforeDeadline + noticeDays(s, 'stop') : FEW_DAYS_BEFORE_MONTH_DEFAULT);
  return { below: f?.below ?? FEW_BELOW_DEFAULT, daysBeforeMonth: days };
};
/** The days before the month the alert can be set to: from the stop days (the alert can't come after changes close) to 28 (more when the stop notice is longer). */
export const fewDaysRange = (s: Pick<ClubState, 'club'>): { min: number; max: number } => {
  const min = noticeDays(s, 'stop');
  return { min, max: Math.max(FEW_DAYS_MAX, min) };
};

/** The day the list opens for `month`: next month's 1st less `daysBeforeMonth`, and never after the stop deadline. */
export const fewVisitsAlertDay = (s: Pick<ClubState, 'club'>, month: YM): ISODate =>
  addDays(monthStart(addMonths(month, 1)), -Math.max(fewVisitsSettings(s).daysBeforeMonth, noticeDays(s, 'stop')));

/** The calls logged for a member in a month, newest first. */
export const callsOf = (s: ClubState, memberId: string, month: YM): VisitCall[] =>
  sortBy(live(s.visitCalls || {}).filter((c) => c.memberId === memberId && c.month === month), (c) => c.at + c.id, -1);

export const VISIT_CALL_OUTCOMES: VisitCall['outcome'][] = ['reached', 'noAnswer', 'staying'];
export const VISIT_CALL_NOTE_MAX = 200;

export type FewRow = { memberId: string; visits: number; last?: ISODate; called: boolean };

/**
 * Who came fewer than `below` days this month (the 1st up to today). Left out: not active today (ended, ending, not started), started after the 1st, on leave this
 * month, stopping or on leave next month, or a plan change / leave already asked for next month (those families have said what they will do).
 * Not called first, then fewest visits first, then by name.
 */
export function fewVisitMembers(s: ClubState, today: ISODate): FewRow[] {
  const month = ym(today);
  const next = addMonths(month, 1);
  const { below } = fewVisitsSettings(s);
  const nextStatus = new Map(nextMonthPlans(s, today).map((r) => [r.member.id, r.status]));
  const calledIds = new Set(live(s.visitCalls || {}).filter((c) => c.month === month).map((c) => c.memberId));
  // this month's check-in days by member, read once (visitsInMonth per member would scan all attendance each time)
  const byMember = new Map<string, ISODate[]>();
  for (const a of live(s.attendance)) {
    if (!a.checkIn || ym(a.date) !== month) continue;
    const list = byMember.get(a.memberId);
    if (list) list.push(a.date); else byMember.set(a.memberId, [a.date]);
  }
  const rows: (FewRow & { name: string })[] = [];
  for (const m of approvedMembers(s)) {
    if (membershipStatus(m, today) !== 'active' || currentMembership(m).start > monthStart(month)) continue;
    if (onLeaveIn(m, month)) continue;
    const st = nextStatus.get(m.id);
    if (st === 'stop' || st === 'leave' || askedInApp(s, m, next)) continue;
    const days = (byMember.get(m.id) || []).filter((d) => d <= today).sort();
    if (days.length >= below) continue;
    rows.push({ memberId: m.id, visits: days.length, ...(days.length ? { last: days[days.length - 1] } : {}), called: calledIds.has(m.id), name: `${m.firstName} ${m.lastName}` });
  }
  rows.sort((a, b) => Number(a.called) - Number(b.called) || a.visits - b.visits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return rows.map(({ name: _name, ...r }) => r);
}

export interface FewVisitsState {
  month: YM;
  alertDay: ISODate;
  /** the last day a stop for next month can be asked for: the list closes after it */
  deadline: ISODate;
  /** before: the list is not open yet · open: from the alert day to the deadline · closed: after the deadline, to the month's end */
  phase: 'before' | 'open' | 'closed';
  rows: FewRow[];
  /** how many of the rows were called */
  called: number;
}
export type FewVisitsWindow = Omit<FewVisitsState, 'rows' | 'called'>;
/** The month's window (alert day, deadline, phase) without the rows: cheap, so the job and Also today check it before building the list. */
export function fewVisitsWindow(s: ClubState, today: ISODate): FewVisitsWindow {
  const month = ym(today);
  const alertDay = fewVisitsAlertDay(s, month);
  const deadline = noticeDeadline(s, addMonths(month, 1), 'stop');
  return { month, alertDay, deadline, phase: today < alertDay ? 'before' : today <= deadline ? 'open' : 'closed' };
}
export function fewVisitsState(s: ClubState, today: ISODate): FewVisitsState {
  const rows = fewVisitMembers(s, today);
  return { ...fewVisitsWindow(s, today), rows, called: rows.filter((r) => r.called).length };
}
