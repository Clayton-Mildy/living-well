// Check on (round 12): the rail block in Arrivals' side rail and the call sheet it opens.
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { AlsoToday, type GuestActions } from './AlsoToday';
import { CheckOnSheet } from './CheckOnSheet';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  document.body.innerHTML = '';
  root = null;
  host = null;
});

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
function Rail() {
  const [id, setId] = useState<string | null>(null);
  return <><AlsoToday guest={noop} onCheckOn={setId} /><CheckOnSheet memberId={id} onClose={() => setId(null)} /></>;
}
/** The seed with Oma Lina (m1) quiet for 12 days: nothing since Friday the 9th. */
function open(quiet: boolean) {
  const state = buildSeed().citra;
  if (quiet) for (const k of Object.keys(state.attendance)) if (state.attendance[k].memberId === 'm1' && state.attendance[k].date > '2026-10-09') delete state.attendance[k];
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Rail /></MemoryRouter>); });
}

describe('Check on in the Arrivals rail', () => {
  it('lists the quiet member with the days and opens the call sheet on a tap', async () => {
    open(true);
    await show();
    const text = host!.textContent ?? '';
    expect(text).toContain("Haven't come lately (1)");
    const row = host!.querySelector('[data-check-on="m1"]') as HTMLButtonElement;
    expect(row.textContent).toContain('Lina');
    expect(row.textContent).toContain('12 days');
    await act(async () => { row.click(); });
    const sheet = document.body.querySelector('[role="dialog"]')!;
    expect(sheet.textContent).toContain('Maria Wijaya');
    expect(sheet.querySelector('a[href^="tel:"]')).toBeTruthy();
    const save = Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent === 'Save call') as HTMLButtonElement;
    expect(save.getAttribute('aria-disabled')).toBe('true');
    await act(async () => { (Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent === 'Travelling') as HTMLButtonElement).click(); });
    expect(save.getAttribute('aria-disabled')).toBeNull();
  });
  it('shows no block when nobody is quiet', async () => {
    open(false);
    await show();
    expect(host!.textContent).not.toContain("Haven't come lately");
  });
});
