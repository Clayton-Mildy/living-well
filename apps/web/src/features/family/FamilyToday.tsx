// Family Today (design ScrFamily 931–1042): greeting, member switcher, member card(s), survey, timeline, photos, team log, plan and invoice, links.
// The club is drop-in: members come on any open day, so there is no booking, leave, "expected" or "not coming". A member is at the club since
// a time, went home at a time, or is simply not at the club today. Flex shows visits used this month; Gold is "come any open day".
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  answeredBy, firstOfRole, isPrimaryFor, liveSurvey, memberName, memberShort, memberSince, planOn, rp, staffCall, todayReading, type Member, type Photo,
} from '@cp/shared';
import {
  dayStateOf, familyPhotoDays, invoiceRows, latestLog, mayStillCome, openInvoiceRows, openTotal, photoActivityLabel, photosInOrder, planSummary, sharedNoteOf, staffFirst, staffIdOf, type DayState,
  type PhotoDay, type PhotoSet,
} from '@cp/shared/rules/family';
import { Avatar, Button, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { writePref } from '../../store/session';
import { PhotoViewer } from '../activity/PhotoViewer';
import { InvoiceSheet } from '../finance/InvoiceSheet';
import { Cap, FamSwitch, H1, H2, HealthPill, PhotoGrid, StatusBanner, fcard, heroBlock, heroCard, linkBtn } from './parts';
import { Timeline } from './Timeline';
import { InvoiceCard, PlanCard } from './PlanCard';
import { LogBlock } from './TeamLog';
import { LunchFeedbackSheet, PaySheet, SurveySheet } from './sheets';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';
import { memberPhoto } from '../../lib/media';

type Banner = { dot: string; text: string; sub?: string };
const SAGE = '#3D6B4F';
const STONE = '#BBA88F';

/** Where the member is today, as one status line: at the club since…, went home at…, or (neutral) not at the club today. */
function useBanner(m: Member, st: DayState): Banner {
  const { s, t, fmt, now } = useFamilyCtx();
  switch (st.kind) {
    case 'here': return { dot: SAGE, text: t('family.atSince', { t: st.since }), sub: t('family.checkedInBy', { s: staffFirst(s, staffIdOf(st.att.checkIn?.by)) || t('family.theLobby') }) };
    case 'home': return { dot: STONE, text: t('family.wentHome', { t: st.at }), sub: t('family.visitSpan', { a: st.att.checkIn?.at || '', b: st.at }) };
    // they may still drop in while the club is open, so "right now"; "today" is for after closing
    case 'away': return { dot: STONE, text: t(mayStillCome(s, now.nowMin) ? 'family.notNow' : 'family.notToday'), sub: t('family.famUsually', { t: m.usualArrival }) };
    case 'closed': return { dot: STONE, text: t('family.stClosed'), sub: t(st.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fmt.fdl(st.next) }) };
    case 'ended': return { dot: STONE, text: t('family.stEnded', { d: fmt.fds(st.lastDay) }) };
    case 'upcoming': return { dot: STONE, text: t('family.stUpcoming', { d: fmt.fds(st.start) }) };
  }
}

interface Actions {
  onPay: (ids: string[]) => void;
  onProfile: (id: string) => void;
}

const nurseName = (s: Parameters<typeof firstOfRole>[0], t: (k: string) => string) => staffCall(firstOfRole(s, 'nurse')) || t('roles.nurse');

/** Both mode: one card per parent with the day's status, health results, the team log with comments, and their own Pay action. */
function ParentCard({ m, a }: { m: Member; a: Actions }) {
  const { s, t, now, user } = useFamilyCtx();
  const { today } = now;
  const st = dayStateOf(s, m, today);
  const banner = useBanner(m, st);
  const plan = planSummary(s, m, today);
  const visiting = st.kind === 'here' || st.kind === 'home';
  const arr = visiting ? todayReading(s, m.id, today, 'arrival') : undefined;
  const dep = visiting ? todayReading(s, m.id, today, 'departure') : undefined;
  const log = latestLog(s, m.id, today);
  const open = openInvoiceRows(invoiceRows(s, [m.id], today));
  const canPay = !!user && isPrimaryFor(s, user.id, m.id) && open.length > 0;
  const bp = [arr && { label: t('family.bpArrival', { t: arr.time }), r: arr }, dep && { label: t('family.bpDeparture', { t: dep.time }), r: dep }].filter(Boolean) as { label: string; r: NonNullable<typeof arr> }[];
  return (
    <section aria-label={memberName(m)} style={heroCard()} data-testid="parent-card" data-member={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={56} ring />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{memberName(m)}</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{plan.plan === 'flex' ? t('family.planUsedLine', { n: plan.used, q: plan.quota ?? 0 }) : t('family.planGoldLine')}</span>
        </div>
        <button type="button" onClick={() => a.onProfile(m.id)} style={linkBtn}>{t('family.profile')}</button>
      </div>
      <StatusBanner {...banner} />
      {bp.map((b) => (
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: '1px solid #F0EAE1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontSize: 15, lineHeight: '22px', fontVariantNumeric: 'tabular-nums', color: '#6B6259' }}>{b.r.sys}/{b.r.dia}{b.r.spo2 ? t('family.oxygen', { o: b.r.spo2 }) : ''}</span>
          </div>
          <HealthPill status={b.r.status} />
        </div>
      ))}
      {!bp.length && st.kind === 'here' ? <span className="cp-hide-phone" style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('family.healthSoon', { n: nurseName(s, t) })}</span> : null}
      {log ? (
        <div style={heroBlock}>
          <Cap>{t('family.notesTeam')}</Cap>
          <LogBlock m={m} log={log} />
        </div>
      ) : null}
      {canPay ? <Button size={56} full icon="account_balance" onClick={() => a.onPay(open.map((r) => r.inv.id))}>{t('family.payAmount', { a: rp(openTotal(open)) })}</Button> : null}
    </section>
  );
}

