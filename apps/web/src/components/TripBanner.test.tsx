// Round 20: the field trip banner (Arrivals, the health station, the kitchen) reads the day's trip and is absent on other days.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { TripBanner } from './TripBanner';

const TRIP = 'ev-outing-1029';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

async function show(date: string | ((tripDate: string) => string), lang: 'en' | 'id' = 'en') {
  const state = buildSeed().citra;
  state.calendarEvents[TRIP].wentIds = ['m2', 'm20'];
  const day = typeof date === 'string' ? date : date(state.calendarEvents[TRIP].date);
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: day, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<TripBanner date={day} />); });
}

describe('TripBanner', () => {
  it('shows the trip, its times and how many are going', async () => {
    await show((d) => d);
    const b = host!.querySelector('[data-testid="trip-banner"]')!;
    expect(b.textContent).toContain('Field trip today');
    expect(b.textContent).toContain('Kebun Raya Bogor botanical garden · 08:30–15:00');
    expect(b.querySelector('[data-testid="trip-going"]')!.textContent).toBe('2 going');
  });
  it('speaks Indonesian', async () => {
    await show((d) => d, 'id');
    const b = host!.querySelector('[data-testid="trip-banner"]')!;
    expect(b.textContent).toContain('Karyawisata hari ini');
    expect(b.textContent).toContain('Kebun Raya Bogor · 08:30–15:00');
    expect(b.textContent).toContain('2 ikut');
  });
  it('is not there on a normal day', async () => {
    await show('2026-10-21');
    expect(host!.querySelector('[data-testid="trip-banner"]')).toBeNull();
    expect(host!.textContent).toBe('');
  });
});
