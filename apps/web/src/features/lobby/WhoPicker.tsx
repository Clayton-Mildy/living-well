// "Not this person" on a face match: the desk picks who it really is from the members not in yet, then confirms as usual.
import { useState } from 'react';
import { manualCandidates } from '@cp/shared/rules/lobby';
import { memberName, type ISODate } from '@cp/shared';
import { Button, Dialog, Sheet, TextField } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { MemberAvatar } from './parts';

export function WhoPicker({ open, phone, today, exclude, onPick, onClose }: { open: boolean; phone: boolean; today: ISODate; exclude?: string; onPick: (memberId: string) => void; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const [q, setQ] = useState('');
  if (!open) return null;
  const rows = manualCandidates(s, today, q).filter((r) => r.m.id !== exclude);
  const close = () => { setQ(''); onClose(); };
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField value={q} onChange={setQ} placeholder={t('lobby.searchMember')} inputMode="search" autoFocus={!phone} />
      <div role="list" style={{ display: 'flex', flexDirection: 'column', maxHeight: phone ? '50vh' : 360, overflowY: 'auto', margin: '0 -6px' }}>
        {rows.map((r) => (
          <div key={r.m.id} role="listitem"><button type="button" onClick={() => { setQ(''); onPick(r.m.id); }} className="h-row"
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 6px', border: 'none', borderRadius: 10, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
            <MemberAvatar m={r.m} size={40} font={14} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{memberName(r.m)}</span>
              <span style={{ fontSize: 13, color: '#6B6259' }}>{t('lobby.est', { t: r.m.usualArrival })}</span>
            </span>
          </button></div>
        ))}
        {!rows.length ? <div style={{ padding: '14px 6px', fontSize: 14, color: '#6B6259' }}>{t('lobby.whoNone', { q })}</div> : null}
      </div>
      <Button variant="secondary" size={44} onClick={close}>{t('lobby.whoNobody')}</Button>
    </div>
  );
  return phone
    ? <Sheet open onClose={close} title={t('lobby.whoTitle')}>{body}</Sheet>
    : <Dialog open onClose={close} title={t('lobby.whoTitle')} maxWidth={460}>{body}</Dialog>;
}
