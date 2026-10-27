// round 14 (B2): a visit on an open weekend day is a visit like any other
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, flexMonth, getUser } from '../index';

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
