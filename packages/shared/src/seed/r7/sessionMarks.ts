// KC round 7 seed: the near-demo-day logs (seed/index.ts, roster.ts) were written before the daily log had per-session marks.
// Give every finished, approved log before the demo day the session marks a teacher would have made, so the activity duty tracker shows a normal record.
import type { ClubState, DailyLog, ISODate, Slot } from '../../types';
import { live, toMin } from '../../util';
import { sessionsOn } from '../../rules/kitchen';
import { attOf } from '../../rules/attendance';

export function seedSessionMarks(s: ClubState, T: ISODate): void {
  for (const l of live(s.dailyLogs)) {
    if (l.date >= T || l.sessions || l.status !== 'saved' || l.mood === undefined || (l.approval && l.approval.status !== 'approved')) continue;
    const a = attOf(s, l.date, l.memberId);
    const inAt = a?.checkIn?.at, outAt = a?.checkOut?.at;
    if (!inAt) continue;
    const marks: Partial<Record<Slot, 'joined' | 'satOut'>> = {};
    for (const { slot, cell } of sessionsOn(s, l.date)) {
      if (!cell) continue;
      if (toMin(inAt) > toMin(slot) + 30 || (outAt && toMin(outAt) <= toMin(slot))) continue; // came after it started, or had gone home
      // a log that says she sat out keeps that for the afternoon session (the seed's "sat out of the afternoon session" notes)
      marks[slot] = l.joined === 'satOut' && slot === '13:30' ? 'satOut' : 'joined';
    }
    if (Object.keys(marks).length) (l as DailyLog).sessions = marks;
  }
}
