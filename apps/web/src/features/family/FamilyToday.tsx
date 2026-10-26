// Family Today (round 8, the Family App prototype with KC's immersive header): the day's picture full-bleed at the top with the date chip and the bell on it,
// the parent(s) and the day at its foot (a row per parent, or one parent's icon rail); then a white panel slides up over it with the day strip, the day's
// timeline, the Lunch card (round 14: dishes, the lunch pictures, how much was eaten), the team's daily log (each session, mood, the note), the day's health checks (round 8d), its photos and a way to tell the kitchen about lunch. On a laptop (round 8b) it is two columns instead: the picture as a
// rounded card that stays in view on the left, the day (what the panel holds) scrolling on the right. Round 8c (the prototype's desktop): a heading above
// the columns ("Good morning, Maria"; "Looking back" and "Back to today" on an earlier day), the day strip as six tiles under the picture, the photos
// as rounded tiles. `?date=YYYY-MM-DD` shows an earlier day;
// `?member=` and `?survey=1` still work. The club is drop-in: members come on any open day, so there is no booking, leave, "expected" or "not coming".
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, answeredBy, live, liveSurvey, displayName, sortBy, type ISODate, type Member, type Photo } from '@cp/shared';
import { activityLabel, roomLabel, dayStory, dishNamesOf, END_OF_DAY, familyPhotosOn, servedLunch, storyNowMin, visitDays, type DayStory } from '@cp/shared/rules/family';
import { openDayStrip, planDay } from '@cp/shared/rules/famToday';
import { eventTitle as calTitle, upcomingClosures } from '@cp/shared/rules/calendar';
import { celebrationsOn } from '@cp/shared/rules/celebrations';
import { occasionsThisWeek } from '@cp/shared/rules/occasions';
import { occasionLine } from '../../lib/occasions';
import { Icon, PhotoImg } from '../../components/ui';
import { NotificationBell } from '../../shell/Notifications';
import { useUi } from '../../store/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Cap, DESK_EYEBROW, F, FamPage, FillCard, HAIR, IconTile, List, TextLink, useFamWide } from './kit';
import { DayPhotoCards } from './PhotoFeed';
import { useDevice } from '../../hooks/useDevice';
import { DayPicker, DayStrip } from './DayStrip';
import { FrostChip, Hero, PANEL_OVERLAP } from './StoryHero';
import { ParentSwitch } from './ParentSwitch';
import { Timeline } from './Timeline';
import { DailyLogSection } from './TeamLog';
import { LunchCard } from './LunchCard';
import { TodayHealthSection } from './TodayHealth';
import { cap, dayWord, namesOf } from './storyBits';
import { LunchFeedbackSheet, SurveySheet } from './sheets';
import { useFamilyCtx, useFamilySel } from './useFamily';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const inkButton: CSSProperties = { height: 46, border: 'none', borderRadius: 999, background: F.ink, color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', padding: '0 20px' };

/** A calm ochre note for a club closure or holiday in the next 7 days (today's is the hero's job); several show as a short list, none shows nothing. */
function ClosureNotice() {
  const { s, t, fmt, now } = useFamilyCtx();
  const rows = upcomingClosures(s, now.today);
  if (!rows.length) return null;
  const day = (d: string) => fmt.fd(d, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  return (
    <section aria-label={t('cal.famClosureLabel')} data-testid="closure-notice">
      <FillCard radius={22} gap={10} pad="14px 16px" style={{ background: F.ochreBg, color: F.ochre }}>
        {rows.map((r) => {
          const what = r.to === r.from ? t('cal.famClosedOn', { d: day(r.from) }) : t('cal.famClosedRange', { a: day(r.from), b: day(r.to) });
          const title = cap(calTitle(r, fmt.lang));
          return (
            <div key={r.eventId} data-testid="closure-row" data-event={r.eventId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, lineHeight: '21px' }}>
              <Icon name={r.kind === 'holiday' ? 'flag' : 'event_busy'} size={20} fill={1} color={F.ochre} style={{ marginTop: 1 }} />
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span style={{ fontWeight: 600 }}>{what}</span>{title ? ` · ${title}` : ''}</span>
            </div>
          );
        })}
      </FillCard>
    </section>
  );
}

/** The recent lunch feedback (last 30 days) with the kitchen's replies, here in the app. */
function RecentFeedback({ memberIds }: { memberIds: string[] }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const since = addDays(now.today, -30);
  const rows = sortBy(live(s.feedback).filter((f) => memberIds.includes(f.memberId) && f.createdAt.slice(0, 10) >= since), (f) => f.createdAt, -1).slice(0, 3);
  if (!rows.length) return null;
  const when = (at: string) => (at.slice(0, 10) === now.today ? `${t('common.today')} ${at.slice(11, 16)}` : fmt.fds(at.slice(0, 10)));
  const status = (f: (typeof rows)[number]) => (f.status === 'open' ? { text: t('family.lunchFbWaiting'), dot: '#C9A35A' } : f.status === 'answered' ? { text: t('family.lunchFbAnswered'), dot: F.sageDot } : { text: t('family.lunchFbClosed'), dot: F.chev });
  return (
    <section data-testid="lunch-feedback" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('family.lunchFb')}</Cap>
      <List>
        {rows.map((f, i) => {
          const st = status(f);
          const day = fmt.fd(f.mealDate, { weekday: 'long', day: 'numeric', month: 'short' });
          return (
            <div key={f.id} data-feedback={f.id} data-status={f.status} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderTop: i ? HAIR : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px' }}>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4, minWidth: 0, color: F.text }}>{[f.dish, day].filter(Boolean).join(' · ')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: F.soft, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: st.dot }} />{st.text}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, lineHeight: '20px', color: F.soft, overflowWrap: 'anywhere' }}>“{f.text}”</span>
                <span style={{ fontSize: 12, color: F.muted }}>{t(f.source === 'staff' ? 'family.lunchFbPhone' : 'family.lunchFbYou', { when: when(f.createdAt) })}</span>
              </div>
              {(f.replies || []).map((r) => (
                <div key={r.id} data-testid="kitchen-reply" style={{ padding: '10px 12px', borderRadius: 12, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: F.text, overflowWrap: 'anywhere' }}>{r.text}</span>
                  <span style={{ fontSize: 12, color: F.sage }}>{t('family.lunchFbKitchen', { when: when(r.at) })}</span>
                </div>
              ))}
            </div>
          );
        })}
      </List>
    </section>
  );
}

