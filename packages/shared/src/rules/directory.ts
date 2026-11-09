// The Contacts directory's categories (round 15, phase 2): which category a contact sits under, and in what order.
import type { CalendarEvent, ClubSettings, ClubState, DirectoryContact, DirectoryGroup } from '../types';
import { live, sortBy } from '../util';

/** The key of the bucket for contacts with no category, or whose category is retired or gone ("Other"). */
export const OTHER = '__other';
/** Round 21: the fixed heading for field trip venues (not one of the categories management edits). */
export const VENUES = '__venues';

/** The category's name in the app language (Indonesian wording where it has one). */
export const groupName = (g: DirectoryGroup, lang: string): string => (lang === 'id' && g.nameId ? g.nameId : g.name);

/** The categories a contact may be put in: the active ones, in the order management keeps them. */
export const activeGroups = (st: ClubSettings): DirectoryGroup[] => (st.directoryGroups ?? []).filter((g) => g.active);

/**
 * The bucket a contact is listed under: its category when that is still active; otherwise "Other" - the club's own active
 * category named Other when it has one (so there is never a second "Other" heading), else the built-in OTHER bucket.
 */
export function groupKeyOf(st: ClubSettings, c: Pick<DirectoryContact, 'groupId'> & { kind?: DirectoryContact['kind'] }): string {
  if (c.kind === 'venue') return VENUES;
  const act = activeGroups(st);
  if (c.groupId && act.some((g) => g.id === c.groupId)) return c.groupId;
  return act.find((g) => g.name.trim().toLowerCase() === 'other')?.id ?? OTHER;
}

/** The buckets in display order: the active categories as kept, then the built-in Other when no category stands for it. */
export function groupKeys(st: ClubSettings): string[] {
  const act = activeGroups(st);
  const own = act.find((g) => g.name.trim().toLowerCase() === 'other');
  const keys = own ? act.map((g) => g.id) : [...act.map((g) => g.id), OTHER];
  // round 21: Field trip venues sit just before Other
  const at = keys.indexOf(own?.id ?? OTHER);
  return [...keys.slice(0, at), VENUES, ...keys.slice(at)];
}

/** Round 21: the field trips held at a venue (live, not cancelled), newest first. */
export const tripsAt = (s: ClubState, contactId: string): CalendarEvent[] =>
  sortBy(live(s.calendarEvents).filter((e) => e.kind === 'outing' && e.venueId === contactId && !e.cancelledAt), (e) => e.date).reverse();

/** Round 21: a contact's average stars (to 1 decimal) and how many ratings; null when unrated. */
export function ratingOf(c: Pick<DirectoryContact, 'ratings'>): { avg: number; n: number } | null {
  const r = c.ratings ?? [];
  if (!r.length) return null;
  return { avg: Math.round((r.reduce((a, x) => a + x.stars, 0) / r.length) * 10) / 10, n: r.length };
}
/** Round 21: best average first, then more ratings, then the name; unrated contacts last (by name). */
export function sortContacts<T extends Pick<DirectoryContact, 'ratings' | 'name'>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ra = ratingOf(a), rb = ratingOf(b);
    if (!ra || !rb) return ra ? -1 : rb ? 1 : a.name.localeCompare(b.name);
    return rb.avg - ra.avg || rb.n - ra.n || a.name.localeCompare(b.name);
  });
}
