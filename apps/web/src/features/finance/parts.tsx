// Small pieces shared by the finance screens, with the design's exact values.
import { type CSSProperties, type ReactNode } from 'react';
import { BADGE, fmtN, type BadgeKey } from '@cp/shared';
import { Button, Dialog, Eyebrow, FONT_BODY, FONT_SMALL, Icon, Pager, Sheet, type Paged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { digits } from './lib';

/** The 28px status badge used in the finance lists (design: height 28, padding 0 10 0 6, icon 17). */
export function FinBadge({ icon, fg, bg, label }: { icon: string; fg: string; bg: string; label: ReactNode }) {
  return (
    <span style={{ height: 26, padding: '0 10px 0 6px', borderRadius: 8, background: bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={16} fill={1} />
      {label}
    </span>
  );
}
/** Badge from the shared table (paid / outstanding / overdue / pending / partial / void). */
export function Badge({ kind, label }: { kind: BadgeKey; label: ReactNode }) {
  const b = BADGE[kind];
  return <FinBadge icon={b[0]} fg={b[1]} bg={b[2]} label={label} />;
}
/** Amber "N waiting" pill (design: Budget card header). */
export const AmberPill = ({ children }: { children: ReactNode }) => (
  <span style={{ height: 28, padding: '0 10px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{children}</span>
);

export const inputBox: CSSProperties = { height: 'var(--cp-field-h, 52px)', border: '1px solid #DDD1C2', borderRadius: 12, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', minWidth: 0 };
export const fieldLabel: CSSProperties = { fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 };
/** Small uppercase label (design: font 13, tracking 1.5, weight 500). */
export const caps: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };

/** Prototype v3 search: an underline, a light icon, a borderless input (a "searchbox"). `width` for the in-card header variant. */
export function SearchField({ value, onChange, label, placeholder, width }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; width?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #DDD1C2', padding: '8px 2px', width: width || '100%', maxWidth: width ? '100%' : 520, minWidth: 0 }}>
      <Icon name="search" size={19} color="#6B6259" style={{ flex: 'none' }} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#24201C', padding: 0, height: 28 }} />
    </label>
  );
}

// ---------- Prototype v3 building blocks (feature-local; the family screens use them too) ----------
export const HP = 'clamp(18px, 3vw, 36px)';
export const HERO_SHADOW = '0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)';
export const HAIR = '1px solid #F0EAE1';

/** The one hero card of a screen: white, 28px radius, lifted; rows sit inside its padding with inset hairlines. */
export function Hero({ children, style, flush, visible }: { children: ReactNode; style?: CSSProperties; flush?: boolean; /** let dropdowns spill out of the card */ visible?: boolean }) {
  return (
    <section style={{ ['--hp' as string]: HP, background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: HERO_SHADOW, padding: flush ? 0 : `8px ${HP} 12px`, minWidth: 0, overflow: visible ? 'visible' : 'hidden', ...style } as CSSProperties}>{children}</section>
  );
}
/** Card title: an eyebrow on the left; a search, a count or an action on the right. */
export function HeroHead({ title, right, meta }: { title: ReactNode; right?: ReactNode; meta?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0 10px', flexWrap: 'wrap' }}>
      <Eyebrow>{title}</Eyebrow>
      {meta !== undefined ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span> : null}
      {right}
    </div>
  );
}
/** An inset list row inside a Hero. */
export const hrow: CSSProperties = { borderTop: HAIR, padding: 'clamp(13px, 2.2vw, 18px) 0' };
/** v3 row title and sub line. */
export const rowTitle: CSSProperties = { fontSize: 17, fontWeight: 500, lineHeight: 1.3, color: '#24201C' };
export const rowSub: CSSProperties = { fontSize: 14, color: '#6B6259', lineHeight: 1.4 };
/** A 7px status dot + text (quiet status instead of a chip). */
export const Dot = ({ color, children, weight = 500 }: { color: string; children: ReactNode; weight?: number }) => (
  <span style={{ color, fontWeight: weight, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: 'none' }} />
    {children}
  </span>
);
/** The aside rail's eyebrow + a plain block with a hairline above it. */
export const railLine: CSSProperties = { height: 1, background: '#E6DDD1', border: 0, margin: 0 };

export interface NumberTab { key: string; label: ReactNode; value: ReactNode; sub?: ReactNode; subColor?: string; selected?: boolean; onClick?: () => void; testId?: string; ariaLabel?: string }
/** Prototype v3 number tabs: a big light number over a label, a 2px line (ink when selected). The label comes first in the DOM (reads "Overdue 1"), the number first on screen. */
export function NumberTabs({ items, cols, maxWidth = 640, label }: { items: NumberTab[]; cols?: number; maxWidth?: number; label?: string }) {
  const any = items.some((x) => x.selected);
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols || items.length}, minmax(0, 1fr))`, gap: 'clamp(10px, 2.4vw, 32px)', maxWidth, width: '100%' }}>
      {items.map((x) => {
        const dim = any && !x.selected;
        const style: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '0 0 12px', border: 'none', borderBottom: `2px solid ${x.selected ? '#24201C' : '#E6DDD1'}`, background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: '#1E1A16', minWidth: 0, cursor: x.onClick ? 'pointer' : 'default' };
        const body = (
          <>
            <span style={{ fontSize: 13, fontWeight: x.selected ? 600 : 400, color: dim ? '#8A8078' : '#5E5852', lineHeight: 1.3 }}>{x.label}</span>
            <span style={{ order: -1, fontSize: 'clamp(32px, 3.8vw, 44px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', color: dim ? '#8A8078' : '#1E1A16' }}>{x.value}</span>
            {x.sub ? <span style={{ fontSize: 13, color: x.subColor && !dim ? x.subColor : '#6B6259', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{x.sub}</span> : null}
          </>
        );
        return x.onClick
          ? <button key={x.key} type="button" aria-pressed={!!x.selected} aria-label={x.ariaLabel} onClick={x.onClick} data-testid={x.testId} style={style}>{body}</button>
          : <div key={x.key} data-testid={x.testId} style={style}>{body}</div>;
      })}
    </div>
  );
}

/** Page buttons under a long list (the kit's Pager, with the card's hairline above it). Nothing for a single page. */
export function PagerBar({ paged, label }: { paged: Paged<unknown>; label: string }) {
  const t = useT();
  if (paged.pages <= 1) return null;
  return (
    <div style={{ borderTop: '1px solid #F0EAE1' }}>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('finance.pager', { list: label })} />
    </div>
  );
}

/** Whole-rupiah (or foreign) amount with a currency block in front, as in the design's money fields. */
export function RpField({ label, value, onChange, prefix = 'Rp', ariaLabel, placeholder, decimal, size = 16, hint }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; prefix?: string; ariaLabel?: string; placeholder?: string; decimal?: boolean; size?: number; hint?: ReactNode;
}) {
  // rupiah: digits grouped as 5.500.000; foreign: digits with one decimal point
  const shown = decimal ? value : fmtN(value);
  const parse = (raw: string) => (decimal ? raw.replace(',', '.').replace(/[^\d.]/g, '').replace(/^(\d*\.\d{0,2}).*$/, '$1') : String(digits(raw) || ''));
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={fieldLabel}>{label}</span> : null}
      <span style={{ display: 'flex', alignItems: 'center', height: 52, border: '1px solid #DDD1C2', borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
        <span style={{ padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', background: '#F3EEE8', borderRight: '1px solid #E4DACD', fontSize: 16, flex: 'none' }}>{prefix}</span>
        <input value={shown} onChange={(e) => onChange(parse(e.target.value))} inputMode={decimal ? 'decimal' : 'numeric'} aria-label={ariaLabel} placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', padding: '0 12px', fontSize: size, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#24201C', background: 'transparent' }} />
      </span>
      {hint ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

/** A bottom sheet on the phone, a centred dialog on tablet and laptop (the design's own split for forms). */
export function FormOverlay({ open, onClose, title, eyebrow, children, footer, maxWidth = 560 }: { open: boolean; onClose: () => void; title: string; eyebrow?: ReactNode; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  const { isPhone } = useDevice();
  if (isPhone) {
    // the action bar stays at the bottom of the sheet while a long list scrolls (same trick as the dialog's footer)
    const bar = footer ? (
      <div style={{ position: 'sticky', bottom: 0, margin: '0 -20px -32px', padding: '12px 20px 28px', background: '#FFFFFF', borderTop: '1px solid #F0EAE1', display: 'flex', flexDirection: 'column', gap: 10 }}>{footer}</div>
    ) : undefined;
    return <Sheet open={open} onClose={onClose} title={title} footer={bar}>{children}</Sheet>;
  }
  return <Dialog open={open} onClose={onClose} title={title} eyebrow={eyebrow} maxWidth={maxWidth} footer={footer}>{children}</Dialog>;
}

/** Ask before something that cannot be undone. */
export function ConfirmDialog({ open, onClose, title, body, confirmLabel, onConfirm, danger = true }: { open: boolean; onClose: () => void; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; danger?: boolean }) {
  const t = useT();
  const { isPhone } = useDevice();
  return (
    <FormOverlay open={open} onClose={onClose} title={title} maxWidth={480}
      footer={<><Button variant="secondary" full={isPhone} onClick={onClose}>{t('common.cancel')}</Button><Button variant={danger ? 'danger' : 'primary'} full={isPhone} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div style={{ fontSize: 16, lineHeight: '24px' }}>{body}</div>
    </FormOverlay>
  );
}

/** Inline panel for refunds and rejections (design: rust-tinted strip under the row). */
export const dangerStrip: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', padding: 10, borderRadius: 12, background: '#FBEDE8' };
