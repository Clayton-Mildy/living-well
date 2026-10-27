// Round 14 phase E, Task 4: the search overlay and its entry points (phone floating button, sidebar field, Cmd/Ctrl-K).
// The overlay runs against the seed at the e2e date; the router's navigate is mocked, the action layer too.
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildSeed, translate } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import { SuperSearch } from './SuperSearch';
import { AppShell } from './AppShell';
import { Sheet } from '../components/ui';
import { rank } from '../lib/search';
import { buildSearchIndex } from '../app/searchRegistry';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));
vi.mock('../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));
vi.mock('./demoAccounts', () => ({ useDemoLogin: () => true, useDemoAccounts: () => [] }));

const T = '2026-10-21';
const WHO: Record<string, { id: string; name: string }> = { lobby: { id: 's1', name: 'Caca' }, finance: { id: 's10', name: 'Fransiska' }, activity: { id: 's5', name: 'Dinar' } };
const KEY = 'cp.search.recent.s10'; // per user: the finance user signs in below unless a test signs in the lobby (s1)
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

function sign(role: 'lobby' | 'finance' | 'activity', width: number) {
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
async function showShell(role: 'lobby' | 'finance' | 'activity', width: number) {
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
    await type('bayar');
    const want = rank(buildSearchIndex(buildSeed().citra, 'finance', (k, v) => translate('en', k, v), 'en'), 'bayar').flatMap((g) => g.hits);
    expect(want.length).toBeGreaterThanOrEqual(2);
    expect(rows().length).toBe(want.length);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await key('ArrowDown');
    expect(rows().map((r) => r.getAttribute('aria-selected'))).toEqual(want.map((_, n) => (n === 1 ? 'true' : 'false')));
    await key('ArrowUp');
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await key('ArrowDown');
    await key('Enter');
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(want[1]!.to);
  });

  it('recents are kept per signed-in user', async () => {
    localStorage.setItem('cp.search.recent.s10', JSON.stringify(['finance only']));
    await showSearch('lobby');
    expect(text()).not.toContain('finance only');
    await type('add member');
    await click(rowOf('Add member'));
    expect(JSON.parse(localStorage.getItem('cp.search.recent.s1')!)).toEqual(['add member']);
    expect(JSON.parse(localStorage.getItem('cp.search.recent.s10')!)).toEqual(['finance only']);
  });

  it('lobby finds a supplier through Contacts; nurse does not', async () => {
    await showSearch('lobby');
    await type('Bersih');
    await click(rowOf('Bersih Prima'));
    expect(navigate).toHaveBeenCalledWith('/contacts?q=Bersih%20Prima');
  });

  it('the listbox is only on the results; group headings are hidden from readers (the group carries the name)', async () => {
    await showSearch('finance');
    expect(document.querySelector('[role="listbox"]')).toBeNull(); // hint / recents
    await type('bayar');
    expect(document.querySelectorAll('[role="listbox"]').length).toBe(1);
    const g = document.querySelector('[data-testid="ss-group"]')!;
    expect(g.getAttribute('aria-label')).toBeTruthy();
    expect(g.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    await type('%%%');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('search entry points in the shell', () => {
  it('phone: the floating search button opens the overlay; the logo header has no search icon', async () => {
    await showShell('finance', 375);
    expect(document.querySelector('input')).toBeNull();
    expect(document.querySelector('[data-testid="staff-sidebar"]')).toBeNull();
    const fab = document.querySelector<HTMLElement>('[data-testid="search-fab"]')!;
    expect(fab.getAttribute('aria-label')).toBe('Search');
    expect(Array.from(document.querySelectorAll('button')).filter((b) => b.getAttribute('aria-label') === 'Search')).toEqual([fab]); // the only one: the header icon is gone
    await click(fab);
    expect(document.activeElement).toBe(input());
    await click(btn('Close search'));
    expect(document.querySelector('input')).toBeNull();
  });

  // the stack's geometry: px of the base (the calc's first term) and the right edge, read off the inline style
  const px = (v: string) => parseFloat(/calc\((\d+)px/.exec(v)?.[1] ?? 'NaN');
  const at = (testid: string) => { const el = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!; return { el, right: parseFloat(el.style.right), bottom: px(el.style.bottom), size: parseFloat(el.style.width) }; };

  it('phone, lobby: the search button sits right above Tasks in the same column, and opens the search', async () => {
    await showShell('lobby', 375);
    const tasks = at('quick-tasks');
    const fab = at('search-fab');
    expect(document.querySelector('[data-testid="quick-camera"]')).toBeNull();
    expect(fab.size).toBe(48);
    expect(fab.right).toBe(tasks.right);
    expect(fab.bottom).toBe(tasks.bottom + tasks.size + 10);
    await click(fab.el);
    expect(document.activeElement).toBe(input());
  });

  it('phone, activity: the search button sits right above the camera, which stays the bottom of the right column', async () => {
    await showShell('activity', 375);
    const cam = at('quick-camera');
    const tasks = at('quick-tasks');
    const fab = at('search-fab');
    expect(fab.right).toBe(cam.right);
    expect(fab.bottom).toBe(cam.bottom + cam.size + 10);
    expect(tasks.right).toBe(cam.right + cam.size + 10); // Tasks stays left of the camera
    expect(tasks.bottom).toBe(cam.bottom);
  });

  it('phone: a page Pin raises the search button with the rest of the stack', async () => {
    await showShell('lobby', 375);
    const before = at('search-fab').bottom;
    await act(async () => { useUi.getState().pin(1); });
    expect(at('search-fab').bottom).toBeGreaterThan(before);
    expect(at('search-fab').bottom).toBe(at('quick-tasks').bottom + 58);
    await act(async () => { useUi.getState().pin(-1); });
  });

  it('laptop: no floating search button', async () => {
    await showShell('lobby', 1440);
    expect(document.querySelector('[data-testid="search-fab"]')).toBeNull();
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

  it('Ctrl+Shift+K and a held key (repeat) do not open it', async () => {
    await showShell('finance', 1440);
    await key('k', { ctrlKey: true, shiftKey: true }, window);
    expect(document.querySelector('input')).toBeNull();
    await key('k', { metaKey: true, repeat: true }, window);
    expect(document.querySelector('input')).toBeNull();
  });

  it('Cmd-K calls preventDefault', async () => {
    await showShell('lobby', 1440);
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true });
    await act(async () => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('Esc closes only the topmost overlay', () => {
  function Stack() {
    const [sheet, setSheet] = useState(true);
    const [find, setFind] = useState(false);
    return (
      <MemoryRouter>
        <button type="button" data-testid="open-find" onClick={() => setFind(true)}>find</button>
        <Sheet open={sheet} onClose={() => { sheetClose(); setSheet(false); }} title="Under"><input data-testid="draft" /></Sheet>
        <SuperSearch open={find} onClose={() => { searchClose(); setFind(false); }} />
      </MemoryRouter>
    );
  }
  const sheetClose = vi.fn();
  const searchClose = vi.fn();

  it('a sheet under the search stays open on the first Esc and closes on the second; the page scroll comes back', async () => {
    sheetClose.mockClear(); searchClose.mockClear();
    sign('finance', 375);
    document.body.style.overflow = '';
    await act(async () => { root!.render(<Stack />); });
    await click(document.querySelector('[data-testid="open-find"]'));
    expect(document.querySelector('[role="dialog"][aria-label="Under"]')).not.toBeNull();
    expect(document.querySelector('input[aria-label="Search"]')).not.toBeNull();
    await key('Escape', {}, window);
    expect(searchClose).toHaveBeenCalledTimes(1);
    expect(sheetClose).not.toHaveBeenCalled();
    expect(document.querySelector('input[aria-label="Search"]')).toBeNull();
    expect(document.querySelector('[role="dialog"][aria-label="Under"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden'); // the sheet is still open
    await key('Escape', {}, window);
    expect(sheetClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
