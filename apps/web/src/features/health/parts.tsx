// Small pieces shared by the health station and the readings screen, with the design's exact sizes.
import { useEffect, useRef, type ReactNode } from 'react';
import { BADGE, initials, type Health } from '@cp/shared';
import { Icon, TONES, FONT_BODY, FONT_SMALL, toneFor } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { photoFill } from '../../lib/media';

/** Status badge (icon + label, never colour alone): v3 small pill, 24px in lists, 30px in banners. */
export function Badge({ kind, size = 28, icon, label }: { kind: Health; size?: 28 | 32; icon?: number; label?: ReactNode }) {
  const t = useT();
  const b = BADGE[kind];
  const sm = size === 28;
  return (
    <span data-testid="status-badge" data-status={kind} style={{ height: sm ? 24 : 30, padding: sm ? '0 9px 0 6px' : '0 12px 0 8px', borderRadius: 999, background: b[2], color: b[1], fontSize: sm ? 'max(12px, var(--cp-small, 0px))' : 'max(13px, var(--cp-small, 0px))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: sm ? 3 : 5, whiteSpace: 'nowrap', flex: 'none' }}>
      <Icon name={b[0]} size={icon ? Math.min(icon, 16) : sm ? 15 : 18} fill={1} />
      {label ?? t('status.' + kind)}
    </span>
  );
}

/** Round avatar with initials in the member's tone (design: 44, 60 and 64px). */
export function Av({ name, tone, size, font, src }: { name: string; tone?: number; size: number; font: number; src?: string }) {
  const [bg, fg] = TONES[(tone ?? toneFor(name)) % 5];
  return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: photoFill(src, bg), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font, fontWeight: 500, flex: 'none' }}>{src ? null : initials(name)}</div>;
}

