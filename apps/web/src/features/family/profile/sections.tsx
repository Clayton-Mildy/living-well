// Round 8 (the prototype's parent profile page): the sections a family reads about a parent. Everything here is what the family may see:
// approved readings, approved daily logs, notes shared with the family, the club's own price list. Each section is a block with an id so the
// jump chips can scroll to it (the page itself is in ../FamilyProfile.tsx).
import { cloneElement, type CSSProperties, type ReactNode } from 'react';
import {
  actorName, addMonths, attOf, contactsOfMember, dayStatus, daysInMonth, dow, fmtPhone, isPendingRow, issueDateOf, limitsFor, live, memberAge, memberName, memberShort, memberSince, primaryContact, priceOn, rp, sortBy, staffCall, waUrl, ym,
  type ClubState, type DocType, type Health, type ISODate, type Member, type MemberNote,
} from '@cp/shared';
import { consentOf, docOf, documentTypes, formatVa } from '@cp/shared/rules/members';
import { latestNote, logOn, planSummary, visitDays } from '@cp/shared/rules/family';
import { logForFamily, noteForFamily } from '@cp/shared/rules/approvals';
import { lunchLabelKey } from '@cp/shared/rules/activity';
import { PROFILE_METRICS, familyReadings, latestOf, metricStatus, metricText, type HMetric } from '@cp/shared/rules/famHealth';
import { Icon } from '../../../components/ui';
import { useDevice } from '../../../hooks/useDevice';
import type { useAct } from '../../../lib/act';
import type { TFn, useFmt } from '../../../lib/i18n';
import { dietLabel, drugLabel, foodList, mobLabel, relLabel, timingLabel, cogText } from '../../members/lib';
import { DocView, useDocPicker, type PaperFile } from '../../members/PaperForm';
import { F, FillCard, HAIR, KV, List, SectionHead, TextLink, useFamWide } from '../kit';
import { MOOD_COLOR, type Mood } from '../storyBits';
import { PALETTE, MemberFace } from '../health/bits';
import { PlanAsk } from '../PlanCard';

/** What every section gets: the club state as the family sees it, the parent, and how to say and do things. */
export interface PCtx {
  s: ClubState; m: Member; t: TFn; fmt: ReturnType<typeof useFmt>; today: ISODate; userId: string; act: ReturnType<typeof useAct>; go: (path: string) => void;
}
type SecProps = { p: PCtx; id: string };

const FONT = 'Inter, system-ui, sans-serif';
/** A price with a non-breaking space so "Rp 650.000" never splits across two lines. */
const rpn = (n: number) => rp(n).replace(' ', '\u00A0');
const day = (p: PCtx, d: ISODate) => (d === p.today ? p.t('common.today') : p.fmt.fd(d, { day: 'numeric', month: 'short' }));
const Sec = ({ id, children, gap = 12 }: { id: string; children: ReactNode; gap?: number }) => (
  <section id={`pf-${id}`} data-pf-sec={id} style={{ display: 'flex', flexDirection: 'column', gap, scrollMarginTop: 'var(--pf-bar, 112px)' }}>{children}</section>
);
const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
    <span style={{ fontSize: 13, letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 600, color: F.muted }}>{children}</span>
    {right ? <span style={{ fontSize: 13, color: F.muted }}>{right}</span> : null}
  </div>
);
const SmallCap = ({ children }: { children: ReactNode }) => <span style={{ fontSize: 13, letterSpacing: '.4px', textTransform: 'uppercase', fontWeight: 500, color: F.muted, padding: '6px 4px 0', display: 'block' }}>{children}</span>;

/** The next invoice run: this month's issue day, or next month's once it has passed. */
const nextInvoice = (s: ClubState, today: ISODate): ISODate => { const a = issueDateOf(s, ym(today)); return a >= today ? a : issueDateOf(s, addMonths(ym(today), 1)); };

