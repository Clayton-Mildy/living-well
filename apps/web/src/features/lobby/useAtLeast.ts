// Container-width switch: `wide` is true when the element is at least `min` px wide. `ready` turns true after the first real
// measurement, so effects that must not act on the guessed first render can wait for it.
import { useLayoutEffect, useState, type RefObject } from 'react';

export function useAtLeast(ref: RefObject<HTMLElement | null>, min: number) {
  const [state, setState] = useState({ wide: true, ready: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setState((c) => { const wide = el.clientWidth >= min; return c.ready && c.wide === wide ? c : { wide, ready: true }; });
    on();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min]);
  return state;
}
