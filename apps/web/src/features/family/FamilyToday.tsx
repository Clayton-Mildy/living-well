// Family Today (design ScrFamily 931–1042): greeting, member switcher, member card(s), survey, timeline, photos, team log, plan and invoice, links.
// The club is drop-in: members come on any open day, so there is no booking, leave, "expected" or "not coming". A member is at the club since
// a time, went home at a time, or is simply not at the club today. Flex shows visits used this month; Gold is "come any open day".
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  answeredBy, firstOfRole, initials, isPrimaryFor, liveSurvey, memberName, memberShort, memberSince, planOn, rp, staffCall, todayReading, type Member, type Photo,
} from '@cp/shared';
import {
  dayStateOf, familyPhotoDays, invoiceRows, latestLog, mayStillCome, openInvoiceRows, openTotal, photoActivityLabel, photosInOrder, planSummary, sharedNoteOf, staffFirst, staffIdOf, type DayState,
  type PhotoDay, type PhotoSet,
} from '@cp/shared/rules/family';
import { Avatar, Button, Icon, TONES, photoBg, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { writePref } from '../../store/session';
import { PhotoViewer } from '../activity/PhotoViewer';
import { InvoiceSheet } from '../finance/InvoiceSheet';
import { Cap, FamSwitch, H1, HealthPill, PhotoGrid, SOFT_SHADOW, StatusBanner, fcard, H2 } from './parts';
import { Timeline } from './Timeline';
import { InvoiceCard, PlanCard } from './PlanCard';
import { LogBlock, TeamLogCard } from './TeamLog';
import { LunchFeedbackSheet, PaySheet, SurveySheet } from './sheets';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';
import { memberPhoto, photoFill } from '../../lib/media';

type Banner = { icon: string; bg: string; fg: string; text: string; sub?: string };

/** Where the member is today, as a banner: at the club since…, went home at…, or (neutral) not at the club today. */
function useBanner(m: Member, st: DayState): Banner {
  const { s, t, fmt, now } = useFamilyCtx();
  switch (st.kind) {
    case 'here': return { icon: 'check_circle', bg: '#E6EFE8', fg: '#3D6B4F', text: t('family.atSince', { t: st.since }), sub: t('family.checkedInBy', { s: staffFirst(s, staffIdOf(st.att.checkIn?.by)) || t('family.theLobby') }) };
    case 'home': return { icon: 'home', bg: '#F4F0EE', fg: '#282828', text: t('family.wentHome', { t: st.at }), sub: t('family.visitSpan', { a: st.att.checkIn?.at || '', b: st.at }) };
    // they may still drop in while the club is open, so "right now"; "today" is for after closing
    case 'away': return { icon: 'event', bg: '#F4F0EE', fg: '#282828', text: t(mayStillCome(s, now.nowMin) ? 'family.notNow' : 'family.notToday'), sub: t('family.famUsually', { t: m.usualArrival }) };
    case 'closed': return { icon: 'event_busy', bg: '#F4F0EE', fg: '#282828', text: t('family.stClosed'), sub: t(st.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fmt.fdl(st.next) }) };
    case 'ended': return { icon: 'archive', bg: '#EFECEA', fg: '#282828', text: t('family.stEnded', { d: fmt.fds(st.lastDay) }) };
    case 'upcoming': return { icon: 'event', bg: '#F4F0EE', fg: '#282828', text: t('family.stUpcoming', { d: fmt.fds(st.start) }) };
  }
}

interface Actions {
  onPay: (ids: string[]) => void;
  onProfile: (id: string) => void;
}

const initialsOf = (m: Member) => initials(memberName(m));
const nurseName = (s: Parameters<typeof firstOfRole>[0], t: (k: string) => string) => staffCall(firstOfRole(s, 'nurse')) || t('roles.nurse');

