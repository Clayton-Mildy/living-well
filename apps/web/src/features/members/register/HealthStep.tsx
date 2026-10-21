// Step 3, health: conditions, dementia (it changes the fee), mobility and diet, medicines (Add member; the nurse adds them after a Join),
// allergies, care instructions and the form's three care questions.
import { live } from '@cp/shared';
import { Note } from '../../../components/ui';
import { AllergyFields, DementiaFields, HealthFields, MedsEditor, RegCareFields, TextField } from '../dialogs/forms';
import { Sec, setRegOf, type StepProps } from './parts';

export function HealthStep({ p }: { p: StepProps }) {
  const { st, set, t, s, mode } = p;
  const setH = (x: Partial<typeof st.health>) => set({ health: { ...st.health, ...x } });
  const setReg = setRegOf(p);
  const e = mode.kind === 'lead' ? s.enquiries[mode.id] : undefined;
  const fromTrial = !!e && !e.form?.submittedAt && live(s.guestVisits).some((g) => g.enquiryId === e.id && g.kind === 'trial');
  const isNew = mode.kind === 'new';
  return (
    <>
      {fromTrial ? <Note tone="cream" icon="info">{t('enq.jn_fromTrial')}</Note> : null}
      <Sec p={p} label={t('profile.sec.health')}>
        <HealthFields d={st.health} set={setH} t={t} instead={<DementiaFields d={st.reg} set={setReg} t={t} />} />
        {isNew ? (
          <>
            <div style={{ fontWeight: 500 }}>{t('profile.medicines')}</div>
            <MedsEditor rows={st.meds} onChange={(meds) => set({ meds })} t={t} showErrors={p.tried} />
          </>
        ) : null}
      </Sec>
      <Sec p={p} label={t('profile.sec.allergies')}>
        <AllergyFields d={st.health} set={setH} t={t} />
        {isNew ? <TextField label={t('profile.careInstructions')} value={st.care} onChange={(v) => set({ care: v })} multiline rows={3} hint={t('profile.careHint')} /> : null}
      </Sec>
      <Sec p={p} label={t('profile.sec.regCare')}>
        <RegCareFields d={st.reg} set={setReg} t={t} err={p.err} dementia={false} ids={false} />
      </Sec>
    </>
  );
}
