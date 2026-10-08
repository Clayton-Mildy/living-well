// KC round 7: the monthly memories (/memories?member=&month=YYYY-MM): the month's best pictures as a collage, a few key numbers, favourite activities,
// how the days felt (a dot per visit day, tap to open that day's story), lunch, and kind words from the team. Few elements, big pictures, generous whitespace.
// Also the teaser card on Today.
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { memberName, memberShort, staffCall, type ISODate, type Member, type Photo, type YM } from '@cp/shared';
import { activityLabel, healthMemberOf, monthRecap, recapMonths, type MonthRecap } from '@cp/shared/rules/family';
import { Avatar, Icon, PhotoImg, photoBg } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { activityPhoto, memberPhoto } from '../../lib/media';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Cap, FamSwitch, H1, SOFT_SHADOW } from './parts';
import { MOODS, MOOD_COLOR, MOOD_INK } from './storyBits';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';

/** A soft white card (flat on a phone, like the app's grouped sections; lifted on a wider screen). */
const card = (phone: boolean, extra: CSSProperties = {}): CSSProperties => ({
  background: '#FFFFFF', borderRadius: 24, padding: phone ? '20px 18px' : '28px 28px', display: 'flex', flexDirection: 'column', gap: 18,
  boxShadow: phone ? 'none' : SOFT_SHADOW, border: phone ? 'none' : '1px solid #EFE7DC', ...extra,
});
const title = (text: string) => <h2 style={{ margin: 0, fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 500, color: '#6B6259' }}>{text}</h2>;

