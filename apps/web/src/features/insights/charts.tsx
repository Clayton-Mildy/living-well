// Visit insights: the small charts that are not time series (those use TrendChart): the weekday x hour heat map, vertical bars, a share bar and a thin
// progress bar. Every cell and bar can be hovered, focused or tapped; the text shows underneath ("Tue 10:00 · 21 in the club on average").
// Events are per element (no pointer maths), so the CSS zoom needs no correction here.
import { useState, type CSSProperties } from 'react';
import { FONT_SMALL } from '../../components/ui';
import { heatColor, heatGradient, hourText, INK, MUTED } from './lib';

const readout: CSSProperties = { minHeight: 20, fontSize: FONT_SMALL, lineHeight: '20px', color: '#4A4038', fontVariantNumeric: 'tabular-nums' };

// ---------- heat map ----------
export function HeatMap({ rows, hours, rowLabels, max, tip, peak, ariaLabel, compact, fewer, more, pick }: {
  /** [row][hour] */
  rows: number[][];
  hours: number[];
  rowLabels: string[];
  max: number;
  /** the sentence for a cell */
  tip: (row: number, hourIdx: number, v: number) => string;
  /** the cell shown before anything is tapped */
  peak: [number, number] | null;
  ariaLabel: string;
  /** phone: smaller cells and an hour label every second column */
  compact: boolean;
  fewer: string;
  more: string;
  /** the hint shown when there is nothing to show yet */
  pick: string;
}) {
  const [sel, setSel] = useState<[number, number] | null>(null);
  const cell = sel ?? peak;
  const h = compact ? 30 : 38;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div role="group" aria-label={ariaLabel} style={{ display: 'grid', gridTemplateColumns: `${compact ? 30 : 44}px repeat(${hours.length}, minmax(0, 1fr))`, gap: compact ? 3 : 4 }}>
        {rows.map((row, w) => [
          <div key={`l${w}`} style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: MUTED, height: h }}>{rowLabels[w]}</div>,
          ...row.map((v, i) => {
            const on = cell?.[0] === w && cell?.[1] === i;
            const k = max > 0 ? v / max : 0;
            const text = tip(w, i, v);
            return (
              <button key={`${w}-${i}`} type="button" title={text} aria-label={text} aria-pressed={sel?.[0] === w && sel?.[1] === i}
                onMouseEnter={() => setSel([w, i])} onFocus={() => setSel([w, i])} onClick={() => setSel([w, i])}
                style={{ height: h, minWidth: 0, padding: 0, border: 'none', borderRadius: 6, background: heatColor(k), color: k > 0.5 ? '#FFFFFF' : INK, fontSize: 11, fontWeight: 500, fontFamily: 'Inter', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', boxShadow: on ? `0 0 0 2px ${INK}` : 'none', position: 'relative', zIndex: on ? 1 : 0 }}>
                {v >= 0.5 ? Math.round(v) : ''}
              </button>
            );
          }),
        ])}
        <div aria-hidden="true" />
        {hours.map((hr, i) => (
          <div key={hr} aria-hidden="true" style={{ textAlign: 'center', fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums', minWidth: 0, overflow: 'visible', whiteSpace: 'nowrap' }}>
            {compact && i % 2 ? '' : hourText(hr)}{/* KC round 7: '08:00', so it reads as a time, not a date */}
          </div>
        ))}
      </div>
      <div style={readout} aria-live="polite">{cell ? tip(cell[0], cell[1], rows[cell[0]][cell[1]]) : pick}</div>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED }}>
        <span>{fewer}</span>
        <span style={{ flex: '0 1 140px', height: 8, borderRadius: 999, background: heatGradient }} />
        <span>{more}</span>
      </div>
    </div>
  );
}

// ---------- vertical bars ----------
export interface BarItem { key: string; label: string; value: number; /** the number written above the bar */ shown?: string; tip: string; color?: string }
export function Bars({ items, height = 104, color = '#75624B', ariaLabel, idle }: { items: BarItem[]; height?: number; color?: string; ariaLabel: string; /** the text before anything is tapped */ idle?: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const max = Math.max(1e-9, ...items.map((i) => i.value));
  const cur = items.find((i) => i.key === sel);
  const room = height - 18;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
        {items.map((it) => {
          const on = sel === it.key;
          return (
            <button key={it.key} type="button" title={it.tip} aria-label={it.tip} aria-pressed={on}
              onMouseEnter={() => setSel(it.key)} onFocus={() => setSel(it.key)} onClick={() => setSel(it.key)}
              style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter' }}>
              <span style={{ height, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 2, borderBottom: '1px solid #E4DACD' }}>
                <span style={{ fontSize: 11, lineHeight: '14px', color: on ? INK : MUTED, fontWeight: on ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>{it.shown ?? it.value}</span>
                <span style={{ width: '70%', maxWidth: 34, height: it.value > 0 ? Math.max(3, (it.value / max) * room) : 0, background: on ? INK : it.color || color, borderRadius: '5px 5px 1px 1px', transition: 'background .12s' }} />
              </span>
              <span style={{ fontSize: 12, color: on ? INK : MUTED, fontWeight: on ? 600 : 400, whiteSpace: 'nowrap' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
      {cur || idle ? <div style={readout} aria-live="polite">{cur ? cur.tip : idle}</div> : null}
    </div>
  );
}

// ---------- share bar ----------
export interface SharePart { key: string; label: string; value: number; color: string; tip: string }
export function ShareBar({ parts, ariaLabel }: { parts: SharePart[]; ariaLabel: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const total = parts.reduce((t, p) => t + p.value, 0);
  const cur = parts.find((p) => p.key === sel) ?? parts[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 2, height: 22 }}>
        {parts.map((p) => (
          <button key={p.key} type="button" title={p.tip} aria-label={p.tip} aria-pressed={sel === p.key}
            onMouseEnter={() => setSel(p.key)} onFocus={() => setSel(p.key)} onClick={() => setSel(p.key)}
            style={{ flex: total > 0 ? `${p.value} 1 0` : '1 1 0', minWidth: p.value > 0 ? 6 : 0, padding: 0, border: 'none', background: total > 0 && p.value === 0 ? 'transparent' : p.color, borderRadius: 6, cursor: 'pointer', opacity: sel && sel !== p.key ? 0.55 : 1, transition: 'opacity .12s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {parts.map((p) => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: INK }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
            {p.label}
            <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{total > 0 ? Math.round((p.value / total) * 100) : 0}%</span>
          </span>
        ))}
      </div>
      <div style={readout} aria-live="polite">{cur?.tip}</div>
    </div>
  );
}

// ---------- thin progress bar (Flex quota) ----------
export function ThinBar({ used, quota, extra = 0 }: { used: number; quota: number; extra?: number }) {
  const whole = Math.max(quota + extra, 1);
  const fill = Math.min(used, quota);
  return (
    <div aria-hidden="true" style={{ display: 'flex', height: 5, borderRadius: 999, background: '#EDE5DA', overflow: 'hidden' }}>
      <span style={{ width: `${(fill / whole) * 100}%`, background: INK }} />
      {extra > 0 ? <span style={{ width: `${(extra / whole) * 100}%`, background: '#C9A24D' }} /> : null}
    </div>
  );
}
