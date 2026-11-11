// Round 21: the location picker's calls to the server's geocoding proxy, and the area names already used in the club (suggestions).
import type { ClubState, GeoHit, GeoPoint, GeoShape } from '@cp/shared';
import { live } from '@cp/shared';
import { api } from './api';

/** Places for an address (throws ApiError with code geo.err.* when the search is down or busy). */
export async function searchPlaces(q: string): Promise<GeoHit[]> {
  return (await api<{ results: GeoHit[] }>(`/api/geo/search?q=${encodeURIComponent(q)}`)).results;
}
/** The place under a pin, or null. */
export async function reversePlace(lat: number, lng: number): Promise<GeoHit | null> {
  return (await api<{ hit: GeoHit | null }>(`/api/geo/reverse?lat=${lat}&lng=${lng}`)).hit;
}

/** 11 Nov (KC): an area's outline for the Where from map (null = none found). Kept for this page's life, so switching views asks nothing twice. */
const outlines = new Map<string, Promise<GeoShape | null>>();
export function areaOutline(q: { level: 'kelurahan' | 'kecamatan'; name: string; city: string; pins: { lat: number; lng: number }[] }): Promise<GeoShape | null> {
  const key = `${q.level}:${q.name.toLowerCase()}|${q.city.toLowerCase()}`;
  let p = outlines.get(key);
  if (!p) {
    const qs = new URLSearchParams({ level: q.level, name: q.name, city: q.city, pins: q.pins.map((p) => `${p.lat},${p.lng}`).join(';') });
    p = api<{ shape: GeoShape | null }>(`/api/geo/outline?${qs}`).then((r) => r.shape).catch(() => { outlines.delete(key); return null; }); // a failed call is tried again next time
    outlines.set(key, p);
  }
  return p;
}

/** Kelurahan and kecamatan names already on members, leads and contacts (and the club), sorted, for the area fields' suggestions. */
export function areaSuggestions(s: ClubState): { kelurahan: string[]; kecamatan: string[] } {
  const pins: (GeoPoint | undefined)[] = [s.club.settings.location, ...live(s.members).map((m) => m.location), ...live(s.enquiries).map((e) => e.location), ...live(s.directory).map((c) => c.location)];
  const kel = new Set<string>();
  const kec = new Set<string>();
  for (const p of pins) { if (p?.kelurahan) kel.add(p.kelurahan); if (p?.kecamatan) kec.add(p.kecamatan); }
  const sort = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b));
  return { kelurahan: sort(kel), kecamatan: sort(kec) };
}
