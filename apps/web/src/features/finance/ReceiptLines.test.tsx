// Round 14 p2, Task 4: finance sees a receipt's items (the "N items" toggle), edits them, and keeps a category per supplier in the Directory.
// The action is mocked; the screens run against the seed.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState, type ReceiptLine } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Receipts } from './Receipts';
import { Directory } from './Directory';

const h = vi.hoisted(() => ({ act: vi.fn() }));
vi.mock('../../lib/act', () => ({ useAct: () => h.act }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => { h.act.mockReset(); h.act.mockResolvedValue({ ok: true, result: {} }); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

const line = (id: string, name: string, qty: number, unitPrice: number, category: ReceiptLine['category'] = 'hygiene', brand?: string): ReceiptLine =>
  ({ id, name, ...(brand ? { brand } : {}), qty, unit: 'pack', unitPrice, amount: qty * unitPrice, category });
const LINES = [line('l1', 'Sarung tangan lateks', 2, 50_000, 'medical', 'Sensi'), line('l2', 'Tisu basah', 5, 10_000), line('l3', 'Underpad (isi 10)', 1, 35_000)]; // 185,000

/** The seed, with rc1 (Sayur Segar Kemang) carrying `patch`, and finance signed in. */
async function show(ui: ReactElement, edit?: (s: ClubState) => void) {
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's10', name: 'Fransiska', role: 'finance', clubId: 'citra', clubs: ['citra'] } });
  const state = buildSeed().citra;
  edit?.(state);
  useReplica.setState({ club: 'citra', userId: 's10', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const withLines = (s: ClubState) => { Object.assign(s.receipts.rc1, { source: 'tokopedia', orderNo: 'INV/20261021/MPL/0042', amount: 185_000, lines: LINES }); };
const textOf = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (label: string | RegExp) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => (typeof label === 'string' ? textOf(b) === label : label.test(textOf(b))));
const text = () => document.body.textContent ?? '';
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const typeInto = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('Receipts: the items of a receipt', () => {
  it('a receipt with 3 lines shows "3 items"; tapping it lists the three names and their amounts', async () => {
    await show(<Receipts />, withLines);
    const toggle = button('3 items')!;
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(text()).not.toContain('Sarung tangan lateks');
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const t = text();
    for (const n of ['Sarung tangan lateks', 'Tisu basah', 'Underpad (isi 10)']) expect(t).toContain(n);
    for (const a of ['Rp 100.000', 'Rp 50.000', 'Rp 35.000']) expect(t).toContain(a);
    expect(t).toContain('Sensi'); // the brand
    expect(t).toContain('Medical supplies'); // the line's category
    expect(t).toContain('Tokopedia'); // bought at
    expect(t).toContain('INV/20261021/MPL/0042'); // the order no.
    await click(toggle);
    expect(text()).not.toContain('Sarung tangan lateks');
  });

  it('a receipt without lines shows no toggle', async () => {
    await show(<Receipts />, (s) => { for (const r of Object.values(s.receipts)) delete r.lines; }); // the seed's history receipts are itemised
    expect(button(/items?$/)).toBeUndefined();
    expect(text()).toContain('Sayur Segar Kemang');
  });

  it('Finance\'s Edit saves a changed quantity through receipt.edit with the new lines', async () => {
    await show(<Receipts />, withLines);
    await click(button('Edit Sayur Segar Kemang') ?? document.querySelector('[aria-label="Edit Sayur Segar Kemang"]'));
    const dlg = document.querySelector('[role="dialog"]')!;
    const qty = Array.from(dlg.querySelectorAll<HTMLInputElement>('input[aria-label="Qty"]'));
    expect(qty.map((i) => i.value)).toEqual(['2', '5', '1']);
    await typeInto(qty[1], '6');
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act).toHaveBeenCalledTimes(1);
    const [name, args] = h.act.mock.calls[0];
    expect(name).toBe('receipt.edit');
    expect(args.id).toBe('rc1');
    expect(args.source).toBe('tokopedia');
    expect(args.orderNo).toBe('INV/20261021/MPL/0042');
    expect(args.lines).toHaveLength(3);
    expect(args.lines[1]).toMatchObject({ id: 'l2', name: 'Tisu basah', qty: 6, unitPrice: 10_000, amount: 60_000 });
  });

  it('removing every line in Edit sends lines: [] (clears them)', async () => {
    await show(<Receipts />, withLines);
    await click(document.querySelector('[aria-label="Edit Sayur Segar Kemang"]'));
    const dlg = document.querySelector('[role="dialog"]')!;
    for (let i = 0; i < 3; i++) await click(dlg.querySelector('[aria-label^="Remove"]'));
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act.mock.calls[0][1].lines).toEqual([]);
  });
});

