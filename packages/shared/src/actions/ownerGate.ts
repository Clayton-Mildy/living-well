// Round 16 (KC): owner approvals. Management's pricing, holiday and weekly-budget changes become change requests (target 'club', no field diff) that only the Owner
// approves or rejects; approving replays the action as the person who asked (actions/review.ts). The Owner switches each kind per role in Admin › Roles
// (rules/access.ts ownerApprovalOn). framework.execute() calls ownerKindOf() after the access-grid check and before the review policy.
import type { ChangeRequest, ClubState, ISODate, Plan, ReviewSection } from '../types';
import type { OwnerKind } from '../rules/access';
import { live, rp, sortBy, weekStart } from '../util';
import { NOTICE_KINDS, noticeSettings } from '../rules/notice';
import { feeOf, priceOn, type Fee } from '../rules/billing';
import { planDefs, planLabel, planPrice } from '../rules/plans';
import { leaveMaxMonths } from '../rules/leave';
import { weeklyLimit } from '../rules/budget';

const PRICING = ['prices.set', 'club.setPlan', 'club.updateSettings'];
const BUDGET = ['budget.setLimit', 'budget.addSection', 'budget.renameSection'];
const isHoliday = (kind: unknown) => kind === 'closed' || kind === 'holiday';

/** Which owner-approval kind a run of this action is (input already parsed), or null when it never waits for the Owner. */
export function ownerKindOf(name: string, input: unknown, s: ClubState): OwnerKind | null {
  // round 17: club.updateSettings waits for the Owner only for the Flex visits and the notice (round 18: any kind); the few-visits alert settings apply at once
  // round 19: and leave in a row (leaveMaxMonths)
  if (name === 'club.updateSettings') { const i = (input ?? {}) as { notice?: unknown; flexQuota?: unknown; leaveMaxMonths?: unknown }; return i.notice !== undefined || i.flexQuota !== undefined || i.leaveMaxMonths !== undefined ? 'pricing' : null; }
  if (PRICING.includes(name)) return 'pricing';
  if (BUDGET.includes(name)) return 'budget';
  const i = (input ?? {}) as { kind?: unknown; eventId?: string };
  if (name === 'calendarEvent.create') return isHoliday(i.kind) ? 'holidays' : null;
  if (name === 'calendarEvent.update' || name === 'calendarEvent.delete') {
    const cur = i.eventId ? s.calendarEvents[i.eventId] : undefined;
    return isHoliday(cur?.kind) || (name === 'calendarEvent.update' && isHoliday(i.kind)) ? 'holidays' : null;
  }
  return null;
}

export const SECTION_OF: Record<OwnerKind, ReviewSection> = { pricing: 'pricing', holidays: 'holiday', budget: 'budget' };
export const OWNER_SECTIONS: ReviewSection[] = Object.values(SECTION_OF);
/** Where the person who asked sees the outcome. */
export const OWNER_LINK: Partial<Record<ReviewSection, string>> = { pricing: '/plans', holiday: '/calendar', budget: '/budget' };
export const isOwnerSection = (section: ReviewSection) => OWNER_SECTIONS.includes(section);

/** Owner requests still waiting (all sections, or one), newest first. */
export const pendingOwnerRequests = (s: ClubState, section?: ReviewSection): ChangeRequest[] =>
  sortBy(live(s.changeRequests).filter((c) => c.status === 'pending' && c.kind === 'approval' && isOwnerSection(c.section) && (!section || c.section === section)), (c) => c.createdAt + c.id, -1);

/**
 * What an owner request asks for, as an i18n key (`approvals.owner.what.*`) and its params, for the Owner's list, the "Waiting for owner" rows and the notice.
 * `date` stays ISO; the caller formats it.
 */
