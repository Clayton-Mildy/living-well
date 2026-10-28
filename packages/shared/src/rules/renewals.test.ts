// KC round 7: renewals rules: the month, the dates, the leave check for a follow-up, and the seed (5 members in the tests, 45 in the demo).
import { describe, it, expect } from 'vitest';
import { buildCitra, DEMO_START_MIN, live, monthStart, planOn, type ClubState } from '../index';
import { leaveDeadline, leaveMonths } from './leave';
import type { FollowUp } from '../types';
import { askedInApp, changeRows, followUpId, followUpOf, isApplied, isChange, isDecided, leaveMonthsCheck, nextMonthPlans, renewalCounts, renewalDates, renewalMembers, renewalMonth, renewalNext, renewalRows, renewalStatus } from './renewals';

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
    // round 14 (R25, R31): nothing waits for management; a change is done and applied; Oma Lina's upgrade is not seeded (her family asks in the app)
    expect(fus.every((f) => f.status !== 'pending' && !f.approval)).toBe(true);
    expect(followUpOf(s, 'm1', month)).toBeUndefined();
    for (const f of fus.filter((x) => isChange(x.outcome))) expect(f.status).toBe('done');
    expect(fus.find((f) => f.outcome === 'noAnswer')?.calls).toHaveLength(2);
    expect(outs).not.toContain('callBack'); // KC round 7: no "call back" option
    expect(outs).toContain('continue');
    // a leave is only seeded when the rules allow it on that day, and it is applied (the months are on the membership)
    for (const f of fus.filter((x) => x.outcome === 'leave')) {
      expect(leaveMonths(s.members[f.memberId])).toEqual(expect.arrayContaining(f.leaveMonths!));
      expect(leaveMonthsCheck(s, s.members[f.memberId], f.leaveMonths!, T)).toMatchObject({ ok: false }); // already on the list
    }
    // everyone with a follow-up is someone to follow up; members who asked in the app are not given one
    const ids = new Set(renewalMembers(s, month).map((m) => m.id));
    for (const f of fus) { expect(ids.has(f.memberId)).toBe(true); if (!isApplied(f)) expect(askedInApp(s, s.members[f.memberId], month)).toBeUndefined(); } // (an applied leave in the month is on the membership now)
    const rows = renewalRows(s, month);
    const c = renewalCounts(rows);
    expect(c.toDo + c.waiting + c.decided).toBe(c.total);
    expect(rows.filter((r) => r.state === 'decided').every((r) => isDecided(r.f) || !!r.asked)).toBe(true);
    return rows;
  };
  it('5 members (the tests): a few decided, nothing waiting, still to do, one asked in the app', () => {
    const rows = check(buildCitra(T, DEMO_START_MIN), { min: 3, max: 3 });
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.m.id === 'm10')).toMatchObject({ state: 'decided', asked: 'plan' });
    expect(renewalCounts(rows).waiting).toBe(0);
  });
  it('45 members (the demo): 5 to 9 follow-ups, the changes applied (Next month lists them), nothing waiting, most members still to do', () => {
    const s = buildCitra(T, DEMO_START_MIN, { roster: true });
    const rows = check(s, { min: 5, max: 9 });
    // KC (28 Oct): one member is on leave next month itself, asked before the notice closed
    const away = live(s.followUps).filter((f) => f.outcome === 'leave' && f.leaveMonths?.[0] === month);
    expect(away).toHaveLength(1);
    expect(nextMonthPlans(s, T).find((r) => r.member.id === away[0].memberId)?.status).toBe('leave');
    expect(rows.length).toBeGreaterThan(35);
    const c = renewalCounts(rows);
    expect(c.waiting).toBe(0);
    expect(c.toDo).toBeGreaterThan(c.decided);
    const down = live(s.followUps).find((f) => f.outcome === 'downgrade')!;
    expect(planOn(s.members[down.memberId], monthStart(month)).plan).toBe('flex');
    expect(changeRows(s, month, T).filter((r) => !r.readOnly).map((r) => r.memberId).sort()).toEqual(live(s.followUps).filter((f) => isChange(f.outcome)).map((f) => f.memberId).sort());
  });
});

// KC round 8d: the list's Status and Next step columns
it('the demo on 28 Oct (after November\'s notice closed) still has the member on leave in November, asked in time', () => {
  const T = '2026-10-28';
  const s = buildCitra(T, DEMO_START_MIN, { roster: true });
  const away = live(s.followUps).find((f) => f.outcome === 'leave' && f.leaveMonths?.[0] === '2026-11')!;
  expect(away).toBeTruthy();
  expect(away.calls[0].at < `${T}T00:00`).toBe(true);
  expect(leaveMonths(s.members[away.memberId])).toContain('2026-11');
  expect(nextMonthPlans(s, T).find((r) => r.member.id === away.memberId)?.status).toBe('leave');
});

