// Management selectors: overview lists, venue clash rules, broadcast audiences, surveys, staff records, price preview.
import type {
  ActivityEntry, Bank, ClubState, DT, FamilyContact, HM, InvoiceLine, ISODate, Lang, Member, Plan, Room, Staff, StaffHr, StaffRole, StaffTime, Survey, VenueBooking, YM,
} from '../types';
import { addDays, addMonths, diffDays, live, sortBy, sum, toMin, ym } from '../util';
import { approvedMembers, contactsOfMember, dayStatus, membershipStatus, primaryContact, isPendingRow } from './core';
import { flexMonth, lobbyGroups } from './attendance';
import { feeOf, invoiceStatus, priceOn, runDone, runLinesFor } from './billing';
import { validReadings } from './health';
import { liveSurvey, responsesOf, surveyStats } from './surveys';
import { openEnquiries } from './enquiries';
import { lunchPhotoIds } from './kitchen';
import { approvalTotal, pendingItems } from './approvals';

// ---------- venue ----------
export const WHOLE_CLUB_ID = 'room-whole';
export const VENUE_EARLIEST: HM = '06:00';
export const VENUE_LATEST: HM = '23:00';
export const isWholeClub = (r: Pick<Room, 'id' | 'name'> | undefined) => !!r && (r.id === WHOLE_CLUB_ID || /^whole club$/i.test(r.name));
export const venueRooms = (s: ClubState): Room[] => sortBy(live(s.rooms).filter((r) => r.venue), (r) => r.name);
export const timesOverlap = (a1: HM, a2: HM, b1: HM, b2: HM) => a1 < b2 && b1 < a2;
export const venueIsPast = (v: Pick<VenueBooking, 'date' | 'to'>, today: ISODate, now: HM) => v.date < today || (v.date === today && v.to <= now);

/** A confirmed booking in the same room (or any room when either is "Whole club") that overlaps in time. */
export function venueClash(s: ClubState, slot: { roomId: string; date: ISODate; from: HM; to: HM }, ignoreId?: string): VenueBooking | undefined {
  const room = s.rooms[slot.roomId];
  return live(s.venueBookings).find(
    (v) => v.status === 'confirmed' && v.id !== ignoreId && v.date === slot.date && timesOverlap(v.from, v.to, slot.from, slot.to) && (v.roomId === slot.roomId || isWholeClub(room) || isWholeClub(s.rooms[v.roomId])),
  );
}
export type SlotCheck = { ok: true } | { ok: false; code: string; params?: Record<string, string | number> };
/** Can a private event take this room at this time? Outings and closures block the day; on club days it must stay out of club hours. */
export function checkVenueSlot(s: ClubState, slot: { roomId: string; date: ISODate; from: HM; to: HM }, today: ISODate, now: HM, ignoreId?: string): SlotCheck {
  const room = s.rooms[slot.roomId];
  if (!room || room.deletedAt || !room.venue) return { ok: false, code: 'mgmt.err.venueRoom' };
  if (slot.date < today || (slot.date === today && slot.to <= now)) return { ok: false, code: 'mgmt.err.venuePast' };
  if (slot.from >= slot.to) return { ok: false, code: 'mgmt.err.venueTimes' };
  if (slot.from < VENUE_EARLIEST || slot.to > VENUE_LATEST) return { ok: false, code: 'mgmt.err.venueLate', params: { from: VENUE_EARLIEST, to: VENUE_LATEST } };
  const st = dayStatus(s, slot.date);
  if (st.open) {
    if (st.outing) return { ok: false, code: 'mgmt.err.venueOuting' };
    const { open, close } = s.club.settings;
    if (timesOverlap(slot.from, slot.to, open, close)) return { ok: false, code: 'mgmt.err.venueClubHours', params: { open, close } };
  } else if (st.reason === 'closed') return { ok: false, code: 'mgmt.err.venueClosed' };
  const clash = venueClash(s, slot, ignoreId);
  if (clash) return { ok: false, code: 'mgmt.err.venueClash', params: { org: clash.org, from: clash.from, to: clash.to, room: s.rooms[clash.roomId]?.name || '' } };
  return { ok: true };
}
export function venueLists(s: ClubState, today: ISODate, now: HM) {
  const all = live(s.venueBookings);
  const upcoming = sortBy(all.filter((v) => v.status === 'confirmed' && !venueIsPast(v, today, now)), (v) => v.date + v.from);
  const past = sortBy(all.filter((v) => v.status === 'cancelled' || venueIsPast(v, today, now)), (v) => v.date + v.from, -1);
  return { upcoming, past };
}

