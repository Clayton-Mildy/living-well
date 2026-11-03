// Admin › Roles (round 17): a role list, then the role's page with View and Edit checkboxes per menu, grouped like the sidebar, saved as one draft.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
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
const roleRow = (r: string) => document.querySelector<HTMLElement>(`[data-role="${r}"]`);

describe('Admin › Roles', () => {
  it('phone: Owner (full access, not a link) and six roles with their people and menu count; a role opens its page grouped like the sidebar', async () => {
    openClub();
    await show(<Roles />, 390);
    const rows = Array.from(document.querySelectorAll('[data-role]')).map((r) => r.getAttribute('data-role'));
    expect(rows).toEqual(['owner', 'mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance']);
    expect(roleRow('owner')!.textContent).toContain('Full access');
    expect(roleRow('owner')!.tagName).not.toBe('BUTTON');
    expect(roleRow('lobby')!.tagName).toBe('BUTTON');
    expect(roleRow('lobby')!.textContent).toContain('Front desk');
    expect(roleRow('lobby')!.textContent).toContain('Caca');
    expect(roleRow('lobby')!.textContent).toContain('10 menus');
    await click(roleRow('lobby'));
    const page = document.querySelector('[data-role-page="lobby"]')!;
    expect(page).toBeTruthy();
    expect(Array.from(page.querySelectorAll('[data-group]')).map((g) => g.getAttribute('data-group'))).toEqual(['General', 'Front desk', 'Care', 'Kitchen', 'Finance', 'Club']);
  });

  it('Edit ticks View, unticking View unticks Edit; the bar counts the change and Save sends the whole role', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    expect(ticked('Billing: View')).toBe('true');
    expect(ticked('Billing: Edit')).toBe('false');
    await click(box('Billing: View'));
    expect(ticked('Billing: View')).toBe('false');
    expect(ticked('Billing: Edit')).toBe('false');
    await click(box('Billing: Edit'));
    expect(ticked('Billing: View')).toBe('true');
    expect(ticked('Billing: Edit')).toBe('true');
    expect(document.body.textContent).toContain('1 change');
    await click(button('Save'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', { role: 'lobby', levels: expect.objectContaining({ billing: 'edit', members: 'edit', payments: 'off' }), approvals: { pricing: false, holidays: false, budget: false } });
  });

  it('a group tick-all is mixed when some rows are ticked', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(roleRow('lobby'));
    expect(ticked('Finance: View')).toBe('mixed'); // Billing only
    expect(ticked('Finance: Edit')).toBe('false');
    expect(ticked('Front desk: Edit')).toBe('true');
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
    await click(button('Save'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', { role: 'lobby', levels: expect.objectContaining({ billing: 'view', payments: 'off', members: 'edit' }), approvals: { pricing: false, holidays: false, budget: false } });
  });

  it('only the Owner reaches /roles', () => {
    openClub();
    const st = useReplica.getState().view!;
    expect(screenFor(st, 'owner', 'roles')).toBe('roles');
    for (const r of ['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance'] as const) expect(screenFor(st, r, 'roles')).toBeNull();
  });
});
