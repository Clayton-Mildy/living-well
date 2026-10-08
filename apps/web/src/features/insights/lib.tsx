// Visit insights: small shared helpers (weekday names, minutes as HH:mm, the heat palette) and the section wrapper.
import { useMemo, type ReactNode } from 'react';
import { Group } from '../../components/ui';
import { useFmt, useT } from '../../lib/i18n';

export const FLEX_COLOR = '#75624B'; // bronze
export const GOLD_COLOR = '#C9A24D'; // gold
export const INK = '#24201C';
export const MUTED = '#6B6259';

const MONDAY = '2026-10-19';
const addD = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Mon … Fri names in the reader's language: short ('Mon') and long ('Monday'). */
export function useWeekdays() {
  const fmt = useFmt();
  return useMemo(() => {
    const dates = [0, 1, 2, 3, 4].map((i) => addD(MONDAY, i));
    return { short: dates.map((d) => fmt.fd(d, { weekday: 'short' })), long: dates.map((d) => fmt.fd(d, { weekday: 'long' })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt.lang]);
}

/** 570 -> '09:30' */
export const hhmm = (min: number) => { const m = Math.max(0, Math.round(min)); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
/** 8 -> '08:00' */
export const hourText = (h: number) => String(h).padStart(2, '0') + ':00';
/** One decimal, no trailing .0 */
export const num1 = (n: number) => String(Math.round(n * 10) / 10);
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** A stay in minutes as '6h 20m' / '45m'. */
export function useStay() {
  const t = useT();
  return (min: number | null) => (min === null ? '—' : min >= 60 ? t('insights.hm', { h: Math.floor(min / 60), m: min % 60 }) : t('insights.m', { m: min }));
}

// ----- the heat palette: warm sand to deep bronze
const STOPS: [number, number, number][] = [[247, 242, 235], [226, 212, 194], [186, 158, 124], [117, 98, 75], [62, 51, 38]];
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const c = STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export const heatGradient = `linear-gradient(90deg, ${STOPS.map((c, i) => `rgb(${c.join(',')}) ${Math.round((i / (STOPS.length - 1)) * 100)}%`).join(', ')})`;

/** A titled section: the iOS grouped block (white, rounded) with a small grey header. */
export function Panel({ title, meta, children, pad = '14px 16px', gap = 10 }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; pad?: number | string; gap?: number }) {
  return <Group title={title} meta={meta} pad={pad} gap={gap}>{children}</Group>;
}

/** A label on the left and a value on the right, one hairline row. */
export function Line({ label, value, first }: { label: ReactNode; value: ReactNode; first?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: first ? 'none' : '1px solid #F0EAE1', fontSize: 15 }}>
      <span style={{ color: MUTED, minWidth: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, color: INK, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
