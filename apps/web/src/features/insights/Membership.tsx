// KC round 9: Insights › Membership. Members in and out over the chosen range (3 months, 6 months, 1 year or custom): who joined and who left, each
// counted by the plan on that day; how many members were active on each plan; and plan switches of members who stayed (above the line the plan moved to,
// below it the plan left). KC 28 Oct: every plan on its own, a catalogue plan beside Flex and Gold once someone is on it (the rules decide: memberTrend).
// Weekly bars up to about three months, monthly beyond.
import type { ReactNode } from 'react';
import { planLabel, type Plan } from '@cp/shared';
import { planCountOf, planCountTotal, type MemberTrend, type MemberTrendPoint, type PlanCount } from '@cp/shared/rules/insights';
import { TrendChart } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { InOutBars, type InOutItem } from './charts';
import { INK, MUTED, Panel, planColor } from './lib';

/** one plan and its number never split over two lines on a phone */
const keep = (x: string) => x.replace(/ /g, '\u00A0');

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
  const s = useClub();
  const { isPhone } = useDevice();
  const { points, totals, plans } = trend;
  const day = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' });
  const periodName = (p: MemberTrendPoint) => (trend.grain === 'week' ? t('insights.mWeekOf', { from: day(p.start), to: day(p.end) }) : fmt.fd(p.start, { month: 'long', year: 'numeric' }));
  const label = (p: MemberTrendPoint) => (trend.grain === 'week' ? day(p.start) : fmt.fd(p.start, { month: 'short' }));
  const name = (p: Plan) => planLabel(s, p, fmt.lang);
  const colors = Object.fromEntries(plans.map((p, i) => [p, planColor(p, i - 2)])) as Record<Plan, string>;
  /** "Flex: 5 · Gold: 0 · Flex 12: 2": every plan shown, in order (the colon keeps a number in a plan's name apart from its count) */
  const byPlan = (c: PlanCount) => plans.map((p) => keep(`${name(p)}: ${planCountOf(c, p)}`)).join(' · ');
  /** only the plans with a number, for a bar's tip ("—" when none) */
  const some = (c: PlanCount) => plans.filter((p) => planCountOf(c, p)).map((p) => `${name(p)}: ${planCountOf(c, p)}`).join(', ') || '—';
  const parts = (c: PlanCount) => plans.map((p) => ({ value: planCountOf(c, p), color: colors[p] }));
  const grain = t(trend.grain === 'week' ? 'insights.mPerWeek' : 'insights.mPerMonth');
  const planKey = plans.map((p) => ({ color: colors[p], label: name(p) }));

  const inOut: InOutItem[] = points.map((p) => ({
    key: p.start, label: label(p), up: parts(p.joined), down: parts(p.left),
    tip: t('insights.mTipInOut', { period: periodName(p), j: planCountTotal(p.joined), jp: some(p.joined), l: planCountTotal(p.left), lp: some(p.left) }),
  }));
  const switches: InOutItem[] = points.map((p) => ({
    key: p.start, label: label(p), up: parts(p.switchedTo), down: parts(p.switchedFrom),
    tip: t('insights.mTipSwitch', { period: periodName(p), n: planCountTotal(p.switchedTo), to: some(p.switchedTo), from: some(p.switchedFrom) }),
  }));
  const byEnd = new Map(points.map((p) => [p.end, p]));
  const anyInOut = planCountTotal(totals.joined) + planCountTotal(totals.left) > 0;
  const switchN = planCountTotal(totals.switchedTo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 18 }}>
      <Panel>
        <div data-testid="member-kpis" style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isPhone ? '14px 12px' : 16 }}>
          <Kpi testId="kpi-joined" label={t('insights.mJoined')} value={planCountTotal(totals.joined)} sub={byPlan(totals.joined)} />
          <Kpi testId="kpi-left" label={t('insights.mLeft')} value={planCountTotal(totals.left)} sub={byPlan(totals.left)} />
          <Kpi testId="kpi-active" label={t('insights.mActiveNow')} value={planCountTotal(totals.activeEnd)} sub={byPlan(totals.activeEnd)} />
          <Kpi testId="kpi-switches" label={t('insights.mSwitches')} value={switchN} sub={plans.map((p) => keep(`${t('insights.mToPlan', { plan: name(p) })}: ${planCountOf(totals.switchedTo, p)}`)).join(' · ')} />
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
            ...plans.map((plan) => ({ key: plan, label: name(plan), color: colors[plan], points: points.map((p) => ({ date: p.end, value: planCountOf(p.active, plan) })) })),
            { key: 'all', label: t('insights.mTotal'), color: INK, dashed: true, points: points.map((p) => ({ date: p.end, value: planCountTotal(p.active) })) },
          ]}
          describe={(d) => { const p = byEnd.get(d); return p ? `${periodName(p)} · ${t('insights.mTipActive', { list: byPlan(p.active), n: planCountTotal(p.active) })}` : undefined; }} />
      </Panel>

      <Panel title={t('insights.mSwitches')} meta={grain}>
        {switchN ? <InOutBars items={switches} height={isPhone ? 110 : 130} ariaLabel={t('insights.mSwitchAria')} idle={t('insights.mIdle')} />
          : <div style={{ fontSize: 14, color: MUTED, padding: '8px 0' }}>{t('insights.mNoSwitch')}</div>}
        <Key items={planKey} note={switchN ? t('insights.mSwitchKey') : undefined} />
      </Panel>
    </div>
  );
}
