// Round 8: the family's photo viewer (the prototype's): black full screen, a round close button, "3 of 12" and Share on top, the picture filling the middle,
// its label and "Today · 10:42 · Oma Lina" underneath. Tap the left 40% for the previous picture and the right 60% for the next; swipe, ← → and Esc work too.
// Videos play in a real player when they have a file (its controls stay free), else the simulated one. PhotoViewer (activity) hands `audience="family"` here.
// Round 8b: the pictures sit in a strip (the neighbours just off the edges). A drag moves the strip with the finger; on letting go it slides on to the
// next or previous picture in ~250 ms, or springs back when the drag was short and slow. Taps on the zones, the ‹ › buttons and the arrow keys slide the
// same way, and a pull down closes. The state moves first (the count and label change at once); the slide is a "first, last, play" catch-up of the strip.
// On a tablet or laptop there are round ‹ › buttons at the sides and the picture fills the screen.
// KC round 9 ("too many clicks… we still need to press back"): the picture grows out of the tile that was tapped and shrinks back into it on closing;
// besides the ✕ and the pull down, a tap on the black above or below the picture and the phone's own back gesture close it.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKE, type PointerEvent as RPE, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '@cp/shared';
import { fmtDuration } from '@cp/shared/rules/activity';
import { swipeOutcome } from '@cp/shared/rules/famPhotos';
import { Icon, PhotoImg } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useLang, useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useMe } from '../../lib/me';
import { mediaUrl } from '../../lib/media';
import { savePhotos } from '../../lib/saveMedia';
import { useClub } from '../../store/replica';
import { isCatalogPhoto } from '../activity/lib';
import { famCaption } from './photoText';
import { namesOf } from './storyBits';
import { useBackClose } from './kit';

