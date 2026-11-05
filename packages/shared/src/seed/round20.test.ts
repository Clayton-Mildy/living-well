// Round 20 seed: a past field trip day is consistent (check-ins, trip list, one charge each, trip photos, no meal).
// Round 20 fix (I3): the default seed has a past trip ("Taman Mini day trip", 2–7 days before the anchor) with everyone checked in that day on it;
// the second block makes a synthetic trip and runs the seeder on it.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, live, type ClubState } from '../index';
import { attId } from '../rules/attendance';
import { menuOn } from '../rules/kitchen';
import { familyPhotosOn, timelineOf, tripPhotos } from '../rules/family';
import { seedTripDay } from './r7/round16';

describe('round 20 fix: the seeded past trip', () => {
  for (const roster of [false, true]) {
    const s: ClubState = buildSeed(DEMO_TODAY, DEMO_START_MIN, { roster }).citra;
    const trip = s.calendarEvents['ev-outing-past'];
    it(`is a few days before the demo day, everyone checked in that day went, one charge each (roster ${roster})`, () => {
      expect(trip).toMatchObject({ kind: 'outing', title: 'Taman Mini day trip', from: '08:30', to: '15:00', fee: 250_000 });
      expect(trip.date < DEMO_TODAY && trip.date >= '2026-10-14').toBe(true);
      const came = live(s.attendance).filter((a) => a.date === trip.date && a.checkIn).map((a) => a.memberId).sort();
      expect([...(trip.wentIds ?? [])].sort()).toEqual(came);
      expect(came).toContain('m1'); // Opa Budi is one of the few-visits members (round 17 keeps only his last visits), so he may not have come that day
      const charges = live(s.pendingCharges).filter((c) => c.source?.id === trip.id);
      expect(charges.map((c) => c.memberId).sort()).toEqual(came);
      expect(charges.every((c) => !c.invoiceId && c.amount === 250_000)).toBe(true);
      expect(Object.values(s.photos).some((p) => p.date === trip.date && p.activity === trip.title && p.memberIds.includes('m1'))).toBe(true);
    });
  }
});

describe('round 21: the outing step gets the trip photos', () => {
  const s: ClubState = buildSeed(DEMO_TODAY, DEMO_START_MIN).citra;
  const trip = s.calendarEvents['ev-outing-past'];
  it('the trip window gives the parent the approved trip pictures, oldest first; a photo outside the window or a pending one is left out', () => {
    const shots = tripPhotos(s, ['m1'], trip, trip.date);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.length).toBeLessThanOrEqual(3);
    expect(shots.map((p) => p.id)).toEqual(expect.arrayContaining(['ptrip-seed-1', 'ptrip-seed-2']));
    expect(shots.every((p) => p.time >= '08:30' && p.time <= '15:00' && p.visibility === 'visible' && !!p.mediaId)).toBe(true);
    expect(tripPhotos(s, ['m1'], { from: '08:00', to: '09:00' }, trip.date)).toEqual([]);
    const pending = structuredClone(s);
    for (const p of Object.values(pending.photos)) if (p.date === trip.date) p.visibility = 'pending';
    expect(tripPhotos(pending, ['m1'], trip, trip.date)).toEqual([]);
    const item = timelineOf(s, [s.members.m1], trip.date, 24 * 60).find((i) => i.kind === 'outing');
    expect(item).toBeTruthy();
  });
});

describe('round 20 seed: a past trip day', () => {
  for (const roster of [false, true]) {
    const s: ClubState = structuredClone(buildSeed(DEMO_TODAY, DEMO_START_MIN, { roster }).citra);
    const base = live(s.calendarEvents).find((e) => e.kind === 'outing')!;
    const trip = { ...base, id: 'ev-past-trip', date: '2026-10-14', wentIds: ['m1', 'm46'] };
    s.calendarEvents[trip.id] = trip;
    for (const m of trip.wentIds) {
      const id = `trip-${trip.id}-${m}`;
      s.pendingCharges[id] = { id, clubId: trip.clubId, createdAt: `${trip.date}T15:00:00`, createdBy: 'staff:s1', memberId: m, amount: 250_000, label: 'inv.line.fieldTrip', params: {}, source: { type: 'event', id: trip.id } };
    }
    const before = Object.keys(s.photos).length;
    seedTripDay(s, trip);
    it(`Oma Lina and Opa Budi have a check-in, a place on the trip and one charge each (roster ${roster})`, () => {
      for (const m of ['m1', 'm46']) {
        expect(s.attendance[attId(trip.date, m)]?.checkIn).toBeTruthy();
        expect(live(s.pendingCharges).filter((c) => c.memberId === m && c.source?.id === trip.id)).toHaveLength(1);
      }
    });
    it('a trip photo is tagged to Oma Lina and her family sees it; the day has no meal; two photos at most', () => {
      const mine = Object.values(s.photos).filter((p) => p.date === trip.date && p.activity === trip.title && p.memberIds.includes('m1'));
      expect(mine.length).toBeGreaterThan(0);
      expect(familyPhotosOn(s, ['m1'], trip.date).some((p) => p.id === mine[0].id)).toBe(true);
      expect(Object.keys(s.photos).length - before).toBeLessThanOrEqual(2);
      expect(menuOn(s, trip.date)).toBeNull();
    });
  }
});
