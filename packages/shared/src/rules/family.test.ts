// Family selectors for a drop-in club: switcher, the member's day, plan card (Flex visits, Gold), timeline, lunch line, photos, invoices, comments.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, projectForFamily, lunchSafety, flexQuota, type ClubState } from '../index';
import {
  BANKS, combinedVa, dayStateOf, extraPriceFor, familyMembers, familyPhotoDays, healthMemberOf, historyRows, homeTime, invoiceRows, isFamilyPhoto, mayStillCome, nextIssueDate,
  openInvoiceRows, openTotal, photoActivityLabel, photosInOrder, planSummary, resolveSel, selWho, servedLunch, sharedNoteOf, timelineOf, vaFor, billingContactOf, latestLog, dishNamesOf,
  bestPhotoOf, dayStory, dayStrip, familyPhotosOn, logOn, monthRecap, recapMonths, storyNowMin, tookPart, visitDays, END_OF_DAY,
} from './family';
import { dow } from '../util';

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
      if (kinds.includes('group')) expect(kinds.indexOf('group')).toBeGreaterThanOrEqual(kinds.includes('solo') ? kinds.indexOf('solo') : 0);
      expect(d.sets.flatMap((x) => x.photos).every((p) => isFamilyPhoto(p) || p.kind === 'activity')).toBe(true); // member photos, and a day's approved activity pictures
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
  it('KC round 7: a day’s activity pictures come after the member photos, one set per activity, only for days one of the members came', () => {
    const s0 = seed();
    const put = (s: ClubState, id: string, date: string, activity: string, visibility: 'visible' | 'pending' | 'hidden' = 'visible') => {
      s.photos[id] = { id, clubId: s.clubId, createdAt: `${date}T10:50`, createdBy: 'staff:s5', date, time: '10:50', kind: 'activity', media: 'photo', activity, memberIds: [], tone: 1, takenBy: 's5', visibility };
    };
    const s = seed();
    expect(s0.attendance[`${T}:m10`]?.checkIn).toBeTruthy(); // Bambang came today; Oma Lina did not
    expect(s0.attendance[`${T}:m1`]?.checkIn).toBeUndefined();
    put(s, 'a1', T, 'Keroncong sing-along'); put(s, 'a2', T, 'Batik painting'); put(s, 'a3', T, 'Keroncong sing-along'); put(s, 'a4', T, 'Batik painting', 'pending'); put(s, 'a5', T, 'Batik painting', 'hidden');
    const bambang = familyPhotoDays(s, ['m10']).find((d) => d.date === T)!;
    const sets = bambang.sets.filter((x) => x.kind === 'activity');
    expect(sets.map((x) => [x.activity, x.photos.map((p) => p.id)])).toEqual([['Keroncong sing-along', ['a1', 'a3']], ['Batik painting', ['a2']]]);
    expect(bambang.sets.map((x) => x.kind).slice(-2)).toEqual(['activity', 'activity']); // after the solo and group photos
    expect(bambang.count).toBe(bambang.sets.reduce((t, x) => t + x.photos.length, 0));
    expect(familyPhotoDays(s, ['m1']).find((d) => d.date === T)?.sets.filter((x) => x.kind === 'activity') ?? []).toEqual([]); // Oma Lina did not come
    // Both mode: one of the two coming is enough
    expect(familyPhotoDays(s, ['m1', 'm10']).find((d) => d.date === T)?.sets.filter((x) => x.kind === 'activity')).toHaveLength(2);
    // the projection holds what the lists need
    const proj = projectForFamily(s, 'fm10_0');
    expect(photosInOrder(familyPhotoDays(proj, ['m10'])).map((p) => p.id)).toEqual(photosInOrder(familyPhotoDays(s, ['m10'])).map((p) => p.id));
  });
  it('Indonesian activity names come from the catalogue', () => {
    const s = seed();
    expect(photoActivityLabel(s, 'Keroncong sing-along', 'id')).toBe('Bernyanyi keroncong');
    expect(photoActivityLabel(s, 'Keroncong sing-along', 'en')).toBe('Keroncong sing-along');
    expect(photoActivityLabel(s, 'Something else', 'id')).toBe('Something else');
  });
});

