// Notification centre: "Needs action" items are derived from state (they clear themselves when handled);
// "Updates" are stored Notification rows with per-user read state.
import type { ClubState, DT, ISODate, Notification, Role, User } from './types';
import { roleOf } from './actions/framework';
import { live, sortBy, toMin, addDays, ym } from './util';
import { lobbyGroups, guestsOn } from './rules/attendance';
import { todayReading, validReadings } from './rules/health';
import { pendingPhotos } from './rules/members';
import { conflictsOn } from './rules/kitchen';
import { invoiceStatus, runDone } from './rules/billing';
import { staffThreads, staffUnread, familyThreads, familyUnread } from './rules/messages';
import { liveSurvey, answeredBy } from './rules/surveys';
import { memberShort, linksOfFamily, isPrimaryFor, isPendingRow } from './rules/core';

export interface ActionItem {
  id: string;
  kind: string; // i18n key under notif.act.*
  params: Record<string, string | number>;
  link: string;
  severity: 'attention' | 'urgent';
  at: DT;
  memberId?: string;
}

// A role's own home screen lives at /today (e.g. Arrivals for the lobby); everything else at /<nav key>.
const HOME_KEY: Partial<Record<Role, string>> = { lobby: 'arrivals', mgmt: 'arrivals', nurse: 'hchecks', kitchen: 'menu', finance: 'billing' };
const linkTo = (role: Role, key: string, query = '') => (HOME_KEY[role] === key ? '/today' : '/' + key) + query;

