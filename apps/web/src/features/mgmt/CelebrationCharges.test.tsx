// Round 16: a celebration's charges (free by default): the front desk adds and removes them, finance or management issues their own invoice.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type Celebration, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ChargesBody } from './CelebrationCharges';

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

const CEL: Celebration = { id: 'cel1', clubId: 'citra', createdAt: '2026-10-21T09:00', createdBy: 'staff:s9', memberId: 'm46', kind: 'birthday', title: "Opa Budi's 80th birthday", date: '2026-11-05', from: '15:00', to: '17:00', roomId: 'room-garden-room', guests: 12, status: 'confirmed', requestedBy: 'staff:s9' };
function openAs(uid: 's1' | 's10', charges: Celebration['charges'] = []) {
  const s: ClubState = structuredClone(buildSeed().citra);
  s.celebrations = { cel1: { ...CEL, charges } };
  const fn = vi.fn(async () => ({ ok: true as const, result: {} }));
  const user = uid === 's1' ? { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] } : { kind: 'staff' as const, id: 's10', name: 'Fransiska', role: 'finance' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: s, view: s, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 600, realStart: Date.now(), offset: 0 }, act: fn as never });
  return fn;
}
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><ChargesBody celebrationId="cel1" /></MemoryRouter>); });
}
const type = async (name: string, v: string) => {
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.endsWith(label)) as HTMLButtonElement | undefined;

describe('celebration charges', () => {
  it('free by default; the front desk adds "Cake · Rp 350.000" and cannot issue the invoice', async () => {
    const fn = openAs('s1');
    await show();
    expect(document.querySelector('[data-testid="charges-total"]')?.textContent).toBe('Free');
    await type('item', 'Cake');
    await type('amount', '350.000');
    await act(async () => { button('Add charge')!.click(); });
    expect(fn).toHaveBeenCalledWith('celebration.addCharge', { celebrationId: 'cel1', item: 'Cake', amount: 350_000 });
    expect(button('Issue invoice')).toBeUndefined();
  });
  it('finance sees the uninvoiced charges and issues their invoice', async () => {
    const fn = openAs('s10', [{ id: 'cc1', item: 'Cake', amount: 350_000 }]);
    await show();
    expect(document.querySelector('[data-charge="cc1"]')?.textContent).toContain('Cake · Rp 350.000');
    await act(async () => { button('Issue invoice')!.click(); });
    expect(fn).toHaveBeenCalledWith('celebration.issueInvoice', { celebrationId: 'cel1' });
  });
});
