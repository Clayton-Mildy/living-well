// Round 8 (the "CitraPremier Family App" prototype): the family app's shared look on every width. White pages in a centred column,
// soft grey fills (#F4F4F5) with hairlines instead of cards and shadows, a big title per tab, pill chips, the iOS segmented control
// and switch, "‹ back" links for pushed pages, and a bottom sheet with Cancel · title · action. Screens build on these only.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { Photo } from '@cp/shared';
import { Icon, PhotoImg, uiZoom, useOverlayA11y } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { pressProps, SelectMark, tileSelectStyle, type PhotoSelect } from './select';
import { useT } from '../../lib/i18n';
import { durText } from './parts';
import { useBackClose } from '../../components/ui/useBackClose';

/** The prototype's palette. */
export const F = {
  ink: '#2B231C', text: '#24201C', muted: '#6B6259', soft: '#4A4038', fill: '#F4F4F5', press: '#EEEEF0', hair: '#E2E2E6', line: '#E0E0E4',
  bronze: '#75624B', chev: '#A89C8E', eyebrow: '#6E5A43', sand: '#E3D9CC',
  sage: '#2F5A40', sageBg: '#E3EFE6', sageDot: '#3D6B4F', live: '#7FB08F', ochre: '#7A5510', ochreBg: '#F6ECD6', rust: '#9A3D24', rustBg: '#F9E3DB', red: '#A2452B',
} as const;
export const HAIR = `0.5px solid ${F.hair}`;
const FONT = 'Inter, system-ui, sans-serif';

/**
 * A family page: the centred column (the phone's width on a tablet). `wide` (round 8, desktop): on a laptop the page may use up to 1180px for
 * two columns (see `Cols`); without it the page stays a 600px column there too. The shell leaves room below for the tab bar.
 * Round 8c: a laptop page has the prototype's 28px / 36px padding.
 */
export function FamPage({ children, gap = 16, pad = 16, testId, style, wide }: { children: ReactNode; gap?: number; pad?: number; testId?: string; style?: CSSProperties; wide?: boolean }) {
  const { isPhone } = useDevice();
  const famWide = useFamWide();
  const big = !!wide && famWide;
  return (
    <div data-testid={testId} style={{ width: '100%', maxWidth: big ? 1180 : 600, margin: '0 auto', padding: `${isPhone ? 14 : big ? 28 : 36}px ${big ? 36 : pad}px 0`, display: 'flex', flexDirection: 'column', gap, boxSizing: 'border-box', ...style }}>
      {children}
    </div>
  );
}

/** The window width from which the family app uses its desktop layout (two columns). KC round 8d: a ~1100px laptop window showed the phone
 *  column, so the desktop layout starts at 1024px (tablet landscape and up), not at the app's 1280px "laptop". */
export const FAM_WIDE_MIN = 1024;
const wideNow = () => (typeof window === 'undefined' ? true : window.innerWidth >= FAM_WIDE_MIN);
/** True when the family pages lay out like the prototype's desktop (two columns). Follows the window as it is resized. */
export function useFamWide() {
  const [wide, setWide] = useState(wideNow);
  useEffect(() => {
    const on = () => setWide(wideNow());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

/**
 * Two columns on a laptop (`left` and `right`, e.g. '1.1fr' / '1fr'), one column below that. `stickyLeft` keeps the left column in view while the
 * right one scrolls (Today's picture, a calendar month).
 */
export function Cols({ children, left = '1fr', right = '1fr', gap = 36, stickyLeft, align = 'start', testId }: { children: [ReactNode, ReactNode]; left?: string; right?: string; gap?: number; stickyLeft?: boolean; align?: 'start' | 'stretch'; testId?: string }) {
  const wide = useFamWide();
  if (!wide) return <>{children[0]}{children[1]}</>;
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `minmax(0, ${left}) minmax(0, ${right})`, gap, alignItems: align }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, ...(stickyLeft ? { position: 'sticky', top: 24 } : {}) }}>{children[0]}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{children[1]}</div>
    </div>
  );
}

/** The laptop page header's small line above the title ("TUESDAY 13 OCTOBER"). */
export const DESK_EYEBROW: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: F.eyebrow, lineHeight: 1.35 };

