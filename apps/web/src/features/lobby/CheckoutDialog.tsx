// Check-out dialog (design OvCheckout): the departure-check status (done with BP / waiting at the health station / missing,
// with "Send to health station") and the confirm. Nobody is recorded as collecting the member.
import { useState } from 'react';
import { memberShort, type Face } from '@cp/shared';
import { departureStatus } from '@cp/shared/rules/lobby';
import { Dialog, Icon, MoodFaces } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { MemberAvatar, Stack } from './parts';

export function CheckoutDialog({ memberId, onClose, onConfirm, onAskDeparture }: { memberId: string; onClose: () => void; onConfirm: (memberId: string, face: Face) => Promise<boolean>; onAskDeparture: (memberId: string) => Promise<void> }) {
  const t = useT();
  const s = useClub();
  const { today, nowMin } = useNow();
  const m = s.members[memberId];
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState<Face | null>(null); // the departure face, required
  if (!m) return null;

  const dep = departureStatus(s, m.id, today, nowMin);
  const box = dep.kind === 'done' ? { bg: '#EAF1EC', fg: '#2F5A40', icon: 'check_circle' } : { bg: '#F6ECD6', fg: '#7A5510', icon: 'visibility' };
  const depText = dep.kind === 'done'
    ? `${t('lobby.depDone', { t: dep.reading.time })}${dep.reading.sys != null ? ` ${dep.reading.sys}/${dep.reading.dia}.` : ''}`
    : dep.kind === 'waiting' ? t('lobby.depWaiting') : t('lobby.depMissing');
  const off = busy || face === null;
  const confirm = async () => {
    if (face === null) return;
    setBusy(true);
    const ok = await onConfirm(m.id, face);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={`${t('lobby.checkOut')} · ${memberShort(m)}`} maxWidth={520}>
      <Stack gap={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MemberAvatar m={m} size={46} font={15} />
          <div role="status" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: box.bg, flexWrap: 'wrap' }}>
            <Icon name={box.icon} size={22} color={box.fg} fill={1} />
            <span style={{ flex: '1 1 160px', fontSize: 15, lineHeight: '21px', color: '#24201C' }}>{depText}</span>
            {dep.kind === 'missing' ? (
              <button type="button" className="h-fill cp-fill" onClick={() => void onAskDeparture(m.id)} style={{ height: 40, padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                {t('lobby.sendNurse')}
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('mood.askOut', { name: memberShort(m) })}</div>
          <MoodFaces value={face} onChange={setFace} name={memberShort(m)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="h-fill" onClick={onClose} style={{ height: 48, padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--fill, #F4F4F5)', color: '#24201C', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.cancel')}</button>
          <button type="button" data-testid="co-confirm" className={off ? undefined : 'h-bronze'} onClick={off ? undefined : () => void confirm()} aria-disabled={off || undefined}
            style={{ height: 48, padding: '0 24px', borderRadius: 12, border: 'none', background: off ? 'var(--press, #EEEEF0)' : '#24201C', color: off ? '#8A8078' : '#FFFFFF', fontSize: 15, fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
            {t('lobby.coConfirm')}
          </button>
        </div>
      </Stack>
    </Dialog>
  );
}
