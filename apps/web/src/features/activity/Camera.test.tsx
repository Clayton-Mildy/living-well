// Round 20: the Camera's photo of members (?tab=manual) on a field trip day offers the members in Who went (some join the bus elsewhere)
// beside those checked in; on a closed day it shows the closed state and nothing to take a photo with.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, displayName, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Camera } from './Camera';

const TRIP = 'ev-outing-1029';
const CLOSED = 'ev-closed-1030';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

let state: ClubState;
async function show(day: (s: ClubState) => string, path = '/camera?tab=manual') {
  state = buildSeed().citra;
  const today = day(state);
  // m1 checked in at the club; m20 only ticked in Who went (joined the bus elsewhere)
  state.attendance[`${today}:m1`] = { id: `${today}:m1`, clubId: 'citra', createdAt: `${today}T08:10`, createdBy: 'staff:s1', date: today, memberId: 'm1', checkIn: { at: '08:10', by: 'staff:s1', method: 'manual' }, dismissed: [], queueAdds: [], edits: [] };
  state.calendarEvents[TRIP].wentIds = ['m1', 'm20'];
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Dinar', role: 'activity', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}><Camera /></MemoryRouter>); });
}
const photoOf = (id: string) => host!.querySelector(`button[aria-label="Take a photo of ${displayName(state.members[id])}"]`);

describe('Camera on trip and closed days', () => {
  it('on a trip day offers a trip-goer who did not check in', async () => {
    await show((s) => s.calendarEvents[TRIP].date);
    expect(photoOf('m1')).not.toBeNull();
    expect(photoOf('m20')).not.toBeNull();
    expect(host!.textContent).not.toContain('Nobody has checked in yet.');
  });
  it('on a closed day shows the closed state with no capture', async () => {
    await show((s) => s.calendarEvents[CLOSED].date);
    expect(host!.querySelector('[data-testid="camera-closed"]')).not.toBeNull();
    expect(Array.from(host!.querySelectorAll('button')).some((b) => b.textContent?.includes('Take a photo'))).toBe(false);
    expect(photoOf('m1')).toBeNull();
    expect(host!.textContent).not.toContain('Record a short video');
  });
  it('on a closed day the Drafts (quick camera) and Activity tabs show the closed state too', async () => {
    for (const path of ['/camera', '/camera?tab=activity']) {
      await show((s) => s.calendarEvents[CLOSED].date, path);
      expect(host!.querySelector('[data-testid="camera-closed"]'), path).not.toBeNull();
      expect(host!.querySelector('[data-testid="drafts-open-camera"]'), path).toBeNull();
      expect(Array.from(host!.querySelectorAll('button')).some((b) => /Open camera|Take a photo|Add a picture/.test(b.textContent ?? '')), path).toBe(false);
      await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null;
    }
  });
});