// ---------- overview: who, this month's plan, a word from the team, the personal details ----------
/** Who the page is about: the face, "Flex · since June 2024", the name and a quiet line. A phone and tablet have it first in the Overview; a laptop in the left column (96px face, 28px name). */
/** The head's words: "GOLD · SINCE MARCH 2025" and "84 years · married to Oma Lina". */
export function headText(p: PCtx): { eyebrow: string; sub: string } {
  const { s, m, t, fmt, today } = p;
  const ps = planSummary(s, m, today);
  const since = memberSince(m);
  const age = memberAge(m, today);
  const spouse = m.spouseId ? s.members[m.spouseId] : undefined;
  const sub = [
    age != null ? t('profile.years', { n: age }) : '',
    m.nanny ? t('profile.withNanny_' + m.gender, { n: m.nanny.name }) : '',
    spouse && !spouse.deletedAt ? t('profile.marriedTo', { n: memberShort(spouse) }) : '',
  ].filter(Boolean).join(' · ');
  return { eyebrow: t('fhealth.eyebrow', { p: t('profile.plan.' + ps.plan), d: since ? fmt.fmonth(ym(since), true) : '—' }), sub };
}

/** The laptop's left column: the face, the eyebrow, the name and the line under it (a phone and tablet have the picture on top instead, ProfileCover). */
export function ProfileHead({ p, column }: { p: PCtx; /** the laptop's left column: a stacked, bigger head */ column?: boolean }) {
  const { m } = p;
  const { eyebrow, sub } = headText(p);
  return (
    <div data-testid="pf-head" style={{ display: 'flex', flexDirection: column ? 'column' : 'row', alignItems: column ? 'flex-start' : 'center', gap: column ? 14 : 14 }}>
      <MemberFace m={m} size={column ? 96 : 72} ring />
      <span style={{ display: 'flex', flexDirection: 'column', gap: column ? 3 : 2, minWidth: 0 }}>
        <span style={{ fontSize: 12, letterSpacing: '1.6px', textTransform: 'uppercase', fontWeight: 600, color: F.eyebrow }}>{eyebrow}</span>
        <h1 style={{ margin: 0, fontSize: column ? 28 : 26, lineHeight: 1.1, fontWeight: 400, letterSpacing: column ? '-0.7px' : '-0.6px', color: F.ink, overflowWrap: 'anywhere' }}>{memberName(m)}</h1>
        {sub ? <span style={{ fontSize: 14, lineHeight: column ? '20px' : 1.4, color: F.muted }}>{sub}</span> : null}
      </span>
    </div>
  );
}

