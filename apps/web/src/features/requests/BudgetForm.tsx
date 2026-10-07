// Budget request (design "Request from a section"): pick a section from the data, say what it is for and how much.
import { useState } from 'react';
import { fmtN, parseN } from '@cp/shared';
import { useT, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { Note } from '../../components/ui';
import { ChoiceChip, PillButton, bronzeInput, cardLabel } from '../kitchen/parts';
import { budgetRequestInput, defaultSectionId, sectionName, sectionsOf } from './finance';

export function BudgetForm({ onSent }: { onSent?: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const { role } = useMe();
  const secs = sectionsOf(s);
  const [picked, setPicked] = useState<string | null>(null);
  const [item, setItem] = useState('');
  const [amt, setAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const sectionId = picked && s.budgetSections[picked] ? picked : defaultSectionId(s, role);
  const amount = parseN(amt);
  const ok = !!sectionId && !!item.trim() && amount > 0;
  const send = async () => {
    if (!ok || busy || !sectionId) return;
    setBusy(true);
    const r = await act('budget.request', budgetRequestInput({ sectionId, item, amount }), { ok: t('requests.budget.sent') });
    setBusy(false);
    if (r.ok) { setItem(''); setAmt(''); onSent?.(); }
  };
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: '0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)', padding: '20px clamp(18px, 3vw, 32px) 24px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'cpUp .2s ease-out' }}>
      <span style={cardLabel}>{t('requests.budget.card')}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('requests.budget.section')}>
        {secs.map((x) => <ChoiceChip key={x.id} label={sectionName(s, x.id, lang)} selected={sectionId === x.id} onClick={() => setPicked(x.id)} />)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('requests.budget.item')} aria-label={t('requests.budget.itemLabel')} maxLength={80} style={{ ...bronzeInput, flex: '2 1 240px' }} />
        <input value={amt} onChange={(e) => setAmt(fmtN(e.target.value))} placeholder={t('requests.budget.amount')} aria-label={t('requests.budget.amountLabel')} inputMode="numeric" style={{ ...bronzeInput, flex: '1 1 140px' }} />
        <PillButton height={52} on={ok && !busy} onClick={send}>{t('requests.budget.send')}</PillButton>
      </div>
      {!secs.length ? <Note tone="ochre" icon="info">{t('requests.budget.noSections')}</Note> : null}
    </div>
  );
}
