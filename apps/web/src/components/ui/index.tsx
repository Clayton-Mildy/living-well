// UI primitives with the design's exact values (Design System.dc.html + CitraPremier App.dc.html).
import { useEffect, useRef, type CSSProperties, type ReactNode, type KeyboardEvent as RKE } from 'react';
import { createPortal } from 'react-dom';
import { BADGE, type BadgeKey, type Member, initials } from '@cp/shared';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { photoFill } from '../../lib/media';
import { useUi } from '../../store/ui';
import { ImageOpen } from './ImageLightbox';

// Round 8c: every role speaks the family palette — white page, soft grey (var(--fill, #F4F4F5)) fills with no border or shadow, #E2E2E6 hairlines, pills for chips,
// var(--press, #EEEEF0) for pressed / tracks. A grey block carries className "cp-grey" and the controls on it ("cp-fill") turn white (global.css).
/** Hairline between rows and sections (0.5px var(--hairline, #E2E2E6)). */
export const HAIRLINE = '0.5px solid var(--hairline, #E2E2E6)';
// round 9: CSS variables, so the staff shell's warm skin (global.css, html[data-skin="warm"]) recolours them; the family app keeps these defaults
const FILL = 'var(--fill, #F4F4F5)', PRESS = 'var(--press, #EEEEF0)', TRACK = 'var(--track, #E8E8EB)'; // TRACK: segmented controls (visible on white and on a var(--fill, #F4F4F5) card)
export const FONT_BODY = 'max(14px, var(--cp-body, 0px))';
export const FONT_SMALL = 'max(13px, var(--cp-small, 0px))';
export const TONES: [string, string][] = [['#E8E1D8', 'var(--accent, #75624B)'], ['#DCCFC0', '#3E3326'], ['#EADFD3', '#6B5640'], ['#CAB8A2', '#2E261D'], ['#F1E7DC', 'var(--accent, #75624B)']];
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
export const Eyebrow = ({ children, color = 'var(--eyebrow, #6E5A43)', style, className }: { children: ReactNode; color?: string; style?: CSSProperties; className?: string }) => (
  <div className={className} style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color, lineHeight: '18px', ...style }}>{children}</div>
);
export const SectionLabel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <Eyebrow style={style}>{children}</Eyebrow>;
export function PageHead({ eyebrow, title, size = 36, right, sub }: { eyebrow?: ReactNode; title: ReactNode; size?: 40 | 36 | 32 | 28; right?: ReactNode; sub?: ReactNode }) {
  // Prototype v3: a large, light display title; 36/40 scale up on wide screens.
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {eyebrow ? <Eyebrow className="cp-eyebrow1">{eyebrow}</Eyebrow> : null}
        <h1 style={{ margin: 0, fontSize: size >= 36 ? `clamp(32px, 3.6vw, ${size + 12}px)` : size, lineHeight: 1.05, fontWeight: 400, letterSpacing: '-1.2px', color: '#2B231C' }}>{title}</h1>
        {sub ? <div className="cp-desc" style={{ fontSize: 14, lineHeight: '20px', maxWidth: 700, color: '#6B6259', marginTop: 2 }}>{sub}</div> : null}
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
  // Prototype v3 buttons are slimmer: 52 / 44 / 40 tall.
  const h = size === 56 ? 52 : size === 48 ? 44 : 40;
  const pad = size === 56 ? '0 26px' : size === 48 ? '0 20px' : '0 16px';
  const fs = size === 56 ? 16 : size === 48 ? 15 : 14;
  const v: Record<BtnVariant, CSSProperties> = {
    primary: { background: '#24201C', color: '#FFFFFF', border: 'none' },
    secondary: { background: FILL, color: '#24201C', border: 'none' },
    ghost: { background: FILL, color: 'var(--accent, #75624B)', border: 'none' },
    danger: { background: '#9A3D24', color: '#FFFFFF', border: 'none' },
    dark: { background: '#24201C', color: '#FFFFFF', border: 'none' },
    quiet: { background: FILL, color: '#24201C', border: 'none' },
  };
  const grey = variant === 'secondary' || variant === 'ghost' || variant === 'quiet';
  // round 8c contrast audit: a disabled button is a grey shape that turns white on a grey card (cp-fill), so it never vanishes into it
  const hover = disabled ? 'cp-fill' : variant === 'primary' || variant === 'dark' ? 'h-bronze' : grey ? 'h-fill cp-fill' : '';
  return (
    <button type={type} onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined} aria-label={label} title={title} className={`${hover} cp-btn${size === 56 ? ' cp-btn-56' : ''}${disabled ? '' : ' cp-press'}`}
      style={{ height: h, minHeight: h, padding: pad, borderRadius: h <= 40 ? 10 : 12, fontFamily: 'Inter', fontSize: fs, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', width: full ? '100%' : undefined, flex: full ? '1 1 auto' : 'none', // shares a row with its neighbours; minHeight keeps it from being squashed flat in a column (a sheet or drawer)
        ...v[variant], ...(disabled ? { background: PRESS, color: '#8A8078', border: 'none' } : {}), ...style }}>
      {icon ? <Icon name={icon} size={size === 56 ? 21 : 19} weight={300} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={19} weight={300} /> : null}
    </button>
  );
}
export function IconButton({ icon, label, onClick, size = 44, bordered = true, fill = 0, style, color = '#24201C' }: { icon: string; label: string; onClick?: () => void; size?: number; bordered?: boolean; fill?: 0 | 1; style?: CSSProperties; color?: string }) {
  // round and grey (bordered) or bare; a white icon (on the camera) gets no light hover tint
  const light = /^#f{3,6}$/i.test(color);
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={light ? undefined : bordered ? 'h-fill cp-fill' : 'h-cream'}
      style={{ width: size, height: size, borderRadius: 999, border: 'none', background: bordered ? FILL : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color, padding: 0, ...style }}>
      <Icon name={icon} size={22} fill={fill} />
    </button>
  );
}

