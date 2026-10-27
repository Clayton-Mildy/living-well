// Round 15 (phase 2, R4) seed: an empty week for the activity team to plan live in the demo. The week containing T+14 (T = the demo day) is published with no
// session on any day, and the Monday after it a version restores the normal days, so the programme comes back after that one week. Both versions are
// published (they are not waiting for approval); no one-day change, extra session or guest booking is seeded on its Monday to Friday (they sit within days of T). The seeded programmed Saturday and the waiting Sunday may fall on its weekend: they stay.
// Fixed dates and no random draws: the same for 5 and 45 members.
import type { ClubState, ISODate, ScheduleVersion } from '../types';
import { addDays, dow } from '../util';

/** The Monday of the week containing T+14. */
export const emptyWeekMonday = (T: ISODate): ISODate => { const d = addDays(T, 14); return addDays(d, -((dow(d) + 6) % 7)); };

/** `normal`: the weekly plan in force before it (the restore version repeats it). `published`: when and by whom the versions were published. */
export function seedEmptyWeek(s: ClubState, T: ISODate, normal: ScheduleVersion['days'], published: { at: ScheduleVersion['createdAt']; by: `staff:${string}` }): void {
  const monday = emptyWeekMonday(T);
  const none = Object.fromEntries([1, 2, 3, 4, 5].map((w) => [w, { '10:30': null, '13:30': null }])) as ScheduleVersion['days'];
  const row = (id: string, effectiveFrom: ISODate, days: ScheduleVersion['days']): ScheduleVersion => ({
    id, clubId: s.clubId, createdAt: published.at, createdBy: published.by, effectiveFrom, status: 'published', days, publishedBy: published.by, publishedAt: published.at,
  });
  s.scheduleVersions['sched-r15-empty'] = row('sched-r15-empty', monday, none);
  s.scheduleVersions['sched-r15-restore'] = row('sched-r15-restore', addDays(monday, 7), JSON.parse(JSON.stringify(normal)));
}