export function actionItems(s: ClubState, user: User, today: ISODate, nowMin: number): ActionItem[] {
  const role = roleOf(user);
  const out: ActionItem[] = [];
  const at = (d: DT | undefined) => d || `${today}T00:00`;
  const add = (x: ActionItem) => out.push(x);
  const isApprover = role === 'mgmt' || role === 'finance' || (user.kind === 'staff' && user.staff.supervisor);

  if (user.kind === 'family') {
    const mids = linksOfFamily(s, user.id).filter((l) => !isPendingRow(l) && l.appAccess).map((l) => l.memberId);
    for (const inv of live(s.invoices)) {
      if (!mids.includes(inv.memberId) || !isPrimaryFor(s, user.id, inv.memberId)) continue;
      const st = invoiceStatus(s, inv, today);
      if (st === 'overdue' || st === 'outstanding' || st === 'partial')
        add({ id: 'inv:' + inv.id, kind: st === 'overdue' ? 'notif.act.invoiceOverdue' : 'notif.act.invoiceDue', params: { name: memberShort(s.members[inv.memberId]), number: inv.number, due: inv.dueDate }, link: '/billing', severity: st === 'overdue' ? 'urgent' : 'attention', at: at(inv.createdAt), memberId: inv.memberId });
    }
    const sv = liveSurvey(s);
    if (sv && sv.recipients.includes(user.id) && !answeredBy(s, sv.id, user.id)) add({ id: 'survey:' + sv.id, kind: 'notif.act.survey', params: { title: sv.title }, link: '/today?survey=1', severity: 'attention', at: at(sv.createdAt) });
    for (const id of mids) {
      const m = s.members[id];
      for (const doc of m?.documents || []) if (doc.status === 'requested') add({ id: `doc:${id}:${doc.id}`, kind: 'notif.act.docRequested', params: { name: memberShort(m), doc: doc.type }, link: `/health?member=${id}&tab=docs`, severity: 'attention', at: at(m.createdAt), memberId: id });
    }
    return sortBy(out, (x) => x.at, -1);
  }

  if (role === 'mgmt') {
    // photos by non-management staff wait for approval before families see them
    const waiting = pendingPhotos(s);
    if (waiting.length) add({ id: 'photos:pending', kind: 'notif.act.photosReview', params: { n: waiting.length }, link: '/reviews?tab=photos', severity: 'attention', at: waiting[0].createdAt });
    for (const c of live(s.changeRequests)) {
      if (c.status !== 'pending') continue;
      add({ id: 'cr:' + c.id, kind: c.kind === 'approval' ? 'notif.act.review' : 'notif.act.reviewFlagged', params: { section: c.section, name: c.target.memberId && s.members[c.target.memberId] ? memberShort(s.members[c.target.memberId]) : '' }, link: '/reviews', severity: 'attention', at: c.createdAt, memberId: c.target.memberId });
    }
    for (const r of validReadings(s).filter((x) => x.date === today && x.status === 'alert' && x.memberId))
      add({ id: 'alert:' + r.id, kind: 'notif.act.alertReading', params: { name: memberShort(s.members[r.memberId!]), value: r.sys ? `${r.sys}/${r.dia}` : String(r.glucose ?? r.spo2 ?? '') }, link: `/members/${r.memberId}/health`, severity: 'urgent', at: `${r.date}T${r.time}`, memberId: r.memberId! });
    for (const st of live(s.staff)) {
      if (!st.active || !st.hr.end) continue;
      if (st.hr.end >= today && st.hr.end <= addDays(today, 30)) add({ id: 'contract:' + st.id, kind: 'notif.act.contract', params: { name: st.name, date: st.hr.end }, link: `/hr?staff=${st.id}`, severity: 'attention', at: `${today}T08:00` });
    }
    for (const f of live(s.feedback).filter((x) => x.status === 'open')) add({ id: 'fb:' + f.id, kind: 'notif.act.complaint', params: { name: memberShort(s.members[f.memberId]), dish: f.dish }, link: '/feedback', severity: 'attention', at: f.createdAt, memberId: f.memberId });
  }
  if (role === 'mgmt' || role === 'finance') {
    for (const r of live(s.planChangeRequests).filter((x) => x.status === 'pending')) {
      const m = s.members[r.memberId];
      if (m) add({ id: 'pcr:' + r.id, kind: 'notif.act.planRequest', params: { name: memberShort(m), plan: r.to === 'gold' ? 'Gold' : 'Flex', date: r.from }, link: `/members/${m.id}/plan`, severity: 'attention', at: r.createdAt, memberId: m.id });
    }
    for (const inv of live(s.invoices)) if (invoiceStatus(s, inv, today) === 'overdue') add({ id: 'od:' + inv.id, kind: 'notif.act.overdue', params: { name: memberShort(s.members[inv.memberId]), number: inv.number }, link: linkTo(role, 'billing', '?f=overdue'), severity: 'urgent', at: `${inv.dueDate}T23:59`, memberId: inv.memberId });
    for (const b of live(s.budgetRequests).filter((x) => x.status === 'pending')) add({ id: 'br:' + b.id, kind: 'notif.act.budgetApprove', params: { item: b.item, amount: b.amount }, link: '/budget', severity: 'attention', at: b.createdAt });
    for (const r of live(s.receipts).filter((x) => x.status === 'submitted' && !x.voidedAt)) add({ id: 'rc:' + r.id, kind: 'notif.act.receiptApprove', params: { supplier: r.supplier, amount: r.amount }, link: '/receipts', severity: 'attention', at: r.createdAt });
    for (const v of live(s.vendorInvoices).filter((x) => x.status === 'toApprove')) add({ id: 'vi:' + v.id, kind: 'notif.act.vendorApprove', params: { supplier: v.supplier, amount: v.amount }, link: '/receipts', severity: 'attention', at: v.createdAt });
    const period = ym(today);
    if (+today.slice(8) >= s.club.settings.issueDay && !runDone(s, period) && live(s.members).length) add({ id: 'run:' + period, kind: 'notif.act.invoiceRun', params: { month: period }, link: linkTo(role, 'billing', '?run=1'), severity: 'attention', at: `${period}-${String(s.club.settings.issueDay).padStart(2, '0')}T08:00` });
  }
  if (isApprover) {
    for (const k of live(s.stockRequests).filter((x) => x.status === 'requested')) {
      if (role === 'kitchen' && k.area !== 'kitchen') continue;
      add({ id: 'stock:' + k.id, kind: 'notif.act.stockApprove', params: { item: k.item, qty: `${k.qty} ${k.unit}` }, link: '/stock', severity: 'attention', at: k.createdAt });
    }
  }
  if (role === 'lobby' || role === 'mgmt') {
    for (const f of live(s.formRequests).filter((x) => x.status === 'submitted' && x.target.type === 'enquiry')) {
      const e = s.enquiries[f.target.id];
      add({ id: 'form:' + f.id, kind: 'notif.act.formReady', params: { name: e ? `${e.senior.title} ${e.senior.name}` : '' }, link: `/enquiries?review=${f.target.id}`, severity: 'attention', at: f.submittedAt || f.createdAt });
    }
    // a trial has no booked time (the guest can come any time the club is open); a visit is due half an hour before its time
    for (const g of guestsOn(s, today).filter((x) => x.status === 'booked' && !x.checkIn && toMin(x.time || s.club.settings.open) - 30 <= nowMin))
      add({ id: 'guest:' + g.id, kind: g.kind === 'trial' ? (g.time ? 'notif.act.guestTrial' : 'notif.act.guestTrialDay') : 'notif.act.guestVisit', params: { name: g.name, time: g.time || '' }, link: linkTo(role, 'arrivals'), severity: 'attention', at: `${today}T${g.time || s.club.settings.open}` });
    if (nowMin >= toMin(s.club.settings.departureFrom)) {
      for (const r of lobbyGroups(s, today).inClub) {
        if (todayReading(s, r.m.id, today, 'departure')) add({ id: 'ready:' + r.m.id, kind: 'notif.act.readyCheckout', params: { name: memberShort(r.m) }, link: linkTo(role, 'arrivals'), severity: 'attention', at: `${today}T15:30`, memberId: r.m.id });
      }
    }
  }
  if (role === 'activity' && nowMin >= 15 * 60) {
    const g = lobbyGroups(s, today);
    const missing = [...g.inClub, ...g.goneHome].filter((r) => !live(s.dailyLogs).some((l) => l.memberId === r.m.id && l.date === today && l.status === 'saved'));
    if (missing.length) add({ id: 'logs', kind: 'notif.act.logs', params: { n: missing.length }, link: '/log', severity: 'attention', at: `${today}T15:00` });
  }
  if (role === 'kitchen' || role === 'mgmt') {
    for (const c of conflictsOn(s, today).filter((x) => !x.plan)) {
      const name = c.diner.type === 'member' ? memberShort(c.diner.m) : c.diner.g.name;
      add({ id: `allergen:${c.diner.id}:${c.dish.id}`, kind: 'notif.act.allergen', params: { name, dish: c.dish.name, allergy: c.allergy }, link: linkTo(role, 'menu'), severity: 'urgent', at: `${today}T08:00`, memberId: c.diner.type === 'member' ? c.diner.id : undefined });
    }
    if (role === 'kitchen') for (const f of live(s.feedback).filter((x) => x.status === 'open')) add({ id: 'fb:' + f.id, kind: 'notif.act.complaint', params: { name: memberShort(s.members[f.memberId]), dish: f.dish }, link: '/feedback', severity: 'attention', at: f.createdAt, memberId: f.memberId });
  }
  if (user.kind === 'staff') {
    const unread = staffThreads(s, role).filter((t) => staffUnread(s, t) > 0);
    if (unread.length) add({ id: 'unread', kind: 'notif.act.unread', params: { n: unread.length }, link: '/chat', severity: 'attention', at: `${today}T00:00` });
  }
  return sortBy(out, (x) => (x.severity === 'urgent' ? '1' : '0') + x.at, -1);
}

/** Stored updates visible to a user, newest first. */
export function updatesFor(s: ClubState, user: User): Notification[] {
  const role = roleOf(user);
  return sortBy(
    live(s.notifications).filter((n) => n.toUsers.includes(user.id) || (user.kind === 'staff' && (n.toRoles as string[]).includes(role))),
    (n) => n.createdAt,
    -1,
  );
}
export const unreadUpdates = (s: ClubState, user: User) => updatesFor(s, user).filter((n) => !n.readBy.includes(user.id));
export const familyUnreadMessages = (s: ClubState, familyId: string) => familyThreads(s, familyId).filter((t) => familyUnread(s, t) > 0).length;
export function bellCount(s: ClubState, user: User, today: ISODate, nowMin: number) {
  return actionItems(s, user, today, nowMin).length + unreadUpdates(s, user).length;
}
