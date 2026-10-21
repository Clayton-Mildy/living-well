// Round 8: the monthly memories as a full-screen story (the prototype's "October with Oma Lina"): one slide at a time over the month's pictures, with
// thin progress bars and a Share button. Every slide shows real data (the approved logs and photos behind `monthRecap`); a slide with nothing to say
// is left out. Opened from the Photos tab's carousel, or directly as the /memories page.
// Round 8b, "the Instagram way": each slide plays for 5 s while its bar fills, then the next one starts (after the last the story closes). A quick tap
// goes on (the right two thirds) or back (the left third) and restarts that slide's 5 s; press and hold pauses the clock and fades the text and buttons
// away so the whole picture shows, and letting go carries on from where it stopped. The clock also waits while the tab is hidden, the share sheet or
// its "Copied" note is up, or the family paused it (Space, or the pause button). ← → move, Esc closes. On a tablet the story is a 520px column over the picture
// blurred and darkened, with ‹ › buttons beside it; on a laptop (round 8c, the prototype's desktop) a centred 420px card over the dimmed page.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { memberName, displayName, staffCall, type Member, type Photo, type YM } from '@cp/shared';
import { activityLabel, monthRecap, type MonthRecap } from '@cp/shared/rules/family';
import { STORY_HOLD_MS, dominantMood, latestQuote, moodIsMostly, stepStoryClock, storyBackdrops, storyBarFill, storySlides, type StorySlide } from '@cp/shared/rules/famPhotos';
import { Avatar, Icon, PhotoImg, useOverlayA11y } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { memberPhoto } from '../../lib/media';
import { useBackClose, useFamWide } from './kit';
import { MOOD_COLOR, MOOD_INK } from './storyBits';
import { useFamilyCtx } from './useFamily';

const FONT = 'Inter, system-ui, sans-serif';
const TOP = 'env(safe-area-inset-top, 0px)';
const BOTTOM = 'env(safe-area-inset-bottom, 0px)';
const scrim = (a: string, b: string, c: string, d: string) => `linear-gradient(to top, ${a} 0%, ${b} ${d}, ${c} 100%)`;
/** The prototype's scrims: warm dark for most, sage for the numbers. */
const SCRIM: Record<StorySlide, string> = {
  cover: scrim('rgba(28,22,16,.9)', 'rgba(28,22,16,.3)', 'rgba(28,22,16,.5)', '55%'),
  numbers: scrim('rgba(31,61,43,.94)', 'rgba(47,90,64,.78)', 'rgba(47,90,64,.55)', '55%'),
  favourite: scrim('rgba(28,22,16,.92)', 'rgba(28,22,16,.4)', 'rgba(28,22,16,.55)', '50%'),
  moods: scrim('rgba(24,19,14,.94)', 'rgba(24,19,14,.6)', 'rgba(24,19,14,.45)', '55%'),
  lunch: scrim('rgba(24,19,14,.94)', 'rgba(24,19,14,.6)', 'rgba(24,19,14,.4)', '55%'),
  note: scrim('rgba(24,19,14,.95)', 'rgba(24,19,14,.7)', 'rgba(24,19,14,.5)', '55%'),
};
const eyebrowStyle: CSSProperties = { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, opacity: 0.85 };
const bigStyle = (size: number): CSSProperties => ({ fontSize: size, lineHeight: 1.05, fontWeight: 300, letterSpacing: '-1.2px', overflowWrap: 'anywhere', textWrap: 'pretty' } as CSSProperties);
const subStyle: CSSProperties = { fontSize: 16, lineHeight: '24px', opacity: 0.85 };
/** A quote is set smaller the longer it is, so the whole of it always fits. */
const quoteSize = (text: string) => (text.length > 220 ? 20 : text.length > 150 ? 23 : text.length > 90 ? 27 : 31);

