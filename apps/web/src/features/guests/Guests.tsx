// Guest hosts (KC round 7): people from outside the club who are invited and paid to lead a session (a guest teacher, a singer, a speaker).
// Two tabs: Sessions (booked, to pay, paid: who, which session, how much) and Hosts (who they are, what they do, their usual fee and bank details).
// Management books and edits; finance only reads (it pays the invoice in Receipts). Phone first: grouped lists, one filter dropdown, a pinned "Book a guest".
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rp, type GuestHost, type GuestSession, type ISODate, type Slot } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import { feeOfSession, guestIssue, guestLists, hostOfSession, hostTotals, hostsList } from '@cp/shared/rules/guests';
import { Button, EmptyState, FilterChips, Icon, PageHead, Pin, Segmented } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { NativeSeg, StatusDot } from '../activity/lib';
import { BookSheet } from './BookSheet';
import { Block, HostDetail, HostForm } from './HostViews';
import { SessionSheet } from './SessionSheet';
import { KindTile, issueText, kindLabel, rowStyle, stateOf } from './lib';

type Tab = 'sessions' | 'hosts';
type Filter = 'all' | 'upcoming' | 'toPay' | 'paid' | 'cancelled';
const FILTERS: Filter[] = ['all', 'upcoming', 'toPay', 'paid', 'cancelled'];

