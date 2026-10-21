// Round 12: the Month report (management). The business view of a period in four grouped lists — Money, Members, Care and mood, Pipeline and team —
// each number with its change since the period before (same length, ending the day before) under it, and each row opening the screen behind it.
// The period is the Insights one (This month, Last month, Last 3 / 6 months, or a custom From and To). "Send to owner" opens a WhatsApp-style summary.
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { rp } from '@cp/shared';
import { PERIOD_KEYS, editPeriod, periodFor, type InsightPeriod, type PeriodKey } from '@cp/shared/rules/insights';
import { END_REASONS, LOST_REASONS, monthReport, type Delta, type MonthReport as Report } from '@cp/shared/rules/monthReport';
import { Button, DateField, EmptyState, Group, Icon, PageHead, Pin, Select } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { useAtLeast } from '../lobby/useAtLeast';
import { OwnerSummary, pct, signed, type SummaryFmt } from './OwnerSummary';
import { Line, MUTED, RUST, SAGE } from './parts';

/** The container width from which the four groups sit in two columns. */
const WIDE = 860;
const PERIOD_KEY: Record<PeriodKey, string> = { thisMonth: 'insights.pThisMonth', lastMonth: 'insights.pLastMonth', last3: 'insights.pLast3', last6: 'insights.pLast6', custom: 'insights.pCustom' };
const one = (n: number) => String(Math.round(n * 10) / 10);
const pts = (n: number) => `${Math.round(n * 100)} pt`;
const count = (n: number) => String(n);

/** The colour of a change: sage when it moved the good way, rust when not, grey when there is no good way (or no change). */
function tone(d: Delta<number | null>): string {
  if (!d.diff || d.good === 'none') return MUTED;
  return (d.diff > 0) === (d.good === 'up') ? SAGE : RUST;
}

/** One row: the label on the left, the number on the right in 17px with its change under it in 13px. */
function Stat({ first, label, value, d, df, sub, onClick }: { first?: boolean; label: string; value: ReactNode; d?: Delta<number | null>; df?: (n: number) => string; sub?: ReactNode; onClick?: () => void }) {
  const diff = d ? signed(d.diff, df) : '';
  return (
    <Line first={first} onClick={onClick} label={onClick ? label : undefined}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, lineHeight: 1.3 }}>{label}</span>
        {sub ? <span style={{ fontSize: 13, lineHeight: '18px', color: MUTED }}>{sub}</span> : null}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 17, fontWeight: 500, lineHeight: '22px' }}>{value}</span>
        {diff ? <span data-delta style={{ fontSize: 13, lineHeight: '18px', color: tone(d!) }}>{diff}</span> : null}
      </span>
      {onClick ? <Icon name="chevron_right" size={18} color="#A8A29C" /> : null}
    </Line>
  );
}
const val = (d: Delta<number | null>, f: (n: number) => string) => (d.cur === null ? '—' : f(d.cur));
/** "Moved away 1 · Unpaid 2": the non-zero counts of a breakdown. */
const breakdown = (t: TFn, keys: readonly string[], counts: Record<string, number>, prefix: string) =>
  keys.filter((k) => counts[k] > 0).map((k) => `${t(prefix + k)} ${counts[k]}`).join(' · ');

