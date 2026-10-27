// The day's list (round 8, as a timeline in round 8b): "Next" today (what is still to come), "That day" on an earlier day the parent came, "What was on" on a day
// they did not. A vertical rail runs down the left with a dot per step (the shared RailDot: passed steps and their line bronze, the step now ink with a half line,
// later steps on a grey track); to the right of each dot sit the time, the title with its details and a "View image" pill that opens that step's pictures. Our
// richer details stay: the lunch dishes and the allergy line, the guest host, joined in / took a rest, how much was eaten, the health reading. Members drop in,
// so nothing is "expected".
// KC round 9: a step with pictures shows its newest one on the right, fading in from the white (no "View image" pill to find); a tap opens the row
// downwards with the step's pictures as big cards, and a card opens the full-screen viewer. Lunch has its own "Tell the kitchen about lunch" line.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, firstOfRole, lunchSafety, displayName, staffCall, visibleTeaPhotos, type ISODate, type Member, type Photo, type Reading } from '@cp/shared';
import { activityLabel, dayStateOf, dishNamesOf, eventTitle, roomLabel, servedLunch, staffFirst, staffIdOf, timelineOf, storyNowMin, type DayStory, type StorySession, type TlItem } from '@cp/shared/rules/family';
import { listItems, listKind } from '@cp/shared/rules/famToday';
import { Avatar, Icon, PhotoImg, RailDot } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { mediaUrl } from '../../lib/media';
import type { TFn } from '../../lib/i18n';
import { Cap, F, TextLink } from './kit';
import { HealthPill } from './parts';
import { stepIcon } from './storyBits';
import { useFamilyCtx } from './useFamily';

interface Props {
  members: Member[];
  /** one story per member (same date) */
  stories: DayStory[];
  date: ISODate;
  /** `all`: every picture of the step, so the viewer can page through them */
  onOpenPhoto: (p: Photo, all?: Photo[]) => void;
  /** open another day (the last visit) */
  onDay: (d: ISODate) => void;
  /** KC round 9: the lunch row's own way to the lunch feedback sheet (what the row at the foot of the page says) */
  lunchFeedback?: { label: string; onClick: () => void };
}

const bpOf = (r: Reading) => (r.sys != null && r.dia != null ? `${r.sys}/${r.dia}` : '');
/** "Blood pressure normal · 128/82", or just "Blood pressure 152/94" (the pill under it says what the nurse is doing). */
const bpLine = (t: TFn, r: Reading) => (bpOf(r) ? t(r.status === 'normal' ? 'family.storyBpOk' : 'family.storyBp', { b: bpOf(r) }) : '');

const line = (children: ReactNode, key?: string | number, extra?: { color?: string; testId?: string }) => (
  <span key={key} data-testid={extra?.testId} style={{ display: 'block', color: extra?.color }}>{children}</span>
);

/** A small dot and words: joined in (sage) or took a rest (warm grey, never a mark against anyone). */
function Took({ took, name }: { took: 'joined' | 'satOut'; name?: string }) {
  const { t } = useFamilyCtx();
  return (
    <span data-testid="took" data-took={took} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: took === 'joined' ? F.sage : F.muted }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: took === 'joined' ? F.sageDot : '#BBA88F', flex: 'none' }} />
      {name ? `${name} · ` : ''}{t(took === 'joined' ? 'family.storyJoined' : 'family.storySatOut')}
    </span>
  );
}

function Guest({ g }: { g: NonNullable<StorySession['guest']> }) {
  const { t } = useFamilyCtx();
  return (
    <span data-testid="guest-host" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: F.muted }}>
      <Avatar name={g.name} src={g.photoMediaId ? mediaUrl(g.photoMediaId) : undefined} size={22} />
      <span style={{ minWidth: 0 }}>{t('family.storyWithGuest', { n: g.name })}{g.what ? ` · ${g.what}` : ''}</span>
    </span>
  );
}

interface Row { time: string; title: string; detail?: ReactNode; extra?: ReactNode; photos?: Photo[]; kind?: 'session' | 'lunch' | 'tea'; alt?: (p: Photo) => string }

