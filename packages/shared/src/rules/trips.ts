// Round 20: field trip days. The trip on a day is its first outing (by start time, then id); check-in puts a member on it (actions/schedule.ts setTripMember).
// A trip counts as a visit day (R3): few visits and the Month report read `visitDaysOf`. Flex quota and extra-day billing keep counting check-ins only
// (rules/attendance.ts visitsInMonth), so a trip-only tick never bills an extra day.
import type { CalendarEvent, ClubState, ISODate } from '../types';
import { addDays, live } from '../util';
import { eventsOn } from './core';

const outingsOn = (s: ClubState, date: ISODate): CalendarEvent[] => eventsOn(s, date).filter((e) => e.kind === 'outing');
const startKey = (e: CalendarEvent) => `${e.from ?? ''}\u0000${e.id}`; // an outing with no times starts with the day

/** The field trip on a date: the first outing by `from`, then by `id`; null when there is none. */
export function tripOn(s: ClubState, date: ISODate): CalendarEvent | null {
  let first: CalendarEvent | null = null;
  for (const e of outingsOn(s, date)) if (!first || startKey(e) < startKey(first)) first = e;
  return first;
}

/** The member is in Who went of an outing on that date (checked in on the trip day, or ticked in Calendar). */
export const onTrip = (s: ClubState, memberId: string, date: ISODate): boolean => outingsOn(s, date).some((e) => !!e.wentIds?.includes(memberId));

function collectVisitDays(s: ClubState, from: ISODate, to: ISODate, only?: string): Map<string, ISODate[]> {
  const sets = new Map<string, Set<ISODate>>();
  const add = (memberId: string, date: ISODate) => {
    if (only !== undefined && memberId !== only) return;
    const x = sets.get(memberId);
    if (x) x.add(date); else sets.set(memberId, new Set([date]));
  };
  for (const a of live(s.attendance)) if (a.checkIn && a.date >= from && a.date <= to) add(a.memberId, a.date);
  for (const e of live(s.calendarEvents)) {
    if (e.kind !== 'outing' || e.cancelledAt || !e.wentIds?.length) continue;
    const end = e.endDate || e.date;
    for (let d = e.date < from ? from : e.date; d <= end && d <= to; d = addDays(d, 1)) for (const m of e.wentIds) add(m, d);
  }
  return new Map([...sets].map(([m, x]) => [m, [...x].sort()]));
}

/** Every member's visit days from `from` to `to` (as `visitDaysOf`), read once for many members. */
export const visitDaysByMember = (s: ClubState, from: ISODate, to: ISODate): Map<string, ISODate[]> => collectVisitDays(s, from, to);

/** R3: a member's visit days from `from` to `to`: the days with a check-in plus the trip days where they are in Who went, sorted and unique. */
export const visitDaysOf = (s: ClubState, memberId: string, from: ISODate, to: ISODate): ISODate[] => collectVisitDays(s, from, to, memberId).get(memberId) ?? [];
