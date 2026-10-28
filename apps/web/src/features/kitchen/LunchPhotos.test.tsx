// Round 13 §13: the kitchen's lunch and tea photo tiles open the picture full size; the X / remove stays its own target and does not open it.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, lunchPhotosOn, type ClubState, type ISODate } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { LunchPhotos } from './LunchPhotos';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

function openClub(): { state: ClubState; date: ISODate } {
  const state = buildSeed().citra;
  const date = Object.values(state.dayMenus).map((d) => d.date).sort().reverse().find((d) => lunchPhotosOn(state, d).length > 0)!;
  // tea gallery on the same day: reuse the first lunch photo row as a tea photo id too
  const first = lunchPhotosOn(state, date)[0];
  state.dayMenus[date] = { ...state.dayMenus[date], teaPhotoIds: [first.id] };
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: date, startMin: 598, realStart: Date.now(), offset: 0 } });
  return { state, date };
}
async function show(ui: ReactElement) {
  (window as { innerWidth: number }).innerWidth = 390;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const viewer = () => document.querySelector('[role=dialog][aria-modal=true]');

describe.each([['lunch', 'lunch-photo'], ['tea', 'tea-photo']] as const)('%s photo tiles', (meal, tid) => {
  it('opens the picture in the viewer on tap', async () => {
    const { date } = openClub();
    await show(<LunchPhotos date={date} meal={meal} />);
    const tile = document.querySelector(`[data-testid=${tid}]`)!;
    expect(tile).not.toBeNull();
    expect(viewer()).toBeNull();
    await act(async () => { (tile.querySelector('[data-testid=photo-open]') as HTMLElement).click(); });
    expect(viewer()).not.toBeNull();
  });
  it('keeps the X as its own target: remove asks to confirm and the viewer does not open', async () => {
    const { date } = openClub();
    await show(<LunchPhotos date={date} meal={meal} />);
    const tile = document.querySelector(`[data-testid=${tid}]`)!;
    const x = tile.querySelector('button[title="Remove photo"]') as HTMLElement;
    expect(x.style.width).toBe('44px');
    await act(async () => { x.click(); });
    expect(document.body.textContent).toContain('Remove this photo?');
    expect(document.body.textContent).not.toMatch(/\d+ \/ \d+/); // the staff viewer's counter
  });
});

describe('compact strip (the Lunch round) and the Menu page gallery (round 15)', () => {
  it('compact: 64 px tile, the X hit area is 36 px so the centre of the tile still opens the picture', async () => {
    const { date } = openClub();
    await show(<LunchPhotos date={date} compact />);
    const tile = document.querySelector<HTMLElement>('[data-testid=lunch-photo]')!;
    expect(tile.style.width).toBe('64px');
    expect(tile.querySelector<HTMLElement>('button[title="Remove photo"]')!.style.width).toBe('36px');
  });
  it('not compact: the larger grid keeps its time chip and readable state', async () => {
    const { date } = openClub();
    await show(<LunchPhotos date={date} />);
    const tile = document.querySelector<HTMLElement>('[data-testid=lunch-photo]')!;
    expect(tile.style.width).toBe('');
    expect(tile.querySelector<HTMLElement>('button[title="Remove photo"]')!.style.width).toBe('44px');
    expect(tile.textContent).toMatch(/\d\d:\d\d/);
    expect(tile.textContent).toMatch(/Waiting for approval|Shown to families|Hidden/);
  });
});

describe('read-only gallery (view only)', () => {
  it('still opens the picture', async () => {
    const { date } = openClub();
    await show(<LunchPhotos date={date} readOnly />);
    await act(async () => { (document.querySelector('[data-testid=photo-open]') as HTMLElement).click(); });
    expect(viewer()).not.toBeNull();
  });
});
