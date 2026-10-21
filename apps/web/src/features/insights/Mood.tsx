// Round 12: Insights › Mood. Which activities and weekdays lift mood, the average arrival-to-departure lift, the average face at each moment and the
// members whose arrival mood fell on each of their last three visits (each links to the check-on sheet on Today).
import { Link } from 'react-router-dom';
import { listName } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import type { MoodInsights } from '@cp/shared/rules/mood';
import type { MoodMoment } from '@cp/shared/types';
import { EmptyState, Group } from '../../components/ui';
import { useLang, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { ThinBar } from './charts';
import { INK, Line, MUTED, num1, Panel, useWeekdays } from './lib';

const MOMENTS: MoodMoment[] = ['arrival', 'health', 'activity', 'departure'];

export function Mood({ data }: { data: MoodInsights }) {
  const s = useClub();
  const t = useT();
  const lang = useLang();
  const wd = useWeekdays();
  const lift = data.lift === null ? t('insights.moodNoLift')
    : data.lift > 0 ? t('insights.moodLift', { n: num1(data.lift) })
    : data.lift < 0 ? t('insights.moodLiftDown', { n: num1(-data.lift) })
    : t('insights.moodLiftNone');
  if (MOMENTS.every((k) => data.byMoment[k] === null)) return <EmptyState icon="insights" title={t('insights.moodEmpty')} />;
  return (
    <>
      <div data-testid="mood-lift" style={{ fontSize: 17, fontWeight: 500, color: INK }}>{lift}</div>
      {data.byActivity.length ? (
        <Panel title={t('insights.moodByActivity')} pad="4px 16px" gap={0}>
          {data.byActivity.map((a, i) => {
            const name = activityName(s.activities[a.activityId], lang) || a.activityId;
            return (
              <div key={a.activityId} data-activity={a.activityId} aria-label={t('insights.moodActivityTip', { name, avg: num1(a.avg), n: a.n })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', fontSize: 15, color: INK }}>
                <span style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span style={{ flex: '0 0 72px' }}><ThinBar used={a.avg - 1} quota={4} /></span>
                <span style={{ flex: 'none', minWidth: 28, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{num1(a.avg)}</span>
                <span style={{ flex: 'none', minWidth: 24, textAlign: 'right', fontSize: 13, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{a.n}</span>
              </div>
            );
          })}
        </Panel>
      ) : null}
      <Panel title={t('insights.moodByWeekday')}>
        <div>
          {data.byWeekday.map((v, i) => <Line key={i} first={i === 0} label={wd.long[i]} value={v === null ? '–' : num1(v)} />)}
        </div>
      </Panel>
      <Panel title={t('insights.moodByMoment')}>
        <div>
          {MOMENTS.map((k, i) => <Line key={k} first={i === 0} label={t(`mood.moment.${k}`)} value={data.byMoment[k] === null ? '–' : num1(data.byMoment[k] as number)} />)}
        </div>
      </Panel>
      <Group title={t('insights.moodDropping')} meta={t('insights.moodDropHint')} pad={0} gap={0}>
        {data.drops.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 15, color: MUTED }}>{t('insights.moodDropNone')}</div>
        ) : data.drops.map((d, i) => {
          const m = s.members[d.memberId];
          if (!m) return null;
          return (
            <Link key={d.memberId} to={`/today?checkOn=${d.memberId}`} className="h-row cp-bleed" data-member={d.memberId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', minHeight: 48, borderTop: i ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', color: INK, textDecoration: 'none', fontSize: 16 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{listName(m)}</span>
              <span style={{ flex: 'none', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{d.faces.join(' → ')}</span>
            </Link>
          );
        })}
      </Group>
    </>
  );
}
