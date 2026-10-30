import { describe, expect, it } from 'vitest';
import { buildSeed } from '../seed';
import { GRID_ROLES, accessOf, menuKeys, ownerApprovalOn } from './access';

const fresh = () => structuredClone(buildSeed().citra);

// round 16: today's NAVS keys, copied here so a change to the defaults is a visible edit
const TODAY: Record<string, string[]> = {
  lobby: ['today', 'enquiries', 'members', 'menu', 'renewals', 'surveys', 'venue', 'tasks', 'contacts', 'requests'],
  nurse: ['today', 'readings', 'members', 'tasks', 'requests', 'contacts'],
  activity: ['today', 'camera', 'log', 'members', 'calendar', 'tasks', 'requests', 'contacts'],
  kitchen: ['today', 'lunch', 'feedback', 'tasks', 'requests', 'contacts'],
  finance: ['today', 'payments', 'budget', 'receipts', 'spending', 'stock', 'guests', 'members', 'tasks', 'directory'],
  mgmt: ['today', 'members', 'reviews', 'tasks', 'report', 'monthReport', 'enquiries', 'renewals', 'hchecks', 'readings', 'log', 'camera', 'menu', 'lunch', 'feedback', 'stock', 'billing', 'payments', 'budget', 'receipts', 'spending', 'calendar', 'guests', 'insights', 'broadcast', 'venue', 'hr', 'directory', 'surveys', 'plans'],
};

describe('access grid', () => {
  it.each(GRID_ROLES)('%s: with no settings the menu is today\'s', (role) => {
    const s = fresh();
    delete s.club.settings.access;
    const want = role === 'lobby' ? [...TODAY.lobby, 'billing'] : TODAY[role];
    expect(menuKeys(s, role)).toEqual(want);
  });
  it('management reads receipts only; the owner edits everything', () => {
    const s = fresh();
    expect(accessOf(s, 'mgmt', 'receipts')).toBe('view');
    expect(accessOf(s, 'owner', 'anything')).toBe('edit');
    expect(menuKeys(s, 'owner')).toEqual([...TODAY.mgmt, 'roles']); // round 16: plus Admin › Roles, the Owner's alone
  });
  it('a granted menu is added; an off one is removed', () => {
    const s = fresh();
    s.club.settings.access = { nurse: { budget: 'edit' }, lobby: { renewals: 'off' } };
    expect(menuKeys(s, 'nurse')).toContain('budget');
    expect(menuKeys(s, 'lobby')).not.toContain('renewals');
  });
  it('owner approval defaults: on for management only', () => {
    const s = fresh();
    expect(ownerApprovalOn(s, 'mgmt', 'holidays')).toBe(true);
    expect(ownerApprovalOn(s, 'lobby', 'holidays')).toBe(false);
    expect(ownerApprovalOn(s, 'owner', 'holidays')).toBe(false);
    s.club.settings.ownerApproval = { mgmt: { holidays: false } };
    expect(ownerApprovalOn(s, 'mgmt', 'holidays')).toBe(false);
  });
});
