import { describe, expect, it } from 'vitest';
import { canOffer, isIosDevice } from './install';

describe('install helpers', () => {
  it('detects iPhone and iPad user agents', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 'iPad', 5)).toBe(true);
  });
  it('detects iPadOS posing as a Mac, but not a real Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
  });
  it('is not iOS on Android or desktop', () => {
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv81', 5)).toBe(false);
  });
  it('offers install only when not installed and a prompt or iOS exists', () => {
    expect(canOffer(false, true, false)).toBe(true);
    expect(canOffer(false, false, true)).toBe(true);
    expect(canOffer(false, false, false)).toBe(false);
    expect(canOffer(true, true, true)).toBe(false);
  });
});
