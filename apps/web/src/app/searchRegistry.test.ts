// Round 14 phase E, Task 2: the search registry and the role-gated index. Runs against the seed at the e2e date.
import { describe, expect, it } from 'vitest';
import { buildSeed, displayName, hasKey, translate, type Role } from '@cp/shared';
import { rank } from '../lib/search';
import { NAVS, allowedKeys, screenFor } from './nav';
import { ACTION_ENTRIES, SCREEN_ENTRIES, buildSearchIndex } from './searchRegistry';

const s = buildSeed().citra;
const t = (k: string) => k;
const idx = (role: Role) => buildSearchIndex(s, role, t);
const byId = (role: Role, id: string) => idx(role).find((i) => i.id === id);
const STAFF: Role[] = ['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt'];

describe('role gating', () => {
  it('kitchen sees no members, no invoices and finds no records for INV', () => {
    const items = idx('kitchen');
    expect(items.some((i) => i.id.startsWith('member:'))).toBe(false);
    expect(items.some((i) => i.id.startsWith('invoice:'))).toBe(false);
    expect(rank(items, 'INV').some((g) => g.group === 'records')).toBe(false);
  });
  it('lobby has no Spending but has Add member', () => {
    expect(byId('lobby', 'screen:spending')).toBeUndefined();
    expect(byId('lobby', 'action:addMember')?.to).toBe('/members?do=add');
  });
  it('nurse cannot add a member', () => expect(byId('nurse', 'action:addMember')).toBeUndefined());
  it('finance has invoices, and Submit receipt goes to the receipts snap', () => {
    expect(idx('finance').some((i) => i.id.startsWith('invoice:'))).toBe(true);
    expect(byId('finance', 'action:submitReceipt')?.to).toBe('/receipts?do=snap');
    expect(byId('mgmt', 'action:submitReceipt')?.to).toBe('/receipts?do=snap');
  });
  it('lobby Submit receipt goes to the requests form', () => expect(byId('lobby', 'action:submitReceipt')?.to).toBe('/requests?do=receipt'));
  it('invoices open Billing where the role reaches it', () => {
    const inv = idx('finance').find((i) => i.id.startsWith('invoice:'))!;
    expect(inv.to).toBe(`/today?inv=${inv.id.slice(8)}`);
    const m = idx('mgmt').find((i) => i.id.startsWith('invoice:'))!;
    expect(m.to).toBe(`/billing?inv=${m.id.slice(8)}`);
  });
  it('dishes open the role Menu', () => {
    expect(idx('kitchen').find((i) => i.id.startsWith('dish:'))?.to).toBe('/today');
    expect(idx('lobby').find((i) => i.id.startsWith('dish:'))?.to).toBe('/menu');
    expect(idx('mgmt').find((i) => i.id.startsWith('dish:'))?.to).toBe('/menu');
  });
  it('record groups follow R4', () => {
    const has = (role: Role, p: string) => idx(role).some((i) => i.id.startsWith(p));
    expect(has('lobby', 'lead:')).toBe(true);
    expect(has('nurse', 'lead:')).toBe(false);
    expect(has('mgmt', 'staff:')).toBe(true);
    expect(has('lobby', 'staff:')).toBe(false);
    expect(has('finance', 'host:')).toBe(true);
    expect(has('mgmt', 'host:')).toBe(true);
    expect(has('nurse', 'host:')).toBe(false);
    expect(has('mgmt', 'supplier:')).toBe(true);
    expect(has('lobby', 'supplier:')).toBe(true); // R-F2: through Contacts
    expect(has('nurse', 'supplier:')).toBe(false);
    expect(has('kitchen', 'supplier:')).toBe(false);
    expect(has('activity', 'activity:')).toBe(true);
    expect(has('mgmt', 'contact:')).toBe(true);
    expect(has('kitchen', 'contact:')).toBe(false);
  });
  it('only live rows, no voided invoices', () => {
    const voided = Object.values(s.invoices).filter((i) => i.voided || i.deletedAt).map((i) => 'invoice:' + i.id);
    const ids = new Set(idx('mgmt').map((i) => i.id));
    for (const v of voided) expect(ids.has(v)).toBe(false);
  });
});

