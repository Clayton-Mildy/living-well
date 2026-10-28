// The Contacts directory's categories (round 15, phase 2): which category a contact sits under, and in what order.
import type { ClubSettings, DirectoryContact, DirectoryGroup } from '../types';

/** The key of the bucket for contacts with no category, or whose category is retired or gone ("Other"). */
export const OTHER = '__other';

/** The category's name in the app language (Indonesian wording where it has one). */
export const groupName = (g: DirectoryGroup, lang: string): string => (lang === 'id' && g.nameId ? g.nameId : g.name);

/** The categories a contact may be put in: the active ones, in the order management keeps them. */
export const activeGroups = (st: ClubSettings): DirectoryGroup[] => (st.directoryGroups ?? []).filter((g) => g.active);

/**
 * The bucket a contact is listed under: its category when that is still active; otherwise "Other" - the club's own active
 * category named Other when it has one (so there is never a second "Other" heading), else the built-in OTHER bucket.
 */
export function groupKeyOf(st: ClubSettings, c: Pick<DirectoryContact, 'groupId'>): string {
  const act = activeGroups(st);
  if (c.groupId && act.some((g) => g.id === c.groupId)) return c.groupId;
  return act.find((g) => g.name.trim().toLowerCase() === 'other')?.id ?? OTHER;
}

/** The buckets in display order: the active categories as kept, then the built-in Other when no category stands for it. */
export function groupKeys(st: ClubSettings): string[] {
  const act = activeGroups(st);
  return act.some((g) => g.name.trim().toLowerCase() === 'other') ? act.map((g) => g.id) : [...act.map((g) => g.id), OTHER];
}
