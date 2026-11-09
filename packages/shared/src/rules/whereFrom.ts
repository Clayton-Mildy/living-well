// Round 21: Insights › Where from. Who lives where: members active today and the leads made in the Insights period (archived ones left out), as pins,
// and their totals per kelurahan or kecamatan (the circle sits at the average of the area's pins). People with no pin are listed apart.
import type { ClubState, ISODate } from '../types';
import { live, sortBy } from '../util';
import { activeOn, displayName, isPendingRow } from './core';
import { seniorName } from './enquiries';
import { distanceKm } from './geo';
import type { InsightPeriod } from './insights';

export type WhereWho = 'members' | 'enquiries' | 'both';
export type WhereLevel = 'pins' | 'kelurahan' | 'kecamatan';
export interface WherePoint { kind: 'member' | 'enquiry'; id: string; name: string; lat: number; lng: number; kelurahan: string; kecamatan: string; km: number | null }
export interface WhereMissing { kind: 'member' | 'enquiry'; id: string; name: string }
export interface WhereArea { key: string; name: string; lat: number; lng: number; members: number; enquiries: number; total: number; people: WherePoint[] }

export function wherePoints(s: ClubState, who: WhereWho, period: InsightPeriod, today: ISODate): { points: WherePoint[]; missing: WhereMissing[] } {
  const club = s.club.settings.location;
  const points: WherePoint[] = [];
  const missing: WhereMissing[] = [];
  const add = (kind: WherePoint['kind'], id: string, name: string, loc: { lat: number; lng: number; kelurahan?: string; kecamatan?: string } | undefined) => {
    if (!loc) { missing.push({ kind, id, name }); return; }
    points.push({ kind, id, name, lat: loc.lat, lng: loc.lng, kelurahan: loc.kelurahan ?? '', kecamatan: loc.kecamatan ?? '', km: club ? distanceKm(club, loc) : null });
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
