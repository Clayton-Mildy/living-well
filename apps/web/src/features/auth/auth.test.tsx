// Session token handling (api wrapper + session store) and the password field's show/hide.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiToken, ApiError } from '../../lib/api';
import { useSession, type PublicUser } from '../../store/session';
import { PasswordField } from './PasswordField';

const user: PublicUser = { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const sentHeaders = () => (fetchMock.mock.calls.at(-1)![1] as { headers: Record<string, string> }).headers;

beforeEach(() => {
  useSession.getState().signOut();
  fetchMock = vi.fn(async () => reply(200, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('session token', () => {
  it('signing in keeps the token (and the user) for reloads, and every request carries it as a bearer header', async () => {
    useSession.getState().signIn(user, 'body.sig');
    expect(apiToken()).toBe('body.sig');
    expect(JSON.parse(localStorage.getItem('cp.session')!)).toMatchObject({ user: { id: 's1' }, token: 'body.sig' });
    await api('/api/snapshot');
    expect(sentHeaders().authorization).toBe('Bearer body.sig');
    expect(sentHeaders()['x-user-id']).toBeUndefined();
  });
  it('signing out drops the token everywhere', async () => {
    useSession.getState().signIn(user, 'body.sig');
    useSession.getState().signOut();
    expect(apiToken()).toBeNull();
    expect(useSession.getState().token).toBeNull();
    expect(JSON.parse(localStorage.getItem('cp.session')!).token).toBeNull();
    await api('/api/clock');
    expect(sentHeaders().authorization).toBeUndefined();
  });
  it('a 401 on an ordinary call (expired or forged token) signs the user out', async () => {
    useSession.getState().signIn(user, 'old.token');
    fetchMock.mockResolvedValueOnce(reply(401, { code: 'err.forbidden' }));
    await expect(api('/api/snapshot')).rejects.toBeInstanceOf(ApiError);
    expect(useSession.getState().user).toBeNull();
    expect(apiToken()).toBeNull();
  });
  it('a wrong password (401 from /api/login) or a no-access demo account (401 from /api/verify) does not sign out the current user', async () => {
    useSession.getState().signIn(user, 'good.token');
    fetchMock.mockResolvedValueOnce(reply(401, { ok: false, code: 'login.errInvalid' }));
    await expect(api('/api/login', { body: { username: 'x', password: 'y' } })).rejects.toMatchObject({ status: 401, code: 'login.errInvalid' });
    fetchMock.mockResolvedValueOnce(reply(401, { ok: false, reason: 'noAccess' }));
    await expect(api('/api/verify', { body: { userId: 's4', code: '000000' } })).rejects.toBeInstanceOf(ApiError);
    expect(useSession.getState().user?.id).toBe('s1');
    expect(apiToken()).toBe('good.token');
  });
  it('a 422 (e.g. a wrong current password) is an ordinary error and keeps the session', async () => {
    useSession.getState().signIn(user, 'good.token');
    fetchMock.mockResolvedValueOnce(reply(422, { code: 'login.errCurrent' }));
    await expect(api('/api/account/password', { body: { current: 'a', next: 'b' } })).rejects.toMatchObject({ status: 422, code: 'login.errCurrent' });
    expect(useSession.getState().user?.id).toBe('s1');
  });
});

describe('PasswordField', () => {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });
  const mount = async (el: React.ReactElement) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(el); });
  };

  it('hides the password until you ask to show it, and the label belongs to the input, not the toggle', async () => {
    useSession.setState({ lang: 'en' });
    await mount(<PasswordField label="Password" value="citra123" onChange={() => {}} autoComplete="current-password" />);
    const input = host!.querySelector('input')!;
    const toggle = host!.querySelector('button')!;
    expect(input.type).toBe('password');
    expect(input.autocomplete).toBe('current-password');
    expect(host!.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Password');
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
    await act(async () => { toggle.click(); });
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    await act(async () => { toggle.click(); });
    expect(input.type).toBe('password');
  });
  it('shows an error as an alert and marks the input invalid', async () => {
    await mount(<PasswordField label="Password" value="" onChange={() => {}} autoComplete="new-password" error="Use at least 8 characters." />);
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Use at least 8 characters.');
    expect(host!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });
});