// ---------- chips & badges ----------
/** The pill look: grey fill, ink when selected, no border (`bd` stays for callers that spread it; add className "cp-fill" to a grey one that sits on a grey block). */
export const chipStyle = (sel: boolean, off = false) => ({ bg: sel ? '#24201C' : FILL, fg: sel ? '#FFFFFF' : off ? '#8A8078' : '#24201C', bd: 'none' });
export function Chip({ selected = false, off = false, children, icon, onClick, size = 44, count, style }: { selected?: boolean; off?: boolean; children: ReactNode; icon?: string; onClick?: () => void; size?: 44 | 40 | 36; count?: number | string; style?: CSSProperties }) {
  const c = chipStyle(selected, off);
  return (
    <button type="button" aria-pressed={selected} aria-disabled={off || undefined} onClick={off ? undefined : onClick} className={selected ? 'cp-chip' : 'cp-chip cp-fill'}
      style={{ height: size - 4, padding: '0 14px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: size === 44 ? 15 : 14, fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', flex: 'none', ...style }}>
      {icon ? <Icon name={icon} size={17} /> : null}
      {children}
      {count !== undefined ? <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>{count}</span> : null}
    </button>
  );
}
export function InfoChip({ icon, label, tone = 'linen', iconColor }: { icon?: string; label: ReactNode; tone?: 'linen' | 'rust' | 'cream' | 'ink' | 'sage' | 'ochre'; iconColor?: string }) {
  const t = { linen: [FILL, '#4A4038'], rust: ['#F9E3DB', '#9A3D24'], cream: [FILL, '#4A4038'], ink: ['#24201C', '#FFFFFF'], sage: ['#E3EFE6', '#2F5A40'], ochre: ['#F6ECD6', '#7A5510'] }[tone];
  return (
    <span className={tone === 'linen' || tone === 'cream' ? 'cp-fill' : undefined} style={{ height: 28, padding: '0 11px', borderRadius: 999, background: t[0], color: t[1], fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
      {icon ? <Icon name={icon} size={16} color={iconColor || (tone === 'rust' ? '#9A3D24' : undefined)} /> : null}
      {label}
    </span>
  );
}
export function StatusBadge({ kind, label, small }: { kind: BadgeKey; label?: ReactNode; small?: boolean }) {
  const t = useT();
  const b = BADGE[kind];
  // the neutral kinds (outstanding, part paid, pending, void) are linen / cream in the shared table: here they are the family's soft grey
  const bg = b[2] as string, neutral = bg === '#E8E1D8' || bg === '#F0EAE1';
  return (
    <span className={neutral ? 'cp-fill' : undefined} style={{ height: small ? 24 : 28, padding: '0 11px 0 7px', borderRadius: 999, background: neutral ? PRESS : bg, color: b[1], fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', lineHeight: 1.4, flex: 'none' }}>
      <Icon name={b[0]} size={16} fill={kind === 'outstanding' || kind === 'pending' ? 0 : 1} />
      {label ?? t('status.' + kind)}
    </span>
  );
}
export const CountDot = ({ n, style }: { n: number; style?: CSSProperties }) =>
  n > 0 ? <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, background: '#2B231C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>{n > 99 ? '99+' : n}</span> : null;

// ---------- avatar & card ----------
export function Avatar({ name, member, tone, size = 48, ring, src, open = true }: { name: string; /** a member: initials come from the first and last name, never the title (any title, "Tante" included) */ member?: Pick<Member, 'title' | 'firstName' | 'lastName'> | null; tone?: number; size?: number; ring?: boolean; /** a photo (member profile picture) */ src?: string;
  /** KC 28 Oct: a photo opens full size on tap, even inside a row (the rest of the row keeps its own tap); false where the caller already opens it */
  open?: boolean }) {
  const t = useT();
  const [bg, fg] = TONES[(tone ?? toneFor(name)) % 5];
  return (
    <ImageOpen nested src={open ? src : undefined} label={`${t('common.openFull')} · ${name}`} style={{ borderRadius: 999 }}>
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(src, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.36), fontWeight: 500, flex: 'none', boxShadow: ring ? 'inset 0 0 0 3px #FFFFFF, 0 0 0 1px var(--field-bd, #E0E0E4)' : undefined }}>
      {src ? null : initials(member ?? name)}
    </div>
    </ImageOpen>
  );
}
/** Round 8c, the family card: a soft grey (var(--fill, #F4F4F5)) block, 20px radius, no border and no shadow (`shadow` is kept for old callers and does nothing). */
export function Card({ children, pad = 0, style }: { children: ReactNode; pad?: number | string; style?: CSSProperties; /** @deprecated cards have no shadow any more */ shadow?: boolean }) {
  return <div className="cp-grey" style={{ background: FILL, borderRadius: 20, overflow: 'hidden', padding: pad, ...style }}>{children}</div>;
}
/** Round 6 (phone, native look): header of an iOS-style grouped section; it sits outside the group, over the page. */
export const GROUP_HEAD: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 500, color: 'var(--group-head, #6B6259)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
/** Round 6 (phone, native look): an iOS-style grouped section, a small grey header over a grey (var(--fill, #F4F4F5)) rounded group, 16px radius, no shadow, no border. */
export function Group({ title, meta, children, label, pad = '14px 16px', gap = 10 }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; label?: string; pad?: number | string; gap?: number }) {
  return (
    <section aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {title || meta ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 16px' }}>
          <h2 style={GROUP_HEAD}>{title}</h2>
          {meta ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '18px', flex: 'none' }}>{meta}</span> : null}
        </div>
      ) : null}
      <div className="cp-grey" style={{ background: FILL, borderRadius: 16, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap }}>{children}</div>
    </section>
  );
}
export function CardHead({ title, meta, right }: { title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ padding: '18px 22px 10px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <SectionLabel>{title}</SectionLabel>
      {meta !== undefined ? <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span> : null}
      {right}
    </div>
  );
}
export const Row = ({ children, onClick, style, label }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; label?: string }) =>
  onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className="h-row cp-row" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', minHeight: 66, border: 'none', borderTop: HAIRLINE, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', ...style }}>{children}</button>
  ) : (
    <div className="cp-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', minHeight: 66, borderTop: HAIRLINE, ...style }}>{children}</div>
  );
