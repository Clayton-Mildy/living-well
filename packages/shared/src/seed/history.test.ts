// Six months of demo history (history.ts): visits, readings, logs, session pictures and paid invoices behind the last 4 weeks, for the 5 hand-made members
// and the 40 background ones.
import { describe, it, expect } from 'vitest';
import {
  addDays, addMonths, buildSeed, dayStatus, DEMO_START_MIN, DEMO_TODAY, dow, extraDaysFor, flexMonth, invoiceStatus, isWeekday, live, membershipStatus, planOn,
  primaryContact, projectForFamily, stopsDue, suspensions, toMin, ym, type ClubState,
} from '../index';
import { existsSync } from 'node:fs';
import { onLeaveIn } from '../rules/leave';
import { demoMediaPath } from './demoMedia';
import { sessionsOn } from '../rules/kitchen';

const T = DEMO_TODAY;
const t0 = performance.now();
const s: ClubState = buildSeed(T, DEMO_START_MIN, { roster: true }).citra;
const buildMs = performance.now() - t0;
const members = live(s.members);
const visits = live(s.attendance).filter((a) => a.checkIn && a.date < T);
const OVER = new Set(['m61:2026-06', 'm73:2026-06', 'm75:2026-06']); // the planned extra days (history.ts), billed on the July invoice

