// Round 14 p2 seed: six months of itemised receipts for Spending. In each of the 26 weeks before this one, two approved receipts read by the simulated reader:
// Thursday a Tokopedia order by Caca (Sahabat Lansia and Grosir Sembako in turn), Saturday a shop (Superindo by the kitchen, Gramedia by Dinar or
// Bersih Prima by Caca, drawn with unit('rch:<k>:shop')). Week k back gives the ids rch-<k>-1 and rch-<k>-2, and the reader's key is rch:<k>:<n>, so
// the same receipts sit at the same distance from any demo date. Prices drift 1.2 % a month (cheaper further back); lines come off the end until a
// section's seeded week is at most 70 % of its limit, and nothing lands in the current week, so this week's Budget is as it was.
// The reader draws each unit price anywhere in the item's range, which buries a 1.2 % drift; so the seed prices an item from one keyed base
// (unit('rch:price:<item>')) with the drift and at most 1 % of keyed noise, and the Spending price trends read as the steady rise they are.
// Every Sahabat Lansia order carries adult diapers (the club's staple) as its first line, added with keyed draws when the reader didn't pick them.
// The roster also gets one Tokopedia order from Caca, yesterday, waiting for finance (it counts against this week's budget when T-1 falls in the current week). Keyed draws only.
import type { ClubState, ISODate, Receipt, ReceiptLine, SectionId, SpendCategory } from '../../types';
import { CATALOGUE, linesTotal, simulatedReceipt } from '../../rules/purchasing';
import { weeklyLimit } from '../../rules/budget';
import { addDays, weekStart } from '../../util';
import { unit } from '../history';

const SUPPLIER: Record<string, string> = {
  d9: 'Bersih Prima',
  d10: 'Sahabat Lansia Official (Tokopedia)',
  d11: 'Grosir Sembako Makmur (Tokopedia)',
  d12: 'Gramedia Kemang',
  d13: 'Superindo Kemang',
};
const SHOPS = [{ dirId: 'd13', by: 's3' }, { dirId: 'd12', by: 's5' }, { dirId: 'd9', by: 's1' }];
const SECTION = (c: SpendCategory): SectionId => (c === 'groceries' || c === 'kitchen' ? 'fnb' : c === 'activity' ? 'activities' : 'operations');
const monthIndex = (d: ISODate) => +d.slice(0, 4) * 12 + +d.slice(5, 7);
const ddmm = (d: ISODate) => d.slice(8) + d.slice(5, 7);
const round100 = (n: number) => Math.round(n / 100) * 100;
/** Each line at the item's seeded price `drift` away from today's, with ±1 % of noise keyed by the line. */
const reprice = (lines: ReceiptLine[], drift: number, key: string) => {
  for (const l of lines) {
    const c = CATALOGUE.find((x) => x.name === l.name)!;
    const base = c.price[0] + unit(`rch:price:${l.name}`) * (c.price[1] - c.price[0]);
    l.unitPrice = round100(base * (1 + drift) * (1 + (unit(`${key}:${l.id}`) - 0.5) * 0.02));
    l.amount = l.qty * l.unitPrice;
  }
};

const POPOK = CATALOGUE.find((c) => c.name.startsWith('Popok dewasa'))!;
/** Sahabat Lansia orders lead with Popok dewasa: moved to the front, or added (keyed qty and brand) and kept to 4 lines; the lines are renumbered. */
const withPopok = (lines: ReceiptLine[], key: string) => {
  const at = lines.findIndex((l) => l.name === POPOK.name);
  const popok = at >= 0 ? lines.splice(at, 1)[0]
    : { id: '', name: POPOK.name, brand: POPOK.brands[Math.floor(unit(`${key}:popok:b`) * POPOK.brands.length)], qty: 1 + Math.floor(unit(`${key}:popok:q`) * 3), unit: POPOK.unit, unitPrice: 0, amount: 0, category: POPOK.category };
  lines.unshift(popok);
  lines.splice(4);
  lines.forEach((l, i) => { l.id = `l${i + 1}`; });
};

export function seedReceipts(s: ClubState, T: ISODate): void {
  const add = (id: string, date: ISODate, dirId: string, by: string, read: ReturnType<typeof simulatedReceipt>, sectionId: SectionId, amount: number, decided: boolean) => {
    const row: Receipt = {
      id, clubId: s.clubId, createdAt: `${date}T${decided ? '12:00' : '15:10'}`, createdBy: `staff:${by}`,
      date, supplier: SUPPLIER[dirId], directoryId: dirId, amount, sectionId, fileName: `nota_${ddmm(date)}.jpg`,
      ...(read.source ? { source: read.source } : {}), ...(read.orderNo ? { orderNo: read.orderNo } : {}), lines: read.lines, by,
      ...(decided ? { status: 'approved' as const, xero: 'synced' as const, decidedBy: 'staff:s10' as const, decidedAt: `${date}T16:30` } : { status: 'submitted' as const, xero: 'notSent' as const }),
    };
    s.receipts[id] = row;
  };

  const thisWeek = weekStart(T);
  for (let k = 1; k <= 26; k++) {
    const week = addDays(thisWeek, -7 * k);
    const shop = SHOPS[Math.floor(unit(`rch:${k}:shop`) * SHOPS.length)];
    const used: Partial<Record<SectionId, number>> = {};
    const plan = [
      { n: 1, date: addDays(week, 3), dirId: k % 2 ? 'd10' : 'd11', by: 's1' }, // Thursday: Tokopedia
      { n: 2, date: addDays(week, 5), dirId: shop.dirId, by: shop.by }, // Saturday: a shop
    ];
    for (const p of plan) {
      const drift = -0.012 * (monthIndex(T) - monthIndex(p.date));
      const read = simulatedReceipt(`rch:${k}:${p.n}`, p.date, { vendor: SUPPLIER[p.dirId], drift, shipping: false, maxLines: 4, maxQty: 3 }); // reprice() below sets every price, drift included
      if (p.dirId === 'd10') withPopok(read.lines, `rch:${k}:${p.n}`);
      reprice(read.lines, drift, `rch:${k}:${p.n}`);
      const sectionId = SECTION(read.lines[0].category);
      const cap = 0.7 * weeklyLimit(s, sectionId, week);
      const before = used[sectionId] ?? 0;
      while (read.lines.length > 1 && before + linesTotal(read.lines) > cap) read.lines.pop();
      const amount = linesTotal(read.lines);
      if (before + amount > cap) continue;
      used[sectionId] = before + amount;
      add(`rch-${k}-${p.n}`, p.date, p.dirId, p.by, read, sectionId, amount, true);
    }
  }

  if (!s.members.m51) return; // the roster only: Caca's order from yesterday, shipping in the total but not in the lines
  const day = addDays(T, -1);
  const read = simulatedReceipt('rch:wait', day, { vendor: SUPPLIER.d10, shipping: true, maxLines: 4, maxQty: 3 });
  const shipping = (read.total ?? 0) - linesTotal(read.lines);
  withPopok(read.lines, 'rch:wait');
  reprice(read.lines, 0, 'rch:wait');
  add('rc4', day, 'd10', 's1', read, SECTION(read.lines[0].category), linesTotal(read.lines) + shipping, false);
}
