// Family Today, a day story you can browse back through (KC round 7): the day strip, the member over the day's best picture, a note from the team,
// the day's rail (activities with pictures, lunch, health, home), the day's photos, the month's memories, and the club's links. `?date=YYYY-MM-DD` shows an earlier
// day; `?member=` and `?survey=1` still work. The club is drop-in: members come on any open day, so there is no booking, leave, "expected" or "not coming".
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDays, answeredBy, firstOfRole, live, liveSurvey, memberShort, sortBy, waUrl, type ISODate, type Photo,
} from '@cp/shared';
import {
  bestPhotoOf, dayStory, dayStrip, familyPhotosOn, latestNote, photoActivityLabel, sharedNoteOf, storyNowMin, visitDays, type StripDay,
} from '@cp/shared/rules/family';
import { eventTitle as calTitle, upcomingClosures } from '@cp/shared/rules/calendar';
import { Button, GROUP_HEAD, Group, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { writePref } from '../../store/session';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Cap, FamSwitch, H1, PhotoGrid, SOFT_SHADOW, fcard } from './parts';
import { DayPicker, DayStrip } from './DayStrip';
import { GroupStory, MemberStory, ParentStory } from './StoryHero';
import { MemoriesTeaser } from './Memories';
import { Timeline } from './Timeline';
import { LogBlock } from './TeamLog';
import { quietLink } from './storyBits';
import { LunchFeedbackSheet, SurveySheet } from './sheets';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** KC round 6: the family's recent lunch feedback (last 30 days) with the kitchen's replies, here in the app (the bell opens Today). */
function LunchFeedback({ memberIds, phone }: { memberIds: string[]; phone: boolean }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const since = addDays(now.today, -30);
  const rows = sortBy(live(s.feedback).filter((f) => memberIds.includes(f.memberId) && f.createdAt.slice(0, 10) >= since), (f) => f.createdAt, -1).slice(0, 3);
  if (!rows.length) return null;
  const when = (at: string) => (at.slice(0, 10) === now.today ? `${t('common.today')} ${at.slice(11, 16)}` : fmt.fds(at.slice(0, 10)));
  const status = (f: (typeof rows)[number]) => f.status === 'open' ? { text: t('family.lunchFbWaiting'), dot: '#C9A35A' } : f.status === 'answered' ? { text: t('family.lunchFbAnswered'), dot: '#3D6B4F' } : { text: t('family.lunchFbClosed'), dot: '#A89C8E' };
  const items = rows.map((f, i) => {
    const st = status(f);
    const day = fmt.fd(f.mealDate, { weekday: 'long', day: 'numeric', month: 'short' });
    return (
      <div key={f.id} data-feedback={f.id} data-status={f.status} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: i ? 14 : 0, borderTop: i ? '1px solid #F0EAE1' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4, minWidth: 0 }}>{[f.dish, day].filter(Boolean).join(' · ')}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4A4038', whiteSpace: 'nowrap', flex: 'none' }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: st.dot }} />{st.text}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>“{f.text}”</span>
          <span style={{ fontSize: 13, color: '#6B6259' }}>{t(f.source === 'staff' ? 'family.lunchFbPhone' : 'family.lunchFbYou', { when: when(f.createdAt) })}</span>
        </div>
        {(f.replies || []).map((r) => (
          <div key={r.id} data-testid="kitchen-reply" style={{ padding: '10px 14px', borderRadius: 12, background: '#EAF1EC', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, lineHeight: '22px', color: '#24201C', overflowWrap: 'anywhere' }}>{r.text}</span>
            <span style={{ fontSize: 13, color: '#4A5E50' }}>{t('family.lunchFbKitchen', { when: when(r.at) })}</span>
          </div>
        ))}
      </div>
    );
  });
  return phone ? (
    <div data-testid="lunch-feedback"><Group title={t('family.lunchFb')}>{items}</Group></div>
  ) : (
    <div data-testid="lunch-feedback" style={fcard('', 12)}><Cap>{t('family.lunchFb')}</Cap>{items}</div>
  );
}

