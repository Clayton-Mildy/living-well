// Enquiries and the family membership form: stages, form state, visit/trial day rules, and the form -> member mapping.
import type {
  Actor, ClubState, Consent, DT, Diet, DrugAllergy, Enquiry, FamilyContact, FamilyLink, FoodAllergen, FormRequest, GuestVisit, HM, ISODate, Member, MemberDocument,
  MembershipForm, MedTiming, Mobility, Plan, Relation, Title,
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
export const FORM_RELATIONS: Relation[] = ['daughter', 'son', 'spouse', 'daughterInLaw', 'sonInLaw', 'grandchild', 'sibling', 'other'];
export const ALL_RELATIONS: Relation[] = ['daughter', 'son', 'daughterInLaw', 'sonInLaw', 'granddaughter', 'grandson', 'grandchild', 'spouse', 'sibling', 'other'];
export const FOODS: FoodAllergen[] = ['shellfish', 'seafood', 'fish', 'peanuts', 'eggs', 'dairy', 'gluten'];
export const DRUGS = ['penicillin', 'sulfa', 'aspirin', 'ibuprofen'] as const;
export const MOBILITIES: Mobility[] = ['walkingStick', 'walker', 'wheelchair'];
export const DIETS: Diet[] = ['softFood', 'lowSalt', 'vegetarian', 'sugarFree'];
export const TIMINGS: MedTiming[] = ['morningHome', 'lunchClub', 'eveningHome', 'asPrescribed'];
export const FORM_STEPS = 7;
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

// ---------- forms ----------
export const formByToken = (s: ClubState, token: string): FormRequest | undefined => live(s.formRequests).find((f) => f.token === token);
/** The newest form request for a lead (or member). */
export function formFor(s: ClubState, target: { type: 'enquiry' | 'member'; id: string }): FormRequest | undefined {
  return sortBy(live(s.formRequests).filter((f) => f.target.type === target.type && f.target.id === target.id), (f) => f.createdAt).pop();
}
export const enquiryForm = (s: ClubState, e: Enquiry) => (e.formToken ? formByToken(s, e.formToken) : undefined) ?? formFor(s, { type: 'enquiry', id: e.id });
export type FormBadge = 'sent' | 'opened' | 'draft' | 'ready' | 'returned' | 'approved';
export function formBadge(f: FormRequest | undefined): FormBadge | null {
  if (!f) return null;
  return ({ sent: 'sent', opened: 'opened', draft: 'draft', submitted: 'ready', returned: 'returned', approved: 'approved' } as const)[f.status];
}
/** Open means the family can still fill it in. */
export const formIsEditable = (f: FormRequest) => ['sent', 'opened', 'draft', 'returned'].includes(f.status);
export const formLink = (token: string) => `/form/${token}`;

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

// ---------- the form itself ----------
const T_OK = (v: unknown): v is string => typeof v === 'string';
const clip = (v: unknown, max: number) => (T_OK(v) ? v.trim().slice(0, max) : '');
const pick = <T extends string>(v: unknown, list: readonly T[]) => (T_OK(v) && (list as readonly string[]).includes(v) ? (v as T) : undefined);
const dateOk = (v: unknown): v is string => T_OK(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]*$/;

/** Keep only known, well-typed form fields (never trust the browser). Missing or invalid values are dropped. */
export function sanitizeForm(raw: unknown): Partial<MembershipForm> {
  const i = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: Partial<MembershipForm> = {};
  const title = pick(i.title, TITLES);
  if (title) out.title = title;
  if (T_OK(i.name)) out.name = clip(i.name, 120);
  if (T_OK(i.dob)) out.dob = dateOk(i.dob) ? i.dob : '';
  if (T_OK(i.address)) out.address = clip(i.address, 300);
  if (i.contact && typeof i.contact === 'object') {
    const c = i.contact as Record<string, unknown>;
    out.contact = { name: clip(c.name, 120), relation: pick(c.relation, ALL_RELATIONS) ?? 'other', phone: clip(c.phone, 40) };
  }
  if (i.nanny === null) out.nanny = null;
  else if (i.nanny && typeof i.nanny === 'object') out.nanny = { name: clip((i.nanny as Record<string, unknown>).name, 120) };
  if (i.docs && typeof i.docs === 'object') {
    const d = i.docs as Record<string, unknown>;
    out.docs = { ktp: d.ktp === true, nannyKtp: d.nannyKtp === true, healthInfo: d.healthInfo === true };
  }
  if (Array.isArray(i.conditions)) out.conditions = i.conditions.map((c) => clip(c, 120)).filter(Boolean).slice(0, 20);
  if (Array.isArray(i.meds)) {
    out.meds = i.meds
      .slice(0, 20)
      .map((m) => {
        const r = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
        return { name: clip(r.name, 80), dose: clip(r.dose, 40), timing: pick(r.timing, TIMINGS) ?? ('asPrescribed' as MedTiming) };
      })
      .filter((m) => m.name);
  }
  if (Array.isArray(i.food)) out.food = i.food.map((x) => pick(x, FOODS)).filter((x): x is FoodAllergen => !!x);
  if (T_OK(i.foodOther)) out.foodOther = clip(i.foodOther, 80);
  if (Array.isArray(i.drugs)) {
    out.drugs = i.drugs
      .map((x): DrugAllergy | undefined => (pick(x, DRUGS) ?? (T_OK(x) && x.startsWith('other:') && x.slice(6).trim() ? (`other:${x.slice(6).trim().slice(0, 60)}` as DrugAllergy) : undefined)))
      .filter((x): x is DrugAllergy => !!x);
  }
  if (i.mobility === null) out.mobility = null;
  else if (pick(i.mobility, MOBILITIES)) out.mobility = pick(i.mobility, MOBILITIES)!;
  if (Array.isArray(i.diet)) out.diet = i.diet.map((x) => pick(x, DIETS)).filter((x): x is Diet => !!x);
  if (i.consent && typeof i.consent === 'object') {
    const c = i.consent as Record<string, unknown>;
    out.consent = { data: c.data === true, face: c.face === true };
  }
  if (i.signature === null) out.signature = null;
  else if (i.signature && typeof i.signature === 'object') {
    const g = i.signature as Record<string, unknown>;
    const p = T_OK(g.svgPath) ? g.svgPath.trim() : '';
    out.signature = p && p.length <= 80000 && PATH_OK.test(p) ? { svgPath: p, at: clip(g.at, 20), by: clip(g.by, 120) } : null;
  }
  return out;
}

export interface FormError { step: number; key: string }
/** What is missing before the form can be sent (step = where to go to fix it). */
export function formErrors(f: Partial<MembershipForm>, today: ISODate): FormError[] {
  const e: FormError[] = [];
  if (!f.name?.trim()) e.push({ step: 0, key: 'name' });
  if (!f.dob) e.push({ step: 0, key: 'dob' });
  else if (f.dob > today || f.dob < '1890-01-01') e.push({ step: 0, key: 'dob' });
  if (!f.contact?.name?.trim()) e.push({ step: 0, key: 'contactName' });
  if (!f.contact || e164(f.contact.phone || '').replace(/\D/g, '').length < 8) e.push({ step: 0, key: 'phone' });
  if (f.nanny === undefined) e.push({ step: 2, key: 'nanny' });
  else if (f.nanny && !f.nanny.name.trim()) e.push({ step: 2, key: 'nannyName' });
  if (f.mobility === undefined) e.push({ step: 4, key: 'mobility' });
  if (!f.consent?.data) e.push({ step: 5, key: 'consent' });
  if (!f.signature?.svgPath) e.push({ step: 5, key: 'signature' });
  return e;
}
/** Which step a user can leave: the first step with a problem blocks "Continue" (steps 1, 3, 6 are always fine). */
export const stepValid = (f: Partial<MembershipForm>, step: number, today: ISODate) => !formErrors(f, today).some((x) => x.step === step);

/** A complete form from a validated draft (defaults for everything optional). */
export function completeForm(f: Partial<MembershipForm>, nowDT: DT): MembershipForm {
  const contact = f.contact || { name: '', relation: 'other' as Relation, phone: '' };
  return {
    title: f.title || 'Oma', name: (f.name || '').trim(), dob: f.dob || '', address: (f.address || '').trim(),
    contact: { name: contact.name.trim(), relation: contact.relation, phone: e164(contact.phone) },
    nanny: f.nanny ?? null,
    docs: { ktp: !!f.docs?.ktp, nannyKtp: !!f.nanny && !!f.docs?.nannyKtp, healthInfo: !!f.docs?.healthInfo },
    conditions: f.conditions || [], meds: f.meds || [], food: f.food || [], ...(f.foodOther?.trim() ? { foodOther: f.foodOther.trim() } : {}),
    drugs: f.drugs || [], mobility: f.mobility ?? null, diet: f.diet || [], consent: { data: !!f.consent?.data, face: !!f.consent?.face },
    signature: f.signature ? { svgPath: f.signature.svgPath, at: nowDT, by: contact.name.trim() } : null,
  };
}

/** Starting values for a lead's form (title, name and contact are already known). */
export function draftFromEnquiry(e: Enquiry): Partial<MembershipForm> {
  return { title: e.senior.title, name: e.senior.name, contact: { name: e.contact.name, relation: e.contact.relation, phone: e.contact.phone } };
}
export const fullName = (m: Pick<Member, 'firstName' | 'lastName'>) => `${m.firstName}${m.lastName && m.lastName !== m.firstName ? ' ' + m.lastName : ''}`;
/** Starting values for an existing member's form (everything on file, ready to confirm or change). */
export function draftFromMember(m: Member, phone: string): Partial<MembershipForm> {
  const doc = (t: MemberDocument['type']) => m.documents.some((d) => d.type === t && d.status === 'onFile');
  const consent = (k: 'data' | 'face') => !!m.consents.find((c) => c.kind === k)?.granted;
  return {
    title: m.title, name: fullName(m), dob: m.dob || '', address: m.address || '', contact: { name: '', relation: 'daughter', phone },
    nanny: m.nanny ? { name: m.nanny.name } : null, docs: { ktp: doc('ktp'), nannyKtp: doc('nannyKtp'), healthInfo: doc('healthInfo') },
    conditions: m.health.conditions.slice(), meds: m.health.meds.map((x) => ({ name: x.name, dose: x.dose, timing: x.timing })), food: m.health.food.slice(),
    ...(m.health.foodOther ? { foodOther: m.health.foodOther } : {}), drugs: m.health.drugs.slice(), mobility: m.health.mobility, diet: m.health.diet.slice(),
    consent: { data: consent('data'), face: consent('face') },
  };
}

// ---------- form -> member ----------
/** "Siu Lan Tjandra" -> first "Siu Lan", last "Tjandra"; a single name is both. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return { first: parts.slice(0, -1).join(' ') || last, last };
}
const isDiabetic = (conds: string[]) => conds.some((c) => /diabet|kencing manis|\bDM\b/i.test(c));
const docRow = (id: string, type: MemberDocument['type'], has: boolean, file: string, on: ISODate, by: Actor, requestedBy: Actor): MemberDocument =>
  has ? { id, type, status: 'onFile', fileName: file, on, via: 'form', by } : { id, type, status: 'requested', on, by: requestedBy };

/** Documents and consent a submitted form puts on a member's record (merged into what is already there). */
export function formMemberPatch(m: Pick<Member, 'id' | 'documents' | 'consents'>, f: MembershipForm, by: Actor, today: ISODate, nowDT: DT): { documents: MemberDocument[]; consents: Consent[] } {
  const documents = m.documents.map((d) => ({ ...d }));
  const put = (type: MemberDocument['type'], has: boolean, file: string) => {
    if (!has) return;
    const row: MemberDocument = { id: `${m.id}-doc-${type === 'membershipForm' ? 'form' : type === 'healthInfo' ? 'health' : type === 'nannyKtp' ? 'nktp' : type}`, type, status: 'onFile', fileName: file, on: today, via: 'form', by };
    const i = documents.findIndex((d) => d.type === type);
    if (i >= 0) documents[i] = { ...row, id: documents[i].id };
    else documents.push(row);
  };
  put('ktp', f.docs.ktp, 'ktp.jpg');
  put('nannyKtp', !!f.nanny && f.docs.nannyKtp, 'ktp-nanny.jpg');
  put('membershipForm', !!f.signature, 'membership-form.pdf');
  put('healthInfo', f.docs.healthInfo, 'health-info.jpg');
  const consents = m.consents.filter((c) => c.kind !== 'data' && c.kind !== 'face').map((c) => ({ ...c }));
  const byName = f.contact.name;
  consents.push({ kind: 'data', granted: f.consent.data, by, byName, at: nowDT, via: 'form' }, { kind: 'face', granted: f.consent.face, by, byName, at: nowDT, via: 'form' });
  return { documents, consents };
}

export interface LeadMemberArgs {
  id: string;
  contactId: string;
  enquiry: Enquiry;
  form: MembershipForm | null;
  plan: Plan;
  start: ISODate;
  today: ISODate;
  nowDT: DT;
  actor: Actor;
  vaIndex: number;
  photoTone: number;
}
/** Every field of the lead (and its form, when there is one) becomes part of the new member record. */
export function memberFromLead(a: LeadMemberArgs): Member {
  const { enquiry: e, form: f } = a;
  const title = f?.title || e.senior.title;
  const { first, last } = splitName(f?.name || e.senior.name);
  const contactName = f?.contact.name || e.contact.name;
  const family: Actor = `family:${a.contactId}`;
  const conditions = f?.conditions.slice() || [];
  const nanny = f?.nanny ? { name: f.nanny.name } : null;
  const at = f?.signature?.at || a.nowDT;
  const documents: MemberDocument[] = f
    ? [
        docRow(`${a.id}-doc-ktp`, 'ktp', f.docs.ktp, 'ktp.jpg', a.today, family, a.actor),
        ...(nanny ? [docRow(`${a.id}-doc-nktp`, 'nannyKtp', f.docs.nannyKtp, 'ktp-nanny.jpg', a.today, family, a.actor)] : []),
        docRow(`${a.id}-doc-form`, 'membershipForm', !!f.signature, 'membership-form.pdf', a.today, family, a.actor),
        docRow(`${a.id}-doc-health`, 'healthInfo', f.docs.healthInfo, 'health-info.jpg', a.today, family, a.actor),
      ]
    : [
        { id: `${a.id}-doc-ktp`, type: 'ktp', status: 'requested', on: a.today, by: a.actor },
        { id: `${a.id}-doc-form`, type: 'membershipForm', status: 'requested', on: a.today, by: a.actor },
        { id: `${a.id}-doc-health`, type: 'healthInfo', status: 'requested', on: a.today, by: a.actor },
      ];
  const consents: Consent[] = f
    ? [
        { kind: 'data', granted: f.consent.data, by: family, byName: contactName, at, via: 'form' },
        { kind: 'face', granted: f.consent.face, by: family, byName: contactName, at, via: 'form' },
      ]
    : [];
  return {
    id: a.id, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor,
    title, firstName: first, lastName: last, gender: isFemaleTitle(title) ? 'f' : 'm', dob: f?.dob || null, ageYears: null, address: f?.address || null, photoTone: a.photoTone,
    memberships: [{ start: a.start }], plans: [{ from: a.start, plan: a.plan, by: a.actor }], usualArrival: '10:00', nanny, spouseId: null,
    health: {
      conditions, diabetic: isDiabetic(conditions), food: f?.food.slice() || [], ...(f?.foodOther ? { foodOther: f.foodOther } : {}), drugs: f?.drugs.slice() || [], mobility: f?.mobility ?? null,
      diet: f?.diet.slice() || [], meds: (f?.meds || []).map((m, i) => ({ id: `${a.id}-med${i + 1}`, name: m.name, dose: m.dose, timing: m.timing })), cognitive: { summary: '' },
    },
    care: { instructions: '', by: a.actor, at: a.nowDT }, consents, documents, face: { enrolled: false },
    billing: { va: '8808' + String(1203440000 + a.vaIndex * 7919).padStart(12, '0') },
    sim: { sys: 128, dia: 80, pulse: 74, spo2: 97, glucose: 110, weight: 58, temp: 36.6, grip: 18 },
  };
}
export function contactFromLead(a: { id: string; enquiry: Enquiry; form: MembershipForm | null; nowDT: DT; actor: Actor; activated: boolean }): FamilyContact {
  const name = a.form?.contact.name || a.enquiry.contact.name;
  const ph = e164(a.form?.contact.phone || a.enquiry.contact.phone);
  return { id: a.id, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor, name, firstName: name.split(' ')[0], phone: ph, ...(a.activated ? { activatedAt: a.nowDT } : {}) };
}
export function linkFromLead(a: { contactId: string; memberId: string; enquiry: Enquiry; form: MembershipForm | null; nowDT: DT; actor: Actor }): FamilyLink {
  return {
    id: `${a.contactId}:${a.memberId}`, clubId: a.enquiry.clubId, createdAt: a.nowDT, createdBy: a.actor, familyId: a.contactId, memberId: a.memberId,
    relation: a.form?.contact.relation || a.enquiry.contact.relation, primary: true, appAccess: true, healthAlerts: true,
  };
}
