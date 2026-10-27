// KC round 12: the registration as six steps (Join a lead and Add member share them). The state the steps edit, how it starts (empty, or
// from a lead and the family's online form), and what still blocks each step — the add-member and application-form validators, per field group.
import { isOpen, live, sortBy, type ClubState, type DocType, type Enquiry, type OnlineRegistration, type ISODate, type KtpUploads, type Plan, type Relation, type Title } from '@cp/shared';
import { genderOf, validateNewMember, type FieldIssue } from '@cp/shared/rules/members';
import { startMondays } from '@cp/shared/rules/enquiries';
import { validateRegistration } from '@cp/shared/rules/applicationForm';
import { regDraftOf, regOfDraft, splitDrugs, type AllergyDraft, type CarerDraft, type HealthDraft, type MedRow, type RegDraft } from '../dialogs/forms';
import type { PaperFile } from '../PaperForm';
import { toCreateInput } from './submit';

export type RegMode = { kind: 'new' } | { kind: 'lead'; id: string };
export type RegStep = 'person' | 'family' | 'health' | 'plan' | 'paper' | 'review';
export const REG_STEPS: RegStep[] = ['person', 'family', 'health', 'plan', 'paper', 'review'];
export const STEP_ICON: Record<RegStep, string> = { person: 'person', family: 'family_restroom', health: 'favorite', plan: 'event', paper: 'description', review: 'fact_check' };

/**
 * Everything the six steps type in. The application form's extra answers (nickname, the NIKs and the IDs ticked, dementia) live in `reg`, the shape
 * the shared field groups edit. A lead keeps its own contact (enquiry.convert's contract): `contact`, `rel` and `phone` then hold the lead's, read-only.
 */
export interface RegState {
  title: Title; name: string; gender: 'f' | 'm'; dob: string; address: string;
  /** usual arrival (optional, informational); profile picture media id; spouse member id — Add member only */
  usual: string; photo: string; spouseId: string;
  contactMode: 'new' | 'existing'; existingId: string; contact: string; rel: Relation; phone: string; primary: boolean;
  health: HealthDraft & AllergyDraft; carer: CarerDraft; meds: MedRow[]; care: string;
  plan: Plan | ''; start: string;
  /** the signed paper form (already uploaded) */ form: PaperFile | null;
  /** photos of the ID cards (already uploaded) */ ktp: KtpUploads;
  docs: DocType[];
  consentData: boolean; consentFace: boolean; note: string;
  reg: RegDraft;
}

export const blankState = (): RegState => ({
  title: 'Oma', name: '', gender: 'f', dob: '', address: '', usual: '', photo: '', spouseId: '',
  contactMode: 'new', existingId: '', contact: '', rel: 'daughter', phone: '', primary: true,
  health: { conditions: [], diabetic: false, mobility: 'none', diet: [], food: [], foodOther: '', drug: [], drugOther: '' }, carer: { nanny: false, nannyName: '', nannyNik: '' }, meds: [], care: '',
  plan: '', start: '', form: null, ktp: {}, docs: [], consentData: false, consentFace: true, note: '', reg: regDraftOf(),
});

/** The health answers the family gave through the link: all of them once sent, and a half-filled draft's only when it got as far as answering something. */
export function onlineHealthOf(e: Enquiry | undefined): OnlineRegistration['health'] | undefined {
  const dr = e?.form?.draft;
  if (!dr) return undefined;
  const h = dr.health;
  const got = h.conditions.length > 0 || h.diabetic || h.food.length > 0 || !!h.foodOther || h.drugs.length > 0 || !!h.mobility || h.diet.length > 0;
  return e?.form?.submittedAt || got ? h : undefined;
}

