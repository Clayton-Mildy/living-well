// Round 14 (B2) seed: weekends open when a programme is approved. The weekly plan has no weekend cells; the first free Saturday on or after the demo day T
// (no venue booking and no calendar event on it or its Sunday: the seeded rentals keep their Saturdays, and a rental in club hours is refused on an open day)
// is programmed as a one-day change (Angklung and Karaoke with Dinar, Monday's rooms and menu), and the Sunday after it has a programme the activity team
// sent, waiting for Ega. Fixed values, no random draws; the same for 5 and 45 members. Runs last, so nothing seeded before it moves onto the Saturday.
import type { ClubState, ISODate } from '../../types';
import { addDays, dow, live, weekStart } from '../../util';

export function seedWeekend(s: ClubState, T: ISODate): void {
  const busy = (d: ISODate) => live(s.venueBookings).some((v) => v.date === d && v.status === 'confirmed') || live(s.calendarEvents).some((e) => e.date <= d && (e.endDate || e.date) >= d);
  let sat = T;
  while (dow(sat) !== 6) sat = addDays(sat, 1);
  for (let i = 0; i < 26 && (busy(sat) || busy(addDays(sat, 1))); i++) sat = addDays(sat, 7);
  const sun = addDays(sat, 1);
  const monday = s.scheduleVersions[`sched-${weekStart(T)}`]?.days[1]; // the plan of the demo week (round 15: each week has its own)
  const mon = s.menuVersions[`menu-${weekStart(T)}`]?.days[1];
  if (!monday || !mon || !s.activities['act-karaoke'] || s.scheduleDays[sat] || s.scheduleDays[sun]) return;
  const room = (slot: '10:30' | '13:30') => monday[slot]?.roomId ?? s.activities['act-angklung'].roomId;
  const row = { clubId: s.clubId, createdAt: `${addDays(T, -1)}T16:00`, createdBy: 'staff:s9' as const };
  s.scheduleDays[sat] = {
    ...row, id: sat, date: sat,
    slots: { '10:30': { activityId: 'act-angklung', staffId: 's5', roomId: room('10:30') }, '13:30': { activityId: 'act-karaoke', staffId: 's5', roomId: room('13:30') } },
  };
  s.dayMenus[sat] = { ...row, createdBy: 'staff:s3', id: sat, date: sat, lunch: [...mon.lunch], soft: [...mon.soft], tea: [...mon.tea], photoIds: [], allergyPlans: [] };
  s.scheduleDays[sun] = {
    ...row, createdBy: 'staff:s5', id: sun, date: sun, slots: {},
    pending: { slots: { '10:30': { activityId: 'act-keroncong', staffId: 's5', roomId: s.activities['act-keroncong'].roomId } }, by: 'staff:s5', at: `${addDays(T, -1)}T16:30` },
  };
}
