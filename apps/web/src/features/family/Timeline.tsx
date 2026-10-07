// "Today at the club": the club's programme (sessions, lunch with the allergy line and the kitchen's photos, tea), plus the member's arrival,
// health check and home time once they happen. Members drop in, so nothing is "expected". No timeline on a closed day or after membership ends.
import { Fragment, type ReactNode } from 'react';
import { firstOfRole, lunchSafety, memberShort, staffCall, visibleLunchPhotos, type Member, type Photo } from '@cp/shared';
import { activityLabel, dayStateOf, dishNamesOf, eventTitle, roomLabel, servedLunch, staffFirst, staffIdOf, timelineOf, type TlItem, type TlState } from '@cp/shared/rules/family';
import { Button, EmptyState, Icon, PhotoImg } from '../../components/ui';
import { useFamilyCtx } from './useFamily';
import { H2, HealthPill, fcard } from './parts';

const DOT: Record<TlState, { dotBg: string; dotBd: string; dotFg: string; fill: 0 | 1 }> = {
  done: { dotBg: '#F3EEE8', dotBd: 'none', dotFg: '#6E5A43', fill: 0 },
  now: { dotBg: '#2B231C', dotBd: 'none', dotFg: '#FFFFFF', fill: 1 },
  up: { dotBg: '#FFFFFF', dotBd: '1.5px solid #DCD3C8', dotFg: '#8A8078', fill: 0 },
};

interface Props {
  members: Member[];
  onFeedback: () => void;
  /** `all`: every lunch photo of the day, so the viewer can page through them */
  onOpenPhoto: (p: Photo, all?: Photo[]) => void;
}

