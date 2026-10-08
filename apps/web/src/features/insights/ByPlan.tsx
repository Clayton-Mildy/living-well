// Visit insights, By plan: Flex and Gold side by side (stacked on a phone): the share of visits, visits per member per month, the days they come, the
// average arrival and stay.
import type { Plan } from '@cp/shared';
import type { PlanStats, VisitInsights } from '@cp/shared/rules/insights';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { Bars, ShareBar, type BarItem } from './charts';
import { FLEX_COLOR, GOLD_COLOR, Line, Panel, num1, pct, useStay, useWeekdays } from './lib';

export function ByPlan({ data }: { data: VisitInsights }) {
  const t = useT();
  const { isPhone } = useDevice();
  const wd = useWeekdays();
  const stay = useStay();
  const colors: Record<Plan, string> = { flex: FLEX_COLOR, gold: GOLD_COLOR };
  const name = (p: Plan) => t(p === 'flex' ? 'insights.planFlex' : 'insights.planGold');
  const plans: Plan[] = ['flex', 'gold'];
  const total = data.overall.visits;

  const card = (p: PlanStats) => {
    const items: BarItem[] = wd.short.map((d, w) => ({ key: String(w), label: d, value: p.weekdays[w], tip: t('insights.patternTip', { day: wd.long[w], n: p.weekdays[w], pct: pct(p.weekdays[w], p.visits) }) }));
    return (
      <Panel key={p.plan} title={name(p.plan)} meta={t('insights.nMembers', { n: p.members })} gap={0}>
        <Line first label={t('insights.visits')} value={p.visits} />
        <Line label={t('insights.perMonth')} value={p.perMemberMonth === null ? '—' : num1(p.perMemberMonth)} />
        <Line label={t('insights.avgArrival')} value={p.avgArrival ?? '—'} />
        <Line label={t('insights.avgStay')} value={stay(p.avgStayMin)} />
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6B6259' }}>{t('insights.pattern')}</span>
          <Bars items={items} height={80} color={colors[p.plan]} ariaLabel={`${name(p.plan)}: ${t('insights.pattern')}`} />
        </div>
      </Panel>
    );
  };

  return (
    <>
      <Panel title={t('insights.share')}>
        <ShareBar ariaLabel={t('insights.share')}
          parts={plans.map((p) => ({ key: p, label: name(p), value: data.byPlan[p].visits, color: colors[p], tip: t('insights.shareTip', { plan: name(p), n: data.byPlan[p].visits, pct: pct(data.byPlan[p].visits, total) }) }))} />
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: isPhone ? 22 : 20, alignItems: 'start' }}>
        {plans.map((p) => card(data.byPlan[p]))}
      </div>
    </>
  );
}
