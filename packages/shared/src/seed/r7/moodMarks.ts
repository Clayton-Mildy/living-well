// Round 12 seed: the mood marks of every seeded visit, so the profile arcs, the overview tile and the lift figure have six months behind them.
// Marks are stamps: arrival and departure by Caca at the lobby (the visit's own check-in / check-out time), the health mark by Ns. Dewi with the arrival
// reading, an activity mark by Dinar at the slot of a joined session. Every draw is `unit('mood:<member>:<date>:<moment>')`, so no other seed stream shifts.
// Round 14: in the current month and week (what the Team view and this month's Month report score duties over) every visit also has a morning face
// by Dinar and every marked lunch a lunch face by the kitchen, and every joined session has its face, so the mood duties are done there. Older days keep
// the round-12 marks only: about 6,000 more marks over six months would push the state past its 7.5 MB cap (last month as well leaves under 30 KB).
import type { Actor, ClubState, Face, HM, ISODate, MoodMoment, Slot } from '../../types';
import { live, weekStart, ym } from '../../util';
import { moodId } from '../../rules/mood';
import { unit } from '../history';

const BY: Record<MoodMoment, Actor> = { arrival: 'staff:s1', departure: 'staff:s1', health: 'staff:s8', morning: 'staff:s5', lunch: 'staff:s2', activity: 'staff:s5' };
const clampFace = (n: number): Face => Math.max(1, Math.min(5, n)) as Face;

/** Arrival: 5 for 15%, 4 for 40%, 3 for 35%, 2 for 8%, 1 for 2%. */
const arrivalFace = (x: number): Face => (x < 0.15 ? 5 : x < 0.55 ? 4 : x < 0.9 ? 3 : x < 0.98 ? 2 : 1);
/** Departure: one higher in 40% of visits (never above 5), one lower in 5%, otherwise the same. */
const departureFace = (a: Face, x: number): Face => (x < 0.4 ? clampFace(a + 1) : x < 0.45 ? clampFace(a - 1) : a);
/** Morning (round 14): one higher in 20% of visits, one lower in 5%, otherwise the arrival face. */
const morningFace = (a: Face, x: number): Face => (x < 0.2 ? clampFace(a + 1) : x < 0.25 ? clampFace(a - 1) : a);
/** Lunch (round 14): one lower when little or nothing was eaten, else one higher in 30%, otherwise the morning face. */
const lunchFace = (m: Face, amount: string, x: number): Face => (amount === 'little' || amount === 'none' ? clampFace(m - 1) : x < 0.3 ? clampFace(m + 1) : m);
const MORNING_AT: HM = '09:45';

/** Past days and today's seeded check-ins; Oma Lina's visit today stays unmarked because her check-in and face are done live by Caca at the door. */
export function seedMoodMarks(s: ClubState, T: ISODate): void {
  const put = (date: ISODate, memberId: string, moment: MoodMoment, face: Face, time: HM, extra: { slot?: Slot; readingId?: string } = {}) => {
    const id = moodId(date, memberId, moment, extra.slot);
    s.moodMarks[id] = { id, clubId: s.clubId, createdAt: `${date}T${time}`, createdBy: BY[moment], memberId, date, time, moment, face, by: BY[moment], ...extra };
  };
  // Opa Hendra's Watch days are low days
  const watchDays = new Set(live(s.readings).filter((r) => r.memberId === 'm2' && r.kind === 'arrival' && r.status !== 'normal').map((r) => r.date));
  // Oma Lina is the demo's family story: a day her log calls cheerful or calm is a Great or Good arrival, one it calls unsettled is a Low one, so the faces and the notes agree
  const lina: Partial<Record<string, Face>> = { cheerful: 5, calm: 4, quiet: 3, agitated: 2 };
  const linaFace = new Map(live(s.dailyLogs).filter((l) => l.memberId === 'm1' && l.mood).map((l) => [l.date, lina[l.mood!]!]));
  const faces = new Map<string, { arrival: Face; departure: Face; morning?: Face }>(); // `${date}:${member}`
  const from = [`${ym(T)}-01`, weekStart(T)].sort()[0]; // the current month and week
  const recent = (date: ISODate) => date >= from && date < T; // past days of the round-14 window (today is marked live)

  for (const a of live(s.attendance)) {
    if (!a.checkIn || a.date > T || (a.date === T && a.memberId === 'm1')) continue;
    const key = (mo: MoodMoment) => `mood:${a.memberId}:${a.date}:${mo}`;
    const arrival: Face = a.memberId === 'm2' && watchDays.has(a.date) ? 2 : (a.memberId === 'm1' && linaFace.get(a.date)) || arrivalFace(unit(key('arrival')));
    const departure = a.checkOut ? departureFace(arrival, unit(key('departure'))) : arrival;
    const morning = recent(a.date) ? morningFace(arrival, unit(key('morning'))) : undefined;
    faces.set(`${a.date}:${a.memberId}`, { arrival, departure, ...(morning ? { morning } : {}) });
    put(a.date, a.memberId, 'arrival', arrival, a.checkIn.at);
    if (morning) put(a.date, a.memberId, 'morning', morning, a.checkIn.at > MORNING_AT ? a.checkIn.at : MORNING_AT);
    if (a.checkOut) put(a.date, a.memberId, 'departure', departure, a.checkOut.at);
  }
  // the health mark copies the arrival face, with the arrival reading it was taken with
  for (const r of live(s.readings)) {
    const f = r.kind === 'arrival' && r.memberId ? faces.get(`${r.date}:${r.memberId}`) : undefined;
    if (f) put(r.date, r.memberId!, 'health', f.arrival, r.time, { readingId: r.id });
  }
  // an activity mark for about 70% of the joined sessions (round 14: all of them in the window): the better of the two door faces in 60%, the arrival face otherwise
  for (const l of live(s.dailyLogs)) {
    const f = faces.get(`${l.date}:${l.memberId}`);
    if (!f) continue;
    if (f.morning && l.lunch) put(l.date, l.memberId, 'lunch', lunchFace(f.morning, l.lunch, unit(`mood:${l.memberId}:${l.date}:lunch`)), '12:40');
    if (!l.sessions) continue;
    for (const [slot, mark] of Object.entries(l.sessions) as [Slot, string][]) {
      if (mark !== 'joined') continue;
      const key = `mood:${l.memberId}:${l.date}:activity:${slot}`;
      if (unit(key) >= 0.7 && !recent(l.date)) continue;
      put(l.date, l.memberId, 'activity', unit(key + ':pick') < 0.6 ? clampFace(Math.max(f.arrival, f.departure)) : f.arrival, slot, { slot });
    }
  }
}
