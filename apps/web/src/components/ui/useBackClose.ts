import { useEffect, useRef } from 'react';

/**
 * KC round 9 ("too many clicks… we still need to press back"): the phone's own back gesture closes an overlay. While it is open there is one extra
 * history entry (same address); Android's back button or the iPhone's edge swipe pops it and closes the overlay instead of leaving the page. When the
 * overlay closes another way, its entry is taken back off. The push waits a tick (React's strict mode mounts twice) and the clean-up checks a moment later
 * (a close that also navigates must not undo the navigation; the entry then simply stays behind).
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const token = 'o' + Math.random().toString(36).slice(2);
    let pushed = false, byBack = false;
    const push = window.setTimeout(() => { window.history.pushState({ ...(window.history.state || {}), cpOverlay: token }, ''); pushed = true; }, 0);
    const onPop = () => { if (pushed && window.history.state?.cpOverlay !== token) { byBack = true; pushed = false; cb.current(); } };
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(push);
      window.removeEventListener('popstate', onPop);
      if (pushed && !byBack) window.setTimeout(() => { if (window.history.state?.cpOverlay === token) window.history.back(); }, 40);
    };
  }, [open]);
}
