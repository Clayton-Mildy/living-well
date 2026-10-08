// KC round 7: the shared trend chart. Every trend in the app uses it, so every chart can be hovered or tapped to see the date and the value.
// Points are placed by date and time (several readings on one day spread by time). The mouse hovers, a finger taps or drags, the keyboard
// steps with the arrow keys; the pointer snaps to the nearest moment that has a reading and a card tells the date, the values and the grade.
// The pure maths (time scale, nearest point, ticks) lives in trendScale.ts.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import type { Health, HM, ISODate } from '@cp/shared';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { uiZoom } from './field';
import { DateField, Segmented } from './index';
import { editCustom, evenDates, inWindow, monthStarts, nearestIndex, niceTicks, pickChoice, rangeFrom, rangeValue, snapTargets, timeScale, windowOf, yDomain, type DateWindow, type RangeChoice, type RangeValue, type SnapTarget } from './trendScale';

export interface TrendPoint {
  date: ISODate;
  /** time of day; without it the point sits at noon (counts per day) */
  time?: HM;
  value: number;
  status?: Health;
  note?: string;
  /** a ready-made value for the tooltip ("134/82 mmHg") instead of format(value) + unit */
  text?: string;
}
export interface TrendSeries {
  key: string;
  label: string;
  points: TrendPoint[];
  dashed?: boolean;
  tone?: 'ink' | 'bronze' | 'muted';
}
export interface TrendChartProps {
  series: TrendSeries[];
  /** a shaded normal range */
  band?: { from: number; to: number };
  /** formats a value for the axis and the tooltip */
  format?: (v: number) => string;
  unit?: string;
  /** the date range shown (points are placed by date); default: the first to the last point */
  from?: ISODate;
  to?: ISODate;
  /** 'line' (default) or 'bars' (a count per day) */
  kind?: 'line' | 'bars';
  height?: number;
  ariaLabel: string;
  /** an extra tooltip line for a date */
  describe?: (date: ISODate) => string | undefined;
  /** small and without axes (a header sparkline); the readout goes in a line under the chart, which shows `caption` until you touch it */
  compact?: boolean;
  caption?: ReactNode;
  /** a key to the lines (solid / dashed) under the chart, when there is more than one */
  legend?: boolean;
  /** shown in place of the chart when nothing falls inside the range */
  empty?: ReactNode;
}

/** The ranges a trend can be looked at over. */
export type TrendRange = '1w' | '1m' | '3m' | '6m' | 'all';
export const TREND_RANGES: TrendRange[] = ['1w', '1m', '3m', '6m', 'all'];
export { rangeFrom, rangeValue, windowOf, inWindow };
export type { DateWindow, RangeChoice, RangeValue };

/** 1M / 3M / 6M / All, one small control above a chart or a group of charts. */
export function TrendRangeTabs({ value, onChange, label }: { value: TrendRange; onChange: (r: TrendRange) => void; label?: string }) {
  const t = useT();
  return <Segmented<TrendRange> label={label ?? t('health.rangeL')} value={value} onChange={onChange} items={TREND_RANGES.map((r) => ({ value: r, label: t('health.range.' + r) }))} />;
}

const RANGE_CHOICES: RangeChoice[] = [...TREND_RANGES, 'custom'];

/**
 * KC round 7 (client): "the chart better can be checked by a date range". 1M / 3M / 6M / All, and Custom, which opens a From and a To date (one slim
 * row under the control). The value is held by the screen (`rangeValue('3m')` to start); `windowOf(value, today, firstDate)` gives the {from, to} to hand
 * to the charts. `firstDate` is the oldest reading: no date before it can be picked. From is never after To (the other end follows).
 * Phone: a full-width segmented row (like the other phone controls), no sideways scroll.
 */
