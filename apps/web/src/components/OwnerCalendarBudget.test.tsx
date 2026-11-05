// Owner approvals (KC): a waiting closed day sits at the top of Calendar and a waiting weekly limit on its Budget card; the Owner approves there, the asker withdraws.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, live, weekStart, type ClubState } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { Calendar } from '../features/calendar';
import { Budget } from '../features/finance/Budget';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; document.body.innerHTML = ''; });
const clock = { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 };
const actMock = vi.fn();
let n = 0;
function open(who: 's9' | 's11', ask: (s: ClubState) => ReturnType<typeof execute>) {
  const seeded = structuredClone(buildSeed().citra);
  const state = ask(seeded).state;
  const user = who === 's9' ? { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] }
    : { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock, act: actMock } as never);
  actMock.mockImplementation(async (name: string, input: unknown) => {
    const view = useReplica.getState().view!;
    try {
      const r = execute(view, name, input, getUser({ citra: view }, who)!, { today: clock.today, nowMin: clock.startMin }, `oc${++n}`);
      useReplica.setState({ view: r.state } as never);
      return { ok: true, result: r.result, reviewed: r.reviewed };
    } catch (e) { return { ok: false, code: (e as { code: string }).code, params: {} }; }
  });
}
const askClose = (s: ClubState) => execute(s, 'calendarEvent.create', { date: '2027-01-14', kind: 'closed', title: 'Staff training day' }, getUser({ citra: s }, 's9')!, { today: clock.today, nowMin: clock.startMin }, `oc${++n}`);
const askLimit = (s: ClubState) => execute(s, 'budget.setLimit', { sectionId: 'fnb', weekly: 9_000_000, fromWeek: weekStart(clock.today) }, getUser({ citra: s }, 's9')!, { today: clock.today, nowMin: clock.startMin }, `oc${++n}`);
async function show(ui: ReactElement, width: number, path: string) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>); });
}
const button = (re: RegExp) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => re.test(b.textContent?.trim() || ''));

describe.each([['phone', 390], ['wide', 1280]])('owner requests on Calendar and Budget (%s)', (_n, width) => {
  it('the Owner sees the closed day at the top of Calendar and Approve creates it', async () => {
    open('s11', askClose);
    await show(<Calendar />, width, '/calendar');
    const box = document.querySelector('[data-owner-request]')!;
    expect(box.textContent).toContain('Staff training day');
    expect(box.textContent).toContain('DateThu 14 Jan');
    await act(async () => { button(/^Approve$/)!.click(); });
    expect(actMock.mock.calls[0][0]).toBe('review.approve');
    expect(live(useReplica.getState().view!.calendarEvents).some((e) => e.title === 'Staff training day' && e.kind === 'closed')).toBe(true);
  });
  it('Management sees Withdraw on Calendar, not Approve', async () => {
    open('s9', askClose);
    await show(<Calendar />, width, '/calendar');
    expect(document.querySelector('[data-owner-request]')).toBeTruthy();
    expect(button(/^Withdraw$/)).toBeTruthy();
    expect(button(/^Approve$/)).toBeUndefined();
  });
  it('a limit request on Budget shows old to new and the Owner can Approve', async () => {
    open('s11', askLimit);
    await show(<Budget />, width, '/budget');
    const box = document.querySelector('[data-owner-request]')!;
    expect(box.textContent).toContain('→');
    expect(box.textContent).toContain((9_000_000).toLocaleString('id-ID'));
    expect(button(/^Approve$/)).toBeTruthy();
  });
});
