// Few visits (round 19, task 5): its own button first in the Members tab's chip row (the round 17 card above the tabs is gone).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ClubState } from '@cp/shared';
import { withFewVisits } from '@cp/shared/rules/testFewVisits';
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
  document.body.innerHTML = '';
  root = null;
  host = null;
});

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: {} }));
function openClub(today: string, state: ClubState = withFewVisits()) {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today, startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
const Where = () => <span data-testid="where">{useLocation().pathname + useLocation().search}</span>;
async function show(ui: ReactElement, at = '/renewals') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[at]}>{ui}<Where /></MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const few = () => document.querySelector<HTMLElement>('[data-testid="few-btn"]');
const fewText = () => few()?.querySelector('[data-testid="few-btn-text"]')?.textContent;
const where = () => document.querySelector('[data-testid="where"]')!.textContent;
const sheet = () => document.querySelector('[data-testid="few-list"]');
const noCalls = (): ClubState => ({ ...withFewVisits(), visitCalls: {} });

describe('the Few visits button on Next month', () => {
  it('before the alert day it is a grey button "Few visits · opens 15 Nov", first in the chip row before the plan chips, never a toggle', async () => {
    openClub('2026-11-10');
    await show(<Renewals />);
    const b = few()!;
    expect(b.tagName).toBe('BUTTON');
    expect(fewText()).toBe('Few visits · opens 15 Nov');
    expect(b.getAttribute('data-phase')).toBe('before');
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    expect(b.style.background).not.toContain('rgb(36, 32, 28)'); // grey, not ink
    const row = document.querySelector('[data-testid="next-plans"]')!;
    expect(row.contains(b)).toBe(true);
    const firstChip = row.querySelector('[data-plan-count]')!;
    expect(b.compareDocumentPosition(firstChip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.querySelector('[data-testid="few-divider"]')).toBeTruthy();
  });

  it('from the alert day it is ink and reads "Few visits · 6", then " · 1 called" once someone is called; after the last change day "6 · 0 called"', async () => {
    openClub('2026-11-15', noCalls());
    await show(<Renewals />);
    expect(fewText()).toBe('Few visits · 6');
    expect(few()?.getAttribute('data-phase')).toBe('open');
    expect(few()?.style.background).toContain('rgb(36, 32, 28)');
    await act(async () => { root?.unmount(); });
    host?.remove();
    openClub('2026-11-15');
    await show(<Renewals />);
    expect(fewText()).toBe('Few visits · 6 · 1 called');
    await act(async () => { root?.unmount(); });
    host?.remove();
    openClub('2026-11-20');
    await show(<Renewals />);
    expect(fewText()).toBe('Few visits · 6 · 1 called');
    expect(few()?.getAttribute('data-phase')).toBe('closed');
    await act(async () => { root?.unmount(); });
    host?.remove();
    openClub('2026-11-20', noCalls());
    await show(<Renewals />);
    expect(fewText()).toBe('Few visits · 6 · 0 called');
  });

  it('a tap opens the few-visits list (?few=1); the old full-width card is gone', async () => {
    openClub('2026-11-15');
    await show(<Renewals />);
    expect(document.querySelector('[data-testid="few-card"]')).toBeNull();
    expect(sheet()).toBeNull();
    await click(few());
    expect(where()).toBe('/renewals?few=1');
    expect(sheet()).toBeTruthy();
  });

  it('the deep link /renewals?few=1 still opens the list (the notification and Also today use it)', async () => {
    openClub('2026-11-15');
    await show(<Renewals />, '/renewals?few=1');
    expect(sheet()).toBeTruthy();
  });

  it('before the alert day it still opens the list', async () => {
    openClub('2026-11-10');
    await show(<Renewals />);
    await click(few());
    expect(sheet()).toBeTruthy();
  });

  it('no button when nobody is flagged', async () => {
    const none: ClubState = { ...withFewVisits(), visitCalls: {}, attendance: Object.fromEntries(Object.entries(withFewVisits().attendance).filter(([, a]) => !a.memberId.startsWith('fv'))) };
    none.members = Object.fromEntries(Object.entries(none.members).filter(([id]) => !id.startsWith('fv')));
    openClub('2026-11-15', none);
    await show(<Renewals />);
    expect(document.querySelector('[data-testid="next-plans"]')).toBeTruthy();
    expect(few()).toBeNull();
    expect(document.querySelector('[data-testid="few-divider"]')).toBeNull();
  });

  it('a past month shows no button', async () => {
    openClub('2026-11-15');
    await show(<Renewals />, '/renewals?tab=changes');
    await click(Array.from(document.querySelectorAll('button')).find((b) => /Earlier month/.test(b.getAttribute('aria-label') || '')));
    expect(few()).toBeNull();
  });
});
