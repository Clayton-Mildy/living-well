import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, updatesFor, DomainError, type ClubState } from '../index';
import { actionItems } from '../notify';
import { leaveBalance, leaveDaysBetween, leaveOf, onLeave, pendingLeave } from '../rules/staffLeave';
import { staffTimeId } from '../rules/mgmt';
import { projectForFamily } from '../project';
import { live } from '../util';

const T = '2026-10-21'; // Wednesday
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const mid = () => `sl${++n}`;
const seed = () => buildSeed().citra;
const user = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, user(s, uid), clock, mid());
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const newOnes = (before: ClubState, after: ClubState) => Object.keys(after.leaveRequests).filter((k) => !(k in before.leaveRequests));
// Mon 16 and Tue 17 Nov are open club days, clear of the seeded requests (Caca waits for 9-10 Nov)
const ask = { from: '2026-11-16', to: '2026-11-17', reason: 'Visiting my sister in Surabaya' };

describe('staff leave (actions)', () => {
  it('any staff member asks: pending, counted in open club days, for herself', () => {
    const s = seed();
    const r = run(s, 'leave.request', ask, 's1');
    const [id] = newOnes(s, r.state);
    expect(r.state.leaveRequests[id]).toMatchObject({ staffId: 's1', from: '2026-11-16', to: '2026-11-17', days: 2, status: 'pending', reason: ask.reason });
    // the weekend in between is not counted
    const w = run(s, 'leave.request', { from: '2026-11-13', to: '2026-11-16', reason: 'Long weekend' }, 's5');
    expect(w.state.leaveRequests[newOnes(s, w.state)[0]]).toMatchObject({ staffId: 's5', days: 2 });
    for (const uid of ['s3', 's8', 's9', 's10']) expect(() => run(s, 'leave.request', ask, uid)).not.toThrow();
    expect(() => run(s, 'leave.request', ask, 'f1')).toThrow('err.forbidden');
  });
  it('refuses an empty reason, the past, closed days only, two years, an overlap and more than is left', () => {
    const s = seed();
    fails(s, 'leave.request', { ...ask, reason: '  ' }, 's1', 'people.err.leaveReason');
    fails(s, 'leave.request', { ...ask, from: '2026-10-20', to: '2026-10-22' }, 's1', 'people.err.leavePast');
    fails(s, 'leave.request', { from: '2026-11-14', to: '2026-11-15', reason: 'x' }, 's1', 'people.err.leaveNoDays'); // a weekend
    fails(s, 'leave.request', { from: '2026-12-25', to: '2026-12-25', reason: 'x' }, 's1', 'people.err.leaveNoDays'); // Christmas Day
    fails(s, 'leave.request', { from: '2026-12-31', to: '2027-01-04', reason: 'x' }, 's1', 'people.err.leaveYear');
    fails(s, 'leave.request', { ...ask, from: '2026-11-18', to: '2026-11-16' }, 's1', 'err.invalid');
    // Caca already waits for 9-10 Nov
    fails(s, 'leave.request', { from: '2026-11-10', to: '2026-11-11', reason: 'x' }, 's1', 'people.err.leaveOverlap');
    const once = run(s, 'leave.request', ask, 's1').state;
    fails(once, 'leave.request', { from: '2026-11-17', to: '2026-11-17', reason: 'x' }, 's1', 'people.err.leaveOverlap');
    // someone else may ask for the same days
    expect(() => run(once, 'leave.request', ask, 's5')).not.toThrow();
    // 5 a year: Caca has 1 used + 2 waiting, so 3 more days are too many; Dinar has 3 left, 4 is too many
    fails(s, 'leave.request', { from: '2026-11-16', to: '2026-11-18', reason: 'x' }, 's1', 'people.err.leaveTooMany');
    fails(s, 'leave.request', { from: '2026-11-16', to: '2026-11-19', reason: 'x' }, 's5', 'people.err.leaveTooMany');
    expect(() => run(s, 'leave.request', { from: '2026-11-16', to: '2026-11-18', reason: 'x' }, 's5')).not.toThrow();
  });
  it('only management decides; approving writes one leave row per open day and tells the requester', () => {
    const s = seed();
    fails(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's1', 'err.forbidden');
    fails(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's10', 'err.forbidden');
    const r = run(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's9');
    expect(r.state.leaveRequests['lv-3']).toMatchObject({ status: 'approved', decidedBy: 'staff:s9' });
    expect(r.state.leaveRequests['lv-3'].decidedAt).toBeTruthy();
    const rows = live(r.state.staffTime).filter((t) => t.staffId === 's1' && t.kind === 'leave' && t.date >= '2026-11-01');
    expect(rows.map((t) => t.id).sort()).toEqual([staffTimeId('s1', '2026-11-09'), staffTimeId('s1', '2026-11-10')]);
    expect(onLeave(r.state, 's1', '2026-11-09')).toBe(true);
    expect(onLeave(r.state, 's1', '2026-11-11')).toBe(false);
    expect(onLeave(s, 's1', '2026-11-09')).toBe(false);
    const told = updatesFor(r.state, user(r.state, 's1')).filter((x) => x.kind === 'people.notif.leaveApproved');
    expect(told).toHaveLength(1);
    expect(updatesFor(r.state, user(r.state, 's5')).some((x) => x.kind === 'people.notif.leaveApproved')).toBe(false);
    // deciding twice is refused
    fails(r.state, 'leave.decide', { requestId: 'lv-3', approve: false }, 's9', 'people.err.leaveDecided');
  });
  it('declining keeps the days and tells the requester with the note', () => {
    const s = seed();
    const r = run(s, 'leave.decide', { requestId: 'lv-3', approve: false, note: 'We are short that week' }, 's9');
    expect(r.state.leaveRequests['lv-3']).toMatchObject({ status: 'declined', note: 'We are short that week' });
    expect(live(r.state.staffTime).some((t) => t.staffId === 's1' && t.kind === 'leave' && t.date === '2026-11-09')).toBe(false);
    const told = updatesFor(r.state, user(r.state, 's1')).filter((x) => x.kind === 'people.notif.leaveDeclined');
    expect(told).toHaveLength(1);
    expect(told[0].params).toMatchObject({ note: 'We are short that week' });
    expect(leaveBalance(r.state, 's1', 2026)).toMatchObject({ used: 1, waiting: 0, left: 4 });
  });
  it('the balance is checked again when management approves', () => {
    const s = seed();
    s.leaveRequests['lv-2'].days = 4; // Caca has used 4 of 5, so her 2 waiting days no longer fit
    fails(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's9', 'people.err.leaveTooMany');
    expect(() => run(s, 'leave.decide', { requestId: 'lv-3', approve: false }, 's9')).not.toThrow(); // declining is always possible
  });
  it('management may decide its own request (one manager in the club)', () => {
    const s = seed();
    const r = run(s, 'leave.request', ask, 's9');
    const [id] = newOnes(s, r.state);
    expect(() => run(r.state, 'leave.decide', { requestId: id, approve: true }, 's9')).not.toThrow();
  });
  it('cancel: the requester while it waits; management also after approval until it starts', () => {
    const s = seed();
    fails(s, 'leave.cancel', { requestId: 'lv-3' }, 's5', 'err.forbidden');
    fails(s, 'leave.cancel', { requestId: 'lv-3' }, 's10', 'err.forbidden');
    const own = run(s, 'leave.cancel', { requestId: 'lv-3' }, 's1');
    expect(own.state.leaveRequests['lv-3'].status).toBe('cancelled');
    expect(leaveBalance(own.state, 's1', 2026).waiting).toBe(0);
    fails(own.state, 'leave.cancel', { requestId: 'lv-3' }, 's1', 'err.forbidden'); // no longer waiting
    fails(own.state, 'leave.cancel', { requestId: 'lv-3' }, 's9', 'people.err.leaveDecided');
    const approved = run(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's9').state;
    fails(approved, 'leave.cancel', { requestId: 'lv-3' }, 's1', 'err.forbidden');
    const gone = run(approved, 'leave.cancel', { requestId: 'lv-3' }, 's9');
    expect(gone.state.leaveRequests['lv-3'].status).toBe('cancelled');
    expect(live(gone.state.staffTime).some((t) => t.staffId === 's1' && t.kind === 'leave' && t.date >= '2026-11-01')).toBe(false);
    expect(gone.state.staffTime[staffTimeId('s1', '2026-11-09')].deletedAt).toBeTruthy();
    expect(onLeave(gone.state, 's1', '2026-11-09')).toBe(false);
    expect(updatesFor(gone.state, user(gone.state, 's1')).some((x) => x.kind === 'people.notif.leaveCancelled')).toBe(true);
    // a leave that has already started (or is over) cannot be taken back
    fails(s, 'leave.cancel', { requestId: 'lv-1' }, 's9', 'people.err.leaveStarted');
    // a declined one cannot be cancelled
    fails(s, 'leave.cancel', { requestId: 'lv-4' }, 's9', 'people.err.leaveDecided');
  });
  it('balance, lists and the day count', () => {
    const s = seed();
    expect(leaveBalance(s, 's1', 2026)).toEqual({ allowance: 5, used: 1, waiting: 2, left: 4 });
    expect(leaveBalance(s, 's5', 2026)).toEqual({ allowance: 5, used: 2, waiting: 0, left: 3 });
    expect(leaveBalance(s, 's5', 2027)).toEqual({ allowance: 5, used: 0, waiting: 0, left: 5 });
    const after = run(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's9').state;
    expect(leaveBalance(after, 's1', 2026)).toEqual({ allowance: 5, used: 3, waiting: 0, left: 2 });
    expect(leaveDaysBetween(s, '2026-11-13', '2026-11-16')).toBe(2);
    expect(leaveOf(s, 's1').map((x) => x.id)).toEqual(['lv-3', 'lv-2']);
    expect(pendingLeave(s).map((x) => x.id)).toEqual(['lv-3']);
  });
  it('management sees one bell item per waiting request; the family never gets any rows', () => {
    const s = seed();
    const items = actionItems(s, user(s, 's9'), T, 600).filter((i) => i.kind === 'notif.act.leaveRequest');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ link: '/hr?staff=s1&tab=leave', severity: 'attention', params: { name: 'Caca', from: '2026-11-09', days: 2 } });
    expect(actionItems(s, user(s, 's1'), T, 600).some((i) => i.kind === 'notif.act.leaveRequest')).toBe(false);
    const after = run(s, 'leave.decide', { requestId: 'lv-3', approve: true }, 's9').state;
    expect(actionItems(after, user(after, 's9'), T, 600).some((i) => i.kind === 'notif.act.leaveRequest')).toBe(false);
    expect(projectForFamily(s, 'f1').leaveRequests).toEqual({});
  });
});
