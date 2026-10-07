// Health tab (design ScrProfile health): latest readings, systolic trend, conditions, medicines, allergies, mobility and diet,
// recent readings and the staff-only care instructions.
import { actorName, bpStatus, gluStatus, limitsOf, pulseStatus, readingsOf, spo2Status, tempStatus, type Health, type Reading } from '@cp/shared';
import { FONT_BODY, Icon, StaffOnlyTag, StatusBadge } from '../../../components/ui';
import { CARD_PX, cardStyle, cogText, dietLabel, drugLabel, foodList, HAIR, listCardStyle, MOB_ICON, mobLabel, timingLabel, whenText } from '../lib';
import { readingForFamily } from '@cp/shared/rules/approvals';
import { PendingMark } from '../../../components/PendingMark';
import { Block, ListHead, PendingBanner } from './parts';
import type { P } from './types';

const KIND_KEY: Record<Reading['kind'], string> = { arrival: 'health.arrivalCheck', departure: 'health.departureCheck', recheck: 'health.recheckL', spot: 'health.spotCheck', monthly: 'profile.monthlyCheck' };

export function HealthTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const rs = readingsOf(s, m.id).map((r) => (p.family ? readingForFamily(r) : r)).filter((r): r is Reading => !!r); // a reading waiting for approval is for staff only
  const L = limitsOf(s);
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
  // systolic on arrival (design: bands 100–139 normal)
  const hist = rs.filter((r) => r.kind === 'arrival' && r.sys != null);
  const y = (v: number) => Math.max(6, Math.min(114, 114 - ((v - 90) / 90) * 108));
  const xs = (i: number) => (hist.length > 1 ? 12 + i * (576 / (hist.length - 1)) : 300);
  const circle = (cx: number, cy: number) => `M${(cx - 4).toFixed(1)} ${cy.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`;
  const line = hist.map((r, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${y(r.sys!).toFixed(1)}`).join(' ');
  const dots = hist.map((r, i) => (r.sys! < 140 ? circle(xs(i), y(r.sys!)) : '')).join('');
  const hot = hist.map((r, i) => (r.sys! >= 140 ? circle(xs(i), y(r.sys!)) : '')).join('');
  const bandY = y(139), bandH = y(100) - y(139);
  const food = foodList(t, m);
  const drugs = m.health.drugs.map((d) => drugLabel(t, d));
  const none = { icon: 'check', label: t('profile.noneKnown'), bg: '#F3EEE8', ic: '#24201C' };
  const recent = rs.slice(-8).reverse();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 2.8vw, 28px)' }}>
      <PendingBanner p={p} tab="health" />
      <div style={{ ...cardStyle, gap: 22 }}>
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
        {hist.length > 1 ? (
          <Block title={t('profile.trendTitle')} meta={t('profile.trendRange', { n: hist.length, d: fmt.fds(hist[0].date) })} gap={12}>
            <svg viewBox="0 0 600 120" role="img" aria-label={t('profile.trendTitle')} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <rect x="0" y={bandY.toFixed(1)} width="600" height={bandH.toFixed(1)} style={{ fill: '#E3EFE6' }} />
              <path d={line} style={{ fill: 'none', stroke: '#75624B', strokeWidth: 2 }} />
              <path d={dots} style={{ fill: '#75624B' }} />
              <path d={hot} style={{ fill: '#9A3D24' }} />
            </svg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, background: '#E3EFE6' }} />{t('profile.normalRange')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#9A3D24' }} />{t('profile.hotRange')}</span>
            </div>
          </Block>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 3vw, 36px)', alignItems: 'flex-start' }}>
        <div style={{ ...cardStyle, flex: '1 1 340px', minWidth: 0, gap: 18 }}>
          <Block first title={t('profile.allergies')} gap={12}>
            {[[t('profile.allergyFood'), food.map((label) => ({ icon: 'no_food', label, bg: '#F9E3DB', ic: '#9A3D24' }))], [t('profile.allergyDrug'), drugs.map((label) => ({ icon: 'medication', label, bg: '#F9E3DB', ic: '#9A3D24' }))]].map(([title, chips], i) => {
              const list = (chips as typeof none[]).length ? (chips as typeof none[]) : [none];
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{title as string}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{list.map(chip)}</div>
                </div>
              );
            })}
          </Block>
          <Block title={t('profile.mobilityDiet')} gap={12}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{mobDiet.map((a, i) => chip({ ...a, bg: '#F3EEE8', ic: '#24201C' }, i))}</div>
            {m.nanny ? <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('profile.nannyComes', { n: m.nanny.name })}</div> : null}
          </Block>
        </div>
        <div style={{ ...listCardStyle, flex: '1 1 340px', minWidth: 0 }}>
          <ListHead title={t('profile.conditions')} />
          {m.health.conditions.map((c, i) => item(i, 'clinical_notes', c, undefined, i === 0))}
          {item('cog', 'psychology', cogText(t, cog.summary), t('profile.cognitive'), !m.health.conditions.length)}
          {m.health.diabetic ? item('dia', 'water_drop', t('profile.diabetic')) : null}
          <ListHead title={t('profile.medicines')} />
          {m.health.meds.map((x, i) => item(x.id, 'medication', `${x.name} ${x.dose}`.trim(), timingLabel(t, x.timing), i === 0))}
          {!m.health.meds.length ? <div style={{ padding: '4px 0 18px', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.noMeds')}</div> : null}
        </div>
      </div>
      <div style={listCardStyle}>
        <ListHead title={t('profile.recentReadings')} />
        {recent.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 0', borderTop: i ? HAIR : 'none', minHeight: 60 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
                {r.kind === 'monthly' || r.sys == null
                  ? [r.glucose != null ? `${t('health.glucose')} ${r.glucose} mg/dL` : '', r.weight != null ? `${t('health.weight').toLowerCase()} ${r.weight} kg` : '', r.grip ? `${t('health.grip').toLowerCase()} ${r.grip} kg` : ''].filter(Boolean).join(' · ')
                  : `BP ${r.sys}/${r.dia} · ${t('health.pulse').toLowerCase()} ${r.pulse}${r.spo2 ? ` · SpO₂ ${r.spo2}%` : ''}${r.temp ? ` · ${r.temp} °C` : ''}`}
              </span>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t(KIND_KEY[r.kind])} · {r.date === today ? t('profile.todayLower') : fmt.fds(r.date)} {r.time}</span>
              {!p.family ? <PendingMark row={r} /> : null}
            </div>
            <StatusBadge kind={r.status} small />
          </div>
        ))}
        {!recent.length ? <div style={{ padding: '4px 0 20px', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.noReadings')}</div> : null}
      </div>
      {!p.family ? (
        <div style={{ background: '#F3EEE8', borderRadius: 16, padding: `18px ${CARD_PX}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Icon name="lock" size={19} color="#75624B" />
            <span style={{ fontWeight: 500, fontSize: 16 }}>{t('profile.careInstructions')}</span>
            <StaffOnlyTag />
          </div>
          <div style={{ fontSize: 15, lineHeight: '23px', whiteSpace: 'pre-line' }}>{m.care.instructions || t('profile.noCareInstructions')}</div>
          {m.care.instructions ? <div style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.updatedBy', { n: actorName(s, m.care.by), w: whenText(fmt.fds, today, m.care.at, t) })}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
