// Kitchen actions: dishes and allergens, weekly menu and per-date overrides, lunch photos, allergy plans,
// meal feedback (family and staff), and stock requests. Pure immer recipes; permissions follow the plan's table.
//
// Lunch photos: a day can hold several (DayMenu.photoIds). Management's go live at once; the kitchen's wait as 'pending' until management
// approves them in Reviews (photo.approve calls announceLunchPhoto for them). Notification kinds and feed keys live in the `kitchen`
// i18n namespace (kitchen.notif.*, kitchen.feed.*).
import type { Draft } from 'immer';
import type { ClubState, Dish, DishAllergen, Feedback, ISODate, MenuDay, StockRequest, User, Weekday } from '../types';
import { DomainError, defineAction, hasRole, isStaff, type ActionDef, type Ctx } from './framework';
import { familyUserIds, postMessage, requireMember, shortOf } from './helpers';
import { dayStatus } from '../rules/core';
import { ALLERGY_COVERS, MAX_LUNCH_PHOTOS, dinersOn } from '../rules/kitchen';
import {
  COURSES, DISH_ALLERGENS, DISH_TAGS, STOCK_AREAS, WEEKDAYS, type Course, type PersonKey,
  canApproveStock, canEditStock, canReceiveStock, canRequestStock, diffTemplates, dishUsage, menuAudience, potentialConflicts, replyTarget, sameIds, templateOn,
} from '../rules/kitchenOps';
import { dow, live, uniq } from '../util';

const asState = (d: Draft<ClubState>) => d as unknown as ClubState;
const kitchenOrMgmt = (u: User) => hasRole(u, 'kitchen', 'mgmt');

// ---------- input parsing (throws err.invalid) ----------
type Raw = Record<string, unknown>;
function bad(): never { throw new DomainError('err.invalid'); }
const rec = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : bad());
/** One line of text, whitespace collapsed. */
const line = (v: unknown, max: number, required = true): string => {
  if (v === undefined || v === null || v === '') return required ? bad() : '';
  if (typeof v !== 'string') return bad();
  const t = v.trim().replace(/\s+/g, ' ');
  if ((required && !t) || t.length > max) return bad();
  return t;
};
/** Free text (newlines kept). */
const para = (v: unknown, max: number): string => {
  if (typeof v !== 'string') return bad();
  const t = v.trim();
  if (!t || t.length > max) return bad();
  return t;
};
const isoDate = (v: unknown): ISODate => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) ? v : bad());
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T => (list.includes(v as T) ? (v as T) : bad());
const listOf = <T extends string>(v: unknown, list: readonly T[]): T[] => (Array.isArray(v) ? uniq((v as unknown[]).map((x) => oneOf(x, list))) : bad());
const idList = (v: unknown): string[] => (Array.isArray(v) && v.length <= 24 && v.every((x) => typeof x === 'string' && x.length > 0 && x.length < 80) ? uniq(v as string[]) : bad());
const optIdList = (v: unknown): string[] | null | undefined => (v === undefined ? undefined : v === null ? null : idList(v));
const posNumber = (v: unknown, max: number): number => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : bad();
};
/** An optional yes/no that defaults to `def` when left out. */
const optBool = (v: unknown, def: boolean): boolean => (v === undefined || v === null ? def : typeof v === 'boolean' ? v : bad());
/** The id of an uploaded picture (POST /api/media). */
const mediaIdOf = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : typeof v === 'string' && /^[\w.-]{1,80}$/.test(v) ? v : bad());
const personKey = (v: unknown): PersonKey => (typeof v === 'string' && /^(member|guest):[\w-]{1,60}$/.test(v) ? (v as PersonKey) : bad());
const parseDays = (v: unknown): Record<Weekday, MenuDay> => {
  const r = rec(v);
  const out = {} as Record<Weekday, MenuDay>;
  for (const w of WEEKDAYS) {
    const x = rec(r[w] ?? {});
    out[w] = { lunch: idList(x.lunch ?? []), soft: idList(x.soft ?? []), tea: idList(x.tea ?? []) };
  }
  return out;
};

