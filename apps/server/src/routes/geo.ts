// Round 21: GET /api/geo/search?q= and GET /api/geo/reverse?lat=&lng= for the location picker (signed-in staff only). 11 Nov (KC): the same two
// under /api/public/form/:token/geo for the family's online form, allowed while that link is open (`base` and `user` say which).
import type { Context, Hono } from 'hono';
import { GeoError, type Geocoder } from '../providers/geocoder';

export interface GeoDeps {
  user: (c: Context) => { id: string } | null;
  geo: () => Geocoder;
}

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
}
