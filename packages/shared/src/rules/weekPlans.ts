// KC round 15 (weekly plans): every week has its own activity programme and its own menu. A published week applies to that week only (Monday to
// Sunday, from its start date); a week nobody planned is empty. "Copy last week" fills the editor with last week's plan (its weekly cells or
// dishes, not its one-day changes, extra sessions or one-off menus), and the planner publishes it as usual (the activity team's and the kitchen's
// still wait for management). Staff are reminded while this week or next week has no plan. Pure functions over ClubState.
import type { ClubState, ISODate } from '../types';
import { dayStatus } from './core';
import { SLOTS, weekDates, weekDays, weekVersions, type Days } from './calendar';
import { COURSES, templateOn, weekDate, type WeekTemplate } from './kitchenOps';
import { ALL_DAYS, addDays, live, weekStart } from '../util';

/** Has the week starting `monday` a published programme (on any of its days)? */
export const programmePlanned = (s: ClubState, monday: ISODate): boolean => weekVersions(s, monday).length > 0;
/** Has the week starting `monday` a menu? One the kitchen sent counts too: the club already cooks from it while management looks. */
export const menuPlanned = (s: ClubState, monday: ISODate): boolean =>
  live(s.menuVersions).some((v) => v.status === 'published' && v.approval?.status !== 'rejected' && weekStart(v.effectiveFrom) === monday);

/** Last week's programme as it was planned: the weekly cells of the week before `monday` (not its one-day changes or extra sessions). */
export const lastWeekProgramme = (s: ClubState, monday: ISODate): Days => weekDays(s, addDays(monday, -7));
/** Last week's menu as it was planned: each day of the week before `monday` (not its one-off date changes). */
export function lastWeekMenu(s: ClubState, monday: ISODate): WeekTemplate {
  const prev = addDays(monday, -7);
  const out = {} as WeekTemplate;
  for (const w of ALL_DAYS) out[w] = templateOn(s, weekDate(prev, w)).days[w];
  return out;
}

export const hasSessions = (d: Days): boolean => ALL_DAYS.some((w) => SLOTS.some((sl) => d[w][sl]));
export const hasDishes = (t: WeekTemplate): boolean => ALL_DAYS.some((w) => COURSES.some((c) => t[w][c].length > 0));

/** "Copy last week" into the programme of the week starting `monday`: each day from today on takes last week's cells; a day that has passed keeps its own. */
export function copyProgramme(draft: Days, last: Days, monday: ISODate, today: ISODate): Days {
  const dates = weekDates(monday);
  const out = {} as Days;
  for (const w of ALL_DAYS) out[w] = { ...(dates[w - 1] >= today ? last[w] : draft[w]) };
  return out;
}
/** "Copy last week" into the menu of the week starting `monday` (the same rule: a day that has passed keeps its own). */
export function copyMenu(draft: WeekTemplate, last: WeekTemplate, monday: ISODate, today: ISODate): WeekTemplate {
  const out = {} as WeekTemplate;
  for (const w of ALL_DAYS) { const d = weekDate(monday, w) >= today ? last[w] : draft[w]; out[w] = { lunch: [...d.lunch], soft: [...d.soft], tea: [...d.tea] }; }
  return out;
}

/** Does the copy replace something already placed on a day that can still change? Then the planner is asked first. */
export function programmeCopyReplaces(draft: Days, last: Days, monday: ISODate, today: ISODate): boolean {
  const dates = weekDates(monday);
  return ALL_DAYS.some((w) => dates[w - 1] >= today && SLOTS.some((sl) => { const c = draft[w][sl], l = last[w][sl]; return !!c && !(l && l.activityId === c.activityId && l.staffId === c.staffId && l.roomId === c.roomId); }));
}
export function menuCopyReplaces(draft: WeekTemplate, last: WeekTemplate, monday: ISODate, today: ISODate): boolean {
  return ALL_DAYS.some((w) => weekDate(monday, w) >= today && COURSES.some((c) => draft[w][c].some((id) => !last[w][c].includes(id))));
}

export interface UnplannedWeek {
  monday: ISODate;
  programme: boolean;
  menu: boolean;
}
/**
 * Weeks that still need a plan: this week (while it has an open weekday from today on) and next week (while it has an open weekday), with what
 * is missing. A week the club is closed throughout needs none. The planners' Today shows it (management both, the activity team the programme,
 * the kitchen the menu).
 */
export function unplannedWeeks(s: ClubState, today: ISODate): UnplannedWeek[] {
  const out: UnplannedWeek[] = [];
  const thisMonday = weekStart(today);
  for (const monday of [thisMonday, addDays(thisMonday, 7)]) {
    const open = weekDates(monday).slice(0, 5).some((d) => d >= today && dayStatus(s, d).open);
    if (!open) continue;
    const programme = !programmePlanned(s, monday), menu = !menuPlanned(s, monday);
    if (programme || menu) out.push({ monday, programme, menu });
  }
  return out;
}
