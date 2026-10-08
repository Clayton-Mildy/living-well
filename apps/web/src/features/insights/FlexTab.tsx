// Visit insights, Flex: how Flex members spend their monthly quota. Key numbers (used, unused or likely unused, extra days), how many members sit in each
// bucket (0-3, 4-6, 7-9, all used, extra days), the pace through the month against an even pace, and each member's used / quota with a thin bar.
// For the month that is still running the unused figure is a projection at each member's own pace.
import { useMemo, useState } from 'react';
import { memberName } from '@cp/shared';
import { FLEX_BUCKETS, FLEX_SORTS, flexUsage, sortFlexRows, type FlexBucket, type FlexRow, type FlexSort } from '@cp/shared/rules/insights';
import { Avatar, Group, MonthField, Pager, Select, TrendChart, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { memberPhoto } from '../../lib/media';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { Bars, ThinBar, type BarItem } from './charts';
import { FLEX_COLOR, Panel, num1, pct } from './lib';

const PAGE = 10;
const SORT_KEY: Record<FlexSort, string> = { unused: 'insights.fsUnused', used: 'insights.fsUsed', extra: 'insights.fsExtra' };
const LABEL: Record<FlexBucket, [string, string]> = { b0: ['insights.b0', 'insights.tb0'], b4: ['insights.b4', 'insights.tb4'], b7: ['insights.b7', 'insights.tb7'], all: ['insights.bAll', 'insights.tAll'], extra: ['insights.bExtra', 'insights.tExtra'] };

export function FlexTab({ today, todayDone, month, onMonth, onOpen }: { today: string; todayDone: boolean; month: string; onMonth: (m: string) => void; onOpen: (memberId: string) => void }) {
  const s = useClub();
  const t = useT();
  const { isPhone, isWide } = useDevice();
  const [sort, setSort] = useState<FlexSort>('unused');
  const u = useMemo(() => flexUsage(s, month, today, { todayDone }), [s, month, today, todayDone]);
  const rows = useMemo(() => sortFlexRows(s, u.rows, sort), [s, u.rows, sort]);
  const paged = usePaged(rows, PAGE, `${month}|${sort}`);
  const nMembers = (n: number) => (n === 1 ? t('insights.oneMember') : t('insights.nMembers', { n }));

  const bucketItems: BarItem[] = FLEX_BUCKETS.map((k) => ({
    key: k, label: t(LABEL[k][0]), value: u.buckets[k], tip: `${t(LABEL[k][1])} · ${nMembers(u.buckets[k])}`,
    color: k === 'extra' ? '#C9A24D' : FLEX_COLOR,
  }));
  const extraText = (n: number) => (n === 1 ? t('insights.extraOne') : t('insights.extraN', { n }));
  const stat = (label: string, value: string | number, sub?: string) => (
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 26, lineHeight: '30px', fontWeight: 300, letterSpacing: '-0.5px', color: '#2B231C', fontVariantNumeric: 'tabular-nums' }}>{value}{sub ? <span style={{ fontSize: 14, color: '#6B6259', letterSpacing: 0, marginLeft: 4 }}>{sub}</span> : null}</span>
      <span style={{ fontSize: 13, color: '#6B6259', lineHeight: '17px' }}>{label}</span>
    </div>
  );
  const rowMeta = (r: FlexRow) => {
    if (r.extra > 0) return extraText(r.extra);
    if (u.current) return r.unused > 0 ? `${t('insights.mLeft', { n: r.left })} · ${t('insights.mLikely', { n: r.unused })}` : r.left > 0 ? t('insights.mLeft', { n: r.left }) : t('insights.mAll');
    return r.left > 0 ? t('insights.mUnused', { n: r.left }) : t('insights.mAll');
  };

  const stats = (
    <Panel title={t('insights.fQuota')} meta={nMembers(u.rows.length)}>
      <div style={{ display: 'flex', gap: 12 }}>
        {stat(t('insights.fUsed'), u.visits - u.extraTotal, t('insights.fOf', { n: u.quotaTotal }))}
        {stat(u.current ? t('insights.fLikely') : t('insights.fUnused'), u.unusedTotal)}
        {stat(t('insights.fExtra'), u.extraTotal)}
      </div>
    </Panel>
  );
  const buckets = (
    <Panel title={t('insights.buckets')}>
      <Bars items={bucketItems} height={96} ariaLabel={t('insights.buckets')} />
    </Panel>
  );
  const pace = u.pace.length ? (
    <Panel title={t('insights.pace')}>
      <TrendChart height={isPhone ? 140 : 170} ariaLabel={t('insights.paceAria')} from={`${month}-01`} to={u.pace[u.pace.length - 1].date} format={num1}
        series={[
          { key: 'avg', label: t('insights.paceAvg'), tone: 'ink', points: u.pace.map((p) => ({ date: p.date, value: p.avg })) },
          { key: 'even', label: t('insights.paceEven'), tone: 'muted', dashed: true, points: u.pace.map((p) => ({ date: p.date, value: p.even })) },
        ]}
        describe={(d) => { const p = u.pace.find((x) => x.date === d); return p ? t('insights.paceDescribe', { even: num1(p.even) }) : undefined; }} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#6B6259' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 2, background: '#24201C' }} />{t('insights.paceAvg')}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 0, borderTop: '2px dashed #8A8078' }} />{t('insights.paceEven')}</span>
      </div>
      {u.half.complete && u.half.firstShare !== null ? (
        <div style={{ fontSize: 14, color: '#4A4038' }}>{t('insights.paceNote', { a: pct(u.half.first, u.half.first + u.half.second), b: pct(u.half.second, u.half.first + u.half.second) })}</div>
      ) : null}
    </Panel>
  ) : null;

  const list = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: isPhone ? '1 1 0' : '0 0 240px', minWidth: 0 }}>
          <Select ariaLabel={t('insights.sortLabel')} value={sort} onChange={setSort} options={FLEX_SORTS.map((k) => ({ value: k, label: t(SORT_KEY[k]) }))} />
        </div>
        <span style={{ fontSize: 13, color: '#6B6259', flex: 'none' }}>{t('insights.fMembers')} · {rows.length}</span>
      </div>
      <Group pad={0} gap={0}>
        {paged.rows.map((r, i) => {
          const m = s.members[r.memberId];
          if (!m) return null;
          const name = memberName(m);
          return (
            <button key={r.memberId} type="button" onClick={() => onOpen(r.memberId)} className="h-row cp-bleed" data-member={r.memberId} aria-label={name}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minHeight: 62, border: 'none', borderTop: i ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
              <Avatar name={name} tone={m.photoTone} size={36} src={memberPhoto(m)} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <span style={{ flex: 'none', fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t('insights.usedOf', { used: r.used, quota: r.quota })}</span>
                </span>
                <ThinBar used={r.used} quota={r.quota} extra={r.extra} />
                <span style={{ fontSize: 13, color: r.extra > 0 ? '#7A5510' : '#6B6259', lineHeight: '17px' }}>{rowMeta(r)}</span>
              </span>
            </button>
          );
        })}
      </Group>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </>
  );

  return (
    <>
      <div style={{ maxWidth: isPhone ? undefined : 260 }}>
        <MonthField ariaLabel={t('insights.fMonth')} value={month} onChange={(v) => v && onMonth(v)} max={today.slice(0, 7)} />
      </div>
      {u.rows.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: '#6B6259', fontSize: 15 }}>{t('insights.fNone')}</div>
      ) : (
        <>
          {stats}
          {isWide ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, alignItems: 'start' }}>
              {buckets}{pace}
            </div>
          ) : <>{buckets}{pace}</>}
          {list}
        </>
      )}
    </>
  );
}
