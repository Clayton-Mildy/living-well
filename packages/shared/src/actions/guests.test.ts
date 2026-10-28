// KC round 7: guest hosts. Booking a guest for a date and session, marking it done (the fee becomes a vendor invoice finance pays), and the rules over it.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, live, sessionsOn, projectForFamily, DomainError, type ClubState } from '../index';
import { dayInfo } from '../rules/calendar';
import { feeOfSession, guestInvoiceNumber, guestIssue, guestLists, guestOn, guestSessionsOn, hostTotals, hostsList, owedTotal, payStateOf } from '../rules/guests';

const clock = { today: '2026-10-21', nowMin: 600 }; // Wed 21 Oct, 10:00
let n = 0;
const fresh = (): ClubState => { const s = buildSeed().citra; return s; };
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid = 's9') => execute(s, name, input, as(s, uid), clock, `g${++n}`);
const step = (s: ClubState, name: string, input: unknown, uid = 's9') => run(s, name, input, uid).state;
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const note = (s: ClubState, kind: string) => live(s.notifications).filter((x) => x.kind === kind);
const notLobby = (s: ClubState, kind: string) => note(s, kind).filter((x) => !(x.toRoles.length === 1 && x.toRoles[0] === 'lobby'));

describe('the demo seed', () => {
  it('has three hosts, two sessions done (one paid, one waiting for finance), one booked today and one tomorrow (both paid in advance) and one next week (to pay)', () => {
    const s = fresh();
    expect(hostsList(s).map((h) => h.name)).toEqual(['Bu Ratna', 'dr. Maya Sari', 'Pak Hendro']);
    const l = guestLists(s);
    expect(l.upcoming.map((g) => [g.hostId, g.date, g.slot])).toEqual([['gh-hendro', '2026-10-21', '10:30'], ['gh-maya', '2026-10-22', '13:30'], ['gh-hendro', '2026-10-28', '10:30']]);
    expect(l.paid.map((g) => g.id)).toEqual(['gs-3', 'gs-5', 'gs-1']); // dr. Maya is paid before her talk
    expect(l.toPay.map((g) => g.id)).toEqual(['gs-2', 'gs-4']);
    expect(l.doneToPay.map((g) => g.id)).toEqual(['gs-2']);
    expect(l.donePaid.map((g) => g.id)).toEqual(['gs-1']);
    expect(payStateOf(s, s.guestSessions['gs-1'])).toBe('paid');
    expect(payStateOf(s, s.guestSessions['gs-2'])).toBe('toPay');
    expect(payStateOf(s, s.guestSessions['gs-3'])).toBe('paid');
    expect(s.vendorInvoices['vi-gh-2']).toMatchObject({ status: 'approved', xero: 'synced', sectionId: 'activities', supplier: 'Bu Ratna', amount: 750000 });
    expect(s.vendorInvoices['vi-gh-1']).toMatchObject({ status: 'paid', supplier: 'Pak Hendro', amount: 900000 });
    expect(s.vendorInvoices['vi-gh-4']).toMatchObject({ status: 'approved', supplier: 'Pak Hendro', amount: 900000, due: '2026-10-28' });
    expect([1, 2, 3, 4, 5].map((n) => s.vendorInvoices[`vi-gh-${n}`].number)).toEqual(['GH-2610-001', 'GH-2610-002', 'GH-2610-003', 'GH-2610-004', 'GH-2610-005']);
    expect(s.guestSessions['gs-5']).toMatchObject({ hostId: 'gh-hendro', date: '2026-10-21', slot: '10:30', activityId: 'act-keroncong', status: 'booked' }); // the demo day itself, the weekly plan already has keroncong
    expect(s.scheduleDays['2026-10-21']).toBeUndefined(); // so no schedule change
    expect(owedTotal(s)).toBe(750000 + 900000);
    expect(hostTotals(s, 'gh-ratna')).toEqual({ sessions: 1, upcoming: 0, paid: 0, owed: 750000 });
    expect(hostTotals(s, 'gh-hendro')).toEqual({ sessions: 1, upcoming: 2, paid: 1800000, owed: 900000 }); // gs-1 (done, paid) + gs-5 (today, paid in advance); gs-4 is still to pay
    expect(hostTotals(s, 'gh-maya')).toEqual({ sessions: 0, upcoming: 1, paid: 1200000, owed: 0 });
    for (const g of live(s.guestSessions)) expect(guestIssue(s, g)).toBeNull();
  });

  it('on a Thursday the demo-day guest leads an activity their host teaches, and the lobby rail and the calendar agree', () => {
    const TEACHES: Record<string, string> = { 'gh-ratna': 'act-angklung', 'gh-hendro': 'act-keroncong', 'gh-maya': 'act-talk' };
    const s = buildSeed('2026-10-22').citra;
    const today = guestSessionsOn(s, '2026-10-22').filter((x) => x.session.status === 'booked' && x.session.id === 'gs-5');
    expect(today).toHaveLength(1);
    const g = today[0];
    expect(g.session.activityId).toBe(TEACHES[g.host.id]);
    expect(g.activity?.id).toBe(g.session.activityId); // the rail's activity name
    const item = dayInfo(s, '2026-10-22', 'staff').items.find((i) => i.time === g.session.slot)!; // the calendar's session
    expect(item).toMatchObject({ activityId: g.session.activityId, guest: { sessionId: 'gs-5', name: g.host.name } });
  });
  it('shows the guest on the calendar: staff and family see who leads; families never see fees', () => {
    const s = fresh();
    const staff = dayInfo(s, '2026-10-22', 'staff').items.find((i) => i.time === '13:30')!;
    expect(staff).toMatchObject({ activityId: 'act-talk', changed: true, guest: { name: 'dr. Maya Sari', what: 'Talk on heart health' } });
    expect(guestOn(s, '2026-10-22', '13:30')?.session.id).toBe('gs-3');
    const fam = projectForFamily(s, 'f1');
    expect(dayInfo(fam, '2026-10-22', 'family').items.find((i) => i.time === '13:30')?.guest?.name).toBe('dr. Maya Sari');
    expect(fam.guestSessions['gs-3'].fee).toBe(0);
    expect(fam.scheduleDays['2026-10-23'].slots['13:30']?.activityId).toBe('act-karaoke'); // the changed session reaches families
    expect(fam.scheduleDays['2026-10-23'].note).toBeUndefined(); // the note is for staff
    expect(fam.guestHosts['gh-maya'].phone).toBe('');
    expect(fam.guestHosts['gh-maya'].bank).toBeUndefined();
    expect(JSON.stringify(fam.guestSessions)).not.toContain('vi-gh');
  });
});

