import { describe, expect, it } from 'vitest';
import { clampDate, dateAllowed, firstAllowedInHour, hmToMin, isHM, minToHM, minuteChoices, monthAllowed, monthGrid, shiftMonth, stepDate, weekdayMon, withMonth, yearAllowed, yearPageStart } from './dates';

describe('calendar math', () => {
  it('weeks start on Monday', () => {
    expect(weekdayMon('2026-10-19')).toBe(0); // Monday
    expect(weekdayMon('2026-10-21')).toBe(2); // Wednesday
    expect(weekdayMon('2026-10-25')).toBe(6); // Sunday
  });
  it('lays out October 2026 (1 Oct is a Thursday) in whole Monday-first weeks', () => {
    const g = monthGrid('2026-10');
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g[g.length - 1].at(-1)).toBeNull();
    expect(g).toHaveLength(5);
  });
  it('handles a month that starts on Monday (no blanks) and leap February', () => {
    expect(monthGrid('2026-06')[0][0]).toBe('2026-06-01');
    expect(monthGrid('2024-02').flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2026-02').flat().filter(Boolean)).toHaveLength(28);
    expect(monthGrid('2026-02')).toHaveLength(5); // 1 Feb 2026 is a Sunday: six blanks, then 28 days
    expect(monthGrid('2027-02')).toHaveLength(4); // 1 Feb 2027 is a Monday: exactly four full weeks
  });
  it('clamps dates into min..max', () => {
    expect(clampDate('2026-10-21', '2026-11-01', '2026-12-01')).toBe('2026-11-01');
    expect(clampDate('2027-01-01', '2026-11-01', '2026-12-01')).toBe('2026-12-01');
    expect(clampDate('2026-11-15', '2026-11-01', '2026-12-01')).toBe('2026-11-15');
    expect(clampDate('2026-11-15')).toBe('2026-11-15');
  });
  it('allows a day by range and by the caller rule', () => {
    const o = { min: '2026-10-05', max: '2026-10-30', disabledDate: (d: string) => d === '2026-10-21' };
    expect(dateAllowed('2026-10-20', o)).toBe(true);
    expect(dateAllowed('2026-10-21', o)).toBe(false);
    expect(dateAllowed('2026-10-04', o)).toBe(false);
    expect(dateAllowed('2026-10-31', o)).toBe(false);
    expect(dateAllowed('2026-10-05', o)).toBe(true); // inclusive
  });
  it('knows which months and years a range touches', () => {
    expect(monthAllowed('2026-09', '2026-10-05', '2026-12-20')).toBe(false);
    expect(monthAllowed('2026-10', '2026-10-05', '2026-12-20')).toBe(true);
    expect(monthAllowed('2026-12', '2026-10-05', '2026-12-20')).toBe(true);
    expect(monthAllowed('2027-01', '2026-10', '2026-12')).toBe(false);
    expect(yearAllowed(2025, '2026-01-01', '2027-12-31')).toBe(false);
    expect(yearAllowed(2027, '2026-01-01', '2027-12-31')).toBe(true);
  });
  it('shifts months keeping the day, clamped to the month length', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2024-01-31', 1)).toBe('2024-02-29');
    expect(shiftMonth('2026-10-21', -10)).toBe('2025-12-21');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(withMonth('2026-10-31', '2026-11')).toBe('2026-11-30');
  });
  it('moves the highlighted day with the keyboard', () => {
    expect(stepDate('2026-10-21', 'ArrowRight')).toBe('2026-10-22');
    expect(stepDate('2026-10-31', 'ArrowRight')).toBe('2026-11-01');
    expect(stepDate('2026-10-21', 'ArrowLeft')).toBe('2026-10-20');
    expect(stepDate('2026-10-21', 'ArrowDown')).toBe('2026-10-28');
    expect(stepDate('2026-10-03', 'ArrowUp')).toBe('2026-09-26');
    expect(stepDate('2026-10-21', 'Home')).toBe('2026-10-19');
    expect(stepDate('2026-10-21', 'End')).toBe('2026-10-25');
    expect(stepDate('2026-10-21', 'PageDown')).toBe('2026-11-21');
    expect(stepDate('2026-10-21', 'PageUp', true)).toBe('2025-10-21');
    expect(stepDate('2026-10-21', 'a')).toBeNull();
  });
  it('pages years in blocks of 12', () => {
    expect(yearPageStart(2026)).toBe(2016);
    expect(yearPageStart(2027)).toBe(2016);
    expect(yearPageStart(2028)).toBe(2028);
    expect(yearPageStart(1941)).toBe(1932);
  });
});

describe('time math', () => {
  it('converts HH:MM and minutes', () => {
    expect(hmToMin('09:58')).toBe(598);
    expect(minToHM(598)).toBe('09:58');
    expect(minToHM(0)).toBe('00:00');
    expect(isHM('23:59')).toBe(true);
    expect(isHM('24:00')).toBe(false);
    expect(isHM('9:30')).toBe(false);
    expect(isHM('')).toBe(false);
  });
  it('lists minutes on the step, plus an off-grid current value', () => {
    expect(minuteChoices(5)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(minuteChoices(15)).toEqual([0, 15, 30, 45]);
    expect(minuteChoices(5, 58)).toContain(58);
    expect(minuteChoices(5, 58).at(-1)).toBe(58);
    expect(minuteChoices(5, 30)).toHaveLength(12);
    expect(minuteChoices(0)).toHaveLength(12); // a bad step falls back to 5
    expect(minuteChoices(1)).toHaveLength(60);
  });
  it('finds the first valid time inside an hour for a min/max window', () => {
    const m = minuteChoices(5);
    expect(firstAllowedInHour(9, m, '08:30', '16:30')).toBe('09:00');
    expect(firstAllowedInHour(8, m, '08:30', '16:30')).toBe('08:30');
    expect(firstAllowedInHour(7, m, '08:30', '16:30')).toBeNull();
    expect(firstAllowedInHour(16, m, '08:30', '16:30')).toBe('16:00');
    expect(firstAllowedInHour(17, m, '08:30', '16:30')).toBeNull();
  });
});
