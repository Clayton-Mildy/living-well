// Family area selectors (pure): member switcher, the member's day, plan card (Flex visits / Gold), timeline, photos, invoices, daily log.
// The club is drop-in: members come on any open date and nothing is "expected", so a member's day is only ever away, here or home.
// Everything reads ClubState, so it works on the full state and on a family's projection.
import type { Attendance, Bank, CalendarEvent, ClubState, DailyLog, GuestHostKind, HM, Invoice, ISODate, MemberNote, Member, Photo, Plan, Reading, Slot, YM } from '../types';
import { currentMembership, dayStatus, familyMemberIds, isPendingRow, memberSince, membershipStatus, nextOpenDay, planOn } from './core';
import { attOf, flexMonth } from './attendance';
import { cameOn, sessionPhotos } from './activity';
import { balanceOf, invoiceStatus, invoicesOf, priceOn, type InvoiceStatus } from './billing';
import { menuOn, sessionsOn, visibleLunchPhotos, type SessionSlot } from './kitchen';
import { guestOn } from './guests';
import { todayReading } from './health';
import { logForFamily, noteForFamily, readingForFamily } from './approvals';
import { addDays, addMonths, live, sortBy, toHM, toMin, ym } from '../util';

/** A reading the family may see: one that waits for management's approval is left out (a family's projection never holds one; this guards the full state). */
const famReading = (s: ClubState, memberId: string, today: ISODate, kind: Reading['kind']): Reading | undefined => {
  const r = todayReading(s, memberId, today, kind);
  return (r && readingForFamily(r)) || undefined;
};

/** Lunch and afternoon tea times on the family timeline (the design's fixed club routine). */
export const LUNCH_AT: HM = '12:00';
export const TEA_AT: HM = '15:00';

// ---------- links, members, switcher ----------
export interface FamilyMembers {
  /** Every linked member (approved link with app access). */
  all: string[];
  /** Members the switcher offers: those whose membership has not ended (all of them when every membership has ended). */
  choices: string[];
}
export function familyMembers(s: ClubState, familyId: string, today: ISODate): FamilyMembers {
  const all = familyMemberIds(s, familyId, true);
  const active = all.filter((id) => membershipStatus(s.members[id], today) !== 'ended');
  return { all, choices: active.length ? active : all };
}
/** A stored switcher value ('both' or a member id) resolved against the members on offer: 'both' only when there is more than one. */
export function resolveSel(stored: unknown, choices: string[]): string {
  if (choices.length < 2) return choices[0] || '';
  return typeof stored === 'string' && choices.includes(stored) ? stored : 'both';
}
export const selWho = (sel: string, choices: string[]) => (sel === 'both' ? choices : [sel]);
/** Health shows one member at a time: the selected member, or the first one when "both" is selected. */
export const healthMemberOf = (sel: string, choices: string[]) => (choices.includes(sel) ? sel : choices[0] || '');

// ---------- small display helpers (keys and data only; text comes from t()) ----------
/** Staff display name for family-facing text: call name ('Ns. Dewi') or first name ('Caca'). */
export const staffFirst = (s: ClubState, id: string | undefined) => {
  const st = id ? s.staff[id] : undefined;
  return st ? st.knownAs || st.name.split(' ')[0] : '';
};
export const staffIdOf = (actor: string | undefined) => (actor && actor.startsWith('staff:') ? actor.slice(6) : actor && /^s\d+$/.test(actor) ? actor : undefined);
/** Activity / room names in the family's language. */
export const activityLabel = (s: ClubState, id: string | undefined, lang: 'en' | 'id') => {
  const a = id ? s.activities[id] : undefined;
  return a ? (lang === 'id' && a.nameId) || a.name : '';
};
export const roomLabel = (s: ClubState, id: string | undefined, lang: 'en' | 'id') => {
  const r = id ? s.rooms[id] : undefined;
  return r ? (lang === 'id' && r.nameId) || r.name : '';
};
/** Photos store the activity as text; map it back to the catalogue for the Indonesian name. */
export const photoActivityLabel = (s: ClubState, name: string | undefined, lang: 'en' | 'id') => {
  if (!name) return '';
  const a = live(s.activities).find((x) => x.name === name);
  return a ? (lang === 'id' && a.nameId) || a.name : name;
};
export const eventTitle = (e: CalendarEvent | undefined, lang: 'en' | 'id') => (e ? (lang === 'id' && e.titleId) || e.title : '');

