// Round 17: "On your next bill" lists the pick-up fee and the charges that wait for the next invoice (a field trip, a birthday cake) with their total.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { NextBill } from './NextBill';

let root: Root | null = null;
let host: HTMLElement | null = null;
const T = '2026-10-21';
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
/** Opa Budi with pick-up at Rp 500.000 and one field trip charge of Rp 250.000 (the seed's cake and trips cleared). */
function state(): ClubState {
  const s: ClubState = structuredClone(buildSeed().citra);
  s.pendingCharges = {};
  s.members.m46.pickup = { on: true, price: 500_000 };
  s.pendingCharges['trip-e1-m46'] = { id: 'trip-e1-m46', clubId: s.clubId, createdAt: '2026-10-20T15:00:00', createdBy: 'staff:s1', memberId: 'm46', amount: 250_000, label: 'inv.line.fieldTrip', params: { title: 'Taman Safari', date: '2026-10-20' } } as never;
  return s;
}
async function show(s: ClubState, memberId: string, lang: 'en' | 'id' = 'en') {
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: s, view: s, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><NextBill memberId={memberId} /></MemoryRouter>); });
}

describe('On your next bill', () => {
  it('shows the pick-up fee and the waiting charge, and their total', async () => {
    await show(state(), 'm46');
    const text = host!.textContent ?? '';
    expect(text).toContain('On your next bill');
    expect(text).toContain('Pick-up');
    expect(text).toContain('Rp 500.000');
    expect(text).toContain('Field trip · Taman Safari · Tue 20 Oct');
    expect(text).toContain('Rp 250.000');
    expect(host!.querySelector('[data-testid="next-total"]')?.textContent).toContain('Rp 750.000');
  });
  it('is in Indonesian too', async () => {
    await show(state(), 'm46', 'id');
    const text = host!.textContent ?? '';
    expect(text).toContain('Di tagihan berikutnya');
    expect(text).toContain('Antar-jemput');
    expect(text).toContain('Karyawisata · Taman Safari');
  });
  it('renders nothing for a member with nothing waiting', async () => {
    await show(state(), 'm1');
    expect(host!.textContent).toBe('');
    expect(host!.innerHTML).toBe('');
  });
});
