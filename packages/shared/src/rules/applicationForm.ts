// The paper Membership Application Form (brochure pp. 14-17): the answers the app keeps in `member.registration`, how they are checked and
// cleaned, and the pure mapping from a member (or a half-typed new member) to the words printed on the four form pages.
// The printed form is Indonesian whatever language the app is in, so the words here are Indonesian.
import type { ClubState, ISODate, MemberRegistration, Plan } from '../types';
import { ageOn, e164, fmtPhone, rp } from '../util';
import { translate } from '../i18n';
import { memberAge, planOn, primaryContact, linksOfMember } from './core';
import { priceOn } from './billing';
import { billingContactOf } from './family';
import { isPhone, plainName, type FieldIssue, type NewMemberInput } from './members';

export const MARITALS = ['single', 'married', 'widowed', 'divorced'] as const;
export type Marital = (typeof MARITALS)[number];
export const REG_IDS = ['guarantor', 'member', 'carer'] as const;

// ---------- the answers: clean and check ----------
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
/** A phone as the seed shows it: +62 812-1090-4471 (a number that is not valid yet is kept as typed, so the check can flag it). */
const cleanPhone = (v: unknown) => {
  const raw = str(v, 30);
  if (!raw) return '';
  const e = e164(raw);
  return isPhone(e) ? fmtPhone(e) : raw;
};
/** The answers with empty ones left out, text trimmed, phones in one format; undefined when nothing is filled in. Anything that is not an answer is dropped. */
export function cleanRegistration(raw: unknown): MemberRegistration | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: MemberRegistration = {};
  const set = <K extends keyof MemberRegistration>(k: K, v: MemberRegistration[K] | '' | undefined) => { if (v !== undefined && v !== '') out[k] = v as MemberRegistration[K]; };
  set('nickname', str(o.nickname, 40));
  set('marital', (MARITALS as readonly string[]).includes(o.marital as string) ? (o.marital as Marital) : undefined);
  set('rtRw', str(o.rtRw, 12));
  set('city', str(o.city, 60));
  set('postcode', str(o.postcode, 10));
  set('phone', cleanPhone(o.phone));
  set('mobile', cleanPhone(o.mobile));
  set('email', str(o.email, 100));
  set('commDifficulty', bool(o.commDifficulty));
  set('selfCare', bool(o.selfCare));
  set('bathroomHelp', bool(o.bathroomHelp));
  set('dementiaNote', str(o.dementiaNote, 300));
  const ids = o.ids && typeof o.ids === 'object' ? (o.ids as Record<string, unknown>) : {};
  const got: NonNullable<MemberRegistration['ids']> = {};
  for (const k of REG_IDS) if (ids[k] === true) got[k] = true; // an unticked ID is the same as none
  if (Object.keys(got).length) out.ids = got;
  return Object.keys(out).length ? out : undefined;
}
/** Field-level problems with the answers (run on cleaned answers). The codes are the members.err.* texts. */
export function validateRegistration(r: MemberRegistration | undefined): FieldIssue[] {
  const out: FieldIssue[] = [];
  if (!r) return out;
  const bad = (field: string, code: string) => out.push({ field, code: `members.err.${code}` });
  if (r.rtRw && !/^[0-9A-Za-z/ -]{1,12}$/.test(r.rtRw)) bad('rtRw', 'rtRwInvalid');
  if (r.postcode && !/^\d{5}$/.test(r.postcode)) bad('postcode', 'postcodeInvalid');
  if (r.phone && !isPhone(e164(r.phone))) bad('regPhone', 'regPhoneInvalid');
  if (r.mobile && !isPhone(e164(r.mobile))) bad('regMobile', 'regPhoneInvalid');
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) bad('email', 'emailInvalid');
  return out;
}

// ---------- the data the form is printed from ----------
/** Everything the four pages need, as plain data: built from a saved member or from a new member that is still being typed. */
export interface ApplicationFormData {
  name: string;
  nickname: string;
  dob: ISODate | null;
  age: number | null;
  marital: Marital | null;
  gender: 'f' | 'm' | null;
  address: string;
  rtRw: string;
  city: string;
  postcode: string;
  phone: string;
  mobile: string;
  email: string;
  plan: Plan;
  /** the one-time fee from the price list, when it has one */
  registrationFee: number | null;
  monthlyFee: number | null;
  conditions: string[];
  cognitive: string;
  dementiaNote: string;
  /** unanswered questions are null and print blank */
  commDifficulty: boolean | null;
  selfCare: boolean | null;
  bathroomHelp: boolean | null;
  /** the carer's (suster's) name, null without one */
  carer: string | null;
  foodAllergies: string[];
  drugAllergies: string[];
  /** the family contact to call */
  kin: { name: string; relation: string; phone: string } | null;
  ids: { guarantor: boolean; member: boolean; carer: boolean };
  /** the responsible family member who signs: the billing contact */
  signer: string;
  /** the print date */
  date: ISODate;
}

