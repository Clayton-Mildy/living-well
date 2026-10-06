// Kitchen and requests selectors that go beyond rules/kitchen.ts (shared and read-only for this area).
// Import by path: '@cp/shared/rules/kitchenOps' (rules/index.ts is not edited).
//
// The club is drop-in: members come on any open day, so nobody is "expected". Diners are the members who have checked in
// (in the club or gone home) plus the guests booked that day, and the live conflicts follow them as they arrive.
//
// What this file adds or corrects compared with rules/kitchen.ts:
//  - potentialConflicts() and allergiesOnFile(): clashes for EVERY active member (checked in or not) so the kitchen can plan
//    ahead, prepare an alternative before someone arrives, or look at a coming day's menu.
//  - safetyOf(): tells "a conflict is waiting for an alternative" apart from "some dish allergens were never checked",
//    and lists every conflict (lunchSafety() reports only the first and calls both cases 'unknown').
//  - unknownAllergyGuests(): guests whose allergies are not known ("ask <escort>"); conflictsOn() skips them silently.
//  - dietaryRows(): dietaryGroups() plus free-text "other" food allergies, typed and ordered for the screen.
//  - membersAffectedBy(): which active members a dish would clash with (planning hints in the menu editor).
//  - template helpers for the weekly menu editor (version in force, scheduled versions, per-date overrides, diffs, the menu of a chosen week).
//  - menuAudience(): the families told when a weekly menu is published.
//  - stock permissions shared by the actions and the screens, and feedback thread helpers.
import type { ClubState, Dish, DishAllergen, Feedback, FoodAllergen, GuestVisit, ISODate, Member, MenuDay, MenuVersion, Message, StockRequest, User, Weekday } from '../types';
import { conflictsOn, dietaryGroups, dinersOn, memberConflictsOn, menuOn, menuVersionFor, ALLERGY_COVERS, type Conflict, type Diner } from './kitchen';
import { attOf, isCheckedIn } from './attendance';
import { activeOn, contactsOfMember, isPendingRow, memberShort } from './core';
import { addDays, dow, live, sortBy, uniq } from '../util';

export type Course = Dish['course'];
export const DISH_ALLERGENS: DishAllergen[] = ['fish', 'shellfish', 'peanuts', 'treeNuts', 'eggs', 'dairy', 'gluten', 'soy'];
export const DISH_TAGS: Dish['tags'] = ['soft', 'lowSalt', 'sugarFree', 'vegetarian'];
export const COURSES: Course[] = ['lunch', 'soft', 'tea'];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const STOCK_AREAS: StockRequest['area'][] = ['kitchen', 'health', 'activities', 'housekeeping', 'transport'];
export const KNOWN_UNITS = ['pcs', 'boxes', 'packs', 'kg', 'litres', 'bottles', 'rolls', 'sets'];

// ---------- diners, conflicts, safety ----------
export type PersonKey = `member:${string}` | `guest:${string}`;
export const personKey = (d: Diner): PersonKey => (d.type === 'member' ? `member:${d.id}` : `guest:${d.id}`);
export const dinerName = (d: Diner) => (d.type === 'member' ? memberShort(d.m) : d.g.name);

/** Covers: members who have checked in that day (so far) plus the guests booked for lunch. */
export function coversOn(s: ClubState, date: ISODate) {
  const all = dinersOn(s, date);
  const guests = all.filter((x) => x.type === 'guest').length;
  return { total: all.length, members: all.length - guests, guests };
}