// ---------- broadcast ----------
export type AudienceKey = 'families' | 'enquiries' | 'staff';
export const AUDIENCES: AudienceKey[] = ['families', 'enquiries', 'staff'];
export interface Recipient { key: string; name: string; firstName: string; phone: string; audience: AudienceKey; userId?: string; lang?: Lang }

/** Family contacts who can use the app: approved, linked with app access to a member who has not left. */
export function appFamilies(s: ClubState, today: ISODate): FamilyContact[] {
  const out = live(s.familyContacts).filter((c) => {
    if (isPendingRow(c)) return false;
    return live(s.familyLinks).some((l) => {
      const m = s.members[l.memberId];
      return l.familyId === c.id && l.appAccess && !isPendingRow(l) && !!m && !m.deletedAt && !isPendingRow(m) && membershipStatus(m, today) !== 'ended';
    });
  });
  return sortBy(out, (c) => c.name);
}
/** Family contacts with the app and a phone number (WhatsApp broadcasts). */
export function familyAudience(s: ClubState, today: ISODate): Recipient[] {
  return appFamilies(s, today)
    .filter((c) => !!c.phone)
    .map((c) => ({ key: 'f:' + c.id, name: c.name, firstName: c.firstName, phone: c.phone, audience: 'families' as const, userId: c.id, lang: c.lang }));
}
/** The people behind open leads (new, visit, trial). */
export function enquiryAudience(s: ClubState): Recipient[] {
  return openEnquiries(s)
    .filter((e) => !!e.contact.phone)
    .map((e) => ({ key: 'e:' + e.id, name: e.contact.name, firstName: e.contact.name.split(' ')[0], phone: e.contact.phone, audience: 'enquiries' as const }));
}
export function staffAudience(s: ClubState): Recipient[] {
  return live(s.staff)
    .filter((x) => x.active && !!x.phone)
    .map((x) => ({ key: 's:' + x.id, name: x.name, firstName: x.knownAs || x.name.split(' ')[0], phone: x.phone, audience: 'staff' as const, userId: x.appAccess ? x.id : undefined }));
}
export function audienceRecipients(s: ClubState, a: AudienceKey, today: ISODate): Recipient[] {
  return a === 'families' ? familyAudience(s, today) : a === 'enquiries' ? enquiryAudience(s) : staffAudience(s);
}
/** Recipients across audiences, one per phone number (people who are in two groups get one message). */
export function broadcastRecipients(s: ClubState, auds: AudienceKey[], today: ISODate): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const a of AUDIENCES.filter((x) => auds.includes(x))) {
    for (const r of audienceRecipients(s, a, today)) {
      if (seen.has(r.phone)) continue;
      seen.add(r.phone);
      out.push(r);
    }
  }
  return out;
}
export const renderTemplate = (text: string, name: string, msg: string) => text.replace(/\{name\}/g, name).replace(/\{msg\}/g, msg.trim() || '…');
export const scheduledBroadcasts = (s: ClubState) => sortBy(live(s.broadcasts).filter((b) => b.status === 'scheduled'), (b) => b.sendAt);

