import { describe, it, expect } from 'vitest';
import { waUrl } from './util';

describe('waUrl', () => {
  it('is wa.me with the digits of the E.164 number: no plus, no spaces', () => {
    expect(waUrl('+6281210904471')).toBe('https://wa.me/6281210904471');
    expect(waUrl('+62 812-1090-4471')).toBe('https://wa.me/6281210904471');
  });
  it('is empty without a number', () => {
    expect(waUrl('')).toBe('');
    expect(waUrl(undefined)).toBe('');
    expect(waUrl(null)).toBe('');
  });
});
