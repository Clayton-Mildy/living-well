// Round 18: field trips on the Calendar: the New field trip button, /calendar?new=trip and the /calendar?date= deep link a search result uses.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Calendar } from './Calendar';
import { VenuePicker } from './VenuePicker';

vi.mock('../../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
const WIDTH = window.innerWidth;
afterEach(async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: WIDTH });
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

const Where = () => { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output>; };
const WHO = { s9: { id: 's9', name: 'Ega', role: 'mgmt' as const }, s5: { id: 's5', name: 'Dinar', role: 'activity' as const } };
async function show(uid: keyof typeof WHO, url = '/calendar', width = 1280) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
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
  it('management has a New field trip button; it opens the editor on Field trip (round 21: no fee box, field trips are paid monthly)', async () => {
    await show('s9');
    expect(dialog()).toBeNull();
    const b = button('New field trip')!;
    expect(b).toBeTruthy();
    await act(async () => { b.click(); });
    expect(dialog()).toBeTruthy();
    expect(selectedChip()).toContain('Field trip');
    expect(document.querySelector('input[name="fee"]')).toBeNull();
  });
  it('round 21: a new field trip asks for the event name and the venue; Save without a venue says so', async () => {
    await show('s9');
    await act(async () => { button('New field trip')!.click(); });
    const dlg = dialog()!;
    const labels = Array.from(dlg.querySelectorAll('label > span:first-child')).map((x) => x.textContent);
    expect(labels).toContain('Event name');
    expect(dlg.textContent).toContain('Venue');
    await act(async () => { Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent === 'Save')!.click(); });
    expect(dlg.textContent).toContain('Choose the venue.');
  });
  it('on a phone management finds the New field trip row at the top of the List view, before the day blocks, and it opens the editor on Field trip', async () => {
    await show('s9', '/calendar', 390);
    const row = document.querySelector('[data-testid="new-field-trip-row"]')!;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('New field trip');
    // before the first day block (a DayBlock carries data-date)
    const blocks = Array.from(document.querySelectorAll('[data-date]'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(row.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => { (row.querySelector('button') as HTMLButtonElement).click(); });
    expect(dialog()).toBeTruthy();
    expect(selectedChip()).toContain('Field trip');
  });
  it('on a phone the activity team has no such row', async () => {
    await show('s5', '/calendar', 390);
    expect(document.querySelector('[data-testid="new-field-trip-row"]')).toBeNull();
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

describe('11 Nov (KC): the picked venue shows its pictures from Contacts', () => {
  it('nothing picked: no preview; a venue picked: its pictures, address and person to ask for; a tap opens one full size', async () => {
    const state = buildSeed().citra;
    const v = Object.values(state.directory).find((d) => d.kind === 'venue' && (d.photoMediaIds?.length ?? 0) > 1)!;
    expect(v).toBeTruthy();
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><VenuePicker value="" onChange={() => {}} /></MemoryRouter>); });
    expect(document.querySelector('[data-testid="venue-preview"]')).toBeNull();
    await act(async () => { root!.render(<MemoryRouter><VenuePicker value={v.id} onChange={() => {}} /></MemoryRouter>); });
    const pre = document.querySelector('[data-testid="venue-preview"]')!;
    expect(pre.querySelectorAll('[data-testid="venue-pic"]')).toHaveLength(v.photoMediaIds!.length);
    if (v.address) expect(pre.textContent).toContain(v.address);
    if (v.contactPerson) expect(pre.textContent).toContain(v.contactPerson);
    await act(async () => { (pre.querySelector('[data-testid="venue-pic"]') as HTMLElement).click(); });
    expect(document.querySelector(`[role="dialog"] img[alt="${v.name}"]`)).toBeTruthy();
  });
});

