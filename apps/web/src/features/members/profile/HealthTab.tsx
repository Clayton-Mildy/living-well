// Health tab (design ScrProfile health): latest readings, trends (hover or tap for a date's value; 1M / 3M / 6M / All), conditions, medicines,
// allergies, mobility and diet, the member's Watch / Alert limits (own or the club's), every reading by month, and the staff-only care instructions.
import { useState } from 'react';
import { actorName, bpStatus, gluStatus, LIMIT_CMP, limitsFor, memberShort, ownLimitKeys, pulseStatus, readingsOf, spo2Status, tempStatus, type Health, type LimitKey, type Reading } from '@cp/shared';
import { Button, FONT_BODY, Group, Icon, Pager, Segmented, StaffOnlyTag, StatusBadge, TrendChart, TrendRangeControl, inWindow, rangeValue, usePaged, windowOf } from '../../../components/ui';
import { LIMIT_ORDER, LimitsSheet, unitOf } from '../../health/LimitsSheet';
import { PhoneSeg } from '../../health/parts';
import { CARD_PX, cardStyle, cogText, dietLabel, drugLabel, foodList, HAIR, listCardStyle, MOB_ICON, mobLabel, timingLabel, whenText } from '../lib';
import { readingForFamily } from '@cp/shared/rules/approvals';
import { TAB_METRICS, tabTrend, type TabMetric } from '@cp/shared/rules/healthStation';
import { PendingMark } from '../../../components/PendingMark';
import { Block, ListCard, ListHead, PendingBanner } from './parts';
import type { P } from './types';

const KIND_KEY: Record<Reading['kind'], string> = { arrival: 'health.arrivalCheck', departure: 'health.departureCheck', recheck: 'health.recheckL', spot: 'health.spotCheck', monthly: 'profile.monthlyCheck' };

