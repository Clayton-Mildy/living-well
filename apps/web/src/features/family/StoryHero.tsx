// The top of Family Today (round 8, KC's immersive header): the day's best picture fills the top of the screen, the date chip and the bell float on it,
// and the parent(s) and the day sit at its foot in big light type; the white panel (day strip and the rest) slides up over it as the page scrolls.
// On a laptop (round 8b) it is a rounded card in the left column instead, as tall as the screen and sticky while the day scrolls beside it; round 8c: radius 30,
// 48px (44 for both parents, whose rows sit in two columns) title, the page's own heading above it and the day strip as six tiles under it.
// Both parents: a row each (tap to focus on one). One parent: the day's icon rail. A day the parent did not come shows the last visit's picture,
// dimmed; no picture at all is the warm bronze gradient, so a morning before the first photo never looks empty.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FACE_KEY, addDays, dayArc, flexMonth, memberName, memberShort, planOn, ym, type ISODate, type Member, type Photo } from '@cp/shared';
import { activityLabel, bestPhotoOf, eventTitle, mayStillCome, type DayStory } from '@cp/shared/rules/family';
import { railFill } from '@cp/shared/rules/famToday';
import { famPhotoDays, ownPicture } from '@cp/shared/rules/famPhotos';
import { Avatar, Icon, PhotoImg, uiZoom } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { memberPhoto } from '../../lib/media';
import { catalogPhoto } from '../activity/lib';
import { F, useFamWide } from './kit';
import { cap, dayTitle, dayWord, namesOf, stepIcon } from './storyBits';
import { useFamilyCtx } from './useFamily';

export const GRADIENT = 'linear-gradient(160deg, #B3A28A 0%, #75624B 52%, #3E3326 100%)';
/** Dark at the top (the chips stay readable on a bright photo), clear in the middle, deep at the foot behind the words. */
export const SCRIM = 'linear-gradient(to bottom, rgba(24,19,14,.5) 0%, rgba(24,19,14,0) 22%, rgba(24,19,14,0) 36%, rgba(24,19,14,.5) 58%, rgba(24,19,14,.93) 100%)';
const SCRIM_ROWS = 'linear-gradient(to bottom, rgba(24,19,14,.5) 0%, rgba(24,19,14,0) 20%, rgba(24,19,14,.2) 32%, rgba(24,19,14,.7) 52%, rgba(24,19,14,.95) 100%)';
const FROST: CSSProperties = { height: 26, padding: '0 9px', borderRadius: 999, background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6, color: '#FFFFFF', whiteSpace: 'nowrap', textTransform: 'uppercase', flex: 'none' };
/** How far the white panel below slides up over the picture. */
export const PANEL_OVERLAP = 28;
/** The picture's height: about 55–60% of a phone screen (the page is zoomed to .875 there), so the day strip and the first rows still show. */
const HERO_H = 'max(420px, min(66vh, 640px))';
/**
 * The laptop picture's height in CSS px: the window's height (the page is zoomed, so vh would fall short) less what shares the screen with it: the page's
 * padding and heading above, the day strip tiles and a little air below (~206px). About 560 at the prototype's 1280×800; never under 460 or over 860.
 */