export function Timeline({ members, stories, date, onOpenPhoto, onDay, lunchFeedback }: Props) {
  const { s, t, fmt, now, pron } = useFamilyCtx();
  const [open, setOpen] = useState<string | null>(null); // the step whose pictures are opened out
  const navigate = useNavigate();
  const { isPhone } = useDevice();
  const { today } = now;
  const isToday = date === today;
  const nowMin = storyNowMin(date, today, now.nowMin);
  const states = members.map((m) => dayStateOf(s, m, date));
  // members drop in on any open day, so the programme shows whether or not anyone has arrived; only a closed day or an ended membership has none (the hero says so)
  if (!states.some((x) => x.kind === 'away' || x.kind === 'here' || x.kind === 'home')) return null;
  const visited = stories.some((x) => x.visited);
  const all = stories.length === 1 ? stories[0].items : timelineOf(s, members, date, nowMin);
  const ahead = date > today; // KC round 9: the day ahead — its plan
  const kind = listKind(isToday, visited, all, ahead);
  const items = listItems(kind, all);
  if (!items.length) return null;
  const single = members.length === 1 ? members[0] : null;
  const nurse = firstOfRole(s, 'nurse');
  const staffName = (by: string | undefined) => staffFirst(s, staffIdOf(by)) || t('family.theLobby');
  const foods = (m: Member) => [...m.health.food.map((f) => t('family.food_' + f)), ...(m.health.foodOther ? [m.health.foodOther] : [])].join(` ${t('common.and')} `);
  const sessionOf = (id: string) => stories.map((st, i) => ({ m: members[i], x: st.sessions.find((y) => y.id === id) })).filter((r): r is { m: Member; x: StorySession } => !!r.x);

  const view = (it: TlItem): Row => {
    switch (it.kind) {
      case 'arrival':
        return { time: it.time, title: t('family.tArrived'), detail: t('family.tArrivedD', { s: staffName(it.att.checkIn?.by) }) };
      case 'health': {
        const arr = it.arrival;
        if (!arr) return { time: '', title: t('family.tHealthUp'), detail: t('family.tHealthUpD', { n: staffCall(nurse) || t('roles.nurse') }) };
        const parts: string[] = [];
        const bp = bpLine(t, arr);
        if (bp) parts.push(bp);
        if (arr.spo2 != null) parts.push(t('family.storyOxygen', { o: arr.spo2 }));
        if (arr.temp != null) parts.push(t('family.tempLine', { t: arr.temp }));
        if (it.monthly) { if (it.monthly.glucose != null) parts.push(`${it.monthly.glucose} mg/dL`); if (it.monthly.weight != null) parts.push(`${it.monthly.weight} kg`); }
        if (arr.shared) { for (const k of arr.noteKeys) parts.push(t('health.note.' + k)); if (arr.note) parts.push(arr.note); }
        return {
          time: it.time, title: t('family.tHealth'), detail: parts.join(' · '),
          extra: (
            <>
              {arr.status !== 'normal' ? <HealthPill status={arr.status} style={{ marginTop: 6 }} /> : null}
              <TextLink size={13} onClick={() => navigate('/health')} style={{ minHeight: 28 }}>{t('family.storyHealthLink')}</TextLink>
            </>
          ),
        };
      }
      case 'session': {
        // the activity pictures of this session (families get only approved ones, and only on a day one of these members came)
        const rows = sessionOf(it.id);
        const shots = Array.from(new Map(rows.flatMap((r) => r.x.photos).map((p) => [p.id, p])).values()).sort((p, q) => (p.time + p.id < q.time + q.id ? -1 : 1));
        const title = activityLabel(s, it.activityId, fmt.lang);
        const guest = rows.find((r) => r.x.guest)?.x.guest ?? null;
        const took = rows.filter((r) => r.x.took);
        return {
          time: it.time, title, kind: 'session', photos: [...shots].reverse(), alt: (p) => t('family.photoAria', { a: title, t: p.time }),
          detail: (
            <>
              {line([roomLabel(s, it.roomId, fmt.lang), staffFirst(s, it.staffId)].filter(Boolean).join(' · '), 'where')}
              {guest ? <span style={{ display: 'block', marginTop: 4 }}><Guest g={guest} /></span> : null}
              {took.length ? <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>{took.map((r) => <Took key={r.m.id} took={r.x.took!} name={members.length > 1 ? displayName(r.m) : undefined} />)}</span> : null}
            </>
          ),
        };
      }
      case 'outing':
        return { time: it.time, title: eventTitle(it.event, fmt.lang), detail: `${it.event.from || ''}–${it.event.to || ''}` };
      case 'lunch': {
        // round 14: once a parent has come, the dishes, the lunch pictures and how much was eaten are on the Lunch card (LunchCard.tsx) and the row keeps the time, the
        // allergy line and the feedback line; before that (the day ahead, a day nobody came) the card is not shown, so the row still tells the menu
        const lines: ReactNode[] = [];
        if (!stories.some((st) => st.visited && st.lunch)) {
          const groups = new Map<string, Member[]>();
          for (const m of members) { const k = dishNamesOf(s, servedLunch(s, m, date)).join(', '); groups.set(k, [...(groups.get(k) || []), m]); }
          for (const [dishes, ms] of groups) if (dishes) lines.push(line(groups.size > 1 ? `${ms.map(displayName).join(` ${t('common.and')} `)}: ${dishes}.` : `${dishes}.`, 'dish-' + dishes));
        }
        if (isToday || ahead) { // the allergy line also for tomorrow's lunch
          for (const m of members) {
            const ls = lunchSafety(s, m.id, date);
            const day = fmt.fd(date, { weekday: 'long' }); // the day ahead says whose menu it is ("Monday's menu"), today says "today's"
            if (ls.kind === 'clear') lines.push(line(ahead ? t('ftoday.planLunchSafe', { n: displayName(m), a: foods(m), day }) : t('family.tLunchSafe', { n: displayName(m), a: foods(m) }), 'safe-' + m.id, { color: F.sage, testId: 'lunch-safe' }));
            else if (ls.kind === 'alternative') lines.push(line(ahead ? t('ftoday.planLunchAlt', { n: displayName(m), a: foods(m), d: ls.dish, x: ls.alternative, day }) : t('family.tLunchAlt', { n: displayName(m), a: foods(m), d: ls.dish, x: ls.alternative }), 'alt-' + m.id, { color: F.ochre, testId: 'lunch-alt' }));
          }
        }
        return {
          time: it.time, title: t('family.tLunch'), kind: 'lunch',
          detail: <>{lines}</>,
          extra: lunchFeedback ? (
            <button type="button" onClick={lunchFeedback.onClick} data-testid="lunch-feedback-line" className="cp-press"
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, minHeight: 28, padding: 0, border: 'none', background: 'transparent', color: F.bronze, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
              <Icon name="rate_review" size={16} color={F.bronze} />{lunchFeedback.label}<Icon name="chevron_right" size={16} color={F.bronze} />
            </button>
          ) : undefined,
        };
      }
      case 'tea':
        return { time: it.time, title: t('family.tTea'), detail: dishNamesOf(s, it.dishIds).join(', '), kind: 'tea', photos: visibleTeaPhotos(s, date), alt: (p) => t('kitchen.photo.tea.alt', { time: p.time }) };
      case 'home': {
        const m = single;
        if (it.att?.checkOut) {
          const dep = it.departure;
          const bp = dep ? bpLine(t, dep) : '';
          return { time: it.time, title: t('family.tHome'), detail: t('family.tHomeDoneD', { s: staffName(it.att.checkOut.by) }) + (bp ? ` · ${bp}` : ''), extra: dep && dep.status !== 'normal' ? <HealthPill status={dep.status} style={{ marginTop: 6 }} /> : undefined };
        }
        return { time: it.time, title: t('family.tHome'), detail: m ? t('family.tHomeD', { s: pron(m).s }) : '' };
      }
    }
  };

  // KC round 10: today, when nobody came, the programme reads "At the club today" (the last visit has its own card above); an earlier day keeps "What was on"
  const head = kind === 'plan' ? (date === addDays(today, 1) ? t('ftoday.planTomorrow') : t('ftoday.planOn', { d: fmt.fd(date, { weekday: 'long' }) })) : kind === 'wasOn' && isToday ? t('ftoday.wasOnToday') : t('ftoday.' + kind);
  // an earlier day nobody came: a way to the last visit (today has the Last visit card instead)
  const lastVisit = kind === 'wasOn' && !isToday ? stories.map((x) => x.lastVisit).filter((d): d is ISODate => !!d).sort().pop() : undefined;
  const dot = isPhone ? 32 : 34;
  return (
    <section data-testid="timeline" data-day={date} data-kind={kind} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* KC round 9: "View calendar" on the right of every day's list (that day, today, tomorrow's plan) opens the calendar on that day */}
      <Cap right={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          {lastVisit ? <TextLink size={14} onClick={() => onDay(lastVisit)} testId="last-visit" style={{ minHeight: 24 }}>{t('ftoday.lastVisit')}</TextLink> : null}
          <TextLink size={14} onClick={() => navigate(`/calendar?date=${date}`)} testId="view-calendar" style={{ minHeight: 24 }}>{t('ftoday.viewCalendar')}</TextLink>
        </span>
      )}>{head}</Cap>
      <ol style={{ listStyle: 'none', margin: 0, padding: '0 4px', display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => {
          const v = view(it);
          const st = kind === 'wasOn' || kind === 'plan' ? 'up' : it.state; // a day they did not come, or the day ahead: the programme on a light track (nothing done yet)
          const isNow = kind === 'next' && it.state === 'now';
          const n = v.photos?.length ?? 0;
          const last = i === items.length - 1;
          return (
            <li key={it.id} data-tl={it.id} data-state={st} style={{ display: 'flex', gap: 14 }}>
              <RailDot state={st} icon={stepIcon(s, it)} last={last} size={dot} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: `3px 0 ${last ? 2 : 18}px` }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {v.time || isNow ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                      {v.time ? <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: F.muted }}>{v.time}</span> : null}
                      {isNow ? <span style={{ height: 20, padding: '0 7px', borderRadius: 7, background: F.ink, color: '#FFFFFF', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center' }}>{t('family.now')}</span> : null}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 16, lineHeight: 1.35, fontWeight: 500, color: F.text, overflowWrap: 'anywhere' }}>{v.title}</span>
                  {v.detail ? <span style={{ fontSize: 13, lineHeight: '19px', color: F.muted, overflowWrap: 'anywhere' }}>{v.detail}</span> : null}
                  {v.extra}
                </div>
                {n ? (
                  // the newest picture, fading in from the white on its left; a tap opens the row's pictures underneath (again: folds them away)
                  <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id} aria-label={`${n > 1 ? t('ftoday.viewImages', { n }) : t('ftoday.viewImage')} · ${v.title}`} data-testid={`${v.kind}-photos`} data-count={n}
                    style={{ position: 'relative', flex: '0 0 42%', maxWidth: 190, minHeight: 72, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 14, overflow: 'hidden' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 28%, #000 70%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 28%, #000 70%)' }}><PhotoImg photo={v.photos![0]} /></span>
                    <span aria-hidden="true" style={{ position: 'absolute', right: 6, bottom: 6, height: 24, padding: '0 8px 0 6px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Icon name={open === it.id ? 'expand_less' : 'photo_library'} size={15} />{n}
                    </span>
                  </button>
                ) : null}
              </div>
              {n && open === it.id ? (
                <div data-testid={`${v.kind}-photos-open`} className="cp-snap cp-pillrow" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', animation: 'cpUp .22s ease-out' }}>
                  {v.photos!.map((p) => (
                    <button key={p.id} type="button" onClick={() => onOpenPhoto(p, v.photos)} aria-label={v.alt ? v.alt(p) : v.title} data-photo-id={p.id}
                      style={{ position: 'relative', flex: n > 1 ? '0 0 min(240px, 78%)' : '0 0 100%', aspectRatio: '4 / 3', border: 'none', padding: 0, borderRadius: 14, overflow: 'hidden', background: F.fill, cursor: 'pointer', scrollSnapAlign: 'start' }}>
                      <PhotoImg photo={p} />
                      <span aria-hidden="true" style={{ position: 'absolute', left: 8, bottom: 8, height: 22, padding: '0 8px', borderRadius: 999, background: 'rgba(20,16,12,.55)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{p.time}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
