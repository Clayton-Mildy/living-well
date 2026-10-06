// Lobby selectors for a drop-in club (members come on any open day; nothing is "expected"):
// face-recognition opt-out, which member "Simulate next arrival" picks, the manual check-in search, the Flex visit line,
// departure-check status, and the "Also today" list (trial/visit guests and unread messages).
// Pure functions over ClubState (also called with an immer draft inside actions).
import type { ClubState, GuestVisit, HM, ISODate, Member, Message, Reading, Role, Thread } from '../types';
import { contactsOfMember, dayStatus, memberName, planOn } from './core';
import { attOf, flexQuota, guestsOn, lobbyGroups, visitsInMonth, wouldBeExtra, type BoardRow } from './attendance';
import { todayReading } from './health';
import { messagesOf, staffThreads, staffUnread } from './messages';
import { sortBy, toMin, ym } from '../util';

// ---------- face recognition ----------
/** The member's most recent face-recognition consent decision (undefined when none was ever recorded). */
export function latestFaceConsent(m: Pick<Member, 'consents'>): boolean | undefined {
  return sortBy(m.consents.filter((c) => c.kind === 'face'), (c) => c.at).pop()?.granted;
}
/** Latest face consent is "no": never picked by the door camera, always checked in by name. */
export const faceOptedOut = (m: Pick<Member, 'consents'>) => latestFaceConsent(m) === false;
/** Can the door camera recognise this member (enrolled, and has not opted out)? */
export const faceRecognisable = (m: Pick<Member, 'consents' | 'face'>) => !!m.face.enrolled && !faceOptedOut(m);

/**
 * Who "Simulate next arrival" picks: a member who is not in the club yet and whom the camera may recognise.
 * Oma Lina (m1) first when she is not in yet, as in the design; otherwise the earliest usual arrival.
 */
export function nextFaceArrival(s: ClubState, date: ISODate): { id: string } | { none: 'everyoneIn' | 'byName' } {
  const pending = lobbyGroups(s, date).others;
  if (!pending.length) return { none: 'everyoneIn' };
  const ok = pending.filter((r) => faceRecognisable(r.m));
  if (!ok.length) return { none: 'byName' };
  return { id: (ok.find((r) => r.m.id === 'm1') || ok[0]).m.id };
}

// ---------- Flex visits ----------
export interface VisitInfo {
  /** Flex: "visit n of quota this month". Gold: unlimited. */
  flex: boolean;
  /** which visit of the month a check-in on `date` is (Flex visits up to and including that day) */
  n: number;
  quota: number | null;
  /** checking in on `date` is an extra day (visit beyond the quota, billed on next month's invoice) */
  extra: boolean;
}
export function visitInfo(s: ClubState, m: Member, date: ISODate): VisitInfo {
  if (planOn(m, date).plan !== 'flex') return { flex: false, n: visitsInMonth(s, m, ym(date)).filter((d) => d <= date).length || 1, quota: null, extra: false };
  const before = visitsInMonth(s, m, ym(date)).filter((d) => d < date && planOn(m, d).plan === 'flex').length;
  return { flex: true, n: before + 1, quota: flexQuota(s, m, ym(date)), extra: wouldBeExtra(s, m, date) };
}

// ---------- member search and the three lobby lists ----------
const norm = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const digits = (v: string) => v.replace(/\D/g, '');
/** Does what was typed find this member: their name, a family contact's name, or (3+ digits) a contact's phone number? Nothing typed finds everyone. */
export function memberMatchesQuery(s: ClubState, m: Member, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const qd = digits(query);
  const contacts = contactsOfMember(s, m.id);
  const hay = [memberName(m), ...contacts.map((x) => x.contact.name)].map(norm).join(' | ');
  return hay.includes(q) || (qd.length >= 3 && contacts.some((x) => digits(x.contact.phone).includes(qd)));
}
const search = (s: ClubState, rows: BoardRow[], query: string) => (norm(query) ? rows.filter((r) => memberMatchesQuery(s, r.m, query)) : rows);
/**
 * The check-in list: active members not checked in today (by usual arrival time, then name),
 * narrowed by what was typed. Nobody can check in on a closed day.
 */
export function manualCandidates(s: ClubState, date: ISODate, query = ''): BoardRow[] {
  if (!dayStatus(s, date).open) return [];
  return search(s, lobbyGroups(s, date).others, query);
}
/** The check-out list: members who are in the club now (arrived, not left), newest arrival first, narrowed by what was typed. */
export const checkoutCandidates = (s: ClubState, date: ISODate, query = ''): BoardRow[] => search(s, lobbyGroups(s, date).inClub, query);
/** Members who checked in and have left today, latest departure first, narrowed by what was typed. */
export const goneHomeRows = (s: ClubState, date: ISODate, query = ''): BoardRow[] => search(s, lobbyGroups(s, date).goneHome, query);

// ---------- departure check ----------
export type DepartureStatus = { kind: 'done'; reading: Reading } | { kind: 'waiting'; since: HM } | { kind: 'missing' };
/** Done (with the BP reading), waiting at the health station (asked by the lobby, or auto-queued from the departure time), or missing. */
export function departureStatus(s: ClubState, memberId: string, date: ISODate, nowMin: number): DepartureStatus {
  const dep = todayReading(s, memberId, date, 'departure');
  if (dep) return { kind: 'done', reading: dep };
  const a = attOf(s, date, memberId);
  if (!a?.checkIn || a.dismissed.some((x) => x.kind === 'departure')) return { kind: 'missing' };
  if (a.departureAsked) return { kind: 'waiting', since: a.departureAsked.at };
  if (nowMin >= toMin(s.club.settings.departureFrom) && todayReading(s, memberId, date, 'arrival')) return { kind: 'waiting', since: s.club.settings.departureFrom };
  return { kind: 'missing' };
}

// ---------- "Also today" ----------
export interface AlsoToday {
  guests: GuestVisit[]; // trial and visit guests (booked, in, out, no-show): trials (no time, they come from opening) first, then by time
  unread: { threads: Thread[]; latest?: { thread: Thread; message: Message } };
}
export function alsoToday(s: ClubState, date: ISODate, role: Role): AlsoToday {
  const unreadThreads = staffThreads(s, role).filter((t) => staffUnread(s, t) > 0);
  let latest: { thread: Thread; message: Message } | undefined;
  for (const t of unreadThreads) {
    const msg = messagesOf(s, t.id).filter((x) => x.seq > t.staffReadSeq && x.from.startsWith('family:')).pop();
    if (msg && (!latest || msg.at > latest.message.at)) latest = { thread: t, message: msg };
  }
  // a trial pass has no time (its guest comes from opening, with lunch and a nurse check), so guests without a time go first
  const guests = sortBy(guestsOn(s, date), (g) => `${g.time || '00:00'}|${g.kind === 'trial' ? 0 : 1}|${g.name}`);
  return { guests, unread: { threads: unreadThreads, latest } };
}
