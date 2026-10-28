// Core selectors: day status, members, plans, family links, staff lookups.
import type { ClubState, HM, ISODate, Member, PlanEntry, FamilyLink, FamilyContact, Staff, StaffRole, CalendarEvent, VenueBooking } from '../types';
import { addDays, ageOn, asWeekday, isWeekday, live, sameWeek, sortBy, ym } from '../util';

// ---------- days ----------
export type DayStatus =
  | { open: true; outing?: CalendarEvent; events: CalendarEvent[] }
  | { open: false; reason: 'weekend' | 'closed' | 'holiday'; event?: CalendarEvent; events: CalendarEvent[] };

export function eventsOn(s: ClubState, date: ISODate): CalendarEvent[] {
  return live(s.calendarEvents).filter((e) => !e.cancelledAt && e.date <= date && (e.endDate || e.date) >= date);
}

/**
 * Round 14 (B2, Ruling 9): is a Saturday or Sunday programmed? It is when a session runs on it: the published weekly plan in force has a cell for that
 * day, or the date's live one-day change has a session or an extra (a slot set to "no session" takes the plan's cell away). A waiting (`pending`) or
 * returned programme never counts: only what is live. A weekend rented out in club hours is never programmed (`clubHoursRental`: the venue rule
 * holds both ways, so the booking stays editable). Reads the collections directly (rules/kitchen.ts imports this file).
 */
export function programmedWeekend(s: ClubState, date: ISODate): boolean {
  if (clubHoursRental(s, date)) return false;
  const pub = live(s.scheduleVersions ?? {}).filter((v) => v.status === 'published' && v.effectiveFrom <= date && sameWeek(v.effectiveFrom, date));
  const plan = sortBy(pub, (v) => v.effectiveFrom + (v.publishedAt || '')).pop()?.days[asWeekday(date)];
  const row = s.scheduleDays?.[date];
  const over = row && !row.deletedAt ? row : undefined;
  if (over?.extra?.length) return true;
  return (['10:30', '13:30'] as const).some((slot) => (over && slot in over.slots ? over.slots[slot] : plan?.[slot]));
}

export function dayStatus(s: ClubState, date: ISODate): DayStatus {
  const events = eventsOn(s, date);
  if (!isWeekday(date) && !programmedWeekend(s, date)) return { open: false, reason: 'weekend', events }; // a programmed weekend opens; its closures and holidays below still apply
  const closed = events.find((e) => e.kind === 'closed');
  if (closed) return { open: false, reason: 'closed', event: closed, events };
  const holiday = events.find((e) => e.kind === 'holiday');
  if (holiday) return { open: false, reason: 'holiday', event: holiday, events };
  return { open: true, outing: events.find((e) => e.kind === 'outing'), events };
}
export const isOpen = (s: ClubState, date: ISODate) => dayStatus(s, date).open;
/** Two time ranges overlap (touching ends do not). */
export const timesOverlap = (a1: HM, a2: HM, b1: HM, b2: HM) => a1 < b2 && b1 < a2;
/** A time range runs into the club's opening hours (a private event may not, on a day the club is open: rules/mgmt.ts checkVenueSlot). */
export const overlapsClubHours = (s: ClubState, from: HM, to: HM) => timesOverlap(from, to, s.club.settings.open, s.club.settings.close);
/** Round 14 (B2): a confirmed venue booking on a date that runs into club hours. Such a weekend stays a rental day: it cannot be programmed. */
export const clubHoursRental = (s: ClubState, date: ISODate): VenueBooking | undefined =>
  live(s.venueBookings ?? {}).find((v) => v.date === date && v.status === 'confirmed' && overlapsClubHours(s, v.from, v.to));
export function nextOpenDay(s: ClubState, from: ISODate, inclusive = false): ISODate {
  let d = inclusive ? from : addDays(from, 1);
  for (let i = 0; i < 60 && !isOpen(s, d); i++) d = addDays(d, 1);
  return d;
}
export function openDaysInMonth(s: ClubState, month: string): ISODate[] {
  const out: ISODate[] = [];
  for (let d = `${month}-01`; ym(d) === month; d = addDays(d, 1)) if (isOpen(s, d)) out.push(d);
  return out;
}

// ---------- members ----------
export const memberName = (m: Pick<Member, 'title' | 'firstName' | 'lastName'>) =>
  `${m.title} ${m.firstName}${m.firstName === m.lastName || !m.lastName ? '' : ' ' + m.lastName}`;
