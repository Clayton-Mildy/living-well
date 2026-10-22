// Enquiries (leads): stages, visit/trial day rules, and the lead -> member mapping.
// Registration is on paper: staff type the key details from the signed paper form and attach a photo or PDF of it when the lead joins.
import type {
  EnquiryForm, OnlineRegistration, KtpUploads,
  Actor, ClubState, Consent, DT, Diet, DrugAllergy, Enquiry, FamilyContact, FamilyLink, FoodAllergen, GuestVisit, HM, ISODate, LeadMove, LostReason, Member, MemberDocument,
  MemberRegistration, Mobility, Plan, Relation, Title, YM,
} from '../types';
import { addMonths, daysInMonth, dow, e164, live, sortBy, toMin, ym } from '../util';
import { currentMembership, dayStatus, isPendingRow, nextOpenDay } from './core';
import { genderOf, ktpDocuments } from './members';
import { ratingTokenOf } from './surveys';

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
export const isFemaleTitle = (t: Title) => genderOf(t) === 'f';

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

// ---------- lead history (round 13) ----------
/** A lead's moves, oldest first. A row from before the history reads as one `new` move at createdAt. */
export const leadHistory = (e: Pick<Enquiry, 'history' | 'createdAt' | 'createdBy'>): LeadMove[] => (e.history?.length ? e.history : [{ stage: 'new', at: e.createdAt, by: e.createdBy }]);
/** The day the lead was opened: the date of its first move. */
export const openedAt = (e: Pick<Enquiry, 'history' | 'createdAt' | 'createdBy'>): ISODate => leadHistory(e)[0].at.slice(0, 10);

export interface LeadFunnel {
  opened: number; visit: number; trial: number; joined: number; lost: number;
  lostReasons: Record<LostReason, number>;
  /** joined / opened (null when nothing was opened) */
  conversion: number | null;
  /** the cohort, oldest first */
  leads: Enquiry[];
}
/**
 * The lead funnel as a cohort: the leads opened between `from` and `to` (archived ones too) and how far each got, so no step ever exceeds the one before it.
 * "Visit" is a lead that reached a visit or went further, "trial" one that reached a trial or joined. Joined needs the lead to be a member now and approved (a join waiting
 * for management, rejected or withdrawn does not count); an undo move never counts as reaching a stage. Lost reasons are the lost leads' current reasons.
 */
export function leadFunnel(s: ClubState, from: ISODate, to: ISODate): LeadFunnel {
  const leads = sortBy(live(s.enquiries).filter((e) => { const d = openedAt(e); return d >= from && d <= to; }), (e) => leadHistory(e)[0].at);
  const out: LeadFunnel = { opened: leads.length, visit: 0, trial: 0, joined: 0, lost: 0, lostReasons: Object.fromEntries(LOST_REASONS.map((k) => [k, 0])) as Record<LostReason, number>, conversion: null, leads };
  for (const e of leads) {
    const m = e.memberId ? s.members[e.memberId] : undefined;
    const joined = e.stage === 'joined' && !!m && !m.deletedAt && !isPendingRow(m);
    const seen = new Set(leadHistory(e).filter((x) => !x.undo).map((x) => x.stage));
    const trial = joined || seen.has('trial');
    if (trial || seen.has('visit')) out.visit++;
    if (trial) out.trial++;
    if (joined) out.joined++;
    if (e.stage === 'lost') { out.lost++; if (e.lost) out.lostReasons[e.lost.reason]++; }
  }
  out.conversion = out.opened ? out.joined / out.opened : null;
  return out;
}
/** What happened in a period (round 13 ruling): per stage, the distinct leads with a (non-undo) move of that stage dated in the period. */
export interface LeadMoves {
  /** leads opened in the period (their first move) */
  opened: number; visit: number; trial: number;
  /** members who joined from a lead, by the day their membership starts (reconciles with the Members group's `joined`) */
  joined: number;
  /** leads with a lost move in the period, the reason read from that move */
  lost: number; lostReasons: Record<LostReason, number>;
  /** the leads opened in the period, oldest first */
  leads: Enquiry[];
}
export function leadMoves(s: ClubState, from: ISODate, to: ISODate): LeadMoves {
  const within = (d: ISODate | undefined) => !!d && d >= from && d <= to;
  const all = live(s.enquiries);
  const out: LeadMoves = {
    opened: 0, visit: 0, trial: 0, joined: 0, lost: 0, lostReasons: Object.fromEntries(LOST_REASONS.map((k) => [k, 0])) as Record<LostReason, number>,
    leads: sortBy(all.filter((e) => within(openedAt(e))), (e) => leadHistory(e)[0].at),
  };
  out.opened = out.leads.length;
  const members = new Set<string>();
  for (const e of all) {
    const moves = leadHistory(e).filter((m) => !m.undo);
    if (moves.some((m) => m.stage === 'visit' && within(m.at.slice(0, 10)))) out.visit++;
    if (moves.some((m) => m.stage === 'trial' && within(m.at.slice(0, 10)))) out.trial++;
    const lost = moves.find((m) => m.stage === 'lost' && within(m.at.slice(0, 10)));
    if (lost) { out.lost++; const r = lost.reason ?? e.lost?.reason; if (r) out.lostReasons[r]++; }
    const m = e.stage === 'joined' && e.memberId ? s.members[e.memberId] : undefined;
    if (m && !m.deletedAt && !isPendingRow(m) && within(currentMembership(m)?.start)) members.add(m.id);
  }
  out.joined = members.size;
  return out;
}

