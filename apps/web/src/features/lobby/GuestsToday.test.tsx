// Round 13: guest hosts on the Arrivals rail. The "Guests today" block lists the hosts booked for today (hidden when nobody is).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { AlsoToday, type GuestActions } from './AlsoToday';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
async function show(today: string) {
  const state = buildSeed('2026-10-21', 598, { roster: true }).citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><AlsoToday guest={noop} /></MemoryRouter>); });
}

describe('Guests today on the Arrivals rail', () => {
  it('lists the guest host booked for today (the demo seed has one on the demo day) with the session time and the activity', async () => {
    await show('2026-10-21');
    const today = host!.querySelector('[data-testid="guests-today"]')!;
    expect(today.textContent).toContain('Pak Hendro');
    expect(today.textContent).toContain('10:30');
    expect(today.textContent).toContain('Keroncong sing-along');
    expect(today.querySelector('[data-guest-session="gs-5"]')).not.toBeNull();
  });
  it('lists the talk on its own day', async () => {
    await show('2026-10-22');
    const block = host!.querySelector('[data-testid="guests-today"]')!;
    expect(host!.textContent).toContain('Guests today');
    expect(block.textContent).toContain('dr. Maya Sari');
    expect(block.textContent).toContain('13:30');
    expect(block.textContent).toContain('Health talk');
  });
  it('is not there on a day without a guest', async () => {
    await show('2026-10-20');
    expect(host!.querySelector('[data-testid="guests-today"]')).toBeNull();
    expect(host!.textContent).not.toContain('Guests today');
  });
});
