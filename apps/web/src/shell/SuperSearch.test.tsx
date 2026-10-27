// Round 14 phase E, Task 4: the search overlay and its entry points (phone icon, sidebar field, Cmd/Ctrl-K).
// The overlay runs against the seed at the e2e date; the router's navigate is mocked, the action layer too.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { SuperSearch } from './SuperSearch';
import { AppShell } from './AppShell';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));
vi.mock('./demoAccounts', () => ({ useDemoLogin: () => true, useDemoAccounts: () => [] }));

const T = '2026-10-21';
const WHO: Record<string, { id: string; name: string }> = { lobby: { id: 's1', name: 'Caca' }, finance: { id: 's10', name: 'Fransiska' } };
const KEY = 'cp.search.recent';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {}; // jsdom has no element scrolling; the shell scrolls <main> to the top on a route change
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  localStorage.clear();
  navigate.mockClear();
  vi.restoreAllMocks();
});

function sign(role: 'lobby' | 'finance', width: number) {
  const { id, name } = WHO[role];
  const state = buildSeed().citra;
  (window as unknown as { innerWidth: number }).innerWidth = width;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id, name, role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
}
async function showSearch(role: 'lobby' | 'finance' = 'finance', open = true, width = 375) {
  sign(role, width);
  const onClose = vi.fn();
  const ui = (o: boolean) => <MemoryRouter><SuperSearch open={o} onClose={onClose} /></MemoryRouter>;
  await act(async () => { root!.render(ui(open)); });
  return { onClose, rerender: async (o: boolean) => { await act(async () => { root!.render(ui(o)); }); } };
}
async function showShell(role: 'lobby' | 'finance', width: number) {
  sign(role, width);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/today']}><Routes><Route element={<AppShell />}><Route path="*" element={<div>page</div>} /></Route></Routes></MemoryRouter>); });
}
const input = () => document.querySelector<HTMLInputElement>('input')!;
const type = async (v: string) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input(), v);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const key = async (k: string, init: KeyboardEventInit = {}, target: EventTarget = input()) => { await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); }); };
const text = () => document.body.textContent ?? '';
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="ss-row"]'));
const rowOf = (label: string) => rows().find((r) => r.textContent!.includes(label))!;
const textOf = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const btn = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => textOf(b) === label || b.getAttribute('aria-label') === label);

describe('SuperSearch overlay', () => {
  it('opens with the input focused, and renders nothing while closed', async () => {
    const { rerender } = await showSearch('finance', false);
    expect(document.querySelector('input')).toBeNull();
    await rerender(true);
    expect(document.activeElement).toBe(input());
  });

  it('finance types tagihan: Screens group with Billing; tapping it stores the query, closes and navigates', async () => {
    const { onClose } = await showSearch('finance');
    await type('tagihan');
    expect(text()).toContain('Screens');
    const row = rowOf('Billing');
    expect(row).toBeTruthy();
    expect(row.tagName).toBe('BUTTON');
    await click(row);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['tagihan']);
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/today'); // finance reaches Billing through its Today key (R-P1)
  });

  it('lobby types tagihan: no Billing', async () => {
    await showSearch('lobby');
    await type('tagihan');
    expect(rows().some((r) => r.textContent!.includes('Billing'))).toBe(false);
  });

  it('re-open shows Recent searches; tapping one fills the input; Clear empties the list', async () => {
    localStorage.setItem(KEY, JSON.stringify(['tagihan']));
    await showSearch('finance');
    expect(text()).toContain('Recent searches');
    await click(btn('tagihan'));
    expect(input().value).toBe('tagihan');
    expect(rowOf('Billing')).toBeTruthy();
    await type('');
    await click(btn('Clear'));
    expect(text()).not.toContain('Recent searches');
    expect(text()).toContain('Type a name, an invoice number or a screen');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('recents: newest first, no duplicates, at most 8', async () => {
    localStorage.setItem(KEY, JSON.stringify(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']));
    await showSearch('finance');
    await type('billing');
    await click(rowOf('Billing'));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['billing', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
  });

  it('with localStorage throwing, typing and opening a result still work and no recents show', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { onClose } = await showSearch('finance');
    expect(text()).not.toContain('Recent searches');
    await type('tagihan');
    await click(rowOf('Billing'));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/today');
  });

  it('Esc closes', async () => {
    const { onClose } = await showSearch('finance');
    await key('Escape');
    expect(onClose).toHaveBeenCalled();
  });

  it('the Close button closes', async () => {
    const { onClose } = await showSearch('finance');
    await click(btn('Close search'));
    expect(onClose).toHaveBeenCalled();
  });

  it('%%% finds nothing and says so', async () => {
    await showSearch('finance');
    await type('%%%');
    expect(text()).toContain('Nothing found for "%%%"');
    expect(rows().length).toBe(0);
  });

  it('groups show at most 6 rows each; every row is a 48 px button', async () => {
    await showSearch('lobby');
    await type('a');
    expect(rows().length).toBeGreaterThan(0);
    for (const g of document.querySelectorAll('[data-testid="ss-group"]')) expect(g.querySelectorAll('[data-testid="ss-row"]').length).toBeLessThanOrEqual(6);
    expect(rows().every((r) => r.tagName === 'BUTTON' && r.style.minHeight === '48px')).toBe(true);
  });

  it('laptop: arrows move the highlight and Enter opens the highlighted row', async () => {
    const { onClose } = await showSearch('finance', true, 1440);
    await type('billing');
    const first = rows()[0];
    expect(first.getAttribute('aria-selected')).toBe('true');
    await key('ArrowDown');
    const hl = rows().filter((r) => r.getAttribute('aria-selected') === 'true');
    expect(hl.length).toBe(1);
    if (rows().length > 1) expect(hl[0]).toBe(rows()[1]);
    await key('ArrowUp');
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await key('Enter');
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('search entry points in the shell', () => {
  it('phone: the search icon in the logo header opens the overlay', async () => {
    await showShell('finance', 375);
    expect(document.querySelector('input')).toBeNull();
    await click(btn('Search'));
    expect(document.activeElement).toBe(input());
    await click(btn('Close search'));
    expect(document.querySelector('input')).toBeNull();
  });

  it('laptop: the sidebar field opens it; Cmd-K toggles it; Ctrl-K too', async () => {
    await showShell('finance', 1440);
    const side = document.querySelector('[data-testid="staff-sidebar"]')!;
    const field = side.querySelector<HTMLElement>('[data-testid="side-search"]')!;
    expect(field.textContent).toContain('Search screens, people, invoices…');
    expect(field.textContent).toMatch(/⌘K|Ctrl K/);
    await click(field);
    expect(document.activeElement).toBe(input());
    await key('Escape');
    expect(document.querySelector('input')).toBeNull();
    await key('k', { metaKey: true }, window);
    expect(document.querySelector('input')).not.toBeNull();
    await key('k', { metaKey: true }, window);
    expect(document.querySelector('input')).toBeNull();
    await key('k', { ctrlKey: true }, window);
    expect(document.querySelector('input')).not.toBeNull();
  });

  it('Cmd-K calls preventDefault', async () => {
    await showShell('lobby', 1440);
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true });
    await act(async () => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
  });
});
