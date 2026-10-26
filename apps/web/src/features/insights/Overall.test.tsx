// Insights › Overall (management): the Today block above the summary (Active with its Flex / Gold split, Came, In the club, Gone home, Not in).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Insights } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
async function show() {
  const state = buildSeed().citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/insights']}><Routes><Route path="/insights" element={<Insights />} /></Routes></MemoryRouter>); });
}

describe('Insights › Overall', () => {
  it('shows the Today block with its five numbers (small seed at 09:58: 5 active, 3 in the club)', async () => {
    await show();
    const block = document.querySelector('[data-testid="insights-today"]') as HTMLElement;
    expect(block).toBeTruthy();
    for (const label of ['Active · 2 Flex · 3 Gold', 'Came', 'In the club', 'Gone home', 'Not in']) expect(block.textContent).toContain(label);
    expect(document.body.textContent).toContain('Today');
    // Active 5, Came 3, In the club 3, Gone home 0, Not in 2
    expect(block.textContent).toBe('5Active · 2 Flex · 3 Gold3Came3In the club0Gone home2Not in');
  });
});
