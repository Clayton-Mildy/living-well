// Family selectors for a drop-in club: switcher, the member's day, plan card (Flex visits, Gold), timeline, lunch line, photos, invoices, comments.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, projectForFamily, lunchSafety, flexQuota, type ClubState, type Message } from '../index';
import {
  BANKS, combinedVa, dayStateOf, extraPriceFor, familyMembers, familyPhotoDays, healthMemberOf, historyRows, homeTime, invoiceRows, isFamilyPhoto, logComments, mayStillCome, nextIssueDate,
  openInvoiceRows, openTotal, photoActivityLabel, photosInOrder, planSummary, resolveSel, selWho, servedLunch, sharedNoteOf, timelineOf, vaFor, billingContactOf, latestLog, careThread, dishNamesOf,
} from './family';

const T = '2026-10-21';
const NOW = 598; // 09:58
const seed = () => buildSeed().citra;
const as = (s: ClubState, uid: string, name: string, input: unknown, mid: string, clk = { today: T, nowMin: 600 }) => execute(s, name, input, getUser({ citra: s }, uid)!, clk, mid);
type Ms = { start: string; lastDay?: string }[];
const setMemberships = (s: ClubState, id: string, ms: Ms) => { (s.members[id] as { memberships: Ms }).memberships = ms; };

describe('member switcher', () => {
  it('lists the members a family is linked to, in link order; "both" only for more than one', () => {
    const s = seed();
    expect(familyMembers(s, 'f1', T)).toEqual({ all: ['m1', 'm46'], choices: ['m1', 'm46'] });
    expect(familyMembers(s, 'fm10_0', T).choices).toEqual(['m10']);
    expect(resolveSel(undefined, ['m1', 'm46'])).toBe('both');
    expect(resolveSel('m46', ['m1', 'm46'])).toBe('m46');
    expect(resolveSel('m99', ['m1', 'm46'])).toBe('both');
    expect(resolveSel('both', ['m10'])).toBe('m10');
    expect(selWho('both', ['m1', 'm46'])).toEqual(['m1', 'm46']);
    expect(selWho('m46', ['m1', 'm46'])).toEqual(['m46']);
  });
  it('Health shows one member: the selected one, or the first when "both" is selected', () => {
    expect(healthMemberOf('m46', ['m1', 'm46'])).toBe('m46');
    expect(healthMemberOf('both', ['m1', 'm46'])).toBe('m1');
  });
  it('ended members drop out of the switcher unless every membership has ended', () => {
    const s = seed();
    setMemberships(s, 'm46', [{ start: '2025-03-03', lastDay: '2026-10-09' }]);
    expect(familyMembers(s, 'f1', T)).toEqual({ all: ['m1', 'm46'], choices: ['m1'] });
    setMemberships(s, 'm1', [{ start: '2025-03-03', lastDay: '2026-10-02' }]);
    expect(familyMembers(s, 'f1', T).choices).toEqual(['m1', 'm46']);
    // a scheduled last day in the future is still a member
    const s2 = seed();
    setMemberships(s2, 'm46', [{ start: '2025-03-03', lastDay: '2026-10-30' }]);
    expect(familyMembers(s2, 'f1', T).choices).toEqual(['m1', 'm46']);
  });
});

