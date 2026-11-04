// Admin › Roles (round 17; round 18: Tasks-style list and sections, folded hidden groups, two columns on wide screens): a role list, then the role's page
// with View and Edit checkboxes per menu, grouped like the sidebar, saved as one draft.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { MENU_KEYS, buildSeed, roleDraft } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { screenFor } from '../../app/nav';
import { AppShell } from '../../shell/AppShell';
import { Roles } from './Roles';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollTo ??= () => {}; // the shell scrolls #main to the top on a route change
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth; // back to jsdom's own (0)
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
const actMock = vi.fn();
function openClub(edit?: (st: ReturnType<typeof buildSeed>['citra']) => void) {
  const state = structuredClone(buildSeed().citra);
  edit?.(state);
  const user = { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  actMock.mockResolvedValue({ ok: true, result: {} });
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', act: actMock, clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } } as never);
}
// a data router, as the app has (createBrowserRouter): leaving the page with a draft goes through useBlocker
let router: ReturnType<typeof createMemoryRouter>;
async function show(ui: ReactElement, width: number, shell = false) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const pages = [{ path: '/roles', element: ui }, { path: '*', element: <div data-testid="elsewhere" /> }];
  router = createMemoryRouter(shell ? [{ element: <AppShell />, children: pages }] : pages, { initialEntries: ['/today', '/roles'], initialIndex: 1 });
  await act(async () => { root!.render(<RouterProvider router={router} />); });
}
const path = () => router.state.location.pathname;
/** A button in the top dialog (on a phone the role page is a dialog too). */
const inDialog = (text: string) => Array.from(Array.from(document.querySelectorAll('[role="dialog"]')).pop()?.querySelectorAll<HTMLElement>('button') ?? []).find((b) => words(b) === text);
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const box = (label: string) => document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${label}"]`)!;
const ticked = (label: string) => box(label)?.getAttribute('aria-checked');
/** A button's words without its icon's ligature name. */
const words = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (text: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => words(b) === text);
const roleRow = (r: string) => document.querySelector<HTMLElement>(`[data-role-row="${r}"]`);
const group = (g: string) => document.querySelector<HTMLElement>(`[data-group="${g}"]`);
const inGroup = (g: string, text: string) => Array.from(group(g)?.querySelectorAll<HTMLElement>('button') ?? []).find((b) => words(b) === text);
/** The role panel's width, as useAtLeast reads it (clientWidth). */
const panelWidth = (w: number) => Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => w });

