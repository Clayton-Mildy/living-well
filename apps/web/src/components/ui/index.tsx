// UI primitives with the design's exact values (Design System.dc.html + CitraPremier App.dc.html).
import { useEffect, useRef, type CSSProperties, type ReactNode, type KeyboardEvent as RKE } from 'react';
import { createPortal } from 'react-dom';
import { BADGE, type BadgeKey, initials } from '@cp/shared';
import { useT } from '../../lib/i18n';
import { photoFill } from '../../lib/media';
import { useUi } from '../../store/ui';

export const FONT_BODY = 'max(14px, var(--cp-body, 0px))';
export const FONT_SMALL = 'max(13px, var(--cp-small, 0px))';
export const TONES: [string, string][] = [['#E8E1D8', '#75624B'], ['#DCCFC0', '#3E3326'], ['#EADFD3', '#6B5640'], ['#CAB8A2', '#2E261D'], ['#F1E7DC', '#75624B']];
const PTONES = ['#E8E1D8', '#DCCFC0', '#EADFD3', '#D9CDBF', '#F1E7DC'];
const PDEEP = ['#C9B49C', '#B9A28A', '#CDB9A3', '#BFA88F', '#D4C2AE'];
/** Placeholder photo background (design's photoBg). */
export const photoBg = (tone = 0) => { const t = (tone || 0) % 5; return `radial-gradient(120% 95% at 28% 22%, #FBF6F0 0%, ${PTONES[t]} 50%, ${PDEEP[t]} 100%)`; };
export const toneFor = (name: string) => (name.length + 2) % 5;

// ---------- icon & brand ----------
export function Icon({ name, size = 22, fill = 0, color, style, weight }: { name: string; size?: number; fill?: 0 | 1; color?: string; style?: CSSProperties; weight?: number }) {
  return (
    <span aria-hidden="true" className="ms" style={{ fontFamily: "'Material Symbols Rounded'", fontSize: size, lineHeight: 1, width: size, height: size, overflow: 'hidden', color, fontVariationSettings: `'FILL' ${fill}${weight ? `, 'wght' ${weight}` : ''}`, flex: 'none', ...style }}>
      {name}
    </span>
  );
}
/** Brand logo (logo-cp.jpg) in place of the text wordmark; multiply removes the JPG's white on cream backgrounds. */
export function Logo({ height = 47, style }: { height?: number; style?: CSSProperties }) {
  return <img src="/logo-cp.jpg" alt="CitraPremier by Living Well Seniors Communities" style={{ height, width: 'auto', display: 'block', mixBlendMode: 'multiply', maxWidth: '100%', objectFit: 'contain', objectPosition: 'left center', ...style }} />;
}

