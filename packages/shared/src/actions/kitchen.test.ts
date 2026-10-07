// Kitchen actions: dishes and allergens, conflicts and plans, menu versions, lunch photo, feedback flow, stock permissions and statuses.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, getAction, actionItems, updatesFor, unreadUpdates, lunchSafety, menuOn, projectForFamily, familyThreads, familyUnread, staffUnreadCount, live, type ClubState } from '../index';
import { defineAction, registerActions } from './framework';
import { announceLunchPhoto } from './kitchen';
import { MAX_LUNCH_PHOTOS, lunchPhotosOn, visibleLunchPhotos } from '../rules/kitchen';
import {
  allergiesOnFile, canApproveStock, canReceiveStock, coversOn, dietaryRows, dishUsage, kitchenConflicts, menuDishesOn, potentialConflicts, safetyOf, sortStock, templateOn, unknownAllergyGuests, unreviewedDishesOn,
} from '../rules/kitchenOps';

const T = '2026-10-21'; // Wednesday: fish soup on the menu
const clock = { today: T, nowMin: 600 };
let n = 0;
const seed = () => buildSeed().citra;
const usr = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, c: { today: string; nowMin: number } = clock) => execute(s, name, input, usr(s, uid), c, 'm' + ++n);
/** management approves what the kitchen published or changed (families see and hear about it only then) */
const approveMenu = (s: ClubState, ids: string[]) => run(s, 'approval.approve', { type: 'menu', ids }, 's9');
const thursdayLunch = (s: ClubState) => templateOn(s, T).days[4].lunch;
const familyOf = (s: ClubState, memberId: string) => live(s.familyLinks).filter((l) => l.memberId === memberId && l.appAccess).map((l) => l.familyId).sort();

describe('dishes', () => {
  it('kitchen and management manage dishes; others cannot', () => {
    const s = seed();
    const r = run(s, 'dish.upsert', { name: 'Ayam kukus', course: 'lunch', allergens: [], tags: ['soft'] }, 's3');
    const id = r.result.dishId as string;
    expect(r.state.dishes[id]).toMatchObject({ name: 'Ayam kukus', course: 'lunch', allergens: [], tags: ['soft'], createdBy: 'staff:s3' });
    expect(r.state.dishes[id].reviewedAt).toBeUndefined(); // nobody has confirmed its allergens yet
    expect(() => run(s, 'dish.upsert', { name: 'X', course: 'lunch', allergens: [], tags: [] }, 's1')).toThrow('err.forbidden');
    expect(() => run(s, 'dish.upsert', { name: 'X', course: 'lunch', allergens: [], tags: [] }, 'f1')).toThrow('err.forbidden');
    const byMgmt = run(s, 'dish.upsert', { name: 'Ayam kukus', course: 'lunch', allergens: [], tags: [] }, 's9');
    expect(byMgmt.state.dishes[byMgmt.result.dishId as string]).toMatchObject({ name: 'Ayam kukus', createdBy: 'staff:s9' });
  });
  it('validates input and refuses duplicates within a course', () => {
    const s = seed();
    expect(() => run(s, 'dish.upsert', { name: '  ', course: 'lunch', allergens: [], tags: [] }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'dish.upsert', { name: 'Tahu', course: 'dinner', allergens: [], tags: [] }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'dish.upsert', { name: 'Tahu', course: 'lunch', allergens: ['lactose'], tags: [] }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'dish.upsert', { name: 'sop IKAN kakap', course: 'lunch', allergens: [], tags: [] }, 's3')).toThrow('kitchen.err.dishExists');
    // same name in another course is a different dish
    expect(run(s, 'dish.upsert', { name: 'Sop ikan kakap', course: 'tea', allergens: [], tags: [] }, 's3').state.dishes).toBeDefined();
  });
  it('confirming allergens records who and when; changing the tags asks for a new confirmation', () => {
    const s = seed();
    const fresh = run(s, 'dish.upsert', { name: 'Ayam kukus', course: 'lunch', allergens: [], tags: [] }, 's3');
    const id = fresh.result.dishId as string;
    const ok = run(fresh.state, 'dish.reviewAllergens', { dishId: id }, 's2');
    expect(ok.state.dishes[id]).toMatchObject({ reviewedBy: 's2', reviewedAt: `${T}T10:00` });
    // editing the allergens clears the confirmation unless the editor confirms in the same save
    const edited = run(ok.state, 'dish.upsert', { id, name: 'Ayam kukus', course: 'lunch', allergens: ['soy'], tags: [] }, 's3');
    expect(edited.state.dishes[id].allergens).toEqual(['soy']);
    expect(edited.state.dishes[id].reviewedAt).toBeUndefined();
    const confirmed = run(ok.state, 'dish.upsert', { id, name: 'Ayam kukus', course: 'lunch', allergens: ['soy'], tags: [], reviewed: true }, 's3');
    expect(confirmed.state.dishes[id]).toMatchObject({ reviewedBy: 's3', reviewedAt: `${T}T10:00` });
    // renaming alone keeps it
    expect(run(ok.state, 'dish.upsert', { id, name: 'Ayam kukus 2', course: 'lunch', allergens: [], tags: [] }, 's3').state.dishes[id].reviewedAt).toBe(`${T}T10:00`);
    expect(() => run(s, 'dish.reviewAllergens', { dishId: 'nope' }, 's3')).toThrow('err.notFound');
    expect(() => run(ok.state, 'dish.reviewAllergens', { dishId: id }, 's1')).toThrow('err.forbidden');
  });
  it('an unchecked dish on today\'s menu means families are not told the menu is clear', () => {
    const s = seed();
    expect(safetyOf(s, 'm1', T)).toEqual({ kind: 'clear' });
    const r = run(s, 'dish.upsert', { id: 'dish-pepaya', name: 'Pepaya', course: 'lunch', allergens: ['gluten'], tags: ['vegetarian'] }, 's3');
    expect(unreviewedDishesOn(r.state, T).map((x) => x.name)).toEqual(['Pepaya']);
    expect(safetyOf(r.state, 'm1', T)).toEqual({ kind: 'unreviewed', dishes: ['Pepaya'] });
    expect(safetyOf(r.state, 'm46', T)).toEqual({ kind: 'none' }); // no food allergies on file
  });
  it('a dish still on the menu cannot be deleted or moved to another course; an unused one is soft-deleted', () => {
    const s = seed();
    expect(dishUsage(s, 'dish-sop-ikan', T).some((u) => u.where === 'template' && u.weekday === 3)).toBe(true);
    expect(() => run(s, 'dish.delete', { dishId: 'dish-sop-ikan' }, 's3')).toThrow('kitchen.err.dishInUse');
    expect(() => run(s, 'dish.upsert', { id: 'dish-sop-ikan', name: 'Sop ikan kakap', course: 'tea', allergens: ['fish'], tags: [] }, 's3')).toThrow('kitchen.err.dishInUse');
    const made = run(s, 'dish.upsert', { name: 'Ayam kukus', course: 'lunch', allergens: [], tags: [] }, 's3');
    const id = made.result.dishId as string;
    const gone = run(made.state, 'dish.delete', { dishId: id }, 's3');
    expect(gone.state.dishes[id].deletedAt).toBe(`${T}T10:00`); // kept, so past menus still resolve it
    expect(live(gone.state.dishes).some((x) => x.id === id)).toBe(false);
    expect(() => run(gone.state, 'dish.delete', { dishId: id }, 's3')).toThrow('err.notFound');
  });
});

