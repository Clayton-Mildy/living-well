// Renewals screen: the month, the progress and key dates, the three segments, and recording a follow-up (a change by the front desk goes for approval).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Renewals } from './index';

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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { pending: true, status: 'pending' } }));
function openClub(uid = 's1', role = 'lobby', name = 'Caca') {
  const state = buildSeed().citra;
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name, role, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const seg = (k: string) => document.querySelector(`[data-seg="${k}"]`);

describe('Renewals', () => {
  it('shows the coming month, how many are decided, the key dates and the three segments', async () => {
    openClub();
    await show(<Renewals />);
    expect(document.body.textContent).toContain('November 2026');
    expect(document.querySelector('[data-testid="renewals-progress"]')?.textContent).toBe('3 of 5 decided'); // everyone but the two still to do
    expect(document.querySelector('[data-testid="renewals-dates"]')?.textContent).toBe('Leave can start in December · Invoice 21 Nov'); // the 17 Oct notice has passed
    expect(seg('toDo')?.textContent).toBe('To do · 2');
    expect(seg('waiting')?.textContent).toBe('Waiting · 1');
    expect(seg('decided')?.textContent).toBe('Decided · 2');
    // the to-do list: Hendra has not answered twice, Tjahjadi asked to be called back
    expect(Array.from(document.querySelectorAll('[data-renewal]')).map((r) => r.getAttribute('data-renewal'))).toEqual(['m2', 'm20']);
    expect(document.querySelector('[data-renewal="m2"]')?.textContent).toContain('No answer · 2 calls');
    await click(seg('decided'));
    expect(document.querySelector('[data-renewal="m10"]')?.textContent).toContain('Asked in the app');
  });

  it('a change by the front desk is sent for approval: pick the outcome, then Send for approval', async () => {
    openClub();
    await show(<Renewals />);
    await click(document.querySelector('[data-renewal="m2"] button.cp-tap-target'));
    expect(document.body.textContent).toContain('Follow up Opa Hendra');
    expect(document.body.textContent).toContain('Cynthia Gunawan'); // the family contact to call
    await click(btn(/^Downgrade to Flex$/));
    await click(btn(/Send for approval/));
    expect(actMock).toHaveBeenCalledWith('followUp.record', { memberId: 'm2', month: '2026-11', outcome: 'downgrade' });
  });

  it('management\'s own record is just Save, and a waiting change says who recorded it', async () => {
    openClub('s9', 'mgmt', 'Ega');
    await show(<Renewals />);
    await click(seg('waiting'));
    await click(document.querySelector('[data-renewal="m1"] button.cp-tap-target'));
    expect(document.body.textContent).toContain('Waiting for management approval. Recorded by Caca.');
    await click(btn(/^Continue$/));
    expect(btn(/Save$/)).toBeTruthy(); // (the button text starts with its icon's name)
    expect(btn(/Send for approval/)).toBeFalsy();
  });
});
