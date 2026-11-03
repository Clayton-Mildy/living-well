// Round 18: charges listed while a celebration is made (front desk and management); the activity team does not see them.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { CelebrationSheet } from './CelebrationSheet';

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

const USERS = {
  s1: { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] },
  s5: { kind: 'staff' as const, id: 's5', name: 'Dewi', role: 'activity' as const, clubId: 'citra', clubs: ['citra'] },
  s9: { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] },
};
function openAs(uid: keyof typeof USERS) {
  const s: ClubState = structuredClone(buildSeed().citra);
  const fn = vi.fn(async () => ({ ok: true as const, result: {} }));
  useSession.setState({ lang: 'en', club: 'citra', user: USERS[uid] });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: s, view: s, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 600, realStart: Date.now(), offset: 0 }, act: fn as never });
  return fn;
}
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><CelebrationSheet open onClose={() => {}} prefill={{ memberId: 'm46', kind: 'birthday', date: '2026-11-05' }} /></MemoryRouter>); });
}
const type = async (name: string, v: string) => {
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.endsWith(label)) as HTMLButtonElement | undefined;
const addCharge = async (item: string, amount: string) => { await type('item', item); await type('amount', amount); await act(async () => { button('Add charge')!.click(); }); };

describe('new celebration: charges', () => {
  it('the front desk lists charges with a running total, and they are sent with the request', async () => {
    const fn = openAs('s1');
    await show();
    expect(document.body.textContent).toContain('Charges · next monthly bill');
    expect(button('Add charge')).toBeTruthy();
    await addCharge('Cake', '350.000');
    await addCharge('Balloons', '120.000');
    expect(document.querySelector('[data-testid="charges-total"]')?.textContent).toContain('Rp 470.000');
    await act(async () => { button('Send request')!.click(); });
    const call = (fn.mock.calls as unknown[][]).find((c) => c[0] === 'celebration.request')!;
    expect((call[1] as { charges: unknown }).charges).toEqual([{ item: 'Cake', amount: 350_000 }, { item: 'Balloons', amount: 120_000 }]);
  });
  it('management sees it too; a charge can be taken back out before saving', async () => {
    openAs('s9');
    await show();
    await addCharge('Cake', '350000');
    expect(document.querySelector('[data-testid="charges-total"]')?.textContent).toContain('Rp 350.000');
    await act(async () => { (document.querySelector('[data-charge="0"] button') as HTMLButtonElement).click(); });
    expect(document.querySelector('[data-testid="charges-total"]')?.textContent).toBe('Free');
  });
  it('the activity team does not see charges and sends none', async () => {
    const fn = openAs('s5');
    await show();
    expect(document.body.textContent).not.toContain('Charges · next monthly bill');
    expect(button('Add charge')).toBeUndefined();
    await act(async () => { button('Send request')!.click(); });
    const call = (fn.mock.calls as unknown[][]).find((c) => c[0] === 'celebration.request')!;
    expect('charges' in (call[1] as object)).toBe(false);
  });
});
