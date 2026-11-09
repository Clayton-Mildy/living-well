// Round 21 seed: CitraPremier's pin at Citra Garden (Kalideres); every member lives in West Jakarta or nearby Tangerang with a pin (spouses share one);
// Oma Lina and Opa Budi 6.4 km east, so his pick-up is priced by distance (7 km × Rp 10.000); every third member and Oma Lina take part in the monthly
// field trips; up to 12 leads have pins; each seeded trip has a venue in Contacts with pictures; the two AC services are rated.
// Runs last: it only rewrites addresses and adds fields, with no random draws, so nothing seeded before it moves.
import type { ClubState, ContactRating, DirectoryContact, GeoPoint, ISODate } from '../../types';
import { live, sortBy } from '../../util';
import { demoMediaId } from '../demoMedia';

const CLUB: GeoPoint = { lat: -6.136, lng: 106.731, kelurahan: 'Kalideres', kecamatan: 'Kalideres', city: 'Jakarta Barat' };
/** street, kelurahan, kecamatan, city, base lat, base lng */
type Area = [string, string, string, string, number, number];
const AREAS: Area[] = [
  ['Jl. Citra Garden 2', 'Kalideres', 'Kalideres', 'Jakarta Barat', -6.134, 106.729],
  ['Jl. Citra Garden 5', 'Pegadungan', 'Kalideres', 'Jakarta Barat', -6.131, 106.72],
  ['Jl. Taman Surya 5', 'Pegadungan', 'Kalideres', 'Jakarta Barat', -6.129, 106.714],
  ['Jl. Peta Selatan', 'Kalideres', 'Kalideres', 'Jakarta Barat', -6.145, 106.712],
  ['Jl. Daan Mogot Baru', 'Kalideres', 'Kalideres', 'Jakarta Barat', -6.15, 106.701],
  ['Jl. Semanan Raya', 'Semanan', 'Kalideres', 'Jakarta Barat', -6.16, 106.706],
  ['Jl. Taman Palem Lestari', 'Cengkareng Barat', 'Cengkareng', 'Jakarta Barat', -6.133, 106.747],
  ['Jl. Kamal Raya', 'Cengkareng Timur', 'Cengkareng', 'Jakarta Barat', -6.139, 106.757],
  ['Jl. Bojong Raya', 'Rawa Buaya', 'Cengkareng', 'Jakarta Barat', -6.161, 106.736],
  ['Jl. Duri Kosambi Raya', 'Duri Kosambi', 'Cengkareng', 'Jakarta Barat', -6.17, 106.728],
  ['Jl. Puri Indah Raya', 'Kembangan Selatan', 'Kembangan', 'Jakarta Barat', -6.187, 106.737],
  ['Jl. Meruya Ilir', 'Meruya Utara', 'Kembangan', 'Jakarta Barat', -6.195, 106.756],
  ['Jl. Tanjung Duren Raya', 'Tanjung Duren Utara', 'Grogol Petamburan', 'Jakarta Barat', -6.175, 106.79],
  ['Jl. Raya Dadap', 'Dadap', 'Kosambi', 'Tangerang', -6.095, 106.719],
];
/** Most members live close to the club: Kalideres comes up most, the far areas once each. */
const ORDER = [0, 1, 2, 3, 6, 0, 4, 1, 7, 5, 2, 8, 3, 0, 9, 6, 1, 10, 4, 2, 7, 11, 0, 3, 12, 5, 1, 6, 13, 2];
/** Oma Lina and Opa Budi: 6.4 km due east of the club (Kapuk, Cengkareng). */
const LINA: GeoPoint = { lat: CLUB.lat, lng: Math.round((CLUB.lng + 6.4 / (111.195 * Math.cos((-CLUB.lat * Math.PI) / 180))) * 1e6) / 1e6, kelurahan: 'Kapuk', kecamatan: 'Cengkareng', city: 'Jakarta Barat' };

const jitter = (i: number, k: number) => (((i * k) % 9) - 4) * 0.0008;
function home(i: number): { address: string; location: GeoPoint } {
  const [street, kel, kec, city, lat, lng] = AREAS[ORDER[i % ORDER.length]];
  return { address: `${street} no. ${(i * 7) % 88 + 1}, ${kel}, ${city}`, location: { lat: Math.round((lat + jitter(i, 37)) * 1e6) / 1e6, lng: Math.round((lng + jitter(i, 53)) * 1e6) / 1e6, kelurahan: kel, kecamatan: kec, city } };
}

