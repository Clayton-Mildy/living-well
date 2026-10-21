// Insights, By plan (under Flex): how Flex members spend their monthly quota, over the calendar months the period touches. "Used it all": how many,
// by about which day of the month the quota ran out and how many days it took from the first visit, then who and when. "Didn't use it all": how many,
// the visits burned (the quota minus the visits made) in all and per member, then who. The running month counts as far as today and burns nothing yet.
import { useMemo } from 'react';
import { displayName, memberName } from '@cp/shared';
import { flexQuotaReport, type InsightPeriod, type QuotaMonth } from '@cp/shared/rules/insights';
import { Avatar, GROUP_HEAD, Group, Pager, usePaged } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { ordinal } from '../finance/lib';
import { ThinBar } from './charts';
import { INK, MUTED, Stat, num1 } from './lib';

const PAGE = 5;

export function FlexQuota({ period, today, gap, onOpen }: { period: InsightPeriod; today: string; gap: number; onOpen: (memberId: string) => void }) {
  const s = useClub();
  const t = useT();
  const fmt = useFmt();
  const r = useMemo(() => flexQuotaReport(s, period, today), [s, period, today]);
  const multi = r.months.length > 1;
  const days = (n: number) => (n === 1 ? t('insights.oneDay') : t('insights.nDays', { n }));
  const month = (m: string, year: boolean) => fmt.fd(`${m}-01`, { month: 'short', ...(year ? { year: 'numeric' } : {}) });
  const span = !r.months.length ? '' : !multi ? fmt.fmonth(r.months[0], true)
    : r.months[0].slice(0, 4) === r.months[r.months.length - 1].slice(0, 4) ? `${month(r.months[0], false)} – ${month(r.months[r.months.length - 1], false)}`
    : `${month(r.months[0], true)} – ${month(r.months[r.months.length - 1], true)}`;
  const count = (n: number) => <Stat label={t(multi ? 'insights.fMemberMonths' : 'insights.fMembers')} value={n} />;

  const usedAll = r.usedAll;
  const notAll = r.notAll;
  const pagedUsed = usePaged(usedAll.entries, PAGE, `${period.from}|${period.to}`);
  const pagedNot = usePaged(notAll.entries, PAGE, `${period.from}|${period.to}`);

  const row = (e: QuotaMonth, side: string, meta: string) => {
    const m = s.members[e.memberId];
    if (!m) return null;
    const name = displayName(m);
    return (
      <button key={`${e.month}:${e.memberId}`} type="button" onClick={() => onOpen(e.memberId)} className="h-row cp-bleed" data-member={e.memberId} aria-label={name}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 62, border: 'none', borderTop: '0.5px solid var(--hairline, #E2E2E6)', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: INK, fontFamily: 'Inter' }}>
        <Avatar name={memberName(m)} tone={m.photoTone} size={36} src={memberPhoto(m)} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ flex: 'none', fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{side}</span>
          </span>
          <ThinBar used={e.used} quota={e.quota} extra={e.extra} />
          <span style={{ fontSize: 13, color: MUTED, lineHeight: '17px' }}>{meta}</span>
        </span>
      </button>
    );
  };

  const usedBlock = (
    <>
      <Group title={t('insights.fUsedAll')} pad={0} gap={0}>
        {usedAll.entries.length === 0 ? (
          <div style={{ padding: '18px 16px', textAlign: 'center', color: MUTED, fontSize: 15 }}>{t('insights.fNoneUsedAll')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: '14px 16px' }}>
              {count(usedAll.entries.length)}
              <Stat label={t('insights.fUsedUpBy')} value={usedAll.avgDay === null ? '—' : t('insights.fDayBy', { day: ordinal(fmt.lang, Math.round(usedAll.avgDay)) })} />
              <Stat label={t('insights.fTook')} value={usedAll.avgDays === null ? '—' : '~' + days(Math.round(usedAll.avgDays))} />
            </div>
            {pagedUsed.rows.map((e) => row(
              e, fmt.fds(e.ranOut!),
              [e.took === 0 ? t('insights.usedSameDay', { quota: e.quota }) : t('insights.usedIn', { quota: e.quota, days: days(e.took!) }), e.extra > 0 ? t('insights.extraAfter', { extra: e.extra }) : ''].filter(Boolean).join(' · '),
            ))}
          </>
        )}
      </Group>
      <Pager page={pagedUsed.page} pages={pagedUsed.pages} onPage={pagedUsed.setPage} />
    </>
  );

  const notBlock = (
    <>
      <Group title={t('insights.fNotAll')} pad={0} gap={0}>
        {notAll.entries.length === 0 ? (
          <div style={{ padding: '18px 16px', textAlign: 'center', color: MUTED, fontSize: 15 }}>{t('insights.fNoneNotAll')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: '14px 16px' }}>
              {count(notAll.entries.length)}
              <Stat label={t('insights.fBurned')} value={notAll.burned} />
              <Stat label={t('insights.fAvgBurned')} value={notAll.avgBurned === null ? '—' : num1(notAll.avgBurned)} />
            </div>
            {pagedNot.rows.map((e) => row(
              e, t('insights.unusedN', { n: e.burned }),
              [multi ? month(e.month, false) : '', t('insights.usedOf', { used: e.used, quota: e.quota })].filter(Boolean).join(' · '),
            ))}
          </>
        )}
      </Group>
      <Pager page={pagedNot.page} pages={pagedNot.pages} onPage={pagedNot.setPage} />
      {r.running > 0 ? <div style={{ fontSize: 13, color: MUTED, padding: '0 16px', marginTop: -6 }}>{r.running === 1 ? t('insights.fRunningOne') : t('insights.fRunning', { n: r.running })}</div> : null}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 16px', marginBottom: -Math.round(gap / 2) }}>
        <h2 style={GROUP_HEAD}>{t('insights.fQuota')}</h2>
        <span style={{ fontSize: 13, color: MUTED, lineHeight: '18px', flex: 'none' }}>{span}</span>
      </div>
      {r.total === 0 ? <div style={{ padding: '18px 0', textAlign: 'center', color: MUTED, fontSize: 15 }}>{t('insights.fNoMonths')}</div> : <>{usedBlock}{notBlock}</>}
    </div>
  );
}
