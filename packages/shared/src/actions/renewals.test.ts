// KC round 7: the month-end follow-up. Caca records what each family answered for the coming month; leave keeps its notice rules.
// Round 14: a change (upgrade, downgrade, leave, stop) applies at once, whoever records it, and can be undone until the 1st; rows that were already waiting
// for management from before can still be decided.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { actionItems, buildSeed, execute, getUser, membershipStatus, planOn, toMin, updatesFor, DomainError, type ClubState } from '../index';
import { pendingItems } from '../rules/approvals';
import { changeRows, followUpId, followUpOf, outcomeChoices, renewalCounts, renewalRows } from '../rules/renewals';

const T = '2026-10-21';
const MONTH = '2026-11';
const clock = { today: T, nowMin: toMin('10:00') };
let n = 0;
/** the demo world without the seeded follow-ups, so each test starts from a clean to-do list */
const fresh = (): ClubState => produce(buildSeed().citra, (d) => { d.followUps = {}; });
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, as(s, uid), clk, `fu${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const record = (s: ClubState, memberId: string, outcome: string, uid = 's1', extra: object = {}) => run(s, 'followUp.record', { memberId, month: MONTH, outcome, ...extra }, uid);
const fu = (s: ClubState, memberId: string) => followUpOf(s, memberId, MONTH)!;
const famTold = (s: ClubState, uid: string, kind: string) => updatesFor(s, as(s, uid)).some((x) => x.kind === kind);

describe('the month-end list', () => {
  it('the seeded follow-up: counts by state, the bell from the 20th, and members who asked in the app', () => {
    const s = buildSeed().citra;
    const rows = renewalRows(s, MONTH);
    const by = (st: string) => rows.filter((r) => r.state === st).map((r) => r.m.id).sort();
    expect(by('waiting')).toEqual([]); // round 14 (R25, R31): nothing waits for Ega; Oma Lina is not called yet (her family asks for Gold in the app)
    expect(by('toDo')).toEqual(['m1', 'm2', 'm20']); // not called yet; no answer after 2 calls; no answer once
    expect(by('decided')).toEqual(['m10', 'm46']); // Bambang's family asked for Gold in the app; Opa Budi continues
    expect(rows.find((r) => r.m.id === 'm10')?.asked).toBe('plan');
    expect(rows.find((r) => r.m.id === 'm2')).toMatchObject({ calls: 2 });
    expect(renewalCounts(rows)).toMatchObject({ total: 5, toDo: 3, waiting: 0, decided: 2, done: 2 });
    // round 14: membership rolls on, so nobody is told "N members to follow up" any more (the front desk has the Unpaid duty instead)
    for (const uid of ['s1', 's9']) expect(actionItems(s, as(s, uid), T, 600).some((i) => i.kind === 'renewals.notif.act.followUp')).toBe(false);
    expect(actionItems(s, as(s, 's9'), T, 600).some((i) => i.kind === 'renewals.notif.act.approve')).toBe(false); // and no renewals wait for approval
    expect(pendingItems(s, 'renewals')).toEqual([]);
  });
});

describe('recording a follow-up', () => {
  it('continue, no answer and call back need no approval; calls pile up on the row', () => {
    let s = record(fresh(), 'm2', 'noAnswer').state;
    expect(fu(s, 'm2')).toMatchObject({ outcome: 'noAnswer', status: 'open' });
    expect(renewalRows(s, MONTH).find((r) => r.m.id === 'm2')?.state).toBe('toDo');
    s = record(s, 'm2', 'continue', 's1', { note: 'Cynthia confirmed.' }).state;
    expect(fu(s, 'm2')).toMatchObject({ outcome: 'continue', status: 'done', note: 'Cynthia confirmed.' });
    expect(fu(s, 'm2').calls.map((c) => [c.outcome, c.by])).toEqual([['noAnswer', 'staff:s1'], ['continue', 'staff:s1']]);
    expect(fu(s, 'm2').approval).toBeUndefined();
    expect(record(s, 'm20', 'noAnswer').state.followUps[followUpId(MONTH, 'm20')].status).toBe('open');
    fails(s, 'followUp.record', { memberId: 'm20', month: MONTH, outcome: 'callBack' }, 's1', 'err.invalid'); // KC round 7: no "call back" option
  });

  it('only the front desk, finance and management; only a month that has not started; a change must fit the plan', () => {
    const s = fresh();
    for (const uid of ['s8', 's5', 'f1']) fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'continue' }, uid, 'err.forbidden');
    fails(s, 'followUp.record', { memberId: 'm1', month: '2026-10', outcome: 'continue' }, 's1', 'renewals.err.pastMonth');
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'maybe' }, 's1', 'err.invalid');
    fails(s, 'followUp.record', { memberId: 'm46', month: MONTH, outcome: 'upgrade' }, 's1', 'err.noChanges'); // already Gold
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'downgrade' }, 's1', 'err.noChanges'); // already Flex
  });
});

describe('a change applies at once', () => {
  it('a lobby change applies at once: no approval, the plan entry starts on 1 Nov, the family hears', () => {
    const s = record(fresh(), 'm1', 'upgrade', 's1', { note: 'Maria agreed.' }).state;
    expect(fu(s, 'm1')).toMatchObject({ outcome: 'upgrade', status: 'done', note: 'Maria agreed.' });
    expect(fu(s, 'm1').approval).toBeUndefined();
    expect(planOn(s.members.m1, '2026-10-31').plan).toBe('flex');
    expect(planOn(s.members.m1, '2026-11-01')).toMatchObject({ plan: 'gold', by: 'staff:s1' });
    expect(famTold(s, 'f1', 'renewals.notif.plan')).toBe(true);
    expect(pendingItems(s, 'renewals')).toEqual([]);
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'continue' }, 's1', 'renewals.err.applied');
  });

  it('rows that were already waiting can still be approved (applies from the 1st) or rejected', () => {
    // Caca's upgrade for Oma Lina, recorded before round 14 and still waiting (old data: the seed no longer has one)
    let s = produce(buildSeed().citra, (d) => {
      const id = followUpId(MONTH, 'm1');
      d.followUps[id] = { id, clubId: d.clubId, createdAt: '2026-10-20T10:15', createdBy: 'staff:s1', memberId: 'm1', month: MONTH, outcome: 'upgrade', calls: [{ at: '2026-10-20T10:15', by: 'staff:s1', outcome: 'upgrade' }], status: 'pending', approval: { status: 'pending', by: 'staff:s1', at: '2026-10-20T10:15' } };
    });
    const f = fu(s, 'm1');
    expect(f).toMatchObject({ outcome: 'upgrade', status: 'pending' });
    expect(pendingItems(s, 'renewals')).toMatchObject([{ id: f.id, memberId: 'm1' }]);
    fails(s, 'approval.approve', { type: 'renewals', ids: [f.id] }, 's1', 'err.forbidden');
    fails(s, 'approval.reject', { type: 'renewals', ids: [f.id], reason: ' ' }, 's9', 'err.noteRequired');
    const rej = run(s, 'approval.reject', { type: 'renewals', ids: [f.id], reason: 'Not eligible this month.' }, 's9').state;
    expect(fu(rej, 'm1')).toMatchObject({ status: 'rejected', approval: { status: 'rejected', reason: 'Not eligible this month.' } });
    expect(planOn(rej.members.m1, '2026-11-01').plan).toBe('flex');
    s = run(s, 'approval.approve', { type: 'renewals', ids: [f.id] }, 's9').state;
    expect(planOn(s.members.m1, '2026-11-01')).toMatchObject({ plan: 'gold', by: 'staff:s1' });
    expect(fu(s, 'm1')).toMatchObject({ status: 'done', approval: { status: 'approved', decidedBy: 'staff:s9' } });
    expect(famTold(s, 'f1', 'renewals.notif.plan')).toBe(true);
  });

  it('management\'s own record applies at once too: a downgrade, a stop', () => {
    let s = record(fresh(), 'm2', 'downgrade', 's9').state;
    expect(fu(s, 'm2')).toMatchObject({ status: 'done' });
    expect(planOn(s.members.m2, '2026-11-01').plan).toBe('flex');
    expect(famTold(s, 'fm2_0', 'renewals.notif.plan')).toBe(true);
    // a stop: the last day is the last day of October, the reason defaults to the family's decision
    s = record(s, 'm46', 'stop', 's9').state;
    const cur = s.members.m46.memberships.at(-1)!;
    expect(cur).toMatchObject({ lastDay: '2026-10-31', endReason: 'familyDecision', endedBy: 'staff:s9' });
    expect(membershipStatus(s.members.m46, '2026-11-01')).toBe('ended');
    const row = renewalRows(s, MONTH).find((r) => r.m.id === 'm46'); // still on the log, decided
    expect(row).toMatchObject({ state: 'decided' });
    expect(row?.f?.outcome).toBe('stop');
  });

  it('a stop by Caca ends the membership at once; the last day has to fit', () => {
    let s = fresh();
    fails(s, 'followUp.record', { memberId: 'm20', month: MONTH, outcome: 'stop', lastDay: '2026-10-20' }, 's1', 'members.err.lastDayPast');
    fails(s, 'followUp.record', { memberId: 'm20', month: MONTH, outcome: 'stop', lastDay: '2026-12-05' }, 's1', 'renewals.err.lastDayLate');
    s = record(s, 'm20', 'stop', 's1', { lastDay: '2026-10-30', endReason: 'movedAway' }).state;
    expect(s.members.m20.memberships.at(-1)).toMatchObject({ lastDay: '2026-10-30', endReason: 'movedAway', endedBy: 'staff:s1' });
    expect(fu(s, 'm20')).toMatchObject({ status: 'done' });
  });
});

describe('undo until the 1st', () => {
  const undo = (s: ClubState, memberId: string, uid = 's1', clk = clock) => run(s, 'followUp.undo', { memberId, month: MONTH }, uid, clk).state;
  const reopened = (s: ClubState, id: string) => { const f = fu(s, id); expect(f.outcome).toBeUndefined(); expect(f.status).toBe('open'); expect(f.approval).toBeUndefined(); };

  it('an upgrade: the plan entry from 1 Nov is gone and the member is back on the list', () => {
    let s = record(fresh(), 'm1', 'upgrade').state;
    expect(planOn(s.members.m1, '2026-11-01').plan).toBe('gold');
    s = undo(s, 'm1');
    expect(s.members.m1.plans.map((p) => p.from)).toEqual(fresh().members.m1.plans.map((p) => p.from));
    expect(planOn(s.members.m1, '2026-11-01').plan).toBe('flex');
    reopened(s, 'm1');
    expect(renewalRows(s, MONTH).find((r) => r.m.id === 'm1')?.state).toBe('toDo');
    // and she can record something else
    expect(record(s, 'm1', 'continue').state.followUps[followUpId(MONTH, 'm1')].status).toBe('done');
  });

  it('a leave: the leave month is removed', () => {
    const early = { today: '2026-10-10', nowMin: toMin('10:00') };
    let s = run(fresh(), 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: ['2026-11', '2026-12'] }, 's1', early).state;
    expect(s.members.m1.memberships.at(-1)!.leaves!.map((l) => l.month)).toEqual(['2026-11', '2026-12']);
    s = undo(s, 'm1', 's1', early);
    expect(s.members.m1.memberships.at(-1)!.leaves ?? []).toEqual([]);
    reopened(s, 'm1');
  });

  it('a stop: the last day and the reason are gone, and the final invoice it made is voided', () => {
    // Oma Lina has an extra visit today, so ending her membership bills a final invoice
    const base = run(fresh(), 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1').state;
    let s = record(base, 'm1', 'stop', 's1', { lastDay: '2026-10-29', endReason: 'movedAway', note: 'Moving to Bali.' }).state;
    const final = () => Object.values(s.invoices).filter((i) => i.memberId === 'm1' && i.kind === 'final');
    expect(s.members.m1.memberships.at(-1)!.lastDay).toBe('2026-10-29');
    expect(final()).toHaveLength(1); // precondition: the ending really made a final invoice
    expect(final()[0].voided).toBeUndefined();
    s = undo(s, 'm1');
    const cur = s.members.m1.memberships.at(-1)!;
    for (const k of ['lastDay', 'endReason', 'endNote', 'endedBy', 'endedAt'] as const) expect(cur[k]).toBeUndefined();
    expect(membershipStatus(s.members.m1, '2026-11-01')).not.toBe('ended');
    expect(final()).toHaveLength(1);
    expect(final()[0].voided).toMatchObject({ reason: 'endingCancelled' });
    reopened(s, 'm1');
  });

  it('undo only removes the plan entry this follow-up added', () => {
    let s = record(fresh(), 'm1', 'upgrade').state;
    const other = produce(s, (d) => { d.members.m1.plans.find((p) => p.from === '2026-11-01')!.by = 'staff:s9'; }); // an entry on the 1st that is not the follow-up's
    expect(undo(other, 'm1').members.m1.plans.some((p) => p.from === '2026-11-01')).toBe(true);
    s = undo(s, 'm1');
    expect(s.members.m1.plans.some((p) => p.from === '2026-11-01')).toBe(false);
  });

  it('undo reopens the plan request the change answered (upgrade) or closed (stop), and tells the family once', () => {
    const s0 = fresh(); // Bambang's family asked for Gold in the app: pcr-m10 waits
    expect(s0.planChangeRequests['pcr-m10']).toMatchObject({ status: 'pending', to: 'gold' });
    const told = (s: ClubState) => Object.values(s.notifications || {}).filter((x) => x.kind === 'renewals.notif.undone');
    let s = record(s0, 'm10', 'upgrade').state;
    expect(s.planChangeRequests['pcr-m10']).toMatchObject({ status: 'applied', decidedBy: 'staff:s1' });
    expect(told(s)).toHaveLength(0);
    s = undo(s, 'm10');
    expect(s.planChangeRequests['pcr-m10'].status).toBe('pending');
    expect(s.planChangeRequests['pcr-m10'].decidedBy).toBeUndefined();
    expect(s.planChangeRequests['pcr-m10'].decidedAt).toBeUndefined();
    expect(told(s)).toHaveLength(1);
    expect(famTold(s, 'fm10_0', 'renewals.notif.undone')).toBe(true);
    // a stop closes the pending request; undoing the stop opens it again
    s = record(s0, 'm10', 'stop', 's1', { lastDay: '2026-10-29' }).state;
    expect(s.planChangeRequests['pcr-m10'].status).toBe('declined');
    s = undo(s, 'm10');
    expect(s.planChangeRequests['pcr-m10'].status).toBe('pending');
    expect(told(s)).toHaveLength(1);
    // a request that was already closed by someone else is left alone
    const closed = produce(s0, (d) => { d.planChangeRequests['pcr-m10'].status = 'declined'; d.planChangeRequests['pcr-m10'].decidedBy = 'staff:s9'; d.planChangeRequests['pcr-m10'].decidedAt = '2026-10-20T09:00'; });
    expect(undo(record(closed, 'm10', 'upgrade').state, 'm10').planChangeRequests['pcr-m10'].status).toBe('declined');
  });

  it('after the 1st it is refused; so is undoing something that was never recorded', () => {
    const s = record(fresh(), 'm1', 'upgrade').state;
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'continue' }, 's1', 'renewals.err.applied');
    fails(s, 'followUp.undo', { memberId: 'm1', month: MONTH }, 's1', 'renewals.err.started', { today: '2026-11-01', nowMin: toMin('10:00') });
    fails(s, 'followUp.undo', { memberId: 'm1', month: MONTH }, 's8', 'err.forbidden');
    fails(record(fresh(), 'm2', 'continue').state, 'followUp.undo', { memberId: 'm2', month: MONTH }, 's1', 'err.invalid'); // only a change can be undone
    fails(fresh(), 'followUp.undo', { memberId: 'm1', month: MONTH }, 's1', 'err.notFound');
  });

  it('changeRows: the applied changes of the month, newest first, with who and from when', () => {
    let s = record(fresh(), 'm1', 'upgrade').state;
    s = run(s, 'followUp.record', { memberId: 'm2', month: MONTH, outcome: 'downgrade' }, 's9', { today: T, nowMin: toMin('11:00') }).state;
    s = record(s, 'm20', 'noAnswer').state; // not a change
    const rows = changeRows(s, MONTH, T);
    expect(rows.map((r) => [r.memberId, r.outcome, r.from, r.by, r.canUndo])).toEqual([['m2', 'downgrade', '2026-11-01', 'staff:s9', true], ['m1', 'upgrade', '2026-11-01', 'staff:s1', true]]);
    expect(changeRows(s, MONTH, '2026-11-01').every((r) => !r.canUndo)).toBe(true);
    expect(changeRows(s, '2026-12', T)).toEqual([]);
    s = undo(s, 'm1');
    expect(changeRows(s, MONTH, T).map((r) => r.memberId)).toEqual(['m2']);
  });
});

describe('changeRows: changes recorded elsewhere', () => {
  it('a plan switch from the profile, a leave month and a stop show read-only (no Undo), with who and from when; a follow-up\'s own change is not listed twice', () => {
    let s = run(fresh(), 'members.changePlan', { memberId: 'm2', plan: 'flex' }, 's10').state; // finance: from 1 Nov
    s = run(s, 'membership.requestLeave', { memberId: 'm20', month: '2026-12' }, 's9').state;
    s = run(s, 'members.end', { memberId: 'm46', lastDay: '2026-11-13', reason: 'movedAway' }, 's9').state;
    const rows = changeRows(s, MONTH, T);
    const ro = rows.filter((r) => r.readOnly).map((r) => [r.memberId, r.outcome, r.from, r.by, r.canUndo]);
    expect(ro).toEqual(expect.arrayContaining([['m2', 'downgrade', '2026-11-01', 'staff:s10', false], ['m46', 'stop', '2026-11-14', 'staff:s9', false]]));
    expect(ro.find((r) => r[0] === 'm20')).toBeUndefined(); // December's leave is not November's
    expect(changeRows(s, '2026-12', T).find((r) => r.memberId === 'm20')).toMatchObject({ outcome: 'leave', from: '2026-12-01', by: 'staff:s9', leaveMonths: ['2026-12'], readOnly: true, canUndo: false });
    // recorded through the follow-up instead: one row, with Undo
    const t = record(fresh(), 'm1', 'upgrade').state;
    expect(changeRows(t, MONTH, T).filter((r) => r.memberId === 'm1').map((r) => [r.outcome, !!r.readOnly, r.canUndo])).toEqual([['upgrade', false, true]]);
  });
});

describe('leave keeps its notice rules', () => {
  it('November\'s notice was due 17 Oct: late on the 21st, fine on the 10th; December still works and applies at once', () => {
    const s = fresh();
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH] }, 's1', 'err.leaveLate');
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [] }, 's1', 'err.invalid');
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: ['2027-01'] }, 's1', 'err.invalid'); // only the month itself and the next
    const early = { today: '2026-10-10', nowMin: toMin('10:00') };
    expect(() => run(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH] }, 's1', early)).not.toThrow();
    const r = record(s, 'm1', 'leave', 's1', { leaveMonths: ['2026-12'] }).state;
    expect(fu(r, 'm1')).toMatchObject({ status: 'done', leaveMonths: ['2026-12'] });
    expect(r.members.m1.memberships.at(-1)!.leaves).toMatchObject([{ month: '2026-12', by: 'staff:s1' }]);
    expect(famTold(r, 'f1', 'renewals.notif.leave')).toBe(true);
    // November and December together: two months in a row is the most
    const two = run(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH, '2026-12'] }, 's9', early).state;
    expect(two.members.m1.memberships.at(-1)!.leaves!.map((l) => l.month)).toEqual(['2026-11', '2026-12']);
  });
});

describe('plan switches to the catalogue (round 15)', () => {
  const withPlans = (): ClubState => produce(fresh(), (d) => {
    d.club.settings.plans = [{ id: 'plan_1', name: 'Flex 8', nameId: 'Fleks 8', kind: 'days', quota: 8, active: true }, { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false }];
  });
  it('lists every other active plan as a move (Gold stays an upgrade, a catalogue plan is a switch) and never a retired one', () => {
    const s = withPlans();
    expect(outcomeChoices(s, 'flex')).toEqual([{ outcome: 'upgrade', plan: 'gold' }, { outcome: 'switch', plan: 'plan_1' }, { outcome: 'leave' }, { outcome: 'stop' }]);
    expect(outcomeChoices(s, 'gold').map((c) => c.plan)).toEqual(['flex', 'plan_1', undefined, undefined]);
    expect(outcomeChoices(s, 'plan_1').map((c) => c.plan)).toEqual(['flex', 'gold', undefined, undefined]);
    expect(outcomeChoices(fresh(), 'flex')).toEqual([{ outcome: 'upgrade', plan: 'gold' }, { outcome: 'leave' }, { outcome: 'stop' }]); // Flex and Gold only: as before
  });
  it('records a switch to an active catalogue plan, applies it from the 1st, lists it by name, and undo takes it back', () => {
    const s = withPlans();
    const r = record(s, 'm1', 'switch', 's1', { plan: 'plan_1' });
    expect(fu(r.state, 'm1')).toMatchObject({ outcome: 'switch', plan: 'plan_1', status: 'done' });
    expect(planOn(r.state.members.m1, '2026-11-01').plan).toBe('plan_1');
    expect(changeRows(r.state, MONTH, T).find((c) => c.memberId === 'm1')).toMatchObject({ outcome: 'switch', plan: 'plan_1', canUndo: true });
    expect(JSON.stringify(Object.values(r.state.activity ?? {}))).toContain('Flex 8');
    const undone = run(r.state, 'followUp.undo', { memberId: 'm1', month: MONTH }, 's1').state;
    expect(planOn(undone.members.m1, '2026-11-01').plan).toBe('flex');
    expect(fu(undone, 'm1').plan).toBeUndefined();
  });
  it('refuses a switch without a plan, to a retired or unknown one, to Flex or Gold, and to the plan the member is on', () => {
    const s = withPlans();
    for (const extra of [{}, { plan: 'plan_2' }, { plan: 'plan_9' }, { plan: 'gold' }, { plan: 'flex' }]) fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'switch', ...extra }, 's1', 'err.invalid');
    const on = run(s, 'members.changePlan', { memberId: 'm1', plan: 'plan_1', effective: '2026-11-01' }, 's9').state;
    fails(on, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'switch', plan: 'plan_1' }, 's1', 'err.noChanges');
    // a plan retired after the sheet was opened is refused too
    const retired = produce(s, (d) => { d.club.settings.plans![0].active = false; });
    fails(retired, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'switch', plan: 'plan_1' }, 's1', 'err.invalid');
  });
});
