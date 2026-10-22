// Round 13: the hero tiles of the month report: four numbers with a six-month line each; no heading of their own.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSeed, rp } from '@cp/shared';
import { periodFor } from '@cp/shared/rules/insights';
import { heroTrend, monthReport } from '@cp/shared/rules/monthReport';
import { useSession } from '../../store/session';
import { HeroTiles } from './HeroTiles';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

const T = '2026-10-21';
const s = buildSeed(T, 598, { roster: true }).citra;
const r = monthReport(s, periodFor('thisMonth', T), T, 600);
const trend = heroTrend(s, r.period, T, 600);
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
async function show(wide: boolean) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Routes><Route path="/" element={<><Where /><HeroTiles r={r} trend={trend} wide={wide} /></>} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>); });
}
const region = () => document.querySelector('section[aria-label="Key numbers"]')!;

describe('the hero tiles', () => {
  it('four tiles with their values, a sparkline each, and no heading', async () => {
    await show(false);
    const tiles = Array.from(region().querySelectorAll('[data-tile]'));
    expect(tiles.map((x) => x.getAttribute('data-tile'))).toEqual(['collected', 'active', 'index', 'conversion']);
    expect(tiles[0].textContent).toContain('Revenue collected');
    expect(tiles[0].textContent).toContain(rp(r.hero.collected.cur));
    expect(tiles[1].textContent).toContain(`Active members${r.hero.active.cur}`);
    expect(tiles[3].textContent).toContain('38%');
    expect(tiles[3].textContent).toContain('of leads opened in the 3 months before');
    for (const x of tiles) { expect(x.querySelector('svg')).toBeTruthy(); expect(x.textContent).toContain('Apr–Sep'); }
    expect(tiles.every((x) => x.querySelector('[aria-label*="six months"]'))).toBe(true);
    expect(region().querySelector('h1,h2,h3')).toBeNull();
  });
  it('phone is two by two, wide is four across', async () => {
    await show(false);
    expect((region().querySelector('[data-grid]') as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    await act(async () => { root!.unmount(); }); host!.remove();
    await show(true);
    expect((region().querySelector('[data-grid]') as HTMLElement).style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
  });
  it('a tile opens the screen behind it', async () => {
    await show(false);
    await act(async () => { (region().querySelector('[data-tile="index"] button') as HTMLElement).click(); });
    expect(document.querySelector('[data-testid="where"]')?.textContent).toBe('/insights?tab=mood');
  });
});
