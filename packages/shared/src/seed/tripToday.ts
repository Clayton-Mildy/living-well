// Demo field trip day (KC, 11 Nov 2026): the demo tools can rebuild today as the Kebun Raya Bogor trip day (buildSeed(…, { trip: true })).
// The same members come as on a club day, but they check in at the club before the bus (08:30), the trip runs until 15:00, and they go home once
// it is back. The seed puts the trip on today, moves today's guests to the next open day, and uses these times where it makes today's visits.
// Fixed values, no random draws.
import type { ClubState, HM, ISODate, Photo } from '../types';
import { live, toHM, toMin } from '../util';
import { attId } from '../rules/attendance';
import { demoMediaId } from './demoMedia';
import { FACE_FREE } from './r7/drafts';

/** The seeded trip that becomes today's (its venue, Kebun Raya Bogor, is in Contacts). */
export const TRIP_TODAY_ID = 'ev-outing-1029';

/** A club-day arrival (08:40–10:20) as a trip-day one, before the bus: 07:35–08:15, in the same order. */
export const tripIn = (hm: HM): HM => toHM(Math.max(455, Math.min(495, 455 + Math.round((toMin(hm) - 520) * 0.4))));
/** A club-day going-home time as a trip-day one: nobody leaves before the bus is back, so a time before 15:20 moves to 15:20–15:34. */
export const tripOut = (hm: HM): HM => (toMin(hm) >= 920 ? hm : toHM(920 + (toMin(hm) % 15)));

/**
 * Trip day, after today's visits are made: Oma Lina and Opa Budi come for the trip (so Maria's Today reads "On the field trip"), everyone checked in
 * today is in Who went (as a check-in on a trip day does), Dinar's camera drafts carry the trip's name, and the trip's pictures appear once their time has passed.
 */
export function seedTripToday(s: ClubState, T: ISODate, nowMin: number): void {
  const trip = s.calendarEvents[TRIP_TODAY_ID];
  if (!trip || trip.date !== T) return;
  const C = s.clubId;
  const come = (memberId: string, inAt: HM, outAt: HM) => {
    const m = s.members[memberId];
    if (!m || m.deletedAt || toMin(inAt) > nowMin || s.attendance[attId(T, memberId)]) return;
    s.attendance[attId(T, memberId)] = {
      id: attId(T, memberId), clubId: C, createdAt: `${T}T${inAt}`, createdBy: 'staff:s1', memberId, date: T,
      checkIn: { at: inAt, by: 'staff:s1', method: 'face' },
      ...(toMin(outAt) <= nowMin ? { checkOut: { at: outAt, by: 'staff:s1', method: 'manual' as const } } : {}),
      queueAdds: [], dismissed: [], edits: [],
    };
  };
  come('m1', '08:06', '15:52');
  come('m46', '08:07', '15:54');
  trip.wentIds = live(s.attendance)
    .filter((a) => a.date === T && a.checkIn && s.members[a.memberId] && !s.members[a.memberId].deletedAt)
    .sort((a, b) => (a.checkIn!.at < b.checkIn!.at ? -1 : a.checkIn!.at > b.checkIn!.at ? 1 : a.memberId < b.memberId ? -1 : 1))
    .map((a) => a.memberId);
  // Dinar's drafts this morning were taken at the garden
  for (const p of live(s.photos)) {
    if (p.date !== T || p.visibility !== 'draft') continue;
    p.activity = trip.title;
    if (p.kind === 'activity') p.mediaId = demoMediaId('act-garden-1');
  }
  // the trip's pictures, sent by Dinar and approved by Ega; strangers' faces never carry a member's name (seed/r7/drafts.ts FACE_FREE)
  const put = (id: string, time: HM, kind: Photo['kind'], memberIds: string[], pic: string) => {
    if (toMin(time) > nowMin) return;
    s.photos[id] = { id, clubId: C, createdAt: `${T}T${time}`, createdBy: 'staff:s5', date: T, time, kind, media: 'photo', activity: trip.title, memberIds, tone: 1, takenBy: 's5', visibility: 'visible', approved: { at: `${T}T${time}`, by: 's9' }, mediaId: demoMediaId(pic) };
  };
  if (trip.wentIds.length) put('ptrip-today-1', '10:40', 'activity', [], 'act-garden-2');
  const both = trip.wentIds.filter((id) => id === 'm1' || id === 'm46');
  if (both.length) put('ptrip-today-2', '12:15', 'group', both, FACE_FREE[0]);
}

/** Today's rows stamped after the demo clock are not there yet: the camera's pictures and the ticked tasks (the clock can be set to any time of day). */
export function dropFuture(s: ClubState, T: ISODate, nowMin: number): void {
  for (const p of Object.values(s.photos)) if (p.date === T && p.time && toMin(p.time) > nowMin) delete s.photos[p.id];
  for (const d of Object.values(s.taskDone)) if (d.createdAt.startsWith(`${T}T`) && toMin(d.createdAt.slice(11, 16)) > nowMin) delete s.taskDone[d.id];
}
