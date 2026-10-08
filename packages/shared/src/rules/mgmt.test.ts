import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, flexMonth, type ClubState } from '../index';
import { comingUp, familyRequests, invoicePreview, liveToday, nextRunPeriod, overviewStats, venueLists } from './mgmt';
import { bookableDays, bookingDayCheck, enquiriesByStage, openEnquiries, paperFormDoc, splitName, startMondays } from './enquiries';

const T = '2026-10-21';
const { citra: s, adina } = buildSeed();
const clock = { today: T, nowMin: 10 * 60 + 5 };
/** The lobby checks a member in (the 11th Flex visit of a month is an extra day). */
const checkIn = (st: ClubState, memberId: string) => execute(st, 'attendance.checkIn', { memberId, method: 'manual' }, getUser({ citra: st }, 's1')!, clock, `t-${memberId}`).state;

describe('overview numbers come from the data', () => {
  it('CitraPremier on the demo morning', () => {
    const o = overviewStats(s, T);
    expect(o).toMatchObject({
      members: 5, staff: 10, inClub: 3, goneHome: 0, visits: 3, extraVisits: 0, checks: 1, flagged: 0, overdue: 1, enquiries: 4, reviews: 7, photos: 0, // reviews: round 7 adds a renewal change waiting
      logsSaved: 0, logsTotal: 3, lunchPhoto: false,
      payments: 2, stock: 3, venues: 2, samplePrices: true, // Hendra and Bambang paid this morning (invoice day); only the extra-day price is still a sample
    });
    expect(o.survey).toEqual({ avg: 4.7, n: 3 });
    expect(o).not.toHaveProperty('unread'); // Messages is gone
  });
  it('an empty clubhouse is all zeros, not made-up numbers', () => {
    expect(overviewStats(adina, T)).toMatchObject({ members: 0, staff: 0, inClub: 0, goneHome: 0, visits: 0, extraVisits: 0, checks: 0, flagged: 0, overdue: 0, enquiries: 0, reviews: 0, photos: 0, logsSaved: 0, logsTotal: 0, payments: 0, stock: 0, venues: 0, survey: null });
    expect(liveToday(adina, T)).toEqual([]);
    expect(comingUp(adina, T)).toEqual([]);
    expect(familyRequests(adina, T)).toEqual([]);
    expect(openEnquiries(adina)).toEqual([]);
  });
  it('payments today are payments received today', () => {
    const paid = { ...s, payments: { ...s.payments, px: { ...s.payments['pay-INV-2610-002'], id: 'px', receivedOn: T } } };
    expect(overviewStats(paid, T).payments).toBe(3);
    expect(overviewStats(s, '2026-10-20').payments).toBe(0); // INV-2610-002 was paid this morning, on the 21st
  });
  it('nobody is "expected": the tiles count who is in, who went home and who visited today', () => {
    const o = overviewStats(s, T);
    expect(o).not.toHaveProperty('expected');
    expect([o.inClub, o.goneHome, o.visits]).toEqual([3, 0, 3]);
    const out = execute(s, 'attendance.checkOut', { memberId: 'm20' }, getUser({ citra: s }, 's1')!, clock, 't-out').state;
    expect(overviewStats(out, T)).toMatchObject({ inClub: 2, goneHome: 1, visits: 3, logsTotal: 3 });
    const arrived = checkIn(s, 'm46'); // Budi arrives
    expect(overviewStats(arrived, T)).toMatchObject({ inClub: 4, goneHome: 0, visits: 4, logsTotal: 4 });
  });
  it('extra visits this month: Flex visits past the quota, from check-ins (Oma Lina has 10 already, so today is her 11th)', () => {
    expect(flexMonth(s, s.members.m1, '2026-10', T)).toMatchObject({ used: 10, left: 0, extra: 0 });
    expect(overviewStats(s, T).extraVisits).toBe(0);
    const lina = checkIn(s, 'm1');
    expect(flexMonth(lina, lina.members.m1, '2026-10', T)).toMatchObject({ used: 11, extra: 1, extraDates: [T] });
    expect(overviewStats(lina, T).extraVisits).toBe(1);
    expect(overviewStats(checkIn(lina, 'm46'), T).extraVisits).toBe(1); // Budi is Gold: unlimited, never extra
    // a last month's extra day does not count this month
    expect(overviewStats(lina, '2026-11-02').extraVisits).toBe(0);
  });
  it('live today lists today only, newest first', () => {
    const l = liveToday(s, T);
    expect(l.map((a) => a.at)).toEqual(['2026-10-21T09:55', '2026-10-21T09:48', '2026-10-21T09:40', '2026-10-21T09:38']);
    expect(liveToday(s, T, 2)).toHaveLength(2);
  });
  it('coming up is sorted by date: closures, outings, private events', () => {
    expect(comingUp(s, T).map((x) => [x.date, x.kind])).toEqual([
      ['2026-10-24', 'venue'], ['2026-10-29', 'outing'], ['2026-10-30', 'closed'], ['2026-10-31', 'venue'], ['2026-11-26', 'outing'], ['2026-12-25', 'holiday'],
    ]);
    expect(comingUp(s, '2026-12-01', 3).map((x) => x.date)).toEqual(['2026-12-25', '2027-01-01']);
  });
  it('family requests: waiting plan changes (families do not book days or ask for leave)', () => {
    expect(familyRequests(s, T).map((r) => [r.kind, r.memberId, r.to])).toEqual([['upgrade', 'm10', 'gold']]);
  });
  it('enquiries: open ones by next step, translated by the screen (stage keys here)', () => {
    expect(openEnquiries(s).map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e5']);
    const by = enquiriesByStage(s);
    expect(by.new.map((e) => e.id)).toEqual(['e3']);
    expect(by.visit.map((e) => e.id)).toEqual(['e2', 'e5']);
    expect(by.trial.map((e) => e.id)).toEqual(['e1']);
    expect(by.lost.map((e) => e.id)).toEqual(['e9']);
  });
  it('a booking made today shows in Live today, Coming up and the venue count; payments today follow the real payment date', () => {
    const r = execute(s, 'venue.book', { org: 'Yayasan Kasih Bunda choir', contactName: 'Ibu Lusi Tan', phone: '', guests: 20, roomId: 'room-lounge', date: '2026-11-14', from: '13:00', to: '17:00' }, getUser({ citra: s }, 's9')!, clock, 't-venue');
    expect(liveToday(r.state, T)[0]).toMatchObject({ key: 'mgmt.feed.venueBooked', params: { org: 'Yayasan Kasih Bunda choir', date: '14/11' } });
    expect(comingUp(r.state, T, 12).some((x) => x.kind === 'venue' && x.title === 'Yayasan Kasih Bunda choir' && x.date === '2026-11-14')).toBe(true);
    expect(overviewStats(r.state, T).venues).toBe(3);
  });
  it('venue lists split upcoming and past', () => {
    const v = venueLists(s, T, '10:00');
    expect(v.upcoming.map((x) => x.id)).toEqual(['v1', 'v2']);
    expect(v.past.map((x) => x.id)).toEqual(['v4', 'vr3', 'vr2', 'vr1', 'vr4']); // v4 and the renters' bookings of round 7 (seed/r7/surveys.ts)
  });
});

describe('pricing preview', () => {
  it('next invoice for a member, with saved or unsaved prices, and the family it is paid with', () => {
    expect(nextRunPeriod(s, T)).toBe('2026-11');
    const p = invoicePreview(s, 'm1', null, T)!;
    expect(p).toMatchObject({ period: '2026-11', issueDate: '2026-11-21', total: 2700000 });
    expect(p.lines.map((l) => l.kind)).toEqual(['plan']);
    expect(p.payer?.name).toBe('Maria Wijaya');
    expect(p.others.map((o) => [o.member.id, o.total])).toEqual([['m46', 3950000]]);
    const draft = invoicePreview(s, 'm1', { flex: 6000000, gold: 10000000, extra: 700000, from: T }, T)!;
    expect(draft.total).toBe(6000000);
    expect(draft.others[0].total).toBe(10000000);
    // a price that starts after the next run does not change it
    expect(invoicePreview(s, 'm1', { flex: 6000000, gold: 10000000, extra: 700000, from: '2026-12-01' }, T)!.total).toBe(2700000);
    expect(invoicePreview(s, 'nope', null, T)).toBeNull();
  });
  it('an extra visit this month shows on the next invoice at the extra-day price, with the unsaved price when typing', () => {
    expect(invoicePreview(s, 'm1', null, T)!.lines.map((l) => l.kind)).toEqual(['plan']); // 10 of 10 visits so far: nothing extra
    const lina = checkIn(s, 'm1');
    const p = invoicePreview(lina, 'm1', null, T)!;
    expect(p.lines.map((l) => [l.kind, l.qty, l.amount])).toEqual([['plan', 1, 2700000], ['extraDay', 1, 650000]]);
    expect(p.lines[1]).toMatchObject({ label: 'inv.line.extra', params: { month: '2026-10', n: 1 }, dates: [T] });
    expect(p.total).toBe(3350000);
    expect(invoicePreview(lina, 'm1', { flex: 6000000, gold: 10000000, extra: 700000, from: T }, T)!.total).toBe(6700000);
    // the typed (unsaved) Flex visits rule is part of the preview too: 11 visits a month makes her 11th an ordinary visit, 8 makes three of them extra
    const typed = (flexQuota: number) => invoicePreview(lina, 'm1', { flex: 2700000, gold: 3950000, extra: 650000, from: T, flexQuota }, T)!;
    expect(typed(11).lines.map((l) => l.kind)).toEqual(['plan']);
    expect(typed(11).total).toBe(2700000);
    expect(typed(8).lines.map((l) => [l.kind, l.qty])).toEqual([['plan', 1], ['extraDay', 3]]);
    expect(typed(8).total).toBe(2700000 + 3 * 650000);
    expect(lina.club.settings.flexQuota).toBe(10); // nothing saved by previewing
  });
});

describe('enquiry rules', () => {
  it('visits and trials: one day ahead for trials; open days only; inside club hours', () => {
    expect(bookingDayCheck(s, 'visit', T, '14:00', T, '10:00')).toEqual({ ok: true });
    expect(bookingDayCheck(s, 'visit', T, '17:30', T, '10:00')).toMatchObject({ ok: false, code: 'enq.err.hours' });
    expect(bookingDayCheck(s, 'visit', T, undefined, T, '10:00')).toMatchObject({ ok: false, code: 'enq.err.hours' }); // a visit needs a time
    expect(bookingDayCheck(s, 'trial', T, undefined, T, '10:00')).toMatchObject({ ok: false, code: 'enq.err.tooSoon' });
    expect(bookingDayCheck(s, 'trial', '2026-10-22', undefined, T, '10:00')).toEqual({ ok: true }); // a trial is a day pass: no time to check
    expect(bookingDayCheck(s, 'trial', '2026-10-24', undefined, T, '10:00')).toMatchObject({ ok: false, code: 'err.closedDay' });
    expect(bookingDayCheck(s, 'trial', '2026-10-29', undefined, T, '10:00')).toMatchObject({ ok: false, code: 'enq.err.outing' });
    expect(bookableDays(s, T, 6)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28']); // no weekend; the 29th is an outing
    expect(bookableDays(s, '2026-10-28', 3)).toEqual(['2026-10-28', '2026-11-02', '2026-11-03']); // 29 outing, 30 closed
    expect(startMondays(s, T, 3)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
  });
  it('name splitting and the paper registration form document', () => {
    expect(splitName('Siu Lan Tjandra')).toEqual({ first: 'Siu Lan', last: 'Tjandra' });
    expect(splitName('Lina')).toEqual({ first: 'Lina', last: 'Lina' });
    expect(paperFormDoc('m47', { mediaId: 'md_abcdefgh01', fileName: 'form.pdf' }, T, 'staff:s1')).toEqual({
      id: 'm47-doc-form', type: 'membershipForm', status: 'onFile', mediaId: 'md_abcdefgh01', fileName: 'form.pdf', on: T, via: 'staff', by: 'staff:s1',
    });
  });

});
