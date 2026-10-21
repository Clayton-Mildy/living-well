// Round 12 seed: two celebrations booked at the front desk. Opa Budi's birthday party (m46, confirmed by management: Garden room, 12 guests, a chocolate
// cake without nuts) on the third open day after T, so the kitchen, the calendar and his family's Today all show it; and an anniversary lunch for Opa Tjahjadi
// (m20) that Caca has asked for and management has not answered yet. Both land on open club days, so they hold for T = 21 Oct (tests) and any other demo day.
// No random draws. Until Task 14 gives Budi a birthday, the date is T + 3 open days.
import type { Celebration, ClubState, ISODate } from '../../types';
import { dayStatus } from '../../rules/core';
import { celebrationTitle } from '../../rules/celebrations';
import { addDays } from '../../util';

/** The n-th open club day after `from` (no weekend, closure, holiday or outing); n = 1 is the next one. */
export function addOpenDays(s: ClubState, from: ISODate, n: number): ISODate {
  let d = from;
  for (let left = n, i = 0; left > 0 && i < 365; i++) {
    d = addDays(d, 1);
    const st = dayStatus(s, d);
    if (st.open && !st.outing) left--;
  }
  return d;
}
/** `from` itself when it is an open club day, else the next one. */
export function openDayFrom(s: ClubState, from: ISODate): ISODate {
  const st = dayStatus(s, from);
  return st.open && !st.outing ? from : addOpenDays(s, from, 1);
}

export function seedCelebrations(s: ClubState, T: ISODate): void {
  const C = s.clubId;
  const row = (id: string, c: Omit<Celebration, 'id' | 'clubId' | 'createdAt' | 'createdBy' | 'requestedBy'>): Celebration => ({ id, clubId: C, createdAt: `${addDays(T, -1)}T15:20`, createdBy: 'staff:s1', requestedBy: 'staff:s1', ...c });
  if (s.members.m46 && s.rooms['room-garden-room']) {
    s.celebrations['cel-seed-1'] = row('cel-seed-1', {
      memberId: 'm46', kind: 'birthday', title: celebrationTitle('birthday', 'Opa Budi', 80, 'en'), date: addOpenDays(s, T, 3), from: '15:00', to: '17:00', roomId: 'room-garden-room', guests: 12,
      cateringNote: 'Chocolate cake, no nuts', status: 'confirmed', decidedBy: 'staff:s9', decidedAt: `${addDays(T, -1)}T16:05`,
    });
  }
  if (s.members.m20 && s.rooms['room-lounge']) {
    s.celebrations['cel-seed-2'] = row('cel-seed-2', {
      memberId: 'm20', kind: 'anniversary', title: celebrationTitle('anniversary', 'Opa Tjahjadi', 60, 'en'), date: openDayFrom(s, addDays(T, 9)), from: '12:30', to: '14:30', roomId: 'room-lounge', guests: 8,
      cateringNote: 'Lunch for the family, a small cake', status: 'requested',
    });
  }
}
