// Enquiries (leads): stages, visit/trial day rules, and the lead -> member mapping.
// Registration is on paper: staff type the key details from the signed paper form and attach a photo or PDF of it when the lead joins.
import type {
  Actor, ClubState, Consent, DT, Diet, Enquiry, FamilyContact, FamilyLink, FoodAllergen, GuestVisit, HM, ISODate, Member, MemberDocument,
  Mobility, Plan, Relation, Title,
} from '../types';
import { dow, e164, live, sortBy, toMin } from '../util';
import { dayStatus, nextOpenDay } from './core';

// ---------- constants ----------
export const ENQ_STAGES = ['new', 'visit', 'trial', 'joined', 'lost'] as const;
export type EnqStage = Enquiry['stage'];
export const OPEN_STAGES: EnqStage[] = ['new', 'visit', 'trial'];
export const ENQ_SOURCES: Enquiry['source'][] = ['referral', 'instagram', 'website', 'walkIn', 'other'];
export const LOST_REASONS = ['price', 'distance', 'notReady', 'otherPlace', 'health', 'other'] as const;
export const TITLES: Title[] = ['Oma', 'Opa', 'Ibu', 'Bapak'];
export const ALL_RELATIONS: Relation[] = ['daughter', 'son', 'daughterInLaw', 'sonInLaw', 'granddaughter', 'grandson', 'grandchild', 'spouse', 'sibling', 'other'];
export const FOODS: FoodAllergen[] = ['shellfish', 'seafood', 'fish', 'peanuts', 'eggs', 'dairy', 'gluten'];
export const DRUGS = ['penicillin', 'sulfa', 'aspirin', 'ibuprofen'] as const;
export const MOBILITIES: Mobility[] = ['walkingStick', 'walker', 'wheelchair'];
export const DIETS: Diet[] = ['softFood', 'lowSalt', 'vegetarian', 'sugarFree'];
export const isFemaleTitle = (t: Title) => t === 'Oma' || t === 'Ibu';

// ---------- leads ----------
export const isOpenStage = (s: EnqStage) => OPEN_STAGES.includes(s);
// a trial is a day pass with no booked time: it sorts at the start of its day
const nextKey = (e: Enquiry) => (e.next?.date ?? '9999-12-31') + ' ' + (e.next?.time ?? (e.next?.kind === 'trial' ? '00:00' : '99:99'));
/** Leads on the board (not archived), per stage: open stages by next step, joined/lost newest first. */
export function enquiriesByStage(s: ClubState): Record<EnqStage, Enquiry[]> {
  const all = live(s.enquiries).filter((e) => !e.archivedAt);
  const out = { new: [], visit: [], trial: [], joined: [], lost: [] } as Record<EnqStage, Enquiry[]>;
  for (const st of ENQ_STAGES) {
    const list = all.filter((e) => e.stage === st);
    out[st] = isOpenStage(st) ? sortBy(list, (e) => nextKey(e) + e.createdAt) : sortBy(list, (e) => e.createdAt, -1);
  }
  return out;
}
export const archivedEnquiries = (s: ClubState) => sortBy(live(s.enquiries).filter((e) => !!e.archivedAt), (e) => e.archivedAt || '', -1);
export const openEnquiries = (s: ClubState) => sortBy(live(s.enquiries).filter((e) => !e.archivedAt && isOpenStage(e.stage)), (e) => nextKey(e) + e.createdAt);
export const seniorName = (e: Pick<Enquiry, 'senior'>) => `${e.senior.title} ${e.senior.name}`;

// ---------- guests (visits and trials) ----------
export const guestsOfEnquiry = (s: ClubState, enquiryId: string) => sortBy(live(s.guestVisits).filter((g) => g.enquiryId === enquiryId && g.status !== 'cancelled'), (g) => g.date + g.time);
/** The booked (not yet arrived) visit or trial of a lead. */
export const openGuest = (s: ClubState, enquiryId: string, kind: GuestVisit['kind']) =>
  live(s.guestVisits).find((g) => g.enquiryId === enquiryId && g.kind === kind && g.status === 'booked' && !g.checkIn);

export type DayCheck = { ok: true } | { ok: false; code: string; params?: Record<string, string | number> };
/**
 * Can a visit be booked on `date` at `time`, or a trial on `date`? Trials need a day's notice and have no time (a trial is a day pass with lunch and the health check);
 * closed days, holidays, weekends and outings are blocked.
 */