export const RowText = ({ title, sub, titleSize = 16 }: { title: ReactNode; sub?: ReactNode; titleSize?: number }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: titleSize, fontWeight: 500, lineHeight: 1.35 }}>{title}</div>
    {sub ? <div style={{ fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.4 }}>{sub}</div> : null}
  </div>
);

// ---------- form controls ----------
export function Toggle({ on, onClick, label, sub, disabled }: { on: boolean; onClick: () => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick} className="cp-fill"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, border: 'none', background: FILL, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', color: '#24201C', fontFamily: 'Inter', width: '100%' }}>
      <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? '#3D6B4F' : 'var(--field-bd, #E0E0E4)', transition: 'background-color .2s', position: 'relative', flex: 'none', marginTop: 1 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
        {sub ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{sub}</span> : null}
      </span>
    </button>
  );
}
export function TextField({ label, value, onChange, placeholder, inputMode, type = 'text', error, hint, multiline, rows = 3, autoFocus, name, maxLength, onEnter, prefix }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'text' | 'tel' | 'numeric' | 'decimal' | 'email' | 'search';
  type?: string; error?: string | false; hint?: ReactNode; multiline?: boolean; rows?: number; autoFocus?: boolean; name?: string; maxLength?: number; onEnter?: () => void; prefix?: ReactNode;
}) {
  // round 8c: a soft grey field, no border, a 2px ink ring on focus (global.css .cp-input) and a rust ring on an error
  const ring = error ? 'inset 0 0 0 2px #9A3D24' : undefined;
  const common: CSSProperties = { border: 'none', borderRadius: prefix ? 0 : 12, background: prefix ? 'transparent' : FILL, boxShadow: prefix ? undefined : ring, padding: multiline ? '12px 14px' : '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', width: '100%', minWidth: 0 };
  const input = multiline ? (
    <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined} className={prefix ? 'cp-input' : 'cp-input cp-fill'} style={{ ...common, resize: 'vertical', lineHeight: '22px' }} />
  ) : (
    <input name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength} aria-invalid={!!error || undefined} className={prefix ? 'cp-input' : 'cp-input cp-fill'}
      onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') onEnter(); } : undefined} style={{ ...common, height: prefix ? '100%' : 'var(--cp-field-h, 52px)', flex: prefix ? 1 : 'none' }} />
  );
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: '#4A4038' }}>{label}</span> : null}
      {prefix ? (
        <span className={`cp-input-wrap cp-fill${error ? ' cp-err' : ''}`} style={{ display: 'flex', alignItems: 'center', height: 'var(--cp-field-h, 52px)', borderRadius: 12, background: FILL, boxShadow: ring, overflow: 'hidden' }}>
          <span style={{ padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', background: PRESS, fontSize: 16, flex: 'none' }}>{prefix}</span>
          {input}
        </span>
      ) : input}
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : hint ? <span style={{ fontSize: FONT_BODY, color: '#5E5852', lineHeight: 1.4 }}>{hint}</span> : null}
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
/** `cols` (round 9): lay the items out as an equal grid of that many columns (e.g. 2 × 2 on a phone when four labels would not fit in one row). */
export function Segmented<V extends string>({ items, value, onChange, label, cols }: { items: { value: V; label: ReactNode; count?: number }[]; value: V; onChange: (v: V) => void; label?: string; cols?: number }) {
  return (
    <div role="tablist" aria-label={label} style={cols ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 2, padding: 2, borderRadius: 9, background: TRACK, alignSelf: 'stretch' } : { display: 'flex', gap: 2, padding: 2, borderRadius: 9, background: TRACK, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.value)}
            style={{ height: 36, padding: cols ? '0 8px' : '0 16px', borderRadius: 7, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: on ? '#1E1A16' : '#5E5852', fontSize: FONT_BODY, fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: cols ? 'center' : undefined, minWidth: 0, gap: 6, fontFamily: 'Inter' }}>
            {it.label}
            {it.count !== undefined ? <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#6B6259' }}>{it.count}</span> : null}
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
      <div className="cp-empty-icon cp-fill" style={{ width: 72, height: 72, borderRadius: 999, background: FILL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent, #75624B)' }}><Icon name={icon} size={30} weight={300} /></div>
      <div style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px', fontWeight: 300, color: '#4A4038' }}>{title}</div>
      {sub ? <div style={{ fontSize: 14, lineHeight: '21px', color: '#6B6259', maxWidth: 320 }}>{sub}</div> : null}
      {action}
    </div>
  );
}
// translucent greys, so the placeholders read on a white page and on a grey block alike
const SKEL = 'rgba(30,30,36,.065)', SKEL_HI = 'rgba(30,30,36,.03)';
const shimmer: CSSProperties = { background: `linear-gradient(90deg,${SKEL} 0,${SKEL_HI} 40%,${SKEL} 80%)`, backgroundSize: '800px 100%', animation: 'cpShimmer 1.4s linear infinite' };
export function SkeletonRows({ n = 3, label = 'Loading' }: { n?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: HAIRLINE }}>
          <div style={{ width: 48, height: 48, borderRadius: 999, ...shimmer }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 14, width: `${55 - i * 7}%`, borderRadius: 8, ...shimmer }} />
            <div style={{ height: 12, width: `${35 - i * 3}%`, borderRadius: 8, background: SKEL }} />
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
      <div style={{ height: 36, width: 320, maxWidth: '80%', borderRadius: 8, ...shimmer }} />
      <div style={{ height: 220, borderRadius: 20, background: SKEL }} />
    </div>
  );
}
/** Phone-only primary action (design's "pin"): a compact pill at the bottom right, so it never covers a whole list row. The shell adds room under the page for it. */
export function Pin({ icon, label, onClick }: { icon: string; label: ReactNode; onClick: () => void }) {
  const pin = useUi((s) => s.pin);
  useEffect(() => { pin(1); return () => pin(-1); }, [pin]);
  return (
    // round 6: fixed just above the floating tab bar (86px + safe area), so it never stops halfway down a short page
    <div style={{ position: 'fixed', right: 0, bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))', zIndex: 44, padding: '4px 14px 10px', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <button type="button" onClick={onClick} className="h-bronze" style={{ pointerEvents: 'auto', height: 44, maxWidth: '100%', padding: '0 18px 0 14px', borderRadius: 999, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 10px 24px rgba(40,30,20,0.28)', fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
        <Icon name={icon} size={20} />
        {label}
      </button>
    </div>
  );
}
export const Note = ({ children, tone = 'cream', icon }: { children: ReactNode; tone?: 'cream' | 'ochre' | 'sage' | 'rust'; icon?: string }) => {
  const c = { cream: [FILL, '#24201C'], ochre: ['#F6ECD6', '#7A5510'], sage: ['#E3EFE6', '#3D6B4F'], rust: ['#F9E3DB', '#9A3D24'] }[tone];
  return (
    <div className={tone === 'cream' ? 'cp-fill' : undefined} style={{ fontSize: 14, lineHeight: '21px', padding: '12px 14px', borderRadius: 14, background: c[0], color: tone === 'cream' ? '#24201C' : c[1], display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {icon ? <Icon name={icon} size={20} fill={1} color={c[1]} style={{ marginTop: 1 }} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
};
export const StaffOnlyTag = () => {
  const t = useT();
  return <span className="cp-fill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: FONT_SMALL, fontWeight: 600, color: '#4A4038', background: FILL, borderRadius: 999, padding: '2px 10px 2px 6px', lineHeight: '20px', whiteSpace: 'nowrap' }}><Icon name="lock" size={16} />{t('common.staffOnly')}</span>;
};

// ---------- overlays ----------
const overlayStack: symbol[] = []; // the open overlays, the topmost last
let overflowBefore = '';
const escHandled = new WeakSet<Event>();
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
    // Esc closes only the topmost overlay: every overlay listens on window, and stopPropagation doesn't stop its siblings there
    const me = Symbol('overlay');
    if (!overlayStack.length) overflowBefore = document.body.style.overflow;
    overlayStack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || escHandled.has(e) || overlayStack[overlayStack.length - 1] !== me) return;
      escHandled.add(e); // the one that closed it: a lower overlay must not also react if the stack changes between listeners
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      overlayStack.splice(overlayStack.indexOf(me), 1);
      if (!overlayStack.length) document.body.style.overflow = overflowBefore; // the last one out restores the page scroll, whatever the closing order
      prev?.focus?.({ preventScroll: true });
    };
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

/** The round grey close button of a sheet, dialog or drawer header (the family popover's). */
export function CloseButton({ onClick, label, size = 32 }: { onClick: () => void; label: string; size?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="h-fill"
      style={{ width: size, height: size, borderRadius: 999, border: 'none', background: FILL, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0, color: '#24201C' }}>
      <Icon name="close" size={18} />
    </button>
  );
}
/** The dimmed backdrop behind every overlay (neutral, not warm). */
const SCRIM = 'rgba(20,16,12,.32)';

/**
 * Round 8c: a bottom sheet on a phone (white, 28px top corners, a handle) and a CENTRED dialog on tablet and laptop (radius 24, padding 18/22/22,
 * up to `maxWidth` wide) over a dimmed backdrop, like the family prototype. Header: the title (20/500) on the left, a round grey close button.
 */
export function Sheet({ open, onClose, title, children, footer, maxWidth = 600 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; maxWidth?: number }) {
  const t = useT();
  const { isWide } = useDevice();
  const { ref, trap } = useOverlayA11y(open, onClose);
  if (!open) return null;
  return portal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: isWide ? 'center' : 'flex-end', justifyContent: 'center', padding: isWide ? 24 : 0, boxSizing: 'border-box' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: SCRIM, animation: 'cpFade .16s ease-out' }} />
      <div ref={ref} className="cp-noshrink" onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ position: 'relative', width: '100%', maxWidth, maxHeight: isWide ? '90%' : '88%', overflowY: 'auto', background: '#FFFFFF', borderRadius: isWide ? 24 : '28px 28px 0 0', padding: isWide ? '18px 22px 22px' : '8px 20px calc(32px + env(safe-area-inset-bottom, 0px))', boxShadow: isWide ? '0 2px 6px rgba(40,30,20,.08), 0 24px 60px rgba(40,30,20,.22)' : undefined, display: 'flex', flexDirection: 'column', gap: 18, animation: isWide ? 'cpPop .2s cubic-bezier(.3,.7,.2,1)' : 'cpUp .22s ease-out', outline: 'none', boxSizing: 'border-box' }}>
        {isWide ? null : <span aria-hidden="true" style={{ display: 'block', alignSelf: 'center', width: 36, height: 5, borderRadius: 999, background: 'var(--outline, #D4D4D8)', flex: 'none' }} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="cp-serif cp-serif-up" style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 500, color: '#24201C', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</h2>
          <CloseButton label={t('common.close')} onClick={onClose} />
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: SCRIM, animation: 'cpFade .16s ease-out' }} />
      <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        style={{ position: 'relative', width: w, maxWidth: '100%', height: '100%', background: '#FFFFFF', display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out', boxShadow: '-12px 0 40px rgba(40,30,20,0.15)', outline: 'none' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <CloseButton label={t('common.close')} onClick={onClose} />
        </div>
        <div className="cp-noshrink" style={{ flex: 1, overflowY: 'auto', padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
        {footer ? <div style={{ padding: '16px 28px 24px', borderTop: HAIRLINE }}>{footer}</div> : null}
      </div>
    </div>,
  );
}
/** Round 6 (KC: "Today like a progress bar"): one step of a day's timeline. Passed steps and the line below them fill in bronze
 *  (the colour of the Flex visits bar); the running step is ink with a soft ring and a half-filled line; later steps sit on a grey track. */
export type RailState = 'done' | 'now' | 'up';
const RAIL: Record<RailState, { bg: string; bd: string; fg: string; fill: 0 | 1; line: string }> = {
  done: { bg: 'var(--accent, #75624B)', bd: 'none', fg: '#FFFFFF', fill: 1, line: 'var(--accent, #75624B)' },
  now: { bg: '#2B231C', bd: 'none', fg: '#FFFFFF', fill: 1, line: 'linear-gradient(var(--accent, #75624B) 0 50%, #E2E2E6 50% 100%)' },
  up: { bg: '#FFFFFF', bd: '1.5px solid var(--field-bd, #E0E0E4)', fg: '#8A8078', fill: 0, line: 'var(--hairline, #E2E2E6)' },
};
/** `src`: the step's picture (an activity photo) in place of the icon, ringed in the step's colour. */
export function RailDot({ state, icon, last, size = 34, src }: { state: RailState; icon: string; last?: boolean; size?: number; src?: string }) {
  const r = RAIL[state];
  const ring = state === 'done' ? 'var(--accent, #75624B)' : state === 'now' ? '#2B231C' : 'var(--field-bd, #E0E0E4)';
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: size }}>
      <span style={{ width: size, height: size, borderRadius: 999, background: src ? photoFill(src, FILL) : r.bg, border: src ? `2.5px solid ${ring}` : r.bd, color: r.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: state === 'now' ? '0 0 0 4px var(--hairline, #E2E2E6)' : undefined }}>
        {src ? null : <Icon name={icon} size={Math.round(size * 0.53)} fill={r.fill} weight={300} color={r.fg} />}
      </span>
      <span style={{ flex: 1, width: 3, minHeight: 12, borderRadius: 2, background: last ? 'transparent' : r.line }} />
    </div>
  );
}
/** Round 6 (phone, native look): a pushed full screen over the page, sliding in from the right. A top bar with "‹ back", a white page
 *  holding the grey grouped sections, and an optional footer pinned at the bottom for the main action. */
