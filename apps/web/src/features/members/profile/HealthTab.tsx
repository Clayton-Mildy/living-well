// Health tab (design ScrProfile health): latest readings, systolic trend, conditions, medicines, allergies, mobility and diet,
// recent readings and the staff-only care instructions.
import { actorName, bpStatus, gluStatus, limitsOf, pulseStatus, readingsOf, spo2Status, tempStatus, type Health, type Reading } from '@cp/shared';
import { FONT_BODY, FONT_SMALL, Icon, SectionLabel, StaffOnlyTag, StatusBadge } from '../../../components/ui';
import { cardStyle, cogText, dietLabel, drugLabel, foodList, listCardStyle, MOB_ICON, mobLabel, timingLabel, whenText } from '../lib';
import { ListHead, PendingBanner } from './parts';
import type { P } from './types';

const KIND_KEY: Record<Reading['kind'], string> = { arrival: 'health.arrivalCheck', departure: 'health.departureCheck', recheck: 'health.recheckL', spot: 'health.spotCheck', monthly: 'profile.monthlyCheck' };

export function HealthTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const rs = readingsOf(s, m.id);
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
  const none = { icon: 'check', label: t('profile.noneKnown'), bg: '#F4F0EE', ic: '#282828' };
  const recent = rs.slice(-8).reverse();
  const cog = m.health.cognitive;
  const meta = (k: string) => <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{k}</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PendingBanner p={p} tab="health" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {tiles.map((v, i) => (
          <div key={i} style={{ padding: '14px 16px', borderRadius: 20, background: '#FFFFFF', border: '1px solid #DBD7D6', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: FONT_SMALL, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' }}>{v.label}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, lineHeight: '36px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{v.value}</span>
              <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{v.unit}</span>
            </span>
            <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{v.date}</span>
            {v.badge ? <span style={{ alignSelf: 'flex-start' }}><StatusBadge kind={v.badge} small /></span> : null}
          </div>
        ))}
      </div>
      {hist.length > 1 ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <SectionLabel>{t('profile.trendTitle')}</SectionLabel>
            {meta(t('profile.trendRange', { n: hist.length, d: fmt.fds(hist[0].date) }))}
          </div>
          <svg viewBox="0 0 600 120" role="img" aria-label={t('profile.trendTitle')} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <rect x="0" y={bandY.toFixed(1)} width="600" height={bandH.toFixed(1)} style={{ fill: '#E6EFE8' }} />
            <path d={line} style={{ fill: 'none', stroke: '#75624B', strokeWidth: 2 }} />
            <path d={dots} style={{ fill: '#75624B' }} />
            <path d={hot} style={{ fill: '#AF4B2F' }} />
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: FONT_BODY, lineHeight: 1.4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, background: '#E6EFE8' }} />{t('profile.normalRange')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#AF4B2F' }} />{t('profile.hotRange')}</span>
          </div>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16, alignItems: 'start' }}>
        <div style={listCardStyle}>
          <ListHead title={t('profile.conditions')} />
          {m.health.conditions.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
              <Icon name="clinical_notes" size={20} color="#75624B" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{c}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.conditionSource')}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
            <Icon name="psychology" size={20} color="#75624B" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{cogText(t, cog.summary)}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.cognitive')}</span>
            </div>
          </div>
          {m.health.diabetic ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
              <Icon name="water_drop" size={20} color="#75624B" />
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('profile.diabetic')}</span>
            </div>
          ) : null}
        </div>
        <div style={listCardStyle}>
          <ListHead title={t('profile.medicines')} />
          {m.health.meds.map((x) => (
            <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
              <Icon name="medication" size={20} color="#75624B" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{`${x.name} ${x.dose}`.trim()}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{timingLabel(t, x.timing)}</span>
              </div>
            </div>
          ))}
          {!m.health.meds.length ? <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noMeds')}</div> : null}
        </div>
        <div style={{ ...cardStyle, padding: '16px 20px 20px' }}>
          <SectionLabel>{t('profile.allergies')}</SectionLabel>
          {[[t('profile.allergyFood'), food.map((label) => ({ icon: 'no_food', label, bg: '#F7E4DD', ic: '#AF4B2F' }))], [t('profile.allergyDrug'), drugs.map((label) => ({ icon: 'medication', label, bg: '#F7E4DD', ic: '#AF4B2F' }))]].map(([title, chips], i) => {
            const list = (chips as typeof none[]).length ? (chips as typeof none[]) : [none];
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{title as string}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {list.map((a, j) => (
                    <span key={j} style={{ minHeight: 32, maxWidth: '100%', padding: '4px 12px', borderRadius: 999, background: a.bg, fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
                      <Icon name={a.icon} size={18} color={a.ic} />
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ ...cardStyle, padding: '16px 20px 20px' }}>
          <SectionLabel>{t('profile.mobilityDiet')}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[{ icon: m.health.mobility ? MOB_ICON[m.health.mobility] : 'directions_walk', label: mobLabel(t, m.health.mobility) }, ...m.health.diet.map((d) => ({ icon: 'restaurant', label: dietLabel(t, d) })), ...(m.health.diabetic ? [{ icon: 'water_drop', label: t('profile.diabetic') }] : [])].map((a, i) => (
              <span key={i} style={{ minHeight: 32, maxWidth: '100%', padding: '4px 12px', borderRadius: 999, background: '#E8E1D8', fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
                <Icon name={a.icon} size={18} />
                {a.label}
              </span>
            ))}
          </div>
          {m.nanny ? <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{t('profile.nannyComes', { n: m.nanny.name })}</div> : null}
        </div>
      </div>
      <div style={listCardStyle}>
        <ListHead title={t('profile.recentReadings')} />
        {recent.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 60 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
                {r.kind === 'monthly' || r.sys == null
                  ? [r.glucose != null ? `${t('health.glucose')} ${r.glucose} mg/dL` : '', r.weight != null ? `${t('health.weight').toLowerCase()} ${r.weight} kg` : '', r.grip ? `${t('health.grip').toLowerCase()} ${r.grip} kg` : ''].filter(Boolean).join(' · ')
                  : `BP ${r.sys}/${r.dia} · ${t('health.pulse').toLowerCase()} ${r.pulse}${r.spo2 ? ` · SpO₂ ${r.spo2}%` : ''}${r.temp ? ` · ${r.temp} °C` : ''}`}
              </span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t(KIND_KEY[r.kind])} · {r.date === today ? t('profile.todayLower') : fmt.fds(r.date)} {r.time}</span>
            </div>
            <StatusBadge kind={r.status} small />
          </div>
        ))}
        {!recent.length ? <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noReadings')}</div> : null}
      </div>
      {!p.family ? (
        <div style={{ ...cardStyle, background: '#F4F0EE', border: 'none', borderRadius: 18, padding: '14px 16px', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Icon name="lock" size={20} color="#75624B" />
            <strong style={{ fontWeight: 600, fontSize: 16 }}>{t('profile.careInstructions')}</strong>
            <StaffOnlyTag />
          </div>
          <div style={{ fontSize: 16, lineHeight: '22px', whiteSpace: 'pre-line' }}>{m.care.instructions || t('profile.noCareInstructions')}</div>
          {m.care.instructions ? <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.updatedBy', { n: actorName(s, m.care.by), w: whenText(fmt.fds, today, m.care.at, t) })}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
