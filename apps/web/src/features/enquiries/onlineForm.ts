// Round 13 (KC): the family's online registration form as five steps — Who is joining, Family contact, Health, Plan, Review and send — with a draft
// that survives closing the page. What the steps type in (FDraft, the field groups' own draft shapes), what still blocks each step, and the two
// places the draft lives: this device (key cp.form.<token>, like the staff flow's cp.reg.*) and the lead (enquiry.formSave through the link).
import { fmtPhone, type Lang, type OnlineRegistration, type Plan, type Relation, type Title, type KtpUploads } from '@cp/shared';
import { validateRegistration } from '@cp/shared/rules/applicationForm';
import type { FieldIssue } from '@cp/shared/rules/members';
import { carerOf, carerOk, joinDrugs, ktpFor, regDraftOf, regOfDraft, splitDrugs, type AllergyDraft, type CarerDraft, type HealthDraft, type RegDraft } from '../members/dialogs/forms';

export type FDraft = HealthDraft & AllergyDraft & CarerDraft & { title: Title; name: string; dob: string; address: string; cName: string; rel: Relation; phone: string; plan: Plan | ''; reg: RegDraft; ktp: KtpUploads };

export type OnlineStep = 'who' | 'family' | 'health' | 'plan' | 'review';
export const ONLINE_STEPS: OnlineStep[] = ['who', 'family', 'health', 'plan', 'review'];
export const STEP_NAME_KEY: Record<OnlineStep, string> = { who: 'enq.pf_who', family: 'enq.pf_contact', health: 'enq.pf_stepHealth', plan: 'enq.pf_stepPlan', review: 'enq.pf_stepReview' };

/** A phone as typed or saved: formatted once it is a whole number, kept as it is while it is half typed. */
const phoneIn = (p: string) => (p.replace(/\D/g, '').length >= 8 ? fmtPhone(p) : p);
const EMPTY_HEALTH: OnlineRegistration['health'] = { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] };

export const fromOnline = (o: OnlineRegistration): FDraft => ({
  title: o.title, name: o.name, dob: o.dob, address: o.address, cName: o.contact.name, rel: o.contact.relation, phone: o.contact.phone ? phoneIn(o.contact.phone) : '', plan: o.plan ?? '',
  conditions: o.health.conditions, diabetic: o.health.diabetic, mobility: o.health.mobility ?? 'none', diet: o.health.diet, food: o.health.food, foodOther: o.health.foodOther, ...splitDrugs(o.health.drugs), reg: regDraftOf(o.registration),
  nanny: !!o.nanny, nannyName: o.nanny?.name ?? '', nannyNik: o.nanny?.nik ?? '', ktp: o.ktp ?? {},
});
/** The answers as the lead keeps them (sent for good, or saved half-filled: the server only checks the shape of a saved draft). */
export const toOnline = (d: FDraft, lang: Lang): OnlineRegistration => ({
  title: d.title.trim(), name: d.name.trim(), dob: d.dob, address: d.address.trim(), contact: { name: d.cName.trim(), relation: d.rel, phone: d.phone.trim() }, ...(d.plan ? { plan: d.plan } : {}),
  health: { conditions: d.conditions, diabetic: d.diabetic, food: d.food, foodOther: d.foodOther.trim(), drugs: joinDrugs(d), mobility: d.mobility === 'none' ? null : d.mobility, diet: d.diet },
  ...(regOfDraft(d.reg, d.nanny) ? { registration: regOfDraft(d.reg, d.nanny) } : {}), nanny: carerOf(d), ...(ktpFor(d.ktp, d.reg.ids, d.nanny) ? { ktp: ktpFor(d.ktp, d.reg.ids, d.nanny) } : {}), lang,
});
export const blankOnline = (): OnlineRegistration => ({ title: 'Oma', name: '', dob: '', address: '', contact: { name: '', relation: 'daughter', phone: '' }, health: EMPTY_HEALTH, lang: 'en' });