/** The month's best pictures as one collage: one large with up to five small (6), or one large with two (3), two, or one. */
function Collage({ photos, onOpen, label, phone }: { photos: Photo[]; onOpen: (p: Photo) => void; label: (p: Photo) => string; phone: boolean }) {
  const k = photos.length >= 6 ? 6 : photos.length >= 3 ? 3 : photos.length;
  const shown = photos.slice(0, k);
  if (!k) return null;
  const grid: CSSProperties = k === 6 ? { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', aspectRatio: '1 / 1' }
    : k === 3 ? { gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', aspectRatio: '3 / 2' }
    : k === 2 ? { gridTemplateColumns: '1fr 1fr', aspectRatio: '2 / 1' } : { gridTemplateColumns: '1fr', aspectRatio: phone ? '4 / 3' : '16 / 9' };
  return (
    <div data-testid="memories-collage" style={{ display: 'grid', gap: 4, borderRadius: 24, overflow: 'hidden', boxShadow: SOFT_SHADOW, background: '#FFFFFF', ...grid }}>
      {shown.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={label(p)} data-photo-id={p.id} className="cp-press"
          style={{ position: 'relative', border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden', background: photoBg(p.tone), minWidth: 0, minHeight: 0, ...(i === 0 && k >= 3 ? { gridRow: 'span 2', gridColumn: k === 6 ? 'span 2' : undefined } : {}) }}>
          <span style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={p} /></span>
        </button>
      ))}
    </div>
  );
}

/** Big light numbers in a row: visits, sessions joined, photos. */
function Numbers({ items }: { items: { n: number; label: string }[] }) {
  return (
    <div data-testid="memories-numbers" style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((x, i) => (
        <div key={x.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: i ? '0 0 0 16px' : '0 16px 0 0', borderLeft: i ? '1px solid #F0EAE1' : 'none', minWidth: 0 }}>
          <span style={{ fontSize: 'clamp(34px, 9vw, 44px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1.2px', color: '#2B231C', fontVariantNumeric: 'tabular-nums' }}>{x.n}</span>
          <span style={{ fontSize: 13, lineHeight: '17px', color: '#6B6259' }}>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

export function FamilyMemories() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { isPhone } = useDevice();
  const navigate = useNavigate();
  const { choices, sel, setSel, multi } = useFamilySel();
  const [sp, setSp] = useSearchParams();
  const [viewer, setViewer] = useState<{ startId: string } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const memberId = healthMemberOf(sel, choices);
  const m: Member | undefined = s.members[memberId];
  const months = useMemo(() => (m ? recapMonths(m, now.today) : []), [m, now.today]);
  const asked = sp.get('month');
  const month: YM = asked && months.includes(asked) ? asked : months[0];
  const recap: MonthRecap | null = useMemo(() => (m && month ? monthRecap(s, m, month) : null), [s, m, month]);
  if (!user || !m || !recap) return null;

  const idx = months.indexOf(month);
  const go = (mo: YM) => { const next = new URLSearchParams(sp); next.set('month', mo); setSp(next, { replace: true }); };
  const openDay = (d: ISODate) => navigate(`/today?member=${m.id}&date=${d}`);
  const n = memberShort(m);
  const monthName = fmt.fmonth(month);
  const dayLabel = (d: ISODate) => fmt.fds(d);
  const moodLabel = (mood: (typeof MOODS)[number] | null) => (mood ? t('family.mood_' + mood) : t('family.memMoodNone'));
  const photoLabel = (p: Photo) => t('family.memPhotoAria', { d: dayLabel(p.date) });
  const maxFav = Math.max(1, ...recap.favourites.map((f) => f.times));
  const presentMoods = MOODS.filter((x) => recap.moods.some((d) => d.mood === x));
  const empty = !recap.visits.length;

  return (
    <div className={isPhone ? 'cp-native' : undefined} data-testid="family-memories" data-member-id={m.id} data-month={month} style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: isPhone ? 20 : 28, maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 8 }}>
        <Cap>{t('family.memEyebrow')}</Cap>
        <H1>{t('family.memTitle', { m: monthName, n })}</H1>
      </div>
      {multi ? <FamSwitch segmented={isPhone} label={t('family.switcher')} value={m.id} onChange={setSel} items={choices.map((id) => ({ key: id, label: memberShort(s.members[id]) }))} /> : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -4 }}>
        <button type="button" onClick={() => go(months[idx + 1])} disabled={idx >= months.length - 1} aria-label={t('family.memPrev')} className="cp-press"
          style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: idx >= months.length - 1 ? 'default' : 'pointer', opacity: idx >= months.length - 1 ? 0.35 : 1 }}>
          <Icon name="chevron_left" size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} aria-live="polite">
          <span style={{ fontSize: 17, fontWeight: 500, color: '#24201C' }}>{fmt.fmonth(month, true)}</span>
          {month === now.today.slice(0, 7) ? <span style={{ fontSize: 13, color: '#6B6259' }}>{t('family.memSoFar')}</span> : null}
        </div>
        <button type="button" onClick={() => go(months[idx - 1])} disabled={idx <= 0} aria-label={t('family.memNext')} className="cp-press"
          style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: idx <= 0 ? 'default' : 'pointer', opacity: idx <= 0 ? 0.35 : 1 }}>
          <Icon name="chevron_right" size={24} />
        </button>
      </div>

      {empty ? (
        <div style={card(isPhone, { alignItems: 'center', textAlign: 'center', padding: '40px 20px' })} data-testid="memories-empty">
          <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={64} ring />
          <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 300, color: '#6B6259' }}>{t('family.memEmpty', { n, m: fmt.fmonth(month, true) })}</span>
        </div>
      ) : (
        <>
          <Collage photos={recap.best} onOpen={(p) => setViewer({ startId: p.id })} label={photoLabel} phone={isPhone} />

          <div style={card(isPhone)}>
            <Numbers items={[{ n: recap.visits.length, label: t('family.memVisits') }, { n: recap.joined, label: t('family.memJoined') }, { n: recap.photos, label: t('family.memPhotos') }]} />
          </div>

          {recap.favourites.length ? (
            <div style={card(isPhone)} data-testid="memories-favourites">
              {title(t('family.memFav'))}
              {recap.favourites.map((f) => {
                const a = s.activities[f.activityId];
                const pic = activityPhoto(a);
                return (
                  <div key={f.activityId} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: pic ? `center / cover no-repeat url("${pic}"), #F3EEE8` : '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      {pic ? null : <Icon name={a?.icon || 'interests'} size={22} color="#75624B" weight={300} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 500, color: '#24201C', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activityLabel(s, f.activityId, fmt.lang)}</span>
                        <span style={{ fontSize: 14, color: '#6B6259', whiteSpace: 'nowrap' }}>{f.times === 1 ? t('family.memTimesOne') : t('family.memTimesN', { n: f.times })}</span>
                      </div>
                      <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: '#F0EAE1', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((f.times / maxFav) * 100)}%`, background: '#75624B', borderRadius: 3 }} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={card(isPhone)} data-testid="memories-moods">
            {title(t('family.memMood'))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recap.moods.map((d) => (
                <button key={d.date} type="button" onClick={() => openDay(d.date)} aria-label={t('family.memMoodAria', { d: dayLabel(d.date), m: moodLabel(d.mood) })} data-date={d.date} data-mood={d.mood ?? ''} className="cp-press"
                  style={{ width: 38, height: 38, borderRadius: 999, border: d.mood ? 'none' : '1.5px dashed #D3C7B8', background: d.mood ? MOOD_COLOR[d.mood] : 'transparent', color: d.mood ? MOOD_INK[d.mood] : '#8A8078', fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', padding: 0, fontFamily: 'Inter' }}>
                  {+d.date.slice(8, 10)}
                </button>
              ))}
            </div>
            {presentMoods.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                {presentMoods.map((x) => (
                  <span key={x} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#6B6259' }}>
                    <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: MOOD_COLOR[x] }} />{t('family.mood_' + x)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {recap.lunch.of > 0 ? (
            <div style={card(isPhone)} data-testid="memories-lunch">
              {title(t('family.memAppetite'))}
              <span style={{ fontSize: 'clamp(18px, 4.8vw, 22px)', lineHeight: 1.35, fontWeight: 300, letterSpacing: '-0.3px', color: '#2B231C' }}>{t('family.memAppetiteLine', { a: recap.lunch.finished, b: recap.lunch.of })}</span>
              <div aria-hidden="true" style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: recap.lunch.of }, (_, i) => <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i < recap.lunch.finished ? '#3D6B4F' : '#E6DDD1' }} />)}
              </div>
            </div>
          ) : null}

          {recap.quotes.length ? (
            <div style={card(isPhone, { gap: 22 })} data-testid="memories-quotes">
              {title(t('family.memQuotes'))}
              {recap.quotes.map((q, i) => {
                const who = s.staff[q.by];
                const name = staffCall(who) || t('family.theLobby');
                return (
                  <button key={q.date} type="button" onClick={() => openDay(q.date)} aria-label={t('family.memOpenDay', { d: dayLabel(q.date) })} className="cp-press"
                    style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', border: 'none', background: 'transparent', padding: i ? '22px 0 0' : 0, borderTop: i ? '1px solid #F0EAE1' : 'none', cursor: 'pointer', fontFamily: 'Inter', width: '100%' }}>
                    <span style={{ fontSize: 'clamp(18px, 4.8vw, 22px)', lineHeight: 1.4, fontWeight: 300, letterSpacing: '-0.3px', color: '#2B231C', textWrap: 'pretty' } as CSSProperties}>{'“'}{q.text}{'”'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={name} src={memberPhoto(who)} size={26} />
                      <span style={{ fontSize: 14, color: '#6B6259' }}>{name} · {dayLabel(q.date)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <button type="button" onClick={() => navigate('/photos')} style={{ alignSelf: 'center', border: 'none', background: 'transparent', minHeight: 44, color: '#75624B', fontSize: 15, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('family.memAllPhotos')}</button>
        </>
      )}
      {viewer ? <PhotoViewer photos={recap.best} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </div>
  );
}

/** The card on Today: "October with Oma Lina" with three small pictures, opening the month's memories. Shows the month so far, else last month; nothing before the first visit. */
export function MemoriesTeaser({ m, phone }: { m: Member; phone: boolean }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const navigate = useNavigate();
  const recap = useMemo(() => {
    const months = recapMonths(m, now.today);
    for (const mo of months.slice(0, 2)) { const r = monthRecap(s, m, mo); if (r.visits.length) return r; }
    return null;
  }, [s, m, now.today]);
  if (!recap) return null;
  const tiles = Array.from({ length: 3 }, (_, i) => recap.best[i] ?? null);
  const sub = [recap.visits.length === 1 ? t('family.storyVisitsOne') : t('family.storyVisitsN', { n: recap.visits.length }), recap.photos ? (recap.photos === 1 ? t('family.phCountOne') : t('family.phCountN', { n: recap.photos })) : ''].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={() => navigate(`/memories?member=${m.id}&month=${recap.month}`)} data-testid="memories-teaser" data-month={recap.month} className="cp-press"
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', border: phone ? 'none' : '1px solid #EFE7DC', background: '#FFFFFF', borderRadius: 20, padding: phone ? '14px 14px 14px 16px' : '18px 20px 18px 24px', boxShadow: phone ? 'none' : SOFT_SHADOW, cursor: 'pointer', fontFamily: 'Inter' }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '16px' }}>{t('family.memEyebrow')}</span>
        <span style={{ fontSize: 'clamp(19px, 5vw, 22px)', lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C' }}>{t('family.memTitle', { m: fmt.fmonth(recap.month), n: memberShort(m) })}</span>
        <span style={{ fontSize: 14, lineHeight: '19px', color: '#6B6259' }}>{sub}</span>
      </span>
      <span aria-hidden="true" style={{ display: 'flex', flex: 'none' }}>
        {tiles.map((p, i) => (
          <span key={i} style={{ width: 46, height: 58, borderRadius: 14, overflow: 'hidden', marginLeft: i ? -14 : 0, boxShadow: '0 0 0 2.5px #FFFFFF', background: photoBg(p?.tone ?? (m.photoTone + i)), transform: `rotate(${(i - 1) * 4}deg)`, position: 'relative', zIndex: i }}>
            {p ? <PhotoImg photo={p} /> : null}
          </span>
        ))}
      </span>
      <Icon name="chevron_right" size={22} color="#A89C8E" />
    </button>
  );
}
