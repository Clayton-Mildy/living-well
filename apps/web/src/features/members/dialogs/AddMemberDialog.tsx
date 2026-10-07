// "Add a member" (design OvPe, mode add): the details come from the signed paper registration form, which must be attached (photo or PDF), with validation (name, date of birth, contact name and mobile,
// consent to data use; the usual arrival time is optional and informational, since members drop in on any open day). Non-management staff
// send it for review; the family contact can sign in once management approves.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtPhone, isOpen, isWeekday, live, memberName, nextOpenDay, sortBy, e164, rp, priceOn, toHM, toMin, type Diet, type DocType, type FoodAllergen, type Mobility, type Plan, type Relation, type Title } from '@cp/shared';
import { DOC_TYPES, nextMonday, validateNewMember, type FieldIssue, type NewMemberInput } from '@cp/shared/rules/members';
import { Button, ChipGroup, DateField, Dialog, Note, Toggle } from '../../../components/ui';
import { useAct } from '../../../lib/act';
import { useT } from '../../../lib/i18n';
import { useClub } from '../../../store/replica';
import { useNow } from '../../../lib/clock';
import { useMe } from '../../../lib/me';
import { docLabel } from '../lib';
import { ProfilePhotoField } from '../ProfilePhoto';
import { PaperFormField, type PaperFile } from '../PaperForm';
import { AllergyFields, DialogBody, TextField, HealthFields, MedsEditor, PeSection, OptionalTime, RelationChips, SelectField, TitleName, YesNo, joinDrugs, useDraft, type MedRow } from './forms';

interface AddDraft {
  title: Title; name: string; dob: string; address: string; usual: string; nanny: boolean; nannyName: string; spouseId: string; photo: string;
  contactMode: 'new' | 'existing'; existingId: string; contact: string; rel: Relation; phone: string; primary: boolean;
  plan: Plan; start: string;
  conditions: string[]; diabetic: boolean; meds: MedRow[]; food: FoodAllergen[]; foodOther: string; drug: string[]; drugOther: string; mobility: Mobility | 'none'; diet: Diet[]; care: string;
  docs: DocType[]; form: PaperFile | null; consentData: boolean; consentFace: boolean; note: string;
}

