// Check on (round 12): the rail block in Arrivals' side rail and the call sheet it opens.
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
  try { localStorage.removeItem('cp.checkOn.days'); } catch { /* none */ }
  root = null;
  host = null;
});

const noop: GuestActions = { onIn: () => undefined, onOut: () => undefined, onNoShow: () => undefined, onUndoNoShow: () => undefined };
function Rail() {
  const [id, setId] = useState<string | null>(null);
  return <><AlsoToday guest={noop} onCheckOn={setId} /><CheckOnSheet memberId={id} onClose={() => setId(null)} /></>;
}
/** The seed with Oma Lina (m1) quiet for 12 days: nothing since Friday the 9th. */
function open(quiet: boolean, alsoM2 = false) {
  const state = buildSeed().citra;
  if (quiet) for (const k of Object.keys(state.attendance)) if (state.attendance[k].memberId === 'm1' && state.attendance[k].date > '2026-10-09') delete state.attendance[k];
  if (alsoM2) for (const k of Object.keys(state.attendance)) if (state.attendance[k].memberId === 'm2' && state.attendance[k].date > '2026-10-13') delete state.attendance[k]; // m2: a week or so quiet, under the automatic 10
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
  it('"Not seen for" in the call sheet: 7 days adds the member quiet for a week to the rail and is remembered', async () => {
    open(true, true);
    await show();
    expect(host!.querySelector('[data-check-on="m2"]')).toBeNull();
    await act(async () => { (host!.querySelector('[data-check-on="m1"]') as HTMLButtonElement).click(); });
    const sheet = document.body.querySelector('[role="dialog"]')!;
    const trigger = sheet.querySelector('[role="combobox"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Automatic');
    await act(async () => { trigger.click(); });
    const opt = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent === '7 days') as HTMLElement;
    await act(async () => { opt.click(); });
    expect(localStorage.getItem('cp.checkOn.days')).toBe('7');
    expect(host!.querySelector('[data-check-on="m2"]')).toBeTruthy();
    expect(host!.textContent).toContain("Haven't come lately (2)");
  });
  it('a stored 30 keeps the block with a quiet line and the control; Automatic brings the member back', async () => {
    open(true);
    localStorage.setItem('cp.checkOn.days', '30');
    await show();
    expect(host!.textContent).toContain("Haven't come lately (0)");
    expect(host!.textContent).toContain('Nobody has been away that long');
    expect(host!.querySelector('[data-check-on="m1"]')).toBeNull();
    const trigger = host!.querySelector('[role="combobox"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain('30 days');
    await act(async () => { trigger.click(); });
    await act(async () => { (Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent === 'Automatic') as HTMLElement).click(); });
    expect(localStorage.getItem('cp.checkOn.days')).toBeNull();
    expect(host!.querySelector('[data-check-on="m1"]')).toBeTruthy();
  });
  it('choosing 7 days on the rail itself updates its count', async () => {
    open(true, true);
    await show();
    expect(host!.textContent).toContain("Haven't come lately (1)");
    await act(async () => { (host!.querySelector('[role="combobox"]') as HTMLButtonElement).click(); });
    await act(async () => { (Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent === '7 days') as HTMLElement).click(); });
    expect(host!.textContent).toContain("Haven't come lately (2)");
  });
  it('still renders with Automatic when storage throws', async () => {
    open(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    await show();
    await act(async () => { (host!.querySelector('[data-check-on="m1"]') as HTMLButtonElement).click(); });
    const trigger = document.body.querySelector('[role="dialog"] [role="combobox"]') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Automatic');
  });
});
