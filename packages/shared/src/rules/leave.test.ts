// Round 18: the leave deadline uses the club's leave notice (rules/notice.ts), not the stop or downgrade days.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed } from '../seed';
import type { ClubState } from '../types';
import { leaveCheck, leaveChoices } from './leave';

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