// ---------- typography ----------
export const Eyebrow = ({ children, color = '#6A6967', style, className }: { children: ReactNode; color?: string; style?: CSSProperties; className?: string }) => (
  <div className={className} style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color, lineHeight: '18px', ...style }}>{children}</div>
);
export const SectionLabel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <Eyebrow color="#282828" style={style}>{children}</Eyebrow>;
export function PageHead({ eyebrow, title, size = 36, right, sub }: { eyebrow?: ReactNode; title: ReactNode; size?: 40 | 36 | 32 | 28; right?: ReactNode; sub?: ReactNode }) {
  const lh = { 40: '48px', 36: '44px', 32: '40px', 28: '36px' }[size];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {eyebrow ? <Eyebrow className="cp-eyebrow1">{eyebrow}</Eyebrow> : null}
        <h1 style={{ margin: 0, fontSize: size, lineHeight: lh, fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</h1>
        {sub ? <div className="cp-desc" style={{ fontSize: 16, lineHeight: '22px', maxWidth: 700, color: '#282828' }}>{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

// ---------- buttons ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'quiet';
export function Button({ variant = 'primary', size = 48, icon, iconRight, children, onClick, disabled, full, type = 'button', style, label, title }: {
  variant?: BtnVariant; size?: 56 | 48 | 44; icon?: string; iconRight?: string; children?: ReactNode; onClick?: () => void; disabled?: boolean; full?: boolean; type?: 'button' | 'submit'; style?: CSSProperties; label?: string; title?: string;
}) {
  const pad = size === 56 ? '0 28px' : size === 48 ? '0 24px' : '0 18px';
  const fs = size === 56 ? 17 : size === 48 ? 16 : 15;
  const v: Record<BtnVariant, CSSProperties> = {
    primary: { background: '#75624B', color: '#FFFFFF', border: 'none' },
    secondary: { background: '#FFFFFF', color: '#75624B', border: '1px solid #75624B' },
    ghost: { background: 'transparent', color: '#75624B', border: 'none', textDecoration: 'underline', textUnderlineOffset: 4 },
    danger: { background: '#AF4B2F', color: '#FFFFFF', border: 'none' },
    dark: { background: '#282828', color: '#FFFFFF', border: 'none' },
    quiet: { background: '#FFFFFF', color: '#282828', border: '1px solid #DBD7D6' },
  };
  const hover = disabled ? '' : variant === 'primary' ? 'h-bronze' : variant === 'secondary' || variant === 'ghost' ? 'h-cream' : variant === 'quiet' ? 'h-border' : '';
  return (
    <button type={type} onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined} aria-label={label} title={title} className={`${hover} cp-btn${size === 56 ? ' cp-btn-56' : ''}`}
      style={{ height: size, padding: pad, borderRadius: 999, fontFamily: 'Inter', fontSize: fs, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', width: full ? '100%' : undefined, flex: full ? '1 1 auto' : 'none',
        ...v[variant], ...(disabled ? { background: '#E8E1D8', color: '#6A6967', border: 'none' } : {}), ...style }}>
      {icon ? <Icon name={icon} size={size === 56 ? 22 : 20} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={20} /> : null}
    </button>
  );
}
export function IconButton({ icon, label, onClick, size = 44, bordered = true, fill = 0, style, color = '#282828' }: { icon: string; label: string; onClick?: () => void; size?: number; bordered?: boolean; fill?: 0 | 1; style?: CSSProperties; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="h-cream"
      style={{ width: size, height: size, borderRadius: 999, border: bordered ? '1px solid #DBD7D6' : 'none', background: bordered ? '#FFFFFF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color, padding: 0, ...style }}>
      <Icon name={icon} size={22} fill={fill} />
    </button>
  );
}

// ---------- chips & badges ----------
export const chipStyle = (sel: boolean, off = false) => ({ bg: sel ? '#282828' : off ? '#F4F0EE' : '#FFFFFF', fg: sel ? '#FFFFFF' : off ? '#6A6967' : '#282828', bd: sel ? '1px solid #282828' : off ? '1px solid #EFECEA' : '1px solid #CAB8A2' });
export function Chip({ selected = false, off = false, children, icon, onClick, size = 44, count, style }: { selected?: boolean; off?: boolean; children: ReactNode; icon?: string; onClick?: () => void; size?: 44 | 40 | 36; count?: number | string; style?: CSSProperties }) {
  const c = chipStyle(selected, off);
  return (
    <button type="button" aria-pressed={selected} aria-disabled={off || undefined} onClick={off ? undefined : onClick} className="cp-chip"
      style={{ height: size, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: size === 44 ? 16 : 15, fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', flex: 'none', ...style }}>
      {selected && !icon ? <Icon name="check" size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {count !== undefined ? <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>{count}</span> : null}
    </button>
  );
}
export function InfoChip({ icon, label, tone = 'linen', iconColor }: { icon?: string; label: ReactNode; tone?: 'linen' | 'rust' | 'cream' | 'ink' | 'sage' | 'ochre'; iconColor?: string }) {
  const t = { linen: ['#E8E1D8', '#282828'], rust: ['#F7E4DD', '#282828'], cream: ['#F4F0EE', '#282828'], ink: ['#282828', '#FFFFFF'], sage: ['#E6EFE8', '#3D6B4F'], ochre: ['#F6ECD6', '#7A5510'] }[tone];
  return (
    <span style={{ height: 32, padding: '0 12px', borderRadius: 999, background: t[0], color: t[1], fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', lineHeight: 1.4, border: tone === 'cream' ? '1px solid #CAB8A2' : undefined }}>
      {icon ? <Icon name={icon} size={18} color={iconColor || (tone === 'rust' ? '#AF4B2F' : undefined)} /> : null}
      {label}
    </span>
  );
}
export function StatusBadge({ kind, label, small }: { kind: BadgeKey; label?: ReactNode; small?: boolean }) {
  const t = useT();
  const b = BADGE[kind];
  return (
    <span style={{ height: small ? 28 : 32, padding: '0 12px 0 8px', borderRadius: 999, background: b[2], color: b[1], fontSize: FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', lineHeight: 1.4, flex: 'none' }}>
      <Icon name={b[0]} size={20} fill={kind === 'outstanding' || kind === 'pending' ? 0 : 1} />
      {label ?? t('status.' + kind)}
    </span>
  );
}
export const CountDot = ({ n, style }: { n: number; style?: CSSProperties }) =>
  n > 0 ? <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 999, background: '#75624B', color: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>{n > 99 ? '99+' : n}</span> : null;

// ---------- avatar & card ----------
export function Avatar({ name, tone, size = 48, ring, src }: { name: string; tone?: number; size?: number; ring?: boolean; /** a photo (member profile picture) */ src?: string }) {
  const [bg, fg] = TONES[(tone ?? toneFor(name)) % 5];
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(src, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.36), fontWeight: 500, flex: 'none', boxShadow: ring ? 'inset 0 0 0 3px #FFFFFF, 0 0 0 1px #CAB8A2' : undefined }}>
      {src ? null : initials(name)}
    </div>
  );
}
export function Card({ children, pad = 0, style, shadow }: { children: ReactNode; pad?: number | string; style?: CSSProperties; shadow?: boolean }) {
  return <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden', padding: pad, boxShadow: shadow ? '0 8px 24px rgba(117,98,75,0.06)' : undefined, ...style }}>{children}</div>;
}
export function CardHead({ title, meta, right }: { title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <SectionLabel>{title}</SectionLabel>
      {meta !== undefined ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{meta}</span> : null}
      {right}
    </div>
  );
}
export const Row = ({ children, onClick, style, label }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; label?: string }) =>
  onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className="h-row cp-row" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', minHeight: 68, border: 'none', borderTop: '1px solid #EFECEA', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter', ...style }}>{children}</button>
  ) : (
    <div className="cp-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', minHeight: 68, borderTop: '1px solid #EFECEA', ...style }}>{children}</div>
  );
export const RowText = ({ title, sub, titleSize = 17 }: { title: ReactNode; sub?: ReactNode; titleSize?: number }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: titleSize, fontWeight: 500, lineHeight: 1.35 }}>{title}</div>
    {sub ? <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</div> : null}
  </div>
);

// ---------- form controls ----------
export function Toggle({ on, onClick, label, sub, disabled }: { on: boolean; onClick: () => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 16, border: '1px solid #DBD7D6', background: '#FFFFFF', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', color: '#282828', fontFamily: 'Inter', width: '100%' }}>
      <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? '#75624B' : '#6A6967', position: 'relative', flex: 'none', marginTop: 1 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
        {sub ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</span> : null}
      </span>
    </button>
  );
}
export function TextField({ label, value, onChange, placeholder, inputMode, type = 'text', error, hint, multiline, rows = 3, autoFocus, name, maxLength, onEnter, prefix }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'text' | 'tel' | 'numeric' | 'decimal' | 'email' | 'search';
  type?: string; error?: string | false; hint?: ReactNode; multiline?: boolean; rows?: number; autoFocus?: boolean; name?: string; maxLength?: number; onEnter?: () => void; prefix?: ReactNode;
}) {
  const border = error ? '2px solid #AF4B2F' : '1px solid #8A755B';
  const common: CSSProperties = { border: prefix ? 'none' : border, borderRadius: prefix ? 0 : 16, background: '#FFFFFF', padding: multiline ? '12px 14px' : '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', width: '100%', minWidth: 0 };
  const input = multiline ? (
    <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined} style={{ ...common, resize: 'vertical', lineHeight: '22px' }} />
  ) : (
    <input name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined}
      onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') onEnter(); } : undefined} style={{ ...common, height: prefix ? '100%' : 'var(--cp-field-h, 52px)', flex: prefix ? 1 : 'none' }} />
  );
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span> : null}
      {prefix ? (
        <span style={{ display: 'flex', alignItems: 'center', height: 'var(--cp-field-h, 52px)', border, borderRadius: 16, background: '#FFFFFF', overflow: 'hidden' }}>
          <span style={{ padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', background: '#F4F0EE', borderRight: '1px solid #DBD7D6', fontSize: 16, flex: 'none' }}>{prefix}</span>
          {input}
        </span>
      ) : input}
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : hint ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}
export function ChipGroup<V extends string | number | boolean>({ label, options, value, onChange, multi }: { label?: ReactNode; options: { value: V; label: ReactNode; off?: boolean }[]; value: V | V[] | null; onChange: (v: V | V[]) => void; multi?: boolean }) {
  const sel = (v: V) => (multi ? (value as V[]).includes(v) : value === v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label ? <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group">
        {options.map((o) => (
          <Chip key={String(o.value)} selected={sel(o.value)} off={o.off} onClick={() => onChange(multi ? (sel(o.value) ? (value as V[]).filter((x) => x !== o.value) : [...(value as V[]), o.value]) : o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
export function Segmented<V extends string>({ items, value, onChange, label }: { items: { value: V; label: ReactNode; count?: number }[]; value: V; onChange: (v: V) => void; label?: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#E8E1D8', alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.value)}
            style={{ height: 40, padding: '0 16px', borderRadius: 999, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: FONT_BODY, fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter' }}>
            {it.label}
            {it.count !== undefined ? <span style={{ fontVariantNumeric: 'tabular-nums', color: '#6A6967' }}>{it.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------- states ----------
export function EmptyState({ icon, title, sub, action }: { icon: string; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="cp-empty" style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <div className="cp-empty-icon" style={{ width: 72, height: 72, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A755B' }}><Icon name={icon} size={34} /></div>
      <div style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{title}</div>
      {sub ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#6A6967', maxWidth: 320 }}>{sub}</div> : null}
      {action}
    </div>
  );
}
const shimmer: CSSProperties = { background: 'linear-gradient(90deg,#EFECEA 0,#F7F5F3 40%,#EFECEA 80%)', backgroundSize: '800px 100%', animation: 'cpShimmer 1.4s linear infinite' };
export function SkeletonRows({ n = 3, label = 'Loading' }: { n?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: '1px solid #EFECEA' }}>
          <div style={{ width: 48, height: 48, borderRadius: 999, ...shimmer }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 14, width: `${55 - i * 7}%`, borderRadius: 8, ...shimmer }} />
            <div style={{ height: 12, width: `${35 - i * 3}%`, borderRadius: 8, background: '#EFECEA' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: 40 }} aria-busy="true" aria-label="Loading">
      <div style={{ height: 14, width: 180, borderRadius: 8, ...shimmer }} />
      <div style={{ height: 36, width: 320, maxWidth: '80%', borderRadius: 12, ...shimmer }} />
      <div style={{ height: 220, borderRadius: 24, background: '#EFECEA' }} />
    </div>
  );
}
/** Phone-only primary action (design's "pin"): a compact pill at the bottom right, so it never covers a whole list row. */
export function Pin({ icon, label, onClick }: { icon: string; label: ReactNode; onClick: () => void }) {
  const pin = useUi((s) => s.pin);
  useEffect(() => { pin(1); return () => pin(-1); }, [pin]);
  return (
    <div style={{ position: 'sticky', bottom: 0, zIndex: 4, padding: '4px 14px 10px', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <button type="button" onClick={onClick} className="h-bronze" style={{ pointerEvents: 'auto', height: 46, maxWidth: '100%', padding: '0 18px 0 14px', borderRadius: 999, border: 'none', background: '#75624B', color: '#FFFFFF', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 6px 16px rgba(60,45,30,0.28)', fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
        <Icon name={icon} size={20} />
        {label}
      </button>
    </div>
  );
}
export const Note = ({ children, tone = 'cream', icon }: { children: ReactNode; tone?: 'cream' | 'ochre' | 'sage' | 'rust'; icon?: string }) => {
  const c = { cream: ['#F4F0EE', '#282828'], ochre: ['#F6ECD6', '#7A5510'], sage: ['#E6EFE8', '#3D6B4F'], rust: ['#F7E4DD', '#AF4B2F'] }[tone];
  return (
    <div style={{ fontSize: 16, lineHeight: '22px', padding: '12px 14px', borderRadius: 16, background: c[0], color: tone === 'cream' ? '#282828' : c[1], display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {icon ? <Icon name={icon} size={20} fill={1} color={c[1]} style={{ marginTop: 1 }} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
};
export const StaffOnlyTag = () => {
  const t = useT();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: FONT_SMALL, fontWeight: 600, color: '#282828', background: '#E8E1D8', borderRadius: 999, padding: '2px 10px 2px 6px', lineHeight: '20px', whiteSpace: 'nowrap' }}><Icon name="lock" size={16} />{t('common.staffOnly')}</span>;
};

// ---------- overlays ----------
export function useOverlayA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // callers pass inline arrows; reading onClose through a ref keeps focus from jumping on every re-render
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])');
    (first || el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = body; prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  const trap = (e: RKE<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>('input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return { ref, trap };
}
const portal = (node: ReactNode) => createPortal(node, document.body);

/** Bottom sheet (design: max 600px, 28px top radius, grab handle). */
export function Sheet({ open, onClose, title, children, footer, maxWidth = 600 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(open, onClose);
  if (!open) return null;
  return portal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(40,40,40,0.36)' }} />
      <div ref={ref} className="cp-noshrink" onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ position: 'relative', width: '100%', maxWidth, maxHeight: '88%', overflowY: 'auto', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '10px 20px 32px', display: 'flex', flexDirection: 'column', gap: 18, animation: 'cpUp .22s ease-out', outline: 'none' }}>
        <div style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 999, background: '#DBD7D6' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</h2>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>
        {children}
        {footer}
      </div>
    </div>,
  );
}
/** Right-hand side panel (design's member drawer: 440px wide, full width on phone). */
export function Drawer({ open, onClose, label, children, footer, width = 440 }: { open: boolean; onClose: () => void; label: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(open, onClose);
  if (!open) return null;
  const w = typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${width}px`;
  return portal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(40,40,40,0.32)' }} />
      <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        style={{ position: 'relative', width: w, maxWidth: '100%', height: '100%', background: '#FFFFFF', display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out', boxShadow: '-12px 0 40px rgba(40,30,20,0.15)', outline: 'none' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="cp-noshrink" style={{ flex: 1, overflowY: 'auto', padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
        {footer ? <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #EFECEA' }}>{footer}</div> : null}
      </div>
    </div>,
  );
}
/** Centred dialog (design's member-edit dialog: max 640px, 28px radius). */
export function Dialog({ open, onClose, eyebrow, title, children, footer, maxWidth = 640 }: { open: boolean; onClose: () => void; eyebrow?: ReactNode; title: ReactNode; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(open, onClose);
  if (!open) return null;
  return portal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(40,40,40,0.32)' }} />
      <div ref={ref} className="cp-noshrink" onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ position: 'relative', width: '100%', maxWidth, maxHeight: '92%', overflowY: 'auto', background: '#FFFFFF', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, animation: 'cpUp .2s ease-out', boxShadow: '0 24px 60px rgba(40,30,20,0.2)', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eyebrow ? <Eyebrow className="cp-eyebrow1">{eyebrow}</Eyebrow> : null}
            <h2 style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</h2>
          </div>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </div>
        {children}
        {footer ? <div style={{ position: 'sticky', bottom: -28, margin: '0 -28px -28px', padding: '16px 28px 24px', background: '#FFFFFF', borderTop: '1px solid #EFECEA', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</div> : null}
      </div>
    </div>,
  );
}

// ---------- kit (round 2): custom fields, paging, camera, photos ----------
export { Select, type SelectOption } from './Select';
export { FilterChips } from './FilterChips';
export { DateField, MonthField } from './DateField';
export { TimeField } from './TimeField';
export { usePaged, Pager, type Paged } from './Pager';
export { CameraCapture, type CaptureInfo } from './CameraCapture';
export { PhotoImg } from './PhotoImg';
