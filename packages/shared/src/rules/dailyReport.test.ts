// KC round 7: the daily report on the 5-member seed. A past day (Mon 19 Oct), a day with a log waiting for approval (Tue 20), a day with an Alert reading (Wed 14),
// today read live (Wed 21 Oct, 09:58), a one-day change of the programme, a closed day and a weekend, and moving between days.
import { describe, it, expect } from 'vitest';
import { buildCitra } from '../seed/index';
import { memberName } from './core';
import { dailyReport, firstReportDay, nextReportDay, prevReportDay, reportDateOf } from './dailyReport';

const T = '2026-10-21'; // Wednesday, the demo day
const NOW = 598; // 09:58
const s = buildCitra();
const name = (r: { m: { firstName: string } }) => r.m.firstName;

describe('a past day', () => {
  const r = dailyReport(s, '2026-10-19', T, NOW);
  it('who came, with the times, the plan and the Flex visit', () => {
    expect(r.status.open).toBe(true);
    expect(r.counts).toMatchObject({ came: 5, trials: 0, visits: 0, lunches: 5, checks: 10 });
    expect(r.members).toHaveLength(5);
    const flex = r.members.filter((x) => x.plan === 'flex');
    expect(flex.length).toBeGreaterThan(0);
    for (const x of flex) { expect(x.flex!.n).toBeGreaterThan(0); expect(x.flex!.quota).toBeGreaterThan(0); }
    for (const x of r.members.filter((y) => y.plan === 'gold')) expect(x.flex).toBeUndefined();
    const lina = r.members.find((x) => x.m.id === 'm1')!;
    expect(lina.checkIn).toBe('10:08');
    expect(lina.checkOut).toBe('16:05');
    expect(lina.inClub).toBe(false);
    expect(r.members.map(name)).toEqual([...r.members.map(name)].sort());
  });
  it('the programme: both sessions done, a guest host leads the first, everybody joined, the pictures are counted', () => {
    expect(r.sessions.map((x) => [x.slot, x.state, x.activity?.name])).toEqual([['10:30', 'done', 'Angklung ensemble'], ['13:30', 'done', 'Chair yoga']]);
    expect(r.sessions[0].guest?.host.name).toBe('Bu Ratna');
    expect(r.sessions[1].guest).toBeNull();
    for (const x of r.sessions) { expect(x.joined).toHaveLength(5); expect(x.satOut).toHaveLength(0); expect(x.notMarked).toBe(0); expect(x.photos).toHaveLength(2); expect(x.changed).toBe(false); }
    expect(r.members[0].sessions.map((x) => x.mark)).toEqual(['joined', 'joined']);
  });
  it('lunch and tea: the menu, how much was eaten, nobody left unmarked', () => {
    expect(r.lunch.menu!.lunch.map((d) => d.name)).toContain('Ayam bakar kecap');
    expect(r.lunch.menu!.tea).toHaveLength(2);
    expect(r.lunch.served).toBe(true);
    expect(r.lunch.eaten).toEqual({ all: 3, most: 2, half: 0, little: 0, none: 0 });
    expect(r.lunch.low).toEqual([]);
    expect(r.lunch.notMarked).toBe(0);
    expect(r.lunch.photos.lunch).toHaveLength(1);
    expect(r.lunch.photos.tea).toHaveLength(1);
  });
  it('health checks: every reading, the people checked, the Watch ones with their values', () => {
    expect(r.health).toMatchObject({ readings: 10, people: 5, watch: 2, alert: 0 });
    expect(r.health.flagged.map((x) => [x.memberId, x.r.kind, x.r.sys, x.r.dia])).toEqual([['m2', 'arrival', 147, 92], ['m2', 'departure', 148, 91]]);
    expect(r.health.flagged[0].name).toBe(memberName(s.members.m2));
    expect(r.members.find((x) => x.m.id === 'm2')!.arrival?.status).toBe('watch');
  });
  it('mood and notes: the counts and the note written for the family', () => {
    expect(r.mood.counts).toEqual({ cheerful: 3, calm: 2, quiet: 0, agitated: 0 });
    expect(r.mood.notMarked).toBe(0);
    expect(r.mood.notes).toHaveLength(1);
    expect(r.mood.notes[0]).toMatchObject({ staff: false, pending: false });
    expect(r.mood.notes[0].text).toMatch(/Bengawan Solo/);
  });
  it('duties: the day has each role’s score; the photos counted are the ones taken (not the door camera’s)', () => {
    expect(r.duties.length).toBeGreaterThan(0);
    for (const d of r.duties) expect(d.done).toBeLessThanOrEqual(d.total);
    expect(r.counts.photos).toBeGreaterThanOrEqual(4 + 2); // the session pictures and the lunch and tea photos
    expect(r.empty).toBe(false);
  });
});

describe('what waits for approval stays visible, marked', () => {
  const r = dailyReport(s, '2026-10-20', T, NOW);
  it('a log waiting for approval: its sessions are not marked yet, its note and reading are flagged pending', () => {
    const budi = r.members.find((x) => x.log?.approval?.status === 'pending')!;
    expect(budi.m.id).toBe('m46');
    expect(budi.pendingLog).toBe(true);
    expect(budi.sessions.map((x) => x.mark)).toEqual([undefined, undefined]);
    expect(r.mood.pendingLogs).toBe(1);
    expect(r.mood.notes.find((n) => n.m.id === 'm46')).toMatchObject({ pending: true });
    expect(r.sessions.map((x) => [x.joined.length, x.notMarked])).toEqual([[3, 1], [3, 1]]);
    expect(budi.arrival?.approval?.status).toBe('pending');
  });
});

