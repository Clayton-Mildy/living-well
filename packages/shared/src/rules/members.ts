// Members: lifecycle status, list rows, filters and search, id allocation, documents and consent, validation,
// pending reviews and the final invoice. Members drop in on any open day, so there are no bookings, leave or "expected" days here:
// status comes from check-ins, and the Flex plan counts visits. Pure selectors shared by the actions and the screens.
import type {
  ChangeRequest, ClubState, Consent, DocType, Diet, DrugAllergy, FoodAllergen, FamilyContact, Health, HM, ISODate, Invoice, InvoiceLine, Member, MemberDocument,
  Mobility, MedTiming, Photo, Plan, Reading, Relation, Row, Title, YM,
} from '../types';
import { addDays, addMonths, ageOn, daysInMonth, diffDays, dow, e164, isWeekday, live, parseDate, sortBy, sum, ym } from '../util';
import { currentMembership, isOpen, isPendingRow, linksOfMember, membershipStatus, memberSince, memberName, planOn, primaryContact } from './core';
import { attOf, extraDaysFor } from './attendance';
import { invoiceStatus, invoicesOf, issueDateOf, nextInvoiceNumber, priceOn, balanceOf, suspensions, type Suspension } from './billing';
import { onLeaveOn } from './leave';
import { latestBp } from './health';

// ---------- option lists ----------
export const TITLES: Title[] = ['Oma', 'Opa', 'Ibu', 'Bapak'];
export const RELATIONS: Relation[] = ['daughter', 'son', 'daughterInLaw', 'sonInLaw', 'granddaughter', 'grandson', 'spouse', 'sibling', 'other'];
export const FOODS: FoodAllergen[] = ['shellfish', 'seafood', 'fish', 'peanuts', 'eggs', 'dairy', 'gluten'];
export const DRUGS = ['penicillin', 'sulfa', 'aspirin', 'ibuprofen'] as const;
export const MOBILITIES: Mobility[] = ['walkingStick', 'walker', 'wheelchair'];
export const DIETS: Diet[] = ['softFood', 'lowSalt', 'vegetarian', 'sugarFree'];
export const MED_TIMINGS: MedTiming[] = ['morningHome', 'lunchClub', 'eveningHome', 'asPrescribed'];
export const END_REASONS = ['movedAway', 'careNeeds', 'careHome', 'passedAway', 'familyDecision'] as const;
export const DOC_TYPES: DocType[] = ['ktp', 'nannyKtp', 'membershipForm', 'healthInfo'];
export const NEW_TAG_DAYS = 30;
/** Simulated PC-303 baseline for a newly added member (design: new-member base). */
export const DEFAULT_SIM = { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 110, weight: 58, temp: 36.6, grip: 18 };
export const SIM_FILE: Record<DocType, string> = { ktp: 'ktp.jpg', nannyKtp: 'ktp-nanny.jpg', membershipForm: 'membership-form.pdf', healthInfo: 'health-info.jpg', other: 'document.pdf' };
const DOC_SHORT: Record<DocType, string> = { ktp: 'ktp', nannyKtp: 'nktp', membershipForm: 'form', healthInfo: 'health', other: 'other' };
export const docIdFor = (memberId: string, type: DocType) => `${memberId}-doc-${DOC_SHORT[type]}`;

