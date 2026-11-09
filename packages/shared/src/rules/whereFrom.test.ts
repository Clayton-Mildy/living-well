// Round 21: Insights › Where from. Members (active today) and enquiries (created in the period, not archived) as pins, and their totals per kelurahan / kecamatan.
import { describe, it, expect } from 'vitest';
import { buildSeed, type ClubState, type Enquiry, type GeoPoint } from '../index';
import { wherePoints, whereAreas } from './whereFrom';

const T = '2026-10-21';
const PERIOD = { from: '2026-10-01', to: '2026-10-21' };
const KAL = (lat: number, lng: number): GeoPoint => ({ lat, lng, kelurahan: 'Kalideres', kecamatan: 'Kalideres' });
const CENG = (lat: number, lng: number): GeoPoint => ({ lat, lng, kelurahan: 'Cengkareng Barat', kecamatan: 'Cengkareng' });

/** The small seed with 3 members in Kalideres, 1 member with no pin and the rest out (ended); 2 leads in Cengkareng (one before the period) and 1 archived. */
function world(): ClubState {
  const s = structuredClone(buildSeed(T, 600, { roster: false }).citra);
  const ids = Object.keys(s.members);
  const keep = ['m1', 'm46', 'm2', 'm20'];
  for (const id of ids) if (!keep.includes(id)) s.members[id].deletedAt = '2026-10-01T09:00';
  s.members.m1.location = KAL(-6.130, 106.720);
  s.members.m46.location = KAL(-6.132, 106.722);
  s.members.m2.location = KAL(-6.134, 106.724);
  delete s.members.m20.location;
  for (const e of Object.values(s.enquiries)) e.deletedAt = '2026-10-01T09:00';
  const lead = (id: string, createdAt: string, loc: GeoPoint, archived = false): Enquiry => ({
    id, clubId: s.clubId, createdAt, createdBy: 'staff:s1', senior: { title: 'Oma', name: `Lead ${id}` }, contact: { name: 'C', relation: 'daughter', phone: '+62811' }, source: 'referral', stage: 'new', location: loc, ...(archived ? { archivedAt: '2026-10-10T09:00' } : {}),
  });
  s.enquiries.x1 = lead('x1', '2026-10-05T10:00', CENG(-6.150, 106.740));
  s.enquiries.x2 = lead('x2', '2026-09-20T10:00', CENG(-6.152, 106.742));
  s.enquiries.x3 = lead('x3', '2026-10-06T10:00', CENG(-6.154, 106.744), true);
  return s;
}

describe('wherePoints', () => {
  it('Both: active members and the period\'s open leads, and who has no pin', () => {
    const s = world();
    const r = wherePoints(s, 'both', PERIOD, T);
    expect(r.points.map((p) => `${p.kind}:${p.id}`).sort()).toEqual(['enquiry:x1', 'member:m1', 'member:m2', 'member:m46']);
    expect(r.missing).toEqual([{ kind: 'member', id: 'm20', name: expect.any(String) }]);
  });
  it('Members only / Enquiries only', () => {
    const s = world();
    expect(wherePoints(s, 'members', PERIOD, T).points.every((p) => p.kind === 'member')).toBe(true);
    expect(wherePoints(s, 'enquiries', PERIOD, T).points.map((p) => p.id)).toEqual(['x1']);
    expect(wherePoints(s, 'enquiries', PERIOD, T).missing).toEqual([]);
  });
  it('km from the club when it has a pin, null when it has none', () => {
    const s = world();
    s.club.settings.location = { lat: -6.136, lng: 106.731 };
    expect(wherePoints(s, 'members', PERIOD, T).points.find((p) => p.id === 'm1')!.km).toBeGreaterThan(0);
    delete s.club.settings.location;
    expect(wherePoints(s, 'members', PERIOD, T).points.find((p) => p.id === 'm1')!.km).toBeNull();
  });
  it('a pin with no area names counts under Unknown (empty name)', () => {
    const s = world();
    s.members.m2.location = { lat: -6.13, lng: 106.72 };
    expect(wherePoints(s, 'members', PERIOD, T).points.find((p) => p.id === 'm2')).toMatchObject({ kelurahan: '', kecamatan: '' });
  });
});

describe('whereAreas', () => {
  it('per kecamatan: members and leads counted apart, biggest first, the centre is the mean of the pins', () => {
    const s = world();
    const a = whereAreas(wherePoints(s, 'both', PERIOD, T).points, 'kecamatan');
    expect(a.map((x) => [x.name, x.members, x.enquiries, x.total])).toEqual([['Kalideres', 3, 0, 3], ['Cengkareng', 0, 1, 1]]);
    expect(a[0].lat).toBeCloseTo(-6.132, 6);
    expect(a[0].lng).toBeCloseTo(106.722, 6);
    expect(a[0].people.map((p) => p.id).sort()).toEqual(['m1', 'm2', 'm46']);
  });
  it('per kelurahan uses the kelurahan name; ties go by name', () => {
    const s = world();
    s.members.m2.location = { ...s.members.m2.location!, kelurahan: 'Pegadungan' };
    const a = whereAreas(wherePoints(s, 'both', PERIOD, T).points, 'kelurahan');
    expect(a.map((x) => [x.name, x.total])).toEqual([['Kalideres', 2], ['Cengkareng Barat', 1], ['Pegadungan', 1]]);
  });
});
