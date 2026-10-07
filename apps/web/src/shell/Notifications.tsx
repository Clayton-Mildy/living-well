// Notification bell + panel: "Needs action" (derived, clears itself) and "Updates" (stored, per-user read state).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionItems, updatesFor, type ActionItem, type Notification } from '@cp/shared';
import { Drawer, Sheet, Icon, Segmented, EmptyState, Button, Pager, usePaged, FONT_BODY } from '../components/ui';
import { useT, useFmt } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useNow } from '../lib/clock';
import { useAct } from '../lib/act';
import { useClub } from '../store/replica';
import { useDevice } from '../hooks/useDevice';
import { say } from '../store/ui';

const KIND_ICON: Record<string, string> = {
  'notif.act.review': 'fact_check', 'notif.act.reviewFlagged': 'fact_check', 'notif.act.alertReading': 'warning', 'notif.act.contract': 'badge', 'notif.act.complaint': 'forum',
  'notif.act.overdue': 'error', 'notif.act.budgetApprove': 'pie_chart', 'notif.act.receiptApprove': 'receipt_long', 'notif.act.vendorApprove': 'request_quote', 'notif.act.invoiceRun': 'event_repeat',
  'notif.act.stockApprove': 'inventory_2', 'notif.act.guestTrial': 'waving_hand', 'notif.act.guestTrialDay': 'waving_hand', 'notif.act.guestVisit': 'meeting_room', 'notif.act.readyCheckout': 'home',
  'notif.act.queue': 'monitor_heart', 'notif.act.logs': 'edit_note', 'notif.act.allergen': 'no_food', 'notif.act.unread': 'chat', 'notif.act.invoiceDue': 'receipt_long', 'notif.act.invoiceOverdue': 'error',
  'notif.act.survey': 'rate_review', 'notif.act.docRequested': 'upload_file', 'notif.checkedIn': 'how_to_reg', 'notif.checkedOut': 'home', 'notif.newPhotos': 'photo_library', 'notif.logSaved': 'edit_note',
  'notif.paymentReceived': 'payments', 'notif.reviewApproved': 'task_alt', 'notif.reviewRejected': 'block', 'notif.reviewReverted': 'undo', 'notif.reviewSubmitted': 'fact_check', 'notif.reviewFlagged': 'fact_check',
  'lobby.notif.extraVisit': 'payments', 'notif.act.planRequest': 'sell', 'notif.act.photosReview': 'photo_library', 'kitchen.notif.feedbackNew': 'forum', 'kitchen.notif.feedbackReply': 'forum', 'health.notif.alert': 'warning', 'health.notif.guestAlert': 'warning', 'kitchen.notif.lunchPhoto': 'photo_camera', 'kitchen.notif.alternative': 'no_food',
  'kitchen.notif.stockApproved': 'task_alt', 'kitchen.notif.stockDeclined': 'block', 'finance.notif.paid': 'payments', 'enq.notif.newLead': 'person_add', 'mgmt.notif.broadcastSent': 'campaign',
  'cal.notif.schedulePublished': 'calendar_month', 'members.notif.welcome': 'waving_hand',
};
// kinds without their own icon fall back to their area's icon
const AREA_ICON: Record<string, string> = {
  family: 'family_restroom', lobby: 'how_to_reg', health: 'monitor_heart', members: 'person', care: 'edit_note', activity: 'photo_library', cal: 'calendar_month',
  kitchen: 'restaurant', chat: 'chat', finance: 'payments', mgmt: 'campaign', enq: 'contact_phone', people: 'badge', requests: 'add_shopping_cart',
};
const PER_PAGE = 10;
export const iconFor = (kind: string, fallback: string) => KIND_ICON[kind] || AREA_ICON[kind.split('.')[0]] || fallback;

export function useBell() {
  const s = useClub();
  const { user } = useMe();
  const { today, nowMin } = useNow();
  return useMemo(() => {
    if (!s || !user) return { items: [] as ActionItem[], updates: [] as Notification[], unread: 0, count: 0 };
    const items = actionItems(s, user, today, nowMin);
    const updates = updatesFor(s, user);
    const unread = updates.filter((n) => !n.readBy.includes(user.id)).length;
    return { items, updates, unread, count: items.length + unread };
  }, [s, user, today, nowMin]);
}

