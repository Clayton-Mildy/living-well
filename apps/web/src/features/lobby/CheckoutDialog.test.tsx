// The check-out dialog asks for a face but never blocks (round 14): confirm works without one, and a tapped face goes with it.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { CheckoutDialog } from './CheckoutDialog';

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

function openClubWithMemberIn(id: string) {
  const state = buildSeed().citra;
  state.attendance[`${T}:${id}`] = { id: `${T}:${id}`, clubId: 'citra', createdAt: `${T}T09:59`, createdBy: 'staff:s1', date: T, memberId: id, checkIn: { at: '09:59', by: 'staff:s1', method: 'manual' }, dismissed: [], queueAdds: [], edits: [] };
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}

describe('CheckoutDialog', () => {
  it('confirms without a face, and with the face once one is tapped', async () => {
    openClubWithMemberIn('m1');
    const onConfirm = vi.fn(async () => true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><CheckoutDialog memberId="m1" onClose={() => {}} onConfirm={onConfirm} onAskDeparture={async () => {}} /></MemoryRouter>); });
    const confirm = () => document.querySelector<HTMLElement>('[data-testid="co-confirm"]')!;
    expect(confirm().getAttribute('aria-disabled')).toBeNull();
    await act(async () => { confirm().click(); });
    expect(onConfirm).toHaveBeenCalledWith('m1', null);
    await act(async () => { document.querySelector<HTMLElement>('[role=radio][data-face="5"]')!.click(); });
    await act(async () => { confirm().click(); });
    expect(onConfirm).toHaveBeenLastCalledWith('m1', 5);
  });
});
