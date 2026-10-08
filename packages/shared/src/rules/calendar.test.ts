import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, type ClubState } from '../index';
import { DRAFT_ID, builderBase, builderDays, changedCells, cloneDays, dayInfo, daysEqual, effectiveVersions, emptyDays, eventTitle, fmtDMY, latestPublished, listDays, monthGrid, nextDays, mondayOf, nextMonday, normalizeDays, sameCell, scheduleDraft, upcomingClosures, weekDates, weekDays, weekEditable, weekVersions, weekView } from './calendar';

const T = '2026-10-21';
const fresh = (): ClubState => buildSeed().citra;

describe('dayInfo', () => {
  it('open weekday: activities from the schedule version, in time order', () => {
    const d = dayInfo(fresh(), T);
    expect(d).toMatchObject({ date: T, weekday: 3, weekend: false, open: true, state: 'open', hasOuting: false });
    expect(d.items.filter((i) => i.kind === 'activity').map((i) => [i.time, i.title, i.titleId, i.staffId, i.roomId])).toEqual([
      ['10:30', 'Keroncong sing-along', 'Bernyanyi keroncong', 's5', 'room-music'],
      ['13:30', 'Batik painting', 'Melukis batik', 's6', 'room-studio'],
    ]);
  });

  it('staff see trials and visits (also leads with a booked visit but no guest row); families do not', () => {
    const s = fresh();
    const staff = dayInfo(s, T, 'staff').items.filter((i) => i.kind === 'guest');
    expect(staff.map((i) => [i.time, i.title, i.guestKind])).toEqual([[null, 'Oma Siu Lan Tjandra', 'trial'], ['14:00', 'Bapak Yusuf Hamid', 'visit']]); // a trial has no time, a visit keeps it
    expect(dayInfo(s, T, 'family').items.some((i) => i.kind === 'guest')).toBe(false);
    // e5 has a visit on 23 Oct but no guest row in the seed
    expect(dayInfo(s, '2026-10-23', 'staff').items.find((i) => i.kind === 'guest')).toMatchObject({ title: 'Opa Leo Gunadi', time: '11:00', guestKind: 'visit', enquiryId: 'e5' });
    expect(dayInfo(s, '2026-10-23', 'family').items.some((i) => i.kind === 'guest')).toBe(false);
  });

  it('venue bookings show the client to staff, and only "private" to families', () => {
    const s = fresh();
    const staff = dayInfo(s, '2026-10-24', 'staff'); // Saturday: Arunika seminar in the whole club
    expect(staff).toMatchObject({ weekend: true, open: false, state: 'weekend' });
    expect(staff.items.find((i) => i.kind === 'venue')).toMatchObject({ title: 'PT Arunika Farma caregiver seminar', roomId: 'room-whole', time: '09:00', to: '13:00' });
    const fam = dayInfo(s, '2026-10-24', 'family').items.find((i) => i.kind === 'venue')!;
    expect(fam).toMatchObject({ private: true, title: '', time: '09:00' });
    expect(JSON.stringify(dayInfo(s, '2026-10-24', 'family'))).not.toMatch(/Arunika|Wirjo|Santi/);
    // the family projection does not even carry venue bookings or enquiries
    const proj = projectForFamily(s, 'f1');
    expect(Object.keys(proj.venueBookings)).toEqual([]);
    expect(Object.keys(proj.enquiries)).toEqual([]);
    expect(dayInfo(proj, '2026-10-24', 'family').items.filter((i) => i.kind === 'venue')).toEqual([]);
    // cancelled venue bookings are gone
    const cancelled = produce(s, (d) => { d.venueBookings.v1.status = 'cancelled'; });
    expect(dayInfo(cancelled, '2026-10-24', 'staff').items.some((i) => i.kind === 'venue')).toBe(false);
  });

  it('closures, holidays and outings: state, no activities, events listed', () => {
    const s = fresh();
    expect(dayInfo(s, '2026-10-30')).toMatchObject({ state: 'closed', open: false });
    expect(dayInfo(s, '2026-10-30').items.map((i) => [i.kind, i.eventId])).toEqual([['closed', 'ev-closed-1030']]);
    expect(dayInfo(s, '2026-12-25')).toMatchObject({ state: 'holiday', open: false });
    const o = dayInfo(s, '2026-10-29');
    expect(o).toMatchObject({ state: 'open', hasOuting: true });
    expect(o.items.map((i) => i.kind)).toEqual(['outing']);
    expect(o.items[0]).toMatchObject({ time: '08:30', to: '15:00' });
    // a holiday on a weekend shows as a holiday
    const hw = produce(s, (d) => { d.calendarEvents['ev-x'] = { id: 'ev-x', clubId: 'citra', createdAt: '', createdBy: 'system', date: '2026-10-24', kind: 'holiday', title: 'Test holiday' }; });
    expect(dayInfo(hw, '2026-10-24').state).toBe('holiday');
    // closed wins over holiday
    const both = produce(hw, (d) => { d.calendarEvents['ev-y'] = { id: 'ev-y', clubId: 'citra', createdAt: '', createdBy: 'system', date: '2026-10-24', kind: 'closed', title: 'Closed' }; });
    expect(dayInfo(both, '2026-10-24').state).toBe('closed');
  });

  it('works in any month and year', () => {
    const s = fresh();
    expect(dayInfo(s, '2027-01-01')).toMatchObject({ state: 'holiday', weekday: 5 });
    expect(dayInfo(s, '2030-03-13')).toMatchObject({ state: 'open', weekday: 3 }); // far future: the schedule in force still applies
    expect(dayInfo(s, '2024-03-13').items.filter((i) => i.kind === 'activity')).toEqual([]); // before the first version
  });

  it('listDays skips weekends that have nothing on', () => {
    const s = fresh();
    const days = listDays(s, '2026-10-21', 14);
    expect(days.map((d) => d.date)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-02', '2026-11-03']);
    // the two Saturdays with a venue booking (24 and 31 Oct) are kept for staff, the empty Sunday 25 Oct is not
    // a family sees the day as a private event if the data carried it, and not at all with today's family projection
    expect(listDays(s, '2026-10-21', 14, 'family').find((d) => d.date === '2026-10-24')?.items).toEqual([expect.objectContaining({ kind: 'venue', private: true, title: '' })]);
    expect(listDays(projectForFamily(s, 'f1'), '2026-10-21', 14, 'family').map((d) => d.date)).not.toContain('2026-10-24');
  });
});

describe('nextDays', () => {
  it('always gives the next 3 days that have something on, skipping empty weekends without losing days', () => {
    const s = fresh();
    expect(nextDays(s, '2026-10-21', 3).map((d) => d.date)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
    // from a Friday: the Saturday with a venue booking counts for staff; for a family it is skipped
    expect(nextDays(s, '2026-10-23', 3).map((d) => d.date)).toEqual(['2026-10-23', '2026-10-24', '2026-10-26']);
    expect(nextDays(s, '2026-10-23', 3, 'family').map((d) => d.date)).toContain('2026-10-24'); // a private event is still a day with something on
    // an empty weekend is skipped: Fri 6 Nov, then Monday
    expect(nextDays(s, '2026-11-06', 2).map((d) => d.date)).toEqual(['2026-11-06', '2026-11-09']);
    expect(nextDays(s, '2026-10-21', 0)).toEqual([]);
    expect(nextDays(s, '2030-01-01', 3)).toHaveLength(3); // far from the seed: still 3 (a schedule version keeps applying)
  });
});

describe('monthGrid and helpers', () => {
  it('leads with the right number of blanks, Monday first, for any month', () => {
    const g = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g.filter(Boolean)).toHaveLength(31);
    const feb = monthGrid('2028-02'); // leap year, 1 Feb 2028 is a Tuesday
    expect(feb.slice(0, 2)).toEqual([null, '2028-02-01']);
    expect(feb.filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01'); // a Monday: no blanks
  });

  it('formats dates and titles', () => {
    expect(fmtDMY('2026-10-30')).toBe('30/10/2026');
    expect(eventTitle({ title: 'Club closed: staff first-aid training', titleId: 'Klub tutup: pelatihan P3K staf' }, 'en')).toBe('staff first-aid training');
    expect(eventTitle({ title: 'Club closed: staff first-aid training', titleId: 'Klub tutup: pelatihan P3K staf' }, 'id')).toBe('pelatihan P3K staf');
    expect(eventTitle({ title: 'Outing: botanical garden' }, 'id')).toBe('botanical garden'); // no Indonesian title: falls back
    expect(eventTitle({ title: 'Outing: botanical garden' }, 'en', false)).toBe('Outing: botanical garden');
    expect(eventTitle({ title: 'Christmas Day (national holiday)' }, 'en')).toBe('Christmas Day (national holiday)');
  });
});

describe('schedule drafts and versions', () => {
  it('normalizes and compares weeks', () => {
    expect(emptyDays()[3]['13:30']).toBeNull();
    const d = normalizeDays({ 3: { '10:30': { activityId: 'a', staffId: 's', roomId: 'r' } } });
    expect(d[3]['10:30']).toEqual({ activityId: 'a', staffId: 's', roomId: 'r' });
    expect(d[3]['13:30']).toBeNull();
    expect(d[1]['10:30']).toBeNull();
    const c = cloneDays(d);
    expect(c).toEqual(d);
    expect(c[3]['10:30']).not.toBe(d[3]['10:30']);
    expect(daysEqual(c, d)).toBe(true);
    c[3]['10:30'] = null;
    expect(changedCells(c, d)).toEqual([{ w: 3, slot: '10:30' }]);
    expect(sameCell(null, undefined)).toBe(true);
    expect(sameCell({ activityId: 'a', staffId: 's', roomId: 'r' }, { activityId: 'a', staffId: 's2', roomId: 'r' })).toBe(false);
  });

  it('the builder starts from the newest published version and prefers a saved draft', () => {
    const s = fresh();
    expect(latestPublished(s)?.id).toBe('sched-2024-07');
    expect(scheduleDraft(s)).toBeUndefined();
    expect(builderDays(s)[3]['10:30']?.activityId).toBe('act-keroncong');
    const cx = (st: ClubState, input: unknown, mid: string) => execute(st, 'schedule.saveDraft', input, getUser({ citra: st }, 's9')!, { today: T, nowMin: 600 }, mid).state;
    const days = builderDays(s);
    days[3]['10:30'] = null;
    const withDraft = cx(s, { days }, 'd1');
    expect(scheduleDraft(withDraft)?.id).toBe(DRAFT_ID);
    expect(builderDays(withDraft)[3]['10:30']).toBeNull();
    expect(builderBase(withDraft)[3]['10:30']?.activityId).toBe('act-keroncong');
    // versions list: one per effective date, newest first
    let v = execute(withDraft, 'schedule.publish', { effectiveFrom: '2026-10-26' }, getUser({ citra: withDraft }, 's9')!, { today: T, nowMin: 600 }, 'p1').state;
    expect(effectiveVersions(v).map((x) => x.effectiveFrom)).toEqual(['2026-10-26', '2024-07-01']);
    const days2 = builderDays(v);
    days2[1]['10:30'] = null;
    v = execute(v, 'schedule.publish', { effectiveFrom: '2026-10-26', days: days2 }, getUser({ citra: v }, 's9')!, { today: T, nowMin: 610 }, 'p2').state;
    expect(effectiveVersions(v).map((x) => x.effectiveFrom)).toEqual(['2026-10-26', '2024-07-01']); // the later publish for the same date replaces the earlier one
    expect(latestPublished(v)?.days[1]['10:30']).toBeNull();
  });

  it('next Monday is always strictly after the given day', () => {
    expect(nextMonday('2026-10-21')).toBe('2026-10-26');
    expect(nextMonday('2026-10-26')).toBe('2026-11-02');
    expect(nextMonday('2026-10-25')).toBe('2026-10-26');
    expect(nextMonday('2026-12-31')).toBe('2027-01-04');
  });
});

describe('the weekly schedule by week', () => {
  const cx = (st: ClubState, name: string, input: unknown, uid: string, mid: string) => execute(st, name, input, getUser({ citra: st }, uid)!, { today: T, nowMin: 600 }, mid).state;

  it('mondayOf: the Monday on or before a date; weekends belong to the week just ended', () => {
    expect(mondayOf('2026-11-04')).toBe('2026-11-02'); // 4 Nov (Wed) is in the week of 2–6 Nov
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-06')).toBe('2026-11-02');
    expect(mondayOf('2026-11-07')).toBe('2026-11-02'); // Saturday
    expect(mondayOf('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // across the year
    expect(weekDates('2026-11-02')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  });

  it('only a week that has not started can be changed', () => {
    expect(weekEditable('2026-10-19', T)).toBe(false); // this week
    expect(weekEditable('2026-10-26', T)).toBe(true);
    expect(weekEditable('2026-10-26', '2026-10-26')).toBe(false); // on its Monday it has started
  });

  it('weekDays follows the version in force on each date, even when a version starts mid-week', () => {
    const s = fresh();
    const days = builderDays(s);
    days[3]['10:30'] = null;
    days[4]['10:30'] = null;
    const v = cx(s, 'schedule.publish', { effectiveFrom: '2026-11-04', days }, 's9', 'w1'); // a Wednesday
    const w = weekDays(v, '2026-11-02');
    expect(w[1]['10:30']?.activityId).toBeTruthy(); // Monday: the old version
    expect(w[2]['10:30']?.activityId).toBeTruthy(); // Tuesday: the old version
    expect(w[3]['10:30']).toBeNull(); // from Wednesday: the new version
    expect(w[4]['10:30']).toBeNull();
    expect(weekVersions(v, '2026-11-02').map((x) => x.effectiveFrom)).toEqual(['2024-07-01', '2026-11-04']);
    expect(weekVersions(v, '2026-10-26').map((x) => x.effectiveFrom)).toEqual(['2024-07-01']);
    expect(weekVersions(v, '2026-11-09').map((x) => x.effectiveFrom)).toEqual(['2026-11-04']);
  });

  it('weekView: the version in force, plus the draft in the week it was saved for', () => {
    const s = fresh();
    const days = builderDays(s);
    days[2]['10:30'] = null;
    const d = cx(s, 'schedule.saveDraft', { days, effectiveFrom: '2026-11-02' }, 's9', 'w2');
    const here = weekView(d, '2026-11-02', T);
    expect(here).toMatchObject({ monday: '2026-11-02', editable: true, draftHere: true, otherDraft: undefined });
    expect(here.changes).toEqual([{ w: 2, slot: '10:30' }]);
    expect(here.days[2]['10:30']).toBeNull();
    expect(here.base[2]['10:30']?.activityId).toBeTruthy();
    expect(here.dates).toHaveLength(5);
    const other = weekView(d, '2026-10-26', T);
    expect(other.draftHere).toBe(false);
    expect(other.changes).toEqual([]);
    expect(other.otherDraft).toEqual({ monday: '2026-11-02', changes: 1 });
    // this week has started: it shows what runs and is not editable; the draft is for another week
    const now = weekView(d, '2026-10-19', T);
    expect(now).toMatchObject({ editable: false, draftHere: false, changes: [] });
    expect(now.days[3]['10:30']?.activityId).toBe('act-keroncong');
    // a draft equal to what runs is no draft for the banner
    const same = cx(s, 'schedule.saveDraft', { days: builderDays(s), effectiveFrom: '2026-11-02' }, 's9', 'w3');
    expect(weekView(same, '2026-11-09', T).otherDraft).toBeUndefined();
    expect(weekView(same, '2026-11-02', T).changes).toEqual([]);
  });
});

describe('upcomingClosures (family Today note)', () => {
  const ev = (id: string, date: string, kind: 'closed' | 'holiday' | 'outing', extra: Record<string, unknown> = {}) => ({ id, clubId: 'citra', createdAt: '', createdBy: 'system', date, kind, title: 'Event ' + id, ...extra }) as ClubState['calendarEvents'][string];
  const withEvents = (...rows: ReturnType<typeof ev>[]) => produce(fresh(), (d) => { for (const r of rows) d.calendarEvents[r.id] = r; });

  it('the seed has nothing in the next 7 days; the closure on 30 Oct is 9 days away', () => {
    expect(upcomingClosures(fresh(), T)).toEqual([]);
    expect(upcomingClosures(fresh(), T, 9)).toMatchObject([{ eventId: 'ev-closed-1030', kind: 'closed', from: '2026-10-30', to: '2026-10-30', title: 'Club closed: staff first-aid training' }]);
  });

  it('covers tomorrow through day 7; later days and outings are left out; soonest first', () => {
    const s = withEvents(ev('late', '2026-10-29', 'closed'), ev('edge', '2026-10-28', 'holiday', { titleId: 'Libur' }), ev('next', '2026-10-22', 'closed'), ev('trip', '2026-10-26', 'outing'));
    expect(upcomingClosures(s, T).map((x) => [x.eventId, x.kind, x.from])).toEqual([['next', 'closed', '2026-10-22'], ['edge', 'holiday', '2026-10-28']]);
    expect(upcomingClosures(s, T)[1].titleId).toBe('Libur');
    expect(upcomingClosures(s, T, 8).map((x) => x.eventId)).toEqual(['next', 'edge', 'late']);
  });

  it('today is the timeline\'s job: a closure today, or one already under way, is not repeated', () => {
    const s = withEvents(ev('now', T, 'closed'), ev('under', '2026-10-20', 'closed', { endDate: '2026-10-23' }));
    expect(upcomingClosures(s, T)).toEqual([]);
  });

  it('a several-day closure is one row from its first to its last weekday, even past the window; weekend days are not counted', () => {
    const s = withEvents(ev('range', '2026-10-26', 'closed', { endDate: '2026-11-03' }), ev('short', '2026-10-23', 'holiday', { endDate: '2026-10-25' }));
    expect(upcomingClosures(s, T).map((x) => [x.eventId, x.from, x.to])).toEqual([['short', '2026-10-23', '2026-10-23'], ['range', '2026-10-26', '2026-11-03']]);
  });

  it('normal weekends, holidays on a weekend, cancelled and deleted events show nothing; closed wins over a holiday on one day', () => {
    const s = withEvents(ev('sat', '2026-10-24', 'holiday'), ev('gone', '2026-10-22', 'closed', { cancelledAt: '2026-10-01T10:00' }), ev('del', '2026-10-23', 'closed', { deletedAt: '2026-10-01T10:00' }), ev('h', '2026-10-27', 'holiday'), ev('c', '2026-10-27', 'closed'));
    expect(upcomingClosures(s, T).map((x) => [x.eventId, x.kind])).toEqual([['c', 'closed']]);
  });
});
