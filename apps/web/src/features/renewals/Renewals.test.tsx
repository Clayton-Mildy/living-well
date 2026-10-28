// Next month screen (round 14, round 15): the month, the Members, Changes and Unpaid tabs, recording a change (it applies at once) and Undo.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { produce } from 'immer';
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
async function show(ui: ReactElement, at = '/renewals?tab=changes') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const tab = (re: RegExp) => Array.from(document.querySelectorAll('[role="tab"]')).find((b) => re.test(b.textContent || ''));

describe('Next month', () => {
  it('shows the coming month under its new title with the Members, Changes and Unpaid tabs, and no progress bar or segments', async () => {
    openClub();
    await show(<Renewals />);
    expect(document.querySelector('h1')?.textContent).toBe('Next month');
    expect(document.body.textContent).toContain('November 2026');
    expect(Array.from(document.querySelectorAll('[role="tab"]')).map((x) => x.textContent)).toEqual(['Members', 'Changes', 'Unpaid']);
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
    const undoBtn = row?.querySelector('[data-testid="change-undo"]') as HTMLElement;
    expect(undoBtn.style.height).toBe('44px');
    await click(undoBtn); // asks first: the family is told at once
    expect(actMock).not.toHaveBeenCalled();
    const dlg = document.querySelector('[role="dialog"]');
    expect(dlg?.textContent).toContain('Undo this change?');
    expect(dlg?.textContent).toContain('The change for Oma Lina in November is cancelled');
    await click(Array.from(dlg!.querySelectorAll('button')).find((b) => b.textContent === 'Undo'));
    expect(actMock).toHaveBeenCalledWith('followUp.undo', { memberId: 'm1', month: '2026-11' });
  });

  it('a plan switch recorded on the profile is a read-only row: who and from when, no Undo', async () => {
    const s = buildSeed().citra;
    const done = execute(s, 'members.changePlan', { memberId: 'm2', plan: 'flex' }, getUser({ citra: s }, 's10')!, { today: '2026-10-21', nowMin: toMin('09:58') }, 'w2').state;
    openClub('s1', 'lobby', 'Caca', done);
    await show(<Renewals />);
    const row = document.querySelector('[data-change="m2"]');
    expect(row?.querySelector('[data-testid="change-what"]')?.textContent).toBe('Downgrade to Flex');
    expect(row?.querySelector('[data-testid="change-when"]')?.textContent).toBe('from 1 Nov · by Bu Fransiska');
    expect(row?.querySelector('[data-testid="change-undo"]')).toBeNull();
  });

  it('a stop on the last day of next month reads "Stops 30 Nov" and keeps the plan', async () => {
    const world = produce(buildSeed().citra, (d) => { const ms = d.members.m1.memberships; ms[ms.length - 1].lastDay = '2026-11-30'; });
    openClub('s1', 'lobby', 'Caca', world);
    await show(<Renewals />, '/renewals');
    const row = document.querySelector('[data-member="m1"]');
    expect(row?.getAttribute('data-status')).toBe('stop');
    expect(row?.querySelector('[data-testid="next-status"]')?.textContent).toBe('Stops 30 Nov');
  });

  it('Members is the first tab and the default: every member, the count line, the Changing filter, and a tap opens the follow-up sheet', async () => {
    const world = withUpgrade();
    // Oma Lina's upgrade is recorded; Oma Lina is on Flex
    openClub('s1', 'lobby', 'Caca', world);
    await show(<Renewals />, '/renewals');
    expect(Array.from(document.querySelectorAll('[role="tab"]')).map((x) => x.textContent)).toEqual(['Members', 'Changes', 'Unpaid']);
    expect(tab(/^Members$/)?.getAttribute('aria-selected')).toBe('true');
    const rows = Array.from(document.querySelectorAll('[data-member]'));
    expect(rows.length).toBeGreaterThan(1);
    const changing = rows.filter((r) => r.getAttribute('data-status') !== 'continues');
    expect(changing.map((r) => r.getAttribute('data-member'))).toContain('m1');
    // next month's plan is the headline: an ink badge "Flex → Gold" with Gold as next month's plan
    expect(document.querySelector('[data-member="m1"] [data-testid="next-status"]')?.textContent).toBe('Flex→Gold');
    expect(document.querySelector('[data-member="m1"] [data-testid="next-plan"]')?.textContent).toBe('Gold');
    // a member who continues shows the plan they keep
    const keeps = rows.find((r) => r.getAttribute('data-status') === 'continues')!;
    expect(keeps.querySelector('[data-testid="next-status"]')?.textContent).toBe('Continues');
    expect(['Flex', 'Gold']).toContain(keeps.querySelector('[data-testid="next-plan"]')?.textContent);
    // next month at a glance: the plan counts add up to everyone who is in next month on a plan
    const counts = Array.from(document.querySelectorAll('[data-plan-count]'));
    expect(counts.map((x) => x.getAttribute('data-plan-count'))).toContain('gold');
    // quick actions: call and WhatsApp the family contact, as links (they never open the sheet)
    expect(document.querySelector('[data-member="m1"] [data-testid="next-call"]')?.getAttribute('href')).toMatch(/^tel:\+?\d+$/);
    expect(document.querySelector('[data-member="m1"] [data-testid="next-wa"]')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    const cont = rows.length - changing.length;
    expect(document.querySelector('[data-testid="next-count"]')?.textContent).toBe(`${cont} continue · ${changing.length} change`);
    expect(document.querySelector('[data-member] [data-testid="next-status"]')).toBeTruthy();
    // the filter: Changing keeps only the changes
    await click(document.querySelector('[role="combobox"]'));
    await click(Array.from(document.querySelectorAll('[role="option"]')).find((o) => /^Changing$/.test(o.textContent || '')));
    const left = Array.from(document.querySelectorAll('[data-member]'));
    expect(left.length).toBe(changing.length);
    expect(left.every((r) => r.getAttribute('data-status') !== 'continues')).toBe(true);
    // a tap opens the follow-up sheet for that member
    await click(document.querySelector('[data-member="m1"] button[data-open]'));
    expect(document.body.textContent).toContain('Follow up Oma Lina');
  });

  it('on a past month the Members tab is not offered: the log opens on Changes', async () => {
    openClub();
    await show(<Renewals />, '/renewals');
    expect(tab(/^Members$/)).toBeTruthy();
    await click(tab(/^Changes$/));
    await click(btn(/Earlier month/));
    expect(Array.from(document.querySelectorAll('[role="tab"]')).map((x) => x.textContent)).toEqual(['Changes', 'Unpaid']);
    expect(tab(/^Changes$/)?.getAttribute('aria-selected')).toBe('true');
  });
});
