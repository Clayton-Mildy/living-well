// Purchasing: the simulated receipt reader, the fixed spend categories and the checks on receipt lines.
// A real provider (a vision model or a document-AI service) replaces `simulatedReceipt` by config; nothing in the screens changes.
import type { ClubState, ISODate, OcrResult, Receipt, ReceiptLine, ReceiptSource, SpendCategory } from '../types';
import { hashOf } from './activity';
import { addMonths, live, monthStart, ym } from '../util';

export const SPEND_CATEGORIES: SpendCategory[] = ['groceries', 'medical', 'hygiene', 'activity', 'cleaning', 'kitchen', 'marketplace', 'other'];
export const RECEIPT_SOURCES: ReceiptSource[] = ['shop', 'tokopedia', 'other'];

export interface CatalogueItem { name: string; brands: string[]; unit: string; price: [number, number]; category: SpendCategory }
/** What the club buys, with the brands and the price range the simulated reader draws from (rupiah). */
export const CATALOGUE: CatalogueItem[] = [
  { name: 'Popok dewasa (isi 10)', brands: ['Confidence', 'Certainty', 'Lifree'], unit: 'pack', price: [85000, 125000], category: 'hygiene' },
  { name: 'Underpad (isi 10)', brands: ['Sensi', 'Confidence'], unit: 'pack', price: [55000, 80000], category: 'hygiene' },
  { name: 'Tisu basah', brands: ['Mitu', 'Sweety', 'Paseo'], unit: 'pack', price: [12000, 22000], category: 'hygiene' },
  { name: 'Sabun cuci tangan refill', brands: ['Lifebuoy', 'Dettol'], unit: 'pouch', price: [18000, 30000], category: 'hygiene' },
  { name: 'Sarung tangan lateks (isi 100)', brands: ['Sensi', 'OneMed'], unit: 'box', price: [65000, 95000], category: 'medical' },
  { name: 'Masker medis (isi 50)', brands: ['Sensi', 'OneMed'], unit: 'box', price: [30000, 55000], category: 'medical' },
  { name: 'Strip gula darah (isi 25)', brands: ['Accu-Chek', 'Easy Touch'], unit: 'box', price: [150000, 230000], category: 'medical' },
  { name: 'Alkohol swab (isi 100)', brands: ['OneMed'], unit: 'box', price: [25000, 40000], category: 'medical' },
  { name: 'Beras (5 kg)', brands: ['Topi Koki', 'Rojolele'], unit: 'sack', price: [68000, 85000], category: 'groceries' },
  { name: 'Minyak goreng (2 L)', brands: ['Bimoli', 'Filma', 'Sania'], unit: 'bottle', price: [34000, 42000], category: 'groceries' },
  { name: 'Biskuit tanpa gula', brands: ['Hatari', 'Tropicana Slim'], unit: 'pack', price: [15000, 32000], category: 'groceries' },
  { name: 'Gula rendah kalori', brands: ['Tropicana Slim', 'Diabetasol'], unit: 'box', price: [38000, 60000], category: 'groceries' },
  { name: 'Susu lansia (400 g)', brands: ['Entrasol', 'Anlene'], unit: 'tin', price: [70000, 110000], category: 'groceries' },
  { name: 'Teh melati', brands: ['Sariwangi', 'Sosro'], unit: 'pack', price: [6000, 12000], category: 'groceries' },
  { name: 'Kertas origami', brands: ['Kiky', 'Sinar Dunia'], unit: 'pack', price: [8000, 15000], category: 'activity' },
  { name: 'Cat akrilik (set 12)', brands: ['Faber-Castell', 'Greebel'], unit: 'set', price: [45000, 90000], category: 'activity' },
  { name: 'Kuas lukis (set)', brands: ['Faber-Castell'], unit: 'set', price: [25000, 45000], category: 'activity' },
  { name: 'Lem kertas', brands: ['UHU', 'Fox'], unit: 'pcs', price: [7000, 15000], category: 'activity' },
  { name: 'Cairan pembersih lantai (800 ml)', brands: ['Super Pel', 'Wipol'], unit: 'bottle', price: [14000, 22000], category: 'cleaning' },
  { name: 'Disinfektan (1 L)', brands: ['Dettol', 'Wipol'], unit: 'bottle', price: [45000, 70000], category: 'cleaning' },
  { name: 'Spons cuci piring', brands: ['Scotch-Brite'], unit: 'pack', price: [9000, 15000], category: 'kitchen' },
  { name: 'Plastik wrap', brands: ['Klin Pak', 'Bagus'], unit: 'roll', price: [25000, 45000], category: 'kitchen' },
];