// ---------- shared checks ----------
function checkDishes(d: Draft<ClubState>, ids: string[], course: Course, ctx: Ctx) {
  for (const id of ids) {
    const x = d.dishes[id];
    if (!x || x.deletedAt || x.course !== course) ctx.fail('kitchen.err.badDish', { id });
  }
}
function ensureDayMenu(d: Draft<ClubState>, date: ISODate, ctx: Ctx) {
  if (!d.dayMenus[date]) d.dayMenus[date] = { id: date, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date, allergyPlans: [] };
  return d.dayMenus[date];
}
/** A day's row with nothing left in it (no override, no lunch photo, no allergy plan) is dropped. */
const isEmptyDay = (row: Draft<ClubState>['dayMenus'][string]) => !row.lunch && !row.soft && !row.tea && !row.photoIds?.length && !row.allergyPlans.length;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

// ---------- dishes ----------
interface DishInput { id?: string; name: string; course: Course; allergens: DishAllergen[]; tags: Dish['tags']; reviewed: boolean }

const dishActions: ActionDef[] = [
  defineAction<DishInput>({
    name: 'dish.upsert',
    can: (u) => kitchenOrMgmt(u),
    parse(raw) {
      const r = rec(raw);
      return { id: r.id === undefined || r.id === null ? undefined : line(r.id, 80), name: line(r.name, 60), course: oneOf(r.course, COURSES), allergens: listOf(r.allergens ?? [], DISH_ALLERGENS), tags: listOf(r.tags ?? [], DISH_TAGS), reviewed: r.reviewed === true };
    },
    run(d, i, ctx) {
      const dup = live(d.dishes as ClubState['dishes']).find((x) => x.id !== i.id && x.course === i.course && x.name.toLocaleLowerCase() === i.name.toLocaleLowerCase());
      if (dup) ctx.fail('kitchen.err.dishExists', { name: dup.name });
      if (i.id) {
        const row = d.dishes[i.id];
        if (!row || row.deletedAt) ctx.fail('err.notFound');
        if (row.course !== i.course && dishUsage(asState(d), row.id, ctx.today).length) ctx.fail('kitchen.err.dishInUse', { name: row.name });
        const allergensChanged = !sameSet(row.allergens, i.allergens);
        row.name = i.name;
        row.course = i.course;
        row.allergens = i.allergens;
        row.tags = i.tags;
        if (i.reviewed) { row.reviewedBy = ctx.user.id; row.reviewedAt = ctx.nowDT; }
        else if (allergensChanged) { delete row.reviewedBy; delete row.reviewedAt; } // new tags: nobody has confirmed them yet
        ctx.result.dishId = row.id;
      } else {
        const id = ctx.id('dish');
        d.dishes[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: i.name, course: i.course, allergens: i.allergens, tags: i.tags, ...(i.reviewed ? { reviewedBy: ctx.user.id, reviewedAt: ctx.nowDT } : {}) };
        ctx.result.dishId = id;
      }
    },
  }),
  defineAction<{ dishId: string }>({
    name: 'dish.delete',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => ({ dishId: line(rec(raw).dishId, 80) }),
    run(d, i, ctx) {
      const row = d.dishes[i.dishId];
      if (!row || row.deletedAt) ctx.fail('err.notFound');
      if (dishUsage(asState(d), row.id, ctx.today).length) ctx.fail('kitchen.err.dishInUse', { name: row.name });
      row.deletedAt = ctx.nowDT; // kept: past menus still resolve its name
    },
  }),
  defineAction<{ dishId: string }>({
    name: 'dish.reviewAllergens',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => ({ dishId: line(rec(raw).dishId, 80) }),
    run(d, i, ctx) {
      const row = d.dishes[i.dishId];
      if (!row || row.deletedAt) ctx.fail('err.notFound');
      row.reviewedBy = ctx.user.id;
      row.reviewedAt = ctx.nowDT;
    },
  }),
];

