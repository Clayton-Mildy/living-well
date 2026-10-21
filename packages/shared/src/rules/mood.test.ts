import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { withMarks } from './testMarks';
import { buildSeed, dayArc, moodId, moodStats } from '../index';

const T = '2026-10-21';
const s0 = buildSeed().citra;

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
  it('dayArc orders the activity faces by slot, not by mark time', () => {
    const s = produce(withMarks, (d) => {
      for (const [slot, face, time] of [['13:30', 4, '13:35'], ['10:30', 2, '13:40']] as const) {
        d.moodMarks[moodId(T, 'm1', 'activity', slot)] = { id: moodId(T, 'm1', 'activity', slot), clubId: d.clubId, createdAt: `${T}T${time}`, createdBy: 'staff:s1', memberId: 'm1', date: T, time, moment: 'activity', slot, face, by: 'staff:s1' };
      }
    });
    expect(dayArc(s, 'm1', T).activity.map((a) => a.slot)).toEqual(['10:30', '13:30']);
  });
  it('moodStats counts visits without an arrival mark', () => {
    const st = moodStats(withMarks, [T]);
    expect(st.index).toBe(4);
    expect(st.n).toBe(2);
    expect(st.lift).toBe(2);
    expect(st.notMarkedAtDoor).toBe(Object.values(withMarks.attendance).filter((a) => a.date === T && a.checkIn).length - 1);
  });
});
