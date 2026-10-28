// Plans: five sections in order (Plans, Extra charges, One-off fees, Changes when edited, Next invoice preview); the Flex visits rule lives in the Flex card.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Plans } from './Plans';

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
function openClub(opts: { staff?: 's9' | 's1'; plans?: boolean; later?: boolean } = {}) {
  const state = structuredClone(buildSeed().citra); // the seed is shared between tests
  if (opts.plans) {
    // round 15 phase 2: two catalogue plans, the second without a price yet
    state.club.settings.plans = [{ id: 'plan_1', name: 'Gold Plus', kind: 'unlimited', active: true }, { id: 'plan_2', name: 'Flex 6', kind: 'days', quota: 6, active: true }];
    Object.values(state.prices).forEach((p) => { p.plans = { plan_1: 4_500_000 }; });
    // round 15 fix wave: Flex 6 is priced from a later date only
    if (opts.later) { const base = Object.values(state.prices)[0]; state.prices['price-later'] = { ...base, id: 'price-later', from: '2026-11-01', plans: { plan_1: 4_500_000, plan_2: 2_100_000 } }; }
  }
  const user = opts.staff === 's1' ? { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] } : { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra', 'adina'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement, width: number) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/plans']}>{ui}</MemoryRouter>); });
}
const sections = () => Array.from(document.querySelectorAll<HTMLElement>('section[aria-label]')).map((x) => x.getAttribute('aria-label'));
const section = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const type = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const priceInput = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name} price in rupiah"]`)!;
const quotaInput = () => Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((i) => i.closest('label')?.textContent?.includes('Flex visits per month'))!;

