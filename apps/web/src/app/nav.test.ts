import { describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { navFor, navGroups, phoneNav, screenFor } from './nav';

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
