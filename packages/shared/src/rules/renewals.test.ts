// KC round 7: renewals rules: the month, the dates, the leave check for a follow-up, and the seed (5 members in the tests, 45 in the demo).
import { describe, it, expect } from 'vitest';
import { buildCitra, DEMO_START_MIN, live, type ClubState } from '../index';
import { leaveDeadline } from './leave';
import { askedInApp, followUpId, isDecided, leaveMonthsCheck, renewalCounts, renewalDates, renewalMembers, renewalMonth, renewalRows, renewalsLeft } from './renewals';

describe('the month and its dates', () => {
  it('the coming month; the leave deadline is 14 days before the end of the month before; the invoice goes out on the 21st', () => {
    expect(renewalMonth('2026-10-21')).toBe('2026-11');
    expect(renewalMonth('2026-12-30')).toBe('2027-01');
    const s = buildCitra('2026-10-08', DEMO_START_MIN);
    expect(leaveDeadline('2026-11')).toBe('2026-10-17');
    expect(renewalDates(s, '2026-11', '2026-10-08')).toEqual({ leaveDeadline: '2026-10-17', leaveOpen: true, leaveFrom: '2026-11', invoice: '2026-11-21' });
    // after the notice day leave can only start in the month after
    expect(renewalDates(s, '2026-11', '2026-10-21')).toMatchObject({ leaveOpen: false, leaveFrom: '2026-12' });
  });
  it('leave for a follow-up: each month passes the leave rules, two in a row at most', () => {
    const s = buildCitra('2026-10-21', DEMO_START_MIN);
    const lina = s.members.m1;
    expect(leaveMonthsCheck(s, lina, ['2026-11'], '2026-10-21')).toMatchObject({ ok: false, code: 'err.leaveLate' });
    expect(leaveMonthsCheck(s, lina, ['2026-12'], '2026-10-21')).toEqual({ ok: true });
    expect(leaveMonthsCheck(s, lina, ['2026-11', '2026-12'], '2026-10-10')).toEqual({ ok: true });
    expect(leaveMonthsCheck(s, lina, ['2026-11', '2026-12', '2027-01'], '2026-10-10')).toMatchObject({ ok: false, code: 'err.invalid' });
    // the notice was given on the 15th: still in time when management approves on the 21st
    expect(leaveMonthsCheck(s, lina, ['2026-11'], '2026-10-21', '2026-10-15')).toEqual({ ok: true });
  });
});

describe.each([['2026-10-21'], ['2026-10-08']])('the seed around %s', (T) => {
  const month = renewalMonth(T);
  const check = (s: ClubState, n: { min: number; max: number }) => {
    const fus = live(s.followUps);
    expect(fus.length).toBeGreaterThanOrEqual(n.min);
    expect(fus.length).toBeLessThanOrEqual(n.max);
    expect(fus.every((f) => f.month === month && f.id === followUpId(month, f.memberId) && f.calls.length > 0)).toBe(true);
    for (const f of fus) for (const c of f.calls) expect(c.at < `${T}T09:58`).toBe(true); // nothing "done today" after the demo start
    const outs = fus.map((f) => f.outcome);
    expect(outs).toContain('upgrade');
    expect(fus.find((f) => f.outcome === 'upgrade')).toMatchObject({ status: 'pending', approval: { status: 'pending', by: 'staff:s1' } });
    expect(fus.find((f) => f.outcome === 'noAnswer')?.calls).toHaveLength(2);
    expect(outs).toContain('callBack');
    expect(outs).toContain('continue');
    // a leave is only seeded when the rules allow it on that day
    for (const f of fus.filter((x) => x.outcome === 'leave')) expect(leaveMonthsCheck(s, s.members[f.memberId], f.leaveMonths!, T)).toEqual({ ok: true });
    // everyone with a follow-up is someone to follow up; members who asked in the app are not given one
    const ids = new Set(renewalMembers(s, month).map((m) => m.id));
    for (const f of fus) { expect(ids.has(f.memberId)).toBe(true); expect(askedInApp(s, s.members[f.memberId], month)).toBeUndefined(); }
    const rows = renewalRows(s, month);
    const c = renewalCounts(rows);
    expect(c.toDo + c.waiting + c.decided).toBe(c.total);
    expect(renewalsLeft(s, T)).toBe(c.toDo);
    expect(rows.filter((r) => r.state === 'decided').every((r) => isDecided(r.f) || !!r.asked)).toBe(true);
    return rows;
  };
  it('5 members (the tests): a few decided, one waiting, two still to do, one asked in the app', () => {
    const rows = check(buildCitra(T, DEMO_START_MIN), { min: 4, max: 4 });
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.m.id === 'm10')).toMatchObject({ state: 'decided', asked: 'plan' });
  });
  it('45 members (the demo): 6 to 8 follow-ups, with management\'s waiting list and most members still to do', () => {
    const rows = check(buildCitra(T, DEMO_START_MIN, { roster: true }), { min: 6, max: 9 });
    expect(rows.length).toBeGreaterThan(35);
    const c = renewalCounts(rows);
    expect(c.waiting).toBeGreaterThanOrEqual(2);
    expect(c.toDo).toBeGreaterThan(c.decided);
  });
});