describe('covers and dietary needs', () => {
  const checkIn = (st: ClubState, memberId: string) => run(st, 'attendance.checkIn', { memberId, method: 'manual' }, 's1').state;
  it('covers are the members checked in so far plus the booked guests, and grow as people arrive', () => {
    const s = seed();
    expect(coversOn(s, T)).toEqual({ total: 4, members: 3, guests: 1 }); // Hendra, Tjahjadi and Bambang are in, plus the trial guest
    const noShow = produce(s, (d) => { d.guestVisits['g-e1'].status = 'noShow'; });
    expect(coversOn(noShow, T)).toEqual({ total: 3, members: 3, guests: 0 });
    const visitLunch = produce(s, (d) => { d.guestVisits['g-e2'].lunch = true; });
    expect(coversOn(visitLunch, T).total).toBe(5);
    // Oma Lina drops in: one more cover, the same guest
    const arrived = checkIn(s, 'm1');
    expect(coversOn(arrived, T)).toEqual({ total: 5, members: 4, guests: 1 });
    // leaving after lunch does not take her out of the covers
    const gone = run(arrived, 'attendance.checkOut', { memberId: 'm1' }, 's1').state;
    expect(coversOn(gone, T).total).toBe(5);
    // a day nobody has checked in on has no covers
    expect(coversOn(s, '2026-10-22')).toEqual({ total: 0, members: 0, guests: 0 });
  });
  it('groups the needs of whoever is here; unknown guests and free-text allergies get their own rows; late arrivals join live', () => {
    const s = produce(seed(), (d) => { d.guestVisits['g-e2'].lunch = true; d.members.m10.health.foodOther = 'mushrooms'; });
    const rows = dietaryRows(s, T);
    expect(rows.map((r) => r.key)).toEqual(['allergy:seafood', 'allergy:shellfish', 'allergy:other', 'allergy:unknown', 'diet:lowSalt', 'diet:softFood', 'diabetic']);
    expect(rows.find((r) => r.key === 'allergy:seafood')).toMatchObject({ n: 1, names: ['Bapak Bambang'] });
    expect(rows.find((r) => r.key === 'allergy:shellfish')).toMatchObject({ n: 1, names: ['Oma Siu Lan Tjandra'] }); // Oma Lina has not arrived
    expect(rows.find((r) => r.key === 'allergy:other')!.names).toEqual(['Bapak Bambang (mushrooms)']);
    expect(rows.find((r) => r.key === 'allergy:unknown')).toMatchObject({ kind: 'unknown', names: ['Bapak Yusuf Hamid'] });
    expect(rows.find((r) => r.key === 'diabetic')).toMatchObject({ icon: 'water_drop', names: ['Opa Tjahjadi'] });
    expect(rows.find((r) => r.key === 'diet:lowSalt')!.names).toEqual(['Opa Hendra']);
    // Oma Lina (shellfish) and Opa Budi (low salt) check in: they join their rows
    const later = checkIn(checkIn(s, 'm1'), 'm46');
    expect(dietaryRows(later, T).find((r) => r.key === 'allergy:shellfish')).toMatchObject({ n: 2, names: ['Oma Lina', 'Oma Siu Lan Tjandra'] });
    expect(dietaryRows(later, T).find((r) => r.key === 'diet:lowSalt')!.names).toEqual(['Opa Budi', 'Opa Hendra']);
  });
});