describe('round 13: the front desk sees guest hosts', () => {
  it('lists the booked and done sessions of a day by slot with host and activity; a cancelled one leaves the list and the lobby is told', () => {
    let s = fresh();
    expect(guestSessionsOn(s, '2026-10-22').map((x) => [x.session.id, x.host.name, x.activity?.name])).toEqual([['gs-3', 'dr. Maya Sari', 'Health talk']]);
    expect(guestSessionsOn(s, '2026-10-23')).toEqual([]);
    const r = run(s, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30' });
    s = r.state;
    expect(guestSessionsOn(s, '2026-10-22').map((x) => x.session.slot)).toEqual(['10:30', '13:30']);
    expect(guestSessionsOn(s, '2026-10-22')[0]).toMatchObject({ host: { name: 'Bu Ratna' }, activity: { id: 'act-garden' } });
    expect(note(s, 'guests.notif.booked').filter((x) => x.toRoles.includes('lobby'))).toHaveLength(1);
    s = step(s, 'guest.cancel', { id: r.result.sessionId });
    expect(guestSessionsOn(s, '2026-10-22').map((x) => x.session.slot)).toEqual(['13:30']);
    const gone = note(s, 'guests.notif.cancelled').filter((x) => x.toRoles.includes('lobby'));
    expect(gone).toHaveLength(1);
    expect(gone[0]).toMatchObject({ toRoles: ['lobby'], params: { name: 'Bu Ratna', slot: '10:30' } });
    expect(note(s, 'guests.notif.booked').filter((x) => x.toRoles.includes('lobby'))).toHaveLength(0); // the front desk's "comes on …" notice is withdrawn
  });
  it('moving a booking withdraws the desk\'s old "will lead" notice, so exactly one live notice remains; cancelling leaves none', () => {
    const lobbyBooked = (st: ClubState) => note(st, 'guests.notif.booked').filter((x) => x.toRoles.length === 1 && x.toRoles[0] === 'lobby');
    const r = run(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30' });
    let s = r.state;
    expect(lobbyBooked(s)).toHaveLength(1);
    s = step(s, 'guest.update', { id: r.result.sessionId, date: '2026-10-23', slot: '13:30', activityId: 'act-angklung' });
    expect(lobbyBooked(s)).toHaveLength(1);
    expect(lobbyBooked(s)[0].params).toMatchObject({ date: '2026-10-23', slot: '13:30', sessionId: r.result.sessionId });
    s = step(s, 'guest.cancel', { id: r.result.sessionId });
    expect(lobbyBooked(s)).toHaveLength(0);
  });
  it('a session that took place stays on the list of its day', () => {
    const s = fresh();
    const g = s.guestSessions['gs-1'];
    expect(guestSessionsOn(s, g.date).map((x) => x.session.id)).toContain('gs-1');
  });
});

describe('guest.saveHost and guest.archiveHost', () => {
  const body = { name: 'Ibu Wati', kind: 'entertainer', what: 'Storyteller', phone: '0812 3456 7890', fee: 500000 };
  it('adds and edits a host (phone normalised, bank optional), names are unique', () => {
    const r = run(fresh(), 'guest.saveHost', { ...body, bank: { bank: 'BCA', account: '123', holder: 'Wati' } });
    const h = r.state.guestHosts[r.result.hostId as string];
    expect(h).toMatchObject({ name: 'Ibu Wati', kind: 'entertainer', phone: '+6281234567890', fee: 500000, active: true, bank: { bank: 'BCA', account: '123', holder: 'Wati' } });
    const e = step(r.state, 'guest.saveHost', { ...body, id: h.id, fee: 600000, bank: { bank: '', account: '', holder: '' }, active: false });
    expect(e.guestHosts[h.id]).toMatchObject({ fee: 600000, active: false });
    expect(e.guestHosts[h.id].bank).toBeUndefined();
    fails(r.state, 'guest.saveHost', { ...body, name: ' ibu wati ' }, 's9', 'guests.err.dupHost');
    fails(fresh(), 'guest.saveHost', { ...body, fee: 0 }, 's9', 'err.invalid');
    fails(fresh(), 'guest.saveHost', { ...body, phone: '12' }, 's9', 'err.invalid');
  });

  it('a host with a booking cannot be archived; past sessions keep the name', () => {
    const s = fresh();
    fails(s, 'guest.archiveHost', { id: 'gh-maya' }, 's9', 'guests.err.hostBooked');
    const a = step(s, 'guest.archiveHost', { id: 'gh-ratna' }); // only a done session
    expect(hostsList(a).map((h) => h.id)).not.toContain('gh-ratna');
    expect(a.guestHosts['gh-ratna'].name).toBe('Bu Ratna');
    fails(a, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30' }, 's9', 'err.notFound');
  });

  it('management only', () => {
    for (const uid of ['s10', 's5', 's1', 'f1']) {
      fails(fresh(), 'guest.saveHost', body, uid, 'err.forbidden');
      fails(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30' }, uid, 'err.forbidden');
      fails(fresh(), 'guest.done', { id: 'gs-3' }, uid, 'err.forbidden');
    }
  });
});

describe('guest.book', () => {
  it('books the session that is on (its activity, the host usual fee); one guest per date and session', () => {
    const r = run(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30' });
    const g = r.state.guestSessions[r.result.sessionId as string];
    expect(g).toMatchObject({ hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30', activityId: 'act-garden', fee: 750000, status: 'booked' });
    expect(r.state.scheduleDays['2026-10-22'].slots['10:30']).toBeUndefined(); // nothing changed for that day
    expect(guestOn(r.state, '2026-10-22', '10:30')?.host.name).toBe('Bu Ratna');
    // the teachers hear about it, families do not (the session is the same)
    const ns = note(r.state, 'guests.notif.booked');
    expect(notLobby(r.state, 'guests.notif.booked').at(-1)).toMatchObject({ toRoles: ['activity'], toUsers: [], params: { name: 'Bu Ratna', activity: 'Gardening club', slot: '10:30' } });
    // round 13: the front desk hears too, in a notice of its own
    expect(ns.filter((x) => x.toRoles.includes('lobby'))).toHaveLength(1);
    expect(ns.find((x) => x.toRoles.includes('lobby'))).toMatchObject({ toRoles: ['lobby'], link: '/calendar', params: { name: 'Bu Ratna', slot: '10:30' } });
    fails(r.state, 'guest.book', { hostId: 'gh-hendro', date: '2026-10-22', slot: '10:30' }, 's9', 'guests.err.slotTaken');
    fails(fresh(), 'guest.book', { hostId: 'gh-hendro', date: '2026-10-22', slot: '13:30' }, 's9', 'guests.err.slotTaken'); // dr. Maya is booked then
    const custom = run(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-22', slot: '10:30', fee: 800000, note: 'Bring the set' }).state;
    expect(live(custom.guestSessions).find((x) => x.date === '2026-10-22' && x.slot === '10:30')).toMatchObject({ fee: 800000, note: 'Bring the set' });
  });

  it('another activity changes that day only (the weekly plan stays) and tells teachers and families; cancelling gives it back', () => {
    const r = run(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-26', slot: '13:30', activityId: 'act-angklung' });
    let s = r.state;
    expect(sessionsOn(s, '2026-10-26')[1].cell).toEqual({ activityId: 'act-angklung', staffId: 's6', roomId: 'room-music' }); // Monday 13:30 was chair yoga with Kak Dimas
    expect(sessionsOn(s, '2026-10-19')[1].cell?.activityId).toBe('act-yoga'); // other Mondays keep the plan
    const told = notLobby(s, 'guests.notif.booked').at(-1)!;
    expect(told.toUsers.length).toBeGreaterThan(0);
    expect(dayInfo(s, '2026-10-26', 'staff').items.find((i) => i.time === '13:30')).toMatchObject({ changed: true, guest: { name: 'Bu Ratna' } });
    s = step(s, 'guest.cancel', { id: r.result.sessionId });
    expect(s.guestSessions[r.result.sessionId as string].status).toBe('cancelled');
    expect(sessionsOn(s, '2026-10-26')[1].cell?.activityId).toBe('act-yoga');
    expect(s.scheduleDays['2026-10-26']).toBeUndefined();
    expect(guestOn(s, '2026-10-26', '13:30')).toBeNull();
    expect(notLobby(s, 'guests.notif.cancelled')).toHaveLength(1);
    fails(s, 'guest.cancel', { id: r.result.sessionId }, 's9', 'guests.err.notBooked');
    expect(guestLists(s).cancelled.map((g) => g.id)).toEqual([r.result.sessionId]);
  });

  it('needs an open day (today or later, no outing) and an active host', () => {
    const s = fresh();
    fails(s, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-20', slot: '10:30' }, 's9', 'cal.err.pastDay');
    fails(s, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-24', slot: '10:30' }, 's9', 'cal.err.dayClosed');
    fails(s, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-30', slot: '10:30' }, 's9', 'cal.err.dayClosed');
    fails(s, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-29', slot: '10:30' }, 's9', 'cal.err.dayOuting');
    fails(s, 'guest.book', { hostId: 'gh-ghost', date: '2026-10-26', slot: '10:30' }, 's9', 'err.notFound');
    const off = step(s, 'guest.saveHost', { id: 'gh-ratna', name: 'Bu Ratna', kind: 'teacher', what: 'Angklung teacher', phone: '+6281290112201', fee: 750000, active: false });
    fails(off, 'guest.book', { hostId: 'gh-ratna', date: '2026-10-26', slot: '10:30' }, 's9', 'guests.err.hostInactive');
  });

  it('guest.update edits a booking: fee, note, another date or host; a taken session is refused; a done one is closed', () => {
    const s = fresh();
    const e = step(s, 'guest.update', { id: 'gs-4', fee: 950000, note: 'Needs a microphone' });
    expect(e.guestSessions['gs-4']).toMatchObject({ fee: 950000, note: 'Needs a microphone' });
    const moved = step(s, 'guest.update', { id: 'gs-4', date: '2026-10-27', slot: '13:30', activityId: 'act-keroncong' });
    expect(moved.guestSessions['gs-4']).toMatchObject({ date: '2026-10-27', slot: '13:30' });
    expect(sessionsOn(moved, '2026-10-27')[1].cell?.activityId).toBe('act-keroncong');
    expect(sessionsOn(moved, '2026-10-28')[0].cell?.activityId).toBe('act-keroncong'); // the weekly plan on the old date
    fails(s, 'guest.update', { id: 'gs-4', date: '2026-10-22', slot: '13:30' }, 's9', 'guests.err.slotTaken');
    fails(s, 'guest.update', { id: 'gs-4' }, 's9', 'err.noChanges');
    fails(s, 'guest.update', { id: 'gs-2', fee: 1 }, 's9', 'guests.err.notBooked');
  });
});

describe('KC round 7: the fee is a payable from the booking, so it can be paid before the session', () => {
  it('booking makes an approved invoice (GH-YYMM-nnn, due on the day, Activities) and tells finance; finance can pay before; done only marks the session', () => {
    const b = run(fresh(), 'guest.book', { hostId: 'gh-ratna', date: '2026-10-21', slot: '13:30', fee: 820000 }); // today
    let s = b.state;
    const id = b.result.sessionId as string;
    const viId = b.result.vendorInvoiceId as string;
    expect(s.vendorInvoices[viId]).toMatchObject({ supplier: 'Bu Ratna', number: 'GH-2610-006', amount: 820000, due: '2026-10-21', sectionId: 'activities', status: 'approved', xero: 'pending' });
    expect(s.guestSessions[id]).toMatchObject({ status: 'booked', vendorInvoiceId: viId });
    expect(payStateOf(s, s.guestSessions[id])).toBe('toPay');
    expect(note(s, 'guests.notif.toPay')[0]).toMatchObject({ toRoles: ['finance'], link: '/guests', params: { name: 'Bu Ratna', amount: 'Rp 820.000', number: 'GH-2610-006' } });
    // paid before the performance
    s = step(s, 'vendorInvoice.markPaid', { vendorInvoiceId: viId }, 's10');
    expect(payStateOf(s, s.guestSessions[id])).toBe('paid');
    // done only records the session: no second invoice
    fails(fresh(), 'guest.done', { id: 'gs-3' }, 's9', 'guests.err.notYet'); // dr. Maya is booked for tomorrow
    const before = Object.keys(s.vendorInvoices).length;
    s = run(s, 'guest.done', { id }).state;
    expect(s.guestSessions[id]).toMatchObject({ status: 'done', vendorInvoiceId: viId });
    expect(Object.keys(s.vendorInvoices)).toHaveLength(before);
    expect(guestLists(s).donePaid.map((g) => g.id)).toContain(id);
    expect(hostTotals(s, 'gh-ratna')).toMatchObject({ sessions: 2, paid: 820000, owed: 750000 });
    fails(s, 'guest.done', { id }, 's9', 'guests.err.notBooked');
    fails(s, 'guest.cancel', { id }, 's9', 'guests.err.notBooked');
  });

  it('changing a booking updates its unpaid invoice; cancelling withdraws it, or tells finance about a paid one', () => {
    let s = step(fresh(), 'guest.update', { id: 'gs-4', fee: 950000 });
    expect(s.vendorInvoices['vi-gh-4']).toMatchObject({ amount: 950000, status: 'approved' });
    s = step(s, 'guest.cancel', { id: 'gs-4' });
    expect(s.vendorInvoices['vi-gh-4'].status).toBe('rejected');
    expect(payStateOf(s, s.guestSessions['gs-4'])).toBe('none');
    // dr. Maya was paid in advance: the paid invoice stays and finance is told to get the money back
    s = step(s, 'guest.cancel', { id: 'gs-3' });
    expect(s.vendorInvoices['vi-gh-3'].status).toBe('paid');
    expect(note(s, 'guests.notif.paidCancelled')).toHaveLength(1);
  });

  it('invoice numbers are unique per month; a deleted invoice puts the session back to "to pay"', () => {
    const s = fresh();
    expect(guestInvoiceNumber(s, '2026-10-21')).toBe('GH-2610-006');
    expect(guestInvoiceNumber(s, '2026-11-02')).toBe('GH-2611-001');
    const d = step(s, 'vendorInvoice.delete', { vendorInvoiceId: 'vi-gh-2' }, 's10');
    expect(payStateOf(d, d.guestSessions['gs-2'])).toBe('toPay');
    expect(feeOfSession(d, d.guestSessions['gs-2'])).toBe(750000);
  });
});