// ---------- what blocks a step ----------
/** The application form's own checks, split by the step that asks the question (same split as the staff flow's steps.ts). */
const REG_FIELDS: Record<OnlineStep, string[]> = { who: ['rtRw', 'postcode', 'regPhone', 'regMobile', 'email'], family: ['nik', 'guarantorNik'], health: [], plan: [], review: [] };

export function onlineIssues(step: OnlineStep, d: FDraft): FieldIssue[] {
  const reg = validateRegistration(regOfDraft(d.reg, d.nanny)).filter((i) => REG_FIELDS[step].includes(i.field));
  if (step === 'who') return [...(d.title.trim() ? [] : [{ field: 'title', code: 'enq.err.titleRequired' }]), ...(d.name.trim() ? [] : [{ field: 'name', code: 'err.invalid' }]), ...reg];
  if (step === 'family') {
    return [
      ...(d.cName.trim() ? [] : [{ field: 'contact', code: 'err.invalid' }]),
      ...(d.phone.replace(/\D/g, '').length >= 8 ? [] : [{ field: 'phone', code: 'err.invalid' }]),
      ...(carerOk(d) ? [] : [{ field: 'nanny', code: 'members.err.nannyNikRequired' }]),
      ...reg,
    ];
  }
  return reg;
}
/** The index of the first step that is not complete yet (the last one when all are). */
export function firstOpenOnlineStep(d: FDraft): number {
  const i = ONLINE_STEPS.findIndex((k) => onlineIssues(k, d).length > 0);
  return i < 0 ? ONLINE_STEPS.length - 1 : i;
}

// ---------- the draft on this device ----------
export const formDraftKey = (token: string) => `cp.form.${token}`;
/** `step` is 1 to 5 (as on the lead); `base` is the server's `savedAt` this copy was last in step with; `dirty` = typed since then. */
export interface DeviceDraft { d: FDraft; step: number; base: string | null; dirty: boolean }

export function loadDevice(token: string): DeviceDraft | null {
  try {
    const raw = localStorage.getItem(formDraftKey(token));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DeviceDraft> | null;
    if (!v || typeof v !== 'object' || !v.d || typeof v.d !== 'object' || typeof v.d.name !== 'string' || !v.d.reg || typeof v.d.reg !== 'object') return null;
    const b = fromOnline(blankOnline());
    return { d: { ...b, ...v.d, reg: { ...b.reg, ...v.d.reg } }, step: typeof v.step === 'number' ? Math.min(ONLINE_STEPS.length, Math.max(1, Math.round(v.step))) : 1, base: typeof v.base === 'string' ? v.base : null, dirty: v.dirty !== false };
  } catch {
    return null;
  }
}
export function saveDevice(token: string, v: DeviceDraft): void {
  try { localStorage.setItem(formDraftKey(token), JSON.stringify(v)); } catch { /* storage blocked or full: the page still works */ }
}
export function clearDevice(token: string): void {
  try { localStorage.removeItem(formDraftKey(token)); } catch { /* storage blocked */ }
}

/**
 * Which draft the page opens with: the newer of the device's and the lead's. The two clocks differ, so this goes by what each has seen: a device
 * copy wins when it holds changes not saved to the lead yet, or when the lead has nothing newer than what the device last synced (`base`); the lead's
 * wins when another phone saved after this device's last sync and this device has typed nothing since.
 */
export function pickDraft(device: DeviceDraft | null, server: { savedAt: string | null; step: number | null; draft: OnlineRegistration }): { d: FDraft; step: number | null; from: 'device' | 'server' | 'lead' } {
  if (device && (!server.savedAt || device.dirty || device.base === server.savedAt)) return { d: device.d, step: device.step, from: 'device' };
  if (server.savedAt) return { d: fromOnline(server.draft), step: server.step, from: 'server' };
  return { d: fromOnline(server.draft), step: null, from: 'lead' };
}

/** The step to open on: the saved one, but never past the first step that is still incomplete (no saved step = the first). */
export function resumeStep(d: FDraft, saved: number | null): number {
  if (!saved) return 0;
  return Math.min(saved - 1, firstOpenOnlineStep(d));
}