export interface KitchenConflict extends Conflict {
  person: PersonKey;
  name: string;
  resolved: boolean;
  /** a guest, or a member who has checked in: the people the live panel is about (false = on file, not here yet) */
  present: boolean;
}
const asRow = (c: Conflict, present: boolean): KitchenConflict => ({ ...c, person: personKey(c.diner), name: dinerName(c.diner), resolved: !!c.plan, present });
const sortConflicts = (rows: KitchenConflict[]) => sortBy(rows, (c) => (c.resolved ? '1' : '0') + c.name + c.dish.name);
/** The live panel: clashes of the members checked in so far and of the booked guests; unresolved first. */
export function kitchenConflicts(s: ClubState, date: ISODate): KitchenConflict[] {
  return sortConflicts(conflictsOn(s, date).map((c) => asRow(c, true)));
}
/** Members the club could see on a date: active, approved. */
const activeMembers = (s: ClubState, date: ISODate) => live(s.members).filter((m) => !isPendingRow(m) && activeOn(m, date));
/**
 * Clashes for everyone who could have lunch on a date: the live ones (checked in, guests) plus every other active member
 * on file. A plan can be prepared for any of them before they arrive.
 */
export function potentialConflicts(s: ClubState, date: ISODate): KitchenConflict[] {
  const rows = conflictsOn(s, date).map((c) => asRow(c, true));
  for (const m of activeMembers(s, date)) {
    if (isCheckedIn(s, date, m.id)) continue; // already in the live rows
    for (const c of memberConflictsOn(s, m, date)) rows.push(asRow(c, false));
  }
  return sortConflicts(rows);
}

export interface OnFileRow {
  m: Member;
  food: FoodAllergen[];
  /** free-text "other" food allergy, shown but never matched against dishes */
  other?: string;
  /** today only: where the member is */
  presence: 'in' | 'gone' | 'notYet' | null;
  clashes: KitchenConflict[];
}
/** Active members with a food allergy on file, with where they are (today) and what on a date's menu clashes with them. */
export function allergiesOnFile(s: ClubState, date: ISODate, today: ISODate): OnFileRow[] {
  const rows: OnFileRow[] = [];
  for (const m of activeMembers(s, date)) {
    const other = m.health.foodOther?.trim() || undefined;
    if (!m.health.food.length && !other) continue;
    const a = date === today ? attOf(s, date, m.id) : undefined;
    const presence: OnFileRow['presence'] = date !== today ? null : a?.checkIn ? (a.checkOut ? 'gone' : 'in') : 'notYet';
    rows.push({ m, food: m.health.food, other, presence, clashes: sortConflicts(memberConflictsOn(s, m, date).map((c) => asRow(c, presence === 'in' || presence === 'gone'))) });
  }
  return sortBy(rows, (r) => r.m.firstName);
}
/**
 * Active members whose food allergies meet a dish: a lunch dish reaches those on the regular lunch, a soft dish those on soft food,
 * tea everyone. For planning: the menu editor flags dishes that clash with someone on file.
 */
export function membersAffectedBy(s: ClubState, dish: Pick<Dish, 'allergens' | 'course'>, date: ISODate): Member[] {
  if (!dish.allergens.length) return [];
  return activeMembers(s, date).filter((m) => {
    const soft = m.health.diet.includes('softFood');
    if ((dish.course === 'lunch' && soft) || (dish.course === 'soft' && !soft)) return false;
    return m.health.food.some((a) => dish.allergens.some((x) => ALLERGY_COVERS[a]?.includes(x)));
  });
}

export interface UnknownGuest {
  guest: GuestVisit;
  escort: string;
  phone?: string;
}
/** Guests eating lunch whose allergies are not known yet: the kitchen asks their escort. */
export function unknownAllergyGuests(s: ClubState, date: ISODate): UnknownGuest[] {
  return dinersOn(s, date).flatMap((d) => (d.type === 'guest' && d.food === null ? [{ guest: d.g, escort: d.g.escortName, phone: s.enquiries[d.g.enquiryId]?.contact.phone }] : []));
}

/** Dishes on a date's menu, resolved to rows (dangling ids are skipped). null on closed days. */
export function menuDishesOn(s: ClubState, date: ISODate): Record<Course, Dish[]> | null {
  const m = menuOn(s, date);
  if (!m) return null;
  const pick = (ids: string[]) => ids.map((id) => s.dishes[id]).filter((x): x is Dish => !!x && !x.deletedAt);
  return { lunch: pick(m.lunch), soft: pick(m.soft), tea: pick(m.tea) };
}
/** Dishes served on a date whose allergen tags nobody has confirmed. */
export function unreviewedDishesOn(s: ClubState, date: ISODate): Dish[] {
  const m = menuDishesOn(s, date);
  if (!m) return [];
  const seen = new Set<string>();
  return [...m.lunch, ...m.soft, ...m.tea].filter((x) => !x.reviewedAt && !seen.has(x.id) && !!seen.add(x.id));
}

