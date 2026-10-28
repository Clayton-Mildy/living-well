// KC round 15 seed: the weeks that have their own programme and menu. A published week applies to that week only, so every week of the six
// months of history (seed/history.ts), this week and next week are planned; the week after next (it holds T+14) and later are empty, for the
// activity team and the kitchen to plan live ("Copy last week"). Fixed dates and no random draws: the same for 5 and 45 members.
import type { ISODate } from '../types';
import { addDays, weekStart } from '../util';

/** The Mondays of the planned weeks, oldest first: from the week the history starts in (182 days back) to next week. */
export function seedPlanWeeks(T: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let m = weekStart(addDays(T, -182)); m <= addDays(weekStart(T), 7); m = addDays(m, 7)) out.push(m);
  return out;
}
/** The Monday of the first week nobody planned (it holds T+14). */
export const unplannedMonday = (T: ISODate): ISODate => addDays(weekStart(T), 14);
