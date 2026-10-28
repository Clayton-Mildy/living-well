// Round 15 (phase 2, R4; fix wave R-F1) seed: an empty week for the activity team to plan live in the demo. Each day Monday to Friday of the week containing
// T+14 (T = the demo day) is a published one-day change with no session (`scheduleDays`, both weekly slots set to "no session"). The weekly plan is not
// touched, so a weekly change approved during the demo (a new plan from next Monday, say) still applies before and after that week. A one-day change wins
// over the weekly plan on its own date (as every one-day change does): the team plans the week live day by day in the Calendar (setting a session on a day
// replaces its "no session"), and a weekly version published from that Monday takes effect again from the Monday after. No extra session or guest booking
// is seeded on its Monday to Friday (they sit within days of T). The seeded programmed Saturday and the waiting Sunday may fall on its weekend: they stay.
// Fixed dates and no random draws: the same for 5 and 45 members.
import type { ClubState, ISODate, ScheduleDay } from '../types';
import { addDays, dow } from '../util';

/** The Monday of the week containing T+14. */
export const emptyWeekMonday = (T: ISODate): ISODate => { const d = addDays(T, 14); return addDays(d, -((dow(d) + 6) % 7)); };

/** `published`: when and by whom the one-day changes were made. */
export function seedEmptyWeek(s: ClubState, T: ISODate, published: { at: ScheduleDay['createdAt']; by: `staff:${string}` }): void {
  const monday = emptyWeekMonday(T);
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    if (s.scheduleDays[date]) continue;
    s.scheduleDays[date] = { id: date, clubId: s.clubId, createdAt: published.at, createdBy: published.by, date, slots: { '10:30': null, '13:30': null } };
  }
}