describe('status and next step of a row', () => {
  const fu = (f: Partial<FollowUp>): FollowUp => ({ id: 'fu-2026-11-m1', clubId: 'citra', createdAt: '2026-10-20T10:00', createdBy: 'staff:s1', memberId: 'm1', month: '2026-11', calls: [], status: 'open', ...f } as FollowUp);
  const call = { at: '2026-10-20T10:00', by: 'staff:s1', outcome: 'noAnswer' } as FollowUp['calls'][number];
  const T = '2026-10-21';
  const next = (f: FollowUp | undefined, asked?: 'plan' | 'leave') => renewalNext({ f, asked }, '2026-11', T);
  const status = (f: FollowUp | undefined, asked?: 'plan' | 'leave') => renewalStatus({ f, asked });

  it('nobody reached: not contacted, call; no answer: call again with the calls so far', () => {
    expect(status(undefined)).toBe('new');
    expect(next(undefined)).toEqual({ kind: 'call' });
    expect(status(fu({ outcome: 'noAnswer', calls: [call, call] }))).toBe('noAnswer');
    expect(next(fu({ outcome: 'noAnswer', calls: [call, call] }))).toEqual({ kind: 'callAgain', calls: 2 });
  });
  it('a change that waits for management shows the outcome and says waiting for approval', () => {
    const f = fu({ outcome: 'upgrade', status: 'pending', calls: [call] });
    expect(status(f)).toBe('upgrade');
    expect(next(f)).toEqual({ kind: 'approval' });
  });
  it('a decided row says what starts when', () => {
    expect(next(fu({ outcome: 'continue', status: 'done' }))).toEqual({ kind: 'renews', date: '2026-11-01' });
    expect(next(fu({ outcome: 'downgrade', status: 'done' }))).toEqual({ kind: 'planFrom', date: '2026-11-01', plan: 'flex' });
    expect(next(fu({ outcome: 'upgrade', status: 'done' }))).toEqual({ kind: 'planFrom', date: '2026-11-01', plan: 'gold' });
    expect(next(fu({ outcome: 'leave', status: 'done', leaveMonths: ['2026-12', '2027-01'] }))).toEqual({ kind: 'leaveFrom', date: '2026-12-01' });
    expect(next(fu({ outcome: 'stop', status: 'done', lastDay: '2026-10-31' }))).toEqual({ kind: 'lastDay', date: '2026-10-31' });
    expect(status(fu({ outcome: 'stop', status: 'done', lastDay: '2026-10-31' }))).toBe('stop');
  });
  it('turned down: ask the family again; asked in the app: answer the request / leave is on the list', () => {
    const rej = fu({ outcome: 'leave', status: 'rejected', leaveMonths: ['2026-11'] });
    expect(status(rej)).toBe('rejected');
    expect(next(rej)).toEqual({ kind: 'askAgain' });
    expect(status(undefined, 'plan')).toBe('asked');
    expect(next(undefined, 'plan')).toEqual({ kind: 'answerRequest' });
    expect(next(undefined, 'leave')).toEqual({ kind: 'leaveFrom', date: '2026-11-01' });
    // a no-answer call does not hide that the family asked in the app
    expect(status(fu({ outcome: 'noAnswer', calls: [call] }), 'plan')).toBe('asked');
  });
  it('a month that has started is a read-only log: no next step', () => {
    expect(renewalNext({ f: undefined }, '2026-10', T)).toEqual({ kind: 'none' });
    expect(renewalNext({ f: undefined }, '2026-11', '2026-11-03')).toEqual({ kind: 'none' });
  });
  it('the seed rows (5 in the tests): Oma Lina not called yet, the decided continue, two no-answers, one asked in the app', () => {
    const s = buildCitra(T, DEMO_START_MIN);
    const by = Object.fromEntries(renewalRows(s, '2026-11').map((r) => [r.m.id, [renewalStatus(r), renewalNext(r, '2026-11', T).kind]]));
    expect(by).toEqual({ m1: ['new', 'call'], m2: ['noAnswer', 'callAgain'], m10: ['asked', 'answerRequest'], m20: ['noAnswer', 'callAgain'], m46: ['continue', 'renews'] });
  });
});