export function MonthReport() {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const { role } = useMe();
  const { today, nowMin } = useNow();
  const { device, isPhone } = useDevice();
  const go = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const { wide } = useAtLeast(boxRef, WIDE);
  const [pKey, setPKey] = useState<PeriodKey>('thisMonth');
  const [custom, setCustom] = useState<InsightPeriod | null>(null);
  const [sending, setSending] = useState(false);
  const period = useMemo(() => periodFor(pKey, today, custom), [pKey, today, custom]);
  const r = useMemo(() => (s ? monthReport(s, period, today, nowMin) : null), [s, period, today, nowMin]);
  if (!s || !r || role !== 'mgmt') return <div ref={boxRef} />;

  const short = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' });
  const range = (p: InsightPeriod) => (p.from === p.to ? short(p.from) : `${short(p.from)} – ${short(p.to)}`);
  const sumFmt: SummaryFmt = { rp, pct, range };
  const pickPeriod = (k: PeriodKey) => { if (k === 'custom' && pKey !== 'custom') setCustom(period); setPKey(k); };
  const periodSelect = <Select ariaLabel={t('month.period')} value={pKey} onChange={pickPeriod} options={PERIOD_KEYS.map((k) => ({ value: k, label: t(PERIOD_KEY[k]) }))} />;
  const customRow = pKey === 'custom' ? (
    <div data-testid="period-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: isPhone ? undefined : 380 }}>
      <DateField compact label={t('insights.from')} value={period.from} max={today} onChange={(d) => setCustom(editPeriod(period, 'from', d, today))} />
      <DateField compact label={t('insights.to')} value={period.to} max={today} onChange={(d) => setCustom(editPeriod(period, 'to', d, today))} />
    </div>
  ) : null;
  const sendBtn = !isPhone && !r.empty ? <Button size={44} icon="send" onClick={() => setSending(true)}>{t('month.sendOwner')}</Button> : null;

  const { money: m, members: mb, care: c, pipeline: p } = r;
  // billed, extra days and renewals go by billing month: say which months they compare ("Oct vs Sep")
  const mon = (x: string) => fmt.fd(`${x}-01`, { month: 'short' });
  const months = (list: string[]) => (list.length > 1 ? `${mon(list[0])}–${mon(list[list.length - 1])}` : mon(list[0]));
  const basis = t('month.monthsVs', { cur: months(r.months.cur), prev: months(r.months.prev) });
  const open = (path: string) => () => go(path);
  const money = (
    <Group key="money" title={t('month.money')} label={t('month.money')} pad={0} gap={0}>
      <Stat first label={t('month.billed')} value={rp(m.billed.cur)} d={m.billed} df={rp} sub={basis} onClick={open('/billing')} />
      <Stat label={t('month.collected')} value={rp(m.collected.cur)} d={m.collected} df={rp} onClick={open('/payments')} />
      <Stat label={t('month.outstanding')} value={rp(m.outstanding.cur)} d={m.outstanding} df={rp} onClick={open('/billing')} />
      <Stat label={t('month.notYetDue')} value={rp(m.notYetDue.cur)} d={m.notYetDue} df={rp} onClick={open('/billing')} />
      <Stat label={t('month.extraDays')} value={m.extraDays.cur ? `${m.extraDays.cur} · ${rp(m.extraDays.amount.cur)}` : '0'} d={m.extraDays} sub={basis} onClick={open('/billing')} />
      <Stat label={t('month.venueIncome')} value={rp(m.venueIncome.cur)} d={m.venueIncome} df={rp} onClick={open('/venue')} />
      <Stat label={t('month.refunds')} value={rp(m.refunds.cur)} d={m.refunds} df={rp} onClick={open('/payments')} />
    </Group>
  );
  const members = (
    <Group key="members" title={t('month.members')} label={t('month.members')} pad={0} gap={0}>
      <Stat first label={t('month.active')} value={mb.active.cur} d={mb.active} onClick={open('/members')} />
      <Stat label={t('month.joined')} value={mb.joined.cur} d={mb.joined} onClick={open('/members')} />
      <Stat label={t('month.ended')} value={mb.ended.cur} d={mb.ended} sub={breakdown(t, END_REASONS, mb.ended.byReason, 'profile.endReason.') || undefined} onClick={open('/members')} />
      <Stat label={t('month.renewalsKept')} value={mb.renewalsKept.cur} d={mb.renewalsKept} sub={basis} onClick={open('/renewals')} />
      <Stat label={t('month.renewalsLost')} value={mb.renewalsLost.cur} d={mb.renewalsLost} sub={basis} onClick={open('/renewals')} />
      <Stat label={t('month.onLeave')} value={mb.onLeave.cur} d={mb.onLeave} onClick={open('/members')} />
      <Stat label={t('month.checkOn')} value={mb.checkOn} onClick={open('/today')} />
      <Stat label={t('month.visitsPerMember')} value={val(mb.visitsPerMember, one)} d={mb.visitsPerMember} df={one} onClick={open('/insights')} />
      <Stat label={t('month.utilisation')} value={pct(mb.utilisation.cur)} d={mb.utilisation} df={pts} onClick={open('/insights')} />
    </Group>
  );
  const moments = (['arrival', 'health', 'activity', 'departure'] as const).filter((k) => c.byMoment[k] !== null).map((k) => `${t('mood.moment.' + k)} ${one(c.byMoment[k]!)}`).join(' · ');
  const care = (
    <Group key="care" title={t('month.care')} label={t('month.care')} pad={0} gap={0}>
      <Stat first label={t('month.index')} value={val(c.index, one)} d={c.index} df={one} sub={moments || undefined} onClick={open('/insights?tab=mood')} />
      <Stat label={t('month.lift')} value={val(c.lift, (n) => signed(n, one) || '0')} d={c.lift} df={one} onClick={open('/insights?tab=mood')} />
      <Stat label={t('month.alerts')} value={c.alerts.cur} d={c.alerts} onClick={open('/readings')} />
      <Stat label={t('month.watches')} value={c.watches.cur} d={c.watches} onClick={open('/readings')} />
      <Stat label={t('month.rechecks')} value={c.rechecks.cur} d={c.rechecks} onClick={open('/readings')} />
      <Stat label={t('month.lunchEaten')} value={pct(c.lunchEaten.cur)} d={c.lunchEaten} df={pts} onClick={open('/report')} />
    </Group>
  );
  const lost = breakdown(t, LOST_REASONS, p.lostReasons, 'enq.lost.');
  const lostN = LOST_REASONS.reduce((a, k) => a + p.lostReasons[k], 0);
  const duties = p.duties.filter((x) => x.total > 0);
  const pipeline = (
    <Group key="pipeline" title={t('month.pipeline')} label={t('month.pipeline')} pad={0} gap={0}>
      <Stat first label={t('month.leads')} value={p.funnel.new} onClick={open('/enquiries')} />
      <Stat label={t('month.visits')} value={p.funnel.visit} sub={p.conversion.toVisit !== null ? pct(p.conversion.toVisit) : undefined} onClick={open('/enquiries')} />
      <Stat label={t('month.trials')} value={p.funnel.trial} sub={p.conversion.toTrial !== null ? pct(p.conversion.toTrial) : undefined} onClick={open('/enquiries')} />
      <Stat label={t('month.converted')} value={p.funnel.joined} sub={p.conversion.toJoined !== null ? pct(p.conversion.toJoined) : undefined} onClick={open('/enquiries')} />
      <Stat label={t('month.lost')} value={lostN} sub={[lost, t('month.leadsCaption')].filter(Boolean).join(' · ')} onClick={open('/enquiries')} />
      {duties.map((x) => <Stat key={x.role} label={`${t('month.duties')} · ${t('roles.' + x.role)}`} value={`${x.done}/${x.total}`} sub={pct(x.done / x.total)} onClick={open('/tasks')} />)}
      <Stat label={t('month.surveyFamily')} value={p.surveys.family === null ? '—' : `${one(p.surveys.family)} / 5`} onClick={open('/surveys')} />
      <Stat label={t('month.surveyVenue')} value={p.surveys.venue === null ? '—' : `${one(p.surveys.venue)} / 5`} onClick={open('/surveys')} />
    </Group>
  );
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 };

  return (
    <div ref={boxRef} className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20 }}>
      <PageHead size={40} title={t('month.title')} right={!isPhone ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ width: 220 }}>{periodSelect}</div>{sendBtn}</div> : undefined} />
      {isPhone ? periodSelect : null}
      {customRow}
      <div data-testid="month-range" style={{ fontSize: 13, color: MUTED, marginTop: isPhone ? -6 : -10 }}>{`${range(r.period)} · ${t('month.vsPrev', { period: range(r.prev) })}`}</div>
      {r.empty ? (
        <EmptyState icon="query_stats" title={t('month.empty')} />
      ) : wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
          <div style={col}>{[money, care]}</div>
          <div style={col}>{[members, pipeline]}</div>
        </div>
      ) : (
        <div style={col}>{[money, members, care, pipeline]}</div>
      )}
      {isPhone && !r.empty && !sending ? <Pin icon="send" label={t('month.sendOwner')} onClick={() => setSending(true)} /> : null}
      <OwnerSummary open={sending} onClose={() => setSending(false)} r={r} fmt={sumFmt} />
    </div>
  );
}