export function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const navigate = useNavigate();
  const { today } = useNow();
  const { role } = useMe();
  const price = priceOn(s, today);
  /** the usual arrival must fall inside opening hours: from opening up to the last minute before closing */
  const hours = { open: s.club.settings.open, last: toHM(toMin(s.club.settings.close) - 1) };
  const firstDay = useMemo(() => nextOpenDay(s, nextMonday(today), true), [s, today]);
  const [d, set] = useDraft<AddDraft>(() => ({
    title: 'Oma', name: '', dob: '', address: '', usual: '', nanny: false, nannyName: '', spouseId: '', photo: '',
    contactMode: 'new', existingId: '', contact: '', rel: 'daughter', phone: '', primary: true, plan: 'flex', start: firstDay,
    conditions: [], diabetic: false, meds: [], food: [], foodOther: '', drug: [], drugOther: '', mobility: 'none', diet: [], care: '', docs: [], form: null, consentData: false, consentFace: true, note: '',
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const contacts = sortBy(live(s.familyContacts).filter((c) => !c.review || c.review.status === 'approved'), (c) => c.name);
  const members = sortBy(live(s.members).filter((m) => !m.review || m.review.status === 'approved'), (m) => m.firstName);

  const input = (): NewMemberInput => ({
    ...(d.photo ? { photoMediaId: d.photo } : {}),
    title: d.title, name: d.name.trim(), dob: d.dob, address: d.address.trim(), usualArrival: d.usual, nanny: d.nanny ? { name: d.nannyName.trim() } : null, spouseId: d.spouseId || null,
    plan: d.plan, start: d.start,
    contact: d.contactMode === 'existing' ? { existingId: d.existingId, name: '', phone: '', relation: d.rel, primary: d.primary } : { name: d.contact.trim(), phone: d.phone.trim() ? e164(d.phone) : '', relation: d.rel, primary: d.primary },
    health: {
      conditions: d.conditions, diabetic: d.diabetic, food: d.food, foodOther: d.foodOther.trim(), drugs: joinDrugs(d), mobility: d.mobility === 'none' ? null : d.mobility, diet: d.diet,
      meds: d.meds.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), dose: x.dose.trim(), timing: x.timing })),
    },
    careInstructions: d.care.trim(), docs: d.docs.filter((x) => (x !== 'nannyKtp' || d.nanny) && x !== 'membershipForm'), formMediaId: d.form?.mediaId ?? '', formFileName: d.form?.fileName ?? '', consent: { data: d.consentData, face: d.consentFace }, ...(d.note.trim() ? { note: d.note.trim() } : {}),
  });
  const issues: FieldIssue[] = validateNewMember(input(), today).concat(d.contactMode === 'existing' && !d.existingId ? [{ field: 'contactName', code: 'members.err.contactRequired' }] : []);
  const err = (...fields: string[]) => (tried ? (() => { const i = issues.find((x) => fields.includes(x.field)); return i ? t(i.code, i.params) : ''; })() : '');
  const mgmt = role === 'mgmt';

  const submit = async () => {
    setTried(true);
    if (issues.length || busy) return;
    setBusy(true);
    const r = await act('members.create', input(), { ok: (res) => t('members.added', { n: String(d.name.trim()), id: String(res.memberId || '') }), reviewText: t('members.sentForReview') });
    setBusy(false);
    if (r.ok) {
      onClose();
      if (r.result.memberId) navigate(`/members/${String(r.result.memberId)}`);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} eyebrow={t('members.newMember')} title={t('members.addTitle')}
      footer={<><Button variant="secondary" size={48} onClick={onClose}>{t('common.cancel')}</Button><Button size={48} disabled={busy} onClick={submit}>{t('members.create')}</Button></>}>
      <DialogBody>
      {mgmt ? null : <Note>{t('members.addNoteReview')}</Note>}
      {tried && issues.length ? <Note tone="rust" icon="error">{t('err.invalid')}</Note> : null}
      <PeSection label={t('profile.sec.details')}>
        <ProfilePhotoField name={d.name ? `${d.title} ${d.name}` : '?'} value={d.photo || null} onChange={(id) => set({ photo: id || '' })} />
        <TitleName d={d} set={set} t={t} errors={{ name: err('name') }} />
        <DateField label={t('profile.f.dob')} value={d.dob} onChange={(v) => set({ dob: v })} max={today} startAt={`${+today.slice(0, 4) - 80}${today.slice(4)}`} error={err('dob')} />
        <TextField label={t('profile.f.address')} value={d.address} onChange={(v) => set({ address: v })} placeholder={t('profile.addressPh')} />
        <OptionalTime label={t('profile.f.usualOpt')} value={d.usual} onChange={(v) => set({ usual: v })} min={hours.open} max={hours.last} error={err('usualArrival')} t={t} />
        <YesNo label={t('profile.comesWithNanny')} value={d.nanny} onChange={(v) => set({ nanny: v })} t={t} />
        {d.nanny ? <TextField label={t('profile.nannyName')} value={d.nannyName} onChange={(v) => set({ nannyName: v })} error={err('nannyName')} /> : null}
        <SelectField label={t('profile.f.spouse')} value={d.spouseId} onChange={(v) => set({ spouseId: v })} placeholder={t('profile.noSpouse')} options={members.map((m) => ({ value: m.id, label: memberName(m) }))} />
      </PeSection>
      <PeSection label={t('profile.sec.contact')}>
        {contacts.length ? (
          <ChipGroup label={t('members.contactMode')} value={d.contactMode} onChange={(v) => set({ contactMode: v as 'new' | 'existing' })} options={[{ value: 'new', label: t('members.newContact') }, { value: 'existing', label: t('members.existingContact') }]} />
        ) : null}
        {d.contactMode === 'existing' ? (
          <SelectField label={t('members.pickContact')} value={d.existingId} onChange={(v) => set({ existingId: v })} placeholder={t('members.pickContactPh')} error={err('contactName')} options={contacts.map((c) => ({ value: c.id, label: `${c.name} · ${fmtPhone(c.phone)}` }))} />
        ) : (
          <>
            <TextField label={t('common.name')} value={d.contact} onChange={(v) => set({ contact: v })} error={err('contactName')} name="contact" />
            <TextField label={t('common.phone')} value={d.phone} onChange={(v) => set({ phone: v })} inputMode="tel" placeholder="+62" error={err('phone')} name="phone" />
          </>
        )}
        <RelationChips value={d.rel} onChange={(v) => set({ rel: v })} t={t} />
        <Toggle on={d.primary} onClick={() => set({ primary: !d.primary })} label={t('profile.primaryBilling')} />
      </PeSection>
      <PeSection label={t('profile.sec.plan')}>
        <ChipGroup label={t('profile.sec.plan')} value={d.plan} onChange={(v) => set({ plan: v as Plan })} options={[{ value: 'flex', label: `${t('profile.planFlex')} · ${rp(price.flex)}` }, { value: 'gold', label: `${t('profile.planGold')} · ${rp(price.gold)}` }]} />
        <div style={{ fontSize: 16, lineHeight: '22px', color: '#5E5852' }}>{d.plan === 'flex' ? t('profile.planNoteFlex', { q: s.club.settings.flexQuota, p: rp(price.extra) }) : t('profile.planNoteGold')}</div>
        <DateField label={t('profile.f.start')} value={d.start} onChange={(v) => set({ start: v })} min={today} disabledDate={(x) => !isWeekday(x) || !isOpen(s, x)} error={err('start')} />
      </PeSection>
      <PeSection label={t('profile.sec.health')}>
        <HealthFields d={d} set={set} t={t} />
        <div style={{ fontWeight: 500 }}>{t('profile.medicines')}</div>
        <MedsEditor rows={d.meds} onChange={(meds) => set({ meds })} t={t} showErrors={tried} />
      </PeSection>
      <PeSection label={t('profile.sec.allergies')}>
        <AllergyFields d={d} set={set} t={t} />
        <TextField label={t('profile.careInstructions')} value={d.care} onChange={(v) => set({ care: v })} multiline rows={3} hint={t('profile.careHint')} />
      </PeSection>
      <PeSection label={t('profile.paperTitle')}>
        <PaperFormField value={d.form} onChange={(f) => set({ form: f })} error={err('form')} />
      </PeSection>
      <PeSection label={t('profile.sec.docsNow')}>
        <ChipGroup label={t('profile.docsReceived')} multi value={d.docs} onChange={(v) => set({ docs: v as DocType[] })} options={DOC_TYPES.filter((x) => x !== 'membershipForm' && (x !== 'nannyKtp' || d.nanny)).map((x) => ({ value: x, label: docLabel(t, x) }))} />
      </PeSection>
      <PeSection label={t('profile.consentTitle')}>
        <Toggle on={d.consentData} onClick={() => set({ consentData: !d.consentData })} label={t('profile.consent.data')} sub={t('profile.consentSub.data')} />
        {err('consentData') ? <Note tone="rust" icon="error">{err('consentData')}</Note> : null}
        <Toggle on={d.consentFace} onClick={() => set({ consentFace: !d.consentFace })} label={t('profile.consent.face')} sub={t('profile.consentSub.face')} />
      </PeSection>
      {!mgmt ? <TextField label={t('profile.noteForMgmt')} value={d.note} onChange={(v) => set({ note: v })} multiline rows={2} /> : null}
      </DialogBody>
    </Dialog>
  );
}