/** Single member card (design `notBoth`): avatar ring, name, plan, Profile, today's status line, the team's note and the invoice. */
function MemberCard({ m, a, onPay, onDetails, onBilling }: { m: Member; a: Actions; onPay: (ids: string[]) => void; onDetails: (id: string) => void; onBilling: () => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const st = dayStateOf(s, m, now.today);
  const banner = useBanner(m, st);
  const plan = planOn(m, now.today).plan;
  const last = m.memberships[m.memberships.length - 1];
  const since = memberSince(m);
  const sub = [`${t(plan === 'flex' ? 'family.planFlex' : 'family.planGold')} · ${t('family.sinceL', { d: since ? fmt.fmonth(since.slice(0, 7), true) : '' })}`, last?.lastDay && st.kind !== 'ended' ? t('family.endsOn', { d: fmt.fds(last.lastDay) }) : ''].filter(Boolean).join(' · ');
  const log = latestLog(s, m.id, now.today);
  return (
    <section aria-label={memberName(m)} style={heroCard()} data-testid="member-card" data-member={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 18px)' }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={64} ring />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 'clamp(24px, 5.6vw, 30px)', lineHeight: 1.1, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{memberName(m)}</div>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{sub}</div>
        </div>
        <button type="button" onClick={() => a.onProfile(m.id)} style={linkBtn}>{t('family.profile')}</button>
      </div>
      <StatusBanner {...banner} />
      {log ? (
        <div style={heroBlock}>
          <Cap>{t('family.notesTeam')}</Cap>
          <LogBlock m={m} log={log} />
        </div>
      ) : null}
      <InvoiceCard m={m} showName={false} bare onPay={onPay} onDetails={onDetails} onBilling={onBilling} />
    </section>
  );
}

/** Tiles for the Today card: at most six a day, solo photos first. */
function trimDays(days: PhotoDay[], max = 6): PhotoDay[] {
  return days.map((d) => {
    let left = max;
    const sets: PhotoSet[] = [];
    for (const x of d.sets) {
      if (left <= 0) break;
      const photos = x.photos.slice(0, left);
      left -= photos.length;
      sets.push({ ...x, photos });
    }
    return { ...d, sets };
  });
}

export function FamilyToday() {
  const { s, t, fmt, now, user, pron } = useFamilyCtx();
  const { isPhone } = useDevice();
  const navigate = useNavigate();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const [sp, setSp] = useSearchParams();
  const [pay, setPay] = useState<string[] | null>(null);
  const [survey, setSurvey] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  const closePay = useCallback(() => setPay(null), []);
  const closeSurvey = useCallback(() => setSurvey(false), []);
  const closeFeedback = useCallback(() => setFeedback(false), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  // a notification can open the survey straight away (/today?survey=1)
  useEffect(() => {
    if (sp.get('survey') !== '1') return;
    setSurvey(true);
    const next = new URLSearchParams(sp);
    next.delete('survey');
    setSp(next, { replace: true });
  }, [sp, setSp]);

  if (!user) return null;
  const { today, nowMin } = now;
  const members = who.map((id) => s.members[id]).filter(Boolean);
  if (!members.length) return null;
  const both = members.length > 1;
  const single = members[0];
  const sv = liveSurvey(s);
  const mine = !!sv && sv.recipients.includes(user.id);
  const answered = !!sv && answeredBy(s, sv.id, user.id);

  const actions: Actions = {
    onPay: setPay,
    onProfile: (id) => { writePref(user.id, 'fam.sel', id); navigate('/health'); },
  };
  const photoLabel = (p: Photo) => {
    const a = photoActivityLabel(s, p.activity, fmt.lang) || t('family.clubPhoto');
    return t(p.media === 'video' ? 'family.photoAriaVideo' : p.kind === 'group' ? 'family.photoAriaGroup' : 'family.photoAria', { a, t: p.time });
  };
  const photoDays = trimDays(familyPhotoDays(s, who, 2));
  const shown = photosInOrder(photoDays);
  const setLabel = (x: PhotoSet) => {
    if (x.kind === 'solo') return both ? memberShort(s.members[x.memberId!]) : t('family.soloPhotos', { n: memberShort(single) });
    if (x.kind === 'both') return t('family.groupWithBoth');
    return both ? t('family.groupOther') : t('family.groupWith', { o: pron(single).o, n: memberShort(single) });
  };
  const greeting = t(nowMin < 12 * 60 ? 'family.goodMorning' : 'family.goodAfternoon', { n: user.contact.firstName });
  const notes = members.map((m) => ({ m, n: sharedNoteOf(s, m.id) })).filter((x) => x.n);

  const quick: { icon: string; label: string; to: string }[] = [
    { icon: 'chat', label: t('family.messageClub'), to: '/chat' },
    { icon: 'calendar_month', label: t('family.calendarBtn'), to: '/calendar' },
    { icon: 'contacts', label: t('family.contactsBtn'), to: '/contacts' },
  ];

  return (
    <div style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 3vw, 32px)', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 8 }}>
        <Cap>{fmt.fdl(today)}</Cap>
        <H1>{greeting}</H1>
      </div>
      {multi ? <FamSwitch label={t('family.switcher')} value={sel} onChange={setSel} items={[...choices.map((id) => ({ key: id, label: memberShort(s.members[id]) })), { key: 'both', label: choices.length > 2 ? t('family.everyone') : t('family.both') }]} /> : null}
      {both ? members.map((m) => <ParentCard key={m.id} m={m} a={actions} />) : <MemberCard m={single} a={actions} onPay={setPay} onDetails={setDetail} onBilling={() => navigate('/billing')} />}
      {sv && mine ? (
        <div style={fcard('', 12)} data-testid="survey-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="rate_review" size={26} color="#6E5A43" weight={300} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Cap>{t('family.surveyEyebrow')}</Cap>
              <span style={{ fontSize: 19, lineHeight: '26px', fontWeight: 400, color: '#2B231C' }}>{sv.title}</span>
            </div>
          </div>
          <span style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>{answered ? t('family.surveyThanks') : t('family.surveyAsk')}</span>
          {!answered ? <Button size={48} full onClick={() => setSurvey(true)}>{t('family.surveyBtn')}</Button> : null}
        </div>
      ) : null}
      <Timeline members={members} onFeedback={() => setFeedback(true)} onOpenPhoto={(p) => setViewer({ photos: [p], startId: p.id })} />
      <div style={fcard('', 14)} data-testid="photos-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <H2>{t('family.photos')}</H2>
          <button type="button" onClick={() => navigate('/photos')} style={linkBtn}>{t('common.seeAll')}</button>
        </div>
        {photoDays.length ? photoDays.map((d) => (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Cap>{d.date === today ? t('common.today') : fmt.fdl(d.date)}</Cap>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.sets.map((x) => (
                <div key={x.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{setLabel(x)}</div>
                  <PhotoGrid photos={x.photos} size="sm" label={photoLabel} onOpen={(p) => setViewer({ photos: shown, startId: p.id })} />
                </div>
              ))}
            </div>
          </div>
        )) : <div style={{ fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('family.phEmpty')}</div>}
      </div>
      {!both ? <PlanCard m={single} showName={false} /> : (
        <>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 3vw, 32px)' }}>
              <PlanCard m={m} showName />
              <InvoiceCard m={m} showName noPay onPay={setPay} onDetails={setDetail} onBilling={() => navigate('/billing')} />
            </div>
          ))}
          <div style={fcard('', 10)}>
            <Cap>{t('family.plansTitle')}</Cap>
            <span style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>{t('family.plansBoth')}</span>
            <div><Button variant="secondary" size={48} onClick={() => navigate('/billing')}>{t('family.openBillingBoth')}</Button></div>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 0 8px' }}>
        {quick.map((q) => (
          <button key={q.to} type="button" onClick={() => navigate(q.to)} className="h-row cp-bleed"
            style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 2px', border: 'none', borderTop: '1px solid #E6DDD1', background: 'transparent', fontSize: 15, color: '#1E1A16', cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
            <Icon name={q.icon} size={20} color="#6E5A43" weight={300} />
            <span style={{ flex: 1 }}>{q.label}</span>
            <Icon name="arrow_forward" size={18} color="#6E5A43" />
          </button>
        ))}
        {notes.map(({ m, n }) => (
          <div key={m.id} style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, borderTop: '1px solid #E6DDD1', paddingTop: 16 }}>{both ? t('family.sharedNoteFor', { m: memberShort(m), n: n!.text }) : t('family.sharedNote', { n: n!.text })}</div>
        ))}
      </div>

      <PaySheet invoiceIds={pay || []} open={!!pay} onClose={closePay} />
      <SurveySheet open={survey} onClose={closeSurvey} />
      <LunchFeedbackSheet memberIds={members.map((m) => m.id)} open={feedback} onClose={closeFeedback} />
      {detail ? <InvoiceSheet invoiceId={detail} open onClose={closeDetail} audience="family" /> : null}
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </div>
  );
}
