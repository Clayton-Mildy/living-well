import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, dayArc, moodId, moodStats } from '../index';

const T = '2026-10-21';
const s0 = buildSeed().citra;
const withMarks = produce(s0, (d) => {
  // the seed has m1 away today; here they are in the club, so their visit is one of the day's check-ins
  d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
  for (const [moment, face, time] of [['arrival', 3, '10:00'], ['departure', 5, '15:45']] as const) {
    d.moodMarks[moodId(T, 'm1', moment)] = { id: moodId(T, 'm1', moment), clubId: d.clubId, createdAt: `${T}T${time}`, createdBy: 'staff:s1', memberId: 'm1', date: T, time, moment, face, by: 'staff:s1' };
  }
});

describe('mood rules', () => {
  it('moodId is stable and slot-aware', () => {
    expect(moodId(T, 'm1', 'activity', '10:30')).toBe('2026-10-21:m1:activity:10:30');
    expect(moodId(T, 'm1', 'arrival')).toBe('2026-10-21:m1:arrival');
  });
  it('dayArc gives the lift', () => {
    const a = dayArc(withMarks, 'm1', T);
    expect(a.arrival).toBe(3);
    expect(a.departure).toBe(5);
    expect(a.lift).toBe(2);
    expect(dayArc(s0, 'm1', T).lift).toBeNull();
  });
  it('moodStats counts visits without an arrival mark', () => {
    const st = moodStats(withMarks, [T]);
    expect(st.index).toBe(4);
    expect(st.n).toBe(2);
    expect(st.lift).toBe(2);
    expect(st.notMarkedAtDoor).toBe(Object.values(withMarks.attendance).filter((a) => a.date === T && a.checkIn).length - 1);
  });
});
