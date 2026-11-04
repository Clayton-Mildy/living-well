// Round 20 (R4): on a field trip day the menu is optional; duties and allergen alerts follow it; no photos on closed days.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, DomainError, menuOn, dinersOn, type ClubState } from '../index';
import { actionItems } from '../notify';
import { dutiesOf } from './tasks';
import { conflictsOn } from './kitchen';

const T = '2026-10-21'; // Wed, normal weekly menu
const base: ClubState = buildSeed().citra;
const withTrip = (s: ClubState): ClubState => produce(s, (d) => { d.calendarEvents.evT = { id: 'evT', clubId: s.clubId, createdAt: '', createdBy: 'staff:s9', date: T, kind: 'outing', title: 'Ancol', from: '08:30', to: '15:00' }; });
const withOverride = (s: ClubState): ClubState => produce(s, (d) => { d.dayMenus[T] = { id: T, clubId: s.clubId, createdAt: `${T}T08:00`, createdBy: 'staff:s3', date: T, lunch: ['dish-sop-ikan'], soft: ['dish-sop-ikan'], tea: [], allergyPlans: [] }; });
const allergic = (s: ClubState): ClubState => produce(s, (d) => { d.dishes['dish-sop-ikan'].allergens = ['fish']; d.members.m10.health.food = ['fish']; });
const ids = (s: ClubState) => dutiesOf(s, 'kitchen', T, T, 600).map((x) => x.def.id);
const alerts = (s: ClubState) => actionItems(s, getUser({ [s.clubId]: s }, 's3')!, T, 600).filter((x) => x.kind === 'notif.act.allergen');
const take = (s: ClubState, date: string) => execute(s, 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo' }, getUser({ [s.clubId]: s }, 's5')!, { today: date, nowMin: 600 }, 'tm1');
const checked = (s: ClubState) => produce(s, (d) => { d.attendance[`${T}:m10`] = { id: `${T}:m10`, clubId: s.clubId, createdAt: '', createdBy: 'system', memberId: 'm10', date: T, checkIn: '09:00', method: 'manual' } as never; });

describe('trip day meals are optional', () => {
  it('a normal day is unchanged', () => {
    expect(menuOn(base, T)?.lunch.length).toBeGreaterThan(0);
  });
  it('a trip day with no override has no menu, no diners, no alert', () => {
    const s = checked(allergic(withTrip(base)));
    expect(menuOn(s, T)).toBeNull();
    expect(dinersOn(s, T)).toEqual([]);
    expect(conflictsOn(s, T)).toEqual([]);
    expect(alerts(s)).toEqual([]);
  });
  it('the same day with an override gets the menu, diners, alert back', () => {
    const s = withOverride(checked(allergic(withTrip(base))));
    expect(menuOn(s, T)?.lunch).toEqual(['dish-sop-ikan']);
    expect(dinersOn(s, T).length).toBeGreaterThan(0);
    expect(alerts(s).length).toBeGreaterThan(0);
  });
  it('lunch, lunchPhoto and teaPhoto duties go with the menu', () => {
    const none = checked(withTrip(base));
    for (const id of ['kitchen.lunch', 'kitchen.lunchPhoto', 'kitchen.teaPhoto']) expect(ids(none)).not.toContain(id);
    const some = withOverride(none);
    for (const id of ['kitchen.lunchPhoto', 'kitchen.teaPhoto']) expect(ids(some)).toContain(id);
    expect(ids(checked(base))).toEqual(expect.arrayContaining(['kitchen.lunchPhoto', 'kitchen.teaPhoto']));
  });
  it('the lunch round needs a lunch or soft menu on a trip day; a tea-only one is no lunch (deferred 5)', () => {
    const trip = withTrip(base); // the seed's check-ins today are the lunch round's diners
    expect(ids(withOverride(trip))).toContain('kitchen.lunch');
    const teaOnly = produce(trip, (d) => { d.dayMenus[T] = { id: T, clubId: d.clubId, createdAt: `${T}T08:00`, createdBy: 'staff:s3', date: T, tea: ['dish-sop-ikan'], allergyPlans: [] } as never; });
    expect(menuOn(teaOnly, T)).not.toBeNull();
    expect(ids(teaOnly)).not.toContain('kitchen.lunch');
  });
});

describe('dayMenu.override on a trip day', () => {
  const override = (s: ClubState, input: Record<string, unknown>) => execute(s, 'dayMenu.override', { date: T, ...input }, getUser({ [s.clubId]: s }, 's9')!, { today: T, nowMin: 480 }, 'om1').state;
  it('keeps a one-date menu that matches the weekly one (there is no weekly menu on a trip day)', () => {
    const weekly = menuOn(base, T)!.lunch;
    const s = override(withTrip(base), { lunch: weekly });
    expect(menuOn(s, T)?.lunch).toEqual(weekly);
  });
  it('an emptied course is no override at all', () => {
    const s = override(override(withTrip(base), { lunch: ['dish-sop-ikan'] }), { lunch: [] });
    expect(menuOn(s, T)).toBeNull();
  });
});

describe('photo.take on closed days', () => {
  it('fails on a closed day, works on a trip day', () => {
    const closed = produce(base, (d) => { d.calendarEvents.evC = { id: 'evC', clubId: base.clubId, createdAt: '', createdBy: 'system', date: T, kind: 'closed', title: 'Closed' }; });
    expect(() => take(closed, T)).toThrow(DomainError);
    try { take(closed, T); } catch (e) { expect((e as DomainError).code).toBe('err.closedDay'); }
    expect(take(withTrip(base), T).result.photoId).toBeTruthy();
  });
});