/** The conversion shown beside a month: of the leads opened in the three whole months before `month`, how many visited, had a trial and joined. */
export interface LeadConversion { opened: number; visit: number; trial: number; joined: number; toVisit: number | null; toTrial: number | null; toJoined: number | null }
export function leadConversion(s: ClubState, month: YM): LeadConversion {
  const f = leadFunnel(s, `${addMonths(month, -3)}-01`, `${addMonths(month, -1)}-${String(daysInMonth(addMonths(month, -1))).padStart(2, '0')}`);
  const r = (n: number) => (f.opened ? Math.round((n / f.opened) * 100) / 100 : null);
  return { opened: f.opened, visit: f.visit, trial: f.trial, joined: f.joined, toVisit: r(f.visit), toTrial: r(f.trial), toJoined: r(f.joined) };
}

export interface LeadMonth { month: YM; from: ISODate; to: ISODate; /** the cohort opened in the month */ funnel: LeadFunnel; /** what happened in the month */ moves: LeadMoves; conversion: LeadConversion }
/** The `n` calendar months ending with the one `today` is in, newest first. */
export function leadMonths(s: ClubState, today: ISODate, n: number): LeadMonth[] {
  return Array.from({ length: n }, (_, i) => {
    const month = addMonths(ym(today), -i);
    const from = `${month}-01`, to = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
    return { month, from, to, funnel: leadFunnel(s, from, to), moves: leadMoves(s, from, to), conversion: leadConversion(s, month) };
  });
}

// ---------- guests (visits and trials) ----------
export const guestsOfEnquiry = (s: ClubState, enquiryId: string) => sortBy(live(s.guestVisits).filter((g) => g.enquiryId === enquiryId && g.status !== 'cancelled'), (g) => g.date + g.time);
/** The booked (not yet arrived) visit or trial of a lead. */
export const openGuest = (s: ClubState, enquiryId: string, kind: GuestVisit['kind']) =>
  live(s.guestVisits).find((g) => g.enquiryId === enquiryId && g.kind === kind && g.status === 'booked' && !g.checkIn);

/** A trial is 2 consecutive open days (the brochure: "Dua (2) hari berturut"): the day chosen and the next open day. */
export const trialDays = (s: ClubState, date: ISODate): [ISODate, ISODate] => [date, nextOpenDay(s, date)];
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
  if (kind === 'trial') {
    // the second day must be a normal club day too: members are away on an outing
    const second = dayStatus(s, trialDays(s, date)[1]);
    return second.open && second.outing ? { ok: false, code: 'enq.err.outing' } : { ok: true };
  }
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

