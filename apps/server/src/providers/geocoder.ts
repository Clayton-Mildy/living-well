// Round 21: address search and pin → area, behind one interface. Nominatim (OpenStreetMap) is free but asks for its own User-Agent,
// at most 1 request a second and no type-ahead: calls queue 1 s apart and answers are cached for a day. CP_GEO_FAKE=1 answers from
// a few fixed places around Citra Garden so tests never go online.
import type { GeoHit } from '@cp/shared';

export interface Geocoder {
  search(q: string): Promise<GeoHit[]>;
  reverse(lat: number, lng: number): Promise<GeoHit | null>;
}
export type GeoCode = 'geo.err.busy' | 'geo.err.unavailable';
export class GeoError extends Error {
  constructor(public code: GeoCode) { super(code); }
}

const FAKE: GeoHit[] = [
  { label: 'Citra Garden 2, Kalideres, Jakarta Barat', lat: -6.136, lng: 106.731, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' },
  { label: 'Citra Garden 6, Pegadungan, Kalideres, Jakarta Barat', lat: -6.1325, lng: 106.7205, kelurahan: 'Pegadungan', kecamatan: 'Kalideres', city: 'Jakarta Barat' },
  { label: 'Jl. Peta Selatan, Kalideres, Jakarta Barat', lat: -6.1452, lng: 106.7123, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' },
  { label: 'Taman Palem Lestari, Cengkareng Barat, Jakarta Barat', lat: -6.1335, lng: 106.7468, kelurahan: 'Cengkareng Barat', kecamatan: 'Cengkareng', city: 'Jakarta Barat' },
  { label: 'Daan Mogot Baru, Kalideres, Jakarta Barat', lat: -6.1508, lng: 106.7006, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' },
  { label: 'Puri Indah, Kembangan Selatan, Jakarta Barat', lat: -6.1875, lng: 106.7372, kelurahan: 'Kembangan Selatan', kecamatan: 'Kembangan', city: 'Jakarta Barat' },
  { label: 'Taman Surya 5, Pegadungan, Kalideres, Jakarta Barat', lat: -6.1306, lng: 106.7128, kelurahan: 'Pegadungan', kecamatan: 'Kalideres', city: 'Jakarta Barat' },
  { label: 'Dadap, Kosambi, Tangerang', lat: -6.0948, lng: 106.7187, kelurahan: 'Dadap', kecamatan: 'Kosambi', city: 'Tangerang' },
];
const near = (lat: number, lng: number) => (h: GeoHit) => (h.lat - lat) ** 2 + (h.lng - lng) ** 2;

/** Fixed answers: search matches the label (any word, any case); reverse is the nearest fixed place. */
export const fakeGeocoder: Geocoder = {
  async search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return FAKE.filter((h) => words.some((w) => h.label.toLowerCase().includes(w))).slice(0, 5);
  },
  async reverse(lat, lng) {
    const d = near(lat, lng);
    return [...FAKE].sort((a, b) => d(a) - d(b))[0] ?? null;
  },
};

interface NomRow { display_name?: string; lat?: string; lon?: string; address?: Record<string, string | undefined> }
/** One Nominatim result as a hit: village / suburb / neighbourhood → kelurahan, city_district / district / county → kecamatan. */
export function mapNominatim(r: NomRow): GeoHit {
  const a = r.address ?? {};
  const kelurahan = a.village || a.suburb || a.neighbourhood;
  const kecamatan = a.city_district || a.district || a.county;
  const city = a.city || a.state;
  return { label: r.display_name ?? '', lat: Number(r.lat), lng: Number(r.lon), ...(kelurahan ? { kelurahan } : {}), ...(kecamatan ? { kecamatan } : {}), ...(city ? { city } : {}) };
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
const BASE = 'https://nominatim.openstreetmap.org';
const UA = 'CitraPremier-ops/1.0';

/** Nominatim with a 1-request-a-second queue and a day's cache (both per process); a call that takes over 8 s is given up (round 21 review), so one slow answer cannot hold up everyone else's search. */
export function nominatimGeocoder(fetchFn: FetchFn = fetch, opts: { minGapMs?: number; ttlMs?: number; timeoutMs?: number } = {}): Geocoder {
  const gap = opts.minGapMs ?? 1000;
  const ttl = opts.ttlMs ?? 24 * 3600_000;
  const timeout = opts.timeoutMs ?? 8000;
  const cache = new Map<string, { at: number; v: unknown }>();
  let queue: Promise<unknown> = Promise.resolve();
  let last = 0;
  const call = async (path: string): Promise<unknown> => {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttl) return hit.v;
    const run = async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
      last = Date.now();
      let res: Response;
      try { res = await fetchFn(`${BASE}${path}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(timeout) }); } catch { throw new GeoError('geo.err.unavailable'); }
      if (res.status === 429) throw new GeoError('geo.err.busy');
      if (!res.ok) throw new GeoError('geo.err.unavailable');
      const v = await res.json().catch(() => { throw new GeoError('geo.err.unavailable'); });
      cache.set(path, { at: Date.now(), v });
      return v;
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  };
  return {
    async search(q) {
      const rows = (await call(`/search?format=jsonv2&addressdetails=1&countrycodes=id&limit=5&q=${encodeURIComponent(q.trim().toLowerCase())}`)) as NomRow[];
      return Array.isArray(rows) ? rows.map(mapNominatim) : [];
    },
    async reverse(lat, lng) {
      const row = (await call(`/reverse?format=jsonv2&addressdetails=1&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`)) as NomRow & { error?: string };
      return row && !row.error && row.lat ? mapNominatim(row) : null;
    },
  };
}

let real: Geocoder | null = null;
/** The configured geocoder: the fixed places with CP_GEO_FAKE=1, else one shared Nominatim queue. */
export function geocoder(): Geocoder {
  if (process.env.CP_GEO_FAKE === '1') return fakeGeocoder;
  return (real ??= nominatimGeocoder());
}
