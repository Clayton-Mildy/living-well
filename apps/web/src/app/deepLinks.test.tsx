// Round 14 phase E, Task 3: the pages a search result opens take their parameter whenever it appears (on mount, or when the search overlay navigates here while the screen is already open) and then drop it from the URL (replace),
// so Back doesn't reopen the sheet: /members?do=add, /requests?do=receipt, /receipts?do=snap, ?inv=<id> on Billing, /directory?q=<text>.
// The screens run against the seed at the e2e date; the action layer is mocked.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { buildSeed, live, type ClubState, type StaffRole } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { MembersList } from '../features/members/MembersList';
import { Requests } from '../features/requests/Requests';
import { Receipts } from '../features/finance/Receipts';
import { Billing } from '../features/finance/Billing';
import { Directory } from '../features/finance/Directory';

vi.mock('../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));
vi.mock('../shell/demoAccounts', () => ({ useDemoLogin: () => true, useDemoAccounts: () => [] }));

const T = '2026-10-21';
const WHO: Record<string, { id: string; name: string }> = { lobby: { id: 's1', name: 'Caca' }, nurse: { id: 's8', name: 'Dewi' }, activity: { id: 's5', name: 'Dinar' }, finance: { id: 's10', name: 'Fransiska' }, mgmt: { id: 's9', name: 'Ega' } };
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  localStorage.clear();
});

/** Shows where the router is, so a test can read the URL after the screen has dropped its parameter. */
const Where = () => { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output>; };

/** A stand-in for the search overlay: sends the router to a result's path without remounting the screen. */
const Go = ({ to }: { to: string }) => { const n = useNavigate(); return <button type="button" data-testid="go" onClick={() => n(to)}>go</button>; };

async function show(role: StaffRole, url: string, ui: ReactElement): Promise<ClubState> {
  const { id, name } = WHO[role];
  const state = buildSeed().citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id, name, role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}<Where /></MemoryRouter>); });
  return state;
}
const text = () => document.body.textContent ?? '';
const where = () => document.querySelector('[data-testid="where"]')!.textContent;
const addFlow = () => document.querySelector('[data-reg-step]');
const photoBtn = () => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Tap to take the photo'));

describe('deep links from search results', () => {
  it('lobby at /members?do=add opens the Add member flow and the URL loses do', async () => {
    await show('lobby', '/members?do=add', <MembersList />);
    expect(addFlow()).toBeTruthy();
    expect(where()).toBe('/members');
  });

  it('nurse at /members?do=add gets no flow (she cannot add)', async () => {
    await show('nurse', '/members?do=add', <MembersList />);
    expect(addFlow()).toBeNull();
  });

  it('keeps the other parameters when it drops do', async () => {
    await show('mgmt', '/members?f=checkOn&do=add', <MembersList />);
    expect(addFlow()).toBeTruthy();
    expect(where()).toBe('/members?f=checkOn');
  });

  it('finance at /today?inv=<seeded id> opens that invoice sheet (Billing reads the parameter, not the path) and the URL loses inv', async () => {
    const s = buildSeed().citra;
    const inv = live(s.invoices)[0];
    await show('finance', `/today?inv=${inv.id}`, <Billing />);
    expect(text()).toContain(`Invoice ${inv.number}`);
    expect(where()).toBe('/today');
  });

  it('management at /billing?inv=<seeded id> opens it too', async () => {
    const inv = live(buildSeed().citra.invoices)[1];
    await show('mgmt', `/billing?inv=${inv.id}`, <Billing />);
    expect(text()).toContain(`Invoice ${inv.number}`);
    expect(where()).toBe('/billing');
  });

  it('?inv=nope opens nothing', async () => {
    await show('finance', '/billing?inv=nope', <Billing />);
    expect(text()).not.toContain('Invoice nope');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(where()).toBe('/billing');
  });

  it('/receipts?do=snap shows the capture (its photo button)', async () => {
    await show('finance', '/receipts?do=snap', <Receipts />);
    expect(photoBtn()).toBeTruthy();
    expect(where()).toBe('/receipts');
  });

  it('/receipts without the parameter shows no capture', async () => {
    await show('finance', '/receipts', <Receipts />);
    expect(photoBtn()).toBeUndefined();
  });

  it('/requests?do=receipt shows the capture for section staff', async () => {
    await show('activity', '/requests?do=receipt', <Requests />);
    expect(photoBtn()).toBeTruthy();
    expect(where()).toBe('/requests');
  });

  it('/directory?q=Bersih lists Bersih Prima and not Sayur Segar Kemang', async () => {
    await show('finance', '/directory?q=Bersih', <Directory />);
    expect(text()).toContain('Bersih Prima');
    expect(text()).not.toContain('Sayur Segar Kemang');
    expect((document.querySelector('input[type="search"], input[placeholder]') as HTMLInputElement).value).toBe('Bersih');
    expect(where()).toBe('/directory');
  });

  it('a result opened while already on the screen (no remount) still opens: Billing, then Directory', async () => {
    const inv = live(buildSeed().citra.invoices)[0];
    await show('mgmt', '/billing', <><Billing /><Go to={`/billing?inv=${inv.id}`} /></>);
    expect(text()).not.toContain(`Invoice ${inv.number}`);
    await act(async () => { (document.querySelector('[data-testid="go"]') as HTMLElement).click(); });
    expect(text()).toContain(`Invoice ${inv.number}`);
    expect(where()).toBe('/billing');
    await act(async () => { root!.unmount(); });
    host!.remove();
    await show('finance', '/directory', <><Directory /><Go to="/directory?q=Bersih" /></>);
    expect(text()).toContain('Sayur Segar Kemang');
    await act(async () => { (document.querySelector('[data-testid="go"]') as HTMLElement).click(); });
    expect(text()).not.toContain('Sayur Segar Kemang');
    expect(where()).toBe('/directory');
  });

  it('a supplier result clears an earlier kind and category filter, so it is never hidden', async () => {
    await show('finance', '/directory', <><Directory /><Go to="/directory?q=Bersih" /></>);
    const chip = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('button[aria-pressed]')).find((b) => (b.textContent ?? '').includes(label))!;
    await act(async () => { chip('Doctors').click(); });
    expect(chip('Doctors').getAttribute('aria-pressed')).toBe('true');
    expect(text()).not.toContain('Bersih Prima'); // the doctor filter hides the supplier
    await act(async () => { (document.querySelector('[data-testid="go"]') as HTMLElement).click(); });
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('Bersih Prima');
  });
});
