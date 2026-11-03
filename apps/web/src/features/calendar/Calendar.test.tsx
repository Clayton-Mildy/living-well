// Round 18: field trips on the Calendar: the New field trip button, /calendar?new=trip and the /calendar?date= deep link a search result uses.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Calendar } from './Calendar';

vi.mock('../../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

const Where = () => { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output>; };
const WHO = { s9: { id: 's9', name: 'Ega', role: 'mgmt' as const }, s5: { id: 's5', name: 'Dinar', role: 'activity' as const } };
async function show(uid: keyof typeof WHO, url = '/calendar') {
  const w = WHO[uid];
  const state = buildSeed().citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: w.id, name: w.name, role: w.role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: w.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}><Calendar /><Where /></MemoryRouter>); });
}
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim().endsWith(label)) as HTMLButtonElement | undefined;
const dialog = () => document.querySelector('[role="dialog"]');
const selectedChip = () => Array.from(document.querySelectorAll('button[aria-pressed="true"]')).map((b) => b.textContent);

describe('Calendar: field trips', () => {
  it('management has a New field trip button; it opens the editor on Field trip with the fee 250.000', async () => {
    await show('s9');
    expect(dialog()).toBeNull();
    const b = button('New field trip')!;
    expect(b).toBeTruthy();
    await act(async () => { b.click(); });
    expect(dialog()).toBeTruthy();
    expect(selectedChip()).toContain('Field trip');
    const fee = Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((i) => i.value === '250.000');
    expect(fee).toBeTruthy();
  });
  it('the activity team has no such button', async () => {
    await show('s5');
    expect(button('New field trip')).toBeUndefined();
  });
  it('/calendar?new=trip opens the editor in field trip mode and the URL loses new', async () => {
    await show('s9', '/calendar?new=trip');
    expect(dialog()).toBeTruthy();
    expect(selectedChip()).toContain('Field trip');
    expect(document.querySelector('[data-testid="where"]')!.textContent).toBe('/calendar');
  });
  it('/calendar?date=2026-10-29 opens that day (the month view with the Bogor field trip) and the URL loses date', async () => {
    await show('s9', '/calendar?date=2026-10-29');
    expect(document.body.textContent).toContain('Kebun Raya Bogor');
    expect(document.querySelector('button[data-date="2026-10-29"][aria-pressed="true"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="where"]')!.textContent).toBe('/calendar');
  });
  it('a bad ?date= is ignored', async () => {
    await show('s9', '/calendar?date=nope');
    expect(document.querySelector('[data-testid="where"]')!.textContent).toBe('/calendar');
  });
});
