// Overview tab (design ScrProfile overview): condition summary, today, plan usage (Flex counts visits; Gold is unlimited), latest note from the
// team, plus the personal details. The club is drop-in, so nothing here is booked or expected.
import { useNavigate } from 'react-router-dom';
import { fmtPhone, live, memberAge, memberName, memberSince, sortBy, staffCall, flexMonth, planOn, todayReading, ym, type DailyLog, type Member } from '@cp/shared';
import { logForFamily, readingForFamily } from '@cp/shared/rules/approvals';
import { Icon, SectionLabel } from '../../../components/ui';
import { cardStyle, cogText, flagChips, linkBtn, mobLabel, dietLabel, logNote, STATUS_STYLE, statusText } from '../lib';
import { StatusBadge } from '../../../components/ui';
import { Block, Chips32, Fact, PendingBanner, Quote } from './parts';
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
  const ar0 = todayReading(s, m.id, today, 'arrival');
  const ar = ar0 && (p.family ? readingForFamily(ar0) ?? undefined : ar0); // a reading waiting for approval is for staff only
  const att = s.attendance[`${today}:${m.id}`];
  const healthLine = ar
    ? t('profile.arrivalLine', { t: ar.time, b: `${ar.sys}/${ar.dia}`, o: ar.spo2 ?? '—' }) + (ar.temp ? ` · ${ar.temp} °C` : '')
    : att?.checkIn ? t('profile.arrivalWaiting') : t('profile.noCheckToday');
  const lg = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && l.status === 'saved').map((l) => (p.family ? logForFamily(l) : l)).filter((l): l is DailyLog => !!l), (l) => l.date, -1)[0];
  const spouse: Member | undefined = m.spouseId ? s.members[m.spouseId] : undefined;
  const since = memberSince(m);
  const age = memberAge(m, today);
  const showClinical = p.role !== 'finance';

  return (
    <>
      <PendingBanner p={p} tab="overview" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 3vw, 36px)', alignItems: 'flex-start' }}>
        <div style={{ ...cardStyle, flex: '1 1 440px', minWidth: 0, gap: 18 }}>
          {showClinical ? (
            <Block first title={t('profile.conditionSummary')}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '23px', textWrap: 'pretty' }}>{summary}</p>
              <Chips32 chips={flagChips(t, m, true)} />
            </Block>
          ) : null}
          <Block first={!showClinical} title={t('common.today')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 17, fontWeight: 500, lineHeight: '24px' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flex: 'none', marginTop: 8 }} />
              <span style={{ minWidth: 0 }}>{statusText(t, p.st, fmt.fds)}</span>
            </div>
            {showClinical ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, lineHeight: '21px', color: '#6B6259', flex: '1 1 200px' }}>{healthLine}</span>
                {ar ? <StatusBadge kind={ar.status} small /> : null}
              </div>
            ) : null}
          </Block>
          <Block title={plan === 'flex' ? t('profile.planLabelFlex', { m: fmt.fmonth(month) }) : t('profile.planLabelGold', { m: fmt.fmonth(month) })}>
            <div style={{ fontSize: 24, lineHeight: '32px', letterSpacing: '-0.5px', color: '#2B231C' }}>
              {plan === 'flex' ? t('profile.visitsUsed', { n: used, q: quota }) : t('profile.visitsSoFar', { n: used })}
            </div>
            {plan === 'flex' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segN},minmax(0,1fr))`, gap: 4 }} role="img" aria-label={t('profile.visitsUsed', { n: used, q: quota })}>
                {segs.map((k, i) => (
                  <span key={i} style={{ height: 8, borderRadius: 999, background: k === 'used' ? '#75624B' : '#F0EAE1' }} />
                ))}
              </div>
            ) : null}
            {/* the number is enough (KC): the visits left, price and billing details live on the Attendance and Plan tabs */}
            {plan === 'flex' && fm.extra ? <div style={{ fontSize: 14, color: '#9A3D24', fontWeight: 500, lineHeight: 1.4 }}>{t('profile.extraShort', { n: fm.extra })}</div> : null}
          </Block>
          {lg ? (
            <Block title={t('profile.fromTeam')} meta={`${staffCall(s.staff[lg.by]) || t('profile.theTeam')} · ${fmt.fds(lg.date)}`}>
              <Quote>{logNote(s, t, p.lang, m, lg)}</Quote>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 14, color: '#6B6259' }}>
                {[['sentiment_satisfied', t('family.mood_' + lg.mood)], ['restaurant', t('family.lunch_' + lg.lunch)]].map(([icon, label]) => (
                  <span key={icon} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
                    <Icon name={icon} size={18} color="#75624B" />
                    {label}
                  </span>
                ))}
              </div>
            </Block>
          ) : null}
        </div>
        <div style={{ ...cardStyle, flex: '0 1 340px', minWidth: 0, gap: 4 }}>
          <SectionLabel>{t('profile.personal')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Fact k={t('profile.f.dob')} first>{m.dob ? `${fmt.fdy(m.dob)}${age != null ? ` · ${t('profile.years', { n: age })}` : ''}` : age != null ? t('profile.years', { n: age }) : t('common.notSet')}</Fact>
            <Fact k={t('profile.f.address')}>{m.address || t('common.notSet')}</Fact>
            <Fact k={t('profile.f.usual')}>{m.usualArrival || t('common.notSet')}</Fact>
            <Fact k={t('profile.f.nanny')}>{m.nanny ? `${m.nanny.name}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}` : t('profile.noNanny')}</Fact>
            <Fact k={t('profile.f.spouse')}>
              {spouse && !spouse.deletedAt && !p.family ? (
                <button type="button" onClick={() => navigate(`/members/${spouse.id}`)} style={{ ...linkBtn, fontSize: 15, minHeight: 28 }}>{memberName(spouse)}</button>
              ) : spouse ? memberName(spouse) : t('profile.noSpouse')}
            </Fact>
            <Fact k={t('profile.since')}>{since ? fmt.fmonth(ym(since), true) : '—'}</Fact>
          </div>
        </div>
      </div>
    </>
  );
}
