// KC round 7: the daily report (management). One club day in one place: who came, the programme, lunch and tea, the health checks, mood and notes, and how each role
// did on its duties. It is read from the data for ANY day (a past day is what the records say; today is live, up to `nowMin`): nothing here is stored, and every figure
// comes from the helpers the rest of the app already uses (attendance, sessions, menu, logs, readings, duties). Management sees entries that still wait for approval too, marked.
import type { Activity, AllergyPlan, ClubState, DailyLog, Dish, Feedback, GuestHost, GuestSession, GuestVisit, HM, ISODate, Member, Photo, Plan, Reading, Room, ScheduleCell, Slot, Staff, StaffRole, VenueBooking } from '../types';
import { LUNCH_AMOUNTS, SESSION_MIN, FIXED_SLOTS, attendedOn, libraryPhotos, logsOn, pendingLogMembers, sessionPhotos, type LunchAmount, type SessionMark } from './activity';
import { attOf, flexMonth, guestsOn } from './attendance';
import { isWaiting } from './approvals';
import { dayStatus, isOpen, memberName, planOn, staffByRole, staffCall, type DayStatus } from './core';
import { guestOn } from './guests';
import { daySummary, readingsOnDay } from './healthStation';
import { lunchPhotosOn, menuOn, scheduleDayOf, sessionsOn, teaPhotosOn } from './kitchen';
import { teamSummary } from './tasks';
import { addDays, dtDate, live, sortBy, toMin, ym } from '../util';

// ---------- the pieces ----------
export interface ReportMember {
  m: Member;
  checkIn: HM;
  checkOut?: HM;
  /** today and not checked out yet */
  inClub: boolean;
  plan: Plan;
  /** Flex: this visit is number `n` of the month's `quota` */
  flex?: { n: number; quota: number };
  /** a Flex visit beyond the month's quota (billed as an extra day) */
  extra: boolean;
  /** the day's log of the member (any approval state), if one was saved */
  log?: DailyLog;
  /** the log waits for management's approval */
  pendingLog: boolean;
  lunch?: LunchAmount;
  mood?: DailyLog['mood'];
  /** one entry per session of the day: joined, sat out, or not marked (undefined) */
  sessions: { slot: Slot; mark?: SessionMark }[];
  /** the arrival reading (any approval state) */
  arrival?: Reading;
}
export interface ReportGuest {
  g: GuestVisit;
  /** in: in the club now · gone: checked in and left (or a past day) · expected: booked, not here yet · noShow: did not come */
  state: 'in' | 'gone' | 'expected' | 'noShow';
  came: boolean;
}
export interface ReportSession {
  slot: Slot;
  cell: ScheduleCell;
  activity?: Activity;
  staff?: Staff;
  room?: Room;
  /** a guest host leads the session instead of the teacher */
  guest: { session: GuestSession; host: GuestHost } | null;
  /** a one-day change of the weekly plan, with the note management left */
  changed: boolean;
  note?: string;
  /** done: over (every past day) · now: running · later: today, not started */
  state: 'done' | 'now' | 'later';
  joined: Member[];
  satOut: Member[];
  /** people who came and were not marked (0 for a session that has not started) */
  notMarked: number;
  /** the session's pictures (approved and waiting ones); an activity in both slots shows its pictures under the first */
  photos: Photo[];
  photosPending: number;
}
export interface ReportAlternative { name: string; memberId?: string; dish: string; alternative: string }
export interface ReportLunch {
  menu: { lunch: Dish[]; soft: Dish[]; tea: Dish[] } | null;
  alternatives: ReportAlternative[];
  photos: { lunch: Photo[]; tea: Photo[] };
  /** lunch (12:00) has been served: a past day, or today from 12:00; before it nothing is expected to be marked */
  served: boolean;
  /** members who came, and guests who came with lunch */
  diners: number;
  /** how much each member ate, from the lunch round of the daily log */
  eaten: Record<LunchAmount, number>;
  /** who ate little or nothing (never the ones who ate well) */
  low: { m: Member; amount: 'little' | 'none' }[];
  /** members who came and whose lunch was not marked (0 while lunch has not been served) */
  notMarked: number;
}
export interface ReportReading { r: Reading; name: string; memberId?: string; pending: boolean }
export interface ReportHealth {
  /** readings taken that day (every kind, guests too) */
  readings: number;
  /** people checked */
  people: number;
  watch: number;
  alert: number;
  /** the Watch and Alert readings, Alert first, then by time */
  flagged: ReportReading[];
}
export type Mood = NonNullable<DailyLog['mood']>;
export const MOODS: Mood[] = ['cheerful', 'calm', 'quiet', 'agitated'];
export interface ReportNote { m: Member; text: string; /** a staff-only note (never shown to the family) */ staff: boolean; log: DailyLog; pending: boolean }
export interface ReportMood {
  counts: Record<Mood, number>;
  /** members who came and have no Mood & notes round yet */
  notMarked: number;
  notes: ReportNote[];
  /** logs of the day still waiting for approval */
  pendingLogs: number;
}
export interface ReportDuty {
  role: StaffRole;
  people: string[];
  /** the duties' score: parts done of parts, and how many are late */
  done: number;
  total: number;
  late: number;
  customDone: number;
  customTotal: number;
  customOverdue: number;
}
export interface ReportOther { feedback: Feedback[]; enquiries: number; venue: VenueBooking[] }

