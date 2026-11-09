// Round 21 seed: the club pin at Citra Garden, every member with a pin around it, Opa Budi's pick-up priced by distance (6.4 km → Rp 70.000),
// a third of members on field trips (Oma Lina yes, Opa Budi no), 12 leads with pins, a venue with pictures on every seeded trip, and ratings.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, live, pickupPrice, type ClubState } from '../index';
import { ratingOf } from '../rules/directory';
import { wherePoints } from '../rules/whereFrom';

for (const roster of [false, true]) {
  describe(`round 21 seed (roster ${roster})`, () => {
    const s: ClubState = buildSeed(DEMO_TODAY, DEMO_START_MIN, { roster }).citra;
    const members = live(s.members);
    it('the club has its pin at Citra Garden, Kalideres', () => {
      expect(s.club.settings.location).toMatchObject({ kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' });
    });
    it('every member has a pin and a West Jakarta / Tangerang address; spouses share theirs', () => {
      expect(members.every((m) => !!m.location && !!m.location.kecamatan)).toBe(true);
      expect(members.every((m) => /Jakarta Barat|Tangerang/.test(m.address ?? ''))).toBe(true);
      expect(s.members.m46.location).toEqual(s.members.m1.location);
      expect(s.members.m46.address).toBe(s.members.m1.address);
    });
    it('Opa Budi\'s pick-up is priced by distance: 6.4 km → Rp 70.000', () => {
      expect(s.members.m46.pickup).toEqual({ on: true });
      expect(pickupPrice(s, s.members.m46, DEMO_TODAY)).toMatchObject({ price: 70_000, km: 6.4 });
    });
    it('about a third are on field trips: Oma Lina yes, Opa Budi no', () => {
      expect(s.members.m1.fieldTrips).toEqual({ on: true });
      expect(s.members.m46.fieldTrips?.on ?? false).toBe(false);
      const on = members.filter((m) => m.fieldTrips?.on).length;
      expect(on / members.length).toBeGreaterThan(0.2);
      expect(on / members.length).toBeLessThan(0.5);
    });
    it('every live outing names a venue with pictures; the past trip has no fee', () => {
      const outings = live(s.calendarEvents).filter((e) => e.kind === 'outing');
      expect(outings.length).toBeGreaterThan(0);
      for (const e of outings) {
        const v = s.directory[e.venueId ?? ''];
        expect(v?.kind).toBe('venue');
        expect(v!.photoMediaIds!.length).toBeGreaterThanOrEqual(2);
        expect(v!.contactPerson && v!.address && v!.location).toBeTruthy();
      }
      expect('fee' in s.calendarEvents['ev-outing-past']).toBe(false);
    });
    it('the two AC services are rated 4.8 (6) and 2.3 (3); two more contacts have a rating', () => {
      expect(ratingOf(s.directory.d14)).toEqual({ avg: 4.8, n: 6 });
      expect(ratingOf(s.directory.d15)).toEqual({ avg: 2.3, n: 3 });
      expect(live(s.directory).filter((d) => d.ratings?.length).length).toBe(4);
    });
    it('the leads have pins (up to 12), and every active member is on the Where from map', () => {
      const pinned = live(s.enquiries).filter((e) => e.location);
      expect(pinned.length).toBe(Math.min(12, live(s.enquiries).length));
      expect(wherePoints(s, 'members', { from: DEMO_TODAY, to: DEMO_TODAY }, DEMO_TODAY).missing).toEqual([]);
    });
  });
}