/** The tab's big title (34px, light; 36px on a laptop), with an optional control on the right (a segmented switch, the avatar rings, the name chips). */
export function LargeTitle({ children, right, eyebrow, sub }: { children: ReactNode; right?: ReactNode; eyebrow?: ReactNode; /** round 11: whose page this is (the chosen parent's name) under the title */ sub?: ReactNode }) {
  const wide = useFamWide();
  return (
    <div style={{ display: 'flex', alignItems: sub ? 'center' : 'flex-end', justifyContent: 'space-between', gap: wide ? 16 : 12, padding: wide ? 0 : '0 4px', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 4 : 2, minWidth: 0 }}>
        {eyebrow ? <span style={wide ? DESK_EYEBROW : { fontSize: 13, color: F.muted, lineHeight: 1.35 }}>{eyebrow}</span> : null}
        <h1 style={{ margin: 0, fontSize: wide ? 36 : 34, lineHeight: wide ? 1.05 : 1.1, fontWeight: 400, letterSpacing: wide ? '-1.1px' : '-1px', color: F.ink, overflowWrap: 'anywhere' }}>{children}</h1>
        {sub ? <span data-testid="title-who" style={{ fontSize: 17, lineHeight: 1.3, fontWeight: 500, color: F.soft, overflowWrap: 'anywhere' }}>{sub}</span> : null}
      </div>
      {right ? <div style={{ flex: 'none', display: 'flex', alignItems: 'center' }}>{right}</div> : null}
    </div>
  );
}

/** A pushed page's title (30px; 36px on a laptop) under its back link. */
export function PageTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: ReactNode }) {
  const wide = useFamWide();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 4 : 2, padding: wide ? 0 : '0 4px' }}>
      {eyebrow ? <span style={wide ? DESK_EYEBROW : { fontSize: 13, color: F.muted, lineHeight: 1.35 }}>{eyebrow}</span> : null}
      <h1 style={{ margin: 0, fontSize: wide ? 36 : 30, lineHeight: wide ? 1.05 : 1.1, fontWeight: 400, letterSpacing: wide ? '-1.1px' : '-0.8px', color: F.ink, overflowWrap: 'anywhere' }}>{children}</h1>
    </div>
  );
}

/** A small uppercase section label ("NEXT", "PHOTOS"), with an optional link or count on the right. */
export function Cap({ children, right, style }: { children: ReactNode; right?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '0 4px', ...style }}>
      <h2 style={{ margin: 0, fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600, color: F.muted }}>{children}</h2>
      {right}
    </div>
  );
}

/** A section heading inside a long page ("Health", "Plan"), 20px (22px on a laptop), with an optional link on the right. */
export function SectionHead({ children, right, id }: { children: ReactNode; right?: ReactNode; id?: string }) {
  const wide = useFamWide();
  return (
    <div id={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: wide ? '18px 4px 0' : '14px 4px 0' }}>
      <h2 style={{ margin: 0, fontSize: wide ? 22 : 20, lineHeight: 1.3, fontWeight: 500, color: F.text }}>{children}</h2>
      {right}
    </div>
  );
}

/** A bronze text button ("All 4", "History", "Ask the club to change the plan"). */
export function TextLink({ children, onClick, size = 15, style, testId }: { children: ReactNode; onClick: () => void; size?: number; style?: CSSProperties; testId?: string }) {
  return (
    <button type="button" onClick={onClick} className="cp-press" data-testid={testId} style={{ border: 'none', background: 'transparent', color: F.bronze, fontSize: size, fontWeight: 500, cursor: 'pointer', padding: 0, minHeight: 32, fontFamily: FONT, textAlign: 'left', ...style }}>
      {children}
    </button>
  );
}

/** A soft grey block (a card without a shadow). With `onClick` it is a button that darkens a little when pressed. */
export function FillCard({ children, pad = 16, radius = 20, gap = 10, style, onClick, label, testId }: { children: ReactNode; pad?: number | string; radius?: number; gap?: number; style?: CSSProperties; onClick?: () => void; label?: string; testId?: string }) {
  const box: CSSProperties = { background: F.fill, borderRadius: radius, padding: pad, display: 'flex', flexDirection: 'column', gap, border: 'none', textAlign: 'left', color: F.text, fontFamily: FONT, width: '100%', boxSizing: 'border-box', ...style };
  return onClick
    ? <button type="button" onClick={onClick} aria-label={label} data-testid={testId} className="cp-fam-press" style={{ ...box, cursor: 'pointer' }}>{children}</button>
    : <div data-testid={testId} style={box}>{children}</div>;
}