// ---------- surveys ----------
export type SurveyAudience = NonNullable<Survey['audience']>;
export const SURVEY_AUDIENCE_MODES: SurveyAudience['mode'][] = ['all', 'members', 'contacts'];
/** The families (contact ids, sorted) a survey audience means today. Only families with the app can answer, so only they are ever chosen. */
export function resolveSurveyAudience(s: ClubState, a: SurveyAudience | undefined, today: ISODate): string[] {
  const eligible = appFamilies(s, today);
  const ok = new Set(eligible.map((c) => c.id));
  if (!a || a.mode === 'all') return [...ok].sort();
  if (a.mode === 'contacts') return (a.contactIds ?? []).filter((id, i, all) => ok.has(id) && all.indexOf(id) === i).sort();
  const ids = new Set<string>();
  for (const mid of a.memberIds ?? []) for (const { link, contact } of contactsOfMember(s, mid)) if (link.appAccess && !isPendingRow(link) && ok.has(contact.id)) ids.add(contact.id);
  return [...ids].sort();
}
/** Members a survey can be aimed at: approved members who have not left and have at least one family contact with the app. */
export function surveyMembers(s: ClubState, today: ISODate): Member[] {
  const ok = new Set(appFamilies(s, today).map((c) => c.id));
  return sortBy(
    approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended' && contactsOfMember(s, m.id).some((x) => x.link.appAccess && !isPendingRow(x.link) && ok.has(x.contact.id))),
    (m) => `${m.firstName} ${m.lastName}`,
  );
}
/** Staff families can rate: active, "rateable" first. */
export const teamCandidates = (s: ClubState): Staff[] =>
  sortBy(live(s.staff).filter((x) => x.active), (x) => (x.rateable ? '0' : '1') + x.name);
export function recommendPct(s: ClubState, sv: Survey): number | null {
  const rs = surveyStats(s, sv).responses.filter((r) => r.recommend !== null);
  return rs.length ? Math.round((rs.filter((r) => r.recommend === true).length / rs.length) * 100) : null;
}
export interface StaffRating { avg: number; n: number; surveys: { id: string; title: string; avg: number; n: number }[] }
/** A staff member's rating pooled over every survey that asked about them. */
export function staffRating(s: ClubState, staffId: string): StaffRating | null {
  let total = 0, n = 0;
  const surveys: StaffRating['surveys'] = [];
  for (const sv of sortBy(live(s.surveys).filter((x) => x.status !== 'draft'), (x) => x.sentOn, -1)) {
    const vals = responsesOf(s, sv.id).filter((r) => sv.recipients.includes(r.familyId)).map((r) => r.team[staffId]).filter((x): x is number => typeof x === 'number');
    if (!vals.length) continue;
    const t = sum(vals);
    total += t;
    n += vals.length;
    surveys.push({ id: sv.id, title: sv.title, avg: Math.round((t / vals.length) * 10) / 10, n: vals.length });
  }
  return n ? { avg: Math.round((total / n) * 10) / 10, n, surveys } : null;
}

// ---------- staff records ----------
export const STAFF_ROLES: StaffRole[] = ['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt', 'housekeeping', 'driver'];
export const BANKS: Bank[] = ['BCA', 'Mandiri', 'BNI', 'BRI', 'Permata'];
export const CONTRACTS: StaffHr['contract'][] = ['pkwtt', 'pkwt'];
export const HR_NOTE_KINDS = ['warning', 'note', 'praise'] as const;
export const TIME_KINDS: StaffTime['kind'][] = ['worked', 'leave', 'sick', 'off'];
export const SOON_DAYS = 30;
export const ROLES_WITH_REQUESTS_HOME: StaffRole[] = ['housekeeping', 'driver'];

export type ContractState = { kind: 'permanent' } | { kind: 'ok' | 'soon' | 'ended'; days: number };
/** Fixed-term contracts end on `hr.end`: warn within 30 days, flag when over. */
export function contractState(hr: Pick<StaffHr, 'end'>, today: ISODate): ContractState {
  if (!hr.end) return { kind: 'permanent' };
  const days = diffDays(today, hr.end);
  return days < 0 ? { kind: 'ended', days: -days } : days <= SOON_DAYS ? { kind: 'soon', days } : { kind: 'ok', days };
}
/** Active staff first, then by name. */
export const staffList = (s: ClubState): Staff[] => sortBy(live(s.staff), (x) => (x.active ? '0' : '1') + x.name);
export const staffTimeId = (staffId: string, date: ISODate) => `st-${staffId}-${date}`;
export const minutesBetween = (from?: HM, to?: HM) => (from && to && to > from ? toMin(to) - toMin(from) : 0);
export const hoursLabel = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export function staffTimeFor(s: ClubState, staffId: string, month: YM) {
  const rows = sortBy(live(s.staffTime).filter((t) => t.staffId === staffId && t.date.startsWith(month)), (t) => t.date);
  return {
    rows,
    worked: rows.filter((r) => r.kind === 'worked').length,
    minutes: sum(rows.filter((r) => r.kind === 'worked').map((r) => minutesBetween(r.from, r.to))),
    leave: rows.filter((r) => r.kind === 'leave').length,
    sick: rows.filter((r) => r.kind === 'sick').length,
    off: rows.filter((r) => r.kind === 'off').length,
  };
}
/** Staff who sign in as this role (for "who is the nurse" lookups instead of fixed ids). */
export const staffWithRole = (s: ClubState, role: StaffRole) => staffList(s).filter((x) => x.active && x.role === role);