describe('six months of history', () => {
  it('visits go back about 130 club days, on open days, inside each membership and never in a leave month', () => {
    const days = [...new Set(visits.map((a) => a.date))].sort();
    expect(days[0] <= addDays(T, -170)).toBe(true);
    expect(days.length).toBeGreaterThan(105);
    for (const a of visits) {
      const m = s.members[a.memberId];
      const cur = m.memberships[m.memberships.length - 1];
      expect(isWeekday(a.date) && dayStatus(s, a.date).open, a.id).toBe(true);
      expect(a.date >= m.memberships[0].start && (!cur.lastDay || a.date <= cur.lastDay), a.id).toBe(true);
      expect(onLeaveIn(m, ym(a.date)), a.id).toBe(false);
      expect(a.checkOut && toMin(a.checkOut.at) > toMin(a.checkIn!.at)).toBeTruthy();
    }
    // the club closed on the public holidays in between
    for (const d of ['2026-05-01', '2026-05-14', '2026-05-28', '2026-06-01', '2026-08-17']) expect(dayStatus(s, d).open, d).toBe(false);
    // a couple comes together; the Wijayas were away for two weeks in the summer
    const lina = new Set(visits.filter((a) => a.memberId === 'm1').map((a) => a.date));
    expect(visits.filter((a) => a.memberId === 'm46').filter((a) => lina.has(a.date)).length).toBeGreaterThan(lina.size * 0.9);
    const holiday = days.filter((d) => d >= '2026-07-01' && d <= '2026-08-31').filter((d) => !lina.has(d) && !s.attendance[`${d}:m46`]);
    expect(holiday.length).toBeGreaterThanOrEqual(8);
  });

  it('Gold comes about 4 days a week, Flex about 2 and never over the 10 visits (but the planned extra days); Tuesday and Thursday are busiest; arrivals peak 09:00 to 10:00', () => {
    const per = (id: string) => {
      const m = s.members[id];
      const from = m.memberships[0].start > addDays(T, -182) ? m.memberships[0].start : addDays(T, -182);
      return visits.filter((a) => a.memberId === id).length / ((new Date(T).getTime() - new Date(from).getTime()) / 604800000);
    };
    const steady = members.filter((m) => m.memberships[0].start < addDays(T, -190) && !m.memberships[0].lastDay && m.plans.length === 1);
    const gold = steady.filter((m) => m.plans[0].plan === 'gold').map((m) => per(m.id));
    const flex = steady.filter((m) => m.plans[0].plan === 'flex').map((m) => per(m.id));
    const avg = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
    expect(avg(gold)).toBeGreaterThan(3.5);
    expect(avg(gold)).toBeLessThan(4.6);
    expect(avg(flex)).toBeGreaterThan(1.6);
    expect(avg(flex)).toBeLessThan(2.6);
    for (const m of members) {
      for (let k = 1; k <= 6; k++) {
        const month = addMonths(ym(T), -k);
        const fm = flexMonth(s, m, month, T);
        if (fm.quota === null) continue;
        if (!OVER.has(`${m.id}:${month}`)) expect(fm.extra, `${m.id} ${month}`).toBe(0);
        else expect(fm.extra, `${m.id} ${month}`).toBeLessThanOrEqual(1);
      }
    }
    // a few Flex members used all 10 early, a few left several unused
    const used = members.flatMap((m) => (m.plans[m.plans.length - 1].plan === 'flex' ? [1, 2, 3, 4].map((k) => flexMonth(s, m, addMonths(ym(T), -k), T)) : []))
      .filter((f) => f.quota === 10 && f.visits.length > 0).map((f) => f.used);
    expect(used.filter((u) => u >= 10).length).toBeGreaterThanOrEqual(8);
    expect(used.filter((u) => u <= 6).length).toBeGreaterThanOrEqual(8);
    const byDay = [0, 0, 0, 0, 0, 0];
    const open = [0, 0, 0, 0, 0, 0];
    for (const d of new Set(visits.map((a) => a.date))) { byDay[dow(d)] += visits.filter((a) => a.date === d).length; open[dow(d)]++; }
    const avgDay = (w: number) => byDay[w] / open[w];
    expect(Math.min(avgDay(2), avgDay(4))).toBeGreaterThan(Math.max(avgDay(1), avgDay(5)));
    const peak = visits.filter((a) => toMin(a.checkIn!.at) >= 9 * 60 && toMin(a.checkIn!.at) < 10 * 60).length;
    expect(peak / visits.length).toBeGreaterThan(0.5);
    expect(visits.every((a) => toMin(a.checkIn!.at) >= 8 * 60 + 30 && toMin(a.checkOut!.at) >= 14 * 60 + 45 && toMin(a.checkOut!.at) <= 16 * 60 + 30)).toBe(true);
  });

  it('every visit has an arrival reading and a saved, approved daily log with a mark per scheduled session; readings are graded by the rules', () => {
    const readings = live(s.readings);
    const arrived = new Set(readings.filter((r) => r.kind === 'arrival').map((r) => `${r.date}:${r.memberId}`));
    const logged = live(s.dailyLogs);
    const logOf = new Map(logged.map((l) => [`${l.date}:${l.memberId}`, l]));
    // the nurse's latest arrival can be missing, and the teachers have the last two days' logs to write (background members)
    const old = visits.filter((a) => a.date < addDays(T, -7));
    expect(old.every((a) => arrived.has(a.id))).toBe(true);
    expect(old.every((a) => logOf.has(a.id))).toBe(true);
    for (const l of old.map((a) => logOf.get(a.id)!)) {
      expect(l.status === 'saved' && !l.approval).toBe(true);
      const slots = sessionsOn(s, l.date).filter((x) => x.cell).map((x) => x.slot);
      expect(Object.keys(l.sessions ?? {}).sort()).toEqual(slots.sort());
      expect(l.joined).toBe(Object.values(l.sessions!).every((x) => x === 'satOut') ? 'satOut' : 'yes'); // 'satOut' only when every session was sat out
    }
    expect(logged.filter((l) => l.note).length / logged.length).toBeGreaterThan(0.25);
    expect(logged.filter((l) => l.note).length / logged.length).toBeLessThan(0.45);
    expect(new Set(logged.filter((l) => l.memberId === 'm46').map((l) => l.note)).size).toBeGreaterThan(15);
    // the five: only Hendra and Tjahjadi are ever flagged; background members have a few Watch values, none in the last 3 weeks, each with a re-check
    const flagged = readings.filter((r) => r.status !== 'normal');
    expect(new Set(flagged.filter((r) => ['m1', 'm46', 'm10'].includes(r.memberId!)).map((r) => r.memberId)).size).toBe(0);
    const roster = flagged.filter((r) => !['m1', 'm46', 'm2', 'm10', 'm20'].includes(r.memberId!));
    expect(roster.length).toBeGreaterThan(5);
    expect(roster.length).toBeLessThan(40);
    expect(roster.every((r) => r.date <= addDays(T, -21) && r.status === 'watch' && r.shared && !!r.familyTold)).toBe(true);
    expect(roster.every((r) => readings.some((x) => x.kind === 'recheck' && x.memberId === r.memberId && x.date === r.date))).toBe(true);
    // Opa Hendra's pressure creeps up over the months; Opa Tjahjadi's glucose too (then the 196 of the story)
    const sysOf = (month: string) => { const r = readings.filter((x) => x.memberId === 'm2' && x.kind === 'arrival' && ym(x.date) === month); return r.reduce((t, x) => t + x.sys!, 0) / r.length; };
    expect(sysOf(addMonths(ym(T), -1)) - sysOf(addMonths(ym(T), -6))).toBeGreaterThan(8);
    const glucose = readings.filter((x) => x.memberId === 'm20' && x.kind === 'monthly').sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => x.glucose!);
    expect(glucose.length).toBeGreaterThanOrEqual(6);
    expect(glucose[0]).toBeLessThan(glucose[glucose.length - 2]);
    // one monthly check per member and month
    const monthly = readings.filter((r) => r.kind === 'monthly').map((r) => `${r.memberId}:${ym(r.date)}`);
    expect(new Set(monthly).size).toBe(monthly.length);
  });

  it('every past club day gets approved session pictures and a lunch photo, each a real demo scene (a file in apps/web/public/demo); today has none yet', () => {
    const pics = live(s.photos).filter((p) => p.kind === 'activity' && p.id.startsWith('pa'));
    expect(pics.length).toBeGreaterThan(300);
    expect(pics.some((p) => p.date < addDays(T, -28)) && pics.some((p) => p.date >= addDays(T, -28))).toBe(true); // the six months, not only the last 4 weeks
    for (const p of pics) {
      expect(p.visibility === 'visible' && (!!p.approved || p.date < addDays(T, -7)) && p.memberIds.length === 0, p.id).toBe(true);
      expect(p.date < T, p.id).toBe(true);
      expect(p.mediaId, p.id).toMatch(/^md_demo_(act|club|food)-/);
    }
    const isTea = (p: { id: string; date: string }) => !!s.dayMenus[p.date]?.teaPhotoIds?.includes(p.id); // KC round 7: the afternoon tea photos (seed/r7/tasks.ts) are kept in the tea gallery
    const lunch = live(s.photos).filter((p) => p.kind === 'lunch' && !isTea(p));
    expect(lunch.length).toBeGreaterThan(100);
    const tea = live(s.photos).filter((p) => p.kind === 'lunch' && isTea(p));
    expect(tea.length).toBeGreaterThan(80);
    for (const p of tea) expect(p.visibility === 'visible' && (!!p.approved || p.date < addDays(T, -7)) && p.date < T && /^md_demo_(food|club)-/.test(p.mediaId ?? ''), p.id).toBe(true);
    for (const p of lunch) {
      expect(p.visibility === 'visible' && (!!p.approved || p.date < addDays(T, -7)) && p.date < T, p.id).toBe(true);
      expect(p.mediaId, p.id).toMatch(/^md_demo_food-/);
      expect(s.dayMenus[p.date].photoIds, p.id).toContain(p.id);
    }
    expect(live(s.photos).some((p) => p.kind === 'lunch' && p.date >= T)).toBe(false); // today's lunch photo is taken at 12:00 in the demo
    // the made-up members keep their initials and their tagged photos stay placeholders: no real face on a member's record
    expect(members.every((m) => !m.photoMediaId)).toBe(true);
    expect(live(s.photos).filter((p) => p.memberIds.length > 0).every((p) => !p.mediaId)).toBe(true);
    // every activity has its own picture, and every demo id the seed uses is a file that is served and has the shape of an uploaded id
    expect(live(s.activities).every((a) => !!a.photoMediaId)).toBe(true);
    const ids = new Set([...live(s.activities).map((a) => a.photoMediaId!), ...pics.map((p) => p.mediaId!), ...lunch.map((p) => p.mediaId!), ...tea.map((p) => p.mediaId!)]);
    for (const id of ids) {
      expect(id).toMatch(/^md_[A-Za-z0-9_-]{8,}$/);
      expect(existsSync(new URL(`../../../../apps/web/public${demoMediaPath(id)}`, import.meta.url)), id).toBe(true);
    }
  });

  it('billing: every month before the two latest runs is a paid, synced invoice with its DOKU payment; nothing is on hold or due to stop; the extra days are billed on the next invoice', () => {
    const runs = live(s.invoiceRuns).sort((a, b) => (a.period < b.period ? -1 : 1));
    const older = runs.slice(0, -2);
    expect(older.length).toBeGreaterThanOrEqual(4);
    for (const run of older) {
      expect(run.issueDate).toBe(`${run.period}-21`);
      for (const id of run.invoiceIds) {
        const inv = s.invoices[id];
        expect(invoiceStatus(s, inv, T), id).toBe('paid');
        expect(inv.xero).toBe('synced');
        expect(isWeekday(inv.dueDate) && dayStatus(s, inv.dueDate).open, id).toBe(true);
        const pay = live(s.payments).find((p) => p.allocations.some((a) => a.invoiceId === id))!;
        expect(pay.xero).toBe('synced');
        if (pay.method === 'dokuVa') expect(pay.bank, id).toBeTruthy();
        expect(pay.receivedAt! >= '08:05' && pay.receivedAt! <= '16:30', id).toBe(true);
        expect(pay.receivedOn >= inv.issueDate && pay.receivedOn < T).toBe(true);
      }
    }
    expect(Object.keys(suspensions(s, T))).toEqual(['m20']); // Tjahjadi's story, nobody else
    expect(stopsDue(s, T)).toEqual([]);
    // the three planned extra days (June) are on the July invoices; a leave month costs the leave fee; a member's first invoice has the registration fee
    for (const k of OVER) { const [id, month] = k.split(':'); expect(extraDaysFor(s, s.members[id], month, T)).toHaveLength(1); expect(s.invoices[`INV-2607-${id.slice(1).padStart(3, '0')}`].lines.some((l) => l.kind === 'extraDay')).toBe(true); }
    const lines = (kind: string) => live(s.invoices).filter((i) => i.lines.some((l) => l.id.startsWith(kind)));
    expect(lines('leave-').length).toBe(2);
    expect(lines('reg-').length).toBeGreaterThanOrEqual(3);
    for (const i of lines('reg-')) expect(live(s.invoices).filter((x) => x.memberId === i.memberId && x.issueDate < i.issueDate)).toHaveLength(0);
    // every active member with a paying contact has an invoice for each month since they joined (or since the history began)
    const issued = new Set(live(s.invoices).map((i) => `${i.memberId}:${i.period}`));
    for (const m of members.filter((x) => planOn(x, T) && membershipStatus(x, T) === 'active' && x.memberships[0].start < addDays(T, -200))) {
      expect(primaryContact(s, m.id)).toBeTruthy();
      for (let k = 2; k <= 5; k++) { const p = addMonths(ym(T), -k); if (p >= '2026-05' && !onLeaveIn(m, p)) expect(issued.has(`${m.id}:${p}`), `${m.id} ${p}`).toBe(true); }
    }
  });

  it('is small and quick: under 5 MB of club state, a family’s share small, built in a couple of seconds', () => {
    expect(JSON.stringify(s).length).toBeLessThan(5_000_000);
    expect(JSON.stringify(projectForFamily(s, 'f1')).length).toBeLessThan(700_000);
    expect(buildMs).toBeLessThan(4000);
  });
});
