// Per-role navigation (design NAVS/NAVG/PHONE_NAV + new Reviews/Requests/Contacts items) and nav-key → screen mapping.
import type { Role } from '@cp/shared';

export interface NavItem { key: string; label: string; short: string; icon: string }
const n = (key: string, labelKey: string, icon: string): NavItem => ({ key, label: 'nav.' + labelKey, short: 'nav.s_' + labelKey, icon });

export const NAVS: Record<Role, NavItem[]> = {
  // KC round 6: the front desk has the kitchen's Menu, view only, to see who is allergic to today's dishes
  // KC round 7: Renewals (the month-end membership follow-up) and Tasks for the front desk
  // round 12: Venue, because every booking comes through the front desk (the invoice stays with management and finance)
  lobby: [n('today', 'arrivals', 'how_to_reg'), n('enquiries', 'enquiries', 'contact_phone'), n('members', 'members', 'groups'), n('menu', 'menu', 'restaurant'), n('renewals', 'renewals', 'event_repeat'), n('venue', 'venue', 'storefront'), n('tasks', 'tasks', 'checklist'), n('contacts', 'contacts', 'contacts'), n('requests', 'requests', 'add_shopping_cart')],
  nurse: [n('today', 'health', 'monitor_heart'), n('readings', 'readings', 'monitoring'), n('members', 'members', 'groups'), n('tasks', 'tasks', 'checklist'), n('requests', 'requests', 'add_shopping_cart'), n('contacts', 'contacts', 'contacts')],
  activity: [n('today', 'today', 'wb_sunny'), n('camera', 'camera', 'photo_camera'), n('log', 'log', 'edit_note'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month'), n('tasks', 'tasks', 'checklist'), n('requests', 'requests', 'add_shopping_cart'), n('contacts', 'contacts', 'contacts')],
  // KC round 6: no Stock page for F&B (Requests has the stock request; the supervisor approves there, under Team stock requests)
  kitchen: [n('today', 'menu', 'restaurant'), n('feedback', 'feedback', 'forum'), n('tasks', 'tasks', 'checklist'), n('requests', 'requests', 'add_shopping_cart'), n('contacts', 'contacts', 'contacts')],
  finance: [n('today', 'billing', 'payments'), n('payments', 'payments', 'account_balance'), n('budget', 'budget', 'pie_chart'), n('receipts', 'receipts', 'receipt_long'), n('stock', 'stock', 'inventory_2'), n('guests', 'guests', 'co_present'), n('members', 'members', 'groups'), n('tasks', 'tasks', 'checklist'), n('directory', 'directory', 'contacts')], // round 7: Guests to pay the guest hosts' fees
  mgmt: [],
  // round 8 (Family App prototype): Today · Photos · Calendar · Health · Me; Billing and Contacts open from Me
  family: [n('today', 'today', 'wb_sunny'), n('photos', 'photos', 'photo_library'), n('calendar', 'calShort', 'calendar_month'), n('health', 'healthF', 'favorite'), n('me', 'me', 'person')],
};
export const NAVG: Record<string, [string | null, NavItem[]][]> = {
  mgmt: [
    [null, [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('reviews', 'reviews', 'fact_check'), n('tasks', 'tasks', 'checklist'), n('report', 'report', 'summarize'), n('monthReport', 'monthReport', 'query_stats')]], // round 7: the daily report (management); round 12: the month report
    ['nav.g_front', [n('enquiries', 'enquiries', 'contact_phone'), n('renewals', 'renewals', 'event_repeat')]],
    ['nav.g_care', [n('hchecks', 'health', 'monitor_heart'), n('readings', 'readings', 'monitoring'), n('log', 'log', 'edit_note'), n('camera', 'camera', 'photo_camera')]], // the photo library is the Camera's Library tab
    ['nav.g_kitchen', [n('menu', 'menu', 'restaurant'), n('feedback', 'feedback', 'forum'), n('stock', 'stock', 'inventory_2')]],
    ['nav.g_finance', [n('billing', 'billing', 'payments'), n('payments', 'payments', 'account_balance'), n('budget', 'budget', 'pie_chart'), n('receipts', 'receipts', 'receipt_long')]],
    ['nav.g_club', [n('calendar', 'calShort', 'calendar_month'), n('guests', 'guests', 'co_present'), n('insights', 'insights', 'insights'), n('broadcast', 'broadcast', 'campaign'), n('venue', 'venue', 'storefront'), n('hr', 'people', 'badge'), n('directory', 'directory', 'contacts'), n('surveys', 'surveys', 'rate_review'), n('plans', 'plans', 'sell')]],
  ],
};
NAVS.mgmt = NAVG.mgmt.reduce<NavItem[]>((a, g) => a.concat(g[1]), []);
export const PHONE_NAV: Partial<Record<Role, NavItem[]>> = {
  mgmt: [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month')],
  // KC round 6: the teacher's bar has Calendar instead of Members (Members and Requests sit under More)
  activity: [n('today', 'today', 'wb_sunny'), n('camera', 'camera', 'photo_camera'), n('log', 'log', 'edit_note'), n('calendar', 'calShort', 'calendar_month')],
};
export const MORE: NavItem = n('more', 'more', 'menu');

/** Round 8: the family tab a pushed family page belongs to (its tab stays lit in the bar). */
export const FAMILY_TAB_OF: Record<string, string> = { billing: 'me', contacts: 'me', profile: 'me', history: 'health', memories: 'photos' };

/** Phone bottom bar: role's phone nav (≤5) or first 4 + More. */
export function phoneNav(role: Role): { items: NavItem[]; more: boolean } {
  if (PHONE_NAV[role]) return { items: [...PHONE_NAV[role]!, MORE], more: true };
  const all = NAVS[role];
  return all.length > 5 ? { items: [...all.slice(0, 4), MORE], more: true } : { items: all, more: false };
}

/** Extra keys a role may open through links (not in its nav). */
// KC round 6: Contacts (the family app's "Useful contacts") is a menu item for every role; management and finance have the full Directory
const EXTRA: Partial<Record<Role, string[]>> = {
  // round 8: pushed pages of the family app (Billing and Contacts from Me, a parent's profile, health history) and the monthly memories
  family: ['billing', 'contacts', 'memories', 'profile', 'history'],
  lobby: ['calendar', 'photos'],
  nurse: ['calendar', 'contacts'],
  kitchen: ['calendar', 'contacts', 'drafts'], // KC round 7: the quick camera's Drafts (activity and management have them in the Camera)
  finance: ['calendar', 'contacts'],
  activity: ['photos', 'contacts', 'drafts'],
  mgmt: ['photos', 'contacts', 'drafts'], // photos: old links to the standalone library
};
export const allowedKeys = (role: Role) => new Set([...NAVS[role].map((x) => x.key), ...(EXTRA[role] || [])]);

export type ScreenId =
  | 'arrivals' | 'health' | 'activityToday' | 'kmenu' | 'fin' | 'overview' | 'familyToday' | 'requests' | 'enq' | 'members' | 'readings' | 'camera' | 'dlog'
  | 'cal' | 'kfeed' | 'kstock' | 'pay' | 'budget' | 'rcpt' | 'dir' | 'venue' | 'bc' | 'hr' | 'surveys' | 'plans' | 'reviews' | 'photoLib' | 'fphotos' | 'familyHealth' | 'fbill'
  | 'renewals' | 'tasks' | 'guests' | 'insights' | 'fmemories' | 'report' | 'monthReport' | 'drafts'
  | 'fme' | 'fprofile' | 'fhistory' | 'fcal' | 'fcontacts';

export function screenFor(role: Role, key: string): ScreenId | null {
  if (!allowedKeys(role).has(key)) return null;
  if (key === 'today') return ({ lobby: 'arrivals', nurse: 'health', activity: 'activityToday', kitchen: 'kmenu', finance: 'fin', mgmt: 'arrivals', family: 'familyToday' } as const)[role];
  if (role === 'family') return ({ photos: 'fphotos', health: 'familyHealth', billing: 'fbill', calendar: 'fcal', contacts: 'fcontacts', memories: 'fmemories', me: 'fme', profile: 'fprofile', history: 'fhistory' } as Record<string, ScreenId>)[key] || null;
  const map: Record<string, ScreenId> = {
    arrivals: 'arrivals', hchecks: 'health', menu: 'kmenu', readings: 'readings', log: 'dlog', camera: 'camera', photos: 'photoLib', feedback: 'kfeed', stock: 'kstock',
    billing: 'fin', payments: 'pay', budget: 'budget', receipts: 'rcpt', directory: 'dir', contacts: 'dir', venue: 'venue', broadcast: 'bc', hr: 'hr', members: 'members',
    enquiries: 'enq', calendar: 'cal', plans: 'plans', surveys: 'surveys', reviews: 'reviews', requests: 'requests',
    renewals: 'renewals', tasks: 'tasks', guests: 'guests', insights: 'insights', report: 'report', monthReport: 'monthReport', drafts: 'drafts',
  };
  return map[key] || null;
}