export function HealthTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const rs = readingsOf(s, m.id).map((r) => (p.family ? readingForFamily(r) : r)).filter((r): r is Reading => !!r); // a reading waiting for approval is for staff only
  const L = limitsFor(s, m); // this member's own limits first, the club's for the rest (the family sees the same grades)
  const [clubOpen, setClubOpen] = useState(false);
  const [limSheet, setLimSheet] = useState(false);
  const [metric, setMetric] = useState<TabMetric>('bp');
  const [range, setRange] = useState(() => rangeValue('3m'));
  // KC round 7: the chosen dates also narrow the "All readings" list (All shows everything, as before)
  const ranged = range.choice !== 'all';
  const listWin = windowOf(range, today, rs[0]?.date);
  const rsIn = ranged ? rs.filter((r) => inWindow(r.date, listWin)) : rs;
  const paged = usePaged(rsIn.slice().reverse(), 12, `${m.id}|${ranged ? listWin.from + listWin.to : 'all'}`); // the readings in range, newest first
  const lastOf = (f: keyof Reading) => { for (let i = rs.length - 1; i >= 0; i--) if (rs[i][f] != null && rs[i][f] !== '') return rs[i]; return null; };
  const tile = (label: string, f: keyof Reading, fmtV: (r: Reading) => string, unit: string, fn?: (r: Reading) => Health) => {
    const r = lastOf(f);
    return { label, unit: r ? unit : '', value: r ? fmtV(r) : '—', date: r ? `${r.date === today ? t('common.today') : fmt.fds(r.date)} · ${r.time}` : t('profile.notMeasured'), badge: r && fn ? fn(r) : null };
  };
  const tiles = [
    tile(t('health.bp'), 'sys', (r) => `${r.sys}/${r.dia}`, 'mmHg', (r) => bpStatus(r.sys!, r.dia!, L)),
    tile(t('health.pulse'), 'pulse', (r) => String(r.pulse), 'bpm', (r) => pulseStatus(r.pulse!, L)),
    tile(t('health.spo2').split(' · ')[1] || 'SpO₂', 'spo2', (r) => String(r.spo2), '%', (r) => spo2Status(r.spo2!, L)),
    tile(t('health.temp'), 'temp', (r) => String(r.temp), '°C', (r) => tempStatus(r.temp!, L)),
    tile(t('health.glucose'), 'glucose', (r) => String(r.glucose), 'mg/dL', (r) => gluStatus(r.glucose!, L)),
    tile(t('health.weight'), 'weight', (r) => String(r.weight), 'kg'),
    tile(t('health.grip'), 'grip', (r) => String(r.grip), 'kg'),
  ];
  // the trends: the metrics with at least two readings; BP and pulse from the arrival checks, weight and glucose from every reading that has them
  const trends = TAB_METRICS.map((k) => ({ k, ...tabTrend(rs, k, L) })).filter((x) => x.series[0].length > 1);
  const cur = trends.find((x) => x.k === metric) ?? trends[0];
  const food = foodList(t, m);
  const drugs = m.health.drugs.map((d) => drugLabel(t, d));
  const none = { icon: 'check', label: t('profile.noneKnown'), bg: '#F3EEE8', ic: '#24201C' };
  const cog = m.health.cognitive;
  /** icon, title, sub line: one inset-hairline row of a list card */
  const item = (key: string | number, icon: string, title: string, sub?: string, first?: boolean) => (
    <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '13px 0', borderTop: first ? 'none' : HAIR }}>
      <Icon name={icon} size={20} color="#75624B" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
        {sub ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{sub}</span> : null}
      </div>
    </div>
  );
  const chip = (a: { icon: string; label: string; bg: string; ic: string }, j: number) => (
    <span key={j} style={{ minHeight: 30, maxWidth: '100%', padding: '3px 12px 3px 9px', borderRadius: 12, background: a.bg, color: a.ic === '#9A3D24' ? '#9A3D24' : '#24201C', fontSize: FONT_BODY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
      <Icon name={a.icon} size={17} color={a.ic} />
      {a.label}
    </span>
  );
  const mobDiet = [{ icon: m.health.mobility ? MOB_ICON[m.health.mobility] : 'directions_walk', label: mobLabel(t, m.health.mobility) }, ...m.health.diet.map((d) => ({ icon: 'restaurant', label: dietLabel(t, d) })), ...(m.health.diabetic ? [{ icon: 'water_drop', label: t('profile.diabetic') }] : [])];

  const ph = p.isPhone; // round 6, phone (staff and family): the sections are iOS grouped sections, headers outside (the card layout stays for tablet and laptop)
  const tilesGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '22px 20px' }}>
      {tiles.map((v, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '18px' }}>{v.label}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 30, lineHeight: '36px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{v.value}</span>
            <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{v.unit}</span>
          </span>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{v.date}</span>
          {v.badge ? <span style={{ alignSelf: 'flex-start', marginTop: 2 }}><StatusBadge kind={v.badge} small /></span> : null}
        </div>
      ))}
    </div>
  );
  const METRIC_KEY: Record<TabMetric, string> = { bp: 'profile.tmBp', pulse: 'profile.tmPulse', weight: 'profile.tmWeight', glucose: 'profile.tmGlucose' };
  const METRIC_UNIT: Record<TabMetric, string> = { bp: 'mmHg', pulse: 'bpm', weight: 'kg', glucose: 'mg/dL' };
  const win = windowOf(range, today, cur?.series[0][0]?.date);
  const readingsIn = (n: number, w: { from: string; to: string }) => t(n === 1 ? 'health.readingsInOne' : 'health.readingsIn', { n, a: fmt.fds(w.from), b: fmt.fds(w.to) });
  const trendIn = cur ? cur.series[0].filter((x) => inWindow(x.date, win)).length : 0;
  const trendMeta = cur && trendIn ? readingsIn(trendIn, win) : '';
  const dot = (bg: string, label: string) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: bg }} />{label}</span>;
  const metricItems = trends.map((x) => ({ value: x.k, label: t(METRIC_KEY[x.k]) }));
  const trendBody = cur ? (
    <>
      <div style={{ display: 'flex', flexDirection: ph ? 'column' : 'row', flexWrap: 'wrap', gap: 8, alignItems: ph ? 'stretch' : 'center', justifyContent: 'space-between' }}>
        {trends.length > 1 ? (ph ? <PhoneSeg<TabMetric> label={t('profile.metricL')} value={cur.k} onChange={setMetric} items={metricItems} /> : <Segmented<TabMetric> label={t('profile.metricL')} value={cur.k} onChange={setMetric} items={metricItems} />) : ph ? null : <span />}
        <TrendRangeControl value={range} onChange={setRange} today={today} firstDate={cur.series[0][0]?.date} />
      </div>
      <TrendChart
        series={cur.k === 'bp'
          ? [{ key: 'sys', label: t('profile.bpUpper'), points: cur.series[0] }, { key: 'dia', label: t('profile.bpLower'), points: cur.series[1], dashed: true, tone: 'muted' }]
          : [{ key: cur.k, label: t(METRIC_KEY[cur.k]), points: cur.series[0] }]}
        band={cur.band} unit={METRIC_UNIT[cur.k]} format={cur.k === 'weight' ? (v) => v.toFixed(1) : (v) => String(Math.round(v))}
        from={win.from} to={win.to} height={ph ? 150 : 170} legend={cur.k === 'bp'}
        ariaLabel={t('health.trendOf', { n: t(METRIC_KEY[cur.k]) })} empty={t('health.noInRange')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
        {cur.band ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 2, background: '#E3EFE6' }} />{t('profile.normalRange')}</span> : null}
        {cur.k !== 'weight' ? [dot('#7A5510', t('status.watch')), dot('#9A3D24', t('status.alert'))] : null}
      </div>
    </>
  ) : null;
  const allergies = (
    <>
      {[[t('profile.allergyFood'), food.map((label) => ({ icon: 'no_food', label, bg: '#F9E3DB', ic: '#9A3D24' }))], [t('profile.allergyDrug'), drugs.map((label) => ({ icon: 'medication', label, bg: '#F9E3DB', ic: '#9A3D24' }))]].map(([title, chips], i) => {
        const list = (chips as typeof none[]).length ? (chips as typeof none[]) : [none];
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{title as string}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{list.map(chip)}</div>
          </div>
        );
      })}
    </>
  );
  const mobility = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{mobDiet.map((a, i) => chip({ ...a, bg: '#F3EEE8', ic: '#24201C' }, i))}</div>
      {m.nanny ? <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('profile.nannyComes', { n: m.nanny.name })}</div> : null}
    </>
  );
  const conds = (
    <>
      {m.health.conditions.map((c, i) => item(i, 'clinical_notes', c, undefined, i === 0))}
      {item('cog', 'psychology', cogText(t, cog.summary), t('profile.cognitive'), !m.health.conditions.length)}
      {m.health.diabetic ? item('dia', 'water_drop', t('profile.diabetic')) : null}
    </>
  );
  const meds = (
    <>
      {m.health.meds.map((x, i) => item(x.id, 'medication', `${x.name} ${x.dose}`.trim(), timingLabel(t, x.timing), i === 0))}
      {!m.health.meds.length ? <div style={{ padding: ph ? '14px 0' : '4px 0 18px', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.noMeds')}</div> : null}
    </>
  );
  const listMeta = ranged ? readingsIn(paged.total, listWin) : t('profile.readingsTotal', { n: paged.total });
  // every reading, newest first, a small header at each new month; paged
  const valuesOf = (r: Reading) => [
    r.sys != null && r.dia != null ? `BP ${r.sys}/${r.dia}` : '',
    r.pulse != null ? `${t('health.pulse').toLowerCase()} ${r.pulse}` : '',
    r.spo2 ? `SpO₂ ${r.spo2}%` : '',
    r.temp ? `${r.temp} °C` : '',
    r.glucose != null ? `${t('health.glucose').toLowerCase()} ${r.glucose} mg/dL` : '',
    r.weight != null ? `${t('health.weight').toLowerCase()} ${r.weight} kg` : '',
    r.grip ? `${t('health.grip').toLowerCase()} ${r.grip} kg` : '',
  ].filter(Boolean).join(' · ');
  const readingRows = (
    <>
      {paged.rows.map((r, i) => {
        const mo = r.date.slice(0, 7);
        const newMonth = i === 0 || paged.rows[i - 1].date.slice(0, 7) !== mo;
        return (
          <div key={r.id} data-testid="history-reading">
            {newMonth ? <div style={{ padding: i === 0 ? '14px 0 2px' : '18px 0 2px', borderTop: i === 0 ? 'none' : HAIR, fontSize: 13, lineHeight: '18px', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 500, color: '#6B6259' }}>{fmt.fmonth(mo, true)}</div> : null}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 0', borderTop: i && !newMonth ? HAIR : 'none', minHeight: 60 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{valuesOf(r)}</span>
                <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t(KIND_KEY[r.kind])} · {r.date === today ? t('profile.todayLower') : fmt.fds(r.date)} {r.time}</span>
                {!p.family ? <PendingMark row={r} /> : null}
              </div>
              <StatusBadge kind={r.status} small />
            </div>
          </div>
        );
      })}
      {!paged.total ? <div style={{ padding: ph ? '14px 0' : '4px 0 20px', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{rs.length ? t('health.noInRange') : t('profile.noReadings')}</div> : null}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </>
  );
  // the member's limits: their own lines first (marked Own); the club's lines they follow sit behind a toggle (marked Club); nurse and management edit
  const own = ownLimitKeys(m);
  const clubKeys = LIMIT_ORDER.filter((k) => !own.includes(k));
  const writeLimits = !p.family && (p.role === 'nurse' || p.role === 'mgmt');
  const limRow = (k: LimitKey, mine: boolean, first: boolean) => {
    const l = L[k], cmp = LIMIT_CMP[k];
    const nums = [l.watch != null ? `${t('health.limW.' + cmp)} ${l.watch}` : '', l.alert != null ? `${t('health.limA.' + cmp)} ${l.alert}` : ''].filter(Boolean).join(' · ');
    return (
      <div key={k} data-limit={k} data-own={mine ? 'yes' : 'no'} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderTop: first ? 'none' : HAIR }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{t('health.lim.' + k)} <span style={{ color: '#6B6259', fontWeight: 400 }}>· {unitOf(k)}</span></span>
          <span style={{ fontSize: 14, color: mine ? '#24201C' : '#6B6259', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>{nums}</span>
        </div>
        {mine ? <span style={{ flex: 'none', padding: '1px 9px', borderRadius: 999, background: '#F3EEE8', color: '#75624B', fontSize: 12, fontWeight: 500, lineHeight: '18px' }}>{t('profile.limOwn')}</span>
          : <span style={{ flex: 'none', fontSize: 12, color: '#8A8078', lineHeight: '18px' }}>{t('profile.limClub')}</span>}
      </div>
    );
  };
  const clearOwnLimits = () => void p.act('health.setMemberLimits', { memberId: m.id, limits: null }, { ok: () => t('profile.limCleared', { n: memberShort(m) }) });
  const limitsBody = (
    <>
      {own.map((k, i) => limRow(k, true, i === 0))}
      {!own.length ? <div style={{ padding: '14px 0', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.limSameAsClub', { n: memberShort(m) })}</div> : null}
      <button type="button" aria-expanded={clubOpen} onClick={() => setClubOpen((o) => !o)} className="cp-tap-self cp-press"
        style={{ width: '100%', minHeight: 44, padding: 0, border: 'none', borderTop: HAIR, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontFamily: 'Inter', fontSize: 15, color: '#75624B', cursor: 'pointer', textAlign: 'left' }}>
        <span>{clubOpen ? t('profile.limHideClub') : t('profile.limShowClub', { n: clubKeys.length })}</span>
        <Icon name={clubOpen ? 'expand_less' : 'expand_more'} size={22} weight={300} color="#A89C8E" />
      </button>
      {clubOpen ? clubKeys.map((k) => limRow(k, false, false)) : null}
      {writeLimits ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '12px 0 14px', borderTop: HAIR }}>
          <Button variant="secondary" size={44} icon="tune" onClick={() => setLimSheet(true)}>{t('profile.limEdit')}</Button>
          {own.length ? <Button variant="ghost" size={44} onClick={clearOwnLimits}>{t('profile.limUseClub')}</Button> : null}
        </div>
      ) : null}
    </>
  );
  const limitsTitle = t('profile.limitsFor', { n: memberShort(m) });
  const limits = !p.family ? (
    <>
      <ListCard phone={ph} title={limitsTitle}>{limitsBody}</ListCard>
      {writeLimits ? <LimitsSheet open={limSheet} onClose={() => setLimSheet(false)} member={m} /> : null}
    </>
  ) : null;
  const careBody = (
    <>
      <div style={{ fontSize: 15, lineHeight: '23px', whiteSpace: 'pre-line' }}>{m.care.instructions || t('profile.noCareInstructions')}</div>
      {m.care.instructions ? <div style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.updatedBy', { n: actorName(s, m.care.by), w: whenText(fmt.fds, today, m.care.at, t) })}</div> : null}
    </>
  );
  if (ph) return (
    <>
      <PendingBanner p={p} tab="health" />
      <Group>{tilesGrid}</Group>
      {cur ? <Group title={t('profile.trendTitle')} meta={trendMeta} gap={12}>{trendBody}</Group> : null}
      <Group title={t('profile.allergies')} gap={12}>{allergies}</Group>
      <Group title={t('profile.mobilityDiet')} gap={12}>{mobility}</Group>
      <Group title={t('profile.conditions')} pad="0 16px" gap={0}>{conds}</Group>
      <Group title={t('profile.medicines')} pad="0 16px" gap={0}>{meds}</Group>
      {limits}
      <Group title={t('profile.recentReadings')} meta={listMeta} pad="0 16px" gap={0}>{readingRows}</Group>
      {!p.family ? <Group title={t('profile.careInstructions')} meta={<StaffOnlyTag />} gap={8}>{careBody}</Group> : null}
    </>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 2.8vw, 28px)' }}>
      <PendingBanner p={p} tab="health" />
      <div style={{ ...cardStyle, gap: 22 }}>
        {tilesGrid}
        {cur ? (
          <Block title={t('profile.trendTitle')} meta={trendMeta} gap={12}>
            {trendBody}
          </Block>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 3vw, 36px)', alignItems: 'flex-start' }}>
        <div style={{ ...cardStyle, flex: '1 1 340px', minWidth: 0, gap: 18 }}>
          <Block first title={t('profile.allergies')} gap={12}>
            {allergies}
          </Block>
          <Block title={t('profile.mobilityDiet')} gap={12}>
            {mobility}
          </Block>
        </div>
        <div style={{ ...listCardStyle, flex: '1 1 340px', minWidth: 0 }}>
          <ListHead title={t('profile.conditions')} />
          {conds}
          <ListHead title={t('profile.medicines')} />
          {meds}
        </div>
      </div>
      {limits}
      <div style={listCardStyle}>
        <ListHead title={t('profile.recentReadings')} meta={listMeta} />
        {readingRows}
      </div>
      {!p.family ? (
        <div style={{ background: '#F3EEE8', borderRadius: 16, padding: `18px ${CARD_PX}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Icon name="lock" size={19} color="#75624B" />
            <span style={{ fontWeight: 500, fontSize: 16 }}>{t('profile.careInstructions')}</span>
            <StaffOnlyTag />
          </div>
          {careBody}
        </div>
      ) : null}
    </div>
  );
}
