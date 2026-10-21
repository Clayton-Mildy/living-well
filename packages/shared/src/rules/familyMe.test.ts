// Family Me / Billing / Contacts helpers: what each contact pays, short amounts, the grouped public contacts.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../index';
import { familyBill, familyContactGroups, rpShort } from './familyMe';

const T = '2026-10-21';
const seed = () => buildSeed().citra;

describe('rpShort', () => {
  it('writes millions and thousands the short Indonesian way', () => {
    expect(rpShort(2_700_000)).toBe('Rp 2,7 jt');
    expect(rpShort(3_950_000)).toBe('Rp 3,95 jt');
    expect(rpShort(5_500_000)).toBe('Rp 5,5 jt');
    expect(rpShort(10_000_000)).toBe('Rp 10 jt');
    expect(rpShort(650_000)).toBe('Rp 650 rb');
    expect(rpShort(0)).toBe('Rp 0');
  });
});

describe('familyBill', () => {
  it('the billing contact pays every open invoice of both parents', () => {
    const s = seed();
    const b = familyBill(s, 'f1', ['m1', 'm46'], T);
    expect(b.pays).toBe(true);
    expect(b.payable.map((r) => r.member.id).sort()).toEqual(['m1', 'm46']);
    expect(b.total).toBe(b.payable.reduce((a, r) => a + r.balance, 0));
    expect(b.total).toBeGreaterThan(0);
    expect(b.payers).toEqual([]);
    expect(b.firstDue).toBe(b.open[0].inv.dueDate);
  });
  it('another family member pays nothing and is told who does; the card still adds up the open invoices for information', () => {
    const s = seed();
    const b = familyBill(s, 'f2', ['m1', 'm46'], T);
    expect(b.pays).toBe(false);
    expect(b.payable).toEqual([]);
    expect(b.payers.map((p) => p.id)).toEqual(['f1']);
    expect(b.shown).toEqual(b.open);
    expect(b.total).toBe(familyBill(s, 'f1', ['m1', 'm46'], T).total);
  });
  it('an overdue invoice is flagged', () => {
    const s = seed();
    const b = familyBill(s, 'fm20_0', ['m20'], T);
    expect(b.overdue).toBe(true);
    expect(b.open.some((r) => r.status === 'overdue')).toBe(true);
  });
});

describe('familyContactGroups', () => {
  it('lists the public contacts only, doctors first, then services', () => {
    const s = seed();
    const g = familyContactGroups(s);
    expect(g.map((x) => x.kind)).toEqual(['doctor', 'service']);
    expect(g.flatMap((x) => x.items).every((d) => d.public)).toBe(true);
    expect(g[0].items.map((d) => d.name)).toEqual(['dr. Andreas Wirawan, Sp.PD', 'dr. Melinda Kusumo']);
  });
});
