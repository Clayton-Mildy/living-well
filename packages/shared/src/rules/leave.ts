// Leave (cuti), from the brochure's terms: a month of leave is asked for in writing the club's leave notice before its 1st (round 18: `noticeDays(s, 'leave')`,
// default 14), costs the leave fee on that month's invoice instead of the plan, lasts at most `leaveMaxMonths(s)` months in a row (round 19: a club setting,
// default 2), and a member who gives no word for the month after the last allowed one is taken to have resigned.
// Leave months live on the membership (`Membership.leaves`). Everything here is pure; the actions are in actions/membership.ts.
import type { ClubState, ISODate, Member, MembershipLeave, YM } from '../types';
import { addDays, addMonths, daysInMonth, live, sortBy, ym } from '../util';
import { currentMembership, membershipStatus } from './core';
import { NOTICE_DAYS_DEFAULT, noticeDays } from './notice';

/** The most months of leave in a row when the club has not set it (round 19), and the range the setting takes. */
export const LEAVE_MAX_DEFAULT = 2;
export const LEAVE_MAX_LIMIT = 6;
/** The club's most months of leave in a row (1–6, default 2). */
export const leaveMaxMonths = (s: Pick<ClubState, 'club'>): number => s.club.settings.leaveMaxMonths ?? LEAVE_MAX_DEFAULT;
/** The "word" for the month after the last allowed one: a return noted on the leave list (the club's note on that row). */
export const RETURN_NOTE = 'return';

export const lastDayOfMonth = (month: YM): ISODate => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
/** The last day a leave for `month` can be asked for: `days` before the month's 1st. Callers pass `noticeDays(s, 'leave')` (round 18; the default 14 → 17 Nov for December). */
export const leaveDeadline = (month: YM, days: number = NOTICE_DAYS_DEFAULT): ISODate => addDays(`${month}-01`, -days);

/** The current membership's leave rows that are real leave months (not the note that a member is coming back), oldest first. */
export const leavesOf = (m: Pick<Member, 'memberships'>): MembershipLeave[] =>
  sortBy((currentMembership(m as Member)?.leaves ?? []).filter((l) => l.note !== RETURN_NOTE), (l) => l.month);
export const leaveMonths = (m: Pick<Member, 'memberships'>): YM[] => leavesOf(m).map((l) => l.month);
export const onLeaveIn = (m: Pick<Member, 'memberships'>, month: YM) => leaveMonths(m).includes(month);
/** A member on leave on `date` (the leave month is the calendar month the date is in). */
export const onLeaveOn = (m: Member, date: ISODate) => !m.deletedAt && membershipStatus(m, date) !== 'ended' && onLeaveIn(m, ym(date));
/** A leave month can be taken back until its deadline. */
export const leaveOpen = (month: YM, today: ISODate, days: number = NOTICE_DAYS_DEFAULT) => today <= leaveDeadline(month, days);
export const leaveLeft = (m: Member, today: ISODate): YM[] => leaveMonths(m).filter((x) => x >= ym(today));

/** How many leave months in a row there would be around `month` if it were on the list. */
export function leaveRunAround(months: YM[], month: YM): number {
  let n = 1;
  for (let k = 1; months.includes(addMonths(month, -k)); k++) n++;
  for (let k = 1; months.includes(addMonths(month, k)); k++) n++;
  return n;
}

export type LeaveCheck = { ok: true } | { ok: false; code: string; params?: Record<string, string | number> };
/** Can `month` be asked for as leave today? The code is an `err.*` key (core namespace). */
export function leaveCheck(s: ClubState, m: Member, month: YM, today: ISODate): LeaveCheck {
  const days = noticeDays(s, 'leave');
  const cur = currentMembership(m);
  if (!cur || membershipStatus(m, today) === 'ended' || cur.lastDay) return { ok: false, code: 'err.leaveEnding' };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, code: 'err.invalid' };
  if (month <= ym(today) || today > leaveDeadline(month, days)) return { ok: false, code: 'err.leaveLate', params: { deadline: leaveDeadline(month, days), month } };
  if (onLeaveIn(m, month)) return { ok: false, code: 'err.leaveAlready', params: { month } };
  const max = leaveMaxMonths(s);
  if (leaveRunAround(leaveMonths(m), month) > max) return { ok: false, code: 'err.leaveMax', params: { max } };
  return { ok: true };
}
/** The next months a leave can still be asked for (deadline not yet passed), soonest first. */
export function leaveChoices(s: ClubState, m: Member, today: ISODate, n = 3): { month: YM; deadline: ISODate; ok: boolean }[] {
  const out: { month: YM; deadline: ISODate; ok: boolean }[] = [];
  const days = noticeDays(s, 'leave');
  for (let k = 1; k <= 12 && out.length < n; k++) {
    const month = addMonths(ym(today), k);
    if (today > leaveDeadline(month, days)) continue;
    out.push({ month, deadline: leaveDeadline(month, days), ok: leaveCheck(s, m, month, today).ok });
  }
  return out;
}

/**
 * A member who has had the club's most months of leave in a row and gives no word for the month after: they are taken to have resigned at the start of that
 * month. Returns that month when `today` is in it (or past its first day), the member has not been told to be back, and nothing else has ended the membership.
 * Months booked before the Owner lowered the setting stay; the run is counted against the setting now.
 */
export function leaveOverrunMonth(s: Pick<ClubState, 'club'>, m: Member, today: ISODate): YM | undefined {
  const cur = currentMembership(m);
  if (!cur || cur.lastDay || membershipStatus(m, today) === 'ended' || m.deletedAt) return undefined;
  const months = leaveMonths(m);
  const month = ym(today);
  const noted = (currentMembership(m).leaves ?? []).some((l) => l.note === RETURN_NOTE && l.month === month);
  if (noted || months.includes(month)) return undefined;
  const max = leaveMaxMonths(s);
  let run = 0;
  for (let k = 1; k <= max && months.includes(addMonths(month, -k)); k++) run++;
  return run >= max ? month : undefined;
}
/** The months of leave in a row ending with `last`. */
const runEndingAt = (months: YM[], last: YM): number => { let n = 0; while (months.includes(addMonths(last, -n))) n++; return n; };
/** The last allowed month of a leave that is about to run out: the club is waiting to hear that the member is coming back in `after` (word is due by the day before it starts). */
export function leaveNeedsWord(s: Pick<ClubState, 'club'>, m: Member, today: ISODate): { after: YM; deadline: ISODate } | undefined {
  const cur = currentMembership(m);
  if (!cur || cur.lastDay || membershipStatus(m, today) === 'ended') return undefined;
  const months = leaveMonths(m);
  for (const last of months) {
    if (last < ym(today) || runEndingAt(months, last) < leaveMaxMonths(s) || months.includes(addMonths(last, 1))) continue;
    const after = addMonths(last, 1);
    if ((cur.leaves ?? []).some((l) => l.note === RETURN_NOTE && l.month === after)) continue;
    if (today >= `${after}-01`) continue;
    return { after, deadline: addDays(`${after}-01`, -1) };
  }
  return undefined;
}
/** Every member currently on leave (in the leave month of `date`), for lists. */
export const membersOnLeave = (s: ClubState, date: ISODate): Member[] => live(s.members).filter((m) => onLeaveOn(m, date));
