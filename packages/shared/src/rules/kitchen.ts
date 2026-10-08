// Menu and schedule versions, diners/covers, allergen conflicts.
import type { ClubState, ISODate, Dish, DishAllergen, FoodAllergen, Member, GuestVisit, MenuDay, Photo, ScheduleCell, Slot, Weekday, ScheduleVersion, MenuVersion } from '../types';
import { dayStatus } from './core';
import { lobbyGroups, guestsOn } from './attendance';
import { dow, live, sortBy, uniq } from '../util';
import { approvedDayMenu, menuVersionForFamily } from './approvals';

// ---------- versions ----------
export function scheduleVersionFor(s: ClubState, date: ISODate): ScheduleVersion | undefined {
  const pub = live(s.scheduleVersions).filter((v) => v.status === 'published' && v.effectiveFrom <= date);
  return sortBy(pub, (v) => v.effectiveFrom + (v.publishedAt || '')).pop();
}
export interface SessionSlot {
  slot: Slot;
  cell: ScheduleCell | null;
}
/** KC round 7: the one-day change of the programme on a date, if any (`scheduleDays`, id = date). */
export const scheduleDayOf = (s: ClubState, date: ISODate) => {
  const d = s.scheduleDays?.[date];
  return d && !d.deletedAt ? d : undefined;
};
/** Activity sessions for a date (empty on closed days and outings). A one-day change (KC round 7) overrides the weekly schedule slot by slot. */
export function sessionsOn(s: ClubState, date: ISODate): SessionSlot[] {
  const st = dayStatus(s, date);
  if (!st.open || st.outing) return [];
  const v = scheduleVersionFor(s, date);
  const over = scheduleDayOf(s, date);
  if (!v && !over) return [];
  const day = v?.days[dow(date) as Weekday];
  return (['10:30', '13:30'] as Slot[]).map((slot) => ({ slot, cell: over && slot in over.slots ? over.slots[slot] ?? null : day?.[slot] ?? null }));
}
/**
 * The weekly menu version in force on a date. A version the kitchen published waits for management's approval; the club's own screens already
 * follow it, families see only approved ones (`approvedOnly`, and the family projection leaves the rest out).
 */
export function menuVersionFor(s: ClubState, date: ISODate, opts: { approvedOnly?: boolean } = {}): MenuVersion | undefined {
  const pub = live(s.menuVersions).filter((v) => v.status === 'published' && v.effectiveFrom <= date && (!opts.approvedOnly || menuVersionForFamily(v)) && v.approval?.status !== 'rejected');
  return sortBy(pub, (v) => v.effectiveFrom + v.createdAt).pop();
}
/** Dish ids served on a date: per-date override, else the version in force; nothing on closed days. */
export function menuOn(s: ClubState, date: ISODate, opts: { approvedOnly?: boolean } = {}): MenuDay | null {
  if (!dayStatus(s, date).open) return null;
  const v = menuVersionFor(s, date, opts);
  const base: MenuDay = v?.days[dow(date) as Weekday] || { lunch: [], soft: [], tea: [] };
  const row = s.dayMenus[date];
  const o = row && opts.approvedOnly ? approvedDayMenu(row) : row;
  return { lunch: o?.lunch ?? base.lunch, soft: o?.soft ?? base.soft, tea: o?.tea ?? base.tea };
}
export const dishNames = (s: ClubState, ids: string[]) => ids.map((id) => s.dishes[id]?.name).filter(Boolean).join(', ');

// ---------- lunch photos ----------
/** The most lunch photos one day can hold (the kitchen's gallery, not a photo library). */
export const MAX_LUNCH_PHOTOS = 12;
/** Lunch photo ids of a date, oldest first. Reads `photoIds`; the deprecated single `photoId` of older data is read too. */
export function lunchPhotoIds(s: ClubState, date: ISODate): string[] {
  const row = s.dayMenus[date];
  if (!row || row.deletedAt) return [];
  return uniq([...(row.photoIds ?? []), ...(row.photoId ? [row.photoId] : [])]);
}
/** A date's lunch photos for the kitchen: waiting for approval, shown to families, or hidden by management (removed ones are gone). Oldest first. */
export function lunchPhotosOn(s: ClubState, date: ISODate): Photo[] {
  return lunchPhotoIds(s, date).map((id) => s.photos[id]).filter((p): p is Photo => !!p && !p.deletedAt && p.kind === 'lunch' && p.visibility !== 'removed');
}
/** The lunch photos families may see on a date: approved ones only (pending, hidden and removed never reach a family). */
export const visibleLunchPhotos = (s: ClubState, date: ISODate): Photo[] => lunchPhotosOn(s, date).filter((p) => p.visibility === 'visible');

// ---------- afternoon tea photos (KC round 7: the same gallery and approval as lunch, kept in DayMenu.teaPhotoIds) ----------
/** Tea photo ids of a date, oldest first. */
export function teaPhotoIds(s: ClubState, date: ISODate): string[] {
  const row = s.dayMenus[date];
  return row && !row.deletedAt ? uniq(row.teaPhotoIds ?? []) : [];
}
/** A date's tea photos for the kitchen (waiting for approval, shown to families or hidden; removed ones are gone). Oldest first. */
export function teaPhotosOn(s: ClubState, date: ISODate): Photo[] {
  return teaPhotoIds(s, date).map((id) => s.photos[id]).filter((p): p is Photo => !!p && !p.deletedAt && p.kind === 'lunch' && p.visibility !== 'removed');
}
/** The tea photos families may see on a date: approved ones only. */
export const visibleTeaPhotos = (s: ClubState, date: ISODate): Photo[] => teaPhotosOn(s, date).filter((p) => p.visibility === 'visible');
/** Which meal's gallery a kitchen photo belongs to. */
export type Meal = 'lunch' | 'tea';
export const mealPhotosOn = (s: ClubState, date: ISODate, meal: Meal): Photo[] => (meal === 'tea' ? teaPhotosOn(s, date) : lunchPhotosOn(s, date));