/** Both mode: one card per parent with the day's status, health results, the team log with comments, and their own Pay action. */
function ParentCard({ m, a }: { m: Member; a: Actions }) {
  const { s, t, now, user } = useFamilyCtx();
  const { today } = now;
  const st = dayStateOf(s, m, today);
  const banner = useBanner(m, st);
  const fg = TONES[m.photoTone % 5][1];
  const plan = planSummary(s, m, today);
  const visiting = st.kind === 'here' || st.kind === 'home';
  const arr = visiting ? todayReading(s, m.id, today, 'arrival') : undefined;
  const dep = visiting ? todayReading(s, m.id, today, 'departure') : undefined;
  const log = latestLog(s, m.id, today);
  const open = openInvoiceRows(invoiceRows(s, [m.id], today));
  const canPay = !!user && isPrimaryFor(s, user.id, m.id) && open.length > 0;
  const bp = [arr && { label: t('family.bpArrival', { t: arr.time }), r: arr }, dep && { label: t('family.bpDeparture', { t: dep.time }), r: dep }].filter(Boolean) as { label: string; r: NonNullable<typeof arr> }[];
  return (
    <section aria-label={memberName(m)} style={fcard('16px', 12, { boxShadow: SOFT_SHADOW })} data-testid="parent-card" data-member={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 999, background: photoFill(memberPhoto(m), photoBg(m.photoTone)), color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500, flex: 'none', boxShadow: 'inset 0 0 0 2px #FFFFFF, 0 0 0 1px #CAB8A2' }}>{m.photoMediaId ? null : initialsOf(m)}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 18, lineHeight: '24px', fontWeight: 500 }}>{memberName(m)}</span>
          <span style={{ fontSize: 16, lineHeight: '22px', color: '#6A6967' }}>{plan.plan === 'flex' ? t('family.planUsedLine', { n: plan.used, q: plan.quota ?? 0 }) : t('family.planGoldLine')}</span>
        </div>
        <Button variant="secondary" size={44} onClick={() => a.onProfile(m.id)} style={{ padding: '0 14px' }}>{t('family.profile')}</Button>
      </div>
      <StatusBanner {...banner} compact />
      {bp.map((b) => (
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid #EFECEA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontSize: 16, lineHeight: '22px', fontVariantNumeric: 'tabular-nums' }}>{b.r.sys}/{b.r.dia}{b.r.spo2 ? t('family.oxygen', { o: b.r.spo2 }) : ''}</span>
          </div>
          <HealthPill status={b.r.status} />
        </div>
      ))}
      {!bp.length ? <span className="cp-hide-phone" style={{ fontSize: 16, lineHeight: '22px', color: '#6A6967' }}>{st.kind === 'here' ? t('family.healthSoon', { n: nurseName(s, t) }) : st.kind === 'away' && mayStillCome(s, now.nowMin) ? t('family.healthOnArrival') : t('family.noHealthToday')}</span> : null}
      {log ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid #EFECEA' }}>
          <Cap>{t('family.notesTeam')}</Cap>
          <LogBlock m={m} log={log} />
        </div>
      ) : null}
      {canPay ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
          <Button size={44} icon="account_balance" onClick={() => a.onPay(open.map((r) => r.inv.id))} style={{ flex: '1 1 100%' }}>{t('family.payAmount', { a: rp(openTotal(open)) })}</Button>
        </div>
      ) : null}
    </section>
  );
}