describe('dayStateOf: members drop in, nobody is expected', () => {
  it('at 09:58 Bambang is in the club; Lina and Budi simply have not come yet', () => {
    const s = seed();
    expect(dayStateOf(s, s.members.m1, T)).toEqual({ kind: 'away' });
    expect(dayStateOf(s, s.members.m46, T)).toEqual({ kind: 'away' });
    expect(dayStateOf(s, s.members.m10, T)).toMatchObject({ kind: 'here', since: '09:48' });
    expect(dayStateOf(s, s.members.m20, T)).toMatchObject({ kind: 'here', since: '09:38' });
  });
  it('a check-in makes the member "here" with the time; a check-out makes them "home" with the time', () => {
    const s = seed();
    const inn = as(s, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 'd1');
    expect(dayStateOf(inn.state, inn.state.members.m1, T)).toMatchObject({ kind: 'here', since: '10:00' });
    const out = as(inn.state, 's1', 'attendance.checkOut', { memberId: 'm1' }, 'd2', { today: T, nowMin: 965 });
    expect(dayStateOf(out.state, out.state.members.m1, T)).toMatchObject({ kind: 'home', at: '16:05' });
  });
  it('closed days, weekends and holidays are told apart; ended and upcoming memberships too', () => {
    const s = seed();
    expect(dayStateOf(s, s.members.m1, '2026-10-24')).toMatchObject({ kind: 'closed', reason: 'weekend', next: '2026-10-26' });
    expect(dayStateOf(s, s.members.m1, '2026-10-30')).toMatchObject({ kind: 'closed', reason: 'closed', next: '2026-11-02' });
    expect(dayStateOf(s, s.members.m1, '2026-12-25')).toMatchObject({ kind: 'closed', reason: 'holiday' });
    const ended = seed();
    setMemberships(ended, 'm1', [{ start: '2025-03-03', lastDay: '2026-10-09' }]);
    expect(dayStateOf(ended, ended.members.m1, T)).toEqual({ kind: 'ended', lastDay: '2026-10-09' });
    const later = seed();
    setMemberships(later, 'm1', [{ start: '2026-11-02' }]);
    expect(dayStateOf(later, later.members.m1, T)).toEqual({ kind: 'upcoming', start: '2026-11-02' });
  });
});

describe('mayStillCome: "right now" until the club closes', () => {
  it('a member who has not come may still drop in until closing time; after that "not at the club" is final for the day', () => {
    const s = seed();
    expect(mayStillCome(s, 7 * 60)).toBe(true); // before opening
    expect(mayStillCome(s, NOW)).toBe(true); // 09:58
    expect(mayStillCome(s, 16 * 60 + 29)).toBe(true);
    expect(mayStillCome(s, 16 * 60 + 30)).toBe(false); // closes at 16:30
    expect(mayStillCome(s, 18 * 60)).toBe(false);
  });
});

describe('planSummary: Flex visits and Gold, from check-ins', () => {
  it('Oma Lina has used all 10 October visits; her next visit is an extra day', () => {
    const s = seed();
    const p = planSummary(s, s.members.m1, T);
    expect(p).toMatchObject({ plan: 'flex', ended: false, month: '2026-10', quota: 10, used: 10, left: 0, extra: [], invoiceMonth: '2026-11', price: 650000 });
    expect(p.visits).toEqual(['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-20']);
  });
  it('checking her in today makes the 11th visit an extra day billed next month; the plan card still reads 10 of 10', () => {
    const s = seed();
    const r = as(s, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 'p1');
    expect(r.result.extra).toBe(true);
    const p = planSummary(r.state, r.state.members.m1, T);
    expect(p).toMatchObject({ quota: 10, used: 10, left: 0, extra: ['2026-10-21'], invoiceMonth: '2026-11', price: 650000 });
    expect(p.visits).toHaveLength(11);
  });
  it('Bambang (Flex) is at 8 of 10 including today; Gold has no quota and no extra days', () => {
    const s = seed();
    expect(planSummary(s, s.members.m10, T)).toMatchObject({ plan: 'flex', quota: 10, used: 8, left: 2, extra: [] });
    const gold = planSummary(s, s.members.m46, T);
    expect(gold).toMatchObject({ plan: 'gold', quota: null, left: null, extra: [] });
    expect(gold.used).toBe(gold.visits.length); // visits so far this month
    expect(gold.visits[0]).toBe('2026-10-01');
    // a Gold member checking in many days is never extra
    const r = as(s, 's1', 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 'p2');
    expect(r.result.extra).toBe(false);
    expect(planSummary(r.state, r.state.members.m46, T).extra).toEqual([]);
  });
  it('the month and the price come from the clock and the data, not a fixed month', () => {
    const s = seed();
    expect(planSummary(s, s.members.m1, '2026-11-02')).toMatchObject({ month: '2026-11', used: 0, left: 10, visits: [], invoiceMonth: '2026-12' });
    expect(extraPriceFor(s, '2026-10-27')).toEqual({ invoiceMonth: '2026-11', price: 650000 });
    expect(extraPriceFor(s, '2026-12-14').invoiceMonth).toBe('2027-01');
  });
  it('a part month is prorated: the quota follows the member’s open days', () => {
    const s = seed();
    setMemberships(s, 'm10', [{ start: '2026-10-15' }]);
    const p = planSummary(s, s.members.m10, T);
    expect(p.quota).toBe(flexQuota(s, s.members.m10, '2026-10'));
    expect(p.quota).toBeLessThan(10);
    expect(p.quota).toBeGreaterThan(0);
  });
  it('an ended membership says so', () => {
    const s = seed();
    setMemberships(s, 'm1', [{ start: '2025-03-03', lastDay: '2026-10-09' }]);
    expect(planSummary(s, s.members.m1, T).ended).toBe(true);
  });
  it('a family’s projected state gives the same card', () => {
    const s = seed();
    const proj = projectForFamily(s, 'f1');
    expect(planSummary(proj, proj.members.m1, T)).toEqual(planSummary(s, s.members.m1, T));
    expect(planSummary(proj, proj.members.m46, T)).toEqual(planSummary(s, s.members.m46, T));
  });
});

