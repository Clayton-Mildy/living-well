import { describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { MENU_KEYS, AREA_BASE } from '@cp/shared';
import { menuGroups, navFor, navGroups, phoneNav, retiredKey, screenFor } from './nav';

const s = structuredClone(buildSeed().citra);
const NAVS = (r: Parameters<typeof navFor>[1]) => navFor(s, r);
const NAVG = (r: Parameters<typeof navFor>[1]) => navGroups(s, r);

// KC round 13 §15: every staff role's sidebar is sectioned; the sections hold exactly the role's items, and the phone bar is untouched
describe('owner nav', () => {
  // round 16: the Owner's menus are management's
  it('the owner has every management menu and lands on the arrivals board', () => {
    const own = NAVS('owner').map((i) => i.key);
    for (const k of NAVS('mgmt').map((i) => i.key)) expect(own).toContain(k);
    expect(screenFor(s, 'owner', 'today')).toBe('arrivals');
  });
});

describe('nav groups', () => {
  it.each(['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt'] as const)('%s: the groups hold exactly the flat nav, each item once', (role) => {
    const grouped = NAVG(role).flatMap((g) => g[1].map((i) => i.key));
    expect([...grouped].sort()).toEqual(NAVS(role).map((i) => i.key).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(NAVG(role)[0][0]).toBeNull(); // the role's own daily work comes first, untitled
    for (const [title] of NAVG(role).slice(1)) expect(title).toMatch(/^nav\.g_/);
  });
  it('the front desk phone bar keeps its round-6 order', () => {
    expect(phoneNav(s, 'lobby').items.map((i) => i.key)).toEqual(['today', 'enquiries', 'members', 'menu', 'more']);
  });
  // round 14 phase 2: Spending is for the people who read the books
  it('Spending is in the finance and management navs, after Receipts, and no other role reaches it', () => {
    for (const role of ['finance', 'mgmt'] as const) {
      const keys = NAVS(role).map((i) => i.key);
      expect(keys[keys.indexOf('receipts') + 1]).toBe('spending');
      expect(NAVG(role).flatMap((g) => g[1]).map((i) => i.key)).toContain('spending');
      expect(screenFor(s, role, 'spending')).toBe('spend');
    }
    for (const role of ['lobby', 'nurse', 'activity', 'kitchen', 'family'] as const) {
      expect(NAVS(role).map((i) => i.key)).not.toContain('spending');
      expect(screenFor(s, role, 'spending')).toBeNull();
    }
  });
  it('Purchases lives inside Spending (its Items tab), not as a menu of its own (KC 28 Oct)', () => {
    for (const role of ['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt', 'family'] as const) {
      expect(NAVS(role).map((i) => i.key)).not.toContain('purchases');
      expect(screenFor(s, role, 'purchases')).toBeNull();
    }
  });
  it('management has the Lunch round in the Kitchen group (KC 28 Oct)', () => {
    const kitchen = NAVG('mgmt').find((g) => g[0] === 'nav.g_kitchen')![1].map((x) => x.key);
    expect(kitchen).toEqual(['menu', 'lunch', 'feedback', 'stock']);
    expect(screenFor(s, 'mgmt', 'lunch')).toBe('klunch');
  });
  // round 16: the front desk sees Billing (view); the grid can switch a menu off
  it('Billing opens for the front desk, and an Off menu is gone', () => {
    expect(screenFor(s, 'lobby', 'billing')).toBe('fin');
    const o = structuredClone(s);
    o.club.settings.access = { lobby: { renewals: 'off' } };
    expect(screenFor(o, 'lobby', 'renewals')).toBeNull();
    expect(navFor(o, 'lobby').map((i) => i.key)).not.toContain('renewals');
    expect(navGroups(o, 'lobby').flatMap((g) => g[1]).map((i) => i.key)).not.toContain('renewals');
  });
});

// round 16 fix: each role keeps today's sidebar grouping and order (KC round 13 §15), copied here as fixtures
describe('access grid in the nav', () => {
  const OLD: Record<string, [string | null, string[]][]> = {
    lobby: [[null, ['today', 'members', 'tasks']], ['nav.g_front', ['enquiries', 'renewals', 'venue', 'surveys']], ['nav.g_kitchen', ['menu']], ['nav.g_club', ['contacts', 'requests', 'billing']]],
    nurse: [[null, ['today', 'readings', 'members', 'tasks']], ['nav.g_club', ['requests', 'contacts']]],
    activity: [[null, ['today', 'camera', 'log', 'tasks']], ['nav.g_club', ['members', 'calendar', 'requests', 'contacts']]],
    kitchen: [[null, ['today', 'lunch', 'feedback', 'tasks']], ['nav.g_club', ['requests', 'contacts']]],
    finance: [[null, ['today', 'payments', 'budget', 'receipts', 'spending']], ['nav.g_kitchen', ['stock']], ['nav.g_club', ['guests', 'members', 'tasks', 'contacts']]],
  };
  it.each(Object.keys(OLD))('%s: default sidebar groups are today\'s (lobby adds Billing under Club)', (role) => {
    expect(navGroups(s, role as 'lobby').map((g) => [g[0], g[1].map((i) => i.key)])).toEqual(OLD[role]);
  });
  it('R3: an Off link-only extra is closed; unset keeps it', () => {
    expect(screenFor(s, 'finance', 'renewals')).toBe('renewals');
    const o = structuredClone(s);
    o.club.settings.access = { finance: { renewals: 'off' } };
    expect(screenFor(o, 'finance', 'renewals')).toBeNull();
  });
  it('the phone bar drops an item the grid switches off', () => {
    expect(phoneNav(s, 'mgmt').items.map((i) => i.key)).toContain('members');
    const o = structuredClone(s);
    o.club.settings.access = { mgmt: { members: 'off' } };
    expect(phoneNav(o, 'mgmt').items.map((i) => i.key)).not.toContain('members');
  });
  it('every grid menu has a nav item and a screen for its base role', () => {
    for (const k of MENU_KEYS) {
      const base = AREA_BASE[k];
      const o = structuredClone(s);
      o.club.settings.access = { [base]: { [k]: 'edit' } };
      expect(navFor(o, base).map((i) => i.key), k).toContain(k);
      expect(screenFor(o, base, k), k).not.toBeNull();
    }
  });
});

// round 19: Directory is retired as a menu; Contacts opens the one Directory screen for every role
describe('one Contacts menu', () => {
  it.each(['finance', 'mgmt', 'owner'] as const)('%s: one Contacts item under Club and no Directory item', (role) => {
    const keys = NAVS(role).map((i) => i.key);
    expect(keys.filter((k) => k === 'contacts')).toHaveLength(1);
    expect(keys).not.toContain('directory');
    expect(NAVG(role).find((g) => g[1].some((i) => i.key === 'contacts'))![0]).toBe('nav.g_club');
    const item = NAVS(role).find((i) => i.key === 'contacts')!;
    expect(item.label).toBe('nav.contacts');
  });
  it('Admin › Roles has no Directory group row', () => {
    expect(menuGroups().flatMap((g) => g.keys)).not.toContain('directory');
    expect(menuGroups().find((g) => g.label === 'nav.g_club')!.keys).toContain('contacts');
  });
  it('Contacts opens the Directory screen; the old directory key is no screen and redirects to contacts', () => {
    expect(screenFor(s, 'finance', 'contacts')).toBe('dir');
    expect(screenFor(s, 'mgmt', 'contacts')).toBe('dir');
    expect(screenFor(s, 'nurse', 'contacts')).toBe('dir');
    expect(screenFor(s, 'finance', 'directory')).toBeNull();
    expect(retiredKey('directory')).toBe('contacts');
    expect(retiredKey('contacts')).toBeNull();
  });
  it('a Contacts cell closes Contacts; a Directory cell saved before the merge still opens it', () => {
    const o = structuredClone(s);
    o.club.settings.access = { finance: { contacts: 'off' }, lobby: { directory: 'edit' } };
    expect(screenFor(o, 'finance', 'contacts')).toBeNull();
    expect(screenFor(o, 'lobby', 'contacts')).toBe('dir');
  });
});
