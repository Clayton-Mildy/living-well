// The day's rail ("Today at the club", or "Tuesday at the club" on an earlier day): the club's programme as a progress rail, with the member's arrival,
// health check and home time once they happen. Each activity shows its picture, who leads it (a guest host too), whether the member joined in or
// took a rest, and that session's pictures; lunch shows the dishes, how much was eaten and the kitchen's photos.
// Members drop in, so nothing is "expected". On a day the member did not come the programme is listed quietly ("What was on that day").
import { Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstOfRole, lunchSafety, memberShort, staffCall, visibleTeaPhotos, type ISODate, type Member, type Photo, type Reading } from '@cp/shared';
import { activityLabel, dayStateOf, dishNamesOf, eventTitle, roomLabel, servedLunch, staffFirst, staffIdOf, timelineOf, storyNowMin, type DayStory, type StorySession, type TlItem } from '@cp/shared/rules/family';
import { Avatar, Button, EmptyState, Group, PhotoImg, RailDot } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFamilyCtx } from './useFamily';
import { mediaUrl } from '../../lib/media';
import { H2, HealthPill, fcard } from './parts';
import { lunchWords, quietLink } from './storyBits';
import type { TFn } from '../../lib/i18n';

interface Props {
  members: Member[];
  /** one story per member (same date) */
  stories: DayStory[];
  date: ISODate;
  onFeedback: () => void;
  /** `all`: every picture of the group, so the viewer can page through them */
  onOpenPhoto: (p: Photo, all?: Photo[]) => void;
}

const bpOf = (r: Reading) => (r.sys != null && r.dia != null ? `${r.sys}/${r.dia}` : '');
/** "Blood pressure normal · 128/82", or just "Blood pressure 152/94" (the pill under it says what the nurse is doing). */
const bpLine = (t: TFn, r: Reading) => (bpOf(r) ? t(r.status === 'normal' ? 'family.storyBpOk' : 'family.storyBp', { b: bpOf(r) }) : '');

/** A small dot and words: joined in (sage) or took a rest (warm grey, never a mark against anyone). */
function Took({ took, name }: { took: 'joined' | 'satOut'; name?: string }) {
  const { t } = useFamilyCtx();
  return (
    <span data-testid="took" data-took={took} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, lineHeight: '20px', color: took === 'joined' ? '#2F5A40' : '#6B6259' }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: took === 'joined' ? '#3D6B4F' : '#BBA88F', flex: 'none' }} />
      {name ? `${name} · ` : ''}{t(took === 'joined' ? 'family.storyJoined' : 'family.storySatOut')}
    </span>
  );
}

function Guest({ g }: { g: NonNullable<StorySession['guest']> }) {
  const { t } = useFamilyCtx();
  return (
    <span data-testid="guest-host" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>
      <Avatar name={g.name} src={g.photoMediaId ? mediaUrl(g.photoMediaId) : undefined} size={22} />
      <span style={{ minWidth: 0 }}>{t('family.storyWithGuest', { n: g.name })}{g.what ? ` · ${g.what}` : ''}</span>
    </span>
  );
}

/**
 * KC round 7: the photos of one step of the day (a session, lunch or afternoon tea), all in the same row of equal square tiles so every step
 * looks alike; after three, the last tile says "+N". Each opens in the viewer. `kind` keeps the test ids (lunch-photo, tea-photo, session-photo).
 */