/** Round 7: a calm ochre note for a club closure or holiday in the next 7 days (today's is the timeline's job); several show as a short list, none shows nothing. */
function ClosureNotice({ phone }: { phone: boolean }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const rows = upcomingClosures(s, now.today);
  if (!rows.length) return null;
  const day = (d: string) => fmt.fd(d, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  return (
    <section aria-label={t('cal.famClosureLabel')} data-testid="closure-notice" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? '12px 14px' : '12px 16px', borderRadius: phone ? 14 : 10, background: '#F6ECD6', color: '#7A5510' }}>
      {rows.map((r) => {
        const what = r.to === r.from ? t('cal.famClosedOn', { d: day(r.from) }) : t('cal.famClosedRange', { a: day(r.from), b: day(r.to) });
        const title = cap(calTitle(r, fmt.lang));
        return (
          <div key={r.eventId} data-testid="closure-row" data-event={r.eventId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: phone ? 15 : 14, lineHeight: '21px' }}>
            <Icon name={r.kind === 'holiday' ? 'flag' : 'event_busy'} size={20} fill={1} color="#7A5510" style={{ marginTop: 1, flex: 'none' }} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span style={{ fontWeight: 600 }}>{what}</span>{title ? ` · ${title}` : ''}</span>
          </div>
        );
      })}
    </section>
  );
}