export const memberShort = (m: Pick<Member, 'title' | 'firstName'>) => `${m.title} ${m.firstName}`;
const TITLE_WORDS = /^(Oma|Opa|Ibu|Bapak|Pak|Bu|Ns\.|Kak|Mbak|Chef|dr\.)\s/i;
/** What staff and family call a member: the nickname (Panggilan) with the title, e.g. "Oma Nio"; the short name when there is no nickname. A nickname that already carries a title ("Oma Lina") is used as it is. */
export const displayName = (m: Pick<Member, 'title' | 'firstName' | 'registration'>) => {
  const nick = m.registration?.nickname?.trim();
  if (!nick) return memberShort(m);
  return nick.toLowerCase().startsWith(m.title.toLowerCase() + ' ') || TITLE_WORDS.test(nick) ? nick : `${m.title} ${nick}`;
};
/** The name a list or header leads with: the nickname with the title when there is one, otherwise the full registered name (so two members who share a first name stay apart). */
export const listName = (m: Pick<Member, 'title' | 'firstName' | 'lastName' | 'registration'>) => (m.registration?.nickname?.trim() ? displayName(m) : memberName(m));
/** The full name, shown small beneath the display name; null when it adds nothing. */
export const displayFull = (m: Pick<Member, 'title' | 'firstName' | 'lastName' | 'registration'>) => {
  if (!m.registration?.nickname?.trim()) return null;
  const full = memberName(m);
  return full === displayName(m) ? null : full;
};
/** Initials of a name, or of a member: a member's title is never part of them (whatever it is, "Tante" included); a plain string has the usual titles stripped. */
export const initials = (n: string | Pick<Member, 'title' | 'firstName' | 'lastName'>) => {
  const p = (typeof n === 'string' ? n.replace(/^(Oma|Opa|Ibu|Bapak|Ns\.|Kak|Pak|Chef|Mbak|dr\.)\s+/, '') : memberName(n).slice(n.title.length + 1)).split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
export const memberAge = (m: Member, today: ISODate) => (m.dob ? ageOn(m.dob, today) : m.ageYears ?? null);
export const pron = (m: Pick<Member, 'gender'>) => (m.gender === 'f' ? { s: 'she', o: 'her', p: 'her' } : { s: 'he', o: 'him', p: 'his' });

export const isPendingRow = (r: { review?: { status: string } }) => !!r.review && r.review.status !== 'approved';
export const currentMembership = (m: Member) => m.memberships[m.memberships.length - 1];
export const memberSince = (m: Member) => m.memberships[0]?.start;

/** Lifecycle status on a date (ignores review state). */
export function membershipStatus(m: Member, date: ISODate): 'upcoming' | 'active' | 'ending' | 'ended' {
  const cur = currentMembership(m);
  if (!cur) return 'ended';
  if (cur.start > date) return 'upcoming';
  if (cur.lastDay && cur.lastDay < date) return 'ended';
  if (cur.lastDay) return 'ending';
  return 'active';
}
export function activeOn(m: Member, date: ISODate) {
  if (m.deletedAt || isPendingRow(m)) return false;
  return m.memberships.some((p) => p.start <= date && (!p.lastDay || p.lastDay >= date));
}
export function planOn(m: Member, date: ISODate): PlanEntry {
  const ps = m.plans.filter((p) => p.from <= date);
  return (ps.length ? ps[ps.length - 1] : m.plans[0]) as PlanEntry;
}

/** Members visible in staff lists (approved, not deleted). Pending creates are listed separately. */
export const listMembers = (s: ClubState) => sortBy(live(s.members).filter((m) => !isPendingRow(m) || m.review?.status === 'pending'), (m) => m.firstName);
export const approvedMembers = (s: ClubState) => live(s.members).filter((m) => !isPendingRow(m));

// ---------- family ----------
export const linksOfMember = (s: ClubState, memberId: string): FamilyLink[] =>
  live(s.familyLinks).filter((l) => l.memberId === memberId && l.review?.status !== 'rejected');
export const linksOfFamily = (s: ClubState, familyId: string): FamilyLink[] =>
  live(s.familyLinks).filter((l) => l.familyId === familyId && l.review?.status !== 'rejected');
export const contactsOfMember = (s: ClubState, memberId: string): { link: FamilyLink; contact: FamilyContact }[] =>
  sortBy(
    linksOfMember(s, memberId)
      .map((link) => ({ link, contact: s.familyContacts[link.familyId] }))
      .filter((x) => x.contact && !x.contact.deletedAt),
    (x) => (x.link.primary ? '0' : '1') + x.contact.name,
  );
export function primaryContact(s: ClubState, memberId: string): FamilyContact | undefined {
  const l = linksOfMember(s, memberId).find((x) => x.primary && !isPendingRow(x));
  return l ? s.familyContacts[l.familyId] : contactsOfMember(s, memberId)[0]?.contact;
}
export function familyMemberIds(s: ClubState, familyId: string, includeEnded = true): string[] {
  return linksOfFamily(s, familyId)
    .filter((l) => !isPendingRow(l) && l.appAccess)
    .map((l) => l.memberId)
    .filter((id) => s.members[id] && !isPendingRow(s.members[id]) && (includeEnded || membershipStatus(s.members[id], '9999-12-31') !== 'ended'));
}
export const isPrimaryFor = (s: ClubState, familyId: string, memberId: string) =>
  linksOfMember(s, memberId).some((l) => l.familyId === familyId && l.primary && !isPendingRow(l));
export const famNames = (s: ClubState, memberId: string, and = 'and') => {
  const n = contactsOfMember(s, memberId).filter((x) => x.link.appAccess && !isPendingRow(x.link)).map((x) => x.contact.firstName);
  return n.length > 1 ? n.slice(0, -1).join(', ') + ` ${and} ` + n[n.length - 1] : n[0] || '';
};

// ---------- staff ----------
export const activeStaff = (s: ClubState) => sortBy(live(s.staff).filter((x) => x.active), (x) => x.name);
export const staffByRole = (s: ClubState, role: StaffRole) => activeStaff(s).filter((x) => x.role === role);
export const staffCall = (x: Staff | undefined) => (x ? x.knownAs || x.name : '');
export const firstOfRole = (s: ClubState, role: StaffRole): Staff | undefined => staffByRole(s, role)[0];

/** Display name for any actor. */
export function actorName(s: ClubState, a: string | undefined): string {
  if (!a) return '';
  if (a === 'system') return 'CitraPremier';
  if (a === 'doorCamera') return 'Door camera';
  const [kind, id] = a.includes(':') ? a.split(':') : [/^s\d+/.test(a) ? 'staff' : 'family', a];
  if (kind === 'staff') return staffCall(s.staff[id]) || id;
  return s.familyContacts[id]?.name || id;
}