// ---------- small validators ----------
export const isHM = (v: unknown): v is HM => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isISO = (v: unknown): v is ISODate => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = parseDate(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
export const isPhone = (v: string) => /^\+\d{8,15}$/.test(v);
export const firstOfNextMonth = (d: ISODate): ISODate => `${addMonths(ym(d), 1)}-01`;
/** The Monday after `d` (design firstMonday: tomorrow onwards). */
export const nextMonday = (d: ISODate): ISODate => {
  let x = addDays(d, 1);
  while (dow(x) !== 1) x = addDays(x, 1);
  return x;
};
export const firstWord = (n: string) => n.trim().split(/\s+/)[0] || '';
/** "Siu Lan Tjandra" -> first "Siu Lan", last "Tjandra" (design applyDraft). */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: parts[0] || '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
/** The name as typed in forms (without title). */
export const plainName = (m: Pick<Member, 'firstName' | 'lastName'>) => (m.firstName === m.lastName || !m.lastName ? m.firstName : `${m.firstName} ${m.lastName}`);
export const genderOf = (t: Title): 'f' | 'm' => (t === 'Oma' || t === 'Ibu' ? 'f' : 'm');

// ---------- ids ----------
const numOf = (id: string, re: RegExp) => { const x = re.exec(id); return x ? Number(x[1]) : 0; };
/** Next member id: m<max+1>, deterministic for a given state. */
export const nextMemberNumber = (s: { members: Record<string, unknown> }) => Object.keys(s.members).reduce((mx, id) => Math.max(mx, numOf(id, /^m(\d+)$/)), 0) + 1;
export const nextMemberId = (s: { members: Record<string, unknown> }) => `m${nextMemberNumber(s)}`;
/** The member id the last create produced (highest m<n>). */
export const lastMemberId = (s: { members: Record<string, unknown> }) => `m${nextMemberNumber(s) - 1}`;
const contactBase = (memberId: string) => `fm${memberId.replace(/^m/, '')}`;
/** Next free contact id for a member: fm<n>_<k>. */
export function nextContactId(s: { familyContacts: Record<string, unknown> }, memberId: string) {
  const base = contactBase(memberId);
  let k = 0;
  while (s.familyContacts[`${base}_${k}`]) k++;
  return `${base}_${k}`;
}
/** The contact id the last addContact produced for a member. */
export function lastContactId(s: { familyContacts: Record<string, unknown> }, memberId: string) {
  const base = contactBase(memberId);
  let k = 0;
  while (s.familyContacts[`${base}_${k + 1}`]) k++;
  return `${base}_${k}`;
}
export const linkId = (familyId: string, memberId: string) => `${familyId}:${memberId}`;
/** Free link id for a pair (an unlinked pair keeps its soft-deleted row, so a re-link gets a suffix). */
export function nextLinkId(s: { familyLinks: Record<string, unknown> }, familyId: string, memberId: string) {
  const base = linkId(familyId, memberId);
  if (!s.familyLinks[base]) return base;
  let n = 2;
  while (s.familyLinks[`${base}#${n}`]) n++;
  return `${base}#${n}`;
}
export function lastLinkId(s: { familyLinks: Record<string, unknown> }, familyId: string, memberId: string) {
  const base = linkId(familyId, memberId);
  let n = 1;
  let id = base;
  while (s.familyLinks[`${base}#${n + 1}`]) { n++; id = `${base}#${n}`; }
  return id;
}
export const vaFor = (idx: number) => '8808' + String(1203440000 + idx * 7919).padStart(12, '0');
export const formatVa = (va: string) => va.replace(/(\d{4})(?=\d)/g, '$1 ');

// ---------- status ----------
/** Where the member is today. Nobody is "expected": a member who has not checked in simply is not here (yet), and may drop in on any open day. */
export type MemberStatus =
  | { key: 'pending' }
  | { key: 'ended'; on: ISODate }
  | { key: 'upcoming'; on: ISODate }
  | { key: 'home'; at: HM }
  | { key: 'in'; at: HM }
  | { key: 'closed' }
  /** not checked in today; `usual` is the informational usual arrival time ("Usually arrives around 10:05"), when one is on file */
  | { key: 'off'; usual?: HM };

export function memberStatus(s: ClubState, m: Member, today: ISODate): MemberStatus {
  if (isPendingRow(m)) return { key: 'pending' };
  const life = membershipStatus(m, today);
  if (life === 'ended') return { key: 'ended', on: currentMembership(m)?.lastDay || today };
  if (life === 'upcoming') return { key: 'upcoming', on: currentMembership(m).start };
  const a = attOf(s, today, m.id);
  if (a?.checkOut) return { key: 'home', at: a.checkOut.at };
  if (a?.checkIn) return { key: 'in', at: a.checkIn.at };
  if (!isOpen(s, today)) return { key: 'closed' };
  return { key: 'off', ...(m.usualArrival ? { usual: m.usualArrival } : {}) };
}
/** Scheduled last day when the membership is ending (still active until then). */
export const endingOn = (m: Member, today: ISODate): ISODate | undefined => (membershipStatus(m, today) === 'ending' ? currentMembership(m).lastDay : undefined);
export const isNewMember = (m: Member, today: ISODate) => {
  const since = memberSince(m);
  return !!since && diffDays(since, today) < NEW_TAG_DAYS;
};
export const isEndedMember = (m: Member, today: ISODate) => membershipStatus(m, today) === 'ended';

// ---------- subscription period ----------
// Subscriptions are month to month: each month's end the family continues, upgrades, downgrades or freezes. So a running membership "renews" at the
// end of the current month; a membership with a last day "ends" then (or "ended" when that day has passed).
export type SubEndKind = 'renews' | 'ends' | 'ended';
/** When the current subscription started (the current membership's first day). */
export const subStart = (m: Member): ISODate | undefined => currentMembership(m)?.start;
/** The end of the current subscription period: its last day when set, otherwise the last day of this month (of the start month when it has not started yet). */
export function subEnd(m: Member, today: ISODate): { on: ISODate; kind: SubEndKind } | undefined {
  const cur = currentMembership(m);
  if (!cur) return undefined;
  if (cur.lastDay) return { on: cur.lastDay, kind: cur.lastDay < today ? 'ended' : 'ends' };
  const p = ym(cur.start > today ? cur.start : today);
  return { on: `${p}-${String(daysInMonth(p)).padStart(2, '0')}`, kind: 'renews' };
}

// ---------- list rows, filters, search ----------
export type MemberFilter = 'active' | 'in' | 'att' | 'flex' | 'gold' | 'ended';
export const MEMBER_FILTERS: MemberFilter[] = ['active', 'in', 'att', 'flex', 'gold', 'ended'];
export interface MemberRow {
  m: Member;
  st: MemberStatus;
  pending: boolean;
  ended: boolean;
  endsOn?: ISODate;
  /** current subscription start and period end (undefined for a pending new member) */
  subStart?: ISODate;
  subEnd?: { on: ISODate; kind: SubEndKind };
  isNew: boolean;
  plan: Plan;
  lr?: Reading;
  hs: Health | null;
  od: boolean;
  /** KC round 6 (the brochure's terms): on hold for an unpaid invoice, or in a month of leave */
  sus?: Suspension;
  leave?: YM;
  /** the latest day up to today the member checked in (today included); undefined when they never have */
  lastVisit?: ISODate;
}
/** The latest check-in day (on or before `today`) of every member, in one pass over the attendance rows. */
export function lastVisits(s: ClubState, today: ISODate): Record<string, ISODate> {
  const out: Record<string, ISODate> = {};
  for (const a of live(s.attendance)) if (a.checkIn && a.date <= today && (!out[a.memberId] || a.date > out[a.memberId])) out[a.memberId] = a.date;
  return out;
}
export function memberRows(s: ClubState, today: ISODate): MemberRow[] {
  const overdue = new Set(live(s.invoices).filter((i) => invoiceStatus(s, i, today) === 'overdue').map((i) => i.memberId));
  const hold = suspensions(s, today);
  const last = lastVisits(s, today);
  return sortBy(
    live(s.members).filter((m) => !isPendingRow(m) || m.review?.status === 'pending'),
    (m) => m.firstName + m.lastName,
  ).map((m) => {
    const lr = latestBp(s, m.id);
    const pending = isPendingRow(m);
    return { m, st: memberStatus(s, m, today), pending, ended: !pending && isEndedMember(m, today), endsOn: pending ? undefined : endingOn(m, today), ...(pending ? {} : { subStart: subStart(m), subEnd: subEnd(m, today) }), isNew: isNewMember(m, today), plan: planOn(m, today).plan, lr, hs: lr && lr.status !== 'normal' ? lr.status : null, od: overdue.has(m.id), ...(hold[m.id] ? { sus: hold[m.id] } : {}), ...(!pending && onLeaveOn(m, today) ? { leave: ym(today) } : {}), ...(last[m.id] ? { lastVisit: last[m.id] } : {}) };
  });
}
export const FILTERS: Record<MemberFilter, (r: MemberRow) => boolean> = {
  active: (r) => !r.ended,
  in: (r) => r.st.key === 'in',
  att: (r) => !r.ended && !r.pending && !!(r.hs || r.od || r.sus),
  flex: (r) => !r.ended && r.plan === 'flex',
  gold: (r) => !r.ended && r.plan === 'gold',
  ended: (r) => r.ended,
};
export type MemberSort = 'name' | 'startNew' | 'startOld' | 'endSoon';
export const MEMBER_SORTS: MemberSort[] = ['name', 'startNew', 'startOld', 'endSoon'];
/** Sort list rows (rows arrive by name; ties and rows without dates, e.g. pending ones, keep that order, dateless last). */
export function sortMemberRows(rows: MemberRow[], by: MemberSort): MemberRow[] {
  if (by === 'name') return rows;
  const key = (r: MemberRow) => (by === 'endSoon' ? r.subEnd?.on : r.subStart);
  const dir = by === 'startNew' ? -1 : 1;
  return rows.map((r, i) => ({ r, i, k: key(r) })).sort((a, b) => {
    if (a.k === b.k) return a.i - b.i;
    if (a.k === undefined) return 1;
    if (b.k === undefined) return -1;
    return a.k < b.k ? -dir : dir;
  }).map((x) => x.r);
}
export const filterCounts =(rows: MemberRow[]) => Object.fromEntries(MEMBER_FILTERS.map((f) => [f, rows.filter(FILTERS[f]).length])) as Record<MemberFilter, number>;

const digitsVariants = (q: string): string[] => {
  const d = q.replace(/\D/g, '');
  if (d.length < 3) return [];
  const out = new Set([d]);
  if (d.startsWith('0')) out.add(d.slice(1));
  if (d.startsWith('62')) out.add(d.slice(2));
  return [...out];
};
/** Text a member matches on: name plus the names and phone numbers of their family contacts. */
export function memberSearchBlob(s: ClubState, m: Member) {
  const fams = linksOfMember(s, m.id).map((l) => s.familyContacts[l.familyId]).filter((c): c is FamilyContact => !!c && !c.deletedAt);
  return { text: [memberName(m), m.firstName, m.lastName, ...fams.map((c) => c.name)].join(' ').toLowerCase(), phones: fams.map((c) => c.phone.replace(/\D/g, '')) };
}
export function matchesQuery(s: ClubState, m: Member, q: string): boolean {
  const query = q.toLowerCase().trim();
  if (!query) return true;
  const b = memberSearchBlob(s, m);
  if (b.text.includes(query)) return true;
  const dv = digitsVariants(query);
  return dv.length > 0 && b.phones.some((p) => dv.some((x) => p.includes(x)));
}

// ---------- documents and consent ----------
export const consentOf = (m: Member, kind: Consent['kind']): Consent | undefined => m.consents.find((c) => c.kind === kind);
/** Face recognition is on unless the member (or family) opted out. */
export const faceConsent = (m: Member) => consentOf(m, 'face')?.granted !== false;
/** The door camera may recognise this member: consent given and a face enrolled. */
export const faceReady = (m: Member) => faceConsent(m) && m.face.enrolled;
export const docOf = (m: Member, type: DocType): MemberDocument | undefined => m.documents.find((d) => d.type === type);
export function documentTypes(m: Pick<Member, 'nanny'>): DocType[] {
  return DOC_TYPES.filter((t) => t !== 'nannyKtp' || !!m.nanny);
}

// ---------- reviews ----------
export type ProfileTab = 'overview' | 'health' | 'care' | 'photos' | 'att' | 'docs' | 'plan' | 'family' | 'notes' | 'history';
export const PROFILE_TABS: ProfileTab[] = ['overview', 'health', 'care', 'photos', 'att', 'docs', 'plan', 'family', 'notes', 'history'];
/** The profile tab that shows a given review section. */
export const tabForSection = (section: ChangeRequest['section']): ProfileTab =>
  ({ newMember: 'overview', conversion: 'overview', details: 'overview', plan: 'plan', docsConsent: 'docs', family: 'family', allergies: 'health', medicines: 'health', care: 'health' } as const)[section];
export const pendingReviewsFor = (s: ClubState, memberId: string): ChangeRequest[] =>
  sortBy(live(s.changeRequests).filter((c) => c.status === 'pending' && c.target.memberId === memberId), (c) => c.createdAt, -1);
export const allPendingReviews = (s: ClubState) => sortBy(live(s.changeRequests).filter((c) => c.status === 'pending' && c.kind === 'approval'), (c) => c.createdAt, -1);
export const appliedReviews = (s: ClubState) => sortBy(live(s.changeRequests).filter((c) => c.status === 'pending' && c.kind === 'postReview'), (c) => c.createdAt, -1);
export const handledReviews = (s: ClubState) => sortBy(live(s.changeRequests).filter((c) => c.status !== 'pending'), (c) => c.reviewedAt || c.createdAt, -1);

// ---------- photo review ----------
/** Photos waiting for management's approval (taken by non-management staff; families never see them). Newest first. */
export const pendingPhotos = (s: ClubState): Photo[] => sortBy(live(s.photos).filter((p) => p.visibility === 'pending'), (p) => p.createdAt + p.id, -1);
export const pendingPhotoCount = (s: ClubState): number => pendingPhotos(s).length;
/** What a pending photo is, for the review grid: a lunch photo, a group photo, the door-camera arrival photo, an activity picture (of a session, no members), or a photo of one member. */
export type PhotoReviewKind = 'lunch' | 'group' | 'arrival' | 'activity' | 'solo';
export const photoReviewKind = (p: Pick<Photo, 'kind'>): PhotoReviewKind => (p.kind === 'lunch' || p.kind === 'group' || p.kind === 'arrival' || p.kind === 'activity' ? p.kind : 'solo');

// ---------- final invoice (ending a membership) ----------
// Flex visits beyond the monthly quota are extra days, normally billed on the next month's invoice. When a membership is ended, the extra days that
// no invoice has billed yet go on a final invoice (by date, so the finance run never bills one twice). Open invoices stay payable as they are.
/** Extra-day dates that already sit on an invoice that is not void. */
export const billedExtraDates = (s: ClubState, memberId: string): Set<ISODate> =>
  new Set(live(s.invoices).filter((i) => i.memberId === memberId && !i.voided).flatMap((i) => i.lines.filter((l) => l.kind === 'extraDay').flatMap((l) => l.dates || [])));
/** Months that may hold extra days no invoice has billed yet: from the month before the last invoice run to the month of the last day. */
export function unbilledExtraMonths(s: ClubState, m: Member, lastDay: ISODate): YM[] {
  const runs = live(s.invoiceRuns).map((r) => r.period).sort();
  const first = ym(currentMembership(m)?.start || lastDay);
  const from = runs.length ? addMonths(runs[runs.length - 1], -1) : first;
  const out: YM[] = [];
  for (let p = from < first ? first : from; p <= ym(lastDay) && out.length < 24; p = addMonths(p, 1)) out.push(p);
  return out;
}
/** Final invoice lines: the extra visits (Flex visits beyond the quota) up to the last day that no invoice has billed yet. */
export function finalInvoiceLines(s: ClubState, m: Member, lastDay: ISODate, today: ISODate): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const done = billedExtraDates(s, m.id);
  for (const p of unbilledExtraMonths(s, m, lastDay)) {
    const extra = extraDaysFor(s, m, p, today).filter((d) => d <= lastDay && !done.has(d));
    if (!extra.length) continue;
    const unit = priceOn(s, issueDateOf(s, p)).extra;
    lines.push({ id: `extra-${p}`, kind: 'extraDay', label: 'inv.line.extra', params: { month: p, n: extra.length }, qty: extra.length, unit, amount: extra.length * unit, refMonth: p, dates: extra });
  }
  return lines;
}
export function finalInvoiceNumber(s: ClubState, memberId: string, today: ISODate) {
  const base = `${nextInvoiceNumber(s, ym(today), memberId)}-F`;
  let n = 1;
  let num = base;
  const have = new Set(Object.values(s.invoices).map((i) => i.number));
  while (have.has(num)) num = `${base}${++n}`;
  return num;
}
/** Total still to pay across a member's open invoices. */
export const openBalance = (s: ClubState, memberId: string, today: ISODate) =>
  sum(invoicesOf(s, memberId).filter((i) => ['outstanding', 'overdue', 'partial'].includes(invoiceStatus(s, i, today))).map((i) => balanceOf(s, i)));