// ---------- the member's day ----------
export type DayState =
  | { kind: 'ended'; lastDay: ISODate }
  | { kind: 'upcoming'; start: ISODate }
  | { kind: 'closed'; reason: 'weekend' | 'closed' | 'holiday'; event?: CalendarEvent; next: ISODate }
  /** An open day and the member has not checked in (members drop in, so this is neutral: nobody is "expected"). */
  | { kind: 'away' }
  | { kind: 'here'; since: HM; att: Attendance }
  | { kind: 'home'; at: HM; att: Attendance };

export function dayStateOf(s: ClubState, m: Member, today: ISODate): DayState {
  const cur = currentMembership(m);
  const ms = membershipStatus(m, today);
  if (ms === 'ended') return { kind: 'ended', lastDay: cur?.lastDay || today };
  if (ms === 'upcoming') return { kind: 'upcoming', start: cur?.start || today };
  const a = attOf(s, today, m.id);
  if (a?.checkOut) return { kind: 'home', at: a.checkOut.at, att: a };
  if (a?.checkIn) return { kind: 'here', since: a.checkIn.at, att: a };
  const ds = dayStatus(s, today);
  if (!ds.open) return { kind: 'closed', reason: ds.reason, event: ds.event, next: nextOpenDay(s, today) };
  return { kind: 'away' };
}

/**
 * A member who has not checked in may still drop in until the club closes, so "not at the club" only reads as final after closing time.
 * Before that the family sees "right now" wording; after it (or on a day the club is closed) "today".
 */
export const mayStillCome = (s: ClubState, nowMin: number) => nowMin < toMin(s.club.settings.close);

// ---------- pricing of an extra day ----------
/** Extra days are billed on the next month's invoice, at the price in force on its issue date. */
export function extraPriceFor(s: ClubState, date: ISODate) {
  const invoiceMonth = addMonths(ym(date), 1);
  const issue = `${invoiceMonth}-${String(s.club.settings.issueDay).padStart(2, '0')}`;
  return { invoiceMonth, price: priceOn(s, issue)?.extra ?? 0 };
}

// ---------- plan card ----------
export interface PlanSummary {
  plan: Plan;
  ended: boolean;
  month: YM;
  /** Flex: visits included each month (prorated in a part month). Null for Gold. */
  quota: number | null;
  /** Flex: visits counted against the plan this month, at most the quota (the rest are extra). Gold: visits so far. */
  used: number;
  /** Flex: visits left before the next one is an extra day. Null for Gold. */
  left: number | null;
  /** Every day checked in this month, oldest first. */
  visits: ISODate[];
  /** Flex visits beyond the quota: extra days, billed on next month's invoice. Always empty for Gold. */
  extra: ISODate[];
  invoiceMonth: YM;
  /** Price of one extra day (in force on the next invoice's issue date). */
  price: number;
}
/** The plan card for a member: Flex "N of 10 visits used" with the extra visits listed, or Gold (come any open day). All from check-ins. */
export function planSummary(s: ClubState, m: Member, today: ISODate): PlanSummary {
  const month = ym(today);
  const plan = planOn(m, today).plan;
  const flex = plan === 'flex';
  const fm = flexMonth(s, m, month, today);
  const { invoiceMonth, price } = extraPriceFor(s, `${month}-01`);
  const quota = flex ? fm.quota ?? s.club.settings.flexQuota : null;
  return {
    plan, ended: membershipStatus(m, today) === 'ended', month, quota,
    used: quota === null ? fm.visits.length : Math.min(fm.used, quota),
    left: quota === null ? null : Math.max(0, quota - fm.used),
    visits: fm.visits, extra: flex ? fm.extraDates : [], invoiceMonth, price,
  };
}

// ---------- timeline ----------
export type TlState = 'done' | 'now' | 'up';
export type TlItem =
  | { id: string; kind: 'arrival'; state: TlState; time: HM; att: Attendance }
  | { id: string; kind: 'health'; state: TlState; time: HM | ''; arrival?: Reading; monthly?: Reading }
  | { id: string; kind: 'session'; state: TlState; time: HM; start: number; end: number; slot: SessionSlot['slot']; activityId: string; roomId: string; staffId: string }
  | { id: string; kind: 'outing'; state: TlState; time: HM; start: number; end: number; event: CalendarEvent }
  | { id: string; kind: 'lunch'; state: TlState; time: HM; start: number; end: number }
  | { id: string; kind: 'tea'; state: TlState; time: HM; start: number; end: number; dishIds: string[] }
  | { id: string; kind: 'home'; state: TlState; time: HM; att?: Attendance; departure?: Reading };

