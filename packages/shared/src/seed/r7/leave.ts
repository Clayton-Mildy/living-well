// Round 13 seed: staff leave (5 days a year). Four requests with their `leave` rows, no random draws, every date from T through addDays / dow / dayStatus:
//  lv-1 Dinar, approved, two open days from the first Monday two months back ("Family wedding in Solo"), decided a week before by Ega;
//  lv-2 Caca, approved, one open day in the month three months back ("Moving house");
//  lv-3 Caca, pending, two open days from the Monday two weeks on ("Taking my mother to a check-up in Bandung"), asked yesterday at 16:10;
//  lv-4 Chef Agus, declined, one past Friday, with Ega's note.
// So on the demo day Caca has 4 of 5 days left (1 used, 2 waiting) and Dinar 3 of 5; approving lv-3 leaves Caca 2 of 5.
import type { ClubState, ISODate, LeaveRequest, StaffTime } from '../../types';
import { dayStatus } from '../../rules/core';
import { leaveDates } from '../../rules/staffLeave';
import { addDays, addMonths, dow, ym } from '../../util';

/** `from` itself when the club is open that day, else the next open day. */
const openFrom = (s: ClubState, from: ISODate): ISODate => {
  let d = from;
  for (let i = 0; i < 60 && !dayStatus(s, d).open; i++) d = addDays(d, 1);
  return d;
};
/** First day on or after `from` that falls on this weekday (0 Sun … 6 Sat). */
const weekdayOnOrAfter = (from: ISODate, wd: number): ISODate => {
  let d = from;
  while (dow(d) !== wd) d = addDays(d, 1);
  return d;
};

export function seedLeave(s: ClubState, T: ISODate): void {
  const C = s.clubId;
  const put = (id: string, staffId: string, from: ISODate, to: ISODate, reason: string, extra: Pick<LeaveRequest, 'status' | 'createdAt'> & Partial<LeaveRequest>) => {
    const row: LeaveRequest = { id, clubId: C, createdBy: `staff:${staffId}`, staffId, from, to, days: leaveDates(s, from, to).length, reason, ...extra };
    s.leaveRequests[id] = row;
    if (row.status === 'approved') {
      for (const date of leaveDates(s, from, to)) {
        const tid = `st-${staffId}-${date}`;
        s.staffTime[tid] = { id: tid, clubId: C, createdAt: row.decidedAt ?? row.createdAt, createdBy: row.decidedBy ?? 'staff:s9', staffId, date, kind: 'leave' } satisfies StaffTime;
      }
    }
  };
  const twoDays = (day: ISODate): [ISODate, ISODate] => [day, openFrom(s, addDays(day, 1))];

  // lv-1 Dinar
  const [a1, b1] = twoDays(openFrom(s, weekdayOnOrAfter(`${addMonths(ym(T), -2)}-01`, 1)));
  put('lv-1', 's5', a1, b1, 'Family wedding in Solo', { status: 'approved', createdAt: `${addDays(a1, -12)}T09:10`, decidedBy: 'staff:s9', decidedAt: `${addDays(a1, -7)}T11:30` });
  // lv-2 Caca
  const a2 = openFrom(s, weekdayOnOrAfter(`${addMonths(ym(T), -3)}-01`, 3));
  put('lv-2', 's1', a2, a2, 'Moving house', { status: 'approved', createdAt: `${addDays(a2, -9)}T08:50`, decidedBy: 'staff:s9', decidedAt: `${addDays(a2, -6)}T10:15` });
  // lv-3 Caca, still waiting for Ega
  const [a3, b3] = twoDays(openFrom(s, weekdayOnOrAfter(addDays(T, 14), 1)));
  put('lv-3', 's1', a3, b3, 'Taking my mother to a check-up in Bandung', { status: 'pending', createdAt: `${addDays(T, -1)}T16:10` });
  // lv-4 Chef Agus: the Friday before T (or an earlier one when that day was closed)
  let fri = addDays(T, -1);
  while (dow(fri) !== 5) fri = addDays(fri, -1);
  for (let i = 0; i < 8 && !dayStatus(s, fri).open; i++) fri = addDays(fri, -7);
  put('lv-4', 's3', fri, fri, 'Visiting my parents in Bogor', { status: 'declined', createdAt: `${addDays(fri, -10)}T14:00`, decidedBy: 'staff:s9', decidedAt: `${addDays(fri, -8)}T15:20`, note: 'Menu tasting that day; please pick another day' });
}