const wideHeight = () => Math.round(Math.max(460, Math.min(860, (typeof window === 'undefined' ? 900 : window.innerHeight) / uiZoom() - 206)));
function useWideHeight(): number {
  const [h, setH] = useState(wideHeight);
  useEffect(() => {
    const on = () => setH(wideHeight());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}
const TITLE: CSSProperties = { margin: 0, fontSize: 36, lineHeight: 1.04, fontWeight: 300, letterSpacing: '-1.1px', textWrap: 'balance', overflowWrap: 'anywhere' } as CSSProperties;
/** The day's title on the picture: the page's h1 on a phone and tablet; a laptop's page heading ("Good morning, Maria") is the h1, so this is an h2 there, bigger (48, or 44 for both parents). */
function Title({ children, dual }: { children: ReactNode; dual?: boolean }) {
  const wide = useFamWide();
  if (!wide) return <h1 style={TITLE}>{children}</h1>;
  return <h2 style={{ ...TITLE, fontSize: dual ? 44 : 48, lineHeight: dual ? 1.04 : 1.02, letterSpacing: dual ? '-1.4px' : '-1.6px' }}>{children}</h2>;
}

type Ctx = ReturnType<typeof useFamilyCtx>;
type CoverPhoto = Pick<Photo, 'mediaId' | 'tone'> & { media?: Photo['media'] };
/** One picture of the opened-out card: `real` when it is a photo the viewer can open (a profile picture is not). */
interface Slide { key: string; photo: CoverPhoto; real?: Photo }
const PILL: CSSProperties = { position: 'absolute', left: 14, bottom: PANEL_OVERLAP + 22, zIndex: 2, padding: '4px 10px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
/** The card's picture: a real image (or an activity's catalogue picture), `dim` for an older visit's, `fromDay` the day it is from; `open` is what a tap shows. */
interface Cover {
  photo: CoverPhoto | null; dim: boolean; fromDay?: ISODate; open?: { photo: Photo; all: Photo[] };
  /** KC round 9: both parents' own pictures side by side */
  split?: CoverPhoto[];
  /** KC round 10: the picture(s) shown first when the card opens out (the parents' own); without it, the card's picture */
  lead?: CoverPhoto[];
}

/** The day's best picture of any of `members`; else a session's catalogue picture; else the last visit's best picture (dimmed); else none (the bronze gradient). */
function coverFor(s: Ctx['s'], members: Member[], stories: DayStory[], date: ISODate): Cover {
  const ids = members.map((m) => m.id);
  const best = bestPhotoOf(s, ids, date);
  // KC round 9 ("the main image should have the personal image for both Oma and Opa"): a parent's own picture — the newest photo staff took of
  // them on their own, else their profile picture. One parent: their picture; both: their pictures side by side. Without one, the day's picture as before.
  const mine = members.map((m) => ownPicture(s, m, date));
  // KC round 9: opened out, the picture swipes through the latest pictures of these parents — this day's first, then back over the days before
  // (their own photos, the sessions they came to, the lunch table), newest first
  const latest = famPhotoDays(s, ids).filter((d) => d.date <= date).flatMap((d) => [...d.photos].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))).filter((p) => p.media === 'photo').slice(0, 30);
  const openFirst = latest[0] ?? (best?.mediaId ? best : null);
  if (mine.length && mine.every(Boolean)) {
    const ps = mine as CoverPhoto[];
    // KC round 10 ("when it's clicked it changed to another image; it should still show the image of the person"): opened out, the parents' own pictures
    // come first and the latest pictures follow; the viewer starts on their own picture too when it is a real photo (a profile picture has no photo of its own)
    const ownReal = ps.filter((p): p is Photo => !!(p as Photo).id && !!p.mediaId);
    const all = [...ownReal, ...latest.filter((p) => !ownReal.some((o) => o.id === p.id))];
    const first = ownReal[0] ?? openFirst;
    return { photo: ps[0], dim: false, lead: ps, ...(ps.length > 1 ? { split: ps } : {}), ...(first ? { open: { photo: first, all } } : {}) };
  }
  if (best?.mediaId) return { photo: best, dim: false, open: { photo: best, all: latest } };
  for (const st of stories) {
    const a = st.heroActivityId ? s.activities[st.heroActivityId] : undefined;
    if (a?.photoMediaId) { const c = catalogPhoto(a, st.date); return { photo: c, dim: false, open: { photo: c, all: latest.length ? latest : [c] } }; }
  }
  const last = stories.map((st) => st.lastVisit).filter((d): d is ISODate => !!d).sort().pop();
  const old = last ? bestPhotoOf(s, ids, last) : null;
  if (last && old?.mediaId) return { photo: old, dim: true, fromDay: last, open: { photo: old, all: latest } };
  return { photo: null, dim: false };
}

// ---------- the words ----------
const moodOf = ({ t }: Ctx, story: DayStory) => (story.log?.mood ? t('family.mood_' + story.log.mood).toLowerCase() : '');
/** "Batik painting now": the session, lunch or tea happening at this moment. */
function nowWhat({ s, t, fmt }: Ctx, story: DayStory): string {
  const it = story.items.find((i) => i.state === 'now');
  if (!it) return '';
  const a = it.kind === 'session' ? activityLabel(s, it.activityId, fmt.lang) : it.kind === 'lunch' ? t('family.tLunch') : it.kind === 'tea' ? t('family.tTea') : it.kind === 'outing' ? eventTitle(it.event, fmt.lang) : '';
  return a ? t('ftoday.nowWhat', { a }) : '';
}
/** "Batik painting and Keroncong": up to two sessions the parent was part of. */
function highlights({ s, t, fmt }: Ctx, story: DayStory): string {
  const names = Array.from(new Set(story.sessions.filter((x) => x.took !== 'satOut').map((x) => activityLabel(s, x.activityId, fmt.lang)).filter(Boolean)));
  return names.slice(0, 2).join(` ${t('common.and')} `);
}
const join = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ');
/** KC round 9: the plan under the name: "Gold plan", or "Flex plan · 7 of 10 used" this month. */
function planLine({ s, t, now }: Ctx, m: Member): string {
  if (planOn(m, now.today).plan !== 'flex') return t('ftoday.heroPlanGold');
  const f = flexMonth(s, m, ym(now.today), now.today);
  const q = f.quota ?? s.club.settings.flexQuota;
  return f.extra ? t('ftoday.heroPlanFlexExtra', { q, x: f.extra }) : t('ftoday.heroPlanFlex', { n: f.used, q });
}

/** A row of the both-parents card: who, where they are, and how far the day has got. */
function rowText(c: Ctx, m: Member, story: DayStory) {
  const { t, fmt, now } = c;
  const n = memberShort(m);
  const st = story.state;
  const isToday = story.date === now.today;
  const span = story.arrivedAt && story.leftAt ? `${story.arrivedAt}–${story.leftAt}` : story.arrivedAt || '';
  if (st.kind === 'here' && isToday) return { title: t('ftoday.rowHere', { n }), sub: join([t('ftoday.since', { t: st.since }), nowWhat(c, story), moodOf(c, story)]), pct: Math.round(railFill(story.items.map((i) => i.state)) * 100) };
  if (st.kind === 'home' && isToday) return { title: t('ftoday.rowWentHome', { n }), sub: join([span, moodOf(c, story)]), pct: 100 };
  if (st.kind === 'here' || st.kind === 'home') return { title: t('ftoday.rowCame', { n, d: dayWord(fmt, story.date, now.today) }), sub: join([span, moodOf(c, story)]), pct: 100 };
  if (st.kind === 'away') {
    const title = isToday ? t(mayStillCome(c.s, now.nowMin) ? 'ftoday.notYet' : 'ftoday.homeToday', { n }) : t('family.storyDidntCome', { n, d: dayWord(fmt, story.date, now.today) });
    // KC round 8b: no "usually arrives around"; just the last visit
    return { title, sub: story.lastVisit ? cap(t('ftoday.lastVisitDay', { d: dayWord(fmt, story.lastVisit, now.today) })) : '', pct: null };
  }
  const plain = plainState(c, m, story);
  return { title: plain.title, sub: plain.sub, pct: null };
}

/** A day the club is closed, or a membership that has ended or not begun: the sentence and its quiet line. */
function plainState(c: Ctx, m: Member, story: DayStory): { title: string; sub: string } {
  const { t, fmt, now } = c;
  const st = story.state;
  const isToday = story.date === now.today;
  switch (st.kind) {
    case 'closed': {
      const ev = eventTitle(st.event, fmt.lang);
      if (!isToday) return { title: t('family.storyClosedOn', { d: dayWord(fmt, story.date, now.today) }), sub: ev };
      const d = fmt.fdl(st.next);
      return { title: t('family.stClosed'), sub: st.reason === 'weekend' ? t('common.weekendSub', { date: d }) : `${ev ? ev + '. ' : ''}${t('common.clubClosedSub', { date: d })}` };
    }
    case 'ended': return { title: t('family.stEnded', { d: fmt.fds(st.lastDay) }), sub: t('family.endedSub', { n: memberShort(m), d: fmt.fds(st.lastDay) }) };
    case 'upcoming': return { title: t('family.stUpcoming', { d: fmt.fds(st.start) }), sub: '' };
    default: return { title: '', sub: '' };
  }
}

/** A small frosted LIVE pill (a softly pulsing sage dot) while the parent is at the club right now. */
function LivePill() {
  const { t } = useFamilyCtx();
  return <span data-testid="hero-pill" style={FROST}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: F.live, animation: 'cpPulse 2s ease-in-out infinite' }} />{t('shell.live')}</span>;
}

