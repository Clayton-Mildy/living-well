// Insights, By plan: All plans, or one plan only (KC round 7). Visits per plan over the period (a line each for Flex and Gold, by day or by week), the share of visits, then Flex and Gold side by side
// (stacked on a phone). A plan's card opens with its key numbers (members, visits, visits per member per week, attendance rate), then the average arrival and
// stay and the days they come; the plan's people follow, and under Flex how the monthly quota is spent.
import { useMemo, useState } from 'react';
import type { PlanGroup } from '@cp/shared/rules/insights';
import type { PlanStats, VisitInsights } from '@cp/shared/rules/insights';
import { Segmented, TrendChart } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { Bars, ShareBar, type BarItem } from './charts';
import { FlexQuota } from './FlexQuota';
import { FLEX_COLOR, GOLD_COLOR, Line, Panel, Stat, num1, pct, useStay, useWeekdays } from './lib';
import { PlanPeople } from './PlanPeople';

const PLANS: PlanGroup[] = ['flex', 'gold'];

export function ByPlan({ data, today, onOpen }: { data: VisitInsights; today: string; onOpen: (memberId: string) => void }) {
  const t = useT();
  const fmt = useFmt();
  const { isPhone } = useDevice();
  const wd = useWeekdays();
  const stay = useStay();
  const colors: Record<PlanGroup, string> = { flex: FLEX_COLOR, gold: GOLD_COLOR };
  const name = (p: PlanGroup) => t(p === 'flex' ? 'insights.planFlex' : 'insights.planGold');
  const total = data.overall.visits;
  const gap = isPhone ? 14 : 20;
  const day = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' });
  const trend = data.trend;
  const byDate = useMemo(() => new Map(trend.points.map((p) => [p.date, p])), [trend]);
  // KC round 7: look at both plans, or at one plan only
  const [view, setView] = useState<'all' | PlanGroup>('all');
  const shown = view === 'all' ? PLANS : [view];

  const trendPanel = (
    <Panel title={t('insights.trend')} meta={t(trend.grain === 'week' ? 'insights.trendWeek' : 'insights.trendDay')}>
      <TrendChart legend={shown.length > 1} height={isPhone ? 160 : 190} ariaLabel={t('insights.trendAria')} from={data.days[0]} to={data.days[data.days.length - 1]}
        series={shown.map((p) => ({ key: p, label: name(p), color: colors[p], points: trend.points.map((x) => ({ date: x.date, value: x[p] })) }))}
        describe={trend.grain === 'week' ? (d) => {
          const p = byDate.get(d);
          if (!p) return undefined;
          return `${t('insights.weekOf', { from: day(p.date), to: day(p.end) })} · ${p.days === 1 ? t('insights.oneOpenDay') : t('insights.nOpenDays', { n: p.days })}`;
        } : undefined} />
    </Panel>
  );

  const card = (p: PlanStats) => {
    const items: BarItem[] = wd.short.map((d, w) => ({ key: String(w), label: d, value: p.weekdays[w], tip: t('insights.patternTip', { day: wd.long[w], n: p.weekdays[w], pct: pct(p.weekdays[w], p.visits) }) }));
    return (
      <Panel title={name(p.plan)} gap={0}>
        <div data-testid={`plan-stats-${p.plan}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, paddingBottom: 12 }}>
          <Stat label={t('insights.kMembers')} value={p.members} />
          <Stat label={t('insights.kVisits')} value={p.visits} />
          <Stat label={t('insights.kPerWeek')} value={p.perMemberWeek === null ? '—' : num1(p.perMemberWeek)} />
          <Stat label={t('insights.kAttend')} value={p.attendanceRate === null ? '—' : `${Math.round(p.attendanceRate * 100)}%`} />
        </div>
        <Line label={t('insights.avgArrival')} value={p.avgArrival ?? '—'} />
        <Line label={t('insights.avgDeparture')} value={p.avgDeparture ?? '—'} />
        <Line label={t('insights.avgStay')} value={stay(p.avgStayMin)} />
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6B6259' }}>{t('insights.pattern')}</span>
          <Bars items={items} height={80} color={colors[p.plan]} ariaLabel={`${name(p.plan)}: ${t('insights.pattern')}`} />
        </div>
      </Panel>
    );
  };

  const column = (plan: PlanGroup) => (
    <div key={plan} data-plan={plan} style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
      {card(data.byPlan[plan])}
      {plan === 'flex' ? <FlexQuota period={data.period} today={today} gap={gap} onOpen={onOpen} /> : null}
      <PlanPeople plan={name(plan)} stats={data.byPlan[plan]} onOpen={onOpen} />
    </div>
  );

  // one plan: its numbers (and Flex's quota) on the left, its people on the right; on a phone everything stacks
  const single = (plan: PlanGroup) => (
    <div data-plan={plan} style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: isPhone ? gap : 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
        {card(data.byPlan[plan])}
        {plan === 'flex' ? <FlexQuota period={data.period} today={today} gap={gap} onOpen={onOpen} /> : null}
      </div>
      <PlanPeople plan={name(plan)} stats={data.byPlan[plan]} onOpen={onOpen} />
    </div>
  );

  return (
    <>
      <Segmented<'all' | PlanGroup> label={t('insights.planView')} value={view} onChange={setView}
        items={[{ value: 'all', label: t('insights.allPlans') }, ...PLANS.map((p) => ({ value: p, label: name(p), count: data.byPlan[p].members }))]} />
      {trendPanel}
      {view === 'all' ? (
        <>
          <Panel title={t('insights.share')}>
            <ShareBar ariaLabel={t('insights.share')}
              parts={PLANS.map((p) => ({ key: p, label: name(p), value: data.byPlan[p].visits, color: colors[p], tip: t('insights.shareTip', { plan: name(p), n: data.byPlan[p].visits, pct: pct(data.byPlan[p].visits, total) }) }))} />
          </Panel>
          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: isPhone ? 22 : 20, alignItems: 'start' }}>
            {PLANS.map(column)}
          </div>
        </>
      ) : single(view)}
    </>
  );
}
