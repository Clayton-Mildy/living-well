// Admin › Settings (round 17): Membership rules (round 18: notice per kind with ask-by dates, waits for the Owner when Management changes it), Few-visits alert
// (applies at once; round 18: days before next month), Terms and conditions.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { screenFor } from '../../app/nav';
import { Settings } from './Settings';

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
let clock = { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 };
// the replica's act without the network: run the shared action on the current view, like the optimistic step does
const actMock = vi.fn();
let n = 0;
function openClub(who: 's9' | 's11' | 's1' = 's9', today = '2026-10-21') {
  clock = { ...clock, today };
  const state = structuredClone(buildSeed().citra);
  delete state.club.settings.terms; // the seed publishes version 1; this screen test starts with none
  const user = who === 's9' ? { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] }
    : who === 's11' ? { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] }
    : { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock, act: actMock } as never);
  actMock.mockImplementation(async (name: string, input: unknown) => {
    const view = useReplica.getState().view!;
    try {
      const r = execute(view, name, input, getUser({ citra: view }, who)!, { today: clock.today, nowMin: clock.startMin }, `st${++n}`);
      useReplica.setState({ view: r.state } as never);
      return { ok: true, result: r.result, reviewed: r.reviewed };
    } catch (e) { return { ok: false, code: (e as { code: string }).code, params: {} }; }
  });
}
async function show(ui: ReactElement, width: number) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/settings']}>{ui}</MemoryRouter>); });
}
const type = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const field = (k: string) => document.querySelector<HTMLInputElement>(`input[data-field="${k}"]`)!;
const sections = () => Array.from(document.querySelectorAll<HTMLElement>('section[aria-label]')).map((x) => x.getAttribute('aria-label'));
const section = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!;
const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.trim() === text);
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe.each([['phone', 390], ['wide', 1280]])('Admin › Settings (%s)', (_n, width) => {
  it('shows three groups: Membership rules, Few-visits alert, Terms and conditions', async () => {
    openClub();
    await show(<Settings />, width);
    expect(sections()).toEqual(['Membership rules', 'Few-visits alert', 'Terms and conditions']);
    for (const k of ['downgrade', 'stop', 'leave']) expect(field(k).value).toBe('14');
    expect(field('below').value).toBe('5');
    expect(field('days').value).toBe('16');
    expect(section('Few-visits alert').textContent).toContain('Flag below');
    expect(section('Few-visits alert').textContent).toContain('Alert before next month');
    expect(section('Terms and conditions').textContent).toContain('No terms yet');
    expect(button(section('Membership rules'), 'Save')).toBeUndefined(); // nothing to save until something is edited
  });

  it('Management changing the stop notice to 10 and saving shows Waiting for owner; the setting is unchanged', async () => {
    openClub('s9');
    await show(<Settings />, width);
    await type(field('stop'), '10');
    await click(button(section('Membership rules'), 'Send to owner')); // Management's change waits for the Owner: the button says so
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { notice: { stop: 10 } });
    expect(document.body.textContent).toContain('Waiting for owner');
    expect(useReplica.getState().view!.club.settings.notice).toBeUndefined();
    expect(field('stop').value).toBe('14');
  });

  it('the Owner changing the notice applies at once', async () => {
    openClub('s11');
    await show(<Settings />, width);
    await type(field('leave'), '10');
    await click(button(section('Membership rules'), 'Save')); // the Owner's own change: a plain Save
    expect(useReplica.getState().view!.club.settings.notice).toEqual({ downgrade: 14, stop: 14, leave: 10, upgrade: 1 });
    expect(document.body.textContent).not.toContain('Waiting for owner');
    expect(field('leave').value).toBe('10');
  });

  it('few-visits settings apply at once, even for Management', async () => {
    openClub('s9');
    await show(<Settings />, width);
    await type(field('below'), '4');
    await type(field('days'), '18');
    await click(button(section('Few-visits alert'), 'Save'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { fewVisits: { below: 4, daysBeforeMonth: 18 } });
    expect(useReplica.getState().view!.club.settings.fewVisits).toEqual({ below: 4, daysBeforeMonth: 18 });
    expect(document.body.textContent).not.toContain('Waiting for owner');
    expect(section('Few-visits alert').textContent).toContain('Flag below');
    expect(button(section('Few-visits alert'), 'Save')).toBeUndefined();
  });

  it('a value out of range is refused with a message and nothing is sent', async () => {
    openClub();
    await show(<Settings />, width);
    await type(field('below'), '0');
    await click(button(section('Few-visits alert'), 'Save'));
    expect(actMock).not.toHaveBeenCalled();
    expect(section('Few-visits alert').textContent).toContain('Use a whole number from 1 to 31.');
    await type(field('downgrade'), '61');
    await click(button(section('Membership rules'), 'Send to owner'));
    expect(actMock).not.toHaveBeenCalled();
    expect(section('Membership rules').textContent).toContain('Use a whole number from 1 to 60.');
  });

  it('Cancel puts the saved value back', async () => {
    openClub();
    await show(<Settings />, width);
    await type(field('days'), '20');
    await click(button(section('Few-visits alert'), 'Cancel'));
    expect(field('days').value).toBe('16');
  });
});

