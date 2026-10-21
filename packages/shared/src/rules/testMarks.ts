// Test fixture (round 12): the seed on the demo day with Oma Lina (m1) in the club, arriving at 3 (10:00) and leaving at 5 (15:45).
import { produce } from 'immer';
import { buildSeed } from '../index';
import { moodId } from './mood';

export const MARKS_DAY = '2026-10-21';
const T = MARKS_DAY;
export const withMarks = produce(buildSeed().citra, (d) => {
  // the seed has m1 away today; here they are in the club, so their visit is one of the day's check-ins
  d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: d.clubId, createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
  for (const [moment, face, time] of [['arrival', 3, '10:00'], ['departure', 5, '15:45']] as const) {
    d.moodMarks[moodId(T, 'm1', moment)] = { id: moodId(T, 'm1', moment), clubId: d.clubId, createdAt: `${T}T${time}`, createdBy: 'staff:s1', memberId: 'm1', date: T, time, moment, face, by: 'staff:s1' };
  }
});
