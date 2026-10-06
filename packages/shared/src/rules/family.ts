// Family area selectors (pure): member switcher, the member's day, plan card (Flex visits / Gold), timeline, photos, invoices, log comments.
// The club is drop-in: members come on any open date and nothing is "expected", so a member's day is only ever away, here or home.
// Everything reads ClubState, so it works on the full state and on a family's projection.
import type { Attendance, Bank, CalendarEvent, ClubState, DailyLog, HM, Invoice, ISODate, MemberNote, Message, Member, Photo, Plan, Reading, Thread, YM } from '../types';
import { currentMembership, dayStatus, familyMemberIds, isPendingRow, membershipStatus, nextOpenDay, planOn } from './core';
import { attOf, flexMonth } from './attendance';
import { balanceOf, invoiceStatus, invoicesOf, priceOn, type InvoiceStatus } from './billing';
import { menuOn, sessionsOn, type SessionSlot } from './kitchen';
import { todayReading } from './health';
import { threadFor } from './messages';
import { addMonths, live, sortBy, toHM, toMin, ym } from '../util';

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
    const arr = visiting ? todayReading(s, m.id, today, 'arrival') : undefined;
    const mon = visiting ? todayReading(s, m.id, today, 'monthly') : undefined;
    if (arr) items.push({ id: 'health', kind: 'health', state: 'done', time: arr.time, arrival: arr, monthly: mon });
    else if (st.kind === 'here') items.push({ id: 'health', kind: 'health', state: 'up', time: '' });
  }

  // a member who has gone home only sees what they were there for
  const blocks = scheduleBlocks(s, today).filter((b) => leftMin === null || b.start < leftMin);
  const home = toMin(homeTime(s));
  blocks.forEach((b, i) => {
    const end = b.end ?? (i < blocks.length - 1 ? blocks[i + 1].start : Math.max(home, b.start + 30));
    const state: TlState = leftMin !== null ? 'done' : !present ? 'up' : nowMin >= end ? 'done' : nowMin >= b.start ? 'now' : 'up';
    items.push(b.build(state, b.start, end));
  });

  if (single) {
    const { a, st } = single;
    if (a?.checkOut) items.push({ id: 'home', kind: 'home', state: 'done', time: a.checkOut.at, att: a, departure: todayReading(s, single.m.id, today, 'departure') });
    else if (st.kind === 'here') items.push({ id: 'home', kind: 'home', state: 'up', time: homeTime(s) });
  }
  return items;
}

// ---------- lunch ----------
/** Dish ids a member is served at lunch (soft diet gets the soft option). */
export function servedLunch(s: ClubState, m: Member, date: ISODate): string[] {
  const menu = menuOn(s, date);
  if (!menu) return [];
  return m.health.diet.includes('softFood') ? menu.soft : menu.lunch;
}
export const dishNamesOf = (s: ClubState, ids: string[]) => ids.map((id) => s.dishes[id]?.name).filter(Boolean) as string[];

// ---------- notes ----------
/** The note the club shares with the family: pinned first, else the latest family-visible note. */
export function sharedNoteOf(s: ClubState, memberId: string): MemberNote | undefined {
  const notes = live(s.memberNotes).filter((n) => n.memberId === memberId && n.visibility === 'family');
  return sortBy(notes, (n) => (n.pinned ? '1' : '0') + n.on, -1)[0];
}

// ---------- the daily log and comments ----------
export const latestLog = (s: ClubState, memberId: string, today: ISODate): DailyLog | undefined =>
  sortBy(live(s.dailyLogs).filter((l) => l.memberId === memberId && l.status === 'saved' && l.date <= today), (l) => l.date).pop();
/** The family's care thread for a member. */
export const careThread = (s: ClubState, familyId: string, memberId: string): Thread | undefined => threadFor(s, memberId, familyId, 'care');
/**
 * Comments under a daily log: the family's messages that reference the log, plus staff replies that follow them
 * (a staff message without a reference replies to the most recent log comment).
 */
export function logComments(s: ClubState, thread: Thread | undefined, logId: string): Message[] {
  if (!thread) return [];
  const msgs = sortBy(live(s.messages).filter((m) => m.threadId === thread.id && m.kind === 'text'), (m) => m.seq);
  const out: Message[] = [];
  let current: string | null = null;
  for (const m of msgs) {
    if (m.ref?.type === 'dailyLog') { current = m.ref.id; if (current === logId) out.push(m); continue; }
    if (m.from.startsWith('staff:')) { if (current === logId) out.push(m); continue; }
    current = null;
  }
  return out;
}

// ---------- photos ----------
export interface PhotoSet { key: string; kind: 'solo' | 'both' | 'group'; memberId?: string; photos: Photo[] }
export interface PhotoDay { date: ISODate; count: number; sets: PhotoSet[] }
/** Photos families see: staff-taken solo and group photos that are visible (not door captures or lunch photos). */
export const isFamilyPhoto = (p: Photo) => p.visibility === 'visible' && (p.kind === 'solo' || p.kind === 'group');
const byTime = (a: Photo, b: Photo) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);
/** Photos of the given members by day, newest day first. Solo photos come first each day, then group photos. */
export function familyPhotoDays(s: ClubState, who: string[], limit = 10): PhotoDay[] {
  const mine = live(s.photos).filter((p) => isFamilyPhoto(p) && p.memberIds.some((id) => who.includes(id)));
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
    return { date, count: ps.length, sets };
  });
}
/** All photos of a set list in tile order (what the viewer pages through). */
export const photosInOrder = (days: { sets: PhotoSet[] }[]) => days.flatMap((d) => d.sets.flatMap((x) => x.photos));

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