/** A new member starts empty; a lead starts from its own details and the family's online form (else allergies and needs from the trial day). The first day is the next open Monday. */
export function initialState(s: ClubState, mode: RegMode, today: ISODate): RegState {
  const base: RegState = { ...blankState(), start: startMondays(s, today, 1)[0] ?? '' };
  if (mode.kind === 'new') return base;
  const e = s.enquiries[mode.id];
  if (!e) return base;
  const online = e.form?.draft; // round 13: a half-filled draft saved through the link counts too
  const onlineHealth = onlineHealthOf(e);
  const trial = sortBy(live(s.guestVisits).filter((g) => g.enquiryId === e.id && g.kind === 'trial'), (g) => g.date).pop();
  const h = onlineHealth;
  // the family's own edit of the name in the online form wins over the lead's
  const title = online?.name?.trim() && online.title ? online.title : e.senior.title;
  const name = online?.name?.trim() || e.senior.name;
  return {
    ...base, title, name, gender: genderOf(title), dob: online?.dob || '', address: online?.address || '',
    contact: e.contact.name, rel: e.contact.relation, phone: e.contact.phone,
    health: h
      ? { conditions: h.conditions, diabetic: h.diabetic, mobility: h.mobility ?? 'none', diet: h.diet, food: h.food, foodOther: h.foodOther, ...splitDrugs(h.drugs) }
      : { conditions: [], diabetic: false, mobility: trial?.mobility ?? 'none', diet: trial?.diet ?? [], food: trial?.food ?? [], foodOther: '', ...splitDrugs(trial?.drugs ?? []) },
    carer: { nanny: !!online?.nanny, nannyName: online?.nanny?.name ?? '', nannyNik: online?.nanny?.nik ?? '', nannyPhoto: online?.nanny?.photoMediaId ?? '', nannyNote: online?.nanny?.note ?? '' },
    ktp: online?.ktp ?? {}, reg: regDraftOf(online?.registration), plan: online?.plan ?? '',
  };
}

const FIELDS: Record<RegStep, string[]> = {
  person: ['title', 'name', 'dob', 'usualArrival', 'nik', 'rtRw', 'postcode', 'regPhone', 'regMobile', 'email'],
  family: ['contact', 'contactName', 'phone', 'guarantorNik', 'nannyName', 'nannyNik'],
  health: ['meds'],
  plan: ['plan', 'start'],
  paper: [], // the scan is optional now: the review asks for it only when the pad is empty
  review: ['form', 'consentData'],
};
/** What a lead does not ask for: its contact is the lead's, and Join has no arrival time, medicines or consents (as before). */
const NOT_FOR_LEADS = ['contact', 'contactName', 'phone', 'usualArrival', 'meds', 'consentData'];

/** What still blocks a step. `s` adds the club calendar check on the first day (a closed day). */
export function stepIssues(step: RegStep, st: RegState, mode: RegMode, today: ISODate, s?: ClubState, signed = false): FieldIssue[] {
  const lead = mode.kind === 'lead';
  const all: FieldIssue[] = [
    ...validateNewMember({ ...toCreateInput(st), ...(signed ? { signatureMediaId: 'pad' } : {}) }, today), // signed on the pad: that stands for the scan
    ...validateRegistration(regOfDraft(st.reg, st.carer.nanny)),
    ...(!lead && st.contactMode === 'existing' && !st.existingId ? [{ field: 'contactName', code: 'members.err.contactRequired' }] : []),
    ...(s && st.start && st.start >= today && !isOpen(s, st.start) ? [{ field: 'start', code: 'err.closedDay' }] : []),
  ];
  return all.filter((i) => FIELDS[step].includes(i.field) && !(lead && NOT_FOR_LEADS.includes(i.field)) && !(lead && i.code === 'members.err.dobRequired')); // Join keeps the date of birth optional
}
/** The first step that is not complete yet (the review step when all are). */
export function firstOpenStep(st: RegState, mode: RegMode, today: ISODate, s?: ClubState, signed = false): number {
  const i = REG_STEPS.findIndex((k) => stepIssues(k, st, mode, today, s, signed).length > 0);
  return i < 0 ? REG_STEPS.length - 1 : i;
}
