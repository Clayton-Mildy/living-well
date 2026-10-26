// Insights, Overall: the day's numbers (KC round 14). Active with its Flex / Gold split, then Came, In the club, Gone home and Not in. It is the period's last
// day: "Today" follows the clock, an earlier day counts whole. It shows even when the period has no counted visits (the first open day of a month).
import { useMemo } from 'react';
import { dayCounts } from '@cp/shared/rules/insights';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { Panel, Stat } from './lib';

export function TodayBlock({ date }: { date: string }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const { today, nowMin } = useNow();
  const dc = useMemo(() => dayCounts(s, date, date === today ? nowMin : 24 * 60), [s, date, today, nowMin]);
  return (
    <Panel title={date === today ? t('insights.today') : fmt.fd(date, { day: 'numeric', month: 'short' })} pad="14px 16px">
      <div data-testid="insights-today" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Stat label={t('insights.todayActive', { f: dc.active.flex, g: dc.active.gold })} value={dc.active.flex + dc.active.gold} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <Stat label={t('insights.todayCame')} value={dc.came} />
          <Stat label={t('insights.todayIn')} value={dc.inNow} />
          <Stat label={t('insights.todayGone')} value={dc.gone} />
          <Stat label={t('insights.todayNotIn')} value={dc.notIn} />
        </div>
      </div>
    </Panel>
  );
}
