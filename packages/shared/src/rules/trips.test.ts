// Round 20 (R3): the trip on a day, who is on it, and the visit days that count a trip as a visit.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, onTrip, tripOn, visitDaysOf, visitsInMonth } from '../index';
import type { CalendarEvent, ClubState } from '../types';

const base: ClubState = buildSeed().citra;
const trip = (id: string, date: string, extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ id, clubId: base.clubId, createdAt: '2026-10-01T09:00', createdBy: 'staff:s9', date, kind: 'outing', title: 'Ancol aquarium', from: '08:30', to: '15:00', ...extra });
const withEvents = (...evs: CalendarEvent[]) => produce(base, (d) => { for (const e of evs) d.calendarEvents[e.id] = e; });

describe('tripOn and onTrip', () => {
  it('the first outing of the day by start time, then id; none on a plain day or for a cancelled outing', () => {
    const s = withEvents(trip('ev-b', '2026-10-21', { from: '09:00' }), trip('ev-a', '2026-10-21', { from: '09:00' }), trip('ev-late', '2026-10-21', { from: '10:00' }), trip('ev-x', '2026-10-22', { cancelledAt: '2026-10-20T09:00' }));
    expect(tripOn(s, '2026-10-21')?.id).toBe('ev-a');
    expect(tripOn(s, '2026-10-22')).toBeNull();
    expect(tripOn(base, '2026-10-21')).toBeNull();
  });
  it('a multi-day trip is the trip on each of its days', () => {
    const s = withEvents(trip('ev-2d', '2026-10-21', { endDate: '2026-10-22' }));
    expect(tripOn(s, '2026-10-22')?.id).toBe('ev-2d');
    expect(tripOn(s, '2026-10-23')).toBeNull();
  });
  it('onTrip: the member is in Who went of an outing that day', () => {
    const s = withEvents(trip('ev-a', '2026-10-21', { wentIds: ['m1'] }));
    expect(onTrip(s, 'm1', '2026-10-21')).toBe(true);
    expect(onTrip(s, 'm2', '2026-10-21')).toBe(false);
    expect(onTrip(s, 'm1', '2026-10-22')).toBe(false);
  });
});

describe('visitDaysOf', () => {
  it('a trip day counts for a member in Who went with no check-in; Flex visits still count check-ins only (Review Focus 5)', () => {
    const s = produce(withEvents(trip('ev-a', '2026-10-19', { wentIds: ['m1'] })), (d) => { delete d.attendance['2026-10-19:m1']; });
    const checkIns = visitsInMonth(s, s.members.m1, '2026-10');
    const days = visitDaysOf(s, 'm1', '2026-10-01', '2026-10-31');
    expect(checkIns).not.toContain('2026-10-19');
    expect(days).toContain('2026-10-19');
    expect(days).toEqual([...new Set([...checkIns, '2026-10-19'])].sort());
  });
  it('a day with both a check-in and the trip counts once; days outside the range are left out', () => {
    const s = withEvents(trip('ev-a', '2026-10-20', { wentIds: ['m1'] }));
    expect(visitsInMonth(s, s.members.m1, '2026-10')).toContain('2026-10-20');
    const days = visitDaysOf(s, 'm1', '2026-10-01', '2026-10-31');
    expect(days.filter((d) => d === '2026-10-20')).toHaveLength(1);
    expect(visitDaysOf(s, 'm1', '2026-10-21', '2026-10-31')).not.toContain('2026-10-20');
  });
  it('every day of a multi-day trip the member went on counts', () => {
    const s = produce(withEvents(trip('ev-2d', '2026-11-02', { endDate: '2026-11-03', wentIds: ['m1'] })), (d) => {
      for (const k of Object.keys(d.attendance)) if (k.endsWith(':m1') && k >= '2026-11') delete d.attendance[k];
    });
    expect(visitDaysOf(s, 'm1', '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-03']);
    expect(visitDaysOf(s, 'm1', '2026-11-03', '2026-11-30')).toEqual(['2026-11-03']);
  });
});