describe('allergy conflicts and plans', () => {
  const plan = { date: T, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' };
  it('Bambang (seafood) clashes with the fish soup: seafood covers fish; Lina (shellfish) is clear', () => {
    const c = kitchenConflicts(seed(), T);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ person: 'member:m10', name: 'Bapak Bambang', allergy: 'seafood', allergen: 'fish', resolved: false });
    expect(c[0].dish.name).toBe('Sop ikan kakap');
    expect(safetyOf(seed(), 'm10', T)).toEqual({ kind: 'pending', dishes: ['Sop ikan kakap'] });
    expect(lunchSafety(seed(), 'm10', T).kind).toBe('unknown'); // the shared rule cannot tell "pending" from "unchecked"
  });
  it('a soft-food diner with a fish allergy clashes with the soft option instead', () => {
    const s = produce(seed(), (d) => { d.members.m10.health.diet = ['softFood']; });
    expect(kitchenConflicts(s, T).map((x) => x.dish.id)).toEqual(['dish-bubur-ikan']);
  });
  it('"Alternative prepared" resolves the conflict, tells the family and clears the kitchen\'s needs-action item', () => {
    const s = seed();
    const chef = usr(s, 's3');
    expect(actionItems(s, chef, T, 600).some((i) => i.kind === 'notif.act.allergen')).toBe(true);
    const r = run(s, 'allergyPlan.set', plan, 's3');
    expect(r.state.dayMenus[T].allergyPlans).toEqual([{ person: plan.person, dishId: plan.dishId, alternative: plan.alternative, by: 's3', at: `${T}T10:00` }]);
    expect(kitchenConflicts(r.state, T)[0]).toMatchObject({ resolved: true, plan: { alternative: 'Ayam kukus', by: 's3' } });
    expect(safetyOf(r.state, 'm10', T)).toEqual({ kind: 'alternative', items: [{ dish: 'Sop ikan kakap', alternative: 'Ayam kukus' }] });
    expect(lunchSafety(r.state, 'm10', T)).toMatchObject({ kind: 'alternative', alternative: 'Ayam kukus' });
    expect(actionItems(r.state, usr(r.state, 's3'), T, 600).some((i) => i.kind === 'notif.act.allergen')).toBe(false);
    const laras = usr(r.state, 'fm10_0');
    const note = unreadUpdates(r.state, laras).find((x) => x.kind === 'kitchen.notif.alternative');
    expect(note).toMatchObject({ params: { name: 'Bapak Bambang', dish: 'Sop ikan kakap', alternative: 'Ayam kukus' }, link: '/today', memberId: 'm10' });
    expect(unreadUpdates(r.state, usr(r.state, 'f1')).some((x) => x.kind === 'kitchen.notif.alternative')).toBe(false);
    expect(Object.values(r.state.activity).some((a) => a.key === 'kitchen.feed.alternative' && a.memberId === 'm10')).toBe(true);
  });
  it('changing the alternative replaces the plan; clearing brings the conflict back', () => {
    const s = seed();
    const a = run(s, 'allergyPlan.set', plan, 's3');
    expect(() => run(a.state, 'allergyPlan.set', plan, 's3')).toThrow('err.noChanges');
    const b = run(a.state, 'allergyPlan.set', { ...plan, alternative: 'Telur dadar' }, 's2');
    expect(b.state.dayMenus[T].allergyPlans).toHaveLength(1);
    expect(b.state.dayMenus[T].allergyPlans[0]).toMatchObject({ alternative: 'Telur dadar', by: 's2' });
    const c = run(b.state, 'allergyPlan.clear', { date: T, person: 'member:m10', dishId: 'dish-sop-ikan' }, 's3');
    expect(kitchenConflicts(c.state, T)[0].resolved).toBe(false);
    expect(c.state.dayMenus[T]).toBeUndefined(); // an empty day row is not kept
    expect(() => run(c.state, 'allergyPlan.clear', { date: T, person: 'member:m10', dishId: 'dish-sop-ikan' }, 's3')).toThrow('err.notFound');
  });
  it('refuses plans that make no sense and plans from people who may not make them', () => {
    const s = seed();
    expect(() => run(s, 'allergyPlan.set', { ...plan, person: 'member:m1' }, 's3')).toThrow('kitchen.err.noConflict');
    expect(() => run(s, 'allergyPlan.set', { ...plan, alternative: 'bubur ikan' }, 's3')).toThrow('kitchen.err.altConflicts');
    expect(() => run(s, 'allergyPlan.set', { ...plan, alternative: '' }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'allergyPlan.set', { ...plan, person: 'someone' }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'allergyPlan.set', { ...plan, date: '2026-10-20' }, 's3')).toThrow('kitchen.err.pastDate');
    for (const uid of ['s1', 's8', 's5', 'f1']) expect(() => run(s, 'allergyPlan.set', plan, uid)).toThrow('err.forbidden');
    expect(run(s, 'allergyPlan.set', plan, 's9').state.dayMenus[T].allergyPlans).toHaveLength(1); // management may
  });
  it('guests get plans too; guests with unknown allergies are listed so the kitchen asks the escort', () => {
    const s = produce(seed(), (d) => { d.guestVisits['g-e1'].food = ['seafood']; d.guestVisits['g-e2'].lunch = true; });
    const c = kitchenConflicts(s, T).find((x) => x.person === 'guest:g-e1')!;
    expect(c.name).toBe('Oma Siu Lan Tjandra');
    const r = run(s, 'allergyPlan.set', { date: T, person: 'guest:g-e1', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' }, 's3');
    expect(kitchenConflicts(r.state, T).find((x) => x.person === 'guest:g-e1')!.resolved).toBe(true);
    expect(updatesFor(r.state, usr(r.state, 'fm10_0')).some((x) => x.kind === 'kitchen.notif.alternative')).toBe(false); // no family to tell
    const u = unknownAllergyGuests(s, T);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ escort: 'Ilham Hamid' });
    expect(u[0].phone).toMatch(/^\+62/);
  });
  it('an alternative can be prepared before the member arrives; on arrival the conflict shows already sorted', () => {
    // the soup now also carries shellfish: Oma Lina would clash, but she has not checked in yet
    const s = produce(seed(), (d) => { d.dishes['dish-sop-ikan'].allergens = ['fish', 'shellfish']; });
    expect(kitchenConflicts(s, T).map((c) => c.person).sort()).toEqual(['guest:g-e1', 'member:m10']); // the live panel: who is here
    const onFile = potentialConflicts(s, T).find((c) => c.person === 'member:m1')!;
    expect(onFile).toMatchObject({ present: false, resolved: false, name: 'Oma Lina' });
    expect(safetyOf(s, 'm1', T)).toEqual({ kind: 'pending', dishes: ['Sop ikan kakap'] }); // her family can be told before she is here
    const r = run(s, 'allergyPlan.set', { date: T, person: 'member:m1', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' }, 's3');
    expect(safetyOf(r.state, 'm1', T)).toEqual({ kind: 'alternative', items: [{ dish: 'Sop ikan kakap', alternative: 'Ayam kukus' }] });
    const told = unreadUpdates(r.state, usr(r.state, 'f1')).find((x) => x.kind === 'kitchen.notif.alternative');
    expect(told).toMatchObject({ params: { name: 'Oma Lina', alternative: 'Ayam kukus' }, memberId: 'm1' });
    expect(kitchenConflicts(r.state, T).some((c) => c.person === 'member:m1')).toBe(false); // still not in the live panel
    // she checks in: the live panel lists her, already sorted, and the kitchen's needs-action list does not
    const arrived = run(r.state, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's1').state;
    expect(kitchenConflicts(arrived, T).find((c) => c.person === 'member:m1')).toMatchObject({ present: true, resolved: true, plan: { alternative: 'Ayam kukus', by: 's3' } });
    const open = actionItems(arrived, usr(arrived, 's3'), T, 600).filter((i) => i.kind === 'notif.act.allergen').map((i) => i.params.name);
    expect(open).toContain('Bapak Bambang');
    expect(open).not.toContain('Oma Lina');
  });
  it('planning ahead: a coming day\'s menu against the allergies on file', () => {
    const FRI = '2026-10-23'; // gado-gado: peanuts and eggs
    const s = produce(seed(), (d) => { d.members.m1.health.food = ['shellfish', 'peanuts']; });
    const rows = allergiesOnFile(s, FRI, T);
    expect(rows.map((r) => [r.m.id, r.presence, r.clashes.map((c) => c.dish.id)])).toEqual([['m10', null, []], ['m1', null, ['dish-gado-gado']]]);
    expect(safetyOf(s, 'm1', FRI)).toEqual({ kind: 'pending', dishes: ['Gado-gado (sauce on the side)'] });
    const r = run(s, 'allergyPlan.set', { date: FRI, person: 'member:m1', dishId: 'dish-gado-gado', alternative: 'Soto ayam bening' }, 's2');
    expect(r.state.dayMenus[FRI].allergyPlans).toEqual([{ person: 'member:m1', dishId: 'dish-gado-gado', alternative: 'Soto ayam bening', by: 's2', at: `${T}T10:00` }]);
    expect(allergiesOnFile(r.state, FRI, T).find((x) => x.m.id === 'm1')!.clashes[0]).toMatchObject({ resolved: true });
    expect(safetyOf(r.state, 'm1', FRI).kind).toBe('alternative');
    expect(unreadUpdates(r.state, usr(r.state, 'f1')).some((x) => x.kind === 'kitchen.notif.alternative')).toBe(false); // the update says "today": nothing goes out for a coming day
    expect(Object.values(r.state.activity).some((a) => a.key === 'kitchen.feed.alternative' && a.memberId === 'm1')).toBe(true); // the kitchen's own feed still records it
    // someone without that allergy has no clash to answer
    expect(() => run(s, 'allergyPlan.set', { date: FRI, person: 'member:m10', dishId: 'dish-gado-gado', alternative: 'Soto' }, 's3')).toThrow('kitchen.err.noConflict');
    // an ended membership has nothing to plan for
    const ended = produce(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-10'; });
    expect(() => run(ended, 'allergyPlan.set', { date: FRI, person: 'member:m1', dishId: 'dish-gado-gado', alternative: 'Soto' }, 's3')).toThrow('kitchen.err.noConflict');
  });
  it('the allergies on file say where each member is today', () => {
    const rows = allergiesOnFile(seed(), T, T);
    expect(rows.map((r) => [r.m.id, r.food, r.presence])).toEqual([['m10', ['seafood'], 'in'], ['m1', ['shellfish'], 'notYet']]);
    expect(rows[0].clashes.map((c) => c.dish.id)).toEqual(['dish-sop-ikan']);
    expect(rows[0].clashes[0].present).toBe(true);
    const home = run(run(seed(), 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1').state, 'attendance.checkOut', { memberId: 'm1' }, 's1').state;
    expect(allergiesOnFile(home, T, T).find((r) => r.m.id === 'm1')!.presence).toBe('gone');
    // a free-text allergy is listed but never matched against dishes
    const other = produce(seed(), (d) => { d.members.m46.health.foodOther = 'mushrooms'; });
    expect(allergiesOnFile(other, T, T).find((r) => r.m.id === 'm46')).toMatchObject({ other: 'mushrooms', food: [], clashes: [] });
    // closed days: no menu, nothing clashes, nothing throws
    expect(allergiesOnFile(seed(), '2026-10-24', T).every((r) => r.clashes.length === 0)).toBe(true);
  });
  it('uses the club date, not a fixed month: a plan for a Wednesday in November', () => {
    const NOV = '2026-11-11'; // Wednesday
    const s = produce(seed(), (d) => {
      d.attendance[`${NOV}:m10`] = { id: `${NOV}:m10`, clubId: 'citra', createdAt: `${NOV}T09:30`, createdBy: 'staff:s1', memberId: 'm10', date: NOV, checkIn: { at: '09:30', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] };
    });
    const c = { today: NOV, nowMin: 600 };
    expect(kitchenConflicts(s, NOV).map((x) => x.dish.id)).toEqual(['dish-sop-ikan']);
    const r = run(s, 'allergyPlan.set', { date: NOV, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' }, 's3', c);
    expect(r.state.dayMenus[NOV].allergyPlans[0].at).toBe(`${NOV}T10:00`);
    expect(r.state.dayMenus[T]).toBeUndefined();
  });
});

describe('weekly menu', () => {
  const withLunch = (s: ClubState, lunch: string[]) => { const days = templateOn(s, T).days; return { ...days, 4: { ...days[4], lunch } }; };
  it('publishing a template changes Thursday from today on and keeps earlier days as they were', () => {
    const s = seed();
    const lunch = [...thursdayLunch(s), 'dish-ayam-bakar'];
    const r = run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch) }, 's3');
    expect(menuOn(r.state, '2026-10-22')!.lunch).toContain('dish-ayam-bakar');
    expect(menuOn(r.state, '2026-10-29')!.lunch).toContain('dish-ayam-bakar');
    expect(menuOn(r.state, '2026-10-15')!.lunch).not.toContain('dish-ayam-bakar'); // last Thursday: history unchanged
    expect(menuOn(r.state, T)!.lunch).toEqual(menuOn(s, T)!.lunch);
    expect(r.state.menuVersions[r.result.versionId as string]).toMatchObject({ status: 'published', effectiveFrom: T, publishedBy: 'staff:s3', approval: { status: 'pending', by: 'staff:s3' } });
    expect(Object.values(r.state.activity).some((a) => a.key === 'kitchen.feed.menuPublished' && a.params.from === T)).toBe(true);
  });
  it('the kitchen\'s published menu waits for management: families see the last approved menu until then', () => {
    const s = seed();
    const lunch = [...thursdayLunch(s), 'dish-ayam-bakar'];
    const r = run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch) }, 's3');
    const id = r.result.versionId as string;
    expect(r.result.pending).toBe(true);
    // the club's own screens follow it at once; the old version is not replaced yet
    expect(menuOn(r.state, '2026-10-22')!.lunch).toContain('dish-ayam-bakar');
    expect(r.state.menuVersions['menu-2024-07'].deletedAt).toBeUndefined();
    // families get the approved menu only
    const fam = projectForFamily(r.state, 'fm10_0');
    expect(fam.menuVersions[id]).toBeUndefined();
    expect(menuOn(fam, '2026-10-22')!.lunch).not.toContain('dish-ayam-bakar');
    expect(menuOn(r.state, '2026-10-22', { approvedOnly: true })!.lunch).not.toContain('dish-ayam-bakar'); // the client rule guards a full state too
    expect(Object.values(r.state.notifications).some((x) => x.kind === 'kitchen.notif.menuPublished')).toBe(false);
    // approval: the version replaces the old one, families see it and are told
    const ok = approveMenu(r.state, [id]);
    expect(ok.state.menuVersions[id].approval).toMatchObject({ status: 'approved', decidedBy: 'staff:s9' });
    expect(ok.state.menuVersions['menu-2024-07'].deletedAt).toBeUndefined(); // earlier versions stay as history; only the same date or later ones give way
    expect(projectForFamily(ok.state, 'fm10_0').menuVersions[id]).toBeDefined();
    expect(menuOn(projectForFamily(ok.state, 'fm10_0'), '2026-10-22')!.lunch).toContain('dish-ayam-bakar');
    expect(Object.values(ok.state.notifications).filter((x) => x.kind === 'kitchen.notif.menuPublished')).toHaveLength(1);
    // rejection: the version is gone, the old menu carries on, the kitchen hears why
    const no = run(r.state, 'approval.reject', { type: 'menu', ids: [id], reason: 'Too much fried food' }, 's9');
    expect(no.state.menuVersions[id]).toMatchObject({ deletedAt: expect.any(String), approval: { status: 'rejected', reason: 'Too much fried food' } });
    expect(menuOn(no.state, '2026-10-22')!.lunch).toEqual(menuOn(s, '2026-10-22')!.lunch);
    expect(unreadUpdates(no.state, usr(no.state, 's3')).some((x) => x.kind === 'approvals.notif.rejected.menu' && x.params.reason === 'Too much fried food')).toBe(true);
    expect(() => run(r.state, 'approval.reject', { type: 'menu', ids: [id], reason: '  ' }, 's9')).toThrow('err.noteRequired');
    // management's own publish is approved at once
    const mg = run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch) }, 's9');
    expect(mg.state.menuVersions[mg.result.versionId as string].approval).toBeUndefined();
  });
  it('the notify toggle: publishing tells the families of the active members, once each; off tells nobody', () => {
    const s = seed();
    const menuNotes = (st: ClubState) => Object.values(st.notifications).filter((x) => x.kind === 'kitchen.notif.menuPublished');
    const lunch = [...thursdayLunch(s), 'dish-ayam-bakar'];
    const on0 = run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch) }, 's3');
    expect(menuNotes(on0.state)).toHaveLength(0); // the kitchen's notice waits for approval
    const on = approveMenu(on0.state, [on0.result.versionId as string]);
    const [note] = menuNotes(on.state);
    expect(note).toMatchObject({ link: '/today', params: { date: T } });
    expect(note.toUsers.length).toBeGreaterThan(3);
    expect(new Set(note.toUsers).size).toBe(note.toUsers.length);
    expect(note.toUsers).toContain('fm10_0');
    expect(menuNotes(run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch), notify: true }, 's9').state)).toHaveLength(1); // management: at once
    expect(menuNotes(run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch), notify: false }, 's9').state)).toHaveLength(0);
    const off = run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch), notify: false }, 's3');
    expect(menuNotes(approveMenu(off.state, [off.result.versionId as string]).state)).toHaveLength(0); // approving tells nobody when the kitchen turned it off
    expect(() => run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, lunch), notify: 'yes' }, 's3')).toThrow('err.invalid');
    // the family sees it in their updates
    expect(updatesFor(on.state, usr(on.state, 'fm10_0')).some((x) => x.kind === 'kitchen.notif.menuPublished')).toBe(true);
  });
  it('planning next week: a plan published from that Monday leaves this week alone and carries on after it', () => {
    const s = seed();
    const MON = '2026-10-26';
    const lunch = [...thursdayLunch(s), 'dish-ayam-bakar'];
    const r = run(s, 'menu.publish', { effectiveFrom: MON, days: withLunch(s, lunch) }, 's3');
    expect(menuOn(r.state, '2026-10-22')!.lunch).toEqual(menuOn(s, '2026-10-22')!.lunch); // Thursday this week: unchanged
    expect(menuOn(r.state, '2026-10-29')!.lunch).toContain('dish-ayam-bakar'); // Thursday next week
    expect(menuOn(r.state, '2026-11-05')!.lunch).toContain('dish-ayam-bakar'); // and the week after, until another menu starts
    expect(r.state.menuVersions[r.result.versionId as string].effectiveFrom).toBe(MON);
    expect(Object.values(approveMenu(r.state, [r.result.versionId as string]).state.notifications).find((x) => x.kind === 'kitchen.notif.menuPublished')!.params.date).toBe(MON);
    // changing only next week's Tuesday in a version already scheduled for that Monday replaces it
    const again = run(r.state, 'menu.publish', { effectiveFrom: MON, days: withLunch(s, ['dish-rawon']) }, 's3');
    expect(live(again.state.menuVersions).filter((v) => v.effectiveFrom === MON)).toHaveLength(1);
    expect(menuOn(again.state, '2026-10-29')!.lunch).toEqual(['dish-rawon']);
  });
  it('a second publish for the same date replaces the first; a later scheduled version is replaced too', () => {
    const s = seed();
    const a = run(s, 'menu.publish', { effectiveFrom: '2026-10-26', days: withLunch(s, ['dish-ayam-bakar']) }, 's3');
    const b = run(a.state, 'menu.publish', { effectiveFrom: '2026-10-26', days: withLunch(s, ['dish-rawon']) }, 's3');
    expect(menuOn(b.state, '2026-10-29')!.lunch).toEqual(['dish-rawon']);
    expect(live(b.state.menuVersions).filter((v) => v.effectiveFrom === '2026-10-26')).toHaveLength(1);
    const c = run(b.state, 'menu.publish', { effectiveFrom: T, days: withLunch(s, ['dish-ayam-bakar']) }, 's3');
    expect(menuOn(c.state, '2026-10-29')!.lunch).toEqual(['dish-ayam-bakar']); // the scheduled one no longer shadows it
    expect(live(c.state.menuVersions).filter((v) => v.effectiveFrom > T)).toHaveLength(0);
  });
  it('refuses unchanged menus, past dates, unknown dishes and dishes in the wrong course', () => {
    const s = seed();
    expect(() => run(s, 'menu.publish', { effectiveFrom: T, days: templateOn(s, T).days }, 's3')).toThrow('err.noChanges');
    expect(() => run(s, 'menu.publish', { effectiveFrom: '2026-10-20', days: withLunch(s, ['dish-rawon']) }, 's3')).toThrow('kitchen.err.pastDate');
    expect(() => run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, ['dish-nope']) }, 's3')).toThrow('kitchen.err.badDish');
    expect(() => run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, ['dish-teh-melati']) }, 's3')).toThrow('kitchen.err.badDish'); // a tea in the lunch list
    expect(() => run(s, 'menu.publish', { effectiveFrom: 'soon', days: templateOn(s, T).days }, 's3')).toThrow('err.invalid');
    for (const uid of ['s1', 's10', 'f1']) expect(() => run(s, 'menu.publish', { effectiveFrom: T, days: withLunch(s, ['dish-rawon']) }, uid)).toThrow('err.forbidden');
  });
  it('a per-date override changes that date only, and back to the template drops it', () => {
    const s = seed();
    const r = run(s, 'dayMenu.override', { date: T, lunch: ['dish-ayam-bakar', 'dish-nasi-putih'] }, 's3');
    expect(menuOn(r.state, T)!.lunch).toEqual(['dish-ayam-bakar', 'dish-nasi-putih']);
    expect(menuOn(r.state, '2026-10-28')!.lunch).toEqual(menuOn(s, '2026-10-28')!.lunch);
    expect(kitchenConflicts(r.state, T)).toHaveLength(0); // the fish soup is off today, so Bambang's conflict is gone
    const back = run(r.state, 'dayMenu.override', { date: T, lunch: null }, 's3');
    expect(menuOn(back.state, T)!.lunch).toEqual(menuOn(s, T)!.lunch);
    expect(back.state.dayMenus[T]).toBeUndefined();
    // setting the template's own dishes is not an override
    expect(() => run(s, 'dayMenu.override', { date: T, lunch: menuOn(s, T)!.lunch }, 's3')).toThrow('err.noChanges');
  });
  it('overrides keep the lunch photo and allergy plans on the day; closed days and the past are refused', () => {
    const s = run(seed(), 'allergyPlan.set', { date: T, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' }, 's3').state;
    const r = run(s, 'dayMenu.override', { date: T, tea: ['dish-klepon'] }, 's3');
    expect(r.state.dayMenus[T].allergyPlans).toHaveLength(1);
    const back = run(r.state, 'dayMenu.override', { date: T, tea: null }, 's3');
    expect(back.state.dayMenus[T].allergyPlans).toHaveLength(1);
    expect(back.state.dayMenus[T].tea).toBeUndefined();
    expect(() => run(s, 'dayMenu.override', { date: '2026-10-24', lunch: ['dish-rawon'] }, 's3')).toThrow('err.closedDay'); // Saturday
    expect(() => run(s, 'dayMenu.override', { date: '2026-10-30', lunch: ['dish-rawon'] }, 's3')).toThrow('err.closedDay'); // closed for training
    expect(() => run(s, 'dayMenu.override', { date: '2026-10-20', lunch: ['dish-rawon'] }, 's3')).toThrow('kitchen.err.pastDate');
    expect(() => run(s, 'dayMenu.override', { date: '2026-10-22', lunch: ['dish-teh-melati'] }, 's3')).toThrow('kitchen.err.badDish');
  });
  it('weekends and closed days have no menu and nothing crashes', () => {
    const s = seed();
    expect(menuOn(s, '2026-10-24')).toBeNull();
    expect(menuDishesOn(s, '2026-10-24')).toBeNull();
    expect(kitchenConflicts(s, '2026-10-24')).toEqual([]);
    expect(dietaryRows(s, '2026-10-24')).toEqual([]);
    expect(safetyOf(s, 'm10', '2026-10-24')).toEqual({ kind: 'none' });
    expect(coversOn(s, '2026-10-24').total).toBe(0);
  });
});