/** Single member card (design `notBoth`): avatar, name, plan, Profile and the status banner. */
function MemberCard({ m, a }: { m: Member; a: Actions }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const { isPhone } = useDevice();
  const st = dayStateOf(s, m, now.today);
  const banner = useBanner(m, st);
  const plan = planOn(m, now.today).plan;
  const last = m.memberships[m.memberships.length - 1];
  const since = memberSince(m);
  const sub = [`${t(plan === 'flex' ? 'family.planFlex' : 'family.planGold')} · ${t('family.sinceL', { d: since ? fmt.fmonth(since.slice(0, 7), true) : '' })}`, last?.lastDay && st.kind !== 'ended' ? t('family.endsOn', { d: fmt.fds(last.lastDay) }) : ''].filter(Boolean).join(' · ');
  return (
    <section aria-label={memberName(m)} style={fcard('18px', 14, { boxShadow: SOFT_SHADOW })} data-testid="member-card" data-member={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={isPhone ? 52 : 68} ring />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: isPhone ? 19 : 21, lineHeight: isPhone ? '26px' : '28px', letterSpacing: '-0.3px' }}>{memberName(m)}</div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</div>
        </div>
        <Button variant="secondary" size={44} onClick={() => a.onProfile(m.id)} style={{ padding: '0 14px' }}>{t('family.profile')}</Button>
      </div>
      <StatusBanner {...banner} />
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

  return (
    <div style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 18, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 2 : 6, padding: '4px 4px 0' }}>
        <Cap style={{ color: '#6A6967' }}>{fmt.fdl(today)}</Cap>
        <H1>{greeting}</H1>
      </div>
      {multi ? <FamSwitch label={t('family.switcher')} value={sel} onChange={setSel} items={[...choices.map((id) => ({ key: id, label: memberShort(s.members[id]) })), { key: 'both', label: choices.length > 2 ? t('family.everyone') : t('family.both') }]} /> : null}
      {both ? members.map((m) => <ParentCard key={m.id} m={m} a={actions} />) : null}
      {sv && mine ? (
        <div style={fcard('16px 18px', 10, { border: '2px solid #75624B' })} data-testid="survey-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="rate_review" size={26} color="#75624B" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Cap>{t('family.surveyEyebrow')}</Cap>
              <span style={{ fontSize: 18, lineHeight: '24px' }}>{sv.title}</span>
            </div>
          </div>
          <span style={{ fontSize: 16, lineHeight: '24px' }}>{answered ? t('family.surveyThanks') : t('family.surveyAsk')}</span>
          {!answered ? <Button size={48} full onClick={() => setSurvey(true)}>{t('family.surveyBtn')}</Button> : null}
        </div>
      ) : null}
      {!both ? <MemberCard m={single} a={actions} /> : null}
      <Timeline members={members} onFeedback={() => setFeedback(true)} onOpenPhoto={(p) => setViewer({ photos: [p], startId: p.id })} />
      <div style={fcard('20px 18px', 14)} data-testid="photos-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <H2>{t('family.photos')}</H2>
          <Button variant="ghost" size={44} onClick={() => navigate('/photos')} style={{ padding: '0 12px' }}>{t('common.seeAll')}</Button>
        </div>
        {photoDays.length ? photoDays.map((d) => (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Cap>{d.date === today ? t('common.today') : fmt.fdl(d.date)}</Cap>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.sets.map((x) => (
                <div key={x.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{setLabel(x)}</div>
                  <PhotoGrid photos={x.photos} size="sm" label={photoLabel} onOpen={(p) => setViewer({ photos: shown, startId: p.id })} />
                </div>
              ))}
            </div>
          </div>
        )) : <div style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('family.phEmpty')} {t('family.phEmptySub')}</div>}
      </div>
      {!both ? <TeamLogCard m={single} /> : null}
      {!both ? (
        <>
          <PlanCard m={single} showName={false} />
          <InvoiceCard m={single} showName={false} onPay={setPay} onDetails={setDetail} onBilling={() => navigate('/billing')} />
        </>
      ) : (
        <>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <PlanCard m={m} showName />
              <InvoiceCard m={m} showName noPay onPay={setPay} onDetails={setDetail} onBilling={() => navigate('/billing')} />
            </div>
          ))}
          <div style={fcard('16px 18px', 10)}>
            <Cap>{t('family.plansTitle')}</Cap>
            <span style={{ fontSize: 16, lineHeight: '24px' }}>{t('family.plansBoth')}</span>
            <Button variant="secondary" size={48} full onClick={() => navigate('/billing')}>{t('family.openBillingBoth')}</Button>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 8px' }}>
        <Button variant="secondary" size={56} full icon="chat" onClick={() => navigate('/chat')} style={{ height: 52 }}>{t('family.messageClub')}</Button>
        <Button variant="secondary" size={56} full icon="calendar_month" onClick={() => navigate('/calendar')} style={{ height: 52 }}>{t('family.calendarBtn')}</Button>
        <Button variant="secondary" size={56} full icon="contacts" onClick={() => navigate('/contacts')} style={{ height: 52 }}>{t('family.contactsBtn')}</Button>
        {notes.map(({ m, n }) => (
          <div key={m.id} style={{ fontSize: FONT_BODY, color: '#6A6967', textAlign: 'center', lineHeight: 1.4 }}>{both ? t('family.sharedNoteFor', { m: memberShort(m), n: n!.text }) : t('family.sharedNote', { n: n!.text })}</div>
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
