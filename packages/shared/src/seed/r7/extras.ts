// KC round 7 seed: one extra activity session beside the weekly plan, so the demo shows it: tea-time karaoke at 15:00 on the next open day after the demo day T.
// Runs after seedGuests (it merges into that day's row, which may already hold the guest talk's one-day change), is relative to T and the same for 5 and 45 members.
import type { ClubState, ISODate, ScheduleDay } from '../../types';
import { dayStatus } from '../../rules/core';
import { addDays } from '../../util';

export function seedExtraSessions(s: ClubState, T: ISODate): void {
  let date = addDays(T, 1);
  for (let i = 0; i < 60; i++, date = addDays(date, 1)) {
    const st = dayStatus(s, date);
    if (st.open && !st.outing) break;
  }
  const karaoke = s.activities['act-karaoke'];
  if (!karaoke || !s.staff.s6) return;
  const row: ScheduleDay = s.scheduleDays[date] ?? { id: date, clubId: s.clubId, createdAt: `${addDays(T, -1)}T11:00`, createdBy: 'staff:s9', date, slots: {} };
  row.extra = [...(row.extra ?? []), { time: '15:00', cell: { activityId: karaoke.id, staffId: 's6', roomId: karaoke.roomId }, note: 'Tea-time karaoke for this month’s birthdays' }];
  s.scheduleDays[date] = row;
}
