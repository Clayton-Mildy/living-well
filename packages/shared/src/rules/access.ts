// Round 16 (KC): who opens which menu. The menus a role has today are the defaults; management's Roles screen (Task 5) changes them per role.
import type { ClubState, StaffRole } from '../types';

export type AccessLevel = 'off' | 'view' | 'edit';
export type GridRole = Exclude<StaffRole, 'owner'>;
export const GRID_ROLES: GridRole[] = ['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance'];

// mgmt's list is in the web nav's group order (Task 2 moved it here from nav.ts NAVS)
const MGMT_MENU = [
  'today', 'members', 'reviews', 'tasks', 'report', 'monthReport',
  'enquiries', 'renewals',
  'hchecks', 'readings', 'log', 'camera',
  'menu', 'lunch', 'feedback', 'stock',
  'billing', 'payments', 'budget', 'receipts', 'spending',
  'calendar', 'guests', 'insights', 'broadcast', 'venue', 'hr', 'directory', 'surveys', 'plans',
];

/** Today's menus per role, in order. `today` is every role's home (not part of the grid, R1). The Owner has management's. */
export const DEFAULT_MENUS: Record<StaffRole, string[]> = {
  lobby: ['today', 'enquiries', 'members', 'menu', 'renewals', 'surveys', 'venue', 'tasks', 'contacts', 'requests'],
  nurse: ['today', 'readings', 'members', 'tasks', 'requests', 'contacts'],
  activity: ['today', 'camera', 'log', 'members', 'calendar', 'tasks', 'requests', 'contacts'],
  kitchen: ['today', 'lunch', 'feedback', 'tasks', 'requests', 'contacts'],
  finance: ['today', 'payments', 'budget', 'receipts', 'spending', 'stock', 'guests', 'members', 'tasks', 'directory'],
  mgmt: MGMT_MENU,
  owner: [...MGMT_MENU, 'roles'], // round 16: Admin › Roles is the Owner's alone (not a grid menu)
};

/** Where today's default is not Edit. Front desk sees Billing; only Finance (and the Owner) approve receipts. */
export const DEFAULT_LEVELS: Partial<Record<GridRole, Record<string, AccessLevel>>> = { lobby: { billing: 'view' }, mgmt: { receipts: 'view' } };

/** Every menu the grid can grant: the grid roles' menus together, mgmt's order first, without `today`. */
export const MENU_KEYS: string[] = (() => {
  const seen = new Set<string>();
  for (const r of GRID_ROLES) for (const k of DEFAULT_MENUS[r]) if (k !== 'today') seen.add(k);
  return [...seen];
})();

/** The role whose area a menu belongs to (the base for what its screens let a role do, Task 3). */
export const AREA_BASE: Record<string, StaffRole> = (() => {
  const m: Record<string, StaffRole> = {};
  for (const k of MENU_KEYS) m[k] = 'mgmt';
  const set = (role: StaffRole, keys: string[]) => { for (const k of keys) m[k] = role; };
  set('lobby', ['members', 'enquiries', 'renewals', 'venue', 'surveys']);
  set('kitchen', ['menu', 'lunch', 'feedback']);
  set('nurse', ['hchecks', 'readings']);
  set('activity', ['log', 'camera', 'calendar']);
  set('finance', ['billing', 'payments', 'budget', 'receipts', 'spending', 'stock', 'guests', 'directory']);
  return m;
})();

export const defaultLevel = (role: GridRole, key: string): AccessLevel =>
  DEFAULT_LEVELS[role]?.[key] ?? (DEFAULT_MENUS[role].includes(key) ? 'edit' : 'off');

export function accessOf(s: ClubState, role: StaffRole, key: string): AccessLevel {
  if (role === 'owner' || key === 'today') return 'edit';
  return s.club.settings.access?.[role]?.[key] ?? defaultLevel(role, key);
}

/** The role's menu keys: `today`, then every key not switched off. Default keys keep their order; granted ones follow in MENU_KEYS order. */
export function menuKeys(s: ClubState, role: StaffRole): string[] {
  const base = DEFAULT_MENUS[role];
  const out = base.filter((k) => k === 'today' || accessOf(s, role, k) !== 'off');
  if (role === 'owner') return out;
  return [...out, ...MENU_KEYS.filter((k) => !base.includes(k) && accessOf(s, role, k) !== 'off')];
}

export type OwnerKind = 'pricing' | 'holidays' | 'budget';
/** Does a change of this kind by this role wait for the Owner? Default: on for Management, off for the others; never for the Owner. */
export function ownerApprovalOn(s: ClubState, role: StaffRole, kind: OwnerKind): boolean {
  if (role === 'owner') return false;
  return s.club.settings.ownerApproval?.[role]?.[kind] ?? role === 'mgmt';
}
