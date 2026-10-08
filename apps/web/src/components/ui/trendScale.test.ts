import { describe, expect, it } from 'vitest';
import { clampWindow, editCustom, evenDates, inWindow, monthStarts, nearestIndex, niceTicks, pickChoice, rangeFrom, rangeValue, snapTargets, timeScale, windowOf, yDomain } from './trendScale';

describe('time scale', () => {
  it('places a point by its date and time between the start of the first day and the end of the last', () => {
    const sc = timeScale('2026-10-01', '2026-10-10', 0, 1000); // 10 days: 100px a day
    expect(sc.days).toBe(10);
    expect(sc.x('2026-10-01', '00:00')).toBe(0);
    expect(sc.x('2026-10-10', '24:00' as never)).toBe(1000);
    expect(sc.x('2026-10-02', '00:00')).toBe(100);
    expect(sc.x('2026-10-02', '12:00')).toBeCloseTo(150);
    expect(sc.x('2026-10-02')).toBeCloseTo(150); // no time: noon, the middle of the day
  });
  it('spreads several readings of one day by their time', () => {
    const sc = timeScale('2026-10-01', '2026-10-08', 0, 800);
    const am = sc.x('2026-10-05', '09:12'), pm = sc.x('2026-10-05', '15:40');
    expect(pm).toBeGreaterThan(am);
    expect(pm - am).toBeCloseTo(((15 * 60 + 40 - (9 * 60 + 12)) / 1440) * 100);
    expect(sc.x('2026-10-04', '23:59')).toBeLessThan(am);
  });
  it('keeps points on the axis, swaps dates given the wrong way round, and knows which dates are inside', () => {
    const sc = timeScale('2026-10-10', '2026-10-01', 10, 110);
    expect([sc.from, sc.to]).toEqual(['2026-10-01', '2026-10-10']);
    expect(sc.x('2026-09-20', '10:00')).toBe(10);
    expect(sc.x('2026-11-20', '10:00')).toBe(110);
    expect(sc.has('2026-10-01') && sc.has('2026-10-10')).toBe(true);
    expect(sc.has('2026-09-30') || sc.has('2026-10-11')).toBe(false);
    expect(timeScale('2026-10-01', '2026-10-01', 0, 100).days).toBe(1); // one day fills the axis
  });
});

