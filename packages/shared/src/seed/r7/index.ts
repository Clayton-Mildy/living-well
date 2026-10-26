// KC round 7 seed data, one file per feature (each owned by that feature). Runs at the end of buildCitra.
import type { ClubState, ISODate } from '../../types';
import { seedRenewals } from './renewals';
import { seedGuests } from './guests';
import { seedSurveys } from './surveys';
import { seedTasks } from './tasks';
import { seedSessionMarks } from './sessionMarks';
import { seedDrafts } from './drafts';
import { seedExtraSessions } from './extras';
import { seedCheckOn } from './checkOn';
import { seedMoodMarks } from './moodMarks';
import { seedCelebrations } from './celebrations';
import { seedLeads } from './leads';
import { seedLeave } from './leave';
import { seedUnpaid } from './unpaid';
import { seedWeekend } from './weekend';

export function seedRound7(s: ClubState, T: ISODate): void {
  seedGuests(s, T); // first: it adds activities and a one-day change that the session marks follow
  seedExtraSessions(s, T); // one extra session (tea-time karaoke) on the next open day
  seedSessionMarks(s, T);
  seedSurveys(s, T);
  seedTasks(s, T);
  seedRenewals(s, T);
  seedDrafts(s, T); // the quick camera's drafts for Dinar today
  seedCheckOn(s, T); // round 12: two roster members have gone quiet (before the mood marks, so they get none for the visits removed)
  seedCelebrations(s, T); // round 12: Opa Budi's birthday (confirmed) and an anniversary lunch (waiting for management)
  seedLeads(s, T); // round 13: the history of every lead, and (roster only) the leads that joined or stalled in the last six months
  seedLeave(s, T); // round 13: staff leave requests (Dinar and Caca approved, Caca waiting, Chef Agus declined) with the approved leave rows; no random draws
  seedUnpaid(s, T); // round 14: (roster only) a promise and a "no answer" on the two overdue invoices; no random draws
  seedMoodMarks(s, T); // round 12: a mood mark for every seeded visit (last: it walks the attendance, readings and logs above)
  seedWeekend(s, T); // round 14: the first Saturday after T is programmed, the Sunday after it waits for Ega (after everything that looks for an open day)
}
