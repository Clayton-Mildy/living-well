// Small pieces of the daily report: grouped-list rows, the "Show all" cap, a label-over-text fact, a tag, and the colours.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Health } from '@cp/shared';
import type { ReportMember } from '@cp/shared/rules/dailyReport';
import type { TFn } from '../../lib/i18n';
import { rowLine } from '../activity/lib';

export const SAGE = '#3D6B4F';
export const RUST = '#9A3D24';
export const OCHRE = '#7A5510';
export const MUTED = '#6B6259';
/** The dot of a reading's status: normal sage, watch ochre, alert rust. */
export const HEALTH_DOT: Record<Health, string> = { normal: '#3F7A55', watch: '#8A6216', alert: RUST };
export const MOOD_DOT = { cheerful: SAGE, calm: '#75624B', quiet: '#8A6216', agitated: RUST } as const;
export const LUNCH_DOT = { all: SAGE, most: '#8FB59B', half: '#E0C27A', little: '#D08A5E', none: RUST } as const;
export const LUNCH_KEY = { all: 'eatAll', most: 'eatMost', half: 'eatHalf', little: 'eatLittle', none: 'eatNone' } as const;

/** One row of a grouped list: 16px inset, a hairline above it (none on the first), a soft hover and press tint when it opens something. `inset` is where the hairline starts. */
export function Line({ first, inset = 16, onClick, children, style, label }: { first?: boolean; inset?: number; onClick?: () => void; children: ReactNode; style?: CSSProperties; label?: string }) {
  const base: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 52, backgroundColor: '#FFFFFF', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', ...rowLine(!!first, inset), ...style };
  if (onClick) return <button type="button" onClick={onClick} aria-label={label} className="h-row cp-tap-self" style={{ ...base, border: 'none', cursor: 'pointer' }}>{children}</button>;
  return <div style={base}>{children}</div>;
}
/** A label over its text (a menu line, an alternative), inside a group. */
export function Fact({ first, label, children }: { first?: boolean; label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 16px', backgroundColor: '#FFFFFF', ...rowLine(!!first) }}>
      <span style={{ fontSize: 13, lineHeight: '18px', color: MUTED }}>{label}</span>
      <div style={{ fontSize: 15, lineHeight: '21px', color: '#24201C', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}
/** "Changed", and other small status tags. */
export function Tag({ children, bg = '#F6ECD6', fg = OCHRE }: { children: ReactNode; bg?: string; fg?: string }) {
  return <span style={{ height: 20, padding: '0 8px', borderRadius: 7, background: bg, color: fg, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flex: 'none' }}>{children}</span>;
}
/** A group's long list shows its first rows and then "Show all N" (one row is never hidden behind the button). */
export function useCap<T>(items: T[], cap: number) {
  const [all, setAll] = useState(false);
  const over = items.length > cap + 1;
  return { shown: over && !all ? items.slice(0, cap) : items, over, all, toggle: () => setAll((v) => !v) };
}
export function MoreRow({ cap, total, t }: { cap: { over: boolean; all: boolean; toggle: () => void }; total: number; t: TFn }) {
  if (!cap.over) return null;
  return (
    <button type="button" onClick={cap.toggle} className="h-row cp-tap-self"
      style={{ width: '100%', height: 44, border: 'none', backgroundColor: '#FFFFFF', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', ...rowLine(false) }}>
      {cap.all ? t('report.showFewer') : t('report.showAll', { n: total })}
    </button>
  );
}
/** "09:48–15:40", "Since 09:48" (in the club now) or "09:48 · no check-out" (a past day nobody checked out on). */
export const visitTime = (t: TFn, x: Pick<ReportMember, 'checkIn' | 'checkOut' | 'inClub'>): string =>
  x.checkOut ? t('report.inOut', { a: x.checkIn, l: x.checkOut }) : x.inClub ? t('report.since', { a: x.checkIn }) : t('report.noOut', { a: x.checkIn });
