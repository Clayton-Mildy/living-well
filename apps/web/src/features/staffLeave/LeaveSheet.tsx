// Ask for leave: two dates and a reason, with the live count of club days and what is left after. The server decides; its refusals show as a toast.
import { useState } from 'react';
import { leaveBalance, leaveDaysBetween } from '@cp/shared/rules/staffLeave';
import { Button, DateField, Sheet, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { useDays } from './parts';

export function LeaveSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { id: me } = useMe();
  const { today } = useNow();
  const days = useDays();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const sameYear = !!from && !!to && from.slice(0, 4) === to.slice(0, 4);
  const n = from && to && to >= from && sameYear ? leaveDaysBetween(s, from, to) : null;
  const b = me && from ? leaveBalance(s, me, Number(from.slice(0, 4))) : null;
  const after = n !== null && b ? b.left - b.waiting - n : null;
  const ready = !!from && !!to && to >= from && !!reason.trim() && !busy;
  const send = async () => {
    if (!ready) return;
    setBusy(true);
    const r = await act('leave.request', { from, to, reason: reason.trim() }, { ok: t('people.leave.sent') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={t('people.leave.sheetTitle')} maxWidth={480}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <DateField label={t('people.leave.from')} value={from} min={today} onChange={(v) => { setFrom(v); if (!to || to < v) setTo(v); }} />
        <DateField label={t('people.leave.to')} value={to} min={from || today} onChange={setTo} />
      </div>
      {n !== null ? (
        <span data-testid="leave-count" style={{ fontSize: 15, color: after !== null && after < 0 ? '#9A3D24' : '#5E5852', lineHeight: 1.4 }}>
          {days(n)}{after !== null ? ` · ${t('people.leave.after', { n: Math.max(0, after) })}` : ''}{after !== null && after < 0 ? ` · ${t('people.err.leaveTooMany', { left: Math.max(0, b ? b.left - b.waiting : 0) })}` : ''}
        </span>
      ) : null}
      <TextField label={t('people.leave.reason')} value={reason} onChange={setReason} placeholder={t('people.leave.reasonPh')} maxLength={200} multiline rows={2} />
      <div><Button size={48} disabled={!ready} onClick={() => void send()}>{t('people.leave.send')}</Button></div>
    </Sheet>
  );
}
