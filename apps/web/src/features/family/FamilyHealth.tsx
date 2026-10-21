// Round 8 (the Family App prototype): the Health tab. One parent at a time (round 11: the shared parent switch at the top right when there are several, no
// "both"; the chosen parent's name under the title): the latest blood pressure on a card tinted by its grade, four small tiles, and the way to the health history and the profile.
// Round 8c, on a laptop (the prototype's desktop): the parents are name chips beside the title (they also say whose health this is); the left column (360px) holds
// the card, the four tiles and the way to the profile, the right one the History inline (measurement chips, range, average, chart, readings in two columns:
// health/HistoryBody). A tile or the card picks the measurement there; "Open full page" goes to the History page.
// A family sees approved readings only, graded against the parent's own limits first, then the club's.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { daysBetween, limitsFor, memberName, displayName, staffCall, type Health, type Reading } from '@cp/shared';
import { healthMemberOf } from '@cp/shared/rules/family';
import { TILE_METRICS, bpHero, familyReadings, heroBars, latestOf, metricStatus, metricText, METRIC_UNIT, type HMetric } from '@cp/shared/rules/famHealth';
import { Icon } from '../../components/ui';
import { F, FamPage, FillCard, LargeTitle, List, ListRow, TextLink, useFamWide } from './kit';
import { PALETTE, MemberFace } from './health/bits';
import { ParentSwitch } from './ParentSwitch';
import { HistoryBody } from './health/HistoryBody';
import { useFamilyCtx, useFamilySel } from './useFamily';