describe('invoices', () => {
  it('Yohana: the overdue September invoice and October (issued today, due on the 28th) are both open, oldest first, with a total', () => {
    const s = seed();
    const rows = invoiceRows(s, ['m20'], T);
    const open = openInvoiceRows(rows);
    expect(open.map((r) => [r.inv.number, r.status])).toEqual([['INV-2609-020', 'overdue'], ['INV-2610-020', 'outstanding']]);
    expect(openTotal(open)).toBe(7900000);
    expect(open[0]).toMatchObject({ balance: 3950000, paid: 0, period: '2026-09' });
    expect(historyRows(rows).map((r) => r.inv.number).slice(0, 2)).toEqual(['INV-2610-020', 'INV-2609-020']); // newest first (the seed holds six months of invoices)
  });
  it('Maria: September is paid, October is open for both parents', () => {
    const s = seed();
    const open = openInvoiceRows(invoiceRows(s, ['m1', 'm46'], T));
    expect(open.map((r) => r.inv.number).sort()).toEqual(['INV-2610-001', 'INV-2610-046']);
    expect(open.every((r) => r.status === 'outstanding')).toBe(true);
    expect(openTotal(open)).toBe(2700000 + 3950000);
  });
  it('a member with no invoice gives an empty list and the next run date', () => {
    const s = seed();
    s.invoices = {};
    expect(invoiceRows(s, ['m1'], T)).toEqual([]);
    expect(nextIssueDate(s, T)).toBe('2026-11-21'); // today is the 21st: the next one is next month's
    expect(nextIssueDate(s, '2026-11-03')).toBe('2026-11-21');
    expect(nextIssueDate(s, '2026-11-21')).toBe('2026-12-21');
    expect(nextIssueDate(s, '2026-12-20')).toBe('2026-12-21');
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

// ---------------------------------------------------------------- KC round 7: the day story and the month's memories
describe('visitDays and the day strip', () => {
  it('lists the days a member checked in, oldest first, up to the given day; a day without a check-in is not a visit', () => {
    const s = seed();
    const days = visitDays(s, 'm1', T);
    expect(days.length).toBeGreaterThan(5);
    expect(days).toEqual([...days].sort());
    expect(days.every((d) => d <= T && !!s.attendance[`${d}:m1`]?.checkIn)).toBe(true);
    expect(days).not.toContain(T); // Oma Lina has not come today
    expect(visitDays(s, 'm10', T)).toContain(T); // Bambang is in the club
    expect(visitDays(s, 'm1', '2026-10-14').every((d) => d <= '2026-10-14')).toBe(true);
    // undoing a check-in removes the visit
    const u = as(s, 's1', 'attendance.undoCheckIn', { memberId: 'm10' }, 'u1');
    expect(visitDays(u.state, 'm10', T)).not.toContain(T);
  });
  it('the strip ends with today even when the member has not come, and carries each day’s cover picture', () => {
    const s = seed();
    const strip = dayStrip(s, ['m1'], T);
    expect(strip[strip.length - 1]).toMatchObject({ date: T, visited: false });
    expect(strip.slice(0, -1).every((d) => d.visited)).toBe(true);
    expect(strip.some((d) => d.photo && d.count > 0)).toBe(true);
    expect(dayStrip(s, ['m10'], T).at(-1)).toMatchObject({ date: T, visited: true });
    // Both mode: the union of their visit days, once each
    const both = dayStrip(s, ['m1', 'm10'], T).map((d) => d.date);
    expect(new Set(both).size).toBe(both.length);
    expect(dayStrip(s, ['m1'], T, 3)).toHaveLength(4); // the last 3 visits and today
  });
});

describe('dayStory: a past day, today, a day she did not come, and what waits for approval', () => {
  const logDay = (s: ClubState) => Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && /Bengawan Solo/.test(l.note))!.date;
  it('a past day reads at the end of the day: arrival and home, the mood and note, every step done, the day’s pictures', () => {
    const s = seed();
    const d = logDay(s);
    expect(storyNowMin(d, T, 600)).toBe(END_OF_DAY);
    expect(storyNowMin(T, T, 600)).toBe(600);
    const st = dayStory(s, s.members.m1, d, END_OF_DAY);
    expect(st).toMatchObject({ date: d, visited: true, state: { kind: 'home' } });
    expect(st.arrivedAt).toBe(s.attendance[`${d}:m1`].checkIn!.at);
    expect(st.leftAt).toBe(s.attendance[`${d}:m1`].checkOut!.at);
    expect(st.log).toMatchObject({ mood: 'cheerful', lunch: 'all' });
    expect(st.log!.note).toMatch(/Bengawan Solo/);
    expect(st.items.every((i) => i.state === 'done')).toBe(true);
    expect(st.sessions.length).toBeGreaterThan(0);
    expect(st.sessions.every((x) => x.state === 'done')).toBe(true);
    expect(st.sessions[0].took).toBe('joined'); // no session was marked: the day’s answer applies
    expect(st.lunch).toMatchObject({ amount: 'all' });
    expect(st.lunch!.dishes.length).toBeGreaterThan(0);
    expect(st.arrival).toBeTruthy();
    expect(st.departure).toBeTruthy();
    expect(st.photos.length).toBeGreaterThan(0);
    expect(st.hero).toBeTruthy();
    expect(st.lastVisit! < d).toBe(true);
  });
  it('a past day with no recorded check-out has no "home time to come"', () => {
    const s = seed();
    const d = logDay(s);
    delete s.attendance[`${d}:m1`].checkOut;
    const st = dayStory(s, s.members.m1, d, END_OF_DAY);
    expect(st.state).toMatchObject({ kind: 'here' });
    expect(st.leftAt).toBeNull();
    expect(st.items.some((i) => i.kind === 'home')).toBe(false);
    expect(st.items.every((i) => i.state === 'done')).toBe(true);
    expect(dayStory(s, s.members.m10, T, NOW).items.some((i) => i.kind === 'home' && i.state === 'up')).toBe(true); // today it is still to come
  });
  it('today follows the clock: Bambang is in the club, his first session is still to come at 09:58 and running at 11:00', () => {
    const s = seed();
    const early = dayStory(s, s.members.m10, T, NOW);
    expect(early).toMatchObject({ visited: true, arrivedAt: '09:48', leftAt: null, state: { kind: 'here', since: '09:48' } });
    expect(early.sessions[0].state).toBe('up');
    expect(early.log).toBeNull(); // no log yet today
    expect(early.sessions[0].took).toBeNull();
    expect(early.lunch!.amount).toBeNull();
    expect(dayStory(s, s.members.m10, T, 11 * 60).sessions[0].state).toBe('now');
    expect(early.arrival).toMatchObject({ sys: 122, dia: 73 }); // his arrival reading this morning
    expect(early.departure).toBeNull();
  });
  it('a day she did not come: a gentle state with what was on, and none of her pictures, readings or answers', () => {
    const s = seed();
    const missed = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`).filter((d) => d < T && [1, 2, 3, 4, 5].includes(dow(d)) && !s.attendance[`${d}:m1`]?.checkIn).pop()!;
    expect(missed).toBeTruthy();
    const st = dayStory(s, s.members.m1, missed, END_OF_DAY);
    expect(st).toMatchObject({ visited: false, arrivedAt: null, leftAt: null, log: null, arrival: null, departure: null, hero: null });
    expect(st.state.kind).toBe('away');
    expect(st.sessions.length).toBeGreaterThan(0); // the programme of the day
    expect(st.sessions.every((x) => x.took === null && x.photos.length === 0)).toBe(true);
    expect(st.lunch!.dishes.length).toBeGreaterThan(0);
    expect(st.lunch!.amount).toBeNull();
    expect(st.photos).toEqual([]);
    // a closed day has no programme at all
    const sat = dayStory(s, s.members.m1, '2026-10-17', END_OF_DAY);
    expect(sat.state).toMatchObject({ kind: 'closed', reason: 'weekend' });
    expect(sat.items).toEqual([]);
    expect(sat.sessions).toEqual([]);
  });
  it('a log that waits for approval is not shown; an edit shows the last approved values; the same holds on a family’s projection', () => {
    const s = seed();
    const d = logDay(s);
    const row = Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && l.date === d)!;
    row.approval = { status: 'pending', by: 'staff:s5', at: `${d}T15:30` };
    expect(logOn(s, 'm1', d)).toBeNull();
    expect(dayStory(s, s.members.m1, d, END_OF_DAY).log).toBeNull();
    expect(dayStory(s, s.members.m1, d, END_OF_DAY).lunch!.amount).toBeNull();
    expect(dayStory(projectForFamily(s, 'f1'), s.members.m1, d, END_OF_DAY).log).toBeNull();
    row.approval = { status: 'pending', by: 'staff:s5', at: `${d}T15:30`, prev: { mood: 'calm', lunch: 'half', joined: 'yes', note: 'A quiet, easy day.' } };
    row.mood = 'agitated'; row.note = 'something staff changed';
    const st = dayStory(s, s.members.m1, d, END_OF_DAY);
    expect(st.log).toMatchObject({ mood: 'calm', note: 'A quiet, easy day.' });
    expect(st.lunch!.amount).toBe('half');
    expect(monthRecap(s, s.members.m1, d.slice(0, 7)).quotes.map((q) => q.text)).not.toContain('something staff changed');
  });
  it('per session: a guest host (name and what they do), joined or sat out, and that session’s approved pictures; fees and phones never reach a family', () => {
    const s = seed();
    s.guestSessions = {}; s.guestHosts = {}; // the seed has guests of its own: start clean
    for (const p of Object.values(s.photos)) if (p.kind === 'activity') delete p.mediaId; // the seed's session pictures are real demo images: here sp1 must be the only real one
    const d = Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && /Bengawan Solo/.test(l.note))!.date;
    const base = { clubId: s.clubId, createdAt: `${d}T08:00`, createdBy: 'staff:s9' as const };
    s.guestHosts.gh1 = { ...base, id: 'gh1', name: 'Bu Ratna', kind: 'teacher', what: 'Angklung teacher', phone: '+62 811 0000 1111', fee: 750000, bank: { bank: 'BCA', account: '123', holder: 'Ratna' }, note: 'pays by transfer', active: true };
    const first = dayStory(s, s.members.m1, d, END_OF_DAY).sessions[0];
    s.guestSessions.gs1 = { ...base, id: 'gs1', hostId: 'gh1', date: d, slot: first.slot, activityId: first.activityId, fee: 750000, status: 'booked', note: 'invoice later', vendorInvoiceId: 'vi1' };
    Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && l.date === d)!.sessions = { [first.slot]: 'satOut', '13:30': 'joined' };
    const act = s.activities[first.activityId];
    s.photos.sp1 = { id: 'sp1', clubId: s.clubId, createdAt: `${d}T11:00`, createdBy: 'staff:s5', date: d, time: '11:00', kind: 'activity', media: 'photo', activity: act.name, memberIds: [], tone: 1, takenBy: 's5', visibility: 'visible', mediaId: 'img1' };
    s.photos.sp2 = { ...s.photos.sp1, id: 'sp2', visibility: 'pending' };
    const st = dayStory(s, s.members.m1, d, END_OF_DAY);
    expect(st.sessions[0]).toMatchObject({ slot: first.slot, took: 'satOut', guest: { name: 'Bu Ratna', what: 'Angklung teacher', kind: 'teacher' } });
    expect(st.sessions[0].photos.map((p) => p.id)).toContain('sp1');
    expect(st.sessions[0].photos.map((p) => p.id)).not.toContain('sp2'); // the pending one is not for families
    expect(st.sessions[0].photos.every((p) => p.visibility === 'visible' && p.kind === 'activity' && p.activity === act.name)).toBe(true);
    expect(st.sessions[1]?.took ?? 'joined').toBe('joined');
    expect(st.sessions[1]?.guest ?? null).toBeNull();
    expect(bestPhotoOf(s, ['m1'], d)?.id).toBe('sp1'); // the only real image of the day is the cover
    const proj = projectForFamily(s, 'f1');
    expect(proj.guestHosts.gh1).toMatchObject({ name: 'Bu Ratna', what: 'Angklung teacher', phone: '', fee: 0 });
    expect(proj.guestHosts.gh1.bank).toBeUndefined();
    expect(proj.guestHosts.gh1.note).toBeUndefined();
    expect(proj.guestSessions.gs1).toMatchObject({ fee: 0 });
    expect(proj.guestSessions.gs1.note).toBeUndefined();
    expect(proj.guestSessions.gs1.vendorInvoiceId).toBeUndefined();
    expect(dayStory(proj, s.members.m1, d, END_OF_DAY).sessions[0].guest?.name).toBe('Bu Ratna');
    // a cancelled booking is not shown at all
    s.guestSessions.gs1.status = 'cancelled';
    expect(dayStory(s, s.members.m1, d, END_OF_DAY).sessions[0].guest).toBeNull();
    expect(projectForFamily(s, 'f1').guestSessions.gs1).toBeUndefined();
    expect(projectForFamily(s, 'f1').guestHosts.gh1).toBeUndefined();
  });
  it('tookPart: the mark for a session, else the whole day’s answer when nothing was marked', () => {
    const s = seed();
    const log = Object.values(s.dailyLogs).find((l) => l.memberId === 'm1')!;
    expect(tookPart(null, '10:30')).toBeNull();
    expect(tookPart({ ...log, joined: 'yes', sessions: undefined }, '10:30')).toBe('joined');
    expect(tookPart({ ...log, joined: 'satOut', sessions: undefined }, '13:30')).toBe('satOut');
    expect(tookPart({ ...log, joined: 'yes', sessions: { '10:30': 'satOut' } }, '10:30')).toBe('satOut');
    expect(tookPart({ ...log, joined: 'yes', sessions: { '10:30': 'satOut' } }, '13:30')).toBeNull();
  });
  it('bestPhotoOf: a real image over a placeholder, her own photo over a group photo, never a video; null when there is none', () => {
    const s = seed();
    const d = logDay(s);
    const solo = (id: string, o: Partial<ClubState['photos'][string]>): ClubState['photos'][string] => ({ id, clubId: s.clubId, createdAt: `${d}T11:00`, createdBy: 'staff:s5', date: d, time: '11:00', kind: 'solo', media: 'photo', activity: 'Batik painting', memberIds: ['m1'], tone: 0, takenBy: 's5', visibility: 'visible', ...o });
    expect(familyPhotosOn(s, ['m1'], d).length).toBeGreaterThan(0);
    // the seed: a session picture is a real demo scene and is the cover; her solo and group photos stay placeholders (no real face on a made-up member)
    expect(bestPhotoOf(s, ['m1'], d)?.mediaId).toMatch(/^md_demo_/);
    expect(familyPhotosOn(s, ['m1'], d).filter((p) => p.kind === 'solo' || p.kind === 'group').every((p) => !p.mediaId)).toBe(true);
    for (const p of Object.values(s.photos)) if (p.kind === 'activity') delete p.mediaId; // from here every seeded photo is a placeholder
    const placeholder = bestPhotoOf(s, ['m1'], d)!;
    expect(placeholder.mediaId).toBeUndefined();
    s.photos.v1 = solo('v1', { media: 'video', mediaId: 'vid', durationSec: 9 });
    expect(bestPhotoOf(s, ['m1'], d)?.id).not.toBe('v1');
    s.photos.g1 = solo('g1', { kind: 'group', memberIds: ['m1', 'm46'], mediaId: 'img-g' });
    expect(bestPhotoOf(s, ['m1'], d)?.id).toBe('g1'); // a real group photo beats placeholders
    s.photos.s1 = solo('s1', { mediaId: 'img-s' });
    expect(bestPhotoOf(s, ['m1'], d)?.id).toBe('s1'); // and her own real photo beats that
    s.photos.s1.visibility = 'pending';
    expect(bestPhotoOf(s, ['m1'], d)?.id).toBe('g1');
    expect(bestPhotoOf(s, ['m1'], '2026-10-17')).toBeNull();
  });
});

describe('monthRecap and recapMonths', () => {
  it('counts the month’s visits, sessions joined, photos and appetite from what the family may see, with warm quotes from the team', () => {
    const s = seed();
    const lina = s.members.m1;
    const month = '2026-10';
    const r = monthRecap(s, lina, month);
    expect(r.visits).toEqual(visitDays(s, 'm1', T).filter((d) => d.startsWith(month)));
    expect(r.moods.map((m) => m.date)).toEqual(r.visits);
    expect(r.moods.every((m) => m.mood === null || ['cheerful', 'calm', 'quiet', 'agitated'].includes(m.mood as string))).toBe(true);
    expect(r.joined).toBeGreaterThan(0);
    expect(r.favourites.length).toBeGreaterThan(0);
    expect(r.favourites.length).toBeLessThanOrEqual(3);
    expect(r.favourites.map((f) => f.times)).toEqual([...r.favourites.map((f) => f.times)].sort((a, b) => b - a));
    expect(r.favourites.reduce((n, f) => n + f.times, 0)).toBeLessThanOrEqual(r.joined);
    expect(r.lunch.of).toBeGreaterThan(0);
    expect(r.lunch.finished).toBeLessThanOrEqual(r.lunch.of);
    expect(r.photos).toBeGreaterThan(0);
    expect(r.best.length).toBeLessThanOrEqual(6);
    expect(r.best.filter((p) => p.mediaId).length).toBeGreaterThan(0); // the collage uses the real session pictures ...
    const real = r.best.map((p) => p.mediaId).filter(Boolean);
    expect(new Set(real).size).toBe(real.length); // ... and never the same picture twice
    expect(r.quotes.some((q) => /Bengawan Solo/.test(q.text))).toBe(true);
    expect(r.quotes.length).toBeLessThanOrEqual(3);
    expect(r.quotes.map((q) => q.date)).toEqual([...r.quotes.map((q) => q.date)].sort());
    // the family’s projection gives the same recap
    const p = projectForFamily(s, 'f1');
    expect(monthRecap(p, p.members.m1, month)).toEqual(r);
  });
  it('a quiet or unsettled day’s note is not a memory, and sat-out sessions are not counted', () => {
    const s = seed();
    const d = Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && /Bengawan Solo/.test(l.note))!.date;
    const log = Object.values(s.dailyLogs).find((l) => l.memberId === 'm1' && l.date === d)!;
    const before = monthRecap(s, s.members.m1, d.slice(0, 7));
    log.mood = 'quiet'; log.joined = 'satOut'; log.sessions = undefined; // the whole day's answer applies
    const after = monthRecap(s, s.members.m1, d.slice(0, 7));
    expect(after.quotes.some((q) => /Bengawan Solo/.test(q.text))).toBe(false);
    expect(after.joined).toBeLessThan(before.joined);
    expect(after.moods.find((m) => m.date === d)?.mood).toBe('quiet');
  });
  it('a month with no visits is empty, not an error', () => {
    const s = seed();
    const r = monthRecap(s, s.members.m1, '2020-01');
    expect(r).toMatchObject({ visits: [], moods: [], joined: 0, photos: 0, best: [], favourites: [], lunch: { finished: 0, of: 0 }, quotes: [] });
  });
  it('the months on offer: this month back to the membership start, at most six', () => {
    const s = seed();
    const lina = s.members.m1; // member since 2025-03-03
    expect(recapMonths(lina, T)).toEqual(['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
    const fresh = { ...lina, memberships: [{ ...lina.memberships[0], start: '2026-09-01' }] };
    expect(recapMonths(fresh, T)).toEqual(['2026-10', '2026-09']);
    const ended = { ...lina, memberships: [{ ...lina.memberships[0], lastDay: '2026-08-14' }] };
    expect(recapMonths(ended, T)[0]).toBe('2026-08');
    expect(recapMonths(ended, T)).toHaveLength(6);
  });
});