export function Overview({ p, id, notice }: SecProps & { notice?: ReactNode }) {
  const { s, m, t, fmt, today } = p;
  const wide = useFamWide();
  const { isLaptop } = useDevice(); // round 8d: the personal details are two columns from a 1280px window; a 1024–1279 window has too little room for two
  const ps = planSummary(s, m, today);
  const flex = ps.plan === 'flex';
  const since = memberSince(m);
  const age = memberAge(m, today);
  const spouse = m.spouseId ? s.members[m.spouseId] : undefined;
  const reg = m.registration;
  const lg = latestNote(s, m.id, today);
  const month = fmt.fmonth(ps.month);
  const place = [reg?.rtRw ? `${t('profile.f.rtRw')} ${reg.rtRw}` : '', reg?.city, reg?.postcode].filter(Boolean).join(' · ');
  const quota = Math.max(1, Math.min(31, ps.quota ?? 0));
  const planCard = (
    <FillCard testId="pf-plan-card" gap={10}>
      <Label right={ps.ended ? undefined : t('fhealth.nextInvoice', { d: fmt.fd(nextInvoice(s, today), { day: 'numeric', month: 'short' }) })}>{t(flex ? 'profile.planLabelFlex' : 'profile.planLabelGold', { m: month })}</Label>
      <span style={{ fontSize: 22, letterSpacing: '-0.4px', color: F.ink }}>{flex ? t('profile.visitsUsed', { n: ps.used, q: ps.quota ?? 0 }) : t('fhealth.visitsGold', { n: ps.used })}</span>
      {flex ? (
        <div role="img" aria-label={t('profile.visitsUsed', { n: ps.used, q: ps.quota ?? 0 })} style={{ display: 'grid', gridTemplateColumns: `repeat(${quota}, minmax(0, 1fr))`, gap: 4 }}>
          {Array.from({ length: quota }, (_, i) => <span key={i} style={{ height: 8, borderRadius: 4, background: i < ps.used ? F.bronze : F.line }} />)}
        </div>
      ) : null}
      {flex && ps.extra.length ? <span style={{ fontSize: 14, color: F.rust, fontWeight: 500 }}>{t(ps.extra.length === 1 ? 'fhealth.extraLineOne' : 'fhealth.extraLine', { n: ps.extra.length, p: rp(ps.price * ps.extra.length) })}</span> : null}
    </FillCard>
  );
  const teamCard = lg ? (
    <FillCard testId="pf-team" gap={10}>
      <Label right={`${staffCall(s.staff[lg.by]) || t('profile.theTeam')} · ${day(p, lg.date)}`}>{t('profile.fromTeam')}</Label>
      <span style={{ fontSize: wide ? 15 : 16, lineHeight: wide ? '22px' : '23px', color: F.text, overflowWrap: 'anywhere' }}>{lg.note}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 14, color: F.soft }}>
        {lg.mood ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: MOOD_COLOR[lg.mood] }} />{t('family.mood_' + lg.mood)}</span> : null}
        {lg.lunch ? <span>{t(lunchLabelKey(lg.lunch))}</span> : null}
      </span>
    </FillCard>
  ) : null;
  // the personal details; a laptop sets them in two columns (the first row's hairline is left off)
  const personal = [
    <KV key="born" k={t('fhealth.born')} v={m.dob ? `${fmt.fdy(m.dob)}${age != null ? ` · ${age}` : ''}` : age != null ? t('profile.years', { n: age }) : t('common.notSet')} />,
    reg?.nickname ? <KV key="nick" k={t('profile.f.knownAs')} v={reg.nickname} /> : null,
    spouse && !spouse.deletedAt ? <KV key="mar" k={t('fhealth.married')} v={memberName(spouse)} /> : reg?.marital ? <KV key="mar" k={t('profile.f.marital')} v={t('profile.marital.' + reg.marital)} /> : null,
    <KV key="addr" k={t('profile.f.address')} v={m.address || t('common.notSet')} />,
    place ? <KV key="area" k={t('profile.f.area')} v={place} /> : null,
    reg?.phone ? <KV key="home" k={t('profile.f.homePhone')} v={reg.phone} /> : null,
    reg?.mobile ? <KV key="mob" k={t('profile.f.phone')} v={reg.mobile} /> : null,
    reg?.email ? <KV key="mail" k={t('profile.f.email')} v={reg.email} /> : null,
    <KV key="usual" k={t('profile.f.usual')} v={m.usualArrival || t('common.notSet')} />,
    <KV key="nanny" k={t('profile.f.nanny')} v={m.nanny ? `${m.nanny.name}${m.nanny.phone ? ' · ' + fmtPhone(m.nanny.phone) : ''}` : t('profile.noNanny')} />,
    <KV key="since" k={t('profile.since')} v={since ? fmt.fmonth(ym(since), true) : '—'} />,
  ].filter((x): x is JSX.Element => !!x);
  return (
    <Sec id={id}>
      {notice}
      {wide
        ? <div style={{ display: 'grid', gridTemplateColumns: teamCard ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 12, alignItems: 'stretch' }}>{planCard}{teamCard}</div>
        : <>{planCard}{teamCard}</>}
      <SmallCap>{t('profile.personal')}</SmallCap>
      {wide && isLaptop ? (
        <List testId="pf-personal" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 0 }}>
          {personal.map((x, i) => <div key={x.key} style={{ minWidth: 0 }}>{cloneKV(x, i < 2)}</div>)}
        </List>
      ) : (
        <List testId="pf-personal">{personal.map((x, i) => cloneKV(x, i === 0))}</List>
      )}
    </Sec>
  );
}
/** The same KV row, told whether it is the first of its column (no hairline above it). */
const cloneKV = (x: JSX.Element, first: boolean) => cloneElement(x, { first });

