// Family plan requests: the primary contact asks to switch plan; management and finance see it until it is applied or declined.
import { describe, it, expect } from 'vitest';
import { actionItems, buildSeed, execute, getUser, live, planOn, projectForFamily, type ClubState } from '../index';

const clubs = buildSeed();
const T = '2026-10-21';
const clock = { today: T, nowMin: 600 };
let n = 0;
function world() {
  let s: ClubState = buildSeed().citra;
  return {
    get s() { return s; },
    run(name: string, input: unknown, uid: string) {
      const r = execute(s, name, input, getUser(clubs, uid)!, clock, `pr${++n}`);
      s = r.state;
      return r;
    },
    fail(name: string, input: unknown, uid: string, code: string) {
      expect(() => execute(s, name, input, getUser(clubs, uid)!, clock, `pr${++n}`)).toThrow(code);
    },
  };
}
const pending = (s: ClubState, memberId: string) => live(s.planChangeRequests).filter((r) => r.memberId === memberId && r.status === 'pending');

describe('planChange.request', () => {
  it('Maria asks to move Oma Lina to Gold from 1 November; management and finance see it to act on', () => {
    const w = world();
    const r = w.run('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1');
    const req = w.s.planChangeRequests[r.result.requestId as string];
    expect(req).toMatchObject({ memberId: 'm1', to: 'gold', from: '2026-11-01', status: 'pending', createdBy: 'family:f1' });
    for (const uid of ['s9', 's10']) {
      const item = actionItems(w.s, getUser(clubs, uid)!, T, 600).find((x) => x.id === 'pcr:' + req.id);
      expect(item).toMatchObject({ kind: 'notif.act.planRequest', link: '/members/m1/plan', params: { plan: 'Gold', date: '2026-11-01' } });
    }
    expect(actionItems(w.s, getUser(clubs, 's1')!, T, 600).some((x) => x.id === 'pcr:' + req.id)).toBe(false);
    // finance applies it (gated for finance? applies from the request date); the action item clears
    w.run('planChange.apply', { requestId: req.id }, 's9');
    expect(planOn(w.s.members.m1, '2026-11-01').plan).toBe('gold');
    expect(actionItems(w.s, getUser(clubs, 's9')!, T, 600).some((x) => x.id === 'pcr:' + req.id)).toBe(false);
  });
  it('only the primary contact may ask, once at a time, and not for the plan they already have', () => {
    const w = world();
    w.fail('planChange.request', { memberId: 'm1', to: 'gold' }, 'f2', 'err.forbidden'); // Daniel is not the payer
    w.fail('planChange.request', { memberId: 'm46', to: 'gold' }, 'f1', 'err.noChanges'); // Budi is already Gold
    w.fail('planChange.request', { memberId: 'm10', to: 'gold' }, 'fm10_0', 'err.planRequestPending'); // seed: Laras already asked
    w.fail('planChange.request', { memberId: 'm1', to: 'platinum' }, 'f1', 'err.invalid');
    w.fail('planChange.request', { memberId: 'm1', to: 'gold' }, 's1', 'err.forbidden'); // staff use members.changePlan
    w.run('planChange.request', { memberId: 'm46', to: 'flex' }, 'f1');
    w.fail('planChange.request', { memberId: 'm46', to: 'flex' }, 'f1', 'err.planRequestPending');
  });
  it('the asker can withdraw a pending request; it leaves the family view and the needs-action list', () => {
    const w = world();
    const id = w.run('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1').result.requestId as string;
    expect(Object.keys(projectForFamily(w.s, 'f1').planChangeRequests)).toContain(id);
    w.fail('planChange.withdraw', { requestId: 'pcr-m10' }, 'f1', 'err.forbidden'); // not hers
    w.run('planChange.withdraw', { requestId: id }, 'f1');
    expect(pending(w.s, 'm1')).toHaveLength(0);
    expect(Object.keys(projectForFamily(w.s, 'f1').planChangeRequests)).not.toContain(id);
    expect(actionItems(w.s, getUser(clubs, 's9')!, T, 600).some((x) => x.id === 'pcr:' + id)).toBe(false);
    w.fail('planChange.withdraw', { requestId: id }, 'f1', 'err.notFound');
    // she can ask again afterwards
    w.run('planChange.request', { memberId: 'm1', to: 'gold' }, 'f1');
    expect(pending(w.s, 'm1')).toHaveLength(1);
  });
  it('runs on the family projection too (optimistic update in the browser)', () => {
    const s = projectForFamily(buildSeed().citra, 'f1');
    const r = execute(s, 'planChange.request', { memberId: 'm1', to: 'gold' }, getUser(clubs, 'f1')!, clock, 'pr-proj');
    expect(pending(r.state, 'm1')).toHaveLength(1);
  });
});
