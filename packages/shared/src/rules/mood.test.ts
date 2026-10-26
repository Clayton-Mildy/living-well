import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { withMarks } from './testMarks';
import { buildSeed, dayArc, moodId, moodInsights, sessionsOn, type ClubState, type DailyLog, type Face, type MoodMoment } from '../index';
import { dailyMood, missingMarks, moodStats } from './mood';
import { logId } from './activity';

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
      expect(r.byMoment).toEqual({ arrival: 3, health: null, morning: null, lunch: null, activity: null, departure: 5 });
    });
  });

  describe('dailyMood (round 14)', () => {
    const put = (d: ClubState, date: string, memberId: string, moment: MoodMoment, face: Face, slot?: string) => {
      const id = moodId(date, memberId, moment, slot as never);
      d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, time: slot ?? '10:00', moment, face, by: 'staff:s1', ...(slot ? { slot } : {}) };
    };
    it('is the rounded mean of that member\'s marks that day, with the marks', () => {
      const r = dailyMood(withMarks, 'm1', T);
      expect(r?.face).toBe(4);
      expect(r?.marks.map((m) => m.moment)).toEqual(['arrival', 'departure']);
      const s = produce(withMarks, (d) => { put(d as ClubState, T, 'm1', 'morning', 4); }); // 3, 4, 5 → 4; 3 and 4 alone → 3.5 rounds to 4
      expect(dailyMood(s, 'm1', T)?.face).toBe(4);
      expect(dailyMood(produce(withMarks, (d) => { put(d as ClubState, T, 'm1', 'departure', 4); }), 'm1', T)?.face).toBe(4);
    });
    it('never takes marks from another day or another member', () => {
      const s = produce(withMarks, (d) => {
        put(d as ClubState, '2026-10-20', 'm1', 'lunch', 1);
        put(d as ClubState, T, 'm2', 'lunch', 1);
      });
      expect(dailyMood(s, 'm1', T)).toMatchObject({ face: 4 });
      expect(dailyMood(s, 'm1', T)!.marks).toHaveLength(2);
    });
    it('a day with only the old mood word and no faces has no daily mood', () => {
      const D = '2026-10-19';
      const s = produce(withMarks, (d) => {
        for (const [id, mk] of Object.entries(d.moodMarks)) if (mk.memberId === 'm1' && mk.date === D) delete d.moodMarks[id];
        d.dailyLogs[logId('m1', D)] = { id: logId('m1', D), clubId: d.clubId, createdAt: `${D}T15:00`, createdBy: 'staff:s5', memberId: 'm1', date: D, mood: 'cheerful', note: '', status: 'saved', by: 's5', edits: [] } as DailyLog;
      });
      expect(dailyMood(s, 'm1', D)).toBeNull();
    });
  });

  describe('missingMarks (round 14)', () => {
    // the seed on the demo day: m20, m2 and m10 are in (none gone home), each marked at the door; m10 has an arrival reading and a health face
    const put = (d: ClubState, memberId: string, moment: MoodMoment, face: Face, slot?: string) => {
      const id = moodId(T, memberId, moment, slot as never);
      d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId, date: T, time: '10:00', moment, face, by: 'staff:s1', ...(slot ? { slot } : {}) };
    };
    const log = (d: ClubState, memberId: string, patch: Partial<DailyLog>) => {
      d.dailyLogs[logId(memberId, T)] = { id: logId(memberId, T), clubId: d.clubId, createdAt: `${T}T12:00`, createdBy: 'staff:s5', memberId, date: T, note: '', status: 'saved', by: 's5', edits: [], ...patch } as DailyLog;
    };
    it('lobby: arrivals of everyone in, departures of those gone home', () => {
      expect(missingMarks(s0, T, 'lobby')).toEqual({ missing: 0, total: 3 });
      const s = produce(s0, (d) => {
        delete d.moodMarks[moodId(T, 'm20', 'arrival')];
        d.attendance[`${T}:m2`].checkOut = { at: '15:00', by: 'staff:s1', method: 'manual' };
      });
      expect(missingMarks(s, T, 'lobby')).toEqual({ missing: 2, total: 4 });
    });
    it('nurse: a health face for each member with a reading', () => {
      expect(missingMarks(s0, T, 'nurse')).toEqual({ missing: 0, total: 1 });
      expect(missingMarks(produce(s0, (d) => { delete d.moodMarks[moodId(T, 'm10', 'health')]; }), T, 'nurse')).toEqual({ missing: 1, total: 1 });
    });
    it('activity: a morning face for everyone in, and a face for each session joined', () => {
      expect(missingMarks(s0, T, 'activity')).toEqual({ missing: 3, total: 3 });
      const s = produce(s0, (d) => {
        put(d as ClubState, 'm2', 'morning', 4);
        log(d as ClubState, 'm2', { sessions: { '10:30': 'joined', '13:30': 'satOut' } });
        put(d as ClubState, 'm2', 'activity', 5, '10:30');
        log(d as ClubState, 'm20', { sessions: { '13:30': 'joined' } });
      });
      expect(missingMarks(s, T, 'activity')).toEqual({ missing: 3, total: 5 });
    });
    it('kitchen: a lunch face for each member whose lunch is marked', () => {
      expect(missingMarks(s0, T, 'kitchen')).toEqual({ missing: 0, total: 0 });
      const s = produce(s0, (d) => {
        log(d as ClubState, 'm2', { lunch: 'all' });
        log(d as ClubState, 'm20', { lunch: 'none' });
        put(d as ClubState, 'm2', 'lunch', 4);
      });
      expect(missingMarks(s, T, 'kitchen')).toEqual({ missing: 1, total: 2 });
      expect(missingMarks(s, T, 'finance')).toEqual({ missing: 0, total: 0 });
    });
  });
});

