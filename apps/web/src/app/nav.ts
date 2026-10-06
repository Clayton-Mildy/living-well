// Per-role navigation (design NAVS/NAVG/PHONE_NAV + new Reviews/Requests/Contacts items) and nav-key → screen mapping.
import type { Role } from '@cp/shared';

export interface NavItem { key: string; label: string; short: string; icon: string }
const n = (key: string, labelKey: string, icon: string): NavItem => ({ key, label: 'nav.' + labelKey, short: 'nav.s_' + labelKey, icon });

export const NAVS: Record<Role, NavItem[]> = {
  lobby: [n('today', 'arrivals', 'how_to_reg'), n('enquiries', 'enquiries', 'contact_phone'), n('chat', 'messages', 'chat'), n('members', 'members', 'groups'), n('contacts', 'contacts', 'contacts'), n('requests', 'requests', 'add_shopping_cart')],
  nurse: [n('today', 'health', 'monitor_heart'), n('readings', 'readings', 'monitoring'), n('members', 'members', 'groups'), n('chat', 'messages', 'chat'), n('requests', 'requests', 'add_shopping_cart')],
  activity: [n('today', 'today', 'wb_sunny'), n('camera', 'camera', 'photo_camera'), n('log', 'log', 'edit_note'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month'), n('requests', 'requests', 'add_shopping_cart')],
  kitchen: [n('today', 'menu', 'restaurant'), n('feedback', 'feedback', 'forum'), n('stock', 'stock', 'inventory_2'), n('requests', 'requests', 'add_shopping_cart')],
  finance: [n('today', 'billing', 'payments'), n('payments', 'payments', 'account_balance'), n('budget', 'budget', 'pie_chart'), n('receipts', 'receipts', 'receipt_long'), n('stock', 'stock', 'inventory_2'), n('members', 'members', 'groups'), n('chat', 'messages', 'chat'), n('directory', 'directory', 'contacts')],
  mgmt: [],
  family: [n('today', 'today', 'wb_sunny'), n('photos', 'photos', 'photo_library'), n('health', 'healthF', 'favorite'), n('billing', 'billing', 'receipt_long'), n('chat', 'messages', 'chat')],
  housekeeping: [n('today', 'requests', 'add_shopping_cart')],
  driver: [n('today', 'requests', 'add_shopping_cart')],
};
export const NAVG: Record<string, [string | null, NavItem[]][]> = {
  mgmt: [
    [null, [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('reviews', 'reviews', 'fact_check')]],
    ['nav.g_front', [n('enquiries', 'enquiries', 'contact_phone'), n('chat', 'messages', 'chat')]],
    ['nav.g_care', [n('hchecks', 'health', 'monitor_heart'), n('readings', 'readings', 'monitoring'), n('log', 'log', 'edit_note'), n('camera', 'camera', 'photo_camera')]], // the photo library is the Camera's Library tab
    ['nav.g_kitchen', [n('menu', 'menu', 'restaurant'), n('feedback', 'feedback', 'forum'), n('stock', 'stock', 'inventory_2')]],
    ['nav.g_finance', [n('billing', 'billing', 'payments'), n('payments', 'payments', 'account_balance'), n('budget', 'budget', 'pie_chart'), n('receipts', 'receipts', 'receipt_long')]],
    ['nav.g_club', [n('calendar', 'calendar', 'calendar_month'), n('broadcast', 'broadcast', 'campaign'), n('venue', 'venue', 'storefront'), n('hr', 'people', 'badge'), n('directory', 'directory', 'contacts'), n('surveys', 'surveys', 'rate_review'), n('plans', 'plans', 'sell')]],
  ],
};
NAVS.mgmt = NAVG.mgmt.reduce<NavItem[]>((a, g) => a.concat(g[1]), []);
export const PHONE_NAV: Partial<Record<Role, NavItem[]>> = {
  mgmt: [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month')],
};
export const MORE: NavItem = n('more', 'more', 'menu');

/** Phone bottom bar: role's phone nav (≤5) or first 4 + More. */
export function phoneNav(role: Role): { items: NavItem[]; more: boolean } {
  if (PHONE_NAV[role]) return { items: [...PHONE_NAV[role]!, MORE], more: true };
  const all = NAVS[role];
  return all.length > 5 ? { items: [...all.slice(0, 4), MORE], more: true } : { items: all, more: false };
}

/** Extra keys a role may open through links (not in its nav). */
const EXTRA: Partial<Record<Role, string[]>> = {
  family: ['calendar', 'contacts'],
  lobby: ['calendar', 'photos'],
  nurse: ['calendar'],
  kitchen: ['calendar', 'chat'],
  finance: ['calendar'],
  activity: ['photos', 'chat'],
  mgmt: ['photos'], // old links to the standalone library
};
export const allowedKeys = (role: Role) => new Set([...NAVS[role].map((x) => x.key), ...(EXTRA[role] || [])]);

export type ScreenId =
  | 'arrivals' | 'health' | 'activityToday' | 'kmenu' | 'fin' | 'overview' | 'familyToday' | 'requests' | 'enq' | 'chat' | 'members' | 'readings' | 'camera' | 'dlog'
  | 'cal' | 'kfeed' | 'kstock' | 'pay' | 'budget' | 'rcpt' | 'dir' | 'venue' | 'bc' | 'hr' | 'surveys' | 'plans' | 'reviews' | 'photoLib' | 'fphotos' | 'familyHealth' | 'fbill';

export function screenFor(role: Role, key: string): ScreenId | null {
  if (!allowedKeys(role).has(key)) return null;
  if (key === 'today') return ({ lobby: 'arrivals', nurse: 'health', activity: 'activityToday', kitchen: 'kmenu', finance: 'fin', mgmt: 'arrivals', family: 'familyToday', housekeeping: 'requests', driver: 'requests' } as const)[role];
  if (role === 'family') return ({ photos: 'fphotos', health: 'familyHealth', billing: 'fbill', chat: 'chat', calendar: 'cal', contacts: 'dir' } as Record<string, ScreenId>)[key] || null;
  const map: Record<string, ScreenId> = {
    arrivals: 'arrivals', hchecks: 'health', menu: 'kmenu', readings: 'readings', log: 'dlog', camera: 'camera', photos: 'photoLib', feedback: 'kfeed', stock: 'kstock', chat: 'chat',
    billing: 'fin', payments: 'pay', budget: 'budget', receipts: 'rcpt', directory: 'dir', contacts: 'dir', venue: 'venue', broadcast: 'bc', hr: 'hr', members: 'members',
    enquiries: 'enq', calendar: 'cal', plans: 'plans', surveys: 'surveys', reviews: 'reviews', requests: 'requests',
  };
  return map[key] || null;
}