export const homeTime = (s: ClubState): HM => toHM(toMin(s.club.settings.close) - 30);

interface Block { id: string; start: number; end?: number; build: (state: TlState, start: number, end: number) => TlItem }
/** Today's schedule blocks (sessions, lunch, tea, or the outing) in time order. */
function scheduleBlocks(s: ClubState, date: ISODate): Block[] {
  const ds = dayStatus(s, date);
  if (!ds.open) return [];
  if (ds.outing) {
    const e = ds.outing;
    const from = e.from || s.club.settings.open;
    return [{ id: 'outing', start: toMin(from), end: toMin(e.to || s.club.settings.close), build: (state, a, b) => ({ id: 'outing', kind: 'outing', state, time: from, start: a, end: b, event: e }) }];
  }
  const out: Block[] = [];
  for (const sl of sessionsOn(s, date)) {
    if (!sl.cell) continue;
    const c = sl.cell;
    out.push({ id: 'session-' + sl.slot, start: toMin(sl.slot), build: (state, a, b) => ({ id: 'session-' + sl.slot, kind: 'session', state, time: sl.slot, start: a, end: b, slot: sl.slot, activityId: c.activityId, roomId: c.roomId, staffId: c.staffId }) });
  }
  const menu = menuOn(s, date);
  if (menu) {
    // the day's approved lunch photos are read by the timeline itself (visibleLunchPhotos)
    out.push({ id: 'lunch', start: toMin(LUNCH_AT), build: (state, a, b) => ({ id: 'lunch', kind: 'lunch', state, time: LUNCH_AT, start: a, end: b }) });
    out.push({ id: 'tea', start: toMin(TEA_AT), build: (state, a, b) => ({ id: 'tea', kind: 'tea', state, time: TEA_AT, start: a, end: b, dishIds: menu.tea }) });
  }
  return sortBy(out, (b) => b.start);
}

/**
 * The "Today at the club" timeline for one or more members. The club's programme is listed either way (it stays "up" until the member
 * is at the club). The arrival item appears once checked in, the health check once the member is in, and home time with the actual
 * time once checked out. With several members (Both mode) only the programme is listed, following whoever has been at the club today.
 */
export function timelineOf(s: ClubState, members: Member[], today: ISODate, nowMin: number): TlItem[] {
  const states = members.map((m) => ({ m, st: dayStateOf(s, m, today), a: attOf(s, today, m.id) }));
  const single = members.length === 1 ? states[0] : null;
  const present = single ? single.st.kind === 'here' : states.some((x) => x.st.kind === 'here' || x.st.kind === 'home');
  const leftMin = single?.st.kind === 'home' ? toMin(single.st.at) : null;
  const items: TlItem[] = [];

  if (single) {
    const { st, a, m } = single;
    if (a?.checkIn) items.push({ id: 'arrival', kind: 'arrival', state: 'done', time: a.checkIn.at, att: a });
    // a reading belongs to a visit: if the check-in was undone, the day is empty again
    const visiting = st.kind === 'here' || st.kind === 'home';
    const arr = visiting ? famReading(s, m.id, today, 'arrival') : undefined;
    const mon = visiting ? famReading(s, m.id, today, 'monthly') : undefined;
    if (arr) items.push({ id: 'health', kind: 'health', state: 'done', time: arr.time, arrival: arr, monthly: mon });
    else if (st.kind === 'here') items.push({ id: 'health', kind: 'health', state: 'up', time: '' });
  }

  // a member who has gone home only sees what they were there for
  const blocks = scheduleBlocks(s, today).filter((b) => leftMin === null || b.start < leftMin);
  const home = toMin(homeTime(s));
  blocks.forEach((b, i) => {
    const end = b.end ?? (i < blocks.length - 1 ? blocks[i + 1].start : Math.max(home, b.start + 30));
    // KC round 6 (a progress bar): what is over is 'done' even when the member is not in; 'now' only for someone at the club
    const state: TlState = leftMin !== null ? 'done' : nowMin >= end ? 'done' : !present ? 'up' : nowMin >= b.start ? 'now' : 'up';
    items.push(b.build(state, b.start, end));
  });

  if (single) {
    const { a, st } = single;
    if (a?.checkOut) items.push({ id: 'home', kind: 'home', state: 'done', time: a.checkOut.at, att: a, departure: famReading(s, single.m.id, today, 'departure') });
    else if (st.kind === 'here') items.push({ id: 'home', kind: 'home', state: 'up', time: homeTime(s) });
  }
  return items;
}