/** A grouped list: rows on one grey block, divided by hairlines (pass `first` to the first row). */
export function List({ children, label, testId, style }: { children: ReactNode; label?: string; testId?: string; style?: CSSProperties }) {
  return <div role={label ? 'group' : undefined} aria-label={label} data-testid={testId} style={{ background: F.fill, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
}

/** A round icon tile for list rows (white on the grey list). */
export function IconTile({ icon, bg = '#FFFFFF', color = F.bronze, size = 32, radius = 999, iconSize }: { icon: string; bg?: string; color?: string; size?: number; radius?: number; iconSize?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={icon} size={iconSize ?? Math.round(size * 0.6)} color={color} /></span>;
}

/**
 * A list row: icon tile, label (and sub line), a value on the right, a chevron when it opens something.
 * `href` makes it a link (WhatsApp, phone); `onClick` a button; neither a plain row. `right` replaces the value (a switch, buttons).
 */
export function ListRow({ icon, tile, tileColor, label, sub, value, valueColor = F.muted, valueWeight = 400, chevron, onClick, href, first, right, danger, testId, minHeight = 52 }: {
  icon?: string; tile?: string; tileColor?: string; label: ReactNode; sub?: ReactNode; value?: ReactNode; valueColor?: string; valueWeight?: number; chevron?: boolean;
  onClick?: () => void; href?: string; first?: boolean; right?: ReactNode; danger?: boolean; testId?: string; minHeight?: number;
}) {
  const ink = danger ? F.rust : F.text;
  const showChev = chevron ?? !!(onClick || href);
  const inner = (
    <>
      {icon ? <IconTile icon={icon} bg={tile ?? '#FFFFFF'} color={tileColor ?? (danger ? F.rust : F.bronze)} /> : null}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, padding: sub ? '10px 0' : 0 }}>
        <span style={{ fontSize: 16, lineHeight: 1.35, color: ink, overflowWrap: 'anywhere' }}>{label}</span>
        {sub ? <span style={{ fontSize: 13, lineHeight: 1.35, color: F.muted, overflowWrap: 'anywhere' }}>{sub}</span> : null}
      </span>
      {right ?? (value !== undefined && value !== null && value !== '' ? <span style={{ fontSize: 14, color: valueColor, fontWeight: valueWeight, textAlign: 'right', flex: 'none', maxWidth: '50%' }}>{value}</span> : null)}
      {showChev ? <Icon name="chevron_right" size={22} color={F.chev} style={{ flex: 'none' }} /> : null}
    </>
  );
  const style: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight, padding: '0 12px', border: 'none', borderTop: first ? 'none' : HAIR, background: 'transparent', textAlign: 'left', color: ink, fontFamily: FONT, textDecoration: 'none', boxSizing: 'border-box', cursor: onClick || href ? 'pointer' : 'default' };
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener" data-testid={testId} className="cp-fam-press" style={style}>{inner}</a>;
  if (onClick) return <button type="button" onClick={onClick} data-testid={testId} className="cp-fam-press" style={style}>{inner}</button>;
  return <div data-testid={testId} style={style}>{inner}</div>;
}

/** A key / value row ("Born · 14 Mar 1945"). `dot` puts a small coloured dot before the value (an allergy in red). */
export function KV({ k, v, first, color = F.text, weight = 400, dot, testId }: { k: ReactNode; v: ReactNode; first?: boolean; color?: string; weight?: number; dot?: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 14px', borderTop: first ? 'none' : HAIR, fontSize: 15, lineHeight: 1.4 }}>
      <span style={{ color: F.muted, flex: 'none', maxWidth: '45%' }}>{k}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'right', color, fontWeight: weight, minWidth: 0, overflowWrap: 'anywhere', justifyContent: 'flex-end' }}>
        {dot ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: dot, flex: 'none' }} /> : null}
        {v}
      </span>
    </div>
  );
}

/** A coloured dot and its words ("● Normal", "● Due"). */
export function StatusDot({ color, children, size = 14, weight = 500 }: { color: string; children: ReactNode; size?: number; weight?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: size, color, fontWeight: weight, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />{children}
    </span>
  );
}

