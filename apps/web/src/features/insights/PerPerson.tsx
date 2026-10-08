// Visit insights, Per person: search, sort (most visits, fewest visits, last visit) and one quiet row per member (name, plan, usual days, visits). A tap
// opens that member's detail (monthly visits, usual days, arrival trend, last 10 visits).
import { useMemo, useState } from 'react';
import { memberName } from '@cp/shared';
import { matchesQuery } from '@cp/shared/rules/members';
import { PERSON_SORTS, sortPeople, type PersonSort, type VisitInsights } from '@cp/shared/rules/insights';
import { Avatar, Group, Icon, Pager, Select, usePaged } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { num1, useWeekdays } from './lib';

const PAGE = 12;
const SORT_KEY: Record<PersonSort, string> = { most: 'insights.sortMost', fewest: 'insights.sortFewest', last: 'insights.sortLast' };

export function PerPerson({ data, onOpen }: { data: VisitInsights; onOpen: (memberId: string) => void }) {
  const s = useClub();
  const t = useT();
  const { isPhone } = useDevice();
  const wd = useWeekdays();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<PersonSort>('most');
  const rows = useMemo(() => sortPeople(s, data.people, sort).filter((p) => !s.members[p.memberId] || matchesQuery(s, s.members[p.memberId], q)), [s, data.people, sort, q]);
  const paged = usePaged(rows, PAGE, `${q}|${sort}|${data.period.from}|${data.period.to}`);

  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 11, background: '#EAE6E0' }}>
        <Icon name="search" size={19} color="#6B6259" />
        <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" autoComplete="off" placeholder={t('insights.searchPh')} aria-label={t('insights.searchLabel')}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', height: '100%', fontSize: 16, fontFamily: 'Inter', color: '#1E1A16', background: 'transparent' }} />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: isPhone ? '1 1 0' : '0 0 240px', minWidth: 0 }}>
          <Select ariaLabel={t('insights.sortLabel')} value={sort} onChange={setSort} options={PERSON_SORTS.map((k) => ({ value: k, label: t(SORT_KEY[k]) }))} />
        </div>
        <span style={{ fontSize: 13, color: '#6B6259', flex: 'none' }}>{t('insights.peopleMeta', { n: rows.length })}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: '#6B6259', fontSize: 15 }}>{t('insights.noPeople')}</div>
      ) : (
        <Group pad={0} gap={0}>
          {paged.rows.map((p, i) => {
            const m = s.members[p.memberId];
            if (!m) return null;
            const name = memberName(m);
            const days = p.usual.map((w) => wd.short[w]).join(', ');
            return (
              <button key={p.memberId} type="button" onClick={() => onOpen(p.memberId)} className="h-row cp-bleed" data-member={p.memberId} aria-label={name}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 60, border: 'none', borderTop: i ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <Avatar name={name} tone={m.photoTone} size={38} src={memberPhoto(m)} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t(p.plan === 'flex' ? 'insights.planFlex' : 'insights.planGold')} · {p.visits ? days : t('insights.none')}
                  </span>
                </span>
                <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '21px' }}>{p.visits}</span>
                  <span style={{ fontSize: 12, color: '#6B6259', lineHeight: '16px' }}>{t('insights.perMo', { n: num1(p.perMonth) })}</span>
                </span>
                <Icon name="chevron_right" size={20} color="#B5A999" />
              </button>
            );
          })}
        </Group>
      )}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </>
  );
}