// ---------- lunch ----------
/** Dish ids a member is served at lunch (soft diet gets the soft option). */
export function servedLunch(s: ClubState, m: Member, date: ISODate): string[] {
  const menu = menuOn(s, date, { approvedOnly: true }); // a menu the kitchen published waits for management's approval
  if (!menu) return [];
  return m.health.diet.includes('softFood') ? menu.soft : menu.lunch;
}
export const dishNamesOf = (s: ClubState, ids: string[]) => ids.map((id) => s.dishes[id]?.name).filter(Boolean) as string[];

// ---------- notes ----------
/** The note the club shares with the family: pinned first, else the latest family-visible note. */
export function sharedNoteOf(s: ClubState, memberId: string): MemberNote | undefined {
  const notes = live(s.memberNotes).filter((n) => n.memberId === memberId && n.visibility === 'family').map(noteForFamily).filter((n): n is MemberNote => !!n);
  return sortBy(notes, (n) => (n.pinned ? '1' : '0') + n.on, -1)[0];
}

// ---------- the daily log ----------
export const latestLog = (s: ClubState, memberId: string, today: ISODate): DailyLog | undefined =>
  sortBy(live(s.dailyLogs).filter((l) => l.memberId === memberId && l.status === 'saved' && l.date <= today).map(logForFamily).filter((l): l is DailyLog => !!l), (l) => l.date).pop();
/** KC round 7: the newest log with a note the team wrote (approved), for the quote on Today before today's note is in. */
export const latestNote = (s: ClubState, memberId: string, today: ISODate): DailyLog | undefined =>
  sortBy(live(s.dailyLogs).filter((l) => l.memberId === memberId && l.status === 'saved' && l.date <= today).map(logForFamily).filter((l): l is DailyLog => !!l?.note), (l) => l.date).pop();

// ---------- photos ----------
export interface PhotoSet { key: string; kind: 'solo' | 'both' | 'group' | 'activity'; memberId?: string; /** activity sets: the activity's stored name */ activity?: string; photos: Photo[] }
export interface PhotoDay { date: ISODate; count: number; sets: PhotoSet[] }
/** Photos families see: staff-taken solo and group photos that are visible (not door captures or lunch photos). */
export const isFamilyPhoto = (p: Photo) => p.visibility === 'visible' && (p.kind === 'solo' || p.kind === 'group');
/** KC round 7: an approved activity picture (of a session, no member tags) is the family's on the days one of `who` came to the club. */
export const isFamilyActivityPic = (s: ClubState, p: Photo, who: string[]) => p.kind === 'activity' && p.visibility === 'visible' && cameOn(s, who, p.date);
const byTime = (a: Photo, b: Photo) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
/** Photos of the given members by day, newest day first. Solo photos come first each day, then group photos, then the day's activity pictures (one set per activity). */
export function familyPhotoDays(s: ClubState, who: string[], limit = 10): PhotoDay[] {
  const mine = live(s.photos).filter((p) => (isFamilyPhoto(p) && p.memberIds.some((id) => who.includes(id))) || isFamilyActivityPic(s, p, who));
  const dates = Array.from(new Set(mine.map((p) => p.date))).sort().reverse().slice(0, limit);
  return dates.map((date) => {
    const ps = mine.filter((p) => p.date === date).sort(byTime);
    const sets: PhotoSet[] = [];
    for (const id of who) {
      const solo = ps.filter((p) => p.kind === 'solo' && p.memberIds.includes(id));
      if (solo.length) sets.push({ key: 'solo:' + id, kind: 'solo', memberId: id, photos: solo });
    }
    const grp = ps.filter((p) => p.kind === 'group');
    const both = who.length > 1 ? grp.filter((p) => who.every((id) => p.memberIds.includes(id))) : [];
    const rest = grp.filter((p) => !both.includes(p));
    if (both.length) sets.push({ key: 'both', kind: 'both', photos: both });
    if (rest.length) sets.push({ key: 'group', kind: 'group', memberId: who.length === 1 ? who[0] : undefined, photos: rest });
    for (const a of Array.from(new Set(ps.filter((p) => p.kind === 'activity').map((p) => p.activity || '')))) sets.push({ key: 'act:' + a, kind: 'activity', activity: a, photos: ps.filter((p) => p.kind === 'activity' && (p.activity || '') === a) });
    return { date, count: ps.length, sets };
  });
}
/** All photos of a set list in tile order (what the viewer pages through). */
export const photosInOrder = (days: { sets: PhotoSet[] }[]) => days.flatMap((d) => d.sets.flatMap((x) => x.photos));

