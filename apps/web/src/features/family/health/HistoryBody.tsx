// The health history's body (round 8): one measurement at a time over a time range (1W … All, or two dates), its average, the chart (tap or hover for a day's
// value) and the readings in range with their grade. A family sees approved readings only; grades follow the parent's own limits.
// Two layouts: the History page (a phone's one column; a laptop's wide chart side that sticks beside the readings list) and, round 8c, `inline` — the laptop's
// Health tab (the prototype's desktop), where it is the right-hand column under a "History" title: measurement chips, a 420px range control, the average, a 240px
// chart, the legend and the readings in two columns (one column under a 1280px window). The measurement is the caller's (the page keeps it in the URL, the Health tab in its own state).
import { useMemo, useState } from 'react';
import { limitsFor, memberShort, type Health, type Member } from '@cp/shared';
import { HIST_METRICS, METRIC_UNIT, averageText, bandOf, familyReadings, isMetric, metricRows, metricsWithData, type HMetric, type MetricRow } from '@cp/shared/rules/famHealth';
import { Icon, TrendChart, inWindow, rangeValue, windowOf, type RangeChoice, type RangeValue, type TrendPoint } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import { Cap, Cols, F, FillCard, Seg, TextLink, useFamWide } from '../kit';
import { useFamilyCtx } from '../useFamily';
import { DateRangeSheet } from './DateRangeSheet';
import { ChipRow, PALETTE } from './bits';

const RANGES: RangeChoice[] = ['1w', '1m', '3m', '6m', 'all', 'custom'];
/** Monthly measurements (glucose, weight, grip) are taken once a month, so they open on six months. */
const DEFAULT_RANGE: Record<HMetric, RangeChoice> = { bp: '3m', pulse: '3m', spo2: '3m', temp: '3m', glucose: '6m', weight: '6m', grip: '6m' };
const PAGE = 12;

