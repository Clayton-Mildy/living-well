// Overview tab (design ScrProfile overview): condition summary, today, plan usage (Flex counts visits; Gold is unlimited), latest note from the
// team, plus the personal details. The club is drop-in, so nothing here is booked or expected.
import { useNavigate } from 'react-router-dom';
import { fmtPhone, live, memberAge, memberName, memberSince, sortBy, staffCall, flexMonth, planOn, todayReading, ym, type Member } from '@cp/shared';
import { FONT_BODY, Icon, SectionLabel } from '../../../components/ui';
import { cardStyle, cogText, flagChips, mobLabel, dietLabel, logNote, STATUS_STYLE, statusText } from '../lib';
import { StatusBadge } from '../../../components/ui';
import { Chips32, Fact, PendingBanner } from './parts';
import type { P } from './types';

export function OverviewTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const navigate = useNavigate();
  const month = ym(today);
  const st = STATUS_STYLE[p.st.key];
  const plan = planOn(m, today).plan;
  const fm = flexMonth(s, m, month, today);
  const quota = fm.quota ?? 0;
  const used = plan === 'flex' ? Math.min(fm.used, quota) : fm.used; // visits beyond the quota are the extra days, shown below
  const segN = Math.max(1, Math.min(31, quota));
  const segs = Array.from({ length: segN }, (_, i) => (i < used ? 'used' : 'free'));
  const conds = m.health.conditions.length ? m.health.conditions.join(', ') : t('profile.noConditions');
  const cog = cogText(t, m.health.cognitive.summary);
  const summary = [
    conds + '.',
    cog + '.',
    m.health.mobility ? t('profile.usesAid', { a: mobLabel(t, m.health.mobility).toLowerCase() }) : '',
    m.health.diet.length ? t('profile.dietSentence', { d: m.health.diet.map((d) => dietLabel(t, d).toLowerCase()).join(', ') }) : '',
  ].filter(Boolean).join(' ');
  const ar = todayReading(s, m.id, today, 'arrival');
  const att = s.attendance[`${today}:${m.id}`];
  const healthLine = ar
    ? t('profile.arrivalLine', { t: ar.time, b: `${ar.sys}/${ar.dia}`, o: ar.spo2 ?? '—' }) + (ar.temp ? ` · ${ar.temp} °C` : '')
    : att?.checkIn ? t('profile.arrivalWaiting') : t('profile.noCheckToday');
  const lg = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && l.status === 'saved'), (l) => l.date, -1)[0];
  const spouse: Member | undefined = m.spouseId ? s.members[m.spouseId] : undefined;
  const since = memberSince(m);
  const age = memberAge(m, today);
  const showClinical = p.role !== 'finance';

  return (
    <>
      <PendingBanner p={p} tab="overview" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16, alignItems: 'start' }}>
        {showClinical ? (
          <div style={cardStyle}>
            <SectionLabel>{t('profile.conditionSummary')}</SectionLabel>
            <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', textWrap: 'pretty' }}>{summary}</p>
            <Chips32 chips={flagChips(t, m, true)} />
          </div>
        ) : null}
        <div style={cardStyle}>
          <SectionLabel>{t('common.today')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: st.bg }}>
            <Icon name={st.icon} size={24} color={st.fg} fill={1} />
            <span style={{ fontSize: 16, fontWeight: 600, color: st.fg, lineHeight: 1.4 }}>{statusText(t, p.st, fmt.fds)}</span>
          </div>
          {showClinical ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, lineHeight: '22px', flex: '1 1 200px' }}>{healthLine}</span>
              {ar ? <StatusBadge kind={ar.status} small /> : null}
            </div>
          ) : null}
        </div>
        <div style={cardStyle}>
          <SectionLabel>{plan === 'flex' ? t('profile.planLabelFlex', { m: fmt.fmonth(month) }) : t('profile.planLabelGold', { m: fmt.fmonth(month) })}</SectionLabel>
          <div style={{ fontSize: 24, lineHeight: '32px', letterSpacing: '-0.5px', color: '#9A836C' }}>
            {plan === 'flex' ? t('profile.visitsUsed', { n: used, q: quota }) : t('profile.visitsSoFar', { n: used })}
          </div>
          {plan === 'flex' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segN},minmax(0,1fr))`, gap: 4 }} role="img" aria-label={t('profile.visitsUsed', { n: used, q: quota })}>
                {segs.map((k, i) => (
                  <span key={i} style={{ height: 12, borderRadius: 999, background: k === 'used' ? '#75624B' : '#EFECEA' }} />
                ))}
              </div>
            </>
          ) : null}
          {/* the number is enough (KC): the visits left, price and billing details live on the Attendance and Plan tabs */}
          {plan === 'flex' && fm.extra ? <div style={{ fontSize: FONT_BODY, color: '#AF4B2F', fontWeight: 500, lineHeight: 1.4 }}>{t('profile.extraShort', { n: fm.extra })}</div> : null}
        </div>
        {lg ? (
          <div style={cardStyle}>
            <SectionLabel>{t('profile.fromTeam')}</SectionLabel>
            <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{staffCall(s.staff[lg.by]) || t('profile.theTeam')} · {fmt.fds(lg.date)}</div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', textWrap: 'pretty' }}>{logNote(s, t, p.lang, m, lg)}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[['sentiment_satisfied', t('family.mood_' + lg.mood)], ['restaurant', t('family.lunch_' + lg.lunch)]].map(([icon, label]) => (
                <span key={icon} style={{ minHeight: 32, maxWidth: '100%', padding: '4px 12px', borderRadius: 999, background: '#F4F0EE', fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
                  <Icon name={icon} size={18} color="#75624B" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div style={cardStyle}>
          <SectionLabel>{t('profile.personal')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Fact k={t('profile.f.dob')} first>{m.dob ? `${fmt.fdy(m.dob)}${age != null ? ` · ${t('profile.years', { n: age })}` : ''}` : age != null ? t('profile.years', { n: age }) : t('common.notSet')}</Fact>
            <Fact k={t('profile.f.address')}>{m.address || t('common.notSet')}</Fact>
            <Fact k={t('profile.f.usual')}>{m.usualArrival || t('common.notSet')}</Fact>
            <Fact k={t('profile.f.nanny')}>{m.nanny ? `${m.nanny.name}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}` : t('profile.noNanny')}</Fact>
            <Fact k={t('profile.f.spouse')}>
              {spouse && !spouse.deletedAt && !p.family ? (
                <button type="button" onClick={() => navigate(`/members/${spouse.id}`)} style={{ border: 'none', background: 'transparent', padding: 0, color: '#75624B', textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 16, cursor: 'pointer', fontFamily: 'Inter', minHeight: 44 }}>{memberName(spouse)}</button>
              ) : spouse ? memberName(spouse) : t('profile.noSpouse')}
            </Fact>
            <Fact k={t('profile.since')}>{since ? fmt.fmonth(ym(since), true) : '—'}</Fact>
          </div>
        </div>
      </div>
    </>
  );
}
