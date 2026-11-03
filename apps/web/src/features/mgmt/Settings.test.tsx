// Admin › Settings (round 17): Membership rules (notice period, waits for the Owner when Management changes it), Few-visits alert (applies at once), Terms and conditions.
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
const clock = { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 };
// the replica's act without the network: run the shared action on the current view, like the optimistic step does
const actMock = vi.fn();
let n = 0;
function openClub(who: 's9' | 's11' | 's1' = 's9') {
  const state = structuredClone(buildSeed().citra);
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
    expect(field('notice').value).toBe('14');
    expect(field('below').value).toBe('5');
    expect(field('days').value).toBe('2');
    expect(section('Few-visits alert').textContent).toContain('Flag below');
    expect(section('Few-visits alert').textContent).toContain('days before the last change day');
    expect(section('Terms and conditions').textContent).toContain('No terms yet');
    expect(button(section('Membership rules'), 'Save')).toBeUndefined(); // nothing to save until something is edited
  });

  it('Management changing the notice to 10 and saving shows Waiting for owner; the setting is unchanged', async () => {
    openClub('s9');
    await show(<Settings />, width);
    await type(field('notice'), '10');
    await click(button(section('Membership rules'), 'Save'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { noticeDays: 10 });
    expect(document.body.textContent).toContain('Waiting for owner');
    expect(useReplica.getState().view!.club.settings.noticeDays).toBeUndefined();
    expect(field('notice').value).toBe('14');
  });

  it('the Owner changing the notice applies at once', async () => {
    openClub('s11');
    await show(<Settings />, width);
    await type(field('notice'), '10');
    await click(button(section('Membership rules'), 'Save'));
    expect(useReplica.getState().view!.club.settings.noticeDays).toBe(10);
    expect(document.body.textContent).not.toContain('Waiting for owner');
    expect(field('notice').value).toBe('10');
  });

  it('few-visits settings apply at once, even for Management', async () => {
    openClub('s9');
    await show(<Settings />, width);
    await type(field('below'), '4');
    await type(field('days'), '3');
    await click(button(section('Few-visits alert'), 'Save'));
    expect(actMock).toHaveBeenCalledWith('club.updateSettings', { fewVisits: { below: 4, daysBeforeDeadline: 3 } });
    expect(useReplica.getState().view!.club.settings.fewVisits).toEqual({ below: 4, daysBeforeDeadline: 3 });
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
    await type(field('notice'), '61');
    await click(button(section('Membership rules'), 'Save'));
    expect(actMock).not.toHaveBeenCalled();
    expect(section('Membership rules').textContent).toContain('Use a whole number from 1 to 60.');
  });

  it('Cancel puts the saved value back', async () => {
    openClub();
    await show(<Settings />, width);
    await type(field('days'), '7');
    await click(button(section('Few-visits alert'), 'Cancel'));
    expect(field('days').value).toBe('2');
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
