// KC round 7: the month-end follow-up. Caca records what each family answered for the coming month; a change (upgrade, downgrade, leave, stop) waits for
// management and applies from the 1st; management's own record applies at once; leave keeps its notice rules.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { actionItems, buildSeed, execute, getUser, live, membershipStatus, planOn, toMin, updatesFor, DomainError, type ClubState } from '../index';
import { approvalHistory, pendingItems } from '../rules/approvals';
import { followUpId, followUpOf, renewalCounts, renewalRows, renewalsLeft } from '../rules/renewals';

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
    expect(by('waiting')).toEqual(['m1']); // Caca's upgrade waits for Ega
    expect(by('toDo')).toEqual(['m2', 'm20']); // no answer after 2 calls; call back
    expect(by('decided')).toEqual(['m10', 'm46']); // Bambang's family asked for Gold in the app; Opa Budi continues
    expect(rows.find((r) => r.m.id === 'm10')?.asked).toBe('plan');
    expect(rows.find((r) => r.m.id === 'm2')).toMatchObject({ calls: 2 });
    expect(renewalCounts(rows)).toMatchObject({ total: 5, toDo: 2, waiting: 1, decided: 2, done: 3 });
    expect(renewalsLeft(s, T)).toBe(2);
    for (const uid of ['s1', 's9']) expect(actionItems(s, as(s, uid), T, 600).find((i) => i.kind === 'renewals.notif.act.followUp')).toMatchObject({ params: { n: 2, month: MONTH }, link: '/renewals' });
    expect(actionItems(s, as(s, 's1'), '2026-10-19', 600).some((i) => i.kind === 'renewals.notif.act.followUp')).toBe(false); // not before the 20th
    expect(actionItems(s, as(s, 's9'), T, 600).some((i) => i.kind === 'renewals.notif.act.approve')).toBe(true);
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
    expect(record(s, 'm20', 'callBack').state.followUps[followUpId(MONTH, 'm20')].status).toBe('open');
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