export type Safety =
  | { kind: 'none' } // no food allergies on file
  | { kind: 'clear' } // no conflicts and every dish checked
  | { kind: 'alternative'; items: { dish: string; alternative: string }[] } // every conflict has an alternative prepared
  | { kind: 'pending'; dishes: string[] } // a conflict is waiting for the kitchen's alternative
  | { kind: 'unreviewed'; dishes: string[] }; // no conflict found, but some dishes' allergens were never checked
/** What a family may be told about a member's lunch, whether or not they are in the club. 'clear' only when nothing conflicts and every served dish was checked. */
export function safetyOf(s: ClubState, memberId: string, date: ISODate): Safety {
  const m = s.members[memberId];
  if (!m || !m.health.food.length) return { kind: 'none' };
  const menu = menuOn(s, date);
  if (!menu) return { kind: 'none' };
  const mine = memberConflictsOn(s, m, date);
  if (mine.length) {
    const open = mine.filter((c) => !c.plan);
    if (open.length) return { kind: 'pending', dishes: open.map((c) => c.dish.name) };
    return { kind: 'alternative', items: mine.map((c) => ({ dish: c.dish.name, alternative: c.plan!.alternative })) };
  }
  const served = (m.health.diet.includes('softFood') ? menu.soft : menu.lunch).concat(menu.tea);
  const unchecked = served.map((id) => s.dishes[id]).filter((x) => x && !x.reviewedAt);
  return unchecked.length ? { kind: 'unreviewed', dishes: unchecked.map((x) => x.name) } : { kind: 'clear' };
}

export interface DietRow {
  key: string;
  kind: 'allergy' | 'other' | 'unknown' | 'diet' | 'diabetic';
  value: string; // allergy or diet key ('seafood', 'softFood'), free text for 'other'
  icon: string;
  names: string[];
  n: number;
}
const DIET_ORDER: Record<DietRow['kind'], number> = { allergy: 0, other: 1, unknown: 2, diet: 3, diabetic: 4 };
/** Dietary needs the kitchen cooks for on a date: dietaryGroups() plus free-text "other" allergies, in screen order. */
export function dietaryRows(s: ClubState, date: ISODate): DietRow[] {
  const rows: DietRow[] = dietaryGroups(s, date).map((g) => {
    const [head, value = ''] = g.key.split(':');
    const kind: DietRow['kind'] = head === 'allergy' ? (value === 'unknown' ? 'unknown' : 'allergy') : head === 'diet' ? 'diet' : 'diabetic';
    return { key: g.key, kind, value, icon: g.icon, names: g.names, n: g.names.length };
  });
  const other = dinersOn(s, date).flatMap((d) => (d.type === 'member' && d.m.health.foodOther?.trim() ? [{ name: memberShort(d.m), text: d.m.health.foodOther.trim() }] : []));
  for (const o of other) {
    let r = rows.find((x) => x.key === 'allergy:other');
    if (!r) rows.push((r = { key: 'allergy:other', kind: 'other', value: '', icon: 'no_food', names: [], n: 0 }));
    r.names.push(`${o.name} (${o.text})`);
    r.n = r.names.length;
  }
  return sortBy(rows, (r) => String(DIET_ORDER[r.kind]) + r.key);
}