export function FamilyToday() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { isPhone } = useDevice();
  const navigate = useNavigate();
  const { choices, sel, who, setSel, multi } = useFamilySel();
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
  const date: ISODate = asked && ISO_DAY.test(asked) && asked <= today ? asked : today;
  const isToday = date === today;
  const whoKey = who.join(',');
  const members = useMemo(() => who.map((id) => s.members[id]).filter(Boolean), [s, whoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stories = useMemo(() => members.map((m) => dayStory(s, m, date, storyNowMin(date, today, nowMin))), [s, members, date, today, nowMin]);
  const visitSet = useMemo(() => new Set(who.flatMap((id) => visitDays(s, id, today))), [s, whoKey, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const strip = useMemo<StripDay[]>(() => {
    const days = dayStrip(s, who, today);
    if (days.some((d) => d.date === date)) return days;
    return sortBy([...days, { date, visited: visitSet.has(date), photo: bestPhotoOf(s, who, date), count: familyPhotosOn(s, who, date).length }], (d) => d.date);
  }, [s, whoKey, today, date, visitSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = useMemo(() => familyPhotosOn(s, who, date), [s, whoKey, date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !members.length) return null;
  const setDate = (d: ISODate) => {
    const next = new URLSearchParams(sp);
    if (d === today) next.delete('date'); else next.set('date', d);
    setSp(next, { replace: true });
  };
  const both = members.length > 1;
  const single = members[0];
  const sv = liveSurvey(s);
  const mine = !!sv && sv.recipients.includes(user.id);
  const answered = !!sv && answeredBy(s, sv.id, user.id);
  const openPhoto = (p: Photo, all?: Photo[]) => setViewer({ photos: all ?? [p], startId: p.id });
  const onProfile = (id: string) => { writePref(user.id, 'fam.sel', id); navigate('/health'); };
  const greeting = t(nowMin < 12 * 60 ? 'family.goodMorning' : 'family.goodAfternoon', { n: user.contact.firstName });
  const notes = members.map((m) => ({ m, n: sharedNoteOf(s, m.id) })).filter((x) => x.n);

  // "WhatsApp the club" is a real link (wa.me) to the front desk's number: the first active lobby staff. The other two rows open screens.
  const desk = waUrl(firstOfRole(s, 'lobby')?.phone);
  const quick: { icon: string; label: string; to?: string; href?: string }[] = [
    ...(desk ? [{ icon: 'chat', label: t('family.messageClub'), href: desk }] : []),
    { icon: 'calendar_month', label: t('family.calendarBtn'), to: '/calendar' },
    { icon: 'contacts', label: t('family.contactsBtn'), to: '/contacts' },
  ];
  const photoLabel = (p: Photo) => {
    const a = photoActivityLabel(s, p.activity, fmt.lang) || t('family.clubPhoto');
    return t(p.media === 'video' ? 'family.photoAriaVideo' : p.kind === 'group' ? 'family.photoAriaGroup' : p.kind === 'activity' ? 'family.photoAriaAct' : 'family.photoAria', { a, t: p.time });
  };
  const shown = photos.slice(0, 9);
  const card: CSSProperties = { background: '#FFFFFF', borderRadius: 20, padding: isPhone ? '18px 18px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: isPhone ? 'none' : SOFT_SHADOW, border: isPhone ? 'none' : '1px solid #EFE7DC' };

  return (
    <div className={isPhone ? 'cp-native' : undefined} data-testid="family-today" data-date={date} style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: isPhone ? 22 : 'clamp(18px, 3vw, 32px)', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 4 : 8, minWidth: 0 }}>
          <Cap>{fmt.fdl(date)}</Cap>
          <H1>{isToday ? greeting : t('family.storyLooking')}</H1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {!isToday ? <button type="button" onClick={() => setDate(today)} className="cp-press" style={{ height: 36, padding: '0 14px', borderRadius: 999, border: 'none', background: '#F3EEE8', color: '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.today')}</button> : null}
          <DayPicker value={date} visits={visitSet} today={today} onPick={setDate} />
        </div>
      </div>
      {multi ? <FamSwitch segmented={isPhone} label={t('family.switcher')} value={sel} onChange={setSel} items={[...choices.map((id) => ({ key: id, label: memberShort(s.members[id]) })), { key: 'both', label: choices.length > 2 ? t('family.everyone') : t('family.both') }]} /> : null}
      <ClosureNotice phone={isPhone} />
      <DayStrip days={strip} selected={date} tone={single.photoTone} onPick={setDate} />

      {both ? (
        <>
          <GroupStory members={members} stories={stories} onOpenPhoto={openPhoto} isPhone={isPhone} />
          {members.map((m, i) => <ParentStory key={m.id} m={m} story={stories[i]} onProfile={onProfile} onDay={setDate} isPhone={isPhone} />)}
        </>
      ) : (
        <MemberStory m={single} story={stories[0]} onProfile={onProfile} onOpenPhoto={openPhoto} onDay={setDate} isPhone={isPhone} />
      )}

      {isToday && sv && mine && isPhone ? (
        <div data-testid="survey-card">
          <Group title={t('family.surveyEyebrow')} gap={10}>
            <span style={{ fontSize: 18, lineHeight: '25px', fontWeight: 400, color: '#2B231C' }}>{sv.title}</span>
            <span style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>{answered ? t('family.surveyThanks') : t('family.surveyAsk')}</span>
            {!answered ? <Button size={48} full onClick={() => setSurvey(true)}>{t('family.surveyBtn')}</Button> : null}
          </Group>
        </div>
      ) : isToday && sv && mine ? (
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

      {/* a note from the team, as a quote with the writer's face: the day's own, or (today, before it is written) the last visit's */}
      {!both ? (() => {
        // KC round 7: only a note the team wrote is quoted (the mood is on the cover, lunch on the rail); today, until its note is in, the newest note
        const log = stories[0].log?.note ? stories[0].log : isToday ? latestNote(s, single.id, today) : undefined;
        if (!log?.note) return null;
        const own = log === stories[0].log;
        return (
          <section style={card} data-testid="team-note" data-own={own}>
            <Cap>{own ? t('family.notesTeam') : t('family.storyLastVisit', { d: log.date })}</Cap>
            <LogBlock m={single} log={log} />
            {!own ? <button type="button" onClick={() => setDate(log.date)} style={{ ...quietLink, alignSelf: 'flex-start' }}>{t('family.memOpenDay', { d: log.date })}</button> : null}
          </section>
        );
      })() : null}

      <Timeline members={members} stories={stories} date={date} onFeedback={() => setFeedback(true)} onOpenPhoto={openPhoto} />

      {shown.length ? (
        isPhone ? (
          <div data-testid="day-photos"><Group title={t('family.storyPhotos')} meta={photos.length === 1 ? t('family.phCountOne') : t('family.phCountN', { n: photos.length })} gap={12}>
            <PhotoGrid photos={shown} label={photoLabel} onOpen={(p) => openPhoto(p, photos)} />
            {photos.length > shown.length ? <button type="button" onClick={() => navigate('/photos')} style={{ ...quietLink, alignSelf: 'flex-start' }}>{t('family.storyAllPhotos')}</button> : null}
          </Group></div>
        ) : (
          <div style={fcard('', 12)} data-testid="day-photos">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <Cap>{t('family.storyPhotos')}</Cap>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{photos.length === 1 ? t('family.phCountOne') : t('family.phCountN', { n: photos.length })}</span>
            </div>
            <PhotoGrid photos={shown} label={photoLabel} onOpen={(p) => openPhoto(p, photos)} />
            {photos.length > shown.length ? <button type="button" onClick={() => navigate('/photos')} style={{ ...quietLink, alignSelf: 'flex-start' }}>{t('family.storyAllPhotos')}</button> : null}
          </div>
        )
      ) : null}

      <LunchFeedback memberIds={members.map((m) => m.id)} phone={isPhone} />
      {members.map((m) => <MemoriesTeaser key={m.id} m={m} phone={isPhone} />)}
      {/* KC round 6: no Plan or invoice cards on Today; the plan card, invoices and Pay live in their own tabs */}
      {/* round 6, phone: an iOS grouped list (tinted icon tiles, chevrons), the shared notes as its footnote */}
      {isPhone ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Group pad={0} gap={0}>
            {quick.map((q, i) => {
              const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 10px 0 14px', border: 'none', background: '#FFFFFF', fontSize: 16, color: '#1E1A16', cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', textDecoration: 'none',
                backgroundImage: i ? 'linear-gradient(#EFEAE3, #EFEAE3)' : 'none', backgroundSize: 'calc(100% - 56px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat' };
              const inner = (
                <>
                  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={q.icon} size={18} color="#75624B" /></span>
                  <span style={{ flex: 1 }}>{q.label}</span>
                  <Icon name="chevron_right" size={22} color="#A89C8E" />
                </>
              );
              return q.href
                ? <a key={q.href} href={q.href} target="_blank" rel="noopener" data-testid="wa-club" className="cp-tap-self" style={rowStyle}>{inner}</a>
                : <button key={q.to} type="button" onClick={() => navigate(q.to!)} className="cp-tap-self" style={rowStyle}>{inner}</button>;
            })}
          </Group>
          {notes.map(({ m, n }) => (
            <div key={m.id} style={{ ...GROUP_HEAD, textTransform: 'none', letterSpacing: 0, whiteSpace: 'normal', fontWeight: 400, lineHeight: '19px', padding: '0 16px' }}>{both ? t('family.sharedNoteFor', { m: memberShort(m), n: n!.text }) : t('family.sharedNote', { n: n!.text })}</div>
          ))}
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 0 8px' }}>
        {quick.map((q) => {
          const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 2px', border: 'none', borderTop: '1px solid #E6DDD1', background: 'transparent', fontSize: 15, color: '#1E1A16', cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left', textDecoration: 'none' };
          const inner = (
            <>
              <Icon name={q.icon} size={20} color="#6E5A43" weight={300} />
              <span style={{ flex: 1 }}>{q.label}</span>
              <Icon name="arrow_forward" size={18} color="#6E5A43" />
            </>
          );
          return q.href
            ? <a key={q.href} href={q.href} target="_blank" rel="noopener" data-testid="wa-club" className="h-row cp-bleed" style={rowStyle}>{inner}</a>
            : <button key={q.to} type="button" onClick={() => navigate(q.to!)} className="h-row cp-bleed" style={rowStyle}>{inner}</button>;
        })}
        {notes.map(({ m, n }) => (
          <div key={m.id} style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, borderTop: '1px solid #E6DDD1', paddingTop: 16 }}>{both ? t('family.sharedNoteFor', { m: memberShort(m), n: n!.text }) : t('family.sharedNote', { n: n!.text })}</div>
        ))}
      </div>
      )}

      <SurveySheet open={survey} onClose={closeSurvey} />
      <LunchFeedbackSheet memberIds={members.map((m) => m.id)} open={feedback} onClose={closeFeedback} />
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </div>
  );
}
