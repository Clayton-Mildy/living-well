// Round 17: visitCall.log writes one call about few visits (reached, no answer, staying); front desk and management only; staff-only data.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { execute, getUser, toMin, DomainError, projectForFamily, type ClubState } from '../index';
import { callsOf, fewVisitMembers } from '../rules/fewVisits';
import { FEW_DAY, FEW_MONTH, withFewVisits } from '../rules/testFewVisits';

const clock = { today: FEW_DAY, nowMin: toMin('10:00') };
const base = withFewVisits();
let n = 0;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, input: unknown, uid: string) => execute(s, 'visitCall.log', input, as(s, uid), clock, `vc${++n}`);
const fails = (s: ClubState, input: unknown, uid: string, code: string) => {
  try { run(s, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected visitCall.log to fail with ${code}`);
};

describe('visitCall.log', () => {
  it('the front desk logs a call with a note: one row for the member and the month, and the member shows as called', () => {
    expect(fewVisitMembers(base, FEW_DAY).find((r) => r.memberId === 'fv2')?.called).toBe(false);
    const r = run(base, { memberId: 'fv2', outcome: 'reached', note: 'Daughter says he had a cold' }, 's1');
    const rows = callsOf(r.state, 'fv2', FEW_MONTH);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ memberId: 'fv2', month: FEW_MONTH, outcome: 'reached', note: 'Daughter says he had a cold', by: 'staff:s1', at: `${FEW_DAY}T10:00` });
    expect(fewVisitMembers(r.state, FEW_DAY).find((x) => x.memberId === 'fv2')?.called).toBe(true);
  });

  it('management may call too; later calls stack up, newest first', () => {
    let r = run(base, { memberId: 'fv5', outcome: 'noAnswer' }, 's9');
    r = execute(r.state, 'visitCall.log', { memberId: 'fv5', outcome: 'staying' }, as(r.state, 's1'), { today: FEW_DAY, nowMin: toMin('11:30') }, 'vc-later');
    expect(callsOf(r.state, 'fv5', FEW_MONTH).map((c) => [c.outcome, c.by])).toEqual([['staying', 'staff:s1'], ['noAnswer', 'staff:s9'], ['noAnswer', 'staff:s1']]);
  });

  it('refuses the nurse, the kitchen, the activity lead and finance', () => {
    for (const uid of ['s8', 's2', 's5', 's10']) fails(base, { memberId: 'fv2', outcome: 'reached' }, uid, 'err.forbidden');
  });

  it('an unknown member, a deleted member or an unknown outcome is refused', () => {
    fails(base, { memberId: 'nobody', outcome: 'reached' }, 's1', 'err.notFound');
    const gone = { ...base, members: { ...base.members, fv2: { ...base.members.fv2, deletedAt: `${FEW_DAY}T08:00` } } };
    fails(gone, { memberId: 'fv2', outcome: 'reached' }, 's1', 'err.notFound');
    fails(base, { memberId: 'fv2', outcome: 'maybe' }, 's1', 'err.invalid');
  });

  it('keeps a note up to 200 characters', () => {
    const r = run(base, { memberId: 'fv2', outcome: 'reached', note: 'x'.repeat(300) }, 's1');
    expect(callsOf(r.state, 'fv2', FEW_MONTH)[0].note).toHaveLength(200);
  });

  it('a call stays on the month log when the member later reaches 5 visits, and drops off the live list', () => {
    const r = run(base, { memberId: 'fv1', outcome: 'staying' }, 's1');
    const visited = produce(r.state, (d) => { d.attendance['2026-11-06:fv1'] = { ...d.attendance['2026-11-06:m1'], id: '2026-11-06:fv1', memberId: 'fv1' }; });
    expect(fewVisitMembers(visited, FEW_DAY).map((x) => x.memberId)).not.toContain('fv1');
    expect(callsOf(visited, 'fv1', FEW_MONTH)).toHaveLength(1);
  });

  it('the family never gets the call log', () => {
    const r = run(base, { memberId: 'fv2', outcome: 'reached' }, 's1');
    expect(Object.keys(r.state.visitCalls).length).toBeGreaterThan(0);
    expect(projectForFamily(r.state, 'f1').visitCalls).toEqual({});
  });
});
