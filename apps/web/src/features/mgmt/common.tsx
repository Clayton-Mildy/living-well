// Small building blocks shared by the management screens (design: light template cards, rows, badges, section labels).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BADGE, hasKey, type BadgeKey } from '@cp/shared';
import { Icon, IconButton, FONT_BODY, FONT_SMALL } from '../../components/ui';
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

export const labelStyle: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };
export const subStyle: CSSProperties = { fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 };

/** Page frame: design padding per device and a column of sections. */
export function Page({ max = 1100, gap = 18, children }: { max?: number; gap?: number; children: ReactNode }) {
  const { device } = useDevice();
  return <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap, maxWidth: max }}>{children}</div>;
}

/** The design's 28px pill: icon + label (status colours come from BADGE or are passed in). */
export function Pill({ icon, label, fg, bg, fill = 1, size = 18 }: { icon?: string; label: ReactNode; fg: string; bg: string; fill?: 0 | 1; size?: number }) {
  return (
    <span style={{ height: 28, padding: icon ? '0 10px 0 6px' : '0 10px', borderRadius: 999, background: bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      {icon ? <IconBox name={icon} size={size} fill={fill} /> : null}
      {label}
    </span>
  );
}
export function BadgePill({ kind, label }: { kind: BadgeKey; label: ReactNode }) {
  const b = BADGE[kind];
  return <Pill icon={b[0]} fg={b[1]} bg={b[2]} label={label} />;
}
export const TONE = {
  sage: { fg: '#3D6B4F', bg: '#E6EFE8' },
  ochre: { fg: '#7A5510', bg: '#F6ECD6' },
  rust: { fg: '#FFFFFF', bg: '#AF4B2F' },
  rustSoft: { fg: '#AF4B2F', bg: '#F7E4DD' },
  linen: { fg: '#282828', bg: '#E8E1D8' },
  grey: { fg: '#6A6967', bg: '#EFECEA' },
} as const;

/** White card with the design's header (small caps label left, meta right). */
export function ListCard({ title, meta, children, headPad = '16px 20px 10px', right, id }: { title: ReactNode; meta?: ReactNode; children: ReactNode; headPad?: string; right?: ReactNode; id?: string }) {
  return (
    <div id={id} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
      <div style={{ padding: headPad, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={labelStyle}>{title}</span>
        {meta !== undefined ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{meta}</span> : null}
        {right}
      </div>
      {children}
    </div>
  );
}
/** Plain padded block inside a ListCard (empty note, hint). */
export const CardNote = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{children}</div>
);

/** A row of the light template: avatar or icon circle, title and sub, optional badge, button or right-hand value. Tappable when `onClick` is set. */
export function LightRow({ avatar, icon, title, sub, badge, btn, right, onClick, ariaLabel }: {
  avatar?: ReactNode; icon?: string; title: ReactNode; sub?: ReactNode; badge?: ReactNode; btn?: ReactNode; right?: ReactNode; onClick?: () => void; ariaLabel?: string;
}) {
  const inner = (
    <>
      {avatar}
      {icon ? (
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none', overflow: 'hidden' }}>
          <IconBox name={icon} size={20} />
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
        {sub ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{sub}</span> : null}
      </div>
      {badge}
      {btn}
      {right !== undefined ? <span style={{ fontSize: FONT_BODY, fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{right}</span> : null}
      {onClick ? <Icon name="chevron_right" size={22} color="#6A6967" /> : null}
    </>
  );
  const base: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 64 };
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="h-row" style={{ ...base, width: '100%', border: 'none', borderTop: '1px solid #EFECEA', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>{inner}</button>
  ) : (
    <div style={base}>{inner}</div>
  );
}

/** Label + value line used by facts lists (design: justify-between, hairline). */
export function Fact({ k, v, last }: { k: ReactNode; v: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: last ? 'none' : '1px solid #EFECEA', fontSize: 16, lineHeight: 1.4 }}>
      <span style={{ color: '#6A6967' }}>{k}</span>
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
    <div ref={ref} role="dialog" aria-modal="false" aria-label={typeof title === 'string' ? title : backLabel} style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#F6F5F5', display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out' }}>
      <div style={{ flex: 'none', height: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid #E8E1D8', background: '#F6F5F5' }}>
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
