// Activity teacher Today (design ScrLight, activity branch): Now/Next hero with Camera and Daily log, who is in the club, what is still to come.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayStatus, nextOpenDay, memberName, staffCall } from '@cp/shared';
import { activityName, cogSummary, inClubMembers, logOf, nowNext, roomName, type PlanItem, type SessionItem } from '@cp/shared/rules/activity';
import { dayInfo, eventTitle } from '@cp/shared/rules/calendar';
import { Card, EmptyState, Icon, PageHead, SectionLabel } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { Av, StatusDot, cogLine, heroCardStyle, heroEyebrow, plural } from './lib';

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
  const first = user?.kind === 'staff' ? user.staff.name.split(' ')[0] : '';
  const room = (r: Parameters<typeof roomName>[0]) => roomName(r, lang);

  // the first session of the next open day, shown once today's sessions are over
  const nextDay = useMemo(() => {
    if (nn.phase !== 'done') return null;
    const d = nextOpenDay(s, today);
    const a = dayInfo(s, d, 'staff').items.find((x) => x.kind === 'activity');
    return a ? { date: d, time: a.time ?? '', name: activityName({ name: a.title, nameId: a.titleId }, lang) } : null;
  }, [nn.phase, s, today, lang]);

  const buttons = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => navigate('/camera')} style={heroBtn(true)} className="dh5 cp-btn"><Icon name="photo_camera" size={20} />{t('nav.camera')}</button>
      <button type="button" onClick={() => navigate('/log')} style={heroBtn(false)} className="dh4 cp-btn"><Icon name="edit_note" size={20} />{t('nav.log')}</button>
    </div>
  );
  const heroCard = (label: ReactNode, title: ReactNode, sub: ReactNode) => (
    <Card pad={isPhone ? 16 : 'clamp(18px, 2.4vw, 26px)'} shadow style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 8 : 10 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontSize: isPhone ? 24 : 'clamp(24px, 2.4vw, 30px)', lineHeight: 1.25, fontWeight: 500, letterSpacing: '-0.4px', color: '#5E4E3B' }}>{title}</div>
      {sub ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#24201C' }}>{sub}</div> : null}
      <div style={{ marginTop: 4 }}>{buttons}</div>
    </Card>
  );

  let hero: ReactNode = null;
  const count = plural(t, 'activity.nInClub', people.length);
  if (outing) {
    const o = outing;
    hero = heroCard(t('activity.outingLabel'), eventTitle(o, lang), [o.from && o.to ? `${o.from}–${o.to}` : t('cal.allDay'), count].join(' · '));
  } else if (status.open && nn.current) {
    const c = nn.current;
    const parts = [room(c.room), c.staff ? t('activity.withTeacher', { name: staffCall(c.staff) }) : '', count].filter(Boolean);
    hero = heroCard(t(nn.phase === 'now' ? 'activity.nowAt' : 'activity.nextAt', { time: c.time }), activityName(c.activity, lang), parts.join(' · '));
  } else if (status.open && nn.phase === 'done') {
    hero = heroCard(t('activity.doneLabel'), t('activity.doneTitle'), [nextDay ? t('activity.nextDay', { day: fds(nextDay.date), time: nextDay.time, name: nextDay.name }) : ''].filter(Boolean).join(' '));
  } else if (status.open) {
    hero = heroCard(t('activity.noneLabel'), t('activity.noneTitle'), '');
  }

  const closedSub = shut ? t(shut.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) }) : '';

  const planRow = (it: PlanItem, i: number) => {
    const sess = it.kind === 'session' ? (it as SessionItem) : null;
    const title = sess ? activityName(sess.activity, lang) : t(it.kind === 'lunch' ? 'activity.lunch' : 'activity.tea');
    const sub = [room(it.room), sess?.staff ? staffCall(sess.staff) : ''].filter(Boolean).join(' · ');
    return (
      <div key={it.kind + it.time} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: i ? 16 : 0, borderTop: i ? '1px solid #E6DDD1' : 'none' }}>
        <span style={{ fontSize: 19, lineHeight: 1.3, fontWeight: 500, color: '#2B231C' }}>{title}</span>
        <span style={{ fontSize: 14, color: '#6B6259' }}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{it.time}</span>{sub ? ' · ' + sub : ''}</span>
      </div>
    );
  };
  const listHead = (title: ReactNode, meta: ReactNode) => (
    <div style={{ padding: '14px 0 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={heroEyebrow}>{title}</span>
      <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{meta}</span>
    </div>
  );
  const emptyRow = (text: string) => <div style={{ padding: '18px 0 14px', borderTop: '1px solid #F0EAE1', fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{text}</div>;

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(18px, 2.8vw, 32px)', maxWidth: 1100 }}>
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
              const logged = !!logOf(s, m.id, today);
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
              <span style={heroEyebrow}>{t('activity.laterToday')}</span>
              {nn.later.length ? nn.later.map(planRow) : <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('activity.nothingLater')}</span>}
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
