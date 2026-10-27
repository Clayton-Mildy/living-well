// Display names: the nickname (Panggilan) is what staff and family call a member.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type Member } from '../index';
import { checkVenueSlot } from './mgmt';
import { dayStatus, displayFull, displayName, initials, memberName, memberShort, openDaysInMonth } from './core';

describe('displayName', () => {
  const m = { title: 'Oma', firstName: 'Giok Nio', lastName: 'Oei', registration: { nickname: 'Nio' } } as Member;
  it('prefers the nickname', () => {
    expect(displayName(m)).toBe('Oma Nio');
    expect(displayFull(m)).toBe('Oma Giok Nio Oei');
    expect(displayFull({ ...m, registration: undefined })).toBeNull();
    expect(displayName({ ...m, registration: undefined })).toBe(memberShort(m));
  });
  it('does not double the title when the nickname already has it', () => {
    const lina = { title: 'Oma', firstName: 'Lina', lastName: 'Wijaya', registration: { nickname: 'Oma Lina' } } as Member;
    expect(displayName(lina)).toBe('Oma Lina');
    expect(displayName({ ...lina, registration: { nickname: 'Pak Bambang' } })).toBe('Pak Bambang');
    expect(displayName({ ...lina, registration: { nickname: '  ' } })).toBe('Oma Lina');
  });
});

describe('initials', () => {
  it('works with any title: given a member it uses the first and last name, never the title', () => {
    expect(initials({ title: 'Tante', firstName: 'Lily', lastName: 'Tan' })).toBe('LT');
    expect(initials({ title: 'Oma', firstName: 'Giok Nio', lastName: 'Oei' })).toBe('GO');
    expect(initials({ title: 'Tante', firstName: 'Lily', lastName: 'Lily' })).toBe('L');
    expect(initials(memberName({ title: 'Oma', firstName: 'Lina', lastName: 'Wijaya' }))).toBe('LW'); // a plain name still strips the presets
    expect(memberName({ title: 'Tante', firstName: 'Lily', lastName: 'Tan' })).toBe('Tante Lily Tan');
  });
});

// round 14 (B2): a weekend is a closed day unless a programme is approved for it (Ruling 9, Review Focus 4)
describe('weekends open when programmed', () => {
  const SAT = '2026-11-14'; // a Saturday with no rental (every October Saturday is rented out in club hours: see below)
  const SUN = '2026-11-15';
  const RENTED = '2026-10-24';
  /** the seed programmes the first Saturday with no venue booking (7 Nov; 24 and 31 Oct are rented out) and leaves its Sunday waiting for Ega */
  const SEED_SAT = '2026-11-07';
  const SEED_SUN = '2026-11-08';
  const seed = () => buildSeed().citra;
    const ANGKLUNG = { activityId: 'act-angklung', staffId: 's5', roomId: 'room-music' };
  it('a Saturday with nothing programmed is closed for the weekend', () => {
    expect(dayStatus(seed(), SAT)).toMatchObject({ open: false, reason: 'weekend' });
  });
  it('opens with a Saturday cell in the published plan, or a live session or extra on the day', () => {
    const plan = produce(seed(), (d) => { d.scheduleVersions['sched-2024-07'].days[6] = { '10:30': ANGKLUNG, '13:30': null }; });
    expect(dayStatus(plan, SAT).open).toBe(true);
    expect(dayStatus(plan, SUN).open).toBe(false);
    const day = produce(seed(), (d) => { d.scheduleDays[SAT] = { id: SAT, clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s9', date: SAT, slots: { '10:30': ANGKLUNG } }; });
    expect(dayStatus(day, SAT).open).toBe(true);
    const extra = produce(seed(), (d) => { d.scheduleDays[SAT] = { id: SAT, clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s9', date: SAT, slots: {}, extra: [{ time: '11:30', cell: ANGKLUNG }] }; });
    expect(dayStatus(extra, SAT).open).toBe(true);
    expect(dayStatus(seed(), SEED_SAT).open).toBe(true);
  });
  it('a published Saturday cell does not open a Saturday rented out in club hours (the booking stays editable); a free Saturday opens', () => {
    const plan = produce(seed(), (d) => { d.scheduleVersions['sched-2024-07'].days[6] = { '10:30': ANGKLUNG, '13:30': null }; });
    expect(plan.venueBookings.v1).toMatchObject({ date: RENTED, status: 'confirmed', from: '09:00', to: '13:00' });
    expect(dayStatus(plan, RENTED)).toMatchObject({ open: false, reason: 'weekend' });
    expect(checkVenueSlot(plan, { roomId: plan.venueBookings.v1.roomId, date: RENTED, from: '09:00', to: '12:00' }, '2026-10-21', '10:00', 'v1')).toEqual({ ok: true }); // the rental can still be edited
    expect(dayStatus(plan, SAT).open).toBe(true);
    const evening = produce(plan, (d) => { d.venueBookings.v1.from = '17:00'; d.venueBookings.v1.to = '20:00'; }); // after club hours: the Saturday opens
    expect(dayStatus(evening, RENTED).open).toBe(true);
    const cancelled = produce(plan, (d) => { d.venueBookings.v1.status = 'cancelled'; });
    expect(dayStatus(cancelled, RENTED).open).toBe(true);
  });
  it('stays closed with only a waiting or a returned programme, and on a weekend holiday', () => {
    const s = seed();
    expect(s.scheduleDays[SEED_SUN].pending?.by).toBe('staff:s5');
    expect(dayStatus(s, SEED_SUN)).toMatchObject({ open: false, reason: 'weekend' });
    const returned = produce(seed(), (d) => { d.scheduleDays[SAT] = { id: SAT, clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s5', date: SAT, slots: {}, returned: { note: 'Not this week', by: 'staff:s9', at: '2026-10-20T11:00' } }; });
    expect(dayStatus(returned, SAT)).toMatchObject({ open: false, reason: 'weekend' });
    const holiday = produce(s, (d) => { d.calendarEvents['ev-sat'] = { id: 'ev-sat', clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s9', date: SEED_SAT, kind: 'holiday', title: 'Holiday' }; });
    expect(dayStatus(holiday, SEED_SAT)).toMatchObject({ open: false, reason: 'holiday' });
  });
  it('the month counts the programmed Saturday as an open day', () => {
    expect(openDaysInMonth(seed(), '2026-11')).toContain(SEED_SAT);
    expect(openDaysInMonth(seed(), '2026-11')).not.toContain(SEED_SUN);
    expect(openDaysInMonth(seed(), '2026-11')).not.toContain(SAT);
    const day = produce(seed(), (d) => { d.scheduleDays[SAT] = { id: SAT, clubId: d.clubId, createdAt: '2026-10-20T10:00', createdBy: 'staff:s9', date: SAT, slots: { '10:30': ANGKLUNG } }; });
    expect(openDaysInMonth(day, '2026-11')).toContain(SAT);
  });
});