// ---------- the day story (KC round 7): one member's day, today or any day before, and the month's memories ----------
// Everything here reads family-visible data only (the approved log, approved readings, visible photos, the approved menu), so it is safe on the full
// state as well as on a family's projection.
/** The minute of the day that reads as "the day is over" (a past date is read at this minute: every step is done). */
export const END_OF_DAY = 24 * 60;
/** The minute to read a date at: now on today, the end of the day on any earlier date. */
export const storyNowMin = (date: ISODate, today: ISODate, nowMin: number) => (date < today ? END_OF_DAY : nowMin);

/** Days the member came to the club (a check-in), oldest first, up to and including `upTo`. */
export function visitDays(s: ClubState, memberId: string, upTo: ISODate): ISODate[] {
  return live(s.attendance).filter((a) => a.memberId === memberId && !!a.checkIn && a.date <= upTo).map((a) => a.date).sort();
}

/** The saved log of a member on a date, as families read it (a log or an edit that waits for approval is left out or shows its last approved values). */
export function logOn(s: ClubState, memberId: string, date: ISODate): DailyLog | null {
  const logs = live(s.dailyLogs).filter((l) => l.memberId === memberId && l.date === date && l.status === 'saved').map(logForFamily).filter((l): l is DailyLog => !!l);
  return sortBy(logs, (l) => l.createdAt + l.id).pop() ?? null;
}
export type LunchAmount = NonNullable<DailyLog['lunch']>;
/** How a member took part in one session, from the log: the mark for that session, else (when no session was marked) the whole day's answer. */
export function tookPart(log: DailyLog | null | undefined, slot: Slot): 'joined' | 'satOut' | null {
  if (!log) return null;
  const marks = log.sessions;
  const mark = marks?.[slot];
  if (mark) return mark;
  if (marks && Object.keys(marks).length) return null; // other sessions were marked, this one was not
  return log.joined === 'satOut' ? 'satOut' : log.joined === 'yes' ? 'joined' : null; // older logs answer for the whole day; a round not filled in yet answers nothing
}

/** The photos a family sees of a day: staff-taken solo and group photos of the members, and (on a day one of them came) the approved activity pictures. Solo first, then group, then activity pictures; each by time. */
export function familyPhotosOn(s: ClubState, who: string[], date: ISODate): Photo[] {
  const rank = (p: Photo) => (p.kind === 'solo' ? 0 : p.kind === 'group' ? 1 : 2);
  return live(s.photos)
    .filter((p) => p.date === date && ((isFamilyPhoto(p) && p.memberIds.some((id) => who.includes(id))) || isFamilyActivityPic(s, p, who)))
    .sort((a, b) => rank(a) - rank(b) || byTime(a, b));
}
const pickRank = (p: Photo) => (p.mediaId && p.media === 'photo' ? 100 : 0) + (p.kind === 'solo' ? 30 : p.kind === 'group' ? 20 : 10);
/**
 * The best picture of a day for the family: a real image over a placeholder, the member's own photo over a group photo over an activity picture,
 * then the latest. Videos are never the cover. Null when the family has no photo of the day.
 */
export function bestPhotoOf(s: ClubState, memberIds: string[], date: ISODate): Photo | null {
  const ps = familyPhotosOn(s, memberIds, date).filter((p) => p.media === 'photo');
  return ps.sort((a, b) => pickRank(b) - pickRank(a) || (a.time < b.time ? 1 : a.time > b.time ? -1 : 0) || (a.id < b.id ? -1 : 1))[0] ?? null;
}

