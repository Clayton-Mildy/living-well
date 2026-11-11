// The demo day moves on by itself once the real day changes (a server left running overnight); a pinned test day never moves.
import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async () => { vi.resetModules(); return import('./clock'); };

describe('realDayChanged', () => {
  afterEach(() => { vi.useRealTimers(); process.env.CP_DEMO_DATE = '2026-10-21'; });

  it('is false all through the day the demo started on, and true after midnight in Jakarta', async () => {
    delete process.env.CP_DEMO_DATE;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T03:00:00Z')); // Wed 11 Nov, 10:00 in Jakarta
    const { realDayChanged } = await load();
    expect(realDayChanged()).toBe(false);
    vi.setSystemTime(new Date('2026-11-11T16:30:00Z')); // 23:30 in Jakarta
    expect(realDayChanged()).toBe(false);
    vi.setSystemTime(new Date('2026-11-11T17:30:00Z')); // Thu 12 Nov, 00:30 in Jakarta
    expect(realDayChanged()).toBe(true);
  });

  it('never fires with a pinned demo day, whatever the real date', async () => {
    process.env.CP_DEMO_DATE = '2026-10-21';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T03:00:00Z'));
    const { realDayChanged } = await load();
    vi.setSystemTime(new Date('2026-12-01T03:00:00Z'));
    expect(realDayChanged()).toBe(false);
  });
});
