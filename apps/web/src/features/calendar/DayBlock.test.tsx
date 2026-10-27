// Round 15 (phase 2, task 4): a day the activity team changed shows its proposed programme, "Proposed", before → after; management can approve or reject it there.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, toMin, type ClubState } from '@cp/shared';
import { dayInfo } from '@cp/shared/rules/calendar';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Calendar } from './Calendar';
import { DayBlock } from './DayBlock';
import { DaySheet } from './DaySheet';

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

const DATE = '2026-10-23'; // a Friday, two days ahead
const clock = { today: '2026-10-21', nowMin: toMin('09:58') };
const actMock = vi.fn(async (_name: string, _input: unknown): Promise<{ ok: true; result: Record<string, unknown> }> => ({ ok: true as const, result: { approved: 1 } }));
/** Dinar (activity) removes the Friday 10:30 session for that day only: the change waits for Ega. */
function pendingDay(): ClubState {
  const s = buildSeed().citra;
  return execute(s, 'schedule.changeDay', { date: DATE, slot: '10:30', cell: null, note: 'Teacher away', notify: true }, getUser({ citra: s }, 's5')!, clock, 'd1').state;
}
function openClub(state: ClubState, who: 'activity' | 'mgmt') {
  actMock.mockClear();
  const id = who === 'mgmt' ? 's9' : 's5';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id, name: who === 'mgmt' ? 'Ega' : 'Dinar', role: who, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function show(state: ClubState, who: 'activity' | 'mgmt' = 'activity') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><DayBlock s={state} info={dayInfo(state, DATE)} today="2026-10-21" canEdit onEdit={() => {}} flag="Proposed" proposed={!!state.scheduleDays?.[DATE]?.pending} decide={who === 'mgmt'} /></MemoryRouter>); });
}
const buttons = (re: RegExp, scope: ParentNode = document) => Array.from(scope.querySelectorAll('button')).filter((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));

describe('DayBlock: a pending day', () => {
  it('shows "Proposed" with the session before (struck through) and after', async () => {
    const s = pendingDay();
    openClub(s, 'activity');
    await show(s, 'activity');
    const card = document.querySelector('[data-testid="proposed-day"]')!;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Proposed');
    expect(card.querySelector('s')?.textContent).toBeTruthy();
    expect(card.textContent).toContain('No session');
    expect(card.textContent).toContain('Teacher away');
    expect(buttons(/^Approve$/)).toHaveLength(0); // the activity team only sees it
  });

  it('management approves the day with approval.approve for that date', async () => {
    const s = pendingDay();
    openClub(s, 'mgmt');
    await show(s, 'mgmt');
    await act(async () => { buttons(/^Approve$/)[0].click(); });
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'programme', ids: [DATE] });
  });

  it('management rejects the day with a reason', async () => {
    const s = pendingDay();
    openClub(s, 'mgmt');
    await show(s, 'mgmt');
    await act(async () => { buttons(/^Reject$/)[0].click(); });
    const field = document.querySelector<HTMLInputElement>('[data-testid="proposal-reason"] input')!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { set.call(field, 'Keep the session'); field.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { buttons(/^Reject$/).find((b) => b.closest('[data-testid="proposal-reason"]'))!.click(); });
    expect(actMock).toHaveBeenCalledWith('approval.reject', { type: 'programme', ids: [DATE], reason: 'Keep the session' });
  });

  it('a day with nothing waiting has no proposed card', async () => {
    const s = buildSeed().citra;
    openClub(s, 'mgmt');
    await show(s, 'mgmt');
    expect(document.querySelector('[data-testid="proposed-day"]')).toBeNull();
  });

  it('the Calendar list marks the day "Proposed" for management', async () => {
    const s = pendingDay();
    openClub(s, 'mgmt');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><Calendar /></MemoryRouter>); });
    expect(document.body.textContent).toContain('Proposed');
  });

  it('management also approves it from the day sheet; the activity team does not get the buttons there', async () => {
    const s = pendingDay();
    openClub(s, 'mgmt');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><DaySheet open onClose={() => {}} date={DATE} slot="10:30" /></MemoryRouter>); });
    await act(async () => { buttons(/^Approve$/)[0].click(); });
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'programme', ids: [DATE] });
    await act(async () => { root?.unmount(); });
    openClub(s, 'activity');
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><DaySheet open onClose={() => {}} date={DATE} slot="10:30" /></MemoryRouter>); });
    expect(buttons(/^Approve$/)).toHaveLength(0);
  });
});

describe('DayBlock: the lunch picture (round 15)', () => {
  it('a day whose lunch has a picture gets a Lunch row at 12:00 with it; the day\'s own lunch photo replaces the dish photo (staff see a pending one)', async () => {
    const s = buildSeed().citra; // Friday 23 Oct: gado-gado is the main dish, with its demo picture
    openClub(s, 'activity');
    await show(s);
    const row = document.querySelector('[data-testid="day-lunch"]');
    expect(row?.getAttribute('data-source')).toBe('dish');
    expect(row?.querySelector('[data-testid="day-lunch-picture"]')?.getAttribute('data-media')).toBe('md_demo_food-gado');
    expect(row?.textContent).toContain('Gado-gado');
    await act(async () => { root?.unmount(); });
    host?.remove();
    const pending = structuredClone(s); // the kitchen's photo of the day, waiting for approval
    pending.photos['ph-k'] = { id: 'ph-k', clubId: 'citra', createdAt: `${DATE}T09:00`, createdBy: 'staff:s3', date: DATE, time: '09:00', kind: 'lunch', media: 'photo', memberIds: [], tone: 0, takenBy: 's3', visibility: 'pending', mediaId: 'md_kitchen_photo' } as never;
    pending.dayMenus[DATE] = { id: DATE, clubId: 'citra', createdAt: `${DATE}T09:00`, createdBy: 'staff:s3', date: DATE, allergyPlans: [], photoIds: ['ph-k'] } as never;
    openClub(pending, 'activity');
    await show(pending);
    const now = document.querySelector('[data-testid="day-lunch"]');
    expect(now?.getAttribute('data-source')).toBe('lunch');
    expect(now?.querySelector('[data-testid="day-lunch-picture"]')?.getAttribute('data-media')).toBe('md_kitchen_photo');
  });
});
