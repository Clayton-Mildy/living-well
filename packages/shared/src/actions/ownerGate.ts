// Round 16 (KC): owner approvals. Management's pricing, holiday and weekly-budget changes become change requests (target 'club', no field diff) that only the Owner
// approves or rejects; approving replays the action as the person who asked (actions/review.ts). The Owner switches each kind per role in Admin › Roles
// (rules/access.ts ownerApprovalOn). framework.execute() calls ownerKindOf() after the access-grid check and before the review policy.
import type { ChangeRequest, ClubState, ISODate, ReviewSection } from '../types';
import type { OwnerKind } from '../rules/access';
import { live, sortBy } from '../util';
import { NOTICE_KINDS, noticeSettings } from '../rules/notice';

const PRICING = ['prices.set', 'club.setPlan', 'club.updateSettings'];
const BUDGET = ['budget.setLimit', 'budget.addSection', 'budget.renameSection'];
const isHoliday = (kind: unknown) => kind === 'closed' || kind === 'holiday';

/** Which owner-approval kind a run of this action is (input already parsed), or null when it never waits for the Owner. */
export function ownerKindOf(name: string, input: unknown, s: ClubState): OwnerKind | null {
  // round 17: club.updateSettings waits for the Owner only for the Flex visits and the notice (round 18: any kind); the few-visits alert settings apply at once
  if (name === 'club.updateSettings') { const i = (input ?? {}) as { notice?: unknown; flexQuota?: unknown }; return i.notice !== undefined || i.flexQuota !== undefined ? 'pricing' : null; }
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
export type OwnerWhatParams = { date?: ISODate; title?: string; name?: string; amount?: number; n?: number; a?: number; b?: number; c?: number };
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
 * change at once (the days after the change), or the Flex visits.
 */
function settingsWhat(s: ClubState, i: Record<string, unknown>): { key: string; params: OwnerWhatParams } {
  const notice = (i.notice ?? {}) as Partial<Record<typeof NOTICE_KINDS[number], number>>;
  const kinds = NOTICE_KINDS.filter((k) => typeof notice[k] === 'number');
  const quota = typeof i.flexQuota === 'number' ? i.flexQuota : undefined;
  if (kinds.length === 1 && quota === undefined) return { key: `approvals.owner.what.notice_${kinds[0]}`, params: { n: notice[kinds[0]] } };
  if (kinds.length > 1 && quota === undefined) { const now = { ...noticeSettings(s), ...notice }; return { key: 'approvals.owner.what.noticeAll', params: { a: now.downgrade, b: now.stop, c: now.leave } }; }
  if (!kinds.length && quota !== undefined) return { key: 'approvals.owner.what.flexQuota', params: { n: quota } };
  return { key: 'approvals.owner.what.rules', params: {} };
}
