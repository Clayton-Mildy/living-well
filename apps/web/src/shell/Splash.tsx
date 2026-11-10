// The family app's opening screen (KC's splash option 3, chosen 9 Nov; rolled out with the Living Well look, 10 Nov): the customer's gold, the white
// star in the middle and the white wordmark at the foot. It shows from the moment the family app opens and fades once the family's data is there:
// at least 0.9 s so it never flickers, at most 3 s, once per page load. Taps pass through it; the browser bar is gold while it shows.
import { useEffect, useRef, useState } from 'react';

/** The gold of the customer's logo PDF. */
export const SPLASH_GOLD = '#CFA550';
const MIN_MS = 900;
const MAX_MS = 3000;
const FADE_MS = 350;
type Phase = 'show' | 'fade' | 'gone';
let shown = false; // once per page load
const themeMeta = () => document.querySelector('meta[name="theme-color"]');

export function Splash({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<Phase>(() => (shown ? 'gone' : 'show'));
  const [minDone, setMinDone] = useState(false);
  const barBefore = useRef<string | null>(null);
  const restoreBar = () => {
    if (barBefore.current === null) return;
    themeMeta()?.setAttribute('content', barBefore.current);
    barBefore.current = null;
  };
  // the first frame: remember it was shown, turn the browser bar gold, start both clocks
  useEffect(() => {
    if (phase === 'gone') return;
    shown = true;
    const meta = themeMeta();
    if (meta && barBefore.current === null) {
      barBefore.current = meta.getAttribute('content') ?? '';
      meta.setAttribute('content', SPLASH_GOLD);
    }
    const min = window.setTimeout(() => setMinDone(true), MIN_MS);
    const max = window.setTimeout(() => setPhase((p) => (p === 'show' ? 'fade' : p)), MAX_MS);
    return () => { window.clearTimeout(min); window.clearTimeout(max); restoreBar(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'show' && minDone && ready) setPhase('fade'); }, [phase, minDone, ready]);
  useEffect(() => {
    if (phase !== 'fade') return;
    const t = window.setTimeout(() => setPhase('gone'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);
  useEffect(() => { if (phase === 'gone') restoreBar(); }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div data-testid="splash" data-phase={phase} role="img" aria-label="CitraPremier by Living Well Seniors Communities"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: SPLASH_GOLD, opacity: phase === 'fade' ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', padding: '0 24px calc(72px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/brand-mark-white.svg" alt="" style={{ width: 140, height: 140, display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ width: 40, height: 1, background: 'rgba(255, 255, 255, 0.7)' }} />
        <img src="/brand-wordmark-white.svg" alt="" style={{ width: 'min(296px, 76vw)', height: 'auto', display: 'block' }} />
      </div>
    </div>
  );
}
