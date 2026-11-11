// Round 21: the geocoding proxy (address search and pin → area). Runs without the database: the routes take the sign-in check as a function.
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { fakeGeocoder, nominatimGeocoder, mapNominatim, pickOutline, GeoError, type Geocoder } from './providers/geocoder';
import type { OutlineCached } from './routes/geo';
import { registerGeoRoutes } from './routes/geo';

function appWith(user: boolean) {
  const app = new Hono();
  registerGeoRoutes(app, { user: () => (user ? { id: 's9' } : null), geo: () => fakeGeocoder });
  return app;
}

describe('fake geocoder (CP_GEO_FAKE=1)', () => {
  it('search "citra" finds Citra Garden in Kalideres first', async () => {
    const hits = await fakeGeocoder.search('citra');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('Citra Garden');
    expect(hits[0].kecamatan).toBe('Kalideres');
  });
  it('reverse at the club gives Kalideres', async () => {
    expect((await fakeGeocoder.reverse(-6.136, 106.731))?.kelurahan).toBe('Kalideres');
  });
});

describe('/api/geo routes', () => {
  it('search answers the hits', async () => {
    const r = await appWith(true).request('/api/geo/search?q=citra');
    expect(r.status).toBe(200);
    const body = (await r.json()) as { results: { label: string }[] };
    expect(body.results[0].label).toContain('Citra Garden');
  });
  it('reverse answers one hit', async () => {
    const r = await appWith(true).request('/api/geo/reverse?lat=-6.136&lng=106.731');
    expect(((await r.json()) as { hit: { kelurahan: string } }).hit.kelurahan).toBe('Kalideres');
  });
  it('a search shorter than 3 characters is refused', async () => {
    const r = await appWith(true).request('/api/geo/search?q=ci');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ code: 'err.invalid' });
  });
  it('a bad pin is refused', async () => {
    expect((await appWith(true).request('/api/geo/reverse?lat=200&lng=1')).status).toBe(400);
  });
  it('needs a signed-in user', async () => {
    expect((await appWith(false).request('/api/geo/search?q=citra')).status).toBe(401);
  });
  it('a busy or unreachable search service is a 429 / 503 with a code', async () => {
    const app = new Hono();
    const busy = { search: async () => { throw new GeoError('geo.err.busy'); }, reverse: async () => { throw new GeoError('geo.err.unavailable'); }, outline: async () => null };
    registerGeoRoutes(app, { user: () => ({ id: 's9' }), geo: () => busy });
    const a = await app.request('/api/geo/search?q=citra');
    expect(a.status).toBe(429);
    expect(await a.json()).toEqual({ code: 'geo.err.busy' });
    const b = await app.request('/api/geo/reverse?lat=-6.1&lng=106.7');
    expect(b.status).toBe(503);
  });
});

describe('Nominatim mode', () => {
  const row = { display_name: 'Citra Garden 2, Kalideres, Jakarta Barat', lat: '-6.1360', lon: '106.7310', address: { village: 'Kalideres', city_district: 'Kalideres', city: 'Jakarta Barat' } };
  it('maps a result to a hit (village → kelurahan, city_district → kecamatan)', () => {
    expect(mapNominatim(row)).toEqual({ label: 'Citra Garden 2, Kalideres, Jakarta Barat', lat: -6.136, lng: 106.731, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' });
  });
  it('a 429 becomes geo.err.busy, another failure geo.err.unavailable', async () => {
    const g429 = nominatimGeocoder(async () => new Response('slow down', { status: 429 }), { minGapMs: 0 });
    await expect(g429.search('citra')).rejects.toMatchObject({ code: 'geo.err.busy' });
    const gDown = nominatimGeocoder(async () => { throw new Error('offline'); }, { minGapMs: 0 });
    await expect(gDown.search('citra')).rejects.toMatchObject({ code: 'geo.err.unavailable' });
  });
  it('sends its own User-Agent, limits to Indonesia, and caches the answer', async () => {
    const calls: { url: string; ua: string | null }[] = [];
    const g = nominatimGeocoder(async (url, init) => {
      calls.push({ url: String(url), ua: new Headers(init?.headers).get('user-agent') });
      return new Response(JSON.stringify([row]), { status: 200 });
    }, { minGapMs: 0 });
    expect((await g.search('Citra Garden'))[0].kecamatan).toBe('Kalideres');
    await g.search('citra garden');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('countrycodes=id');
    expect(calls[0].ua).toBe('CitraPremier-ops/1.0');
  });
  it('keeps calls at least the gap apart', async () => {
    const at: number[] = [];
    const g = nominatimGeocoder(async () => { at.push(Date.now()); return new Response('[]', { status: 200 }); }, { minGapMs: 60 });
    await Promise.all([g.search('one place'), g.search('two place')]);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(55);
  });
  it('round 21 review: a search that never answers times out as geo.err.unavailable, and the next search still runs', async () => {
    let n = 0;
    const hang = (_url: string, init?: RequestInit) => {
      n += 1;
      if (n > 1) return Promise.resolve(new Response('[]', { status: 200 }));
      return new Promise<Response>((_ok, fail) => init?.signal?.addEventListener('abort', () => fail(new Error('aborted'))));
    };
    const g = nominatimGeocoder(hang, { minGapMs: 0, timeoutMs: 50 });
    await expect(g.search('slow place')).rejects.toMatchObject({ code: 'geo.err.unavailable' });
    await expect(g.search('next place')).resolves.toEqual([]);
  });
});

describe('11 Nov (KC): the family form\'s own geo routes', () => {
  it('answer under the given base only while the link check allows it', async () => {
    const app = new Hono();
    registerGeoRoutes(app, { user: (c) => (c.req.param('token') === 'open' ? { id: 'form' } : null), geo: () => fakeGeocoder }, '/api/public/form/:token/geo');
    const ok = await app.request('/api/public/form/open/geo/search?q=citra');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { results: unknown[] }).results.length).toBeGreaterThan(0);
    expect((await app.request('/api/public/form/open/geo/reverse?lat=-6.1&lng=106.7')).status).toBe(200);
    expect((await app.request('/api/public/form/closed/geo/search?q=citra')).status).toBe(401);
    expect((await app.request('/api/geo/search?q=citra')).status).toBe(404); // the staff route is not on this app
  });
});

