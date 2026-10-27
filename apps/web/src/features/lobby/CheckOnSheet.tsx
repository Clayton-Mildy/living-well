// Check on (round 12): the call sheet for a member who has not been seen for a while. The primary family contact with a tel: link,
// what the family said (chips), an optional note and "Check again on" date. Saving writes a welfare call (staff only) and the member leaves the list.
// A bottom sheet on phones, a centred dialog on wider screens (the Sheet does both).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, displayName } from '@cp/shared';
import { CARE_CALL_OUTCOMES, checkOnList } from '@cp/shared/rules/checkOn';
import { renewalContact } from '@cp/shared/rules/renewals';
import type { CareCallOutcome } from '@cp/shared';
import { Button, ChipGroup, DateField, Note, Sheet, TextField } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { CallLink, relText } from './parts';
import { useCheckOnDays } from './useCheckOnDays';

export function CheckOnSheet({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  return memberId ? <Body key={memberId} memberId={memberId} onClose={onClose} /> : null;
}

function Body({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const t = useT();
  const { fd } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const act = useAct();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<CareCallOutcome | null>(null);
  const [note, setNote] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [days] = useCheckOnDays();

  const m = s.members[memberId];
  if (!m || m.deletedAt) return null;
  const who = renewalContact(s, memberId);
  const row = checkOnList(s, today, days).find((r) => r.member.id === memberId);
  const name = displayName(m);
  const day = (d: string) => fd(d, { day: 'numeric', month: 'short' });

  const save = async () => {
    if (!outcome || busy) return;
    setBusy(true);
    const r = await act('member.logCall', { memberId, contactName: who?.contact.name ?? '', phone: who?.contact.phone ?? '', outcome, ...(note.trim() ? { note: note.trim() } : {}), ...(again ? { checkAgainOn: again } : {}) }, { silent: true });
    setBusy(false);
    if (!r.ok) return;
    if (outcome === 'wantsPause') say(t('checkOn.saved'), { action: { label: t('checkOn.recordLeave'), run: () => navigate(`/members/${memberId}/plan`) } });
    else say(t('checkOn.saved'));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={name} maxWidth={480}
      footer={<Button variant="primary" size={48} full disabled={!outcome || busy} onClick={() => void save()}>{t('checkOn.save')}</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14, lineHeight: 1.4, color: '#6B6259' }}>
          {row ? <span>{row.lastVisit ? t('checkOn.lastSeen', { date: day(row.lastVisit) }) : t('checkOn.neverSeen')} · {t(row.daysSince === 1 ? 'checkOn.day1' : 'checkOn.days', { n: row.daysSince })}</span> : null}
          {row?.lastCall ? <span>{t('checkOn.lastCall', { outcome: t('checkOn.outcome.' + row.lastCall.outcome) })} · {day(row.lastCall.date)}</span> : null}
        </div>
        {who ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{who.contact.name}</span>
              <span style={{ fontSize: 14, lineHeight: 1.4, color: '#6B6259' }}>{relText(t, who.relation)}{who.contact.phone ? ` · ${who.contact.phone}` : ''}</span>
            </span>
            {who.contact.phone ? <CallLink t={t} name={who.contact.name} phone={who.contact.phone} /> : null}
          </div>
        ) : <Note>{t('checkOn.noContact')}</Note>}
        <ChipGroup label={t('checkOn.outcomeLabel')} value={outcome} onChange={(v) => setOutcome(v as CareCallOutcome)} options={CARE_CALL_OUTCOMES.map((o) => ({ value: o, label: t('checkOn.outcome.' + o) }))} />
        <TextField value={note} onChange={setNote} placeholder={t('checkOn.notePh')} multiline rows={2} maxLength={500} />
        <DateField label={t('checkOn.again')} value={again} onChange={setAgain} min={addDays(today, 1)} clearable />
      </div>
    </Sheet>
  );
}