/** Health basics typed in when a lead joins (Add member's fields, without medicines: the nurse adds those). */
export interface LeadHealth { conditions: string[]; diabetic: boolean; food: FoodAllergen[]; foodOther: string; drugs: DrugAllergy[]; mobility: Mobility | null; diet: Diet[] }
/** What the Join dialog types in from the paper application form (KC round 6). All optional: a plan, a first day and the signed form are enough. */
export interface LeadDetails { dob?: ISODate; address?: string; health?: LeadHealth; registration?: MemberRegistration; /** KC round 10: the carer (suster) with the carer's NIK */ nanny?: { name: string; nik: string } | null; /** photos of the ID cards */ ktp?: KtpUploads }
export interface LeadMemberArgs {
  id: string;
  contactId: string;
  enquiry: Enquiry;
  form: PaperForm;
  details?: LeadDetails;
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
  const x = a.details ?? {};
  // KC round 10: the ID cards photographed at registration are on file; the member's is asked for when it was not
  const uploaded = ktpDocuments(a.id, x.ktp, !!x.nanny, a.today, a.actor, 'staff');
  const documents: MemberDocument[] = [
    ...(uploaded.some((d) => d.type === 'ktp') ? [] : [{ id: `${a.id}-doc-ktp`, type: 'ktp' as const, status: 'requested' as const, on: a.today, by: a.actor }]),
    ...uploaded,
    paperFormDoc(a.id, a.form, a.today, a.actor),
    { id: `${a.id}-doc-health`, type: 'healthInfo', status: 'requested', on: a.today, by: a.actor },
  ];
  const consents: Consent[] = [];
  const h = x.health;
  return {
    id: a.id, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor,
    title, firstName: first, lastName: last, gender: isFemaleTitle(title) ? 'f' : 'm', dob: x.dob || null, ageYears: null, address: x.address || null, photoTone: a.photoTone,
    memberships: [{ start: a.start }], plans: [{ from: a.start, plan: a.plan, by: a.actor }], usualArrival: '10:00', nanny: a.details?.nanny ?? null, spouseId: null,
    health: {
      conditions: h?.conditions ?? [], diabetic: !!h?.diabetic, food: h?.food ?? [], ...(h?.foodOther ? { foodOther: h.foodOther } : {}), drugs: h?.drugs ?? [], mobility: h?.mobility ?? null, diet: h?.diet ?? [], meds: [], cognitive: { summary: '' },
    },
    care: { instructions: '', by: a.actor, at: a.nowDT }, consents, documents, face: { enrolled: false },
    billing: { va: '8808' + String(1203440000 + a.vaIndex * 7919).padStart(12, '0') },
    sim: { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 110, weight: 58, temp: 36.6, grip: 18 },
    ...(x.registration ? { registration: x.registration } : {}),
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

// ---------- KC round 10: the online registration link (/form/:token) ----------
/** How long a link stays open. Staff can send a fresh one after. */
export const FORM_LINK_DAYS = 14;
export const formPath = (token: string) => `/form/${token}`;
/** An unguessable token for a lead's form link (same recipe as the venue rating link). */
export const formTokenOf = (seed: string) => ratingTokenOf('form|' + seed);
export type FormLinkState = 'sent' | 'opened' | 'inProgress' | 'submitted' | 'expired';
/** How many steps the online form has (Who is joining, Family contact, Health, Plan, Review and send). */
export const FORM_STEPS = 5;
/** Where a lead's link stands now (null = no link was ever sent). A submitted form never expires: its answers stay for the join. */
export function formLinkState(f: EnquiryForm | undefined, nowDT: DT): FormLinkState | null {
  if (!f) return null;
  if (f.submittedAt) return 'submitted';
  if (nowDT > f.expiresAt) return 'expired';
  if (f.savedAt) return 'inProgress'; // round 13: the family saved a draft through the link
  return f.openedAt ? 'opened' : 'sent';
}
/** The lead a form token belongs to (deleted leads never match). */
export const enquiryByFormToken = (s: ClubState, token: string | undefined | null): Enquiry | null =>
  (token && live(s.enquiries).find((e) => e.form?.token === token)) || null;
/** What the family's form starts from: the lead as the front desk typed it (name, title, who is asking), everything else empty. */
export const onlineDraftOf = (e: Enquiry): OnlineRegistration => e.form?.draft ?? ({
  title: e.senior.title, name: e.senior.name, dob: '', address: '', contact: { ...e.contact }, health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en',
});