// ---------- lunch photo announcement ----------
/**
 * Tell the families of the members who had lunch that day ("the kitchen posted a photo of today's lunch"). Called when management posts a
 * photo, and by photo.approve when a pending lunch photo is approved. Each family hears it once a day, however many photos follow.
 * Nothing is sent for a photo from an earlier day (families only see today's lunch photos) or one that is not a visible lunch photo.
 */
export function announceLunchPhoto(d: Draft<ClubState>, ctx: Ctx, photoId: string): void {
  const p = d.photos[photoId];
  if (!p || p.deletedAt || p.kind !== 'lunch' || p.visibility !== 'visible' || p.date !== ctx.today) return;
  const told = new Set(Object.values(d.notifications).filter((n) => !n.deletedAt && n.kind === 'kitchen.notif.lunchPhoto' && n.createdAt.startsWith(p.date)).flatMap((n) => n.toUsers));
  const families = uniq(dinersOn(asState(d), p.date).flatMap((x) => (x.type === 'member' ? familyUserIds(d, x.id) : []))).filter((f) => !told.has(f));
  if (families.length) ctx.notify({ toUsers: families, kind: 'kitchen.notif.lunchPhoto', link: '/today', ref: { type: 'photo', id: p.id } });
}

// ---------- menu ----------
interface OverrideInput { date: ISODate; lunch?: string[] | null; soft?: string[] | null; tea?: string[] | null }

