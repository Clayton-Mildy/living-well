// Few visits, log a call (round 17): the billing contact with Call and WhatsApp, what the family said (Reached, No answer, Staying), an optional note, and the month's
// earlier calls (who, when, outcome). A pushed full screen on phones, a bottom sheet / dialog elsewhere.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { actorName, displayName, fmtPhone, memberName, waUrl, ym } from '@cp/shared';
import { callsOf, VISIT_CALL_NOTE_MAX, VISIT_CALL_OUTCOMES } from '@cp/shared/rules/fewVisits';
import { renewalContact } from '@cp/shared/rules/renewals';
import { Avatar, Button, Chip, GROUP_HEAD, Icon, PhoneScreen, Sheet, TextField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useClub } from '../../store/replica';
import { relLabel, whenText } from '../members/lib';

const HAIR = '0.5px solid var(--hairline, #E2E2E6)';
const pill: CSSProperties = { height: 44, padding: '0 16px 0 14px', borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', cursor: 'pointer', fontFamily: 'Inter' };

export function VisitCallSheet({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const m = s.members[memberId];
  const [outcome, setOutcome] = useState<(typeof VISIT_CALL_OUTCOMES)[number] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const calls = useMemo(() => callsOf(s, memberId, ym(today)), [s, memberId, today]);
  if (!m) return null;

  const canSave = !!outcome && !busy;
  const save = async () => {
    if (!outcome || busy) return;
    setBusy(true);
    const r = await act('visitCall.log', { memberId, outcome, ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('renewals.few.saved', { name: displayName(m) }) });
    setBusy(false);
    if (r.ok) onClose();
  };

  /** a titled grey group (a plain function, not a component: a component defined here would remount its inputs on every keystroke) */
  const Section = (title: ReactNode, children: ReactNode, pad: string | number = '14px 16px') => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <h2 style={{ ...GROUP_HEAD, padding: '0 16px' }}>{title}</h2>
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap: pad === 0 ? 0 : 12 }}>{children}</div>
    </section>
  );

  const rc = renewalContact(s, memberId);
  const contact = rc ? Section(t('renewals.group.contact'), (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '22px' }}>{rc.contact.name}{` · ${relLabel(t, rc.relation)}`}</span>
        <span style={{ fontSize: 13, color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{fmtPhone(rc.contact.phone)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={`tel:${rc.contact.phone}`} className="cp-press cp-fill" style={pill}><Icon name="call" size={18} />{t('common.call')}</a>
        <a href={waUrl(rc.contact.phone)} target="_blank" rel="noreferrer" className="cp-press cp-fill" style={pill}><Icon name="chat" size={18} />{t('renewals.whatsapp')}</a>
      </div>
    </>
  )) : null;

  const decision = Section(t('renewals.few.outcome'), (
    <>
      <div role="group" aria-label={t('renewals.few.outcome')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {VISIT_CALL_OUTCOMES.map((o) => <Chip key={o} size={40} selected={outcome === o} onClick={() => setOutcome(o)}>{t(`renewals.few.${o}`)}</Chip>)}
      </div>
      <TextField label={t('common.note')} value={note} onChange={setNote} multiline rows={2} placeholder={t('renewals.notePh')} maxLength={VISIT_CALL_NOTE_MAX} />
    </>
  ));

  const earlier = calls.length ? Section(t('renewals.few.earlier'), calls.map((c, i) => (
    <div key={c.id} data-testid="few-earlier" style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: i ? HAIR : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px' }}>{t(`renewals.few.${c.outcome}`)}</span>
        <span style={{ fontSize: 13, color: '#6B6259', whiteSpace: 'nowrap' }}>{whenText(fmt.fds, today, c.at, t)}</span>
      </div>
      <span style={{ fontSize: 13, color: '#6B6259' }}>{actorName(s, c.by)}</span>
      {c.note ? <span style={{ fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{c.note}</span> : null}
    </div>
  )), 0) : null;

  const title = `${t('renewals.few.log')} · ${displayName(m)}`;
  const body = (
    <>
      {isPhone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={memberName(m)} member={m} tone={m.photoTone} src={memberPhoto(m)} size={48} open={false} />
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</h1>
        </div>
      ) : null}
      {contact}
      {decision}
      {earlier}
    </>
  );
  const saveBtn = isPhone
    ? <button type="button" className="cp-press" aria-disabled={!canSave || undefined} onClick={canSave ? save : undefined} style={{ width: '100%', height: 50, borderRadius: 999, border: 'none', background: canSave ? '#24201C' : 'var(--press, #EEEEF0)', color: canSave ? '#FFFFFF' : '#8A8078', fontSize: 16, fontWeight: 500, fontFamily: 'Inter', cursor: canSave ? 'pointer' : 'default' }}>{t('renewals.save')}</button>
    : <Button size={48} icon="check" disabled={!canSave} onClick={save}>{t('renewals.save')}</Button>;

  if (isPhone) return <PhoneScreen open onClose={onClose} label={title} back={t('renewals.few.title')} footer={saveBtn}>{body}</PhoneScreen>;
  return <Sheet open onClose={onClose} title={title} footer={saveBtn}>{body}</Sheet>;
}
