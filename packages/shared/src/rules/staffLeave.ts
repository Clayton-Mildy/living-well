// Staff leave (KC round 13): 5 days a year per staff member, counted in open club days. Pure rules; the actions are in actions/staffLeave.ts.
import type { ClubState, ISODate, LeaveRequest } from '../types';
import { addDays, live, sortBy } from '../util';
import { dayStatus } from './core';

export const DEFAULT_LEAVE_DAYS = 5;
/** Days of leave a staff member may take in a calendar year. */
export const leaveAllowance = (s: ClubState): number => s.club.settings.leaveDays ?? DEFAULT_LEAVE_DAYS;

/** Open club days from `from` to `to`, both included (weekends, holidays and closures are not leave days). */
export function leaveDaysBetween(s: ClubState, from: ISODate, to: ISODate): number {
  return leaveDates(s, from, to).length;
}
/** The open club days themselves (the days a `leave` StaffTime row is written for). */
export function leaveDates(s: ClubState, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i++) if (dayStatus(s, d).open) out.push(d);
  return out;
}

const yearOf = (r: Pick<LeaveRequest, 'from'>) => Number(r.from.slice(0, 4));
/** One person's requests, newest first (by the first day asked for). */
export const leaveOf = (s: ClubState, staffId: string): LeaveRequest[] => sortBy(live(s.leaveRequests ?? {}).filter((r) => r.staffId === staffId), (r) => r.from + r.id, -1);
/** Everything waiting for management, oldest first. */
export const pendingLeave = (s: ClubState): LeaveRequest[] => sortBy(live(s.leaveRequests ?? {}).filter((r) => r.status === 'pending'), (r) => r.createdAt + r.id);

/** The year's numbers for one person: used = approved days, waiting = asked and not decided, left = allowance - used (waiting days are not taken off until approved). */
export function leaveBalance(s: ClubState, staffId: string, year: number, exceptId?: string) {
  const mine = live(s.leaveRequests ?? {}).filter((r) => r.staffId === staffId && yearOf(r) === year && r.id !== exceptId);
  const used = mine.filter((r) => r.status === 'approved').reduce((n, r) => n + r.days, 0);
  const waiting = mine.filter((r) => r.status === 'pending').reduce((n, r) => n + r.days, 0);
  const allowance = leaveAllowance(s);
  return { allowance, used, waiting, left: Math.max(0, allowance - used) };
}
/** True when the person has a live `leave` row (an approved leave day) on this date. */
export const onLeave = (s: ClubState, staffId: string, date: ISODate): boolean =>
  live(s.staffTime).some((t) => t.staffId === staffId && t.date === date && t.kind === 'leave');
