// KC round 12: the registration state as the two actions take it — members.create (Add member) and enquiry.convert (Join a lead).
import { e164, type Enquiry, type HM, type ISODate, type MemberRegistration, type Plan } from '@cp/shared';
import type { NewMemberInput } from '@cp/shared/rules/members';
import type { ConvertIn } from '@cp/shared/actions/enquiries';
import { carerOf, joinDrugs, ktpFor, regOfDraft } from '../dialogs/forms';
import type { RegState } from './steps';

export type NewMemberFull = NewMemberInput & { registration?: MemberRegistration };

const healthOf = (st: RegState) => {
  const h = st.health;
  return { conditions: h.conditions, diabetic: h.diabetic, food: h.food, foodOther: h.foodOther.trim(), drugs: joinDrugs(h), mobility: h.mobility === 'none' ? null : h.mobility, diet: h.diet };
};

export function toCreateInput(st: RegState): NewMemberFull {
  const reg = regOfDraft(st.reg, st.carer.nanny);
  const ktp = ktpFor(st.ktp, st.reg.ids, st.carer.nanny);
  const note = st.note.trim();
  return {
    ...(st.photo ? { photoMediaId: st.photo } : {}),
    title: st.title, name: st.name.trim(), dob: st.dob, address: st.address.trim(), usualArrival: st.usual as HM | '', nanny: carerOf(st.carer), spouseId: st.spouseId || null, ...(ktp ? { ktp } : {}),
    plan: st.plan as Plan, start: st.start,
    contact: st.contactMode === 'existing'
      ? { existingId: st.existingId, name: '', phone: '', relation: st.rel, primary: st.primary }
      : { name: st.contact.trim(), phone: st.phone.trim() ? e164(st.phone) : '', relation: st.rel, primary: st.primary },
    health: { ...healthOf(st), meds: st.meds.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), dose: x.dose.trim(), timing: x.timing })) },
    careInstructions: st.care.trim(), docs: st.docs.filter((x) => (x !== 'nannyKtp' || st.carer.nanny) && x !== 'membershipForm'),
    formMediaId: st.form?.mediaId ?? '', formFileName: st.form?.fileName ?? '', consent: { data: st.consentData, face: st.consentFace },
    ...(reg ? { registration: reg } : {}), ...(note ? { note } : {}),
  };
}

export function toConvertInput(st: RegState, lead: Enquiry, plan: Plan, start: ISODate): ConvertIn {
  const reg = regOfDraft(st.reg, st.carer.nanny);
  const ktp = ktpFor(st.ktp, st.reg.ids, st.carer.nanny);
  return {
    enquiryId: lead.id, plan, start, formMediaId: st.form?.mediaId ?? '', formFileName: st.form?.fileName ?? '',
    ...(st.dob ? { dob: st.dob } : {}), ...(st.address.trim() ? { address: st.address.trim() } : {}), health: healthOf(st), ...(reg ? { registration: reg } : {}),
    nanny: carerOf(st.carer), ...(ktp ? { ktp } : {}),
  };
}

/** Join takes the senior's title and name from the lead: when they were corrected here, the lead is updated first. */
export const seniorChanged = (st: RegState, lead: Enquiry) => st.title !== lead.senior.title || st.name.trim() !== lead.senior.name;
