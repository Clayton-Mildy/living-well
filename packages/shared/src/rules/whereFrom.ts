// Round 21: Insights › Where from. Who lives where: members active today and the leads made in the Insights period (archived ones left out), as pins,
// and their totals per kelurahan or kecamatan. 11 Nov (KC): the map shades each whole area (its OpenStreetMap outline) green to red by how many live
// there, instead of drawing circles. People with no pin are listed apart.
import type { ClubState, ISODate } from '../types';
import { live, sortBy } from '../util';
import { activeOn, displayName, isPendingRow } from './core';
import { seniorName } from './enquiries';
import { distanceKm } from './geo';
import type { InsightPeriod } from './insights';

export type WhereWho = 'members' | 'enquiries' | 'both';
export type WhereLevel = 'pins' | 'kelurahan' | 'kecamatan';
export interface WherePoint { kind: 'member' | 'enquiry'; id: string; name: string; lat: number; lng: number; kelurahan: string; kecamatan: string; /** 11 Nov: for the outline lookup */ city?: string; km: number | null }
export interface WhereMissing { kind: 'member' | 'enquiry'; id: string; name: string }
export interface WhereArea { key: string; name: string; lat: number; lng: number; members: number; enquiries: number; total: number; people: WherePoint[] }

export function wherePoints(s: ClubState, who: WhereWho, period: InsightPeriod, today: ISODate): { points: WherePoint[]; missing: WhereMissing[] } {
  const club = s.club.settings.location;
  const points: WherePoint[] = [];
  const missing: WhereMissing[] = [];
  const add = (kind: WherePoint['kind'], id: string, name: string, loc: { lat: number; lng: number; kelurahan?: string; kecamatan?: string; city?: string } | undefined) => {
    if (!loc) { missing.push({ kind, id, name }); return; }
    points.push({ kind, id, name, lat: loc.lat, lng: loc.lng, kelurahan: loc.kelurahan ?? '', kecamatan: loc.kecamatan ?? '', ...(loc.city ? { city: loc.city } : {}), km: club ? distanceKm(club, loc) : null });
  };
  if (who !== 'enquiries') {
    for (const m of sortBy(live(s.members).filter((x) => !isPendingRow(x) && activeOn(x, today)), (x) => x.firstName)) add('member', m.id, displayName(m), m.location);
  }
  if (who !== 'members') {
    for (const e of sortBy(live(s.enquiries).filter((x) => !x.archivedAt && x.createdAt.slice(0, 10) >= period.from && x.createdAt.slice(0, 10) <= period.to), (x) => x.createdAt)) add('enquiry', e.id, seniorName(e), e.location);
  }
  return { points, missing };
}

/** Totals per area, biggest first then by name; an empty area name is its own bucket (shown as "Unknown"). */
export function whereAreas(points: WherePoint[], level: 'kelurahan' | 'kecamatan'): WhereArea[] {
  const by = new Map<string, WherePoint[]>();
  for (const p of points) { const k = p[level]; const list = by.get(k); if (list) list.push(p); else by.set(k, [p]); }
  const areas = [...by].map(([key, people]): WhereArea => {
    const n = people.length;
    const members = people.filter((p) => p.kind === 'member').length;
    return { key, name: key, lat: people.reduce((a, p) => a + p.lat, 0) / n, lng: people.reduce((a, p) => a + p.lng, 0) / n, members, enquiries: n - members, total: n, people };
  });
  return areas.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** 11 Nov (KC): an area's colour on the map, green (few) to red (the busiest area), in five steps of the busiest area's count. */
export const HEAT_COLORS = ['#7DBA5B', '#C5D24A', '#F2C23D', '#EE8A35', '#D9483B'] as const;
export function heatColor(total: number, max: number): string {
  if (max <= 1) return HEAT_COLORS[0];
  const step = Math.min(HEAT_COLORS.length - 1, Math.floor(((total - 1) / (max - 1)) * HEAT_COLORS.length));
  return HEAT_COLORS[Math.max(0, step)];
}

/** 11 Nov (KC): the colour key: each colour with the counts it stands for (1 up to the busiest area's count, split into heatColor's five steps); empty steps left out. */
export function heatBands(max: number): { color: string; from: number; to: number }[] {
  const out: { color: string; from: number; to: number }[] = [];
  for (let n = 1; n <= Math.max(1, max); n++) {
    const color = heatColor(n, max);
    const last = out[out.length - 1];
    if (last && last.color === color) last.to = n; else out.push({ color, from: n, to: n });
  }
  return out;
}

/** 11 Nov (KC): what the map asks the server for an area's outline: its name, the commonest city of its people, and up to 5 of their pins (the outline must contain one). */
export function outlineQuery(a: Pick<WhereArea, 'name' | 'people'>, level: 'kelurahan' | 'kecamatan'): { level: 'kelurahan' | 'kecamatan'; name: string; city: string; pins: { lat: number; lng: number }[] } | null {
  if (!a.name || !a.people.length) return null;
  const n = new Map<string, number>();
  for (const p of a.people) if (p.city) n.set(p.city, (n.get(p.city) ?? 0) + 1);
  const city = [...n].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]?.[0] ?? '';
  const pins: { lat: number; lng: number }[] = [];
  for (const p of a.people) if (pins.length < 5 && !pins.some((x) => x.lat === p.lat && x.lng === p.lng)) pins.push({ lat: p.lat, lng: p.lng });
  return { level, name: a.name, city, pins };
}