export function FamilyHealth() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const navigate = useNavigate();
  const { choices, sel, setSel, multi } = useFamilySel();
  const [down, setDown] = useState(false);
  const [hm, setHm] = useState<HMetric | null>(null); // the laptop's inline History: the measurement shown
  const wide = useFamWide();
  const memberId = healthMemberOf(sel, choices);
  const m = s.members[memberId];
  if (!user || !m) return null;
  const rs = familyReadings(s, memberId);
  const L = limitsFor(s, m);
  const short = displayName(m);
  const go = (path: string) => navigate(path);
  const histPath = (metric?: HMetric) => `/history?member=${memberId}${metric ? `&metric=${metric}` : ''}`;
  // a laptop shows the history beside the card, so a tap picks the measurement there; a phone and tablet open the History page
  const hist = (metric?: HMetric) => (wide ? setHm(metric ?? null) : go(histPath(metric)));
  const when = (r: Reading, withTime: boolean) => (r.date === now.today ? t('common.today') : fmt.fds(r.date)) + (withTime ? ` ${r.time}` : '');
  // KC round 10: a reading older than three weeks is stale — it says how old it is and its number goes quiet
  const ageDays = (r: Reading) => daysBetween(r.date, now.today);
  const stale = (r: Reading) => ageDays(r) > 21;
  const ago = (r: Reading) => { const d = ageDays(r); return d >= 60 ? t('fhealth.monthsAgo', { n: Math.round(d / 30) }) : t('fhealth.weeksAgo', { n: Math.round(d / 7) }); };

  const hero = bpHero(rs, L);
  const bars = heroBars(rs);
  const pal = hero ? PALETTE[hero.status] : PALETTE.normal;
  const nurse = hero ? staffCall(s.staff[hero.r.takenBy]).replace(/ /g, '\u00A0') : ''; // "Ns. Dewi" stays on one line

  // laptop: name chips (a 36px face and the short name; ink when chosen) beside the title
  const nameChips = multi ? (
    <span style={{ display: 'flex', gap: 8 }}>
      {choices.map((id) => {
        const x = s.members[id];
        const on = id === memberId;
        return (
          <button key={id} type="button" aria-pressed={on} data-member={id} onClick={() => setSel(id)} className="cp-press"
            style={{ height: 44, padding: '0 16px 0 4px', border: 'none', borderRadius: 999, background: on ? F.ink : F.fill, color: on ? '#FFFFFF' : F.text, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
            <MemberFace m={x} size={36} />{displayName(x)}
          </button>
        );
      })}
    </span>
  ) : undefined;
  // phone and tablet: the family app's parent switch (faces only, no "both": Health shows one parent)
  const switcher = multi ? <ParentSwitch tone="page" both={false} members={choices.map((id) => s.members[id]).filter(Boolean)} sel={memberId} onPick={setSel} /> : undefined;

  const heroCard = hero ? (
    <button type="button" onClick={() => hist('bp')} aria-label={t('fhealth.heroAria', { n: short })} data-testid="health-hero" data-status={hero.status}
      onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)} onPointerCancel={() => setDown(false)}
      style={{ border: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: 30, background: pal.bg, padding: wide ? 22 : 20, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', transform: down ? 'scale(.99)' : 'none', transition: 'transform .15s ease' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: pal.fg, letterSpacing: '.4px', textTransform: 'uppercase' }}>
        <Icon name={pal.icon} size={18} fill={1} color={pal.fg} />{t('status.' + hero.status)} · {when(hero.r, true)}
      </span>
      <span style={{ fontSize: wide ? 64 : 60, lineHeight: 1, fontWeight: 300, letterSpacing: '-2px', color: pal.ink, fontVariantNumeric: 'tabular-nums' }}>{metricText(hero.r, 'bp')}</span>
      <span style={{ fontSize: 14, lineHeight: 1.4, color: pal.fg }}>
        {t('fhealth.bpWhen_' + hero.r.kind, { n: short })}{nurse ? ` · ${nurse}` : ''}
        {hero.status !== 'normal' ? <> <br />{t(hero.status === 'watch' ? 'fhealth.heroWatch' : 'fhealth.heroAlert')}</> : null}
      </span>
      {bars.length ? (
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 46, marginTop: 8, width: '100%' }}>
          {bars.map((h, i) => <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 3, background: pal.bar }} />)}
        </span>
      ) : null}
    </button>
  ) : null;

  const tiles = rs.length ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {TILE_METRICS.map((k) => {
        const r = latestOf(rs, k);
        const st: Health | null = r ? metricStatus(r, k, L) : null;
        const flagged = st === 'watch' || st === 'alert';
        const old = !!r && stale(r);
        return (
          <FillCard key={k} radius={22} pad={14} gap={4} onClick={() => hist(k)} testId={`health-tile-${k}`}>
            <span style={{ fontSize: 13, color: F.muted }}>{t('fhealth.m_' + k)}</span>
            <span style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.6px', fontVariantNumeric: 'tabular-nums', color: flagged ? PALETTE[st!].fg : old ? F.muted : F.text }}>
              {r ? metricText(r, k) : '—'}{r ? <span style={{ fontSize: 13, color: F.muted, marginLeft: 3, letterSpacing: 0 }}>{METRIC_UNIT[k]}</span> : null}
            </span>
            <span style={{ fontSize: 12, color: flagged ? PALETTE[st!].fg : F.muted }}>
              {r ? (old ? `${ago(r)} · ${when(r, false)}` : when(r, false)) : t('fhealth.notMeasured')}{flagged ? ` · ${t('status.' + st)}` : ''}
            </span>
          </FillCard>
        );
      })}
    </div>
  ) : (
    <FillCard radius={22} pad={20} gap={6} testId="health-empty">
      <Icon name="monitor_heart" size={28} color={F.bronze} />
      <span style={{ fontSize: 17, fontWeight: 500, color: F.text }}>{t('fhealth.emptyTitle')}</span>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: F.muted }}>{t('fhealth.emptyBody', { n: short })}</span>
    </FillCard>
  );

  const rows = (
    <List>
      {rs.length ? <ListRow first icon="monitoring" label={t('fhealth.historyRow')} onClick={() => go(histPath())} testId="health-history" /> : null}
      <ListRow first={!rs.length} icon="assignment_ind" label={t('fhealth.profileRow', { n: short })} onClick={() => go(`/profile?member=${memberId}&from=health`)} testId="health-profile" />
    </List>
  );

  if (wide) {
    return (
      <div data-testid="family-health" data-member-id={memberId}>
        <FamPage gap={22} wide>
          <LargeTitle right={nameChips}>{t('fhealth.title')}</LargeTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              {heroCard}
              {tiles}
              <FillCard onClick={() => go(`/profile?member=${memberId}&from=health`)} testId="health-profile" radius={22} pad={14} gap={10} label={t('fhealth.profileRow', { n: short })} style={{ flexDirection: 'row', alignItems: 'center', fontSize: 15 }}>
                <Icon name="assignment_ind" size={22} color={F.bronze} />
                <span style={{ flex: 1 }}>{t('fhealth.profileRow', { n: short })}</span>
                <Icon name="chevron_right" size={22} color={F.chev} />
              </FillCard>
            </div>
            {rs.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: '-0.3px', color: F.ink }}>{t('fhealth.history')}</h2>
                  <TextLink onClick={() => go(histPath(hm ?? undefined))} testId="health-history" size={14}>{t('fhealth.openFull')}</TextLink>
                </div>
                <HistoryBody inline m={m} asked={hm} onMetric={setHm} />
              </div>
            ) : <span />}
          </div>
        </FamPage>
      </div>
    );
  }

  return (
    <div data-testid="family-health" data-member-id={memberId}>
      <FamPage gap={12} wide>
        <LargeTitle right={switcher} sub={multi ? memberName(m) : undefined}>{t('fhealth.title')}</LargeTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{heroCard}{tiles}{rows}</div>
      </FamPage>
    </div>
  );
}
