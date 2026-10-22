// Your leave: what is left this year, the request button and your own requests (Account sheet, Tasks → Mine).
import { useState } from 'react';
import { leaveBalance, leaveOf } from '@cp/shared/rules/staffLeave';
import { Button } from '../../components/ui';
import { PillBtn } from '../mgmt/common';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { LeaveSheet } from './LeaveSheet';
import { LeaveRow } from './parts';

export function MyLeave() {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { id: me } = useMe();
  const { today } = useNow();
  const [asking, setAsking] = useState(false);
  if (!me) return null;
  const year = Number(today.slice(0, 4));
  const b = leaveBalance(s, me, year);
  const mine = leaveOf(s, me).filter((r) => Number(r.from.slice(0, 4)) >= year);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span data-testid="leave-balance" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
          {t('people.leave.left', { left: b.left, n: b.allowance })}{b.waiting ? ` · ${t('people.leave.waiting', { n: b.waiting })}` : ''}
        </span>
        <Button size={48} onClick={() => setAsking(true)}>{t('people.leave.ask')}</Button>
      </div>
      {mine.map((r, i) => (
        <LeaveRow key={r.id} r={r} first={i === 0}
          action={r.status === 'pending' ? <PillBtn onClick={() => void act('leave.cancel', { requestId: r.id }, { ok: t('people.leave.cancelled') })}>{t('people.leave.cancel')}</PillBtn> : undefined} />
      ))}
      {asking ? <LeaveSheet onClose={() => setAsking(false)} /> : null}
    </div>
  );
}
