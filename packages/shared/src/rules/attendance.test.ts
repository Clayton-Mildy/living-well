// round 14 (B2): a visit on an open weekend day is a visit like any other
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, flexMonth, getUser, wouldBeExtra, type ClubState, type PlanDef } from '../index';

describe('Flex visits on a programmed weekend', () => {
  it('a check-in on the programmed Saturday counts toward the month’s Flex visits', () => {
    const clubs = buildSeed();
    const SAT = '2026-11-14'; // a Saturday with no rental (October's are rented out)
    const s = produce(clubs.citra, (d) => { d.invoices = {}; /* no hold from an unpaid October invoice */ d.scheduleDays[SAT] = { id: SAT, clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s9', date: SAT, slots: { '10:30': { activityId: 'act-angklung', staffId: 's5', roomId: 'room-music' } } }; });
    const before = flexMonth(s, s.members.m1, '2026-11', SAT);
    const r = execute(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, getUser(clubs, 's1')!, { today: SAT, nowMin: 600 }, 't-sat');
    const after = flexMonth(r.state, r.state.members.m1, '2026-11', SAT);
    expect(after.visits).toContain(SAT);
    expect(after.used).toBe(before.used + 1);
  });
});

// ---------- round 15, phase 2: quota by plan ----------
describe('the quota of a custom plan', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
  const stateOn = (plan: PlanDef): ClubState => {
    const s = structuredClone(buildSeed().citra);
    s.club.settings.plans = [plan];
    s.members.m1.plans = [{ from: '2020-01-01', plan: plan.id, by: 'staff:s9' }];
    s.attendance = {};
    for (const d of days) s.attendance[`${d}:m1`] = { id: `${d}:m1`, clubId: s.clubId, createdAt: `${d}T09:00`, createdBy: 'staff:s1', date: d, memberId: 'm1', checkIn: { at: `${d}T09:00`, by: 'staff:s1', method: 'manual' } } as never;
    return s;
  };
  it('on a days plan with a quota of 8, the 9th visit of the month is an extra day', () => {
    const s = stateOn({ id: 'plan_1', name: 'Flex 8', kind: 'days', quota: 8, active: true });
    const fm = flexMonth(s, s.members.m1, '2026-10', '2026-10-21');
    expect(fm).toMatchObject({ quota: 8, used: 9, left: 0, extra: 1, extraDates: ['2026-10-13'] });
    expect(wouldBeExtra(s, s.members.m1, '2026-10-13')).toBe(true);
    expect(wouldBeExtra(s, s.members.m1, '2026-10-12')).toBe(false);
  });
  it('on an unlimited custom plan nothing is an extra day', () => {
    const s = stateOn({ id: 'plan_2', name: 'Private', kind: 'unlimited', active: true });
    expect(flexMonth(s, s.members.m1, '2026-10', '2026-10-21')).toMatchObject({ quota: null, extraDates: [], extra: 0 });
    expect(wouldBeExtra(s, s.members.m1, '2026-10-13')).toBe(false);
  });
  it('Flex keeps the club quota', () => {
    const s = stateOn({ id: 'plan_1', name: 'Flex 8', kind: 'days', quota: 8, active: true });
    s.members.m1.plans = [{ from: '2020-01-01', plan: 'flex', by: 'staff:s9' }];
    expect(flexMonth(s, s.members.m1, '2026-10', '2026-10-21')).toMatchObject({ quota: 10, extra: 0 });
  });
});