/** Pill chips in a row that scrolls sideways and bleeds to the page edges (filters, metric pickers, the profile's jump chips). */
export function Chips<V extends string>({ items, value, onChange, label, bleed = 16, testId, lg }: { items: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; label: string; bleed?: number; testId?: string; /** the laptop's 36px chips */ lg?: boolean }) {
  return (
    <div role="group" aria-label={label} data-testid={testId} className="cp-pillrow" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: `0 -${bleed}px`, padding: `0 ${bleed}px`, flex: 'none' }}>
      {items.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" aria-pressed={on} onClick={() => onChange(c.value)} data-value={c.value} className={on ? 'cp-press' : 'cp-press cp-fill'}
            style={{ flex: 'none', height: lg ? 36 : 34, padding: lg ? '0 16px' : '0 13px', border: 'none', borderRadius: 999, background: on ? F.ink : F.fill, color: on ? '#FFFFFF' : F.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** The iOS segmented control (List | Month, 1W … Custom). */
export function Seg<V extends string>({ items, value, onChange, label, width, size = 14, testId }: { items: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; label: string; width?: number | string; size?: number; testId?: string }) {
  return (
    <div role="tablist" aria-label={label} data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 2, padding: 2, borderRadius: 9, background: F.press, width, flex: 'none', boxSizing: 'border-box' }}>
      {items.map((s) => {
        const on = s.value === value;
        return (
          <button key={s.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(s.value)} data-value={s.value}
            style={{ height: 30, border: 'none', borderRadius: 7, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,.14)' : 'none', fontSize: size, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', cursor: 'pointer', fontFamily: FONT, padding: '0 6px', whiteSpace: 'nowrap' }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** The iOS switch (51×31, sage when on). */
export function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      style={{ width: 51, height: 31, borderRadius: 999, border: 'none', padding: 0, background: on ? F.sageDot : F.line, position: 'relative', flex: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background-color .2s' }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
    </button>
  );
}

/** Go back to where the family came from, or to `fallback` when the page was opened directly (a link, a reload). */
export function useBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1); else navigate(fallback);
  };
}

/** "‹ Me": a pushed page's back link (bronze, 17px). */
export function BackLink({ label, onClick, testId = 'fam-back' }: { label: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="cp-press"
      style={{ alignSelf: 'flex-start', height: 44, display: 'flex', alignItems: 'center', gap: 0, margin: '-6px 0 -6px -6px', border: 'none', background: 'transparent', color: F.bronze, fontSize: 17, cursor: 'pointer', padding: '0 8px 0 0', fontFamily: FONT, maxWidth: '100%' }}>
      <Icon name="chevron_left" size={30} weight={300} color={F.bronze} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

/**
 * The prototype's bottom sheet: white, 28px top corners, a grab handle. With `action` the header is Cancel · title · action (bronze, grey while
 * disabled); without, the title sits left and Done closes it. Round 8c, on a laptop it is a centred 460px dialog (radius 24, no handle) over the dimmed page.
 */
export { useBackClose }; // moved to components/ui so the shared lightbox can use it

/**
 * KC round 9: a bottom sheet follows a downward swipe and closes when it is let go far enough (or flicked), like the phone's own sheets. The swipe starts
 * anywhere on the sheet while its content is scrolled to the top; a sideways move or a scroll inside it is left alone.
 */
export function useSwipeDown(ref: RefObject<HTMLElement>, onClose: () => void, enabled: boolean) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let x0 = 0, y0 = 0, t0 = 0, dy = 0, active = false, decided = false;
    const scroller = (target: EventTarget | null) => { // the nearest part of the sheet that scrolls (a long list inside it)
      for (let n = target as HTMLElement | null; n && n !== el.parentElement; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY !== 'visible') return n;
      return el;
    };
    let box: HTMLElement = el;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { active = false; return; }
      box = scroller(e.target);
      if (box.scrollTop > 0) { active = false; return; }
      const p = e.touches[0];
      x0 = p.clientX; y0 = p.clientY; t0 = performance.now(); dy = 0; active = true; decided = false;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const p = e.touches[0];
      const ddx = p.clientX - x0, ddy = p.clientY - y0;
      if (!decided) {
        if (Math.hypot(ddx, ddy) < 8) return;
        decided = true;
        if (ddy <= 0 || Math.abs(ddx) > Math.abs(ddy) || box.scrollTop > 0) { active = false; return; }
      }
      e.preventDefault(); // the sheet moves, the page under it does not
      dy = Math.max(0, ddy);
      el.style.transition = 'none';
      el.style.transform = `translate3d(0,${dy / uiZoom()}px,0)`;
    };
    const end = () => {
      if (!active || !decided) { active = false; return; }
      active = false;
      const ms = Math.max(1, performance.now() - t0);
      if (dy > 110 || (dy > 50 && dy / ms > 0.5)) {
        el.style.transition = 'transform 180ms ease-in';
        el.style.transform = 'translate3d(0,100%,0)';
        window.setTimeout(() => { cb.current(); window.setTimeout(() => { el.style.transition = 'none'; el.style.transform = 'none'; }, 80); }, 170); // put it back in case it stays open
      } else {
        el.style.transition = 'transform 240ms cubic-bezier(.2,.9,.3,1.2)';
        el.style.transform = 'none';
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [ref, enabled]);
}

export function FamSheet({ open, onClose, title, action, children, testId, maxWidth = 600, full }: { open: boolean; onClose: () => void; title: string; action?: { label: string; onClick: () => void; disabled?: boolean }; children: ReactNode; testId?: string; maxWidth?: number; full?: boolean }) {
  const t = useT();
  const wide = useFamWide();
  const { ref, trap } = useOverlayA11y(open, onClose);
  useBackClose(open, onClose); // KC round 9: the phone's back gesture closes it
  const [mounted, setMounted] = useState(false); // the swipe hook needs the sheet in the page
  useEffect(() => { setMounted(open); }, [open]);
  useSwipeDown(ref, onClose, open && mounted && !wide && !full); // a full-screen sheet is not swiped away (a stroke on the signature pad would be)
  if (!open) return null;
  const textBtn = (label: string, onClick: () => void, bold: boolean, color: string, disabled?: boolean) => (
    <button type="button" onClick={onClick} disabled={disabled} style={{ border: 'none', background: 'transparent', color, fontSize: 16, fontWeight: bold ? 600 : 400, cursor: disabled ? 'default' : 'pointer', padding: 0, minHeight: 40, fontFamily: FONT, whiteSpace: 'nowrap' }}>{label}</button>
  );
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,12,.32)' }} />
      <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-testid={testId} className="cp-noshrink"
        style={{ position: 'relative', width: '100%', maxWidth: wide ? 460 : full ? '100%' : maxWidth, maxHeight: wide ? '88%' : full ? '100%' : '88%', ...(full && !wide ? { height: '100%' } : {}), overflowY: 'auto', background: '#FFFFFF', borderRadius: wide ? 24 : full ? 0 : '28px 28px 0 0', padding: wide ? '18px 22px 22px' : full ? 'calc(12px + env(safe-area-inset-top, 0px)) 18px calc(24px + env(safe-area-inset-bottom, 0px))' : '8px 18px calc(34px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14, animation: wide ? 'cpPop .2s cubic-bezier(.3,.7,.2,1)' : 'cpUp .22s ease-out', boxShadow: wide ? '0 2px 6px rgba(40,30,20,.08), 0 24px 60px rgba(40,30,20,.22)' : undefined, outline: 'none', boxSizing: 'border-box' }}>
        {wide || full ? null : <span aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 999, background: '#D4D4D8', flex: 'none' }} />}
        {action ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ justifySelf: 'start' }}>{textBtn(t('fam.cancel'), onClose, false, F.bronze)}</span>
            <span style={{ fontSize: 17, fontWeight: 600, color: F.text, textAlign: 'center' }}>{title}</span>
            <span style={{ justifySelf: 'end' }}>{textBtn(action.label, action.onClick, true, action.disabled ? '#C4C4C8' : F.bronze, action.disabled)}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 500, color: F.text }}>{title}</span>
            {textBtn(t('fam.done'), onClose, true, F.bronze)}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Round 8 (KC: notifications "like a pop up, not from below"): a rounded card that grows out of its anchor — the visible element marked
 * `data-bell-anchor` (the bell on Today's picture, or the sidebar's Notifications row). Under the anchor and right-aligned to it on a phone; beside it
 * when the anchor is in the left sidebar. The page dims a little; a tap outside or Escape closes it.
 */
export function FamPopover({ open, onClose, title, children, testId, width = 380 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; testId?: string; width?: number }) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(open, onClose);
  useBackClose(open, onClose);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const z = uiZoom();
    const vw = window.innerWidth / z, vh = window.innerHeight / z;
    const w = Math.min(width, vw - 24);
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-bell-anchor]')).find((x) => x.getBoundingClientRect().width > 0);
    if (!el) { setPos({ top: 16, right: 12, width: w, maxHeight: vh - 32, transformOrigin: 'top right' }); return; }
    const r = el.getBoundingClientRect();
    const a = { top: r.top / z, bottom: r.bottom / z, left: r.left / z, right: r.right / z };
    if (a.right < vw / 3) { // the sidebar: open to its right, level with the row
      const top = Math.max(12, Math.min(a.top - 8, vh - 420));
      setPos({ top, left: a.right + 12, width: w, maxHeight: vh - top - 16, transformOrigin: 'top left' });
    } else {
      const top = a.bottom + 10;
      setPos({ top, right: Math.max(12, vw - a.right - 2), width: w, maxHeight: Math.min(600, vh - top - 16), transformOrigin: 'top right' });
    }
  }, [open, width]);
  if (!open) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,12,.16)', animation: 'cpFade .16s ease-out' }} />
      <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}
        style={{ position: 'absolute', ...(pos || { top: 16, right: 12, width: Math.min(width, 360) }), visibility: pos ? 'visible' : 'hidden', boxSizing: 'border-box', background: '#FFFFFF', borderRadius: 22, boxShadow: '0 2px 6px rgba(40,30,20,.08), 0 24px 60px rgba(40,30,20,.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none', animation: 'cpPop .2s cubic-bezier(.3,.7,.2,1)' }}>
        <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 16px 6px 18px' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: F.text }}>{title}</span>
          <button type="button" onClick={onClose} aria-label={t('fam.done')} className="cp-fam-press" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: F.fill, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="close" size={18} color={F.text} /></button>
        </div>
        <div className="cp-noshrink" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Square photo tiles, 3 across with 2px gaps (edge to edge when `edge`), each opening the viewer. Videos show a play mark and their length.
 * `max` shows that many and turns the last into "+N".
 */
