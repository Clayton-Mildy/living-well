// Round 21: GET /api/geo/search?q= and GET /api/geo/reverse?lat=&lng= for the location picker (signed-in staff only). 11 Nov (KC): the same two
// under /api/public/form/:token/geo for the family's online form, allowed while that link is open (`base` and `user` say which).
import type { Context, Hono } from 'hono';
import type { GeoShape } from '@cp/shared';
import { GeoError, type Geocoder, type OutlineLevel } from '../providers/geocoder';

export interface GeoDeps {
  user: (c: Context) => { id: string } | null;
  geo: () => Geocoder;
  /** 11 Nov (KC): where area outlines are kept once found (the database's meta table); with none, GET …/outline is not served */
  outlines?: { get: (key: string) => Promise<OutlineCached | undefined>; set: (key: string, v: OutlineCached) => Promise<void> };
}
/** An outline as kept: the shape (null = none found) and when it was looked up (a miss is tried again after a week). */
export interface OutlineCached { shape: GeoShape | null; at: number }
const MISS_RETRY_MS = 7 * 24 * 3600_000;
/** Outlines already read, by key (they hardly ever change, so this process keeps them). */
const mem = new Map<string, OutlineCached>();

const fail = (c: Context, e: unknown) => {
  if (e instanceof GeoError) return c.json({ code: e.code }, e.code === 'geo.err.busy' ? 429 : 503);
  return c.json({ code: 'geo.err.unavailable' }, 503);
};

export function registerGeoRoutes(app: Hono, deps: GeoDeps, base = '/api/geo'): void {
  app.get(`${base}/search`, async (c) => {
    if (!deps.user(c)) return c.json({ code: 'err.forbidden' }, 401);
    const q = (c.req.query('q') ?? '').trim();
    if (q.length < 3 || q.length > 200) return c.json({ code: 'err.invalid' }, 400);
    try { return c.json({ results: await deps.geo().search(q) }); } catch (e) { return fail(c, e); }
  });
  app.get(`${base}/reverse`, async (c) => {
    if (!deps.user(c)) return c.json({ code: 'err.forbidden' }, 401);
    const lat = Number(c.req.query('lat'));
    const lng = Number(c.req.query('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return c.json({ code: 'err.invalid' }, 400);
    try { return c.json({ hit: await deps.geo().reverse(lat, lng) }); } catch (e) { return fail(c, e); }
  });
  const store = deps.outlines;
  if (!store) return;
  // 11 Nov (KC): GET …/outline?level=kelurahan|kecamatan&name=&city=&pins=lat,lng;lat,lng (up to 5) → { shape }: the area's outline for the Where from map,
  // looked up once (it must contain one of the pins) and kept in the database, so OpenStreetMap is asked at most once per area
  app.get(`${base}/outline`, async (c) => {
    if (!deps.user(c)) return c.json({ code: 'err.forbidden' }, 401);
    const level = c.req.query('level') as OutlineLevel;
    const name = (c.req.query('name') ?? '').trim();
    const city = (c.req.query('city') ?? '').trim();
    const pins = (c.req.query('pins') ?? '').split(';').filter(Boolean).map((x) => { const [lat, lng] = x.split(',').map(Number); return { lat, lng }; });
    const okPin = (p: { lat: number; lng: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
    if ((level !== 'kelurahan' && level !== 'kecamatan') || !name || name.length > 60 || city.length > 60 || !pins.length || pins.length > 5 || !pins.every(okPin)) return c.json({ code: 'err.invalid' }, 400);
    const key = `geoOutline:v3:${level}:${name.toLowerCase()}|${city.toLowerCase()}`;
    const fresh = (v: OutlineCached | undefined) => !!v && (v.shape !== null || Date.now() - v.at < MISS_RETRY_MS);
    let v = mem.get(key);
    if (!fresh(v)) { v = await store.get(key).catch(() => undefined); if (fresh(v)) mem.set(key, v!); }
    if (fresh(v)) return c.json({ shape: v!.shape });
    try {
      const shape = await deps.geo().outline(level, name, city, pins);
      const row = { shape, at: Date.now() };
      mem.set(key, row);
      await store.set(key, row).catch(() => undefined);
      return c.json({ shape });
    } catch (e) { return fail(c, e); }
  });
}
