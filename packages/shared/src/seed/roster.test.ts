// The 45-member demo club: the opt-in roster (roster.ts) adds 40 background members to the 5 hand-made ones.
import { describe, it, expect } from 'vitest';
import {
  addDays, buildSeed, dayStatus, DEMO_START_MIN, DEMO_TODAY, invoiceStatus, isWeekday, live, lobbyGroups, membershipStatus, planOn, primaryContact,
  projectForFamily, runPreview, flexMonth, ym, toMin, type ClubState,
} from '../index';

const build = (T = DEMO_TODAY, nowMin = DEMO_START_MIN) => buildSeed(T, nowMin, { roster: true }).citra;
const extra = (s: ClubState) => live(s.members).filter((m) => /^m(5\d|[6-8]\d|90)$/.test(m.id));

describe('demo roster', () => {
  it('is off by default (the 5-member world the other tests use)', () => {
    expect(Object.keys(buildSeed().citra.members).sort()).toEqual(['m1', 'm10', 'm2', 'm20', 'm46']);
  });

  it('adds 40 complete members', () => {
    const s = build();
    expect(Object.keys(s.members)).toHaveLength(45);
    expect(extra(s)).toHaveLength(40);
    for (const m of extra(s)) {
      expect(primaryContact(s, m.id), m.id).toBeTruthy();
      expect(primaryContact(s, m.id)!.phone).toMatch(/^\+628\d{8,11}$/);
      expect(m.plans.length).toBeGreaterThan(0);
      expect(m.memberships).toHaveLength(1);
      expect(['Oma', 'Opa', 'Ibu', 'Bapak']).toContain(m.title);
      expect(m.title === 'Oma' || m.title === 'Ibu' ? 'f' : 'm').toBe(m.gender);
      expect(m.documents.some((d) => d.type === 'membershipForm' && d.status === 'onFile' && d.via === 'staff')).toBe(true);
      expect(m.billing.va).toMatch(/^8808\d{12}$/);
      const age = (+DEMO_TODAY.slice(0, 4)) - +m.dob!.slice(0, 4);
      expect(age).toBeGreaterThanOrEqual(65);
      expect(age).toBeLessThanOrEqual(92);
    }
    // every collection id is unique across the old and new rows by construction (keyed objects); check the virtual accounts and phones too
    const vas = live(s.members).map((m) => m.billing.va);
    expect(new Set(vas).size).toBe(vas.length);
    const phones = [...live(s.familyContacts), ...live(s.staff)].map((x) => x.phone);
    expect(new Set(phones).size).toBe(phones.length);
    for (const l of live(s.familyLinks)) { expect(s.members[l.memberId], l.id).toBeTruthy(); expect(s.familyContacts[l.familyId], l.id).toBeTruthy(); }
    // a quarter have an allergy; Flex and Gold are both common; a few end this month, a few have ended
    const allergic = extra(s).filter((m) => m.health.food.length || m.health.drugs.length).length;
    expect(allergic).toBeGreaterThanOrEqual(8);
    expect(allergic).toBeLessThanOrEqual(12);
    const plans = extra(s).map((m) => planOn(m, DEMO_TODAY).plan);
    expect(plans.filter((p) => p === 'gold').length).toBeGreaterThanOrEqual(12);
    expect(plans.filter((p) => p === 'flex').length).toBeGreaterThanOrEqual(12);
    const life = extra(s).map((m) => membershipStatus(m, DEMO_TODAY));
    expect(life.filter((x) => x === 'ending')).toHaveLength(3);
    expect(life.filter((x) => x === 'ended')).toHaveLength(3);
    expect(life.filter((x) => x === 'upcoming')).toHaveLength(0);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    expect(JSON.stringify(build('2026-12-04', 700))).toBe(JSON.stringify(build('2026-12-04', 700)));
  });

  it('keeps visits, invoices and the lobby consistent', () => {
    const s = build();
    // visits: weekdays only, on open days, never before the member started or after they left, Flex within the quota
    for (const m of extra(s)) {
      const days = live(s.attendance).filter((a) => a.memberId === m.id).map((a) => a.date);
      for (const d of days) { expect(isWeekday(d)).toBe(true); expect(dayStatus(s, d).open).toBe(true); expect(d >= m.memberships[0].start).toBe(true); expect(!m.memberships[0].lastDay || d <= m.memberships[0].lastDay).toBe(true); }
      const fm = flexMonth(s, m, ym(DEMO_TODAY), DEMO_TODAY);
      expect(fm.extra, m.id).toBe(0);
      expect(flexMonth(s, m, ym(addDays(DEMO_TODAY, -28)), DEMO_TODAY).extra, m.id).toBe(0);
    }
    const g = lobbyGroups(s, DEMO_TODAY);
    const rosterIn = [...g.inClub, ...g.goneHome].filter((x) => extra(s).some((m) => m.id === x.m.id));
    expect(rosterIn.length).toBeGreaterThanOrEqual(11);
    expect(rosterIn.length).toBeLessThanOrEqual(15);
    expect(g.inClub.length + g.goneHome.length).toBe(live(s.attendance).filter((a) => a.date === DEMO_TODAY).length);
    // invoices: last two runs, a few overdue / outstanding, all payments allocated to a real invoice
    const mine = live(s.invoices).filter((i) => extra(s).some((m) => m.id === i.memberId));
    expect(mine.length).toBeGreaterThan(40);
    const open = mine.filter((i) => ['overdue', 'outstanding', 'partial'].includes(invoiceStatus(s, i, DEMO_TODAY)));
    expect(new Set(open.map((i) => i.memberId)).size).toBeLessThanOrEqual(4);
    expect(new Set(open.map((i) => i.memberId)).size).toBeGreaterThanOrEqual(2);
    expect(mine.filter((i) => invoiceStatus(s, i, DEMO_TODAY) === 'overdue').length).toBeGreaterThanOrEqual(1);
    for (const p of live(s.payments)) for (const a of p.allocations) expect(s.invoices[a.invoiceId], p.id).toBeTruthy();
    for (const run of live(s.invoiceRuns)) for (const iid of run.invoiceIds) expect(s.invoices[iid], iid).toBeTruthy();
    expect(() => runPreview(s, '2026-11', DEMO_TODAY)).not.toThrow();
    expect(runPreview(s, '2026-11', DEMO_TODAY).filter((r) => r.skipped === 'noPayer')).toEqual([]);
    expect(Object.keys(projectForFamily(s, primaryContact(s, 'm51')!.id).members)).toContain('m51');
  });

  it('shows today\'s check-ins only once their time has passed', () => {
    const arrivals = (nowMin: number) => {
      const s = build(DEMO_TODAY, nowMin);
      return live(s.attendance).filter((a) => a.date === DEMO_TODAY && /^m(5\d|[6-8]\d|90)$/.test(a.memberId));
    };
    for (const nowMin of [toMin('07:00'), toMin('09:00'), DEMO_START_MIN, toMin('12:00'), toMin('15:00'), toMin('17:00')]) {
      const rows = arrivals(nowMin);
      for (const a of rows) {
        expect(toMin(a.checkIn!.at)).toBeLessThanOrEqual(nowMin);
        if (a.checkOut) expect(toMin(a.checkOut.at)).toBeLessThanOrEqual(nowMin);
      }
      const s = build(DEMO_TODAY, nowMin);
      for (const x of live(s.readings).filter((r) => r.date === DEMO_TODAY)) expect(toMin(x.time)).toBeLessThanOrEqual(nowMin);
    }
    expect(arrivals(toMin('07:00'))).toHaveLength(0);
    expect(arrivals(toMin('09:58')).length).toBeGreaterThanOrEqual(11);
    expect(arrivals(toMin('17:00'))).toHaveLength(15);
    expect(arrivals(toMin('17:00')).every((a) => a.checkOut)).toBe(true);
    const mid = arrivals(toMin('15:00'));
    expect(mid.filter((a) => a.checkOut).length).toBeGreaterThanOrEqual(2); // a few already gone home
    expect(mid.filter((a) => !a.checkOut).length).toBeGreaterThanOrEqual(5);
  });

  it('works around other days', () => {
    for (const T of ['2026-10-06', '2026-10-30', '2026-11-02', '2026-12-28', '2027-02-17']) {
      const s = build(T, 620);
      expect(live(s.members)).toHaveLength(45);
      for (const a of live(s.attendance)) expect(a.date <= T && isWeekday(a.date)).toBe(true);
      for (const m of extra(s)) expect(primaryContact(s, m.id)).toBeTruthy();
      expect(() => lobbyGroups(s, T)).not.toThrow();
      expect(() => runPreview(s, ym(addDays(T, 31)), T)).not.toThrow();
    }
  });
});
