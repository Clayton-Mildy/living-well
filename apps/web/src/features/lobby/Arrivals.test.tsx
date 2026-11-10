// Round 20: Arrivals on a field trip day. The banner sits at the top, a checked-in member's row reads "· on the trip", and an undone
// check-in whose trip fee is already on an invoice keeps the member on the trip with a toast that says so (R2).
// The actions run for real: the API stand-in executes them on the confirmed state and hands back the patches, as the server does.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, displayName, execute, getUser, rp, type ClubState } from '@cp/shared';
import { clockNow, useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { useUi } from '../../store/ui';

const apiMock = vi.fn(async (path: string, opts?: { body?: { mutationId: string; input: unknown } }) => {
  const name = path.replace('/api/actions/', '');
  const r = useReplica.getState();
  const s = r.confirmed!;
  const out = execute(s, name, opts!.body!.input, getUser({ [s.clubId]: s }, r.userId!)!, clockNow(r.clock!), opts!.body!.mutationId);
  return { rev: r.rev + 1, patches: out.patches, result: out.result };
});
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<typeof import('../../lib/api')>()), api: (...a: [string, { body?: { mutationId: string; input: unknown } }?]) => apiMock(...a) }));
const { Arrivals } = await import('./Arrivals');

const TRIP = 'ev-outing-1029';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { useUi.setState({ toast: null }); });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

/** The seed on the trip day (or a normal day), two members already ticked as going (round 21: no fee per trip). */
async function show(onTripDay = true) {
  const state: ClubState = buildSeed().citra;
  const ev = state.calendarEvents[TRIP];
  ev.wentIds = ['m2', 'm20'];
  const today = onTripDay ? ev.date : '2026-10-21';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Arrivals /></MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const button = (pred: (b: HTMLButtonElement) => boolean) => Array.from(document.body.querySelectorAll('button')).find(pred);
async function checkInLina() {
  await click(button((b) => (b.getAttribute('aria-label') ?? '').startsWith('Check in: ') && (b.getAttribute('aria-label') ?? '').includes('Lina')));
  await click(button((b) => (b.textContent ?? '').includes('Confirm check-in')));
}

describe('Arrivals on a field trip day', () => {
  it('shows the trip banner, and a checked-in member reads "on the trip"', async () => {
    await show();
    const b = host!.querySelector('[data-testid="trip-banner"]')!;
    expect(b.textContent).toContain('Field trip today');
    expect(b.textContent).toContain('Kebun Raya Bogor botanical garden · 08:30–15:00');
    expect(b.textContent).toContain('2 going');
    await checkInLina();
    expect(useReplica.getState().confirmed!.calendarEvents[TRIP].wentIds).toContain('m1');
    expect(host!.querySelector('[data-testid="trip-banner"]')!.textContent).toContain('3 going');
    await click(button((b) => b.getAttribute('role') === 'tab' && (b.textContent ?? '').includes('In the club')));
    const row = Array.from(host!.querySelectorAll('[data-list="inclub"] [data-testid="row-name"]')).find((n) => (n.textContent ?? '').includes('Lina'))!.closest('button')!;
    expect(row.textContent).toMatch(/Arrived \d\d:\d\d · on the trip/);
  });
  it('an undone check-in whose per-trip fee from before round 21 is invoiced keeps the member on the trip, and the toast says so', async () => {
    await show();
    await checkInLina();
    const chargeId = `trip-${TRIP}-m1`;
    expect(useReplica.getState().pending).toEqual([]);
    // a per-trip fee charged before round 21, which finance put on an invoice
    const billed = produce(useReplica.getState().confirmed!, (d) => { d.pendingCharges[chargeId] = { id: chargeId, clubId: d.clubId, createdAt: '2026-10-29T09:00', createdBy: 'staff:s1', memberId: 'm1', amount: 150000, label: 'inv.line.fieldTrip', params: { title: 'Bogor', date: '2026-10-29' }, source: { type: 'event', id: TRIP }, invoiceId: 'INV-2026-11-0042' }; });
    useReplica.setState({ confirmed: billed, view: billed });
    const undo = useUi.getState().toast?.action;
    expect(undo?.label).toBe('Undo');
    await act(async () => { undo!.run(); await new Promise((r) => setTimeout(r, 0)); });
    const name = displayName(useReplica.getState().confirmed!.members.m1);
    expect(useUi.getState().toast?.text).toBe(`Check-in undone. ${name} stays on the trip: the ${rp(150000).replace(/\s/g, '\u00a0')} fee is on invoice INV-2026-11-0042. Finance can remove it.`);
    expect(useReplica.getState().confirmed!.calendarEvents[TRIP].wentIds).toContain('m1');
  });
  it('has no banner on a normal day', async () => {
    await show(false);
    expect(host!.querySelector('[data-testid="trip-banner"]')).toBeNull();
    expect(host!.textContent).not.toContain('on the trip');
  });
});