/**
 * The full-bleed picture with its scrim and the two layers on top: `top` (the date chip, the bell) and the foot (`children`).
 * It sticks to the top of the scroller, so the white panel that follows slides up over it. A tap on the picture opens it (`onOpen`).
 */
function Frame({ cover, scrim, top, children, attrs, onOpen, onOpenPhoto, grow }: { cover: Cover; scrim: string; top: ReactNode; children: ReactNode; attrs: Record<string, string>; onOpen?: () => void; onOpenPhoto?: (p: Photo, all: Photo[]) => void; grow?: boolean }) {
  const { t } = useFamilyCtx();
  const { isPhone } = useDevice();
  const wide = useFamWide();
  const wideH = useWideHeight();
  const real = !!cover.photo?.mediaId;
  // KC round 9: a tap on the picture opens it out — the picture grows down to almost the whole screen and shows uncropped, the day below moves down with it;
  // the words step aside. Another tap folds it back; the ⤢ button opens the full-screen viewer. (The laptop's card is already as tall as the screen.)
  const [big, setBig] = useState(false);
  const canGrow = real && !wide;
  useEffect(() => { setBig(false); }, [cover.photo?.mediaId]);
  const bigH = useMemo(() => Math.max(480, Math.round(window.innerHeight / uiZoom() - 150)), [big]); // eslint-disable-line react-hooks/exhaustive-deps
  // opened out, the picture swipes sideways through the pictures (KC round 9: "we should be able to swipe"): the picture the card showed comes first (KC round 10:
  // the parent's own picture stays, it does not jump to another one), then the latest pictures, newest first. A profile picture is shown only (`real` missing).
  const slides = useMemo<Slide[]>(() => {
    const all = (cover.open?.all ?? []).filter((p) => !!p.mediaId && p.media === 'photo');
    const lead = (cover.lead ?? (cover.photo ? [cover.photo] : [])).filter((p) => !!p.mediaId);
    const used = new Set<string>();
    const first = lead.map((p, i): Slide => {
      const id = (p as Photo).id;
      const real = id ? all.find((x) => x.id === id) : all.find((x) => x.mediaId === p.mediaId);
      if (real) used.add(real.id);
      return { key: real?.id ?? `lead-${i}`, photo: real ?? p, real };
    });
    return [...first, ...all.filter((p) => !used.has(p.id)).map((p): Slide => ({ key: p.id, photo: p, real: p }))];
  }, [cover]);
  const realSlides = useMemo(() => slides.flatMap((x) => (x.real ? [x.real] : [])), [slides]);
  const [at, setAt] = useState(0);
  useEffect(() => { if (!big) setAt(0); }, [big]);
  // laptop: a card in the left column (rounded all round, as tall as the screen, no white panel over its foot); otherwise the full-bleed picture the panel slides over
  return (
    <section data-testid="story-hero" data-cover={real ? 'photo' : 'gradient'} {...attrs}
      style={{ position: wide ? 'relative' : 'sticky', top: 0, zIndex: 0, isolation: 'isolate', overflow: 'hidden', color: '#FFFFFF', background: real ? '#2B231C' : GRADIENT, borderRadius: wide ? 30 : isPhone ? 0 : '30px 30px 0 0',
        [grow && !big ? 'minHeight' : 'height']: wide ? wideH : big ? bigH : HERO_H, transition: 'height .38s cubic-bezier(.2,.8,.2,1), min-height .38s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}
      data-open={big || undefined}>
      {real && big ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -4, filter: 'blur(26px) brightness(.55)', transform: 'scale(1.15)' }}><PhotoImg photo={slides[at]?.photo ?? cover.photo!} /></span> : null}
      {real && !big && cover.split ? (
        <span aria-hidden="true" data-testid="hero-split" style={{ position: 'absolute', inset: 0, zIndex: -3, display: 'grid', gridTemplateColumns: `repeat(${cover.split.length}, minmax(0, 1fr))`, gap: 2, background: '#1E1A16' }}>
          {cover.split.map((p, i) => <span key={i} style={{ position: 'relative', overflow: 'hidden' }}><PhotoImg photo={p} /></span>)}
        </span>
      ) : real && !big ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -3 }}><PhotoImg photo={cover.photo!} /></span> : null}
      {real && big ? (
        // the day's pictures, uncropped, swiped sideways; a tap folds the picture back
        <div data-testid="hero-slides" className="cp-snap" onScroll={(e) => { const el = e.currentTarget; if (el.clientWidth > 0) setAt(Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)))); }}
          style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', overflowX: slides.length > 1 ? 'auto' : 'hidden', scrollSnapType: 'x mandatory' }}>
          {(slides.length ? slides : [{ key: 'cover', photo: cover.photo! } as Slide]).map((sl) => (
            <button key={sl.key} type="button" onClick={() => setBig(false)} aria-label={t('ftoday.heroFold')} data-photo-id={sl.real?.id ?? sl.key} data-own={sl.real ? undefined : true}
              style={{ flex: '0 0 100%', height: '100%', border: 'none', padding: 0, margin: 0, background: 'transparent', cursor: 'pointer', scrollSnapAlign: 'center', position: 'relative' }}>
              <PhotoImg photo={sl.photo} style={{ objectFit: 'contain', background: 'transparent' }} />
            </button>
          ))}
        </div>
      ) : null}
      {/* KC round 10: under the picture, "Swipe to see the latest pictures" until the first swipe; then "2 of 12" */}
      {real && big && slides.length > 1 ? (at === 0
        ? <span aria-hidden="true" data-testid="hero-swipe-hint" style={PILL}><Icon name="swipe" size={16} color="#FFFFFF" />{t('ftoday.heroSwipeHint')}</span>
        : <span aria-hidden="true" data-testid="hero-count" style={PILL}>{t('fphotos.viewerCount', { i: at + 1, n: slides.length })}</span>) : null}
      {real && cover.dim ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -2, background: 'rgba(28,22,16,.35)', opacity: big ? 0 : 1, transition: 'opacity .25s' }} /> : null}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: scrim, pointerEvents: 'none', opacity: big ? 0 : 1, transition: 'opacity .25s' }} />
      {canGrow && big && onOpen ? (
        <button type="button" onClick={() => (onOpenPhoto && slides[at]?.real ? onOpenPhoto(slides[at].real!, realSlides) : onOpen())} aria-label={t('family.storyCoverAria')} data-testid="hero-full"
          style={{ position: 'absolute', right: 14, bottom: PANEL_OVERLAP + 14, zIndex: 2, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="open_in_full" size={20} color="#FFFFFF" />
        </button>
      ) : null}
      {onOpen || canGrow ? <button type="button" onClick={canGrow ? () => setBig((x) => !x) : onOpen} aria-label={canGrow ? t(big ? 'ftoday.heroFold' : 'ftoday.heroOpen') : t('family.storyCoverAria')} aria-expanded={canGrow ? big : undefined} data-testid="hero-open" style={{ position: 'absolute', inset: 0, width: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }} /> : null}
      <div style={{ position: 'relative', zIndex: 3, padding: `${isPhone ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : wide ? '18px' : '16px'} ${wide ? 18 : 14}px 0`, pointerEvents: 'none' }}>{top}</div>
      <div style={{ position: 'relative', padding: wide ? '24px 26px 26px' : `24px 20px ${PANEL_OVERLAP + 18}px`, display: 'flex', flexDirection: 'column', gap: wide ? 14 : 12, pointerEvents: 'none', opacity: big ? 0 : 1, visibility: big ? 'hidden' : 'visible', transition: big ? 'opacity .18s, visibility 0s .18s' : 'opacity .25s .12s' }}>{children}</div>
    </section>
  );
}