const menuActions: ActionDef[] = [
  // effectiveFrom: the Monday of a coming week, or today for the current one. The weekly menu is a template that repeats every week from its
  // start date until another one starts. notify (default on): tell the families of the active members that the menu changes.
  defineAction<{ effectiveFrom: ISODate; days: Record<Weekday, MenuDay>; notify: boolean }>({
    name: 'menu.publish',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => { const r = rec(raw); return { effectiveFrom: isoDate(r.effectiveFrom), days: parseDays(r.days), notify: optBool(r.notify, true) }; },
    run(d, i, ctx) {
      if (i.effectiveFrom < ctx.today) ctx.fail('kitchen.err.pastDate'); // published history never changes
      for (const w of WEEKDAYS) for (const c of COURSES) checkDishes(d, i.days[w][c], c, ctx);
      const st = asState(d);
      const replaced = live(st.menuVersions).filter((v) => v.status === 'published' && v.effectiveFrom >= i.effectiveFrom);
      if (!diffTemplates(templateOn(st, i.effectiveFrom).days, i.days).length && !replaced.some((v) => v.effectiveFrom > i.effectiveFrom)) ctx.fail('err.noChanges');
      // a version for the same date (or later ones) is replaced by this one; earlier versions stay as history
      for (const v of replaced) d.menuVersions[v.id].deletedAt = ctx.nowDT;
      const id = ctx.id('mv');
      d.menuVersions[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, effectiveFrom: i.effectiveFrom, status: 'published', days: i.days, publishedBy: ctx.actor };
      ctx.result.versionId = id;
      if (i.notify) {
        const families = menuAudience(st, i.effectiveFrom > ctx.today ? i.effectiveFrom : ctx.today);
        if (families.length) ctx.notify({ toUsers: families, kind: 'kitchen.notif.menuPublished', params: { date: i.effectiveFrom }, link: '/today' });
      }
      ctx.feed({ icon: 'restaurant_menu', key: 'kitchen.feed.menuPublished', params: { from: i.effectiveFrom } });
    },
  }),
  defineAction<OverrideInput>({
    name: 'dayMenu.override',
    can: (u) => kitchenOrMgmt(u),
    parse(raw) {
      const r = rec(raw);
      return { date: isoDate(r.date), lunch: optIdList(r.lunch), soft: optIdList(r.soft), tea: optIdList(r.tea) };
    },
    run(d, i, ctx) {
      if (i.date < ctx.today) ctx.fail('kitchen.err.pastDate');
      const st = asState(d);
      if (!dayStatus(st, i.date).open) ctx.fail('err.closedDay');
      const base = templateOn(st, i.date).days[dow(i.date) as Weekday];
      const row = ensureDayMenu(d, i.date, ctx);
      let changed = false;
      for (const c of COURSES) {
        const v = i[c];
        if (v === undefined) continue;
        if (v === null || sameIds(v, base[c])) { // back to the template: no phantom override
          if (row[c] !== undefined) { delete row[c]; changed = true; }
          continue;
        }
        checkDishes(d, v, c, ctx);
        if (!row[c] || !sameIds(row[c]!, v)) { row[c] = v; changed = true; }
      }
      if (!changed) ctx.fail('err.noChanges');
      if (isEmptyDay(row)) delete d.dayMenus[i.date];
      ctx.feed({ icon: 'restaurant_menu', key: 'kitchen.feed.menuChanged', params: { date: i.date } });
    },
  }),
  // Add a lunch photo to today's menu. mediaId: the uploaded camera picture (without it the design's placeholder shows).
  // Management's photo is visible at once and, with notify (default on), the families of today's diners are told. Anyone else's waits as 'pending'.
  defineAction<{ date: ISODate; mediaId?: string; notify: boolean }>({
    name: 'menu.postLunchPhoto',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => { const r = rec(raw); return { date: isoDate(r.date), mediaId: mediaIdOf(r.mediaId), notify: optBool(r.notify, true) }; },
    run(d, i, ctx) {
      if (i.date !== ctx.today) ctx.fail('kitchen.err.notToday');
      const st = asState(d);
      if (!dayStatus(st, i.date).open) ctx.fail('err.closedDay');
      const row = ensureDayMenu(d, i.date, ctx);
      const ids = (row.photoIds ??= []);
      if (ids.length >= MAX_LUNCH_PHOTOS) ctx.fail('kitchen.err.tooManyPhotos', { n: MAX_LUNCH_PHOTOS });
      const pid = ctx.id('p');
      const mgmt = ctx.role === 'mgmt';
      d.photos[pid] = {
        id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date: i.date, time: ctx.now, kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [],
        tone: (3 + ids.length) % 5, // the design's lunch placeholder; each one gets its own tone
        takenBy: ctx.user.id, visibility: mgmt ? 'visible' : 'pending', ...(mgmt ? { approved: { at: ctx.nowDT, by: ctx.user.id } } : {}), ...(i.mediaId ? { mediaId: i.mediaId } : {}),
      };
      ids.push(pid);
      ctx.result.photoId = pid;
      ctx.result.pending = !mgmt;
      if (mgmt) {
        if (i.notify) announceLunchPhoto(d, ctx, pid);
        ctx.feed({ icon: 'restaurant', key: 'kitchen.feed.lunchPhoto' });
      } else ctx.feed({ icon: 'hourglass_top', key: 'kitchen.feed.lunchPhotoPending' }); // management is asked in Reviews
    },
  }),
  // Take one of today's lunch photos away (a blurry one, or one that was posted by mistake). Kept as 'removed', never shown again.
  defineAction<{ photoId: string }>({
    name: 'menu.removeLunchPhoto',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => ({ photoId: line(rec(raw).photoId, 80) }),
    run(d, i, ctx: Ctx) { // explicit Ctx so ctx.fail() narrows
      const p = d.photos[i.photoId];
      if (!p || p.deletedAt || p.kind !== 'lunch' || p.visibility === 'removed') ctx.fail('err.notFound');
      if (p.date !== ctx.today) ctx.fail('kitchen.err.notToday');
      const row = d.dayMenus[p.date];
      const k = row?.photoIds ? row.photoIds.indexOf(p.id) : -1;
      if (!row || !row.photoIds || k < 0) ctx.fail('err.notFound');
      row.photoIds.splice(k, 1);
      if (!row.photoIds.length) delete row.photoIds;
      p.visibility = 'removed';
      p.moderated = { at: ctx.nowDT, by: ctx.user.id, reason: 'removed' };
      if (isEmptyDay(row)) delete d.dayMenus[p.date];
      ctx.feed({ icon: 'no_photography', key: 'kitchen.feed.lunchPhotoRemoved' });
    },
  }),
];