export function HistoryBody({ m, asked, onMetric, inline }: { m: Member; /** the measurement asked for (`?metric=`), if any */ asked: string | null; onMetric: (v: HMetric) => void; inline?: boolean }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const [picked, setPicked] = useState<RangeValue | null>(null);
  const [sheet, setSheet] = useState<{ pick: 'from' | 'to'; n: number } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const wide = useFamWide();
  const { isLaptop } = useDevice(); // the inline readings are two columns from a 1280px window; narrower (1024–1279) the column is too tight for two
  const rs = useMemo(() => familyReadings(s, m.id), [s, m]);
  const L = useMemo(() => limitsFor(s, m), [s, m]);

  const short = memberShort(m);
  const avail = metricsWithData(rs);
  const metric: HMetric = isMetric(asked) && avail.includes(asked) ? asked : avail[0] ?? 'bp';
  const rows = metricRows(rs, metric, L);
  const first = rows[0]?.r.date;
  const range = picked ?? rangeValue(DEFAULT_RANGE[metric]);
  const win = windowOf(range, now.today, first);
  const inRange = rows.filter((x) => inWindow(x.r.date, win));
  const label = (k: HMetric) => t('fhealth.m_' + k);
  const unit = METRIC_UNIT[metric];
  const dec = metric === 'weight' || metric === 'temp' || metric === 'grip';
  const crossYear = win.from.slice(0, 4) !== win.to.slice(0, 4) || win.to.slice(0, 4) !== now.today.slice(0, 4);
  const day = (d: string) => fmt.fd(d, crossYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  const count = inRange.length;
  const band = bandOf(metric, L);

  if (!avail.length) {
    return (
      <FillCard radius={22} pad={20} gap={6} testId="history-empty">
        <Icon name="monitor_heart" size={28} color={F.bronze} />
        <span style={{ fontSize: 17, fontWeight: 500, color: F.text }}>{t('fhealth.emptyTitle')}</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: F.muted }}>{t('fhealth.emptyBody', { n: short })}</span>
      </FillCard>
    );
  }

  const pt = (x: MetricRow, v: number, withStatus: boolean): TrendPoint => ({ date: x.r.date, time: x.r.time, value: v, ...(withStatus && x.status ? { status: x.status } : {}) });
  const series = metric === 'bp'
    ? [{ key: 'sys', label: t('profile.bpUpper'), points: inRange.map((x) => pt(x, x.value, true)) }, { key: 'dia', label: t('profile.bpLower'), points: inRange.map((x) => pt(x, x.low ?? 0, false)), dashed: true, tone: 'muted' as const }]
    : [{ key: metric, label: label(metric), points: inRange.map((x) => pt(x, x.value, true)) }];

  const setMetric = (v: HMetric) => { onMetric(v); setShown(PAGE); };
  const pickRange = (v: RangeChoice) => {
    if (v === 'custom') { setSheet({ pick: 'from', n: Date.now() }); return; }
    setPicked(rangeValue(v));
    setShown(PAGE);
  };
  const dot = (bg: string, text: string) => <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: bg }} />{text}</span>;
  const kindWhen = (x: MetricRow) => `${x.r.date === now.today ? t('common.today') : fmt.fds(x.r.date)} · ${x.r.time} · ${t('fhealth.kind_' + x.r.kind)}`;
  const list = inRange.slice().reverse();
  const stText = (st: Health | null) => (st ? t('status.' + st) : t('fhealth.recorded'));

  const metrics = <ChipRow<HMetric> label={t('fhealth.chooseMetric')} value={metric} onChange={setMetric} testId="history-metrics" items={HIST_METRICS.filter((k) => avail.includes(k)).map((k) => ({ value: k, label: label(k) }))} />;
  const rangeSeg = <Seg<RangeChoice> label={t('fhealth.rangeAria')} value={range.choice} onChange={pickRange} size={13} testId="history-range" width={inline ? 420 : undefined} items={RANGES.map((r) => ({ value: r, label: t('health.range.' + r) }))} />;
  const custom = range.choice === 'custom' ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, ...(inline ? { maxWidth: 420 } : {}) }}>
      {(['from', 'to'] as const).map((k) => (
        <button key={k} type="button" onClick={() => setSheet({ pick: k, n: Date.now() })} className="cp-fam-press" data-testid={`range-${k}`}
          style={{ height: 52, border: 'none', borderRadius: 14, background: F.fill, padding: '0 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <span style={{ fontSize: 11, color: F.muted, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>{t(k === 'from' ? 'health.rangeFrom' : 'health.rangeTo')}</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: F.text }}>{fmt.fdy(k === 'from' ? win.from : win.to)}</span>
        </button>
      ))}
    </div>
  ) : null;
  const summary = (
    <div data-testid="history-summary" data-metric={metric} data-count={count} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: inline ? 0 : '0 4px' }}>
      <span style={{ fontSize: 13, color: F.muted }}>{count === 0 ? t('fhealth.spanLineNone', { a: day(win.from), b: day(win.to) }) : t(count === 1 ? 'fhealth.spanLineOne' : 'fhealth.spanLine', { a: day(win.from), b: day(win.to), n: count })}</span>
      <span style={{ fontSize: inline ? 36 : 32, lineHeight: 1.05, fontWeight: 300, letterSpacing: '-1px', color: F.ink, fontVariantNumeric: 'tabular-nums', minHeight: 34 }}>
        {count ? averageText(inRange, metric) : '—'} <span style={{ fontSize: 14, color: F.muted, letterSpacing: 0 }}>{t('fhealth.avgUnit', { u: unit })}</span>
      </span>
    </div>
  );
  const chart = (
    <div data-testid="history-chart" style={{ background: F.fill, borderRadius: inline ? 18 : 16, padding: '12px 10px 8px' }}>
      <TrendChart series={series} band={band} unit={unit} format={dec ? (v) => v.toFixed(1) : (v) => String(Math.round(v))} from={win.from} to={win.to} height={inline ? 240 : wide ? 280 : 180}
        legend={metric === 'bp'} ariaLabel={t('health.trendOf', { n: label(metric) })} empty={t('health.noInRange')} />
    </div>
  );
  const legend = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: F.muted, padding: inline ? 0 : '0 4px', marginTop: -4 }}>
      {band ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 9, background: F.sageBg, borderRadius: 2 }} />{t('profile.normalRange')}</span> : null}
      {metric !== 'weight' && metric !== 'grip' ? [dot(F.ochre, t('status.watch')), dot(F.rust, t('status.alert'))] : null}
    </div>
  );
  const readings = (
    <div key="r" style={{ display: 'flex', flexDirection: 'column' }} data-testid="history-list">
      {inline ? null : <Cap style={{ padding: '6px 4px' }}>{t('fhealth.listTitle')}</Cap>}
      <div style={inline ? { display: 'grid', gridTemplateColumns: isLaptop ? 'repeat(2, minmax(0, 1fr))' : '1fr', columnGap: 24 } : { display: 'flex', flexDirection: 'column' }}>
        {list.slice(0, shown).map((x, j) => (
          <div key={x.r.id} data-testid="history-reading" data-status={x.status ?? 'recorded'} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: inline ? '11px 0' : '11px 4px', borderTop: inline || j ? `0.5px solid ${F.hair}` : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: F.text }}>{metric === 'bp' ? x.text : `${x.text} ${unit}`}</span>
              <span style={{ fontSize: 13, color: F.muted, overflowWrap: 'anywhere' }}>{kindWhen(x)}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: x.status ? PALETTE[x.status].fg : F.muted, flex: 'none' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: x.status ? PALETTE[x.status].dot : F.chev }} />{stText(x.status)}
            </span>
          </div>
        ))}
      </div>
      {!list.length ? <span style={{ fontSize: 14, color: F.muted, padding: inline ? '8px 0' : '8px 4px' }}>{t('fhealth.noneInRange')}</span> : null}
      {list.length > shown ? <TextLink onClick={() => setShown((n) => n + 20)} testId="history-more" style={{ alignSelf: 'flex-start', padding: inline ? '4px 0' : '4px' }}>{t('fhealth.showMore')} ({list.length - shown})</TextLink> : null}
    </div>
  );
  const dateSheet = sheet ? (
    <DateRangeSheet key={sheet.n} from={win.from} to={win.to} pick={sheet.pick} today={now.today} firstDate={first} onClose={() => setSheet(null)}
      onApply={(w) => { setPicked({ choice: 'custom', custom: w }); setShown(PAGE); setSheet(null); }} />
  ) : null;

  if (inline) {
    return (
      <div data-testid="history-inline" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {metrics}
        {rangeSeg}
        {custom}
        {summary}
        {chart}
        {legend}
        {readings}
        {dateSheet}
      </div>
    );
  }
  return (
    <>
      <Cols left="1.5fr" right="1fr" stickyLeft>
        {[
          <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {metrics}
            {rangeSeg}
            {custom}
            {summary}
            {chart}
            {legend}
          </div>,
          readings,
        ]}
      </Cols>
      {dateSheet}
    </>
  );
}
