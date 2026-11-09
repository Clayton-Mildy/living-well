// Round 21: a contact's ratings on its sheet. Tap 1–5 stars, add an optional note, Add rating; the log below lists every rating (newest first)
// with who and when, and a delete on your own (management can delete any). Staff only: families never see ratings.
import { useState } from 'react';
import { actorName } from '@cp/shared';
import { ratingOf } from '@cp/shared/rules/directory';
import { Button, FONT_SMALL, HAIRLINE, Icon, IconButton, TextField } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
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
  const me = useMe();
  const c = s.directory[contactId];
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!c) return null;
  const sum = ratingOf(c);
  const log = [...(c.ratings ?? [])].reverse();
  const myActor = `staff:${me.id}`;
  const add = async () => {
    setTried(true);
    if (!stars || busy) return;
    setBusy(true);
    try {
      const r = await act('directory.rate', { contactId, stars, ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('finance.dir.rated') });
      if (r.ok) { setStars(0); setNote(''); setTried(false); }
    } finally { setBusy(false); }
  };
  const remove = (ratingId: string) => act('directory.unrate', { contactId, ratingId }, { ok: t('finance.dir.ratingRemoved') });
  return (
    <div data-testid="ratings" style={{ padding: '10px 0', borderTop: HAIRLINE, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#6B6259' }}>{sum ? t('finance.dir.ratingsAvg', { avg: sum.avg.toFixed(1), n: sum.n }) : t('finance.dir.ratings')}</span>
      {canRate ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="radiogroup" aria-label={t('finance.dir.yourRating')} style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={t(i === 1 ? 'finance.dir.star1' : 'finance.dir.starN', { n: i })} onClick={() => setStars(i)}
                style={{ width: 44, height: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Icon name="star" size={30} fill={i <= stars ? 1 : 0} color={i <= stars ? GOLD : '#B9B1A6'} />
              </button>
            ))}
          </div>
          {tried && !stars ? <span role="alert" style={{ fontSize: FONT_SMALL, color: '#9A3D24' }}>{t('finance.dir.pickStars')}</span> : null}
          <TextField name="ratingNote" label={t('finance.dir.ratingNote')} value={note} onChange={(v) => setNote(v.slice(0, 200))} maxLength={200} />
          <Button size={48} variant="secondary" disabled={busy} onClick={add} style={{ alignSelf: 'flex-start' }}>{t('finance.dir.addRating')}</Button>
        </div>
      ) : null}
      {log.length ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {log.map((r) => (
            <div key={r.id} data-rating-row={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderTop: HAIRLINE }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}><Stars n={r.stars} />{r.note ? <span style={{ overflowWrap: 'anywhere' }}>{r.note}</span> : null}</span>
                <span style={{ fontSize: FONT_SMALL, color: '#6B6259' }}>{actorName(s, r.by)} · {fd(r.at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {canRate && (r.by === myActor || me.role === 'mgmt' || me.realRole === 'owner') ? <IconButton icon="delete" label={t('finance.dir.ratingRemove')} bordered={false} size={36} color="#6B6259" onClick={() => void remove(r.id)} /> : null}
            </div>
          ))}
        </div>
      ) : <span style={{ fontSize: 14, color: '#6B6259' }}>{t('finance.dir.noRatings')}</span>}
    </div>
  );
}
