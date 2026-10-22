// Round 13: send the live family survey to one more contact (a family who joined after it went out, or asked at the desk).
// Lists the families with the app who do not have it yet; one tap sends it. The front desk and management both use it.
import { useMemo, useState } from 'react';
import { displayName, linksOfFamily, type Survey } from '@cp/shared';
import { appFamilies } from '@cp/shared/rules/mgmt';
import { Icon, Pager, Sheet, usePaged } from '../../../components/ui';
import { useT } from '../../../lib/i18n';
import { useNow } from '../../../lib/clock';
import { useAct } from '../../../lib/act';
import { useClub } from '../../../store/replica';
import { SearchBar } from '../common';

export function SendToSheet({ sv, open, onClose }: { sv: Survey; open: boolean; onClose: () => void }) {
  const t = useT();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const [q, setQ] = useState('');
  const rows = useMemo(() => appFamilies(s, today)
    .filter((c) => !sv.recipients.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name, sub: linksOfFamily(s, c.id).filter((l) => l.appAccess && s.members[l.memberId] && !s.members[l.memberId].deletedAt).map((l) => displayName(s.members[l.memberId])).join(', ') })),
  [s, today, sv.recipients]);
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => `${r.name} ${r.sub}`.toLowerCase().includes(needle)) : rows;
  const paged = usePaged(shown, 6, q);
  const send = (id: string) => { onClose(); void act('survey.send', { surveyId: sv.id, familyId: id }, { ok: (r) => t('mgmt.svSentToT', { name: String(r.name ?? '') }) }); };
  return (
    <Sheet open={open} onClose={onClose} title={t('mgmt.svSendToTitle')}>
      <SearchBar value={q} onChange={setQ} label={t('mgmt.svSendToSearch')} placeholder={t('common.search')} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.length ? paged.rows.map((r, i) => (
          <button key={r.id} type="button" data-send-to={r.id} onClick={() => send(r.id)} className="cp-press"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 0', border: 'none', borderTop: i === 0 ? 'none' : '0.5px solid var(--hairline, #E2E2E6)', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{r.name}</span>
              {r.sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259', overflowWrap: 'anywhere' }}>{r.sub}</span> : null}
            </span>
            <Icon name="send" size={20} color="#8A8078" />
          </button>
        )) : <span style={{ padding: '12px 0', fontSize: 15, color: '#6B6259' }}>{t('mgmt.svSendToNone')}</span>}
      </div>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('mgmt.pgPick')} />
    </Sheet>
  );
}
