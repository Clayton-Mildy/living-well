// Round 16: the plan tab's Pick-up row — off, the default monthly price, or the member's own; finance and management edit it.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed, type ClubState, type Role } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { PlanTab } from './PlanTab';
import type { P } from './types';

const T = '2026-10-21';
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
  document.body.innerHTML = '';
});
const acts: [string, unknown][] = [];
function Harness({ state, as }: { state: ClubState; as: Role }) {
  const t = useT();
  const fmt = useFmt();
  const doAct = vi.fn(async (name: string, input: unknown) => { acts.push([name, input]); return { ok: true as const, result: {} }; });
  const p = { s: state, m: state.members.m1, today: T, nowMin: 600, t, fmt, lang: 'en', audience: 'staff', family: false, role: as, mgmt: as === 'mgmt', pending: [], mine: [], act: doAct, canEdit: true } as unknown as P;
  return <PlanTab p={p} />;
}
async function show(state: ClubState, as: Role) {
  acts.length = 0;
  const uid = as === 'finance' ? 's10' : as === 'mgmt' ? 's9' : 's1';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: 'X', role: as, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Harness state={state} as={as} /></MemoryRouter>); });
}

describe('round 16: pick-up on the plan tab', () => {
  it('reads Off, the default price, or "· custom"', async () => {
    const s = structuredClone(buildSeed().citra);
    await show(s, 'lobby');
    expect(document.querySelector('[data-testid="pickup-fact"]')?.textContent).toContain('Off');
    expect(document.querySelector('[data-testid="pickup-edit"]')).toBeNull();
    await act(async () => { root?.unmount(); });
    s.members.m1.pickup = { on: true, price: 450_000 };
    await show(s, 'finance');
    expect(document.querySelector('[data-testid="pickup-fact"]')?.textContent).toContain('Rp 450.000 / month · custom');
    expect(document.querySelector('[data-testid="pickup-edit"]')).toBeTruthy();
  });
});
