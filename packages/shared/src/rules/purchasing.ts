// Purchasing: the simulated receipt reader, the fixed spend categories and the checks on receipt lines.
// A real provider (a vision model or a document-AI service) replaces `simulatedReceipt` by config; nothing in the screens changes.
import type { ClubState, ISODate, OcrResult, ReceiptLine, ReceiptSource, SpendCategory } from '../types';
import { hashOf } from './activity';

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