// ---------- diners ----------
export type Diner =
  | { type: 'member'; id: string; m: Member; soft: boolean; food: FoodAllergen[] }
  | { type: 'guest'; id: string; g: GuestVisit; soft: boolean; food: FoodAllergen[] | null };

const memberDiner = (m: Member): Diner => ({ type: 'member', id: m.id, m, soft: m.health.diet.includes('softFood'), food: m.health.food });
/** Who has lunch on a date: members checked in that day (members drop in, so nobody is expected) plus booked guests. */
export function dinersOn(s: ClubState, date: ISODate): Diner[] {
  const g = lobbyGroups(s, date);
  const members = [...g.inClub, ...g.goneHome].map((r) => memberDiner(r.m));
  const guests: Diner[] = guestsOn(s, date).filter((x) => x.lunch && x.status === 'booked').map((x) => ({ type: 'guest', id: x.id, g: x, soft: x.diet.includes('softFood'), food: x.food }));
  return [...members, ...guests];
}

// ---------- allergens ----------
/** Which dish allergens a person's food allergy covers. "Seafood" covers fish and shellfish. */
export const ALLERGY_COVERS: Record<FoodAllergen, DishAllergen[]> = {
  shellfish: ['shellfish'],
  seafood: ['fish', 'shellfish'],
  fish: ['fish'],
  peanuts: ['peanuts'],
  eggs: ['eggs'],
  dairy: ['dairy'],
  gluten: ['gluten'],
};
export interface Conflict {
  diner: Diner;
  dish: Dish;
  allergen: DishAllergen;
  allergy: FoodAllergen;
  plan?: { alternative: string; by: string; at: string };
}
/** Allergen clashes between today's diners and the menu (updates live as members check in). */
export function conflictsOn(s: ClubState, date: ISODate): Conflict[] {
  const menu = menuOn(s, date);
  return menu ? conflictsFor(s, date, menu, dinersOn(s, date)) : [];
}
/** A member's clashes with a date's menu, whether or not they are in the club. */
export function memberConflictsOn(s: ClubState, m: Member, date: ISODate): Conflict[] {
  const menu = menuOn(s, date);
  return menu ? conflictsFor(s, date, menu, [memberDiner(m)]) : [];
}
function conflictsFor(s: ClubState, date: ISODate, menu: MenuDay, diners: Diner[]): Conflict[] {
  const out: Conflict[] = [];
  const plans = s.dayMenus[date]?.allergyPlans || [];
  for (const d of diners) {
    const ids = (d.soft ? menu.soft : menu.lunch).concat(menu.tea);
    for (const id of ids) {
      const dish = s.dishes[id];
      if (!dish) continue;
      for (const allergy of d.food || []) {
        const hit = dish.allergens.find((a) => ALLERGY_COVERS[allergy]?.includes(a));
        if (hit) {
          const person = (d.type === 'member' ? `member:${d.id}` : `guest:${d.id}`) as `member:${string}`;
          const p = plans.find((x) => x.person === person && x.dishId === id);
          out.push({ diner: d, dish, allergen: hit, allergy, plan: p ? { alternative: p.alternative, by: p.by, at: p.at } : undefined });
          break;
        }
      }
    }
  }
  return out;
}
/** What families and the lobby may be told about a member's lunch. */
export function lunchSafety(s: ClubState, memberId: string, date: ISODate): { kind: 'none' } | { kind: 'clear' } | { kind: 'alternative'; dish: string; alternative: string } | { kind: 'unknown' } {
  const m = s.members[memberId];
  if (!m || !m.health.food.length) return { kind: 'none' };
  const menu = menuOn(s, date);
  if (!menu) return { kind: 'none' };
  const served = (m.health.diet.includes('softFood') ? menu.soft : menu.lunch).concat(menu.tea);
  const unchecked = served.some((id) => !s.dishes[id]?.reviewedAt);
  const mine = memberConflictsOn(s, m, date);
  if (mine.length) {
    const p = mine.find((c) => c.plan);
    return p && mine.every((c) => c.plan) ? { kind: 'alternative', dish: p.dish.name, alternative: p.plan!.alternative } : { kind: 'unknown' };
  }
  return unchecked ? { kind: 'unknown' } : { kind: 'clear' };
}
/** Members whose dietary needs the kitchen groups for the day. */
export function dietaryGroups(s: ClubState, date: ISODate) {
  const groups: Record<string, { icon: string; key: string; names: string[] }> = {};
  const add = (key: string, icon: string, name: string) => ((groups[key] = groups[key] || { icon, key, names: [] }).names.push(name));
  for (const d of dinersOn(s, date)) {
    const name = d.type === 'member' ? `${d.m.title} ${d.m.firstName}` : d.g.name;
    (d.food || []).forEach((a) => add('allergy:' + a, 'no_food', name));
    if (d.type === 'guest' && d.food === null) add('allergy:unknown', 'help', name);
    const diet = d.type === 'member' ? d.m.health.diet : d.g.diet;
    diet.forEach((x) => add('diet:' + x, 'restaurant', name));
    if (d.type === 'member' && d.m.health.diabetic) add('diabetic', 'water_drop', name);
  }
  return Object.values(groups);
}
