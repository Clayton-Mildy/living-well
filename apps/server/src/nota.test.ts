// KC 28 Oct: the drawn nota of a demo receipt shows the receipt's own numbers.
import { describe, expect, it } from 'vitest';
import type { Receipt } from '@cp/shared';
import { notaSvg } from './nota';

const base = { id: 'rc9', clubId: 'citra', createdAt: '2026-10-15T12:00', createdBy: 'staff:s1', date: '2026-10-15', supplier: 'Toko <A&B>', amount: 115000, sectionId: 'fnb', fileName: 'nota.jpg', by: 's1', status: 'approved', xero: 'synced' } as unknown as Receipt;

describe('notaSvg', () => {
  it('lists every line, the shipping the lines miss and the total; text is escaped', () => {
    const svg = notaSvg({ ...base, source: 'tokopedia', orderNo: 'INV/1', lines: [{ id: 'l1', name: 'Sabun cair', brand: 'Lifebuoy', qty: 5, unit: 'btl', unitPrice: 20000, amount: 100000, category: 'hygiene' }] });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('TOKO &lt;A&amp;B&gt;');
    expect(svg).toContain('Sabun cair Lifebuoy');
    expect(svg).toContain('5 btl x 20.000');
    expect(svg).toContain('Ongkos kirim');
    expect(svg).toContain('Rp 115.000');
    expect(svg).toContain('15/10/2026');
    expect(svg).not.toMatch(/<script/i);
  });
  it('a receipt saved as a total only shows the one amount', () => {
    const svg = notaSvg(base);
    expect(svg).toContain('Belanja');
    expect(svg).not.toContain('Ongkos kirim');
    expect(svg).toContain('Rp 115.000');
  });
});
