// Small pieces shared by the finance screens, with the design's exact values.
import { type CSSProperties, type ReactNode } from 'react';
import { BADGE, fmtN, type BadgeKey } from '@cp/shared';
import { Button, Dialog, Eyebrow, FONT_BODY, FONT_SMALL, GROUP_HEAD, Icon, Pager, Sheet, type Paged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { digits } from './lib';

/** The 28px status badge used in the finance lists (design: height 28, padding 0 10 0 6, icon 17). */
export function FinBadge({ icon, fg, bg, label }: { icon: string; fg: string; bg: string; label: ReactNode }) {
  // the neutral kinds (outstanding, part paid, pending, void) are linen / cream in the shared table: here they are the family's soft grey
  const neutral = bg === BADGE.outstanding[2] || bg === BADGE.void[2];
  return (
    <span className={neutral ? 'cp-fill' : undefined} style={{ height: 26, padding: '0 10px 0 6px', borderRadius: 8, background: neutral ? 'var(--press, #EEEEF0)' : bg, color: fg, fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={16} fill={1} />
      {label}
    </span>
  );
}
/** Badge from the shared table (paid / outstanding / overdue / pending / partial / void). */
export function Badge({ kind, label }: { kind: BadgeKey; label: ReactNode }) {
  const { isPhone } = useDevice();
  const b = BADGE[kind];
  // round 6, phone: a quiet status (a dot and text in the status colour) instead of a chip
  if (isPhone) {
    const c = kind === 'overdue' || kind === 'alert' ? b[2] : kind === 'paid' || kind === 'normal' ? b[1] : kind === 'watch' || kind === 'partial' ? '#8A6216' : '#5E5852';
    return <span style={{ fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap', flex: 'none' }}><Dot color={c} weight={kind === 'overdue' ? 600 : 500}>{label}</Dot></span>;
  }
  return <FinBadge icon={b[0]} fg={b[1]} bg={b[2]} label={label} />;
}
/** Amber "N waiting" pill (design: Budget card header). */
export const AmberPill = ({ children }: { children: ReactNode }) => (
  <span style={{ height: 28, padding: '0 10px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{children}</span>
);

/** A soft grey field, no border (add className "cp-input cp-fill": white on a grey card, an ink ring on focus). */
export const inputBox: CSSProperties = { height: 'var(--cp-field-h, 52px)', border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', minWidth: 0 };
export const fieldLabel: CSSProperties = { fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 };
/** Small uppercase label (design: font 13, tracking 1.5, weight 500). */
export const caps: CSSProperties = { fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: 'var(--eyebrow, #6E5A43)' };

/** Search: a soft grey box (var(--fill, #F4F4F5), radius 12), a light icon, a borderless input (a "searchbox"). `width` for the in-card header variant. */
export function SearchField({ value, onChange, label, placeholder, width }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; width?: string }) {
  const { isPhone } = useDevice();
  // phone: the grey search bar (as on Arrivals)
  if (isPhone) {
    return (
      <label className="cp-fill" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 12, background: 'var(--fill, #F4F4F5)', width: '100%', minWidth: 0 }}>
        <Icon name="search" size={19} color="#6B6259" style={{ flex: 'none' }} />
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off"
          style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', padding: 0 }} />
      </label>
    );
  }
  return (
    <label className="cp-fill" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '6px 12px', width: width || '100%', maxWidth: width ? '100%' : 520, minWidth: 0 }}>
      <Icon name="search" size={19} color="#6B6259" style={{ flex: 'none' }} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'Inter', color: '#24201C', padding: 0, height: 28 }} />
    </label>
  );
}

// ---------- Prototype v3 building blocks (feature-local; the family screens use them too) ----------
export const HP = 'clamp(18px, 3vw, 36px)';
/** @deprecated cards have no shadow any more (kept for old callers) */
export const HERO_SHADOW = 'none';
export const HAIR = '0.5px solid var(--hairline, #E2E2E6)';

/** The one hero card of a screen: soft grey (var(--fill, #F4F4F5)), 20px radius, no border or shadow; rows sit inside its padding with inset hairlines. */
export function Hero({ children, style, flush, visible }: { children: ReactNode; style?: CSSProperties; flush?: boolean; /** let dropdowns spill out of the card */ visible?: boolean }) {
  return (
    <section className="cp-grey" style={{ ['--hp' as string]: HP, background: 'var(--fill, #F4F4F5)', borderRadius: 20, padding: flush ? 0 : `8px ${HP} 12px`, minWidth: 0, overflow: visible ? 'visible' : 'hidden', ...style } as CSSProperties}>{children}</section>
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
export const railLine: CSSProperties = { height: 1, background: 'var(--hairline, #E2E2E6)', border: 0, margin: 0 };

export interface NumberTab { key: string; label: ReactNode; value: ReactNode; sub?: ReactNode; subColor?: string; selected?: boolean; onClick?: () => void; testId?: string; ariaLabel?: string }
/** Prototype v3 number tabs: a big light number over a label, a 2px line (ink when selected). The label comes first in the DOM (reads "Overdue 1"), the number first on screen. */
export function NumberTabs({ items, cols, maxWidth = 640, label }: { items: NumberTab[]; cols?: number; maxWidth?: number; label?: string }) {
  const any = items.some((x) => x.selected);
  const { isPhone } = useDevice();
  // round 6, phone: no KPI tiles; one flat white group, a 2-column grid split by hairlines (label over a modest count and the amount). Filters stay buttons.
  if (isPhone) {
    return (
      <PGroup pad={0} gap={0}>
        <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, background: 'var(--outline, #DCDCE0)' }}>{/* contrast audit: 1px dividers (0.5px vanished at the phone's zoom) */}
          {items.map((x) => {
            const style: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 14px', minHeight: 62, border: 'none', background: x.selected ? 'var(--press, #EEEEF0)' : 'var(--cell, #F4F4F5)', boxShadow: x.selected ? 'inset 3px 0 0 #2B231C' : undefined, textAlign: 'left', fontFamily: 'Inter', color: '#1E1A16', minWidth: 0, cursor: x.onClick ? 'pointer' : 'default' };
            const body = (
              <>
                <span style={{ maxWidth: '100%', fontSize: 13, fontWeight: x.selected ? 600 : 400, color: x.selected ? '#1E1A16' : '#6B6259', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</span>
                <span style={{ maxWidth: '100%', display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: '#1E1A16' }}>{x.value}</span>
                  {x.sub ? <span style={{ fontSize: 13, color: x.subColor || '#6B6259', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.sub}</span> : null}
                </span>
              </>
            );
            return x.onClick
              ? <button key={x.key} type="button" className="cp-tap-self" aria-pressed={!!x.selected} aria-label={x.ariaLabel} onClick={x.onClick} data-testid={x.testId} style={style}>{body}</button>
              : <div key={x.key} data-testid={x.testId} style={style}>{body}</div>;
          })}
          {items.length % 2 ? <div aria-hidden="true" style={{ background: 'var(--fill, #F4F4F5)' }} /> : null}
        </div>
      </PGroup>
    );
  }
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols || items.length}, minmax(0, 1fr))`, gap: 'clamp(10px, 2.4vw, 32px)', maxWidth, width: '100%' }}>
      {items.map((x) => {
        const dim = any && !x.selected;
        const style: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '0 0 12px', border: 'none', borderBottom: `2px solid ${x.selected ? '#24201C' : 'var(--hairline, #E2E2E6)'}`, background: 'transparent', textAlign: 'left', fontFamily: 'Inter', color: '#1E1A16', minWidth: 0, cursor: x.onClick ? 'pointer' : 'default' };
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
    <div style={{ borderTop: '0.5px solid var(--hairline, #E2E2E6)' }}>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('finance.pager', { list: label })} />
    </div>
  );
}

/** Whole-rupiah amount with an "Rp" block in front, as in the design's money fields (digits grouped as 5.500.000). */
export function RpField({ label, value, onChange, prefix = 'Rp', ariaLabel, placeholder, size = 16, hint }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; prefix?: string; ariaLabel?: string; placeholder?: string; size?: number; hint?: ReactNode;
}) {
  const shown = fmtN(value);
  const parse = (raw: string) => String(digits(raw) || '');
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={fieldLabel}>{label}</span> : null}
      <span className="cp-input-wrap cp-fill" style={{ display: 'flex', alignItems: 'center', height: 52, borderRadius: 12, background: 'var(--fill, #F4F4F5)', overflow: 'hidden' }}>
        <span style={{ padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', background: 'var(--press, #EEEEF0)', fontSize: 16, flex: 'none' }}>{prefix}</span>
        <input value={shown} onChange={(e) => onChange(parse(e.target.value))} inputMode="numeric" aria-label={ariaLabel} placeholder={placeholder}
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
      <div style={{ position: 'sticky', bottom: 0, margin: '0 -20px -32px', padding: '12px 20px 28px', background: '#FFFFFF', borderTop: '0.5px solid var(--hairline, #E2E2E6)', display: 'flex', flexDirection: 'column', gap: 10 }}>{footer}</div>
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

// ---------- round 6, phone: native building blocks (iOS grouped sections) ----------
/** round 6, phone: like the kit's Group (small grey header OUTSIDE a flat white group), but the header is a plain div, not an h2: the finance and request screens keep their one heading (tests and screen readers find "Payments" once).
 *  `meta` is an element or text on the right of the header; `pad` / `gap` as in Group (list groups: pad 0, rows carry their own padding). */
export function PGroup({ title, meta, children, label, pad = '14px 16px', gap = 10 }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; label?: string; pad?: number | string; gap?: number }) {
  return (
    <section aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {title || meta ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px', minHeight: 18 }}>
          <div style={GROUP_HEAD}>{title}</div>
          {meta ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '18px', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>{meta}</span> : null}
        </div>
      ) : null}
      <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap }}>{children}</div>
    </section>
  );
}
/** round 6, phone: a list row inside a PGroup with pad 0: 16px sides, a hairline inset 16px from the left (none on the first row). */
export const prow = (first?: boolean, extra?: CSSProperties): CSSProperties => ({
  padding: '11px 16px', backgroundColor: 'transparent', backgroundImage: first ? 'none' : 'linear-gradient(var(--hairline, #E2E2E6), #E2E2E6)', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', ...extra,
});
/** a 34px pill button for a row action (primary = ink, danger = rust text on grey, plain = grey). */
export function PillBtn({ children, onClick, label, tone = 'plain', icon, disabled }: { children: ReactNode; onClick?: () => void; label?: string; tone?: 'plain' | 'primary' | 'danger'; icon?: string; disabled?: boolean }) {
  const c = disabled ? { bg: 'var(--press, #EEEEF0)', fg: '#8A8078' } : tone === 'primary' ? { bg: '#24201C', fg: '#FFFFFF' } : tone === 'danger' ? { bg: 'var(--fill, #F4F4F5)', fg: '#9A3D24' } : { bg: 'var(--fill, #F4F4F5)', fg: '#24201C' };
  return (
    <button type="button" className={tone === 'primary' && !disabled ? 'cp-press' : 'cp-press cp-fill'} onClick={disabled ? undefined : onClick} aria-label={label} aria-disabled={disabled || undefined}
      style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: c.bg, color: c.fg, fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flex: 'none', fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      {icon ? <Icon name={icon} size={17} weight={300} /> : null}
      {children}
    </button>
  );
}
/** round 6, phone: a segmented control over aria-pressed buttons (var(--track, #E8E8EB) track, white thumb). For up to about 4 choices. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode }[]; value: T | undefined; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 2, padding: 2, borderRadius: 9, background: 'var(--track, #E8E8EB)' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} className="cp-press"
            style={{ minWidth: 0, height: 36, padding: '0 6px', borderRadius: 7, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background-color .15s' }}>{o.label}</button>
        );
      })}
    </div>
  );
}
/** a grey rounded field (no border) for the form fields that sit inside a flat group. */
/** (add className "cp-input cp-fill") */
export const phoneField: CSSProperties = { height: 44, border: 'none', borderRadius: 12, background: 'var(--fill, #F4F4F5)', padding: '0 12px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', minWidth: 0 };
