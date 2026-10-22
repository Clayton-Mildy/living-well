// ImageLightbox: any plain picture (a scan, a KTP, a staff or profile photo, a catalog picture, a camera draft) opens full screen on tap.
// Dark, the picture contained; the round X and a tap outside the picture close it, and so does the phone's back gesture.
// (Records of type Photo open in PhotoViewer instead: it carries tags, hide and remove.)
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../lib/i18n';
import { Icon, useOverlayA11y } from './index';
import { useBackClose } from './useBackClose';

export function ImageLightbox({ src, alt = '', kind = 'image', onClose }: { src: string; alt?: string; kind?: 'image' | 'video'; onClose: () => void }) {
  const t = useT();
  const { ref, trap } = useOverlayA11y(true, onClose);
  useBackClose(true, onClose); // the back gesture closes the picture instead of leaving the page
  // Escape closes only the picture when it sits on top of a sheet or dialog (those also listen on window): capture it first
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const [broken, setBroken] = useState(false);
  // React events bubble out of a portal: the root keeps taps and keys from reaching the row or sheet underneath
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={alt || t('common.photoFull')} data-testid="image-lightbox" tabIndex={-1} onKeyDown={(e) => { e.stopPropagation(); trap(e); }} onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,16,12,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)', boxSizing: 'border-box', outline: 'none' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label={t('common.close')} title={t('common.close')} data-testid="image-lightbox-close"
        style={{ position: 'absolute', right: 8, top: 'calc(env(safe-area-inset-top, 0px) + 8px)', width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.14)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <Icon name="close" size={24} color="#FFFFFF" />
      </button>
      {kind === 'video'
        ? <video src={src} controls playsInline preload="metadata" aria-label={alt || undefined} data-testid="image-lightbox-img" onClick={(e) => e.stopPropagation()} style={media} />
        : broken
          ? <Icon name="broken_image" size={48} color="#CAB8A2" />
          : <img src={src} alt={alt} data-testid="image-lightbox-img" onClick={(e) => e.stopPropagation()} onError={() => setBroken(true)} style={media} />}
    </div>,
    document.body,
  );
}
const media: CSSProperties = { display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, background: '#000000' };

/**
 * A thumbnail button that opens its picture in the lightbox: wrap the thumbnail (`children`) and give the full-size `src`.
 * `disabled` (or no `src`) renders the children bare, as before. Extra controls (remove, badges) stay OUTSIDE this button.
 */
export function ImageOpen({ src, alt, label, kind, disabled, children, style, className }: { src?: string | null; alt?: string; /** the button's accessible name */ label: string; kind?: 'image' | 'video'; disabled?: boolean; children: ReactNode; style?: CSSProperties; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src || disabled) return <>{children}</>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} className={className ?? 'cp-press'}
        style={{ display: 'block', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in', flex: 'none', font: 'inherit', color: 'inherit', ...style }}>
        {children}
      </button>
      {open ? <ImageLightbox src={src} alt={alt ?? label} kind={kind} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
