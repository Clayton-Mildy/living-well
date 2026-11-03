// Round 17 (KC, point 9): the few-visits alert. A member who came fewer than 5 days this month is a "potential quitter": the club calls the family before plan changes
// close. The alert day is `daysBeforeDeadline` (2) days before the notice deadline of the next month (15 Nov when December's deadline is 17 Nov). Pure reads; the call
// log is in actions/visitCalls.ts.
import type { ClubState, ISODate, YM } from '../types';
import { addDays, addMonths, live, monthStart, ym } from '../util';
import { approvedMembers, currentMembership, membershipStatus } from './core';
import { visitsInMonth } from './attendance';
import { onLeaveIn } from './leave';
import { noticeDeadline } from './notice';
import { askedInApp, nextMonthPlans } from './renewals';

export const FEW_BELOW_DEFAULT = 5;
export const FEW_DAYS_BEFORE_DEFAULT = 2;
/** The club's few-visits settings: "fewer than `below` visit days", from `daysBeforeDeadline` days before the notice deadline. */
export const fewVisitsSettings = (s: Pick<ClubState, 'club'>): { below: number; daysBeforeDeadline: number } => {
  const f = s.club.settings.fewVisits;
  return { below: f?.below ?? FEW_BELOW_DEFAULT, daysBeforeDeadline: f?.daysBeforeDeadline ?? FEW_DAYS_BEFORE_DEFAULT };
};

/** The day the list opens for `month`: the notice deadline of the month after, less `daysBeforeDeadline`. */
export const fewVisitsAlertDay = (s: ClubState, month: YM): ISODate =>
  addDays(noticeDeadline(s, addMonths(month, 1)), -fewVisitsSettings(s).daysBeforeDeadline);

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
  const rows: (FewRow & { name: string })[] = [];
  for (const m of approvedMembers(s)) {
    if (membershipStatus(m, today) !== 'active' || currentMembership(m).start > monthStart(month)) continue;
    if (onLeaveIn(m, month)) continue;
    const st = nextStatus.get(m.id);
    if (st === 'stop' || st === 'leave' || askedInApp(s, m, next)) continue;
    const days = visitsInMonth(s, m, month).filter((d) => d <= today);
    if (days.length >= below) continue;
    rows.push({ memberId: m.id, visits: days.length, ...(days.length ? { last: days[days.length - 1] } : {}), called: calledIds.has(m.id), name: `${m.firstName} ${m.lastName}` });
  }
  rows.sort((a, b) => Number(a.called) - Number(b.called) || a.visits - b.visits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return rows.map(({ name: _name, ...r }) => r);
}

export interface FewVisitsState {
  month: YM;
  alertDay: ISODate;
  /** the last day plan changes for next month can be asked for */
  deadline: ISODate;
  /** before: the list is not open yet · open: from the alert day to the deadline · closed: after the deadline, to the month's end */
  phase: 'before' | 'open' | 'closed';
  rows: FewRow[];
  /** how many of the rows were called */
  called: number;
}
export function fewVisitsState(s: ClubState, today: ISODate): FewVisitsState {
  const month = ym(today);
  const alertDay = fewVisitsAlertDay(s, month);
  const deadline = noticeDeadline(s, addMonths(month, 1));
  const rows = fewVisitMembers(s, today);
  return { month, alertDay, deadline, phase: today < alertDay ? 'before' : today <= deadline ? 'open' : 'closed', rows, called: rows.filter((r) => r.called).length };
}