// ---------- menu editor ----------
export type WeekTemplate = Record<Weekday, MenuDay>;
export const emptyDay = (): MenuDay => ({ lunch: [], soft: [], tea: [] });
export const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The weekly template in force on a date (empty days when no version applies). */
export function templateOn(s: ClubState, date: ISODate): { version?: MenuVersion; days: WeekTemplate } {
  const version = menuVersionFor(s, date);
  const days = {} as WeekTemplate;
  for (const w of WEEKDAYS) {
    const d = version?.days[w];
    days[w] = { lunch: [...(d?.lunch ?? [])], soft: [...(d?.soft ?? [])], tea: [...(d?.tea ?? [])] };
  }
  return { version, days };
}
/** How many weeks ahead the menu can be planned. */
export const MAX_PLAN_WEEKS = 12;
/** The date of a weekday in the week that starts on `monday`. */
export const weekDate = (monday: ISODate, w: Weekday): ISODate => addDays(monday, w - 1);
/**
 * The weekly menu as it is served in the week starting `monday`: each weekday follows the version in force on that day (so a version that
 * starts midweek shows from its first day). A day that has already passed follows the version in force today, because a change published now
 * cannot reach it: it is the template for next week's same weekday.
 */
export function templateForWeek(s: ClubState, monday: ISODate, today: ISODate): WeekTemplate {
  const days = {} as WeekTemplate;
  for (const w of WEEKDAYS) { const day = weekDate(monday, w); days[w] = templateOn(s, day < today ? today : day).days[w]; }
  return days;
}
/**
 * When a menu planned for the week starting `monday` takes effect: that Monday. The current week (its Monday has passed) can only start today.
 * A weekly menu is a template that repeats every week from its start date until another one starts, so a plan for a future week begins on
 * its Monday and carries on after it.
 */
export const planStartFor = (monday: ISODate, today: ISODate): ISODate => (monday > today ? monday : today);

/** Family contacts (user ids) who are told about the club's menu: approved links with app access to members active on `date`. */
export function menuAudience(s: ClubState, date: ISODate): string[] {
  const active = new Set(activeMembers(s, date).map((m) => m.id));
  return uniq(live(s.familyLinks).filter((l) => active.has(l.memberId) && l.appAccess && !isPendingRow(l)).map((l) => l.familyId));
}

/** Published weekly versions that start after `date` (scheduled, not in force yet). */
export const scheduledVersions = (s: ClubState, date: ISODate): MenuVersion[] =>
  sortBy(live(s.menuVersions).filter((v) => v.status === 'published' && v.effectiveFrom > date), (v) => v.effectiveFrom);

export interface MenuChange { weekday: Weekday; course: Course; added: string[]; removed: string[] }
/** What differs between two templates, as dish ids per weekday and course. */
export function diffTemplates(a: WeekTemplate, b: WeekTemplate): MenuChange[] {
  const out: MenuChange[] = [];
  for (const w of WEEKDAYS) for (const c of COURSES) {
    const x = a[w]?.[c] ?? [], y = b[w]?.[c] ?? [];
    const added = y.filter((id) => !x.includes(id)), removed = x.filter((id) => !y.includes(id));
    if (added.length || removed.length) out.push({ weekday: w, course: c, added, removed });
  }
  return out;
}

export interface MenuOverride { date: ISODate; lunch?: string[]; soft?: string[]; tea?: string[] }
/** Per-date overrides from a date onward (today and later), soonest first. */
export function overridesFrom(s: ClubState, from: ISODate): MenuOverride[] {
  return sortBy(
    Object.values(s.dayMenus).filter((o) => !o.deletedAt && o.date >= from && (o.lunch || o.soft || o.tea)).map((o) => ({ date: o.date, lunch: o.lunch, soft: o.soft, tea: o.tea })),
    (o) => o.date,
  );
}

export interface DishUse { where: 'template' | 'scheduled' | 'override'; course: Course; weekday?: Weekday; date?: ISODate }
/** Where a dish is still on the menu from `today` onward (the version in force, later versions and per-date overrides). */
export function dishUsage(s: ClubState, dishId: string, today: ISODate): DishUse[] {
  const out: DishUse[] = [];
  const inForce = menuVersionFor(s, today);
  const later = scheduledVersions(s, today);
  for (const v of [...(inForce ? [inForce] : []), ...later]) {
    for (const w of WEEKDAYS) for (const c of COURSES) if (v.days[w]?.[c]?.includes(dishId)) out.push({ where: v === inForce ? 'template' : 'scheduled', course: c, weekday: w });
  }
  for (const o of overridesFrom(s, today)) for (const c of COURSES) if (o[c]?.includes(dishId)) out.push({ where: 'override', course: c, date: o.date });
  return out;
}

