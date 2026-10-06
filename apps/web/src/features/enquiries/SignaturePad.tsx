// Signature capture (design setSig): a canvas the family signs with a finger or mouse. The strokes are stored as an SVG path
// (so staff can see the signature in the review) in a fixed 1000 x 300 space, whatever the screen size.
import { useCallback, useEffect, useRef } from 'react';
import { useT } from '../../lib/i18n';
import { FONT_BODY } from '../../components/ui';

export const SIG_W = 1000;
export const SIG_H = 300;

/** Draw an SVG path made of M and L commands onto a canvas context (canvas units, scaled to the canvas size). */
function paint(ctx: CanvasRenderingContext2D, d: string, w: number, h: number, dpr: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2.4 * dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#282828';
  const sx = w / SIG_W, sy = h / SIG_H;
  for (const m of d.matchAll(/M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)((?:\s*L\s*-?[\d.]+[\s,]+-?[\d.]+)*)/g)) {
    ctx.beginPath();
    ctx.moveTo(Number(m[1]) * sx, Number(m[2]) * sy);
    for (const p of m[3].matchAll(/L\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) ctx.lineTo(Number(p[1]) * sx, Number(p[2]) * sy);
    ctx.stroke();
  }
}

export function SignaturePad({ value, onChange, label, disabled }: { value: string; onChange: (svgPath: string) => void; label: string; disabled?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<string[]>([]);
  const cur = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const size = useCallback((el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.max(1, Math.round(r.width * dpr));
    el.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = el.getContext('2d');
    if (ctx) paint(ctx, strokes.current.join(' '), el.width, el.height, dpr);
  }, []);

  // restore a saved signature (draft) and keep the picture when the size changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    strokes.current = value ? value.split(/(?=M\s*-?[\d.])/).map((x) => x.trim()).filter(Boolean) : [];
    size(el);
  }, [value, size]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => size(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * SIG_W), Math.round(((e.clientY - r.top) / r.height) * SIG_H)] as const;
  };
  const draw = (e: React.PointerEvent<HTMLCanvasElement>, from: readonly [number, number], to: readonly [number, number]) => {
    const el = e.currentTarget;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.4 * (window.devicePixelRatio || 1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#282828';
    ctx.beginPath();
    ctx.moveTo((from[0] / SIG_W) * el.width, (from[1] / SIG_H) * el.height);
    ctx.lineTo((to[0] / SIG_W) * el.width, (to[1] / SIG_H) * el.height);
    ctx.stroke();
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const p = pt(e);
    cur.current = `M${p[0]} ${p[1]}`;
    draw(e, p, [p[0] + 0.1, p[1]]);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (cur.current === null) return;
    const p = pt(e);
    const last = cur.current.split(/[ML]/).filter(Boolean).pop()!.trim().split(/\s+/).map(Number);
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 3) return;
    draw(e, [last[0], last[1]], p);
    cur.current += ` L${p[0]} ${p[1]}`;
  };
  const up = () => {
    if (cur.current === null) return;
    const s = cur.current.includes('L') ? cur.current : `${cur.current} L${Number(cur.current.slice(1).split(' ')[0]) + 1} ${cur.current.split(' ')[1]}`;
    cur.current = null;
    strokes.current = [...strokes.current, s];
    onChangeRef.current(strokes.current.join(' '));
  };
  const clear = () => {
    strokes.current = [];
    const el = ref.current;
    el?.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    onChangeRef.current('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', height: 180, borderRadius: 16, border: '1px solid #8A755B', background: '#FFFFFF', overflow: 'hidden' }}>
        <canvas ref={ref} aria-label={label} role="img" data-testid="signature-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: disabled ? 'default' : 'crosshair' }} />
        {!value ? <span style={{ position: 'absolute', left: 16, bottom: 14, fontSize: FONT_BODY, color: '#6A6967', pointerEvents: 'none', lineHeight: 1.4 }}>{t('form.signHere')}</span> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={clear} disabled={disabled || !value} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: value ? 'pointer' : 'default', textDecoration: 'underline', textUnderlineOffset: 4, whiteSpace: 'nowrap', fontFamily: 'Inter', opacity: value ? 1 : 0.5 }}>{t('form.clear')}</button>
      </div>
    </div>
  );
}

/** The signature as an image for the staff review: scaled to the ink, whatever the original size. */
export function SignatureView({ path, height = 90 }: { path: string; height?: number }) {
  const nums = (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length < 4) return null;
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  const pad = 8;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return (
    <svg role="img" viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height, background: '#FFFFFF', borderRadius: 12, border: '1px solid #DBD7D6' }}>
      <path d={path} fill="none" stroke="#282828" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
