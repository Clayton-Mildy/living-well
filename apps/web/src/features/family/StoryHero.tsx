// The top of a day's story (KC round 7): the member (or both parents) over the day's best picture, with the day's title, one status line and the mood.
// Without a real picture the cover is a warm bronze gradient with the member's avatar, so a day never looks empty.
import type { CSSProperties, ReactNode } from 'react';
import type { ISODate, Member, Photo, Reading } from '@cp/shared';
import { firstOfRole, memberName, staffCall } from '@cp/shared';
import { eventTitle, latestLog, mayStillCome, planSummary, staffFirst, staffIdOf, type DayStory, type DayState } from '@cp/shared/rules/family';
import { Avatar, PhotoImg } from '../../components/ui';
import { memberPhoto } from '../../lib/media';
import type { TFn } from '../../lib/i18n';
import { catalogPhoto } from '../activity/lib';
import { Cap, HealthPill, SOFT_SHADOW, StatusBanner, linkBtn } from './parts';
import { LogBlock } from './TeamLog';
import { MOOD_COLOR, moodWords, quietLink, storyTitle, namesOf } from './storyBits';
import { useFamilyCtx } from './useFamily';

const SAGE = '#3D6B4F';
const STONE = '#BBA88F';
export type Banner = { dot: string; text: string; sub?: string };

/** Where the member is on that day, as one status line: at the club since / went home (today), arrived and home (an earlier day), not at the club, closed. */
export function useStatus(m: Member, story: DayStory): Banner {
  const { s, t, fmt, now } = useFamilyCtx();
  const st: DayState = story.state;
  const isToday = story.date === now.today;
  switch (st.kind) {
    case 'here': return isToday
      ? { dot: SAGE, text: t('family.atSince', { t: st.since }), sub: t('family.checkedInBy', { s: staffFirst(s, staffIdOf(st.att.checkIn?.by)) || t('family.theLobby') }) }
      : { dot: STONE, text: t('family.storyArrived', { a: st.since }) };
    case 'home': return isToday
      ? { dot: STONE, text: t('family.wentHome', { t: st.at }), sub: t('family.visitSpan', { a: st.att.checkIn?.at || '', b: st.at }) }
      : { dot: STONE, text: t('family.storyArrivedHome', { a: st.att.checkIn?.at || '', b: st.at }) };
    case 'away': return isToday ? { dot: STONE, text: t(mayStillCome(s, now.nowMin) ? 'family.notNow' : 'family.notToday'), sub: t('family.famUsually', { t: m.usualArrival }) } : { dot: STONE, text: '' };
    case 'closed': return isToday
      ? { dot: STONE, text: t('family.stClosed'), sub: t(st.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fmt.fdl(st.next) }) }
      : { dot: STONE, text: st.event ? eventTitle(st.event, fmt.lang) : t('family.storyWeekend') };
    case 'ended': return { dot: STONE, text: t('family.stEnded', { d: fmt.fds(st.lastDay) }) };
    case 'upcoming': return { dot: STONE, text: t('family.stUpcoming', { d: fmt.fds(st.start) }) };
  }
}

/** The plan under a member's name: Flex counts the visits left this month, Gold comes any open day. */
function planLeft(t: TFn, p: ReturnType<typeof planSummary>) {
  return p.plan === 'flex' ? t('family.planLeftLine', { n: Math.max(0, (p.quota ?? 0) - p.used), q: p.quota ?? 0 }) : t('family.planGoldLine');
}

type CoverImage = Pick<Photo, 'mediaId' | 'tone'> | null;
/**
 * The cover picture: a real image fills it (tap to open); otherwise a warm gradient with the avatar. A scrim keeps the white text readable on any picture.
 * `size`: tall (a real picture), mid (a visited day without one), compact (a day the member did not come, or the club was closed).
 */
