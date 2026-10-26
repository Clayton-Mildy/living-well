// First-load numbers the screens rely on (Wed 21 Oct 2026, 09:58).
import { describe, it, expect } from 'vitest';
import { buildSeed, suspensions, lobbyGroups, nurseQueue, dinersOn, conflictsOn, lunchSafety, invoiceStatus, live, flexMonth, wouldBeExtra, extraDaysFor, budgetWeek, surveyStats, toMin } from './index';
import type { ClubState } from './types';

const T = '2026-10-21';
const s = buildSeed().citra;
describe('seed', () => {
  it('lobby: 3 in the club; nobody is expected, Budi and Lina are in the check-in list by usual arrival', () => {
    const g = lobbyGroups(s, T);
    expect(g.inClub.map((r) => r.m.id).sort()).toEqual(['m10', 'm2', 'm20']);
    expect(g.goneHome).toHaveLength(0);
    expect(g.others.map((r) => r.m.id)).toEqual(['m46', 'm1']);
    expect(Object.keys(g).sort()).toEqual(['goneHome', 'inClub', 'others']);
  });
  it('nurse queue: Tjahjadi (monthly due) then Hendra; one reading done', () => {
    const q = nurseQueue(s, T, toMin('09:58'));
    expect(q.todo.map((x) => x.personId)).toEqual(['m20', 'm2']);
    expect(q.todo[0].monthly).toBe(true);
    expect(q.done).toHaveLength(1);
  });
  it('kitchen: 4 covers (3 in the club + trial guest); Bambang vs fish soup conflict', () => {
    expect(dinersOn(s, T).map((d) => d.id).sort()).toEqual(['g-e1', 'm10', 'm2', 'm20']);
    const c = conflictsOn(s, T);
    expect(c.map((x) => `${x.diner.id}:${x.dish.id}`)).toEqual(['m10:dish-sop-ikan']);
    expect(lunchSafety(s, 'm1', T).kind).toBe('clear');
    expect(lunchSafety(s, 'm10', T).kind).toBe('unknown');
  });
  it('billing: invoice day (the 21st). 1 overdue (Tjahjadi, Sep), 3 outstanding in Oct, Hendra and Bambang paid this morning; Tjahjadi is on hold, with the family’s word on the invoice', () => {
    const st = live(s.invoices).map((i) => [i.number, invoiceStatus(s, i, T)]);
    expect(st.filter(([, x]) => x === 'overdue')).toEqual([['INV-2609-020', 'overdue']]);
    expect(suspensions(s, T)).toMatchObject({ m20: { number: 'INV-2609-020', since: '2026-10-01', stopOn: '2026-10-03', told: true } });
    expect(Object.keys(suspensions(s, T))).toEqual(['m20']);
    expect(s.invoices['INV-2609-020'].callNotes).toHaveLength(1);
    expect(st.filter(([n, x]) => n.startsWith('INV-2610') && x === 'paid').map(([n]) => n)).toEqual(['INV-2610-002', 'INV-2610-010']);
    expect(live(s.invoices).filter((i) => i.period === '2026-10').every((i) => i.issueDate === '2026-10-21' && i.dueDate === '2026-10-28')).toBe(true);
    expect(st.filter(([n, x]) => n.startsWith('INV-2610') && x === 'outstanding')).toHaveLength(3);
  });
  it('flex visits: Lina has used all 10 October visits, so today is an extra day; Bambang 8 of 10; Gold never extra', () => {
    const fm = flexMonth(s, s.members.m1, '2026-10', T);
    expect([fm.quota, fm.used, fm.left, fm.extra]).toEqual([10, 10, 0, 0]);
    expect(wouldBeExtra(s, s.members.m1, T)).toBe(true);
    expect(flexMonth(s, s.members.m10, '2026-10', T)).toMatchObject({ quota: 10, used: 8, left: 2, extra: 0 });
    expect(wouldBeExtra(s, s.members.m10, '2026-10-22')).toBe(false);
    expect(wouldBeExtra(s, s.members.m46, T)).toBe(false);
    expect(flexMonth(s, s.members.m46, '2026-10', T)).toMatchObject({ quota: null, extra: 0 });
    // once she checks in today, 21 Oct is billed as an extra day on the November invoice
    const after: ClubState = { ...s, attendance: { ...s.attendance, [`${T}:m1`]: { ...s.attendance[`2026-10-20:m1`], id: `${T}:m1`, date: T, checkOut: undefined } } };
    expect(extraDaysFor(after, after.members.m1, '2026-10', T)).toEqual([T]);
  });
  it('budget week of 19 Oct: 6.12M / 0.84M / 1.42M used', () => {
    expect(budgetWeek(s, 'fnb', T).used).toBe(6120000);
    expect(budgetWeek(s, 'activities', T).used).toBe(840000);
    expect(budgetWeek(s, 'operations', T).used).toBe(1420000);
  });
  it('survey 3 of 4; no Messages data is seeded, and the answered meal feedback keeps its reply', () => {
    expect(surveyStats(s, s.surveys.sv1).rate).toBe(75);
    expect(Object.keys(s.threads)).toHaveLength(0);
    expect(Object.keys(s.messages)).toHaveLength(0);
    expect(s.feedback.c2).toMatchObject({ status: 'answered', replies: [{ by: 'staff:s3' }] });
    expect(Object.values(s.feedback).every((f) => f.threadId === undefined)).toBe(true);
  });
  it('only Hendra BP and Tjahjadi glucose are ever flagged', () => {
    const flagged = new Set(live(s.readings).filter((r) => r.status !== 'normal').map((r) => r.memberId));
    expect([...flagged].sort()).toEqual(['m2', 'm20']);
  });
  it('round 12 collections exist and start empty in Adina', () => {
    const { citra, adina } = buildSeed();
    for (const k of ['moodMarks', 'careCalls', 'celebrations'] as const) { expect(citra[k]).toBeTypeOf('object'); expect(adina[k]).toEqual({}); }
  });
  it('round 13 staff leave: the collection exists, Adina has none, Citra has the four seeded requests with their leave rows', () => {
    const { citra, adina } = buildSeed();
    expect(adina.leaveRequests).toEqual({});
    expect(citra.club.settings.leaveDays).toBe(5);
    expect(Object.keys(citra.leaveRequests).sort()).toEqual(['lv-1', 'lv-2', 'lv-3', 'lv-4']);
    expect(Object.values(citra.leaveRequests).map((x) => [x.staffId, x.status, x.days])).toEqual([['s5', 'approved', 2], ['s1', 'approved', 1], ['s1', 'pending', 2], ['s3', 'declined', 1]]);
    expect(citra.leaveRequests['lv-4'].note).toBe('Menu tasting that day; please pick another day');
    // an approved request has one staffTime leave row per day; a pending or declined one has none
    const rows = live(citra.staffTime).filter((t) => t.kind === 'leave');
    expect(rows).toHaveLength(3);
    for (const id of ['lv-1', 'lv-2']) {
      const lv = citra.leaveRequests[id];
      expect(rows.filter((t) => t.staffId === lv.staffId && t.date >= lv.from && t.date <= lv.to)).toHaveLength(lv.days);
    }
  });
  it('round 14 unpaid follow-ups: the collection exists; the small seed has none, the roster has a promise and a no answer on its two overdue invoices', () => {
    const { citra, adina } = buildSeed();
    expect(adina.unpaidFollowUps).toEqual({});
    expect(citra.unpaidFollowUps).toEqual({});
    const roster = buildSeed(undefined, undefined, { roster: true }).citra;
    const rows = Object.values(roster.unpaidFollowUps);
    expect(rows.map((f) => [f.invoiceId, f.memberId, f.calls.map((c) => c.outcome)])).toEqual([['INV-2609-020', 'm20', ['promised']], ['INV-2609-074', 'm74', ['noAnswer']]]);
    expect(rows[0].calls[0].promisedOn).toBe('2026-10-23');
    for (const f of rows) expect(f.calls[0].at < `${T}T09:58`).toBe(true);
  });
});
