// Kitchen selectors (rules/kitchenOps.ts): safety messages, menu template helpers, dish usage, stock permissions, feedback helpers.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, getUser, menuOn, type ClubState, type MenuVersion } from '../index';
import {
  COURSES, DISH_ALLERGENS, DISH_TAGS, KNOWN_UNITS, STOCK_AREAS, WEEKDAYS,
  allergiesOnFile, canApproveStock, canEditStock, canReceiveStock, canRequestStock, coversOn, defaultAreaFor, defaultSectionFor, diffTemplates, dishUsage, dishesByCourse, feedbackThread, isStockApprover,
  kitchenConflicts, membersAffectedBy, menuAudience, menuDishesOn, overridesFrom, personKey, potentialConflicts, replyTarget, safetyOf, sameIds, scheduledVersions, sortFeedback, sortStock, templateForWeek, templateOn, unreviewedDishesOn, weekDate, weekdayOf, planStartFor, MAX_PLAN_WEEKS,
} from './kitchenOps';
import { lunchPhotoIds, lunchPhotosOn, visibleLunchPhotos } from './kitchen';

const T = '2026-10-21';
const seed = () => buildSeed().citra;
const usr = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const withVersion = (s: ClubState, effectiveFrom: string, lunch4: string[]) => produce(s, (d) => {
  const base = d.menuVersions['menu-2024-07'];
  const days = JSON.parse(JSON.stringify(base.days));
  days[4].lunch = lunch4;
  d.menuVersions['mv-next'] = { id: 'mv-next', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', effectiveFrom, status: 'published', days } satisfies MenuVersion;
});

describe('constants', () => {
  it('the allergen chips, courses, tags and weekdays are the ones the brief names', () => {
    expect(DISH_ALLERGENS).toEqual(['fish', 'shellfish', 'peanuts', 'treeNuts', 'eggs', 'dairy', 'gluten', 'soy']);
    expect(COURSES).toEqual(['lunch', 'soft', 'tea']);
    expect(DISH_TAGS).toEqual(['soft', 'lowSalt', 'sugarFree', 'vegetarian']);
    expect(WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
    expect(STOCK_AREAS).toEqual(['kitchen', 'health', 'activities', 'housekeeping', 'transport']);
    expect(KNOWN_UNITS).toContain('boxes');
  });
});

describe('safetyOf: what a family may be told', () => {
  it('none, clear, pending, alternative, unreviewed', () => {
    const s = seed();
    expect(safetyOf(s, 'm46', T)).toEqual({ kind: 'none' }); // no food allergies on file
    expect(safetyOf(s, 'm1', T)).toEqual({ kind: 'clear' }); // shellfish; nothing on today's menu has it
    expect(safetyOf(s, 'm10', T)).toEqual({ kind: 'pending', dishes: ['Sop ikan kakap'] });
    const planned = produce(s, (d) => { d.dayMenus[T] = { id: T, clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: T, allergyPlans: [{ person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus', by: 's3', at: `${T}T10:00` }] }; });
    expect(safetyOf(planned, 'm10', T)).toEqual({ kind: 'alternative', items: [{ dish: 'Sop ikan kakap', alternative: 'Ayam kukus' }] });
    const unchecked = produce(s, (d) => { delete d.dishes['dish-pepaya'].reviewedAt; });
    expect(safetyOf(unchecked, 'm1', T)).toEqual({ kind: 'unreviewed', dishes: ['Pepaya'] });
  });
  it('several conflicts: every dish is listed, and one without an alternative keeps it pending', () => {
    const s = produce(seed(), (d) => {
      d.members.m10.health.food = ['seafood', 'eggs'];
      d.dishes['dish-pepaya'].allergens = ['eggs'];
      d.dayMenus[T] = { id: T, clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: T, allergyPlans: [{ person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Ayam kukus', by: 's3', at: `${T}T10:00` }] };
    });
    // the egg allergy also meets the papaya (tagged above) and the kue lumpur served at tea
    expect(kitchenConflicts(s, T).filter((c) => c.person === 'member:m10').map((c) => c.dish.id).sort()).toEqual(['dish-kue-lumpur', 'dish-pepaya', 'dish-sop-ikan']);
    expect(safetyOf(s, 'm10', T)).toEqual({ kind: 'pending', dishes: ['Pepaya', 'Kue lumpur'] });
  });
  it('closed days say nothing and nothing throws', () => {
    expect(safetyOf(seed(), 'm10', '2026-10-24')).toEqual({ kind: 'none' });
  });
  it('personKey tells members and guests apart', () => {
    const c = kitchenConflicts(produce(seed(), (d) => { d.guestVisits['g-e1'].food = ['seafood']; }), T);
    expect(c.map((x) => personKey(x.diner)).sort()).toEqual(['guest:g-e1', 'member:m10']);
  });
});

describe('drop-in club: who is here, and who is on file', () => {
  const soup = (s: ClubState) => produce(s, (d) => { d.dishes['dish-sop-ikan'].allergens = ['fish', 'shellfish']; });
  it('the live panel follows check-ins; the potential list also holds members who have not arrived', () => {
    const s = soup(seed());
    expect(kitchenConflicts(s, T).map((c) => c.person).sort()).toEqual(['guest:g-e1', 'member:m10']);
    const all = potentialConflicts(s, T);
    expect(all.map((c) => [c.person, c.present]).sort()).toEqual([['guest:g-e1', true], ['member:m1', false], ['member:m10', true]]);
    // nobody is double counted once the member arrives
    const arrived = produce(s, (d) => { d.attendance[`${T}:m1`] = { id: `${T}:m1`, clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s1', memberId: 'm1', date: T, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] }; });
    expect(potentialConflicts(arrived, T).filter((c) => c.person === 'member:m1')).toHaveLength(1);
    expect(potentialConflicts(arrived, T).find((c) => c.person === 'member:m1')!.present).toBe(true);
    expect(coversOn(arrived, T).members).toBe(4);
  });
  it('another day has no live diners, but every active member is still on file', () => {
    const s = soup(seed());
    expect(kitchenConflicts(s, '2026-10-28')).toEqual([]); // nobody has checked in that day
    expect(potentialConflicts(s, '2026-10-28').map((c) => c.person).sort()).toEqual(['member:m1', 'member:m10']); // Wednesday: the soup again
    expect(potentialConflicts(s, '2026-10-24')).toEqual([]); // closed
  });
  it('members who are not active, or still waiting for approval, are not on file', () => {
    const s = soup(seed());
    const ended = produce(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-10'; });
    expect(potentialConflicts(ended, T).some((c) => c.person === 'member:m1')).toBe(false);
    expect(allergiesOnFile(ended, T, T).some((r) => r.m.id === 'm1')).toBe(false);
    const pending = produce(s, (d) => { d.members.m1.review = { status: 'pending', crId: 'x' }; });
    expect(allergiesOnFile(pending, T, T).some((r) => r.m.id === 'm1')).toBe(false);
  });
  it('safetyOf and the family message do not depend on the member being in the club', () => {
    const s = soup(seed());
    expect(safetyOf(seed(), 'm1', T)).toEqual({ kind: 'clear' }); // not here, nothing clashes
    expect(safetyOf(s, 'm1', T)).toEqual({ kind: 'pending', dishes: ['Sop ikan kakap'] }); // not here, but the soup would clash
  });
  it('membersAffectedBy follows the course: lunch reaches regular eaters, soft the soft-food eaters, tea everyone', () => {
    const s = produce(seed(), (d) => { d.members.m10.health.diet = ['softFood']; d.members.m1.health.food = ['shellfish', 'peanuts']; });
    const ids = (course: 'lunch' | 'soft' | 'tea', allergens: ('fish' | 'shellfish' | 'peanuts')[]) => membersAffectedBy(s, { course, allergens }, T).map((m) => m.id).sort();
    expect(ids('lunch', ['fish'])).toEqual([]); // Bambang is on soft food now; Oma Lina's shellfish does not cover fish
    expect(ids('soft', ['fish'])).toEqual(['m10']);
    expect(ids('tea', ['shellfish'])).toEqual(['m1', 'm10']); // seafood covers shellfish
    expect(ids('lunch', ['peanuts'])).toEqual(['m1']);
    expect(membersAffectedBy(s, { course: 'lunch', allergens: [] }, T)).toEqual([]);
    const ended = produce(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-10'; });
    expect(membersAffectedBy(ended, { course: 'lunch', allergens: ['peanuts'] }, T)).toEqual([]);
  });
});

describe('menu template helpers', () => {
  it('the template in force, scheduled versions and the version a later date resolves to', () => {
    const s = withVersion(seed(), '2026-10-26', ['dish-rawon']);
    expect(templateOn(s, T).version?.id).toBe('menu-2024-07');
    expect(templateOn(s, '2026-10-29').version?.id).toBe('mv-next');
    expect(templateOn(s, '2026-10-29').days[4].lunch).toEqual(['dish-rawon']);
    expect(scheduledVersions(s, T).map((v) => v.id)).toEqual(['mv-next']);
    expect(scheduledVersions(s, '2026-10-26')).toEqual([]); // starts on that day: in force, not scheduled
    expect(templateOn(seed(), T).days[3].soft).toEqual(['dish-bubur-ikan']);
    // a template with no version at all gives empty days, not a crash
    const none = produce(seed(), (d) => { d.menuVersions = {}; });
    expect(templateOn(none, T).days[1]).toEqual({ lunch: [], soft: [], tea: [] });
    expect(menuOn(none, T)).toEqual({ lunch: [], soft: [], tea: [] });
  });
  it('diffTemplates finds what was added and removed, per weekday and course, and ignores order', () => {
    const a = templateOn(seed(), T).days;
    expect(diffTemplates(a, a)).toEqual([]);
    const b = JSON.parse(JSON.stringify(a));
    b[4].lunch = [...b[4].lunch.filter((x: string) => x !== 'dish-semur-tahu'), 'dish-ayam-bakar'];
    b[2].tea = [...b[2].tea].reverse();
    expect(diffTemplates(a, b)).toEqual([{ weekday: 4, course: 'lunch', added: ['dish-ayam-bakar'], removed: ['dish-semur-tahu'] }]);
    expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
  });
  it('overrides from a date on ignore the past and days that only hold a photo or plans', () => {
    const s = produce(seed(), (d) => {
      for (const k of Object.keys(d.dayMenus)) if (d.dayMenus[k].approval) delete d.dayMenus[k]; // the seed's override that waits for approval
      d.dayMenus['2026-10-20'] = { id: '2026-10-20', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: '2026-10-20', lunch: ['dish-rawon'], allergyPlans: [] };
      d.dayMenus[T] = { id: T, clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: T, photoIds: ['p-x'], allergyPlans: [] };
      d.dayMenus['2026-10-23'] = { id: '2026-10-23', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: '2026-10-23', tea: ['dish-klepon'], allergyPlans: [] };
    });
    expect(overridesFrom(s, T)).toEqual([{ date: '2026-10-23', lunch: undefined, soft: undefined, tea: ['dish-klepon'] }]);
    expect(weekdayOf('2026-10-23')).toBe(5);
  });
  it('dish usage: the version in force, later versions and overrides; a dish nobody uses is free', () => {
    const s = produce(withVersion(seed(), '2026-10-26', ['dish-rawon']), (d) => {
      d.dayMenus['2026-10-23'] = { id: '2026-10-23', clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: '2026-10-23', tea: ['dish-klepon'], allergyPlans: [] };
    });
    expect(dishUsage(s, 'dish-semur-tahu', T)).toEqual([{ where: 'template', course: 'lunch', weekday: 4 }]); // the scheduled version drops it
    expect(dishUsage(s, 'dish-rawon', T).some((u) => u.where === 'scheduled' && u.weekday === 4)).toBe(true);
    expect(dishUsage(s, 'dish-klepon', T).some((u) => u.where === 'override' && u.date === '2026-10-23' && u.course === 'tea')).toBe(true);
    expect(dishUsage(s, 'dish-kopi-susu', T).length).toBeGreaterThan(0); // Friday tea
    expect(dishUsage(produce(s, (d) => { d.dishes['dish-x'] = { id: 'dish-x', clubId: 'citra', createdAt: '', createdBy: 'system', name: 'X', course: 'tea', allergens: [], tags: [] }; }), 'dish-x', T)).toEqual([]);
  });
  it('dishes on a menu skip dangling and deleted ids; unreviewed dishes are listed once', () => {
    const s = produce(seed(), (d) => {
      d.dayMenus[T] = { id: T, clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: T, lunch: ['dish-rawon', 'dish-gone', 'dish-nasi-putih'], allergyPlans: [] };
      d.dishes['dish-nasi-putih'].deletedAt = `${T}T08:00`;
      delete d.dishes['dish-rawon'].reviewedAt;
    });
    expect(menuDishesOn(s, T)!.lunch.map((x) => x.id)).toEqual(['dish-rawon']);
    expect(unreviewedDishesOn(s, T).map((x) => x.id)).toEqual(['dish-rawon']);
    expect(dishesByCourse(s, 'lunch').some((x) => x.id === 'dish-nasi-putih')).toBe(false);
    expect(dishesByCourse(s).length).toBeGreaterThan(dishesByCourse(s, 'tea').length);
  });
});

describe('stock helpers', () => {
  it('the section a request defaults to, from the data; the area a role defaults to', () => {
    const s = seed();
    expect(defaultSectionFor(s, 'kitchen')).toBe('fnb');
    expect(defaultSectionFor(s, 'activities')).toBe('activities');
    expect(defaultSectionFor(s, 'health')).toBe('operations');
    expect(defaultSectionFor(s, 'transport')).toBe('operations');
    const renamed = produce(s, (d) => { delete d.budgetSections.operations; });
    expect(defaultSectionFor(renamed, 'health')).toBeTruthy(); // falls back to a section that exists
    expect(defaultSectionFor(produce(s, (d) => { d.budgetSections = {}; }), 'kitchen')).toBeUndefined();
    expect(defaultAreaFor('nurse')).toBe('health');
    expect(defaultAreaFor('activity')).toBe('activities');
    expect(defaultAreaFor('driver')).toBe('transport');
    expect(defaultAreaFor('mgmt')).toBe('kitchen');
    expect(defaultAreaFor(null)).toBe('kitchen');
  });
  it('who may request, edit, approve and receive: the permission matrix', () => {
    const s = seed();
    const k1 = s.stockRequests.k1, k2 = s.stockRequests.k2, k3 = s.stockRequests.k3;
    const who = ['s1', 's2', 's3', 's5', 's6', 's8', 's9', 's10'] as const;
    const approve = (k: typeof k1) => who.filter((id) => canApproveStock(usr(s, id), k));
    expect(approve(k1)).toEqual(['s9', 's10']); // health item: management and finance
    expect(approve(k2)).toEqual(['s2', 's9', 's10']); // kitchen item: plus the F&B supervisor, not the chef
    expect(approve(k3)).toEqual([]); // already approved
    const receive = (k: typeof k1) => who.filter((id) => canReceiveStock(usr(s, id), k));
    expect(receive(k3)).toEqual(['s6', 's9', 's10']); // the requester and the approvers
    expect(receive(k1)).toEqual([]); // not approved yet
    const edit = (k: typeof k1) => who.filter((id) => canEditStock(usr(s, id), k));
    expect(edit(k1)).toEqual(['s8']);
    expect(edit(k2)).toEqual(['s2']);
    expect(edit(k3)).toEqual([]);
    expect(who.every((id) => canRequestStock(usr(s, id)))).toBe(true);
    expect(canRequestStock(usr(s, 'f1'))).toBe(false);
    expect(isStockApprover(usr(s, 's2'), { area: 'kitchen' })).toBe(true);
    expect(isStockApprover(usr(s, 's2'), { area: 'activities' })).toBe(false);
    expect(isStockApprover(usr(s, 'f1'), { area: 'kitchen' })).toBe(false);
  });
  it('sorting: requested, approved, received, declined, cancelled; newest first inside each', () => {
    const s = produce(seed(), (d) => {
      d.stockRequests.k1.status = 'rejected';
      d.stockRequests.k5.status = 'cancelled';
      d.stockRequests.k2.createdAt = '2026-10-21T08:00';
    });
    expect(sortStock(Object.values(s.stockRequests)).map((k) => k.id)).toEqual(['k2', 'k3', 'k4', 'k1', 'k5']);
  });
});

describe('feedback helpers', () => {
  it('open first, then the newest meal date; the thread comes back in order', () => {
    const s = seed();
    expect(sortFeedback(Object.values(s.feedback)).map((f) => f.id)).toEqual(['c3', 'c1', 'c2']); // c3 (21 Oct) and c1 (19 Oct) are open
    expect(feedbackThread(s, s.feedback.c2).map((m) => [m.seq, m.from])).toEqual([[1, 'family:fm2_0'], [2, 'staff:s3']]);
    expect(feedbackThread(s, { ...s.feedback.c2, threadId: undefined })).toEqual([]);
  });
  it('replies go to the family who wrote; a staff-logged item goes to the first contact with app access', () => {
    const s = seed();
    expect(replyTarget(s, s.feedback.c1)).toBe('fm10_0');
    expect(replyTarget(s, { familyId: null, memberId: 'm2' })).toBe('fm2_0'); // Hendra's primary contact
    const noPrimary = produce(s, (d) => { d.familyLinks['fm2_0:m2'].appAccess = false; });
    expect(replyTarget(noPrimary, { familyId: null, memberId: 'm2' })).toBe('fm2_1'); // the next contact with app access
    const none = produce(noPrimary, (d) => { d.familyLinks['fm2_1:m2'].appAccess = false; });
    expect(replyTarget(none, { familyId: null, memberId: 'm2' })).toBeUndefined();
    const pending = produce(s, (d) => { d.familyLinks['fm2_0:m2'].review = { status: 'pending', crId: 'x' }; });
    expect(replyTarget(pending, { familyId: null, memberId: 'm2' })).toBe('fm2_1');
  });
});

describe('planning other weeks', () => {
  it('a date in a week, and when a plan for that week starts: its Monday, or today for the current week', () => {
    expect(weekDate('2026-10-26', 1)).toBe('2026-10-26');
    expect(weekDate('2026-10-26', 5)).toBe('2026-10-30');
    expect(weekDate('2026-12-28', 5)).toBe('2027-01-01'); // across a month and year end
    expect(planStartFor('2026-10-26', T)).toBe('2026-10-26'); // next week: its Monday
    expect(planStartFor('2026-10-19', T)).toBe(T); // this week: its Monday has passed
    expect(planStartFor('2026-10-21', T)).toBe(T);
    expect(MAX_PLAN_WEEKS).toBeGreaterThan(4);
  });
  it('the menu of a week is the template in force, day by day', () => {
    const base = seed();
    expect(templateForWeek(base, '2026-10-26', T)).toEqual(templateOn(base, T).days);
    // a version that starts on Wednesday 28 Oct: Monday and Tuesday of that week still follow the old menu
    const s = withVersion(base, '2026-10-28', ['dish-rawon']);
    const w = templateForWeek(s, '2026-10-26', T);
    expect(w[2]).toEqual(templateOn(base, T).days[2]);
    expect(w[4].lunch).toEqual(['dish-rawon']);
    expect(w[3]).toEqual(templateOn(s, '2026-10-28').days[3]);
    // this week: days that have passed follow the version in force today (that is what a change published now reaches next week)
    const cur = templateForWeek(s, '2026-10-19', T);
    expect(cur[1]).toEqual(templateOn(s, T).days[1]);
    expect(cur[4].lunch).toEqual(templateOn(base, T).days[4].lunch); // Thursday 22 Oct: the scheduled version only starts on the 28th
  });
  it('the families told about a menu: approved app links of members active that day, once each', () => {
    const s = seed();
    const all = menuAudience(s, T);
    expect(all.length).toBeGreaterThan(3);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('fm10_0');
    expect(all).toContain('f1');
    // a member whose membership has ended is not in it
    const ended = produce(s, (d) => { d.members['m10'].memberships = d.members['m10'].memberships.map((p) => ({ ...p, lastDay: '2026-10-01' })); });
    expect(menuAudience(ended, T)).not.toContain('fm10_0');
  });
});

describe('lunch photo selectors', () => {
  const row = (extra: Record<string, unknown>) => ({ id: T, clubId: 'citra', createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: T, allergyPlans: [], ...extra });
  const photo = (id: string, visibility: 'pending' | 'visible' | 'hidden' | 'removed', kind = 'lunch') => ({ id, clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s3', date: T, time: '10:00', kind, media: 'photo', memberIds: [], tone: 3, takenBy: 's3', visibility });
  const s = produce(seed(), (d) => {
    d.dayMenus[T] = row({ photoIds: ['a', 'b', 'c', 'd', 'e', 'nope', 'x'] }) as never;
    for (const [id, v] of [['a', 'visible'], ['b', 'pending'], ['c', 'hidden'], ['d', 'removed'], ['e', 'visible']] as const) d.photos[id] = photo(id, v) as never;
    d.photos['x'] = photo('x', 'visible', 'solo') as never; // not a lunch photo
  });
  it('lists the day\'s photos oldest first, without removed ones, dangling ids or other kinds', () => {
    expect(lunchPhotoIds(s, T)).toEqual(['a', 'b', 'c', 'd', 'e', 'nope', 'x']);
    expect(lunchPhotosOn(s, T).map((p) => p.id)).toEqual(['a', 'b', 'c', 'e']);
  });
  it('families only get the approved ones', () => {
    expect(visibleLunchPhotos(s, T).map((p) => p.id)).toEqual(['a', 'e']);
    expect(visibleLunchPhotos(s, '2026-10-22')).toEqual([]);
    expect(lunchPhotosOn(seed(), T)).toEqual([]);
  });
  it('still reads the deprecated single photoId of older data', () => {
    const old = produce(seed(), (d) => { d.dayMenus[T] = row({ photoId: 'a' }) as never; d.photos['a'] = photo('a', 'visible') as never; });
    expect(lunchPhotoIds(old, T)).toEqual(['a']);
    expect(visibleLunchPhotos(old, T).map((p) => p.id)).toEqual(['a']);
  });
});