function Face({ m, size }: { m: Member; size: number }) {
  return <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={size} />;
}

/** Where the parent is, as one strong line and a quiet one under it (never side by side, so neither wraps into the other). */
function Status({ text, sub, live }: { text: string; sub?: string; live?: boolean }) {
  const wide = useFamWide();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: wide ? 17 : 16, lineHeight: 1.3, fontWeight: 600 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', background: live ? F.live : F.sand, boxShadow: live ? '0 0 0 3px rgba(127,176,143,.3)' : 'none' }} />
        <span data-testid="hero-status" style={{ minWidth: 0 }}>{text}</span>
      </span>
      {sub ? <span data-testid="hero-sub" style={{ fontSize: wide ? 15 : 14, lineHeight: 1.4, color: F.sand, paddingLeft: 16 }}>{sub}</span> : null}
    </div>
  );
}

/** Both parents (or everyone): the day's title, then a row for each; tapping a row focuses on that parent. */
function DualHero({ members, stories, date, top, onFocus, onOpenPhoto }: { members: Member[]; stories: DayStory[]; date: ISODate; top: ReactNode; onFocus: (id: string) => void; onOpenPhoto: (p: Photo, all: Photo[]) => void }) {
  const c = useFamilyCtx();
  const { s, t, fmt, now } = c;
  const cover = coverFor(s, members, stories, date);
  const live = stories.some((st) => st.state.kind === 'here' && date === now.today);
  const wide = useFamWide();
  return (
    <Frame cover={cover} scrim={SCRIM_ROWS} top={top} grow attrs={{ 'data-mode': 'both', 'data-day': date }} onOpen={cover.open ? () => onOpenPhoto(cover.open!.photo, cover.open!.all) : undefined} onOpenPhoto={onOpenPhoto}>
      {live ? <span style={{ alignSelf: 'flex-start' }}><LivePill /></span> : null}
      <Title dual>{dayTitle(t, fmt, namesOf(t, members), date, now.today)}</Title>
      <div style={wide ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 20, marginTop: 2 } : { display: 'flex', flexDirection: 'column', marginTop: 2 }}>
        {members.map((m, i) => {
          const r = rowText(c, m, stories[i]);
          const here = stories[i].visited;
          return (
            <button key={m.id} type="button" onClick={() => onFocus(m.id)} data-testid="parent-row" data-member={m.id} className="cp-press"
              style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#FFFFFF', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <span style={{ opacity: here ? 1 : 0.65, display: 'flex', borderRadius: 999, boxShadow: '0 0 0 2px rgba(255,255,255,.85)' }}><Face m={m} size={wide ? 38 : 36} /></span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 17, lineHeight: 1.3, fontWeight: 500 }}>{r.title}</span>
                  {r.sub ? <span style={{ fontSize: 13, lineHeight: 1.35, color: F.sand }}>{r.sub}</span> : null}
                </span>
                <Icon name="chevron_right" size={22} color="rgba(255,255,255,.65)" />
              </span>
              {r.pct !== null ? <span aria-hidden="true" style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,.22)', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: `${r.pct}%`, background: '#FFFFFF', borderRadius: 2 }} /></span> : null}
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

/** The day's steps as a line of dots over the picture: done = small white, now = big white, later = see-through; the white line fills up to now. */
function Rail({ story }: { story: DayStory }) {
  const { s, t } = useFamilyCtx();
  const wide = useFamWide();
  const items = story.items;
  if (items.length < 2) return null;
  const states = items.map((i) => i.state);
  const fill = railFill(states);
  const done = states.filter((x) => x === 'done').length;
  return (
    <div role="img" aria-label={t('ftoday.railAria', { n: done, m: items.length })} data-testid="hero-rail" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 38, marginTop: 4, maxWidth: wide ? 520 : undefined }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 2, marginTop: -1, background: 'rgba(255,255,255,.25)' }} />
      <span aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', height: 2, marginTop: -1, width: `calc((100% - 24px) * ${fill})`, background: '#FFFFFF' }} />
      {items.map((it) => {
        const icon = stepIcon(s, it);
        const now = it.state === 'now';
        const size = now ? 36 : 24;
        const up = it.state === 'up';
        return (
          <span key={it.id} data-step={it.id} data-state={it.state} style={{ position: 'relative', width: 24, height: 24, flex: 'none' }}>
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: size, height: size, borderRadius: 999, background: up ? 'rgba(255,255,255,.22)' : '#FFFFFF', boxShadow: now ? '0 0 0 4px rgba(255,255,255,.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={now ? 20 : 14} fill={1} color={up ? '#FFFFFF' : F.ink} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** One parent: the picture, the parent (to the profile), the day's title, where they are, and the icon rail. */
function SingleHero({ m, story, date, top, onProfile, onOpenPhoto }: { m: Member; story: DayStory; date: ISODate; top: ReactNode; onProfile: (id: string) => void; onOpenPhoto: (p: Photo, all: Photo[]) => void }) {
  const c = useFamilyCtx();
  const { s, t, fmt, now } = c;
  const cover = coverFor(s, [m], [story], date);
  const st = story.state;
  const isToday = date === now.today;
  const n = memberShort(m);
  const photoFrom = cover.fromDay ? t(m.gender === 'f' ? 'ftoday.photoFromF' : 'ftoday.photoFromM', { d: dayWord(fmt, cover.fromDay, now.today) }) : '';
  const arrivalFace = dayArc(s, m.id, date).arrival; // round 12: the face marked at the door
  const face = arrivalFace !== undefined ? t(FACE_KEY[arrivalFace]).toLowerCase() : '';
  let status = '', sub = '', live = false, rail = false;
  if (st.kind === 'here' && isToday) { status = face ? t('ftoday.atSinceFelt', { t: st.since, face }) : t('family.atSince', { t: st.since }); sub = join([nowWhat(c, story), moodOf(c, story)]); live = true; rail = true; }
  else if (st.kind === 'here') { status = face ? t('ftoday.arrivedFelt', { a: st.since, face }) : t('family.storyArrived', { a: st.since }); sub = join([highlights(c, story), moodOf(c, story)]); rail = true; }
  else if (st.kind === 'home') { status = face ? t('ftoday.arrivedHomeFelt', { a: story.arrivedAt || '', b: st.at, face }) : t('family.storyArrivedHome', { a: story.arrivedAt || '', b: st.at }); sub = join([highlights(c, story), moodOf(c, story)]); rail = true; }
  else if (st.kind === 'away') {
    status = isToday ? t(mayStillCome(s, now.nowMin) ? 'ftoday.notYet' : 'ftoday.homeToday', { n }) : t('family.storyDidntCome', { n, d: dayWord(fmt, date, now.today) });
    // KC round 8b: no "usually arrives around"; where the picture is from, else the last visit
    sub = cap(photoFrom || (story.lastVisit ? t('ftoday.lastVisitDay', { d: dayWord(fmt, story.lastVisit, now.today) }) : ''));
  } else { const p = plainState(c, m, story); status = p.title; sub = p.sub; }
  return (
    <Frame cover={cover} scrim={SCRIM} top={top} attrs={{ 'data-mode': 'single', 'data-member': m.id, 'data-day': date }} onOpen={cover.open ? () => onOpenPhoto(cover.open!.photo, cover.open!.all) : undefined} onOpenPhoto={onOpenPhoto}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button type="button" onClick={() => onProfile(m.id)} aria-label={t('ftoday.profileAria', { n })} data-testid="hero-profile" className="cp-press"
          style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, border: 'none', background: 'transparent', color: '#FFFFFF', padding: 0, cursor: 'pointer', fontFamily: 'Inter' }}>
          <span style={{ display: 'flex', borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF' }}><Face m={m} size={34} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, lineHeight: 1.2 }}>
            <span style={{ maxWidth: '100%', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{memberName(m)}</span>
            <span data-testid="hero-plan" style={{ maxWidth: '100%', fontSize: 12, fontWeight: 500, opacity: 0.86, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{planLine(c, m)}</span>
          </span>
        </button>
        {live ? <LivePill /> : null}
      </div>
      <Title>{dayTitle(t, fmt, n, date, now.today)}</Title>
      <Status text={status} sub={sub} live={live} />
      {rail ? <Rail story={story} /> : null}
    </Frame>
  );
}

/** Every parent's day is closed or not running (a closed day, an ended membership): the day's title and the sentence on the bronze gradient. */
function StatusHero({ members, stories, date, top }: { members: Member[]; stories: DayStory[]; date: ISODate; top: ReactNode }) {
  const c = useFamilyCtx();
  const { t, fmt, now } = c;
  const p = plainState(c, members[0], stories[0]);
  return (
    <Frame cover={{ photo: null, dim: false }} scrim={SCRIM} top={top} attrs={{ 'data-mode': 'status', 'data-day': date }}>
      <Title dual={members.length > 1}>{dayTitle(t, fmt, namesOf(t, members), date, now.today)}</Title>
      <Status text={p.title} sub={p.sub} />
    </Frame>
  );
}

/** KC round 9: the day ahead — "Tomorrow at the club", the opening hours and the day's activities, on the first activity's own picture (a plan names no one). */
function PlanHero({ members, stories, date, top }: { members: Member[]; stories: DayStory[]; date: ISODate; top: ReactNode }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const sessions = (stories[0]?.items ?? []).flatMap((i) => (i.kind === 'session' ? [i] : []));
  const pic = sessions.map((i) => s.activities[i.activityId]).find((a) => a?.photoMediaId);
  const cover: Cover = pic ? { photo: catalogPhoto(pic, date), dim: false } : { photo: null, dim: false };
  const title = date === addDays(now.today, 1) ? t('ftoday.planTitleTomorrow') : t('ftoday.planTitleDay', { d: fmt.fd(date, { weekday: 'long' }) });
  const names = Array.from(new Set(sessions.map((i) => activityLabel(s, i.activityId, fmt.lang)).filter(Boolean)));
  return (
    <Frame cover={cover} scrim={SCRIM} top={top} attrs={{ 'data-mode': 'plan', 'data-day': date }}>
      <Title dual={members.length > 1}>{title}</Title>
      <Status text={t('ftoday.planOpen', { from: s.club.settings.open, to: s.club.settings.close })} sub={names.join(' · ')} />
    </Frame>
  );
}

const OFF = new Set(['closed', 'ended', 'upcoming']);

/** The hero for the selected parents. `top` is the row of floating controls (the date chip, the bell) drawn on the picture. */
export function Hero({ members, stories, date, top, onFocus, onProfile, onOpenPhoto }: {
  members: Member[]; stories: DayStory[]; date: ISODate; top: ReactNode; onFocus: (id: string) => void; onProfile: (id: string) => void; onOpenPhoto: (p: Photo, all: Photo[]) => void;
}) {
  const { now } = useFamilyCtx();
  if (date > now.today && !stories.every((st) => OFF.has(st.state.kind))) return <PlanHero members={members} stories={stories} date={date} top={top} />;
  if (stories.every((st) => OFF.has(st.state.kind))) return <StatusHero members={members} stories={stories} date={date} top={top} />;
  if (members.length > 1) return <DualHero members={members} stories={stories} date={date} top={top} onFocus={onFocus} onOpenPhoto={onOpenPhoto} />;
  return <SingleHero m={members[0]} story={stories[0]} date={date} top={top} onProfile={onProfile} onOpenPhoto={onOpenPhoto} />;
}

/** A frosted chip for the controls floating on the picture ("‹ Both parents", "Today"). */
export function FrostChip({ children, onClick, testId, icon }: { children: ReactNode; onClick: () => void; testId: string; icon?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="cp-press"
      style={{ pointerEvents: 'auto', height: 36, padding: icon ? '0 14px 0 6px' : '0 14px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#FFFFFF', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap', flex: 'none' }}>
      {icon ? <Icon name={icon} size={22} color="#FFFFFF" /> : null}{children}
    </button>
  );
}