const TILE = 84;
const ROW_MAX = 3;
function PhotoRow({ photos, caption, alt, onOpen, kind }: { photos: Photo[]; caption?: string; alt: (p: Photo) => string; onOpen: (p: Photo, all: Photo[]) => void; kind: 'lunch' | 'tea' | 'session' }) {
  const shown = photos.slice(0, ROW_MAX);
  const more = photos.length - shown.length;
  return (
    <div data-testid={`${kind}-photos`} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, alignSelf: 'flex-start', maxWidth: '100%' }}>
      {caption ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{caption}{photos.length === 1 ? ` · ${photos[0].time}` : ''}</span> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        {shown.map((p, i) => (
          <button key={p.id} type="button" onClick={() => onOpen(p, photos)} aria-label={alt(p)} data-testid={`${kind}-photo`} data-photo-id={p.id} className="cp-press"
            style={{ position: 'relative', width: TILE, height: TILE, borderRadius: 12, border: 'none', padding: 0, overflow: 'hidden', cursor: 'pointer', background: '#F3EEE8', flex: 'none' }}>
            <PhotoImg photo={p} />
            {i === shown.length - 1 && more > 0 ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(36,32,28,0.55)', color: '#FFFFFF', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{more}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Timeline({ members, stories, date, onFeedback, onOpenPhoto }: Props) {
  const { s, t, fmt, now, pron } = useFamilyCtx();
  const { isPhone } = useDevice();
  const navigate = useNavigate();
  const { today } = now;
  const isToday = date === today;
  const nowMin = storyNowMin(date, today, now.nowMin);
  const states = members.map((m) => dayStateOf(s, m, date));
  const visited = stories.some((x) => x.visited);
  // members drop in on any open day, so the programme shows whether or not anyone has arrived; only a closed day or an ended membership has none
  const showTimeline = states.some((x) => x.kind === 'away' || x.kind === 'here' || x.kind === 'home');
  // the rail is a progress bar for a day someone was at the club (or is today); on a day nobody came it is just what was on
  const quiet = !isToday && !visited;
  const head = isToday ? t('family.todayAtClub') : quiet ? t('family.storyWhatWasOn') : t('family.storyDayAtClub', { d: fmt.fd(date, { weekday: 'long' }) });

  // ----- no timeline: club closed / membership ended (an earlier day says it in the cover) -----
  if (!showTimeline) {
    if (!isToday) return null;
    const first = states[0];
    let icon = 'event', title: string = t('family.notToday'), sub: ReactNode = '';
    if (first.kind === 'closed') {
      icon = 'event_busy';
      title = t('common.clubClosed');
      const d = fmt.fdl(first.next);
      sub = first.reason === 'weekend' ? t('common.weekendSub', { date: d }) : <>{eventTitle(first.event, fmt.lang) ? <>{eventTitle(first.event, fmt.lang)}. </> : null}{t('common.clubClosedSub', { date: d })}</>;
    } else if (first.kind === 'ended') {
      icon = 'archive';
      title = t('family.stEnded', { d: fmt.fds(first.lastDay) });
    } else if (first.kind === 'upcoming') {
      title = t('family.stUpcoming', { d: fmt.fds(first.start) });
    }
    // round 6, phone: an iOS grouped section (the title over a flat white group)
    if (isPhone) return <div data-testid="timeline-empty"><Group title={head} pad={0}><EmptyState icon={icon} title={title} sub={sub} /></Group></div>;
    return (
      <div style={fcard('', 14)} data-testid="timeline-empty">
        <H2>{head}</H2>
        <EmptyState icon={icon} title={title} sub={sub} />
      </div>
    );
  }

  // ----- the timeline -----
  const items = stories.length === 1 ? stories[0].items : timelineOf(s, members, date, nowMin);
  const single = members.length === 1 ? members[0] : null;
  const nurse = firstOfRole(s, 'nurse');
  const staffName = (by: string | undefined) => staffFirst(s, staffIdOf(by)) || t('family.theLobby');
  const foods = (m: Member) => [...m.health.food.map((f) => t('family.food_' + f)), ...(m.health.foodOther ? [m.health.foodOther] : [])].join(` ${t('common.and')} `);
  const sessionOf = (id: string) => stories.map((st, i) => ({ m: members[i], x: st.sessions.find((y) => y.id === id) })).filter((r): r is { m: Member; x: StorySession } => !!r.x);

  const view = (it: TlItem): { icon: string; time: string; title: string; detail: ReactNode; badge?: ReactNode; extra?: ReactNode } => {
    switch (it.kind) {
      case 'arrival':
        return { icon: 'how_to_reg', time: it.time, title: t('family.tArrived'), detail: t('family.tArrivedD', { s: staffName(it.att.checkIn?.by) }) };
      case 'health': {
        const arr = it.arrival;
        if (!arr) return { icon: 'monitor_heart', time: '', title: t('family.tHealthUp'), detail: t('family.tHealthUpD', { n: staffCall(nurse) || t('roles.nurse') }) };
        const parts: string[] = [];
        const bp = bpLine(t, arr);
        if (bp) parts.push(bp);
        if (arr.spo2 != null) parts.push(t('family.storyOxygen', { o: arr.spo2 }));
        if (arr.temp != null) parts.push(t('family.tempLine', { t: arr.temp }));
        if (it.monthly) { if (it.monthly.glucose != null) parts.push(`${it.monthly.glucose} mg/dL`); if (it.monthly.weight != null) parts.push(`${it.monthly.weight} kg`); }
        if (arr.shared) { for (const k of arr.noteKeys) parts.push(t('health.note.' + k)); if (arr.note) parts.push(arr.note); }
        return {
          icon: 'monitor_heart', time: it.time, title: t('family.tHealth'), detail: parts.join(' · '),
          badge: arr.status !== 'normal' ? <HealthPill status={arr.status} style={{ marginTop: 4 }} /> : undefined,
          extra: <button type="button" onClick={() => navigate('/health')} style={{ ...quietLink, alignSelf: 'flex-start', minHeight: 32, padding: 0 }}>{t('family.storyHealthLink')}</button>,
        };
      }
      case 'session': {
        // the activity pictures of this session (families get only approved ones, and only on a day one of these members came)
        const a = s.activities[it.activityId];
        const rows = sessionOf(it.id);
        const shots = Array.from(new Map(rows.flatMap((r) => r.x.photos).map((p) => [p.id, p])).values()).sort((p, q) => (p.time + p.id < q.time + q.id ? -1 : 1));
        const title = activityLabel(s, it.activityId, fmt.lang);
        const guest = rows.find((r) => r.x.guest)?.x.guest ?? null;
        const took = rows.filter((r) => r.x.took);
        return {
          icon: a?.icon || 'interests', time: it.time, title,
          detail: (
            <>
              <span style={{ display: 'block' }}>{[roomLabel(s, it.roomId, fmt.lang), staffFirst(s, it.staffId)].filter(Boolean).join(' · ')}</span>
              {guest ? <span style={{ display: 'block', marginTop: 4 }}><Guest g={guest} /></span> : null}
              {took.length ? <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>{took.map((r) => <Took key={r.m.id} took={r.x.took!} name={members.length > 1 ? memberShort(r.m) : undefined} />)}</span> : null}
            </>
          ),
          // KC round 7: every dot on the line is an icon; the session's pictures sit beside the line, in the same row of tiles as lunch and tea
          extra: shots.length ? <PhotoRow kind="session" photos={[...shots].reverse()} onOpen={onOpenPhoto} alt={(p) => t('family.photoAria', { a: title, t: p.time })} /> : undefined,
        };
      }
      case 'outing':
        return { icon: 'directions_bus', time: it.time, title: eventTitle(it.event, fmt.lang), detail: `${it.event.from || ''}–${it.event.to || ''}` };
      case 'lunch': {
        const groups = new Map<string, Member[]>();
        for (const m of members) { const k = dishNamesOf(s, servedLunch(s, m, date)).join(', '); groups.set(k, [...(groups.get(k) || []), m]); }
        const lines: string[] = [];
        for (const [dishes, ms] of groups) if (dishes) lines.push(groups.size > 1 ? `${ms.map(memberShort).join(` ${t('common.and')} `)}: ${dishes}.` : `${dishes}.`);
        if (isToday) {
          for (const m of members) {
            const ls = lunchSafety(s, m.id, date);
            if (ls.kind === 'clear') lines.push(t('family.tLunchSafe', { n: memberShort(m), a: foods(m) }));
            else if (ls.kind === 'alternative') lines.push(t('family.tLunchAlt', { n: memberShort(m), a: foods(m), d: ls.dish, x: ls.alternative }));
          }
        }
        // how much was eaten, from the team's log (a kind line, one per member who has one)
        const ate = stories.flatMap((st, i) => (st.lunch?.amount ? [{ m: members[i], a: st.lunch.amount as string }] : []));
        const photos = stories[0]?.lunch?.photos ?? []; // the kitchen's approved photos (a family never receives pending ones)
        return {
          icon: 'restaurant', time: it.time, title: t('family.tLunch'),
          detail: (
            <>
              {lines.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
              {ate.map((r) => (
                <span key={r.m.id} data-testid="lunch-amount" data-amount={r.a} style={{ display: 'block', marginTop: 4, color: '#2F5A40', fontWeight: 500 }}>{members.length > 1 ? `${memberShort(r.m)}: ` : ''}{lunchWords(t, r.a)}</span>
              ))}
            </>
          ),
          extra: (
            <>
              {photos.length ? <PhotoRow kind="lunch" photos={photos} caption={t('family.lunchPhoto')} alt={(p) => t('kitchen.photo.alt', { time: p.time })} onOpen={onOpenPhoto} /> : null}
              {isToday || visited ? <Button variant="ghost" size={44} onClick={onFeedback} style={{ alignSelf: 'flex-start', padding: '0 4px' }}>{t('family.lunchFeedback')}</Button> : null}
            </>
          ),
        };
      }
      case 'tea': {
        const photos = visibleTeaPhotos(s, date); // the kitchen's approved tea photos (a family never receives pending ones)
        return {
          icon: 'local_cafe', time: it.time, title: t('family.tTea'), detail: dishNamesOf(s, it.dishIds).join(', '),
          extra: photos.length ? <PhotoRow kind="tea" photos={photos} caption={t('family.teaPhoto')} alt={(p) => t('kitchen.photo.tea.alt', { time: p.time })} onOpen={onOpenPhoto} /> : undefined,
        };
      }
      case 'home': {
        const m = single!;
        if (it.att?.checkOut) {
          const dep = it.departure;
          const bp = dep ? bpLine(t, dep) : '';
          return { icon: 'home', time: it.time, title: t('family.tHome'), detail: t('family.tHomeDoneD', { s: staffName(it.att.checkOut.by) }) + (bp ? ` · ${bp}` : ''), badge: dep && dep.status !== 'normal' ? <HealthPill status={dep.status} style={{ marginTop: 4 }} /> : undefined };
        }
        return { icon: 'home', time: it.time, title: t('family.tHome'), detail: t('family.tHomeD', { s: pron(m).s }) };
      }
    }
  };

  const views = items.map((it) => ({ it, v: view(it) }));
  const dot = 34; // KC round 7: icons only on the line, one size, so the text lines up
  const list = (
    <ol style={{ display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 }}>
      {views.map(({ it, v }, i) => {
        const last = i === views.length - 1;
        const state = quiet ? 'up' : it.state;
        return (
          <Fragment key={it.id}>
            <li style={{ display: 'flex', gap: 14, position: 'relative' }} data-tl={it.id} data-state={state}>
              <RailDot state={state} icon={v.icon} last={last} size={dot} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#6B6259', lineHeight: 1.4 }}>{v.time}</span>
                  {state === 'now' ? <span style={{ height: 22, padding: '0 8px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center' }}>{t('family.now')}</span> : null}
                </div>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#24201C', lineHeight: 1.4 }}>{v.title}</span>
                {v.detail ? <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{v.detail}</span> : null}
                {v.badge}
                {v.extra}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
  // round 6, phone: an iOS grouped section (the title over a flat white group)
  if (isPhone) return <div data-testid="timeline" data-day={date}><Group title={head} pad="16px 16px 0" gap={0}>{list}</Group></div>;
  return (
    <div style={fcard('', 10)} data-testid="timeline" data-day={date}>
      <H2>{head}</H2>
      {list}
    </div>
  );
}