const id = (key: string) => translate('id', key);
// KC round 6: a member who is alert and oriented has no dementia to report; the line then reads "Tidak ada" (see page1Values)
const cognitiveText = (summary: string | undefined) => (!summary || summary === 'Alert and oriented' ? '' : summary);
const foodWords = (food: readonly string[], other?: string) => [...food.map((x) => id(`profile.food.${x}`)), ...(other ? [other] : [])];
const drugWords = (drugs: readonly string[]) => drugs.map((x) => (x.startsWith('other:') ? x.slice(6) : id(`profile.drug.${x}`)));

/** The form of a saved member. The signer is the billing contact (the primary one); without one, the first contact. */
export function applicationDataOf(s: ClubState, memberId: string, today: ISODate): ApplicationFormData {
  const m = s.members[memberId];
  const r = m.registration || {};
  const plan = planOn(m, today).plan;
  const price = priceOn(s, today);
  const kinC = primaryContact(s, m.id);
  const kinLink = kinC ? linksOfMember(s, m.id).find((l) => l.familyId === kinC.id) : undefined;
  const signer = billingContactOf(s, m.id) ?? kinC;
  return {
    name: plainName(m), nickname: r.nickname || '', dob: m.dob, age: memberAge(m, today), marital: r.marital ?? null, gender: m.gender,
    address: m.address || '', rtRw: r.rtRw || '', city: r.city || '', postcode: r.postcode || '', phone: r.phone || '', mobile: r.mobile || '', email: r.email || '',
    plan, registrationFee: price.registration ?? null, monthlyFee: plan === 'gold' ? price.gold : price.flex,
    conditions: m.health.conditions, cognitive: cognitiveText(m.health.cognitive.summary), dementiaNote: r.dementiaNote || '',
    commDifficulty: r.commDifficulty ?? null, selfCare: r.selfCare ?? null, bathroomHelp: r.bathroomHelp ?? null,
    carer: m.nanny ? m.nanny.name : null,
    foodAllergies: foodWords(m.health.food, m.health.foodOther), drugAllergies: drugWords(m.health.drugs),
    kin: kinC ? { name: kinC.name, relation: kinLink ? id(`profile.rel.${kinLink.relation}`) : '', phone: kinC.phone ? fmtPhone(kinC.phone) : '' } : null,
    ids: { guarantor: !!r.ids?.guarantor, member: !!r.ids?.member, carer: !!r.ids?.carer && !!m.nanny },
    signer: signer?.name || '', date: today,
  };
}

/** What Add member has typed so far (the member is not saved yet, so there is no profile): the same form data. */
export type ApplicationInput = Pick<NewMemberInput, 'name' | 'dob' | 'address' | 'plan' | 'nanny' | 'contact'> & {
  title?: string;
  health: Pick<NewMemberInput['health'], 'conditions' | 'food' | 'foodOther' | 'drugs'>;
  registration?: MemberRegistration;
};
export function applicationDataFromInput(s: ClubState, input: ApplicationInput, today: ISODate): ApplicationFormData {
  const r = input.registration || {};
  const price = priceOn(s, today);
  const existing = input.contact.existingId ? s.familyContacts[input.contact.existingId] : undefined;
  const kinName = existing?.name || input.contact.name.trim();
  const kinPhone = existing?.phone || input.contact.phone;
  const female = input.title ? input.title === 'Oma' || input.title === 'Ibu' : null;
  return {
    name: input.name.trim(), nickname: r.nickname || '', dob: input.dob || null, age: input.dob ? ageOn(input.dob, today) : null, marital: r.marital ?? null, gender: female === null ? null : female ? 'f' : 'm',
    address: input.address.trim(), rtRw: r.rtRw || '', city: r.city || '', postcode: r.postcode || '', phone: r.phone || '', mobile: r.mobile || '', email: r.email || '',
    plan: input.plan, registrationFee: price.registration ?? null, monthlyFee: input.plan === 'gold' ? price.gold : price.flex,
    conditions: input.health.conditions, cognitive: '', dementiaNote: r.dementiaNote || '',
    commDifficulty: r.commDifficulty ?? null, selfCare: r.selfCare ?? null, bathroomHelp: r.bathroomHelp ?? null,
    carer: input.nanny ? input.nanny.name : null,
    foodAllergies: foodWords(input.health.food, input.health.foodOther), drugAllergies: drugWords(input.health.drugs),
    kin: kinName ? { name: kinName, relation: id(`profile.rel.${input.contact.relation}`), phone: kinPhone ? fmtPhone(kinPhone) : '' } : null,
    ids: { guarantor: !!r.ids?.guarantor, member: !!r.ids?.member, carer: !!r.ids?.carer && !!input.nanny },
    signer: kinName, date: today,
  };
}

