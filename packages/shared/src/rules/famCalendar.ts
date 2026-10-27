// Family Calendar selectors (round 8, pure): what the family reads on one day (the agenda), the month grid with photo days, and how far back and forward to browse.
// Everything is family-visible data only (approved logs, visible photos, the approved menu, no staff notes, a private venue booking has no client), so it is
// safe on the full state as well as on a family's projection. The club is drop-in: nobody is "expected"; a parent only "joined in" or "sat out" on a day they came.
import type { ClubState, HM, ISODate, Member, Photo, Slot, YM } from '../types';
import { dayStatus } from './core';
import { attOf } from './attendance';
import { sessionPhotos } from './activity';
import { occasionsInRange } from './occasions';
import { dayInfo, monthGrid, type DayState } from './calendar';
import { extrasOn, menuOn, teaPhotosOn, visibleLunchPhotos } from './kitchen';
import { bestPhotoOf, familyPhotosOn, homeTime, logOn, servedLunch, dishNamesOf, tookPart, visitDays, LUNCH_AT, TEA_AT } from './family';
import { addDays, addMonths, live, toMin, ym } from '../util';

export type FamRowKind = 'session' | 'lunch' | 'tea' | 'outing' | 'venue' | 'birthday' | 'celebration';
export interface FamDishes {
  /** the parents these dishes are for; undefined when everyone is served the same */
  memberIds?: string[];
  names: string[];
}
export interface FamRow {
  key: string;
  kind: FamRowKind;
  /** null never happens for rows the family sees, but a venue booking or outing without a time falls back to the club's opening time */
  time: HM;
  /** round 15, the bronze bar: this row's time has passed (a past day, or today once it has ended); filled in by `famDay` */
  passed: boolean;
  /** session */
  slot?: Slot;
  activityId?: string;
  roomId?: string;
  staffId?: string;
  guest?: { name: string };
  extra?: boolean;
  /** outing: the event title (and its Indonesian title) */
  title?: string;
  titleId?: string;
  /** round 12, celebration: which celebration (title, guests and the catering note are read from it) and whose it is */
  celebrationId?: string;
  memberId?: string;
  /** round 12, birthday: the age the parent turns (memberId says who) */
  years?: number;
  /** venue / outing / celebration: the end time when there is one */
  to?: HM | null;
  /** lunch and tea: the dishes */
  dishes?: FamDishes[];
  /** a session that is over, on a day a parent came: who joined in or sat out (only parents the log says something about) */
  took: { memberId: string; took: 'joined' | 'satOut' }[];
  /** the family-visible pictures of a session / meal that is over, on a day a parent came (a session's pictures appear once per activity) */
  photos: Photo[];
}
export interface FamBanner {
  kind: 'closed' | 'holiday' | 'weekend';
  title?: string;
  titleId?: string;
}
export interface FamDay {
  date: ISODate;
  state: DayState;
  banner: FamBanner | null;
  rows: FamRow[];
  /** the parents who checked in that day (never in the future) */
  came: string[];
  /** the day's other family photos (a parent's own, group pictures) that no row shows */
  others: Photo[];
}

const isPast = (date: ISODate, time: HM, today: ISODate, nowMin: number) => date < today || (date === today && toMin(time) <= nowMin);

/**
 * Round 15: marks which rows have passed. A row ends at its own end time, else where the next row starts (the way the day's timeline reads it), else
 * half an hour on or closing time. A past day is passed whole; a birthday (all day) passes with its day. `rows` are in time order.
 */
function markPassed(s: ClubState, rows: FamRow[], date: ISODate, today: ISODate, nowMin: number) {
  const close = toMin(homeTime(s));
  rows.forEach((r, i) => {
    if (date !== today) { r.passed = date < today; return; }
    if (r.kind === 'birthday') return;
    const start = toMin(r.time);
    const next = rows.slice(i + 1).find((x) => x.kind !== 'birthday' && toMin(x.time) > start);
    const end = r.to ? toMin(r.to) : next ? toMin(next.time) : Math.max(close, start + 30);
    r.passed = nowMin >= end;
  });
}

/** Dishes a meal serves the parents: one entry when everyone has the same, else one per group of parents with the same dishes. */
function lunchDishes(s: ClubState, parents: Member[], date: ISODate): FamDishes[] {
  const groups = new Map<string, { ids: string[]; memberIds: string[] }>();
  for (const m of parents) {
    const ids = servedLunch(s, m, date);
    const key = ids.join(',');
    const g = groups.get(key) ?? { ids, memberIds: [] };
    g.memberIds.push(m.id);
    groups.set(key, g);
  }
  const list = Array.from(groups.values()).filter((g) => g.ids.length);
  return list.map((g) => ({ ...(list.length > 1 ? { memberIds: g.memberIds } : {}), names: dishNamesOf(s, g.ids) }));
}

