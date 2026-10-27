// Members "Check on" filter (round 15): the "Not seen for" choice sits under the filters and changes the rows.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { MembersList } from './MembersList';

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

describe('Members rows, nanny', () => {
  it('round 15: a member with a nanny shows her face and "with {name}" on the row; the others show none', async () => {
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
    expect(n[0].textContent).toBe('with Mbak Sari');
    expect(n[0].innerHTML).toContain('md_nannyphoto0001');
    expect(n[0].closest('[data-member]')?.getAttribute('data-member')).toBe('m1');
    expect(n[0].querySelector('button')).toBeNull();
  });
});