export interface StorySession {
  /** the timeline item id ('session-10:30') */
  id: string;
  slot: Slot;
  time: HM;
  state: TlState;
  activityId: string;
  roomId: string;
  staffId: string;
  /** a guest host leads the session (name and what they do only; never their fee or phone) */
  guest: { id: string; name: string; what: string; kind: GuestHostKind; photoMediaId?: string } | null;
  /** from the day's log: joined or sat out; null when it is not known */
  took: 'joined' | 'satOut' | null;
  /** the approved activity pictures of this session (only on a day the member came), oldest first */
  photos: Photo[];
}
export interface StoryLunch {
  dishIds: string[];
  dishes: string[];
  /** how much the member ate, from the log; null when there is no log (or the member did not come) */
  amount: LunchAmount | null;
  photos: Photo[];
}
export interface DayStory {
  date: ISODate;
  memberId: string;
  state: DayState;
  /** the member checked in that day */
  visited: boolean;
  arrivedAt: HM | null;
  leftAt: HM | null;
  /** the approved log of the day */
  log: DailyLog | null;
  /** the day's steps in order (the timeline); `sessions`, `lunch` and `tea` are the same steps with their story */
  items: TlItem[];
  sessions: StorySession[];
  lunch: StoryLunch | null;
  tea: string[] | null;
  arrival: Reading | null;
  departure: Reading | null;
  /** the day's cover picture, and the first session whose catalogue has a picture (the cover when there is no real photo) */
  hero: Photo | null;
  heroActivityId: string | null;
  /** every family photo of the day, in tile order */
  photos: Photo[];
  /** the closure, holiday or outing of the day */
  event: CalendarEvent | null;
  /** the visit before this date, if there was one */
  lastVisit: ISODate | null;
}

/** One member's day as the family reads it. Pass `storyNowMin(date, today, nowMin)` as `nowMin`: a past day is read at the end of the day, today follows the clock. */
export function dayStory(s: ClubState, m: Member, date: ISODate, nowMin: number): DayStory {
  const state = dayStateOf(s, m, date);
  const att = attOf(s, date, m.id);
  const visited = !!att?.checkIn;
  // a day that is over has no "still to come": a health check or home time that never happened (a check-out nobody recorded) is left out
  const items = timelineOf(s, [m], date, nowMin).filter((i) => !(nowMin >= END_OF_DAY && i.state === 'up' && (i.kind === 'home' || i.kind === 'health')));
  const log = logOn(s, m.id, date);
  const sessions: StorySession[] = [];
  for (const it of items) {
    if (it.kind !== 'session') continue;
    const g = guestOn(s, date, it.slot);
    const act = s.activities[it.activityId];
    sessions.push({
      id: it.id, slot: it.slot, time: it.time, state: it.state, activityId: it.activityId, roomId: it.roomId, staffId: it.staffId,
      guest: g ? { id: g.host.id, name: g.host.name, what: g.host.what, kind: g.host.kind, photoMediaId: g.host.photoMediaId } : null,
      took: visited ? tookPart(log, it.slot) : null,
      photos: visited ? sessionPhotos(s, date, act, { familyOnly: true }) : [],
    });
  }
  const lunchItem = items.find((i) => i.kind === 'lunch');
  const dishIds = lunchItem ? servedLunch(s, m, date) : [];
  const lunch: StoryLunch | null = lunchItem ? { dishIds, dishes: dishNamesOf(s, dishIds), amount: visited && log?.lunch ? log.lunch : null, photos: visibleLunchPhotos(s, date) } : null;
  const tea = items.find((i): i is Extract<TlItem, { kind: 'tea' }> => i.kind === 'tea');
  const ds = dayStatus(s, date);
  const event = ds.open ? ds.outing ?? null : ds.event ?? null;
  return {
    date, memberId: m.id, state, visited, arrivedAt: att?.checkIn?.at ?? null, leftAt: att?.checkOut?.at ?? null, log, items, sessions, lunch,
    tea: tea ? dishNamesOf(s, tea.dishIds) : null,
    arrival: visited ? famReading(s, m.id, date, 'arrival') ?? null : null,
    departure: visited ? famReading(s, m.id, date, 'departure') ?? null : null,
    hero: bestPhotoOf(s, [m.id], date),
    heroActivityId: visited ? sessions.find((x) => s.activities[x.activityId]?.photoMediaId)?.activityId ?? null : null,
    photos: familyPhotosOn(s, [m.id], date), event,
    lastVisit: visitDays(s, m.id, addDays(date, -1)).pop() ?? null,
  };
}

