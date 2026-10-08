import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, lobbyGroups, nurseQueue, unreadUpdates, updatesFor, visitsInMonth, type ClubState } from '../index';

// Wed 21 Oct 2026, 10:00. The club is drop-in: nobody is "expected". Oma Lina (Flex, 10 visits already this month) and
// Opa Budi (Gold) have not come in yet; Hendra, Tjahjadi and Bambang are in the club.
const clock = { today: '2026-10-21', nowMin: 600 };
const clubs = buildSeed();
const base: ClubState = clubs.citra;
const as = (id: string) => getUser(clubs, id)!;
let n = 0;
const run = (s: ClubState, name: string, input: unknown, userId = 's1', c = clock) => execute(s, name, input, as(userId), c, `t${++n}`);
const checkIn = (s: ClubState, memberId = 'm1', method: 'face' | 'manual' = 'face', c = clock) => run(s, 'attendance.checkIn', { memberId, method }, 's1', c).state;
const att = (s: ClubState, memberId: string, date = clock.today) => s.attendance[`${date}:${memberId}`];
/** Oma Lina without her 20 Oct visit: checking in today is her 10th visit, still inside the plan. */
const linaNineVisits = () => produce(base, (d) => { delete d.attendance['2026-10-20:m1']; });
/** Nobody owes anything (a later day in the tests below: an unpaid October invoice would put the membership on hold from 1 November). */
const noDebt = produce(base, (d) => { d.invoices = {}; });
const extraNotes = (s: ClubState, userId: string) => unreadUpdates(s, as(userId)).filter((x) => x.kind === 'lobby.notif.extraVisit');