export function Timeline({ members, onFeedback, onOpenPhoto }: Props) {
  const { s, t, fmt, now, pron } = useFamilyCtx();
  const { today, nowMin } = now;
  const states = members.map((m) => dayStateOf(s, m, today));
  // members drop in on any open day, so the programme shows whether or not anyone has arrived; only a closed day or an ended membership has none
  const showTimeline = states.some((x) => x.kind === 'away' || x.kind === 'here' || x.kind === 'home');

  // ----- no timeline: club closed / membership ended -----
  if (!showTimeline) {
    const first = states[0];
    let icon = 'event', title: string = t('family.notToday'), sub: ReactNode = '';
    if (first.kind === 'closed') {
      icon = 'event_busy';
      title = t('common.clubClosed');
      const date = fmt.fdl(first.next);
      sub = first.reason === 'weekend' ? t('common.weekendSub', { date }) : <>{eventTitle(first.event, fmt.lang) ? <>{eventTitle(first.event, fmt.lang)}. </> : null}{t('common.clubClosedSub', { date })}</>;
    } else if (first.kind === 'ended') {
      icon = 'archive';
      title = t('family.stEnded', { d: fmt.fds(first.lastDay) });
    } else if (first.kind === 'upcoming') {
      title = t('family.stUpcoming', { d: fmt.fds(first.start) });
    }
    return (
      <div style={fcard('', 14)} data-testid="timeline-empty">
        <H2>{t('family.todayAtClub')}</H2>
        <EmptyState icon={icon} title={title} sub={sub} />
      </div>
    );
  }

  // ----- the timeline -----
  const items = timelineOf(s, members, today, nowMin);
  const single = members.length === 1 ? members[0] : null;
  const nurse = firstOfRole(s, 'nurse');
  const staffName = (by: string | undefined) => staffFirst(s, staffIdOf(by)) || t('family.theLobby');
  const foods = (m: Member) => [...m.health.food.map((f) => t('family.food_' + f)), ...(m.health.foodOther ? [m.health.foodOther] : [])].join(` ${t('common.and')} `);

  const view = (it: TlItem): { icon: string; time: string; title: string; detail: ReactNode; badge?: ReactNode; extra?: ReactNode } => {
    switch (it.kind) {
      case 'arrival':
        return { icon: 'how_to_reg', time: it.time, title: t('family.tArrived'), detail: t('family.tArrivedD', { s: staffName(it.att.checkIn?.by) }) };
      case 'health': {
        const arr = it.arrival;
        if (!arr) return { icon: 'monitor_heart', time: '', title: t('family.tHealthUp'), detail: t('family.tHealthUpD', { n: staffCall(nurse) || t('roles.nurse') }) };
        const parts: string[] = [];
        if (arr.sys != null && arr.dia != null) parts.push(arr.spo2 != null ? t('health.healthD', { b: `${arr.sys}/${arr.dia}`, o: arr.spo2 }) : `${t('health.bp')} ${arr.sys}/${arr.dia}`);
        else if (arr.spo2 != null) parts.push(`SpO₂ ${arr.spo2}%`);
        if (arr.temp != null) parts.push(t('family.tempLine', { t: arr.temp }));
        if (it.monthly) { if (it.monthly.glucose != null) parts.push(`${it.monthly.glucose} mg/dL`); if (it.monthly.weight != null) parts.push(`${it.monthly.weight} kg`); }
        if (arr.shared) { for (const k of arr.noteKeys) parts.push(t('health.note.' + k)); if (arr.note) parts.push(arr.note); }
        return { icon: 'monitor_heart', time: it.time, title: t('family.tHealth'), detail: parts.join(' · '), badge: <HealthPill status={arr.status} style={{ marginTop: 4 }} /> };
      }
      case 'session':
        return { icon: s.activities[it.activityId]?.icon || 'interests', time: it.time, title: activityLabel(s, it.activityId, fmt.lang), detail: [roomLabel(s, it.roomId, fmt.lang), staffFirst(s, it.staffId)].filter(Boolean).join(' · ') };
      case 'outing':
        return { icon: 'directions_bus', time: it.time, title: eventTitle(it.event, fmt.lang), detail: `${it.event.from || ''}–${it.event.to || ''}` };
      case 'lunch': {
        const groups = new Map<string, Member[]>();
        for (const m of members) { const k = dishNamesOf(s, servedLunch(s, m, today)).join(', '); groups.set(k, [...(groups.get(k) || []), m]); }
        const lines: string[] = [];
        for (const [dishes, ms] of groups) if (dishes) lines.push(groups.size > 1 ? `${ms.map(memberShort).join(` ${t('common.and')} `)}: ${dishes}.` : `${dishes}.`);
        for (const m of members) {
          const ls = lunchSafety(s, m.id, today);
          if (ls.kind === 'clear') lines.push(t('family.tLunchSafe', { n: memberShort(m), a: foods(m) }));
          else if (ls.kind === 'alternative') lines.push(t('family.tLunchAlt', { n: memberShort(m), a: foods(m), d: ls.dish, x: ls.alternative }));
        }
        const photos = visibleLunchPhotos(s, today); // the kitchen's approved photos (a family never receives pending ones)
        return {
          icon: 'restaurant', time: it.time, title: t('family.tLunch'),
          detail: <>{lines.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}</>,
          extra: (
            <>
              {photos.length ? <LunchPhotos photos={photos} caption={t('family.lunchPhoto')} alt={(p) => t('kitchen.photo.alt', { time: p.time })} onOpen={onOpenPhoto} /> : null}
              <Button variant="ghost" size={44} onClick={onFeedback} style={{ alignSelf: 'flex-start', padding: '0 4px' }}>{t('family.lunchFeedback')}</Button>
            </>
          ),
        };
      }
      case 'tea':
        return { icon: 'local_cafe', time: it.time, title: t('family.tTea'), detail: dishNamesOf(s, it.dishIds).join(', ') };
      case 'home': {
        const m = single!;
        if (it.att?.checkOut) {
          const dep = it.departure;
          const bp = dep && dep.sys != null && dep.dia != null ? ` · ${t('family.tHomeBp', { b: `${dep.sys}/${dep.dia}` })}` : '';
          return { icon: 'home', time: it.time, title: t('family.tHome'), detail: t('family.tHomeDoneD', { s: staffName(it.att.checkOut.by) }) + bp, badge: dep ? <HealthPill status={dep.status} style={{ marginTop: 4 }} /> : undefined };
        }
        return { icon: 'home', time: it.time, title: t('family.tHome'), detail: t('family.tHomeD', { s: pron(m).s }) };
      }
    }
  };

  const views = items.map((it) => ({ it, v: view(it) }));
  return (
    <div style={fcard('', 10)} data-testid="timeline">
      <H2>{t('family.todayAtClub')}</H2>
      <ol style={{ display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 }}>
        {views.map(({ it, v }, i) => {
          const d = DOT[it.state];
          const last = i === views.length - 1;
          return (
            <Fragment key={it.id}>
              <li style={{ display: 'flex', gap: 14 }} data-tl={it.id} data-state={it.state}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 34 }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 999, background: d.dotBg, border: d.dotBd, color: d.dotFg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name={v.icon} size={18} fill={d.fill} weight={300} color={d.dotFg} />
                  </span>
                  <span style={{ flex: 1, width: 2, minHeight: 12, background: last ? 'transparent' : '#F0EAE1' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#6B6259', lineHeight: 1.4 }}>{v.time}</span>
                    {it.state === 'now' ? <span style={{ height: 22, padding: '0 8px', borderRadius: 8, background: '#2B231C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center' }}>{t('family.now')}</span> : null}
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
    </div>
  );
}

/** The kitchen's approved lunch photos of the day, as thumbnails. Each opens in the viewer. */
function LunchPhotos({ photos, caption, alt, onOpen }: { photos: Photo[]; caption: string; alt: (p: Photo) => string; onOpen: (p: Photo, all: Photo[]) => void }) {
  return (
    <div data-testid="lunch-photos" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <span style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{caption}{photos.length === 1 ? ` · ${photos[0].time}` : ''}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpen(p, photos)} aria-label={alt(p)} data-testid="lunch-photo" data-photo-id={p.id}
            style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, border: 'none', padding: 0, overflow: 'hidden', cursor: 'pointer', background: '#F3EEE8', flex: 'none' }}>
            <PhotoImg photo={p} />
          </button>
        ))}
      </div>
    </div>
  );
}
