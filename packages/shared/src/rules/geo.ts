// Round 21: places on the map. The distance from the club is a straight line (haversine) to 0.1 km; pick-up costs the club's price per
// started km (6.4 km → 7 km) and nothing within the free distance (2.0 km is free, 2.1 km is billed as 3 km).
import type { ClubState, GeoPoint } from '../types';

export const PICKUP_RATE_DEFAULT = { perKm: 10_000, freeKm: 2 } as const;
const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** The straight-line distance between two pins, in km to 0.1. */
export function distanceKm(a: Pick<GeoPoint, 'lat' | 'lng'>, b: Pick<GeoPoint, 'lat' | 'lng'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

/** The club's pick-up price per km and free distance (the defaults when Settings has none). */
export const pickupRateOf = (s: ClubState): { perKm: number; freeKm: number } => s.club.settings.pickupRate ?? { ...PICKUP_RATE_DEFAULT };

/** The monthly pick-up price for a home pin; null when the club or the home has no pin. */
export function pickupByDistance(s: ClubState, at?: GeoPoint): { km: number; price: number; free: boolean } | null {
  const club = s.club.settings.location;
  if (!club || !at) return null;
  const km = distanceKm(club, at);
  const { perKm, freeKm } = pickupRateOf(s);
  return km <= freeKm ? { km, price: 0, free: true } : { km, price: Math.ceil(km) * perKm, free: false };
}

const AREA_MAX = 60;
const okArea = (v: unknown) => v === undefined || (typeof v === 'string' && v.length <= AREA_MAX);
const okNum = (v: unknown, lim: number) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;

/** A pin as stored: lat −90…90, lng −180…180, and area names of at most 60 characters. */
export function isGeoPoint(v: unknown): v is GeoPoint {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return okNum(o.lat, 90) && okNum(o.lng, 180) && okArea(o.kelurahan) && okArea(o.kecamatan) && okArea(o.city);
}