const TOP = 'env(safe-area-inset-top, 0px)';
const BOTTOM = 'env(safe-area-inset-bottom, 0px)';
const round: CSSProperties = { width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none', fontFamily: 'inherit' };
const zone: CSSProperties = { position: 'absolute', top: 0, bottom: 0, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, margin: 0, WebkitTapHighlightColor: 'transparent' };
/** The slide between two pictures: about a quarter of a second, easing out; a spring back overshoots a hair. */
const SLIDE = 'transform 250ms cubic-bezier(.22,.8,.3,1)';
const SPRING = 'transform 260ms cubic-bezier(.2,.9,.3,1.25)';

export function FamilyPhotoViewer({ photos, startId, onClose }: { photos: Photo[]; startId: string; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const lang = useLang();
  const fmt = useFmt();
  const { today } = useNow();
  const { user } = useMe();
  const { isPhone } = useDevice();

  // follow the live rows: families only ever see approved pictures that are still in their data (an activity's catalogue picture has no row of its own)
  const list = useMemo(() => photos.map((p) => s.photos[p.id] ?? p).filter((p) => isCatalogPhoto(p) || (!!s.photos[p.id] && p.visibility === 'visible' && !p.deletedAt)), [photos, s.photos]);
  const [idx, setIdx] = useState(() => Math.max(0, list.findIndex((p) => p.id === startId)));
  useEffect(() => { const k = list.findIndex((p) => p.id === startId); if (k >= 0) setIdx(k); }, [startId]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = list.length;
  const i = Math.min(idx, Math.max(0, n - 1));
  const p = list[i];
  useEffect(() => { if (!n) onClose(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const [playing, setPlaying] = useState<string | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, []);
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(toastTimer.current); }, []);

  // ---- grow out of the tile, shrink back into it (KC round 9) ----
  const [chrome, setChrome] = useState(false); // the bar, caption and arrows fade in once the picture has arrived
  const closing = useRef(false);
  /** the tile on the page that shows this picture (outside the viewer) and is on screen */
  const tileOf = (id: string): HTMLElement | null => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return Array.from(document.querySelectorAll<HTMLElement>(`[data-photo-id="${CSS.escape(id)}"]`)).find((el) => {
      if (root.current?.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    }) ?? null;
  };
  /** the strip's transform that puts the picture over the tile (as % of the stage, so the UI zoom does not matter) */
  const overTile = (tile: HTMLElement) => {
    const a = tile.getBoundingClientRect(), b = stage.current!.getBoundingClientRect();
    const tx = ((a.left + a.width / 2 - (b.left + b.width / 2)) / b.width) * 100;
    const ty = ((a.top + a.height / 2 - (b.top + b.height / 2)) / b.height) * 100;
    return `translate3d(${tx}%,${ty}%,0) scale(${Math.max(0.05, a.width / b.width)})`;
  };
  useLayoutEffect(() => {
    const el = track.current, tile = tileOf(startId);
    if (!el || !stage.current || !root.current || !tile || reduced) { setChrome(true); return; }
    root.current.dataset.anim = '1';
    stage.current.style.overflow = 'visible';
    root.current.style.background = 'rgba(0,0,0,0)';
    el.style.transition = 'none';
    el.style.transform = overTile(tile);
    void el.offsetWidth;
    el.style.transition = 'transform 260ms cubic-bezier(.2,.8,.2,1)';
    el.style.transform = 'none';
    root.current.style.transition = 'background 220ms ease-out';
    root.current.style.background = '#000000';
    const done = window.setTimeout(() => { if (stage.current) stage.current.style.overflow = 'hidden'; if (root.current) delete root.current.dataset.anim; setChrome(true); }, 270);
    return () => window.clearTimeout(done);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** close: back into the tile when it is on screen, else a quick fade */
  const closeAnimated = () => {
    if (closing.current) return;
    closing.current = true;
    const el = track.current, cur = list[Math.min(idx, Math.max(0, list.length - 1))];
    const tile = cur ? tileOf(cur.id) : null;
    if (reduced || !el || !root.current || !stage.current) { onClose(); return; }
    setChrome(false);
    root.current.style.transition = 'background 200ms ease-in, opacity 160ms ease-in';
    if (tile) {
      root.current.dataset.anim = '1';
      stage.current.style.overflow = 'visible';
      el.style.transition = 'transform 220ms cubic-bezier(.4,0,.2,1)';
      el.style.transform = overTile(tile);
      root.current.style.background = 'rgba(0,0,0,0)';
    } else {
      root.current.style.opacity = '0';
    }
    window.setTimeout(onClose, tile ? 210 : 150);
  };
  useBackClose(true, closeAnimated); // the phone's back gesture closes the viewer instead of leaving the page

  // the strip: where it is now, as a % of the stage's width (a drag or a slide in progress shows up in its box)
  const offsetPct = () => {
    const a = track.current?.getBoundingClientRect(), b = stage.current?.getBoundingClientRect();
    return a && b && b.width > 0 ? ((a.left - b.left) / b.width) * 100 : 0;
  };
  const shiftFrom = useRef(0);
  const go = (d: number) => {
    if (n < 2) return;
    clearTimeout(timer.current); setPlaying(null);
    shiftFrom.current = offsetPct() + d * 100; // the strip recentres on the new picture; start from where the old one is now, then slide to 0
    setIdx((cur) => (cur + d + n) % n);
  };
  // first, last, play: after the strip re-lays out around the new picture, put it back where the eye is and let it slide home
  useLayoutEffect(() => {
    const el = track.current, from = shiftFrom.current;
    shiftFrom.current = 0;
    if (!el) return;
    if (!from || reduced) { el.style.transition = 'none'; el.style.transform = 'none'; return; }
    el.style.transition = 'none';
    el.style.transform = `translate3d(${from}%,0,0)`;
    void el.offsetWidth; // flush, so the next change is animated
    el.style.transition = SLIDE;
    el.style.transform = 'translate3d(0,0,0)';
  }, [i]);
  const togglePlay = (x: Photo) => {
    clearTimeout(timer.current);
    if (playing === x.id) { setPlaying(null); return; }
    setPlaying(x.id);
    setPlayKey(Date.now());
    timer.current = setTimeout(() => setPlaying(null), (x.durationSec || 10) * 1000 + 300);
  };

  // dragging: sideways moves the strip, a pull down moves the whole picture (and fades the black); a quick tap is left to the zones' own buttons
  const drag = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number; dy: number } | null>(null);
  const dropClickUntil = useRef(0);
  const onDown = (e: RPE<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('video')) return; // a real video's controls stay free
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0, dy: 0 };
  };
  const onMove = (e: RPE<HTMLDivElement>) => {
    const d = drag.current, el = track.current, box = stage.current?.getBoundingClientRect();
    if (!d || !el || !box || box.width <= 0) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if ((d.axis === 'x' && n < 2) || (d.axis === 'y' && dy < 0)) { drag.current = null; return; }
      try { stage.current?.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      el.style.transition = 'none';
    }
    d.dx = dx; d.dy = dy;
    if (d.axis === 'x') el.style.transform = `translate3d(${(dx / box.width) * 100}%,0,0)`;
    else {
      const pull = Math.max(0, dy);
      el.style.transform = `translate3d(0,${(pull / box.height) * 100}%,0) scale(${1 - Math.min(0.12, pull / box.height / 3)})`;
      if (root.current) root.current.style.background = `rgba(0,0,0,${1 - Math.min(0.7, pull / box.height)})`;
    }
  };
  const onUp = (e: RPE<HTMLDivElement>) => {
    const d = drag.current, el = track.current, box = stage.current?.getBoundingClientRect();
    drag.current = null;
    if (!d?.axis || !el || !box) return;
    dropClickUntil.current = Date.now() + 160; // the click that ends a drag is not a tap
    try { stage.current?.releasePointerCapture(e.pointerId); } catch { /* none held */ }
    const r = swipeOutcome(d.dx, d.dy, performance.now() - d.t, box.width);
    if (r === 'next' || r === 'prev') { go(r === 'next' ? 1 : -1); return; }
    if (r === 'close') {
      el.style.transition = 'transform 200ms ease-in';
      el.style.transform = `translate3d(0,${Math.max(110, (d.dy / box.height) * 100 + 40)}%,0)`;
      if (root.current) { root.current.style.transition = 'background 200ms'; root.current.style.background = 'rgba(0,0,0,0)'; }
      setTimeout(() => keys.current.onClose(), reduced ? 0 : 190);
      return;
    }
    el.style.transition = reduced ? 'none' : SPRING; // short or slow: spring back
    el.style.transform = 'translate3d(0,0,0)';
    if (root.current) { root.current.style.transition = 'background 200ms'; root.current.style.background = '#000000'; }
  };
  const tapped = (d: number) => () => { if (Date.now() < dropClickUntil.current) return; go(d); };

  // focus, scroll lock, keyboard
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    root.current?.focus({ preventScroll: true }); // the viewer holds focus (no ring on the close button); Tab reaches the buttons
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; prev?.focus?.({ preventScroll: true }); };
  }, []);
  const keys = useRef({ go, onClose, closeAnimated });
  keys.current = { go, onClose, closeAnimated };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); keys.current.closeAnimated(); }
      else if (e.key === 'ArrowLeft') keys.current.go(-1);
      else if (e.key === 'ArrowRight') keys.current.go(1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  // the neighbours are loaded ahead, so a slide never waits for a picture
  useEffect(() => {
    if (n < 2) return;
    for (const k of [i - 1, i + 1]) { const x = list[(k + n) % n]; if (x?.mediaId && x.media !== 'video') new Image().src = mediaUrl(x.mediaId); }
  }, [i, n, list]);
  const trap = (e: RKE<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !root.current) return;
    const items = Array.from(root.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!p) return null;
  const plain = isCatalogPhoto(p);
  const isVideo = p.media === 'video';
  const real = isVideo && !!p.mediaId; // a recorded or uploaded clip plays in a real <video controls>
  const live1 = playing === p.id;
  const caption = famCaption(s, p, t, lang);
  // "Today · 10:42 · Oma Lina": the name only when the family has several parents, and only the parents in the picture
  const own = user?.kind === 'family' ? user.memberIds : [];
  const inIt = own.length > 1 ? p.memberIds.filter((id) => own.includes(id)).map((id) => s.members[id]).filter(Boolean) : [];
  const sub = plain ? '' : [p.date === today ? t('common.today') : fmt.fds(p.date), p.time, inIt.length ? namesOf(t, inIt) : ''].filter(Boolean).join(' · ');

  const flash = (text: string) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2800); };
  const share = async () => {
    const url = p.mediaId ? new URL(mediaUrl(p.mediaId), window.location.origin).href : undefined;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: caption, text: sub || caption, url }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url ?? [caption, sub].filter(Boolean).join(' · ')); flash(t('fphotos.shareCopied')); } catch { /* clipboard blocked */ }
  };
  // KC round 10: Save to the gallery (the share sheet's "Save Image" on a phone; a download elsewhere)
  const save = async () => {
    if (!p.mediaId || saving) return;
    setSaving(true);
    try { const r = await savePhotos([p]); if (r.how === 'download' && r.n) flash(t('fphotos.savedOne')); }
    catch { flash(t('fphotos.saveFailed')); }
    setSaving(false);
  };
  // a real video keeps its controls: the tap zones are narrow edges and stop above the player's bar
  const zones = real ? { left: '20%', right: '20%', bottom: 76 } : { left: '40%', right: '60%', bottom: 0 };
  // the strip: the previous, this and the next picture side by side (a family with two pictures has the same one on both sides)
  const slots = (n > 1 ? [-1, 0, 1] : [0]).map((pos) => ({ pos, photo: list[(i + pos + n) % n] }));
  const slide = ({ pos, photo }: { pos: number; photo: Photo }) => {
    const cur = pos === 0;
    const video = photo.media === 'video';
    const placeholder = !photo.mediaId;
    const isReal = video && !!photo.mediaId;
    return (
      <div key={n > 2 ? photo.id : `${photo.id}@${pos}`} data-slide={cur ? 'cur' : pos < 0 ? 'prev' : 'next'} aria-hidden={cur ? undefined : true}
        style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos * 100}%`, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: cur ? undefined : 'none' }}>
        <div style={placeholder ? { position: 'relative', width: 'min(92%, 560px)', maxHeight: '100%', aspectRatio: '4 / 5', borderRadius: 14, overflow: 'hidden' } : { position: 'absolute', inset: 0 }}>
          <PhotoImg photo={photo} alt={cur ? caption : ''} controls={cur && isReal} style={placeholder ? undefined : { objectFit: 'contain', background: 'transparent' }} />
          {cur && video && !isReal && live1 ? <div key={'pg' + playKey} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: '#FFFFFF', transformOrigin: 'left center', animation: `cpProg ${photo.durationSec || 10}s linear forwards`, zIndex: 2 }} /> : null}
          {video ? <span style={{ position: 'absolute', top: 10, left: 10, height: 26, padding: '0 10px', borderRadius: 999, background: 'rgba(20,16,12,.6)', color: '#FFFFFF', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>{photo.durationSec ? t('activity.videoLabel', { d: fmtDuration(photo.durationSec) }) : t('activity.video')}</span> : null}
        </div>
      </div>
    );
  };
  const side = (dir: 'prev' | 'next'): CSSProperties => ({ ...round, width: 56, height: 56, position: 'absolute', top: '50%', marginTop: -28, [dir === 'prev' ? 'left' : 'right']: 24, zIndex: 5 });

  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-label={caption} tabIndex={-1} onKeyDown={trap} data-testid="family-viewer" data-photo-id={p.id}
      onClick={(e) => { if (e.target === e.currentTarget) closeAnimated(); }} // a tap on the black above or below the picture
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000000', color: '#FFFFFF', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`.cp-view-side{background:rgba(255,255,255,.14);transition:background-color .15s ease}.cp-view-side:hover{background:rgba(255,255,255,.28)}[data-anim] [data-slide="prev"],[data-anim] [data-slide="next"]{visibility:hidden}.cp-view-chrome{transition:opacity .18s ease}`}</style>
      <div className="cp-view-chrome" style={{ position: 'absolute', top: `calc(10px + ${TOP})`, left: 12, right: 12, height: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 6, pointerEvents: 'none', opacity: chrome ? 1 : 0 }}>
        <button type="button" onClick={closeAnimated} aria-label={t('common.close')} style={{ ...round, pointerEvents: 'auto' }}><Icon name="close" size={24} /></button>
        <span data-testid="viewer-count" style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t('fphotos.viewerCount', { i: i + 1, n })}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {p.mediaId ? <button type="button" onClick={() => void save()} aria-label={t('fphotos.viewerSaveAria')} data-testid="viewer-save" aria-busy={saving || undefined} style={{ ...round, pointerEvents: 'auto' }}><Icon name={saving ? 'progress_activity' : 'download'} size={22} style={saving ? { animation: 'cpSpin 0.9s linear infinite' } : undefined} /></button> : null}
          {plain ? (p.mediaId ? null : <span style={{ width: 44, height: 44 }} />) : <button type="button" onClick={share} aria-label={t('fphotos.viewerShareAria')} style={{ ...round, pointerEvents: 'auto' }}><Icon name="ios_share" size={22} /></button>}
        </span>
      </div>

      <div ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'absolute', left: 0, right: 0, top: `calc(68px + ${TOP})`, bottom: `calc(124px + ${BOTTOM})`, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div ref={track} data-testid="viewer-strip" style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
          {slots.map(slide)}
        </div>
        {n > 1 ? (
          <>
            <button type="button" onClick={tapped(-1)} aria-label={t('activity.prevPhoto')} data-testid="viewer-prev" style={{ ...zone, left: 0, width: zones.left, bottom: zones.bottom, zIndex: 1 }} />
            <button type="button" onClick={tapped(1)} aria-label={t('activity.nextPhoto')} data-testid="viewer-next" style={{ ...zone, right: 0, width: zones.right, bottom: zones.bottom, zIndex: 1 }} />
          </>
        ) : null}
        {isVideo && !real ? ( // the simulated player's button sits over the strip (the tap zones are under it)
          <button type="button" onClick={() => togglePlay(p)} aria-label={live1 ? t('activity.pause') : t('activity.play')} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 76, height: 76, borderRadius: 999, border: 'none', background: 'rgba(40,40,40,.6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <Icon name={live1 ? 'pause' : 'play_arrow'} size={44} fill={1} color="#FFFFFF" />
          </button>
        ) : null}
      </div>
      {n > 1 && !isPhone ? (
        <>
          <button type="button" onClick={() => go(-1)} aria-label={t('activity.prevPhoto')} data-testid="viewer-arrow-prev" className="cp-view-side" style={side('prev')}><Icon name="chevron_left" size={34} weight={300} color="#FFFFFF" /></button>
          <button type="button" onClick={() => go(1)} aria-label={t('activity.nextPhoto')} data-testid="viewer-arrow-next" className="cp-view-side" style={side('next')}><Icon name="chevron_right" size={34} weight={300} color="#FFFFFF" /></button>
        </>
      ) : null}

      <div className="cp-view-chrome" style={{ position: 'absolute', left: 20, right: 20, bottom: `calc(40px + ${BOTTOM})`, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 3, pointerEvents: 'none', opacity: chrome ? 1 : 0 }}>
        <span data-testid="viewer-label" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}>{caption}</span>
        {sub ? <span data-testid="viewer-sub" style={{ fontSize: 14, color: '#BBBBBB', lineHeight: 1.4 }}>{sub}</span> : null}
      </div>

      {toast ? <div role="status" aria-live="polite" style={{ position: 'absolute', left: 16, right: 16, top: `calc(72px + ${TOP})`, display: 'flex', justifyContent: 'center', zIndex: 7, pointerEvents: 'none' }}><span style={{ padding: '11px 16px', borderRadius: 14, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontSize: 14, lineHeight: '20px', textAlign: 'center' }}>{toast}</span></div> : null}
    </div>,
    document.body,
  );
}
