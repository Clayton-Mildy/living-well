// Small building blocks shared by the management screens (design: light template cards, rows, badges, section labels).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BADGE, hasKey, type BadgeKey } from '@cp/shared';
import { Group, Icon, FONT_BODY } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, type TFn } from '../../lib/i18n';

/** Text with a count: uses the singular form (key + 'One') when the count is 1, so we never show "1 answers". */
export function tn(t: TFn, key: string, n: number, vars?: Record<string, string | number | undefined | null>) {
  return t(n === 1 && hasKey(key + 'One') ? key + 'One' : key, { n, ...vars });
}

/** An icon in a fixed, clipped box. While the icon font is still loading its glyph name would show as wide text and push the layout sideways. */
export function IconBox({ name, size = 20, color, fill }: { name: string; size?: number; color?: string; fill?: 0 | 1 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, overflow: 'hidden', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size} color={color} fill={fill} />
    </span>
  );
}

/** Prototype v3 eyebrow: 12px, 2px tracking, uppercase, bronze-brown. */
export const labelStyle: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };
export const subStyle: CSSProperties = { fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 };
/** Horizontal padding inside a hero card; rows sit inside it so their hairlines are inset. */
export const HPAD = 'clamp(18px, 3vw, 32px)';
/** Gap between page sections. */
export const SECTION_GAP = 'clamp(18px, 2.8vw, 32px)';
/** v3 hero card shell (white, hairline, 24px, soft lifted shadow). */
export const heroCard: CSSProperties = { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' };

/** A single v3 hero card with inner padding. Use `flush` for lists whose rows carry their own inset padding. */
export function HeroCard({ children, pad = `20px ${HPAD}`, style, id }: { children: ReactNode; pad?: string; style?: CSSProperties; id?: string }) {
  return <section id={id} style={{ ...heroCard, padding: pad, ...style }}>{children}</section>;
}
/** The no-box side rail: an eyebrow, then plain blocks separated by hairlines. */
export function Rail({ eyebrow, children, grow = '0 1 300px' }: { eyebrow?: ReactNode; children: ReactNode; grow?: string }) {
  return (
    <aside style={{ flex: grow, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {eyebrow ? <span style={labelStyle}>{eyebrow}</span> : null}
      {children}
    </aside>
  );
}
/** Two-column page body: main card then a rail that drops below on phones. */
export const splitRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'flex-start' };
/** A quiet underlined text link / button (bronze). */
export const linkBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, color: '#75624B', fontSize: 14, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'Inter' };

/** v3 number tabs (big light number, label, 2px underline). Up to 3 columns. */
export function NumberTabs<V extends string>({ items, value, onChange, label }: { items: { value: V; label: ReactNode; n: ReactNode }[]; value: V; onChange: (v: V) => void; label?: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))`, gap: 'clamp(8px, 2vw, 32px)', maxWidth: 640 }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.value)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '0 0 12px', border: 'none', borderBottom: `2px solid ${on ? '#24201C' : '#E6DDD1'}`, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter' }}>
            <span style={{ fontSize: 'clamp(32px, 3.8vw, 44px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', color: on ? '#24201C' : '#8A8078' }}>{it.n}</span>
            <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: on ? '#24201C' : '#8A8078' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
/** Dot + text status item for quiet rows. */
export function DotText({ color, children }: { color: string; children: ReactNode }) {
  return <span style={{ color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: 'none' }} />{children}</span>;
}

/** Page frame: design padding per device and a column of sections. */
/** A management page. KC round 6: every staff page is full width on laptop, like Members (`max` is kept for old callers and ignored). */
export function Page({ gap = 18, children }: { max?: number; gap?: number; children: ReactNode }) {
  const { device } = useDevice();
  // round 6, phone: cp-native flattens the cards on the page (iOS-style groups, no shadows)
  return <div className={device === 'phone' ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: device === 'phone' ? gap : `max(${gap}px, clamp(18px, 2.8vw, 32px))` }}>{children}</div>;
}

/** The design's 28px pill: icon + label (status colours come from BADGE or are passed in). */
export function Pill({ icon, label, fg, bg, fill = 1, size = 18 }: { icon?: string; label: ReactNode; fg: string; bg: string; fill?: 0 | 1; size?: number }) {
  return (
    <span style={{ height: 26, padding: icon ? '0 10px 0 6px' : '0 10px', borderRadius: 999, background: bg, color: fg, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      {icon ? <IconBox name={icon} size={Math.min(size, 16)} fill={fill} /> : null}
      {label}
    </span>
  );
}
export function BadgePill({ kind, label }: { kind: BadgeKey; label: ReactNode }) {
  const b = BADGE[kind];
  return <Pill icon={b[0]} fg={b[1]} bg={b[2]} label={label} />;
}
export const TONE = {
  sage: { fg: '#3D6B4F', bg: '#E3EFE6' },
  ochre: { fg: '#7A5510', bg: '#F6ECD6' },
  rust: { fg: '#FFFFFF', bg: '#9A3D24' },
  rustSoft: { fg: '#9A3D24', bg: '#F9E3DB' },
  linen: { fg: '#24201C', bg: '#E8E1D8' },
  grey: { fg: '#5E5852', bg: '#F0EAE1' },
} as const;

/** v3 hero card: eyebrow title (meta on the right), then rows inside the card padding so their hairlines are inset. */
export function ListCard({ title, meta, children, headPad = '18px 0 8px', right, id }: { title: ReactNode; meta?: ReactNode; children: ReactNode; headPad?: string; right?: ReactNode; id?: string }) {
  const { isPhone } = useDevice();
  // round 6, phone: the title moves outside as a small grey header over a flat group; rows keep their own top hairline, and the -1px lift clips the first one
  if (isPhone) {
    return (
      <div id={id}>
        <Group title={title} meta={meta !== undefined || right ? <>{meta}{right}</> : undefined} pad="0 16px" gap={0}><div style={{ marginTop: -1 }}>{children}</div></Group>
      </div>
    );
  }
  return (
    <section id={id} style={{ ...heroCard, padding: `0 ${HPAD} 8px` }}>
      <div style={{ padding: headPad, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={labelStyle}>{title}</span>
        {meta !== undefined ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span> : null}
        {right}
      </div>
      {children}
    </section>
  );
}
/** Plain padded block inside a ListCard (empty note, hint). */
export const CardNote = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: '14px 0 16px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{children}</div>
);

/** A quiet v3 row: avatar or icon circle, name (17/500), one sub line, one action. Tappable when `onClick` is set. Rows sit inside a ListCard's padding. */
export function LightRow({ avatar, icon, title, sub, badge, btn, right, onClick, ariaLabel }: {
  avatar?: ReactNode; icon?: string; title: ReactNode; sub?: ReactNode; badge?: ReactNode; btn?: ReactNode; right?: ReactNode; onClick?: () => void; ariaLabel?: string;
}) {
  const { isPhone } = useDevice();
  const inner = (
    <>
      {avatar}
      {icon ? (
        <span aria-hidden="true" style={{ width: isPhone ? 40 : 46, height: isPhone ? 40 : 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none', overflow: 'hidden' }}>
          <IconBox name={icon} size={isPhone ? 20 : 21} />
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.3 }}>{title}</span>
        {sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{sub}</span> : null}
      </div>
      {badge}
      {btn}
      {right !== undefined ? <span style={{ fontSize: 14, color: '#6B6259', fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{right}</span> : null}
      {onClick ? <Icon name="chevron_right" size={20} color="#8A8078" /> : null}
    </>
  );
  // round 6, phone: a tighter grouped row (40px circle, 16px title), a press fade on the tappable ones
  const base: CSSProperties = isPhone ? { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F0EAE1', minHeight: 58 } : { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid #F0EAE1', minHeight: 64 };
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={isPhone ? 'cp-press' : undefined} style={{ ...base, width: '100%', border: 'none', borderTop: '1px solid #F0EAE1', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>{inner}</button>
  ) : (
    <div style={base}>{inner}</div>
  );
}

/** Label + value line used by facts lists (design: justify-between, hairline). */
export function Fact({ k, v, last }: { k: ReactNode; v: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: last ? 'none' : '1px solid #F0EAE1', fontSize: 15, lineHeight: 1.4 }}>
      <span style={{ color: '#6B6259' }}>{k}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  );
}

/** Full-screen panel with a back button: the phone version of a list -> detail split (people). */
export function PushPanel({ open, onBack, backLabel, title, children }: { open: boolean; onBack: () => void; backLabel: string; title?: ReactNode; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onBack(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [open, onBack]);
  if (!open) return null;
  // round 6, phone: a pushed iOS screen (only mounted on phones): "‹ People" in bronze on the grey page, no bar border; the button keeps its "Back" name
  return (
    <div ref={ref} role="dialog" aria-modal="false" aria-label={typeof title === 'string' ? title : backLabel} className="cp-native" style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#F5F5F3', display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out' }}>
      <div style={{ flex: 'none', height: 50, display: 'flex', alignItems: 'center', padding: '0 6px 0 2px', background: '#F5F5F3' }}>
        <button type="button" className="cp-press" onClick={onBack} aria-label={t('common.back')} style={{ maxWidth: '100%', height: 44, padding: '0 8px 0 0', border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="chevron_left" size={32} weight={300} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{backLabel}</span>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

/** Round 6 (phone): a small 34px pill action for a row. primary = ink, secondary = white with a hairline, quiet = tinted. A disabled pill keeps its click as a no-op, like Button. */
export function PillBtn({ children, onClick, icon, tone = 'secondary', disabled, grow, label }: { children: ReactNode; onClick?: () => void; icon?: string; tone?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; grow?: boolean; label?: string }) {
  const c = { primary: ['#24201C', '#FFFFFF', 'none'], secondary: ['#FFFFFF', '#24201C', '1px solid #DCD3C8'], quiet: ['#F3EEE8', '#24201C', 'none'], danger: ['#F9E3DB', '#9A3D24', 'none'] }[tone];
  return (
    <button type="button" className="cp-press" onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined} aria-label={label}
      style={{ height: 34, padding: '0 14px', borderRadius: 999, border: c[2], background: disabled ? '#EDE5DA' : c[0], color: disabled ? '#8A8078' : c[1], fontSize: 14, fontWeight: 500, fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap', cursor: disabled ? 'not-allowed' : 'pointer', flex: grow ? '1 1 auto' : 'none' }}>
      {icon ? <IconBox name={icon} size={17} /> : null}
      {children}
    </button>
  );
}
/** Round 6 (phone): an iOS switch row (label left, switch right) in place of the bordered Toggle card. Same role, name and aria-checked as Toggle. */
export function SwitchRow({ on, onClick, label, sub, disabled }: { on: boolean; onClick: () => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick} className="cp-press"
      style={{ width: '100%', minHeight: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', border: 'none', background: 'transparent', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{label}</span>
        {sub ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{sub}</span> : null}
      </span>
      <span aria-hidden="true" style={{ width: 50, height: 30, borderRadius: 999, background: on ? '#24201C' : '#D9D3CB', position: 'relative', flex: 'none', transition: 'background-color .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 26, height: 26, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .15s' }} />
      </span>
    </button>
  );
}
/** Round 6 (phone): an iOS segmented control with the tab roles of the old tabs. `scroll` lets a long row (5 tabs) swipe sideways instead of squeezing. */
export function SegTabs<V extends string>({ items, value, onChange, label, scroll }: { items: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; label?: string; scroll?: boolean }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: scroll ? 'flex' : 'grid', gridTemplateColumns: scroll ? undefined : `repeat(${items.length}, minmax(0, 1fr))`, gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0', overflowX: scroll ? 'auto' : undefined, scrollbarWidth: 'none', maxWidth: '100%' }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.value)}
            style={{ flex: scroll ? 'none' : undefined, minWidth: 0, height: 36, padding: '0 12px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: on ? '#1E1A16' : '#5E5852', fontSize: 14, fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Inter', transition: 'background-color .15s' }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
/** Round 6 (phone): the flat iOS group look for a card the screen builds itself (white, radius 14, no border, no shadow). */
export const groupCard: CSSProperties = { background: '#FFFFFF', borderRadius: 14, overflow: 'hidden' };
/** Round 6 (phone): the grey search bar (as in the Arrivals list) for a screen's own search box. */
export function SearchBar({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 11, background: '#EAE6E0' }}>
      <Icon name="search" size={19} color="#6B6259" />
      <input value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} type="search" inputMode="search" placeholder={placeholder} autoComplete="off"
        style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', WebkitAppearance: 'none' }} />
    </label>
  );
}

/** Wrap-around chips for choosing one or several values, with the design's pressed look. */
/** A chip whose text may be long (survey questions in Indonesian, staff names): wraps instead of running off a phone screen. */
export const wrapChip: CSSProperties = { height: 'auto', minHeight: 44, padding: '8px 16px', whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%', flex: '0 1 auto', lineHeight: 1.3 };
export const chipRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
/** v3 underline-style text field label (small caps eyebrow) used above textareas. */
export const fieldBox: CSSProperties = { border: '1px solid #DDD1C2', borderRadius: 10, padding: '12px 14px', fontSize: 16, lineHeight: '24px', fontFamily: 'Inter', color: '#24201C', outline: 'none', background: '#FFFFFF' };
