// Members "Check on" filter (round 15): the "Not seen for" choice sits under the filters and changes the rows.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { MembersList } from './MembersList';

const device = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/useDevice', async (orig) => {
  const m = await orig<typeof import('../../hooks/useDevice')>();
  return { ...m, useDevice: () => (device.phone ? { device: 'phone', isPhone: true, isTablet: false, isLaptop: false, isWide: false } : m.useDevice()) };
});
vi.mock('../../lib/act', () => ({ useAct: () => vi.fn(async () => ({ ok: true, result: {} })) }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  localStorage.clear();
  device.phone = false;
});

describe('Members, Check on filter', () => {
  it('"Not seen for" 7 days adds the member who has been away a week; Automatic takes them off again', async () => {
    const state = buildSeed().citra;
    for (const k of Object.keys(state.attendance)) {
      const a = state.attendance[k];
      if ((a.memberId === 'm1' && a.date > '2026-10-09') || (a.memberId === 'm2' && a.date > '2026-10-13')) delete state.attendance[k];
    }
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/members?f=checkOn']}><MembersList /></MemoryRouter>); });
    const rows = () => host!.querySelectorAll('[data-testid="member-contact"]').length;
    const pick = async (label: string) => {
      await act(async () => { (host!.querySelector('[role="combobox"][aria-labelledby]') as HTMLButtonElement).click(); });
      await act(async () => { (Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent === label) as HTMLElement).click(); });
    };
    expect(rows()).toBe(1);
    await pick('7 days');
    expect(localStorage.getItem('cp.checkOn.days')).toBe('7');
    expect(rows()).toBe(2);
    await pick('Automatic');
    expect(localStorage.getItem('cp.checkOn.days')).toBeNull();
    expect(rows()).toBe(1);
  });
});

describe.each([['laptop', false], ['phone', true]])('Members rows, nanny (%s)', (_label, phone) => {
  it('round 15 follow-up: a nanny shows her face and "Nanny · {name}" on the name line, right after the member\'s name; the others show none', async () => {
    device.phone = phone;
    const state = buildSeed().citra;
    for (const m of Object.values(state.members)) m.nanny = null;
    state.members.m1.nanny = { name: 'Mbak Sari', photoMediaId: 'md_nannyphoto0001' };
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/members?f=all']}><MembersList /></MemoryRouter>); });
    const n = host.querySelectorAll('[data-testid="row-nanny"]');
    expect(host.querySelectorAll('[data-member]').length).toBeGreaterThan(1);
    expect(n).toHaveLength(1);
    expect(n[0].textContent).toBe('Nanny · Mbak Sari');
    expect(n[0].innerHTML).toContain('md_nannyphoto0001');
    expect(n[0].closest('[data-member]')?.getAttribute('data-member')).toBe('m1');
    expect(n[0].querySelector('button')).toBeNull();
    const line = n[0].closest('[data-testid="row-name"]');
    expect(line, 'the nanny sits inside the name line').not.toBeNull();
    expect(line!.textContent).toMatch(/^Oma Lina.*Nanny · Mbak Sari$/); // after the name, not before it
  });
});

describe('Members, In the club by plan', () => {
  it('round 15: Plan = Gold narrows In the club to the Gold members who are in, and the count line follows', async () => {
    const state = buildSeed().citra;
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/members?f=in']}><MembersList /></MemoryRouter>); });
    const rows = () => Array.from(host!.querySelectorAll('[data-member]')).map((e) => e.getAttribute('data-member'));
    const group = () => host!.querySelector('[role="radiogroup"][aria-label="Plan"]') as HTMLElement;
    const chip = (label: string) => Array.from(group().querySelectorAll<HTMLElement>('[role="radio"]')).find((o) => o.textContent?.startsWith(label))!;
    const pick = async (label: string) => { await act(async () => { chip(label).click(); }); };
    expect(rows().sort()).toEqual(['m10', 'm2', 'm20']);
    expect(host.querySelector('[data-testid="members-split"]')!.textContent).toBe('1 Flex · 2 Gold');
    expect(Array.from(group().querySelectorAll('[role="radio"]')).map((o) => o.textContent)).toEqual(['All · 3', 'Flex · 1', 'Gold · 2']);
    expect(chip('All').getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('[role="combobox"][aria-labelledby]')).toBeNull(); // chips, not a dropdown
    await pick('Gold');
    expect(chip('Gold').getAttribute('aria-checked')).toBe('true');
    expect(rows().sort()).toEqual(['m2', 'm20']);
    expect(host.querySelector('[data-testid="members-split"]')!.textContent).toBe('0 Flex · 2 Gold');
    await pick('Flex');
    expect(rows()).toEqual(['m10']);
    await pick('All');
    expect(rows()).toHaveLength(3);
  });
  it('a retired plan that still has members in the club keeps its chip (a retired plan with none has no chip)', async () => {
    const state = structuredClone(buildSeed().citra);
    state.club.settings.plans = [{ id: 'plan_1', name: 'Saver 8', kind: 'days', quota: 8, active: false }, { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false }];
    state.members.m10.plans = [{ from: '2020-01-01', plan: 'plan_1', by: 'staff:s9' }]; // m10 is in the club today (Flex before)
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/members?f=in']}><MembersList /></MemoryRouter>); });
    const group = host.querySelector('[role="radiogroup"][aria-label="Plan"]') as HTMLElement;
    const chips = Array.from(group.querySelectorAll('[role="radio"]')).map((o) => o.textContent);
    expect(chips).toEqual(['All · 3', 'Flex · 0', 'Gold · 2', 'Saver 8 · 1']);
    await act(async () => { (Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).find((o) => o.textContent?.startsWith('Saver 8')))!.click(); });
    expect(Array.from(host.querySelectorAll('[data-member]')).map((e) => e.getAttribute('data-member'))).toEqual(['m10']);
  });
  it('the Plan chips show only while In the club is selected', async () => {
    const state = buildSeed().citra;
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
    useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/members?f=active']}><MembersList /></MemoryRouter>); });
    expect(host.querySelector('[role="radiogroup"][aria-label="Plan"]')).toBeNull();
  });
});