function Cover({ image, size, onOpen, avatar, title, status, mood, tall }: {
  image: CoverImage; size: 'tall' | 'mid' | 'compact'; onOpen?: () => void; avatar: ReactNode; title: string; status?: Banner; mood?: { text: string; color: string }; tall: string;
}) {
  const { t } = useFamilyCtx();
  const real = !!image?.mediaId;
  const sized: CSSProperties = real && size === 'tall' ? { aspectRatio: tall, maxHeight: 460 } : { minHeight: size === 'compact' ? 150 : 232 };
  return (
    <div data-testid="story-hero" data-cover={real ? 'photo' : 'gradient'} style={{ position: 'relative', isolation: 'isolate', borderRadius: 24, overflow: 'hidden', width: '100%', boxShadow: SOFT_SHADOW, color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16, padding: '20px 20px 18px',
      background: real ? '#2B231C' : 'linear-gradient(160deg, #B3A28A 0%, #75624B 52%, #3E3326 100%)', ...sized }}>
      {real ? <span style={{ position: 'absolute', inset: 0, zIndex: -2 }}><PhotoImg photo={image!} /></span> : null}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(to top, rgba(28,22,16,.84) 0%, rgba(28,22,16,.5) 38%, rgba(28,22,16,0) 74%)', pointerEvents: 'none' }} />
      {real && onOpen ? <button type="button" onClick={onOpen} aria-label={t('family.storyCoverAria')} className="cp-press" style={{ position: 'absolute', inset: 0, zIndex: 0, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }} /> : null}
      {real ? null : <span aria-hidden="true" style={{ alignSelf: 'flex-start', marginBottom: 'auto', display: 'inline-flex' }}>{avatar}</span>}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(26px, 7.2vw, 36px)', lineHeight: 1.08, fontWeight: 300, letterSpacing: '-0.9px', textWrap: 'balance' } as CSSProperties}>{title}</h2>
        {status && status.text ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, lineHeight: '21px' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: status.dot, flex: 'none', marginTop: 6, boxShadow: '0 0 0 2px rgba(255,255,255,.35)' }} />
            <span style={{ minWidth: 0 }}><span style={{ fontWeight: 500 }}>{status.text}</span>{status.sub ? <span style={{ opacity: 0.78 }}>{' '}{status.sub}</span> : null}</span>
          </div>
        ) : null}
        {mood ? (
          <span data-testid="story-mood" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px 0 10px', borderRadius: 999, background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(8px)', fontSize: 14, fontWeight: 500 }}>
            <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: mood.color, boxShadow: '0 0 0 2px rgba(255,255,255,.7)' }} />{mood.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** What the cover shows: the day's best real picture, else the catalogue picture of a session, else the gradient. */
function coverOf(s: ReturnType<typeof useFamilyCtx>['s'], story: DayStory[]): { image: CoverImage; open?: { photo: Photo; all: Photo[] } } {
  for (const st of story) if (st.hero?.mediaId) return { image: st.hero, open: { photo: st.hero, all: st.photos } };
  for (const st of story) {
    const a = st.heroActivityId ? s.activities[st.heroActivityId] : undefined;
    if (a?.photoMediaId) { const c = catalogPhoto(a, st.date); return { image: c, open: { photo: c, all: [c] } }; }
  }
  return { image: null };
}

interface HeroProps {
  /** hands a picture (and the list it belongs to) to the viewer */
  onOpenPhoto: (p: Photo, all: Photo[]) => void;
  isPhone: boolean;
}

/** One member: the identity row (avatar, name, plan, Profile) over the cover. (`member-card`) */
export function MemberStory({ m, story, onProfile, onOpenPhoto, onDay, isPhone }: HeroProps & { m: Member; story: DayStory; onProfile: (id: string) => void; onDay: (d: ISODate) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const status = useStatus(m, story);
  const isToday = story.date === now.today;
  const last = m.memberships[m.memberships.length - 1];
  const sub = [planLeft(t, planSummary(s, m, now.today)), last?.lastDay && story.state.kind !== 'ended' ? t('family.endsOn', { d: fmt.fds(last.lastDay) }) : ''].filter(Boolean).join(' · ');
  const cover = coverOf(s, [story]);
  const size = cover.image ? 'tall' : story.visited ? 'mid' : 'compact';
  const title = storyTitle(t, fmt, namesOf(t, [m]), story, now.today, true);
  const mood = story.log?.mood ? { text: moodWords(t, story.log.mood, isToday), color: MOOD_COLOR[story.log.mood] } : undefined;
  const avatar = <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={size === 'compact' ? 56 : 72} ring />;
  return (
    <section aria-label={memberName(m)} data-testid="member-card" data-member={m.id} data-day={story.date} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {cover.image ? <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={isPhone ? 44 : 48} ring /> : null}{/* without a picture the cover carries the avatar */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: isPhone ? 18 : 20, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px', color: '#2B231C' }}>{memberName(m)}</span>
          <span style={{ fontSize: 14, lineHeight: '19px', color: '#6B6259' }}>{sub}</span>
        </div>
        <button type="button" onClick={() => onProfile(m.id)} style={linkBtn}>{t('family.profile')}</button>
      </div>
      <Cover image={cover.image} size={size} tall={isPhone ? '1 / 1' : '4 / 3'} avatar={avatar} title={title} status={status} mood={mood}
        onOpen={cover.open ? () => onOpenPhoto(cover.open!.photo, cover.open!.all) : undefined} />
      {!story.visited && story.lastVisit && !isToday ? (
        <button type="button" onClick={() => onDay(story.lastVisit!)} style={{ ...quietLink, alignSelf: 'flex-start' }} data-testid="last-visit">{t('family.storyLastVisit', { d: story.lastVisit })}</button>
      ) : null}
    </section>
  );
}

/** Both parents (or everyone): one shared cover over the day's best picture of any of them; their own cards follow. */
export function GroupStory({ members, stories, onOpenPhoto, isPhone }: HeroProps & { members: Member[]; stories: DayStory[] }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const cover = coverOf(s, stories);
  const anyVisit = stories.some((x) => x.visited);
  const size = cover.image ? 'tall' : anyVisit ? 'mid' : 'compact';
  const title = storyTitle(t, fmt, namesOf(t, members), stories[0], now.today, false);
  const avatar = (
    <span style={{ display: 'inline-flex' }}>
      {members.slice(0, 3).map((m, i) => <span key={m.id} style={{ marginLeft: i ? -18 : 0, display: 'inline-flex' }}><Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={size === 'compact' ? 52 : 64} ring /></span>)}
    </span>
  );
  return (
    <Cover image={cover.image} size={size} tall={isPhone ? '1 / 1' : '4 / 3'} avatar={avatar} title={title}
      onOpen={cover.open ? () => onOpenPhoto(cover.open!.photo, cover.open!.all) : undefined} />
  );
}

const bpLabel = (t: TFn, r: Reading) => `${r.sys}/${r.dia}${r.spo2 ? t('family.oxygen', { o: r.spo2 }) : ''}`;

/** Both mode: one card per parent with that day's status, health results, mood and the team's note. Bills live in the Bills tab. */
export function ParentStory({ m, story, onProfile, onDay, isPhone }: { m: Member; story: DayStory; onProfile: (id: string) => void; onDay: (d: ISODate) => void; isPhone: boolean }) {
  const { s, t, now } = useFamilyCtx();
  const status = useStatus(m, story);
  const isToday = story.date === now.today;
  const plan = planSummary(s, m, now.today);
  const here = story.state.kind === 'here';
  const bp = [story.arrival && { label: t('family.bpArrival', { t: story.arrival.time }), r: story.arrival }, story.departure && { label: t('family.bpDeparture', { t: story.departure.time }), r: story.departure }].filter(Boolean) as { label: string; r: Reading }[];
  const log = story.log ?? (isToday ? latestLogOf(s, m, now.today) : null);
  const withMood = story.log?.mood ? { text: moodWords(t, story.log.mood, isToday), color: MOOD_COLOR[story.log.mood] } : null;
  return (
    <section aria-label={memberName(m)} data-testid="parent-card" data-member={m.id} data-day={story.date} style={{ background: '#FFFFFF', borderRadius: 20, padding: isPhone ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: isPhone ? 'none' : SOFT_SHADOW, border: isPhone ? 'none' : '1px solid #EFE7DC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={isPhone ? 52 : 56} ring />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: isPhone ? 20 : 22, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{memberName(m)}</span>
          <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{planLeft(t, plan)}</span>
        </div>
        <button type="button" onClick={() => onProfile(m.id)} style={linkBtn}>{t('family.profile')}</button>
      </div>
      {status.text ? <StatusBanner {...status} /> : null}
      {withMood ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#24201C' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: withMood.color }} />{withMood.text}
        </span>
      ) : null}
      {!story.visited && story.lastVisit && !isToday && story.state.kind === 'away' ? <button type="button" onClick={() => onDay(story.lastVisit!)} style={{ ...quietLink, alignSelf: 'flex-start' }}>{t('family.storyLastVisit', { d: story.lastVisit })}</button> : null}
      {bp.map((b) => (
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: '1px solid #F0EAE1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontSize: 15, lineHeight: '22px', fontVariantNumeric: 'tabular-nums', color: '#6B6259' }}>{bpLabel(t, b.r)}</span>
          </div>
          <HealthPill status={b.r.status} />
        </div>
      ))}
      {!bp.length && here ? <span className="cp-hide-phone" style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{t('family.healthSoon', { n: nurseOf(s, t) })}</span> : null}
      {log && (log.note || log.mood) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14, borderTop: '1px solid #F0EAE1' }}>
          <Cap>{story.log ? t('family.notesTeam') : t('family.storyLastVisit', { d: log.date })}</Cap>
          <LogBlock m={m} log={log} compact />
        </div>
      ) : null}
    </section>
  );
}

const nurseOf = (s: Parameters<typeof firstOfRole>[0], t: (k: string) => string) => staffCall(firstOfRole(s, 'nurse')) || t('roles.nurse');
const latestLogOf = (s: Parameters<typeof latestLog>[0], m: Member, today: ISODate) => latestLog(s, m.id, today) ?? null;