export function TrendRangeControl({ value, onChange, today, firstDate, label }: { value: RangeValue; onChange: (v: RangeValue) => void; today: ISODate; firstDate?: ISODate | null; label?: string }) {
  const t = useT();
  const { isPhone } = useDevice();
  const win = windowOf(value, today, firstDate);
  const items = RANGE_CHOICES.map((r) => ({ value: r, label: t('health.range.' + r) }));
  const pick = (c: RangeChoice) => onChange(pickChoice(value, c, today, firstDate));
  const min = firstDate && firstDate <= today ? firstDate : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {isPhone ? (
        <div role="tablist" aria-label={label ?? t('health.rangeL')} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0' }}>
          {items.map((it) => {
            const on = it.value === value.choice;
            return (
              <button key={it.value} type="button" role="tab" aria-selected={on} onClick={() => pick(it.value)}
                style={{ minWidth: 0, height: 36, padding: '0 4px', borderRadius: 9, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#1E1A16' : '#5E5852', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'background-color .15s' }}>
                {it.label}
              </button>
            );
          })}
        </div>
      ) : <Segmented<RangeChoice> label={label ?? t('health.rangeL')} value={value.choice} onChange={pick} items={items} />}
      {value.choice === 'custom' ? (
        <div data-testid="range-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 380 }}>
          <DateField compact label={t('health.rangeFrom')} value={win.from} min={min} max={today} onChange={(d) => onChange(editCustom(value, 'from', d, today, firstDate))} />
          <DateField compact label={t('health.rangeTo')} value={win.to} min={min} max={today} onChange={(d) => onChange(editCustom(value, 'to', d, today, firstDate))} />
        </div>
      ) : null}
    </div>
  );
}

const INK = '#24201C', BRONZE = '#75624B', MUTED = '#8A8078';
const TONE: Record<NonNullable<TrendSeries['tone']>, string> = { ink: INK, bronze: BRONZE, muted: MUTED };
const STATUS_FG: Record<Health, string> = { normal: '#2F5A40', watch: '#7A5510', alert: '#9A3D24' };
const FLAG: Record<'watch' | 'alert', string> = { watch: '#7A5510', alert: '#9A3D24' };
const defaultFormat = (v: number) => String(Math.round(v * 100) / 100);
const withUnit = (txt: string, unit?: string) => (unit ? (unit === '%' ? txt + unit : `${txt} ${unit}`) : txt);
const stamp = (p: { date: ISODate; time?: HM }) => p.date + 'T' + (p.time ?? '12:00');

/** Width of an element in page pixels (the page is CSS-zoomed: rects come back in screen pixels), kept up to date. */
function useMeasuredWidth(ref: RefObject<HTMLElement>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect().width / uiZoom();
      setW((old) => (Math.abs(old - r) < 0.5 ? old : r));
    };
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

interface TipRow { key: string; label: string; color: string; dashed: boolean; text: string; time?: HM; status?: Health; note?: string }

export function TrendChart({ series, band, format, unit, from, to, kind = 'line', height = 140, ariaLabel, describe, compact = false, caption, legend, empty }: TrendChartProps) {
  const t = useT();
  const { fd } = useFmt();
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const measured = useMeasuredWidth(wrap);
  const W = measured > 20 ? measured : 320;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [cardW, setCardW] = useState(0);
  const [ring, setRing] = useState(false);
  const viaKeys = useRef(false);
  const bars = kind === 'bars';
  const fmtV = format ?? defaultFormat;

  // ----- the data inside the range, in time order -----
  const everyDate = series.flatMap((s) => s.points.map((p) => p.date)).sort();
  const lo0 = from ?? everyDate[0], hi0 = to ?? everyDate[everyDate.length - 1];
  const vis = lo0 && hi0
    ? series.map((s) => ({ ...s, points: s.points.filter((p) => p.date >= lo0 && p.date <= hi0).sort((a, b) => (stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0)) }))
    : series.map((s) => ({ ...s, points: [] as TrendPoint[] }));
  const count = vis.reduce((n, s) => n + s.points.length, 0);

  // ----- the plot -----
  const padT = compact ? 5 : 10, padB = compact ? 5 : 24, padR = compact ? 4 : 6;
  const [yLo, yHi] = yDomain(vis.flatMap((s) => s.points.map((p) => p.value)), bars);
  const ticks = compact || !count ? [] : niceTicks(yLo, yHi, 3, bars);
  const tickText = ticks.map(fmtV);
  const padL = compact ? 4 : Math.max(1, ...tickText.map((x) => x.length)) * 6.8 + 12;
  const inset = compact ? 6 : 8;
  const x0 = padL + inset, x1 = Math.max(x0 + 10, W - padR - inset);
  const plotH = Math.max(10, height - padT - padB);
  const plotB = padT + plotH;
  const y = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo || 1)) * plotH;
  const sc = timeScale(lo0 ?? '1970-01-01', hi0 ?? '1970-01-01', x0, x1);
  const targets: SnapTarget[] = count ? snapTargets(vis, sc) : [];
  const xs = targets.map((tg) => tg.x);
  const act = activeKey ? targets.find((tg) => tg.key === activeKey) ?? null : null;
  const dayLabel = (d: ISODate, year: boolean) => fd(d, { weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).replace(/,/g, '');

  // ----- what the card says about the active moment -----
  const rows: TipRow[] = [];
  if (act) {
    vis.forEach((s, i) => {
      const same = s.points.filter((p) => p.date === act.date);
      const p = same.find((q) => (q.time ?? '') === (act.time ?? '')) ?? same[same.length - 1];
      if (!p) return;
      rows.push({
        key: s.key, label: s.label, color: TONE[s.tone ?? (i === 0 ? 'bronze' : 'muted')], dashed: !!s.dashed, text: p.text ?? withUnit(fmtV(p.value), unit),
        time: (p.time ?? '') !== (act.time ?? '') ? p.time : undefined, status: p.status, note: p.note,
      });
    });
  }
  const extra = act ? describe?.(act.date) : undefined;
  const head = act ? dayLabel(act.date, !compact) + (act.time && !compact ? ` · ${act.time}` : '') : '';
  const statusWord = (s?: Health) => (s ? t('status.' + s) : '');
  const rowText = (r: TipRow) => [vis.length > 1 ? r.label : '', r.time ?? '', r.text, statusWord(r.status)].filter(Boolean).join(' ');
  const liveText = act ? [head, ...rows.map(rowText), ...rows.flatMap((r) => (r.note ? [r.note] : [])), extra].filter(Boolean).join('. ') : '';

  // the card sits beside the guide line, on the side with room, and never leaves the chart
  useLayoutEffect(() => {
    const el = card.current;
    if (el) setCardW(el.getBoundingClientRect().width / uiZoom());
  }, [activeKey, liveText, compact]);
  const GAP = 12;
  const cardLeft = act ? Math.max(2, Math.min(act.x + GAP + cardW > W - 2 ? act.x - GAP - cardW : act.x + GAP, W - cardW - 2)) : 0;

  // a tap elsewhere puts it away
  const open = activeKey !== null;
  useEffect(() => {
    if (!open) return;
    const off = (e: globalThis.PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setActiveKey(null); };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [open]);

  const locate = (e: PointerEvent<HTMLDivElement>) => {
    if (!targets.length) return;
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    // the pointer is in screen pixels and the page is CSS-zoomed: divide by the zoom (equal to W / width when W was measured the same way)
    const i = nearestIndex(xs, r.width ? ((e.clientX - r.left) / r.width) * W : (e.clientX - r.left) / uiZoom());
    if (i >= 0) { viaKeys.current = false; setActiveKey(targets[i].key); }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!targets.length) return;
    const i = act ? targets.indexOf(act) : -1;
    let n = -2;
    if (e.key === 'ArrowLeft') n = i < 0 ? targets.length - 1 : Math.max(0, i - 1);
    else if (e.key === 'ArrowRight') n = i < 0 ? targets.length - 1 : Math.min(targets.length - 1, i + 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = targets.length - 1;
    else if (e.key === 'Escape' && act) { e.stopPropagation(); setActiveKey(null); return; }
    if (n === -2) return;
    e.preventDefault();
    viaKeys.current = true;
    setActiveKey(targets[n].key);
  };

  // ----- the axis labels -----
  const plotW = x1 - x0;
  const xLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; tick: boolean }[] = [];
  if (!compact && count) {
    const crossYears = sc.from.slice(0, 4) !== sc.to.slice(0, 4);
    if (sc.days > 62) {
      const monthPx = (plotW * 30.4) / sc.days;
      const step = [1, 2, 3, 4, 6, 12].find((n) => monthPx * n >= (crossYears ? 66 : 42)) ?? 12;
      const label = (d: ISODate, i: number) => fd(d, crossYears && (i === 0 || d.slice(5, 7) === '01') ? { month: 'short', year: 'numeric' } : { month: 'short' });
      const ms = monthStarts(sc.from, sc.to).filter((d) => (Number(d.slice(5, 7)) - 1) % step === 0);
      ms.forEach((d, i) => {
        const x = sc.x(d, '00:00');
        const text = label(d, i);
        if (x + text.length * 6.4 + 4 <= W - padR + 6) xLabels.push({ x: x + 3, text, anchor: 'start', tick: true });
      });
    }
    if (!xLabels.length) {
      const n = Math.max(2, Math.min(5, Math.floor(plotW / 88)));
      evenDates(sc.from, sc.to, n).forEach((d, i, a) => {
        const last = a.length > 1 && i === a.length - 1;
        xLabels.push({ x: i === 0 ? padL : last ? W - padR : sc.x(d), text: fd(d, { day: 'numeric', month: 'short' }), anchor: i === 0 ? 'start' : last ? 'end' : 'middle', tick: false });
      });
    }
  }

  // ----- drawing -----
  const dense = count > plotW / 6;
  // many readings (a long range): quiet dots, a Watch is small and an Alert stands out
  const rN = compact ? 2.4 : dense ? 1.7 : 3.2;
  const rF = (st: Health) => (st === 'alert' ? (compact || dense ? 3.8 : 4.8) : compact ? 3.2 : dense ? 2.6 : 4.2);
  const toneOf = (s: TrendSeries, i: number) => TONE[s.tone ?? (i === 0 ? 'bronze' : 'muted')];
  const slot = plotW / sc.days;
  const bw = Math.max(2, Math.min(22, (slot * 0.7) / Math.max(1, vis.length)));
  const bandTop = band ? Math.min(band.to, yHi) : 0, bandBot = band ? Math.max(band.from, yLo) : 0;

  return (
    <div
      ref={wrap}
      role="group"
      aria-label={ariaLabel}
      tabIndex={count ? 0 : undefined}
      onKeyDown={onKeyDown}
      onFocus={(e) => setRing(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => { setRing(false); if (viaKeys.current) setActiveKey(null); }}
      onPointerDown={locate}
      onPointerMove={(e) => { if (e.pointerType === 'mouse' || e.buttons) locate(e); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActiveKey(null); }}
      onPointerCancel={() => setActiveKey(null)}
      style={{ position: 'relative', width: '100%', minWidth: 0, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', outline: ring ? `2px solid ${BRONZE}` : 'none', outlineOffset: 2, borderRadius: 8 }}
    >
      {count ? (
        <>
          <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
            {band && bandTop > bandBot ? <rect x={padL} y={y(bandTop)} width={Math.max(0, W - padL - padR)} height={y(bandBot) - y(bandTop)} rx={4} fill="#E3EFE6" /> : null}
            {ticks.map((v, i) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#EDE7DE" strokeWidth={1} />
                <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={12} fontFamily="Inter" fill="#6B6259" style={{ fontVariantNumeric: 'tabular-nums' }}>{tickText[i]}</text>
              </g>
            ))}
            {xLabels.map((l, i) => (
              <g key={i}>
                {l.tick ? <line x1={l.x - 3} x2={l.x - 3} y1={plotB} y2={plotB + 5} stroke="#CFC5B8" strokeWidth={1} /> : null}
                <text x={l.x} y={height - 6} textAnchor={l.anchor} fontSize={12} fontFamily="Inter" fill="#6B6259">{l.text}</text>
              </g>
            ))}
            {bars ? (
              <>
                {act ? <rect x={act.x - Math.max(6, slot) / 2} y={padT} width={Math.max(6, slot)} height={plotH} rx={4} fill="#F5F2ED" /> : null}
                {vis.map((s, si) => s.points.map((p, pi) => {
                  const cx = sc.x(p.date, p.time);
                  const h = Math.max(p.value > 0 ? 1.5 : 0, plotB - y(p.value));
                  return <rect key={`${si}-${pi}`} x={cx - (vis.length * bw) / 2 + si * bw} y={plotB - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={p.status && p.status !== 'normal' ? FLAG[p.status] : toneOf(s, si)} />;
                }))}
              </>
            ) : (
              <>
                {act ? <line x1={act.x} x2={act.x} y1={padT} y2={plotB} stroke={INK} strokeOpacity={0.28} strokeWidth={1} /> : null}
                {vis.map((s, si) => (s.points.length > 1 ? (
                  <path key={s.key} fill="none" stroke={toneOf(s, si)} strokeWidth={compact ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined}
                    d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sc.x(p.date, p.time).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')} />
                ) : null))}
                {vis.map((s, si) => s.points.map((p, pi) => {
                  const flagged = !!p.status && p.status !== 'normal';
                  if (!flagged && dense) return null;
                  const hollow = !flagged && (s.dashed || s.tone === 'muted' || (!s.tone && si > 0));
                  return <circle key={`${si}-${pi}`} cx={sc.x(p.date, p.time)} cy={y(p.value)} r={flagged ? rF(p.status as Health) : rN}
                    fill={flagged ? FLAG[p.status as 'watch' | 'alert'] : hollow ? '#FFFFFF' : INK} stroke={flagged ? '#FFFFFF' : hollow ? toneOf(s, si) : 'none'} strokeWidth={flagged ? 1.5 : hollow ? 1.5 : 0} />;
                }))}
                {act ? vis.map((s, si) => s.points.filter((p) => p.date === act.date && (p.time ?? '') === (act.time ?? '')).map((p, pi) => {
                  const col = p.status && p.status !== 'normal' ? FLAG[p.status] : INK;
                  return (
                    <g key={`${si}-${pi}`}>
                      <circle cx={act.x} cy={y(p.value)} r={compact ? 5.5 : 7} fill="#FFFFFF" stroke={toneOf(s, si)} strokeWidth={compact ? 1.5 : 2} />
                      <circle cx={act.x} cy={y(p.value)} r={compact ? 3 : 4} fill={col} />
                    </g>
                  );
                })) : null}
              </>
            )}
          </svg>
          {legend && vis.length > 1 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', paddingTop: 6, fontSize: 13, color: '#6B6259', lineHeight: '18px' }}>
              {vis.map((s, i) => (
                <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 16, height: 0, borderTop: `2px ${s.dashed ? 'dashed' : 'solid'} ${toneOf(s, i)}` }} />
                  {s.label}
                </span>
              ))}
            </div>
          ) : null}
          {compact ? (
            <div style={{ minHeight: 18, paddingTop: 2, fontSize: 13, lineHeight: '18px', color: '#6B6259', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {act ? <><span>{head}</span><span> · </span><strong style={{ fontWeight: 600, color: INK }}>{rows.map((r) => r.text).join(' · ')}</strong>{rows.some((r) => r.status) ? ` · ${statusWord(rows.find((r) => r.status)?.status)}` : ''}</> : caption}
            </div>
          ) : act ? (
            <div ref={card} data-testid="trend-tip" style={{ position: 'absolute', top: 4, left: cardLeft, zIndex: 4, pointerEvents: 'none', minWidth: 120, maxWidth: Math.max(140, Math.min(240, W - 4)), padding: '8px 11px 9px', background: '#FFFFFF', border: '1px solid #E4DACD', borderRadius: 10, boxShadow: '0 6px 18px rgba(40,30,20,0.14)', fontSize: 13, lineHeight: '18px', color: INK, fontFamily: 'Inter', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{head}</span>
              {rows.map((r) => (
                <span key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {vis.length > 1 ? <span aria-hidden="true" style={{ width: 14, height: 0, borderTop: `2px ${r.dashed ? 'dashed' : 'solid'} ${r.color}`, flex: 'none' }} /> : null}
                    {vis.length > 1 ? <span style={{ color: '#6B6259' }}>{r.label}{r.time ? ` ${r.time}` : ''}</span> : null}
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.text}</span>
                    {r.status ? <span style={{ fontWeight: 600, color: STATUS_FG[r.status] }}>{statusWord(r.status)}</span> : null}
                  </span>
                  {r.note ? <span style={{ color: '#6B6259', overflowWrap: 'anywhere' }}>{r.note}</span> : null}
                </span>
              ))}
              {extra ? <span style={{ color: '#6B6259', overflowWrap: 'anywhere' }}>{extra}</span> : null}
            </div>
          ) : null}
        </>
      ) : empty ? (
        <div style={{ minHeight: compact ? 36 : Math.min(height, 90), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 14, lineHeight: 1.4, color: '#6B6259', background: '#FAF9F7', borderRadius: 10, padding: '10px 12px' }}>{empty}</div>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">{liveText}</span>
    </div>
  );
}
