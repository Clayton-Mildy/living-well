// Round 17: set, change or clear a member's spouse from the Family tab. The same call as the Details form (members.updateDetails { spouseId }),
// so a front-desk edit goes for approval and management's applies at once. The list is the Details form's: live members, not this one, not waiting for approval.
import { useState } from 'react';
import { isPendingRow, live, memberName, sortBy } from '@cp/shared';
import { Button, Select, Sheet } from '../../../components/ui';
import type { P } from './types';

export function SpouseSheet({ p, open, onClose }: { p: P; open: boolean; onClose: () => void }) {
  const { s, m, t } = p;
  const [pick, setPick] = useState(m.spouseId || '');
  const [busy, setBusy] = useState(false);
  const members = sortBy(live(s.members).filter((x) => x.id !== m.id && !isPendingRow(x)), (x) => x.firstName);
  const save = async (spouseId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await p.act('members.updateDetails', { memberId: m.id, patch: { spouseId } }, { ok: t('profile.savedDetails', { n: memberName(m) }), reviewText: t('profile.sentForReview') });
      if (r.ok) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.spouseTitle', { n: memberName(m) })}
      footer={(
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {m.spouseId ? <Button variant="secondary" icon="link_off" disabled={busy} onClick={() => save(null)}>{t('profile.clearSpouse')}</Button> : null}
          <Button icon="check" disabled={busy || !pick || pick === m.spouseId} onClick={() => save(pick)}>{t('profile.spouseSave')}</Button>
        </div>
      )}>
      <Select label={t('profile.f.spouse')} value={pick} onChange={setPick} placeholder={t('profile.noSpouse')} searchable options={members.map((x) => ({ value: x.id, label: memberName(x) }))} />
    </Sheet>
  );
}
