// i18n coverage for the kitchen and requests areas: every key the screens and actions use exists in English and Indonesian,
// both languages carry the same {placeholders}, and no key is left unused.
import { describe, it, expect } from 'vitest';
import { en, id, ALLERGY_COVERS } from '@cp/shared';
import { COURSES, DISH_ALLERGENS, DISH_TAGS, KNOWN_UNITS, STOCK_AREAS } from '@cp/shared/rules/kitchenOps';

const screens = import.meta.glob(['./*.ts', './*.tsx', '../requests/*.ts', '../requests/*.tsx', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const actions = import.meta.glob(['../../../../../packages/shared/src/actions/kitchen.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const dicts = { en: en as Record<string, string>, id: id as Record<string, string> };

/** Keys that are built at run time: prefix -> the values the code appends to it. */
const DYNAMIC: Record<string, readonly string[]> = {
  'kitchen.allergen.': DISH_ALLERGENS,
  'kitchen.food.': Object.keys(ALLERGY_COVERS),
  'kitchen.tag.': DISH_TAGS,
  'kitchen.course.': COURSES,
  'kitchen.area.': STOCK_AREAS,
  'kitchen.unit.': KNOWN_UNITS,
  'kitchen.rel.': ['daughter', 'son', 'daughterInLaw', 'sonInLaw', 'granddaughter', 'grandson', 'grandchild', 'spouse', 'sibling', 'other'],
  'kitchen.dietKey.': ['softFood', 'lowSalt', 'vegetarian', 'sugarFree'],
  'kitchen.photo.status.': ['visible', 'pending', 'hidden'],
  'kitchen.stock.s_': ['requested', 'approved', 'received', 'rejected', 'cancelled'],
  'requests.mine.s_': ['waiting', 'approved', 'rejected', 'cancelled', 'withFinance'],
};
const KEY = /['"`]((?:kitchen|requests|common|status|err|nav)\.[A-Za-z0-9_.]+)['"`]/g;
const used = (files: Record<string, string>) => {
  const out = new Set<string>();
  for (const src of Object.values(files)) for (const m of src.matchAll(KEY)) out.add(m[1]);
  return out;
};
const keys = new Set([...used(screens), ...used(actions)]);
const literal = [...keys].filter((k) => !/[._]$/.test(k));
const prefixes = [...keys].filter((k) => /[._]$/.test(k));
const holders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('kitchen and requests i18n', () => {
  it('finds the screens and the actions to scan', () => {
    expect(Object.keys(screens).length).toBeGreaterThan(15);
    expect(Object.keys(actions)).toHaveLength(1);
    expect(literal.length).toBeGreaterThan(150);
  });
  it('every key used in code exists in English and Indonesian', () => {
    const missing = literal.filter((k) => !(k in dicts.en) || !(k in dicts.id));
    expect(missing).toEqual([]);
  });
  it('every run-time key prefix is known, and all its values exist in both languages', () => {
    const known = Object.keys(DYNAMIC);
    expect(prefixes.filter((p) => !known.includes(p)), 'a new run-time key prefix: add its values to DYNAMIC').toEqual([]);
    const missing = Object.entries(DYNAMIC).flatMap(([p, vals]) => vals.map((v) => p + v)).filter((k) => !(k in dicts.en) || !(k in dicts.id));
    expect(missing).toEqual([]);
  });
  it('English and Indonesian have the same keys, and the same {placeholders} in each', () => {
    for (const ns of ['kitchen.', 'requests.']) {
      const a = Object.keys(dicts.en).filter((k) => k.startsWith(ns)).sort();
      const b = Object.keys(dicts.id).filter((k) => k.startsWith(ns)).sort();
      expect(b).toEqual(a);
      expect(a.length).toBeGreaterThan(40);
      const drift = a.filter((k) => holders(dicts.en[k]) !== holders(dicts.id[k]));
      expect(drift, 'placeholders differ between EN and ID').toEqual([]);
      expect(a.filter((k) => !dicts.id[k].trim() || !dicts.en[k].trim())).toEqual([]);
    }
  });
  it('Indonesian is translated, not copied (apart from words that are the same in both)', () => {
    const same = Object.keys(dicts.en).filter((k) => (k.startsWith('kitchen.') || k.startsWith('requests.')) && dicts.en[k] === dicts.id[k]);
    // data-like labels that are legitimately identical
    const allowed = new Set(['kitchen.unit.kg', 'kitchen.allergen.gluten', 'kitchen.food.gluten', 'kitchen.dietKey.vegetarian', 'kitchen.tag.vegetarian', 'kitchen.food.seafood', 'kitchen.picker.titleDay']); // no words: a format string
    expect(same.filter((k) => !allowed.has(k))).toEqual([]);
  });
  it('no key is left unused', () => {
    const all = Object.keys(dicts.en).filter((k) => k.startsWith('kitchen.') || k.startsWith('requests.'));
    const dyn = new Set(Object.entries(DYNAMIC).flatMap(([p, vals]) => vals.map((v) => p + v)));
    const unused = all.filter((k) => !keys.has(k) && !dyn.has(k));
    expect(unused).toEqual([]);
  });
});