// ---------- the words on the page ----------
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** 2026-10-21 -> "21 Oktober 2026" */
export const idDate = (d: ISODate) => `${+d.slice(8, 10)} ${MONTHS_ID[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const yaTidak = (v: boolean | null) => (v === null ? '' : v ? 'Ya' : 'Tidak');
/** Status Pernikahan in Indonesian (a widow is Janda, a widower Duda). */
export const maritalWord = (m: Marital | null, gender: 'f' | 'm' | null) =>
  m === 'single' ? 'Belum menikah' : m === 'married' ? 'Menikah' : m === 'widowed' ? (gender === 'f' ? 'Janda' : gender === 'm' ? 'Duda' : 'Janda / Duda') : m === 'divorced' ? 'Cerai' : '';
/** Break an address over the form's two lines at a space: the first line holds about `first` characters. */
export function splitAddress(address: string, first = 64): [string, string] {
  const a = address.replace(/\s+/g, ' ').trim();
  if (a.length <= first) return [a, ''];
  const cut = a.lastIndexOf(' ', first);
  const at = cut > first * 0.5 ? cut : first;
  return [a.slice(0, at).trim(), a.slice(at).trim()];
}

/** The values written on page 1, one per blank line (the print view places each one). Empty text leaves the line blank. */
export interface Page1Values {
  name: string; nickname: string; dobAge: string; marital: string; address1: string; address2: string; rtRw: string; city: string; postcode: string;
  phone: string; mobile: string; email: string; registrationFee: string; monthlyFee: string; conditions: string; dementia: string;
  q1: string; q2: string; q3: string; carer: string; carerName: string; allergy: string; allergyList: string;
  kin: string; kinRelation: string; kinHome: string; kinPhone: string;
  /** the ✓ marks next to "(berikan tanda)" */
  idGuarantor: boolean; idMember: boolean; idCarer: boolean;
  /** the bottom table */
  signer: string; date: string;
}
export function page1Values(d: ApplicationFormData): Page1Values {
  const [address1, address2] = splitAddress(d.address);
  const allergies = [...d.foodAllergies, ...d.drugAllergies];
  const planName = d.plan === 'gold' ? 'Gold' : 'Flex';
  return {
    name: d.name, nickname: d.nickname,
    dobAge: d.dob ? `${idDate(d.dob)}${d.age != null ? ` (${d.age} th)` : ''}` : d.age != null ? `${d.age} th` : '',
    marital: maritalWord(d.marital, d.gender), address1, address2, rtRw: d.rtRw, city: d.city, postcode: d.postcode,
    phone: d.phone, mobile: d.mobile, email: d.email,
    registrationFee: d.registrationFee ? `${planName} · ${rp(d.registrationFee)}` : planName,
    monthlyFee: d.monthlyFee != null ? rp(d.monthlyFee) : '',
    conditions: d.conditions.join('; '), dementia: [d.cognitive, d.dementiaNote].filter(Boolean).join('; ') || id('form.dementiaNone'),
    q1: yaTidak(d.commDifficulty), q2: yaTidak(d.selfCare), q3: yaTidak(d.bathroomHelp),
    carer: d.carer ? 'Ya' : 'Tidak', carerName: d.carer || '',
    allergy: allergies.length ? 'Ya' : 'Tidak', allergyList: allergies.join(', '),
    kin: d.kin?.name || '', kinRelation: d.kin?.relation || '', kinHome: d.phone, kinPhone: d.kin?.phone || '',
    idGuarantor: d.ids.guarantor, idMember: d.ids.member, idCarer: d.ids.carer,
    signer: d.signer, date: idDate(d.date),
  };
}
/** Pages 3 and 4: the signer's name and the print date (the initials and the signature stay blank for pen). */
export const signatureValues = (d: ApplicationFormData) => ({ signer: d.signer, date: idDate(d.date) });

