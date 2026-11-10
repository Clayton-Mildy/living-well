// Round 21: distance from the club and the pick-up price by distance (ceil km × rate, free within the radius).
import { describe, it, expect } from 'vitest';
import { buildSeed, type ClubState, type GeoPoint } from '../index';
import { distanceKm, isGeoPoint, pickupByDistance, pickupRateOf, PICKUP_RATE_DEFAULT } from './geo';

const CLUB: GeoPoint = { lat: -6.136, lng: 106.731 };
/** A point `km` east of the club (1° of longitude at 6°S is about 110.6 km). */
const east = (km: number): GeoPoint => ({ lat: CLUB.lat, lng: CLUB.lng + km / (111.195 * Math.cos((CLUB.lat * Math.PI) / 180)) });
const withClub = (pin: GeoPoint | undefined, rate?: { perKm: number; freeKm: number }): ClubState => {
  const s = buildSeed('2026-10-21', 600, { roster: false }).citra;
  if (pin) s.club.settings.location = pin; else delete s.club.settings.location;
  if (rate) s.club.settings.pickupRate = rate; else delete s.club.settings.pickupRate;
  return s;
};

describe('distanceKm', () => {
  it('Citra Garden to a point 6.4 km east is about 6.4 km, to 0.1', () => {
    expect(distanceKm(CLUB, { lat: -6.136, lng: 106.789 })).toBeCloseTo(6.4, 1);
    expect(distanceKm(CLUB, east(6.4))).toBe(6.4);
  });
  it('the same point is 0 km', () => {
    expect(distanceKm(CLUB, CLUB)).toBe(0);
  });
});

describe('pickupByDistance', () => {
  it('defaults: Rp 10.000 per km, free within 2 km', () => {
    expect(PICKUP_RATE_DEFAULT).toEqual({ perKm: 10_000, freeKm: 2 });
    expect(pickupRateOf(withClub(CLUB))).toEqual({ perKm: 10_000, freeKm: 2 });
  });
  it('1.2 km is free', () => {
    expect(pickupByDistance(withClub(CLUB), east(1.2))).toEqual({ km: 1.2, price: 0, free: true });
  });
  it('exactly 2.0 km is still free', () => {
    expect(pickupByDistance(withClub(CLUB), east(2))).toMatchObject({ km: 2, price: 0, free: true });
  });
  it('just over the free distance rounds up to the next km (2.1 km → 3 km → Rp 30.000)', () => {
    expect(pickupByDistance(withClub(CLUB), east(2.06))).toMatchObject({ km: 2.1, price: 30_000, free: false });
  });
  it('6.4 km → 7 km → Rp 70.000', () => {
    expect(pickupByDistance(withClub(CLUB), east(6.4))).toEqual({ km: 6.4, price: 70_000, free: false });
  });
  it('the club’s own rate: Rp 12.000 per km and nothing free → 6.4 km is Rp 84.000', () => {
    expect(pickupByDistance(withClub(CLUB, { perKm: 12_000, freeKm: 0 }), east(6.4))).toMatchObject({ price: 84_000 });
  });
  it('no club pin or no member pin → null', () => {
    expect(pickupByDistance(withClub(undefined), east(6.4))).toBeNull();
    expect(pickupByDistance(withClub(CLUB), undefined)).toBeNull();
  });
});

describe('isGeoPoint', () => {
  it('rejects a latitude out of range and accepts a pin with areas', () => {
    expect(isGeoPoint({ lat: 200, lng: 0 })).toBe(false);
    expect(isGeoPoint({ lat: -6.1, lng: 106.7, kelurahan: 'Kalideres' })).toBe(true);
    expect(isGeoPoint({ lat: -6.1, lng: 106.7, kelurahan: 'x'.repeat(61) })).toBe(false);
    expect(isGeoPoint({ lat: '1', lng: 2 })).toBe(false);
    expect(isGeoPoint(null)).toBe(false);
  });
});
