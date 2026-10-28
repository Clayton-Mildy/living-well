// Round 14 p2, Task 7: the Spending screen for finance and management. Runs against the seed at the e2e date.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, rp, type ClubState } from '@cp/shared';
import { purchases, spending, spendWindow } from '@cp/shared/rules/purchasing';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Spending } from './Spending';

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

async function show(edit?: (s: ClubState) => void, userId = 's10', role: 'finance' | 'mgmt' = 'finance') {
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: userId, name: 'Gabriel', role, clubId: 'citra', clubs: ['citra'] } });
  const state = buildSeed().citra;
  edit?.(state);
  useReplica.setState({ club: 'citra', userId, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Spending /></MemoryRouter>); });
  return state;
}
const textOf = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const tab = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find((b) => textOf(b) === label);
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const text = () => document.body.textContent ?? '';
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="sp-row"]'));
/** "Rp 1.234.000" → 1234000 */
const rupiah = (s: string) => Number(s.replace(/\D/g, ''));

describe('Spending', () => {
  it('Category view: the rows add up to the total shown', async () => {
    const s = await show();
    const w = spendWindow('month', T);
    const want = spending(s, w.from, w.to);
    expect(want.total).toBeGreaterThan(0);
    expect(text()).toContain('Spent');
    expect(document.querySelector('[data-testid="sp-total"]')!.textContent).toBe(rp(want.total));
    const shown = rows();
    expect(shown.length).toBe(want.byCategory.length);
    expect(shown.map((r) => rupiah(r.querySelector('[data-testid="sp-amount"]')!.textContent!)).reduce((a, b) => a + b, 0)).toBe(want.total);
    expect(shown[0].textContent).toContain('Groceries'); // categories read translated, not as keys
  });

  it('Item view: tapping Popok dewasa opens the sheet with the price chart and at least 2 purchases', async () => {
    await show();
    await click(tab('3 months'));
    await click(tab('Item'));
    const popok = rows().find((r) => r.textContent!.includes('Popok dewasa (isi 10)'))!;
    expect(popok).toBeTruthy();
    expect(popok.textContent).toMatch(/\d+ pack · avg Rp/);
    expect(popok.textContent).toMatch(/[▲▼] \d+ %/); // the price moved from the first to the last purchase
    await click(popok);
    const sheet = document.querySelector('[role="dialog"]')!;
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toContain('Popok dewasa (isi 10)');
    expect(sheet.querySelector('svg')).toBeTruthy(); // TrendChart
    expect(sheet.querySelectorAll('[data-testid="sp-purchase"]').length).toBeGreaterThanOrEqual(2);
    expect(sheet.querySelector('[data-testid="sp-purchase"]')!.textContent).toMatch(/\d+ × Rp [\d.]+ = Rp [\d.]+/);
    await click(Array.from(sheet.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Close'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Brand and Vendor views list their rows too', async () => {
    const s = await show();
    await click(tab('3 months'));
    const w = spendWindow('3m', T);
    const want = spending(s, w.from, w.to);
    await click(tab('Brand'));
    expect(rows().length).toBe(want.byBrand.length);
    await click(tab('Vendor'));
    expect(rows().length).toBe(want.byVendor.length);
    expect(rows().map((r) => rupiah(r.querySelector('[data-testid="sp-amount"]')!.textContent!)).reduce((a, b) => a + b, 0)).toBe(want.total);
  });

  it('Custom: From after To is impossible, the other end follows', async () => {
    await show();
    await click(tab('Custom'));
    // pick To = 5 Oct, then From = 15 Oct: To follows to 15 Oct
    const pick = async (label: string, date: string) => {
      await click(Array.from(document.querySelectorAll<HTMLElement>('[data-testid="sp-custom"] button[aria-haspopup="dialog"]'))[label === 'From' ? 0 : 1]);
      await click(document.querySelector(`[data-date="${date}"]`));
    };
    await pick('To', '2026-10-05');
    await pick('From', '2026-10-15');
    const [from, to] = Array.from(document.querySelectorAll('[data-testid="sp-custom"] button[aria-haspopup="dialog"]')).map((b) => b.textContent);
    expect(from).toBe(to); // 15 Oct to 15 Oct
    expect(to).toContain('15');
  });

  it('Waiting receipts count, and the part waiting for finance is shown under the total (KC 28 Oct)', async () => {
    const s = await show((x) => { for (const r of Object.values(x.receipts)) if (r.status === 'approved' && r.date >= '2026-10-01') r.status = 'submitted'; });
    const w = spendWindow('month', T);
    const want = spending(s, w.from, w.to);
    expect(want.waiting).toBe(want.total);
    expect(document.querySelector('[data-testid="sp-total"]')!.textContent).toBe(rp(want.total));
    expect(document.querySelector('[data-testid="sp-waiting"]')!.textContent).toBe(`${rp(want.waiting)} waiting for finance`);
  });

  it('A window with no receipts shows the empty state', async () => {
    await show((s) => { for (const r of Object.values(s.receipts)) r.status = 'rejected'; });
    expect(text()).toContain('No receipts in this period');
    expect(rows().length).toBe(0);
  });

  it('Items tab: every bought item, and the items add up to the Summary total when every receipt is itemised', async () => {
    const s = await show();
    await click(tab('Last month'));
    const w = spendWindow('lastMonth', T);
    const want = purchases(s, w.from, w.to);
    expect(want.length).toBeGreaterThan(0);
    await click(tab('Items'));
    expect(document.querySelectorAll('[data-testid="pu-row"]').length).toBeGreaterThan(0);
    const itemsTotal = want.reduce((a, p) => a + p.line.amount, 0);
    expect(document.querySelector('[data-testid="pu-total"]')!.textContent).toBe(rp(itemsTotal));
    const sum = spending(s, w.from, w.to);
    const shipping = Object.values(s.receipts).filter((r) => r.status !== 'rejected' && !r.voidedAt && !r.deletedAt && r.date >= w.from && r.date <= w.to)
      .reduce((a, r) => a + (r.lines?.length ? Math.max(0, r.amount - r.lines.reduce((b, l) => b + l.amount, 0)) : r.amount), 0);
    expect(itemsTotal + shipping).toBe(sum.total); // the Summary total also counts shipping and receipts without items
    await click(tab('Summary'));
    expect(document.querySelector('[data-testid="sp-total"]')!.textContent).toBe(rp(sum.total));
  });

  it('Management reads the same screen', async () => {
    await show(undefined, 'm1', 'mgmt');
    expect(document.querySelector('[data-testid="sp-total"]')).toBeTruthy();
  });
});
