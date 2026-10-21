// Insights, By plan: the people of one plan in the period. One quiet row per member (name, usual days and the share of open days they came, visits and
// visits per week), most or fewest visits first. A tap opens that member's detail.
import { useMemo, useState } from 'react';
import { memberName } from '@cp/shared';
import { PLAN_SORTS, sortPeople, type PersonSort, type PlanStats } from '@cp/shared/rules/insights';
import { Avatar, Group, Icon, Pager, Select, usePaged } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { MUTED, num1, useWeekdays } from './lib';

const PAGE = 8;
const SORT_KEY: Record<PersonSort, string> = { most: 'insights.sortMost', fewest: 'insights.sortFewest', last: 'insights.sortLast' };

export function PlanPeople({ plan, stats, onOpen }: { plan: string; stats: PlanStats; onOpen: (memberId: string) => void }) {
  const s = useClub();
  const t = useT();
  const wd = useWeekdays();
  const [sort, setSort] = useState<PersonSort>('most');
  const rows = useMemo(() => sortPeople(s, stats.people, sort), [s, stats.people, sort]);
  const paged = usePaged(rows, PAGE, `${sort}|${stats.plan}|${stats.people.length}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>{/* the list and its pages stay together (in a grid the pager would take a cell of its own) */}
      <Group title={t('insights.planPeople', { plan })} meta={stats.people.length} pad={0} gap={0}>
        {rows.length === 0 ? (
          <div style={{ padding: '18px 16px', textAlign: 'center', color: MUTED, fontSize: 15 }}>{t('insights.noPlanPeople')}</div>
        ) : (
          <>
            <div style={{ padding: '10px 16px' }}>
              <Select ariaLabel={t('insights.sortLabel')} value={sort} onChange={setSort} options={PLAN_SORTS.map((k) => ({ value: k, label: t(SORT_KEY[k]) }))} />
            </div>
            {paged.rows.map((p) => {
              const m = s.members[p.memberId];
              if (!m) return null;
              const name = memberName(m);
              const days = p.usual.map((w) => wd.short[w]).join(', ');
              return (
                <button key={p.memberId} type="button" onClick={() => onOpen(p.memberId)} className="h-row cp-bleed" data-member={p.memberId} aria-label={name}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 60, border: 'none', borderTop: '0.5px solid var(--hairline, #E2E2E6)', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <Avatar name={name} tone={m.photoTone} size={38} src={memberPhoto(m)} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ fontSize: 13, color: MUTED, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.visits ? days : t('insights.none')}{p.rate !== null ? ` · ${t('insights.ofDays', { pct: Math.round(p.rate * 100) })}` : ''}
                    </span>
                  </span>
                  <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '21px' }}>{p.visits}</span>
                    <span style={{ fontSize: 12, color: MUTED, lineHeight: '16px' }}>{t('insights.perWk', { n: num1(p.perWeek) })}</span>
                  </span>
                  <Icon name="chevron_right" size={20} color="#A89C8E" />
                </button>
              );
            })}
          </>
        )}
      </Group>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </div>
  );
}