describe('attendance.checkIn', () => {
  it('checks a member in: stamp, arrival photo, feed entry, family notification', () => {
    const r = run(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' });
    const a = att(r.state, 'm1');
    expect(a.checkIn).toMatchObject({ at: '10:00', by: 'staff:s1', method: 'face' });
    expect(a.checkIn).not.toHaveProperty('escort'); // nobody is recorded as bringing her
    expect(a.edits.map((e) => e.what)).toEqual(['checkIn']);
    expect(r.result.time).toBe('10:00');
    const photos = Object.values(r.state.photos).filter((p) => p.kind === 'arrival' && p.date === clock.today && p.memberIds[0] === 'm1');
    expect(photos).toHaveLength(1);
    expect(photos[0].visibility).toBe('visible');
    expect(Object.values(r.state.activity).some((x) => x.key === 'feed.checkedIn' && x.memberId === 'm1')).toBe(true);
    const f1 = unreadUpdates(r.state, as('f1')).filter((x) => x.kind === 'notif.checkedIn');
    expect(f1).toHaveLength(1);
    expect(f1[0].params).toMatchObject({ name: 'Oma Lina', time: '10:00' });
    expect(unreadUpdates(r.state, as('f2')).some((x) => x.kind === 'notif.checkedIn')).toBe(true);
    const g = lobbyGroups(r.state, clock.today);
    expect(g.inClub.some((x) => x.m.id === 'm1')).toBe(true);
    expect(g.others.map((x) => x.m.id)).toEqual(['m46']);
  });
  it('is not a customer-detail edit: applies at once, no change request', () => {
    const r = run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' });
    expect(r.reviewed).toBeUndefined();
    expect(Object.keys(r.state.changeRequests)).toEqual(Object.keys(base.changeRequests));
  });
  it('any active member can drop in on any open day: no booking, no usual day', () => {
    expect('bookings' in base).toBe(false);
    const thu = { today: '2026-10-22', nowMin: 600 }; // Opa Tjahjadi usually comes Mon to Fri; a Thursday is no different from a Wednesday
    const r = run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 's1', thu);
    expect(att(r.state, 'm46', thu.today).checkIn?.at).toBe('10:00');
    expect(lobbyGroups(r.state, thu.today).inClub.map((x) => x.m.id)).toEqual(['m46']);
  });
  it('records no escort even if one is sent, and the walk-in, booking, notice and escort actions are gone', () => {
    const r = run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual', escort: { kind: 'family', familyId: 'f1' } });
    expect(att(r.state, 'm46').checkIn).not.toHaveProperty('escort');
    for (const name of ['attendance.walkIn', 'attendance.setEscort', 'booking.add', 'booking.cancel', 'notice.report', 'notice.cancel']) {
      expect(() => run(base, name, { memberId: 'm46', method: 'manual' })).toThrow('err.unknownAction');
    }
  });
  it('management can check in; nurse, finance, activity and family cannot', () => {
    expect(att(run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 's9').state, 'm46').checkIn?.by).toBe('staff:s9');
    for (const u of ['s8', 's10', 's5', 'f1']) expect(() => run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, u)).toThrow('err.forbidden');
  });
  it('validates input', () => {
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm1', method: 'camera' })).toThrow('err.invalid');
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm1' })).toThrow('err.invalid');
    expect(() => run(base, 'attendance.checkIn', { method: 'manual' })).toThrow('err.invalid');
    expect(() => run(base, 'attendance.checkIn', { memberId: '', method: 'manual' })).toThrow('err.invalid');
    expect(() => run(base, 'attendance.checkIn', { memberId: 'nobody', method: 'manual' })).toThrow('err.notFound');
  });
  it('refuses double check-in, pending members and memberships that are not active', () => {
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm2', method: 'manual' })).toThrow('err.alreadyCheckedIn');
    const pending = produce(base, (d) => { d.members.m46.review = { status: 'pending', crId: 'cr-x' }; });
    expect(() => run(pending, 'attendance.checkIn', { memberId: 'm46', method: 'manual' })).toThrow('err.memberPending');
    const ended = produce(base, (d) => { d.members.m46.memberships[0].lastDay = '2026-10-20'; });
    expect(() => run(ended, 'attendance.checkIn', { memberId: 'm46', method: 'manual' })).toThrow('err.memberNotActive');
  });
  it('face check-in respects the opt-out (latest consent decides); by name still works', () => {
    const optOut = produce(base, (d) => { d.members.m1.consents.push({ kind: 'face', granted: false, by: 'family:f1', byName: 'Maria Wijaya', at: '2026-10-10T09:00', via: 'staff' }); });
    expect(() => run(optOut, 'attendance.checkIn', { memberId: 'm1', method: 'face' })).toThrow('lobby.err.faceOptOut');
    expect(att(checkIn(optOut, 'm1', 'manual'), 'm1').checkIn?.method).toBe('manual');
    const optedBackIn = produce(optOut, (d) => { d.members.m1.consents.push({ kind: 'face', granted: true, by: 'family:f1', byName: 'Maria Wijaya', at: '2026-10-12T09:00', via: 'staff' }); });
    expect(att(checkIn(optedBackIn, 'm1', 'face'), 'm1').checkIn?.method).toBe('face');
  });
  it('does not run on a closed day', () => {
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', { today: '2026-10-24', nowMin: 600 })).toThrow('err.closedDay'); // Saturday
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 's1', { today: '2026-10-30', nowMin: 600 })).toThrow('err.closedDay'); // closed event
  });
  it('uses the club date, not a fixed month', () => {
    const c = { today: '2026-11-04', nowMin: 650 }; // a Wednesday in November (the families have paid October, or the membership would be on hold)
    const r = run(noDebt, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 's1', c);
    expect(att(r.state, 'm46', c.today).checkIn?.at).toBe('10:50');
    expect(Object.values(r.state.photos).some((p) => p.date === c.today && p.kind === 'arrival' && p.memberIds[0] === 'm46')).toBe(true);
    expect(att(r.state, 'm46', clock.today)?.checkIn).toBeUndefined();
  });
});