describe('timeline: the club programme either way', () => {
  it('Lina has not come yet: the programme only, no arrival, health or home item, nothing "expected"', () => {
    const s = seed();
    const tl = timelineOf(s, [s.members.m1], T, NOW);
    expect(tl.map((x) => `${x.id}:${x.state}`)).toEqual(['session-10:30:up', 'lunch:up', 'session-13:30:up', 'tea:up']);
    const lunch = tl.find((x) => x.kind === 'lunch');
    expect(lunch).toMatchObject({ time: '12:00', start: 720, end: 810 });
    expect(tl.find((x) => x.kind === 'session')).toMatchObject({ activityId: 'act-keroncong', staffId: 's5' });
  });
  it('once checked in the arrival item appears with the real time, then the health check and home time to come', () => {
    const s = seed();
    const r = as(s, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 't1');
    const tl = timelineOf(r.state, [r.state.members.m1], T, 600);
    expect(tl.map((x) => x.id)).toEqual(['arrival', 'health', 'session-10:30', 'lunch', 'session-13:30', 'tea', 'home']);
    expect(tl[0]).toMatchObject({ kind: 'arrival', state: 'done', time: '10:00' });
    expect(tl[1]).toMatchObject({ kind: 'health', state: 'up', time: '' });
    expect(tl[tl.length - 1]).toMatchObject({ kind: 'home', state: 'up', time: '16:00' });
  });
  it('Bambang, in the club at 09:58, then at 10:45 and 13:40', () => {
    const s = seed();
    const at = (min: number) => timelineOf(s, [s.members.m10], T, min).map((x) => `${x.id}:${x.state}`);
    expect(at(NOW)).toEqual(['arrival:done', 'health:done', 'session-10:30:up', 'lunch:up', 'session-13:30:up', 'tea:up', 'home:up']);
    expect(at(645)).toContain('session-10:30:now');
    expect(at(820)).toEqual(['arrival:done', 'health:done', 'session-10:30:done', 'lunch:done', 'session-13:30:now', 'tea:up', 'home:up']);
    expect(at(930)).toContain('tea:now');
    expect(timelineOf(s, [s.members.m10], T, 600)[1]).toMatchObject({ kind: 'health', arrival: { sys: 122, dia: 73 } });
  });
  it('if the lobby undoes a check-in the day is empty again, even though a reading was taken', () => {
    const s = seed();
    const r = as(s, 's1', 'attendance.undoCheckIn', { memberId: 'm10' }, 't2');
    expect(dayStateOf(r.state, r.state.members.m10, T)).toEqual({ kind: 'away' });
    expect(timelineOf(r.state, [r.state.members.m10], T, NOW).map((x) => x.id)).toEqual(['session-10:30', 'lunch', 'session-13:30', 'tea']);
    expect(planSummary(r.state, r.state.members.m10, T).used).toBe(7); // the visit no longer counts
  });
  it('after check-out home time shows the actual time, and only what the member was there for', () => {
    const early = seed();
    early.attendance[`${T}:m10`] = { ...early.attendance[`${T}:m10`], checkOut: { at: '12:30', by: 'staff:s1', method: 'manual' } };
    const tl = timelineOf(early, [early.members.m10], T, 780);
    expect(tl.map((x) => `${x.id}:${x.state}`)).toEqual(['arrival:done', 'health:done', 'session-10:30:done', 'lunch:done', 'home:done']);
    expect(tl[tl.length - 1]).toMatchObject({ kind: 'home', time: '12:30' });
    const late = seed();
    late.attendance[`${T}:m10`] = { ...late.attendance[`${T}:m10`], checkOut: { at: '15:45', by: 'staff:s1', method: 'manual' } };
    expect(timelineOf(late, [late.members.m10], T, 950).map((x) => x.state).every((x) => x === 'done')).toBe(true);
  });
  it('Both mode lists the programme only and follows whoever has been at the club', () => {
    const s = seed();
    const tl = timelineOf(s, [s.members.m1, s.members.m46], T, NOW);
    expect(tl.map((x) => x.kind)).toEqual(['session', 'lunch', 'session', 'tea']);
    expect(tl.every((x) => x.state === 'up')).toBe(true); // neither is at the club yet
    const mixed = timelineOf(s, [s.members.m10, s.members.m20], T, 700);
    expect(mixed.find((x) => x.kind === 'session')?.state).toBe('now');
  });
  it('an outing day replaces the sessions; closed days have no timeline', () => {
    const s = seed();
    const out = timelineOf(s, [s.members.m46], '2026-10-29', NOW);
    expect(out.map((x) => x.kind)).toEqual(['outing']);
    expect(out[0]).toMatchObject({ time: '08:30', start: 510, end: 900 });
    expect(timelineOf(s, [s.members.m1], '2026-10-24', NOW)).toEqual([]); // Saturday
    expect(timelineOf(s, [s.members.m1], '2026-10-30', NOW)).toEqual([]); // closure
  });
  it('home time comes from the club hours', () => {
    expect(homeTime(seed())).toBe('16:00');
  });
});

