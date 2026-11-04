// Round 18: the leave deadline uses the club's leave notice (rules/notice.ts), not the stop or downgrade days.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed } from '../seed';
import type { ClubState } from '../types';
import { leaveCheck, leaveChoices, leaveMaxMonths, leaveNeedsWord, leaveOverrunMonth } from './leave';
import { leaveMonthChoices } from './renewals';

const withLeave30 = (): ClubState => produce(buildSeed().citra, (d) => { d.club.settings.notice = { downgrade: 14, stop: 14, leave: 30 }; });

describe('leave notice', () => {
  it('with leave notice 30, December asked on 5 Nov is late: the deadline was 1 Nov', () => {
    const s = withLeave30();
    expect(leaveCheck(s, s.members.m1, '2026-12', '2026-11-05')).toEqual({ ok: false, code: 'err.leaveLate', params: { deadline: '2026-11-01', month: '2026-12' } });
  });
  it('the choices skip December and give the 30-day deadlines', () => {
    const s = withLeave30();
    expect(leaveChoices(s, s.members.m1, '2026-11-05').map((c) => [c.month, c.deadline])).toEqual([['2027-01', '2026-12-02'], ['2027-02', '2027-01-02'], ['2027-03', '2027-01-30']]);
  });
});

describe('round 19: leave in a row is a club setting', () => {
  const withMax = (n: number) => produce(buildSeed().citra, (d) => { d.club.settings.leaveMaxMonths = n; });
  const booked = (s: ClubState, months: string[]) => produce(s, (d) => { d.members.m1.memberships.at(-1)!.leaves = months.map((month) => ({ month, at: '2026-10-01T10:00', by: 'family:f1' })); });
  it('defaults to 2', () => {
    expect(leaveMaxMonths({ club: { settings: {} } } as unknown as ClubState)).toBe(2);
    expect(leaveMaxMonths(buildSeed().citra)).toBe(2);
  });
  it('with 3, a third month in a row passes and a fourth fails with the max', () => {
    const s = booked(withMax(3), ['2026-12', '2027-01']);
    expect(leaveCheck(s, s.members.m1, '2027-02', '2026-10-21')).toEqual({ ok: true });
    const t = booked(withMax(3), ['2026-12', '2027-01', '2027-02']);
    expect(leaveCheck(t, t.members.m1, '2027-03', '2026-10-21')).toEqual({ ok: false, code: 'err.leaveMax', params: { max: 3 } });
  });
  it('the follow-up offers as many months as the setting', () => {
    expect(leaveMonthChoices(withMax(3), '2026-12')).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(leaveMonthChoices(buildSeed().citra, '2026-12')).toEqual(['2026-12', '2027-01']);
  });
  it('with 3, word is needed after the third month, not the second; no word ends it after the third', () => {
    const two = booked(withMax(3), ['2026-12', '2027-01']);
    expect(leaveNeedsWord(two, two.members.m1, '2026-10-21')).toBeUndefined();
    expect(leaveOverrunMonth(two, two.members.m1, '2027-02-01')).toBeUndefined();
    const three = booked(withMax(3), ['2026-12', '2027-01', '2027-02']);
    expect(leaveNeedsWord(three, three.members.m1, '2026-10-21')).toEqual({ after: '2027-03', deadline: '2027-02-28' });
    expect(leaveOverrunMonth(three, three.members.m1, '2027-03-01')).toBe('2027-03');
  });
  it('Review Focus 2: lowering the max to 1 keeps 2 booked months; only a new request over it fails', () => {
    const s = booked(withMax(1), ['2026-12', '2027-01']);
    expect(s.members.m1.memberships.at(-1)!.leaves!.map((l) => l.month)).toEqual(['2026-12', '2027-01']);
    expect(leaveCheck(s, s.members.m1, '2027-02', '2026-10-21')).toEqual({ ok: false, code: 'err.leaveMax', params: { max: 1 } });
    expect(leaveCheck(s, s.members.m1, '2027-04', '2026-10-21')).toEqual({ ok: true }); // not in a row
  });
});