// ---------- allergy plans ----------
// "Alternative prepared": the kitchen's answer to a clash between a person's allergy and a dish. Allowed for anyone who could eat
// that day (checked in, a booked guest, or an active member on file), so it can be done ahead of time.
interface PlanInput { date: ISODate; person: PersonKey; dishId: string; alternative: string }

const planActions: ActionDef[] = [
  defineAction<PlanInput>({
    name: 'allergyPlan.set',
    can: (u) => kitchenOrMgmt(u),
    parse(raw) {
      const r = rec(raw);
      return { date: isoDate(r.date), person: personKey(r.person), dishId: line(r.dishId, 80), alternative: line(r.alternative, 80) };
    },
    run(d, i, ctx: Ctx) { // explicit Ctx so ctx.fail() narrows
      if (i.date < ctx.today) ctx.fail('kitchen.err.pastDate');
      const st = asState(d);
      // members drop in, so the alternative can be prepared before the person has checked in (or for a coming day's menu)
      const c = potentialConflicts(st, i.date).find((x) => x.person === i.person && x.dish.id === i.dishId);
      if (!c) ctx.fail('kitchen.err.noConflict');
      // an alternative that carries the same allergen is no alternative
      const named = live(st.dishes).find((x) => x.name.toLocaleLowerCase() === i.alternative.toLocaleLowerCase());
      if (named && (c.diner.food || []).some((a) => named.allergens.some((x) => ALLERGY_COVERS[a]?.includes(x)))) ctx.fail('kitchen.err.altConflicts', { dish: named.name });
      const row = ensureDayMenu(d, i.date, ctx);
      const plan = { person: i.person, dishId: i.dishId, alternative: i.alternative, by: ctx.user.id, at: ctx.nowDT };
      const k = row.allergyPlans.findIndex((x) => x.person === i.person && x.dishId === i.dishId);
      if (k >= 0 && row.allergyPlans[k].alternative === i.alternative) ctx.fail('err.noChanges');
      if (k >= 0) row.allergyPlans[k] = plan; else row.allergyPlans.push(plan);
      const memberId = c.diner.type === 'member' ? c.diner.id : undefined;
      // the update says "today", so only today's plans notify (also before the member has checked in); a coming day's plan shows on the family's Today page that day
      if (memberId && i.date === ctx.today) ctx.notify({ toUsers: familyUserIds(d, memberId), kind: 'kitchen.notif.alternative', params: { name: shortOf(d, memberId), dish: c.dish.name, alternative: i.alternative }, link: '/today', memberId });
      ctx.feed({ icon: 'no_food', key: 'kitchen.feed.alternative', params: { name: c.name, dish: c.dish.name, alternative: i.alternative }, memberId });
    },
  }),
  defineAction<{ date: ISODate; person: PersonKey; dishId: string }>({
    name: 'allergyPlan.clear',
    can: (u) => kitchenOrMgmt(u),
    parse(raw) { const r = rec(raw); return { date: isoDate(r.date), person: personKey(r.person), dishId: line(r.dishId, 80) }; },
    run(d, i, ctx) {
      if (i.date < ctx.today) ctx.fail('kitchen.err.pastDate');
      const row = d.dayMenus[i.date];
      const k = row ? row.allergyPlans.findIndex((x) => x.person === i.person && x.dishId === i.dishId) : -1;
      if (!row || k < 0) ctx.fail('err.notFound');
      row.allergyPlans.splice(k, 1);
      if (isEmptyDay(row)) delete d.dayMenus[i.date];
    },
  }),
];

