// Admin › Roles (round 17): a role list, then the role's page with View and Edit checkboxes per menu, grouped like the sidebar, saved as one draft.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { screenFor } from '../../app/nav';
import { Roles } from './Roles';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
const actMock = vi.fn();
function openClub() {
  const state = structuredClone(buildSeed().citra);
  const user = { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  actMock.mockResolvedValue({ ok: true, result: {} });
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', act: actMock, clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } } as never);
}
async function show(ui: ReactElement, width: number) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/roles']}>{ui}</MemoryRouter>); });
}
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const box = (label: string) => document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${label}"]`)!;
const ticked = (label: string) => box(label)?.getAttribute('aria-checked');
const button = (text: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.trim() === text);
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

  it('only the Owner reaches /roles', () => {
    openClub();
    const st = useReplica.getState().view!;
    expect(screenFor(st, 'owner', 'roles')).toBe('roles');
    for (const r of ['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance'] as const) expect(screenFor(st, r, 'roles')).toBeNull();
  });
});