export function PhoneScreen({ open, onClose, label, back, children, footer }: { open: boolean; onClose: () => void; label: string; back: string; children: ReactNode; footer?: ReactNode }) {
  const { ref, trap } = useOverlayA11y(open, onClose);
  if (!open) return null;
  return portal(
    <div ref={ref} onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="cp-native"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#FFFFFF', animation: 'cpSlideL .2s ease-out', outline: 'none' }}>
      <div style={{ height: 50, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 6px 0 2px' }}>
        <button type="button" className="cp-press" onClick={onClose} aria-label={back} style={{ maxWidth: '100%', height: 44, padding: '0 8px 0 0', border: 'none', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="chevron_left" size={32} weight={300} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{back}</span>
        </button>
      </div>
      <div className="cp-noshrink" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
      {footer ? <div style={{ flex: 'none', padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: HAIRLINE, background: '#FFFFFF' }}>{footer}</div> : null}
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: SCRIM, animation: 'cpFade .16s ease-out' }} />
      <div ref={ref} className="cp-noshrink" onKeyDown={trap} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ position: 'relative', width: '100%', maxWidth, maxHeight: '92%', overflowY: 'auto', background: '#FFFFFF', borderRadius: 24, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, animation: 'cpUp .2s ease-out', boxShadow: '0 2px 6px rgba(40,30,20,.08), 0 24px 60px rgba(40,30,20,.22)', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eyebrow ? <Eyebrow className="cp-eyebrow1">{eyebrow}</Eyebrow> : null}
            <h2 className="cp-serif cp-serif-up" style={{ margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 500, color: '#24201C', overflowWrap: 'anywhere' }}>{title}</h2>
          </div>
          <CloseButton label={t('common.close')} onClick={onClose} />
        </div>
        {children}
        {footer ? <div style={{ position: 'sticky', bottom: -28, margin: '0 -28px -28px', padding: '16px 28px 24px', background: '#FFFFFF', borderTop: HAIRLINE, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</div> : null}
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
export { PhotoImg, PhotoThumbs } from './PhotoImg';
export { ImageLightbox, ImageOpen, PictureOpen } from './ImageLightbox';
export { DishThumb } from './DishThumb';
export { SignaturePad } from './SignaturePad';
export { useBackClose } from './useBackClose';
export { uiZoom } from './field';
export { TrendChart, TrendRangeTabs, TrendRangeControl, rangeFrom, rangeValue, windowOf, inWindow, TREND_RANGES, type TrendChartProps, type TrendPoint, type TrendSeries, type TrendRange, type RangeValue, type RangeChoice, type DateWindow } from './TrendChart';
export { MoodFaces, FACE_ICON } from './MoodFaces';
