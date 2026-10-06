// Attendance: members drop in on any open day (nothing is "expected"). Lobby groups, Flex visits per month, extra days.
import type { Attendance, ClubState, GuestVisit, ISODate, Member } from '../types';
import { activeOn, planOn, openDaysInMonth, isPendingRow } from './core';
import { live, sortBy, ym, daysInMonth } from '../util';

export const attId = (date: ISODate, memberId: string) => `${date}:${memberId}`;
export const attOf = (s: ClubState, date: ISODate, memberId: string): Attendance | undefined => s.attendance[attId(date, memberId)];
export const isCheckedIn = (s: ClubState, date: ISODate, memberId: string) => !!attOf(s, date, memberId)?.checkIn;

export interface BoardRow {
  m: Member;
  a?: Attendance;
}
export interface LobbyGroups {
  inClub: BoardRow[];
  goneHome: BoardRow[];
  /** active members not checked in on this date: the manual check-in list (by usual arrival time, then name) */
  others: BoardRow[];
}
/** Lobby board for a date. */
export function lobbyGroups(s: ClubState, date: ISODate): LobbyGroups {
  const inClub: BoardRow[] = [];
  const goneHome: BoardRow[] = [];
  const others: BoardRow[] = [];
  for (const m of live(s.members)) {
    if (isPendingRow(m)) continue;
    const a = attOf(s, date, m.id);
    if (a?.checkIn) (a.checkOut ? goneHome : inClub).push({ m, a });
    else if (activeOn(m, date)) others.push({ m, a });
  }
  return {
    inClub: sortBy(inClub, (r) => r.a!.checkIn!.at, -1),
    goneHome: sortBy(goneHome, (r) => r.a!.checkOut!.at, -1),
    others: sortBy(others, (r) => (r.m.usualArrival || '99:99') + r.m.firstName),
  };
}

export const guestsOn = (s: ClubState, date: ISODate): GuestVisit[] =>
  sortBy(live(s.guestVisits).filter((g) => g.date === date && g.status !== 'cancelled'), (g) => g.time || '00:00');

// ---------- Flex: visits per month ----------
export interface FlexMonth {
  /** visits included in the plan this month; null for Gold (unlimited) */
  quota: number | null;
  /** visits that count toward the quota (days checked in on Flex) */
  used: number;
  left: number | null;
  /** every day checked in this month, oldest first */
  visits: ISODate[];
  /** Flex visits beyond the quota: billed as extra days on next month's invoice */
  extraDates: ISODate[];
  extra: number;
}
/** Days a member checked in during a month ('YYYY-MM'), oldest first. */
export const visitsInMonth = (s: ClubState, m: Member, month: string): ISODate[] =>
  live(s.attendance).filter((a) => a.memberId === m.id && a.checkIn && ym(a.date) === month).map((a) => a.date).sort();

/** Quota prorated by open days for a partial first/last month. */
export function flexQuota(s: ClubState, m: Member, month: string): number {
  const base = s.club.settings.flexQuota;
  const days = openDaysInMonth(s, month);
  if (!days.length) return base;
  const active = days.filter((d) => activeOn(m, d));
  if (active.length >= days.length) return base;
  return Math.max(0, Math.round((base * active.length) / days.length));
}
const monthEnd = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

export function flexMonth(s: ClubState, m: Member, month: string, today: ISODate): FlexMonth {
  const visits = visitsInMonth(s, m, month);
  const flexVisits = visits.filter((d) => planOn(m, d).plan === 'flex');
  const planNow = planOn(m, ym(today) === month ? today : monthEnd(month)).plan;
  if (planNow !== 'flex' && !flexVisits.length) return { quota: null, used: visits.length, left: null, visits, extraDates: [], extra: 0 };
  const quota = flexQuota(s, m, month);
  const extraDates = flexVisits.slice(quota);
  return { quota, used: flexVisits.length, left: Math.max(0, quota - flexVisits.length), visits, extraDates, extra: extraDates.length };
}
/** Checking in on `date` would be an extra day: Flex, and the month's quota is already used by earlier visits. */
export function wouldBeExtra(s: ClubState, m: Member, date: ISODate): boolean {
  if (planOn(m, date).plan !== 'flex') return false;
  const month = ym(date);
  const before = visitsInMonth(s, m, month).filter((d) => d < date && planOn(m, d).plan === 'flex');
  return before.length >= flexQuota(s, m, month);
}
/** This (existing) visit is an extra day. */
export const visitIsExtra = (s: ClubState, m: Member, date: ISODate) => flexMonth(s, m, ym(date), date).extraDates.includes(date);

/** Extra-day dates billed for a month (Flex visits beyond the quota). */
export const extraDaysFor = (s: ClubState, m: Member, month: string, today: ISODate) => flexMonth(s, m, month, today).extraDates;

