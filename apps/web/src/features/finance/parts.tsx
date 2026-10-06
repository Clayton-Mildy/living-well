// Small pieces shared by the finance screens, with the design's exact values.
import { type CSSProperties, type ReactNode } from 'react';
import { BADGE, fmtN, type BadgeKey } from '@cp/shared';
import { Button, Dialog, FONT_BODY, FONT_SMALL, Icon, Pager, Sheet, type Paged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { digits } from './lib';

/** The 28px status badge used in the finance lists (design: height 28, padding 0 10 0 6, icon 17). */
export function FinBadge({ icon, fg, bg, label }: { icon: string; fg: string; bg: string; label: ReactNode }) {
  return (
    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={17} fill={1} />
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
  <span style={{ height: 28, padding: '0 10px', borderRadius: 999, background: '#F6ECD6', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{children}</span>
);

export const inputBox: CSSProperties = { height: 'var(--cp-field-h, 52px)', border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', minWidth: 0 };
export const fieldLabel: CSSProperties = { fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 };
/** Small uppercase label (design: font 13, tracking 1.5, weight 500). */
export const caps: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };

/** Search box for the long lists. */
export function SearchField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', maxWidth: 520, width: '100%' }}>
      <Icon name="search" size={20} color="#6A6967" style={{ position: 'absolute', left: 14, top: 16, pointerEvents: 'none' }} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} style={{ ...inputBox, width: '100%', paddingLeft: 42 }} />
    </div>
  );
}

/** Page buttons under a long list (the kit's Pager, with the card's hairline above it). Nothing for a single page. */
export function PagerBar({ paged, label }: { paged: Paged<unknown>; label: string }) {
  const t = useT();
  if (paged.pages <= 1) return null;
  return (
    <div style={{ borderTop: '1px solid #EFECEA' }}>
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
      <span style={{ display: 'flex', alignItems: 'center', height: 52, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', overflow: 'hidden' }}>
        <span style={{ padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', background: '#F4F0EE', borderRight: '1px solid #DBD7D6', fontSize: 16, flex: 'none' }}>{prefix}</span>
        <input value={shown} onChange={(e) => onChange(parse(e.target.value))} inputMode={decimal ? 'decimal' : 'numeric'} aria-label={ariaLabel} placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', padding: '0 12px', fontSize: size, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter', color: '#282828', background: 'transparent' }} />
      </span>
      {hint ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

/** A bottom sheet on the phone, a centred dialog on tablet and laptop (the design's own split for forms). */
export function FormOverlay({ open, onClose, title, eyebrow, children, footer, maxWidth = 560 }: { open: boolean; onClose: () => void; title: string; eyebrow?: ReactNode; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  const { isPhone } = useDevice();
  if (isPhone) {
    // the action bar stays at the bottom of the sheet while a long list scrolls (same trick as the dialog's footer)
    const bar = footer ? (
      <div style={{ position: 'sticky', bottom: 0, margin: '0 -20px -32px', padding: '12px 20px 28px', background: '#FFFFFF', borderTop: '1px solid #EFECEA', display: 'flex', flexDirection: 'column', gap: 10 }}>{footer}</div>
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
export const dangerStrip: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', padding: 10, borderRadius: 16, background: '#FBEDE8' };