describe('an Alert reading', () => {
  it('comes first in the list, with its value and who it was', () => {
    const r = dailyReport(s, '2026-10-14', T, NOW);
    expect(r.health.alert).toBe(1);
    expect(r.health.flagged[0]).toMatchObject({ memberId: 'm2', pending: false });
    expect(r.health.flagged[0].r).toMatchObject({ status: 'alert', sys: 164, dia: 98 });
    expect(r.health.flagged.slice(1).every((x) => x.r.status === 'watch')).toBe(true);
    expect(r.sessions[0].guest?.host.name).toBe('Pak Hendro');
  });
});

describe('today, live', () => {
  it('at 09:58 the sessions and lunch have not started: nothing is "not marked" yet, and the booked guests are expected', () => {
    const r = dailyReport(s, T, T, NOW);
    expect(r.live).toBe(true);
    expect(r.counts.came).toBe(3);
    expect(r.members.every((x) => x.inClub)).toBe(true);
    expect(r.sessions.map((x) => x.state)).toEqual(['later', 'later']);
    expect(r.sessions.every((x) => x.notMarked === 0 && x.joined.length === 0)).toBe(true);
    expect(r.lunch.served).toBe(false);
    expect(r.lunch.notMarked).toBe(0);
    expect(r.mood.notMarked).toBe(3);
    expect(r.guests.map((g) => [g.g.kind, g.state])).toEqual(expect.arrayContaining([['trial', 'expected'], ['visit', 'expected']]));
    expect(r.counts).toMatchObject({ trials: 0, visits: 0 }); // booked, not come
    expect(r.health.readings).toBe(1);
  });
  it('later in the day a running session shows as now, and a finished one as done', () => {
    expect(dailyReport(s, T, T, 11 * 60).sessions.map((x) => x.state)).toEqual(['now', 'later']);
    expect(dailyReport(s, T, T, 14 * 60).sessions.map((x) => x.state)).toEqual(['done', 'now']);
    expect(dailyReport(s, T, T, 13 * 60).lunch.served).toBe(true);
    expect(dailyReport(s, T, T, 13 * 60).lunch.notMarked).toBe(3);
  });
});

describe('a one-day change of the programme', () => {
  it('is flagged with its note, and a booked guest host shows', () => {
    const fri = dailyReport(s, '2026-10-23', T, NOW);
    const sess = fri.sessions.find((x) => x.slot === '13:30')!;
    expect(sess).toMatchObject({ changed: true, note: 'Kak Dimas is off sick' });
    expect(sess.activity?.name).toMatch(/karaoke/i);
    expect(fri.sessions.find((x) => x.slot === '10:30')!.changed).toBe(false);
    const thu = dailyReport(s, '2026-10-22', T, NOW);
    expect(thu.sessions.find((x) => x.slot === '13:30')!.guest?.host.name).toBeTruthy();
    expect(thu.duties).toEqual([]); // a coming day has its sessions but no duty score
    expect(fri.duties).toEqual([]);
  });
});

describe('a closed day and a weekend', () => {
  it('says so and has nothing else', () => {
    const closed = dailyReport(s, '2026-10-30', T, NOW);
    expect(closed.status).toMatchObject({ open: false, reason: 'closed' });
    expect(closed.empty).toBe(true);
    expect(closed.members).toEqual([]);
    expect(closed.sessions).toEqual([]);
    expect(closed.lunch.menu).toBeNull();
    expect(closed.duties).toEqual([]);
    const sat = dailyReport(s, '2026-10-17', T, NOW);
    expect(sat.status).toMatchObject({ open: false, reason: 'weekend' });
    expect(sat.empty).toBe(true);
  });
  it('an outing day has no sessions but is an open day', () => {
    const o = dailyReport(s, '2026-10-29', T, NOW);
    expect(o.status).toMatchObject({ open: true });
    expect(o.sessions).toEqual([]);
  });
});

describe('moving between days', () => {
  it('‹ skips the weekend and closed days, › stops at today', () => {
    expect(prevReportDay(s, T)).toBe('2026-10-20');
    expect(prevReportDay(s, '2026-10-19')).toBe('2026-10-16');
    expect(nextReportDay(s, '2026-10-16', T)).toBe('2026-10-19');
    expect(nextReportDay(s, '2026-10-20', T)).toBe(T);
    expect(nextReportDay(s, T, T)).toBeNull();
    const first = firstReportDay(s)!;
    expect(prevReportDay(s, first)).toBeNull();
  });
  it('a ?date= link is a real date up to today, else today', () => {
    expect(reportDateOf('2026-10-14', T)).toBe('2026-10-14');
    expect(reportDateOf('2026-10-25', T)).toBe(T);
    expect(reportDateOf('soon', T)).toBe(T);
    expect(reportDateOf(null, T)).toBe(T);
    expect(reportDateOf('2026-13-45', T)).toBe(T);
  });
});
