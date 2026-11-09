// Round 21: the location picker's calls to the server's geocoding proxy, and the area names already used in the club (suggestions).
import type { ClubState, GeoHit, GeoPoint } from '@cp/shared';
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

/** Kelurahan and kecamatan names already on members, leads and contacts (and the club), sorted, for the area fields' suggestions. */
export function areaSuggestions(s: ClubState): { kelurahan: string[]; kecamatan: string[] } {
  const pins: (GeoPoint | undefined)[] = [s.club.settings.location, ...live(s.members).map((m) => m.location), ...live(s.enquiries).map((e) => e.location)];
  const kel = new Set<string>();
  const kec = new Set<string>();
  for (const p of pins) { if (p?.kelurahan) kel.add(p.kelurahan); if (p?.kecamatan) kec.add(p.kecamatan); }
  const sort = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b));
  return { kelurahan: sort(kel), kecamatan: sort(kec) };
}
