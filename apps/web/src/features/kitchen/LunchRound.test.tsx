// Round 14: the F&B team's lunch round. One row per person who came: how much they ate (one tap) and a lunch face; it opens at 11:30.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { LunchRound } from './LunchRound';

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
  root = null;
  host = null;
  document.body.innerHTML = '';
});

async function show(startMin: number) {
  const state = buildSeed().citra;
  const mock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true, result: {} }));
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's2', name: 'Yohanes', role: 'kitchen', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's2', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin, realStart: Date.now(), offset: 0 }, act: mock as never });
  (window as { innerWidth: number }).innerWidth = 390;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><LunchRound /></MemoryRouter>); });
  return mock;
}
const row = (id: string) => document.querySelector<HTMLElement>(`[data-testid="lunch-row"][data-member="${id}"]`)!;
const button = (scope: ParentNode, name: string) => Array.from(scope.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent === name || b.getAttribute('aria-label') === name || b.textContent?.endsWith(name))!;

describe('LunchRound', () => {
  it('tapping "Most" marks how much that person ate with kitchen.lunchMark', async () => {
    const mock = await show(12 * 60);
    expect(row('m2')).toBeTruthy();
    expect(Array.from(row('m2').querySelectorAll('[role=group] button')).map((b) => b.textContent)).toEqual(['All', 'Most', 'Half', 'Little', 'None']);
    await act(async () => { button(row('m2'), 'Most').click(); });
    expect(mock).toHaveBeenCalledWith('kitchen.lunchMark', { date: T, memberIds: ['m2'], lunch: 'most' });
  });

  it('a face marks the lunch mood, and "Mark the rest" asks first and then marks everyone left as Ate all', async () => {
    const mock = await show(12 * 60);
    await act(async () => { row('m10').querySelector<HTMLElement>('[role=radio][data-face="4"]')!.click(); });
    expect(mock).toHaveBeenCalledWith('kitchen.lunchMark', { date: T, memberIds: ['m10'], face: 4 });
    await act(async () => { button(document.body, 'Mark the rest as Ate all').click(); });
    expect(document.body.textContent).toContain('Mark 3 people as Ate all?');
    await act(async () => { button(document.body, 'Mark them').click(); });
    const rest = mock.mock.calls.find((c) => (c[1] as { onlyEmpty?: boolean }).onlyEmpty)!;
    expect(rest[0]).toBe('kitchen.lunchMark');
    expect(rest[1]).toMatchObject({ date: T, lunch: 'all', onlyEmpty: true });
    expect([...(rest[1] as { memberIds: string[] }).memberIds].sort()).toEqual(['m10', 'm2', 'm20']);
  });

  it('before 11:30 it says when it opens, still shows the lunch photos, and has no rows to mark', async () => {
    await show(11 * 60 + 15);
    expect(document.body.textContent).toContain('Opens at 11:30');
    expect(document.querySelector('[data-testid="lunch-row"]')).toBeNull();
    expect(document.querySelector('[data-testid="lunch-photos"]')).not.toBeNull();
  });
});
