// The demo runs on today's date: the seed must tell the same story around any open day, not only 21 Oct 2026.
import { describe, it, expect } from 'vitest';
import {
  actionItems, addDays, addMonths, buildSeed, conflictsOn, demoDateFor, extraDaysFor, flexMonth, getUser, invoiceStatus, isWeekday, lobbyGroups,
  live, projectForFamily, wouldBeExtra, ym, dayStatus, type ClubState,
} from '../index';
import { stationQueue } from '../rules/healthStation';

const anchors: string[] = [];
for (let d = '2026-10-01'; d <= '2027-03-05'; d = addDays(d, 1)) if (isWeekday(d) && !['12-25', '01-01'].includes(d.slice(5))) anchors.push(d);

describe('seed around any demo day', () => {
  it.each(anchors)('%s', (T) => {
    const s: ClubState = buildSeed(T).citra;
    const month = ym(T);
    // nobody visits on a weekend or after today
    for (const a of live(s.attendance)) {
      expect(isWeekday(a.date), `attendance on ${a.date}`).toBe(true);
      expect(a.date <= T).toBe(true);
    }
    // the club is open; the three regulars are in; Lina and Budi can drop in
    expect(dayStatus(s, T).open).toBe(true);
    const g = lobbyGroups(s, T);
    expect(g.inClub.map((r) => r.m.id).sort()).toEqual(['m10', 'm2', 'm20']);
    expect(g.others.map((r) => r.m.id).sort()).toEqual(['m1', 'm46']);
    // Flex: Lina's extra day, live from mid-month, else last month's 11th visit on this month's invoice
    const lina = s.members.m1;
    const fm = flexMonth(s, lina, month, T);
    if (fm.used >= 10) expect(wouldBeExtra(s, lina, T)).toBe(true);
    else expect(extraDaysFor(s, lina, addMonths(month, -1), T)).toHaveLength(1);
    expect(fm.extra).toBe(0);
    // Bambang stays under his 10 visits and clashes with the fish soup
    expect(wouldBeExtra(s, s.members.m10, T)).toBe(false);
    expect(conflictsOn(s, T).map((c) => `${c.diner.id}:${c.dish.id}`)).toContain('m10:dish-sop-ikan');
    // billing: two runs, exactly one overdue invoice (Tjahjadi), no due date on a weekend
    expect(live(s.invoiceRuns)).toHaveLength(2);
    const overdue = live(s.invoices).filter((i) => invoiceStatus(s, i, T) === 'overdue');
    expect(overdue.map((i) => i.memberId)).toEqual(['m20']);
    for (const i of live(s.invoices)) expect(isWeekday(i.dueDate)).toBe(true);
    // the calendar and leads look ahead, on open days
    for (const e of live(s.calendarEvents).filter((x) => x.kind !== 'holiday')) { expect(e.date > T).toBe(true); expect(isWeekday(e.date)).toBe(true); }
    expect(new Set(live(s.calendarEvents).map((e) => e.date)).size).toBe(live(s.calendarEvents).length);
    for (const e of live(s.enquiries)) if (e.next?.date && e.stage !== 'trial' && e.stage !== 'visit') expect(e.next.date > T).toBe(true);
    expect(live(s.guestVisits).every((x) => x.date === T)).toBe(true);
    // the plan request starts next month; screens and rules run without errors
    expect(s.planChangeRequests['pcr-m10'].from).toBe(`${addMonths(month, 1)}-01`);
    expect(actionItems(s, getUser({ citra: s }, 's9')!, T, 598).length).toBeGreaterThan(0);
    expect(stationQueue(s, T, 598).todo.map((q) => q.personId)).toContain('m2');
    const fam = projectForFamily(s, 'f1');
    expect(Object.keys(fam.members)).toEqual(expect.arrayContaining(['m1', 'm46'])); // plus name-only stubs of people in shared group photos
    expect(fam.members.m2?.health.conditions ?? []).toEqual([]);
    // only Hendra (blood pressure) and Tjahjadi (glucose) are ever flagged
    expect([...new Set(live(s.readings).filter((r) => r.status !== 'normal').map((r) => r.memberId))].sort()).toEqual(['m2', 'm20']);
  });
});

describe('demo day', () => {
  it('is today in Jakarta, or the next open day', () => {
    expect(demoDateFor(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06'); // Tuesday
    expect(demoDateFor(new Date('2026-10-05T18:30:00Z'))).toBe('2026-10-06'); // 01:30 Tuesday in Jakarta
    expect(demoDateFor(new Date('2026-10-10T03:00:00Z'))).toBe('2026-10-12'); // Saturday → Monday
    expect(demoDateFor(new Date('2026-12-25T03:00:00Z'))).toBe('2026-12-28'); // Christmas (Friday) → Monday
    expect(demoDateFor(new Date('2026-10-10T03:00:00Z'), '2026-10-21')).toBe('2026-10-21'); // pinned
  });
});
