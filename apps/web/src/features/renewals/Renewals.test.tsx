// Next month screen (round 14): the month, the Changes and Unpaid tabs, recording a change (it applies at once) and Undo.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, toMin, type ClubState } from '@cp/shared';
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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { status: 'done' } }));
function openClub(uid = 's1', role = 'lobby', name = 'Caca', state: ClubState = buildSeed().citra) {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name, role, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
/** the seeded world with Lina's upgrade recorded the way round 14 does it: applied at once */
const withUpgrade = (): ClubState => {
  const s = buildSeed().citra;
  return execute(s, 'followUp.record', { memberId: 'm1', month: '2026-11', outcome: 'upgrade' }, getUser({ citra: s }, 's1')!, { today: '2026-10-21', nowMin: toMin('09:58') }, 'w1').state;
};
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const tab = (re: RegExp) => Array.from(document.querySelectorAll('[role="tab"]')).find((b) => re.test(b.textContent || ''));

describe('Next month', () => {
  it('shows the coming month under its new title with the Changes and Unpaid tabs, and no progress bar or segments', async () => {
    openClub();
    await show(<Renewals />);
    expect(document.querySelector('h1')?.textContent).toBe('Next month');
    expect(document.body.textContent).toContain('November 2026');
    expect(Array.from(document.querySelectorAll('[role="tab"]')).map((x) => x.textContent)).toEqual(['Changes', 'Unpaid']);
    expect(tab(/^Changes$/)?.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-testid="renewals-progress"]')).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
    expect(document.querySelector('[data-testid="renewal-quick-continue"]')).toBeNull();
    expect(document.querySelector('[data-change]')).toBeNull(); // Lina's upgrade still waits for Ega from before: not a change yet
    expect(document.body.textContent).toContain('No changes recorded for November');
    expect(btn(/Record a change/)).toBeTruthy();
    await click(tab(/^Unpaid$/));
    expect(document.querySelector('[data-testid="unpaid-list"]')).toBeTruthy();
    expect(btn(/Record a change/)).toBeFalsy();
  });

  it('recording an upgrade: pick the member, pick the change, Save calls followUp.record', async () => {
    openClub();
    await show(<Renewals />);
    await click(btn(/Record a change/));
    expect(document.body.textContent).toContain('Pick a member');
    await click(document.querySelector('[role="combobox"]'));
    const opt = Array.from(document.querySelectorAll('[role="option"]')).find((o) => /Lina/.test(o.textContent || ''));
    await click(opt);
    expect(document.body.textContent).toContain('Follow up Oma Lina');
    await click(btn(/^Upgrade to Gold$/));
    expect(btn(/Send for approval/)).toBeFalsy(); // round 14: no approval step
    expect(Array.from(document.querySelectorAll('button')).some((b) => /^(Continue|No answer)$/.test(b.textContent || ''))).toBe(false);
    await click(btn(/Save$/)); // (the button text starts with its icon's name)
    expect(actMock).toHaveBeenCalledWith('followUp.record', { memberId: 'm1', month: '2026-11', outcome: 'upgrade' });
  });

  it('a recorded change is a row with who, from when, and Undo; Undo calls followUp.undo', async () => {
    openClub('s1', 'lobby', 'Caca', withUpgrade());
    await show(<Renewals />);
    const row = document.querySelector('[data-change="m1"]');
    expect(row?.textContent).toContain('Oma Lina');
    expect(row?.querySelector('[data-testid="change-what"]')?.textContent).toBe('Upgrade to Gold');
    expect(row?.querySelector('[data-testid="change-when"]')?.textContent).toBe('from 1 Nov · by Caca');
    await click(row?.querySelector('[data-testid="change-undo"]'));
    expect(actMock).toHaveBeenCalledWith('followUp.undo', { memberId: 'm1', month: '2026-11' });
  });
});
