// KC round 9 (the reviewer: "too many clicks… to view an image we need to click, and then press back"): pictures you see without opening anything.
// PostCard: one post of the Photos feed (like Instagram) — the pictures of one session, the lunch table or a parent's own pictures, big, swiped sideways
// (native scroll snapping, so it feels like the phone), a "2 of 5" mark and every picture as a thumbnail under it, the caption underneath. DayPhotoCards: Today's pictures as a row of
// large cards swiped sideways. A tap on a picture still opens the full-screen viewer, which grows out of it and closes with a swipe down or the back gesture.
import { useRef, useState, type CSSProperties } from 'react';
import type { Photo } from '@cp/shared';
import type { PhotoPost } from '@cp/shared/rules/famPhotos';
import { Icon, PhotoImg } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { F } from './kit';
import { famCaption, famPhotoAria } from './photoText';
import { pressProps, SelectMark, tileSelectStyle, type PhotoSelect } from './select';
import { namesOf } from './storyBits';
import { useFamilyCtx } from './useFamily';

const videoMark = (p: Photo, big?: boolean) => (p.media === 'video' ? (
  <span aria-hidden="true" style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 2, padding: big ? '4px 10px 4px 6px' : '2px 8px 2px 4px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: big ? 13 : 11, fontWeight: 600 }}>
    <Icon name="play_arrow" size={big ? 18 : 14} fill={1} />{p.durationSec ? `${Math.floor(p.durationSec / 60)}:${String(p.durationSec % 60).padStart(2, '0')}` : ''}
  </span>
) : null);
const round: CSSProperties = { position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.88)', color: '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.18)', padding: 0, zIndex: 2 };

/** One post: the pictures big and swipeable, its caption (what it was, when, and which of the family's parents are in it) under them. */
export function PostCard({ post, onOpen, wide, select }: { post: PhotoPost; onOpen: (p: Photo) => void; wide?: boolean; /** KC round 10: long press selects, for saving in bulk */ select?: PhotoSelect }) {
  const { s, t, fmt, user } = useFamilyCtx();
  const { isPhone } = useDevice();
  const strip = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const n = post.photos.length;
  const first = post.photos[0];
  const own = user?.kind === 'family' ? user.memberIds : [];
  const inIt = own.length > 1 ? own.filter((id) => post.photos.some((p) => p.memberIds.includes(id))).map((id) => s.members[id]).filter(Boolean) : [];
  const time = post.from === post.to ? post.from : `${post.from}–${post.to}`;
  const sub = [time, inIt.length ? namesOf(t, inIt) : ''].filter(Boolean).join(' · ');
  const onScroll = () => { const el = strip.current; if (el && el.clientWidth > 0) setIdx(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / el.clientWidth)))); };
  const step = (d: number) => { const el = strip.current; if (el) el.scrollBy({ left: d * el.clientWidth, behavior: 'smooth' }); };
  const go = (k: number) => { const el = strip.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); setIdx(k); };
  const bleed = isPhone; // edge to edge on a phone, like a feed
  return (
    <article data-testid="photo-post" data-post={post.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', margin: bleed ? '0 -16px' : 0 }}>
        <div ref={strip} onScroll={onScroll} className="cp-snap" style={{ display: 'flex', overflowX: n > 1 ? 'auto' : 'hidden', scrollSnapType: 'x mandatory', borderRadius: bleed ? 0 : 18, background: F.fill }}>
          {post.photos.map((p) => (
            <button key={p.id} type="button" onClick={() => (select?.on ? select.toggle(p) : onOpen(p))} aria-label={famPhotoAria(s, p, t, fmt.lang)} aria-pressed={select?.on ? select.has(p.id) : undefined} data-photo-id={p.id} data-kind={p.kind} {...pressProps(() => select?.start(p), !!select)}
              style={{ position: 'relative', flex: '0 0 100%', aspectRatio: wide ? '1 / 1' : '4 / 5', border: 'none', padding: 0, margin: 0, background: F.fill, cursor: 'pointer', overflow: 'hidden', scrollSnapAlign: 'center', ...(select ? tileSelectStyle : {}) }}>
              <PhotoImg photo={p} />
              {videoMark(p, true)}
              {select?.on ? <SelectMark selected={select.has(p.id)} size={28} left /> : null}
            </button>
          ))}
        </div>
        {n > 1 ? <span aria-hidden="true" data-testid="post-count" style={{ position: 'absolute', top: 10, right: 10, padding: '3px 9px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{t('fphotos.viewerCount', { i: idx + 1, n })}</span> : null}
        {n > 1 && !isPhone ? (
          <>
            {idx > 0 ? <button type="button" onClick={() => step(-1)} aria-label={t('activity.prevPhoto')} style={{ ...round, left: 10 }}><Icon name="chevron_left" size={24} /></button> : null}
            {idx < n - 1 ? <button type="button" onClick={() => step(1)} aria-label={t('activity.nextPhoto')} style={{ ...round, right: 10 }}><Icon name="chevron_right" size={24} /></button> : null}
          </>
        ) : null}
      </div>
      {/* KC round 9: every picture of the post as a small thumbnail under the big one (see them all at once; a tap brings that one up) */}
      {n > 1 ? (
        <div data-testid="post-thumbs" className="cp-snap cp-pillrow" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 4px' }}>
          {post.photos.map((p, k) => (
            <button key={p.id} type="button" onClick={() => go(k)} aria-label={t('fphotos.viewerCount', { i: k + 1, n })} aria-current={k === idx || undefined}
              style={{ position: 'relative', flex: '0 0 54px', height: 54, borderRadius: 10, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: F.fill, boxShadow: k === idx ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${F.ink}` : 'none', opacity: k === idx ? 1 : 0.72, transition: 'opacity .15s, box-shadow .15s', margin: 2 }}>
              <PhotoImg photo={p} />
              {p.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}><Icon name="play_arrow" size={22} fill={1} /></span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: bleed ? '0 2px' : 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: F.text, lineHeight: 1.35 }}>{famCaption(s, first, t, fmt.lang)}</span>
        {sub ? <span style={{ fontSize: 13, color: F.muted, lineHeight: 1.4 }}>{sub}</span> : null}
      </div>
    </article>
  );
}

/** Today's pictures as large cards in a row, swiped sideways; the caption sits on the picture. */
export function DayPhotoCards({ photos, onOpen, wide, testId }: { photos: Photo[]; onOpen: (p: Photo) => void; wide?: boolean; testId?: string }) {
  const { s, t, fmt } = useFamilyCtx();
  const { isPhone } = useDevice();
  return (
    <div data-testid={testId} className="cp-snap cp-pillrow" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', margin: isPhone ? '0 -16px' : 0, padding: isPhone ? '0 16px' : 0, scrollPaddingLeft: isPhone ? 16 : 0 }}>
      {photos.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={famPhotoAria(s, p, t, fmt.lang)} data-photo-id={p.id} data-kind={p.kind}
          style={{ position: 'relative', flex: wide ? '0 0 220px' : '0 0 72%', aspectRatio: '4 / 5', border: 'none', padding: 0, borderRadius: 18, overflow: 'hidden', background: F.fill, cursor: 'pointer', scrollSnapAlign: 'start' }}>
          <PhotoImg photo={p} />
          <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 12px 11px', background: 'linear-gradient(to top, rgba(20,16,12,.62), rgba(20,16,12,0))', color: '#FFFFFF', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{famCaption(s, p, t, fmt.lang)}</span>
            <span style={{ fontSize: 12, opacity: 0.9 }}>{p.media === 'video' ? `▶ ${p.time}` : p.time}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
