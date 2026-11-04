// Round 20: "Also today" on a field trip day with no kitchen menu shows the trip in place of "Menu today"; a menu the kitchen added brings the menu back.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { AlsoToday, type GuestActions } from './AlsoToday';

const TRIP = 'ev-outing-1029';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
async function show(edit?: (s: ClubState, tripDate: string) => void, normal = false) {
  const state = buildSeed().citra;
  const day = normal ? '2026-10-21' : state.calendarEvents[TRIP].date;
  edit?.(state, day);
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: day, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><AlsoToday guest={noop} /></MemoryRouter>); });
}

describe('Also today on a field trip day', () => {
  it('shows the trip instead of "Menu today" when the kitchen set no menu', async () => {
    await show();
    expect(host!.textContent).not.toContain('Menu today');
    expect(host!.querySelector('[data-testid="lobby-menu"]')).toBeNull();
    const trip = host!.querySelector('[data-testid="lobby-trip"]')!;
    expect(trip.textContent).toContain('Field trip today');
    expect(trip.textContent).toContain('Kebun Raya Bogor botanical garden · 08:30–15:00');
  });
  it('shows the menu the kitchen added for the trip day', async () => {
    await show((s, d) => { s.dayMenus[d] = { id: d, clubId: s.clubId, createdAt: `${d}T08:00`, createdBy: 'staff:s3', date: d, lunch: ['dish-sop-ikan'], allergyPlans: [] } as ClubState['dayMenus'][string]; });
    expect(host!.querySelector('[data-testid="lobby-menu"]')!.textContent).toContain('Menu today');
    expect(host!.querySelector('[data-testid="lobby-trip"]')).toBeNull();
  });
  it('a normal day keeps "Menu today" and has no trip row', async () => {
    await show(undefined, true);
    expect(host!.textContent).toContain('Menu today');
    expect(host!.querySelector('[data-testid="lobby-trip"]')).toBeNull();
  });
});
