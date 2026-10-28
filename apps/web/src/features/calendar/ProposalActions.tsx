// Round 15 (phase 2): management reviews the activity team's proposed programme inside the Calendar.
// ProposalActions: Approve and Reject (a reason is required) for one programme item, a weekly version (id = the version) or a day's change (id = the date).
// They call the same approval actions as the Approvals screen, and report a conflict the same way (the item was re-sent or decided meanwhile).
// ProposedDay: the day's proposed programme, "Proposed", each session time that changes before (struck through) → after, and the actions for management.
import { useState } from 'react';
import type { ClubState } from '@cp/shared';
import { Button, Note, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { say } from '../../store/ui';
import { programmeDayView } from '../members/approvalView';

export function ProposalActions({ id }: { id: string }) {
  const t = useT();
  const act = useAct();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState('');
  const approve = async () => {
    if (busy) return;
    setBusy(true);
    setConflict('');
    const r = await act('approval.approve', { type: 'programme', ids: [id] }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    const n = Number(r.result.approved ?? 0);
    const conflicts = (r.result.conflicts as string[] | undefined)?.length ?? 0;
    if (conflicts) setConflict(t('approvals.conflictProgramme', { n: conflicts })); // the item changed or was re-sent since it was shown: nothing was approved
    else say(n ? t('approvals.approvedOne') : t('approvals.nothingDone'), { icon: n ? 'task_alt' : 'info' });
  };
  const reject = async () => {
    if (busy || !reason.trim()) return; // a rejection says why
    setBusy(true);
    setConflict('');
    const r = await act('approval.reject', { type: 'programme', ids: [id], reason: reason.trim() }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    const n = Number(r.result.rejected ?? 0);
    const conflicts = (r.result.conflicts as string[] | undefined)?.length ?? 0;
    if (conflicts) setConflict(t('approvals.conflictProgramme', { n: conflicts }));
    else { say(n ? t('approvals.rejectedOne') : t('approvals.nothingDone'), { icon: n ? 'task_alt' : 'info' }); setAsking(false); setReason(''); }
  };
  return (
    <div data-testid="proposal-actions" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {conflict ? <div data-testid="proposal-conflict"><Note tone="ochre" icon="info">{conflict}</Note></div> : null}
      {asking ? (
        <div data-testid="proposal-reason" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TextField label={t('approvals.rejectReasonOne')} value={reason} onChange={setReason} maxLength={200} autoFocus onEnter={() => void reject()} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="danger" size={44} disabled={!reason.trim() || busy} onClick={() => void reject()}>{t('approvals.rejectOne')}</Button>
            <Button variant="ghost" size={44} onClick={() => { setAsking(false); setReason(''); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size={44} disabled={busy} onClick={() => void approve()}>{t('approvals.approveOne')}</Button>
          <Button variant="secondary" size={44} disabled={busy} onClick={() => setAsking(true)}>{t('approvals.rejectOne')}</Button>
        </div>
      )}
    </div>
  );
}

/** A day with a change waiting: what it changes before → after, marked "Proposed". `decide`: management also gets Approve and Reject. */
export function ProposedDay({ s, date, decide, bare }: { s: ClubState; date: string; decide?: boolean; /** inside a sheet: no row padding or top line */ bare?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const rows = programmeDayView(s, date, t, fmt).detail.rows;
  return (
    <div data-testid="proposed-day" style={{ display: 'flex', flexDirection: 'column', gap: 10, ...(bare ? {} : { padding: '12px 16px 14px', borderTop: '0.5px solid var(--hairline, #E2E2E6)' }) }}>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#7A5510' }}>{t('cal.proposed')}</span>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline', minWidth: 0 }}>
          <span style={{ width: 54, flex: 'none', fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: '#4A4038' }}>{r.label}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
            {r.from !== undefined ? <><s style={{ color: '#8A8078' }}>{r.from}</s> → </> : null}<span style={{ fontWeight: 600 }}>{r.to}</span>
          </span>
        </div>
      ))}
      {decide ? <ProposalActions id={date} /> : null}
    </div>
  );
}
