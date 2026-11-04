// Round 20: the kitchen's menu page on a field trip day: "Field trip · menu optional" and an "Add what they'll eat" row that opens the one-date menu editor.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { KitchenMenu } from './KitchenMenu';

const TRIP = 'ev-outing-1029';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); document.body.innerHTML = ''; root = null; host = null; });

async function show(normal = false) {
  const state = buildSeed().citra;
  const day = normal ? '2026-10-21' : state.calendarEvents[TRIP].date;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's3', name: 'Sari', role: 'kitchen', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's3', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: day, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><KitchenMenu /></MemoryRouter>); });
}

describe('Kitchen menu on a field trip day', () => {
  it('reads "Field trip · menu optional" and the add row opens the one-date editor with empty courses', async () => {
    await show();
    expect(host!.querySelector('[data-testid="trip-banner"]')!.textContent).toContain('Field trip · menu optional');
    const add = host!.querySelector('[data-testid="trip-add-menu"]') as HTMLButtonElement;
    expect(add.textContent).toContain("Add what they'll eat");
    await act(async () => { add.click(); });
    const sheet = document.body.querySelector('[role="dialog"]')!;
    expect(sheet.textContent).toContain('Change one date');
    expect(sheet.textContent).not.toContain('The club is closed');
    expect(sheet.querySelector('[data-testid="override-lunch"]')).not.toBeNull();
  });
  it('a normal day has neither', async () => {
    await show(true);
    expect(host!.querySelector('[data-testid="trip-banner"]')).toBeNull();
    expect(host!.querySelector('[data-testid="trip-add-menu"]')).toBeNull();
  });
});
