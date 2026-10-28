// Purchasing rules: the simulated receipt (stand-in for a vision model), line categories and line checks.
import { describe, it, expect } from 'vitest';
import { CATALOGUE, RECEIPT_SOURCES, SIM_VENDORS, SPEND_CATEGORIES, filterPurchases, itemKey, itemPurchases, purchases, purchasesByCategory, lineCategory, lineProblem, linesGap, linesTotal, simulatedReceipt, spending, spendWindow, supplierCategory } from './purchasing';
import type { ClubState, Receipt, ReceiptLine } from '../types';
import { buildSeed } from '../index';

const KEYS = ['md_abc', 'md_def', 'md_ghi', 'md_jkl', 'md_mno', 'md_pqr', 'md_stu', 'md_vwx', 'md_yz1', 'md_234'];
const item = (name: string) => CATALOGUE.find((c) => c.name === name)!;

describe('simulatedReceipt', () => {
  it('is the same on every call and every line is internally consistent', () => {
    expect(simulatedReceipt('md_abc', '2026-10-21')).toEqual(simulatedReceipt('md_abc', '2026-10-21'));
    for (const key of KEYS) {
      const r = simulatedReceipt(key, '2026-10-21');
      expect(r.date).toBe('2026-10-21');
      expect(r.confidence).toBeGreaterThanOrEqual(0.86);
      expect(r.confidence).toBeLessThanOrEqual(0.97);
      expect(r.lines.length).toBeGreaterThanOrEqual(2);
      expect(r.lines.map((l) => l.id)).toEqual(r.lines.map((_, i) => `l${i + 1}`));
      expect(new Set(r.lines.map((l) => l.name)).size).toBe(r.lines.length);
      for (const l of r.lines) {
        const c = item(l.name);
        expect(l.amount).toBe(l.qty * l.unitPrice);
        expect(l.unitPrice % 100).toBe(0);
        expect(l.unitPrice).toBeGreaterThanOrEqual(c.price[0]);
        expect(l.unitPrice).toBeLessThanOrEqual(c.price[1]);
        expect(l.category).toBe(c.category);
        expect(c.brands).toContain(l.brand);
        expect(l.unit).toBe(c.unit);
        expect(l.qty).toBeGreaterThanOrEqual(1);
        expect(l.qty).toBeLessThanOrEqual(4);
      }
      // the vendor sells only what its categories say
      const v = SIM_VENDORS.find((x) => x.name === r.supplier)!;
      expect(v.source).toBe(r.source);
      for (const l of r.lines) expect(v.categories).toContain(l.category);
    }
  });
  it('differs between photos, and mixes marketplace and shop receipts', () => {
    const rs = KEYS.map((k) => simulatedReceipt(k, '2026-10-21'));
    expect(new Set(rs.map((r) => r.supplier)).size).toBeGreaterThan(1);
    expect(rs.some((r) => r.source === 'tokopedia')).toBe(true);
    expect(rs.some((r) => r.source === 'shop')).toBe(true);
  });
  it('a Tokopedia receipt carries an invoice number built from the date', () => {
    const r = simulatedReceipt('md_abc', '2026-10-21', { vendor: 'Sahabat Lansia Official (Tokopedia)' });
    expect(r.source).toBe('tokopedia');
    expect(r.orderNo).toMatch(/^INV\/20261021\/MPL\/\d{10}$/);
    const shop = simulatedReceipt('md_abc', '2026-10-21', { vendor: 'Superindo Kemang' });
    expect(shop.source).toBe('shop');
    expect(shop.orderNo).toBeUndefined();
  });
  it('shipping is only on Tokopedia, is added to the total and not to the lines', () => {
    const t = (key: string, shipping?: boolean) => simulatedReceipt(key, '2026-10-21', { vendor: 'Grosir Sembako Makmur (Tokopedia)', shipping });
    expect(KEYS.some((k) => { const r = t(k, true); return r.total! - linesTotal(r.lines) >= 9000; })).toBe(true);
    for (const k of KEYS) {
      const none = t(k, false);
      expect(none.total).toBe(linesTotal(none.lines));
      const forced = t(k, true);
      const ship = forced.total! - linesTotal(forced.lines);
      expect(ship).toBeGreaterThanOrEqual(9000);
      expect(ship).toBeLessThanOrEqual(20000);
      expect(ship % 500).toBe(0);
      expect(forced.lines).toEqual(none.lines);
      const auto = t(k);
      expect([0, ship]).toContain(auto.total! - linesTotal(auto.lines));
      const shop = simulatedReceipt(k, '2026-10-21', { vendor: 'Gramedia Kemang', shipping: true });
      expect(shop.total).toBe(linesTotal(shop.lines));
    }
  });
  it('drift raises every unit price by about that share, from the same draws', () => {
    for (const key of KEYS) {
      const a = simulatedReceipt(key, '2026-10-21');
      const b = simulatedReceipt(key, '2026-10-21', { drift: 0.1 });
      expect(b.lines.map((l) => l.name)).toEqual(a.lines.map((l) => l.name));
      b.lines.forEach((l, i) => {
        expect(l.unitPrice % 100).toBe(0);
        expect(Math.abs(l.unitPrice - Math.round((a.lines[i].unitPrice * 1.1) / 100) * 100)).toBeLessThanOrEqual(100);
        expect(l.amount).toBe(l.qty * l.unitPrice);
      });
    }
  });
  it('honours the line and quantity caps', () => {
    for (const key of KEYS) {
      const r = simulatedReceipt(key, '2026-10-21', { vendor: 'Superindo Kemang', maxLines: 3, maxQty: 2 });
      expect(r.lines.length).toBeGreaterThanOrEqual(2);
      expect(r.lines.length).toBeLessThanOrEqual(3);
      for (const l of r.lines) expect(l.qty).toBeLessThanOrEqual(2);
    }
    // a vendor with only two items on its shelf never gets more than two lines
    expect(simulatedReceipt('md_abc', '2026-10-21', { vendor: 'Bersih Prima', maxLines: 6 }).lines).toHaveLength(2);
  });
  it('exposes the categories and sources in a fixed order', () => {
    expect(SPEND_CATEGORIES).toEqual(['groceries', 'medical', 'hygiene', 'activity', 'cleaning', 'kitchen', 'marketplace', 'other']);
    expect(RECEIPT_SOURCES).toEqual(['shop', 'tokopedia', 'other']);
    expect(CATALOGUE).toHaveLength(22);
  });
});