describe('a change waits for management, then applies from the 1st', () => {
  it('Caca records an upgrade: nothing changes and the family hears nothing; Ega approves and it applies from 1 Nov', () => {
    let s = record(fresh(), 'm1', 'upgrade', 's1', { note: 'Maria agreed.' }).state;
    const f = fu(s, 'm1');
    expect(f).toMatchObject({ outcome: 'upgrade', status: 'pending', approval: { status: 'pending', by: 'staff:s1' } });
    expect(planOn(s.members.m1, '2026-11-01').plan).toBe('flex');
    expect(famTold(s, 'f1', 'renewals.notif.plan')).toBe(false);
    expect(renewalRows(s, MONTH).find((r) => r.m.id === 'm1')?.state).toBe('waiting');
    expect(pendingItems(s, 'renewals')).toMatchObject([{ id: f.id, sub: 'renewal', memberId: 'm1', by: 'staff:s1' }]);
    fails(s, 'approval.approve', { type: 'renewals', ids: [f.id] }, 's1', 'err.forbidden');
    s = run(s, 'approval.approve', { type: 'renewals', ids: [f.id] }, 's9').state;
    expect(planOn(s.members.m1, '2026-10-31').plan).toBe('flex');
    expect(planOn(s.members.m1, '2026-11-01')).toMatchObject({ plan: 'gold', by: 'staff:s1' });
    expect(fu(s, 'm1')).toMatchObject({ status: 'done', approval: { status: 'approved', decidedBy: 'staff:s9' } });
    expect(famTold(s, 'f1', 'renewals.notif.plan')).toBe(true);
    expect(pendingItems(s, 'renewals')).toEqual([]);
    expect(approvalHistory(s).find((h) => h.type === 'renewals')).toMatchObject({ status: 'approved', by: 'staff:s1', memberId: 'm1' });
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'continue' }, 's1', 'renewals.err.applied');
  });

  it('a rejection needs a reason, changes nothing, tells Caca and puts the member back on her list', () => {
    let s = record(fresh(), 'm1', 'upgrade').state;
    const id = fu(s, 'm1').id;
    fails(s, 'approval.reject', { type: 'renewals', ids: [id], reason: ' ' }, 's9', 'err.noteRequired');
    s = run(s, 'approval.reject', { type: 'renewals', ids: [id], reason: 'Not eligible this month.' }, 's9').state;
    expect(fu(s, 'm1')).toMatchObject({ status: 'rejected', approval: { status: 'rejected', reason: 'Not eligible this month.' } });
    expect(planOn(s.members.m1, '2026-11-01').plan).toBe('flex');
    expect(updatesFor(s, as(s, 's1')).some((x) => x.kind === 'approvals.notif.rejected.renewals' && x.params.reason === 'Not eligible this month.')).toBe(true);
    expect(renewalRows(s, MONTH).find((r) => r.m.id === 'm1')?.state).toBe('toDo');
    // she can record something else
    s = record(s, 'm1', 'continue').state;
    expect(fu(s, 'm1')).toMatchObject({ status: 'done' });
    expect(fu(s, 'm1').approval).toBeUndefined();
  });

  it('management\'s own record applies at once: a downgrade, a stop', () => {
    let s = record(fresh(), 'm2', 'downgrade', 's9').state;
    expect(fu(s, 'm2')).toMatchObject({ status: 'done' });
    expect(planOn(s.members.m2, '2026-11-01').plan).toBe('flex');
    expect(pendingItems(s, 'renewals')).toEqual([]);
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

  it('a stop by Caca waits too, and Ega\'s approval ends the membership', () => {
    let s = record(fresh(), 'm20', 'stop', 's1', { lastDay: '2026-10-30', endReason: 'movedAway' }).state;
    expect(live(s.members).find((m) => m.id === 'm20')!.memberships.at(-1)!.lastDay).toBeUndefined();
    fails(s, 'followUp.record', { memberId: 'm20', month: MONTH, outcome: 'stop', lastDay: '2026-10-20' }, 's1', 'members.err.lastDayPast');
    fails(s, 'followUp.record', { memberId: 'm20', month: MONTH, outcome: 'stop', lastDay: '2026-12-05' }, 's1', 'renewals.err.lastDayLate');
    s = run(s, 'approval.approve', { type: 'renewals', ids: [fu(s, 'm20').id] }, 's9').state;
    expect(s.members.m20.memberships.at(-1)).toMatchObject({ lastDay: '2026-10-30', endReason: 'movedAway' });
  });
});

describe('leave keeps its notice rules', () => {
  it('November\'s notice was due 17 Oct: late on the 21st, fine on the 10th; December still works and applies after approval', () => {
    const s = fresh();
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH] }, 's1', 'err.leaveLate');
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [] }, 's1', 'err.invalid');
    fails(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: ['2027-01'] }, 's1', 'err.invalid'); // only the month itself and the next
    const early = { today: '2026-10-10', nowMin: toMin('10:00') };
    expect(() => run(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH] }, 's1', early)).not.toThrow();
    let r = record(s, 'm1', 'leave', 's1', { leaveMonths: ['2026-12'] }).state;
    expect(fu(r, 'm1')).toMatchObject({ status: 'pending', leaveMonths: ['2026-12'] });
    expect(r.members.m1.memberships.at(-1)!.leaves ?? []).toEqual([]);
    r = run(r, 'approval.approve', { type: 'renewals', ids: [fu(r, 'm1').id] }, 's9').state;
    expect(r.members.m1.memberships.at(-1)!.leaves).toMatchObject([{ month: '2026-12', by: 'staff:s1' }]);
    expect(famTold(r, 'f1', 'renewals.notif.leave')).toBe(true);
    // November and December together: two months in a row is the most
    const two = run(s, 'followUp.record', { memberId: 'm1', month: MONTH, outcome: 'leave', leaveMonths: [MONTH, '2026-12'] }, 's9', early).state;
    expect(two.members.m1.memberships.at(-1)!.leaves!.map((l) => l.month)).toEqual(['2026-11', '2026-12']);
  });
});
