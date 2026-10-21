// Step 2, the family: the contact who signs and pays (a lead keeps its own, shown read-only), the family member's ID, and the carer (suster).
import { fmtPhone, live, sortBy } from '@cp/shared';
import { ChipGroup, Toggle } from '../../../components/ui';
import { relLabel } from '../lib';
import { CarerFields, RelationChips, SelectField, TextField } from '../dialogs/forms';
import { DupNote, OneId, Rows, Sec, setKtpOf, type StepProps } from './parts';

export function FamilyStep({ p }: { p: StepProps }) {
  const { st, set, t, s, mode } = p;
  const contacts = sortBy(live(s.familyContacts).filter((c) => !c.review || c.review.status === 'approved'), (c) => c.name);
  return (
    <>
      <Sec p={p} label={t('profile.sec.contact')}>
        {mode.kind === 'lead' ? (
          <Rows rows={[[t('common.name'), st.contact], [t('profile.f.relation'), relLabel(t, st.rel)], [t('common.phone'), fmtPhone(st.phone)]]} />
        ) : (
          <>
            {contacts.length ? (
              <ChipGroup label={t('members.contactMode')} value={st.contactMode} onChange={(v) => set({ contactMode: v as 'new' | 'existing' })} options={[{ value: 'new', label: t('members.newContact') }, { value: 'existing', label: t('members.existingContact') }]} />
            ) : null}
            {st.contactMode === 'existing' ? (
              <SelectField label={t('members.pickContact')} value={st.existingId} onChange={(v) => set({ existingId: v })} placeholder={t('members.pickContactPh')} error={p.err('contactName')} options={contacts.map((c) => ({ value: c.id, label: `${c.name} · ${fmtPhone(c.phone)}` }))} />
            ) : (
              <>
                <TextField label={t('common.name')} value={st.contact} onChange={(v) => set({ contact: v })} error={p.err('contactName')} name="contact" />
                <TextField label={t('common.phone')} value={st.phone} onChange={(v) => set({ phone: v })} type="tel" inputMode="tel" placeholder="+62" error={p.err('phone')} name="phone" />
                <DupNote p={p} phone={st.phone} />
              </>
            )}
            <RelationChips value={st.rel} onChange={(v) => set({ rel: v })} t={t} />
            <Toggle on={st.primary} onClick={() => set({ primary: !st.primary })} label={t('profile.primaryBilling')} />
          </>
        )}
        <OneId p={p} who="guarantor" />
      </Sec>
      <Sec p={p} label={t('profile.sec.nanny')}>
        <CarerFields d={st.carer} set={(x) => set({ carer: { ...st.carer, ...x } })} t={t} tried={p.tried} ktp={st.ktp} setKtp={setKtpOf(p)} />
      </Sec>
    </>
  );
}
