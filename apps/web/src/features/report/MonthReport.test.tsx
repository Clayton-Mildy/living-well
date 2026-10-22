// The month report page (management) against the 5-member seed: the four groups, the Money rows, and the owner summary with the billed amount.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSeed, rp } from '@cp/shared';
import { periodFor } from '@cp/shared/rules/insights';
import { monthReport } from '@cp/shared/rules/monthReport';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { MonthReport } from './MonthReport';

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

const T = '2026-10-21';
const state = buildSeed().citra;
function open() {
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
}
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/monthReport" element={<><Where />{ui}</>} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const heads = () => Array.from(document.querySelectorAll('h2')).map((h) => h.textContent);
const button = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || ''));

describe('the month report page', () => {
  it('four groups, a Billed row in Money, and the owner summary carries the billed amount', async () => {
    open();
    await show(<MonthReport />, '/monthReport');
    expect(document.querySelector('h1')?.textContent).toBe('Month report');
    expect(heads()).toEqual(['Money', 'Members', 'Care and mood', 'Pipeline and team']);
    const money = document.querySelector('section[aria-label="Money"]')!;
    expect(money.textContent).toContain('Billed');
    const billed = monthReport(state, periodFor('thisMonth', T), T, 598).money.billed.cur;
    expect(money.textContent).toContain(rp(billed));
    expect(money.textContent).toContain('Oct vs Sep'); // billed goes by billing month and says which
    await click(button(/Send to owner/));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(rp(billed));
  });

  it('a Money row opens Billing', async () => {
    open();
    await show(<MonthReport />, '/monthReport');
    await click(Array.from(document.querySelectorAll('section[aria-label="Money"] button')).find((b) => /Billed/.test(b.textContent || '')));
    expect(document.querySelector('[data-testid="where"]')?.textContent).toBe('/billing');
  });

  it('four key numbers lead the page without a heading of their own, and the owner summary starts with them', async () => {
    open();
    await show(<MonthReport />, '/monthReport');
    const hero = document.querySelector('section[aria-label="Key numbers"]')!;
    expect(hero.querySelectorAll('[data-tile]')).toHaveLength(4);
    const r = monthReport(state, periodFor('thisMonth', T), T, 598);
    expect(hero.textContent).toContain(`Revenue collected${rp(r.hero.collected.cur)}`);
    expect(heads()).toEqual(['Money', 'Members', 'Care and mood', 'Pipeline and team']);
    await click(button(/Send to owner/));
    const lines = (document.querySelector('[data-testid="owner-summary"]')?.textContent ?? '');
    const at = (k: string) => lines.indexOf(k);
    expect(at('Revenue collected:')).toBeGreaterThan(-1);
    expect(at('Revenue collected:')).toBeLessThan(at('Active members:'));
    expect(at('Active members:')).toBeLessThan(at('Mood index:'));
    expect(at('Mood index:')).toBeLessThan(at('Enquiry → joined:'));
    expect(at('Enquiry → joined:')).toBeLessThan(at('Money'));
  });
});
