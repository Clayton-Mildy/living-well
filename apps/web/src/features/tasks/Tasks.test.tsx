// The Tasks screen: a role's own day (the general duties, then the additional tasks to tick off), and management's Team (day / week / month) and Manage (duties on or off, times) views.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { DUTIES } from '@cp/shared/rules/tasks';
import { Tasks } from './Tasks';

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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { period: '2026-10-21' } }));
function openClub(id: string, role: string) {
  const state = buildSeed().citra;
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id, name: id, role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function show(ui: ReactElement, url = '/tasks') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
function Where() { const l = useLocation(); return <span data-testid="where">at {l.pathname}</span>; }
async function showWithLocation(ui: ReactElement, url = '/tasks') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/tasks" element={ui} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>); });
  return { container: host };
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const tab = (name: RegExp) => Array.from(document.querySelectorAll('[role="tab"]')).find((b) => name.test(b.textContent || ''));

describe('Tasks: my day', () => {
  it('shows today’s duties first (late ones with a rust dot and their time), then the additional tasks with who ticked what', async () => {
    openClub('s1', 'lobby');
    await show(<Tasks />);
    expect(document.querySelector('[role="status"]')?.textContent).toMatch(/^0 of 4 done/); // the duty score: the check-out, two guests, the renewals
    const heads = Array.from(document.querySelectorAll('h2')).map((h) => h.textContent);
    expect(heads).toEqual(['Today’s duties', 'Additional tasks']); // duties first
    const renewals = document.querySelector('[data-duty="lobby.renewals"]')!;
    expect(renewals.textContent).toContain('Renewals followed up');
    expect(renewals.textContent).toContain('Late · By 09:00'); // 09:58 now
    expect(renewals.hasAttribute('data-late')).toBe(true);
    expect(renewals.querySelector('[data-late]')).toBeTruthy(); // the rust dot
    expect(document.querySelector('[data-duty="lobby.checkout"]')?.textContent).toContain('By 16:30'); // waiting for its time: no dot
    expect(document.querySelector('[data-duty="lobby.checkout"]')?.hasAttribute('data-late')).toBe(false);
    expect(document.querySelectorAll('[data-duty="lobby.guests"]').length).toBeGreaterThan(0); // one row per guest
    expect(document.querySelector('[data-task="task-lobby-desk"][data-done]')?.textContent).toContain('Caca · 08:22');
    expect(document.querySelector('[data-task="task-lobby-photo"]:not([data-done])')?.textContent).toContain('Photo');
    expect(document.querySelector('[role="tablist"]')).toBeNull(); // Mine only: Team and Manage are management's
  });

  it('a duty row goes to the place where it is done', async () => {
    openClub('s1', 'lobby');
    const { container } = await showWithLocation(<Tasks />);
    await click(document.querySelector('[data-duty="lobby.renewals"]'));
    expect(container.textContent).toContain('at /renewals');
  });

  it('a done duty shows a check and who and when; the kitchen’s lunch photo is its own duty', async () => {
    openClub('s2', 'kitchen');
    const state = useReplica.getState().view!;
    const posted = produce(state, (d) => {
      d.photos.pl = { id: 'pl', clubId: d.clubId, createdAt: '2026-10-21T08:30', createdBy: 'staff:s2', date: '2026-10-21', time: '08:30', kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [], tone: 3, takenBy: 's2', visibility: 'pending' };
      d.dayMenus['2026-10-21'] = { id: '2026-10-21', clubId: d.clubId, createdAt: '', createdBy: 'system', date: '2026-10-21', allergyPlans: [], photoIds: ['pl'] };
    });
    useReplica.setState({ confirmed: posted, view: posted });
    await show(<Tasks />);
    const row = document.querySelector('[data-duty="kitchen.lunchPhoto"]')!;
    expect(row.hasAttribute('data-done')).toBe(true);
    expect(row.textContent).toContain('Yohanes · 08:30');
    expect(document.querySelector('[data-duty="kitchen.teaPhoto"]')?.textContent).toContain('By 15:15');
  });

  it('a task without proof ticks off with one tap; a proof task asks for the photo first', async () => {
    openClub('s8', 'nurse');
    await show(<Tasks />);
    expect(btn(/Mark done: Check the PC-303/)).toBeUndefined(); // ticked in the seed: no circle to tap
    await click(btn(/Mark done: Restock the first-aid kit/));
    expect(actMock).toHaveBeenCalledWith('task.done', { templateId: 'task-nurse-firstaid' });
  });

  it('a proof task opens the camera instead of ticking at once', async () => {
    openClub('s1', 'lobby');
    await show(<Tasks />);
    await click(btn(/Take photo and mark done: Photo of the tidy lobby/));
    expect(actMock).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('opening a ticked task shows who and when, and the person who ticked it can take it back', async () => {
    openClub('s1', 'lobby');
    await show(<Tasks />);
    await click(document.querySelector('[data-task="task-lobby-desk"] .cp-tap-target'));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Caca · 08:22');
    await click(btn(/Mark as not done/));
    expect(actMock).toHaveBeenCalledWith('task.undo', { templateId: 'task-lobby-desk', period: '2026-10-21' });
  });
});

describe('Tasks: management', () => {
  it('Team: the roles in a list with their people and duty score, the chosen role beside it with tabs; housekeeping has no app login (additional tasks only)', async () => {
    openClub('s9', 'mgmt');
    await show(<Tasks />, '/tasks?view=team');
    expect(tab(/Team/)?.getAttribute('aria-selected')).toBe('true');
    const roles = Array.from(document.querySelectorAll('[data-role-row]')).map((e) => e.getAttribute('data-role-row'));
    expect(roles).toEqual(['lobby', 'nurse', 'activity', 'kitchen', 'housekeeping', 'driver', 'finance', 'mgmt']);
    const hk = document.querySelector('[data-role-row="housekeeping"]')!;
    expect(hk.textContent).toContain('no app login');
    expect(hk.textContent).toContain('0 of 2 done');
    expect(document.querySelector('[data-role-row="activity"]')?.textContent).toMatch(/0 of 6 done/); // two session pictures, two joined marks, lunch, mood
    // one role's details at a time, beside the list (the first late role opens first)
    expect(document.querySelectorAll('[data-role]')).toHaveLength(1);
    await click(document.querySelector('[data-role-row="finance"]'));
    expect(document.querySelector('[data-role]')?.getAttribute('data-role')).toBe('finance');
    await click(tab(/^Additional tasks/));
    expect(document.querySelector('[data-role="finance"] [data-task="task-finance-bank"]')?.textContent).toContain('Overdue');
    await click(document.querySelector('[data-role-row="kitchen"]'));
    expect(document.querySelector('[data-task="task-kitchen-fridge"]')?.textContent).toContain('08:12'); // the tab stays on additional tasks
    await click(tab(/^Duties/));
    const lunch = document.querySelector('[data-role="kitchen"] [data-duty="kitchen.lunchPhoto"]')!;
    expect(lunch.textContent).toContain('Photo of lunch');
    expect(lunch.textContent).toContain('0 of 1');
    // housekeeping has only additional tasks: no tabs, the tasks straight away
    await click(document.querySelector('[data-role-row="housekeeping"]'));
    expect(document.querySelectorAll('[data-role="housekeeping"] [data-task]').length).toBe(2);
  });

  it('Team: a day, a week or a month; a past day is read from the data and a duty only today can tell shows a dash', async () => {
    openClub('s9', 'mgmt');
    await show(<Tasks />, '/tasks?view=team');
    // week: a percentage in the list, "18 of 20 · 90%" per duty; today-only duties are left out with a dash
    await click(tab(/^Week$/));
    const nurse = document.querySelector('[data-role-row="nurse"]')!;
    expect(nurse.textContent).toMatch(/\d+%/);
    await click(nurse);
    expect(document.querySelector('[data-role="nurse"] [data-duty="nurse.arrival"]')?.textContent).toMatch(/Arrival check for everyone who came.*\d+ of \d+ · \d+%/);
    await click(document.querySelector('[data-role-row="finance"]'));
    expect(document.querySelector('[data-role="finance"] [data-duty="finance.overdue"]')?.textContent).toContain('—');
    await click(tab(/^Month$/));
    expect(document.body.textContent).toContain('October 2026');
    await click(tab(/^Day$/));
    expect(document.querySelectorAll('[data-role-row]').length).toBeGreaterThan(5);
  });

  it('Manage: the roles in a list; a role’s general duties (switch and time) and its additional tasks in tabs; Add a task for that role', async () => {
    openClub('s9', 'mgmt');
    await show(<Tasks />, '/tasks?view=manage');
    expect(document.querySelectorAll('[data-role-row]')).toHaveLength(8);
    expect(document.querySelector('[data-role-row="nurse"]')?.textContent).toMatch(/2 of 2 duties on · 3 additional tasks/);
    // the first role is open on its general duties, every one with a switch and (while on) a time
    expect(document.querySelector('[data-role]')?.getAttribute('data-role')).toBe('lobby');
    expect(document.querySelectorAll('[data-role="lobby"] [data-duty] [role="switch"]').length).toBe(DUTIES.filter((d) => d.role === 'lobby').length);
    await click(document.querySelector('[data-role-row="kitchen"]'));
    const lunch = document.querySelector('[data-duty="kitchen.lunchPhoto"]')!;
    expect(lunch.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    expect(lunch.textContent).toContain('12:30'); // its default time
    await click(lunch.querySelector('[role="switch"]'));
    expect(actMock).toHaveBeenCalledWith('duty.configure', { id: 'kitchen.lunchPhoto', off: true });
    actMock.mockClear();
    await click(document.querySelector('[data-role-row="activity"]'));
    expect(document.querySelector('[data-duty="activity.pictures"]')?.textContent).toContain('After each session'); // no time of its own
    // the nurse's additional tasks
    await click(document.querySelector('[data-role-row="nurse"]'));
    await click(tab(/^Additional tasks/));
    expect(document.querySelectorAll('[data-template]')).toHaveLength(3);
    expect(document.querySelector('[data-template="task-nurse-thermo"]')?.textContent).toContain('Monthly · Day 1');
    await click(btn(/Add a task for Nurse/));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('New task');
    await click(btn(/Save task/));
    expect(actMock).not.toHaveBeenCalled(); // a name is required
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'Wipe the handrails');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(btn(/Save task/));
    expect(actMock).toHaveBeenCalledWith('task.saveTemplate', { title: 'Wipe the handrails', role: 'nurse', every: 'daily', proof: 'none', active: true });
  });
});