// ---------- overview ----------
/** Today's feed, newest first. */
export function liveToday(s: ClubState, today: ISODate, limit = 12): ActivityEntry[] {
  return sortBy(Object.values(s.activity).filter((a) => a.at.startsWith(today)), (a) => a.at + a.id, -1).slice(0, limit);
}
export interface ComingUpItem {
  id: string;
  kind: 'closed' | 'holiday' | 'outing' | 'venue' | 'trial' | 'visit';
  date: ISODate;
  time?: HM;
  /** Stored title (events, venue organisation, guest name). */
  title: string;
  titleId?: string;
}
/** What is next on the club calendar after today: closures, holidays, outings, private events, visits and trials. */
export function comingUp(s: ClubState, today: ISODate, limit = 6): ComingUpItem[] {
  const out: ComingUpItem[] = [];
  for (const e of live(s.calendarEvents)) {
    if (e.cancelledAt || (e.endDate || e.date) <= today) continue;
    out.push({ id: 'ev:' + e.id, kind: e.kind, date: e.date > today ? e.date : addDays(today, 1), time: e.from, title: e.title, titleId: e.titleId });
  }
  for (const v of live(s.venueBookings)) if (v.status === 'confirmed' && v.date > today) out.push({ id: 'vn:' + v.id, kind: 'venue', date: v.date, time: v.from, title: v.org });
  for (const g of live(s.guestVisits)) if (g.status === 'booked' && g.date > today) out.push({ id: 'g:' + g.id, kind: g.kind, date: g.date, time: g.time, title: g.name });
  return sortBy(out, (x) => x.date + (x.time || '00:00') + x.id).slice(0, limit);
}
export interface FamilyRequest { id: string; kind: 'upgrade'; memberId: string; to: Plan; from: ISODate; createdAt: DT }
/** What families asked for lately: plan changes waiting to be applied. Newest first. (Families do not book days or ask for leave: members come on any open day.) */
export function familyRequests(s: ClubState, today: ISODate, limit = 8): FamilyRequest[] {
  const ok = (m: Member | undefined): m is Member => !!m && !m.deletedAt && !isPendingRow(m) && membershipStatus(m, today) !== 'ended';
  const out: FamilyRequest[] = [];
  for (const p of live(s.planChangeRequests)) {
    if (p.status !== 'pending' || !ok(s.members[p.memberId])) continue;
    out.push({ id: 'plan:' + p.id, kind: 'upgrade', memberId: p.memberId, to: p.to, from: p.from, createdAt: p.createdAt });
  }
  return sortBy(out, (r) => r.createdAt + r.id, -1).slice(0, limit);
}
export interface OverviewStats {
  members: number; staff: number; inClub: number; goneHome: number; visits: number; extraVisits: number; checks: number; flagged: number; overdue: number; enquiries: number; reviews: number;
  survey: { avg: number; n: number } | null; photos: number; logsSaved: number; logsTotal: number; lunchPhoto: boolean; payments: number; stock: number; venues: number; samplePrices: boolean;
}
/** Every number on the overview tiles, computed from the club's own data (an empty clubhouse gives zeros). */
export function overviewStats(s: ClubState, today: ISODate): OverviewStats {
  const g = lobbyGroups(s, today);
  const checks = validReadings(s).filter((r) => r.date === today && r.kind !== 'monthly');
  const sv = liveSurvey(s);
  const st = sv ? surveyStats(s, sv) : null;
  const price = priceOn(s, today);
  return {
    members: approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended').length,
    staff: live(s.staff).filter((x) => x.active).length,
    inClub: g.inClub.length,
    goneHome: g.goneHome.length,
    visits: g.inClub.length + g.goneHome.length, // members who checked in today
    extraVisits: sum(approvedMembers(s).filter((m) => membershipStatus(m, today) !== 'ended').map((m) => flexMonth(s, m, ym(today), today).extra)), // Flex visits beyond the quota this month, billed next month
    checks: checks.length,
    flagged: checks.filter((r) => r.status !== 'normal').length,
    overdue: live(s.invoices).filter((i) => invoiceStatus(s, i, today) === 'overdue').length,
    enquiries: openEnquiries(s).length,
    reviews: approvalTotal(s) - pendingItems(s, 'stock').length, // waiting in Approvals (stock has its own tile)
    survey: st && st.overallN ? { avg: st.overall, n: st.overallN } : null,
    photos: live(s.photos).filter((p) => p.date === today && p.visibility === 'visible' && p.kind !== 'arrival').length,
    logsSaved: live(s.dailyLogs).filter((l) => l.date === today && l.status === 'saved' && l.mood !== undefined).length, // round 7: complete once the Mood & notes round is in
    logsTotal: g.inClub.length + g.goneHome.length, // a log for everyone who visited today
    lunchPhoto: lunchPhotoIds(s, today).length > 0,
    payments: live(s.payments).filter((p) => p.receivedOn === today).length,
    stock: live(s.stockRequests).filter((k) => k.status === 'requested').length,
    venues: live(s.venueBookings).filter((v) => v.status === 'confirmed' && v.date >= today).length,
    samplePrices: !!price && Object.values(price.sample).some(Boolean),
  };
}

