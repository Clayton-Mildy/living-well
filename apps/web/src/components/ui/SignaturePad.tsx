// A signature pad (round 14 d): a canvas drawn with pointer events (mouse, touch and pen), full width and 180 px tall. `onChange` gets a PNG after each stroke ends,
// and null while the pad is empty (at first, and after Clear). touch-action: none keeps the page from scrolling under the finger.
import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { useT } from '../../lib/i18n';
import { Button } from './index';

const HEIGHT = 180;
const INK = '#24201C';

export function SignaturePad({ onChange, label }: { onChange: (png: Blob | null) => void; label: string }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);
  const dpr = () => Math.min(3, typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1);

  // size the bitmap to the laid-out box once (resizing a canvas wipes it), so a stroke is as sharp as the screen
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = Math.round((c.clientWidth || 320) * dpr());
    c.height = Math.round(HEIGHT * dpr());
    const g = c.getContext('2d');
    if (g) { g.lineWidth = 2.6 * dpr(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.fillStyle = INK; }
  }, []);

  /** the pointer's place in canvas pixels (the box is scaled by CSS, so measure it) */
  const at = (e: RPE<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    const sx = r.width ? c.width / r.width : 1, sy = r.height ? c.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };
  const down = (e: RPE<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
    const p = at(e);
    last.current = p;
    const g = e.currentTarget.getContext('2d');
    if (g) { g.beginPath(); g.arc(p.x, p.y, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); } // a tap leaves a dot
  };
  const move = (e: RPE<HTMLCanvasElement>) => {
    if (!last.current) return;
    e.preventDefault();
    const p = at(e), g = e.currentTarget.getContext('2d');
    if (g) { g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); }
    last.current = p;
  };
  const up = (e: RPE<HTMLCanvasElement>) => {
    if (!last.current) return;
    last.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* nothing to release */ }
    setInked(true);
    e.currentTarget.toBlob((b) => { if (b) onChange(b); }, 'image/png');
  };
  const clear = () => {
    const c = ref.current;
    last.current = null;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setInked(false);
    onChange(null);
  };

  return (
    <div>
      <div style={{ position: 'relative', background: '#FFFFFF', border: '0.5px solid var(--hairline, #E2E2E6)', borderRadius: 12, overflow: 'hidden' }}>
        <canvas ref={ref} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ display: 'block', width: '100%', height: HEIGHT, touchAction: 'none', cursor: 'crosshair' }} />
        {!inked ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontFamily: 'Inter', fontSize: 14, color: '#8A8078' }}>{label}</span> : null}
        <span aria-hidden="true" style={{ position: 'absolute', left: 16, right: 16, bottom: 36, borderBottom: '0.5px solid var(--hairline, #E2E2E6)', pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="quiet" size={48} onClick={clear}>{t('sign.clear')}</Button>
      </div>
    </div>
  );
}