// round 18: notice per kind of change, each with its ask-by date; the few-visits alert as days before next month
describe.each([['phone', 390], ['wide', 1280]])('Settings › notice per kind (%s)', (_n, width) => {
  const row = (k: string) => field(k).closest<HTMLElement>('[data-setting]')!;
  it('Ega on 5 Nov: Downgrade, Stop membership and Leave at 14, each asked by 17 Nov for December', async () => {
    openClub('s9', '2026-11-05');
    await show(<Settings />, width);
    const m = section('Membership rules');
    expect(Array.from(m.querySelectorAll('input')).map((x) => x.getAttribute('aria-label')).slice(0, 3)).toEqual(['Downgrade', 'Stop membership', 'Leave (cuti)']);
    for (const k of ['downgrade', 'stop', 'leave']) {
      expect(field(k).value).toBe('14');
      expect(row(k).textContent).toContain('ask by 17 Nov');
      expect(row(k).textContent).toContain('days');
    }
    expect(row('downgrade').textContent).toContain('to a cheaper plan · ask by 17 Nov');
    expect(row('stop').textContent).toContain('last month November · ask by 17 Nov');
    expect(row('leave').textContent).toContain('December off · ask by 17 Nov');
  });
  it('Stop at 30 moves its line before saving; Save sends only the stop days', async () => {
    openClub('s9', '2026-11-05');
    await show(<Settings />, width);
    await type(field('stop'), '30');
    expect(row('stop').textContent).toContain('last month December · ask by 2 Dec'); // December's stop deadline (1 Nov) has passed: the example moves to January
    expect(row('leave').textContent).toContain('ask by 17 Nov');
    await click(button(section('Membership rules'), 'Send to owner'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { notice: { stop: 30 } });
  });
  it('Benjamin (the Owner) sees Save, not Send to owner', async () => {
    openClub('s11', '2026-11-05');
    await show(<Settings />, width);
    await type(field('stop'), '30');
    expect(button(section('Membership rules'), 'Send to owner')).toBeUndefined();
    await click(button(section('Membership rules'), 'Save'));
    expect(useReplica.getState().view!.club.settings.notice).toEqual({ downgrade: 14, stop: 30, leave: 14, upgrade: 1 });
  });
  it('round 19: Ega on 5 Nov sees Upgrade at 1 (ask by 30 Nov) and Leave in a row at 2 months', async () => {
    openClub('s9', '2026-11-05');
    await show(<Settings />, width);
    expect(Array.from(section('Membership rules').querySelectorAll('input')).map((x) => x.getAttribute('aria-label'))).toEqual(['Downgrade', 'Stop membership', 'Leave (cuti)', 'Upgrade', 'Leave in a row']);
    expect(field('upgrade').value).toBe('1');
    expect(row('upgrade').textContent).toContain('starts the next 1st · ask by 30 Nov');
    expect(row('upgrade').textContent).toContain('days');
    expect(field('leaveRun').value).toBe('2');
    expect(row('leaveRun').textContent).toContain('no word after that ends the membership');
    expect(row('leaveRun').textContent).toContain('months');
    expect(section('Membership rules').textContent).not.toContain('no notice');
  });
  it('round 19: Upgrade 5 moves its line to 26 Nov; Ega sends {notice:{upgrade:5}} to the owner', async () => {
    openClub('s9', '2026-11-05');
    await show(<Settings />, width);
    await type(field('upgrade'), '5');
    expect(row('upgrade').textContent).toContain('ask by 26 Nov');
    await click(button(section('Membership rules'), 'Send to owner'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { notice: { upgrade: 5 } });
  });
  it('round 19: Benjamin saves Upgrade 5 at once', async () => {
    openClub('s11', '2026-11-05');
    await show(<Settings />, width);
    await type(field('upgrade'), '5');
    expect(button(section('Membership rules'), 'Send to owner')).toBeUndefined();
    await click(button(section('Membership rules'), 'Save'));
    expect(useReplica.getState().view!.club.settings.notice).toMatchObject({ upgrade: 5 });
  });
  it('round 19: Leave in a row 3 sends {leaveMaxMonths:3}; 7 shows the range on blur and is not sent', async () => {
    openClub('s11', '2026-11-05');
    await show(<Settings />, width);
    await type(field('leaveRun'), '7');
    expect(section('Membership rules').textContent).not.toContain('Use a whole number from 1 to 6.');
    await act(async () => { field('leaveRun').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(section('Membership rules').textContent).toContain('Use a whole number from 1 to 6.');
    expect(field('leaveRun').getAttribute('aria-invalid')).toBe('true');
    await click(button(section('Membership rules'), 'Save'));
    expect(actMock).not.toHaveBeenCalled();
    await type(field('leaveRun'), '3');
    await click(button(section('Membership rules'), 'Save'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { leaveMaxMonths: 3 });
    expect(useReplica.getState().view!.club.settings.leaveMaxMonths).toBe(3);
  });
  it('the few-visits row shows 16 with December: alert 15 Nov · changes close 17 Nov; 10 is refused with the range', async () => {
    openClub('s9', '2026-11-05');
    await show(<Settings />, width);
    expect(field('days').value).toBe('16');
    expect(row('days').textContent).toContain('December: alert 15 Nov · changes close 17 Nov');
    await type(field('days'), '1'); // final review minor 6: no message while typing ("18" is not wrong after the "1")
    expect(section('Few-visits alert').textContent).not.toContain('Pick 14–28 days');
    expect(field('days').getAttribute('aria-invalid')).toBeNull();
    await type(field('days'), '10');
    expect(section('Few-visits alert').textContent).not.toContain('Pick 14–28 days');
    await act(async () => { field('days').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }); // leaving the field shows it
    expect(section('Few-visits alert').textContent).toContain('Pick 14–28 days: the alert has to come before changes close.');
    await click(button(section('Few-visits alert'), 'Save'));
    expect(actMock).not.toHaveBeenCalled();
    await type(field('days'), '18');
    expect(row('days').textContent).toContain('December: alert 13 Nov · changes close 17 Nov');
  });
});

describe('Settings menu', () => {
  it('management and the Owner reach it; the front desk does not', () => {
    const s = structuredClone(buildSeed().citra);
    expect(screenFor(s, 'mgmt', 'settings')).toBe('settings');
    expect(screenFor(s, 'owner', 'settings')).toBe('settings');
    expect(screenFor(s, 'lobby', 'settings')).toBeNull();
  });
});