describe('line rules', () => {
  it('lineCategory: the item keeps its own category; a marketplace supplier says nothing about the item', () => {
    expect(lineCategory('medical', 'marketplace')).toBe('medical');
    expect(lineCategory(undefined, 'groceries')).toBe('groceries');
    expect(lineCategory(undefined, 'marketplace')).toBe('other');
    expect(lineCategory(undefined, undefined)).toBe('other');
  });
  it('linesTotal and linesGap (positive: the lines are short of the total)', () => {
    expect(linesTotal([{ amount: 10 }, { amount: 5 }])).toBe(15);
    expect(linesTotal([])).toBe(0);
    expect(linesGap(100000, [{ amount: 90000 }])).toBe(10000);
    expect(linesGap(100000, [{ amount: 110000 }])).toBe(-10000);
  });
  it('lineProblem names the first thing wrong', () => {
    expect(lineProblem({ name: ' ', qty: 1, unitPrice: 1 })).toBe('name');
    expect(lineProblem({ name: 'x', qty: 0, unitPrice: 1 })).toBe('qty');
    expect(lineProblem({ name: 'x', qty: 1, unitPrice: -5 })).toBe('price');
    expect(lineProblem({ name: 'x', qty: Number.NaN, unitPrice: 1 })).toBe('qty');
    expect(lineProblem({ qty: 1, unitPrice: 1 })).toBe('name');
    expect(lineProblem({ name: 'Tisu basah', qty: 2, unitPrice: 15000 })).toBeNull();
  });
  it('supplierCategory reads the Directory entry, and nothing for free text', () => {
    const s = structuredClone(buildSeed().citra);
    s.directory.d6.category = 'medical';
    expect(supplierCategory(s, 'd6')).toBe('medical');
    expect(supplierCategory(s, 'd9')).toBe('cleaning'); // from the seed
    expect(supplierCategory(s, 'd4')).toBeUndefined(); // a service has none
    expect(supplierCategory(s, 'nope')).toBeUndefined();
    expect(supplierCategory(s)).toBeUndefined();
  });
});

