// Layout helpers shared by the health screens (not components, so the component files stay hot-reloadable).
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Eyebrow-style caption in the design's small caps (letter-spacing 1px, used above fields and groups). */
export const smallCaps = (spacing = '1px'): CSSProperties => ({ fontSize: 'max(13px, var(--cp-small, 0px))', letterSpacing: spacing, textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' });

/** Width of an element, kept up to date (to know when the queue and the detail stack). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref as React.RefObject<T>, w];
}

