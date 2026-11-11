// The demo tools' field trip day (KC, 11 Nov 2026): buildSeed(…, { trip: true }) makes today the Kebun Raya Bogor trip at any time of day.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_TODAY, live, toMin, type ClubState } from '../index';
import { tripOn } from '../rules/trips';

const T = DEMO_TODAY;
const built = new Map<string, ClubState>(); // one build per time (a build holds six months of history)
const trip = (hm: string) => { if (!built.has(hm)) built.set(hm, buildSeed(T, toMin(hm), { roster: true, trip: true }).citra); return built.get(hm)!; };
const away = (hm: string) => toMin(hm) > toMin('08:30') && toMin(hm) < toMin('15:00');
const todayVisits = (s: ClubState) => live(s.attendance).filter((a) => a.date === T);

describe('demo field trip day', () => {
  it('makes today the Bogor trip: everyone checks in before the bus and is on it, and nothing happens at the club while it is away', () => {
    const s = trip('10:00');
    const ev = tripOn(s, T)!;
    expect(ev).toMatchObject({ id: 'ev-outing-1029', from: '08:30', to: '15:00' });
    const visits = todayVisits(s);
    expect(visits.length).toBeGreaterThanOrEqual(15);
    expect(visits.every((a) => toMin(a.checkIn!.at) < toMin('08:30') && !a.checkOut)).toBe(true);
    expect([...ev.wentIds!].sort()).toEqual(visits.map((a) => a.memberId).sort());
    expect(ev.wentIds).toEqual(expect.arrayContaining(['m1', 'm46'])); // Maria's parents, for the family app
    for (const r of live(s.readings).filter((x) => x.date === T)) expect(away(r.time), `reading ${r.id} ${r.time}`).toBe(false);
    for (const m of live(s.moodMarks).filter((x) => x.date === T)) expect(away(m.time), `mood ${m.id} ${m.time}`).toBe(false);
    expect(live(s.guestVisits).some((g) => g.date === T)).toBe(false); // the trial and the visit move to the next open day
    expect(live(s.guestSessions).some((g) => g.date === T)).toBe(false); // no guest host booked on the trip day
    expect(live(s.photos).filter((p) => p.date === T).every((p) => p.activity === ev.title && toMin(p.time) <= toMin('10:00'))).toBe(true);
  }, 60_000);

  it('early on, only who has come so far; once the bus is back they go home, and the trip pictures are there', () => {
    const early = todayVisits(trip('07:50'));
    expect(early.length).toBeGreaterThan(0);
    expect(early.length).toBeLessThan(todayVisits(trip('10:00')).length);
    const late = trip('16:40');
    const gone = todayVisits(late).filter((a) => a.memberId !== 'm_sri'); // Oma Sri's first visit has no going-home on any day
    expect(gone.every((a) => a.checkOut && toMin(a.checkOut.at) >= toMin('15:20'))).toBe(true);
    expect(late.photos['ptrip-today-1']).toBeTruthy();
    expect(late.photos['ptrip-today-2'].memberIds).toEqual(['m1', 'm46']);
  }, 60_000);

  it('a club day keeps its trip next week, and an early time shows nothing from later in the day', () => {
    const s = buildSeed(T, toMin('08:00'), { roster: true }).citra;
    expect(s.calendarEvents['ev-outing-1029'].date).not.toBe(T);
    expect(live(s.guestSessions).some((g) => g.date === T)).toBe(true);
    expect(live(s.photos).some((p) => p.date === T)).toBe(false);
    expect(live(s.taskDone).some((d) => d.createdAt.startsWith(`${T}T`) && toMin(d.createdAt.slice(11, 16)) > toMin('08:00'))).toBe(false);
  }, 60_000);
});
