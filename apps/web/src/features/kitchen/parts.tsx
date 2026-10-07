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
    <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 8, background: bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
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

/** Eyebrow label used inside cards (v3: 12px caps, 2px tracking, bronze-brown). */
export const cardLabel: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43' };
/** v3 hero card: white, 24px radius, soft lifted shadow; rows inside sit between inset hairlines. */
export const heroCard: CSSProperties = { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '8px clamp(18px, 3vw, 32px) 12px', minWidth: 0 };
/** An inset hairline row inside a hero card. */
export const heroRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: '1px solid #F0EAE1' };
/** The v3 rule between plain aside blocks. */
export const asideRule: CSSProperties = { height: 1, background: '#E6DDD1' };
export const asideTitle: CSSProperties = { fontSize: 19, lineHeight: 1.3, fontWeight: 500, color: '#2B231C' };
export const asideSub: CSSProperties = { fontSize: 14, color: '#6B6259', lineHeight: 1.4 };

/** Dot plus text for a status (v3 replaces chip clusters with this). */
export function StatusDot({ color, children, weight = 500 }: { color: string; children: ReactNode; weight?: number }) {
  return <span style={{ color, fontWeight: weight, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: color, flex: 'none' }} />{children}</span>;
}

/** v3 number tabs: a big light number over a label, 2px underline (ink when selected). Role tab, so it works as a filter switch. */
export function NumTabs<V extends string>({ items, value, onChange, label, maxWidth = 640 }: { items: { value: V; n: number; label: string }[]; value: V; onChange: (v: V) => void; label: string; maxWidth?: number }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 'clamp(8px, 2vw, 28px)', maxWidth, width: '100%' }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} aria-label={`${it.label} ${it.n}`} onClick={() => onChange(it.value)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '0 0 10px', border: 'none', borderBottom: `2px solid ${on ? '#24201C' : '#E6DDD1'}`, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', minWidth: 0 }}>
            <span style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1px', color: on ? '#24201C' : '#8A8078', fontVariantNumeric: 'tabular-nums' }}>{it.n}</span>
            <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: on ? '#24201C' : '#8A8078', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
export const mutedBody: CSSProperties = { fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 };
export const bronzeInput: CSSProperties = { height: 'var(--cp-field-h, 52px)', border: '1px solid #DDD1C2', borderRadius: 12, padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', background: '#FFFFFF', minWidth: 0 };

/** Design button-state colours (btnS): ink when ready, linen when not. */
export const btnState = (on: boolean) => (on ? { bg: '#24201C', fg: '#FFFFFF' } : { bg: '#E8E1D8', fg: '#5E5852' });
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
    <button type="button" onClick={onClick} aria-label={label} className="h-cream" style={{ height: 44, padding: '0 12px', borderRadius: 12, border: 'none', background: 'transparent', color, fontSize: size ?? FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
      {children}
    </button>
  );
}
/** Outlined pill button, 44px (design's "Mark received"). */
export function OutlineButton({ children, onClick, icon, label }: { children: ReactNode; onClick?: () => void; icon?: string; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="h-cream cp-btn" style={{ height: 44, padding: '0 16px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', flex: 'none' }}>
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
      style={{ height: 44, padding: '0 16px', borderRadius: 12, border: c.bd, background: c.bg, color: c.fg, fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
      {label}
    </button>
  );
}
/** The design's choice chip (16px, 44px tall) for section and area pickers. */
export function ChoiceChip({ label, selected, onClick }: { label: ReactNode; selected: boolean; onClick: () => void }) {
  const c = chipStyle(selected, false);
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className="cp-chip"
      style={{ height: 44, padding: '0 16px', borderRadius: 12, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
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