describe('supplier paths', () => {
  it('management and finance open the Directory, the lobby opens Contacts (R-F2)', () => {
    expect(idx('mgmt').find((i) => i.id.startsWith('supplier:'))!.to).toMatch(/^\/directory\?q=/);
    expect(idx('finance').find((i) => i.id.startsWith('supplier:'))!.to).toMatch(/^\/directory\?q=/);
    expect(idx('lobby').find((i) => i.id.startsWith('supplier:'))!.to).toMatch(/^\/contacts\?q=/);
  });
});

describe('every result opens a screen the role may open', () => {
  it.each(STAFF)('%s: the first path segment passes screenFor', (role) => {
    for (const i of idx(role)) {
      const seg = i.to.split('?')[0]!.split('/').filter(Boolean)[0]!;
      expect(screenFor(role, seg), `${role}: ${i.id} -> ${i.to}`).not.toBeNull();
    }
  });
});

describe('labels and ids', () => {
  it('the kitchen Today reads as its Menu', () => {
    expect(byId('kitchen', 'screen:today')?.label).toBe('nav.menu');
    expect(byId('kitchen', 'screen:today')?.to).toBe('/today');
  });
  it('item ids are unique per role', () => {
    for (const r of STAFF) { const ids = idx(r).map((i) => i.id); expect(new Set(ids).size).toBe(ids.length); }
  });
  it('a contact reads "Family of" its parent', () => {
    const c = idx('mgmt').find((i) => i.id.startsWith('contact:'))!;
    expect(c.sub).toBe('search.familyOf');
  });
});

describe('results', () => {
  it('finance: tagihan finds Billing first, and it is the Today key', () => {
    const screens = rank(idx('finance'), 'tagihan').find((g) => g.group === 'screens')!;
    expect(screens.hits[0]!.id).toBe('screen:today');
    expect(screens.hits[0]!.label).toBe('nav.billing');
  });
  it('mgmt: the nickname finds the member first', () => {
    const m = s.members['m1']!;
    const people = rank(idx('mgmt'), displayName(m)).find((g) => g.group === 'people')!;
    expect(people.hits[0]!.id).toBe('member:m1');
  });
  it('an exact invoice number finds that invoice first', () => {
    const inv = Object.values(s.invoices).find((i) => !i.voided && !i.deletedAt)!;
    const records = rank(idx('mgmt'), inv.number).find((g) => g.group === 'records')!;
    expect(records.hits[0]!.id).toBe('invoice:' + inv.id);
  });
  it('a lead is found by its contact name', () => {
    const e = Object.values(s.enquiries).find((x) => !x.deletedAt)!;
    const hit = rank(idx('lobby'), e.contact.name).find((g) => g.group === 'records');
    expect(hit?.hits.some((h) => h.id === 'lead:' + e.id)).toBe(true);
  });
});

describe('registry completeness', () => {
  it('every nav key of every staff role has a screen entry', () => {
    const have = new Set(SCREEN_ENTRIES.map((e) => e.key));
    for (const r of STAFF) for (const n of NAVS[r]) expect(have.has(n.key), `${r}:${n.key}`).toBe(true);
  });
  it('every screen and action entry has keywords in both languages', () => {
    for (const e of [...SCREEN_ENTRIES, ...ACTION_ENTRIES]) { expect(e.keywords.en.length).toBeGreaterThan(0); expect(e.keywords.id.length).toBeGreaterThan(0); }
  });
  it('screen items only for keys the role may open', () => {
    for (const r of STAFF) for (const i of idx(r).filter((x) => x.group === 'screens')) expect(allowedKeys(r).has(i.id.slice(7))).toBe(true);
  });
});

describe('copy', () => {
  it('every label and sub line resolves in both languages (no raw keys)', () => {
    const missing: string[] = [];
    for (const lang of ['en', 'id'] as const) {
      const tr = (k: string, p?: Record<string, string | number>) => { if (!hasKey(k)) missing.push(k); return translate(lang, k, p); };
      for (const r of STAFF) buildSearchIndex(s, r, tr, lang);
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
