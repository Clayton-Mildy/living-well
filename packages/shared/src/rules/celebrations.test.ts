import { describe, it, expect } from 'vitest';
import { buildSeed, type ClubState } from '../index';
import { celebrationLists, celebrationTitle, celebrationsOn, checkCelebrationSlot } from './celebrations';
import { checkVenueSlot, venueClash } from './mgmt';
import { addOpenDays } from '../seed/r7/celebrations';
import { coversOn } from './kitchenOps';

const T = '2026-10-21';
const withCel = (s: ClubState, over: Record<string, unknown>) => {
  s.celebrations.c9 = { id: 'c9', clubId: s.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s1', memberId: 'm46', kind: 'birthday', title: 'x', date: '2026-11-04', from: '15:00', to: '17:00', roomId: 'room-garden-room', guests: 8, status: 'confirmed', requestedBy: 'staff:s1', ...over } as never;
  return s;
};

describe('celebrations (rules)', () => {
  it('checkCelebrationSlot refuses the venue slots that are taken or closed, and allows club hours', () => {
    const s = buildSeed().citra;
    // v1: Whole club, Sat 24 Oct 09:00-13:00
    expect(checkCelebrationSlot(s, { roomId: 'room-lounge', date: '2026-10-24', from: '10:00', to: '11:00' }, T, '10:00')).toMatchObject({ ok: false, code: 'mgmt.err.venueClash' });
    expect(checkCelebrationSlot(s, { roomId: 'room-lounge', date: '2026-10-30', from: '15:00', to: '17:00' }, T, '10:00')).toMatchObject({ ok: false, code: 'mgmt.err.venueClosed' });
    expect(checkCelebrationSlot(s, { roomId: 'room-lounge', date: '2026-10-20', from: '15:00', to: '17:00' }, T, '10:00')).toMatchObject({ ok: false, code: 'mgmt.err.venuePast' });
    expect(checkCelebrationSlot(s, { roomId: 'room-lounge', date: '2026-10-22', from: '15:00', to: '17:00' }, T, '10:00')).toEqual({ ok: true }); // an open day, inside club hours
    expect(checkVenueSlot(s, { roomId: 'room-lounge', date: '2026-10-22', from: '15:00', to: '17:00' }, T, '10:00')).toMatchObject({ code: 'mgmt.err.venueClubHours' }); // a private event may not
  });
  it('only confirmed celebrations hold a slot, in both directions', () => {
    const s = withCel(buildSeed().citra, {});
    const slot = { roomId: 'room-garden-room', date: '2026-11-04', from: '16:00', to: '18:00' };
    expect(venueClash(s, slot)).toMatchObject({ kind: 'celebration', id: 'c9' });
    expect(checkVenueSlot(s, { ...slot, from: '17:00', to: '19:00' }, T, '10:00')).toEqual({ ok: true });
    expect(checkCelebrationSlot(s, slot, T, '10:00')).toMatchObject({ ok: false, code: 'mgmt.err.venueClash' });
    expect(checkCelebrationSlot(s, slot, T, '10:00', 'c9')).toEqual({ ok: true });
    expect(venueClash(buildSeed().citra, { roomId: 'room-music', date: '2026-10-24', from: '10:00', to: '11:00' })).toMatchObject({ kind: 'venue', id: 'v1' });
    expect(venueClash(withCel(buildSeed().citra, { status: 'requested' }), slot)).toBeUndefined();
  });
  it('celebrationsOn returns confirmed only by default; lists split requested, upcoming and past', () => {
    const s = withCel(buildSeed().citra, { status: 'requested' });
    expect(celebrationsOn(s, '2026-11-04').map((c) => c.id)).not.toContain('c9');
    expect(celebrationsOn(s, '2026-11-04', ['requested', 'confirmed']).map((c) => c.id)).toContain('c9');
    expect(celebrationLists(s, T, '10:00').requested.map((c) => c.id)).toContain('c9');
    const done = withCel(buildSeed().citra, { date: '2026-10-19' });
    expect(celebrationLists(done, T, '10:00').past.map((c) => c.id)).toContain('c9');
    expect(celebrationLists(done, T, '10:00').upcoming.map((c) => c.id)).not.toContain('c9');
  });
  it('titles', () => {
    expect(celebrationTitle('birthday', 'Opa Budi', 80, 'en')).toBe("Opa Budi's 80th birthday");
    expect([81, 82, 83, 11, 12, 13, 101, 111].map((n) => celebrationTitle('birthday', 'X', n, 'en').split(' ')[1])).toEqual(['81st', '82nd', '83rd', '11th', '12th', '13th', '101st', '111th']);
    expect(celebrationTitle('birthday', 'Opa Budi', 80, 'id')).toBe('Ulang tahun ke-80 Opa Budi');
    expect(celebrationTitle('anniversary', 'Opa Budi', undefined, 'en')).toBe("Opa Budi's anniversary");
    expect(celebrationTitle('anniversary', 'Opa Budi', undefined, 'id')).toBe('Hari jadi Opa Budi');
    expect(celebrationTitle('other', 'Opa Budi', 80, 'en')).toBe('Opa Budi');
  });
  it('the seed holds Opa Budi\'s birthday three open days out (confirmed) and an anniversary lunch waiting', () => {
    const s = buildSeed().citra;
    expect(addOpenDays(s, T, 3)).toBe('2026-10-26');
    expect(addOpenDays(s, '2026-10-28', 2)).toBe('2026-11-03'); // 29 Oct is an outing and 30 Oct a closure
    expect(s.celebrations['cel-seed-1']).toMatchObject({ memberId: 'm46', status: 'confirmed', date: '2026-10-26', from: '15:00', to: '17:00', roomId: 'room-garden-room', guests: 12, cateringNote: 'Chocolate cake, no nuts' });
    expect(s.celebrations['cel-seed-2']).toMatchObject({ memberId: 'm20', status: 'requested' });
    expect(coversOn(s, '2026-10-26').celebration).toBe(12);
    expect(celebrationLists(s, T, '10:00').requested.map((c) => c.id)).toEqual(['cel-seed-2']);
  });
});