/** The invoice a membership ending would create (null when there is nothing to bill). Used by the action and the end dialog. */
export function finalInvoiceFor(s: ClubState, m: Member, lastDay: ISODate, today: ISODate): Omit<Invoice, keyof Row> | null {
  const lines = finalInvoiceLines(s, m, lastDay, today);
  if (!lines.length) return null;
  const issue = today;
  return {
    number: finalInvoiceNumber(s, m.id, today), memberId: m.id, payerFamilyId: primaryContact(s, m.id)?.id || '', kind: 'final', issueDate: issue,
    dueDate: addDays(lastDay > issue ? lastDay : issue, s.club.settings.finalDueDays), lines, va: m.billing.va, xero: 'draft', reminders: [], callNotes: [],
  };
}

// ---------- validation ----------
export interface FieldIssue { field: string; code: string; params?: Record<string, string | number> }
export interface NewMemberInput {
  title: Title;
  name: string;
  dob: ISODate;
  address: string;
  /** informational only (members drop in on any open day); '' when not given */
  usualArrival: HM | '';
  nanny: { name: string; phone?: string } | null;
  spouseId: string | null;
  /** profile picture, uploaded first (POST /api/media) */
  photoMediaId?: string;
  plan: Plan;
  start: ISODate;
  contact: { existingId?: string; name: string; phone: string; relation: Relation; primary: boolean };
  health: { conditions: string[]; diabetic: boolean; food: FoodAllergen[]; foodOther: string; drugs: DrugAllergy[]; mobility: Mobility | null; diet: Diet[]; meds: { name: string; dose: string; timing: MedTiming }[] };
  careInstructions: string;
  docs: DocType[];
  /** The signed paper registration form (photo or PDF uploaded first, POST /api/media): required. */
  formMediaId: string;
  formFileName: string;
  consent: { data: boolean; face: boolean };
  note?: string;
}
export const ageRange = { min: 18, max: 120 };
/** Field-level problems for the add-member form. Without `today` (action parse) the checks that need the clock are skipped. */
export function validateNewMember(d: Partial<NewMemberInput>, today?: ISODate): FieldIssue[] {
  const out: FieldIssue[] = [];
  const bad = (field: string, code: string, params?: Record<string, string | number>) => out.push({ field, code: `members.err.${code}`, params });
  if (!d.name || d.name.trim().length < 2) bad('name', 'nameRequired');
  if (!d.dob) bad('dob', 'dobRequired');
  else if (!isISO(d.dob) || (today && d.dob > today)) bad('dob', 'dobInvalid');
  else if (today) { const a = ageOn(d.dob, today); if (a < ageRange.min || a > ageRange.max) bad('dob', 'dobInvalid'); }
  if (d.usualArrival && !isHM(d.usualArrival)) bad('usualArrival', 'arrivalInvalid');
  if (d.plan !== 'flex' && d.plan !== 'gold') bad('plan', 'planInvalid');
  if (!isISO(d.start) || (today && (d.start as string) < today)) bad('start', 'startInvalid');
  else if (!isWeekday(d.start as string)) bad('start', 'startInvalid');
  const c = d.contact;
  if (!c) bad('contact', 'contactRequired');
  else if (!c.existingId) {
    if (!c.name || c.name.trim().length < 2) bad('contactName', 'contactRequired');
    if (!c.phone || !c.phone.trim()) bad('phone', 'phoneRequired');
    else if (!isPhone(e164(c.phone))) bad('phone', 'phoneInvalid');
  }
  if (!d.formMediaId) bad('form', 'formRequired');
  if (!d.consent?.data) bad('consentData', 'consentRequired');
  for (const med of d.health?.meds || []) if (!med.name?.trim()) { bad('meds', 'medNameRequired'); break; }
  if (d.nanny && !d.nanny.name?.trim()) bad('nannyName', 'nannyNameRequired');
  return out;
}