describe('lunch photos', () => {
  const lunchNotes = (st: ClubState) => Object.values(st.notifications).filter((x) => x.kind === 'kitchen.notif.lunchPhoto');
  const IN_CLUB = ['fm10_0', 'fm20_0', 'fm2_0', 'fm2_1']; // Bambang, Hendra and Tjahjadi are in; Oma Lina and Opa Budi have not arrived
  it('the kitchen\'s photo waits for approval: pending, on the day\'s list, and nobody is told yet', () => {
    const s = seed();
    const r = run(s, 'menu.postLunchPhoto', { date: T, mediaId: 'media-abc_1' }, 's3');
    const photo = r.state.photos[r.result.photoId as string];
    expect(photo).toMatchObject({ kind: 'lunch', media: 'photo', memberIds: [], visibility: 'pending', date: T, time: '10:00', takenBy: 's3', mediaId: 'media-abc_1' });
    expect(photo.approved).toBeUndefined();
    expect(r.result.pending).toBe(true);
    expect(r.state.dayMenus[T].photoIds).toEqual([photo.id]);
    expect(r.state.dayMenus[T].photoId).toBeUndefined(); // the deprecated single field is never written
    expect(lunchNotes(r.state)).toHaveLength(0);
    expect(visibleLunchPhotos(r.state, T)).toEqual([]);
    expect(lunchPhotosOn(r.state, T).map((p) => p.id)).toEqual([photo.id]);
    // what a family's browser receives leaves it out until management approves it
    expect(Object.keys(projectForFamily(r.state, 'fm10_0').photos)).not.toContain(photo.id);
    expect(Object.values(r.state.activity).some((a) => a.key === 'kitchen.feed.lunchPhotoPending')).toBe(true);
  });
  it('management\'s photo is visible at once and tells the families of the members checked in', () => {
    const s = seed();
    const r = run(s, 'menu.postLunchPhoto', { date: T }, 's9');
    const photo = r.state.photos[r.result.photoId as string];
    expect(photo).toMatchObject({ kind: 'lunch', visibility: 'visible', takenBy: 's9', approved: { at: `${T}T10:00`, by: 's9' } });
    expect(photo.mediaId).toBeUndefined(); // no upload: the design's placeholder
    expect(r.result.pending).toBe(false);
    const [note] = lunchNotes(r.state);
    expect([...note.toUsers].sort()).toEqual(IN_CLUB);
    expect(note.link).toBe('/today');
    expect(note.ref).toEqual({ type: 'photo', id: photo.id });
    expect(visibleLunchPhotos(r.state, T).map((p) => p.id)).toEqual([photo.id]);
    expect(Object.keys(projectForFamily(r.state, 'fm10_0').photos)).toContain(photo.id);
    expect(Object.values(r.state.activity).some((a) => a.key === 'kitchen.feed.lunchPhoto')).toBe(true);
  });
  it('the notify toggle: off keeps it quiet, on by default', () => {
    const s = seed();
    const quiet = run(s, 'menu.postLunchPhoto', { date: T, notify: false }, 's9');
    expect(quiet.state.photos[quiet.result.photoId as string].visibility).toBe('visible'); // still shown to families
    expect(lunchNotes(quiet.state)).toHaveLength(0);
    expect(lunchNotes(run(s, 'menu.postLunchPhoto', { date: T, notify: true }, 's9').state)).toHaveLength(1);
    expect(lunchNotes(run(s, 'menu.postLunchPhoto', { date: T }, 's9').state)).toHaveLength(1);
    expect(() => run(s, 'menu.postLunchPhoto', { date: T, notify: 'no' }, 's9')).toThrow('err.invalid');
  });
  it('a day holds several photos, oldest first; each family is told once a day, not once per photo', () => {
    const s = seed();
    const a = run(s, 'menu.postLunchPhoto', { date: T }, 's9');
    const b = run(a.state, 'menu.postLunchPhoto', { date: T, mediaId: 'm2' }, 's9', { today: T, nowMin: 610 });
    const c = run(b.state, 'menu.postLunchPhoto', { date: T }, 's3', { today: T, nowMin: 620 });
    const ids = [a.result.photoId, b.result.photoId, c.result.photoId] as string[];
    expect(c.state.dayMenus[T].photoIds).toEqual(ids);
    expect(lunchPhotosOn(c.state, T).map((p) => p.id)).toEqual(ids);
    expect(visibleLunchPhotos(c.state, T).map((p) => p.id)).toEqual(ids.slice(0, 2)); // the kitchen's third is still pending
    expect(new Set(ids.map((id) => c.state.photos[id].tone)).size).toBe(3); // each placeholder has its own tone
    expect(lunchNotes(c.state)).toHaveLength(1);
    // somebody who checks in later is told about the next photo
    const late = produce(c.state, (d) => { d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: 'citra', createdAt: `${T}T10:30`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:30', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] }; });
    const d = run(late, 'menu.postLunchPhoto', { date: T }, 's9', { today: T, nowMin: 650 });
    const notes = lunchNotes(d.state);
    expect(notes).toHaveLength(2);
    expect(notes.at(-1)!.toUsers).toEqual(familyOf(d.state, 'm1'));
  });
  it('at most 12 photos a day', () => {
    let st = seed();
    for (let i = 0; i < MAX_LUNCH_PHOTOS; i++) st = run(st, 'menu.postLunchPhoto', { date: T }, 's9').state;
    expect(st.dayMenus[T].photoIds).toHaveLength(MAX_LUNCH_PHOTOS);
    expect(() => run(st, 'menu.postLunchPhoto', { date: T }, 's9')).toThrow('kitchen.err.tooManyPhotos');
  });
  it('only for today, only on open days, only by kitchen or management, with a sane media id', () => {
    const s = seed();
    expect(() => run(s, 'menu.postLunchPhoto', { date: '2026-10-22' }, 's3')).toThrow('kitchen.err.notToday');
    expect(() => run(s, 'menu.postLunchPhoto', { date: T }, 's1')).toThrow('err.forbidden');
    expect(() => run(s, 'menu.postLunchPhoto', { date: T }, 'f1')).toThrow('err.forbidden');
    expect(() => run(s, 'menu.postLunchPhoto', { date: '2026-10-24' }, 's3', { today: '2026-10-24', nowMin: 700 })).toThrow('err.closedDay');
    expect(() => run(s, 'menu.postLunchPhoto', { date: T, mediaId: '../../etc/passwd' }, 's3')).toThrow('err.invalid');
    expect(() => run(s, 'menu.postLunchPhoto', { date: T, mediaId: 42 }, 's3')).toThrow('err.invalid');
    expect(run(s, 'menu.postLunchPhoto', { date: '2026-11-12' }, 's9', { today: '2026-11-12', nowMin: 730 }).state.dayMenus['2026-11-12'].photoIds).toHaveLength(1);
  });
  it('removing one: it leaves the day\'s list, is kept as removed, and the others stay', () => {
    const s = seed();
    const a = run(s, 'menu.postLunchPhoto', { date: T }, 's9');
    const b = run(a.state, 'menu.postLunchPhoto', { date: T }, 's3');
    const [pa, pb] = [a.result.photoId, b.result.photoId] as string[];
    const r = run(b.state, 'menu.removeLunchPhoto', { photoId: pa }, 's3');
    expect(r.state.dayMenus[T].photoIds).toEqual([pb]);
    expect(r.state.photos[pa]).toMatchObject({ visibility: 'removed', moderated: { by: 's3', reason: 'removed' } });
    expect(visibleLunchPhotos(r.state, T)).toEqual([]);
    expect(lunchPhotosOn(r.state, T).map((p) => p.id)).toEqual([pb]);
    // the last one goes: the day's row goes with it
    const last = run(r.state, 'menu.removeLunchPhoto', { photoId: pb }, 's9');
    expect(last.state.dayMenus[T]).toBeUndefined();
    expect(() => run(r.state, 'menu.removeLunchPhoto', { photoId: pa }, 's3')).toThrow('err.notFound'); // already removed
    expect(() => run(r.state, 'menu.removeLunchPhoto', { photoId: 'nope' }, 's3')).toThrow('err.notFound');
    expect(() => run(b.state, 'menu.removeLunchPhoto', { photoId: pa }, 's1')).toThrow('err.forbidden');
    // an allergy plan on the day stays when the last photo goes
    const planned = run(r.state, 'allergyPlan.set', { date: T, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus' }, 's3').state;
    expect(run(planned, 'menu.removeLunchPhoto', { photoId: pb }, 's3').state.dayMenus[T].allergyPlans).toHaveLength(1);
  });
  it('only today\'s photos can be removed, and only lunch photos', () => {
    const s = seed();
    const a = run(s, 'menu.postLunchPhoto', { date: T }, 's9');
    expect(() => run(a.state, 'menu.removeLunchPhoto', { photoId: a.result.photoId }, 's3', { today: '2026-10-22', nowMin: 600 })).toThrow('kitchen.err.notToday');
    const other = Object.values(s.photos).find((p) => p.kind !== 'lunch')!;
    expect(() => run(s, 'menu.removeLunchPhoto', { photoId: other.id }, 's3')).toThrow('err.notFound');
  });
  it('announceLunchPhoto tells the families of today\'s diners once, for a visible lunch photo of today only (as photo.approve uses it)', () => {
    const s = seed();
    const posted = run(s, 'menu.postLunchPhoto', { date: T }, 's3'); // pending: no notification
    const pid = posted.result.photoId as string;
    // photo.approve (the activity area) calls it from inside its own run; here a throwaway action does the same
    registerActions([defineAction<{ photoId: string }>({ name: 'test.announceLunchPhoto', can: () => true, run: (d, i, ctx) => announceLunchPhoto(d, ctx, i.photoId) })]);
    const announce = (st: ClubState, id: string, c = clock) => execute(st, 'test.announceLunchPhoto', { photoId: id }, usr(st, 's9'), c, 'ann' + ++n).state;
    // still pending: nothing is announced
    expect(lunchNotes(announce(posted.state, pid))).toHaveLength(0);
    // management approves (what photo.approve does), then announces
    const approved = produce(posted.state, (d) => { d.photos[pid].visibility = 'visible'; d.photos[pid].approved = { at: `${T}T10:05`, by: 's9' }; });
    const told = announce(approved, pid);
    expect([...lunchNotes(told)[0].toUsers].sort()).toEqual(IN_CLUB);
    // a photo from an earlier day, or one that is not a lunch photo, announces nothing
    expect(lunchNotes(announce(approved, pid, { today: '2026-10-22', nowMin: 600 }))).toHaveLength(0);
    const solo = Object.values(s.photos).find((p) => p.kind !== 'lunch')!;
    expect(lunchNotes(announce(s, solo.id))).toHaveLength(0);
    expect(lunchNotes(announce(s, 'nope'))).toHaveLength(0);
  });
});

describe('meal feedback', () => {
  const sub = { memberId: 'm10', mealDate: '2026-10-19', dish: 'Sayur asem', text: 'Papa said the soup was too salty again.' };
  it('a family submits: feedback, a kitchen thread, and the kitchen is told', () => {
    const s = seed();
    const r = run(s, 'feedback.submit', sub, 'fm10_0');
    const fb = r.state.feedback[r.result.feedbackId as string];
    expect(fb).toMatchObject({ ...sub, familyId: 'fm10_0', source: 'family', status: 'open' });
    const th = r.state.threads[fb.threadId!];
    expect(th).toMatchObject({ topic: 'kitchen', memberId: 'm10', familyId: 'fm10_0', feedbackId: fb.id, lastSeq: 1 });
    expect(Object.values(r.state.messages).find((m) => m.threadId === th.id)).toMatchObject({ from: 'family:fm10_0', text: sub.text, ref: { type: 'feedback', id: fb.id } });
    const chef = usr(r.state, 's3');
    expect(updatesFor(r.state, chef).some((x) => x.kind === 'kitchen.notif.feedbackNew' && x.params.name === 'Bapak Bambang')).toBe(true);
    expect(staffUnreadCount(r.state, 'kitchen')).toBe(staffUnreadCount(s, 'kitchen') + 1);
    expect(actionItems(r.state, chef, T, 600).filter((i) => i.kind === 'notif.act.complaint')).toHaveLength(3); // c1, c3 and the new one
    // it reaches only that family's view
    expect(projectForFamily(r.state, 'fm10_0').feedback[fb.id]).toBeDefined();
    expect(projectForFamily(r.state, 'f1').feedback[fb.id]).toBeUndefined();
  });
  it('runs on the family\'s own projected state (the optimistic run) and gives the same rows as the server', () => {
    const full = seed();
    const projected = projectForFamily(full, 'fm10_0');
    const client = execute(projected, 'feedback.submit', sub, getUser({ [projected.clubId]: projected }, 'fm10_0')!, clock, 'mfam');
    const server = execute(full, 'feedback.submit', sub, usr(full, 'fm10_0'), clock, 'mfam');
    expect(client.result.feedbackId).toBe(server.result.feedbackId);
    expect(client.result.feedbackId).toBe('fb_mfam_1');
    expect(JSON.stringify(client.patches)).toEqual(JSON.stringify(server.patches));
    // after the server confirms, the family's refreshed projection carries the thread and the feedback
    const next = projectForFamily(server.state, 'fm10_0');
    expect(next.feedback.fb_mfam_1.status).toBe('open');
    expect(Object.values(next.threads).some((t) => t.feedbackId === 'fb_mfam_1')).toBe(true);
  });
  it('only a linked family can submit, for a real meal date, with words', () => {
    const s = seed();
    expect(() => run(s, 'feedback.submit', sub, 'f1')).toThrow('err.forbidden'); // Maria is not Bambang's family
    expect(() => run(s, 'feedback.submit', sub, 's3')).toThrow('err.forbidden');
    expect(() => run(s, 'feedback.submit', { ...sub, mealDate: '2026-10-22' }, 'fm10_0')).toThrow('kitchen.err.futureDate');
    expect(() => run(s, 'feedback.submit', { ...sub, text: '  ' }, 'fm10_0')).toThrow('err.invalid');
    expect(() => run(s, 'feedback.submit', { ...sub, mealDate: 'yesterday' }, 'fm10_0')).toThrow('err.invalid');
    expect(run(s, 'feedback.submit', { ...sub, dish: '' }, 'fm10_0').state.feedback).toBeDefined(); // a dish is optional
  });
  it('the kitchen replies into that thread: answered, the family is told and finds it in Messages', () => {
    const s = run(seed(), 'feedback.submit', sub, 'fm10_0').state;
    const id = Object.values(s.feedback).find((f) => f.text === sub.text)!.id;
    const r = run(s, 'feedback.reply', { feedbackId: id, text: 'Sorry about that. We will use less salt.' }, 's3');
    const fb = r.state.feedback[id];
    expect(fb.status).toBe('answered');
    const th = r.state.threads[fb.threadId!];
    expect(th.lastSeq).toBe(2);
    expect(Object.values(r.state.messages).filter((m) => m.threadId === th.id).map((m) => m.from)).toEqual(['family:fm10_0', 'staff:s3']);
    expect(familyUnread(r.state, th)).toBe(1);
    expect(familyThreads(r.state, 'fm10_0').some((t) => t.id === th.id)).toBe(true);
    expect(unreadUpdates(r.state, usr(r.state, 'fm10_0')).some((x) => x.kind === 'kitchen.notif.feedbackReply' && x.link === '/chat')).toBe(true);
    expect(actionItems(r.state, usr(r.state, 's3'), T, 600).some((i) => i.id === 'fb:' + id)).toBe(false); // handled: leaves "needs action"
    const reply = Object.values(r.state.messages).find((m) => m.from === 'staff:s3' && m.threadId === th.id)!;
    expect(projectForFamily(r.state, 'fm10_0').messages[reply.id]).toBeDefined();
    expect(projectForFamily(r.state, 'f1').messages[reply.id]).toBeUndefined();
  });
  it('an edited reply is a new message; reopening puts the item back in needs-action; closing stops replies', () => {
    const s0 = run(seed(), 'feedback.submit', sub, 'fm10_0').state;
    const id = Object.values(s0.feedback).find((f) => f.text === sub.text)!.id;
    const a = run(s0, 'feedback.reply', { feedbackId: id, text: 'We will use less salt.' }, 's3');
    const b = run(a.state, 'feedback.reply', { feedbackId: id, text: 'We will use less salt and taste it first.' }, 's2');
    const th = b.state.feedback[id].threadId!;
    expect(Object.values(b.state.messages).filter((m) => m.threadId === th).map((m) => m.text)).toEqual([sub.text, 'We will use less salt.', 'We will use less salt and taste it first.']);
    expect(b.state.feedback[id].status).toBe('answered');
    const open = run(b.state, 'feedback.setStatus', { feedbackId: id, status: 'open' }, 's3');
    expect(actionItems(open.state, usr(open.state, 's3'), T, 600).some((i) => i.id === 'fb:' + id)).toBe(true);
    expect(() => run(open.state, 'feedback.setStatus', { feedbackId: id, status: 'open' }, 's3')).toThrow('err.noChanges');
    expect(() => run(open.state, 'feedback.setStatus', { feedbackId: id, status: 'done' }, 's3')).toThrow('err.invalid');
    const closed = run(open.state, 'feedback.setStatus', { feedbackId: id, status: 'closed' }, 's9');
    expect(() => run(closed.state, 'feedback.reply', { feedbackId: id, text: 'Late reply' }, 's3')).toThrow('kitchen.err.feedbackClosed');
    expect(() => run(open.state, 'feedback.setStatus', { feedbackId: id, status: 'answered' }, 's1')).toThrow('err.forbidden');
    expect(() => run(open.state, 'feedback.reply', { feedbackId: id, text: 'Hi' }, 'fm10_0')).toThrow('err.forbidden');
    expect(() => run(open.state, 'feedback.reply', { feedbackId: 'nope', text: 'Hi' }, 's3')).toThrow('err.notFound');
  });
  it('a reply to the seeded complaint lands in its existing thread; management may reply too', () => {
    const s = seed();
    const threadsBefore = Object.keys(s.threads).length;
    const r = run(s, 'feedback.reply', { feedbackId: 'c1', text: 'We will check the salt.' }, 's9');
    expect(Object.keys(r.state.threads)).toHaveLength(threadsBefore);
    expect(r.state.threads['tk-c1'].lastSeq).toBe(2);
    expect(r.state.feedback.c1.status).toBe('answered');
    expect(Object.values(r.state.messages).find((m) => m.threadId === 'tk-c1' && m.seq === 2)!.from).toBe('staff:s9');
  });
  it('staff log feedback received by phone; the reply goes to the member\'s family contact in Messages', () => {
    const s = seed();
    const r = run(s, 'feedback.log', { memberId: 'm2', mealDate: T, dish: 'Sop ikan kakap', text: 'Cynthia phoned: the fish soup was too hot.' }, 's1');
    const id = r.result.feedbackId as string;
    expect(r.state.feedback[id]).toMatchObject({ source: 'staff', familyId: null, status: 'open' });
    expect(r.state.feedback[id].threadId).toBeUndefined();
    expect(updatesFor(r.state, usr(r.state, 's3')).some((x) => x.kind === 'kitchen.notif.feedbackNew')).toBe(true);
    const ans = run(r.state, 'feedback.reply', { feedbackId: id, text: 'Thank you, we will serve it cooler.' }, 's3');
    const th = ans.state.threads[ans.state.feedback[id].threadId!];
    expect(th).toMatchObject({ familyId: 'fm2_0', topic: 'kitchen', feedbackId: id });
    expect(ans.state.feedback[id]).toMatchObject({ status: 'answered', familyId: null });
    expect(unreadUpdates(ans.state, usr(ans.state, 'fm2_0')).some((x) => x.kind === 'kitchen.notif.feedbackReply')).toBe(true);
    // nobody to message: the reply is refused, the kitchen answers by phone and marks it answered
    const noApp = produce(r.state, (d) => { for (const l of Object.values(d.familyLinks)) if (l.memberId === 'm2') l.appAccess = false; });
    expect(() => run(noApp, 'feedback.reply', { feedbackId: id, text: 'Hi' }, 's3')).toThrow('kitchen.err.noFamilyApp');
    expect(run(noApp, 'feedback.setStatus', { feedbackId: id, status: 'answered' }, 's3').state.feedback[id].status).toBe('answered');
    // kitchen staff logging their own phone call do not notify themselves
    const own = run(s, 'feedback.log', { memberId: 'm2', mealDate: T, dish: '', text: 'Phone call.' }, 's3');
    expect(Object.values(own.state.notifications).some((x) => x.kind === 'kitchen.notif.feedbackNew')).toBe(false);
    expect(() => run(s, 'feedback.log', { memberId: 'm2', mealDate: T, dish: '', text: 'x' }, 'f1')).toThrow('err.forbidden');
    expect(() => run(s, 'feedback.log', { memberId: 'nope', mealDate: T, dish: '', text: 'x' }, 's1')).toThrow('err.notFound');
  });
});

describe('stock requests', () => {
  const req = { item: 'Gloves', qty: 4, unit: 'boxes', area: 'health', sectionId: 'operations' };
  it('any staff with an app login can request; finance and management are not auto-approved', () => {
    const s = produce(seed(), (d) => { d.staff.s4.appAccess = true; d.staff.s7.appAccess = true; });
    for (const uid of ['s1', 's2', 's5', 's8', 's9', 's10', 's4', 's7']) {
      const r = run(s, 'stock.request', req, uid);
      const k = r.state.stockRequests[r.result.stockId as string];
      expect(k).toMatchObject({ item: 'Gloves', qty: 4, unit: 'boxes', area: 'health', sectionId: 'operations', status: 'requested', requestedBy: uid });
      expect(k.decidedBy).toBeUndefined();
    }
    expect(() => run(s, 'stock.request', req, 'f1')).toThrow('err.forbidden');
    expect(() => run(s, 'stock.request', { ...req, sectionId: 'nope' }, 's8')).toThrow('kitchen.err.noSection');
    expect(() => run(s, 'stock.request', { ...req, qty: 0 }, 's8')).toThrow('err.invalid');
    expect(() => run(s, 'stock.request', { ...req, item: ' ' }, 's8')).toThrow('err.invalid');
    expect(() => run(s, 'stock.request', { ...req, area: 'garage' }, 's8')).toThrow('err.invalid');
    expect(run(s, 'stock.request', { ...req, qty: '2,5' }, 's8').state.stockRequests).toBeDefined();
  });
  it('the F&B supervisor approves kitchen items; finance and management approve everything; others cannot', () => {
    const s = seed();
    const k2 = run(s, 'stock.approve', { id: 'k2' }, 's2'); // Teh melati, kitchen area
    expect(k2.state.stockRequests.k2).toMatchObject({ status: 'approved', decidedBy: 'staff:s2', decidedAt: `${T}T10:00` });
    expect(() => run(s, 'stock.approve', { id: 'k1' }, 's2')).toThrow('err.forbidden'); // health item
    expect(() => run(s, 'stock.approve', { id: 'k2' }, 's3')).toThrow('err.forbidden'); // chef is not the supervisor
    for (const uid of ['s1', 's8', 's5']) expect(() => run(s, 'stock.approve', { id: 'k1' }, uid)).toThrow('err.forbidden');
    expect(run(s, 'stock.approve', { id: 'k1' }, 's10').state.stockRequests.k1.status).toBe('approved');
    expect(run(s, 'stock.approve', { id: 'k5' }, 's9').state.stockRequests.k5.status).toBe('approved');
    expect(() => run(k2.state, 'stock.approve', { id: 'k2' }, 's9')).toThrow('kitchen.err.alreadyDecided');
    expect(() => run(s, 'stock.approve', { id: 'nope' }, 's9')).toThrow('err.notFound');
    // the requester hears about it, with a link they can open
    const k1 = run(s, 'stock.approve', { id: 'k1' }, 's10');
    const note = unreadUpdates(k1.state, usr(k1.state, 's8')).find((x) => x.kind === 'kitchen.notif.stockApproved')!;
    expect(note).toMatchObject({ params: { item: 'Test strips (glucose)', qty: '2 boxes' }, link: '/requests' });
    const k2b = run(s, 'stock.approve', { id: 'k2' }, 's9');
    expect(updatesFor(k2b.state, usr(k2b.state, 's2')).find((x) => x.kind === 'kitchen.notif.stockApproved')!.link).toBe('/stock');
  });
  it('declining needs a note and keeps the request as Declined', () => {
    const s = seed();
    expect(() => run(s, 'stock.reject', { id: 'k1' }, 's10')).toThrow('err.noteRequired');
    expect(() => run(s, 'stock.reject', { id: 'k1', note: '  ' }, 's10')).toThrow('err.noteRequired');
    expect(() => run(s, 'stock.reject', { id: 'k1', note: 'Too many' }, 's2')).toThrow('err.forbidden');
    const r = run(s, 'stock.reject', { id: 'k1', note: 'We still have four boxes.' }, 's10');
    expect(r.state.stockRequests.k1).toMatchObject({ status: 'rejected', note: 'We still have four boxes.', decidedBy: 'staff:s10' });
    expect(live(r.state.stockRequests).some((k) => k.id === 'k1')).toBe(true); // kept, not deleted
    const note = unreadUpdates(r.state, usr(r.state, 's8')).find((x) => x.kind === 'kitchen.notif.stockDeclined')!;
    expect(note.params).toMatchObject({ item: 'Test strips (glucose)', note: 'We still have four boxes.' });
    expect(() => run(r.state, 'stock.reject', { id: 'k1', note: 'again' }, 's9')).toThrow('kitchen.err.alreadyDecided');
    expect(() => run(r.state, 'stock.approve', { id: 'k1' }, 's9')).toThrow('kitchen.err.alreadyDecided');
    // approvals and declines leave the approvers' needs-action list
    expect(actionItems(s, usr(s, 's10'), T, 600).some((i) => i.id === 'stock:k1')).toBe(true);
    expect(actionItems(r.state, usr(r.state, 's10'), T, 600).some((i) => i.id === 'stock:k1')).toBe(false);
  });
  it('the requester edits or cancels while it is still requested; nobody else, and not after approval', () => {
    const s = seed();
    const e = run(s, 'stock.edit', { id: 'k1', qty: 3, item: 'Glucose test strips' }, 's8');
    expect(e.state.stockRequests.k1).toMatchObject({ qty: 3, item: 'Glucose test strips', unit: 'boxes', status: 'requested' });
    expect(() => run(s, 'stock.edit', { id: 'k1', qty: 3 }, 's2')).toThrow('err.forbidden');
    expect(() => run(s, 'stock.edit', { id: 'k1', qty: 3 }, 's9')).toThrow('err.forbidden');
    expect(() => run(s, 'stock.edit', { id: 'k1', qty: 2 }, 's8')).toThrow('err.noChanges');
    expect(() => run(s, 'stock.edit', { id: 'k1', qty: -1 }, 's8')).toThrow('err.invalid');
    expect(() => run(s, 'stock.edit', { id: 'k1', sectionId: 'nope' }, 's8')).toThrow('kitchen.err.noSection');
    const c = run(s, 'stock.cancel', { id: 'k1' }, 's8');
    expect(c.state.stockRequests.k1.status).toBe('cancelled');
    expect(live(c.state.stockRequests).some((k) => k.id === 'k1')).toBe(true);
    expect(() => run(s, 'stock.cancel', { id: 'k1' }, 's10')).toThrow('err.forbidden');
    const approved = run(s, 'stock.approve', { id: 'k1' }, 's10').state;
    expect(() => run(approved, 'stock.edit', { id: 'k1', qty: 3 }, 's8')).toThrow('kitchen.err.stockLocked');
    expect(() => run(approved, 'stock.cancel', { id: 'k1' }, 's8')).toThrow('kitchen.err.stockLocked');
    expect(() => run(c.state, 'stock.edit', { id: 'k1', qty: 3 }, 's8')).toThrow('kitchen.err.stockLocked');
  });
  it('receiving is for the requester or an approver, and only once it is approved', () => {
    const s = seed();
    expect(() => run(s, 'stock.receive', { id: 'k1' }, 's8')).toThrow('kitchen.err.notApproved'); // not approved yet... (the requester may, but there is nothing to receive)
    // k3: approved, requested by Kak Dimas (s6), activities area
    expect(() => run(s, 'stock.receive', { id: 'k3' }, 's8')).toThrow('err.forbidden'); // another section's nurse
    expect(() => run(s, 'stock.receive', { id: 'k3' }, 's2')).toThrow('err.forbidden'); // supervisor: kitchen items only
    expect(() => run(s, 'stock.receive', { id: 'k3' }, 's1')).toThrow('err.forbidden');
    const r = run(s, 'stock.receive', { id: 'k3' }, 's6');
    expect(r.state.stockRequests.k3).toMatchObject({ status: 'received', receivedBy: 'staff:s6' });
    expect(run(s, 'stock.receive', { id: 'k3' }, 's9').state.stockRequests.k3.receivedBy).toBe('staff:s9');
    expect(run(s, 'stock.receive', { id: 'k3' }, 's10').state.stockRequests.k3.status).toBe('received');
    expect(() => run(r.state, 'stock.receive', { id: 'k3' }, 's6')).toThrow('kitchen.err.notApproved');
    // the supervisor receives kitchen items: approve k2 first
    const k2 = run(s, 'stock.approve', { id: 'k2' }, 's2').state;
    expect(run(k2, 'stock.receive', { id: 'k2' }, 's2').state.stockRequests.k2.status).toBe('received');
    expect(() => run(k2, 'stock.receive', { id: 'k2' }, 's3')).toThrow('err.forbidden');
  });
  it('the permission helpers match the actions, and the list sorts requested, approved, received, then the rest', () => {
    const s = seed();
    expect(canApproveStock(usr(s, 's2'), s.stockRequests.k2)).toBe(true);
    expect(canApproveStock(usr(s, 's2'), s.stockRequests.k1)).toBe(false);
    expect(canReceiveStock(usr(s, 's6'), s.stockRequests.k3)).toBe(true);
    expect(canReceiveStock(usr(s, 's8'), s.stockRequests.k3)).toBe(false);
    expect(getAction('stock.approve').can(usr(s, 's2'), { id: 'k2' }, s)).toBe(true);
    expect(getAction('stock.approve').can(usr(s, 's2'), { id: 'k1' }, s)).toBe(false);
    expect(getAction('stock.reject').can(usr(s, 's10'), { id: 'k1', note: 'x' }, s)).toBe(true);
    const withS4 = produce(s, (d) => { d.staff.s4.appAccess = true; });
    const declined = run(withS4, 'stock.reject', { id: 'k1', note: 'No' }, 's10').state;
    expect(sortStock(Object.values(declined.stockRequests)).map((k) => k.id)).toEqual(['k5', 'k2', 'k3', 'k4', 'k1']);
    const cancelled = run(declined, 'stock.cancel', { id: 'k5' }, 's4').state;
    expect(sortStock(Object.values(cancelled.stockRequests)).map((k) => [k.id, k.status])).toEqual([['k2', 'requested'], ['k3', 'approved'], ['k4', 'received'], ['k1', 'rejected'], ['k5', 'cancelled']]);
  });
  it('is deterministic: the same mutation id gives the same patches on client and server', () => {
    const a = seed(), b = seed();
    const r1 = execute(a, 'stock.request', req, usr(a, 's8'), clock, 'mx');
    const r2 = execute(b, 'stock.request', req, usr(b, 's8'), clock, 'mx');
    expect(JSON.stringify(r1.patches)).toEqual(JSON.stringify(r2.patches));
    expect(r1.result.stockId).toBe('k_mx_1');
  });
});