describe('11 Nov (KC): area outlines for the Where from map', () => {
  const box = (lng: number, lat: number, r: number) => ({ type: 'Polygon' as const, coordinates: [[[lng - r, lat - r], [lng + r, lat - r], [lng + r, lat + r], [lng - r, lat + r], [lng - r, lat - r]]] });
  const AT = { lat: -6.136, lng: 106.731 };
  it('Jakarta: with a village, the suburb is the kecamatan', () => {
    expect(mapNominatim({ lat: '-6.1', lon: '106.7', address: { village: 'Cengkareng Timur', suburb: 'Cengkareng', city: 'Jakarta Barat' } })).toMatchObject({ kelurahan: 'Cengkareng Timur', kecamatan: 'Cengkareng' });
    expect(mapNominatim({ lat: '-6.1', lon: '106.7', address: { suburb: 'Kembangan', city: 'Jakarta Barat' } })).toMatchObject({ kelurahan: 'Kembangan' });
  });
  it('picks the area of the level\'s kind that contains the pin; a same-named place elsewhere, a point or a non-area is never used', () => {
    const rows = [
      { osm_type: 'node', addresstype: 'suburb', geojson: { type: 'Point', coordinates: [106.73, -6.13] } },
      { osm_type: 'relation', addresstype: 'suburb', geojson: box(110, -7, 0.05) }, // same name, other city
      { osm_type: 'relation', addresstype: 'village', geojson: box(106.731, -6.136, 0.01) },
      { osm_type: 'relation', addresstype: 'suburb', geojson: box(106.731, -6.136, 0.03) },
    ];
    expect(pickOutline(rows, 'kecamatan', [AT])).toEqual(box(106.731, -6.136, 0.03));
    expect(pickOutline(rows, 'kelurahan', [AT])).toEqual(box(106.731, -6.136, 0.01));
    expect(pickOutline(rows.slice(0, 2), 'kecamatan', [AT])).toBeNull();
    expect(pickOutline(rows, 'kecamatan', [{ lat: -6.5, lng: 107 }, AT])).toEqual(box(106.731, -6.136, 0.03)); // one stray pin is fine: another inside is enough
    // a pin just outside (about 0.6 km past the edge) still gets the outline; one 5 km away does not
    expect(pickOutline(rows, 'kelurahan', [{ lat: -6.136, lng: 106.731 + 0.01 + 0.0055 }])).toEqual(box(106.731, -6.136, 0.01));
    expect(pickOutline([rows[2]], 'kelurahan', [{ lat: -6.136, lng: 106.731 + 0.01 + 0.045 }])).toBeNull();
  });
  it('GET /api/geo/outline asks once per area and keeps the answer (a miss too); bad input is 400; without a store it is not served', async () => {
    const kept = new Map<string, OutlineCached>();
    let asked = 0;
    const geo: Geocoder = { ...fakeGeocoder, outline: async (...a) => { asked++; return fakeGeocoder.outline(...a); } };
    const app = new Hono();
    registerGeoRoutes(app, { user: () => ({ id: 's9' }), geo: () => geo, outlines: { get: async (k) => kept.get(k), set: async (k, v) => { kept.set(k, v); } } });
    const url = '/api/geo/outline?level=kecamatan&name=Kalideres&city=Jakarta%20Barat&pins=-6.136,106.731;-6.14,106.72';
    const a = (await (await app.request(url)).json()) as { shape: { type: string } | null };
    expect(a.shape?.type).toBe('Polygon');
    await app.request(url);
    expect(asked).toBe(1);
    expect([...kept.keys()]).toEqual(['geoOutline:v3:kecamatan:kalideres|jakarta barat']);
    const miss = (await (await app.request('/api/geo/outline?level=kelurahan&name=Nowhere&pins=-6.1,106.7')).json()) as { shape: unknown };
    expect(miss.shape).toBeNull();
    await app.request('/api/geo/outline?level=kelurahan&name=Nowhere&pins=-6.1,106.7');
    expect(asked).toBe(2);
    expect((await app.request('/api/geo/outline?level=rt&name=X&pins=1,1')).status).toBe(400);
    expect((await app.request('/api/geo/outline?level=kelurahan&name=&pins=1,1')).status).toBe(400);
    expect((await app.request('/api/geo/outline?level=kelurahan&name=X')).status).toBe(400);
    expect((await app.request('/api/geo/outline?level=kelurahan&name=X&pins=1,1;2,2;3,3;4,4;5,5;6,6')).status).toBe(400);
    const plain = new Hono();
    registerGeoRoutes(plain, { user: () => ({ id: 's9' }), geo: () => geo });
    expect((await plain.request(url)).status).toBe(404);
  });
});

