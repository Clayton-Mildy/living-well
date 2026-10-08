// Management overview (design ScrLight, mgmt branch): tiles, then Live today / Coming up / Requests from families / Enquiries.
// Every number and row is computed from the clubhouse's own data, so an empty clubhouse (Adina) shows zeros and empty states.
import { Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { actorName, memberName, type Enquiry } from '@cp/shared';
import { comingUp, familyRequests, liveToday, overviewStats, type ComingUpItem, type FamilyRequest } from '@cp/shared/rules/mgmt';
import { openEnquiries } from '@cp/shared/rules/enquiries';
import { Avatar, EmptyState, Group, PageHead } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { nextText } from '../enquiries/text';
import { Page, ListCard, LightRow, IconBox, DotText, tn } from './common';
import { memberPhoto } from '../../lib/media';

interface Tile { key: string; label: string; value: string; icon: string; to: string; badge?: { icon: string; fg: string; bg: string; label: string } }

const UP_ICON: Record<ComingUpItem['kind'], string> = { venue: 'storefront', outing: 'directions_bus', closed: 'event_busy', holiday: 'flag', trial: 'waving_hand', visit: 'meeting_room' };
const STAGE_ICON: Record<Enquiry['stage'], string> = { new: 'call', visit: 'meeting_room', trial: 'waving_hand', joined: 'how_to_reg', lost: 'block' };

export function Overview() {
  const t = useT();
  const { isPhone } = useDevice();
  const { lang, fdl, fds } = useFmt();
  const s = useClub();
  const { today } = useNow();
  const navigate = useNavigate();
  const st = useMemo(() => overviewStats(s, today), [s, today]);
  const empty = st.members === 0 && st.staff === 0;

  const tiles: Tile[] = [
    { key: 'inClub', label: t('mgmt.tileInClubNow'), value: String(st.inClub), icon: 'how_to_reg', to: '/arrivals' },
    { key: 'goneHome', label: t('mgmt.tileGoneHome'), value: String(st.goneHome), icon: 'home', to: '/arrivals' },
    { key: 'visits', label: t('mgmt.tileVisits'), value: String(st.visits), icon: 'event_available', to: '/arrivals' },
    { key: 'extra', label: t('mgmt.tileExtra'), value: String(st.extraVisits), icon: 'add_circle', to: '/billing', badge: st.extraVisits ? { icon: 'payments', fg: '#7A5510', bg: '#F6ECD6', label: t('mgmt.plNextInvoice') } : undefined },
    { key: 'review', label: t('mgmt.tileReview'), value: String(st.reviews), icon: 'fact_check', to: '/reviews' },
    { key: 'checks', label: t('nav.health'), value: String(st.checks), icon: 'monitor_heart', to: '/hchecks', badge: st.flagged ? { icon: 'visibility', fg: '#7A5510', bg: '#F6ECD6', label: t('mgmt.toWatch', { n: st.flagged }) } : { icon: 'check_circle', fg: '#3D6B4F', bg: '#E3EFE6', label: t('mgmt.allNormal') } },
    { key: 'overdue', label: t('mgmt.tileOverdue'), value: String(st.overdue), icon: 'receipt_long', to: '/billing', badge: { icon: 'error', fg: '#FFFFFF', bg: '#9A3D24', label: t('status.overdue') } },
    { key: 'enq', label: t('nav.enquiries'), value: String(st.enquiries), icon: 'contact_phone', to: '/enquiries' },
    { key: 'survey', label: t('mgmt.tileSurvey'), value: st.survey ? `${st.survey.avg.toFixed(1)} / 5` : t('mgmt.noAnswers'), icon: 'rate_review', to: '/surveys', badge: st.survey ? { icon: 'check_circle', fg: '#3D6B4F', bg: '#E3EFE6', label: tn(t, 'mgmt.nAnswers', st.survey.n) } : undefined },
    { key: 'photos', label: t('mgmt.tilePhotos'), value: String(st.photos), icon: 'photo_camera', to: '/camera?tab=library' },
    { key: 'logs', label: t('mgmt.tileLogs'), value: `${st.logsSaved} / ${st.logsTotal}`, icon: 'edit_note', to: '/log' },
    { key: 'lunch', label: t('mgmt.tileLunch'), value: st.lunchPhoto ? t('mgmt.posted') : t('mgmt.notYet'), icon: 'restaurant', to: '/menu' },
    { key: 'pay', label: t('mgmt.tilePayments'), value: String(st.payments), icon: 'payments', to: '/payments' },
    { key: 'stock', label: t('mgmt.tileStock'), value: String(st.stock), icon: 'inventory_2', to: '/stock' },
    { key: 'venue', label: t('mgmt.tileVenue'), value: String(st.venues), icon: 'storefront', to: '/venue' },
    { key: 'plans', label: t('nav.plans'), value: st.samplePrices ? t('mgmt.sample') : t('mgmt.priceSet'), icon: 'sell', to: '/plans', badge: st.samplePrices ? { icon: 'visibility', fg: '#7A5510', bg: '#F6ECD6', label: t('mgmt.samplePrices') } : { icon: 'check_circle', fg: '#3D6B4F', bg: '#E3EFE6', label: t('mgmt.clubPrices') } },
  ];

  const who = (a: string) => (a === 'system' ? t('mgmt.whoSystem') : a === 'doorCamera' ? t('mgmt.whoDoor') : actorName(s, a));
  const live = liveToday(s, today);
  const up = comingUp(s, today);
  const reqs = familyRequests(s, today);
  const enqs = openEnquiries(s).slice(0, 6);

  return (
    <Page gap={22}>
      <PageHead eyebrow={fdl(today)} title={t('nav.overview')} />
      {empty ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#6B6259' }}>{t('mgmt.emptyClub', { club: s.club.fullName })}</div> : null}

      {isPhone ? (
        // round 6, phone: the numbers are one flat group, two by two, each still a tap into its screen
        <Group pad="6px 16px 8px" gap={0}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px 16px' }}>
            {tiles.map((x) => (
              <button key={x.key} type="button" data-tile={x.key} onClick={() => navigate(x.to)} className="cp-press"
                style={{ minWidth: 0, padding: '10px 0', border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, color: '#24201C', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
                <span data-testid={`tile-${x.key}`} style={{ fontSize: 26, lineHeight: '30px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{x.value}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: '#6B6259' }}>
                  <IconBox name={x.icon} size={16} color="#75624B" />
                  {x.label}
                </span>
                {x.badge ? <span style={{ fontSize: 13, lineHeight: '18px' }}><DotText color={x.badge.fg === '#FFFFFF' ? '#9A3D24' : x.badge.fg}>{x.badge.label}</DotText></span> : null}
              </button>
            ))}
          </div>
        </Group>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'clamp(14px, 2.4vw, 32px) clamp(14px, 2.4vw, 32px)' }}>
        {tiles.map((x) => (
          <button key={x.key} type="button" data-tile={x.key} onClick={() => navigate(x.to)}
            style={{ minWidth: 0, padding: '0 0 12px', border: 'none', borderBottom: '2px solid #E6DDD1', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, color: '#24201C', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
            <span data-testid={`tile-${x.key}`} style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{x.value}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: '#6B6259' }}>
              <IconBox name={x.icon} size={16} color="#75624B" />
              {x.label}
            </span>
            {x.badge ? <span style={{ fontSize: 13, lineHeight: '18px' }}><DotText color={x.badge.fg === '#FFFFFF' ? '#9A3D24' : x.badge.fg}>{x.badge.label}</DotText></span> : null}
          </button>
        ))}
      </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(16px, 2.4vw, 32px)', alignItems: 'start' }}>
        <ListCard id="ov-live" title={t('mgmt.listLive')}>
          {live.length ? live.map((a) => (
            <Fragment key={a.id}>
              <LightRow icon={a.icon} title={t(a.key, a.params)} sub={`${a.at.slice(11, 16)} · ${who(a.actor)}`} onClick={a.memberId && s.members[a.memberId] ? () => navigate(`/members/${a.memberId}`) : undefined} />
            </Fragment>
          )) : <EmptyState icon="bolt" title={t('mgmt.liveEmpty')} />}
        </ListCard>

        <ListCard id="ov-up" title={t('mgmt.listUp')} >
          {up.length ? up.map((x) => (
            <Fragment key={x.id}>
              <LightRow icon={UP_ICON[x.kind]} title={upTitle(t, lang, x)} sub={fds(x.date) + (x.time ? ' · ' + x.time : '')} onClick={() => navigate('/calendar')} />
            </Fragment>
          )) : <EmptyState icon="event" title={t('mgmt.upEmpty')} />}
        </ListCard>

        <ListCard id="ov-req" title={t('mgmt.listReq')}>
          {reqs.length ? reqs.map((r) => {
            const m = s.members[r.memberId];
            if (!m) return null;
            return (
              <Fragment key={r.id}>
                <LightRow avatar={<Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={46} />} title={memberName(m)} sub={reqText(t, fds, r)} onClick={() => navigate(`/members/${m.id}/plan`)} />
              </Fragment>
            );
          }) : <EmptyState icon="inbox" title={t('mgmt.reqEmpty')} />}
        </ListCard>

        <ListCard id="ov-enq" title={t('nav.enquiries')} >
          {enqs.length ? enqs.map((e) => (
            <Fragment key={e.id}>
              <LightRow icon={STAGE_ICON[e.stage]} title={`${e.senior.title} ${e.senior.name}`} sub={`${e.contact.name} · ${nextText(t, fds, e)}`} right={t('enq.stage.' + e.stage)} onClick={() => navigate('/enquiries')} />
            </Fragment>
          )) : <EmptyState icon="contact_phone" title={t('mgmt.enqEmpty')} />}
        </ListCard>
      </div>
    </Page>
  );
}

type TFn = ReturnType<typeof useT>;
type Fds = (d: string) => string;
function upTitle(t: TFn, lang: string, x: ComingUpItem) {
  if (x.kind === 'venue') return t('mgmt.upVenue', { org: x.title });
  if (x.kind === 'trial') return t('mgmt.upTrial', { name: x.title });
  if (x.kind === 'visit') return t('mgmt.upVisit', { name: x.title });
  return lang === 'id' && x.titleId ? x.titleId : x.title;
}
function reqText(t: TFn, fds: Fds, r: FamilyRequest) {
  return t('mgmt.reqUpgrade', { to: t('mgmt.plan_' + r.to), date: fds(r.from) });
}
