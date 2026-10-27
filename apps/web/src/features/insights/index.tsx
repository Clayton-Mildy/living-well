// KC round 7: Insights (management, Club group). How intensely members come to the club: Overall (daily visitors, a weekday x hour heat map of who is in
// the club, arrivals per hour), By plan (visits per plan over time, the visit rate and the people of each plan, and under Flex how the monthly quota is
// spent) and Per person (search, sort, detail). The period picks the window for all three (This month, Last month, Last 3 / 6 months, or a custom From
// and To). Today only counts once the day is over.
// KC round 9: a fourth tab, Membership — members in and out by plan, with its own range (3 months, 6 months, 1 year or a custom From and To).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toMin } from '@cp/shared';
import { moodInsights } from '@cp/shared/rules/mood';
import { MEMBER_RANGES, PERIOD_KEYS, editPeriod, memberRangeFor, memberTrend, periodFor, visitInsights, type InsightPeriod, type MemberRangeKey, type PeriodKey } from '@cp/shared/rules/insights';
import { DateField, EmptyState, PageHead, Segmented, Select } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { ByPlan } from './ByPlan';
import { Membership } from './Membership';
import { Mood } from './Mood';
import { Overall } from './Overall';
import { PerPerson } from './PerPerson';
import { PersonDetail } from './PersonDetail';
import { TodayBlock } from './TodayBlock';

type Tab = 'overall' | 'plan' | 'person' | 'members' | 'mood';
const TABS: Tab[] = ['overall', 'plan', 'person', 'members', 'mood'];
const TAB_KEY: Record<Tab, string> = { overall: 'insights.tabOverall', plan: 'insights.tabPlan', person: 'insights.tabPerson', members: 'insights.tabMembers', mood: 'insights.tabMood' };
const M_KEY: Record<MemberRangeKey, string> = { '3m': 'insights.m3', '6m': 'insights.m6', '1y': 'insights.m1y', custom: 'insights.mCustom' };
const PERIOD_KEY: Record<PeriodKey, string> = { thisMonth: 'insights.pThisMonth', lastMonth: 'insights.pLastMonth', last3: 'insights.pLast3', last6: 'insights.pLast6', custom: 'insights.pCustom' };

export function Insights() {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today, nowMin } = useNow();
  const { device, isPhone } = useDevice();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => { const k = params.get('tab'); return TABS.find((x) => x === k) ?? 'overall'; });
  const [pKey, setPKey] = useState<PeriodKey>('thisMonth');
  const [custom, setCustom] = useState<InsightPeriod | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const todayDone = nowMin >= toMin(s.club.settings.close);
  const period = useMemo(() => periodFor(pKey, today, custom), [pKey, today, custom]);
  const data = useMemo(() => visitInsights(s, period, today, { todayDone }), [s, period, today, todayDone]);
  // the Membership tab's own range
  const [mKey, setMKey] = useState<MemberRangeKey>('6m');
  const [mCustom, setMCustom] = useState<InsightPeriod | null>(null);
  const mPeriod = useMemo(() => memberRangeFor(mKey, today, mCustom), [mKey, today, mCustom]);
  const mTrend = useMemo(() => (tab === 'members' ? memberTrend(s, mPeriod, today) : null), [tab, s, mPeriod, today]);
  const members = tab === 'members';
  const mood = useMemo(() => (tab === 'mood' ? moodInsights(s, period, today) : null), [tab, s, period, today]);

  const range = data.days.length
    ? t('insights.range', { from: fmt.fd(data.days[0], { day: 'numeric', month: 'short' }), to: fmt.fd(data.days[data.days.length - 1], { day: 'numeric', month: 'short' }), n: data.days.length })
    : t('insights.rangeNone');
  // Custom range starts as the dates that were showing, then From and To are set below (From is never after To)
  const pickPeriod = (k: PeriodKey) => { if (k === 'custom' && pKey !== 'custom') setCustom(period); setPKey(k); };
  const periodSelect = (
    <Select ariaLabel={t('insights.period')} value={pKey} onChange={pickPeriod} options={PERIOD_KEYS.map((k) => ({ value: k, label: t(PERIOD_KEY[k]) }))} />
  );
  const pickMRange = (k: MemberRangeKey) => { if (k === 'custom' && mKey !== 'custom') setMCustom(mPeriod); setMKey(k); };
  const mSelect = (
    <Select ariaLabel={t('insights.mRange')} value={mKey} onChange={pickMRange} options={MEMBER_RANGES.map((k) => ({ value: k, label: t(M_KEY[k]) }))} />
  );
  const mCustomRow = mKey === 'custom' ? (
    <div data-testid="mrange-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 380 }}>
      <DateField compact label={t('insights.from')} value={mPeriod.from} max={today} onChange={(d) => setMCustom(editPeriod(mPeriod, 'from', d, today))} />
      <DateField compact label={t('insights.to')} value={mPeriod.to} max={today} onChange={(d) => setMCustom(editPeriod(mPeriod, 'to', d, today))} />
    </div>
  ) : null;
  const customRow = pKey === 'custom' ? (
    <div data-testid="period-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 380 }}>
      <DateField compact label={t('insights.from')} value={period.from} max={today} onChange={(d) => setCustom(editPeriod(period, 'from', d, today))} />
      <DateField compact label={t('insights.to')} value={period.to} max={today} onChange={(d) => setCustom(editPeriod(period, 'to', d, today))} />
    </div>
  ) : null;
  // the person's detail follows the period
  const detailLabel = pKey === 'custom' ? `${fmt.fds(period.from)} – ${fmt.fds(period.to)}` : t(PERIOD_KEY[pKey]);
  // five tabs do not fit one row on a phone (Indonesian least of all): two per row there
  const tabs = <Segmented label={t('insights.tabs')} value={tab} onChange={setTab} cols={isPhone ? 2 : undefined} items={TABS.map((k) => ({ value: k, label: t(TAB_KEY[k]) }))} />;

  return (
    <>
      <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
        <PageHead size={isPhone ? 40 : 36} title={t('insights.title')} right={!isPhone ? <div style={{ width: 220 }}>{members ? mSelect : periodSelect}</div> : undefined} />
        {tabs}
        {isPhone ? (members ? mSelect : periodSelect) : null}
        {members ? mCustomRow : customRow}
        <div style={{ fontSize: 13, color: '#6B6259', marginTop: isPhone ? -6 : -10 }}>{members ? t('insights.mRangeText', { from: fmt.fds(mPeriod.from), to: fmt.fds(mPeriod.to) }) : range}</div>
        {tab === 'overall' ? <TodayBlock date={period.to} /> : null}
        {members && mTrend ? (
          <Membership trend={mTrend} />
        ) : tab === 'mood' && mood ? (
          <Mood data={mood} />
        ) : data.overall.visits === 0 && tab !== 'person' ? (
          <EmptyState icon="insights" title={t('insights.empty')} sub={t('insights.emptySub')} />
        ) : tab === 'overall' ? (
          <Overall data={data} />
        ) : tab === 'plan' ? (
          <ByPlan data={data} today={today} onOpen={setDetail} />
        ) : (
          <PerPerson data={data} onOpen={setDetail} />
        )}
      </div>
      <PersonDetail memberId={detail} period={period} periodLabel={detailLabel} today={today} todayDone={todayDone} onClose={() => setDetail(null)} />
    </>
  );
}
