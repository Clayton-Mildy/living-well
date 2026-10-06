// Small pieces shared by the kitchen and requests screens, with the design's exact inline styles.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { BADGE, type BadgeKey, type StockRequest, type Feedback } from '@cp/shared';
import { useT } from '../../lib/i18n';
import { Button, Dialog, Icon, chipStyle, FONT_BODY, FONT_SMALL } from '../../components/ui';

/** Reset form fields when `key` changes, during render and not in an effect: an effect can run after someone has already started
 *  typing in a freshly opened sheet and would wipe what they typed. `reset` only calls this component's own setState functions. */
export function useResetOn<K>(key: K, reset: () => void) {
  const [seen, setSeen] = useState(key);
  if (!Object.is(seen, key)) { setSeen(key); reset(); }
}

/** The design's inline status pill: 28px, icon + label (rust only for declined/overdue). */
export function Pill({ icon, fg, bg, label }: { icon: string; fg: string; bg: string; label: ReactNode }) {
  return (
    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={17} fill={1} />
      {label}
    </span>
  );
}
export function BadgePill({ kind, label }: { kind: BadgeKey; label: ReactNode }) {
  const b = BADGE[kind];
  return <Pill icon={b[0]} fg={b[1]} bg={b[2]} label={label} />;
}

const STOCK_BADGE: Record<StockRequest['status'], BadgeKey> = { requested: 'pending', approved: 'watch', received: 'paid', rejected: 'overdue', cancelled: 'void' };
export function StockBadge({ status }: { status: StockRequest['status'] }) {
  const t = useT();
  return <BadgePill kind={STOCK_BADGE[status]} label={t('kitchen.stock.s_' + status)} />;
}
const FB_BADGE: Record<Feedback['status'], BadgeKey> = { open: 'watch', answered: 'paid', closed: 'void' };
export function FeedbackBadge({ status }: { status: Feedback['status'] }) {
  const t = useT();
  return <BadgePill kind={FB_BADGE[status]} label={t('status.' + status)} />;
}

/** Eyebrow-sized label used inside cards (design: 13px caps, 1.5px tracking). */
export const cardLabel: CSSProperties = { fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' };
export const mutedBody: CSSProperties = { fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 };
export const bronzeInput: CSSProperties = { height: 'var(--cp-field-h, 52px)', border: '1px solid #8A755B', borderRadius: 16, padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', background: '#FFFFFF', minWidth: 0 };

/** Design button-state colours (btnS): bronze when ready, linen when not. */
export const btnState = (on: boolean) => (on ? { bg: '#75624B', fg: '#FFFFFF' } : { bg: '#E8E1D8', fg: '#6A6967' });
/** Pill button in the design's inline style (used where the design hand-rolls its buttons). */
export function PillButton({ children, onClick, on = true, height = 48, pad = '0 22px', icon, type = 'button', label, grow }: { children: ReactNode; onClick?: () => void; on?: boolean; height?: number; pad?: string; icon?: string; type?: 'button' | 'submit'; label?: string; grow?: boolean }) {
  const c = btnState(on);
  return (
    <button type={type} onClick={onClick} aria-disabled={!on || undefined} aria-label={label} className={on ? 'h-bronze cp-btn' : 'cp-btn'}
      style={{ height, padding: pad, borderRadius: 999, border: 'none', background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: on ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap', fontFamily: 'Inter', flex: grow ? '1' : 'none' }}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  );
}
/** Underlined text button, 44px target (design's "Retake photo" / "Decline" style). */
export function TextButton({ children, onClick, color = '#75624B', label, size }: { children: ReactNode; onClick?: () => void; color?: string; label?: string; size?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="h-cream" style={{ height: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color, fontSize: size ?? FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
      {children}
    </button>
  );
}
/** Outlined pill button, 44px (design's "Mark received"). */
export function OutlineButton({ children, onClick, icon, label }: { children: ReactNode; onClick?: () => void; icon?: string; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="h-cream cp-btn" style={{ height: 44, padding: '0 16px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', flex: 'none' }}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

/** The design's filter chip: 44px pill, no check mark; label usually "Name · count". */
export function FilterChip({ label, selected, onClick }: { label: ReactNode; selected: boolean; onClick: () => void }) {
  const c = chipStyle(selected, false);
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      style={{ height: 44, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
      {label}
    </button>
  );
}
/** The design's choice chip (16px, 44px tall) for section and area pickers. */
export function ChoiceChip({ label, selected, onClick }: { label: ReactNode; selected: boolean; onClick: () => void }) {
  const c = chipStyle(selected, false);
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className="cp-chip"
      style={{ height: 44, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
      {label}
    </button>
  );
}

/** Small yes/no dialog (cancel a request, delete something). */
export function ConfirmDialog({ open, onClose, title, body, confirmLabel, cancelLabel, onConfirm, danger = true }: { open: boolean; onClose: () => void; title: string; body: ReactNode; confirmLabel: string; cancelLabel: string; onConfirm: () => void | Promise<void>; danger?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidth={480}
      footer={<><Button variant="secondary" onClick={onClose}>{cancelLabel}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()}>{confirmLabel}</Button></>}>
      <div style={{ fontSize: 16, lineHeight: '24px' }}>{body}</div>
    </Dialog>
  );
}
