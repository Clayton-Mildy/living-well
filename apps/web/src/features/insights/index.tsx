// KC round 7: Visit insights (management, Club group). How intensely members come to the club: Overall (daily visitors, a weekday x hour heat map of who is in
// the club, arrivals per hour), By plan (Flex vs Gold), Per person (search, sort, detail) and Flex (how the monthly quota is spent). The period picks
// the window for the first three tabs (This month, Last month, Last 3 / 6 months, or a custom From and To); Flex has its own month. Today only counts once the day is over.
import { useMemo, useState } from 'react';
import { toMin, ym } from '@cp/shared';
import { PERIOD_KEYS, editPeriod, periodFor, visitInsights, type InsightPeriod, type PeriodKey } from '@cp/shared/rules/insights';
import { DateField, EmptyState, PageHead, Segmented, Select } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { ByPlan } from './ByPlan';
import { FlexTab } from './FlexTab';
import { Overall } from './Overall';
import { PerPerson } from './PerPerson';
import { PersonDetail } from './PersonDetail';

type Tab = 'overall' | 'plan' | 'person' | 'flex';
const TABS: Tab[] = ['overall', 'plan', 'person', 'flex'];
const TAB_KEY: Record<Tab, string> = { overall: 'insights.tabOverall', plan: 'insights.tabPlan', person: 'insights.tabPerson', flex: 'insights.tabFlex' };
const PERIOD_KEY: Record<PeriodKey, string> = { thisMonth: 'insights.pThisMonth', lastMonth: 'insights.pLastMonth', last3: 'insights.pLast3', last6: 'insights.pLast6', custom: 'insights.pCustom' };

export function Insights() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today, nowMin } = useNow();
  const { device, isPhone } = useDevice();
  const [tab, setTab] = useState<Tab>('overall');
  const [pKey, setPKey] = useState<PeriodKey>('thisMonth');
  const [custom, setCustom] = useState<InsightPeriod | null>(null);
  const [month, setMonth] = useState(() => ym(today));
  const [detail, setDetail] = useState<string | null>(null);
  const todayDone = nowMin >= toMin(s.club.settings.close);
  const period = useMemo(() => periodFor(pKey, today, custom), [pKey, today, custom]);
  const data = useMemo(() => visitInsights(s, period, today, { todayDone }), [s, period, today, todayDone]);

  const range = data.days.length
    ? t('insights.range', { from: fmt.fd(data.days[0], { day: 'numeric', month: 'short' }), to: fmt.fd(data.days[data.days.length - 1], { day: 'numeric', month: 'short' }), n: data.days.length })
    : t('insights.rangeNone');
  const flex = tab === 'flex';
  // Custom range starts as the dates that were showing, then From and To are set below (From is never after To)
  const pickPeriod = (k: PeriodKey) => { if (k === 'custom' && pKey !== 'custom') setCustom(period); setPKey(k); };
  const periodSelect = (
    <Select ariaLabel={t('insights.period')} value={pKey} onChange={pickPeriod} options={PERIOD_KEYS.map((k) => ({ value: k, label: t(PERIOD_KEY[k]) }))} />
  );
  const customRow = pKey === 'custom' && !flex ? (
    <div data-testid="period-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 380 }}>
      <DateField compact label={t('insights.from')} value={period.from} max={today} onChange={(d) => setCustom(editPeriod(period, 'from', d, today))} />
      <DateField compact label={t('insights.to')} value={period.to} max={today} onChange={(d) => setCustom(editPeriod(period, 'to', d, today))} />
    </div>
  ) : null;
  // the person's detail follows the period (from the Flex tab, which has no period, it looks at the last 6 months)
  const detailPeriod = useMemo(() => (flex ? periodFor('last6', today) : period), [flex, period, today]);
  const detailLabel = flex ? t('insights.last6') : pKey === 'custom' ? `${fmt.fds(period.from)} – ${fmt.fds(period.to)}` : t(PERIOD_KEY[pKey]);
  const tabs = <Segmented label={t('insights.tabs')} value={tab} onChange={setTab} items={TABS.map((k) => ({ value: k, label: t(TAB_KEY[k]) }))} />;

  return (
    <>
      <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
        <PageHead size={isPhone ? 40 : 36} title={t('insights.title')} right={!isPhone && !flex ? <div style={{ width: 220 }}>{periodSelect}</div> : undefined} />
        {tabs}
        {isPhone && !flex ? periodSelect : null}
        {customRow}
        {!flex ? <div style={{ fontSize: 13, color: '#6B6259', marginTop: isPhone ? -6 : -10 }}>{range}</div> : null}
        {flex ? (
          <FlexTab today={today} todayDone={todayDone} month={month} onMonth={setMonth} onOpen={setDetail} />
        ) : data.overall.visits === 0 && tab !== 'person' ? (
          <EmptyState icon="insights" title={t('insights.empty')} sub={t('insights.emptySub')} />
        ) : tab === 'overall' ? (
          <Overall data={data} />
        ) : tab === 'plan' ? (
          <ByPlan data={data} />
        ) : (
          <PerPerson data={data} onOpen={setDetail} />
        )}
      </div>
      <PersonDetail memberId={detail} period={detailPeriod} periodLabel={detailLabel} today={today} todayDone={todayDone} onClose={() => setDetail(null)} />
    </>
  );
}