describe('Admin › Roles', () => {
  it('phone: Owner (full access, not a link) and six roles with their people and menu count; a role opens its page grouped like the sidebar', async () => {
    openClub();
    await show(<Roles />, 390);
    const rows = Array.from(document.querySelectorAll('[data-role-row]')).map((r) => r.getAttribute('data-role-row'));
    expect(rows).toEqual(['owner', 'mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance']);
    expect(roleRow('owner')!.textContent).toContain('full access');
    expect(roleRow('owner')!.tagName).not.toBe('BUTTON');
    expect(roleRow('lobby')!.tagName).toBe('BUTTON');
    expect(roleRow('lobby')!.textContent).toContain('Front desk');
    expect(roleRow('lobby')!.textContent).toContain('Caca');
    const d = roleDraft(useReplica.getState().view!, 'lobby');
    const seen = MENU_KEYS.filter((k) => d.levels[k] !== 'off').length;
    expect(roleRow('lobby')!.textContent).toContain(`${seen} of ${MENU_KEYS.length}`);
    await click(roleRow('lobby'));
    const page = document.querySelector('[data-role-page="lobby"]')!;
    expect(page).toBeTruthy();
    expect(Array.from(page.querySelectorAll('[data-group]')).map((g) => g.getAttribute('data-group'))).toEqual(['General', 'Front desk', 'Care', 'Kitchen', 'Finance', 'Club']);
    expect(page.querySelector('[data-role-head]')!.textContent).toContain(`${seen} of ${MENU_KEYS.length}`);
  });

  it('round 19: one Contacts row (no Directory), 31 menus, Finance on Edit; a Directory cell saved before the merge shows as the Contacts level', async () => {
    openClub((st) => { st.club.settings.access = { lobby: { contacts: 'view', directory: 'edit' } }; });
    panelWidth(700);
    await show(<Roles />, 1024);
    expect(MENU_KEYS).toHaveLength(31);
    await click(roleRow('finance'));
    const page = document.querySelector('[data-role-page="finance"]')!;
    expect(page.querySelector('[data-role-head]')!.textContent).toContain('of 31');
    const rows = Array.from(page.querySelectorAll('[data-menu]'));
    expect(rows.filter((r) => /Contacts/.test(r.textContent ?? ''))).toHaveLength(1);
    expect(rows.some((r) => /Directory/.test(r.textContent ?? ''))).toBe(false);
    expect(ticked('Contacts: View')).toBe('true');
    expect(ticked('Contacts: Edit')).toBe('true');
    await click(roleRow('lobby'));
    expect(ticked('Contacts: Edit')).toBe('true'); // View stored for contacts, Edit for the old directory cell: the more permissive wins
  });

  it('Edit ticks View, unticking View unticks Edit; the bar counts the change and Save sends the whole role', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    expect(ticked('Billing: View')).toBe('true');
    expect(ticked('Billing: Edit')).toBe('false');
    await click(box('Billing: View'));
    expect(ticked('Billing: View')).toBe('false');
    expect(ticked('Billing: Edit')).toBe('false'); // Finance now has nothing ticked but stays open while it is being edited
    await click(box('Billing: Edit'));
    expect(ticked('Billing: View')).toBe('true');
    expect(ticked('Billing: Edit')).toBe('true');
    expect(document.body.textContent).toContain('1 change');
    await click(button('Save · 1 change'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', { role: 'lobby', levels: expect.objectContaining({ billing: 'edit', members: 'edit', payments: 'off' }), approvals: { pricing: false, holidays: false, budget: false } });
  });

  it('tasks-view-edit: Tasks is a plain row, View by default for Front desk with no sub-row; ticking Edit is one change and Save sends it', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    expect(document.querySelector('[data-task-create]')).toBeNull();
    expect(document.body.textContent).not.toContain('Create tasks for');
    expect(document.querySelector('[data-menu="tasks"]')?.textContent).toContain('view only');
    expect(ticked('Tasks: View')).toBe('true');
    expect(ticked('Tasks: Edit')).toBe('false');
    await click(box('Tasks: Edit'));
    expect(ticked('Tasks: Edit')).toBe('true');
    expect(document.querySelector('[data-task-create]')).toBeNull();
    await click(button('Save · 1 change'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', { role: 'lobby', levels: expect.objectContaining({ tasks: 'edit' }), approvals: { pricing: false, holidays: false, budget: false } });
  });

  it('tasks-view-edit: Management keeps Tasks on Edit, with no sub-row', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('mgmt'));
    expect(ticked('Tasks: Edit')).toBe('true');
    expect(document.querySelector('[data-task-create]')).toBeNull();
  });

  it('Save counts the draft: "Save · 2 changes" after two ticks; Discard drops the draft', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    await click(box('Billing: Edit'));
    await click(box('Payments: View'));
    expect(button('Save · 2 changes')).toBeTruthy();
    await click(button('Discard'));
    expect(button('Save · 2 changes')).toBeUndefined();
    expect(ticked('Billing: Edit')).toBe('false');
  });

  it('a group with nothing ticked folds to "Care · hidden" with its menus; tapping it opens its four rows', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    const care = group('Care')!;
    expect(care.textContent).toContain('Care · hidden');
    expect(care.textContent).toContain('Health checks');
    expect(care.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
    await click(care.querySelector('button'));
    expect(group('Care')!.querySelectorAll('[data-menu]')).toHaveLength(4);
    expect(group('Care')!.textContent).not.toContain('hidden');
    expect(ticked('Readings: View')).toBe('false');
  });

  it('a group header counts what the role sees and All ticks every View and Edit in it; then it reads None', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    const d = roleDraft(useReplica.getState().view!, 'lobby');
    const keys = Array.from(group('General')!.querySelectorAll('[data-menu]')).map((m) => m.getAttribute('data-menu')!);
    const seen = keys.filter((k) => d.levels[k] !== 'off').length;
    expect(group('General')!.textContent).toContain(`${seen} of ${keys.length}`);
    expect(inGroup('General', 'None')).toBeUndefined();
    await click(inGroup('General', 'All'));
    for (const m of Array.from(group('General')!.querySelectorAll('[data-menu]'))) {
      expect(m.querySelectorAll('[role="checkbox"][aria-checked="true"]')).toHaveLength(2);
    }
    const n = keys.filter((k) => d.levels[k] !== 'edit').length;
    expect(n).toBeGreaterThan(0);
    expect(button(n === 1 ? 'Save · 1 change' : `Save · ${n} changes`)).toBeTruthy();
    expect(group('General')!.textContent).toContain(`${keys.length} of ${keys.length}`);
    expect(inGroup('General', 'None')).toBeTruthy();
  });

  it('a menu with View and no Edit reads "view only"', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    const report = () => document.querySelector('[data-menu="report"]')!;
    expect(report().textContent).not.toContain('view only');
    await click(box('Daily report: View'));
    expect(report().textContent).toContain('Daily report · view only');
    await click(box('Daily report: Edit'));
    expect(report().textContent).not.toContain('view only');
  });

  it('the sections sit in two columns when the role panel is 900px or wider, each with its View / Edit header', async () => {
    openClub();
    panelWidth(1200);
    await show(<Roles />, 1440);
    const cols = document.querySelector('[data-columns]')!;
    expect(cols.getAttribute('data-columns')).toBe('2');
    const columns = Array.from(cols.querySelectorAll('[data-column]'));
    expect(columns).toHaveLength(2);
    for (const c of columns) expect(c.querySelector('[data-col-head]')?.textContent).toBe('ViewEdit');
    // balanced by rows, sidebar order kept
    const order = columns.flatMap((c) => Array.from(c.querySelectorAll('[data-group]')).map((g) => g.getAttribute('data-group')));
    expect(order).toEqual(['General', 'Front desk', 'Care', 'Kitchen', 'Finance', 'Club']);
    // the owner-approval section is outside the columns
    expect(cols.querySelector('[data-approval]')).toBeNull();
    expect(document.querySelector('[data-approval="pricing"]')).toBeTruthy();
  });

  it('one column under 900px', async () => {
    openClub();
    panelWidth(700);
    await show(<Roles />, 1024);
    expect(document.querySelector('[data-columns]')!.getAttribute('data-columns')).toBe('1');
    expect(document.querySelectorAll('[data-column]')).toHaveLength(1);
  });

  it('going back with a dirty draft asks first', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    await click(box('Billing: Edit'));
    await click(document.querySelector('button[aria-label="Roles"]'));
    expect(document.body.textContent).toContain('Discard 1 change?');
    expect(document.querySelector('[data-role-page="lobby"]')).toBeTruthy();
    expect(actMock).not.toHaveBeenCalled();
  });

  it('wide: the list and the role page side by side', async () => {
    openClub();
    await show(<Roles />, 1024);
    expect(roleRow('lobby')).toBeTruthy();
    expect(document.querySelector('[data-role-page="mgmt"]')).toBeTruthy();
    await click(roleRow('lobby'));
    expect(document.querySelector('[data-role-page="lobby"]')).toBeTruthy();
    expect(roleRow('finance')).toBeTruthy();
  });

  it('final review I-3: side by side (874px or wider) the list is sticky; stacked (tablet portrait) it is not, and a pick scrolls the card into view', async () => {
    const scrolled = vi.fn();
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrolled;
    openClub();
    panelWidth(1000);
    await show(<Roles />, 1024);
    expect(document.querySelector('[data-roles-layout]')!.getAttribute('data-roles-layout')).toBe('side');
    expect(document.querySelector<HTMLElement>('[data-testid="roles-list"]')!.style.position).toBe('sticky');
    await click(roleRow('lobby'));
    expect(scrolled).not.toHaveBeenCalled();
    await act(async () => { root?.unmount(); });
    document.body.innerHTML = '';
    openClub();
    panelWidth(712); // 768 minus the tablet sidebar is narrower still; anything under 874 stacks
    await show(<Roles />, 768);
    expect(document.querySelector('[data-roles-layout]')!.getAttribute('data-roles-layout')).toBe('stacked');
    expect(document.querySelector<HTMLElement>('[data-testid="roles-list"]')!.style.position).toBe('');
    await click(roleRow('finance'));
    expect(document.querySelector('[data-role-page="finance"]')).toBeTruthy();
    expect(scrolled).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('with a draft, a sidebar link asks first and only Discard leaves', async () => {
    openClub();
    await show(<Roles />, 1024, true);
    await click(roleRow('lobby'));
    await click(box('Billing: Edit'));
    await click(document.querySelector('[data-nav-key="today"]'));
    expect(document.body.textContent).toContain('Discard 1 change?');
    expect(path()).toBe('/roles');
    await click(inDialog('Discard'));
    expect(path()).toBe('/today');
    expect(actMock).not.toHaveBeenCalled();
  });

  it('with a draft, the back gesture asks first; Cancel stays', async () => {
    openClub();
    await show(<Roles />, 1024);
    await click(box('Billing: View'));
    expect(document.body.textContent).toContain('1 change');
    await act(async () => { await router.navigate(-1); });
    expect(document.body.textContent).toContain('Discard 1 change?');
    expect(path()).toBe('/roles');
    await click(inDialog('Cancel'));
    expect(path()).toBe('/roles');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain('1 change');
  });

  it('without a draft, leaving does not ask', async () => {
    openClub();
    await show(<Roles />, 1024);
    await act(async () => { await router.navigate(-1); });
    expect(path()).toBe('/today');
  });

  it('Reset to default asks first, then the draft is the defaults and Save sends them', async () => {
    openClub((st) => {
      st.club.settings.access = { lobby: { billing: 'edit', payments: 'view' } };
      st.club.settings.ownerApproval = { lobby: { pricing: true } };
    });
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    expect(ticked('Billing: Edit')).toBe('true');
    await click(button('Reset to default'));
    expect(document.body.textContent).toContain('Reset Front desk to default?');
    expect(ticked('Billing: Edit')).toBe('true'); // nothing yet
    await click(inDialog('Reset to default'));
    expect(ticked('Billing: View')).toBe('true');
    expect(ticked('Billing: Edit')).toBe('false');
    expect(ticked('Payments: View')).toBe('false');
    expect(ticked('Prices and plans')).toBe('false');
    expect(document.body.textContent).toContain('3 changes');
    await click(button('Save · 3 changes'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', { role: 'lobby', levels: expect.objectContaining({ billing: 'view', payments: 'off', members: 'edit' }), approvals: { pricing: false, holidays: false, budget: false } });
  });

  it('only the Owner reaches /roles', () => {
    openClub();
    const st = useReplica.getState().view!;
    expect(screenFor(st, 'owner', 'roles')).toBe('roles');
    for (const r of ['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance'] as const) expect(screenFor(st, r, 'roles')).toBeNull();
  });
});