/** The shops the simulated reader "finds" on a photo; the names match the Directory seed. */
export const SIM_VENDORS: { name: string; source: ReceiptSource; categories: SpendCategory[] }[] = [
  { name: 'Sahabat Lansia Official (Tokopedia)', source: 'tokopedia', categories: ['hygiene', 'medical'] },
  { name: 'Grosir Sembako Makmur (Tokopedia)', source: 'tokopedia', categories: ['groceries', 'kitchen'] },
  { name: 'Gramedia Kemang', source: 'shop', categories: ['activity'] },
  { name: 'Superindo Kemang', source: 'shop', categories: ['groceries', 'cleaning', 'kitchen', 'hygiene'] },
  { name: 'Bersih Prima', source: 'shop', categories: ['cleaning'] },
];

const round100 = (n: number) => Math.round(n / 100) * 100;

/**
 * The simulated receipt reader: the same photo (`key`, a media id) always reads the same.
 * `drift` raises every unit price by that share (for a price trend over time), `shipping` forces (true) or
 * suppresses (false) a Tokopedia shipping charge that is in the total but not in the lines.
 */
export function simulatedReceipt(key: string, date: ISODate, opts: { vendor?: string; drift?: number; shipping?: boolean; maxLines?: number; maxQty?: number } = {}): OcrResult {
  const u = (n: number) => hashOf(`${key}:${n}`) / 4294967296; // 0 ≤ u < 1
  const pick = <T>(list: T[], n: number) => list[Math.floor(u(n) * list.length)];
  const named = opts.vendor ? SIM_VENDORS.find((v) => v.name === opts.vendor) : undefined;
  const pool = SIM_VENDORS.filter((v) => (u(0) < 0.6 ? v.source === 'tokopedia' : v.source === 'shop'));
  const vendor = named ?? pick(pool, 1);

  const shelf = CATALOGUE.filter((c) => vendor.categories.includes(c.category));
  const maxLines = Math.max(2, opts.maxLines ?? 6);
  const maxQty = Math.max(1, opts.maxQty ?? 4);
  const count = Math.min(shelf.length, 2 + Math.floor(u(2) * (maxLines - 1)));
  const lines: ReceiptLine[] = [];
  for (let k = 0; k < count; k++) {
    const c = shelf.splice(Math.floor(u(10 + k * 5) * shelf.length), 1)[0];
    const qty = 1 + Math.floor(u(11 + k * 5) * maxQty);
    const base = round100(c.price[0] + u(12 + k * 5) * (c.price[1] - c.price[0]));
    const unitPrice = opts.drift ? round100(base * (1 + opts.drift)) : base;
    lines.push({ id: `l${k + 1}`, name: c.name, brand: pick(c.brands, 13 + k * 5), qty, unit: c.unit, unitPrice, amount: qty * unitPrice, category: c.category });
  }

  const tokopedia = vendor.source === 'tokopedia';
  const shipped = tokopedia && (opts.shipping ?? u(3) < 0.5);
  const shipping = shipped ? 9000 + 500 * Math.floor(u(4) * 23) : 0; // 9,000–20,000 in steps of 500
  const digits = (n: number) => String(hashOf(`${key}:order${n}`) % 100000).padStart(5, '0');
  return {
    supplier: vendor.name,
    source: vendor.source,
    ...(tokopedia ? { orderNo: `INV/${date.replace(/-/g, '')}/MPL/${digits(1)}${digits(2)}` } : {}),
    date,
    lines,
    total: linesTotal(lines) + shipping,
    confidence: Math.round((0.86 + u(5) * 0.11) * 100) / 100,
  };
}

/** The category of a line: the item's own, else what the supplier sells, but a marketplace says nothing about the item. */
export const lineCategory = (itemCategory: SpendCategory | undefined, supplierCategory: SpendCategory | undefined): SpendCategory =>
  itemCategory ?? (supplierCategory && supplierCategory !== 'marketplace' ? supplierCategory : 'other');

export const linesTotal = (lines: Pick<ReceiptLine, 'amount'>[]): number => lines.reduce((a, l) => a + l.amount, 0);
/** The receipt total minus the lines; positive means the lines are short of the total (shipping, rounding or a missed line). */
export const linesGap = (total: number, lines: Pick<ReceiptLine, 'amount'>[]): number => total - linesTotal(lines);

/** The first thing wrong with a line, or null: a blank name, a quantity that isn't above zero, a negative or absurd price. */
export function lineProblem(l: Partial<ReceiptLine>): 'name' | 'qty' | 'price' | null {
  if (typeof l.name !== 'string' || !l.name.trim()) return 'name';
  if (typeof l.qty !== 'number' || !Number.isFinite(l.qty) || l.qty <= 0 || l.qty > 100_000) return 'qty';
  if (typeof l.unitPrice !== 'number' || !Number.isFinite(l.unitPrice) || l.unitPrice < 0 || l.unitPrice > 100_000_000_000) return 'price';
  return null;
}

/** What the Directory says this supplier sells (free-text suppliers have no category). */
export const supplierCategory = (s: ClubState, directoryId?: string): SpendCategory | undefined => (directoryId ? s.directory[directoryId]?.category : undefined);

// ---- Spending: where the money went, from the approved receipts ----

