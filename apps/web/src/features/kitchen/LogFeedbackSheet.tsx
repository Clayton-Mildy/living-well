// Staff log meal feedback received by phone (feedback.log): who it is about, which meal, what was said.
import { useMemo, useState } from 'react';
import { activeOn, listMembers, memberName, menuOn } from '@cp/shared';
import { Avatar, Button, Chip, DateField, Icon, Note, Pager, Sheet, TextField, usePaged } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { useResetOn } from './parts';
import { memberPhoto } from '../../lib/media';

export function LogFeedbackSheet({ open, onClose, memberId: preset }: { open: boolean; onClose: () => void; memberId?: string }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { today } = useNow();
  const [q, setQ] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [dish, setDish] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useResetOn(open, () => { if (open) { setQ(''); setMemberId(preset ?? null); setDate(today); setDish(''); setText(''); } });
  const members = useMemo(() => listMembers(s).filter((m) => activeOn(m, today) && !m.deletedAt), [s.members, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const needle = q.trim().toLocaleLowerCase();
  const found = useMemo(() => members.filter((m) => !needle || memberName(m).toLocaleLowerCase().includes(needle)), [members, needle]);
  const paged = usePaged(found, 6, needle); // searching starts again on page 1
  const shown = paged.rows;
  const picked = memberId ? s.members[memberId] : undefined;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && !Number.isNaN(Date.parse(date + 'T00:00:00Z'));
  const served = useMemo(() => {
    const m = validDate ? menuOn(s, date) : null;
    return m ? [...m.lunch, ...m.soft, ...m.tea].map((id) => s.dishes[id]?.name).filter((x): x is string => !!x) : [];
  }, [s, date, validDate]);
  const ok = !!picked && validDate && text.trim().length > 0;
  const save = async () => {
    if (!ok || busy || !memberId) return;
    setBusy(true);
    const r = await act('feedback.log', { memberId, mealDate: date, dish, text }, { ok: t('kitchen.log.done', { name: picked ? memberName(picked) : '' }) });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('kitchen.log.title')}
      footer={<Button full style={{ flex: 'none' }} onClick={save} disabled={!ok || busy} icon="call">{t('kitchen.log.save')}</Button>}>
      {picked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: '1px solid #E4DACD', borderRadius: 12 }}>
          <Avatar name={memberName(picked)} tone={picked.photoTone} src={memberPhoto(picked)} size={40} />
          <span style={{ flex: 1, fontSize: 16, fontWeight: 500 }}>{memberName(picked)}</span>
          {!preset ? <Button variant="ghost" size={44} onClick={() => setMemberId(null)}>{t('kitchen.log.change')}</Button> : null}
        </div>
      ) : (
        <>
          <TextField label={t('kitchen.log.who')} value={q} onChange={setQ} placeholder={t('kitchen.log.whoPh')} inputMode="search" />
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #E4DACD', borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
            {shown.map((m, k) => (
              <button key={m.id} type="button" onClick={() => setMemberId(m.id)} className="h-row"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', minHeight: 56, border: 'none', borderTop: k ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', width: '100%' }}>
                <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={40} />
                <span style={{ flex: 1, fontSize: 16, fontWeight: 500 }}>{memberName(m)}</span>
                <Icon name="chevron_right" size={22} color="#5E5852" />
              </button>
            ))}
            {!shown.length ? <div style={{ padding: '14px', fontSize: 16, color: '#5E5852' }}>{t('common.noResults')}</div> : null}
          </div>
          <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.log.pages')} />
        </>
      )}
      <DateField label={t('kitchen.log.meal')} value={date} onChange={setDate} max={today} error={!validDate ? t('kitchen.err.futureDate') : undefined} />
      <TextField label={t('kitchen.log.dish')} value={dish} onChange={setDish} placeholder={t('kitchen.log.dishPh')} maxLength={80} />
      {served.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{served.map((n) => <Chip key={n} size={36} selected={dish === n} onClick={() => setDish(dish === n ? '' : n)}>{n}</Chip>)}</div> : null}
      <TextField label={t('kitchen.log.text')} value={text} onChange={setText} multiline rows={3} maxLength={1000} placeholder={t('kitchen.log.textPh')} />
      <Note tone="cream" icon="call">{t('kitchen.log.note')}</Note>
    </Sheet>
  );
}