// ---------- meal feedback ----------
interface FeedbackInput { memberId: string; mealDate: ISODate; dish: string; text: string }
const parseFeedback = (raw: unknown): FeedbackInput => {
  const r = rec(raw);
  return { memberId: line(r.memberId, 80), mealDate: isoDate(r.mealDate), dish: line(r.dish, 80, false), text: para(r.text, 1000) };
};
const feedbackRow = (d: Draft<ClubState>, id: string, ctx: Ctx) => {
  const f = d.feedback[id];
  if (!f || f.deletedAt) ctx.fail('err.notFound');
  return f;
};

const feedbackActions: ActionDef[] = [
  defineAction<FeedbackInput>({
    name: 'feedback.submit',
    can: (u, i) => u.kind === 'family' && u.memberIds.includes(i.memberId),
    parse: parseFeedback,
    run(d, i, ctx) {
      requireMember(d, i.memberId, ctx);
      if (i.mealDate > ctx.today) ctx.fail('kitchen.err.futureDate');
      const id = ctx.id('fb');
      d.feedback[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: i.memberId, familyId: ctx.user.id, mealDate: i.mealDate, dish: i.dish, text: i.text, status: 'open', source: 'family' };
      // the kitchen thread: the family's words are its first message, so replies land in the family's Messages
      const r = postMessage(d, ctx, { memberId: i.memberId, familyId: ctx.user.id, topic: 'kitchen', text: i.text, feedbackId: id, ref: { type: 'feedback', id } });
      d.feedback[id].threadId = r.threadId;
      ctx.notify({ toRoles: ['kitchen'], kind: 'kitchen.notif.feedbackNew', params: { name: shortOf(d, i.memberId), dish: i.dish }, link: '/feedback', memberId: i.memberId, ref: { type: 'feedback', id } });
      ctx.feed({ icon: 'forum', key: 'kitchen.feed.feedback', params: { name: shortOf(d, i.memberId), dish: i.dish }, memberId: i.memberId });
      ctx.result.feedbackId = id;
    },
  }),
  defineAction<FeedbackInput>({
    name: 'feedback.log',
    can: (u) => isStaff(u),
    parse: parseFeedback,
    run(d, i, ctx) {
      requireMember(d, i.memberId, ctx);
      if (i.mealDate > ctx.today) ctx.fail('kitchen.err.futureDate');
      const id = ctx.id('fb');
      d.feedback[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: i.memberId, familyId: null, mealDate: i.mealDate, dish: i.dish, text: i.text, status: 'open', source: 'staff' };
      if (ctx.role !== 'kitchen') ctx.notify({ toRoles: ['kitchen'], kind: 'kitchen.notif.feedbackNew', params: { name: shortOf(d, i.memberId), dish: i.dish }, link: '/feedback', memberId: i.memberId, ref: { type: 'feedback', id } });
      ctx.feed({ icon: 'call', key: 'kitchen.feed.feedbackLogged', params: { name: shortOf(d, i.memberId), dish: i.dish }, memberId: i.memberId });
      ctx.result.feedbackId = id;
    },
  }),
  defineAction<{ feedbackId: string; text: string }>({
    name: 'feedback.reply',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => { const r = rec(raw); return { feedbackId: line(r.feedbackId, 80), text: para(r.text, 1000) }; },
    run(d, i, ctx: Ctx) {
      const fb = feedbackRow(d, i.feedbackId, ctx);
      if (fb.status === 'closed') ctx.fail('kitchen.err.feedbackClosed');
      const familyId = replyTarget(asState(d), fb);
      if (!familyId) ctx.fail('kitchen.err.noFamilyApp');
      // answering again (an edited reply) adds a new message; the earlier one stays in the thread
      const r = postMessage(d, ctx, { memberId: fb.memberId, familyId, topic: 'kitchen', text: i.text, feedbackId: fb.id, ref: { type: 'feedback', id: fb.id } });
      fb.threadId = r.threadId;
      fb.status = 'answered';
      ctx.notify({ toUsers: [familyId], kind: 'kitchen.notif.feedbackReply', params: { name: shortOf(d, fb.memberId), dish: fb.dish }, link: '/chat', memberId: fb.memberId, ref: { type: 'feedback', id: fb.id } });
      ctx.feed({ icon: 'reply', key: 'kitchen.feed.feedbackReply', params: { name: shortOf(d, fb.memberId), dish: fb.dish }, memberId: fb.memberId });
    },
  }),
  defineAction<{ feedbackId: string; status: Feedback['status'] }>({
    name: 'feedback.setStatus',
    can: (u) => kitchenOrMgmt(u),
    parse: (raw) => { const r = rec(raw); return { feedbackId: line(r.feedbackId, 80), status: oneOf(r.status, ['open', 'answered', 'closed'] as const) }; },
    run(d, i, ctx) {
      const fb = feedbackRow(d, i.feedbackId, ctx);
      if (fb.status === i.status) ctx.fail('err.noChanges');
      fb.status = i.status;
    },
  }),
];