export function PhotoTiles({ photos, onOpen, label, edge = true, cols = 3, max, radius = 0, gap = 2, testId, select }: { photos: Photo[]; onOpen: (p: Photo) => void; label: (p: Photo) => string; edge?: boolean; cols?: number; max?: number; radius?: number; /** px between tiles; a wider gap means each tile is rounded on its own (the laptop's Today) */ gap?: number; testId?: string; /** KC round 10: long press selects, for saving in bulk */ select?: PhotoSelect }) {
  const { isPhone } = useDevice();
  const shown = max ? photos.slice(0, max) : photos;
  const more = photos.length - shown.length;
  // edge to edge only on a phone; in the centred column the grid keeps the page's side padding and soft corners
  const bleed = edge && isPhone;
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, margin: bleed ? '0 -16px' : 0, borderRadius: bleed || gap > 2 ? 0 : 14, overflow: gap > 2 ? 'visible' : 'hidden' }}>
      {shown.map((p, i) => (
        <button key={p.id} type="button" onClick={() => (select?.on ? select.toggle(p) : onOpen(p))} aria-label={label(p)} aria-pressed={select?.on ? select.has(p.id) : undefined} data-photo-id={p.id} data-kind={p.kind} {...pressProps(() => select?.start(p), !!select)}
          style={{ position: 'relative', aspectRatio: '1', border: 'none', padding: 0, background: F.fill, cursor: 'pointer', overflow: 'hidden', borderRadius: radius, ...(select ? tileSelectStyle : {}) }}>
          <PhotoImg photo={p} />
          {select?.on ? <SelectMark selected={select.has(p.id)} /> : null}
          {p.media === 'video' ? <span aria-hidden="true" style={{ position: 'absolute', left: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px 2px 3px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 11, fontWeight: 600 }}><Icon name="play_arrow" size={14} fill={1} color="#FFFFFF" />{durText(p.durationSec)}</span> : null}
          {i === shown.length - 1 && more > 0 ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,16,.5)', color: '#FFFFFF', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{more}</span> : null}
        </button>
      ))}
    </div>
  );
}
