// Celebrations (round 12): a family asks the front desk to hold a room for a birthday or a small celebration at the club; management confirms.
// Pure selectors over ClubState. Families only ever see confirmed ones (the projection already filters), staff also see requested ones.
import type { Celebration, CelebrationKind, CelebrationStatus, ClubState, HM, ISODate, Lang } from '../types';
import { live, sortBy } from '../util';
import { checkVenueSlot, venueIsPast, type SlotCheck } from './mgmt';

export const CELEBRATION_KINDS: CelebrationKind[] = ['birthday', 'anniversary', 'other'];
export const CELEBRATION_GUESTS_MAX = 200;

/** Celebrations on a date, by status (confirmed only by default), earliest first. */
export function celebrationsOn(s: ClubState, date: ISODate, statuses: CelebrationStatus[] = ['confirmed']): Celebration[] {
  return sortBy(live(s.celebrations || {}).filter((c) => c.date === date && statuses.includes(c.status)), (c) => c.from + c.id);
}
export const celebrationIsPast = (c: Pick<Celebration, 'date' | 'to'>, today: ISODate, now: HM) => venueIsPast(c, today, now);
/** Requested (waiting for management), upcoming (confirmed, not over) and past (over, declined or cancelled; newest first). */
export function celebrationLists(s: ClubState, today: ISODate, now: HM): { requested: Celebration[]; upcoming: Celebration[]; past: Celebration[] } {
  const all = live(s.celebrations || {});
  const over = (c: Celebration) => celebrationIsPast(c, today, now);
  return {
    requested: sortBy(all.filter((c) => c.status === 'requested' && !over(c)), (c) => c.date + c.from + c.id),
    upcoming: sortBy(all.filter((c) => c.status === 'confirmed' && !over(c)), (c) => c.date + c.from + c.id),
    past: sortBy(all.filter((c) => c.status === 'declined' || c.status === 'cancelled' || over(c)), (c) => c.date + c.from + c.id, -1),
  };
}
/** The number of guests the kitchen should cook for on a date: confirmed celebrations only. */
export const celebrationGuestsOn = (s: ClubState, date: ISODate) => celebrationsOn(s, date).reduce((n, c) => n + c.guests, 0);

/** Same checks as a private event (room, past, times, hours of the day, closed days, a clash with a booking or celebration), except it may fall in club hours: it is family joining a member while the club is open. */
export function checkCelebrationSlot(s: ClubState, slot: { roomId: string; date: ISODate; from: HM; to: HM }, today: ISODate, now: HM, ignoreId?: string): SlotCheck {
  return checkVenueSlot(s, slot, today, now, ignoreId, true);
}

const ordinalEn = (n: number) => {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
/** The title a celebration gets by default, e.g. "Opa Budi's 80th birthday" / "Ulang tahun ke-80 Opa Budi". 'other' is the name alone. */
export function celebrationTitle(kind: CelebrationKind, name: string, years: number | undefined, lang: Lang): string {
  if (kind === 'other') return name;
  const n = years && years > 0 ? years : 0;
  if (lang === 'id') {
    const word = kind === 'birthday' ? 'Ulang tahun' : 'Hari jadi';
    return n ? `${word} ke-${n} ${name}` : `${word} ${name}`;
  }
  const word = kind === 'birthday' ? 'birthday' : 'anniversary';
  return n ? `${name}'s ${ordinalEn(n)} ${word}` : `${name}'s ${word}`;
}