describe('lunch line', () => {
  it('Lina (shellfish) is clear before she arrives; Bambang (seafood) has no reassurance until the kitchen serves an alternative', () => {
    const s = seed();
    expect(lunchSafety(s, 'm1', T)).toEqual({ kind: 'clear' });
    expect(lunchSafety(s, 'm10', T).kind).toBe('unknown');
    expect(lunchSafety(s, 'm46', T).kind).toBe('none');
    const plan = as(s, 's3', 'allergyPlan.set', { date: T, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Grilled chicken' }, 'l1');
    expect(lunchSafety(plan.state, 'm10', T)).toEqual({ kind: 'alternative', dish: 'Sop ikan kakap', alternative: 'Grilled chicken' });
  });
  it('a member who is not at the club still gets an honest answer', () => {
    const s = seed();
    (s.members.m1.health as { food: string[] }).food = ['fish']; // Oma Lina has not checked in today
    expect(lunchSafety(s, 'm1', T).kind).toBe('unknown');
  });
  it('what a member is served: the soft option for a soft diet', () => {
    const s = seed();
    expect(dishNamesOf(s, servedLunch(s, s.members.m1, T))).toEqual(['Sop ikan kakap', 'Nasi merah', 'Tumis buncis wortel', 'Pepaya']);
    expect(dishNamesOf(s, servedLunch(s, s.members.m20, T))).toEqual(['Bubur ikan']);
  });
});

describe('notes, logs and comments', () => {
  it('the shared note is each member’s own: pinned first', () => {
    const s = seed();
    expect(sharedNoteOf(s, 'm1')?.text).toMatch(/Bengawan Solo/);
    expect(sharedNoteOf(s, 'm46')?.text).toMatch(/pharmacist/);
    expect(sharedNoteOf(s, 'm1')?.id).toBe('n-m1-1');
    const p = projectForFamily(s, 'f1');
    expect(sharedNoteOf(p, 'm1')?.visibility).toBe('family');
  });
  it('the latest saved log up to today', () => {
    const s = seed();
    expect(latestLog(s, 'm1', T)?.date).toBe('2026-10-20');
    expect(latestLog(s, 'm1', '2026-10-15')?.date).toBe('2026-10-14');
  });
  it('comments under a log are the family’s messages that reference it plus the staff replies after them', () => {
    const s = seed();
    const log = latestLog(s, 'm1', T)!;
    const th = { id: 'th1', clubId: 'citra', createdAt: '', createdBy: 'family:f1' as const, memberId: 'm1', familyId: 'f1', topic: 'care' as const, lastSeq: 5, staffReadSeq: 0, familyReadSeq: 0 };
    const msg = (seq: number, from: Message['from'], text: string, ref?: Message['ref'], kind: Message['kind'] = 'text'): Message => ({ id: 'm' + seq, clubId: 'citra', createdAt: '', createdBy: from, threadId: 'th1', seq, from, at: `2026-10-20T1${seq}:00`, text, kind, ...(ref ? { ref } : {}) });
    const c = { ...s, threads: { th1: th }, messages: Object.fromEntries([
      msg(1, 'family:f1', 'Thank you Dinar!', { type: 'dailyLog', id: log.id }),
      msg(2, 'staff:s5', 'She loved it.'),
      msg(3, 'staff:s5', 'Autoreply', undefined, 'autoAck'),
      msg(4, 'family:f1', 'Unrelated question about Friday'),
      msg(5, 'staff:s1', 'Answer about Friday'),
    ].map((m) => [m.id, m])) } as ClubState;
    expect(careThread(c, 'f1', 'm1')?.id).toBe('th1');
    expect(logComments(c, careThread(c, 'f1', 'm1'), log.id).map((m) => m.text)).toEqual(['Thank you Dinar!', 'She loved it.']);
    expect(logComments(c, careThread(c, 'f1', 'm1'), 'another-log')).toEqual([]);
    expect(logComments(c, undefined, log.id)).toEqual([]);
  });
});

describe('photos', () => {
  it('only staff-taken visible solo and group photos; solo first, group after; newest day first', () => {
    const s = seed();
    const days = familyPhotoDays(s, ['m1']);
    expect(days.length).toBeGreaterThan(0);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort().reverse());
    for (const d of days) {
      expect(d.count).toBe(d.sets.reduce((t, x) => t + x.photos.length, 0));
      const kinds = d.sets.map((x) => x.kind);
      expect(kinds.indexOf('group')).toBeGreaterThanOrEqual(kinds.includes('solo') ? kinds.indexOf('solo') : 0);
      expect(d.sets.flatMap((x) => x.photos).every(isFamilyPhoto)).toBe(true);
    }
    const hidden = seed();
    const first = days[0].sets[0].photos[0];
    hidden.photos[first.id] = { ...first, visibility: 'hidden' };
    expect(photosInOrder(familyPhotoDays(hidden, ['m1'])).some((p) => p.id === first.id)).toBe(false);
  });
  it('a check-in’s door-camera arrival photo is not a family photo', () => {
    const s = seed();
    const r = as(s, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 'ph1');
    const arrival = Object.values(r.state.photos).filter((p) => p.kind === 'arrival' && p.memberIds.includes('m1') && p.date === T);
    expect(arrival.length).toBeGreaterThan(0);
    expect(photosInOrder(familyPhotoDays(r.state, ['m1'])).some((p) => p.kind === 'arrival')).toBe(false);
  });
  it('Both mode: each parent’s solo photos, then group photos with both, then the rest; a photo shows once', () => {
    const s = seed();
    const days = familyPhotoDays(s, ['m1', 'm46']);
    const ids = photosInOrder(days).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const withBoth = days.flatMap((d) => d.sets).find((x) => x.kind === 'both');
    if (withBoth) expect(withBoth.photos.every((p) => p.memberIds.includes('m1') && p.memberIds.includes('m46'))).toBe(true);
    expect(days.flatMap((d) => d.sets).filter((x) => x.kind === 'solo').map((x) => x.memberId)).toEqual(expect.arrayContaining(['m1', 'm46']));
  });
  it('the photos a family receives are enough to build the same lists (projection)', () => {
    const s = seed();
    const p = projectForFamily(s, 'f1');
    expect(photosInOrder(familyPhotoDays(p, ['m1', 'm46'])).map((x) => x.id)).toEqual(photosInOrder(familyPhotoDays(s, ['m1', 'm46'])).map((x) => x.id));
  });
  it('Indonesian activity names come from the catalogue', () => {
    const s = seed();
    expect(photoActivityLabel(s, 'Keroncong sing-along', 'id')).toBe('Bernyanyi keroncong');
    expect(photoActivityLabel(s, 'Keroncong sing-along', 'en')).toBe('Keroncong sing-along');
    expect(photoActivityLabel(s, 'Something else', 'id')).toBe('Something else');
  });
});

describe('invoices', () => {
  it('Yohana: the overdue September invoice and October are both open, oldest first, with a total', () => {
    const s = seed();
    const rows = invoiceRows(s, ['m20'], T);
    const open = openInvoiceRows(rows);
    expect(open.map((r) => [r.inv.number, r.status])).toEqual([['INV-2609-020', 'overdue'], ['INV-2610-020', 'outstanding']]);
    expect(openTotal(open)).toBe(19000000);
    expect(open[0]).toMatchObject({ balance: 9500000, paid: 0, period: '2026-09' });
    expect(historyRows(rows).map((r) => r.inv.number)).toEqual(['INV-2610-020', 'INV-2609-020']);
  });
  it('Maria: September is paid, October is open for both parents', () => {
    const s = seed();
    const open = openInvoiceRows(invoiceRows(s, ['m1', 'm46'], T));
    expect(open.map((r) => r.inv.number).sort()).toEqual(['INV-2610-001', 'INV-2610-046']);
    expect(open.every((r) => r.status === 'outstanding')).toBe(true);
    expect(openTotal(open)).toBe(5500000 + 9500000);
  });
  it('a member with no invoice gives an empty list and the next run date', () => {
    const s = seed();
    s.invoices = {};
    expect(invoiceRows(s, ['m1'], T)).toEqual([]);
    expect(nextIssueDate(s, T)).toBe('2026-11-15');
    expect(nextIssueDate(s, '2026-11-03')).toBe('2026-11-15');
    expect(nextIssueDate(s, '2026-11-15')).toBe('2026-12-15');
    expect(nextIssueDate(s, '2026-12-20')).toBe('2027-01-15');
  });
  it('who looks after billing', () => {
    const s = seed();
    expect(billingContactOf(s, 'm1')?.firstName).toBe('Maria');
    expect(billingContactOf(s, 'm20')?.firstName).toBe('Yohana');
  });
  it('virtual accounts: bank prefix, grouped in fours; a shared account is not doubled', () => {
    const s = seed();
    const a = s.members.m1.billing.va, b = s.members.m46.billing.va;
    expect(a).toBe('8808001203440000');
    expect(vaFor(a, 'BCA')).toBe('3901 0012 0344 0000');
    expect(vaFor(a, 'Mandiri')).toBe('8950 0012 0344 0000');
    expect(combinedVa([a, a], 'BCA')).toBe(vaFor(a, 'BCA'));
    expect(combinedVa([a, b], 'BNI').replace(/\s/g, '')).toHaveLength(16);
    expect(combinedVa([a, b], 'BNI').startsWith('8492 ')).toBe(true);
    expect(combinedVa([], 'BCA')).toBe('');
    expect(BANKS).toEqual(['BCA', 'Mandiri', 'BNI', 'BRI', 'Permata']);
  });
});