/**
 * KC round 10 (the analysis: "a day the parent stayed home shows the programme they missed first"): on a day nobody came, the last visit leads — when it was,
 * arrived and home, the mood, how lunch went, what they joined, and its first pictures. A tap opens that day. One card: the most recent visit of any of them.
 */
function LastVisitCard({ members, stories, onOpen, onOpenPhoto }: { members: Member[]; stories: DayStory[]; onOpen: (d: ISODate) => void; onOpenPhoto: (p: Photo, all: Photo[]) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const wide = useFamWide();
  const last = stories.map((st) => st.lastVisit).filter((d): d is ISODate => !!d).sort().pop();
  const came = last ? members.filter((m) => visitDays(s, m.id, last).includes(last)) : [];
  const story = useMemo(() => (last && came[0] ? dayStory(s, came[0], last, END_OF_DAY) : null), [s, came, last]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = useMemo(() => (last ? familyPhotosOn(s, came.map((m) => m.id), last) : []), [s, came, last]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last || !story) return null;
  const when = `${cap(dayWord(fmt, last, now.today))} · ${fmt.fd(last, { day: 'numeric', month: 'short' })}`;
  const times = story.arrivedAt && story.leftAt ? t('family.storyArrivedHome', { a: story.arrivedAt, b: story.leftAt }) : story.arrivedAt ? t('family.storyArrived', { a: story.arrivedAt }) : '';
  const joined = Array.from(new Set(story.sessions.filter((x) => x.took !== 'satOut').map((x) => activityLabel(s, x.activityId, fmt.lang)).filter(Boolean))).slice(0, 2);
  const bits = [story.log?.mood ? t('family.mood_' + story.log.mood) : '', story.lunch?.amount ? t('family.lunch_' + story.lunch.amount) : '', joined.length ? t('ftoday.lvSessions', { a: joined.join(` ${t('common.and')} `) }) : ''].filter(Boolean);
  const who = came.length > 1 ? namesOf(t, came) : came[0] ? displayName(came[0]) : '';
  const thumbs = photos.slice(0, 3);
  return (
    <section data-testid="last-visit-card" data-date={last} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('ftoday.lastVisit')}</Cap>
      <FillCard radius={22} pad={14} gap={10} testId="last-visit-body">
        {/* the header row opens that day (the card itself is not a button: the pictures inside are buttons of their own) */}
        <button type="button" onClick={() => onOpen(last)} data-testid="last-visit-open" className="cp-press" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: F.text }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: F.text, lineHeight: 1.3 }}>{when}{came.length > 1 || members.length > 1 ? ` · ${who}` : ''}</span>
            {times ? <span style={{ fontSize: 14, color: F.soft }}>{times}</span> : null}
            {bits.length ? <span style={{ fontSize: 13, color: F.muted, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{bits.join(' · ')}</span> : null}
          </span>
          <Icon name="chevron_right" size={22} color={F.chev} />
        </button>
        {thumbs.length ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {thumbs.map((p, i) => (
              <button key={p.id} type="button" onClick={() => onOpenPhoto(p, photos)} aria-label={famPhotoAriaLite(fmt.fds(p.date), p.time)} data-photo-id={p.id}
                style={{ position: 'relative', flex: '1 1 0', minWidth: 0, aspectRatio: wide ? '4 / 3' : '1', borderRadius: 12, overflow: 'hidden', border: 'none', padding: 0, background: '#FFFFFF', cursor: 'pointer' }}>
                <PhotoImg photo={p} />
                {i === thumbs.length - 1 && photos.length > thumbs.length ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,16,.45)', color: '#FFFFFF', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{photos.length - thumbs.length}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: F.muted }}>
          {photos.length ? <span>{photos.length === 1 ? t('ftoday.lvPhotosOne') : t('ftoday.lvPhotosN', { n: photos.length })} · </span> : null}
          <TextLink size={13} onClick={() => onOpen(last)} style={{ minHeight: 24 }}>{t('ftoday.lvOpen')}</TextLink>
        </span>
      </FillCard>
    </section>
  );
}
const famPhotoAriaLite = (day: string, time: string) => `${day} · ${time}`;

/** Round 12: a confirmed celebration of one of these parents on the day shown (the club has said yes): what, when, where, and the cake. Only confirmed ones reach a family. */
function CelebrationCard({ members, date }: { members: Member[]; date: ISODate }) {
  const { s, t, fmt } = useFamilyCtx();
  const navigate = useNavigate();
  const ids = members.map((m) => m.id);
  const list = celebrationsOn(s, date).filter((c) => ids.includes(c.memberId));
  if (!list.length) return null;
  return (
    <section data-testid="celebration-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('celeb.famCard')}</Cap>
      {list.map((c) => (
        <FillCard key={c.id} radius={22} pad={14} gap={10} testId="celebration-body">
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <IconTile icon="cake" size={40} iconSize={22} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: F.text, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{c.title}</span>
              <span style={{ fontSize: 14, color: F.soft }}>{t('celeb.famSub', { from: c.from, to: c.to, room: roomLabel(s, c.roomId, fmt.lang) })}</span>
              <span style={{ fontSize: 13, color: F.muted, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{[t(c.guests === 1 ? 'celeb.guest1' : 'celeb.guests', { n: c.guests }), c.cateringNote].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <TextLink size={13} onClick={() => navigate(`/calendar?date=${c.date}`)} style={{ minHeight: 24 }}>{t('celeb.famOpen')}</TextLink>
        </FillCard>
      ))}
    </section>
  );
}

/** Round 12: one of these parents has a birthday in the coming week ("Opa Budi turns 80 on Monday"): a quiet card, only while looking at today. */
function BirthdayCard({ members, today }: { members: Member[]; today: ISODate }) {
  const { s, t, fmt } = useFamilyCtx();
  const ids = members.map((m) => m.id);
  const list = occasionsThisWeek(s, today).filter((o) => o.kind === 'birthday' && ids.includes(o.member.id));
  if (!list.length) return null;
  return (
    <section data-testid="birthday-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Cap>{t('occasions.famCard')}</Cap>
      {list.map((o) => (
        <FillCard key={o.member.id} radius={22} pad={14} gap={10} testId="birthday-body">
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconTile icon="cake" size={40} iconSize={22} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, color: F.text, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{occasionLine(t, fmt.lang, o, today, displayName(o.member))}</span>
          </span>
        </FillCard>
      ))}
    </section>
  );
}

export function FamilyToday() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const navigate = useNavigate();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const { isPhone } = useDevice();
  const wide = useFamWide();
  const [sp, setSp] = useSearchParams();
  const [survey, setSurvey] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  const closeSurvey = useCallback(() => setSurvey(false), []);
  const closeFeedback = useCallback(() => setFeedback(false), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  // a notification can open the survey straight away (/today?survey=1)
  useEffect(() => {
    if (sp.get('survey') !== '1') return;
    setSurvey(true);
    const next = new URLSearchParams(sp);
    next.delete('survey');
    setSp(next, { replace: true });
  }, [sp, setSp]);

  const { today, nowMin } = now;
  // the day being read: `?date=` (a past day), else today
  const asked = sp.get('date');
  // KC round 9: besides today and earlier days, the day ahead (tomorrow's plan) can be read
  const ahead = useMemo(() => planDay(s, today), [s, today]);
  const date: ISODate = asked && ISO_DAY.test(asked) && (asked <= today || asked === ahead) ? asked : today;
  const isToday = date === today;
  const isPlan = date > today;
  const whoKey = who.join(',');
  const members = useMemo(() => who.map((id) => s.members[id]).filter(Boolean), [s, whoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stories = useMemo(() => members.map((m) => dayStory(s, m, date, storyNowMin(date, today, nowMin))), [s, members, date, today, nowMin]);
  const visitSet = useMemo(() => new Set(who.flatMap((id) => visitDays(s, id, today))), [s, whoKey, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const strip = useMemo(() => openDayStrip(s, who, today, date, 6, true), [s, whoKey, today, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = useMemo(() => familyPhotosOn(s, who, date), [s, whoKey, date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !members.length) return null;
  const setDate = (d: ISODate) => {
    const next = new URLSearchParams(sp);
    if (d === today) next.delete('date'); else next.set('date', d);
    setSp(next, { replace: true });
  };
  const sv = liveSurvey(s);
  const mine = !!sv && sv.recipients.includes(user.id);
  const answered = !!sv && answeredBy(s, sv.id, user.id);
  const openPhoto = (p: Photo, all?: Photo[]) => setViewer({ photos: all ?? [p], startId: p.id });
  const toTop = () => document.getElementById('main')?.scrollTo?.({ top: 0 });
  const focus = (id: string) => { setSel(id); toTop(); };


  // lunch feedback: when the day has a lunch and someone came (or it is today); the row says what was served, or that the kitchen has been told
  const ids = members.map((m) => m.id);
  // like the prototype: lunch feedback only on a day one of them came (and so had the lunch)
  const hasLunch = stories.some((st: DayStory) => st.lunch) && stories.some((st) => st.visited);
  const sent = sortBy(live(s.feedback).filter((f) => ids.includes(f.memberId) && f.mealDate === date && f.source === 'family'), (f) => f.createdAt, -1)[0];
  const dishes = dishNamesOf(s, servedLunch(s, members[0], date)).slice(0, 2).join(', ');
  const fbSub = sent ? t(sent.status === 'answered' ? 'ftoday.fbReplied' : 'ftoday.fbSent') : dishes ? (isToday ? t('ftoday.fbSubToday', { dish: dishes }) : t('ftoday.fbSubDay', { dish: dishes, d: dayWord(fmt, date, today) })) : t('ftoday.fbSubNone');

  // laptop: the page's own heading above the columns (the prototype's "Good morning, Maria"); an earlier day reads "Looking back" with a way back
  const first = user.contact.firstName;
  const greeting = t(now.nowMin < 12 * 60 ? 'family.goodMorning' : now.nowMin < 18 * 60 ? 'family.goodAfternoon' : 'ftoday.goodEvening', { n: first });
  const heading = (
    <div key="heading" data-testid="today-heading" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={DESK_EYEBROW}>{fmt.fdl(date)}</span>
        <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.05, fontWeight: 400, letterSpacing: '-1.1px', color: F.ink, overflowWrap: 'anywhere' }}>{isToday ? greeting : isPlan ? (date === addDays(today, 1) ? t('ftoday.planTitleTomorrow') : t('ftoday.planTitleDay', { d: fmt.fd(date, { weekday: 'long' }) })) : t('family.storyLooking')}</h1>
      </div>
      {!isToday ? <button type="button" onClick={() => setDate(today)} data-testid="back-to-today" className="cp-fam-press" style={{ flex: 'none', height: 40, padding: '0 16px', border: 'none', borderRadius: 999, background: F.fill, color: F.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{t('ftoday.backToday')}</button> : null}
    </div>
  );

  const hero = (
    <Hero key="hero" members={members} stories={stories} date={date} onFocus={focus} onProfile={(id) => navigate(`/profile?member=${id}`)} onOpenPhoto={openPhoto}
      top={(
        <div data-testid="today-header" data-date={date} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* KC round 9: one tap from Oma to Opa (or back to both), no "‹ Both parents" step in between */}
            {multi ? <ParentSwitch members={choices.map((id) => s.members[id]).filter(Boolean)} sel={sel} onPick={(id) => (id === 'both' ? setSel('both') : focus(id))} /> : null}
            <DayPicker chip={fmt.fd(date, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '')} value={date} visits={visitSet} today={today} onPick={setDate} />
            {!isToday && !wide ? <FrostChip testId="back-to-today" onClick={() => setDate(today)}>{t('common.today')}</FrostChip> : null}
          </div>
          {/* the bell floats on the picture on a phone; the tablet and laptop sidebars have Notifications (so there is only ever one bell anchor) */}
          {isPhone ? <NotificationBell variant="hero" onClick={() => useUi.getState().setBell(true)} /> : null}
        </div>
      )} />
  );

  // the day: the strip, closures, timeline, daily log, health, photos, lunch feedback and, last, the quick survey (the white panel on a phone and tablet, the right column on a laptop)
  const day = (
    <div key="day" data-testid="today-panel" style={wide
      ? { display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }
      : { position: 'relative', zIndex: 1, marginTop: -PANEL_OVERLAP, background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 18, minHeight: '50vh', boxShadow: '0 -1px 0 rgba(255,255,255,.4)' }}>
      {wide ? null : <span aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 999, background: '#D4D4D8', marginBottom: -4, flex: 'none' }} />}
      {wide ? null : <DayStrip days={strip} selected={date} onPick={setDate} />}

      <ClosureNotice />

      {/* KC round 10: today, when nobody has come (and the club is shut for the day or they are simply home), the last visit comes first */}
      {isToday && !stories.some((st) => st.visited) && stories.some((st) => st.state.kind === 'away') ? <LastVisitCard members={members} stories={stories} onOpen={setDate} onOpenPhoto={openPhoto} /> : null}

      {isToday ? <BirthdayCard members={members} today={today} /> : null}

      <CelebrationCard members={members} date={date} />

      <Timeline members={members} stories={stories} date={date} onOpenPhoto={openPhoto} onDay={setDate}
        lunchFeedback={hasLunch ? { label: sent ? fbSub : t('ftoday.fbRow'), onClick: () => setFeedback(true) } : undefined} />

      {isPlan ? null : <LunchCard members={members} stories={stories} past={!isToday} onOpenPhoto={openPhoto} />}

      {isPlan ? null : <DailyLogSection members={members} stories={stories} date={date} onOpenDay={setDate} />}

      {isPlan ? null : <TodayHealthSection members={members} stories={stories} date={date} />}

      {photos.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Cap right={<TextLink size={14} onClick={() => navigate('/photos')} testId="photos-all" style={{ minHeight: 24 }}>{t('ftoday.allN', { n: photos.length })}</TextLink>}>{t('family.photos')}</Cap>
          {/* KC round 9: big cards swiped sideways instead of six small tiles; a tap opens the viewer, which grows out of the card */}
          <DayPhotoCards photos={photos} onOpen={(p) => openPhoto(p, photos)} wide={wide} testId="day-photos" />
        </section>
      ) : null}

      {hasLunch ? (
        <FillCard onClick={() => setFeedback(true)} testId="lunch-feedback-row" radius={18} pad={14} gap={12} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconTile icon="restaurant" size={36} radius={11} iconSize={20} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{t('ftoday.fbRow')}</span>
            <span style={{ fontSize: 13, color: F.muted, overflowWrap: 'anywhere' }}>{fbSub}</span>
          </span>
          <Icon name="chevron_right" size={22} color={F.chev} />
        </FillCard>
      ) : null}
      <RecentFeedback memberIds={ids} />

      {/* KC round 9: the quick survey is the last thing on the day */}
      {isToday && sv && mine ? (
        <FillCard testId="survey-card" radius={22} gap={8}>
          <span style={{ fontSize: 13, letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600, color: F.eyebrow }}>{t('family.surveyEyebrow')}</span>
          <span style={{ fontSize: 17, lineHeight: '24px', fontWeight: 500, color: F.text }}>{sv.title}</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: F.muted }}>{answered ? t('family.surveyThanks') : t('family.surveyAsk')}</span>
          {!answered ? <button type="button" onClick={() => setSurvey(true)} style={{ ...inkButton, marginTop: 4 }}>{t('family.surveyBtn')}</button> : null}
        </FillCard>
      ) : null}
    </div>
  );
  const overlays = (
    <>
      <SurveySheet open={survey} onClose={closeSurvey} />
      <LunchFeedbackSheet memberIds={ids} date={date} open={feedback} onClose={closeFeedback} />
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </>
  );

  if (wide) {
    // laptop: the heading, then the picture and the day strip stay in view on the left while the day scrolls on the right
    return (
      <FamPage wide testId="family-today" gap={24}>
        {heading}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 1fr)', gap: 32, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {hero}
            <DayStrip tiles days={strip} selected={date} onPick={setDate} />
          </div>
          {day}
        </div>
        {overlays}
      </FamPage>
    );
  }
  return (
    <div data-testid="family-today" style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: isPhone ? 0 : '24px 16px 0', boxSizing: 'border-box' }}>
      {hero}
      {day}
      {overlays}
    </div>
  );
}
