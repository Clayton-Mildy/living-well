// Weekly schedule builder (round 14): the activity team's Publish is "Send to Ega"; a version that waits shows "Waiting for Ega".
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, toMin, type ClubState } from '@cp/shared';
import { builderDays } from '@cp/shared/rules/calendar';
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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { versionId: 'sched-x', pending: true } }));
function openClub(state: ClubState) {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Dinar', role: 'activity', clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
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
