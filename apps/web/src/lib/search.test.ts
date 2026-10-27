// Super search: normalising the text and ranking the items.
import { describe, expect, it } from 'vitest';
import { SEARCH_GROUPS, normalize, rank, scoreItem, scoreTerm, type SearchItem } from './search';

describe('normalize', () => {
  it('lower-cases, drops accents and tidies the spaces', () => {
    expect(normalize('  Oma  LÍNA ')).toBe('oma lina');
    expect(normalize('INV-2609-020')).toBe('inv 2609 020');
    expect(normalize('***')).toBe('');
  });
});

describe('scoreTerm', () => {
  it('scores each band', () => {
    expect(scoreTerm('tagihan', 'tagihan')).toBe(100);
    expect(scoreTerm('tag', 'tagihan')).toBe(80);
    expect(scoreTerm('lina', 'oma lina')).toBe(60);
    expect(scoreTerm('2609 020', 'inv 2609 020')).toBe(40);
    expect(scoreTerm('tagihqn', 'tagihan')).toBe(20);
    expect(scoreTerm('tagiahn', 'tagihan')).toBe(0);
    expect(scoreTerm('tg', 'tagihan')).toBe(0);
  });
  it('matches several words in any order, each to a different word', () => {
    expect(scoreTerm('lina oma', 'oma lina')).toBe(40);
    expect(scoreTerm('a ab', 'ab a')).toBe(40);
  });
  it('forgives a typo only from four letters up', () => {
    expect(scoreTerm('tagi', 'tagihan')).toBe(80);
    expect(scoreTerm('bilx', 'billing')).toBe(20);
    expect(scoreTerm('bix', 'billing')).toBe(0);
  });
});

const item = (id: string, group: SearchItem['group'], label: string, terms: string[] = [], sub?: string): SearchItem =>
  ({ id, group, label, sub, icon: 'x', to: `/${id}`, terms });

const fixture: SearchItem[] = [
  item('billing', 'screens', 'Billing', ['tagihan', 'invoices']),
  item('inbox', 'screens', 'Inbox', ['bilik']),
  item('pay', 'actions', 'Record payment', ['bayar']),
  item('oma', 'people', 'Oma Lina', ['room 4'], 'Room 4'),
  item('inv', 'records', 'INV-2609-020', ['bill'], 'Oma Lina'),
  item('dish', 'records', 'Nasi tim', ['menu']),
];

describe('scoreItem', () => {
  it('takes the best of label, sub and terms', () => {
    expect(scoreItem('tagihan', fixture[0]!)).toBe(100);
    expect(scoreItem('room', fixture[3]!)).toBe(80);
    expect(scoreItem('zzz', fixture[0]!)).toBe(0);
  });
});

describe('rank', () => {
  it('puts the best screen first', () => {
    const out = rank(fixture, 'bil');
    const screens = out.find((g) => g.group === 'screens')!;
    expect(screens.hits[0]!.id).toBe('billing');
    expect(screens.hits.map((h) => h.id)).toEqual(['billing', 'inbox']);
  });
  it('returns nothing for an empty or unmatched query', () => {
    expect(rank(fixture, '')).toEqual([]);
    expect(rank(fixture, 'x'.repeat(200))).toEqual([]);
    expect(rank(fixture, '%%%')).toEqual([]);
  });
  it('keeps the group order, skips empty groups and caps each group', () => {
    const out = rank(fixture, 'oma');
    expect(out.map((g) => g.group)).toEqual(['people', 'records']);
    expect(SEARCH_GROUPS).toEqual(['screens', 'actions', 'people', 'records']);
    const many = Array.from({ length: 8 }, (_, i) => item(`p${i}`, 'people', `Oma ${String.fromCharCode(65 + i)}`));
    const res = rank([...fixture, ...many], 'oma');
    expect(res.find((g) => g.group === 'people')!.hits).toHaveLength(6);
    expect(rank([...fixture, ...many], 'oma', 2).find((g) => g.group === 'people')!.hits).toHaveLength(2);
  });
  it('sorts by score, then label', () => {
    const items = [item('b', 'people', 'Budi'), item('a', 'people', 'Ana Budi'), item('c', 'people', 'Bud')];
    expect(rank(items, 'bud')[0]!.hits.map((h) => h.id)).toEqual(['c', 'b', 'a']);
  });
});