export function Guests() {
  const t = useT();
  const { lang, fds } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const { role } = useMe();
  const canEdit = role === 'mgmt';
  const [tab, setTab] = useState<Tab>('sessions');
  const [filter, setFilter] = useState<Filter>('all');
  const [book, setBook] = useState<null | { edit?: GuestSession; hostId?: string; date?: ISODate; slot?: Slot }>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostForm, setHostForm] = useState<null | 'new' | GuestHost>(null);

  // the calendar links here: ?book=date|slot opens the booking sheet on that session, ?session=id opens that booking
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const b = params.get('book');
    const sid = params.get('session');
    if (!b && !sid) return;
    if (b && canEdit) { const [date, slot] = b.split('|'); setBook({ date, slot: slot === '13:30' ? '13:30' : '10:30' }); }
    if (sid) { setTab('sessions'); setOpenId(sid); }
    setParams({}, { replace: true });
  }, [params, setParams, canEdit]);

  const lists = useMemo(() => guestLists(s), [s]);
  const hosts = useMemo(() => hostsList(s), [s]);
  const total = lists.upcoming.length + lists.doneToPay.length + lists.donePaid.length;
  const count: Record<Filter, number> = { all: total, upcoming: lists.upcoming.length, toPay: lists.toPay.length, paid: lists.paid.length, cancelled: lists.cancelled.length };

  const sessionRow = (g: GuestSession, i: number) => {
    const host = hostOfSession(s, g);
    const a = s.activities[g.activityId];
    const st = stateOf(s, g, t);
    const issue = guestIssue(s, g);
    const late = g.status === 'booked' && g.date < today;
    return (
      <button key={g.id} type="button" className={isPhone ? 'cp-tap-self' : 'h-row'} onClick={() => setOpenId(g.id)} data-testid="guest-row" style={rowStyle(i === 0, isPhone)}>
        {host ? <KindTile kind={host.kind} size={isPhone ? 36 : 42} /> : null}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host?.name ?? ''}</span>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{fds(g.date)} · {g.slot} · {activityName(a, lang)}</span>
          {issue || late ? <span style={{ fontSize: 13, fontWeight: 500, color: '#7A5510', lineHeight: 1.35 }}>{issue ? issueText(t, issue) : t('guests.late')}</span> : null}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{rp(feeOfSession(s, g))}</span>
          {st ? <span style={{ fontSize: 13 }}><StatusDot color={st.color}>{st.text}</StatusDot></span> : null}
        </span>
        <Icon name="chevron_right" size={20} color="#A89C8E" />
      </button>
    );
  };
  const group = (key: Exclude<Filter, 'all'>, rows: GuestSession[], meta?: string) => (
    <Block key={key} title={t('guests.g_' + key)} meta={meta ?? String(rows.length)}>{rows.map(sessionRow)}</Block>
  );
  // All: every session once (upcoming, then the past ones to pay, then the paid ones); a filter shows all of its kind (To pay includes booked sessions not paid yet)
  const shown: [Exclude<Filter, 'all'>, GuestSession[]][] = filter === 'all'
    ? ([['upcoming', lists.upcoming], ['toPay', lists.doneToPay], ['paid', lists.donePaid]] as [Exclude<Filter, 'all'>, GuestSession[]][]).filter(([, rows]) => rows.length > 0)
    : ([['upcoming', lists.upcoming], ['toPay', lists.toPay], ['paid', lists.paid], ['cancelled', lists.cancelled]] as [Exclude<Filter, 'all'>, GuestSession[]][]).filter(([k]) => k === filter);

  const hostRow = (h: GuestHost, i: number) => {
    const tot = hostTotals(s, h.id);
    return (
      <button key={h.id} type="button" className={isPhone ? 'cp-tap-self' : 'h-row'} onClick={() => setHostId(h.id)} data-testid="host-row" style={rowStyle(i === 0, isPhone)}>
        <KindTile kind={h.kind} size={isPhone ? 36 : 42} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
          <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.35 }}>{h.what} · {kindLabel(t, h.kind)}</span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{rp(h.fee)}</span>
          {!h.active ? <span style={{ fontSize: 13, color: '#6B6259' }}>{t('guests.inactive')}</span> : tot.owed ? <span style={{ fontSize: 13 }}><StatusDot color="#7A5510">{t('guests.owes', { amount: rp(tot.owed) })}</StatusDot></span> : null}
        </span>
        <Icon name="chevron_right" size={20} color="#A89C8E" />
      </button>
    );
  };

  const tabs = [{ value: 'sessions' as Tab, label: t('guests.sessions') }, { value: 'hosts' as Tab, label: t('guests.hosts') }];
  const bookBtn = () => setBook({});
  const actionLabel = tab === 'sessions' ? t('guests.book') : t('guests.addHost');
  const action = () => (tab === 'sessions' ? bookBtn() : setHostForm('new'));

  return (
    <>
      <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(18px, 2.8vw, 28px)' }}>
        <PageHead size={isPhone ? 28 : 40} title={t('nav.guests')} right={canEdit && !isPhone ? <Button icon={tab === 'sessions' ? 'event_available' : 'person_add'} onClick={action}>{actionLabel}</Button> : undefined} />
        {isPhone ? <NativeSeg label={t('guests.view')} value={tab} onChange={setTab} items={tabs} /> : <Segmented label={t('guests.view')} value={tab} onChange={setTab} items={tabs} />}

        {tab === 'sessions' ? (
          <>
            {total || lists.cancelled.length ? <FilterChips label={t('guests.filter')} value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f, label: t('guests.f_' + f), count: count[f] }))} /> : null}
            {shown.length ? shown.map(([k, rows]) => group(k, rows, k === 'toPay' && rows.length ? rp(rows.reduce((n, g) => n + feeOfSession(s, g), 0)) : undefined)) : (
              <Block pad={0}><EmptyState icon="co_present" title={t('guests.empty')} action={canEdit ? <Button icon="event_available" onClick={bookBtn}>{t('guests.book')}</Button> : undefined} /></Block>
            )}
          </>
        ) : (
          <Block title={t('guests.hosts')} meta={String(hosts.length)}>
            {hosts.length ? hosts.map(hostRow) : <EmptyState icon="person_add" title={t('guests.emptyHosts')} action={canEdit ? <Button icon="person_add" onClick={() => setHostForm('new')}>{t('guests.addHost')}</Button> : undefined} />}
          </Block>
        )}
      </div>
      {canEdit && isPhone ? <Pin icon={tab === 'sessions' ? 'event_available' : 'person_add'} label={actionLabel} onClick={action} /> : null}
      {canEdit ? <BookSheet open={!!book} onClose={() => setBook(null)} edit={book?.edit} hostId={book?.hostId} date={book?.date} slot={book?.slot} /> : null}
      <SessionSheet id={openId} onClose={() => setOpenId(null)} onEdit={(g) => { setOpenId(null); setBook({ edit: g }); }} />
      <HostDetail hostId={hostId} onClose={() => setHostId(null)} onBook={(id) => { setHostId(null); setBook({ hostId: id }); }} onEdit={(h) => setHostForm(h)} onOpenSession={(id) => { setOpenId(id); }} />
      {canEdit ? <HostForm open={!!hostForm} onClose={() => setHostForm(null)} host={hostForm && hostForm !== 'new' ? hostForm : undefined} /> : null}
    </>
  );
}