export function MemoriesStory({ memberId, month, startSlide = 0, cover, onClose }: { memberId: string; month: YM; startSlide?: number; /** the picture the carousel card showed, so the story opens on the same one */ cover?: Photo | null; onClose: () => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const navigate = useNavigate();
  const m: Member | undefined = s.members[memberId];
  const recap: MonthRecap | null = useMemo(() => (m ? monthRecap(s, m, month) : null), [s, m, month]);
  const slides = useMemo(() => (recap ? storySlides(recap) : []), [recap]);
  const backdrops = useMemo(() => (m && recap ? storyBackdrops(s, m, recap, slides, cover) : []), [s, m, recap, slides, cover]);
  const { isPhone } = useDevice();
  const lap = useFamWide(); // a laptop: the 420px card over the dimmed page
  const [idx, setIdx] = useState(startSlide);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const { ref, trap } = useOverlayA11y(true, onClose);
  useBackClose(true, onClose); // KC round 9: the phone's back gesture closes the story
  const n = slides.length;
  const i = Math.min(Math.max(0, idx), Math.max(0, n - 1));

  // the slide's clock: the bar's fill is the time shown, out of five seconds. Held, hidden-tab, sharing, toast and manual pauses all stop it.
  const [held, setHeld] = useState(false);
  const [away, setAway] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const [sharing, setSharing] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [restart, setRestart] = useState(0);
  const reduced = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, []);
  const elapsed = useRef(0);
  const bar = useRef<HTMLSpanElement>(null);
  const paused = held || away || sharing || userPaused || !!toast;
  const goTo = (k: number) => { elapsed.current = 0; setRestart((r) => r + 1); setIdx(k); };
  const next = () => (i < n - 1 ? goTo(i + 1) : onClose());
  const prev = () => goTo(Math.max(0, i - 1));
  const keys = useRef({ next, prev, toggle: () => setUserPaused((v) => !v) });
  keys.current = { next, prev, toggle: () => setUserPaused((v) => !v) };
  const paint = useCallback(() => { if (bar.current) bar.current.style.transform = `scaleX(${reduced ? 1 : storyBarFill(0, 0, elapsed.current)})`; }, [reduced]);
  useLayoutEffect(paint, [paint, i, restart]);
  useEffect(() => {
    if (paused || !n) return;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const r = stepStoryClock(elapsed.current, now - last, true);
      last = now;
      elapsed.current = r.elapsed;
      paint();
      if (r.done) keys.current.next(); else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [paused, i, restart, n, paint]);

  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []); // the story itself holds focus (no ring on a button); Tab reaches the buttons
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') keys.current.next();
      else if (e.key === 'ArrowLeft') keys.current.prev();
      else if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button, a, input, textarea, select'))) { e.preventDefault(); keys.current.toggle(); }
    };
    const vis = () => setAway(document.visibilityState === 'hidden');
    window.addEventListener('keydown', on);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('keydown', on); document.removeEventListener('visibilitychange', vis); clearTimeout(toastTimer.current); };
  }, []);

  // press and hold: after STORY_HOLD_MS of a finger (or button) down on the picture the story pauses and the overlay fades; the click that ends a hold is dropped
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; held: boolean } | null>(null);
  const dropClickUntil = useRef(0);
  const endPress = useCallback(() => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    press.current = null;
    if (p.held) { dropClickUntil.current = Date.now() + 160; setHeld(false); }
  }, []);
  useEffect(() => () => clearTimeout(press.current?.timer), []);
  const onDown = (e: RPE<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('[data-nohold]')) return;
    endPress();
    const p = { timer: setTimeout(() => { p.held = true; setHeld(true); }, STORY_HOLD_MS), x: e.clientX, y: e.clientY, held: false };
    press.current = p;
  };
  const onMove = (e: RPE<HTMLDivElement>) => {
    const p = press.current;
    if (p && !p.held && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 14) { clearTimeout(p.timer); press.current = null; } // dragging, not holding
  };
  const tapped = (go: () => void) => () => { if (Date.now() < dropClickUntil.current) return; go(); };

  if (!m || !recap || !n) return null;

  const g = m.gender === 'f' ? 'f' : 'm';
  const names = displayName(m);
  const monthName = fmt.fmonth(month);
  const title = t('family.memTitle', { m: monthName, n: names });
  const visits = recap.visits.length;
  const visitsText = visits === 1 ? t('family.storyVisitsOne') : t('family.storyVisitsN', { n: visits });
  const photosText = recap.photos === 1 ? t('family.phCountOne') : t('family.phCountN', { n: recap.photos });
  const isNow = month === now.today.slice(0, 7);
  const coverSub = recap.photos
    ? (isNow ? t('fphotos.coverNow', { v: visitsText, p: photosText }) : t('fphotos.coverPast', { v: visitsText, p: photosText, m: monthName }))
    : (isNow ? t('fphotos.coverNowNoPics', { v: visitsText }) : t('fphotos.coverPastNoPics', { v: visitsText, m: monthName }));
  const kind = slides[i];
  const bgPhoto: Pick<Photo, 'mediaId' | 'tone'> = backdrops[i] ?? { tone: (m.photoTone || 0) + i };

  const openDay = (d: string) => navigate(`/today?date=${d}&member=${m.id}`);
  const flash = (text: string) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2800); };
  const share = async () => {
    const url = `${window.location.origin}/memories?member=${m.id}&month=${month}`;
    const text = t('fphotos.shareText', { t: title, s: coverSub });
    if (typeof navigator.share === 'function') {
      setSharing(true); // the story waits while the share sheet is up
      try { await navigator.share({ title, text, url }); } catch { /* cancelled */ } finally { setSharing(false); }
      return;
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); flash(t('fphotos.shareCopied')); } catch { /* clipboard blocked */ }
  };

  let eyebrow: string = '';
  let big: ReactNode = null;
  let size = 40;
  let sub: ReactNode = null;
  let extra: ReactNode = null;
  let dots: ReactNode = null;
  if (kind === 'cover') { eyebrow = t('family.memEyebrow'); big = title; size = 48; sub = coverSub; }
  else if (kind === 'numbers') {
    eyebrow = t('fphotos.numbersTitle_' + g);
    const rows = [{ n: visits, label: t('fphotos.numVisits') }, { n: recap.joined, label: t('fphotos.numSessions') }, { n: recap.photos, label: t('fphotos.numPhotos') }].filter((x, k) => !k || x.n > 0);
    extra = (
      <div data-testid="story-numbers" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {rows.map((x) => (
          <span key={x.label} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 84, lineHeight: 0.9, fontWeight: 300, letterSpacing: '-3px', fontVariantNumeric: 'tabular-nums' }}>{x.n}</span>
            <span style={{ fontSize: 20, fontWeight: 300, opacity: 0.85 }}>{x.label}</span>
          </span>
        ))}
      </div>
    );
  } else if (kind === 'favourite') {
    const [top, ...rest] = recap.favourites;
    eyebrow = t('fphotos.favTitle_' + g);
    const times = (k: number) => (k === 1 ? t('family.memTimesOne') : t('family.memTimesN', { n: k }));
    big = t('fphotos.favBig', { a: activityLabel(s, top.activityId, fmt.lang), t: times(top.times) });
    size = 42;
    if (rest.length) {
      const list = rest.map((f) => `${activityLabel(s, f.activityId, fmt.lang)} (${f.times})`);
      sub = t('fphotos.favThen', { l: list.length > 1 ? `${list.slice(0, -1).join(', ')} ${t('common.and')} ${list[list.length - 1]}` : list[0] });
    }
  } else if (kind === 'moods') {
    const dom = dominantMood(recap)!;
    eyebrow = t('family.memMood');
    big = moodIsMostly(recap) ? t('fphotos.mostly_' + dom) : t('fphotos.mixed');
    sub = t('fphotos.dotsHint');
    dots = (
      <div data-testid="story-moods" data-nohold="" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, pointerEvents: held ? 'none' : 'auto' }}>
        {recap.moods.map((d) => (
          <button key={d.date} type="button" onClick={() => openDay(d.date)} data-date={d.date} data-mood={d.mood ?? ''} aria-label={t('family.memMoodAria', { d: fmt.fds(d.date), m: d.mood ? t('family.mood_' + d.mood) : t('family.memMoodNone') })}
            style={{ width: 44, height: 44, border: d.mood ? 'none' : '1.5px dashed rgba(255,255,255,.55)', padding: 0, borderRadius: 999, background: d.mood ? MOOD_COLOR[d.mood] : 'transparent', color: d.mood ? MOOD_INK[d.mood] : '#FFFFFF', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: d.mood ? '0 0 0 2px rgba(255,255,255,.25)' : 'none' }}>
            {+d.date.slice(8, 10)}
          </button>
        ))}
      </div>
    );
    size = 40;
  } else if (kind === 'lunch') {
    eyebrow = t('family.memAppetite');
    big = t('family.memAppetiteLine', { a: recap.lunch.finished, b: recap.lunch.of });
    size = 38;
    sub = t('fphotos.lunchSub');
    extra = (
      <div data-testid="story-lunch" aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: recap.lunch.of }, (_, k) => <span key={k} style={{ flex: 1, height: 10, borderRadius: 5, background: k < recap.lunch.finished ? '#7FB08F' : 'rgba(255,255,255,.3)' }} />)}
      </div>
    );
  } else {
    const q = latestQuote(recap)!;
    const who = s.staff[q.by];
    eyebrow = t('fphotos.noteTitle');
    big = <>{'“'}{q.text}{'”'}</>;
    size = quoteSize(q.text);
    sub = `${staffCall(who) || t('family.theLobby')} · ${fmt.fds(q.date)}`;
  }

  const round: CSSProperties = { border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT };
  const wide = !isPhone;
  const fade: CSSProperties = { opacity: held ? 0 : 1, transition: 'opacity .2s ease', pointerEvents: held ? 'none' : undefined };
  const arrow = (dir: 'prev' | 'next'): CSSProperties => ({ ...round, position: 'absolute', top: '50%', marginTop: -26, [dir === 'prev' ? 'right' : 'left']: `calc(50% + ${lap ? 210 : 260}px + 28px)`, width: 52, height: 52, borderRadius: 999, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 });
  return createPortal(
    <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('fphotos.storyAria', { t: title })} data-testid="memories-story" data-member-id={m.id} data-month={month} data-slide={kind} data-index={i} data-paused={paused ? 'true' : 'false'} data-held={held ? 'true' : 'false'}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} onContextMenu={(e) => e.preventDefault()} onClick={(e) => { if (lap && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: lap ? 'rgba(20,16,12,.72)' : '#14100C', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: wide ? '24px 0' : 0, boxSizing: 'border-box', outline: 'none', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as CSSProperties}>
      <style>{`.cp-story-arrow{background:rgba(255,255,255,.12);opacity:.7;transition:background-color .15s ease,opacity .15s ease}.cp-story-arrow:hover{background:rgba(255,255,255,.28);opacity:1}`}</style>
      {wide && !lap ? (
        <div key={'bd' + i} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: 'cpFade .4s ease-out' }}>
          <div style={{ position: 'absolute', inset: -80, filter: 'blur(48px) brightness(.42) saturate(1.15)' }}><PhotoImg photo={bgPhoto} style={{ objectFit: 'cover' }} /></div>
        </div>
      ) : null}
      {wide ? (
        <>
          <button type="button" onClick={prev} aria-label={t('fphotos.storyPrev')} data-testid="story-arrow-prev" data-nohold="" className="cp-story-arrow" style={arrow('prev')}><Icon name="chevron_left" size={34} weight={300} color="#FFFFFF" /></button>
          <button type="button" onClick={next} aria-label={t('fphotos.storyNext')} data-testid="story-arrow-next" data-nohold="" className="cp-story-arrow" style={arrow('next')}><Icon name="chevron_right" size={34} weight={300} color="#FFFFFF" /></button>
        </>
      ) : null}
      <div style={{ position: 'relative', width: '100%', maxWidth: lap ? 420 : 520, height: '100%', maxHeight: wide ? 940 : undefined, overflow: 'hidden', borderRadius: wide ? 28 : 0, boxShadow: wide ? '0 30px 80px rgba(0,0,0,.5)' : undefined, color: '#FFFFFF', background: '#1C1610', fontFamily: FONT, zIndex: 1 }}>
        <div key={i} aria-hidden="true" style={{ position: 'absolute', inset: 0, animation: 'cpFade .3s ease-out' }}><PhotoImg photo={bgPhoto} style={{ objectFit: 'cover' }} /></div>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SCRIM[kind], ...fade }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `calc(70px + ${TOP})`, background: 'linear-gradient(to bottom, rgba(20,16,12,.34), rgba(20,16,12,0))', zIndex: 1 }} />

        <div style={{ position: 'absolute', top: `calc(16px + ${TOP})`, left: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 3 }}>
          <div aria-hidden="true" data-testid="story-bars" style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 4 }}>
            {slides.map((_, k) => (
              <span key={k} style={{ position: 'relative', height: 3, borderRadius: 2, background: 'rgba(255,255,255,.38)', overflow: 'hidden', boxShadow: '0 0 3px rgba(0,0,0,.25)' }}>
                <span ref={k === i ? bar : undefined} data-bar={k < i ? 'done' : k === i ? 'now' : 'next'} style={{ position: 'absolute', inset: 0, borderRadius: 2, background: '#FFFFFF', transformOrigin: 'left center', ...(k === i ? {} : { transform: `scaleX(${storyBarFill(k, i, 0)})` }) }} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...fade }}>
            <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={32} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            <button type="button" onClick={() => setUserPaused((v) => !v)} aria-label={userPaused ? t('fphotos.storyPlay') : t('fphotos.storyPause')} data-testid="story-pause" data-nohold="" style={{ ...round, width: 40, height: 40, borderRadius: 999, background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={userPaused ? 'play_arrow' : 'pause'} size={26} fill={1} /></button>
            <button type="button" onClick={onClose} aria-label={t('common.close')} data-testid="story-close" data-nohold="" style={{ ...round, width: 40, height: 40, borderRadius: 999, background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={28} /></button>
          </div>
        </div>

        <button type="button" onClick={tapped(prev)} aria-label={t('fphotos.storyPrev')} data-testid="story-prev" style={{ ...round, position: 'absolute', left: 0, top: `calc(100px + ${TOP})`, bottom: `calc(100px + ${BOTTOM})`, width: '33.33%', background: 'transparent', zIndex: 2, WebkitTapHighlightColor: 'transparent' }} />
        <button type="button" onClick={tapped(next)} aria-label={t('fphotos.storyNext')} data-testid="story-next" style={{ ...round, position: 'absolute', right: 0, top: `calc(100px + ${TOP})`, bottom: `calc(100px + ${BOTTOM})`, width: '66.67%', background: 'transparent', zIndex: 2, WebkitTapHighlightColor: 'transparent' }} />

        <div style={{ position: 'absolute', left: 24, right: 24, top: `calc(100px + ${TOP})`, bottom: `calc(108px + ${BOTTOM})`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16, pointerEvents: 'none', zIndex: 3, overflow: 'hidden', opacity: held ? 0 : 1, transition: 'opacity .2s ease' }}>
          <span style={eyebrowStyle}>{eyebrow}</span>
          {extra}
          {dots}
          {big ? <span data-testid="story-big" style={bigStyle(size)}>{big}</span> : null}
          {sub ? <span data-testid="story-sub" style={subStyle}>{sub}</span> : null}
        </div>

        <div style={{ position: 'absolute', left: 24, right: 24, bottom: `calc(34px + ${BOTTOM})`, display: 'flex', alignItems: 'center', gap: 10, zIndex: 3, ...fade }}>
          <button type="button" onClick={share} data-testid="story-share" data-nohold="" style={{ ...round, height: 48, padding: '0 20px', borderRadius: 999, background: '#FFFFFF', color: '#2B231C', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="ios_share" size={20} color="#2B231C" />{t('fphotos.storyShare')}
          </button>
          <span style={{ flex: 1 }} />
          <span data-testid="story-count" style={{ fontSize: 14, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{t('fphotos.storyCount', { i: i + 1, n })}</span>
        </div>

        {toast ? <div role="status" aria-live="polite" style={{ position: 'absolute', left: 24, right: 24, bottom: `calc(94px + ${BOTTOM})`, zIndex: 4, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}><span style={{ padding: '11px 16px', borderRadius: 14, background: 'rgba(20,16,12,.92)', border: '1px solid rgba(255,255,255,.2)', fontSize: 14, lineHeight: '20px', textAlign: 'center' }}>{toast}</span></div> : null}
      </div>
    </div>,
    document.body,
  );
}