export type SpendPeriod = 'month' | '3m' | '6m' | 'custom';
/** Calendar months ending today: this month is the 1st to today, 3 months starts on the 1st two months back. */
export function spendWindow(p: SpendPeriod, today: ISODate, custom?: { from: ISODate; to: ISODate }): { from: ISODate; to: ISODate } {
  if (p === 'custom' && custom) return { from: custom.from, to: custom.to };
  const back = p === '3m' ? 2 : p === '6m' ? 5 : 0;
  return { from: monthStart(addMonths(ym(today), -back)), to: today };
}

export interface SpendRow { key: string; label: string; amount: number; count: number }
export interface ItemRow extends SpendRow { unit: string; qty: number; avgUnitPrice: number; change: number | null /* last vs first unit price, as a fraction */ }

/** One item is a name in a unit: 'Tisu basah' per pack and per box are separate rows. */
export const itemKey = (name: string, unit: string): string => `${name.trim().toLowerCase()}|${unit}`;

/** Approved receipts that aren't voided, dated inside the window, oldest first. */
function counted(s: ClubState, from: ISODate, to: ISODate): Receipt[] {
  return live(s.receipts)
    .filter((r) => r.status === 'approved' && !r.voidedAt && r.date >= from && r.date <= to)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));
}
const bySize = <T extends SpendRow>(rows: T[]): T[] => rows.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

/**
 * What was paid in the window. A receipt counts its total: the lines give the category, item and brand rows, and the part
 * of the total they miss (Tokopedia shipping) goes under the supplier's category; one without lines counts its whole total there.
 */
export function spending(s: ClubState, from: ISODate, to: ISODate): { total: number; byCategory: SpendRow[]; byItem: ItemRow[]; byBrand: SpendRow[]; byVendor: SpendRow[] } {
  const cat = new Map<string, SpendRow>();
  const brand = new Map<string, SpendRow>();
  const vendor = new Map<string, SpendRow>();
  const items = new Map<string, { row: ItemRow; first: number; last: number }>();
  const add = (m: Map<string, SpendRow>, key: string, label: string, amount: number, count = 1) => {
    const row = m.get(key) ?? { key, label, amount: 0, count: 0 };
    row.label = label; // receipts run oldest first, so the label ends as the newest spelling
    row.amount += amount;
    row.count += count;
    m.set(key, row);
  };
  let total = 0;
  for (const r of counted(s, from, to)) {
    const lines = r.lines ?? [];
    const itemsSum = linesTotal(lines);
    // what was paid: the part of the total the lines miss (shipping, rounding) counts; lines over the total (a discount) are left as they are
    const missed = lines.length ? Math.max(0, r.amount - itemsSum) : 0;
    const whole = lines.length ? itemsSum + missed : r.amount;
    total += whole;
    add(vendor, r.directoryId ?? r.supplier.trim().toLowerCase(), r.supplier, whole);
    if (!lines.length) {
      const c = supplierCategory(s, r.directoryId) ?? 'other';
      add(cat, c, c, r.amount);
      continue;
    }
    if (missed) { const c = supplierCategory(s, r.directoryId) ?? 'other'; add(cat, c, c, missed, 0); }
    for (const l of lines) {
      add(cat, l.category, l.category, l.amount);
      if (l.brand?.trim()) add(brand, l.brand.trim().toLowerCase(), l.brand.trim(), l.amount);
      const key = itemKey(l.name, l.unit);
      const it = items.get(key) ?? { row: { key, label: l.name, unit: l.unit, amount: 0, count: 0, qty: 0, avgUnitPrice: 0, change: null }, first: l.unitPrice, last: l.unitPrice };
      it.row.label = l.name;
      it.row.amount += l.amount;
      it.row.count += 1;
      it.row.qty += l.qty;
      it.last = l.unitPrice;
      items.set(key, it);
    }
  }
  const byItem = [...items.values()].map(({ row, first, last }) => ({
    ...row,
    avgUnitPrice: row.qty ? row.amount / row.qty : 0,
    change: row.count > 1 && first > 0 ? (last - first) / first : null,
  }));
  return { total, byCategory: bySize([...cat.values()]), byItem: bySize(byItem), byBrand: bySize([...brand.values()]), byVendor: bySize([...vendor.values()]) };
}

/** Every purchase of one item in the window, oldest first (for the item's price trend). */
export function itemPurchases(s: ClubState, key: string, from: ISODate, to: ISODate): { date: ISODate; receiptId: string; supplier: string; brand?: string; qty: number; unitPrice: number; amount: number }[] {
  const out: ReturnType<typeof itemPurchases> = [];
  for (const r of counted(s, from, to))
    for (const l of r.lines ?? [])
      if (itemKey(l.name, l.unit) === key) out.push({ date: r.date, receiptId: r.id, supplier: r.supplier, ...(l.brand ? { brand: l.brand } : {}), qty: l.qty, unitPrice: l.unitPrice, amount: l.amount });
  return out;
}