/** The day strip: the member(s)' visit days (newest last) with today always present, the cover picture of each, and how many photos it holds. */
export interface StripDay { date: ISODate; visited: boolean; photo: Photo | null; count: number }
export function dayStrip(s: ClubState, who: string[], today: ISODate, limit = 45): StripDay[] {
  const visits = new Set<ISODate>();
  for (const id of who) for (const d of visitDays(s, id, today)) visits.add(d);
  const dates = Array.from(visits).sort().slice(-limit);
  if (!dates.includes(today)) dates.push(today);
  return dates.map((date) => ({ date, visited: visits.has(date), photo: bestPhotoOf(s, who, date), count: familyPhotosOn(s, who, date).length }));
}

// ---------- monthly memories ----------
export interface MonthRecap {
  month: YM;
  memberId: string;
  /** the days the member came, oldest first */
  visits: ISODate[];
  /** one per visit day: the mood from the team's log (null when there is no approved log) */
  moods: { date: ISODate; mood: NonNullable<DailyLog['mood']> | null }[];
  /** sessions the member took part in, from the logs */
  joined: number;
  /** the member's family photos of the month (solo, group and activity pictures) */
  photos: number;
  /** up to six of the month's best pictures, at most two a day, real images first */
  best: Photo[];
  /** the most joined activities, up to three */
  favourites: { activityId: string; times: number }[];
  /** lunch: days all of it was eaten, out of the days the team wrote down how much was eaten */
  lunch: { finished: number; of: number };
  /** up to three warm notes from the team, oldest first */
  quotes: { date: ISODate; text: string; by: string; mood: NonNullable<DailyLog['mood']> }[];
}
export const RECAP_MONTHS = 6;
/** The months a member's memories can show, newest first: from this month back to the start of the membership, at most six. */
export function recapMonths(m: Member, today: ISODate): YM[] {
  const last = currentMembership(m)?.lastDay;
  const newest = last && ym(last) < ym(today) ? ym(last) : ym(today);
  const oldest = [ym(memberSince(m) || today), addMonths(newest, -(RECAP_MONTHS - 1))].reduce((a, b) => (a > b ? a : b));
  const out: YM[] = [];
  for (let x = newest; x >= oldest; x = addMonths(x, -1)) out.push(x);
  return out.length ? out : [newest]; // a membership that has not started yet still has this month (empty)
}
export function monthRecap(s: ClubState, m: Member, month: YM): MonthRecap {
  const visits = visitDays(s, m.id, `${month}-31`).filter((d) => ym(d) === month);
  const moods: MonthRecap['moods'] = [];
  const times = new Map<string, number>();
  let joined = 0, finished = 0, ate = 0;
  const notes: MonthRecap['quotes'] = [];
  for (const d of visits) {
    const log = logOn(s, m.id, d);
    moods.push({ date: d, mood: log?.mood ?? null });
    if (!log) continue;
    const left = attOf(s, d, m.id)?.checkOut?.at;
    for (const sl of sessionsOn(s, d)) {
      if (!sl.cell || (left && toMin(sl.slot) >= toMin(left))) continue; // she had gone home
      if (tookPart(log, sl.slot) === 'joined') { joined += 1; times.set(sl.cell.activityId, (times.get(sl.cell.activityId) || 0) + 1); }
    }
    if (log.lunch && log.lunch !== 'none') { ate += 1; if (log.lunch === 'all') finished += 1; }
    const text = (log.note || '').trim();
    if (text.length >= 24 && (log.mood === 'cheerful' || log.mood === 'calm')) notes.push({ date: d, text, by: log.by, mood: log.mood });
  }
  const mine = live(s.photos).filter((p) => ym(p.date) === month && ((isFamilyPhoto(p) && p.memberIds.includes(m.id)) || isFamilyActivityPic(s, p, [m.id])));
  const perDay = new Map<string, number>();
  const shown = new Set<string>();
  const best: Photo[] = [];
  for (const p of mine.filter((x) => x.media === 'photo').sort((a, b) => pickRank(b) - pickRank(a) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || byTime(b, a))) {
    if (best.length >= 6 || (perDay.get(p.date) || 0) >= 2 || (p.mediaId && shown.has(p.mediaId))) continue; // real pictures first, and the collage never shows the same picture twice
    perDay.set(p.date, (perDay.get(p.date) || 0) + 1);
    if (p.mediaId) shown.add(p.mediaId);
    best.push(p);
  }
  // the warmest, fullest notes first (cheerful over calm, then the longest), three of them, then in date order
  // (the same words on two days are quoted once)
  const quotes = sortBy(sortBy(notes, (n) => -n.text.length), (n) => (n.mood === 'cheerful' ? 0 : 1)).filter((n, i, a) => a.findIndex((x) => x.text === n.text) === i).slice(0, 3);
  return {
    month, memberId: m.id, visits, moods, joined, photos: mine.length, best,
    favourites: Array.from(times, ([activityId, n]) => ({ activityId, times: n })).sort((a, b) => b.times - a.times || (a.activityId < b.activityId ? -1 : 1)).slice(0, 3),
    lunch: { finished, of: ate },
    quotes: sortBy(quotes, (n) => n.date),
  };
}

