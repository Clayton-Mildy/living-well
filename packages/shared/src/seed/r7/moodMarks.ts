// Round 12 seed: the mood marks of every seeded visit, so the profile arcs, the overview tile and the lift figure have six months behind them.
// Marks are stamps: arrival and departure by Caca at the lobby (the visit's own check-in / check-out time), the health mark by Ns. Dewi with the arrival
// reading, an activity mark by Dinar at the slot of a joined session. Every draw is `unit('mood:<member>:<date>:<moment>')`, so no other seed stream shifts.
import type { Actor, ClubState, Face, HM, ISODate, MoodMoment, Slot } from '../../types';
import { live } from '../../util';
import { moodId } from '../../rules/mood';
import { unit } from '../history';

const BY: Record<MoodMoment, Actor> = { arrival: 'staff:s1', departure: 'staff:s1', health: 'staff:s8', activity: 'staff:s5' };
const clampFace = (n: number): Face => Math.max(1, Math.min(5, n)) as Face;

/** Arrival: 5 for 15%, 4 for 40%, 3 for 35%, 2 for 8%, 1 for 2%. */
const arrivalFace = (x: number): Face => (x < 0.15 ? 5 : x < 0.55 ? 4 : x < 0.9 ? 3 : x < 0.98 ? 2 : 1);
/** Departure: one higher in 40% of visits (never above 5), one lower in 5%, otherwise the same. */
const departureFace = (a: Face, x: number): Face => (x < 0.4 ? clampFace(a + 1) : x < 0.45 ? clampFace(a - 1) : a);

/** Past days and today's seeded check-ins; Oma Lina's visit today stays unmarked because her check-in and face are done live by Caca at the door. */
export function seedMoodMarks(s: ClubState, T: ISODate): void {
  const put = (date: ISODate, memberId: string, moment: MoodMoment, face: Face, time: HM, extra: { slot?: Slot; readingId?: string } = {}) => {
    const id = moodId(date, memberId, moment, extra.slot);
    s.moodMarks[id] = { id, clubId: s.clubId, createdAt: `${date}T${time}`, createdBy: BY[moment], memberId, date, time, moment, face, by: BY[moment], ...extra };
  };
  // Opa Hendra's Watch days are low days
  const watchDays = new Set(live(s.readings).filter((r) => r.memberId === 'm2' && r.kind === 'arrival' && r.status !== 'normal').map((r) => r.date));
  const faces = new Map<string, { arrival: Face; departure: Face }>(); // `${date}:${member}`

  for (const a of live(s.attendance)) {
    if (!a.checkIn || a.date > T || (a.date === T && a.memberId === 'm1')) continue;
    const key = (mo: MoodMoment) => `mood:${a.memberId}:${a.date}:${mo}`;
    const arrival: Face = a.memberId === 'm2' && watchDays.has(a.date) ? 2 : arrivalFace(unit(key('arrival')));
    const departure = a.checkOut ? departureFace(arrival, unit(key('departure'))) : arrival;
    faces.set(`${a.date}:${a.memberId}`, { arrival, departure });
    put(a.date, a.memberId, 'arrival', arrival, a.checkIn.at);
    if (a.checkOut) put(a.date, a.memberId, 'departure', departure, a.checkOut.at);
  }
  // the health mark copies the arrival face, with the arrival reading it was taken with
  for (const r of live(s.readings)) {
    const f = r.kind === 'arrival' && r.memberId ? faces.get(`${r.date}:${r.memberId}`) : undefined;
    if (f) put(r.date, r.memberId!, 'health', f.arrival, r.time, { readingId: r.id });
  }
  // an activity mark for about 70% of the joined sessions: the better of the two door faces in 60%, the arrival face otherwise
  for (const l of live(s.dailyLogs)) {
    const f = faces.get(`${l.date}:${l.memberId}`);
    if (!f || !l.sessions) continue;
    for (const [slot, mark] of Object.entries(l.sessions) as [Slot, string][]) {
      if (mark !== 'joined') continue;
      const key = `mood:${l.memberId}:${l.date}:activity:${slot}`;
      if (unit(key) >= 0.7) continue;
      put(l.date, l.memberId, 'activity', unit(key + ':pick') < 0.6 ? clampFace(Math.max(f.arrival, f.departure)) : f.arrival, slot, { slot });
    }
  }
}
