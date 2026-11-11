// 11 Nov (KC): a contact's one rating on its sheet: the stars now and the latest why, and Change (Rate when unrated), which opens 1–5 stars, an
// optional why and Save. Below, the log of every change (old → new stars, why, who and when), newest first; it is fixed, nothing is removed.
// Staff only: families never see ratings.
import { useState } from 'react';
import { actorName } from '@cp/shared';
import { ratingChanges, ratingOf } from '@cp/shared/rules/directory';
import { Button, FONT_SMALL, HAIRLINE, Icon, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';

const GOLD = '#CFA550';
const Stars = ({ n, size = 15 }: { n: number; size?: number }) => (
  <span aria-hidden="true" style={{ display: 'inline-flex', gap: 1 }}>
    {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} fill={i <= n ? 1 : 0} color={i <= n ? GOLD : '#C9C2B8'} />)}
  </span>
);

export function Ratings({ contactId, canRate }: { contactId: string; canRate: boolean }) {
  const t = useT();
  const s = useClub();
  const act = useAct();
  const { fd } = useFmt();
  const c = s.directory[contactId];
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!c) return null;
  const now = ratingOf(c);
  const log = ratingChanges(c);
  const same = !!now && stars === now.stars;
  const open = () => { setEditing(true); setStars(now?.stars ?? 0); setNote(''); setTried(false); };
  const save = async () => {
    setTried(true);
    if (!stars || same || busy) return;
    setBusy(true);
    try {
      const r = await act('directory.rate', { contactId, stars, ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('finance.dir.rated') });
      if (r.ok) { setEditing(false); setTried(false); }
    } finally { setBusy(false); }
  };
  return (
    <div data-testid="ratings" style={{ padding: '10px 0', borderTop: HAIRLINE, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6259' }}>{t('finance.dir.rating')}</span>
        {canRate && !editing ? <Button size={44} variant="secondary" onClick={open} style={{ fontSize: 13 }}>{t(now ? 'finance.dir.changeRating' : 'finance.dir.rateIt')}</Button> : null}
      </div>
      {!editing ? (now ? (
        <div data-rating-now={now.stars} aria-label={t('finance.dir.ratingNow', { n: now.stars })} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Stars n={now.stars} size={24} />
          {log[0]?.note ? <span style={{ fontSize: 14, color: '#4A433D', overflowWrap: 'anywhere' }}>{log[0].note}</span> : null}
        </div>
      ) : <span style={{ fontSize: 14, color: '#6B6259' }}>{t('finance.dir.noRatings')}</span>) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="radiogroup" aria-label={t('finance.dir.yourRating')} style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={t(i === 1 ? 'finance.dir.star1' : 'finance.dir.starN', { n: i })} onClick={() => setStars(i)}
                style={{ width: 44, height: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Icon name="star" size={30} fill={i <= stars ? 1 : 0} color={i <= stars ? GOLD : '#B9B1A6'} />
              </button>
            ))}
          </div>
          {tried && (!stars || same) ? <span role="alert" style={{ fontSize: FONT_SMALL, color: '#9A3D24' }}>{t(!stars ? 'finance.dir.pickStars' : 'finance.dir.sameStars')}</span> : null}
          <TextField name="ratingNote" label={t('finance.dir.ratingWhy')} value={note} onChange={(v) => setNote(v.slice(0, 200))} maxLength={200} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size={44} variant="secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            <Button size={44} disabled={busy} onClick={save}>{t('finance.dir.saveRating')}</Button>
          </div>
        </div>
      )}
      {log.length ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#8A8078', paddingBottom: 2 }}>{t('finance.dir.ratingChanges')}</span>
          {log.map((r) => (
            <div key={r.id} data-rating-row={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderTop: HAIRLINE }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 14, lineHeight: '20px' }}>
                <span data-change={`${r.from ?? ''}>${r.stars}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, color: '#8A6A1F', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {r.from !== null ? <>{r.from}<Icon name="star" size={13} fill={1} color={GOLD} /> → </> : null}{r.stars}<Icon name="star" size={13} fill={1} color={GOLD} />
                </span>
                <span style={{ color: '#24201C', overflowWrap: 'anywhere' }}>{r.note || (r.from === null ? t('finance.dir.firstRating') : '')}</span>
              </span>
              <span style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{actorName(s, r.by)} · {fd(r.at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