describe.each([['phone', 390], ['wide', 1280]])('Plans sections (%s)', (_n, width) => {
  it('shows Plans, Extra charges, One-off fees and the preview in that order', async () => {
    openClub();
    await show(<Plans />, width);
    expect(sections()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Next invoice preview']);
    expect(section('Plans')!.contains(priceInput('Flex'))).toBe(true);
    expect(section('Plans')!.contains(priceInput('Gold'))).toBe(true);
    expect(section('Extra charges')!.contains(priceInput('Extra day'))).toBe(true);
    expect(section('Extra charges')!.contains(priceInput('Leave (cuti)'))).toBe(true);
    expect(section('One-off fees')!.contains(priceInput('Registration'))).toBe(true);
    expect(section('One-off fees')!.contains(priceInput('Trial'))).toBe(true);
    expect(section('Plans')!.contains(quotaInput())).toBe(true);
    expect(document.body.textContent).not.toContain('Club rules');
  });
  it('a visits edit adds Changes with the next-invoice note, no date and no notify switch', async () => {
    openClub();
    await show(<Plans />, width);
    expect(section('Changes')).toBeNull();
    await type(quotaInput(), '9');
    expect(sections()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Changes', 'Next invoice preview']);
    const ch = section('Changes')!;
    expect(ch.textContent).toContain('Takes effect from');
    expect(ch.textContent).toContain('On next month’s invoice');
    expect(ch.textContent).not.toContain('Notify the team');
    expect(ch.querySelector('input')).toBeNull();
  });
  it('a price edit adds Changes with the date field and Notify the team', async () => {
    openClub();
    await show(<Plans />, width);
    await type(priceInput('Flex'), '2.800.000');
    const ch = section('Changes')!;
    expect(ch.textContent).toContain('Notify the team');
    expect(ch.textContent).toContain('Takes effect from');
    expect(ch.querySelector('input, button[aria-haspopup], [role="button"]')).toBeTruthy();
  });
});

// ---------- round 15 phase 2: the plan catalogue ----------
const calls: [string, Record<string, unknown>][] = [];
function mockAct() {
  calls.length = 0;
  const fn = vi.fn(async (name: string, input: unknown) => { calls.push([name, input as Record<string, unknown>]); return { ok: true as const, result: name === 'club.setPlan' ? { planId: 'plan_3' } : {} }; });
  useReplica.setState({ act: fn as never });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const byText = (sel: string, text: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.textContent?.trim().endsWith(text));
const field = (label: string) => Array.from(document.querySelectorAll<HTMLLabelElement>('[role="dialog"] label')).find((l) => l.textContent?.startsWith(label))!.querySelector('input')!;

describe.each([['phone', 390], ['wide', 1280]])('the plan catalogue (%s)', (_n, width) => {
  it('management sees Flex, Gold and the custom plans with their price in force, or No price', async () => {
    openClub({ plans: true });
    await show(<Plans />, width);
    const plans = section('Plans')!;
    expect(plans.contains(priceInput('Flex'))).toBe(true);
    expect(plans.contains(priceInput('Gold'))).toBe(true);
    expect(priceInput('Gold Plus').value).toBe('4.500.000');
    expect(plans.textContent).toContain('Unlimited');
    expect(plans.textContent).toContain('6 days a month');
    expect(priceInput('Flex 6').value).toBe('');
    expect(priceInput('Flex 6').placeholder).toBe('No price');
    expect(plans.textContent).toContain('Add plan');
  });
  it('a plan priced from a later date shows "From {date}: Rp X" instead of No price', async () => {
    openClub({ plans: true, later: true });
    await show(<Plans />, width);
    expect(priceInput('Flex 6').value).toBe('');
    expect(priceInput('Flex 6').placeholder).toBe('From Sun 1 Nov: Rp 2.100.000');
    expect(priceInput('Gold Plus').value).toBe('4.500.000');
  });
  it('if the price does not save after the plan was added, the sheet stays open with an error, no "added" toast, and Save retries only the price', async () => {
    openClub();
    mockAct();
    let fail = true;
    const fn = vi.fn(async (name: string, input: unknown) => {
      calls.push([name, input as Record<string, unknown>]);
      if (name === 'prices.set' && fail) return { ok: false as const, code: 'err.invalid', params: {} };
      return { ok: true as const, result: name === 'club.setPlan' ? { planId: 'plan_3' } : {} };
    });
    useReplica.setState({ act: fn as never });
    await show(<Plans />, width);
    await click(byText('button', 'Add plan'));
    await click(byText('button', 'Start from Gold'));
    await type(field('Plan name'), 'Gold 2');
    await click(byText('button', 'Save'));
    expect(calls.map((c) => c[0])).toEqual(['club.setPlan', 'prices.set']);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('its price was not saved');
    fail = false;
    await click(byText('button', 'Save'));
    expect(calls.map((c) => c[0])).toEqual(['club.setPlan', 'prices.set', 'prices.set']); // the plan is not added twice
    expect(calls[2][1]).toMatchObject({ plans: { plan_3: expect.any(Number) } });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('Start from Flex prefills Days per month, the Flex quota and the Flex price; saving adds the plan and then prices it', async () => {
    openClub();
    mockAct();
    await show(<Plans />, width);
    await click(byText('button', 'Add plan'));
    expect(byText('button', 'Start from Gold')).toBeTruthy();
    await click(byText('button', 'Start from Flex'));
    const flexQuota = useReplica.getState().view!.club.settings.flexQuota;
    expect(byText('[role="tab"]', 'Days per month')!.getAttribute('aria-selected')).toBe('true');
    expect(field('Days a month').value).toBe(String(flexQuota));
    expect(field('Price per month').value).toBe('2.700.000');
    await type(field('Plan name'), 'Flex 8');
    await type(field('Days a month'), '8');
    await type(field('Price per month'), '2000000');
    await click(byText('button', 'Save'));
    expect(calls.map((c) => c[0])).toEqual(['club.setPlan', 'prices.set']);
    expect(calls[0][1]).toEqual({ name: 'Flex 8', kind: 'days', quota: 8, active: true });
    expect(calls[1][1]).toMatchObject({ plans: { plan_3: 2_000_000 }, from: '2026-10-21' });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('Start from Gold prefills Unlimited and the Gold price, with no days field', async () => {
    openClub();
    mockAct();
    await show(<Plans />, width);
    await click(byText('button', 'Add plan'));
    await click(byText('button', 'Start from Gold'));
    expect(byText('[role="tab"]', 'Unlimited')!.getAttribute('aria-selected')).toBe('true');
    expect(field('Price per month').value).toBe('3.950.000');
    expect(Array.from(document.querySelectorAll('label')).some((l) => l.textContent?.startsWith('Days a month'))).toBe(false);
    await type(field('Plan name'), 'Gold Lite');
    await click(byText('button', 'Save'));
    expect(calls[0][1]).toEqual({ name: 'Gold Lite', kind: 'unlimited', active: true });
  });
  it('an empty name or price keeps the sheet open and calls nothing', async () => {
    openClub();
    mockAct();
    await show(<Plans />, width);
    await click(byText('button', 'Add plan'));
    await click(byText('button', 'Save'));
    expect(calls).toEqual([]);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Give the plan a name.');
  });
  it('switching Active off retires the plan with club.setPlan', async () => {
    openClub({ plans: true });
    mockAct();
    await show(<Plans />, width);
    const sw = document.querySelectorAll<HTMLElement>('[role="switch"]');
    expect(sw.length).toBe(2);
    await click(sw[1]);
    expect(calls).toEqual([['club.setPlan', { id: 'plan_2', name: 'Flex 6', kind: 'days', quota: 6, active: false }]]);
  });
  it('a custom plan price is saved from the chosen date with prices.set plans', async () => {
    openClub({ plans: true });
    mockAct();
    await show(<Plans />, width);
    await type(priceInput('Flex 6'), '1800000');
    expect(section('Changes')!.textContent).toContain('Takes effect from');
    await click(byText('button', 'Save changes'));
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('prices.set');
    expect(calls[0][1]).toMatchObject({ plans: { plan_1: 4_500_000, plan_2: 1_800_000 }, from: '2026-10-21' });
  });
  it('a lobby user sees the plans but no Add plan, Edit or Active switch', async () => {
    openClub({ plans: true, staff: 's1' });
    await show(<Plans />, width);
    expect(section('Plans')!.textContent).toContain('Gold Plus');
    expect(byText('button', 'Add plan')).toBeUndefined();
    expect(document.querySelector('[role="switch"]')).toBeNull();
    expect(document.querySelector('button[aria-label^="Edit "]')).toBeNull();
  });
});