describe('extra days (Flex: 10 visits a month; the 11th visit is an extra day)', () => {
  it('the 11th visit is an extra day: flagged in the result and the feed; management and finance are told, nobody else', () => {
    expect(visitsInMonth(base, base.members.m1, '2026-10')).toHaveLength(10);
    const r = run(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' });
    expect(r.result).toMatchObject({ extra: true, visit: 11, time: '10:00' });
    expect(Object.values(r.state.activity).some((x) => x.key === 'lobby.feed.extraVisit' && x.memberId === 'm1' && x.params.n === 11)).toBe(true);
    for (const u of ['s9', 's10']) {
      const note = extraNotes(r.state, u);
      expect(note).toHaveLength(1);
      expect(note[0]).toMatchObject({ link: '/members/m1', memberId: 'm1', params: { name: 'Oma Lina', n: 11, price: 'Rp 650.000' } });
    }
    for (const u of ['s1', 's5', 's8', 'f1', 'f2']) expect(extraNotes(r.state, u)).toHaveLength(0);
    // the family still gets the plain "checked in" message, and the visit counts from the check-in itself
    expect(unreadUpdates(r.state, as('f1')).filter((x) => x.kind === 'notif.checkedIn')).toHaveLength(1);
    expect(visitsInMonth(r.state, r.state.members.m1, '2026-10')).toHaveLength(11);
  });
  it('the 10th visit is inside the plan: no extra flag, no note', () => {
    const s = linaNineVisits();
    expect(visitsInMonth(s, s.members.m1, '2026-10')).toHaveLength(9);
    const r = run(s, 'attendance.checkIn', { memberId: 'm1', method: 'face' });
    expect(r.result).toMatchObject({ extra: false, visit: 10 });
    expect(Object.values(r.state.activity).some((x) => x.key === 'lobby.feed.extraVisit')).toBe(false);
    for (const u of ['s9', 's10']) expect(extraNotes(r.state, u)).toHaveLength(0);
  });
  it('Gold is unlimited: never an extra day', () => {
    const r = run(base, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }); // 15th visit of the month
    expect(r.result.extra).toBe(false);
    for (const u of ['s9', 's10']) expect(extraNotes(r.state, u)).toHaveLength(0);
  });
  it('counts actual check-ins, month by month', () => {
    const nov = { today: '2026-11-04', nowMin: 600 };
    const r = run(noDebt, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', nov); // Oma Lina's first November visit
    expect(r.result).toMatchObject({ extra: false, visit: 1 });
    // a Flex member who has not been in this month is nowhere near the quota, whatever the plan
    const s = produce(base, (d) => { for (const k of Object.keys(d.attendance)) if (k.endsWith(':m1')) delete d.attendance[k]; });
    expect(run(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }).result).toMatchObject({ extra: false, visit: 1 });
  });
  it('undoing the extra-day check-in takes the notes back; checking in again notes it once', () => {
    const s = run(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' }).state;
    const undone = run(s, 'attendance.undoCheckIn', { memberId: 'm1' }).state;
    for (const u of ['s9', 's10']) expect(updatesFor(undone, as(u)).some((x) => x.kind === 'lobby.notif.extraVisit')).toBe(false);
    expect(updatesFor(undone, as('f1')).some((x) => x.kind === 'notif.checkedIn' && x.memberId === 'm1')).toBe(false);
    expect(visitsInMonth(undone, undone.members.m1, '2026-10')).toHaveLength(10);
    const again = checkIn(undone, 'm1', 'manual');
    for (const u of ['s9', 's10']) expect(updatesFor(again, as(u)).filter((x) => x.kind === 'lobby.notif.extraVisit')).toHaveLength(1);
  });
  it('the note does not repeat when the member checks out', () => {
    const s = checkIn(base, 'm1');
    const out = run(s, 'attendance.checkOut', { memberId: 'm1' }).state;
    expect(updatesFor(out, as('s9')).filter((x) => x.kind === 'lobby.notif.extraVisit')).toHaveLength(1);
  });
});

describe('attendance.checkOut', () => {
  it('checks out, tells the family, keeps history; nobody is recorded as collecting', () => {
    const r = run(base, 'attendance.checkOut', { memberId: 'm2' });
    expect(att(r.state, 'm2').checkOut).toMatchObject({ at: '10:00', by: 'staff:s1', method: 'manual' });
    expect(att(r.state, 'm2').checkOut).not.toHaveProperty('escort');
    expect(att(r.state, 'm2').edits.map((e) => e.what)).toEqual(['checkIn', 'checkOut']);
    expect(unreadUpdates(r.state, as('fm2_0')).some((x) => x.kind === 'notif.checkedOut' && x.params.time === '10:00')).toBe(true);
    expect(lobbyGroups(r.state, clock.today).goneHome.map((x) => x.m.id)).toEqual(['m2']);
    // an old client that still sends a collector gets the same result
    const old = run(base, 'attendance.checkOut', { memberId: 'm2', escort: { kind: 'driver', staffId: 's7' } });
    expect(att(old.state, 'm2').checkOut).not.toHaveProperty('escort');
  });
  it('needs a check-in first, once only', () => {
    expect(() => run(base, 'attendance.checkOut', { memberId: 'm46' })).toThrow('err.notCheckedIn');
    const out = run(base, 'attendance.checkOut', { memberId: 'm2' }).state;
    expect(() => run(out, 'attendance.checkOut', { memberId: 'm2' })).toThrow('err.alreadyCheckedOut');
    expect(() => run(base, 'attendance.checkOut', {})).toThrow('err.invalid');
    expect(() => run(base, 'attendance.checkOut', { memberId: 'nobody' })).toThrow('err.notFound');
  });
  it('a member whose membership ends today can still be checked out on the last day', () => {
    const s = produce(base, (d) => { d.members.m2.memberships[0].lastDay = clock.today; });
    expect(att(run(s, 'attendance.checkOut', { memberId: 'm2' }).state, 'm2').checkOut?.at).toBe('10:00');
  });
  it('forbids roles without the lobby', () => {
    expect(() => run(base, 'attendance.checkOut', { memberId: 'm2' }, 's8')).toThrow('err.forbidden');
    expect(att(run(base, 'attendance.checkOut', { memberId: 'm2' }, 's9').state, 'm2').checkOut?.by).toBe('staff:s9');
  });
});

describe('attendance.undoCheckIn', () => {
  it('reverses the check-in: photo voided, family notice retracted, history kept, back on the check-in list', () => {
    const s = checkIn(base, 'm1');
    const r = run(s, 'attendance.undoCheckIn', { memberId: 'm1' });
    const a = att(r.state, 'm1');
    expect(a.checkIn).toBeUndefined();
    expect(a.edits.map((e) => e.what)).toEqual(['checkIn', 'undoCheckIn']);
    const photo = Object.values(r.state.photos).find((p) => p.kind === 'arrival' && p.date === clock.today && p.memberIds[0] === 'm1');
    expect(photo?.visibility).toBe('removed');
    expect(photo?.moderated).toMatchObject({ by: 's1', reason: 'undoCheckIn' });
    expect(updatesFor(r.state, as('f1')).some((x) => x.kind === 'notif.checkedIn' && x.memberId === 'm1' && x.params.time === '10:00')).toBe(false);
    expect(updatesFor(r.state, as('f1')).some((x) => x.kind === 'notif.checkedIn' && x.memberId === 'm2')).toBe(false); // only her own
    expect(Object.values(r.state.activity).some((x) => x.key === 'lobby.feed.undoIn')).toBe(true);
    expect(lobbyGroups(r.state, clock.today).others.some((x) => x.m.id === 'm1')).toBe(true);
    expect(lobbyGroups(r.state, clock.today).inClub.some((x) => x.m.id === 'm1')).toBe(false);
    // checking in again works and makes a fresh photo
    const again = checkIn(r.state, 'm1');
    expect(att(again, 'm1').checkIn).toBeTruthy();
  });
  it('the visit no longer counts after the undo', () => {
    const s = checkIn(base, 'm46', 'manual');
    expect(visitsInMonth(s, s.members.m46, '2026-10')).toHaveLength(15);
    const r = run(s, 'attendance.undoCheckIn', { memberId: 'm46' });
    expect(visitsInMonth(r.state, r.state.members.m46, '2026-10')).toHaveLength(14);
  });
  it('only before check-out; needs a check-in; clears a departure request', () => {
    expect(() => run(base, 'attendance.undoCheckIn', { memberId: 'm1' })).toThrow('err.notCheckedIn');
    const out = run(base, 'attendance.checkOut', { memberId: 'm2' }).state;
    expect(() => run(out, 'attendance.undoCheckIn', { memberId: 'm2' })).toThrow('lobby.err.undoAfterOut');
    const asked = run(base, 'attendance.askDeparture', { memberId: 'm10' }).state;
    expect(att(run(asked, 'attendance.undoCheckIn', { memberId: 'm10' }).state, 'm10').departureAsked).toBeUndefined();
  });
  it('is for lobby and management only', () => {
    const s = checkIn(base, 'm1');
    expect(() => run(s, 'attendance.undoCheckIn', { memberId: 'm1' }, 's8')).toThrow('err.forbidden');
    expect(att(run(s, 'attendance.undoCheckIn', { memberId: 'm1' }, 's9').state, 'm1').checkIn).toBeUndefined();
  });
});

describe('attendance.undoCheckOut', () => {
  it('puts the member back in the club and retracts the "checked out" message', () => {
    const out = run(base, 'attendance.checkOut', { memberId: 'm2' }).state;
    const r = run(out, 'attendance.undoCheckOut', { memberId: 'm2' });
    expect(att(r.state, 'm2').checkOut).toBeUndefined();
    expect(att(r.state, 'm2').edits.map((e) => e.what)).toEqual(['checkIn', 'checkOut', 'undoCheckOut']);
    expect(updatesFor(r.state, as('fm2_0')).some((x) => x.kind === 'notif.checkedOut')).toBe(false);
    expect(updatesFor(r.state, as('fm2_0')).some((x) => x.kind === 'notif.checkedIn')).toBe(true); // the morning check-in stays
    expect(lobbyGroups(r.state, clock.today).inClub.some((x) => x.m.id === 'm2')).toBe(true);
  });
  it('needs a check-out to undo', () => {
    expect(() => run(base, 'attendance.undoCheckOut', { memberId: 'm2' })).toThrow('lobby.err.notCheckedOut');
    expect(() => run(base, 'attendance.undoCheckOut', { memberId: 'm46' })).toThrow('err.notCheckedIn');
  });
});

describe('attendance.askDeparture', () => {
  it('sets the request and the nurse queue picks it up', () => {
    const r = run(base, 'attendance.askDeparture', { memberId: 'm10' });
    expect(att(r.state, 'm10').departureAsked).toEqual({ at: '10:00', by: 'staff:s1' });
    expect(att(r.state, 'm10').edits.at(-1)?.what).toBe('departureAsked');
    const q = nurseQueue(r.state, clock.today, clock.nowMin);
    const item = [...q.todo, ...q.later].find((x) => x.key === 'departure:m10');
    expect(item).toMatchObject({ kind: 'departure', due: '10:00' });
    expect([...nurseQueue(base, clock.today, clock.nowMin).todo].some((x) => x.key === 'departure:m10')).toBe(false);
  });
  it('is idempotent and re-queues a departure check the nurse skipped', () => {
    const once = run(base, 'attendance.askDeparture', { memberId: 'm10' }).state;
    expect(run(once, 'attendance.askDeparture', { memberId: 'm10' }).patches).toHaveLength(0);
    const skipped = produce(once, (d) => { d.attendance[`${clock.today}:m10`].dismissed.push({ at: '10:01', by: 'staff:s8', kind: 'departure', reason: 'later' }); });
    const r = run(skipped, 'attendance.askDeparture', { memberId: 'm10' }, 's1', { today: clock.today, nowMin: 610 });
    expect(att(r.state, 'm10').dismissed).toHaveLength(0);
    expect(att(r.state, 'm10').departureAsked?.at).toBe('10:10');
  });
  it('needs the member in the club', () => {
    expect(() => run(base, 'attendance.askDeparture', { memberId: 'm46' })).toThrow('err.notCheckedIn');
    const out = run(base, 'attendance.checkOut', { memberId: 'm2' }).state;
    expect(() => run(out, 'attendance.askDeparture', { memberId: 'm2' })).toThrow('err.alreadyCheckedOut');
    expect(() => run(base, 'attendance.askDeparture', { memberId: 'm10' }, 's8')).toThrow('err.forbidden');
  });
});

describe('guest.* (trial and visit guests: booked for a date and time)', () => {
  it('checks the trial guest in and puts her in the nurse queue; a visit guest has no health check', () => {
    const r = run(base, 'guest.checkIn', { guestId: 'g-e1' });
    expect(r.state.guestVisits['g-e1'].checkIn).toEqual({ at: '10:00', by: 'staff:s1' });
    expect(r.result).toMatchObject({ time: '10:00', healthCheck: true });
    const q = nurseQueue(r.state, clock.today, clock.nowMin);
    const item = q.todo.find((x) => x.key === 'arrival:g-e1');
    expect(item?.person.type).toBe('guest');
    expect(Object.values(r.state.activity).some((x) => x.key === 'lobby.feed.guestTrial')).toBe(true);
    const v = run(r.state, 'guest.checkIn', { guestId: 'g-e2' }).state;
    expect(nurseQueue(v, clock.today, clock.nowMin).todo.some((x) => x.key === 'arrival:g-e2')).toBe(false);
  });
  it('checks a guest out once, after check-in', () => {
    expect(() => run(base, 'guest.checkOut', { guestId: 'g-e1' })).toThrow('err.notCheckedIn');
    const s = run(base, 'guest.checkIn', { guestId: 'g-e1' }).state;
    const out = run(s, 'guest.checkOut', { guestId: 'g-e1' }, 's1', { today: clock.today, nowMin: 700 });
    expect(out.state.guestVisits['g-e1'].checkOut?.at).toBe('11:40');
    expect(() => run(out.state, 'guest.checkOut', { guestId: 'g-e1' })).toThrow('err.alreadyCheckedOut');
    expect(nurseQueue(out.state, clock.today, 700).todo.some((x) => x.key === 'arrival:g-e1')).toBe(false);
  });
  it('marks a no-show, and a late arrival after a no-show checks in again', () => {
    const r = run(base, 'guest.noShow', { guestId: 'g-e1' });
    expect(r.state.guestVisits['g-e1'].status).toBe('noShow');
    expect(run(r.state, 'guest.noShow', { guestId: 'g-e1' }).patches).toHaveLength(0);
    const late = run(r.state, 'guest.checkIn', { guestId: 'g-e1' }).state;
    expect(late.guestVisits['g-e1']).toMatchObject({ status: 'booked', checkIn: { at: '10:00' } });
    expect(() => run(late, 'guest.noShow', { guestId: 'g-e1' })).toThrow('lobby.err.guestArrived');
  });
  it('can undo a check-in and a no-show', () => {
    const s = run(base, 'guest.checkIn', { guestId: 'g-e1' }).state;
    expect(run(s, 'guest.undoCheckIn', { guestId: 'g-e1' }).state.guestVisits['g-e1'].checkIn).toBeUndefined();
    const ns = run(base, 'guest.noShow', { guestId: 'g-e2' }).state;
    expect(run(ns, 'guest.undoNoShow', { guestId: 'g-e2' }).state.guestVisits['g-e2'].status).toBe('booked');
    expect(() => run(base, 'guest.undoCheckIn', { guestId: 'g-e1' })).toThrow('err.notCheckedIn');
  });
  it('only today’s guests, only booked ones, only lobby and management', () => {
    expect(() => run(base, 'guest.checkIn', { guestId: 'g-e1' }, 's1', { today: '2026-10-22', nowMin: 600 })).toThrow('lobby.err.guestNotToday');
    const cancelled = produce(base, (d) => { d.guestVisits['g-e1'].status = 'cancelled'; });
    expect(() => run(cancelled, 'guest.checkIn', { guestId: 'g-e1' })).toThrow('lobby.err.guestCancelled');
    expect(() => run(base, 'guest.checkIn', { guestId: 'nope' })).toThrow('err.notFound');
    expect(() => run(base, 'guest.checkIn', {})).toThrow('err.invalid');
    for (const u of ['s8', 's10', 'f1']) expect(() => run(base, 'guest.checkIn', { guestId: 'g-e1' }, u)).toThrow('err.forbidden');
    expect(run(base, 'guest.checkIn', { guestId: 'g-e1' }, 's9').state.guestVisits['g-e1'].checkIn?.by).toBe('staff:s9');
  });
});

describe('determinism', () => {
  it('the same mutation id gives the same patches (client and server agree), also for an extra-day check-in', () => {
    const a = execute(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, as('s1'), clock, 'mx');
    const b = execute(buildSeed().citra, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, as('s1'), clock, 'mx');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
    const o1 = execute(a.state, 'attendance.checkOut', { memberId: 'm1' }, as('s1'), clock, 'my');
    const o2 = execute(b.state, 'attendance.checkOut', { memberId: 'm1' }, as('s1'), clock, 'my');
    expect(JSON.stringify(o1.patches)).toEqual(JSON.stringify(o2.patches));
  });
  it('does not change the seed it was given', () => {
    const before = JSON.stringify(base.attendance);
    run(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' });
    expect(JSON.stringify(base.attendance)).toBe(before);
  });
});
