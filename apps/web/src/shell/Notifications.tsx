// Notification bell + panel: "Needs action" (derived, clears itself) and "Updates" (stored, per-user read state).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionItems, updatesFor, type ActionItem, type Notification } from '@cp/shared';
import { noticeKind, type NoticeKind } from '@cp/shared/rules/famToday';
import { Drawer, Sheet, Icon, Segmented, EmptyState, Button, Pager, usePaged, FONT_BODY } from '../components/ui';
import { useT, useFmt } from '../lib/i18n';
import { useMe } from '../lib/me';
import { useNow } from '../lib/clock';
import { useAct } from '../lib/act';
import { useClub } from '../store/replica';
import { useDevice } from '../hooks/useDevice';
import { say } from '../store/ui';
import { F, FamPopover, HAIR, TextLink } from '../features/family/kit';

const KIND_ICON: Record<string, string> = {
  'notif.act.review': 'fact_check', 'notif.act.reviewFlagged': 'fact_check', 'notif.act.alertReading': 'warning', 'notif.act.contract': 'badge', 'notif.act.complaint': 'forum',
  'notif.act.overdue': 'error', 'notif.act.budgetApprove': 'pie_chart', 'notif.act.receiptApprove': 'receipt_long', 'notif.act.vendorApprove': 'request_quote', 'notif.act.invoiceRun': 'event_repeat',
  'notif.act.stockApprove': 'inventory_2', 'notif.act.guestTrial': 'waving_hand', 'notif.act.guestTrialDay': 'waving_hand', 'notif.act.guestVisit': 'meeting_room', 'notif.act.readyCheckout': 'home',
  'notif.act.queue': 'monitor_heart', 'notif.act.logs': 'edit_note', 'notif.act.allergen': 'no_food', 'notif.act.invoiceDue': 'receipt_long', 'notif.act.invoiceOverdue': 'error',
  'notif.act.survey': 'rate_review', 'notif.act.docRequested': 'upload_file', 'notif.checkedIn': 'how_to_reg', 'notif.checkedOut': 'home', 'notif.newPhotos': 'photo_library', 'notif.logSaved': 'edit_note',
  'notif.paymentReceived': 'payments', 'notif.reviewApproved': 'task_alt', 'notif.reviewRejected': 'block', 'notif.reviewReverted': 'undo', 'notif.reviewSubmitted': 'fact_check', 'notif.reviewFlagged': 'fact_check',
  'lobby.notif.extraVisit': 'payments', 'notif.act.planRequest': 'sell', 'notif.act.photosReview': 'photo_library', 'kitchen.notif.feedbackNew': 'forum', 'kitchen.notif.feedbackReply': 'forum', 'health.notif.alert': 'warning', 'health.notif.guestAlert': 'warning', 'kitchen.notif.lunchPhoto': 'photo_camera', 'kitchen.notif.alternative': 'no_food',
  'kitchen.notif.stockApproved': 'task_alt', 'kitchen.notif.stockDeclined': 'block', 'finance.notif.paid': 'payments', 'enq.notif.newLead': 'person_add', 'enq.notif.formSubmitted': 'assignment_turned_in', 'mgmt.notif.broadcastSent': 'campaign',
  'cal.notif.schedulePublished': 'calendar_month', 'members.notif.welcome': 'waving_hand',
  // KC round 7
  'renewals.notif.act.followUp': 'event_repeat', 'renewals.notif.act.approve': 'fact_check', 'renewals.notif.plan': 'sell', 'renewals.notif.leave': 'beach_access', 'renewals.notif.leave2': 'beach_access',
  'activity.notif.act.lunch': 'restaurant', 'activity.notif.act.session': 'groups', 'activity.notif.act.mood': 'edit_note',
  'guests.notif.booked': 'co_present', 'guests.notif.toPay': 'request_quote', 'guests.notif.paidCancelled': 'currency_exchange', 'mgmt.notif.venueRated': 'star',
};
// kinds without their own icon fall back to their area's icon
const AREA_ICON: Record<string, string> = {
  family: 'family_restroom', lobby: 'how_to_reg', health: 'monitor_heart', members: 'person', care: 'edit_note', activity: 'photo_library', cal: 'calendar_month',
  kitchen: 'restaurant', finance: 'payments', mgmt: 'campaign', enq: 'contact_phone', people: 'badge', requests: 'add_shopping_cart',
  renewals: 'event_repeat', guests: 'co_present', tasks: 'checklist',
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

/** `row` (KC round 6, tablet and laptop sidebar): a labelled row under the logo, like the menu items, so the logo keeps its full size. */
/** Urgent items arriving live also pop a toast. The bell does it; the family app (whose bell is on Today only) mounts it in its shell. */
export function useUrgentToasts(items: ActionItem[]) {
  const t = useT();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const urgent = items.filter((i) => i.severity === 'urgent');
    if (seen.current === null) { seen.current = new Set(urgent.map((i) => i.id)); return; }
    for (const i of urgent) if (!seen.current.has(i.id)) { seen.current.add(i.id); say(t(i.kind, i.params), { tone: 'urgent', icon: iconFor(i.kind, 'warning') }); }
  }, [items, t]);
}
export function UrgentToasts() {
  useUrgentToasts(useBell().items);
  return null;
}

