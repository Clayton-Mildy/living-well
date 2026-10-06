// Check-out dialog (design OvCheckout): the departure-check status (done with BP / waiting at the health station / missing,
// with "Send to health station") and the confirm. Nobody is recorded as collecting the member.
import { useState } from 'react';
import { memberShort } from '@cp/shared';
import { departureStatus } from '@cp/shared/rules/lobby';
import { Dialog, Icon } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { MemberAvatar, Stack } from './parts';

export function CheckoutDialog({ memberId, onClose, onConfirm, onAskDeparture }: { memberId: string; onClose: () => void; onConfirm: (memberId: string) => Promise<boolean>; onAskDeparture: (memberId: string) => Promise<void> }) {
  const t = useT();
  const s = useClub();
  const { today, nowMin } = useNow();
  const m = s.members[memberId];
  const [busy, setBusy] = useState(false);
  if (!m) return null;

  const dep = departureStatus(s, m.id, today, nowMin);
  const box = dep.kind === 'done' ? { bg: '#E6EFE8', fg: '#3D6B4F', icon: 'check_circle' } : { bg: '#F6ECD6', fg: '#7A5510', icon: 'visibility' };
  const depText = dep.kind === 'done'
    ? `${t('lobby.depDone', { t: dep.reading.time })}${dep.reading.sys != null ? ` ${dep.reading.sys}/${dep.reading.dia}.` : ''}`
    : dep.kind === 'waiting' ? t('lobby.depWaiting') : t('lobby.depMissing');
  const confirm = async () => {
    setBusy(true);
    const ok = await onConfirm(m.id);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={`${t('lobby.checkOut')} · ${memberShort(m)}`} maxWidth={560}>
      <Stack gap={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MemberAvatar m={m} size={56} font={20} />
          <div role="status" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: box.bg, flexWrap: 'wrap' }}>
            <Icon name={box.icon} size={24} color={box.fg} fill={1} />
            <span style={{ flex: '1 1 160px', fontSize: 16, lineHeight: '22px', color: '#282828' }}>{depText}</span>
            {dep.kind === 'missing' ? (
              <button type="button" onClick={() => void onAskDeparture(m.id)} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 'max(14px, var(--cp-body, 0px))', fontWeight: 500, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                {t('lobby.sendNurse')}
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ height: 52, padding: '0 22px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.cancel')}</button>
          <button type="button" className={busy ? undefined : 'dh83'} onClick={busy ? undefined : () => void confirm()} aria-disabled={busy || undefined}
            style={{ height: 52, padding: '0 24px', borderRadius: 999, border: 'none', background: busy ? '#E8E1D8' : '#75624B', color: busy ? '#6A6967' : '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
            {t('lobby.coConfirm')}
          </button>
        </div>
      </Stack>
    </Dialog>
  );
}
