import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, pageSlice, pageWindow } from './paging';

describe('paging math', () => {
  it('counts pages (an empty list is still one page)', () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
    expect(pageCount(95, 10)).toBe(10);
    expect(pageCount(5, 0)).toBe(5); // a bad size counts as 1
  });
  it('keeps the page inside 1..pages', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(NaN, 5)).toBe(1);
    expect(clampPage(2.7, 5)).toBe(2);
  });
  it('slices a page, and the last page may be short', () => {
    const items = Array.from({ length: 23 }, (_, i) => i + 1);
    expect(pageSlice(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pageSlice(items, 3, 10)).toEqual([21, 22, 23]);
    expect(pageSlice(items, 9, 10)).toEqual([21, 22, 23]); // past the end shows the last page
    expect(pageSlice([], 1, 10)).toEqual([]);
  });
  it('shows every page of a short list and a window with ellipses for a long one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 20)).toEqual([1, 2, '…', 20]);
    expect(pageWindow(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
    expect(pageWindow(20, 20)).toEqual([1, '…', 19, 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, '…', 20]);
    expect(pageWindow(17, 20)).toEqual([1, '…', 16, 17, 18, 19, 20]);
  });
});