/** `family` (round 8): the family Today header's round grey bell, a small rust dot while anything is new. It leaves the urgent toasts to the shell. */
export function NotificationBell({ onClick, variant = 'icon' }: { onClick: () => void; variant?: 'icon' | 'row' | 'family' | 'hero' | 'side' }) {
  const t = useT();
  const { count, items } = useBell();
  useUrgentToasts(variant === 'family' || variant === 'hero' ? [] : items);
  const urgent = items.some((i) => i.severity === 'urgent');
  if (variant === 'side') { // round 9 (App v4): the espresso sidebar's bell, a light icon with a small gold count (rust when anything is urgent)
    return (
      <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} data-testid="side-bell" className="cp-side-dark cp-press"
        style={{ position: 'relative', width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: '#EDE4D8' }}>
        <Icon name="notifications" size={22} color="#EDE4D8" />
        {count ? <span aria-hidden="true" style={{ position: 'absolute', top: 2, right: 1, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: urgent ? '#9A3D24' : '#D2B98F', color: urgent ? '#FFFFFF' : '#221B15', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #221B15', boxSizing: 'border-box' }}>{count > 99 ? '99+' : count}</span> : null}
      </button>
    );
  }
  if (variant === 'hero') { // round 8: Today's bell floats on the day's photo (frosted, white icon, an amber dot while anything is new)
    return (
      <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} data-testid="fam-bell" data-bell-anchor="" className="cp-press"
        style={{ pointerEvents: 'auto', position: 'relative', width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
        <Icon name="notifications" size={21} color="#FFFFFF" />
        {count ? <span aria-hidden="true" style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 999, background: '#E9A23B', boxShadow: '0 0 0 1.5px rgba(36,32,28,.35)' }} /> : null}
      </button>
    );
  }
  if (variant === 'family') {
    return (
      <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} data-testid="fam-bell" data-bell-anchor="" className="cp-fam-press"
        style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: '#24201C' }}>
        <Icon name="notifications" size={22} color="#24201C" />
        {count ? <span aria-hidden="true" style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 999, background: '#9A3D24' }} /> : null}
      </button>
    );
  }
  if (variant === 'row') {
    return (
      <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} className="dh57"
        style={{ height: 42, padding: '0 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#4A4038', fontSize: 15, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', width: '100%', flex: 'none' }}>
        <Icon name="notifications" size={21} color="#6B6259" />
        <span style={{ flex: 1, minWidth: 0 }}>{t('shell.notifications')}</span>
        {count ? <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 8, background: urgent ? '#9A3D24' : '#2B231C', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{count > 99 ? '99+' : count}</span> : null}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={t('shell.bell', { n: count })} className="h-cream" style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', color: '#24201C' }}>
      <Icon name="notifications" size={22} color="#24201C" />
      {count ? <span style={{ position: 'absolute', top: 5, right: 4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 8, background: items.some((i) => i.severity === 'urgent') ? '#9A3D24' : '#2B231C', color: '#FFFFFF', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}>{count > 99 ? '99+' : count}</span> : null}
    </button>
  );
}

const FAM_ICON: Record<NoticeKind, string> = { arrived: 'how_to_reg', home: 'home', photos: 'photo_library', note: 'edit_note', health: 'monitor_heart', billing: 'receipt_long', survey: 'rate_review', document: 'upload_file', kitchen: 'restaurant', calendar: 'calendar_month', plan: 'sell', club: 'campaign' };
const FAM_PAGE = 8;

/**
 * Round 8, the family app: a drop-down card from the bell (KC: a pop-up, not a sheet from below), then one list. What needs the family comes first (the survey, an invoice due, a document
 * asked for), then the updates; each row has a tinted icon tile, a title with its time, and the words. Tapping a row marks it read and opens its screen.
 */
function FamilyNotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { fds } = useFmt();
  const navigate = useNavigate();
  const act = useAct();
  const { user } = useMe();
  const { items, updates, unread } = useBell();
  const { today } = useNow();
  const [shown, setShown] = useState(FAM_PAGE);
  useEffect(() => { if (open) setShown(FAM_PAGE); }, [open]);
  const day = (dt: string) => (dt.slice(0, 10) === today ? t('common.today') : fds(dt.slice(0, 10)));
  const clock = (dt: string) => (dt.slice(0, 10) === today ? dt.slice(11, 16) : fds(dt.slice(0, 10)));
  const words = (kind: string, params: Record<string, string | number>) => t(kind, { ...params, section: params.section ? t('review.' + params.section) : undefined, outcome: params.outcome ? t('checkOn.outcome.' + params.outcome).toLowerCase() : undefined });
  const go = (link: string, id?: string) => {
    if (id && user) void act('notifications.read', { ids: [id] }, { silent: true });
    onClose();
    navigate(link);
  };
  const rows = [
    ...items.map((i) => ({ id: i.id, kind: i.kind, text: words(i.kind, i.params), when: day(i.at), tile: i.severity === 'urgent' ? '#F9E3DB' : '#F6ECD6', ink: i.severity === 'urgent' ? '#9A3D24' : '#7A5510', unread: false, go: () => go(i.link) })),
    ...updates.slice(0, shown).map((n) => {
      const k = noticeKind(n.kind);
      return { id: n.id, kind: n.kind, text: words(n.kind, n.params), when: clock(n.createdAt), tile: k === 'health' ? '#E3EFE6' : 'var(--press, #F0F0F2)', ink: k === 'health' ? '#2F5A40' : 'var(--accent, #75624B)', unread: !!user && !n.readBy.includes(user.id), go: () => go(n.link, n.id) };
    }),
  ];
  return (
    <FamPopover open={open} onClose={onClose} title={t('shell.notifications')} testId="fam-notifications">
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => {
            const k = noticeKind(r.kind);
            return (
              <button key={r.id} type="button" onClick={r.go} data-unread={r.unread} className="cp-fam-press"
                style={{ display: 'flex', gap: 12, padding: '12px 0', border: 'none', borderTop: i ? HAIR : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: F.text, width: '100%' }}>
                <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, background: r.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={FAM_ICON[k]} size={20} color={r.ink} /></span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: F.text, display: 'flex', alignItems: 'center', gap: 6 }}>{t('ftoday.nt_' + k)}{r.unread ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#9A3D24', flex: 'none' }} /> : null}</span>
                    <span style={{ fontSize: 12, color: F.muted, whiteSpace: 'nowrap', paddingTop: 2 }}>{r.when}</span>
                  </span>
                  <span style={{ fontSize: 14, lineHeight: '20px', color: F.soft, overflowWrap: 'anywhere' }}>{r.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : <span style={{ fontSize: 15, color: F.muted, padding: '8px 0' }}>{t('ftoday.allCaught')}</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {unread ? <TextLink size={14} onClick={() => act('notifications.readAll', {}, { silent: true })} testId="fam-read-all">{t('shell.markAllRead')}</TextLink> : <span />}
        {updates.length > shown ? <TextLink size={14} onClick={() => setShown((n) => n + FAM_PAGE)} testId="fam-show-more">{t('ftoday.showMore')}</TextLink> : null}
      </div>
    </FamPopover>
  );
}

export function NotificationPanel(props: { open: boolean; onClose: () => void }) {
  const { user } = useMe();
  return user?.kind === 'family' ? <FamilyNotificationPanel {...props} /> : <StaffNotificationPanel {...props} />;
}

function StaffNotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <div className="cp-grey" style={{ display: 'flex', flexDirection: 'column', background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
            {pagedItems.rows.map((i, k) => (
              <button key={i.id} type="button" onClick={() => openLink(i.link)} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60, border: 'none', borderTop: k ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <span style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i.severity === 'urgent' ? '#9A3D24' : '#F6ECD6', color: i.severity === 'urgent' ? '#FFFFFF' : '#7A5510' }}>
                  <Icon name={iconFor(i.kind, 'priority_high')} size={22} fill={1} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: '22px' }}>{t(i.kind, { ...i.params, section: i.params.section ? t('review.' + i.params.section) : undefined, outcome: i.params.outcome ? t('checkOn.outcome.' + i.params.outcome).toLowerCase() : undefined })}</span>
                <Icon name="chevron_right" size={22} color="#5E5852" />
              </button>
            ))}
            <Pager page={pagedItems.page} pages={pagedItems.pages} onPage={pagedItems.setPage} label={t('shell.needsAction')} />
          </div>
        ) : <EmptyState icon="done_all" title={t('shell.nothingAction')} />
      ) : updates.length ? (
        <>
          {unread ? <div><Button variant="ghost" size={44} onClick={() => act('notifications.readAll', {}, { silent: true })}>{t('shell.markAllRead')}</Button></div> : null}
          <div className="cp-grey" style={{ display: 'flex', flexDirection: 'column', background: 'var(--fill, #F4F4F5)', borderRadius: 16, overflow: 'hidden' }}>
            {pagedUpdates.rows.map((n, k) => {
              const isUnread = !!user && !n.readBy.includes(user.id);
              return (
                <button key={n.id} type="button" onClick={() => openLink(n.link, n.id)} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60, border: 'none', borderTop: k ? '0.5px solid var(--hairline, #E2E2E6)' : 'none', background: isUnread ? '#FFFFFF' : 'transparent', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                  <span className={isUnread ? undefined : 'cp-fill'} style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fill, #F4F4F5)', color: 'var(--accent, #75624B)' }}><Icon name={iconFor(n.kind, 'notifications')} size={22} /></span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: isUnread ? 500 : 400 }}>{t(n.kind, { ...n.params, section: n.params.section ? t('review.' + n.params.section) : undefined, outcome: n.params.outcome ? t('checkOn.outcome.' + n.params.outcome).toLowerCase() : undefined })}</span>
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
      <h2 className="cp-serif" style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{t('shell.notifications')}</h2>
      {body}
    </Drawer>
  );
}