export function bookingDayCheck(s: ClubState, kind: 'visit' | 'trial', date: ISODate, time: HM | undefined, today: ISODate, now: HM): DayCheck {
  if (kind === 'trial' ? date <= today : date < today) return { ok: false, code: kind === 'trial' ? 'enq.err.tooSoon' : 'enq.err.past' };
  if (kind === 'visit' && time && date === today && time < now) return { ok: false, code: 'enq.err.pastTime' };
  const st = dayStatus(s, date);
  if (!st.open) return { ok: false, code: 'err.closedDay' };
  if (st.outing) return { ok: false, code: 'enq.err.outing' };
  if (kind === 'trial') return { ok: true };
  const { open, close } = s.club.settings;
  if (!time || toMin(time) < toMin(open) || toMin(time) >= toMin(close)) return { ok: false, code: 'enq.err.hours', params: { open, close } };
  return { ok: true };
}
/** The next `n` days the club is open and an outing doesn't take the members away, from `from` (inclusive). */
export function bookableDays(s: ClubState, from: ISODate, n: number): ISODate[] {
  const out: ISODate[] = [];
  let d = nextOpenDay(s, from, true);
  for (let i = 0; i < 80 && out.length < n; i++) {
    const st = dayStatus(s, d);
    if (st.open && !st.outing) out.push(d);
    d = nextOpenDay(s, d);
  }
  return out;
}
/** Open Mondays after `from` (membership start choices). */
export function startMondays(s: ClubState, from: ISODate, n: number): ISODate[] {
  const out: ISODate[] = [];
  let d = from;
  for (let i = 0; i < 120 && out.length < n; i++) {
    d = nextOpenDay(s, d);
    if (dow(d) === 1) out.push(d);
  }
  return out;
}

/** "Siu Lan Tjandra" -> first "Siu Lan", last "Tjandra"; a single name is both. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return { first: parts.slice(0, -1).join(' ') || last, last };
}

/** The signed paper registration form a lead joins with: the uploaded photo or PDF (`mediaId`) and its file name. */
export interface PaperForm { mediaId: string; fileName: string }
/** The document row for a member's signed registration form (typed in by staff from the paper, so `via` is 'staff'). */
export const paperFormDoc = (memberId: string, f: PaperForm, on: ISODate, by: Actor): MemberDocument =>
  ({ id: `${memberId}-doc-form`, type: 'membershipForm', status: 'onFile', mediaId: f.mediaId, fileName: f.fileName, on, via: 'staff', by });
/** Does this member document have an uploaded file behind it (rather than a paper copy kept at the club)? */
export const docHasFile = (d: Pick<MemberDocument, 'mediaId'> | undefined | null) => !!d?.mediaId;

export interface LeadMemberArgs {
  id: string;
  contactId: string;
  enquiry: Enquiry;
  form: PaperForm;
  plan: Plan;
  start: ISODate;
  today: ISODate;
  nowDT: DT;
  actor: Actor;
  vaIndex: number;
  photoTone: number;
}
/** The lead's details become the new member record; the signed paper form is attached as the member's registration document. */
export function memberFromLead(a: LeadMemberArgs): Member {
  const { enquiry: e } = a;
  const title = e.senior.title;
  const { first, last } = splitName(e.senior.name);
  const documents: MemberDocument[] = [
    { id: `${a.id}-doc-ktp`, type: 'ktp', status: 'requested', on: a.today, by: a.actor },
    paperFormDoc(a.id, a.form, a.today, a.actor),
    { id: `${a.id}-doc-health`, type: 'healthInfo', status: 'requested', on: a.today, by: a.actor },
  ];
  const consents: Consent[] = [];
  return {
    id: a.id, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor,
    title, firstName: first, lastName: last, gender: isFemaleTitle(title) ? 'f' : 'm', dob: null, ageYears: null, address: null, photoTone: a.photoTone,
    memberships: [{ start: a.start }], plans: [{ from: a.start, plan: a.plan, by: a.actor }], usualArrival: '10:00', nanny: null, spouseId: null,
    health: {
      conditions: [], diabetic: false, food: [], drugs: [], mobility: null, diet: [], meds: [], cognitive: { summary: '' },
    },
    care: { instructions: '', by: a.actor, at: a.nowDT }, consents, documents, face: { enrolled: false },
    billing: { va: '8808' + String(1203440000 + a.vaIndex * 7919).padStart(12, '0') },
    sim: { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 110, weight: 58, temp: 36.6, grip: 18 },
  };
}
export function contactFromLead(a: { id: string; enquiry: Enquiry; nowDT: DT; actor: Actor; activated: boolean }): FamilyContact {
  const name = a.enquiry.contact.name;
  const ph = e164(a.enquiry.contact.phone);
  return { id: a.id, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor, name, firstName: name.split(' ')[0], phone: ph, ...(a.activated ? { activatedAt: a.nowDT } : {}) };
}
export function linkFromLead(a: { contactId: string; memberId: string; enquiry: Enquiry; nowDT: DT; actor: Actor }): FamilyLink {
  return {
    id: `${a.contactId}:${a.memberId}`, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor, familyId: a.contactId, memberId: a.memberId,
    relation: a.enquiry.contact.relation, primary: true, appAccess: true, healthAlerts: true,
  };
}