// ---------- plans and pricing ----------
/** Prices (and the Flex visits rule) as typed on the Plans screen but not saved yet. */
export interface PriceDraft { flex: number; gold: number; extra: number; registration?: number; trial?: number; leave?: number; from: ISODate; flexQuota?: number }
/** The period the next invoice run bills: this month's if it hasn't run yet, else next month's. */
export const nextRunPeriod = (s: ClubState, today: ISODate): YM => (runDone(s, ym(today)) ? addMonths(ym(today), 1) : ym(today));
export interface InvoicePreview { period: YM; issueDate: ISODate; member: Member; payer?: FamilyContact; lines: InvoiceLine[]; total: number; others: { member: Member; total: number }[] }
/** What the next invoice for a member would be, optionally with prices not saved yet. */
export function invoicePreview(s: ClubState, memberId: string, draft: PriceDraft | null, today: ISODate): InvoicePreview | null {
  const m = s.members[memberId];
  if (!m || m.deletedAt || isPendingRow(m)) return null;
  const period = nextRunPeriod(s, today);
  const st: ClubState = draft
    ? {
        ...s,
        prices: { ...s.prices, __draft: { id: '__draft', clubId: s.clubId, createdAt: '', createdBy: 'system', from: draft.from, flex: draft.flex, gold: draft.gold, extra: draft.extra, registration: draft.registration ?? feeOf(priceOn(s, draft.from), 'registration'), trial: draft.trial ?? feeOf(priceOn(s, draft.from), 'trial'), leave: draft.leave ?? feeOf(priceOn(s, draft.from), 'leave'), sample: { flex: false, gold: false, extra: false } } },
        club: draft.flexQuota ? { ...s.club, settings: { ...s.club.settings, flexQuota: draft.flexQuota } } : s.club,
      }
    : s;
  const lines = runLinesFor(st, m, period, today);
  const payer = primaryContact(st, m.id);
  const others = payer
    ? approvedMembers(st)
        .filter((o) => o.id !== m.id && membershipStatus(o, today) !== 'ended' && primaryContact(st, o.id)?.id === payer.id)
        .map((o) => ({ member: o, total: sum(runLinesFor(st, o, period, today).map((l) => l.amount)) }))
        .filter((o) => o.total > 0)
    : [];
  const issue = `${period}-${String(s.club.settings.issueDay).padStart(2, '0')}`;
  return { period, issueDate: issue, member: m, payer, lines, total: sum(lines.map((l) => l.amount)), others };
}