// ---------- invoices and virtual accounts ----------
export interface InvRow { inv: Invoice; member: Member; status: InvoiceStatus; total: number; balance: number; paid: number; period: YM }
const invTotal = (inv: Invoice) => inv.lines.reduce((t, l) => t + l.amount, 0);
export function invoiceRows(s: ClubState, memberIds: string[], today: ISODate): InvRow[] {
  const rows: InvRow[] = [];
  for (const id of memberIds) {
    const member = s.members[id];
    if (!member) continue;
    for (const inv of invoicesOf(s, id)) {
      const status = invoiceStatus(s, inv, today);
      if (status === 'void') continue;
      const balance = balanceOf(s, inv);
      rows.push({ inv, member, status, total: invTotal(inv), balance, paid: invTotal(inv) - balance, period: inv.period || ym(inv.issueDate) });
    }
  }
  return rows;
}
export const isOpenStatus = (st: InvoiceStatus) => st === 'outstanding' || st === 'overdue' || st === 'partial';
/** Open invoices (including overdue and part paid), oldest due date first. */
export const openInvoiceRows = (rows: InvRow[]) => sortBy(rows.filter((r) => isOpenStatus(r.status)), (r) => r.inv.dueDate + r.inv.number);
/** Every invoice, newest first (for the history list). */
export const historyRows = (rows: InvRow[]) => sortBy(rows, (r) => r.inv.issueDate + r.inv.number, -1);
export const openTotal = (rows: InvRow[]) => rows.reduce((t, r) => t + r.balance, 0);
/** The next invoice run date for the empty state ("first invoice arrives on the 15th"). */
export function nextIssueDate(s: ClubState, today: ISODate): ISODate {
  const day = String(s.club.settings.issueDay).padStart(2, '0');
  const thisMonth = `${ym(today)}-${day}`;
  return today < thisMonth ? thisMonth : `${addMonths(ym(today), 1)}-${day}`;
}
/** Who looks after billing for a member (primary contact). */
export const billingContactOf = (s: ClubState, memberId: string) =>
  live(s.familyLinks).filter((x) => x.memberId === memberId && x.primary && !isPendingRow(x)).map((x) => s.familyContacts[x.familyId]).find(Boolean);
/** Each bank's virtual-account prefix (the design's DOKU demo numbers). */
export const BANK_PREFIX: Record<Bank, string> = { BCA: '3901', Mandiri: '8950', BNI: '8492', BRI: '1290', Permata: '8856' };
export const BANKS = Object.keys(BANK_PREFIX) as Bank[];
const group4 = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');
/** A member's virtual account number for a bank, grouped in fours ('3901 1203 4400 7919'). */
export const vaFor = (va: string, bank: Bank) => group4(BANK_PREFIX[bank] + va.slice(4));
/** One number to pay several invoices: the shared account when they all use one, else a combined number. */
export function combinedVa(vas: string[], bank: Bank): string {
  const uniq = Array.from(new Set(vas));
  if (!uniq.length) return '';
  if (uniq.length === 1) return vaFor(uniq[0], bank);
  const total = uniq.reduce((t, v) => t + Number(v.slice(-6)), 0);
  return vaFor('8808' + String(total).padStart(12, '0'), bank);
}
