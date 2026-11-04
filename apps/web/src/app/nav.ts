// Per-role navigation (design NAVS/NAVG/PHONE_NAV + new Reviews/Requests/Contacts items) and nav-key → screen mapping.
import { MENU_KEYS, accessOf, menuKeys, type ClubState, type Role, type StaffRole } from '@cp/shared';

export interface NavItem { key: string; label: string; short: string; icon: string }
const n = (key: string, labelKey: string, icon: string): NavItem => ({ key, label: 'nav.' + labelKey, short: 'nav.s_' + labelKey, icon });

// round 16 (KC): the menus come from the shared access grid (rules/access.ts). Icons and labels stay here, keyed by menu key.
/** Each role's own Today: its label and icon say what the home screen is (Arrivals, Health, Menu, Billing…). */
const TODAY_ITEM: Record<StaffRole, NavItem> = {
  lobby: n('today', 'arrivals', 'how_to_reg'), nurse: n('today', 'health', 'monitor_heart'), activity: n('today', 'today', 'wb_sunny'),
  kitchen: n('today', 'menu', 'restaurant'), finance: n('today', 'billing', 'payments'), mgmt: n('today', 'arrivals', 'how_to_reg'), owner: n('today', 'arrivals', 'how_to_reg'),
};
// KC round 6: the front desk has the kitchen's Menu, view only; round 7: Renewals, Tasks; round 12: Venue
const ITEMS: Record<string, NavItem> = Object.fromEntries([
  n('members', 'members', 'groups'), n('reviews', 'reviews', 'fact_check'), n('tasks', 'tasks', 'checklist'), n('report', 'report', 'summarize'), n('monthReport', 'monthReport', 'query_stats'),
  n('enquiries', 'enquiries', 'contact_phone'), n('renewals', 'renewals', 'event_repeat'),
  n('hchecks', 'health', 'monitor_heart'), n('readings', 'readings', 'monitoring'), n('log', 'log', 'edit_note'), n('camera', 'camera', 'photo_camera'),
  n('menu', 'menu', 'restaurant'), n('lunch', 'lunch', 'lunch_dining'), n('feedback', 'feedback', 'forum'), n('stock', 'stock', 'inventory_2'),
  n('billing', 'billing', 'payments'), n('payments', 'payments', 'account_balance'), n('budget', 'budget', 'pie_chart'), n('receipts', 'receipts', 'receipt_long'), n('spending', 'spending', 'shopping_cart'),
  n('calendar', 'calShort', 'calendar_month'), n('guests', 'guests', 'co_present'), n('insights', 'insights', 'insights'), n('broadcast', 'broadcast', 'campaign'), n('venue', 'venue', 'storefront'), n('hr', 'people', 'badge'),
  n('surveys', 'surveys', 'rate_review'), n('plans', 'plans', 'sell'), n('contacts', 'contacts', 'contacts'), n('requests', 'requests', 'add_shopping_cart'),
  n('roles', 'roles', 'admin_panel_settings'), // round 16: the Owner's Admin › Roles
  n('settings', 'settings', 'tune'), // round 17: Admin › Settings (Owner and Management)
].map((x) => [x.key, x]));
// round 8 (Family App prototype): Today · Photos · Calendar · Health · Me; Billing and Contacts open from Me
export const FAMILY_NAV: NavItem[] = [n('today', 'today', 'wb_sunny'), n('photos', 'photos', 'photo_library'), n('calendar', 'calShort', 'calendar_month'), n('health', 'healthF', 'favorite'), n('me', 'me', 'person')];

/** The nav label key of a menu item (the grid on Admin › Roles names its menus the way the sidebar does). */
export const menuLabel = (key: string): string => ITEMS[key]?.label ?? 'nav.' + key;
/** The sidebar icon of a menu item (round 18: each row on Admin › Roles has it). */
export const menuIcon = (key: string): string => ITEMS[key]?.icon ?? 'apps';
const itemOf = (role: StaffRole, key: string): NavItem | null => (key === 'today' ? TODAY_ITEM[role] : ITEMS[key] ?? null);

/** The role's sidebar and More list, flat: today, then its menus from the grid. */
export function navFor(s: ClubState, role: Role): NavItem[] {
  if (role === 'family') return FAMILY_NAV;
  return menuKeys(s, role).map((k) => itemOf(role, k)).filter((x): x is NavItem => !!x);
}

