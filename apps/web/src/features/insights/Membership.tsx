// KC round 9: Insights › Membership. Members in and out over the chosen range (3 months, 6 months, 1 year or custom): who joined and who left, each
// counted as Gold or Flex by the plan on that day; how many Gold and Flex members were active; and plan switches of members who stayed.
// Weekly bars up to about three months, monthly beyond (the rules decide: memberTrend).
import type { ReactNode } from 'react';
import type { MemberTrend, MemberTrendPoint, PlanCount } from '@cp/shared/rules/insights';
import { TrendChart } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { InOutBars, type InOutItem } from './charts';
import { FLEX_COLOR, GOLD_COLOR, INK, MUTED, Panel } from './lib';

const all = (c: PlanCount) => c.gold + c.flex;

function Kpi({ label, value, sub, testId }: { label: ReactNode; value: ReactNode; sub?: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 24, lineHeight: '28px', fontWeight: 300, letterSpacing: '-0.5px', color: '#2B231C', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 13, color: INK, fontWeight: 500, lineHeight: '17px' }}>{label}</span>
      {sub ? <span style={{ fontSize: 12, color: MUTED, lineHeight: '16px', fontVariantNumeric: 'tabular-nums' }}>{sub}</span> : null}
    </div>
  );
}

function Key({ items, note }: { items: { color: string; label: string; dashed?: boolean }[]; note?: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: INK }}>
      {items.map((x) => (
        <span key={x.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: x.color }} />{x.label}
        </span>
      ))}
      {note ? <span style={{ color: MUTED }}>{note}</span> : null}
    </div>
  );
}

export function Membership({ trend }: { trend: MemberTrend }) {
  const t = useT();
  const fmt = useFmt();
  const { isPhone } = useDevice();
  const { points, totals } = trend;
  const day = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' });
  const periodName = (p: MemberTrendPoint) => (trend.grain === 'week' ? t('insights.mWeekOf', { from: day(p.start), to: day(p.end) }) : fmt.fd(p.start, { month: 'long', year: 'numeric' }));
  const label = (p: MemberTrendPoint) => (trend.grain === 'week' ? day(p.start) : fmt.fd(p.start, { month: 'short' }));
  const gf = (c: PlanCount) => t('insights.mGoldFlex', { g: c.gold, f: c.flex });
  const grain = t(trend.grain === 'week' ? 'insights.mPerWeek' : 'insights.mPerMonth');
  const planKey = [{ color: GOLD_COLOR, label: t('insights.planGold') }, { color: FLEX_COLOR, label: t('insights.planFlex') }];

  const inOut: InOutItem[] = points.map((p) => ({
    key: p.start, label: label(p),
    up: [{ value: p.joined.gold, color: GOLD_COLOR }, { value: p.joined.flex, color: FLEX_COLOR }],
    down: [{ value: p.left.gold, color: GOLD_COLOR }, { value: p.left.flex, color: FLEX_COLOR }],
    tip: t('insights.mTipInOut', { period: periodName(p), j: all(p.joined), jg: p.joined.gold, jf: p.joined.flex, l: all(p.left), lg: p.left.gold, lf: p.left.flex }),
  }));
  const switches: InOutItem[] = points.map((p) => ({
    key: p.start, label: label(p),
    up: [{ value: p.toGold, color: GOLD_COLOR }],
    down: [{ value: p.toFlex, color: FLEX_COLOR }],
    tip: t('insights.mTipSwitch', { period: periodName(p), g: p.toGold, f: p.toFlex }),
  }));
  const byEnd = new Map(points.map((p) => [p.end, p]));
  const anyInOut = all(totals.joined) + all(totals.left) > 0;
  const anySwitch = totals.toGold + totals.toFlex > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 18 }}>
      <Panel>
        <div data-testid="member-kpis" style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isPhone ? '14px 12px' : 16 }}>
          <Kpi testId="kpi-joined" label={t('insights.mJoined')} value={all(totals.joined)} sub={gf(totals.joined)} />
          <Kpi testId="kpi-left" label={t('insights.mLeft')} value={all(totals.left)} sub={gf(totals.left)} />
          <Kpi testId="kpi-active" label={t('insights.mActiveNow')} value={all(totals.activeEnd)} sub={gf(totals.activeEnd)} />
          <Kpi testId="kpi-switches" label={t('insights.mSwitches')} value={totals.toGold + totals.toFlex} sub={t('insights.mSwitchSub', { g: totals.toGold, f: totals.toFlex })} />
        </div>
      </Panel>

      <Panel title={t('insights.mInOut')} meta={grain}>
        {anyInOut ? <InOutBars items={inOut} height={isPhone ? 150 : 180} ariaLabel={t('insights.mInOutAria')} idle={t('insights.mIdle')} />
          : <div style={{ fontSize: 14, color: MUTED, padding: '8px 0' }}>{t('insights.mNone')}</div>}
        <Key items={planKey} note={anyInOut ? t('insights.mInOutKey') : undefined} />
      </Panel>

      <Panel title={t('insights.mActive')} meta={grain}>
        <TrendChart legend height={isPhone ? 150 : 180} ariaLabel={t('insights.mActiveAria')} from={points[0]?.end} to={points[points.length - 1]?.end}
          series={[
            { key: 'gold', label: t('insights.planGold'), color: GOLD_COLOR, points: points.map((p) => ({ date: p.end, value: p.active.gold })) },
            { key: 'flex', label: t('insights.planFlex'), color: FLEX_COLOR, points: points.map((p) => ({ date: p.end, value: p.active.flex })) },
            { key: 'all', label: t('insights.mTotal'), color: INK, dashed: true, points: points.map((p) => ({ date: p.end, value: all(p.active) })) },
          ]}
          describe={(d) => { const p = byEnd.get(d); return p ? `${periodName(p)} · ${t('insights.mTipActive', { g: p.active.gold, f: p.active.flex, n: all(p.active) })}` : undefined; }} />
      </Panel>

      <Panel title={t('insights.mSwitches')} meta={grain}>
        {anySwitch ? <InOutBars items={switches} height={isPhone ? 110 : 130} ariaLabel={t('insights.mSwitchAria')} idle={t('insights.mIdle')} />
          : <div style={{ fontSize: 14, color: MUTED, padding: '8px 0' }}>{t('insights.mNoSwitch')}</div>}
        <Key items={[{ color: GOLD_COLOR, label: t('insights.mToGold') }, { color: FLEX_COLOR, label: t('insights.mToFlex') }]} note={anySwitch ? t('insights.mSwitchKey') : undefined} />
      </Panel>
    </div>
  );
}