// ---------- stock ----------
interface StockInput { item: string; qty: number; unit: string; area: StockRequest['area']; sectionId: string }
interface StockEdit { id: string; item?: string; qty?: number; unit?: string; area?: StockRequest['area']; sectionId?: string }

const stockRow = (d: Draft<ClubState>, id: string, ctx: Ctx) => {
  const k = d.stockRequests[id];
  if (!k || k.deletedAt) ctx.fail('err.notFound');
  return k;
};
const stockParts = (r: Raw) => ({ item: line(r.item, 80), qty: posNumber(r.qty, 100000), unit: line(r.unit, 24), area: oneOf(r.area, STOCK_AREAS), sectionId: line(r.sectionId, 60) });
const requesterLink = (d: Draft<ClubState>, k: StockRequest) => (['kitchen', 'mgmt'].includes(d.staff[k.requestedBy]?.role ?? '') ? '/stock' : '/requests');

const stockActions: ActionDef[] = [
  defineAction<StockInput>({
    name: 'stock.request',
    can: (u) => canRequestStock(u),
    parse: (raw) => stockParts(rec(raw)),
    run(d, i, ctx) {
      const sec = d.budgetSections[i.sectionId];
      if (!sec || sec.deletedAt) ctx.fail('kitchen.err.noSection');
      const id = ctx.id('k');
      // finance and management requests wait for approval like everyone else's
      d.stockRequests[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, item: i.item, qty: i.qty, unit: i.unit, area: i.area, sectionId: i.sectionId, status: 'requested', requestedBy: ctx.user.id };
      ctx.result.stockId = id;
      ctx.feed({ icon: 'inventory_2', key: 'kitchen.feed.stockRequested', params: { item: i.item, qty: `${i.qty} ${i.unit}` } });
    },
  }),
  defineAction<StockEdit>({
    name: 'stock.edit',
    can: (u, i, s) => { const k = s.stockRequests[i.id]; return !k || canEditStock(u, { status: 'requested', requestedBy: k.requestedBy }); },
    parse(raw) {
      const r = rec(raw);
      return {
        id: line(r.id, 80),
        item: r.item === undefined ? undefined : line(r.item, 80), qty: r.qty === undefined ? undefined : posNumber(r.qty, 100000), unit: r.unit === undefined ? undefined : line(r.unit, 24),
        area: r.area === undefined ? undefined : oneOf(r.area, STOCK_AREAS), sectionId: r.sectionId === undefined ? undefined : line(r.sectionId, 60),
      };
    },
    run(d, i, ctx) {
      const k = stockRow(d, i.id, ctx);
      if (k.status !== 'requested') ctx.fail('kitchen.err.stockLocked');
      if (i.sectionId !== undefined) { const sec = d.budgetSections[i.sectionId]; if (!sec || sec.deletedAt) ctx.fail('kitchen.err.noSection'); }
      let changed = false;
      for (const f of ['item', 'qty', 'unit', 'area', 'sectionId'] as const) {
        const v = i[f];
        if (v !== undefined && k[f] !== v) { (k as Record<string, unknown>)[f] = v; changed = true; }
      }
      if (!changed) ctx.fail('err.noChanges');
    },
  }),
  defineAction<{ id: string }>({
    name: 'stock.cancel',
    can: (u, i, s) => { const k = s.stockRequests[i.id]; return !k || canEditStock(u, { status: 'requested', requestedBy: k.requestedBy }); },
    parse: (raw) => ({ id: line(rec(raw).id, 80) }),
    run(d, i, ctx) {
      const k = stockRow(d, i.id, ctx);
      if (k.status !== 'requested') ctx.fail('kitchen.err.stockLocked');
      k.status = 'cancelled'; // kept in the list as Cancelled
    },
  }),
  defineAction<{ id: string }>({
    name: 'stock.approve',
    can: (u, i, s) => { const k = s.stockRequests[i.id]; return !k || canApproveStock(u, { status: 'requested', area: k.area }); },
    parse: (raw) => ({ id: line(rec(raw).id, 80) }),
    run(d, i, ctx) {
      const k = stockRow(d, i.id, ctx);
      if (k.status !== 'requested') ctx.fail('kitchen.err.alreadyDecided');
      k.status = 'approved';
      k.decidedBy = ctx.actor;
      k.decidedAt = ctx.nowDT;
      ctx.notify({ toUsers: [k.requestedBy], kind: 'kitchen.notif.stockApproved', params: { item: k.item, qty: `${k.qty} ${k.unit}` }, link: requesterLink(d, k), ref: { type: 'stockRequest', id: k.id } });
      ctx.feed({ icon: 'task_alt', key: 'kitchen.feed.stockApproved', params: { item: k.item } });
    },
  }),
  defineAction<{ id: string; note: string }>({
    name: 'stock.reject',
    can: (u, i, s) => { const k = s.stockRequests[i.id]; return !k || canApproveStock(u, { status: 'requested', area: k.area }); },
    parse: (raw) => {
      const r = rec(raw);
      if (typeof r.note !== 'string' || !r.note.trim()) throw new DomainError('err.noteRequired'); // a decline always says why
      return { id: line(r.id, 80), note: para(r.note, 240) };
    },
    run(d, i, ctx) {
      const k = stockRow(d, i.id, ctx);
      if (k.status !== 'requested') ctx.fail('kitchen.err.alreadyDecided');
      k.status = 'rejected'; // kept as Declined, with the reason
      k.decidedBy = ctx.actor;
      k.decidedAt = ctx.nowDT;
      k.note = i.note;
      ctx.notify({ toUsers: [k.requestedBy], kind: 'kitchen.notif.stockDeclined', params: { item: k.item, note: i.note }, link: requesterLink(d, k), severity: 'attention', ref: { type: 'stockRequest', id: k.id } });
      ctx.feed({ icon: 'block', key: 'kitchen.feed.stockDeclined', params: { item: k.item } });
    },
  }),
  defineAction<{ id: string }>({
    name: 'stock.receive',
    can: (u, i, s) => { const k = s.stockRequests[i.id]; return !k || canReceiveStock(u, { status: 'approved', area: k.area, requestedBy: k.requestedBy }); },
    parse: (raw) => ({ id: line(rec(raw).id, 80) }),
    run(d, i, ctx) {
      const k = stockRow(d, i.id, ctx);
      if (k.status !== 'approved') ctx.fail('kitchen.err.notApproved');
      k.status = 'received';
      k.receivedBy = ctx.actor;
      ctx.feed({ icon: 'inventory', key: 'kitchen.feed.stockReceived', params: { item: k.item } });
    },
  }),
];

export const kitchenActions: ActionDef[] = [...dishActions, ...menuActions, ...planActions, ...feedbackActions, ...stockActions] as ActionDef[];
