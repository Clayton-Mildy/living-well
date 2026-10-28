// Step 6, review: one group per step with an Edit link back to it, then what is confirmed before sending (Add member: the consents and a
// note for management).
import type { ReactNode } from 'react';
import { feeOf, fmtPhone, planLabel, priceOn, rp } from '@cp/shared';
import { Group, ImageOpen, Note, SignaturePad, Toggle } from '../../../components/ui';
import { mediaUrl } from '../../../lib/media';
import { PillBtn } from '../../mgmt/common';
import { useFmt } from '../../../lib/i18n';
import { foodLabel, mobLabel, relLabel } from '../lib';
import { TextField, dementiaQuestion } from '../dialogs/forms';
import { Rows, type StepProps } from './parts';
import { REG_STEPS, type RegStep } from './steps';

/**
 * `onSign`: the PNG the family member drew on the pad (null while it is empty); it is uploaded when the registration is sent (round 15).
 * `online`: KC 28 Oct, the signature they drew on the online form: shown instead of the pad, with Sign again; `changed` = answers edited here since.
 */
export function ReviewStep({ p, role, goTo, onSign, online, changed, onResign }: { p: StepProps; role: string | null; goTo: (k: RegStep) => void; onSign: (png: Blob | null) => void;
  online?: { mediaId: string; at: string; by: string }; changed?: boolean; onResign?: () => void }) {
  const { st, set, t, s, today, mode } = p;
  const { fds, fd, lang } = useFmt();
  const none = t('reg.none');
  const isNew = mode.kind === 'new';
  const mgmt = role === 'mgmt';
  const contactName = isNew && st.contactMode === 'existing' ? s.familyContacts[st.existingId]?.name ?? '' : st.contact;
  const contactPhone = isNew && st.contactMode === 'existing' ? s.familyContacts[st.existingId]?.phone ?? '' : st.phone;
  const allergies = [...st.health.food.map((x) => foodLabel(t, x)), st.health.foodOther.trim(), ...st.health.drug.map((x) => t('profile.drug.' + x)), st.health.drugOther.trim()].filter(Boolean);
  const rows: Record<Exclude<RegStep, 'review'>, [ReactNode, ReactNode][]> = {
    person: [[t('common.name'), `${st.title} ${st.name.trim()}`], [t('profile.f.called'), st.reg.nickname.trim() || none], [t('profile.f.dob'), st.dob ? fd(st.dob, { day: 'numeric', month: 'short', year: 'numeric' }) : none], [t('profile.f.address'), st.address.trim() || none]],
    family: [[t('common.name'), contactName || none], [t('profile.f.relation'), relLabel(t, st.rel)], [t('common.phone'), contactPhone ? fmtPhone(contactPhone) : none], [t('profile.sec.nanny'), st.carer.nanny ? st.carer.nannyName.trim() || none : none]],
    health: [[t('profile.f.conditions'), st.health.conditions.join(', ') || none], [t('profile.f.mobility'), mobLabel(t, st.health.mobility === 'none' ? null : st.health.mobility)], [t('profile.sec.allergies'), allergies.join(', ') || none], [dementiaQuestion(t, feeOf(priceOn(s, today), 'dementia')), st.reg.dementia === null ? none : st.reg.dementia ? <>{t('common.yes')}<span data-testid="review-dementia-fee" style={{ display: 'block', fontSize: 13, lineHeight: '19px', color: '#6B6259' }}>{t('profile.dementiaFee', { rp: rp(feeOf(priceOn(s, today), 'dementia')) })}</span></> : t('common.no')]],
    plan: [[t('enq.plan'), st.plan ? planLabel(s, st.plan, lang) : none], [t('enq.start'), st.start ? fds(st.start) : none]],
    paper: [[t('profile.paperTitle'), st.form?.fileName || (online ? t('reg.signedOnlineShort') : none)], [t('profile.f.idsShort'), st.reg.ids.filter((x) => x !== 'carer').map((x) => t('profile.ids.' + x)).join(', ') || none]],
  };
  const edit = (k: RegStep) => (
    <button type="button" onClick={() => goTo(k)} style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--accent, #75624B)', fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter' }}>{t('reg.edit')}</button>
  );
  return (
    <>
      {REG_STEPS.filter((k): k is Exclude<RegStep, 'review'> => k !== 'review').map((k) => (
        <div key={k} data-review-group={k}><Group title={t('reg.' + k)} meta={edit(k)} gap={0} pad="6px 16px"><Rows rows={rows[k]} /></Group></div>
      ))}
      <div data-review-group="confirm">
        <Group title={t('reg.confirm')}>
          <div style={{ fontSize: 14, lineHeight: '21px' }}>{t('enq.jn_regFee', { price: rp(feeOf(priceOn(s, today), 'registration')) })}</div>
          {isNew ? (
            <>
              <Toggle on={st.consentData} onClick={() => set({ consentData: !st.consentData })} label={t('profile.consent.data')} sub={t('profile.consentSub.data')} />
              {p.err('consentData') ? <Note tone="rust" icon="error">{p.err('consentData')}</Note> : null}
              <Toggle on={st.consentFace} onClick={() => set({ consentFace: !st.consentFace })} label={t('profile.consent.face')} sub={t('profile.consentSub.face')} />
              {!mgmt ? <TextField label={t('profile.noteForMgmt')} value={st.note} onChange={(v) => set({ note: v })} multiline rows={2} /> : null}
            </>
          ) : null}
          {online ? (
            <div data-reg-signed-online style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: '21px', color: '#24201C' }}>{t('reg.signedOnline', { name: online.by, date: fds(online.at.slice(0, 10)) })}</span>
              <ImageOpen src={mediaUrl(online.mediaId)} label={`${t('common.openFull')} · ${online.by}`} style={{ width: '100%', borderRadius: 12 }}>
                <img src={mediaUrl(online.mediaId)} alt={t('reg.signatureOf', { name: online.by })} data-testid="online-signature"
                  style={{ display: 'block', width: '100%', height: 120, objectFit: 'contain', background: '#FFFFFF', borderRadius: 12, boxShadow: 'inset 0 0 0 1px var(--field-bd, #E0E0E4)' }} />
              </ImageOpen>
              {changed ? <div data-testid="signed-changed"><Note tone="ochre" icon="edit_note">{t('reg.signedChanged')}</Note></div> : null}
              <div><PillBtn icon="draw" onClick={onResign}>{t('reg.signAgain')}</PillBtn></div>
            </div>
          ) : (
            <div data-reg-sign style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: '21px', color: '#24201C' }}>{t('reg.signHere', { name: contactName || t('profile.theFamily') })}</span>
              <SignaturePad onChange={onSign} label={t('sign.drawHere')} />
              <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('reg.signOptional')}</span>
              {p.issues.some((i) => i.field === 'form') ? <div data-testid="sign-or-scan"><Note tone="ochre" icon="draw">{t('reg.signOrScan')}</Note></div> : null}
            </div>
          )}
          {!mgmt ? <Note tone="ochre" icon="hourglass_top">{t(isNew ? 'members.addNoteReview' : 'enq.joinReviewNote')}</Note> : null}
        </Group>
      </div>
    </>
  );
}