// The sidebar sections: each role keeps its own grouping and order (KC round 13 §15; only the titles are shared), filtered by the grid.
// A menu the grid grants beyond the role's defaults goes under Club at the end.
const G_FRONT = 'nav.g_front', G_CARE = 'nav.g_care', G_KITCHEN = 'nav.g_kitchen', G_FINANCE = 'nav.g_finance', G_CLUB = 'nav.g_club';
type Layout = [string | null, string[]][];
const MGMT_LAYOUT: Layout = [
  [null, ['today', 'members', 'reviews', 'tasks', 'report', 'monthReport']],
  [G_FRONT, ['enquiries', 'renewals']],
  [G_CARE, ['hchecks', 'readings', 'log', 'camera']], // the photo library is the Camera's Library tab
  [G_KITCHEN, ['menu', 'lunch', 'feedback', 'stock']], // KC 28 Oct: management has the Lunch round too
  [G_FINANCE, ['billing', 'payments', 'budget', 'receipts', 'spending']],
  [G_CLUB, ['calendar', 'guests', 'insights', 'broadcast', 'venue', 'hr', 'contacts', 'surveys', 'plans', 'settings', 'roles']], // round 16: 'roles' is the Owner's only (DEFAULT_MENUS.owner); management's menus do not include it
];
/** Admin › Roles (round 17) groups the menus as management's sidebar does, without Today and Roles; a menu not in that layout goes to the first group, General. */
export function menuGroups(): { label: string | null; keys: string[] }[] {
  const groups = MGMT_LAYOUT.map(([label, keys]) => ({ label: label ?? 'nav.g_general', keys: keys.filter((k) => MENU_KEYS.includes(k)) }));
  const placed = new Set(groups.flatMap((g) => g.keys));
  groups[0].keys.push(...MENU_KEYS.filter((k) => !placed.has(k)));
  return groups.filter((g) => g.keys.length);
}
const LAYOUTS: Record<StaffRole, Layout> = {
  lobby: [[null, ['today', 'members', 'tasks']], [G_FRONT, ['enquiries', 'renewals', 'venue', 'surveys']], [G_KITCHEN, ['menu']], [G_CLUB, ['contacts', 'requests']]],
  nurse: [[null, ['today', 'readings', 'members', 'tasks']], [G_CLUB, ['requests', 'contacts']]],
  activity: [[null, ['today', 'camera', 'log', 'tasks']], [G_CLUB, ['members', 'calendar', 'requests', 'contacts']]],
  kitchen: [[null, ['today', 'lunch', 'feedback', 'tasks']], [G_CLUB, ['requests', 'contacts']]],
  finance: [[null, ['today', 'payments', 'budget', 'receipts', 'spending']], [G_KITCHEN, ['stock']], [G_CLUB, ['guests', 'members', 'tasks', 'contacts']]],
  mgmt: MGMT_LAYOUT,
  owner: MGMT_LAYOUT,
};
export function navGroups(s: ClubState, role: Role): [string | null, NavItem[]][] {
  const all = navFor(s, role);
  if (role === 'family') return [[null, all]];
  const out: [string | null, NavItem[]][] = LAYOUTS[role].map(([title, keys]) => [title, keys.map((k) => all.find((i) => i.key === k)).filter((x): x is NavItem => !!x)]);
  const placed = new Set(out.flatMap((g) => g[1].map((i) => i.key)));
  const rest = all.filter((i) => !placed.has(i.key));
  if (rest.length) { const club = out.find((g) => g[0] === G_CLUB); if (club) club[1].push(...rest); else out.push([G_CLUB, rest]); }
  return out.filter((g) => g[1].length);
}