describe('nearest point', () => {
  const xs = [10, 40, 45, 200];
  it('finds the nearest entry, the earlier one on a tie, and copes with the ends', () => {
    expect(nearestIndex(xs, -50)).toBe(0);
    expect(nearestIndex(xs, 10)).toBe(0);
    expect(nearestIndex(xs, 24)).toBe(0);
    expect(nearestIndex(xs, 26)).toBe(1); // 10 and 40 are 15 away from 25: the earlier wins at 25, 26 is closer to 40
    expect(nearestIndex(xs, 25)).toBe(0);
    expect(nearestIndex(xs, 43)).toBe(2);
    expect(nearestIndex(xs, 120)).toBe(2);
    expect(nearestIndex(xs, 125)).toBe(3);
    expect(nearestIndex(xs, 999)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
    expect(nearestIndex([7], 100)).toBe(0);
  });
  it('snaps to the moments that have a reading in any series, once each, left to right, inside the axis only', () => {
    const sc = timeScale('2026-10-01', '2026-10-10', 0, 1000);
    const tg = snapTargets([
      { points: [{ date: '2026-10-05', time: '09:12' }, { date: '2026-10-03', time: '09:00' }, { date: '2026-09-01', time: '09:00' }] },
      { points: [{ date: '2026-10-05', time: '09:12' }, { date: '2026-10-05', time: '15:40' }, { date: '2026-10-07' }] },
    ], sc);
    expect(tg.map((x) => x.key)).toEqual(['2026-10-03|09:00', '2026-10-05|09:12', '2026-10-05|15:40', '2026-10-07|']);
    expect(tg.map((x) => x.x)).toEqual([...tg.map((x) => x.x)].sort((a, b) => a - b));
    const i = nearestIndex(tg.map((x) => x.x), sc.x('2026-10-05', '14:00'));
    expect(tg[i].key).toBe('2026-10-05|15:40');
  });
});

describe('ranges and ticks', () => {
  it('counts back from today and never starts before the first reading', () => {
    expect(rangeFrom('1m', '2026-10-21', '2026-01-05')).toBe('2026-09-21');
    expect(rangeFrom('3m', '2026-10-21', '2026-01-05')).toBe('2026-07-23');
    expect(rangeFrom('6m', '2026-10-21', '2026-01-05')).toBe('2026-04-24');
    expect(rangeFrom('all', '2026-10-21', '2026-01-05')).toBe('2026-01-05');
    expect(rangeFrom('6m', '2026-10-21', '2026-10-01')).toBe('2026-10-01'); // two weeks of data fill the chart
    expect(rangeFrom('all', '2026-10-21')).toBe('2026-09-21'); // no data: a month
    expect(rangeFrom('3m', '2026-10-21', '2026-12-01')).toBe('2026-10-21');
  });
  it('pads the y range, starts counts at zero, and picks about three round gridlines', () => {
    const [lo, hi] = yDomain([120, 160]);
    expect(lo).toBeLessThan(120);
    expect(hi).toBeGreaterThan(160);
    const [flatLo, flatHi] = yDomain([62]);
    expect(flatLo).toBeLessThan(62);
    expect(flatHi).toBeGreaterThan(62);
    expect(yDomain([3, 7, 5], true)[0]).toBe(0);
    expect(yDomain([])).toEqual([0, 1]);
    const t = niceTicks(117, 169);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t.length).toBeLessThanOrEqual(4);
    expect(t.every((v) => v >= 117 && v <= 169)).toBe(true);
    expect(niceTicks(0, 5.6, 3, true).every((v) => Number.isInteger(v))).toBe(true);
    expect(niceTicks(36.2, 38.8)).toContain(37);
  });
  it('lists month starts and evenly spread dates for the axis labels', () => {
    expect(monthStarts('2026-07-12', '2026-10-21')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(monthStarts('2026-11-20', '2027-02-03')).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
    expect(monthStarts('2026-10-02', '2026-10-21')).toEqual([]);
    expect(evenDates('2026-10-01', '2026-10-31', 3)).toEqual(['2026-10-01', '2026-10-16', '2026-10-31']);
    expect(evenDates('2026-10-01', '2026-10-01', 4)).toEqual(['2026-10-01']);
  });
});

describe('date range control', () => {
  const T = '2026-10-21', FIRST = '2026-04-22';
  it('a preset runs from its first day to today; All starts at the first reading', () => {
    expect(windowOf(rangeValue('3m'), T, FIRST)).toEqual({ from: '2026-07-23', to: T });
    expect(windowOf(rangeValue('all'), T, FIRST)).toEqual({ from: FIRST, to: T });
  });
  it('switching to Custom starts from the range that was showing, and keeps an edited window when it is chosen again', () => {
    const c = pickChoice(rangeValue('1m'), 'custom', T, FIRST);
    expect(c).toEqual({ choice: 'custom', custom: { from: '2026-09-21', to: T } });
    const e = editCustom(c, 'from', '2026-08-01', T, FIRST);
    expect(windowOf(e, T, FIRST)).toEqual({ from: '2026-08-01', to: T });
    expect(pickChoice(e, 'custom', T, FIRST)).toBe(e);
    expect(pickChoice(e, '6m', T, FIRST)).toEqual({ choice: '6m', custom: null });
  });
  it('From is never after To: the other end follows, and nothing goes past today or before the first reading', () => {
    const c = pickChoice(rangeValue('3m'), 'custom', T, FIRST);
    const a = editCustom(editCustom(c, 'to', '2026-09-10', T, FIRST), 'from', '2026-09-30', T, FIRST);
    expect(windowOf(a, T, FIRST)).toEqual({ from: '2026-09-30', to: '2026-09-30' });
    const b = editCustom(editCustom(c, 'from', '2026-09-01', T, FIRST), 'to', '2026-08-15', T, FIRST);
    expect(windowOf(b, T, FIRST)).toEqual({ from: '2026-08-15', to: '2026-08-15' });
    expect(clampWindow({ from: '2026-10-30', to: '2026-10-25' }, T, FIRST)).toEqual({ from: T, to: T });
    expect(clampWindow({ from: '2026-01-01', to: '2026-06-01' }, T, FIRST)).toEqual({ from: FIRST, to: '2026-06-01' });
    expect(clampWindow({ from: '2026-06-01', to: '2026-05-01' }, T)).toEqual({ from: '2026-05-01', to: '2026-06-01' }); // swapped
  });
  it('knows which dates are inside a window (both ends included)', () => {
    const w = { from: '2026-09-01', to: '2026-09-30' };
    expect(inWindow('2026-09-01', w) && inWindow('2026-09-30', w)).toBe(true);
    expect(inWindow('2026-08-31', w) || inWindow('2026-10-01', w)).toBe(false);
  });
});