describe('Directory: supplier categories', () => {
  const categorise = (s: ClubState) => { Object.assign(s.directory.d6, { category: 'medical' }); Object.assign(s.directory.d7, { category: 'groceries' }); delete s.directory.d9.category; }; // Bersih Prima as a supplier with no category
  const filter = () => document.querySelector<HTMLElement>('[role="combobox"][aria-label="Category"]');
  /** The form's Category select: the combobox whose label reads Category. */
  const combo = (within: Element) => Array.from(within.querySelectorAll('[role="combobox"]')).find((c) => document.getElementById(c.getAttribute('aria-labelledby') ?? '')?.textContent === 'Category');
  const pick = async (label: string) => {
    await click(filter());
    await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === label));
  };

  it('the Category filter appears with Suppliers and lists only suppliers of that category', async () => {
    await show(<Directory />, categorise);
    expect(filter()).toBeNull(); // not while All is on
    await click(button(/^Suppliers/));
    expect(filter()).toBeTruthy();
    expect(text()).toContain('Sayur Segar Kemang');
    expect(text()).toContain('Ikan Laut Jaya');
    await pick('Medical supplies');
    expect(text()).toContain('Sayur Segar Kemang');
    expect(text()).not.toContain('Ikan Laut Jaya');
    expect(text()).not.toContain('Bersih Prima'); // no category at all
    await pick('All categories');
    expect(text()).toContain('Ikan Laut Jaya');
    await click(button(/^Doctors/));
    expect(filter()).toBeNull();
  });

  it('a supplier row shows its category', async () => {
    await show(<Directory />, categorise);
    expect(text()).toContain('Supplier · Vegetables and fruit · Medical supplies');
    expect(text()).toContain('Supplier · Fish · Groceries');
    expect(text()).toContain('Supplier · Cleaning supplies');
    expect(text()).not.toContain('Cleaning supplies · ');
  });

  it('saving the supplier form with a category sends directory.update with category', async () => {
    await show(<Directory />, categorise);
    await click(document.querySelector('[aria-label="Edit Bersih Prima"]'));
    const dlg = document.querySelector('[role="dialog"]')!;
    await click(combo(dlg));
    await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === 'Cleaning'));
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act).toHaveBeenCalledTimes(1);
    const [name, args] = h.act.mock.calls[0];
    expect(name).toBe('directory.update');
    expect(args).toMatchObject({ id: 'd9', category: 'cleaning' });
  });

  it('clearing the category in the form sends category: null', async () => {
    await show(<Directory />, categorise);
    await click(document.querySelector('[aria-label="Edit Sayur Segar Kemang"]'));
    const dlg = document.querySelector('[role="dialog"]')!;
    expect(textOf(combo(dlg)!)).toContain('Medical supplies');
    await click(combo(dlg));
    await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === 'No category'));
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act.mock.calls[0][1]).toMatchObject({ id: 'd6', category: null });
  });

  it('a doctor\'s form has no category field', async () => {
    await show(<Directory />, categorise);
    await click(document.querySelector('[aria-label="Edit dr. Melinda Kusumo"]'));
    expect(combo(document.querySelector('[role="dialog"]')!)).toBeUndefined();
  });
});
