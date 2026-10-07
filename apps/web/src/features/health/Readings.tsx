// Readings (design ScrReadings, lines 1583–1621; logic 2889–2926), with the record by day.
// Two views of the same data. "Trends": who is Watch or Alert (search and pages), and one member's six charts with their history.
// "By day": pick any date (calendar) to see that day's readings for everyone. A member's history is browsed day by day, back in time.
// Phone: the list alone, a row opens the member as a full-screen sheet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, limitsOf, memberAge, memberName, ym, type ClubState, type Health, type HealthLimits, type Reading } from '@cp/shared';
import { NORMAL_BANDS, daySummary, memberReadingsOn, memberTrend, nameMatches, neighbourDay, readingDays, readingsOnDay, sparkPaths, trendCharts, trendRows, type ChartSpec, type TrendRow } from '@cp/shared/rules/healthStation';
import { Button, DateField, Icon, PageHead, Pager, Segmented, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { memberPhoto } from '../../lib/media';
import { EditReadingDialog, VoidReadingDialog } from './dialogs';
import { Av, Badge, FullSheet, SearchBox, StepButton } from './parts';
import { CHECK_KEY, ReadingCard, readingTitle } from './ReadingCard';
import { smallCaps, useWidth } from './lib';
import { whoOfReading } from './who';

type Filter = 'all' | 'watch' | 'alert';
type Mode = 'trends' | 'day';
type Dlg = { t: 'edit'; id: string } | { t: 'void'; id: string };
const SIDE_BY_SIDE = 400 + 20 + 560;
const WEEKS = 4;
const PAGE = 10;

export function Readings() {
  const t = useT();
  const { fds, fmonth } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('trends');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [date, setDate] = useState(today); // the day shown in "By day"
  const [sel, setSel] = useState<string | null>(null);
  const [histDay, setHistDay] = useState<string | null>(null); // the day of the selected member's record (null = their latest day)
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState(0);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [bodyRef, bodyW] = useWidth<HTMLDivElement>();
  const detailRef = useRef<HTMLDivElement>(null);
  const stacked = isPhone || (bodyW > 0 && bodyW < SIDE_BY_SIDE);

  // ----- trends: members with readings -----
  const rows = useMemo(() => trendRows(s, today, WEEKS * 7), [s, today]);
  const F: Record<Filter, (r: TrendRow) => boolean> = { all: () => true, watch: (r) => r.worst === 'watch', alert: (r) => r.worst === 'alert' };
  const list = useMemo(() => rows.filter(F[filter]).filter((r) => nameMatches(memberName(r.m), q)), [rows, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pagedT = usePaged(list, PAGE, `${filter}|${q}`);

  // ----- by day: every reading of the chosen date -----
  const dayAll = useMemo(() => readingsOnDay(s, date), [s, date]);
  const dayItems = useMemo(() => dayAll.map((r) => ({ r, who: whoOfReading(s, r) })).filter((x) => nameMatches(x.who?.name ?? '', q)), [dayAll, s, q]);
  const pagedD = usePaged(dayItems, PAGE, `${date}|${q}`);
  const sum = daySummary(dayAll);

  // the selected member: from the list, or (a day's reading of someone no longer listed) built on the spot
  const cur: TrendRow | null = useMemo(() => {
    if (sel) return rows.find((r) => r.m.id === sel) ?? (s.members[sel] ? memberTrend(s, s.members[sel], today, WEEKS * 7) : null);
    return mode === 'trends' ? list[0] ?? null : null;
  }, [sel, rows, list, mode, s, today]);
  const sheetOpen = isPhone && sheet && !!cur;

  // deep link: /readings?member=m2 (from the health station)
  const want = params.get('member');
  useEffect(() => {
    if (!want) return;
    if (rows.some((r) => r.m.id === want)) { setMode('trends'); setFilter('all'); setQ(''); setSel(want); setHistDay(null); setPick((p) => p + 1); if (isPhone) setSheet(true); }
    navigate(pathname, { replace: true });
  }, [want]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pick && stacked && !isPhone) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string, day: string | null = null) => { setSel(id); setHistDay(day); setPick((p) => p + 1); if (isPhone) setSheet(true); };
  const switchMode = (m: Mode) => { setMode(m); setQ(''); setSel(null); setHistDay(null); setSheet(false); };
  const filters: [Filter, string][] = [['all', t('common.all')], ['watch', t('status.watch')], ['alert', t('status.alert')]];
  const when = (d: string) => (d === today ? t('health.todayL') : fds(d));

  // ----- the lists -----
  const trendsCard = (
    <>
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SearchBox value={q} onChange={setQ} label={t('health.searchL')} placeholder={t('health.trendsSearchPh')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label={t('health.filterL')}>
          {filters.map(([k, label]) => {
            const on = filter === k;
            return (
              <button key={k} type="button" className="cp-chip" aria-pressed={on} onClick={() => { setFilter(k); setSel(null); }}
                style={{ height: 36, padding: '0 14px', borderRadius: 12, border: on ? '1px solid #24201C' : '1px solid #DCD3C8', background: on ? '#24201C' : '#FFFFFF', color: on ? '#FFFFFF' : '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                {label} · {rows.filter(F[k]).length}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        {pagedT.rows.map((r) => {
          const on = cur?.m.id === r.m.id;
          return (
            <button key={r.m.id} type="button" className="dh42" onClick={() => choose(r.m.id)} aria-current={on ? 'true' : undefined} data-testid="reading-row"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 66, border: 'none', borderTop: '1px solid #F0EAE1', background: on ? '#FBF8F4' : '#FFFFFF', boxShadow: on ? 'inset 3px 0 0 #2B231C' : 'none', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
              <Av name={memberName(r.m)} tone={r.m.photoTone} src={memberPhoto(r.m)} size={42} font={15} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{memberName(r.m)}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{r.last ? t('health.lastBp', { v: `${r.last.sys}/${r.last.dia}`, d: when(r.last.date) }) : ''}</span>
              </span>
              <Badge kind={r.worst} icon={17} />
            </button>
          );
        })}
        {!list.length ? <div style={{ padding: '32px 16px', borderTop: '1px solid #F0EAE1', textAlign: 'center', fontSize: 16, color: '#5E5852', lineHeight: 1.4 }}>{q.trim() ? t('common.noResults') : t('health.nobodyGroup')}</div> : null}
        <div style={{ borderTop: list.length ? '1px solid #F0EAE1' : undefined }}><Pager page={pagedT.page} pages={pagedT.pages} onPage={pagedT.setPage} /></div>
      </div>
    </>
  );

  const dayCard = (
    <>
      <div style={{ padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DayNav value={date} onChange={setDate} today={today} ariaLabel={t('health.dayL')} prev={() => setDate(addDays(date, -1))} next={date < today ? () => setDate(addDays(date, 1)) : null}
          prevLabel={t('health.dayPrev')} nextLabel={t('health.dayNext')} reset={date !== today ? { label: t('health.dayToday'), run: () => setDate(today) } : null} />
        <div data-testid="day-summary" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#24201C', fontWeight: 500, lineHeight: 1.4 }}>{t('health.daySum', { r: sum.readings, p: sum.people })}</span>
          {sum.watch ? <Badge kind="watch" label={`${t('status.watch')} · ${sum.watch}`} /> : null}
          {sum.alert ? <Badge kind="alert" label={`${t('status.alert')} · ${sum.alert}`} /> : null}
        </div>
        {dayAll.length > 1 ? <SearchBox value={q} onChange={setQ} label={t('health.searchL')} placeholder={t('health.trendsSearchPh')} /> : null}
      </div>
      <div>
        {pagedD.rows.map(({ r, who }) => {
          const on = !!who && cur?.m.id === who.id;
          const inner = (
            <>
              <Av name={who?.name || ''} tone={who?.tone} src={who?.photo} size={42} font={15} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{who?.name}</span>
                <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{readingTitle(r, t)}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{`${t(CHECK_KEY[r.kind])} · ${r.time}`}</span>
              </span>
              <Badge kind={r.status} icon={17} />
            </>
          );
          const st = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 66, borderTop: '1px solid #F0EAE1', background: on ? '#FBF8F4' : '#FFFFFF', boxShadow: on ? 'inset 3px 0 0 #2B231C' : 'none', textAlign: 'left', color: '#24201C', fontFamily: 'Inter' } as const;
          return who?.member
            ? <button key={r.id} type="button" className="dh42" data-testid="day-row" onClick={() => choose(who.id, r.date)} aria-current={on ? 'true' : undefined} style={{ ...st, border: 'none', borderTop: st.borderTop, cursor: 'pointer' }}>{inner}</button>
            : <div key={r.id} data-testid="day-row" style={st}>{inner}</div>;
        })}
        {!dayAll.length ? (
          <div style={{ padding: '32px 16px', borderTop: '1px solid #F0EAE1', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Icon name="event_busy" size={30} weight={300} color="#6E5A43" style={{ alignSelf: 'center' }} />
            <span style={{ fontSize: 16, lineHeight: 1.4 }}>{t('health.dayEmpty', { d: fds(date) })}</span>
          </div>
        ) : !dayItems.length ? <div style={{ padding: '32px 16px', borderTop: '1px solid #F0EAE1', textAlign: 'center', fontSize: 16, color: '#5E5852' }}>{t('common.noResults')}</div> : null}
        <div style={{ borderTop: dayItems.length ? '1px solid #F0EAE1' : undefined }}><Pager page={pagedD.page} pages={pagedD.pages} onPage={pagedD.setPage} /></div>
      </div>
    </>
  );

  const listCard = (
    <div data-testid="readings-list" style={{ flex: stacked ? '1 1 100%' : mode === 'day' ? '0 1 400px' : '0 1 340px', minWidth: 290, background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
      {mode === 'trends' ? trendsCard : dayCard}
    </div>
  );

  const detail = cur ? (
    <Detail row={cur} s={s} today={today} t={t} when={when} fds={fds} fmonth={fmonth} day={histDay} onDay={setHistDay} onProfile={() => navigate(`/members/${cur.m.id}/health`)}
      onEdit={(id) => setDlg({ t: 'edit', id })} onVoid={(id) => setDlg({ t: 'void', id })} />
  ) : mode === 'day' ? (
    <div style={{ padding: '60px 24px', textAlign: 'center', fontSize: 18, color: '#6B6259', ...{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)' } }}>{t('health.choose')}</div>
  ) : null;
  const pos = cur && mode === 'trends' ? t('health.posList', { i: Math.max(0, list.findIndex((r) => r.m.id === cur.m.id)) + 1, n: list.length }) : '';

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 'clamp(18px, 2.8vw, 28px)' }}>
      <PageHead size={40} eyebrow={t('health.readingsEyebrow', { n: WEEKS })} title={t('nav.readings')} />
      <Segmented<Mode> label={t('health.modeL')} value={mode} onChange={switchMode} items={[{ value: 'trends', label: t('health.modeTrends') }, { value: 'day', label: t('health.modeDay') }]} />
      <div ref={bodyRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(14px, 2vw, 24px)', alignItems: 'flex-start' }}>
        {listCard}
        {!isPhone && detail ? <div ref={detailRef} style={{ flex: '1 1 560px', minWidth: 0 }}>{detail}</div> : null}
      </div>
      {isPhone ? (
        <FullSheet open={sheetOpen} onClose={() => setSheet(false)} back={t('nav.readings')} pos={pos} label={cur ? memberName(cur.m) : t('nav.readings')} bg="#F5F5F3">
          <div style={{ padding: '16px 16px 28px' }}>{detail}</div>
        </FullSheet>
      ) : null}
      {dlg?.t === 'edit' ? <EditReadingDialog readingId={dlg.id} onClose={() => setDlg(null)} /> : null}
      {dlg?.t === 'void' ? <VoidReadingDialog readingId={dlg.id} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}

/** Step back and forward a day, pick any date in the calendar, and jump back to now. The steps may skip to the nearest day that has something. */
function DayNav({ value, onChange, today, ariaLabel, prev, next, prevLabel, nextLabel, reset }: {
  value: string; onChange: (d: string) => void; today: string; ariaLabel: string; prev: (() => void) | null; next: (() => void) | null; prevLabel: string; nextLabel: string; reset: { label: string; run: () => void } | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DateField ariaLabel={ariaLabel} value={value} onChange={(d) => d && onChange(d)} max={today} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <StepButton icon="chevron_left" label={prevLabel} onClick={prev} />
        <StepButton icon="chevron_right" label={nextLabel} onClick={next} />
        {reset ? <Button variant="secondary" size={44} onClick={reset.run}>{reset.label}</Button> : null}
      </div>
    </div>
  );
}

function Detail({ row, s, today, t, when, fds, fmonth, day, onDay, onProfile, onEdit, onVoid }: {
  row: TrendRow; s: ClubState; today: string; t: TFn; when: (d: string) => string; fds: (d: string) => string; fmonth: (m: string) => string; day: string | null; onDay: (d: string | null) => void;
  onProfile: () => void; onEdit: (id: string) => void; onVoid: (id: string) => void;
}) {
  const m = row.m;
  const name = memberName(m);
  const L = limitsOf(s);
  const charts = useMemo(() => trendCharts(row.rs, today, WEEKS * 7, L), [row.rs, today, L]);
  const age = memberAge(m, today);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Av name={name} tone={m.photoTone} src={memberPhoto(m)} size={48} font={17} />
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(20px, 2vw, 24px)', lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{name}</h2>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{[age ?? '', m.health.conditions.length ? m.health.conditions.join(', ') : t('health.noConditions')].filter((x) => x !== '').join(' · ')}</span>
        </div>
        <Button variant="secondary" size={44} icon="folder_open" onClick={onProfile}>{t('health.openRecord')}</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
        {charts.map((c) => <ChartCard key={c.id} c={c} t={t} fds={fds} fmonth={fmonth} today={today} L={L} />)}
      </div>
      <History row={row} s={s} today={today} t={t} when={when} day={day} onDay={onDay} onEdit={onEdit} onVoid={onVoid} />
    </div>
  );
}

/** A member's record, one day at a time: the arrows go to the nearest earlier / later day that has readings, the calendar to any date. */
function History({ row, s, today, t, when, day, onDay, onEdit, onVoid }: {
  row: TrendRow; s: ClubState; today: string; t: TFn; when: (d: string) => string; day: string | null; onDay: (d: string | null) => void; onEdit: (id: string) => void; onVoid: (id: string) => void;
}) {
  const days = useMemo(() => readingDays(row.rs), [row.rs]);
  const latest = days[days.length - 1] ?? today;
  const cur = day ?? latest;
  const rs: Reading[] = useMemo(() => memberReadingsOn(s, row.m.id, cur), [s, row.m.id, cur]);
  const prev = neighbourDay(days, cur, -1);
  const next = neighbourDay(days, cur, 1);
  const idx = days.indexOf(cur);
  return (
    <div data-testid="history" style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '16px clamp(16px, 2vw, 24px) 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ ...smallCaps('2px'), color: '#6E5A43' }}>{t('health.history')}</span>
        <DayNav value={cur} onChange={onDay} today={today} ariaLabel={t('health.histDayL')} prev={prev ? () => onDay(prev) : null} next={next ? () => onDay(next) : null}
          prevLabel={t('health.histEarlier')} nextLabel={t('health.histLater')} reset={cur !== latest ? { label: t('health.histLatest'), run: () => onDay(null) } : null} />
        {idx >= 0 ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('health.histPos', { i: idx + 1, n: days.length })}</span> : null}
      </div>
      <div style={{ padding: '0 clamp(16px, 2vw, 24px) 8px', display: 'flex', flexDirection: 'column' }}>
        {rs.map((r) => <ReadingCard key={r.id} r={r} s={s} t={t} meta={`${when(r.date)} ${r.time}`} onEdit={() => onEdit(r.id)} onVoid={() => onVoid(r.id)} />)}
        {!rs.length ? (
          <div data-testid="history-empty" style={{ padding: '20px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, lineHeight: 1.4 }}>{days.length ? t('health.histEmpty', { d: when(cur) }) : t('health.histNone')}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChartCard({ c, t, fds, fmonth, today, L }: { c: ChartSpec; t: TFn; fds: (d: string) => string; fmonth: (m: string) => string; today: string; L: HealthLimits }) {
  const p = useMemo(() => sparkPaths(c.series, c.opts), [c]);
  const r = c.latest;
  const since = fmonth(c.sinceMonth ?? ym(today));
  const meta: Record<ChartSpec['id'], { title: string; latest: string; legend: string }> = {
    bp: { title: t('health.bp'), latest: r ? `${r.sys}/${r.dia}` : '—', legend: t('health.lgBp') },
    pulse: { title: t('health.pulse'), latest: r ? String(r.pulse) : '—', legend: t('health.lgPulse', { lo: NORMAL_BANDS.pulse[0], hi: NORMAL_BANDS.pulse[1] }) },
    spo2: { title: t('health.cSpo2'), latest: r ? `${r.spo2}%` : '—', legend: t('health.lgSpo2', { w: L.spo2Low.watch ?? '—', a: L.spo2Low.alert ?? '—' }) },
    temp: { title: t('health.cTemp'), latest: r ? `${r.temp} °C` : '—', legend: t('health.lgTemp', { w: L.tempHigh.watch ?? '—', a: L.tempHigh.alert ?? '—' }) },
    glucose: { title: t('health.glucose'), latest: r ? `${r.glucose} mg/dL` : '—', legend: t('health.lgGlu', { m: since, lo: NORMAL_BANDS.glucose[0], hi: NORMAL_BANDS.glucose[1] }) },
    weight: { title: t('health.weight'), latest: r ? `${r.weight} kg` : '—', legend: t('health.lgWt', { m: since, w: L.weightChange.watch ?? L.weightChange.alert ?? '—' }) },
  };
  const m = meta[c.id];
  const badge: Health | null = c.latestStatus;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }} data-chart={c.id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...smallCaps('1.3px'), fontWeight: 600, color: '#5E5852' }}>{m.title}</span>
          <span style={{ fontSize: 26, lineHeight: '32px', fontWeight: 400, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{m.latest}</span>
        </div>
        {badge ? <Badge kind={badge} icon={17} /> : null}
      </div>
      <svg viewBox="0 0 600 130" aria-hidden="true" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x="0" y={p.bandY} width="600" height={p.bandH} rx="6" style={{ fill: '#EAF1EC' }} />
        <path d={p.line2} style={{ fill: 'none', stroke: '#8A755B', strokeWidth: 2, strokeDasharray: '6 5' }} />
        <path d={p.line} style={{ fill: 'none', stroke: '#75624B', strokeWidth: 2 }} />
        <path d={p.dots} style={{ fill: '#75624B' }} />
        <path d={p.hot} style={{ fill: '#9A3D24' }} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
        <span>{m.legend}</span>
        <span>{p.from && p.to ? `${fds(p.from)} – ${fds(p.to)}` : t('health.noReadingsYet')}</span>
      </div>
    </div>
  );
}
