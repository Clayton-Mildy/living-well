// Purchasing rules: the simulated receipt (stand-in for a vision model), line categories and line checks.
import { describe, it, expect } from 'vitest';
import { CATALOGUE, RECEIPT_SOURCES, SIM_VENDORS, SPEND_CATEGORIES, lineCategory, lineProblem, linesGap, linesTotal, simulatedReceipt, supplierCategory } from './purchasing';
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
    s.directory.d6.category = 'groceries';
    expect(supplierCategory(s, 'd6')).toBe('groceries');
    expect(supplierCategory(s, 'd7')).toBeUndefined();
    expect(supplierCategory(s, 'nope')).toBeUndefined();
    expect(supplierCategory(s)).toBeUndefined();
  });
});
