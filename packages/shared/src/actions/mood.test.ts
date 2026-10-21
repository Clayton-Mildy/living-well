import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, moodId, DomainError, type ClubState } from '../index';

const T = '2026-10-21';
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const seed = (): ClubState => buildSeed().citra;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, getUser({ [s.clubId]: s }, uid)!, clk, `mm${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};

describe('mood actions', () => {
  it('mood.mark upserts one mark per moment', () => {
    let s = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
    s = run(s, 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 4 }, 's1').state;
    s = run(s, 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 2 }, 's1').state;
    const marks = Object.values(s.moodMarks).filter((m) => m.memberId === 'm1' && m.date === T);
    expect(marks).toHaveLength(1);
    expect(marks[0].face).toBe(2);
    expect(marks[0].time).toBe('10:00');
  });
  it('mood.mark refuses a non-arrival mark before check-in', () => fails(seed(), 'mood.mark', { memberId: 'm1', moment: 'health', face: 3 }, 's8', 'mood.err.notIn'));
  it('mood.mark rejects face 6', () => fails(seed(), 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 6 }, 's1', 'err.invalid'));
  it('mood.clear removes a mark', () => {
    let s = run(seed(), 'mood.mark', { memberId: 'm1', moment: 'arrival', face: 4 }, 's1').state;
    s = run(s, 'mood.clear', { memberId: 'm1', moment: 'arrival' }, 's1').state;
    expect(s.moodMarks[moodId(T, 'm1', 'arrival')]).toBeUndefined();
  });
  it('check-in with a face writes the arrival mark; undo removes it', () => {
    const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'manual', face: 3 }, 's1').state;
    expect(s1.moodMarks[moodId(T, 'm1', 'arrival')]?.face).toBe(3);
    const s2 = run(s1, 'attendance.undoCheckIn', { memberId: 'm1' }, 's1').state;
    expect(s2.moodMarks[moodId(T, 'm1', 'arrival')]).toBeUndefined();
  });
  it('check-out with a face writes departure; without check-in it fails and writes nothing', () => {
    fails(seed(), 'attendance.checkOut', { memberId: 'm1', face: 5 }, 's1', 'err.notCheckedIn');
    const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
    const s2 = run(s1, 'attendance.checkOut', { memberId: 'm1', face: 5 }, 's1', { ...clock, nowMin: 15 * 60 }).state;
    expect(s2.moodMarks[moodId(T, 'm1', 'departure')]).toMatchObject({ face: 5, time: '15:00' });
    fails(s2, 'attendance.checkOut', { memberId: 'm1', face: 1 }, 's1', 'err.alreadyCheckedOut');
    const s3 = run(s2, 'attendance.undoCheckOut', { memberId: 'm1' }, 's1').state;
    expect(s3.moodMarks[moodId(T, 'm1', 'departure')]).toBeUndefined();
  });
  it('reading.save with a face writes a health mark tied to the reading; void clears it', () => {
    const s1 = seed(); // m2 is already checked in today in the seed
    const r = run(s1, 'reading.save', { memberId: 'm2', kind: 'arrival', sys: 130, dia: 80, pulse: 70, noteKeys: [], shared: true, tellFamily: false, recheck: false, deferMonthly: false, face: 4 }, 's8');
    const mark = r.state.moodMarks[moodId(T, 'm2', 'health')];
    expect(mark).toMatchObject({ face: 4, readingId: r.result.readingId });
    const s3 = run(r.state, 'reading.void', { readingId: r.result.readingId, reason: 'duplicate', withMonthly: false }, 's8').state;
    expect(s3.moodMarks[moodId(T, 'm2', 'health')]).toBeUndefined();
  });
  it('log.mark with a session and a face writes an activity mark per member', () => {
    const s1 = run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
    const s2 = run(s1, 'log.mark', { date: T, memberIds: ['m1'], session: { slot: '10:30', value: 'joined' }, face: 5 }, 's5').state;
    expect(s2.moodMarks[moodId(T, 'm1', 'activity', '10:30')]?.face).toBe(5);
  });
});
