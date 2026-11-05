// Round 20 (spec §6): the family's Today on a field trip day: the hero says she is on the trip, the list is the arrival, the trip, lunch (only with a menu)
// and the way back to the club; trip photos tagged with her reach the family, also when she joined the bus without a check-in (Review Focus 5).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyToday } from './FamilyToday';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  (window as unknown as { innerWidth: number }).innerWidth = 800;
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
const trip = (s: ClubState, wentIds?: string[]) => produce(s, (d) => {
  d.calendarEvents.evTrip = { id: 'evTrip', clubId: s.clubId, createdAt: '2026-10-01T09:00', createdBy: 'staff:s9', date: T, kind: 'outing', title: 'Kebun Raya Bogor', from: '08:30', to: '15:00', ...(wentIds ? { wentIds } : {}) } as never;
});
const menu = (s: ClubState) => produce(s, (d) => { d.dayMenus[T] = { id: T, clubId: s.clubId, createdAt: `${T}T07:00`, createdBy: 'staff:s3', date: T, lunch: ['dish-sop-ikan'], soft: ['dish-sop-ikan'], tea: [], allergyPlans: [] } as never; });
const as = (s: ClubState, name: string, input: unknown, mid: string, nowMin: number) => execute(s, name, input, getUser({ citra: s }, 's1')!, { today: T, nowMin }, mid).state;
/** Oma Lina checks in at 08:12 in a good mood and is checked out back at the club at 15:20. */
const lina = (s: ClubState) => as(as(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual', face: 4 }, 'tr1', 492), 'attendance.checkOut', { memberId: 'm1' }, 'tr2', 920);
/** A photo of her on the trip, taken by staff and approved. */
const tripPhoto = (s: ClubState) => produce(s, (d) => {
  d.photos.ptrip = { id: 'ptrip', clubId: s.clubId, createdAt: `${T}T11:00`, createdBy: 'staff:s5', date: T, time: '11:00', kind: 'group', media: 'photo', activity: 'Kebun Raya Bogor', memberIds: ['m1'], tone: 2, takenBy: 's5', visibility: 'visible', mediaId: 'md_trip' } as never;
});

async function open(full: ClubState, member: string, min: number) {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const view = projectForFamily(full, 'f1');
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'family', id: 'f1', name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: 'f1', confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: min, realStart: Date.now(), offset: 0 }, act: vi.fn(async () => ({ ok: true as const, result: {} })) as never });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[`/today?member=${member}`]}><FamilyToday /></MemoryRouter>); });
}
const q = (sel: string) => document.querySelector(sel);
const rows = () => Array.from(document.querySelectorAll('[data-testid="timeline"] [data-tl]')).map((x) => x.getAttribute('data-tl'));
const row = (id: string) => q(`[data-testid="timeline"] [data-tl="${id}"]`)?.textContent || '';

describe('family Today on a field trip day', () => {
  it('she checked in: the hero says she is on the trip (past tense once checked out); arrival, the trip and back at the club; no lunch row without a menu', async () => {
    await open(tripPhoto(lina(trip(buildSeed().citra))), 'm1', 960);
    expect(q('[data-testid="story-hero"]')?.textContent).toContain('Went on the field trip · Kebun Raya Bogor');
    expect(rows()).toEqual(['arrival', 'outing', 'home']);
    expect(row('arrival')).toContain('08:12');
    expect(row('arrival')).toContain('Arrived · good mood');
    expect(row('outing')).toContain('08:30');
    expect(row('outing')).toContain('Field trip · Kebun Raya Bogor');
    expect(q('[data-tl="outing"]')?.innerHTML).toContain('directions_bus');
    expect(row('home')).toContain('15:20');
    expect(row('home')).toContain('Back at the club · going home');
    expect(q('[data-testid="day-photos"] [data-photo-id="ptrip"]')).toBeTruthy();
    // round 21: the trip's step shows its newest picture on the right (taken 11:00, inside 08:30–15:00); a tap opens the pictures
    expect(q('[data-tl="outing"] [data-testid="outing-photos"]')?.getAttribute('data-count')).toBe('1');
    await act(async () => { (q('[data-tl="outing"] [data-testid="outing-photos"]') as HTMLElement).click(); });
    expect(q('[data-tl="outing"] [data-testid="outing-photos-open"] [data-photo-id="ptrip"]')).toBeTruthy();
    expect(q(`[data-testid="day-strip"] [data-date="${T}"]`)).toBeTruthy();
  });
  it('with a menu the kitchen added, lunch shows the dish', async () => {
    await open(lina(menu(trip(buildSeed().citra))), 'm1', 960);
    expect(rows()).toEqual(['arrival', 'outing', 'lunch', 'home']);
    expect(row('lunch')).toContain('12:00');
    expect(row('lunch')).toContain('Lunch · Sop ikan kakap');
  });
  it('she joined the bus without a check-in (ticked in Who went): still on the field trip, and the trip photo is hers', async () => {
    await open(tripPhoto(trip(buildSeed().citra, ['m1'])), 'm1', 660);
    expect(q('[data-testid="story-hero"]')?.textContent).toContain('On the field trip · Kebun Raya Bogor');
    expect(rows()).toEqual(['outing']);
    expect(q('[data-testid="day-photos"] [data-photo-id="ptrip"]')).toBeTruthy();
  });
  it('a parent not on the trip and not checked in reads as before', async () => {
    await open(trip(buildSeed().citra, ['m1']), 'm46', 660);
    const hero = q('[data-testid="story-hero"]')?.textContent || '';
    expect(hero).not.toContain('field trip');
    expect(hero).toContain('Opa Budi isn’t at the club');
  });
});