export function NotificationBell({ onClick }: { onClick: () => void }) {
  const t = useT();
  const { count, items } = useBell();
  // urgent items arriving live also pop a toast
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const urgent = items.filter((i) => i.severity === 'urgent');
    if (seen.current === null) { seen.current = new Set(urgent.map((i) => i.id)); return; }
    for (const i of urgent) if (!seen.current.has(i.id)) { seen.current.add(i.id); say(t(i.kind, i.params), { tone: 'urgent', icon: iconFor(i.kind, 'warning') }); }
  }, [items, t]);
  return (
    <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} className="h-cream" style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: '#24201C' }}>
      <Icon name="notifications" size={22} color="#24201C" />
      {count ? <span style={{ position: 'absolute', top: 5, right: 4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 8, background: items.some((i) => i.severity === 'urgent') ? '#9A3D24' : '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}>{count > 99 ? '99+' : count}</span> : null}
    </button>
  );
}

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { fds } = useFmt();
  const { isPhone } = useDevice();
  const navigate = useNavigate();
  const act = useAct();
  const { user } = useMe();
  const { items, updates, unread } = useBell();
  const { today } = useNow();
  const [tab, setTab] = useState<'action' | 'updates'>('action');
  useEffect(() => { if (open) setTab(items.length ? 'action' : 'updates'); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // both lists can grow: ten to a page, back to page 1 whenever the panel opens or the tab changes
  const pagedItems = usePaged(items, PER_PAGE, `${open}|${tab}`);
  const pagedUpdates = usePaged(updates, PER_PAGE, `${open}|${tab}`);
  const when = (dt: string) => (dt.slice(0, 10) === today ? dt.slice(11, 16) : fds(dt.slice(0, 10)) + ' · ' + dt.slice(11, 16));
  const openLink = (link: string, id?: string) => {
    if (id && user) void act('notifications.read', { ids: [id] }, { silent: true });
    onClose();
    navigate(link);
  };
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmented label={t('shell.notifications')} value={tab} onChange={setTab} items={[{ value: 'action', label: t('shell.needsAction'), count: items.length }, { value: 'updates', label: t('shell.updates'), count: unread }]} />
      {tab === 'action' ? (
        items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #E4DACD', borderRadius: 14, overflow: 'hidden' }}>
            {pagedItems.rows.map((i, k) => (
              <button key={i.id} type="button" onClick={() => openLink(i.link)} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60, border: 'none', borderTop: k ? '1px solid #F0EAE1' : 'none', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <span style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i.severity === 'urgent' ? '#9A3D24' : '#F6ECD6', color: i.severity === 'urgent' ? '#FFFFFF' : '#7A5510' }}>
                  <Icon name={iconFor(i.kind, 'priority_high')} size={22} fill={1} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px' }}>{t(i.kind, { ...i.params, section: i.params.section ? t('review.' + i.params.section) : undefined })}</span>
                <Icon name="chevron_right" size={22} color="#5E5852" />
              </button>
            ))}
            <Pager page={pagedItems.page} pages={pagedItems.pages} onPage={pagedItems.setPage} label={t('shell.needsAction')} />
          </div>
        ) : <EmptyState icon="done_all" title={t('shell.nothingAction')} />
      ) : updates.length ? (
        <>
          {unread ? <div><Button variant="ghost" size={44} onClick={() => act('notifications.readAll', {}, { silent: true })}>{t('shell.markAllRead')}</Button></div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #E4DACD', borderRadius: 14, overflow: 'hidden' }}>
            {pagedUpdates.rows.map((n, k) => {
              const isUnread = !!user && !n.readBy.includes(user.id);
              return (
                <button key={n.id} type="button" onClick={() => openLink(n.link, n.id)} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60, border: 'none', borderTop: k ? '1px solid #F0EAE1' : 'none', background: isUnread ? '#FBF8F4' : '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3EEE8', color: '#75624B' }}><Icon name={iconFor(n.kind, 'notifications')} size={22} /></span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: isUnread ? 500 : 400 }}>{t(n.kind, { ...n.params, section: n.params.section ? t('review.' + n.params.section) : undefined })}</span>
                    <span style={{ fontSize: FONT_BODY, color: '#5E5852' }}>{when(n.createdAt)}</span>
                  </span>
                  {isUnread ? <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: '#24201C', flex: 'none' }} /> : null}
                </button>
              );
            })}
            <Pager page={pagedUpdates.page} pages={pagedUpdates.pages} onPage={pagedUpdates.setPage} label={t('shell.updates')} />
          </div>
        </>
      ) : <EmptyState icon="notifications_none" title={t('shell.nothingUpdates')} />}
    </div>
  );
  return isPhone ? (
    <Sheet open={open} onClose={onClose} title={t('shell.notifications')}>{body}</Sheet>
  ) : (
    <Drawer open={open} onClose={onClose} label={t('shell.notifications')} width={420}>
      <h2 style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{t('shell.notifications')}</h2>
      {body}
    </Drawer>
  );
}
