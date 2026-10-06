// Small pieces shared by the health station and the readings screen, with the design's exact sizes.
import { useEffect, useRef, type ReactNode } from 'react';
import { BADGE, initials, type Health } from '@cp/shared';
import { Icon, TONES, FONT_BODY, FONT_SMALL, toneFor } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { photoFill } from '../../lib/media';

/** Status badge (icon + label, never colour alone): 28px in lists, 32px in banners. */
export function Badge({ kind, size = 28, icon, label }: { kind: Health; size?: 28 | 32; icon?: number; label?: ReactNode }) {
  const t = useT();
  const b = BADGE[kind];
  const sm = size === 28;
  return (
    <span data-testid="status-badge" data-status={kind} style={{ height: size, padding: sm ? '0 10px 0 6px' : '0 12px 0 8px', borderRadius: 999, background: b[2], color: b[1], fontSize: sm ? 'max(13px, var(--cp-small, 0px))' : FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6, whiteSpace: 'nowrap', flex: 'none' }}>
      <Icon name={b[0]} size={icon ?? (sm ? 18 : 20)} fill={1} />
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
      style={{ minHeight: 44, padding: '6px 16px 6px 10px', borderRadius: 999, border: on ? '1px solid #282828' : '1px solid #CAB8A2', background: on ? '#282828' : '#FFFFFF', color: on ? '#FFFFFF' : '#282828', fontSize: 16, fontWeight: 500, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left', maxWidth: '100%', fontFamily: 'Inter' }}>
      <Icon name={on ? 'check_circle' : 'radio_button_unchecked'} size={22} fill={1} />
      <span>{label}</span>
    </button>
  );
}

/** Quick-note chip (design: 44px, no check icon). */
export function NoteChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      style={{ minHeight: 44, padding: '0 16px', borderRadius: 999, border: on ? '1px solid #282828' : '1px solid #CAB8A2', background: on ? '#282828' : '#FFFFFF', color: on ? '#FFFFFF' : '#282828', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', maxWidth: '100%' }}>
      {children}
    </button>
  );
}

/**
 * Phone detail: a full-screen sheet above the whole app (design: the detail card turns into an absolutely positioned sheet) with a
 * sticky "← back" bar. Escape closes it, focus moves in and returns to where it was.
 */
export function FullSheet({ open, onClose, back, pos, label, bg = '#FFFFFF', children }: { open: boolean; onClose: () => void; back: ReactNode; pos?: ReactNode; label: string; bg?: string; children: ReactNode }) {
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
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} style={{ position: 'fixed', inset: 0, zIndex: 15, background: bg, display: 'flex', flexDirection: 'column', outline: 'none' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(8px + env(safe-area-inset-top, 0px)) 12px 8px', background: '#FFFFFF', borderBottom: '1px solid #EFECEA' }}>
        <button type="button" onClick={onClose} style={{ height: 44, padding: '0 14px 0 8px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
          <Icon name="arrow_back" size={22} color="#75624B" />
          {back}
        </button>
        <span style={{ flex: 1 }} />
        {pos ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', whiteSpace: 'nowrap' }}>{pos}</span> : null}
      </div>
      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>{children}</div>
    </div>
  );
}

/** Single-line input in the design's dialog style (52px, 16px radius). The shared TextField collapses to the text height inside a column label, so the dialogs use this. */
export function Field({ label, value, onChange, inputMode, error, placeholder, maxLength }: { label: ReactNode; value: string; onChange: (v: string) => void; inputMode?: 'decimal' | 'text' | 'numeric'; error?: string | false; placeholder?: string; maxLength?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error || undefined}
        style={{ height: 52, border: error ? '2px solid #AF4B2F' : '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', width: '100%', minWidth: 0 }} />
      {error ? <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_SMALL, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span> : null}
    </label>
  );
}

/** Search box in the kit's field look (52px, bronze border) with a clear button once something is typed. */
export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const t = useT();
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Icon name="search" size={22} color="#6A6967" style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} autoComplete="off" spellCheck={false} enterKeyHint="search" data-testid="station-search"
        style={{ height: 52, width: '100%', minWidth: 0, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: value ? '0 52px 0 46px' : '0 14px 0 46px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none' }} />
      {value ? (
        <button type="button" aria-label={t('common.clear')} onClick={() => onChange('')} className="h-cream"
          style={{ position: 'absolute', right: 4, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#282828', padding: 0 }}>
          <Icon name="close" size={20} />
        </button>
      ) : null}
    </div>
  );
}

/** A small "due" chip on a member's row: icon and words (never colour alone); `now` is stronger than `later`. */
export function DueChip({ icon, label, tone }: { icon: string; label: ReactNode; tone: 'now' | 'later' }) {
  const now = tone === 'now';
  return (
    <span data-testid="due-chip" data-tone={tone} style={{ minHeight: 28, padding: '3px 10px 3px 6px', borderRadius: 999, background: now ? '#F6ECD6' : '#EFECEA', color: now ? '#7A5510' : '#282828', fontSize: 'max(13px, var(--cp-small, 0px))', fontWeight: 500, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
      <Icon name={icon} size={17} fill={now ? 1 : 0} />
      <span data-testid="due-chip-label">{label}</span>
    </span>
  );
}

/** A 44px round step button (previous / next day); `onClick` null = nothing further in that direction. */
export function StepButton({ icon, label, onClick }: { icon: string; label: string; onClick: (() => void) | null }) {
  return (
    <button type="button" aria-label={label} aria-disabled={!onClick || undefined} onClick={onClick ?? undefined} className={onClick ? 'h-cream' : undefined}
      style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DBD7D6', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'not-allowed', color: onClick ? '#282828' : '#B5B0AC', flex: 'none', padding: 0 }}>
      <Icon name={icon} size={22} />
    </button>
  );
}
