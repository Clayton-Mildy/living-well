// Core selectors: day status, members, plans, family links, staff lookups.
import type { ClubState, ISODate, Member, PlanEntry, FamilyLink, FamilyContact, Staff, StaffRole, CalendarEvent } from '../types';
import { addDays, ageOn, isWeekday, live, sortBy, ym } from '../util';

// ---------- days ----------
export type DayStatus =
  | { open: true; outing?: CalendarEvent; events: CalendarEvent[] }
  | { open: false; reason: 'weekend' | 'closed' | 'holiday'; event?: CalendarEvent; events: CalendarEvent[] };

export function eventsOn(s: ClubState, date: ISODate): CalendarEvent[] {
  return live(s.calendarEvents).filter((e) => !e.cancelledAt && e.date <= date && (e.endDate || e.date) >= date);
}

export function dayStatus(s: ClubState, date: ISODate): DayStatus {
  const events = eventsOn(s, date);
  if (!isWeekday(date)) return { open: false, reason: 'weekend', events };
  const closed = events.find((e) => e.kind === 'closed');
  if (closed) return { open: false, reason: 'closed', event: closed, events };
  const holiday = events.find((e) => e.kind === 'holiday');
  if (holiday) return { open: false, reason: 'holiday', event: holiday, events };
  return { open: true, outing: events.find((e) => e.kind === 'outing'), events };
}
export const isOpen = (s: ClubState, date: ISODate) => dayStatus(s, date).open;
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
export const initials = (n: string) => {
  const p = n.replace(/^(Oma|Opa|Ibu|Bapak|Ns\.|Kak|Pak|Chef|Mbak|dr\.)\s+/, '').split(/\s+/).filter(Boolean);
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