export type OwnerWhatParams = { date?: ISODate; title?: string; name?: string; amount?: number; n?: number; a?: number; b?: number; c?: number; d?: number };
export function ownerWhat(s: ClubState, action: string, input: unknown): { key: string; params: OwnerWhatParams } {
  const i = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const section = (id: unknown) => s.budgetSections[str(id)]?.name || str(id);
  switch (action) {
    case 'prices.set': return { key: 'approvals.owner.what.prices', params: { date: str(i.from) } };
    case 'club.setPlan': return { key: 'approvals.owner.what.plan', params: { name: str(i.name) } };
    case 'club.updateSettings': return settingsWhat(s, i);
    case 'budget.setLimit': return { key: 'approvals.owner.what.budgetLimit', params: { name: section(i.sectionId), amount: Number(i.weekly) || 0, date: str(i.fromWeek) } };
    case 'budget.addSection': return { key: 'approvals.owner.what.budgetAdd', params: { name: str(i.name), amount: Number(i.weekly) || 0 } };
    case 'budget.renameSection': return { key: 'approvals.owner.what.budgetRename', params: { name: str(i.name) } };
    case 'calendarEvent.create': return { key: i.kind === 'holiday' ? 'approvals.owner.what.holidayAdd' : 'approvals.owner.what.closeAdd', params: { date: str(i.date), title: str(i.title) } };
    case 'calendarEvent.update':
    case 'calendarEvent.delete': {
      const cur = s.calendarEvents[str(i.eventId)];
      return { key: action === 'calendarEvent.delete' ? 'approvals.owner.what.eventRemove' : 'approvals.owner.what.eventChange', params: { date: str(i.date) || cur?.date || '', title: str(i.title) || cur?.title || '' } };
    }
    default: return { key: 'approvals.owner.what.other', params: {} };
  }
}

/**
 * Final review minor 2: what a club-rules request changes, so the Owner sees it: one notice kind ("Stop membership · 30 days"), all three when several
 * change at once (the days after the change), or the Flex visits. Round 19: "Upgrade · 3 days" is one more kind, and "Leave in a row · 3 months" alone.
 */
function settingsWhat(s: ClubState, i: Record<string, unknown>): { key: string; params: OwnerWhatParams } {
  const notice = (i.notice ?? {}) as Partial<Record<typeof NOTICE_KINDS[number], number>>;
  const kinds = NOTICE_KINDS.filter((k) => typeof notice[k] === 'number');
  const quota = typeof i.flexQuota === 'number' ? i.flexQuota : undefined;
  const leaveMax = typeof i.leaveMaxMonths === 'number' ? i.leaveMaxMonths : undefined;
  const others = (quota === undefined ? 0 : 1) + (leaveMax === undefined ? 0 : 1);
  if (kinds.length === 1 && quota === undefined && leaveMax !== undefined) return { key: `approvals.owner.what.notice_${kinds[0]}_leaveMax`, params: { n: notice[kinds[0]], a: leaveMax } }; // e.g. "Upgrade · 3 days · Leave in a row · 3 months"
  if (kinds.length === 1 && !others) return { key: `approvals.owner.what.notice_${kinds[0]}`, params: { n: notice[kinds[0]] } };
  if (kinds.length > 1 && !others) { const now = { ...noticeSettings(s), ...notice }; return { key: 'approvals.owner.what.noticeAll', params: { a: now.downgrade, b: now.stop, c: now.leave, d: now.upgrade } }; }
  if (!kinds.length && quota !== undefined && others === 1) return { key: 'approvals.owner.what.flexQuota', params: { n: quota } };
  if (!kinds.length && leaveMax !== undefined && others === 1) return { key: 'approvals.owner.what.leaveMax', params: { n: leaveMax } };
  return { key: 'approvals.owner.what.rules', params: {} };
}

/** One thing an owner request changes. `label` and `to`/`from` that start with `approvals.owner.chg.` are i18n keys; anything else (a plan's or section's name, an amount) is shown as is. */
export interface OwnerChange { label: string; from?: string; to: string }
const K = 'approvals.owner.chg.';
/** A day or a range as text for the web to format: `date:2026-11-23` or `date:2026-11-23~2026-11-24`. */
const dateSpec = (from: string, to?: unknown) => 'date:' + from + (typeof to === 'string' && to && to !== from ? '~' + to : '');
const dateRow = (from: string, to?: unknown): OwnerChange => ({ label: K + (typeof to === 'string' && to && to !== from ? 'dates' : 'date'), to: dateSpec(from, to) });
const EVENT_KIND: Record<string, string> = { closed: 'cal.t_closed', holiday: 'cal.t_holiday' };
const FEE_KEYS: Fee[] = ['registration', 'trial', 'leave', 'dementia', 'pickup', 'fieldTrip'];

/**
 * KC (owner approvals): what a request changes, so the Owner can see "how much" before deciding. Only changed values are listed, compared with what is in force on the
 * request's date. An empty list means nothing to show (no price changes; holidays and closures are already clear from `ownerWhat`).
 */
