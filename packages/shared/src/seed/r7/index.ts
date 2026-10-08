// KC round 7 seed data, one file per feature (each owned by that feature). Runs at the end of buildCitra.
import type { ClubState, ISODate } from '../../types';
import { seedRenewals } from './renewals';
import { seedGuests } from './guests';
import { seedSurveys } from './surveys';
import { seedTasks } from './tasks';
import { seedSessionMarks } from './sessionMarks';

export function seedRound7(s: ClubState, T: ISODate): void {
  seedGuests(s, T); // first: it adds activities and a one-day change that the session marks follow
  seedSessionMarks(s, T);
  seedSurveys(s, T);
  seedTasks(s, T);
  seedRenewals(s, T);
}
