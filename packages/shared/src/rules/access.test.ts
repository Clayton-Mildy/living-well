import { describe, expect, it } from 'vitest';
import { buildSeed } from '../seed';
import { GRID_ROLES, MENU_KEYS, accessOf, draftChanges, isDefaultCell, menuKeys, ownerApprovalOn, roleDraft } from './access';

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

describe('role draft', () => {
  it('lists every menu key with its effective level and the three approval switches', () => {
    const s = fresh();
    delete s.club.settings.access;
    delete s.club.settings.ownerApproval;
    const d = roleDraft(s, 'lobby');
    expect(Object.keys(d.levels).sort()).toEqual([...MENU_KEYS].sort());
    expect(d.levels.billing).toBe('view');
    expect(d.levels.members).toBe('edit');
    expect(d.levels.payments).toBe('off');
    expect(d.approvals).toEqual({ pricing: false, holidays: false, budget: false });
    expect(roleDraft(s, 'mgmt').approvals).toEqual({ pricing: true, holidays: true, budget: true });
  });
  it('draftChanges counts the cells that differ from what is saved', () => {
    const s = fresh();
    const d = roleDraft(s, 'lobby');
    expect(draftChanges(s, 'lobby', d)).toBe(0);
    d.levels.billing = 'edit';
    expect(draftChanges(s, 'lobby', d)).toBe(1);
    d.approvals.pricing = true;
    d.levels.members = 'off';
    expect(draftChanges(s, 'lobby', d)).toBe(3);
  });
  it('isDefaultCell: the default level, and Off on a default-off key', () => {
    expect(isDefaultCell('lobby', 'billing', 'view')).toBe(true);
    expect(isDefaultCell('lobby', 'billing', 'edit')).toBe(false);
    expect(isDefaultCell('lobby', 'payments', 'off')).toBe(true);
    expect(isDefaultCell('lobby', 'members', 'edit')).toBe(true);
    expect(isDefaultCell('lobby', 'members', 'off')).toBe(false);
  });
});
