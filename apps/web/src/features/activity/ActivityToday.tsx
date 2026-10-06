// Activity teacher Today (design ScrLight, activity branch): Now/Next hero with Camera and Daily log, who is in the club, what is still to come.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayStatus, nextOpenDay, memberName, staffCall } from '@cp/shared';
import { activityName, cogSummary, inClubMembers, logOf, nowNext, roomName, type PlanItem, type SessionItem } from '@cp/shared/rules/activity';
import { dayInfo, eventTitle } from '@cp/shared/rules/calendar';
import { Card, EmptyState, Icon, PageHead, SectionLabel, FONT_BODY } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { Av, Badge, cogLine, plural } from './lib';

const heroBtn = (primary: boolean): CSSProperties => ({ height: 48, padding: '0 22px', borderRadius: 999, border: primary ? 'none' : '1px solid #75624B', background: primary ? '#75624B' : '#FFFFFF', color: primary ? '#FFFFFF' : '#75624B', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter' });

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
    <Card pad={isPhone ? 14 : 22} shadow style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 8 : 14 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontSize: isPhone ? 24 : 28, lineHeight: isPhone ? '30px' : '36px', letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</div>
      <div style={{ fontSize: isPhone ? 15 : 16, lineHeight: isPhone ? '22px' : '24px' }}>{sub}</div>
      {buttons}
    </Card>
  );

  let hero: ReactNode = null;
  const count = plural(t, 'activity.nInClub', people.length);
  if (outing) {
    const o = outing;
    hero = heroCard(t('activity.outingLabel'), eventTitle(o, lang), [o.from && o.to ? `${o.from}–${o.to}` : t('cal.allDay'), count].join(' · ') + (isPhone ? '' : '. ' + t('activity.heroNote')));
  } else if (status.open && nn.current) {
    const c = nn.current;
    const parts = [room(c.room), c.staff ? t('activity.withTeacher', { name: staffCall(c.staff) }) : '', count].filter(Boolean);
    hero = heroCard(t(nn.phase === 'now' ? 'activity.nowAt' : 'activity.nextAt', { time: c.time }), activityName(c.activity, lang), parts.join(' · ') + (isPhone ? '' : '. ' + t('activity.heroNote')));
  } else if (status.open && nn.phase === 'done') {
    hero = heroCard(t('activity.doneLabel'), t('activity.doneTitle'), [t('activity.doneSub'), nextDay ? t('activity.nextDay', { day: fds(nextDay.date), time: nextDay.time, name: nextDay.name }) : ''].filter(Boolean).join(' '));
  } else if (status.open) {
    hero = heroCard(t('activity.noneLabel'), t('activity.noneTitle'), t('activity.noneSub'));
  }

  const closedSub = shut ? t(shut.reason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(nextOpenDay(s, today)) }) : '';

  const planRow = (it: PlanItem) => {
    const sess = it.kind === 'session' ? (it as SessionItem) : null;
    const icon = sess ? sess.activity?.icon || 'interests' : it.kind === 'lunch' ? 'restaurant' : 'local_cafe';
    const title = sess ? activityName(sess.activity, lang) : t(it.kind === 'lunch' ? 'activity.lunch' : 'activity.tea');
    const sub = [room(it.room), sess?.staff ? staffCall(sess.staff) : ''].filter(Boolean).join(' · ');
    return (
      <div key={it.kind + it.time} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 64 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#75624B', flex: 'none' }}><Icon name={icon} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title}</span>
          <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{sub}</span>
        </div>
        <span style={{ fontSize: FONT_BODY, fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{it.time}</span>
      </div>
    );
  };
  const listHead = (title: ReactNode, meta: ReactNode) => (
    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <SectionLabel>{title}</SectionLabel>
      <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{meta}</span>
    </div>
  );
  const emptyRow = (text: string) => <div style={{ padding: '14px 20px 18px', borderTop: '1px solid #EFECEA', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{text}</div>;

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 22, maxWidth: 1100 }}>
      <PageHead eyebrow={fdl(today)} title={t('activity.hello', { n: first })} />
      {hero}
      {shut ? (
        <Card><EmptyState icon="event_busy" title={t('common.clubClosed')} sub={[shut.event ? cap(eventTitle(shut.event, lang)) : '', closedSub].filter(Boolean).join(' · ')} /></Card>
      ) : null}
      {status.open || people.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
          <Card>
            {listHead(t('activity.inClub'), String(people.length))}
            {people.length ? people.map((m) => {
              const logged = !!logOf(s, m.id, today);
              return (
                <button key={m.id} type="button" onClick={() => navigate(`/log?member=${m.id}`)} className="h-row" aria-label={`${memberName(m)}: ${t(logged ? 'activity.logged' : 'activity.notLogged')}`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: isPhone ? '9px 14px' : '12px 20px', border: 'none', borderTop: '1px solid #EFECEA', minHeight: isPhone ? 56 : 64, background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                  <Av m={m} size={40} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{memberName(m)}</span>
                    <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{cogLine(t, cogSummary(s, m))}</span>
                  </span>
                  {logged ? <Badge kind="paid" label={t('activity.logged')} /> : <Badge kind="pending" label={t('activity.notLogged')} />}
                </button>
              );
            }) : emptyRow(t('activity.nobodyYet'))}
          </Card>
          {status.open && !outing ? (
            <Card>
              {listHead(t('activity.laterToday'), '')}
              {nn.later.length ? nn.later.map(planRow) : emptyRow(t('activity.nothingLater'))}
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