/**
 * Everything the family reads about one date: a banner for a closure, holiday or weekend; else the rows (sessions with the room and who leads, guest hosts,
 * extra sessions, an outing, a private event, lunch and tea with the menu), and for a session or meal that is over on a day a parent came: who joined in
 * and the family's pictures of it. A date in the future has no "joined" lines and no pictures.
 */
export function famDay(s: ClubState, who: string[], date: ISODate, today: ISODate, nowMin: number): FamDay {
  const info = dayInfo(s, date, 'family');
  const came = date <= today ? who.filter((id) => !!attOf(s, date, id)?.checkIn) : [];
  const parents = who.map((id) => s.members[id]).filter((m): m is Member => !!m);
  const rows: FamRow[] = [];
  let banner: FamBanner | null = null;
  const shut = info.items.find((i) => i.kind === 'closed' || i.kind === 'holiday');
  if (info.state === 'closed' || info.state === 'holiday') banner = { kind: info.state, title: shut?.title, titleId: shut?.titleId };
  else if (info.state === 'weekend') banner = { kind: 'weekend' };

  // round 12: a birthday of one of these parents (all day, so it sits at the top of the club's day; on a closed day it is the only row)
  const birthdays: FamRow[] = occasionsInRange(s, date, date).filter((o) => o.kind === 'birthday' && who.includes(o.member.id))
    .map((o) => ({ key: 'bd:' + o.member.id, kind: 'birthday', time: s.club.settings.open as HM, passed: false, memberId: o.member.id, years: o.years, took: [], photos: [] }));
  if (info.open) {
    const open = s.club.settings.open as HM;
    const extraTimes = new Set(extrasOn(s, date).map((x) => x.time as string));
    const shown = new Set<string>(); // activities whose pictures a row already holds (an activity in both sessions shows them once)
    const used = new Set<string>();
    for (const it of info.items) {
      if (it.kind === 'outing') {
        rows.push({ key: it.key, kind: 'outing', time: it.time ?? open, to: it.to ?? null, passed: false, title: it.title, titleId: it.titleId, took: [], photos: [] });
      } else if (it.kind === 'venue') {
        rows.push({ key: it.key, kind: 'venue', time: it.time ?? open, to: it.to ?? null, passed: false, roomId: it.roomId, took: [], photos: [] });
      } else if (it.kind === 'celebration') {
        // only the celebrations of the parents this view is about
        if (!it.memberId || !who.includes(it.memberId)) continue;
        rows.push({ key: it.key, kind: 'celebration', time: it.time ?? open, to: it.to ?? null, passed: false, roomId: it.roomId, celebrationId: it.celebrationId, memberId: it.memberId, title: it.title, took: [], photos: [] });
      } else if (it.kind === 'activity' && it.time) {
        const slot = it.time as Slot;
        const over = came.length > 0 && isPast(date, slot, today, nowMin);
        const act = it.activityId ? s.activities[it.activityId] : undefined;
        const here = over ? came.filter((id) => { const out = attOf(s, date, id)?.checkOut?.at; return !out || toMin(slot) < toMin(out); }) : [];
        const took = here.flatMap((id) => { const v = tookPart(logOn(s, id, date), slot); return v ? [{ memberId: id, took: v }] : []; });
        let photos: Photo[] = [];
        if (over && act && !shown.has(act.name)) { photos = sessionPhotos(s, date, act, { familyOnly: true }); shown.add(act.name); }
        photos.forEach((p) => used.add(p.id));
        rows.push({ key: it.key, kind: 'session', time: slot, slot, passed: false, activityId: it.activityId, roomId: it.roomId, staffId: it.staffId, ...(it.guest ? { guest: { name: it.guest.name } } : {}), ...(extraTimes.has(slot) ? { extra: true } : {}), took, photos });
      }
    }
    if (!info.hasOuting) {
      const menu = menuOn(s, date, { approvedOnly: true });
      const lunch = menu ? lunchDishes(s, parents, date) : [];
      if (lunch.length) {
        const over = came.length > 0 && isPast(date, LUNCH_AT, today, nowMin);
        const photos = over ? visibleLunchPhotos(s, date) : [];
        photos.forEach((p) => used.add(p.id));
        rows.push({ key: 'lunch', kind: 'lunch', time: LUNCH_AT, passed: false, dishes: lunch, took: [], photos });
      }
      const tea = menu ? dishNamesOf(s, menu.tea) : [];
      if (tea.length) {
        const over = came.length > 0 && isPast(date, TEA_AT, today, nowMin);
        const photos = over ? teaPhotosOn(s, date).filter((p) => p.visibility === 'visible') : [];
        photos.forEach((p) => used.add(p.id));
        rows.push({ key: 'tea', kind: 'tea', time: TEA_AT, passed: false, dishes: [{ names: tea }], took: [], photos });
      }
    }
    const rank: Record<FamRowKind, number> = { outing: 0, venue: 1, birthday: 2, celebration: 3, session: 4, lunch: 5, tea: 6 };
    rows.push(...birthdays);
    rows.sort((a, b) => a.time.localeCompare(b.time) || rank[a.kind] - rank[b.kind]);
    markPassed(s, rows, date, today, nowMin);
    const others = came.length ? familyPhotosOn(s, who, date).filter((p) => !used.has(p.id)) : [];
    return { date, state: info.state, banner, rows, came, others };
  }
  // a closed day (weekend, holiday) can still hold a celebration: the banner stays, the celebration is its only row
  for (const it of info.items) {
    if (it.kind === 'celebration' && it.memberId && who.includes(it.memberId)) rows.push({ key: it.key, kind: 'celebration', time: it.time ?? (s.club.settings.open as HM), to: it.to ?? null, passed: false, roomId: it.roomId, celebrationId: it.celebrationId, memberId: it.memberId, title: it.title, took: [], photos: [] });
  }
  rows.push(...birthdays);
  markPassed(s, rows, date, today, nowMin);
  return { date, state: info.state, banner, rows, came, others: [] };
}