/** The design's pill switch under a result: dark when on, check icon + label (role switch). Long labels wrap instead of overflowing. */
export function PillSwitch({ on, label, onClick }: { on: boolean; label: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick}
      style={{ minHeight: 40, padding: '6px 16px 6px 10px', borderRadius: 12, border: on ? '1px solid #24201C' : '1px solid #DCD3C8', background: on ? '#24201C' : '#FFFFFF', color: on ? '#FFFFFF' : '#24201C', fontSize: 15, fontWeight: 500, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left', maxWidth: '100%', fontFamily: 'Inter' }}>
      <Icon name={on ? 'check_circle' : 'radio_button_unchecked'} size={22} fill={1} />
      <span>{label}</span>
    </button>
  );
}

/** Quick-note chip (design: 44px, no check icon). */
export function NoteChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  const { isPhone } = useDevice();
  // round 6, phone: a soft pill, ink when on, no outline
  const ph = isPhone ? { borderRadius: 999, border: 'none', background: on ? '#24201C' : '#F3EEE8', padding: '0 16px', minHeight: 40 } : null;
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={isPhone ? 'cp-press' : undefined}
      style={{ minHeight: 40, padding: '0 16px', borderRadius: 12, border: on ? '1px solid #24201C' : '1px solid #DCD3C8', background: on ? '#24201C' : '#FFFFFF', color: on ? '#FFFFFF' : '#24201C', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', maxWidth: '100%', ...ph }}>
      {children}
    </button>
  );
}

/** Round 6 (phone): an iOS segmented control. `role` "tab" makes it a tablist (aria-selected), "group" keeps pressed buttons (aria-pressed). */
export function PhoneSeg<V extends string>({ items, value, onChange, label, role = 'tab' }: { items: { value: V; label: ReactNode; aria?: string }[]; value: V; onChange: (v: V) => void; label: string; role?: 'tab' | 'group' }) {
  return (
    <div role={role === 'tab' ? 'tablist' : 'group'} aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0' }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role={role === 'tab' ? 'tab' : undefined} aria-selected={role === 'tab' ? on : undefined} aria-pressed={role === 'group' ? on : undefined} aria-label={it.aria} onClick={() => onChange(it.value)}
            style={{ minWidth: 0, height: 36, padding: '0 6px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'background-color .15s' }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Phone detail: a full-screen pushed page above the whole app (round 6: iOS look, the grey page sliding in from the right, a "‹ back" bar with the
 * position on the right). Children are laid out in a column with 22px between sections; a child may pin itself at the bottom with `position: sticky`
 * (margin 0 -16px). Escape closes it, focus moves in and returns to where it was.
 */
export function FullSheet({ open, onClose, back, pos, label, bg = '#F5F5F3', children }: { open: boolean; onClose: () => void; back: ReactNode; pos?: ReactNode; label: string; bg?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // callers pass inline arrows: read onClose through a ref so the effect (which moves focus) runs when the sheet opens, not on every render
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelectorAll('[aria-modal="true"]').length <= 1) close.current(); // a dialog on top closes first
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  useEffect(() => { if (open) scroller.current?.scrollTo({ top: 0 }); }, [open, label]);
  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="cp-native" style={{ position: 'fixed', inset: 0, zIndex: 15, background: bg, display: 'flex', flexDirection: 'column', animation: 'cpSlideL .2s ease-out', outline: 'none' }}>
      <div style={{ flex: 'none', height: 'calc(50px + env(safe-area-inset-top, 0px))', display: 'flex', alignItems: 'center', gap: 8, padding: 'env(safe-area-inset-top, 0px) 14px 0 2px' }}>
        <button type="button" className="cp-press" onClick={onClose} style={{ maxWidth: '70%', height: 44, padding: '0 8px 0 0', border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="chevron_left" size={32} weight={300} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{back}</span>
        </button>
        <span style={{ flex: 1 }} />
        {pos ? <span style={{ fontSize: FONT_BODY, color: '#6B6259', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{pos}</span> : null}
      </div>
      <div ref={scroller} className="cp-noshrink" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
    </div>
  );
}

/** Single-line input in the design's dialog style (52px, 16px radius). The shared TextField collapses to the text height inside a column label, so the dialogs use this. */
export function Field({ label, value, onChange, inputMode, error, placeholder, maxLength }: { label: ReactNode; value: string; onChange: (v: string) => void; inputMode?: 'decimal' | 'text' | 'numeric'; error?: string | false; placeholder?: string; maxLength?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error || undefined}
        style={{ height: 48, border: error ? '2px solid #9A3D24' : '1px solid #DDD1C2', borderRadius: 10, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', width: '100%', minWidth: 0 }} />
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_SMALL, color: '#9A3D24', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : null}
    </label>
  );
}

/** Search box in the v3 look: an underline, a search icon and a borderless input (with a clear button once something is typed). On the phone: the iOS grey search bar. */
export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const t = useT();
  const { isPhone } = useDevice();
  const clear = value ? (
    <button type="button" aria-label={t('common.clear')} onClick={() => onChange('')} className={isPhone ? 'cp-press' : 'h-cream'}
      style={{ position: 'absolute', right: isPhone ? 2 : 0, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#24201C', padding: 0 }}>
      <Icon name="close" size={isPhone ? 19 : 20} />
    </button>
  ) : null;
  // round 6, phone: the grey bar (#EAE6E0, radius 11, 40px), same as the Arrivals list
  if (isPhone) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 40, borderRadius: 11, background: '#EAE6E0' }}>
        <Icon name="search" size={19} color="#6B6259" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} autoComplete="off" spellCheck={false} enterKeyHint="search" data-testid="station-search"
          style={{ height: '100%', width: '100%', minWidth: 0, border: 'none', background: 'transparent', padding: value ? '0 44px 0 36px' : '0 12px 0 36px', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', outline: 'none' }} />
        {clear}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '1px solid #DDD1C2' }}>
      <Icon name="search" size={20} weight={300} color="#6B6259" style={{ position: 'absolute', left: 0, pointerEvents: 'none' }} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} autoComplete="off" spellCheck={false} enterKeyHint="search" data-testid="station-search"
        style={{ height: 44, width: '100%', minWidth: 0, border: 'none', background: 'transparent', padding: value ? '0 44px 0 30px' : '0 0 0 30px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none' }} />
      {clear}
    </div>
  );
}

/** A small "due" chip on a member's row: icon and words (never colour alone); `now` is stronger than `later`. */
export function DueChip({ icon, label, tone }: { icon: string; label: ReactNode; tone: 'now' | 'later' }) {
  const now = tone === 'now';
  return (
    <span data-testid="due-chip" data-tone={tone} style={{ minHeight: 28, padding: '3px 10px 3px 6px', borderRadius: 12, background: now ? '#F6ECD6' : '#F0EAE1', color: now ? '#7A5510' : '#24201C', fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 500, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
      <Icon name={icon} size={17} fill={now ? 1 : 0} />
      <span data-testid="due-chip-label">{label}</span>
    </span>
  );
}

/** A 44px round step button (previous / next day); `onClick` null = nothing further in that direction. */
export function StepButton({ icon, label, onClick }: { icon: string; label: string; onClick: (() => void) | null }) {
  return (
    <button type="button" aria-label={label} aria-disabled={!onClick || undefined} onClick={onClick ?? undefined} className={onClick ? 'h-cream' : undefined}
      style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #E4DACD', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'not-allowed', color: onClick ? '#24201C' : '#B5B0AC', flex: 'none', padding: 0 }}>
      <Icon name={icon} size={22} />
    </button>
  );
}
