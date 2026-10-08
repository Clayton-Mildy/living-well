// The brochure's terms (KC round 6): leave (cuti), suspension for an unpaid invoice, the stop on the 3rd, the registration fee on a first invoice.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  buildSeed, execute, getUser, systemUser, live, leaveCheck, leaveChoices, leaveDeadline, leaveNeedsWord, leaveOverrunMonth, membershipStatus, onLeaveOn, registrationDue,
  stopsDue, suspendDatesFor, suspensionOf, suspensions, updatesFor, type ClubState,
} from '../index';
import { runPlan } from '../rules/finance';

const T = '2026-10-21';
const clubs = buildSeed();
const base: ClubState = clubs.citra;
let n = 0;
const at = (today: string, nowMin = 600) => ({ today, nowMin });
const run = (s: ClubState, name: string, input: unknown, uid: string, clock = at(T)) => execute(s, name, input, getUser({ citra: s }, uid)!, clock, `m${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clock = at(T)) => expect(() => run(s, name, input, uid, clock)).toThrow(code);
const tick = (s: ClubState, clock: { today: string; nowMin: number }) => execute(s, 'jobs.tick', {}, systemUser('citra'), clock, `m${++n}`);
const lina = (s: ClubState) => s.members.m1;
const leaves = (s: ClubState, id = 'm1') => s.members[id].memberships.at(-1)!.leaves ?? [];
/** Nobody owes anything (the families have paid every invoice). */
const paidUp = (s: ClubState): ClubState =>
  produce(s, (d) => { for (const i of Object.values(d.invoices)) { const paid = Object.values(d.payments).flatMap((p) => p.allocations).filter((a) => a.invoiceId === i.id).reduce((t, a) => t + a.amount, 0); const total = i.lines.reduce((t, l) => t + l.amount, 0); if (total > paid) d.payments[`pp-${i.id}`] = { id: `pp-${i.id}`, clubId: 'citra', createdAt: `${i.issueDate}T12:00`, createdBy: 'system', memberId: i.memberId, method: 'dokuVa', amount: total - paid, receivedOn: i.issueDate, allocations: [{ invoiceId: i.id, amount: total - paid }], xero: 'synced', by: 'system' }; } });

describe('leave: who asks, how late, how many months', () => {
  it('the deadline is 14 days before the end of the month before: for December it is 16 Nov', () => {
    expect(leaveDeadline('2026-12')).toBe('2026-11-16'); // November ends on the 30th
    expect(leaveDeadline('2026-11')).toBe('2026-10-17'); // October ends on the 31st
    expect(leaveDeadline('2027-03')).toBe('2027-02-14'); // February ends on the 28th
  });
  it('the billing contact asks for December: it is recorded, finance and management are told, and the family sees the choices', () => {
    const r = run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1');
    expect(leaves(r.state)).toEqual([{ month: '2026-12', at: `${T}T10:00`, by: 'family:f1' }]);
    expect(r.result).toMatchObject({ month: '2026-12', deadline: '2026-11-16' });
    for (const uid of ['s9', 's10']) expect(updatesFor(r.state, getUser({ citra: r.state }, uid)!).some((x) => x.kind === 'family.notif.leaveAsked' && x.params.month === '2026-12' && x.params.fee === 'Rp 250.000')).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'family.feed.leaveAsked' && a.memberId === 'm1')).toBe(true);
    // the next choices start with the first month whose deadline has not passed: November's was 17 Oct
    expect(leaveChoices(base, lina(base), T).map((c) => [c.month, c.deadline, c.ok])).toEqual([['2026-12', '2026-11-16', true], ['2027-01', '2026-12-17', true], ['2027-02', '2027-01-17', true]]);
  });
  it('a late request is refused with the deadline: November was due on 17 October', () => {
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-11' }, 'f1', 'err.leaveLate');
    try { run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-11' }, 'f1'); } catch (e) { expect((e as { params: object }).params).toMatchObject({ deadline: '2026-10-17', month: '2026-11' }); }
    // the day itself is still in time
    expect(() => run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-11' }, 'f1', at('2026-10-17'))).not.toThrow();
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-11' }, 'f1', 'err.leaveLate', at('2026-10-18'));
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-10' }, 'f1', 'err.leaveLate'); // this month
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: 'December' }, 'f1', 'err.invalid');
  });
  it('only the member’s billing contact (or finance, management) may; the lobby may not', () => {
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f2', 'err.forbidden'); // Daniel is not the billing contact
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'fm20_0', 'err.forbidden'); // somebody else's family
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 's1', 'err.forbidden');
    fails(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 's8', 'err.forbidden');
    for (const uid of ['s10', 's9']) {
      const r = run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12', note: 'Maria wrote on 10 Oct' }, uid);
      expect(leaves(r.state)[0]).toMatchObject({ month: '2026-12', by: `staff:${uid}`, note: 'Maria wrote on 10 Oct' });
      // staff record it for the family: the billing contact is told
      expect(updatesFor(r.state, getUser({ citra: r.state }, 'f1')!).some((x) => x.kind === 'family.notif.leaveRecorded')).toBe(true);
    }
  });
  it('at most 2 months in a row; a month already asked for is refused; a membership that is ending cannot ask', () => {
    let s = run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1').state;
    s = run(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-01' }, 'f1').state;
    fails(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-02' }, 'f1', 'err.leaveMax'); // a 3rd in a row
    fails(s, 'membership.requestLeave', { memberId: 'm1', month: '2026-11' }, 'f1', 'err.leaveMax', at('2026-10-10')); // one before makes 3 as well
    fails(s, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1', 'err.leaveAlready');
    expect(() => run(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-03' }, 'f1')).not.toThrow(); // a gap makes it a new run
    const ending = produce(base, (d) => { d.members.m1.memberships[0].lastDay = '2026-11-30'; d.members.m1.memberships[0].endReason = 'movedAway'; });
    fails(ending, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1', 'err.leaveEnding');
    expect(leaveCheck(base, lina(base), '2026-12', T)).toEqual({ ok: true });
  });
  it('the family can take a request back until its deadline, and not after', () => {
    const s = run(base, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1').state;
    const w = run(s, 'membership.withdrawLeave', { memberId: 'm1', month: '2026-12' }, 'f1');
    expect(leaves(w.state)).toEqual([]);
    expect(updatesFor(w.state, getUser({ citra: w.state }, 's9')!).some((x) => x.kind === 'family.notif.leaveWithdrawn')).toBe(true);
    expect(() => run(s, 'membership.withdrawLeave', { memberId: 'm1', month: '2026-12' }, 'f1', at('2026-11-16'))).not.toThrow(); // the deadline day
    fails(s, 'membership.withdrawLeave', { memberId: 'm1', month: '2026-12' }, 'f1', 'err.leaveLocked', at('2026-11-17'));
    fails(s, 'membership.withdrawLeave', { memberId: 'm1', month: '2027-01' }, 'f1', 'err.notFound');
    fails(s, 'membership.withdrawLeave', { memberId: 'm1', month: '2026-12' }, 'f2', 'err.forbidden');
  });
});

describe('leave: the invoice, the check-in, the job', () => {
  const dec = (s: ClubState) => run(s, 'membership.requestLeave', { memberId: 'm1', month: '2026-12' }, 'f1').state;
  it('a leave month costs the leave fee on that month’s invoice instead of the plan', () => {
    const s = dec(base);
    const plan = runPlan(s, '2026-12', '2026-12-21');
    const l = plan.issue.find((r) => r.member.id === 'm1')!;
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0]).toMatchObject({ kind: 'plan', label: 'inv.line.leave', amount: 250000, refMonth: '2026-12', params: { month: '2026-12' } });
    expect(l.total).toBe(250000);
    expect(plan.issue.find((r) => r.member.id === 'm46')!.total).toBe(3950000); // everybody else pays the plan
    // issued, it is the month’s plan line: a second run does not bill the plan again
    const w = run(s, 'run.issue', { period: '2026-12' }, 's10', at('2026-12-21'));
    expect(w.state.invoices['INV-2612-001'].lines.map((x) => [x.label, x.amount])).toEqual([['inv.line.leave', 250000]]);
    expect(() => run(w.state, 'run.issue', { period: '2026-12' }, 's10', at('2026-12-21'))).toThrow('finance.err.nothingToIssue');
    // January is a normal month again
    expect(runPlan(s, '2027-01', '2027-01-21').issue.find((r) => r.member.id === 'm1')!.lines.map((x) => x.label)).toEqual(['inv.line.flex']);
  });
  it('the leave fee follows the price list', () => {
    const s = run(dec(base), 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, leave: 300000, from: T }, 's9').state;
    expect(runPlan(s, '2026-12', '2026-12-21').issue.find((r) => r.member.id === 'm1')!.total).toBe(300000);
  });
  it('no check-in during the leave month: refused with a clear message; the month before and after are fine', () => {
    const s = paidUp(dec(base));
    expect(onLeaveOn(lina(s), '2026-12-02')).toBe(true);
    expect(onLeaveOn(lina(s), '2026-11-30')).toBe(false);
    expect(onLeaveOn(lina(s), '2027-01-04')).toBe(false);
    const err = (() => { try { run(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', at('2026-12-02')); } catch (e) { return e as { code: string; params: Record<string, string> }; } })();
    expect(err?.code).toBe('err.onLeave');
    expect(err?.params).toMatchObject({ name: 'Oma Lina', month: '2026-12' });
    expect(() => run(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', at('2026-11-30'))).not.toThrow();
    expect(() => run(s, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', at('2027-01-04'))).not.toThrow();
    expect(() => run(s, 'attendance.checkIn', { memberId: 'm46', method: 'manual' }, 's1', at('2026-12-02'))).not.toThrow(); // others are not affected
  });
  it('after 2 months of leave with no word, the membership ends at the start of the 3rd month: leaveOverrun, once, and the family is told', () => {
    let s = dec(base);
    s = run(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-01' }, 'f1').state;
    s = paidUp(s);
    expect(leaveOverrunMonth(lina(s), '2027-01-29')).toBeUndefined(); // still on leave
    expect(tick(s, at('2027-01-29')).state.members.m1.memberships.at(-1)!.endReason).toBeUndefined();
    expect(leaveOverrunMonth(lina(s), '2027-02-01')).toBe('2027-02');
    const r = tick(s, at('2027-02-01', 480));
    const ms = r.state.members.m1.memberships.at(-1)!;
    expect(ms).toMatchObject({ lastDay: '2027-01-31', endReason: 'leaveOverrun', endedBy: 'system' });
    expect(membershipStatus(r.state.members.m1, '2027-02-02')).toBe('ended');
    expect(updatesFor(r.state, getUser({ citra: r.state }, 's9')!).some((x) => x.kind === 'family.notif.leaveOverrun' && x.memberId === 'm1')).toBe(true);
    expect(updatesFor(r.state, getUser({ citra: r.state }, 'f1')!).some((x) => x.kind === 'family.notif.leaveOverrunFamily' && x.memberId === 'm1')).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'family.feed.leaveOverrun' && a.memberId === 'm1')).toBe(true);
    expect(tick(r.state, at('2027-02-01', 490)).state.members.m1.memberships.at(-1)).toEqual(ms); // not again
  });
  it('word that the member is coming back keeps the membership: a return noted before the 3rd month starts', () => {
    let s = dec(base);
    s = run(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-01' }, 'f1').state;
    s = paidUp(s);
    expect(leaveNeedsWord(lina(s), T)).toEqual({ after: '2027-02', deadline: '2027-01-31' });
    expect(leaveNeedsWord(dec(base).members.m1, T)).toBeUndefined(); // one month of leave needs no word
    fails(s, 'membership.confirmReturn', { memberId: 'm1' }, 'f2', 'err.forbidden');
    fails(dec(base), 'membership.confirmReturn', { memberId: 'm1' }, 'f1', 'err.noChanges');
    const back = run(s, 'membership.confirmReturn', { memberId: 'm1' }, 'f1', at('2027-01-20'));
    expect(leaves(back.state).at(-1)).toMatchObject({ month: '2027-02', note: 'return' });
    expect(leaveNeedsWord(lina(back.state), '2027-01-20')).toBeUndefined();
    expect(leaveOverrunMonth(lina(back.state), '2027-02-01')).toBeUndefined();
    expect(tick(back.state, at('2027-02-01', 480)).state.members.m1.memberships.at(-1)!.endReason).toBeUndefined();
    // the return note is not a month of leave: February is a normal month, and the check-in works
    expect(onLeaveOn(lina(back.state), '2027-02-02')).toBe(false);
    expect(() => run(back.state, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', at('2027-02-02'))).not.toThrow();
    // too late once the month has begun
    fails(s, 'membership.confirmReturn', { memberId: 'm1' }, 'f1', 'err.noChanges', at('2027-02-01'));
  });
  it('two separate months of leave (with a month between) do not end anything', () => {
    let s = dec(base);
    s = run(s, 'membership.requestLeave', { memberId: 'm1', month: '2027-02' }, 'f1').state;
    s = paidUp(s);
    expect(leaveOverrunMonth(lina(s), '2027-01-04')).toBeUndefined();
    expect(leaveOverrunMonth(lina(s), '2027-03-01')).toBeUndefined(); // only one leave month before March
  });
});

describe('suspension and stop: an unpaid invoice (issued 21st, due 28th, on hold on the 1st, stopped on the 3rd)', () => {
  const inv = (id: string) => base.invoices[id];
  it('the days follow the settings: due 28 Oct, hold from 1 Nov, stop on 3 Nov', () => {
    expect(inv('INV-2610-001')).toMatchObject({ issueDate: '2026-10-21', dueDate: '2026-10-28' });
    expect(suspendDatesFor(base, inv('INV-2610-001'))).toEqual({ since: '2026-11-01', stopOn: '2026-11-03' });
    expect(base.club.settings).toMatchObject({ issueDay: 21, dueDay: 28, suspendDay: 1, stopDay: 3 });
  });
  it('on hold from the 1st after the due month; unpaid on 1 Nov Lina, Budi and Tjahjadi are on hold (until paid), with the invoice that did it', () => {
    expect(Object.keys(suspensions(base, '2026-10-30'))).toEqual(['m20']); // Tjahjadi: September's invoice, on hold since 1 Oct (the family told finance)
    expect(suspensions(base, '2026-10-30').m20).toMatchObject({ number: 'INV-2609-020', since: '2026-10-01', stopOn: '2026-10-03', told: true });
    expect(suspensions(base, '2026-09-30')).toEqual({});
    const hold = suspensions(base, '2026-11-02');
    expect(Object.keys(hold).sort()).toEqual(['m1', 'm20', 'm46']); // October is still open for Lina, Budi and Tjahjadi
    expect(hold.m1).toMatchObject({ number: 'INV-2610-001', balance: 2700000, since: '2026-11-01', stopOn: '2026-11-03', dueDate: '2026-10-28', told: false });
    expect(hold.m20).toMatchObject({ number: 'INV-2609-020' }); // the oldest unpaid invoice is the one that counts
    expect(suspensionOf(base, 'm2', '2026-11-02')).toBeUndefined(); // Hendra paid
    // a part payment still leaves the invoice open; paying it in full lifts the hold at once
    const part = run(base, 'payment.record', { memberId: 'm1', amount: 1000000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', at('2026-11-02')).state;
    expect(suspensionOf(part, 'm1', '2026-11-02')?.balance).toBe(1700000);
    const paid = run(part, 'payment.record', { memberId: 'm1', amount: 1700000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', at('2026-11-02')).state;
    expect(suspensionOf(paid, 'm1', '2026-11-02')).toBeUndefined();
  });
  it('check-in is refused while on hold, with the invoice and the amount; fine again once paid', () => {
    const c = at('2026-11-02');
    const err = (() => { try { run(base, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', c); } catch (e) { return e as { code: string; params: Record<string, string> }; } })();
    expect(err?.code).toBe('err.suspended');
    expect(err?.params).toMatchObject({ name: 'Oma Lina', number: 'INV-2610-001', amount: 'Rp 2.700.000' });
    fails(base, 'attendance.checkIn', { memberId: 'm1', method: 'face' }, 's9', 'err.suspended', c); // management has no override: they record the payment
    expect(() => run(base, 'attendance.checkIn', { memberId: 'm2', method: 'manual' }, 's1', c)).not.toThrow(); // Hendra paid
    const paid = run(base, 'payment.record', { memberId: 'm1', amount: 2700000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', c).state;
    expect(() => run(paid, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', c)).not.toThrow();
  });
  it('the daily job tells management, finance and the billing contact once, on the first day of the hold', () => {
    const r = tick(base, at('2026-11-02', 480));
    const mgmt = updatesFor(r.state, getUser({ citra: r.state }, 's9')!).filter((x) => x.kind === 'finance.notif.suspended');
    expect(mgmt.map((x) => x.memberId).sort()).toEqual(['m1', 'm46']); // Tjahjadi's hold began on 1 Oct: he was told then (it is in the seed)
    expect(mgmt.find((x) => x.memberId === 'm1')?.params).toMatchObject({ name: 'Oma Lina', number: 'INV-2610-001', amount: 'Rp 2.700.000', date: '2026-11-03' });
    expect(updatesFor(r.state, getUser({ citra: r.state }, 's10')!).some((x) => x.kind === 'finance.notif.suspended')).toBe(true);
    const fam = updatesFor(r.state, getUser({ citra: r.state }, 'f1')!).filter((x) => x.kind === 'finance.notif.suspendedFamily');
    expect(fam).toHaveLength(2); // Lina and Budi: Maria is the billing contact of both
    expect(updatesFor(base, getUser({ citra: base }, 's9')!).some((x) => x.kind === 'finance.notif.suspendedTold' && x.memberId === 'm20')).toBe(true);
    expect(updatesFor(r.state, getUser({ citra: r.state }, 'f2')!).some((x) => x.kind === 'finance.notif.suspendedFamily')).toBe(false);
    expect(r.state.members.m1.memberships[0].lastDay).toBeUndefined(); // on hold is not stopped
    expect(tick(r.state, at('2026-11-02', 490)).patches).toHaveLength(0); // once
  });
  it('still unpaid on the 3rd with no word from the family: the membership stops (endReason unpaid, last day = the day before the hold), management and the billing contact are told', () => {
    const paidTwo = produce(base, (d) => { d.payments['pp-1'] = { id: 'pp-1', clubId: 'citra', createdAt: '', createdBy: 'system', memberId: 'm46', method: 'cash', amount: 3950000, receivedOn: T, allocations: [{ invoiceId: 'INV-2610-046', amount: 3950000 }], xero: 'synced', by: 'system' }; });
    expect(stopsDue(paidTwo, '2026-11-02')).toEqual([]);
    expect(stopsDue(paidTwo, '2026-11-03').map((x) => x.memberId)).toEqual(['m1']); // Tjahjadi’s family told finance (a call note is on the invoice): he stays on hold, not stopped
    const r = tick(paidTwo, at('2026-11-03', 480));
    expect(r.state.members.m1.memberships.at(-1)).toMatchObject({ lastDay: '2026-10-31', endReason: 'unpaid', endNote: 'INV-2610-001', endedBy: 'system' });
    expect(membershipStatus(r.state.members.m1, '2026-11-03')).toBe('ended');
    expect(r.state.members.m46.memberships.at(-1)!.endReason).toBeUndefined(); // paid
    expect(r.state.members.m20.memberships.at(-1)!.endReason).toBeUndefined(); // told: held, not stopped
    expect(suspensions(r.state, '2026-11-03').m20).toMatchObject({ told: true });
    const mgmt = updatesFor(r.state, getUser({ citra: r.state }, 's9')!).filter((x) => x.kind === 'finance.notif.stopped');
    expect(mgmt.map((x) => x.memberId)).toEqual(['m1']);
    expect(updatesFor(r.state, getUser({ citra: r.state }, 'f1')!).some((x) => x.kind === 'finance.notif.stoppedFamily' && x.memberId === 'm1')).toBe(true);
    // without that word he would have been stopped too
    const silent = produce(paidTwo, (d) => { d.invoices['INV-2609-020'].callNotes = []; });
    expect(stopsDue(silent, '2026-11-03').map((x) => x.memberId).sort()).toEqual(['m1', 'm20']);
    expect(membershipStatus(tick(silent, at('2026-11-03', 480)).state.members.m20, '2026-11-03')).toBe('ended');
    expect(Object.values(r.state.activity).some((a) => a.key === 'finance.feed.stopped' && a.memberId === 'm1')).toBe(true);
    // a stopped member is no longer on hold or in the lobby list, and the old invoice stays open for finance
    expect(Object.keys(suspensions(r.state, '2026-11-04'))).toEqual(['m20']); // only the one that was told
    fails(r.state, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', 'err.memberNotActive', at('2026-11-04'));
    expect(r.state.invoices['INV-2610-001'].voided).toBeUndefined();
    expect(tick(r.state, at('2026-11-03', 490)).patches).toHaveLength(0);
  });
  it('paying before the 3rd keeps the membership; paying after the stop does not bring it back (it needs re-registration)', () => {
    const c = at('2026-11-02');
    const paid = run(base, 'payment.record', { memberId: 'm1', amount: 2700000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', c).state;
    expect(stopsDue(paid, '2026-11-03').map((x) => x.memberId)).not.toContain('m1');
    const stopped = tick(base, at('2026-11-03')).state;
    const late = run(stopped, 'payment.record', { memberId: 'm1', amount: 2700000, method: 'cash', invoiceId: 'INV-2610-001' }, 's10', at('2026-11-04')).state;
    expect(membershipStatus(late.members.m1, '2026-11-04')).toBe('ended');
    // management registers them again: a new membership, which pays the registration fee on its first invoice
    const back = run(late, 'members.reactivate', { memberId: 'm1', start: '2026-11-09' }, 's9', at('2026-11-04')).state;
    expect(membershipStatus(back.members.m1, '2026-11-09')).toBe('active');
    expect(registrationDue(back, back.members.m1)).toBe(true);
    // the old unpaid debt (if there were any) does not hold the new membership
    const owing = produce(stopped, (d) => { d.members.m1.memberships.push({ start: '2026-11-09' }); });
    expect(Object.keys(suspensions(owing, '2026-11-10'))).toEqual(['m20']); // Lina’s old debt does not hold her new membership (Tjahjadi’s is a different member)
    expect(stopsDue(owing, '2026-11-10').map((x) => x.memberId)).not.toContain('m1');
  });
  it('an invoice for something other than the monthly plan (a final invoice) or a void invoice never holds a member', () => {
    const s = produce(base, (d) => { d.invoices['INV-2610-001'].voided = { at: `${T}T10:00`, by: 'staff:s10', reason: 'x' }; d.invoices['INV-2610-046'].kind = 'final'; });
    expect(Object.keys(suspensions(s, '2026-11-02'))).toEqual(['m20']);
  });
});

describe('the one-time registration fee on a first invoice', () => {
  const joined = () => {
    // a lead becomes a member who starts on Mon 26 Oct: first invoice is November's
    const s0 = run(base, 'enquiry.convert', { enquiryId: 'e3', plan: 'gold', start: '2026-10-26', formMediaId: 'md_testregistrationform01', formFileName: 'form.jpg' }, 's9').state;
    return s0;
  };
  it('a new member’s first invoice carries it (Rp 2.500.000), once; the plan line comes first', () => {
    const s = joined();
    const id = Object.keys(s.members).find((k) => !base.members[k])!;
    expect(registrationDue(s, s.members[id])).toBe(true);
    const plan = runPlan(s, '2026-11', '2026-11-21');
    const row = plan.issue.find((r) => r.member.id === id)!;
    expect(row.lines.map((l) => [l.kind, l.label, l.amount])).toEqual([['plan', 'inv.line.gold', 3950000], ['adjustment', 'inv.line.registration', 2500000]]);
    expect(row.total).toBe(6450000);
    // the members who were here before are not charged it
    expect(plan.issue.filter((r) => r.member.id !== id).every((r) => !r.lines.some((l) => l.label === 'inv.line.registration'))).toBe(true);
    expect(base.members.m1.memberships.length).toBe(1);
    expect(registrationDue(base, base.members.m1)).toBe(false);
    // issued once: December's invoice has no registration line
    const issued = run(s, 'run.issue', { period: '2026-11' }, 's10', at('2026-11-21')).state;
    const num = Object.values(issued.invoices).find((i) => i.memberId === id)!;
    expect(num.lines.some((l) => l.label === 'inv.line.registration')).toBe(true);
    expect(registrationDue(issued, issued.members[id])).toBe(false);
    expect(runPlan(issued, '2026-12', '2026-12-21').issue.find((r) => r.member.id === id)!.lines.map((l) => l.kind)).toEqual(['plan']);
    // voiding that invoice gives the fee back to the next run
    const voided = run(issued, 'invoice.void', { invoiceId: num.id, reason: 'Re-issue' }, 's10', at('2026-11-21')).state;
    expect(registrationDue(voided, voided.members[id])).toBe(true);
  });
  it('the fee follows the price list', () => {
    const s = run(joined(), 'prices.set', { flex: 2700000, gold: 3950000, extra: 650000, registration: 3000000, from: T }, 's9').state;
    const id = Object.keys(s.members).find((k) => !base.members[k])!;
    expect(runPlan(s, '2026-11', '2026-11-21').issue.find((r) => r.member.id === id)!.lines.at(-1)).toMatchObject({ label: 'inv.line.registration', amount: 3000000 });
  });
  it('a member who came back after a stop pays it again on the first invoice of the new membership', () => {
    const stopped = tick(base, at('2026-11-03')).state;
    const back = run(stopped, 'members.reactivate', { memberId: 'm1', start: '2026-11-09' }, 's9', at('2026-11-04')).state;
    const row = runPlan(back, '2026-11', '2026-11-21').issue.find((r) => r.member.id === 'm1')!;
    expect(row.lines.map((l) => l.label)).toEqual(['inv.line.flex', 'inv.line.registration']);
    expect(live(back.invoices).filter((i) => i.memberId === 'm1').length).toBe(live(base.invoices).filter((i) => i.memberId === 'm1').length); // the old ones (six months of them) are still there
  });
});
