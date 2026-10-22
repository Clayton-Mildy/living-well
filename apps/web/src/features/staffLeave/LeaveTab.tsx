// People → Leave (management): one person's balance for the year, the requests waiting for a decision (Approve / Decline with an optional note), and the year's decided ones.
import { useState } from 'react';
import type { LeaveRequest, Staff } from '@cp/shared';
import { leaveBalance, leaveOf } from '@cp/shared/rules/staffLeave';
import { Button, Group, Sheet, TextField } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { PillBtn } from '../mgmt/common';
import { LeaveRow } from './parts';

export function LeaveTab({ staff: x }: { staff: Staff }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const [declining, setDeclining] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const year = Number(today.slice(0, 4));
  const b = leaveBalance(s, x.id, year);
  const all = leaveOf(s, x.id);
  const waiting = all.filter((r) => r.status === 'pending');
  const decided = all.filter((r) => r.status !== 'pending' && Number(r.from.slice(0, 4)) >= year);
  const first = x.knownAs || x.name.split(' ')[0];
  const decide = async (r: LeaveRequest, approve: boolean, n?: string) => {
    if (busy) return;
    setBusy(true);
    const res = await act('leave.decide', { requestId: r.id, approve, ...(n ? { note: n } : {}) }, { ok: approve ? t('people.leave.approved') : t('people.leave.declined') });
    setBusy(false);
    if (res.ok) setDeclining(null);
  };
  const tile = (label: string, value: number) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: isPhone ? 28 : 'clamp(28px, 3.4vw, 40px)', lineHeight: isPhone ? '32px' : 1, fontWeight: 300, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6259' }}>{label}</span>
    </div>
  );
  return (
    <>
      <Group pad="14px 16px" gap={10}>
        <span data-testid="leave-balance" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('people.leave.left', { left: b.left, n: b.allowance })}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          {tile(t('people.leave.stLeft'), b.left)}
          {tile(t('people.leave.stUsed'), b.used)}
          {tile(t('people.leave.stWaiting'), b.waiting)}
        </div>
      </Group>
      {waiting.length ? (
        <Group title={t('people.leave.pendingTitle')} pad="2px 16px" gap={0}>
          {waiting.map((r, i) => (
            <LeaveRow key={r.id} r={r} first={i === 0}
              action={<><Button size={48} disabled={busy} onClick={() => void decide(r, true)}>{t('people.leave.approve')}</Button><Button size={48} variant="secondary" disabled={busy} onClick={() => { setNote(''); setDeclining(r); }}>{t('people.leave.decline')}</Button></>} />
          ))}
        </Group>
      ) : null}
      <Group title={t('people.leave.historyTitle')} pad="2px 16px" gap={0}>
        {decided.length ? decided.map((r, i) => (
          <LeaveRow key={r.id} r={r} first={i === 0}
            action={r.status === 'approved' && r.from > today ? <PillBtn onClick={() => void act('leave.cancel', { requestId: r.id }, { ok: t('people.leave.cancelled') })}>{t('people.leave.cancelLeave')}</PillBtn> : undefined} />
        )) : <div style={{ padding: '14px 0', fontSize: 15, color: '#6B6259' }}>{t('people.leave.none')}</div>}
      </Group>
      {declining ? (
        <Sheet open onClose={() => setDeclining(null)} title={t('people.leave.declineTitle')} maxWidth={480}>
          <TextField label={t('people.leave.declineNote', { name: first })} value={note} onChange={setNote} maxLength={200} multiline rows={2} />
          <div><Button size={48} variant="danger" disabled={busy} onClick={() => void decide(declining, false, note.trim())}>{t('people.leave.declineGo')}</Button></div>
        </Sheet>
      ) : null}
    </>
  );
}