// ---------- the month ----------
export interface FamMonthCell {
  date: ISODate;
  state: DayState;
  /** a parent came that day */
  visited: boolean;
  /** round 11: which of `who` came that day, in the order given */
  came: string[];
  /** the day's best family photo (only on a day a parent came) */
  photo: Photo | null;
}
/** The month's grid, Monday first (null = a blank before the 1st): each day's state, who came and the day's best family photo. */
export function famMonth(s: ClubState, who: string[], month: YM, today: ISODate): (FamMonthCell | null)[] {
  const came = cameByDay(s, who, today);
  return monthGrid(month).map((date) => {
    if (!date) return null;
    const st = dayStatus(s, date);
    const c = came.get(date) ?? [];
    return { date, state: st.open ? 'open' : st.reason, visited: c.length > 0, came: c, photo: c.length ? bestPhotoOf(s, who, date) : null };
  });
}
/** Round 11: for each day a parent came, which of `who` came (in the order given), so a calendar can show who. */
export function cameByDay(s: ClubState, who: string[], today: ISODate): Map<ISODate, string[]> {
  const out = new Map<ISODate, string[]>();
  for (const id of who) for (const d of visitDays(s, id, today)) (out.get(d) || out.set(d, []).get(d)!).push(id);
  return out;
}

/** The days of the week that starts on `monday` (Monday to Friday, plus a Saturday or Sunday that is open: round 14), each as the family reads it: the desktop's week list shows a line of what is on. */
export function famWeek(s: ClubState, who: string[], monday: ISODate, today: ISODate, nowMin: number): FamDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)).filter((d, i) => i < 5 || dayStatus(s, d).open).map((d) => famDay(s, who, d, today, nowMin));
}

/** How far the family can browse: from the month of the first visit to the month of the last calendar event (at least two months ahead, at most a year). */
export function famRange(s: ClubState, who: string[], today: ISODate): { min: YM; max: YM } {
  const firsts = who.map((id) => visitDays(s, id, today)[0]).filter((d): d is ISODate => !!d).sort();
  const min = firsts.length ? (ym(firsts[0]) < ym(today) ? ym(firsts[0]) : ym(today)) : ym(today);
  const ends = live(s.calendarEvents).map((e) => e.endDate ?? e.date).sort();
  const last = ends.length ? ym(ends[ends.length - 1]) : ym(today);
  const cap = addMonths(ym(today), 12);
  let max = addMonths(ym(today), 2);
  if (last > max) max = last;
  if (max > cap) max = cap;
  return { min, max };
}
