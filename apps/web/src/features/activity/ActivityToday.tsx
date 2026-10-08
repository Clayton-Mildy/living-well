// Activity teacher Today (design ScrLight, activity branch): Now/Next hero with Camera and Daily log, who is in the club, what is still to come.
// Round 6 (phone, native look): the hero is one flat group with its label outside; who is in the club is a grouped list; the day's programme is a progress timeline.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayStatus, nextOpenDay, memberName, scheduleDayOf, staffCall, toMin, type Activity, type Photo } from '@cp/shared';
import { SESSION_MIN, activityName, cogSummary, dayPlan, inClubMembers, logOf, nowNext, roomName, sessionPhotos, type PlanItem, type SessionItem } from '@cp/shared/rules/activity';
import { SLOTS, dayInfo, eventTitle, slotChanged } from '@cp/shared/rules/calendar';
import { guestOn } from '@cp/shared/rules/guests';
import { Card, EmptyState, Group, Icon, PageHead, PhotoThumbs, RailDot, SectionLabel, type RailState } from '../../components/ui';
import { PhotoViewer } from './PhotoViewer';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { Av, StatusDot, catalogPhoto, cogLine, heroCardStyle, heroEyebrow, plural, rowLine } from './lib';
import { activityPhoto, mediaUrl, photoFill } from '../../lib/media';