export function ownerChanges(s: ClubState, action: string, input: unknown): OwnerChange[] {
  const i = (input ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: OwnerChange[] = [];
  const diff = (label: string, from: string, to: string) => { if (from !== to) out.push({ label, from, to }); };
  switch (action) {
    case 'prices.set': {
      if (typeof i.from !== 'string') return out;
      const cur = priceOn(s, i.from);
      if (!cur) return out;
      const money = (label: string, was: number, now: unknown) => { if (typeof now === 'number') diff(label, rp(was), rp(now)); };
      money(K + 'flex', cur.flex, i.flex);
      money(K + 'gold', cur.gold, i.gold);
      money(K + 'extra', cur.extra, i.extra);
      for (const f of FEE_KEYS) money(K + f, feeOf(cur, f), i[f]);
      for (const [id, n] of Object.entries((i.plans ?? {}) as Record<string, number>)) money(planLabel(s, id as Plan, 'en'), planPrice(cur, id as Plan), n);
      return out;
    }
    case 'club.setPlan': {
      const old = i.id ? planDefs(s).find((p) => p.id === i.id) : undefined;
      const kind = (k: unknown) => K + (k === 'unlimited' ? 'kind_unlimited' : 'kind_days');
      const quota = (k: unknown, q: unknown) => (k === 'days' && q !== undefined ? String(q) : '');
      const active = (a: unknown) => K + (a === false ? 'retired' : 'active');
      if (!old) {
        out.push({ label: K + 'name', to: String(i.name ?? '') }, { label: K + 'kind', to: kind(i.kind) });
        if (quota(i.kind, i.quota)) out.push({ label: K + 'quota', to: quota(i.kind, i.quota) });
        return out;
      }
      diff(K + 'name', old.name, String(i.name ?? old.name));
      diff(K + 'kind', kind(old.kind), kind(i.kind));
      diff(K + 'quota', quota(old.kind, old.quota) || K + 'none', quota(i.kind, i.quota) || K + 'none');
      diff(K + 'status', active(old.active), active(i.active));
      return out;
    }
    case 'club.updateSettings': {
      const notice = (i.notice ?? {}) as Record<string, number>;
      const now = noticeSettings(s);
      for (const k of NOTICE_KINDS) if (typeof notice[k] === 'number') diff(K + 'notice_' + k, String(now[k]), String(notice[k]));
      if (typeof i.flexQuota === 'number') diff(K + 'flexQuota', String(s.club.settings.flexQuota), String(i.flexQuota));
      if (typeof i.leaveMaxMonths === 'number') diff(K + 'leaveMax', String(leaveMaxMonths(s)), String(i.leaveMaxMonths));
      return out;
    }
    case 'budget.setLimit': {
      const sec = s.budgetSections[String(i.sectionId)];
      const weekly = Number(i.weekly) || 0;
      const was = weeklyLimit(s, String(i.sectionId), weekStart(String(i.fromWeek ?? '')));
      return sec && was !== weekly ? [{ label: sec.name, from: rp(was), to: rp(weekly) }] : [];
    }
    case 'budget.renameSection': {
      const sec = s.budgetSections[String(i.sectionId ?? i.id)];
      return sec && typeof i.name === 'string' && i.name !== sec.name ? [{ label: K + 'name', from: sec.name, to: i.name }] : [];
    }
    case 'calendarEvent.create': return [{ label: K + 'eventKind', to: EVENT_KIND[String(i.kind)] ?? '' }, dateRow(String(i.date ?? ''), i.endDate), { label: K + 'title', to: String(i.title ?? '') }];
    case 'calendarEvent.update': {
      const cur = s.calendarEvents[String(i.eventId)];
      if (!cur) return out;
      const [d0, e0] = [cur.date, cur.endDate && cur.endDate !== cur.date ? cur.endDate : undefined];
      const d1 = typeof i.date === 'string' ? i.date : d0;
      const e1 = i.endDate === undefined ? e0 : i.endDate && i.endDate !== d1 ? i.endDate : undefined;
      if (d0 !== d1 || e0 !== e1) out.push({ ...dateRow(d1, e1), from: dateSpec(d0, e0) });
      if (typeof i.title === 'string') diff(K + 'title', cur.title, i.title);
      if (typeof i.kind === 'string') diff(K + 'eventKind', EVENT_KIND[cur.kind] ?? '', EVENT_KIND[i.kind] ?? '');
      return out;
    }
    case 'calendarEvent.delete': {
      const cur = s.calendarEvents[String(i.eventId)];
      return cur ? [{ label: K + 'remove', to: `${EVENT_KIND[cur.kind] ?? ''}|${dateSpec(cur.date, cur.endDate)}|${cur.title}` }] : [];
    }
    case 'budget.addSection': return [{ label: K + 'name', to: String(i.name ?? '') }, { label: K + 'weekly', to: rp(Number(i.weekly) || 0) }];
    default: return out;
  }
}
