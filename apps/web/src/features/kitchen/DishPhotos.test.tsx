// Round 15: dish photos. The dish library and the menu plan show a thumbnail per dish; the dish dialog can remove the picture (photoMediaId: null).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { DishesCard } from './DishesCard';
import { DishField } from './dish';

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

async function show(ui: React.ReactElement) {
  const state = buildSeed().citra;
  const mock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true, result: {} }));
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's3', name: 'Yohanes', role: 'kitchen', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's3', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 }, act: mock as never });
  (window as { innerWidth: number }).innerWidth = 390;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
  return mock;
}

describe('dish photos', () => {
  it('the dish library shows a thumbnail for the dishes that have a picture only', async () => {
    await show(<DishesCard />);
    const rows = Array.from(document.querySelectorAll('[data-testid="dish-row"]'));
    const withPic = rows.filter((r) => r.querySelector('[data-testid="dish-thumb"]'));
    expect(withPic.length).toBeGreaterThan(0);
    expect(withPic.length).toBeLessThan(rows.length); // sides have none
    expect(document.querySelector('[data-testid="dish-thumb"]')?.getAttribute('src')).toMatch(/^\/demo\/food-.*\.jpg$/);
  });
  it('the menu plan chip of a dish with a picture shows its thumbnail', async () => {
    await show(<DishField label="Lunch" course="lunch" ids={['dish-sop-ikan', 'dish-nasi-merah']} onRemove={() => {}} onAdd={() => {}} flex="1" testId="f" />);
    expect(document.querySelectorAll('[data-testid="plan-dish-thumb"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="plan-dish-thumb"]')?.getAttribute('data-media')).toBe('md_demo_food-sop-ikan');
  });
  it('removing the picture in the dish dialog saves photoMediaId: null', async () => {
    const mock = await show(<DishesCard />);
    const row = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="dish-row"]')).find((r) => r.querySelector('[data-testid="dish-thumb"]'))!;
    await act(async () => { row.click(); });
    expect(document.querySelector('[data-testid="dish-photo-img"]')).toBeTruthy();
    const remove = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="dish-photo"] button')).find((b) => b.textContent === 'Remove photo')!;
    await act(async () => { remove.click(); });
    expect(document.querySelector('[data-testid="dish-photo-img"]')).toBeNull();
    const save = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent === 'Save dish')!;
    await act(async () => { save.click(); });
    expect(mock).toHaveBeenCalledWith('dish.upsert', expect.objectContaining({ photoMediaId: null }));
  });
});