export interface DayReport {
  date: ISODate;
  /** the date is today (live: figures follow the clock) */
  live: boolean;
  status: DayStatus;
  counts: { came: number; trials: number; visits: number; lunches: number; checks: number; photos: number };
  members: ReportMember[];
  guests: ReportGuest[];
  sessions: ReportSession[];
  lunch: ReportLunch;
  health: ReportHealth;
  mood: ReportMood;
  duties: ReportDuty[];
  other: ReportOther;
  /** nobody came and nothing was recorded (the page says so instead of listing empty sections) */
  empty: boolean;
}

const LUNCH_AT = FIXED_SLOTS.find((f) => f.kind === 'lunch')!.time;

/** The report of one club day. `today` and `nowMin` say what is still to come: a session or a meal that has not started shows as such. */
export function dailyReport(s: ClubState, date: ISODate, today: ISODate, nowMin: number): DayReport {
  const status = dayStatus(s, date);
  const isToday = date === today;
  const logs = logsOn(s, date);
  const came = attendedOn(s, date);
  const readings = readingsOnDay(s, date);
  const guestRows = guestsOn(s, date).map((g): ReportGuest => ({
    g,
    came: !!g.checkIn,
    state: g.checkIn ? (g.checkOut || !isToday ? 'gone' : 'in') : g.status === 'noShow' || date < today ? 'noShow' : 'expected',
  }));
  const guestsCame = guestRows.filter((x) => x.came);

  // ----- the programme -----
  const seenActivities = new Set<string>();
  const sessions: ReportSession[] = [];
  const over = scheduleDayOf(s, date);
  const sessionState = (slot: Slot): ReportSession['state'] => (date < today ? 'done' : date > today ? 'later' : nowMin >= toMin(slot) + SESSION_MIN ? 'done' : nowMin >= toMin(slot) ? 'now' : 'later');
  for (const x of sessionsOn(s, date)) {
    if (!x.cell) continue;
    const activity = s.activities[x.cell.activityId];
    const state = sessionState(x.slot);
    const marks = came.map((m) => ({ m, mark: logs.get(m.id)?.sessions?.[x.slot] }));
    const firstOfActivity = !activity || !seenActivities.has(activity.name);
    if (activity) seenActivities.add(activity.name);
    const photos = firstOfActivity ? sessionPhotos(s, date, activity) : [];
    sessions.push({
      slot: x.slot, cell: x.cell, activity, staff: s.staff[x.cell.staffId], room: s.rooms[x.cell.roomId], guest: guestOn(s, date, x.slot),
      changed: !!over && x.slot in over.slots, note: over && x.slot in over.slots ? over.note : undefined, state,
      joined: marks.filter((k) => k.mark === 'joined').map((k) => k.m),
      satOut: marks.filter((k) => k.mark === 'satOut').map((k) => k.m),
      notMarked: state === 'later' ? 0 : marks.filter((k) => !k.mark).length,
      photos, photosPending: photos.filter((p) => p.visibility === 'pending').length,
    });
  }

  // ----- who came -----
  const members = came.map((m): ReportMember => {
    const a = attOf(s, date, m.id)!;
    const log = logs.get(m.id);
    const plan = planOn(m, date).plan;
    const fm = flexMonth(s, m, ym(date), today);
    const flexVisits = fm.visits.filter((d) => d <= date && planOn(m, d).plan === 'flex').length;
    const arrival = readings.filter((r) => r.memberId === m.id && r.kind === 'arrival').pop();
    return {
      m, checkIn: a.checkIn!.at, checkOut: a.checkOut?.at, inClub: isToday && !a.checkOut, plan,
      flex: plan === 'flex' ? { n: flexVisits, quota: fm.quota ?? 0 } : undefined, extra: fm.extraDates.includes(date),
      log, pendingLog: !!log && isWaiting(log), lunch: log?.lunch, mood: log?.mood,
      sessions: sessions.map((x) => ({ slot: x.slot, mark: log?.sessions?.[x.slot] })), arrival,
    };
  });

  // ----- lunch and tea -----
  const menu = menuOn(s, date);
  const dish = (id: string) => s.dishes[id];
  const named = (ids: string[]) => ids.map(dish).filter((d): d is Dish => !!d);
  const plans: AllergyPlan[] = s.dayMenus[date]?.allergyPlans ?? [];
  const alternatives = plans.map((p): ReportAlternative => {
    const id = p.person.slice(p.person.indexOf(':') + 1);
    const member = p.person.startsWith('member:') ? s.members[id] : undefined;
    return { name: member ? memberName(member) : s.guestVisits[id]?.name ?? '', memberId: member?.id, dish: dish(p.dishId)?.name ?? '', alternative: p.alternative };
  });
  const lunchServed = date < today || (isToday && nowMin >= toMin(LUNCH_AT));
  const eaten = Object.fromEntries(LUNCH_AMOUNTS.map((a) => [a, 0])) as Record<LunchAmount, number>;
  const low: ReportLunch['low'] = [];
  let lunchNotMarked = 0;
  for (const r of members) {
    if (r.lunch) { eaten[r.lunch]++; if (r.lunch === 'little' || r.lunch === 'none') low.push({ m: r.m, amount: r.lunch }); }
    else if (lunchServed) lunchNotMarked++;
  }
  const diners = members.length + guestsCame.filter((x) => x.g.lunch).length;

  // ----- health -----
  const hs = daySummary(readings);
  const guestName = (r: Reading) => (r.guestId ? s.guestVisits[r.guestId]?.name : undefined) ?? '';
  const flagged = sortBy(
    readings.filter((r) => r.status !== 'normal').map((r): ReportReading => ({ r, name: r.memberId ? (s.members[r.memberId] ? memberName(s.members[r.memberId]) : '') : guestName(r), memberId: r.memberId ?? undefined, pending: !!r.approval && isWaiting(r) })),
    (x) => (x.r.status === 'alert' ? '0' : '1') + x.r.time + x.r.id,
  );

  // ----- mood and notes -----
  const counts = Object.fromEntries(MOODS.map((k) => [k, 0])) as Record<Mood, number>;
  const notes: ReportNote[] = [];
  for (const r of members) {
    if (r.mood) counts[r.mood]++;
    if (r.log?.note?.trim()) notes.push({ m: r.m, text: r.log.note.trim(), staff: false, log: r.log, pending: r.pendingLog });
    if (r.log?.staffNote?.trim()) notes.push({ m: r.m, text: r.log.staffNote.trim(), staff: true, log: r.log, pending: r.pendingLog });
  }

  // ----- duties (each role's score of the day) -----
  const duties: ReportDuty[] = date > today ? [] : teamSummary(s, date, today, nowMin).map((r) => ({
    role: r.role, people: staffByRole(s, r.role).map(staffCall).filter(Boolean), done: r.done, total: r.total, late: r.late,
    customDone: r.customDone, customTotal: r.customTotal, customOverdue: r.customOverdue,
  }));

  const photoCount = libraryPhotos(s, { from: date, to: date }).filter((p) => p.kind !== 'arrival').length; // the door camera's arrival pictures are not photos anyone took
  const other: ReportOther = {
    feedback: live(s.feedback).filter((f) => dtDate(f.createdAt) === date),
    enquiries: live(s.enquiries).filter((e) => dtDate(e.createdAt) === date).length,
    venue: sortBy(live(s.venueBookings).filter((b) => b.date === date && b.status !== 'cancelled'), (b) => b.from),
  };
  const lunchPhotos = lunchPhotosOn(s, date);
  const teaPhotos = teaPhotosOn(s, date);
  return {
    date, live: isToday, status,
    counts: {
      came: members.length, trials: guestsCame.filter((x) => x.g.kind === 'trial').length, visits: guestsCame.filter((x) => x.g.kind === 'visit').length,
      lunches: diners, checks: hs.readings, photos: photoCount,
    },
    members, guests: guestRows, sessions,
    lunch: { menu: menu ? { lunch: named(menu.lunch), soft: named(menu.soft), tea: named(menu.tea) } : null, alternatives, photos: { lunch: lunchPhotos, tea: teaPhotos }, served: lunchServed, diners, eaten, low, notMarked: lunchNotMarked },
    health: { readings: hs.readings, people: hs.people, watch: hs.watch, alert: hs.alert, flagged },
    mood: { counts, notMarked: date > today ? 0 : pendingLogMembers(s, date).length, notes, pendingLogs: members.filter((r) => r.pendingLog).length },
    duties, other,
    empty: members.length === 0 && guestRows.length === 0 && readings.length === 0 && photoCount === 0 && lunchPhotos.length === 0 && teaPhotos.length === 0,
  };
}

// ---------- moving between days ----------
/** The first day with a check-in (the report has nothing before it), or null when nobody ever checked in. */
export function firstReportDay(s: ClubState): ISODate | null {
  let first: ISODate | null = null;
  for (const a of live(s.attendance)) if (a.checkIn && (!first || a.date < first)) first = a.date;
  return first;
}
/** The open day before `date` (back to the first day with data), or null. The report's ‹ button. */
export function prevReportDay(s: ClubState, date: ISODate): ISODate | null {
  const first = firstReportDay(s);
  if (!first) return null;
  for (let d = addDays(date, -1), i = 0; d >= first && i < 400; d = addDays(d, -1), i++) if (isOpen(s, d)) return d;
  return null;
}
/** The open day after `date`, up to today, or null. The report's › button. */
export function nextReportDay(s: ClubState, date: ISODate, today: ISODate): ISODate | null {
  for (let d = addDays(date, 1); d <= today; d = addDays(d, 1)) if (isOpen(s, d)) return d;
  return null;
}
/** The date a `?date=` link names: a real date up to today, else today. */
export const reportDateOf = (q: string | null | undefined, today: ISODate): ISODate => (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && !Number.isNaN(Date.parse(q + 'T00:00:00Z')) && q <= today ? q : today);