// ---------- health: the latest of each measurement, then allergies, mobility, diet, conditions and medicines ----------
export function HealthSection({ p, id }: SecProps) {
  const { s, m, t, today, go } = p;
  const wide = useFamWide();
  const rs = familyReadings(s, m.id);
  const L = limitsFor(s, m);
  const open = (metric?: HMetric) => go(`/history?member=${m.id}&from=profile${metric ? `&metric=${metric}` : ''}`);
  const vitals = PROFILE_METRICS.map((k) => {
    const r = latestOf(rs, k);
    const st: Health | null = r ? metricStatus(r, k, L) : null;
    const v = r ? (k === 'spo2' ? `${metricText(r, k)}%` : k === 'temp' ? `${metricText(r, k)}°` : k === 'weight' ? `${metricText(r, k)} kg` : metricText(r, k)) : '—';
    const when = r ? `${day(p, r.date)}${k === 'bp' && r.date === today ? ` ${r.time}` : ''}` : '';
    return { k, v, when, flagged: st === 'watch' || st === 'alert' ? st : null };
  });
  const food = foodList(t, m);
  const drugs = m.health.drugs.map((d) => drugLabel(t, d));
  const diets = [...m.health.diet.map((d) => dietLabel(t, d)), ...(m.health.diabetic ? [t('profile.diabetic')] : [])];
  const red = { color: F.red, weight: 500, dot: F.red } as const;
  const meds = m.health.meds;
  return (
    <Sec id={id}>
      <SectionHead right={rs.length ? <TextLink onClick={() => open()} testId="pf-history">{t('fhealth.history')}</TextLink> : undefined}>{t('profile.tab.health')}</SectionHead>
      {rs.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${wide ? 6 : 3}, minmax(0, 1fr))`, gap: 8 }}>
          {vitals.map((x) => (
            <FillCard key={x.k} radius={16} pad="10px 12px" gap={2} onClick={() => open(x.k)} testId={`pf-vital-${x.k}`}>
              <span style={{ fontSize: 12, color: F.muted }}>{t(x.k === 'bp' || x.k === 'temp' ? 'fhealth.s_' + x.k : 'fhealth.m_' + x.k)}</span>
              <span style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', color: x.flagged ? PALETTE[x.flagged].fg : F.text, whiteSpace: 'nowrap' }}>{x.v}</span>
              <span style={{ fontSize: 11, color: x.flagged ? PALETTE[x.flagged].fg : F.muted }}>{x.when}{x.flagged ? ` · ${t('status.' + x.flagged)}` : ''}</span>
            </FillCard>
          ))}
        </div>
      ) : null}
      <List testId="pf-care-list">
        <KV first k={t('fhealth.foodAllergy')} v={food.length ? food.join(', ') : t('profile.noneKnown')} {...(food.length ? red : {})} />
        <KV k={t('fhealth.drugAllergy')} v={drugs.length ? drugs.join(', ') : t('profile.noneKnown')} {...(drugs.length ? red : {})} />
        <KV k={t('fhealth.mobility')} v={mobLabel(t, m.health.mobility)} />
        <KV k={t('fhealth.diet')} v={diets.length ? diets.join(' · ') : t('fhealth.noDiet')} />
        <KV k={t('profile.conditions')} v={m.health.conditions.length ? m.health.conditions.join(', ') : t('profile.noConditions')} />
        {meds.length ? meds.map((x, i) => <KV key={x.id} k={i === 0 ? t('profile.medicines') : ''} v={`${`${x.name} ${x.dose}`.trim()} · ${timingLabel(t, x.timing)}`} />) : <KV k={t('profile.medicines')} v={t('common.none')} />}
      </List>
    </Sec>
  );
}

// ---------- care: how she is thinking, how the last logs felt, the last days she came ----------
export function CareSection({ p, id }: SecProps) {
  const { s, m, t, fmt, today, go } = p;
  const cog = m.health.cognitive;
  const reviewer = cog.reviewedBy ? staffCall(s.staff[cog.reviewedBy]) || cog.reviewedBy : '';
  const logs = sortBy(live(s.dailyLogs).filter((l) => l.memberId === m.id && l.status === 'saved' && l.date <= today).map(logForFamily).filter((l) => !!l && l.mood !== undefined), (l) => l!.date, -1).slice(0, 10);
  const moods = (['cheerful', 'calm', 'quiet', 'agitated'] as Mood[]).map((k) => ({ k, n: logs.filter((l) => l!.mood === k).length })).filter((x) => x.n);
  const days = visitDays(s, m.id, today).slice().reverse().slice(0, 3);
  return (
    <Sec id={id}>
      <SectionHead right={<span style={{ fontSize: 13, color: F.muted }}>{t('fhealth.last10')}</span>}>{t('fhealth.jump.care')}</SectionHead>
      <FillCard radius={16} pad={14} gap={10} testId="pf-care">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15 }}>{cogText(t, cog.summary)}</span>
          <span style={{ fontSize: 13, color: F.muted }}>{cog.reviewedOn ? t('profile.reviewedBy', { n: reviewer || t('profile.theTeam'), d: fmt.fdy(cog.reviewedOn) }) : t('profile.notReviewed')}</span>
        </span>
        <div style={{ display: 'flex', gap: '6px 14px', flexWrap: 'wrap', fontSize: 14, color: F.soft }}>
          {moods.map((x) => <span key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: MOOD_COLOR[x.k] }} />{t('family.mood_' + x.k)} {x.n}</span>)}
          {!moods.length ? <span style={{ color: F.muted }}>{t('fhealth.noMood')}</span> : null}
        </div>
      </FillCard>
      {days.length ? (
        <List testId="pf-days">
          {days.map((d, i) => {
            const a = attOf(s, d, m.id);
            const mood = logOn(s, m.id, d)?.mood;
            const times = a?.checkIn ? `${a.checkIn.at}${a.checkOut ? `–${a.checkOut.at}` : ''}` : '';
            return (
              <button key={d} type="button" onClick={() => go(`/today?member=${m.id}&date=${d}`)} data-date={d} className="cp-fam-press"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: 'none', borderTop: i ? HAIR : 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{d === today ? t('common.today') : fmt.fds(d)}</span>
                  <span style={{ fontSize: 13, color: F.muted }}>{[times, mood ? t('family.mood_' + mood) : ''].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevron_right" size={22} color={F.chev} />
              </button>
            );
          })}
        </List>
      ) : null}
    </Sec>
  );
}

// ---------- visits this month: tiles and a small month ----------
export function VisitsSection({ p, id }: SecProps) {
  const { s, m, t, fmt, today } = p;
  const wide = useFamWide();
  const ps = planSummary(s, m, today);
  const flex = ps.plan === 'flex';
  const month = ps.month;
  const extra = new Set(ps.extra);
  const lead = (dow(`${month}-01`) + 6) % 7;
  const month1 = fmt.fmonth(month);
  const tiles = flex
    ? [
        { k: t('fhealth.tUsed'), v: `${ps.used}/${ps.quota ?? 0}`, sub: month1 },
        { k: t('fhealth.tLeft'), v: String(ps.left ?? 0), sub: t('fhealth.tLeftSub', { p: rpn(ps.price) }) },
        { k: t('fhealth.tExtra'), v: String(ps.extra.length), sub: ps.extra.length ? t('fhealth.tExtraBill', { p: rpn(ps.price * ps.extra.length) }) : t('fhealth.tExtraNone') },
      ]
    : [
        { k: t('fhealth.tVisits'), v: String(ps.used), sub: month1 },
        { k: t('fhealth.tPlan'), v: t('profile.plan.gold'), sub: t('fhealth.tGoldSub') },
        { k: t('fhealth.tUsual'), v: m.usualArrival || '—', sub: t('fhealth.tArrival') },
      ];
  const cells: { n: number | null; bg: string; fg: string; op: number; ring: boolean; date?: ISODate }[] = Array.from({ length: lead }, () => ({ n: null, bg: 'transparent', fg: F.text, op: 1, ring: false }));
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const visited = !!attOf(s, date, m.id)?.checkIn;
    const weekend = dow(date) === 0 || dow(date) === 6;
    const closed = !weekend && !dayStatus(s, date).open;
    const isExtra = extra.has(date);
    cells.push({
      n: d, date, ring: date === today,
      bg: isExtra ? F.ink : visited ? F.bronze : closed ? F.ochreBg : weekend ? 'transparent' : '#FFFFFF',
      fg: visited ? '#FFFFFF' : closed ? F.ochre : F.text,
      op: visited || isExtra ? 1 : weekend ? 0.4 : date > today ? 0.6 : 1,
    });
  }
  const dows = Array.from({ length: 7 }, (_, i) => fmt.fd(`2024-01-0${i + 1}`, { weekday: 'narrow' }));
  const legend = [{ bg: F.bronze, label: t('fhealth.lgVisited') }, ...(flex ? [{ bg: F.ink, label: t('fhealth.lgExtra') }] : []), { bg: F.ochreBg, label: t('fhealth.lgClosed') }];
  return (
    <Sec id={id}>
      <SectionHead>{t('fhealth.visitsIn', { m: month1 })}</SectionHead>
      {/* a laptop: the tiles stacked in a 240px column beside the month; a phone: three tiles over the month */}
      <div style={wide ? { display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 12, alignItems: 'start' } : { display: 'contents' }}>
        <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr' : 'repeat(3, 1fr)', gap: 8 }} data-testid="pf-visit-tiles">
          {tiles.map((x) => (
            <div key={x.k} style={{ background: F.fill, borderRadius: 16, padding: wide ? '10px 14px' : '10px 12px', display: 'flex', flexDirection: wide ? 'row' : 'column', justifyContent: wide ? 'space-between' : undefined, alignItems: wide ? 'center' : undefined, gap: 2, minWidth: 0 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: F.muted }}>{x.k}</span>
                {wide ? <span style={{ fontSize: 11, color: F.muted, overflowWrap: 'anywhere' }}>{x.sub}</span> : null}
              </span>
              <span style={{ fontSize: wide ? 24 : 22, fontWeight: 300, letterSpacing: '-0.5px', color: F.text, fontVariantNumeric: 'tabular-nums' }}>{x.v}</span>
              {wide ? null : <span style={{ fontSize: 11, color: F.muted, overflowWrap: 'anywhere' }}>{x.sub}</span>}
            </div>
          ))}
        </div>
        <div data-testid="pf-month" style={{ background: F.fill, borderRadius: 20, padding: wide ? 12 : 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 11, fontWeight: 500, color: F.muted }}>{dows.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: wide ? 4 : 3 }}>
            {cells.map((c, i) => (
              <span key={i} data-date={c.date} style={{ height: 30, borderRadius: 8, background: c.bg, color: c.fg, opacity: c.op, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.ring ? `inset 0 0 0 2px ${F.ink}` : undefined, fontVariantNumeric: 'tabular-nums' }}>{c.n}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: F.muted, padding: 2, whiteSpace: 'nowrap', flexWrap: 'wrap' }}>
            {legend.map((l) => <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: l.bg }} />{l.label}</span>)}
          </div>
        </div>
      </div>
    </Sec>
  );
}

// ---------- plan and billing ----------
export function PlanSection({ p, id }: SecProps) {
  const { s, m, t, fmt, today } = p;
  const ps = planSummary(s, m, today);
  const flex = ps.plan === 'flex';
  const price = priceOn(s, today);
  const prim = primaryContact(s, m.id);
  const spouse = m.spouseId ? s.members[m.spouseId] : undefined;
  const upcoming = m.plans.find((x) => x.from > today);
  const last = m.memberships[m.memberships.length - 1]?.lastDay;
  return (
    <Sec id={id}>
      <SectionHead>{t('fhealth.jump.plan')}</SectionHead>
      <List testId="pf-plan">
        <KV first k={t('fhealth.tPlan')} v={t(flex ? 'profile.planFlexTitle' : 'profile.planGoldTitle', { q: s.club.settings.flexQuota })} />
        <KV k={t('profile.fee')} v={t('fhealth.perMonth', { p: rp(price[ps.plan]) })} />
        {flex ? <KV k={t('profile.extraDay')} v={rp(price.extra)} /> : null}
        {prim ? <KV k={t('profile.billingContact')} v={prim.name} /> : null}
        <KV k={t('profile.va')} v={m.billing.va ? formatVa(m.billing.va) : t('profile.vaLater')} />
        {upcoming ? <KV k={t('profile.nextChange')} v={`${t('profile.plan.' + upcoming.plan)} · ${t('profile.fromDate', { d: fmt.fdy(upcoming.from) })}`} /> : null}
        {spouse && !spouse.deletedAt ? <KV k={t('profile.couple')} v={t('fhealth.coupleVal', { n: memberShort(spouse) })} /> : null}
        <KV k={t('profile.membership')} v={last ? t(last < today ? 'profile.endedOn' : 'profile.endsOn', { d: fmt.fdy(last) }) : t('fhealth.monthly', { d: fmt.fd(nextInvoice(s, today), { day: 'numeric', month: 'short' }) })} />
      </List>
      <PlanAsk m={m} />
    </Sec>
  );
}

// ---------- family: who looks after this parent, one tap to WhatsApp or call ----------
export function FamilySection({ p, id }: SecProps) {
  const { s, m, t, userId } = p;
  const rows = contactsOfMember(s, m.id).filter(({ link, contact }) => !isPendingRow(link) && !isPendingRow(contact));
  const circle: CSSProperties = { width: 40, height: 40, borderRadius: 999, border: 'none', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: F.bronze, textDecoration: 'none', flex: 'none' };
  return (
    <Sec id={id}>
      <SectionHead>{t('fhealth.jump.family')}</SectionHead>
      <List testId="pf-family">
        {rows.map(({ link, contact }, i) => {
          const me = contact.id === userId;
          const wa = waUrl(contact.phone);
          const line = [relLabel(t, link.relation), link.primary ? t('fhealth.paysBills') : '', link.appAccess ? t('fhealth.usesApp') : t('fhealth.noApp')].filter(Boolean).join(' · ');
          return (
            <div key={link.id} data-testid="pf-contact" data-family-id={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', borderTop: i ? HAIR : 'none' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: F.text, overflowWrap: 'anywhere' }}>{contact.name}</span>
                <span style={{ fontSize: 13, color: F.muted }}>{line}</span>
              </span>
              {me ? <span style={{ fontSize: 13, fontWeight: 500, color: F.muted, paddingRight: 4 }}>{t('fhealth.you')}</span> : (
                <>
                  {wa ? <a href={wa} target="_blank" rel="noopener" aria-label={t('fhealth.waAria', { n: contact.firstName })} data-testid="pf-wa" className="cp-press" style={circle}><Icon name="chat" size={19} /></a> : null}
                  <a href={`tel:${contact.phone}`} aria-label={t('profile.callName', { n: contact.firstName })} data-testid="pf-call" className="cp-press" style={circle}><Icon name="call" size={19} /></a>
                </>
              )}
            </div>
          );
        })}
      </List>
    </Sec>
  );
}

// ---------- documents and consents ----------
function DocRow({ p, type, first }: { p: PCtx; type: DocType; first: boolean }) {
  const { s, m, t, act, userId } = p;
  const doc = docOf(m, type);
  const has = doc?.status === 'onFile';
  const requested = doc?.status === 'requested';
  const waiting = live(s.changeRequests).some((c) => c.status === 'pending' && c.section === 'docsConsent' && c.submittedBy === `family:${userId}` && c.action === 'document.upload' && (c.input as { type?: string; memberId?: string })?.type === type && (c.input as { memberId?: string })?.memberId === m.id);
  const pick = useDocPicker((f: PaperFile) => act('document.upload', { memberId: m.id, type, fileName: f.fileName, mediaId: f.mediaId }, { reviewText: t('profile.uploadSent') }), type === 'nannyKtp' ? 'ktp-nanny' : type === 'ktp' ? 'ktp' : type === 'membershipForm' ? 'registration-form' : 'health-info');
  const title = type === 'ktp' ? t('profile.docTitle.ktp', { n: m.firstName }) : t('profile.docTitle.' + type);
  const st = waiting
    ? { c: F.ochre, text: t('fhealth.stWaiting') }
    : has ? { c: F.sage, text: doc?.mediaId ? t('fhealth.stOnFile') : t('fhealth.stPaper') }
      : requested ? { c: F.ochre, text: t('fhealth.stRequested') } : { c: F.rust, text: t('profile.docMissing') };
  const pill: CSSProperties = { height: 36, padding: '0 14px', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flex: 'none' };
  return (
    <div data-testid="pf-doc" data-type={type} data-state={waiting ? 'waiting' : has ? 'onFile' : requested ? 'requested' : 'missing'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', borderTop: first ? 'none' : HAIR }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: F.text, overflowWrap: 'anywhere' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: st.c }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: st.c, flex: 'none' }} />{st.text}</span>
      </span>
      {has && doc?.mediaId ? <DocView doc={doc} title={title}>{(open) => <button type="button" onClick={open} className="cp-fill cp-press" style={{ ...pill, background: '#FFFFFF', color: F.ink }}>{t('profile.view')}</button>}</DocView> : null}
      {!has && !waiting ? <button type="button" disabled={pick.busy} onClick={pick.chooseFile} className="cp-press" data-testid="pf-upload" style={{ ...pill, background: F.ink, color: '#FFFFFF', opacity: pick.busy ? 0.6 : 1 }}>{t('profile.upload')}</button> : null}
      {pick.node}
    </div>
  );
}

export function DocsSection({ p, id }: SecProps) {
  const { m, t, fmt } = p;
  const wide = useFamWide();
  const consents = (['data', 'face'] as const).map((k) => ({ k, c: consentOf(m, k) }));
  const docs = <List testId="pf-docs">{documentTypes(m).map((type, i) => <DocRow key={type} p={p} type={type} first={!i} />)}</List>;
  return (
    <Sec id={id}>
      <SectionHead>{t('fhealth.jump.docs')}</SectionHead>
      {/* a laptop: the documents and the consents side by side (an unseen caption keeps the two lists level) */}
      {wide ? null : docs}
      {wide ? null : <SmallCap>{t('fhealth.consents')}</SmallCap>}
      <div style={wide ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, alignItems: 'start' } : { display: 'contents' }}>
      {wide ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><SmallCap><span aria-hidden="true" style={{ visibility: 'hidden' }}>{t('fhealth.consents')}</span></SmallCap>{docs}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {wide ? <SmallCap>{t('fhealth.consents')}</SmallCap> : null}
      <List testId="pf-consents">
        {consents.map(({ k, c }, i) => (
          <div key={k} data-testid="pf-consent" data-kind={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? HAIR : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{t('profile.consent.' + k)}</span>
              <span style={{ fontSize: 13, color: F.muted }}>{c ? t('fhealth.consentLine', { n: c.byName, d: fmt.fdy(c.at.slice(0, 10)), v: t('profile.cvia_' + c.via) }) : t('profile.consentNone')}</span>
            </span>
            {c ? <span style={{ fontSize: 13, fontWeight: 600, color: c.granted ? F.sage : F.muted, flex: 'none' }}>{c.granted ? t('profile.consentGranted') : t('profile.consentOptOut')}</span> : null}
          </div>
        ))}
      </List>
      </div>
      </div>
    </Sec>
  );
}

// ---------- notes the club team shared with the family (pinned first) ----------
export function NotesSection({ p, id }: SecProps) {
  const { s, m, t, fmt } = p;
  const notes = sortBy(live(s.memberNotes).filter((n) => n.memberId === m.id && n.visibility === 'family').map(noteForFamily).filter((n): n is MemberNote => !!n), (n) => (n.pinned ? '1' : '0') + n.on + n.createdAt, -1);
  return (
    <Sec id={id}>
      <SectionHead>{t('fhealth.notesTitle')}</SectionHead>
      <List testId="pf-notes">
        {notes.map((n, i) => (
          <div key={n.id} data-testid="pf-note" data-pinned={!!n.pinned} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderTop: i ? HAIR : 'none' }}>
            {n.pinned ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: F.bronze }}><Icon name="push_pin" size={15} fill={1} color={F.bronze} />{t('fhealth.pinned')}</span> : null}
            <span style={{ fontSize: 15, lineHeight: '21px', color: F.text, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{n.text}</span>
            <span style={{ fontSize: 12, color: F.muted }}>{t('fhealth.sharedBy', { n: actorName(s, n.createdBy), d: fmt.fds(n.on) })}</span>
          </div>
        ))}
        {!notes.length ? <div style={{ padding: '14px', fontSize: 14, color: F.muted }}>{t('profile.noNotes')}</div> : null}
      </List>
    </Sec>
  );
}
