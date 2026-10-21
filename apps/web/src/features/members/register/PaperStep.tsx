// Step 5, the signed paper form: print it filled in, sign it, then photograph or attach it. In the demo, "Use sample form" attaches the brochure's
// application form page so the flow can be shown without a scan. Add member also ticks the other documents received.
import { useState } from 'react';
import { DOC_TYPES } from '@cp/shared/rules/members';
import { applicationDataFromInput } from '@cp/shared/rules/applicationForm';
import type { DocType } from '@cp/shared';
import { Button, ChipGroup } from '../../../components/ui';
import { uploadDocument } from '../../../lib/media';
import { say } from '../../../store/ui';
import { useDemoLogin } from '../../../shell/demoAccounts';
import { PillBtn } from '../../mgmt/common';
import { useApplicationForm } from '../ApplicationForm';
import { PaperFormField, type PaperFile } from '../PaperForm';
import { docLabel } from '../lib';
import { toCreateInput } from './submit';
import { Sec, type StepProps } from './parts';

export const SAMPLE_FORM = '/forms/application-1.jpg';

export function PaperStep({ p }: { p: StepProps }) {
  const { st, set, t, s, today, mode } = p;
  const printer = useApplicationForm();
  const demo = useDemoLogin();
  const [busy, setBusy] = useState(false);
  const onChange = (f: PaperFile | null) => set({ form: f });
  const sample = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(SAMPLE_FORM)).blob();
      onChange(await uploadDocument(blob, 'registration-form.jpg'));
    } catch {
      say(t('profile.paperFailed'), { tone: 'error', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Sec p={p} label={t('profile.paperTitle')}>
        <div><Button variant="secondary" size={44} icon="print" onClick={() => printer.open(applicationDataFromInput(s, toCreateInput(st), today))}>{t('form.printToSign')}</Button></div>
        <PaperFormField value={st.form} onChange={onChange} error={p.err('form') || undefined} />
        {demo && !st.form ? <div><PillBtn icon="description" disabled={busy} onClick={() => void sample()}>{busy ? t('profile.paperUploading') : t('reg.sample')}</PillBtn></div> : null}
      </Sec>
      {mode.kind === 'new' ? (
        <Sec p={p} label={t('profile.sec.docsNow')}>
          <ChipGroup label={t('profile.docsReceived')} multi value={st.docs} onChange={(v) => set({ docs: v as DocType[] })} options={DOC_TYPES.filter((x) => x !== 'membershipForm' && (x !== 'nannyKtp' || st.carer.nanny)).map((x) => ({ value: x, label: docLabel(t, x) }))} />
        </Sec>
      ) : null}
      {printer.node}
    </>
  );
}