const heroBtn = (primary: boolean): CSSProperties => ({ height: 46, padding: '0 20px', borderRadius: 12, border: primary ? 'none' : '1px solid #DCD3C8', background: primary ? '#24201C' : '#FFFFFF', color: primary ? '#FFFFFF' : '#24201C', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter' });

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function ActivityToday() {
  const t = useT();
  const { lang, fdl, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today, nowMin } = useNow();
  const { user } = useMe();
  const navigate = useNavigate();
  const status = dayStatus(s, today);
  const outing = status.open ? status.outing : undefined;
  const shut = status.open ? null : status;
  const people = useMemo(() => inClubMembers(s, today), [s, today]);
  const nn = useMemo(() => nowNext(s, today, nowMin), [s, today, nowMin]);
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  // KC round 6: a session's picture is its newest real activity picture from today, else the activity's catalog picture (else the icon)
  const pictureOf = (a: Activity | undefined) => { const real = [...sessionPhotos(s, today, a)].reverse().find((p) => p.mediaId && p.media !== 'video'); return real?.mediaId ? mediaUrl(real.mediaId) : activityPhoto(a); };
  // KC round 7: the picture (banner or dot) opens in the viewer: today's activity pictures of the session from the newest, else the catalog picture on its own
  const openPicture = (a: Activity | undefined) => {
    if (!a) return;
    const shots = sessionPhotos(s, today, a);
    const real = [...shots].reverse().find((p) => p.mediaId && p.media !== 'video');
    if (real) setViewer({ photos: shots, startId: real.id });
    else if (a.photoMediaId) { const c = catalogPhoto(a, today); setViewer({ photos: [c], startId: c.id }); }
  };
  const first = user?.kind === 'staff' ? user.staff.name.split(' ')[0] : '';
  const room = (r: Parameters<typeof roomName>[0]) => roomName(r, lang);

  // the first session of the next open day, shown once today's sessions are over
  const nextDay = useMemo(() => {
    if (nn.phase !== 'done') return null;
    const d = nextOpenDay(s, today);
    const a = dayInfo(s, d, 'staff').items.find((x) => x.kind === 'activity');
    return a ? { date: d, time: a.time ?? '', name: activityName({ name: a.title, nameId: a.titleId }, lang) } : null;
  }, [nn.phase, s, today, lang]);

  // round 6, phone: the two buttons share the row as equal pills
  const pillStyle = (primary: boolean): CSSProperties => ({ ...heroBtn(primary), flex: 1, justifyContent: 'center', borderRadius: 999, minWidth: 0 });
  const buttons = (
    <div style={{ display: 'flex', gap: 8, flexWrap: isPhone ? 'nowrap' : 'wrap' }}>
      {/* KC round 6: Camera opens today's Activity pictures for the Now / Next session */}
      <button type="button" onClick={() => navigate(`/camera?tab=activity${nn.current?.activity ? `&act=${encodeURIComponent(nn.current.activity.name)}` : ''}`)} style={isPhone ? pillStyle(true) : heroBtn(true)} className={isPhone ? 'dh5 cp-btn cp-press' : 'dh5 cp-btn'}><Icon name="photo_camera" size={20} />{t('nav.camera')}</button>
      <button type="button" onClick={() => navigate('/log')} style={isPhone ? pillStyle(false) : heroBtn(false)} className={isPhone ? 'dh4 cp-btn cp-press' : 'dh4 cp-btn'}><Icon name="edit_note" size={20} />{t('nav.log')}</button>
    </div>
  );
  // KC round 6: the session's picture as a banner on top of the card (uploaded in the Activities editor); KC round 7: tap it to see it in full
  const banner = (img: string | undefined, h: number, a?: Activity, name?: string) => (img ? <button type="button" data-testid="hero-photo" className="cp-press" onClick={() => openPicture(a)} aria-label={t('activity.openPicture', { a: name || '' })} style={{ display: 'block', width: '100%', height: h, borderRadius: 12, border: 'none', padding: 0, cursor: 'pointer', background: photoFill(img, '#E8E1D8'), marginBottom: 4, flex: 'none' }} /> : null);
  const heroCard = (label: ReactNode, title: ReactNode, sub: ReactNode, img?: string, a?: Activity, name?: string, extra?: ReactNode) => isPhone ? (
    // round 6, phone: the label is the group header, outside; the session is one flat group
    <Group title={label} pad="14px 16px 16px" gap={8}>
      {banner(img, 150, a, name)}
      <div style={{ fontSize: 24, lineHeight: 1.25, fontWeight: 500, letterSpacing: '-0.4px', color: '#5E4E3B' }}>{title}</div>
      {sub ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{sub}</div> : null}
      {extra}
      <div style={{ marginTop: 4 }}>{buttons}</div>
    </Group>
  ) : (
    <Card pad="clamp(18px, 2.4vw, 26px)" shadow style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel>{label}</SectionLabel>
      {banner(img, 190, a, name)}
      <div style={{ fontSize: 'clamp(24px, 2.4vw, 30px)', lineHeight: 1.25, fontWeight: 500, letterSpacing: '-0.4px', color: '#5E4E3B' }}>{title}</div>
      {sub ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{sub}</div> : null}
      {extra}
      <div style={{ marginTop: 4 }}>{buttons}</div>
    </Card>
  );

  // KC round 7: the day's programme was changed for this day only: a quiet line with the note
  const changedToday = status.open && !outing && SLOTS.some((sl) => slotChanged(s, today, sl));
  const changedNote = scheduleDayOf(s, today)?.note;
  const changedLine = changedToday ? (
    <div data-testid="changed-today" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 14, lineHeight: '20px', color: '#7A5510' }}>
      <Icon name="edit_calendar" size={18} style={{ marginTop: 1 }} />
      <span>{changedNote ? t('cal.changedToday', { note: changedNote }) : t('cal.changedTodayPlain')}</span>
    </div>
  ) : null;
  let hero: ReactNode = null;
  const count = plural(t, 'activity.nInClub', people.length);
  if (outing) {
    const o = outing;
    hero = heroCard(t('activity.outingLabel'), eventTitle(o, lang), [o.from && o.to ? `${o.from}–${o.to}` : t('cal.allDay'), count].join(' · '));
  } else if (status.open && nn.current) {
    const c = nn.current;
    const guest = guestOn(s, today, c.slot); // KC round 7: a guest host leads this session
    const parts = [room(c.room), guest ? t('guests.withGuest', { name: guest.host.name }) : c.staff ? t('activity.withTeacher', { name: staffCall(c.staff) }) : '', count].filter(Boolean);
    hero = heroCard(t(nn.phase === 'now' ? 'activity.nowAt' : 'activity.nextAt', { time: c.time }), activityName(c.activity, lang), parts.join(' · '), pictureOf(c.activity), c.activity, activityName(c.activity, lang), changedLine);
  } else if (status.open && nn.phase === 'done') {
    hero = heroCard(t('activity.doneLabel'), t('activity.doneTitle'), [nextDay ? t('activity.nextDay', { day: fds(nextDay.date), time: nextDay.time, name: nextDay.name }) : ''].filter(Boolean).join(' '));
  } else if (status.open) {
    hero = heroCard(t('activity.noneLabel'), t('activity.noneTitle'), '');
  }

  const closedSub = shut ? t(shut.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) }) : '';

  // KC round 6: the whole day as a progress timeline; what has passed fills in bronze (lunch counts an hour, tea half an hour)
  const plan = dayPlan(s, today);
  const endOf = (it: PlanItem) => toMin(it.time) + (it.kind === 'session' ? SESSION_MIN : it.kind === 'lunch' ? 60 : 30);
  const stateOf = (it: PlanItem): RailState => (nowMin >= endOf(it) ? 'done' : nowMin >= toMin(it.time) ? 'now' : 'up');
  // one dot size for the whole timeline, so the text lines up: a little larger once any session has its picture
  const dot = isPhone ? 32 : 34; // icons only on the line (round 7)
  const timeline = (
    <>
    <ol data-testid="today-plan" style={{ display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 }}>
      {plan.map((it, i) => {
        const sess = it.kind === 'session' ? (it as SessionItem) : null;
        const title = sess ? activityName(sess.activity, lang) : t(it.kind === 'lunch' ? 'activity.lunch' : 'activity.tea');
        const guest = sess ? guestOn(s, today, sess.slot) : null;
        const sub = [room(it.room), guest ? t('guests.withGuest', { name: guest.host.name }) : sess?.staff ? staffCall(sess.staff) : ''].filter(Boolean).join(' · ');
        const st = stateOf(it);
        const shots = sess ? sessionPhotos(s, today, sess.activity) : []; // KC round 6: the photos taken during this session
        return (
          <li key={it.kind + it.time} data-state={st} style={{ display: 'flex', gap: 14, position: 'relative' }}>
            {/* KC round 7: every dot on the line is an icon; the session's pictures sit beside the line */}
            <RailDot state={st} icon={sess ? sess.activity?.icon || 'interests' : it.kind === 'lunch' ? 'restaurant' : 'local_cafe'} last={i === plan.length - 1} size={dot} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#6B6259', lineHeight: 1.4 }}>{it.time}</span>
                {st === 'now' ? <span style={{ height: 22, padding: '0 8px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center' }}>{t('family.now')}</span> : null}
              </div>
              <span style={{ fontSize: isPhone ? 16 : 17, fontWeight: 500, lineHeight: 1.35, color: st === 'done' ? '#6B6259' : '#2B231C' }}>{title}</span>
              {sub ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{sub}</span> : null}
              {shots.length ? <PhotoThumbs photos={shots} onOpen={(p) => setViewer({ photos: shots, startId: p.id })} alt={(p) => t('family.photoAria', { a: title, t: p.time })} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
    </>
  );
  const viewerEl = viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={() => setViewer(null)} audience="staff" /> : null;
  const listHead = (title: ReactNode, meta: ReactNode) => (
    <div style={{ padding: '14px 0 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={heroEyebrow}>{title}</span>
      <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span>
    </div>
  );
  const emptyRow = (text: string) => <div style={{ padding: '18px 0 14px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{text}</div>;

  // round 6, phone: a member row in the grouped list: avatar, name, logged / not logged, a chevron; the care line stays hidden on phones as before
  const memberRowPhone = (m: (typeof people)[number], i: number) => {
    const logged = logOf(s, m.id, today)?.mood !== undefined; // round 7: logged once the Mood & notes round is in
    return (
      <button key={m.id} type="button" onClick={() => navigate(`/log?member=${m.id}`)} className="cp-tap-self" aria-label={`${memberName(m)}: ${t(logged ? 'activity.logged' : 'activity.notLogged')}`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px 8px 16px', border: 'none', minHeight: 58, backgroundColor: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter', ...rowLine(i === 0, 68) }}>
        <Av m={m} size={40} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{memberName(m)}</span>
          <span className="cp-hide-phone" style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{cogLine(t, cogSummary(s, m))}</span>
        </span>
        {logged ? <StatusDot color="#3D6B4F">{t('activity.logged')}</StatusDot> : <StatusDot color="#7A5510">{t('activity.notLogged')}</StatusDot>}
        <Icon name="chevron_right" size={20} color="#A89C8E" />
      </button>
    );
  };

  if (isPhone) {
    return (
      <div className="cp-native" style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PageHead eyebrow={fdl(today)} title={t('activity.hello', { n: first })} />
        {hero}
        {shut ? (
          <Group pad={0} gap={0}><EmptyState icon="event_busy" title={t('common.clubClosed')} sub={[shut.event ? cap(eventTitle(shut.event, lang)) : '', closedSub].filter(Boolean).join(' · ')} /></Group>
        ) : null}
        {status.open || people.length ? (
          <Group title={t('activity.inClub')} meta={String(people.length)} pad={0} gap={0}>
            {people.length ? people.map(memberRowPhone) : <div style={{ padding: '16px', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('activity.nobodyYet')}</div>}
          </Group>
        ) : null}
        {status.open && !outing ? (
          <Group title={t('activity.todayPlan')} pad={plan.length ? '16px 16px 0' : 0} gap={0}>
            {plan.length ? timeline : <div style={{ padding: '14px 16px', fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('activity.nothingToday')}</div>}
          </Group>
        ) : null}
        {viewerEl}
      </div>
    );
  }
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(18px, 2.8vw, 32px)' }}>
      <PageHead eyebrow={fdl(today)} title={t('activity.hello', { n: first })} />
      {hero}
      {shut ? (
        <Card><EmptyState icon="event_busy" title={t('common.clubClosed')} sub={[shut.event ? cap(eventTitle(shut.event, lang)) : '', closedSub].filter(Boolean).join(' · ')} /></Card>
      ) : null}
      {status.open || people.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'flex-start' }}>
          <section style={{ ...heroCardStyle, flex: '1 1 440px' }}>
            {listHead(t('activity.inClub'), String(people.length))}
            {people.length ? people.map((m) => {
              const logged = logOf(s, m.id, today)?.mood !== undefined; // round 7: logged once the Mood & notes round is in
              return (
                <button key={m.id} type="button" onClick={() => navigate(`/log?member=${m.id}`)} className="h-row cp-bleed" aria-label={`${memberName(m)}: ${t(logged ? 'activity.logged' : 'activity.notLogged')}`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: isPhone ? '12px 0' : '16px 0', border: 'none', borderTop: '1px solid #F0EAE1', minHeight: isPhone ? 56 : 64, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <Av m={m} size={isPhone ? 40 : 46} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>{memberName(m)}</span>
                    <span className="cp-hide-phone" style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{cogLine(t, cogSummary(s, m))}</span>
                  </span>
                  {logged ? <StatusDot color="#3D6B4F">{t('activity.logged')}</StatusDot> : <StatusDot color="#7A5510">{t('activity.notLogged')}</StatusDot>}
                </button>
              );
            }) : emptyRow(t('activity.nobodyYet'))}
          </section>
          {status.open && !outing ? (
            <aside style={{ flex: '0 1 300px', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
              <span style={heroEyebrow}>{t('activity.todayPlan')}</span>
              {plan.length ? timeline : <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('activity.nothingToday')}</span>}
            </aside>
          ) : null}
        </div>
      ) : null}
      {viewerEl}
    </div>
  );
}
