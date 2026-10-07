// Small building blocks shared by the management screens (design: light template cards, rows, badges, section labels).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BADGE, hasKey, type BadgeKey } from '@cp/shared';
import { Icon, IconButton, FONT_BODY } from '../../components/ui';
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
export function Page({ max = 1100, gap = 18, children }: { max?: number; gap?: number; children: ReactNode }) {
  const { device } = useDevice();
  return <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: device === 'phone' ? gap : `max(${gap}px, clamp(18px, 2.8vw, 32px))`, maxWidth: max }}>{children}</div>;
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
  const inner = (
    <>
      {avatar}
      {icon ? (
        <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none', overflow: 'hidden' }}>
          <IconBox name={icon} size={21} />
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{title}</span>
        {sub ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{sub}</span> : null}
      </div>
      {badge}
      {btn}
      {right !== undefined ? <span style={{ fontSize: 14, color: '#6B6259', fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{right}</span> : null}
      {onClick ? <Icon name="chevron_right" size={20} color="#8A8078" /> : null}
    </>
  );
  const base: CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: '1px solid #F0EAE1', minHeight: 64 };
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} style={{ ...base, width: '100%', border: 'none', borderTop: '1px solid #F0EAE1', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>{inner}</button>
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
  return (
    <div ref={ref} role="dialog" aria-modal="false" aria-label={typeof title === 'string' ? title : backLabel} style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#F5F5F3', display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out' }}>
      <div style={{ flex: 'none', height: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid #F0EAE1', background: '#F5F5F3' }}>
        <IconButton icon="arrow_back" label={t('common.back')} onClick={onBack} />
        <span style={{ fontSize: 17, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{backLabel}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

/** Wrap-around chips for choosing one or several values, with the design's pressed look. */
/** A chip whose text may be long (survey questions in Indonesian, staff names): wraps instead of running off a phone screen. */
export const wrapChip: CSSProperties = { height: 'auto', minHeight: 44, padding: '8px 16px', whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%', flex: '0 1 auto', lineHeight: 1.3 };
export const chipRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
/** v3 underline-style text field label (small caps eyebrow) used above textareas. */
export const fieldBox: CSSProperties = { border: '1px solid #DDD1C2', borderRadius: 10, padding: '12px 14px', fontSize: 16, lineHeight: '24px', fontFamily: 'Inter', color: '#24201C', outline: 'none', background: '#FFFFFF' };
