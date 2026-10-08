// Visit insights, Overall: one summary line, the daily visitors, the weekday x hour heat map (members in the club), arrivals per hour and the
// average per weekday. The trial day passes (guests) are only a footnote.
import { useMemo } from 'react';
import { HEAT_HOURS, type VisitInsights } from '@cp/shared/rules/insights';
import { TrendChart } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { Bars, HeatMap, type BarItem } from './charts';
import { hourText, num1, pct, Panel, useWeekdays } from './lib';

export function Overall({ data }: { data: VisitInsights }) {
  const t = useT();
  const fmt = useFmt();
  const { isPhone, isWide } = useDevice();
  const wd = useWeekdays();
  const o = data.overall;
  const day = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' });

  // the busiest cell of the heat map is what the readout shows before anything is tapped
  const peak = useMemo<[number, number] | null>(() => {
    let best: [number, number] | null = null;
    o.presenceHeat.forEach((row, w) => row.forEach((v, i) => { if (v > 0 && (!best || v > o.presenceHeat[best[0]][best[1]])) best = [w, i]; }));
    return best;
  }, [o]);

  const summary = [
    t('insights.sumVisits', { n: o.visits }),
    t('insights.sumPerDay', { n: num1(o.avgPerDay) }),
    o.busiestWeekday !== null ? t('insights.sumBusiest', { day: wd.short[o.busiestWeekday] }) : '',
    o.peakHour !== null ? t('insights.sumPeak', { hour: hourText(o.peakHour) }) : '',
  ].filter(Boolean).join(' · ');

  const arrivalsTotal = o.arrivals.reduce((a, b) => a + b, 0);
  const arrivalItems: BarItem[] = HEAT_HOURS.map((h, i) => ({
    key: String(h), label: hourText(h), value: o.arrivals[i],
    tip: t('insights.arrivalsTip', { hour: hourText(h), n: o.arrivals[i], pct: pct(o.arrivals[i], arrivalsTotal) }),
  }));
  const weekdayItems: BarItem[] = wd.short.map((name, w) => ({
    key: String(w), label: name, value: o.weekdayAvg[w], shown: num1(o.weekdayAvg[w]),
    tip: t('insights.weekdayTip', { day: wd.long[w], n: num1(o.weekdayAvg[w]) }),
  }));

  const daily = (
    <Panel title={t('insights.daily')} meta={o.maxDay ? t('insights.dailyMax', { n: o.maxDay.total, d: day(o.maxDay.date) }) : undefined}>
      <TrendChart kind="bars" height={isPhone ? 120 : 150} ariaLabel={t('insights.dailyAria')} from={data.days[0]} to={data.days[data.days.length - 1]}
        series={[{ key: 'visitors', label: t('insights.dailySeries'), tone: 'bronze', points: o.dailyCounts.map((d) => ({ date: d.date, value: d.total })) }]}
        describe={(d) => { const c = o.dailyCounts.find((x) => x.date === d); return c ? t('insights.dayDescribe', { flex: c.flex, gold: c.gold }) : undefined; }} />
    </Panel>
  );
  const heat = (
    <Panel title={t('insights.heat')}>
      <HeatMap rows={o.presenceHeat} hours={HEAT_HOURS} rowLabels={wd.short} max={o.heatMax} peak={peak} compact={isPhone} ariaLabel={t('insights.heatAria')}
        fewer={t('insights.fewer')} more={t('insights.more')} pick={t('insights.heatPick')}
        tip={(w, i, v) => t('insights.heatTip', { day: wd.short[w], hour: hourText(HEAT_HOURS[i]), n: num1(v) })} />
    </Panel>
  );
  const arrivals = (
    <Panel title={t('insights.arrivals')}>
      <Bars items={arrivalItems} ariaLabel={t('insights.arrivals')} />
    </Panel>
  );
  const weekdays = (
    <Panel title={t('insights.weekdays')}>
      <Bars items={weekdayItems} ariaLabel={t('insights.weekdays')} />
    </Panel>
  );

  return (
    <>
      <div data-testid="insights-summary" style={{ fontSize: 15, lineHeight: '22px', color: '#2B231C', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{summary}</div>
      {daily}
      {isWide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 20, alignItems: 'start' }}>
          {heat}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{arrivals}{weekdays}</div>
        </div>
      ) : <>{heat}{arrivals}{weekdays}</>}
      {data.trials > 0 ? <div style={{ fontSize: 13, color: '#6B6259', padding: '0 4px' }}>{data.trials === 1 ? t('insights.trialsOne') : t('insights.trials', { n: data.trials })}</div> : null}
    </>
  );
}
