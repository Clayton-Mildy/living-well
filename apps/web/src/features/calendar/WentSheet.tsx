// Round 16 (KC): who went on a field trip. The activity team or management ticks the members; each is charged the outing's fee on their next invoice.
import { useState } from 'react';
import { approvedMembers, rp } from '@cp/shared';
import { Button, Sheet } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { MemberPicker } from '../activity/MemberPicker';

export function WentSheet({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const ev = useClub().calendarEvents[eventId ?? ''];
  return ev && eventId ? <Body key={ev.id} eventId={ev.id} onClose={onClose} /> : null;
}

function Body({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const ev = s.calendarEvents[eventId];
  const [ids, setIds] = useState<string[]>(() => ev?.wentIds ?? []);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await act('calendarEvent.setWent', { eventId, memberIds: ids }, { ok: t('cal.whoWentSaved') }); if (r.ok) onClose(); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={t('cal.whoWentTitle', { title: ev.title })} footer={<Button full disabled={busy} onClick={() => void save()}>{t('common.save')}</Button>}>
      <MemberPicker members={approvedMembers(s)} value={ids} onChange={setIds} selectedLabel={t('cal.went')} emptyLabel={t('cal.wentNone')} />
    </Sheet>
  );
}
