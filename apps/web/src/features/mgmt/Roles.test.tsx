// Admin › Roles: six role rows on a wide screen; on a phone a role picker, the menu list and the three owner-approval switches.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, MENU_KEYS } from '@cp/shared';
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
const combo = (name: string) => document.querySelector<HTMLElement>(`[role="combobox"][aria-label="${name}"]`)!;
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const option = (name: string) => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === name);

describe('Admin › Roles', () => {
  it('wide: menu items down, six role columns, no Owner column, three approval rows', async () => {
    openClub();
    await show(<Roles />, 1024);
    expect(Array.from(document.querySelectorAll('thead th[data-role]')).map((r) => r.getAttribute('data-role'))).toEqual(['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance']);
    expect(document.querySelectorAll('tbody tr[data-menu]')).toHaveLength(MENU_KEYS.length);
    expect(document.querySelectorAll('tbody tr[data-approval]')).toHaveLength(3);
    expect(document.querySelectorAll('tbody tr[data-approval] [role="switch"]')).toHaveLength(18);
    expect(document.body.textContent).not.toContain('Owner');
  });

  it('a never-set default-off cell shows "—"; choosing Hidden saves the role through access.setRole', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(document.querySelector('[role="combobox"][aria-labelledby]'));
    await click(option('Front desk'));
    expect(combo('Front desk: Payments').textContent).toContain('—');
    await click(combo('Front desk: Payments'));
    await click(option('Hidden'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', expect.objectContaining({ role: 'lobby', levels: expect.objectContaining({ payments: 'off', billing: 'view' }) }));
  });

  it('only the Owner reaches /roles', () => {
    openClub();
    const st = useReplica.getState().view!;
    expect(screenFor(st, 'owner', 'roles')).toBe('roles');
    for (const r of ['mgmt', 'lobby', 'nurse', 'activity', 'kitchen', 'finance'] as const) expect(screenFor(st, r, 'roles')).toBeNull();
  });

  it('phone: a role picker, the menu list with a level each, three switches; Front desk › Billing to Hidden calls access.setRole', async () => {
    openClub();
    await show(<Roles />, 390);
    expect(document.querySelectorAll('[role="switch"]')).toHaveLength(3);
    expect(document.body.textContent).toContain('Needs owner approval');
    // pick Front desk in the role dropdown
    await click(document.querySelector('[role="combobox"][aria-labelledby]'));
    await click(option('Front desk'));
    expect(combo('Front desk: Billing').textContent).toContain('View'); // the default
    await click(combo('Front desk: Billing'));
    await click(option('Hidden'));
    expect(actMock).toHaveBeenCalledWith('access.setRole', expect.objectContaining({ role: 'lobby', levels: expect.objectContaining({ billing: 'off', members: 'edit' }) }));
  });

  it('a switch calls access.setRole with the approval changed', async () => {
    openClub();
    await show(<Roles />, 390);
    await click(document.querySelector('[role="switch"]')); // Management starts on for Pricing
    expect(actMock).toHaveBeenCalledWith('access.setRole', expect.objectContaining({ role: 'mgmt', approvals: { pricing: false, holidays: true, budget: true } }));
  });
});
