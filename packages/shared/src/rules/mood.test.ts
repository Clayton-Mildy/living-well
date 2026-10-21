import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { withMarks } from './testMarks';
import { buildSeed, dayArc, moodId, moodInsights, sessionsOn, type Face } from '../index';
import { moodStats } from './mood';

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

  describe('moodInsights', () => {
    const mk = (d: { moodMarks: Record<string, unknown>; clubId: string }, date: string, memberId: string, moment: 'arrival' | 'activity' | 'departure', face: Face, slot?: string) => {
      const id = moodId(date, memberId, moment, slot as never);
      d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, time: slot ?? '10:00', moment, face, by: 'staff:s1', ...(slot ? { slot } : {}) };
    };
    const period = { from: '2026-10-12', to: T };
    const days = ['2026-10-12', '2026-10-13', '2026-10-14']; // Mon Tue Wed
    const arrivals = (faces: Face[]) => produce(s0, (d) => {
      d.moodMarks = {};
      faces.forEach((f, i) => mk(d as never, days[i], 'm2', 'arrival', f));
    });
    it('drops: the last three visits strictly decreasing', () => {
      expect(moodInsights(arrivals([4, 3, 2]), period, T).drops).toEqual([{ memberId: 'm2', faces: [4, 3, 2] }]);
      expect(moodInsights(arrivals([3, 3, 2]), period, T).drops).toEqual([]);
      expect(moodInsights(arrivals([4, 3]), period, T).drops).toEqual([]);
    });
    it('drops skips members who are not active today', () => {
      const s = produce(arrivals([4, 3, 2]), (d) => { d.members.m2.memberships = d.members.m2.memberships.map((p) => ({ ...p, lastDay: '2026-10-14' })); });
      expect(moodInsights(s, period, T).drops).toEqual([]);
    });
    it('byWeekday has five entries Mon to Fri, null without marks', () => {
      const r = moodInsights(arrivals([4, 3, 2]), period, T);
      expect(r.byWeekday).toEqual([4, 3, 2, null, null]);
    });
    it('byActivity joins the activity marks to the schedule cell, n >= 3, best first', () => {
      const date = days[0];
      const slot = sessionsOn(s0, date).find((x) => x.cell)!;
      const id = slot.cell!.activityId;
      const s = produce(s0, (d) => {
        d.moodMarks = {};
        ['m1', 'm2', 'm3'].forEach((m, i) => mk(d as never, date, m, 'activity', ([5, 4, 3] as Face[])[i], slot.slot));
        mk(d as never, days[1], 'm1', 'activity', 1, sessionsOn(s0, days[1]).find((x) => x.cell)!.slot); // a different day: fewer than 3 marks for its activity
      });
      const r = moodInsights(s, period, T);
      expect(r.byActivity.every((a) => a.n >= 3)).toBe(true);
      expect(r.byActivity.find((a) => a.activityId === id)).toMatchObject({ avg: 4, n: 3 });
    });
    it('lift and byMoment', () => {
      const r = moodInsights(withMarks, { from: T, to: T }, T);
      expect(r.lift).toBe(2);
      expect(r.byMoment).toEqual({ arrival: 3, health: null, activity: null, departure: 5 });
    });
  });
});
