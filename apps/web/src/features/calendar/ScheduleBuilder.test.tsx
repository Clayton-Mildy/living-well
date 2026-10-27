// Weekly schedule builder (round 14): the activity team's Publish is "Send to Ega"; a version that waits shows "Waiting for Ega".
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, toMin, type ClubState } from '@cp/shared';
import { builderDays, pendingVersions } from '@cp/shared/rules/calendar';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ScheduleBuilder } from './ScheduleBuilder';

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

const actMock = vi.fn(async (_name: string, _input: unknown): Promise<{ ok: true; result: Record<string, unknown> }> => ({ ok: true as const, result: { versionId: 'sched-x', pending: true } }));
function openClub(state: ClubState, who: 'activity' | 'mgmt' = 'activity') {
  actMock.mockReset();
  actMock.mockImplementation(async () => ({ ok: true as const, result: { versionId: 'sched-x', pending: true } }));
  const id = who === 'mgmt' ? 's9' : 's5';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id, name: who === 'mgmt' ? 'Ega' : 'Dinar', role: who, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
const clock = { today: '2026-10-21', nowMin: toMin('09:58') };
/** Dinar's draft for this week: Friday 13:30 becomes the reading circle. */
function withDraft(): ClubState {
  const s = buildSeed().citra;
  const days = builderDays(s);
  days[5]['13:30'] = { activityId: 'act-reading', staffId: 's6', roomId: 'room-lounge' };
  return execute(s, 'schedule.saveDraft', { days, effectiveFrom: '2026-10-21' }, getUser({ citra: s }, 's5')!, clock, 'w1').state;
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const buttons = (re: RegExp, scope: ParentNode = document) => Array.from(scope.querySelectorAll('button')).filter((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));

describe('ScheduleBuilder for the activity team', () => {
  it('the publish button reads "Send to Ega" and sends the draft with schedule.publish (no catalog, no notify switch)', async () => {
    openClub(withDraft());
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    expect(document.body.textContent).toContain('1 change not yet published');
    expect(buttons(/Publish to staff and families/)).toHaveLength(0);
    expect(buttons(/Activities and rooms/)).toHaveLength(0);
    const send = buttons(/Send to Ega$/);
    expect(send).toHaveLength(1);
    await act(async () => { send[0].click(); });
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Send the weekly schedule to Ega');
    expect(dialog.querySelector('[role="switch"]')).toBeNull();
    await act(async () => { buttons(/Send to Ega$/, dialog)[0].click(); });
    const call = actMock.mock.calls.find(([name]) => name === 'schedule.publish');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ effectiveFrom: '2026-10-21' });
    expect(call![1]).not.toHaveProperty('notify');
  });

  it('a version that waits shows "Waiting for Ega" above the builder', async () => {
    const s = withDraft();
    openClub(execute(s, 'schedule.publish', { effectiveFrom: '2026-10-21' }, getUser({ citra: s }, 's5')!, clock, 'w2').state);
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    expect(document.querySelector('[data-testid="programme-waiting"]')?.textContent).toContain('Waiting for Ega');
  });
});

// Round 15 (phase 2, task 4): management reviews the version inside the Calendar, with the same approval actions as Approvals.
describe('ScheduleBuilder: the proposed week', () => {
  const waitingState = () => { const s = withDraft(); return execute(s, 'schedule.publish', { effectiveFrom: '2026-10-21' }, getUser({ citra: s }, 's5')!, clock, 'w2').state; };
  const typeInto = async (el: HTMLElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
  };

  it('management sees "See proposed week"; the proposed grid shows a changed cell struck through before, then after; the button toggles back', async () => {
    openClub(waitingState(), 'mgmt');
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    expect(document.querySelectorAll('[data-proposed-cell]')).toHaveLength(0);
    const see = buttons(/See proposed week/);
    expect(see).toHaveLength(1);
    await act(async () => { see[0].click(); });
    const cells = Array.from(document.querySelectorAll('[data-proposed-cell]'));
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttribute('data-proposed-cell')).toBe('5|13:30');
    expect(cells[0].querySelector('s')?.textContent).toBeTruthy();
    expect(cells[0].textContent).toContain('Reading');
    expect(buttons(/See current week/)).toHaveLength(1);
    await act(async () => { buttons(/See current week/)[0].click(); });
    expect(document.querySelectorAll('[data-proposed-cell]')).toHaveLength(0);
  });

  it('Approve calls approval.approve for the programme version', async () => {
    const s = waitingState();
    openClub(s, 'mgmt');
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    actMock.mockImplementationOnce(async () => ({ ok: true as const, result: { approved: 1 } }));
    await act(async () => { buttons(/^Approve$/)[0].click(); });
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'programme', ids: [pendingVersions(s)[0].id] });
  });

  it('Reject needs a reason, then calls approval.reject with it', async () => {
    const s = waitingState();
    openClub(s, 'mgmt');
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    await act(async () => { buttons(/^Reject$/)[0].click(); });
    const field = document.querySelector<HTMLInputElement>('[data-testid="proposal-reason"] input')!;
    expect(field).toBeTruthy();
    const confirm = buttons(/^Reject$/).find((b) => b.closest('[data-testid="proposal-reason"]'))!;
    await act(async () => { confirm.click(); });
    expect(actMock.mock.calls.some(([n]) => n === 'approval.reject')).toBe(false);
    await typeInto(field, '   ');
    await act(async () => { confirm.click(); });
    expect(actMock.mock.calls.some(([n]) => n === 'approval.reject')).toBe(false);
    await typeInto(field, 'Keep Friday as it is');
    await act(async () => { confirm.click(); });
    expect(actMock).toHaveBeenCalledWith('approval.reject', { type: 'programme', ids: [pendingVersions(s)[0].id], reason: 'Keep Friday as it is' });
  });

  it('the activity team sees the proposed grid but no Approve or Reject', async () => {
    openClub(waitingState(), 'activity');
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    await act(async () => { buttons(/See proposed week/)[0].click(); });
    expect(document.querySelectorAll('[data-proposed-cell]')).toHaveLength(1);
    expect(buttons(/^Approve$/)).toHaveLength(0);
    expect(buttons(/^Reject$/)).toHaveLength(0);
  });

  it('a version that was decided meanwhile shows the conflict message, as in Approvals', async () => {
    openClub(waitingState(), 'mgmt');
    await show(<ScheduleBuilder week="2026-10-19" onWeek={() => {}} />);
    actMock.mockImplementationOnce(async () => ({ ok: true as const, result: { approved: 0, skipped: [], conflicts: ['sched-x'] } }));
    await act(async () => { buttons(/^Approve$/)[0].click(); });
    expect(document.querySelector('[data-testid="proposal-conflict"]')?.textContent).toContain('1 not approved');
  });
});