const VENUES: { event: string; id: string; name: string; contactPerson: string; phone: string; address: string; location: GeoPoint; pics: string[] }[] = [
  { event: 'ev-outing-past', id: 'dv-tmii', name: 'Taman Mini Indonesia Indah', contactPerson: 'Ibu Ratna (group bookings)', phone: '+62218779261', address: 'Jl. Raya Taman Mini, Cipayung, Jakarta Timur', location: { lat: -6.3025, lng: 106.8952, kelurahan: 'Ceger', kecamatan: 'Cipayung', city: 'Jakarta Timur' }, pics: ['act-garden-1', 'club-chat-1', 'act-garden-2'] },
  { event: 'ev-outing-1029', id: 'dv-bogor', name: 'Kebun Raya Bogor', contactPerson: 'Pak Andi Wirawan', phone: '+622518311362', address: 'Jl. Ir. H. Juanda 13, Paledang, Bogor', location: { lat: -6.5976, lng: 106.7996, kelurahan: 'Paledang', kecamatan: 'Bogor Tengah', city: 'Bogor' }, pics: ['act-garden-2', 'act-garden-1'] },
  { event: 'ev-outing-1126', id: 'dv-batik', name: 'Museum Tekstil Jakarta', contactPerson: 'Ibu Sari Lestari', phone: '+62215606613', address: 'Jl. K.S. Tubun 2-4, Tanah Abang, Jakarta Pusat', location: { lat: -6.1886, lng: 106.8096, kelurahan: 'Kota Bambu Selatan', kecamatan: 'Palmerah', city: 'Jakarta Barat' }, pics: ['act-batik-1', 'act-batik-2'] },
];

const rate = (id: string, stars: number, by: string, at: string, note?: string): ContactRating => ({ id, stars: stars as ContactRating['stars'], at, by: `staff:${by}` as ContactRating['by'], ...(note ? { note } : {}) });

export function seedRound21(s: ClubState, T: ISODate): void {
  s.club = { ...s.club, settings: { ...s.club.settings, location: { ...CLUB } } };

  // ----- where members live (spouses share the lead's home) -----
  const members = sortBy(live(s.members), (m) => Number(m.id.slice(1)));
  const homes = new Map<string, { address: string; location: GeoPoint }>();
  members.forEach((m, i) => {
    const shared = m.spouseId ? homes.get(m.spouseId) : undefined;
    const h = m.id === 'm1' || m.id === 'm46' ? { address: 'Jl. Kapuk Raya no. 18, Kapuk, Jakarta Barat', location: { ...LINA } } : shared ?? home(i);
    homes.set(m.id, h);
    m.address = h.address;
    m.location = { ...h.location };
  });

  // ----- pick-up by distance; the monthly field trips -----
  if (s.members.m46) s.members.m46.pickup = { on: true };
  members.forEach((m, i) => { if (m.id === 'm1' || (m.id !== 'm46' && i % 3 === 2)) m.fieldTrips = { on: true }; });

  // ----- where the leads live -----
  sortBy(live(s.enquiries), (e) => e.id).slice(0, 12).forEach((e, i) => {
    const h = home(i * 5 + 3);
    e.address = h.address;
    e.location = h.location;
  });

  // ----- trip venues in Contacts, each seeded outing at one -----
  for (const v of VENUES) {
    const contact: DirectoryContact = { id: v.id, clubId: s.clubId, createdAt: `${T}T08:00`, createdBy: 'staff:s9', kind: 'venue', name: v.name, what: '', phone: v.phone, public: false, contactPerson: v.contactPerson, address: v.address, location: v.location, photoMediaIds: v.pics.map(demoMediaId) };
    s.directory[v.id] = contact;
  }
  const byEvent = new Map(VENUES.map((v) => [v.event, v.id]));
  for (const e of live(s.calendarEvents)) if (e.kind === 'outing') e.venueId = byEvent.get(e.id) ?? VENUES[0].id;

  // ----- ratings: the two AC services, and one each for two more contacts -----
  const d = (k: number) => `2026-${String(8 + Math.floor(k / 3)).padStart(2, '0')}-${String(4 + (k % 3) * 9).padStart(2, '0')}T11:00`;
  if (s.directory.d14) s.directory.d14.ratings = [
    rate('rt-d14-1', 5, 's1', d(0), 'Came the same day, fixed the AC fast'), rate('rt-d14-2', 5, 's9', d(1)), rate('rt-d14-3', 4, 's1', d(2), 'A bit late, good work'),
    rate('rt-d14-4', 5, 's1', d(3)), rate('rt-d14-5', 5, 's9', d(4), 'Cleaned all units in one visit'), rate('rt-d14-6', 5, 's1', d(5)),
  ];
  if (s.directory.d15) s.directory.d15.ratings = [
    rate('rt-d15-1', 2, 's1', d(1), 'Two hours late, AC leaked again'), rate('rt-d15-2', 3, 's9', d(3)), rate('rt-d15-3', 2, 's1', d(5), 'Had to call back twice'),
  ];
  for (const [id, stars, note] of [['d1', 5, 'Kind with the members'], ['d6', 4, 'Fresh, on time']] as const) if (s.directory[id]) s.directory[id].ratings = [rate(`rt-${id}-1`, stars, 's9', d(4), note)];
}
