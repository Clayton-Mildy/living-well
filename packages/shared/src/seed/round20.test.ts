// Round 20 seed: a past field trip day is consistent (check-ins, trip list, one charge each, trip photos, no meal).
// The default seed has no past trip (its Bogor outing is always 8 days after the anchor, so round16's "trip already this month" block never fires);
// the test makes one on the last open day before the anchor and runs the seeder on it.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, live, type ClubState } from '../index';
import { attId } from '../rules/attendance';
import { menuOn } from '../rules/kitchen';
import { familyPhotosOn } from '../rules/family';
import { seedTripDay } from './r7/round16';

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
