// Round 21 seed: the club pin at Citra Garden, every member with a pin around it, Opa Budi's pick-up priced by distance (6.4 km → Rp 70.000),
// a third of members on field trips (Oma Lina yes, Opa Budi no), 12 leads with pins, a venue with pictures on every seeded trip, and ratings.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, invoiceTotal, live, pickupPrice, runLinesFor, sum, type ClubState } from '../index';
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
    it('round 21 review: October\'s invoices bill the field trip fee of roster members switched on, and a full payment still covers the invoice', () => {
      const oct = live(s.invoices).filter((i) => i.kind === 'monthly' && i.period === '2026-10' && !i.voided);
      const isRoster = (id: string) => Number(id.slice(1)) >= 51;
      const on = oct.filter((i) => s.members[i.memberId]?.fieldTrips?.on && isRoster(i.memberId));
      expect(on.length > 0).toBe(roster);
      expect(oct.filter((i) => !isRoster(i.memberId)).every((i) => !i.lines.some((l) => l.id === 'trip-2026-10'))).toBe(true); // the tests' five keep theirs
      for (const i of on) expect(i.lines.find((l) => l.id === 'trip-2026-10')).toMatchObject({ kind: 'fieldTrip', amount: 250_000, refMonth: '2026-10' });
      expect(oct.filter((i) => !s.members[i.memberId]?.fieldTrips?.on).every((i) => !i.lines.some((l) => l.id === 'trip-2026-10'))).toBe(true);
      for (const i of on) {
        const paid = sum(live(s.payments).flatMap((p) => p.allocations).filter((a) => a.invoiceId === i.id).map((a) => a.amount));
        expect(paid === 0 || paid >= invoiceTotal(i), `${i.memberId} is not left part-paid`).toBe(true);
      }
    });
    it.runIf(roster)('round 21 review: once the 29 Oct trip is over, the November bill credits October to a roster member switched on who went on no October trip (not before)', () => {
      const missed = live(s.members).find((m) => Number(m.id.slice(1)) >= 51 && m.fieldTrips?.on && !live(s.calendarEvents).some((e) => e.kind === 'outing' && e.date.startsWith('2026-10') && e.wentIds?.includes(m.id)))!;
      expect(missed).toBeTruthy();
      expect(runLinesFor(s, missed, '2026-11', DEMO_TODAY).find((l) => l.id === 'tripCredit-2026-10')).toBeUndefined();
      expect(runLinesFor(s, missed, '2026-11', '2026-10-30').find((l) => l.id === 'tripCredit-2026-10')?.amount).toBe(-250_000);
      expect(runLinesFor(s, s.members.m1, '2026-11', '2026-10-30').find((l) => l.id === 'tripCredit-2026-10')).toBeUndefined(); // Oma Lina went on 16 Oct
    });
    it('the leads have pins (up to 12), and every active member is on the Where from map', () => {
      const pinned = live(s.enquiries).filter((e) => e.location);
      expect(pinned.length).toBe(Math.min(12, live(s.enquiries).length));
      expect(wherePoints(s, 'members', { from: DEMO_TODAY, to: DEMO_TODAY }, DEMO_TODAY).missing).toEqual([]);
    });
  });
}
