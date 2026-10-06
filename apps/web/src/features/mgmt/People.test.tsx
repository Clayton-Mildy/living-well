// People: the read-only username and the Reset password button (management), which calls POST /api/account/reset-password { userId }.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { useUi } from '../../store/ui';

const apiMock = vi.fn();
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<typeof import('../../lib/api')>()), api: (...a: unknown[]) => apiMock(...a) }));
const { People } = await import('./People');
const { ApiError } = await import('../../lib/api');

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { apiMock.mockReset(); useUi.setState({ toast: null }); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
function openClub(lang: 'en' | 'id' = 'en') {
  const state = buildSeed().citra;
  state.staff.s1.username = 'caca'; // the server sets usernames
  delete state.staff.s4.username; // Siti has no account yet
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement, path: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (label: string, within: ParentNode = document) => Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => textOf(b) === label);
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe('username and reset password', () => {
  it('shows the username as text, never as an input', async () => {
    openClub();
    await show(<People />, '/hr?staff=s1');
    expect(document.body.textContent).toContain('Username');
    expect(document.body.textContent).toContain('caca');
    expect(Array.from(document.querySelectorAll('input')).some((i) => i.getAttribute('aria-label') === 'Username' || i.value === 'caca')).toBe(false);
  });
  it('a person without app access has no username and nothing to reset', async () => {
    openClub();
    await show(<People />, '/hr?staff=s4'); // Siti: no app access
    expect(document.body.textContent).toContain('Created when app access is on');
    expect(button('Reset password')).toBeUndefined();
  });
  it('Reset password asks first, then calls the account route with the user id and tells management the default', async () => {
    openClub();
    apiMock.mockResolvedValue({ ok: true, username: 'caca', defaultPassword: 'citra123' });
    await show(<People />, '/hr?staff=s1');
    await click(button('Reset password'));
    expect(apiMock).not.toHaveBeenCalled(); // a confirmation first
    const dlg = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dlg.textContent).toContain('Reset the password of Caca?');
    await click(button('Reset password', dlg));
    expect(apiMock).toHaveBeenCalledWith('/api/account/reset-password', { body: { userId: 's1' } });
    expect(useUi.getState().toast?.text).toBe('The password of Caca is back to the default: citra123');
  });
  it('a refused reset shows the server’s reason and keeps the dialog open', async () => {
    openClub();
    apiMock.mockRejectedValue(new ApiError(404, 'err.notFound'));
    await show(<People />, '/hr?staff=s1');
    await click(button('Reset password'));
    await click(button('Reset password', document.querySelector<HTMLElement>('[role="dialog"]')!));
    expect(useUi.getState().toast).toMatchObject({ tone: 'error' });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });
  it('Indonesian: translated', async () => {
    openClub('id');
    await show(<People />, '/hr?staff=s1');
    expect(document.body.textContent).toContain('Nama pengguna');
    expect(button('Atur ulang kata sandi')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\bpeople\.[A-Za-z]/);
  });
});