describe('spending', () => {
  const POPOK = 'Popok dewasa (isi 10)';
  const line = (name: string, unit: string, qty: number, unitPrice: number, category: ReceiptLine['category'], brand?: string): ReceiptLine =>
    ({ id: 'l', name, unit, qty, unitPrice, amount: qty * unitPrice, category, ...(brand ? { brand } : {}) });
  const rcpt = (id: string, date: string, supplier: string, amount: number, extra: Partial<Receipt> = {}): Receipt =>
    ({ id, clubId: 'citra', createdAt: `${date}T09:00`, createdBy: { kind: 'staff', id: 'x', name: 'x' }, date, supplier, amount, sectionId: 'kitchen', fileName: 'nota.jpg', by: 'x', status: 'approved', xero: 'none', ...extra }) as unknown as Receipt;
  const state = (rs: Receipt[]): ClubState => {
    const s = structuredClone(buildSeed().citra);
    s.receipts = Object.fromEntries(rs.map((r) => [r.id, r]));
    return s;
  };

  it('spendWindow: calendar months ending today, or the custom dates', () => {
    expect(spendWindow('3m', '2026-10-21')).toEqual({ from: '2026-08-01', to: '2026-10-21' });
    expect(spendWindow('6m', '2026-10-21')).toEqual({ from: '2026-05-01', to: '2026-10-21' });
    expect(spendWindow('3m', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-10' });
    expect(spendWindow('month', '2026-10-21').from).toBe('2026-10-01');
    expect(spendWindow('custom', '2026-10-21', { from: '2026-09-03', to: '2026-09-09' })).toEqual({ from: '2026-09-03', to: '2026-09-09' });
  });

  it('counts approved and waiting live receipts dated inside the window (both ends included); waiting is the part not yet approved', () => {
    const inside = rcpt('a', '2026-10-01', 'Toko A', 1000);
    const s = state([
      inside,
      rcpt('edge', '2026-10-21', 'Toko A', 500),
      rcpt('sub', '2026-10-05', 'Toko A', 7000, { status: 'submitted' }),
      rcpt('rej', '2026-10-05', 'Toko A', 7000, { status: 'rejected' }),
      rcpt('void', '2026-10-05', 'Toko A', 7000, { voidedAt: '2026-10-06T09:00' }),
      rcpt('gone', '2026-10-05', 'Toko A', 7000, { deletedAt: '2026-10-06T09:00' }),
      rcpt('early', '2026-09-30', 'Toko A', 7000),
      rcpt('late', '2026-10-22', 'Toko A', 7000),
    ]);
    const r = spending(s, '2026-10-01', '2026-10-21');
    expect(r.total).toBe(8500);
    expect(r.waiting).toBe(7000);
    expect(r.byVendor).toEqual([{ key: 'toko a', label: 'Toko A', amount: 8500, count: 3 }]);
  });

  it('a receipt without lines counts its whole amount under the supplier category, or other', () => {
    const s = state([rcpt('a', '2026-10-02', 'Superindo', 40000, { directoryId: 'd6' }), rcpt('b', '2026-10-03', 'Warung', 10000), rcpt('c', '2026-10-04', 'Warung', 5000, { lines: [] })]);
    s.directory.d6.category = 'groceries';
    const r = spending(s, '2026-10-01', '2026-10-31');
    expect(r.total).toBe(55000);
    expect(r.byCategory).toEqual([{ key: 'groceries', label: 'groceries', amount: 40000, count: 1 }, { key: 'other', label: 'other', amount: 15000, count: 2 }]);
    expect(r.byVendor.map((v) => [v.key, v.label, v.amount, v.count])).toEqual([['d6', 'Superindo', 40000, 1], ['warung', 'Warung', 15000, 2]]);
    expect(r.byItem).toEqual([]);
    expect(r.byBrand).toEqual([]);
  });

  it('lines split by category, item, brand and vendor, largest first; unbranded lines skip byBrand', () => {
    const s = state([
      rcpt('a', '2026-10-02', 'Sahabat Lansia', 255000, { lines: [line(POPOK, 'pack', 2, 100000, 'hygiene', 'Confidence'), line('Tisu basah', 'pack', 3, 15000, 'hygiene', 'Mitu'), line('Teh melati', 'pack', 1, 10000, 'groceries')] }),
      rcpt('b', '2026-10-09', 'sahabat lansia', 20000, { lines: [line('Teh melati', 'pack', 2, 10000, 'groceries', 'Sosro')] }),
    ]);
    const r = spending(s, '2026-10-01', '2026-10-31');
    expect(r.total).toBe(275000);
    expect(r.byCategory.map((c) => [c.key, c.amount, c.count])).toEqual([['hygiene', 245000, 2], ['groceries', 30000, 2]]);
    expect(r.byItem.map((i) => [i.label, i.amount])).toEqual([[POPOK, 200000], ['Tisu basah', 45000], ['Teh melati', 30000]]);
    expect(r.byBrand.map((b) => [b.label, b.amount])).toEqual([['Confidence', 200000], ['Mitu', 45000], ['Sosro', 20000]]);
    expect(r.byVendor).toEqual([{ key: 'sahabat lansia', label: 'sahabat lansia', amount: 275000, count: 2 }]);
  });

  it('an item bought twice sums qty, averages the price and shows the change from first to last', () => {
    const s = state([
      rcpt('a', '2026-09-05', 'Toko', 100000, { lines: [line(POPOK, 'pack', 1, 100000, 'hygiene', 'Confidence')] }),
      rcpt('b', '2026-10-05', 'Toko', 220000, { lines: [line(POPOK, 'pack', 2, 110000, 'hygiene', 'Confidence')] }),
    ]);
    const r = spending(s, '2026-09-01', '2026-10-31');
    expect(r.byItem).toHaveLength(1);
    const it = r.byItem[0];
    expect(it).toMatchObject({ key: itemKey(POPOK, 'pack'), label: POPOK, unit: 'pack', qty: 3, amount: 320000, count: 2 });
    expect(it.avgUnitPrice).toBeCloseTo(320000 / 3);
    expect(it.change).toBeCloseTo(0.1);
    // one purchase has no change
    expect(spending(s, '2026-10-01', '2026-10-31').byItem[0].change).toBeNull();
  });

  it('counts what was paid: the part of the total the lines miss goes under the supplier category, a discount is not subtracted', () => {
    const s = state([
      rcpt('a', '2026-10-02', 'Sahabat Lansia', 115000, { directoryId: 'd6', lines: [line(POPOK, 'pack', 1, 100000, 'hygiene', 'Confidence')] }),
      rcpt('b', '2026-10-03', 'Gramedia', 90000, { lines: [line('Lem kertas', 'pcs', 1, 100000, 'activity')] }),
    ]);
    s.directory.d6.category = 'marketplace';
    const r = spending(s, '2026-10-01', '2026-10-31');
    expect(r.total).toBe(215000);
    expect(r.byCategory.map((c) => [c.key, c.amount]).sort()).toEqual([['activity', 100000], ['hygiene', 100000], ['marketplace', 15000]]);
    expect(r.byVendor.map((v) => [v.key, v.amount])).toEqual([['d6', 115000], ['gramedia', 100000]]);
    expect(r.byItem.map((i) => i.amount)).toEqual([100000, 100000]); // items stay line-only
    expect(r.byBrand).toEqual([{ key: 'confidence', label: 'Confidence', amount: 100000, count: 1 }]);
  });

  it('the same name in another unit is a separate item', () => {
    const s = state([rcpt('a', '2026-10-05', 'Toko', 300000, { lines: [line(POPOK, 'pack', 1, 100000, 'hygiene'), line(POPOK, 'box', 1, 200000, 'hygiene')] })]);
    expect(spending(s, '2026-10-01', '2026-10-31').byItem.map((i) => i.key).sort()).toEqual([itemKey(POPOK, 'box'), itemKey(POPOK, 'pack')].sort());
    expect(itemKey('  Popok DEWASA (isi 10) ', 'pack')).toBe(itemKey(POPOK, 'pack'));
  });

  it('an empty window gives zero and empty lists', () => {
    expect(spending(state([rcpt('a', '2026-01-01', 'Toko', 5000)]), '2026-10-01', '2026-10-31')).toEqual({ total: 0, waiting: 0, byCategory: [], byItem: [], byBrand: [], byVendor: [] });
  });

  it('itemPurchases lists every purchase of one item in the window, oldest first', () => {
    const s = state([
      rcpt('b', '2026-10-05', 'Toko B', 220000, { lines: [line(POPOK, 'pack', 2, 110000, 'hygiene', 'Lifree')] }),
      rcpt('a', '2026-09-05', 'Toko A', 100000, { lines: [line(POPOK, 'pack', 1, 100000, 'hygiene', 'Confidence'), line(POPOK, 'box', 1, 5, 'hygiene')] }),
      rcpt('x', '2026-10-06', 'Toko A', 5, { status: 'rejected', lines: [line(POPOK, 'pack', 1, 5, 'hygiene')] }),
    ]);
    expect(itemPurchases(s, itemKey(POPOK, 'pack'), '2026-09-01', '2026-10-31')).toEqual([
      { date: '2026-09-05', receiptId: 'a', supplier: 'Toko A', brand: 'Confidence', qty: 1, unitPrice: 100000, amount: 100000 },
      { date: '2026-10-05', receiptId: 'b', supplier: 'Toko B', brand: 'Lifree', qty: 2, unitPrice: 110000, amount: 220000 },
    ]);
    expect(itemPurchases(s, itemKey(POPOK, 'pack'), '2026-10-01', '2026-10-31')).toHaveLength(1);
  });

  it('spendWindow: last month is the whole previous calendar month', () => {
    expect(spendWindow('lastMonth', '2026-10-21')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(spendWindow('lastMonth', '2026-03-01')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('purchases: approved and waiting lines in the window, newest first; filters by name or brand, source and category; grouped by category', () => {
    const s = state([
      rcpt('a', '2026-10-02', 'Toko A', 0, { lines: [{ ...line('Beras', 'sak', 2, 150000, 'groceries'), id: 'l1' }, { ...line(POPOK, 'pack', 1, 90000, 'hygiene', 'Lifree'), id: 'l2' }] }),
      rcpt('b', '2026-10-05', 'Tokopedia store', 0, { status: 'submitted', source: 'tokopedia', lines: [{ ...line('Sabun cair', 'btl', 3, 20000, 'hygiene', 'Lifebuoy'), id: 'l1' }] }),
      rcpt('rej', '2026-10-05', 'Toko A', 0, { status: 'rejected', lines: [line('Gula', 'kg', 1, 15000, 'groceries')] }),
      rcpt('void', '2026-10-05', 'Toko A', 0, { voidedAt: '2026-10-06T09:00', lines: [line('Gula', 'kg', 1, 15000, 'groceries')] }),
      rcpt('early', '2026-09-30', 'Toko A', 0, { lines: [line('Gula', 'kg', 1, 15000, 'groceries')] }),
    ]);
    const rows = purchases(s, '2026-10-01', '2026-10-31');
    expect(rows.map((p) => [p.key, p.waiting, p.source])).toEqual([['b:l1', true, 'tokopedia'], ['a:l2', false, 'shop'], ['a:l1', false, 'shop']]);
    expect(filterPurchases(rows, { q: 'lifr' }).map((p) => p.key)).toEqual(['a:l2']);
    expect(filterPurchases(rows, { q: ' BERAS ' }).map((p) => p.key)).toEqual(['a:l1']);
    expect(filterPurchases(rows, { source: 'tokopedia' }).map((p) => p.key)).toEqual(['b:l1']);
    expect(filterPurchases(rows, { category: 'hygiene', source: 'shop' }).map((p) => p.key)).toEqual(['a:l2']);
    expect(filterPurchases(rows, { q: '', source: '', category: '' })).toHaveLength(3);
    expect(purchasesByCategory(rows).map((g) => [g.category, g.amount, g.rows.length])).toEqual([['groceries', 300000, 1], ['hygiene', 150000, 2]]);
  });

  it('purchases: a receipt without lines is one whole row, a total over its lines adds an extra row; together they add up to spending', () => {
    const s = state([
      rcpt('a', '2026-10-02', 'Superindo', 40000, { directoryId: 'd6' }),
      rcpt('b', '2026-10-03', 'Tokopedia store', 115000, { source: 'tokopedia', lines: [{ ...line('Sabun cair', 'btl', 5, 20000, 'hygiene'), id: 'l1' }] }),
      rcpt('c', '2026-10-04', 'Toko', 9000, { lines: [{ ...line('Gula', 'kg', 1, 10000, 'groceries'), id: 'l1' }] }), // a discount: no extra row
    ]);
    s.directory.d6.category = 'groceries';
    const rows = purchases(s, '2026-10-01', '2026-10-31');
    expect(rows.map((p) => [p.key, p.kind ?? null, p.line.amount, p.line.category])).toEqual([
      ['c:l1', null, 10000, 'groceries'], ['b:l1', null, 100000, 'hygiene'], ['b:extra', 'extra', 15000, 'other'], ['a:whole', 'whole', 40000, 'groceries'],
    ]);
    expect(rows.reduce((a, p) => a + p.line.amount, 0)).toBe(spending(s, '2026-10-01', '2026-10-31').total);
    expect(filterPurchases(rows, { q: 'sabun' }).map((p) => p.key)).toEqual(['b:l1']); // the search is on items: the extra rows drop out
  });

  it('purchases add up to spending on the seed, month by month', () => {
    const s = buildSeed().citra;
    for (const [from, to] of [['2026-08-01', '2026-08-31'], ['2026-09-01', '2026-09-30'], ['2026-10-01', '2026-10-31']])
      expect(purchases(s, from, to).reduce((a, p) => a + p.line.amount, 0), from).toBe(spending(s, from, to).total);
  });
});
