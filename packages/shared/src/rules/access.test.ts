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
  finance: ['today', 'payments', 'budget', 'receipts', 'spending', 'stock', 'guests', 'members', 'tasks', 'contacts'],
  mgmt: ['today', 'members', 'reviews', 'tasks', 'report', 'monthReport', 'enquiries', 'renewals', 'hchecks', 'readings', 'log', 'camera', 'menu', 'lunch', 'feedback', 'stock', 'billing', 'payments', 'budget', 'receipts', 'spending', 'calendar', 'guests', 'insights', 'broadcast', 'venue', 'hr', 'contacts', 'surveys', 'plans', 'settings'], // round 17: Admin › Settings
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

describe('one Contacts menu (round 19)', () => {
  const withCells = (cells: Record<string, Record<string, 'off' | 'view' | 'edit'>>) => { const s = fresh(); s.club.settings.access = cells; return s; };
  it('Directory is gone from the grid: 31 menus, Contacts in its place', () => {
    expect(MENU_KEYS).not.toContain('directory');
    expect(MENU_KEYS).toContain('contacts');
    expect(MENU_KEYS).toHaveLength(31);
  });
  it('Finance and Management edit Contacts with no stored cells (they had Directory on Edit)', () => {
    const s = fresh();
    delete s.club.settings.access;
    expect(accessOf(s, 'finance', 'contacts')).toBe('edit');
    expect(accessOf(s, 'mgmt', 'contacts')).toBe('edit');
    expect(accessOf(s, 'finance', 'directory')).toBe('off');
  });
  it('a stored directory cell with no contacts cell is read as Contacts', () => {
    expect(accessOf(withCells({ finance: { directory: 'edit' } }), 'finance', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ nurse: { directory: 'edit' } }), 'nurse', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ lobby: { directory: 'edit' } }), 'lobby', 'contacts')).toBe('edit');
  });
  it('a lone directory cell never narrows the Contacts default (lobby, nurse, finance)', () => {
    expect(accessOf(withCells({ lobby: { directory: 'view' } }), 'lobby', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ nurse: { directory: 'view' } }), 'nurse', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ finance: { directory: 'off' } }), 'finance', 'contacts')).toBe('edit');
  });
  it('a stored contacts cell with no directory cell stands as it is', () => {
    expect(accessOf(withCells({ lobby: { contacts: 'view' } }), 'lobby', 'contacts')).toBe('view');
  });
  it('with both stored, the more permissive one wins (edit > view > off)', () => {
    expect(accessOf(withCells({ lobby: { contacts: 'view', directory: 'edit' } }), 'lobby', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ lobby: { contacts: 'edit', directory: 'off' } }), 'lobby', 'contacts')).toBe('edit');
    expect(accessOf(withCells({ lobby: { contacts: 'off', directory: 'view' } }), 'lobby', 'contacts')).toBe('view');
    expect(accessOf(withCells({ lobby: { contacts: 'off', directory: 'off' } }), 'lobby', 'contacts')).toBe('off');
  });
  it('menuKeys: Contacts off hides the single item; a lone Directory off does not', () => {
    expect(menuKeys(withCells({ finance: { contacts: 'off' } }), 'finance')).not.toContain('contacts');
    expect(menuKeys(withCells({ finance: { directory: 'off' } }), 'finance')).toContain('contacts');
    expect(menuKeys(fresh(), 'finance').filter((k) => k === 'contacts')).toHaveLength(1);
  });
  it('the draft and its change count read the merged cell', () => {
    const s = withCells({ lobby: { contacts: 'view', directory: 'edit' } });
    const d = roleDraft(s, 'lobby');
    expect(d.levels.contacts).toBe('edit');
    expect(d.levels).not.toHaveProperty('directory');
    expect(draftChanges(s, 'lobby', d)).toBe(0);
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
