// One unpaid invoice (round 14): note what the family said (outcome chips, the day they promise to pay, a note), the calls so far, and Record payment, which
// opens the same payment form the front desk and finance use on an invoice (the front desk's waits for finance, but the invoice leaves the list at once).
// A pushed full screen on phones, a bottom sheet elsewhere.
import { useState, type ReactNode } from 'react';
import { actorName, displayName, memberName, type UnpaidOutcome } from '@cp/shared';
import { callsOn, unpaidRows } from '@cp/shared/rules/unpaid';
import { Avatar, Button, Chip, DateField, GROUP_HEAD, PhoneScreen, Sheet, TextField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { memberPhoto } from '../../lib/media';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { PaymentForm } from '../finance/forms';
import { whenText } from '../members/lib';
import { lateLine, nextDateText } from './lib';

const OUTCOMES: UnpaidOutcome[] = ['promised', 'paid', 'disputed', 'noAnswer'];
const HAIR = '0.5px solid var(--hairline, #E2E2E6)';
const dm = { day: 'numeric', month: 'short' } as const;

export function UnpaidSheet({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const act = useAct();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const { role } = useMe();
  const [outcome, setOutcome] = useState<UnpaidOutcome | null>(null);
  const [promisedOn, setPromisedOn] = useState('');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const row = unpaidRows(s, today).find((r) => r.invoice.id === invoiceId);
  if (!row) return null; // paid or voided meanwhile: nothing left to chase
  const { member, invoice } = row;

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(promisedOn) && promisedOn >= today;
  const canSave = !!outcome && (outcome !== 'promised' || dateOk) && !busy;
  const save = async () => {
    if (!outcome || !canSave) return;
    setBusy(true);
    const r = await act('unpaid.call', { invoiceId, outcome, ...(outcome === 'promised' ? { promisedOn } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('unpaid.saved', { name: displayName(member) }) });
    setBusy(false);
    if (r.ok) onClose();
  };

  /** a titled box (a plain function, not a component: a component defined here would remount its inputs on every keystroke) */
  const Section = (title: ReactNode, children: ReactNode, pad: string | number = '14px 16px') => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <h2 style={{ ...GROUP_HEAD, padding: '0 16px' }}>{title}</h2>
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap: pad === 0 ? 0 : 12 }}>{children}</div>
    </section>
  );

  const summary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'Inter' }}>
      <span style={{ fontSize: 13, color: '#6B6259' }}>{t('unpaid.invoice', { number: invoice.number })}</span>
      <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{lateLine(t, row)}</span>
      <span style={{ fontSize: 14 }}>{nextDateText(t, fmt.fd, row, today, invoice.callNotes.length > 0)}</span>
    </div>
  );
  const decision = Section(t('unpaid.group.outcome'), (
    <>
      <div role="group" aria-label={t('unpaid.group.outcome')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OUTCOMES.map((o) => <Chip key={o} size={40} selected={outcome === o} onClick={() => setOutcome(o)}>{t(`unpaid.outcome.${o}`)}</Chip>)}
      </div>
      {outcome === 'promised' ? <DateField label={t('unpaid.promisedOn')} value={promisedOn} onChange={setPromisedOn} min={today} error={promisedOn && !dateOk ? t('unpaid.err.promiseDate') : false} /> : null}
      <TextField label={t('common.note')} value={note} onChange={setNote} multiline rows={2} placeholder={t('renewals.notePh')} maxLength={400} />
    </>
  ));
  const calls = [...callsOn(s, invoiceId)].reverse();
  const history = Section(t('unpaid.group.calls'), (
    calls.length ? calls.map((c, i) => (
      <div key={c.at + i} style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: i ? HAIR : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '22px' }}>{t(`unpaid.outcome.${c.outcome}`)}{c.promisedOn ? ` · ${fmt.fd(c.promisedOn, dm)}` : ''}</span>
          <span style={{ fontSize: 13, color: '#6B6259', whiteSpace: 'nowrap' }}>{whenText(fmt.fds, today, c.at, t)}</span>
        </div>
        <span style={{ fontSize: 13, color: '#6B6259' }}>{actorName(s, c.by)}</span>
        {c.note ? <span style={{ fontSize: 15, lineHeight: '21px', overflowWrap: 'anywhere' }}>{c.note}</span> : null}
      </div>
    )) : <div style={{ padding: '14px 16px', fontSize: 15, color: '#6B6259' }}>{t('unpaid.calls.none')}</div>
  ), 0);
  const pay = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div><Button variant="secondary" size={48} icon="payments" onClick={() => setPaying((v) => !v)} style={{ padding: '0 16px' }}>{t('unpaid.recordPayment')}</Button></div>
      {paying ? <PaymentForm fixed={invoice} desk={role === 'lobby'} onDone={onClose} /> : null}
    </div>
  );

  const title = t('unpaid.sheetTitle', { name: displayName(member) });
  const body = (
    <>
      {isPhone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={memberName(member)} member={member} tone={member.photoTone} src={memberPhoto(member)} size={48} />
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</h1>
        </div>
      ) : null}
      {summary}
      {pay}
      {decision}
      {history}
    </>
  );
  const saveBtn = isPhone
    ? <button type="button" className="cp-press" aria-disabled={!canSave || undefined} onClick={canSave ? save : undefined} style={{ width: '100%', height: 50, borderRadius: 999, border: 'none', background: canSave ? '#24201C' : 'var(--press, #EEEEF0)', color: canSave ? '#FFFFFF' : '#8A8078', fontSize: 16, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'Inter' }}>{t('unpaid.save')}</button>
    : <Button size={48} icon="check" disabled={!canSave} onClick={save}>{t('unpaid.save')}</Button>;

  if (isPhone) return <PhoneScreen open onClose={onClose} label={title} back={t('renewals.title')} footer={saveBtn}>{body}</PhoneScreen>;
  return <Sheet open onClose={onClose} title={title} footer={saveBtn}>{body}</Sheet>;
}
