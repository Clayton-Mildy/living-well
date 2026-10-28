import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, type ClubState } from '../index';
import { weekDays } from './calendar';
import { menuOn, sessionsOn } from './kitchen';
import { templateForWeek } from './kitchenOps';
import { copyMenu, copyProgramme, hasDishes, hasSessions, lastWeekMenu, lastWeekProgramme, menuCopyReplaces, menuPlanned, programmeCopyReplaces, programmePlanned, unplannedWeeks } from './weekPlans';

const T = '2026-10-21'; // Wednesday; the seed plans this week (19 Oct) and next week (26 Oct)
const THIS = '2026-10-19', NEXT = '2026-10-26', EMPTY = '2026-11-02';
const fresh = (): ClubState => buildSeed().citra;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, getUser({ citra: s }, uid)!, { today: T, nowMin: 600 }, 'wp' + Math.random()).state;
const KARAOKE = { activityId: 'act-karaoke', staffId: 's6', roomId: 'room-music' };

describe('KC round 15: each week has its own plan', () => {
  it('the seed plans this week and next week; the week after is empty for both the programme and the menu', () => {
    const s = fresh();
    expect([THIS, NEXT, EMPTY].map((m) => programmePlanned(s, m))).toEqual([true, true, false]);
    expect([THIS, NEXT, EMPTY].map((m) => menuPlanned(s, m))).toEqual([true, true, false]);
    expect(hasSessions(weekDays(s, EMPTY))).toBe(false);
    expect(hasDishes(templateForWeek(s, EMPTY, T))).toBe(false);
    expect(menuOn(s, '2026-11-05')).toEqual({ lunch: [], soft: [], tea: [] }); // (the 4th has a one-off lunch the kitchen planned ahead)
  });

  it('last week: the planned cells and dishes of the week before, not its one-day changes or one-off menus', () => {
    const s = produce(fresh(), (d) => {
      d.scheduleDays['2026-10-28'] = { id: '2026-10-28', clubId: d.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s9', date: '2026-10-28', slots: { '10:30': KARAOKE } };
      d.dayMenus['2026-10-28'] = { id: '2026-10-28', clubId: d.clubId, createdAt: `${T}T09:00`, createdBy: 'staff:s3', date: '2026-10-28', lunch: ['dish-rawon'], allergyPlans: [] };
    });
    const prog = lastWeekProgramme(s, EMPTY);
    expect(prog).toEqual(weekDays(s, NEXT));
    expect(prog[3]['10:30']?.activityId).toBe('act-keroncong'); // the plan, not the one-day Karaoke
    expect(sessionsOn(s, '2026-10-28')[0].cell).toEqual(KARAOKE);
    const menu = lastWeekMenu(s, EMPTY);
    expect(menu[3].lunch).not.toContain('dish-rawon');
    expect(menu).toEqual(templateForWeek(s, NEXT, T));
    expect(hasSessions(lastWeekProgramme(s, '2026-11-09'))).toBe(false); // the week before was never planned
  });

  it('copy: every day from today on takes last week’s; a day that has passed keeps its own; replacing asks first', () => {
    const s = fresh();
    const last = lastWeekProgramme(s, THIS);
    const draft = weekDays(s, THIS);
    draft[2]['10:30'] = KARAOKE; // Tuesday: already over
    draft[4]['10:30'] = KARAOKE; // Thursday: still to come
    const out = copyProgramme(draft, last, THIS, T);
    expect(out[2]['10:30']).toEqual(KARAOKE);
    expect(out[4]['10:30']).toEqual(last[4]['10:30']);
    expect(programmeCopyReplaces(draft, last, THIS, T)).toBe(true);
    expect(programmeCopyReplaces(out, last, THIS, T)).toBe(false); // already the same: nothing to replace
    expect(programmeCopyReplaces(weekDays(s, EMPTY), lastWeekProgramme(s, EMPTY), EMPTY, T)).toBe(false); // an empty week just copies
    const lastMenu = lastWeekMenu(s, EMPTY);
    const empty = templateForWeek(s, EMPTY, T);
    expect(menuCopyReplaces(empty, lastMenu, EMPTY, T)).toBe(false);
    const filled = copyMenu(empty, lastMenu, EMPTY, T);
    expect(filled).toEqual(lastMenu);
    filled[1].lunch.push('dish-rawon');
    expect(lastMenu[1].lunch).not.toContain('dish-rawon'); // a copy, not the same lists
    expect(menuCopyReplaces(filled, lastMenu, EMPTY, T)).toBe(true);
  });

  it('a copied week published for the empty week runs that week only; Today reminds while this or next week is unplanned', () => {
    const s = fresh();
    expect(unplannedWeeks(s, T)).toEqual([]); // this week and next week are planned
    expect(unplannedWeeks(s, NEXT)).toEqual([{ monday: EMPTY, programme: true, menu: true }]); // on Monday 26 Oct, next week is the empty one
    const p = run(s, 'schedule.publish', { effectiveFrom: EMPTY, days: lastWeekProgramme(s, EMPTY) }, 's9');
    expect(sessionsOn(p, '2026-11-04')[0].cell?.activityId).toBe('act-keroncong');
    expect(sessionsOn(p, '2026-11-11')).toEqual([]);
    expect(unplannedWeeks(p, NEXT)).toEqual([{ monday: EMPTY, programme: false, menu: true }]);
    const m = run(p, 'menu.publish', { effectiveFrom: EMPTY, days: lastWeekMenu(p, EMPTY) }, 's3'); // the kitchen's, waiting for management, counts
    expect(unplannedWeeks(m, NEXT)).toEqual([]);
    // a week the club is closed throughout needs no plan
    const shut = produce(s, (d) => { d.calendarEvents.shut = { id: 'shut', clubId: d.clubId, createdAt: '', createdBy: 'system', date: EMPTY, endDate: '2026-11-06', kind: 'closed', title: 'Renovation' }; });
    expect(unplannedWeeks(shut, NEXT)).toEqual([]);
  });
});
