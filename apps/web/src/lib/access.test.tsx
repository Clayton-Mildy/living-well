// Round 16: the per-screen access (mirrors the server's permit/canRun) and the granted-screen role in useMe().
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, type ClubState } from '@cp/shared';
import { screenFor } from '../app/nav';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { ScreenAccessProvider, screenAccess, useScreenAccess } from './access';
import { useMe } from './me';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

describe('screenAccess', () => {
  it('follows the defaults, an explicit cell, and never-set Off cells', () => {
    expect(screenAccess(undefined, 'lobby', 'billing', true)).toEqual({ key: 'billing', level: 'view' });
    expect(screenAccess(undefined, 'mgmt', 'receipts', true).level).toBe('view');
    expect(screenAccess(undefined, 'mgmt', 'plans', true)).toEqual({ key: 'plans', level: 'edit', roleAs: undefined });
    expect(screenAccess(undefined, 'lobby', 'budget', true)).toEqual({ key: 'budget', level: 'edit' }); // not a grid cell: `can` alone
    expect(screenAccess('off', 'lobby', 'budget', true).level).toBe('view');
    expect(screenAccess('edit', 'lobby', 'billing', true)).toEqual({ key: 'billing', level: 'edit', roleAs: 'finance' });
    expect(screenAccess('edit', 'lobby', 'members', true).roleAs).toBeUndefined(); // already Edit by default
    expect(screenAccess('edit', 'lobby', 'tasks', true)).toEqual({ key: 'tasks', level: 'edit', roleAs: undefined }); // tasks-view-edit: Tasks on Edit is never management's screen
    expect(screenAccess(undefined, 'lobby', 'tasks', true).level).toBe('view');
    expect(screenAccess(undefined, 'owner', 'billing', false).roleAs).toBe('mgmt');
    expect(screenAccess(undefined, 'owner', 'roles', false).roleAs).toBeUndefined();
    expect(screenAccess(undefined, 'family', 'billing', false).level).toBe('edit');
  });
});

function probe(who: { id: string; role: 'lobby' | 'mgmt' }, access: ClubState['club']['settings']['access'], key: string) {
  const state = buildSeed().citra;
  state.club.settings.access = access;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: who.id, name: 'X', role: who.role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: who.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 600, realStart: Date.now(), offset: 0 } });
  const out: { me?: ReturnType<typeof useMe>; acc?: ReturnType<typeof useScreenAccess> } = {};
  function Probe() { out.me = useMe(); out.acc = useScreenAccess(); return null; }
  host = document.createElement('div');
  root = createRoot(host);
  return { out, render: () => act(async () => { root!.render(<ScreenAccessProvider screenKey={key}><Probe /></ScreenAccessProvider>); }) };
}

describe('useMe on a granted screen', () => {
  it('a front-desk user granted Edit on Payments is finance there, and still lobby elsewhere', async () => {
    const p = probe({ id: 's1', role: 'lobby' }, { lobby: { payments: 'edit' } }, 'payments');
    await p.render();
    expect(p.out.acc).toEqual({ key: 'payments', level: 'edit', roleAs: 'finance' });
    expect(p.out.me!.role).toBe('finance');
    expect(p.out.me!.realRole).toBe('lobby');
    expect(p.out.me!.navRole).toBe('lobby');
    expect(p.out.me!.user!.kind === 'staff' && p.out.me!.user!.staff.role).toBe('finance');
    await act(async () => { root!.unmount(); });
    const q = probe({ id: 's1', role: 'lobby' }, { lobby: { payments: 'edit' } }, 'members');
    await q.render();
    expect(q.out.me!.role).toBe('lobby');
  });
  it('Caca on Billing (default View) is lobby with level view', async () => {
    const p = probe({ id: 's1', role: 'lobby' }, undefined, 'billing');
    await p.render();
    expect(p.out.acc).toEqual({ key: 'billing', level: 'view' });
    expect(p.out.me!.role).toBe('lobby');
  });
  it('round 16 review: a lobby user granted Edit on Billing keeps routes of the real role (not finance), so the screen opens', async () => {
    const p = probe({ id: 's1', role: 'lobby' }, { lobby: { billing: 'edit' } }, 'billing');
    await p.render();
    expect(p.out.acc).toEqual({ key: 'billing', level: 'edit', roleAs: 'finance' });
    expect(p.out.me!.role).toBe('finance');
    expect(p.out.me!.navRole).toBe('lobby');
    const club = useReplica.getState().view as ClubState;
    expect(screenFor(club, 'lobby', 'billing')).toBe('fin');
    expect(screenFor(club, p.out.me!.role!, 'billing')).toBeNull(); // the old lookup: Today
  });
});
