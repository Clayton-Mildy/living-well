// Overview tab (design ScrProfile overview): condition summary, today, plan usage (Flex counts visits; Gold is unlimited), latest note from the
// team, plus the personal details (with the answers of the paper application form). The club is drop-in, so nothing here is booked or expected.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtPhone, live, memberAge, memberName, memberSince, sortBy, staffCall, flexMonth, planOn, todayReading, ym, type DailyLog, type Member } from '@cp/shared';
import { lunchLabelKey } from '@cp/shared/rules/activity';
import { logForFamily, readingForFamily } from '@cp/shared/rules/approvals';
import { Group, Icon, SectionLabel } from '../../../components/ui';
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
  const lg = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && l.status === 'saved').map((l) => (p.family ? logForFamily(l) : l)).filter((l): l is DailyLog => !!l && l.mood !== undefined), (l) => l.date, -1)[0]; // the latest Mood & notes round
  const spouse: Member | undefined = m.spouseId ? s.members[m.spouseId] : undefined;
  const since = memberSince(m);
  const age = memberAge(m, today);
  const showClinical = p.role !== 'finance';
  const reg = m.registration;
  const yn = (v: boolean | undefined) => (v === undefined ? '' : v ? t('common.yes') : t('common.no'));
  const careQs = ([['q.commShort', reg?.commDifficulty], ['q.selfShort', reg?.selfCare], ['q.bathShort', reg?.bathroomHelp]] as const).filter(([, v]) => v !== undefined);
  const ids = (['guarantor', 'member', 'carer'] as const).filter((k) => reg?.ids?.[k]).map((k) => t('profile.ids.' + k));
  const place = [reg?.rtRw ? `${t('profile.f.rtRw')} ${reg.rtRw}` : '', reg?.city, reg?.postcode].filter(Boolean).join(' · ');
  const phones = [reg?.mobile, reg?.phone].filter(Boolean).join(' · ');

  // the sections once, laid out as Blocks in one card (tablet, laptop) or as iOS grouped sections (round 6, staff on a phone)
  const sections: { key: string; title: ReactNode; meta?: ReactNode; body: ReactNode }[] = [];
  if (showClinical) sections.push({ key: 'cond', title: t('profile.conditionSummary'), body: (
    <>
      <p style={{ margin: 0, fontSize: 15, lineHeight: '23px', textWrap: 'pretty' }}>{summary}</p>
      <Chips32 chips={flagChips(t, m, true)} />
    </>
  ) });
  sections.push({ key: 'today', title: t('common.today'), body: (
    <>
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
    </>
  ) });
  sections.push({ key: 'plan', title: plan === 'flex' ? t('profile.planLabelFlex', { m: fmt.fmonth(month) }) : t('profile.planLabelGold', { m: fmt.fmonth(month) }), body: (
    <>
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
    </>
  ) });
  if (lg) sections.push({ key: 'team', title: t('profile.fromTeam'), meta: `${staffCall(s.staff[lg.by]) || t('profile.theTeam')} · ${fmt.fds(lg.date)}`, body: (
    <>
      <Quote>{logNote(s, t, p.lang, m, lg)}</Quote>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 14, color: '#6B6259' }}>
        {([['sentiment_satisfied', lg.mood ? t('family.mood_' + lg.mood) : ''], ['restaurant', lg.lunch ? t(lunchLabelKey(lg.lunch)) : '']] as const).filter(([, label]) => label).map(([icon, label]) => (
          <span key={icon} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
            <Icon name={icon} size={18} color="#75624B" />
            {label}
          </span>
        ))}
      </div>
    </>
  ) });
  const facts = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Fact k={t('profile.f.dob')} first>{m.dob ? `${fmt.fdy(m.dob)}${age != null ? ` · ${t('profile.years', { n: age })}` : ''}` : age != null ? t('profile.years', { n: age }) : t('common.notSet')}</Fact>
      {reg?.nickname ? <Fact k={t('profile.f.knownAs')}>{reg.nickname}</Fact> : null}
      {reg?.marital ? <Fact k={t('profile.f.marital')}>{t('profile.marital.' + reg.marital)}</Fact> : null}
      <Fact k={t('profile.f.address')}>{m.address || t('common.notSet')}</Fact>
      {place ? <Fact k={t('profile.f.area')}>{place}</Fact> : null}
      {phones ? <Fact k={t('profile.f.phones')}>{phones}</Fact> : null}
      {reg?.email ? <Fact k={t('profile.f.email')}>{reg.email}</Fact> : null}
      <Fact k={t('profile.f.usual')}>{m.usualArrival || t('common.notSet')}</Fact>
      <Fact k={t('profile.f.nanny')}>{m.nanny ? `${m.nanny.name}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}` : t('profile.noNanny')}</Fact>
      <Fact k={t('profile.f.spouse')}>
        {spouse && !spouse.deletedAt && !p.family ? (
          <button type="button" onClick={() => navigate(`/members/${spouse.id}`)} style={{ ...linkBtn, fontSize: 15, minHeight: 28 }}>{memberName(spouse)}</button>
        ) : spouse ? memberName(spouse) : t('profile.noSpouse')}
      </Fact>
      <Fact k={t('profile.since')}>{since ? fmt.fmonth(ym(since), true) : '—'}</Fact>
      {!p.family && careQs.length ? <Fact k={t('profile.sec.regCare')}>{careQs.map(([k, v]) => <span key={k} style={{ display: 'block' }}>{t('profile.' + k)} · {yn(v)}</span>)}</Fact> : null}
      {!p.family && reg?.dementiaNote ? <Fact k={t('profile.f.dementiaShort')}>{reg.dementiaNote}</Fact> : null}
      {!p.family && ids.length ? <Fact k={t('profile.f.idsShort')}>{ids.join(', ')}</Fact> : null}
      {!p.family && !reg ? <Fact k={t('profile.f.regForm')}>{t('profile.regNone')}</Fact> : null}
    </div>
  );

  if (p.isPhone) { // round 6, phone: staff and the family's Health alike
    return (
      <>
        <PendingBanner p={p} tab="overview" />
        {sections.map((x) => <Group key={x.key} title={x.title} meta={x.meta}>{x.body}</Group>)}
        <Group title={t('profile.personal')} pad="0 16px" gap={0}>{facts}</Group>
      </>
    );
  }
  return (
    <>
      <PendingBanner p={p} tab="overview" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 3vw, 36px)', alignItems: 'flex-start' }}>
        <div style={{ ...cardStyle, flex: '1 1 440px', minWidth: 0, gap: 18 }}>
          {sections.map((x, i) => <Block key={x.key} first={i === 0} title={x.title} meta={x.meta}>{x.body}</Block>)}
        </div>
        <div style={{ ...cardStyle, flex: '0 1 340px', minWidth: 0, gap: 4 }}>
          <SectionLabel>{t('profile.personal')}</SectionLabel>
          {facts}
        </div>
      </div>
    </>
  );
}