const PHONE_NAV: Partial<Record<Role, NavItem[]>> = {
  mgmt: [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month')],
  owner: [n('today', 'arrivals', 'how_to_reg'), n('members', 'members', 'groups'), n('calendar', 'calShort', 'calendar_month')],
  // KC round 6: the teacher's bar has Calendar instead of Members (Members and Requests sit under More)
  activity: [n('today', 'today', 'wb_sunny'), n('camera', 'camera', 'photo_camera'), n('log', 'log', 'edit_note'), n('calendar', 'calShort', 'calendar_month')],
};
export const MORE: NavItem = n('more', 'more', 'menu');

/** Round 8: the family tab a pushed family page belongs to (its tab stays lit in the bar). */
export const FAMILY_TAB_OF: Record<string, string> = { billing: 'me', contacts: 'me', profile: 'me', history: 'health', memories: 'photos' };

/** Phone bottom bar: role's phone nav (≤5) or first 4 + More. */
export function phoneNav(s: ClubState, role: Role): { items: NavItem[]; more: boolean } {
  const all = navFor(s, role);
  if (PHONE_NAV[role]) { // a bar item the grid switched off drops out
    const have = new Set(all.map((x) => x.key));
    return { items: [...PHONE_NAV[role]!.filter((x) => have.has(x.key)), MORE], more: true };
  }
  return all.length > 5 ? { items: [...all.slice(0, 4), MORE], more: true } : { items: all, more: false };
}

/** Extra keys a role may open through links (not in its nav). */
// KC round 6: Contacts (the family app's "Useful contacts") is a menu item for every role; management and finance have the full Directory
const EXTRA: Partial<Record<Role, string[]>> = {
  // round 8: pushed pages of the family app (Billing and Contacts from Me, a parent's profile, health history) and the monthly memories
  family: ['billing', 'contacts', 'memories', 'profile', 'history'],
  lobby: ['calendar', 'photos', 'guests', 'surveys', 'celebrations'], // guests: link-only, read-only (the Arrivals rail's "Guests today"); celebrations: link-only, the birthday reminder's request form (round 14)
  nurse: ['calendar', 'contacts'],
  kitchen: ['calendar', 'contacts', 'drafts'], // KC round 7: the quick camera's Drafts (activity and management have them in the Camera)
  finance: ['calendar', 'contacts', 'renewals'], // round 14: renewals is link-only, for the Unpaid list (the Month report, the duty)
  activity: ['photos', 'contacts', 'drafts', 'celebrations'],
  mgmt: ['photos', 'contacts', 'drafts', 'celebrations'], // photos: old links to the standalone library
  owner: ['photos', 'contacts', 'drafts', 'celebrations'],
};
/** The menus plus the link-only extras. A key the grid sets to Off is gone from both (round 16). */
export const allowedKeys = (s: ClubState, role: Role) => {
  const cells = role === 'family' ? undefined : s.club.settings.access?.[role];
  // round 19: a Directory cell saved before the merge closes or opens Contacts too (accessOf merges the two)
  const off = role === 'family' ? undefined : (k: string) => (k === 'contacts' ? (cells?.contacts !== undefined || cells?.directory !== undefined) && accessOf(s, role, k) === 'off' : cells?.[k] === 'off');
  return new Set([...navFor(s, role).map((x) => x.key), ...(EXTRA[role] || []).filter((k) => !off?.(k))]);
};

export type ScreenId =
  | 'arrivals' | 'health' | 'activityToday' | 'kmenu' | 'klunch' | 'fin' | 'overview' | 'familyToday' | 'requests' | 'enq' | 'members' | 'readings' | 'camera' | 'dlog'
  | 'cal' | 'kfeed' | 'kstock' | 'pay' | 'budget' | 'rcpt' | 'spend' | 'dir' | 'venue' | 'bc' | 'hr' | 'surveys' | 'plans' | 'settings' | 'reviews' | 'photoLib' | 'fphotos' | 'familyHealth' | 'fbill'
  | 'renewals' | 'tasks' | 'guests' | 'insights' | 'fmemories' | 'report' | 'monthReport' | 'drafts'
  | 'roles' | 'fme' | 'fprofile' | 'fhistory' | 'fcal' | 'fcontacts' | 'celebrations';

/** Round 19: menu keys that were merged into another. A link to the old key (/directory?q=…) lands on the new one. */
const RETIRED_KEYS: Record<string, string> = { directory: 'contacts' };
export const retiredKey = (key: string): string | null => RETIRED_KEYS[key] ?? null;

export function screenFor(s: ClubState, role: Role, key: string): ScreenId | null {
  if (!allowedKeys(s, role).has(key)) return null;
  if (key === 'today') return ({ lobby: 'arrivals', nurse: 'health', activity: 'activityToday', kitchen: 'kmenu', finance: 'fin', mgmt: 'arrivals', owner: 'arrivals', family: 'familyToday' } as const)[role];
  if (role === 'family') return ({ photos: 'fphotos', health: 'familyHealth', billing: 'fbill', calendar: 'fcal', contacts: 'fcontacts', memories: 'fmemories', me: 'fme', profile: 'fprofile', history: 'fhistory' } as Record<string, ScreenId>)[key] || null;
  const map: Record<string, ScreenId> = {
    arrivals: 'arrivals', hchecks: 'health', menu: 'kmenu', lunch: 'klunch', readings: 'readings', log: 'dlog', camera: 'camera', photos: 'photoLib', feedback: 'kfeed', stock: 'kstock',
    billing: 'fin', payments: 'pay', budget: 'budget', receipts: 'rcpt', spending: 'spend', contacts: 'dir', venue: 'venue', broadcast: 'bc', hr: 'hr', members: 'members',
    enquiries: 'enq', calendar: 'cal', plans: 'plans', settings: 'settings', surveys: 'surveys', reviews: 'reviews', requests: 'requests',
    renewals: 'renewals', tasks: 'tasks', guests: 'guests', insights: 'insights', report: 'report', monthReport: 'monthReport', drafts: 'drafts', celebrations: 'celebrations', roles: 'roles',
  };
  return map[key] || null;
}
