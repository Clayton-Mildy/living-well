// Visit insights: one member's detail over the chosen period (a pushed screen on phones, a sheet on tablet and laptop): visits per month, the days they
// usually come, how their arrival time moves, and their last 10 visits.
import { useMemo } from 'react';
import { memberName } from '@cp/shared';
import { visitInsights, type InsightPeriod, type PersonStats } from '@cp/shared/rules/insights';
import { Avatar, PhoneScreen, Sheet, TrendChart } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { memberPhoto } from '../../lib/media';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { Bars, type BarItem } from './charts';
import { FLEX_COLOR, GOLD_COLOR, Line, Panel, hhmm, num1, pct, useStay, useWeekdays } from './lib';

export function PersonDetail({ memberId, period, periodLabel, today, todayDone, onClose }: { memberId: string | null; period: InsightPeriod; periodLabel: string; today: string; todayDone: boolean; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const { isPhone } = useDevice();
  const name = memberId && s.members[memberId] ? memberName(s.members[memberId]) : '';
  const body = memberId ? <Body memberId={memberId} period={period} periodLabel={periodLabel} today={today} todayDone={todayDone} /> : null;
  if (isPhone) return <PhoneScreen open={!!memberId} onClose={onClose} label={name} back={t('insights.back')}>{body}</PhoneScreen>;
  return <Sheet open={!!memberId} onClose={onClose} title={name} maxWidth={640}>{body}</Sheet>;
}

function Body({ memberId, period, periodLabel, today, todayDone }: { memberId: string; period: InsightPeriod; periodLabel: string; today: string; todayDone: boolean }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const wd = useWeekdays();
  const stay = useStay();
  const m = s.members[memberId];
  const p = useMemo<PersonStats | undefined>(
    () => visitInsights(s, period, today, { todayDone }).people.find((x) => x.memberId === memberId),
    [s, memberId, period, today, todayDone],
  );
  if (!m) return null;
  const color = p?.plan === 'gold' ? GOLD_COLOR : FLEX_COLOR;
  const month = (mo: string) => fmt.fd(`${mo}-01`, { month: 'short' });
  const monthly: BarItem[] = (p?.monthly ?? []).map((x) => ({ key: x.month, label: month(x.month), value: x.visits, tip: t('insights.monthlyTip', { month: fmt.fmonth(x.month, true), n: x.visits }) }));
  const total = p?.visits ?? 0;
  const days: BarItem[] = wd.short.map((d, w) => ({ key: String(w), label: d, value: p?.weekdays[w] ?? 0, tip: t('insights.patternTip', { day: wd.long[w], n: p?.weekdays[w] ?? 0, pct: pct(p?.weekdays[w] ?? 0, total) }) }));
  const arrivals = p?.arrivals ?? [];
  const toDate = period.to < today ? period.to : today;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={memberName(m)} tone={m.photoTone} size={56} src={memberPhoto(m)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 500, color: '#2B231C', lineHeight: '26px' }}>{memberName(m)}</span>
          <span style={{ fontSize: 14, color: '#6B6259' }}>{t(p?.plan === 'gold' ? 'insights.planGold' : 'insights.planFlex')} · {periodLabel}</span>
        </div>
      </div>
      <Panel gap={0}>
        <Line first label={t('insights.dVisits')} value={p?.visits ?? 0} />
        <Line label={t('insights.dPerMonth')} value={num1(p?.perMonth ?? 0)} />
        <Line label={t('insights.avgArrival')} value={p?.avgArrival ?? '—'} />
        <Line label={t('insights.avgStay')} value={stay(p?.avgStayMin ?? null)} />
        <Line label={t('insights.dLast')} value={p?.lastVisit ? fmt.fds(p.lastVisit) : t('insights.dNever')} />
      </Panel>
      <Panel title={t('insights.monthly')}>
        <Bars items={monthly} color={color} height={96} ariaLabel={t('insights.monthly')} />
      </Panel>
      <Panel title={t('insights.usual')}>
        <Bars items={days} color={color} height={80} ariaLabel={t('insights.usual')} />
      </Panel>
      {arrivals.length ? (
        <Panel title={t('insights.arrivalTrend')}>
          <TrendChart height={130} from={period.from} to={toDate} ariaLabel={t('insights.arrivalTrend')} format={hhmm}
            series={[{ key: 'arrival', label: t('insights.arrivalSeries'), tone: 'bronze', points: arrivals.map((a) => ({ date: a.date, value: a.value })) }]} />
        </Panel>
      ) : null}
      {p?.recent.length ? (
        <Panel title={t('insights.recent')} pad="4px 16px" gap={0}>
          {p.recent.map((r, i) => (
            <Line key={r.date} first={i === 0} label={fmt.fds(r.date)} value={r.out ? `${r.in} – ${r.out}` : `${r.in} · ${t('insights.noCheckOut')}`} />
          ))}
        </Panel>
      ) : null}
    </>
  );
}