export const dishesByCourse = (s: ClubState, course?: Course): Dish[] =>
  sortBy(live(s.dishes).filter((x) => !course || x.course === course), (x) => x.name.toLocaleLowerCase());
export const weekdayOf = (date: ISODate) => dow(date) as Weekday;

// ---------- stock ----------
/** Who may approve, decline and (with the requester) receive a request: management, finance, and the F&B supervisor for kitchen-area items. */
export const isStockApprover = (u: User, k: Pick<StockRequest, 'area'>) =>
  u.kind === 'staff' && (u.staff.role === 'mgmt' || u.staff.role === 'finance' || (u.staff.supervisor && u.staff.role === 'kitchen' && k.area === 'kitchen'));
export const canRequestStock = (u: User) => u.kind === 'staff';
export const canEditStock = (u: User, k: Pick<StockRequest, 'status' | 'requestedBy'>) => u.kind === 'staff' && k.status === 'requested' && k.requestedBy === u.id;
export const canApproveStock = (u: User, k: Pick<StockRequest, 'status' | 'area'>) => k.status === 'requested' && isStockApprover(u, k);
export const canReceiveStock = (u: User, k: Pick<StockRequest, 'status' | 'area' | 'requestedBy'>) => k.status === 'approved' && u.kind === 'staff' && (k.requestedBy === u.id || isStockApprover(u, k));

const STOCK_ORDER: Record<StockRequest['status'], number> = { requested: 0, approved: 1, received: 2, rejected: 3, cancelled: 4 };
/** Requested, approved, received, then declined and cancelled; newest first within each. */
export const sortStock = (rows: StockRequest[]) => sortBy(sortBy(rows, (k) => k.createdAt, -1), (k) => STOCK_ORDER[k.status]);
/** Default budget section for a stock area (fnb, activities, operations when they exist; else the first section). */
export function defaultSectionFor(s: ClubState, area: StockRequest['area']): string | undefined {
  const want = area === 'kitchen' ? ['fnb'] : area === 'activities' ? ['activities'] : ['operations'];
  const secs = live(s.budgetSections);
  return (secs.find((x) => want.includes(x.id)) ?? sortBy(secs, (x) => x.createdAt)[0])?.id;
}
/** The role a staff member belongs to for choosing the stock area they most likely request for. */
export function defaultAreaFor(role: string | null | undefined): StockRequest['area'] {
  return ({ kitchen: 'kitchen', nurse: 'health', activity: 'activities', housekeeping: 'housekeeping', lobby: 'housekeeping', driver: 'transport' } as Record<string, StockRequest['area']>)[role || ''] ?? 'kitchen';
}

// ---------- feedback ----------
export const FEEDBACK_ORDER: Record<Feedback['status'], number> = { open: 0, answered: 1, closed: 2 };
export const feedbackThread = (s: ClubState, fb: Feedback): Message[] =>
  fb.threadId ? sortBy(live(s.messages).filter((m) => m.threadId === fb.threadId), (m) => m.seq) : [];
/** Open first, then newest meal date, then newest first. */
export const sortFeedback = (rows: Feedback[]) => sortBy(sortBy(sortBy(rows, (f) => f.createdAt, -1), (f) => f.mealDate, -1), (f) => FEEDBACK_ORDER[f.status]);
/** The family contact who receives a reply: the one who wrote, else the member's first contact with app access (primary first). */
export function replyTarget(s: ClubState, fb: Pick<Feedback, 'familyId' | 'memberId'>): string | undefined {
  if (fb.familyId) return fb.familyId;
  return contactsOfMember(s, fb.memberId).find((x) => x.link.appAccess && !isPendingRow(x.link))?.contact.id;
}