// round 15 (R5): the Members tab lists every member active on the 1st, plus those a recorded stop ends before it
describe('nextMonthPlans', () => {
  const T = '2026-10-21';
  const world = (edit: (ms: ClubState['members']) => void): ClubState => {
    const s = structuredClone(buildCitra(T, DEMO_START_MIN));
    // a quiet world: five members on Flex, all running, nothing recorded
    for (const m of Object.values(s.members)) {
      m.plans = [{ from: '2026-01-01', plan: 'flex', by: 'staff:s1' }];
      m.memberships = [{ start: '2026-01-01' }];
    }
    s.followUps = {};
    edit(s.members);
    return s;
  };
  const by = (rows: ReturnType<typeof nextMonthPlans>) => Object.fromEntries(rows.map((r) => [r.member.id, r]));

  it('a member with nothing recorded continues on the plan they have', () => {
    const rows = nextMonthPlans(world(() => {}), T);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toMatchObject({ status: 'continues', planNow: 'flex', planNext: 'flex' });
  });
  it('an upgrade recorded for the 1st is a plan change to Gold', () => {
    const s = world((ms) => { ms.m1.plans.push({ from: '2026-11-01', plan: 'gold', by: 'staff:s1' }); });
    expect(by(nextMonthPlans(s, T)).m1).toMatchObject({ status: 'plan', planNow: 'flex', planNext: 'gold' });
    expect(by(nextMonthPlans(s, T)).m2.status).toBe('continues');
  });
  it('leave starting the 1st shows as leave, on the plan they keep', () => {
    const s = world((ms) => { ms.m1.memberships[0].leaves = [{ month: '2026-11', by: 'staff:s1', at: '2026-10-05T10:00' }]; });
    expect(by(nextMonthPlans(s, T)).m1).toMatchObject({ status: 'leave', planNow: 'flex', planNext: 'flex' });
  });
  it('a stop this month is listed as a stop, never as continues', () => {
    const s = world((ms) => { ms.m1.memberships[0].lastDay = '2026-10-31'; });
    expect(by(nextMonthPlans(s, T)).m1).toMatchObject({ status: 'stop', planNow: 'flex', planNext: null });
    // also when the last day is today, and when it falls early in next month
    expect(by(nextMonthPlans(world((ms) => { ms.m1.memberships[0].lastDay = T; }), T)).m1.status).toBe('stop');
    expect(by(nextMonthPlans(world((ms) => { ms.m1.memberships[0].lastDay = '2026-11-10'; }), T)).m1.status).toBe('stop');
    // a last day on the final day of next month: still in all of November, so the plan on the 1st stays, with the date
    expect(by(nextMonthPlans(world((ms) => { ms.m1.memberships[0].lastDay = '2026-11-30'; }), T)).m1).toMatchObject({ status: 'stop', planNext: 'flex', lastDay: '2026-11-30' });
    expect(by(nextMonthPlans(world((ms) => { ms.m1.memberships[0].lastDay = '2026-11-15'; }), T)).m1).toMatchObject({ status: 'stop', planNext: 'flex', lastDay: '2026-11-15' });
    // a last day further out than next month does not touch it
    expect(by(nextMonthPlans(world((ms) => { ms.m1.memberships[0].lastDay = '2026-12-31'; }), T)).m1.status).toBe('continues');
  });
  it('a member who has already ended, or is waiting for approval, is not listed', () => {
    const s = world((ms) => {
      ms.m1.memberships[0].lastDay = '2026-10-10';
      ms.m2.review = { status: 'pending' } as never;
    });
    const ids = nextMonthPlans(s, T).map((r) => r.member.id);
    expect(ids).not.toContain('m1');
    expect(ids).not.toContain('m2');
    expect(ids).toContain('m10');
  });
  it('a new member whose plan starts on the 1st continues with that plan', () => {
    const s = world((ms) => {
      ms.m1.memberships = [{ start: '2026-11-01' }];
      ms.m1.plans = [{ from: '2026-11-01', plan: 'gold', by: 'staff:s1' }];
    });
    expect(by(nextMonthPlans(s, T)).m1).toMatchObject({ status: 'continues', planNow: 'gold', planNext: 'gold' });
  });
  it('a member who starts after the 1st is not listed; the list is sorted by display name', () => {
    const s = world((ms) => { ms.m1.memberships = [{ start: '2026-11-15' }]; });
    const rows = nextMonthPlans(s, T);
    expect(rows.map((r) => r.member.id)).not.toContain('m1');
    // the same order as the Members page: first and last name, not the title (Oma/Opa do not group together)
    const keys = rows.map((r) => r.member.firstName + r.member.lastName);
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});
