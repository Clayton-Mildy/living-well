// Check on: active members who have gone quiet. Members drop in on any open day, so "quiet" is measured against each member's own rhythm:
// the threshold is twice their usual gap between visits, never under 10 or over 14 days. The front desk phones the family and logs the answer (a CareCall).
// A call hides the member until the threshold has passed again, or until the date the family said (checkAgainOn).
import type { CareCall, CareCallOutcome, ClubState, ISODate, Member } from '../types';
import { addDays, daysBetween, live, sortBy } from '../util';
import { activeOn, currentMembership } from './core';
import { suspensionOf } from './billing';
import { onLeaveOn } from './leave';

export const CHECK_ON_MIN = 10, CHECK_ON_MAX = 14, CHECK_ON_WINDOW = 90, CHECK_ON_MIN_VISITS = 3, CHECK_ON_NEW_DAYS = 14;
export const CARE_CALL_OUTCOMES: CareCallOutcome[] = ['fine', 'unwell', 'hospital', 'travelling', 'wantsPause', 'noAnswer', 'other'];

export interface CheckOnRow { member: Member; lastVisit: ISODate | null; daysSince: number; usualGapDays: number | null; threshold: number; lastCall?: CareCall }

/** Check-in days of every member in (today - 90, today], ascending. */
function visitDays(s: ClubState, today: ISODate): Record<string, ISODate[]> {
  const from = addDays(today, -CHECK_ON_WINDOW);
  const out: Record<string, ISODate[]> = {};
  for (const a of live(s.attendance)) if (a.checkIn && a.date > from && a.date <= today) (out[a.memberId] ??= []).push(a.date);
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}
function gapOf(days: ISODate[] | undefined): number | null {
  if (!days || days.length < CHECK_ON_MIN_VISITS) return null;
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d)).sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}
/** The median gap in days between a member's check-ins over the last 90 days; null with fewer than three visits. */
export const usualGapDays = (s: ClubState, memberId: string, today: ISODate): number | null => gapOf(visitDays(s, today)[memberId]);
/** Twice the usual gap, held between 10 and 14 days; 14 when the usual gap is unknown. */
export const checkOnThreshold = (gap: number | null): number => (gap === null ? CHECK_ON_MAX : Math.min(CHECK_ON_MAX, Math.max(CHECK_ON_MIN, 2 * gap)));

/** Active members not seen for longer than their own rhythm, longest quiet first. With `notSeenFor` (days, a device choice) that number is the threshold for everyone;
 *  the three-visit rule only feeds the automatic one, so a fixed number lists members of any rhythm. */
export function checkOnList(s: ClubState, today: ISODate, notSeenFor?: number): CheckOnRow[] {
  const days = visitDays(s, today);
  const last: Record<string, ISODate> = {};
  for (const a of live(s.attendance)) if (a.checkIn && a.date <= today && (!last[a.memberId] || a.date > last[a.memberId])) last[a.memberId] = a.date;
  const calls: Record<string, CareCall[]> = {};
  for (const c of live(s.careCalls)) (calls[c.memberId] ??= []).push(c);
  const out: CheckOnRow[] = [];
  for (const m of live(s.members)) {
    const start = currentMembership(m)?.start;
    if (!start || !activeOn(m, today) || daysBetween(start, today) < CHECK_ON_NEW_DAYS || onLeaveOn(m, today) || suspensionOf(s, m.id, today)) continue;
    if (last[m.id] === today) continue;
    const lastVisit = last[m.id] ?? null;
    const daysSince = daysBetween(lastVisit ?? start, today);
    const gap = gapOf(days[m.id]);
    const threshold = notSeenFor ?? checkOnThreshold(gap);
    if (daysSince < threshold) continue;
    const lastCall = sortBy(calls[m.id] ?? [], (c) => c.date + c.at, -1)[0];
    if ((calls[m.id] ?? []).some((c) => !!c.checkAgainOn && c.checkAgainOn > today)) continue;
    if (lastCall && daysBetween(lastCall.date, today) < threshold) continue;
    out.push({ member: m, lastVisit, daysSince, usualGapDays: gap, threshold, ...(lastCall ? { lastCall } : {}) });
  }
  return sortBy(out, (r) => r.daysSince, -1);
}
