// Shared pieces of the kit's custom fields: the label + trigger + message frame, and the popover layer
// (a floating panel under the trigger on tablet and laptop, a bottom sheet on phone).
// Imports from './index' are only used while rendering (index re-exports this file), never at module load.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as RKE, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../lib/i18n';
import { useDevice } from '../../hooks/useDevice';
import { FONT_BODY, Icon, IconButton } from './index';

/** ids that tie a label, its trigger and the message below together. */
export function useFieldIds(idProp?: string) {
  const uid = useId();
  const base = idProp || `f${uid.replace(/:/g, '')}`;
  return { trigger: base, label: `${base}-l`, msg: `${base}-m`, list: `${base}-list`, value: `${base}-v` };
}

/** The design's 52px field box (bronze border, 16px radius); `error` swaps in the rust border. */
export function triggerStyle(o: { error?: boolean; disabled?: boolean; open?: boolean }): CSSProperties {
  return {
    width: '100%', minWidth: 0, height: 'var(--cp-field-h, 52px)', padding: '0 14px', borderRadius: 16, background: o.disabled ? '#F4F0EE' : '#FFFFFF', color: o.disabled ? '#6A6967' : '#282828',
    border: o.error ? '2px solid #AF4B2F' : o.open ? '2px solid #75624B' : '1px solid #8A755B', fontFamily: 'Inter', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10,
    textAlign: 'left', cursor: o.disabled ? 'not-allowed' : 'pointer', ...(o.open || o.error ? { padding: '0 13px' } : {}),
  };
}

export function FieldFrame({ ids, label, error, hint, children }: { ids: ReturnType<typeof useFieldIds>; label?: ReactNode; error?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label ? <label id={ids.label} htmlFor={ids.trigger} style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{label}</label> : null}
      {children}
      {error ? <span id={ids.msg} role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}><Icon name="error" size={18} fill={1} />{error}</span>
        : hint ? <span id={ids.msg} style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{hint}</span> : null}
    </div>
  );
}

const FOCUSABLE = 'input, textarea, select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The popover layer. Escape and Tab are handled here and stopped, so a field inside a Sheet or Dialog
 * closes only its own popover. Focus returns to the trigger when it closes.
 */
export function PopLayer({ open, onClose, anchorRef, title, children, minWidth = 240, maxHeight = 340, menu }: {
  open: boolean; onClose: () => void; anchorRef: RefObject<HTMLElement | null>; title: string; children: ReactNode; minWidth?: number; maxHeight?: number;
  /** a plain list (Select): no dialog role on wide screens and Tab leaves the field instead of cycling inside */
  menu?: boolean;
}) {
  const t = useT();
  const { isPhone } = useDevice();
  const panel = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [pos, setPos] = useState<CSSProperties | null>(null);

  // position under (or above) the trigger on wide screens: on the side where the whole panel fits, else the roomier side (it then scrolls);
  // follows scroll, resize and the panel's own height (a calendar changes between a month and a year view)
  useLayoutEffect(() => {
    if (!open || isPhone) return;
    const place = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(Math.max(r.width, minWidth), vw - 16);
      const left = Math.min(Math.max(8, r.left), vw - width - 8);
      const below = vh - r.bottom - 12, above = r.top - 12;
      const want = Math.min(maxHeight, (inner.current?.scrollHeight ?? 0) + 2) || maxHeight;
      const down = below >= want || (above < want && below >= above);
      const mh = Math.max(160, Math.min(maxHeight, down ? below : above));
      const next: CSSProperties = down ? { left, width, top: r.bottom + 6, maxHeight: mh } : { left, width, bottom: vh - r.top + 6, maxHeight: mh };
      setPos((old) => (old && JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (inner.current) ro?.observe(inner.current);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); ro?.disconnect(); };
  }, [open, isPhone, anchorRef, minWidth, maxHeight]);

  // phone sheet: lock the page behind it
  useEffect(() => {
    if (!open || !isPhone) return;
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; };
  }, [open, isPhone]);

  // return focus to the trigger when the layer closes
  useEffect(() => {
    if (!open) return;
    const a = anchorRef.current;
    return () => { a?.focus?.({ preventScroll: true }); };
  }, [open, anchorRef]);

  if (!open) return null;
  const onKeyDown = (e: RKE<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close.current(); return; }
    if (e.key !== 'Tab' || !panel.current) return;
    e.stopPropagation();
    if (menu && !isPhone) { anchorRef.current?.focus({ preventScroll: true }); close.current(); return; } // focus returns to the trigger, then the browser moves on from there
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.tabIndex >= 0 || x.matches('[tabindex="0"]'));
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  };

  if (isPhone) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={() => close.current()} style={{ position: 'absolute', inset: 0, background: 'rgba(40,40,40,0.36)' }} />
        <div ref={panel} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}
          style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '86%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', animation: 'cpUp .22s ease-out', gap: 12 }}>
          <div style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 999, background: '#DBD7D6', flex: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: 'none' }}>
            <h2 style={{ margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 400, letterSpacing: '-0.4px', color: '#9A836C', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
            <IconButton icon="close" label={t('common.close')} onClick={() => close.current()} />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>{children}</div>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <>
      <div onClick={() => close.current()} style={{ position: 'fixed', inset: 0, zIndex: 69, background: 'transparent' }} />
      <div ref={panel} onKeyDown={onKeyDown} role={menu ? undefined : 'dialog'} aria-label={menu ? undefined : title}
        style={{ position: 'fixed', zIndex: 70, ...(pos || { left: -9999, top: 0, width: minWidth }), display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 16, boxShadow: '0 12px 32px rgba(40,30,20,0.16)', overflow: 'hidden' }}>
        <div ref={inner} style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>{children}</div>
      </div>
    </>,
    document.body,
  );
}
