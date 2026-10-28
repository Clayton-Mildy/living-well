// The invoice run's lines for a member: the dementia care fee (round 14, A2) on top of the plan line.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, priceOn, type ClubState, type PlanDef } from '../index';
import { FEE_DEFAULTS, feeOf, runLinesFor } from './billing';

const T = '2026-10-21';
const PERIOD = '2026-11';
const seed = (): ClubState => structuredClone(buildSeed().citra);
const withDementia = (v: boolean | undefined) => {
  const s = seed();
  s.members.m1.registration = { ...s.members.m1.registration, dementia: v };
  return s;
};
const dementiaLine = (s: ClubState) => runLinesFor(s, s.members.m1, PERIOD, T).find((l) => l.kind === 'dementia');

describe('the dementia care fee on the invoice', () => {
  it('is Rp 750.000 by default and a line of its own after the plan line', () => {
    expect(FEE_DEFAULTS.dementia).toBe(750000);
    const s = withDementia(true);
    expect(dementiaLine(s)).toMatchObject({ id: `dementia-${PERIOD}`, kind: 'dementia', label: 'inv.line.dementia', qty: 1, unit: 750000, amount: 750000 });
    const kinds = runLinesFor(s, s.members.m1, PERIOD, T).map((l) => l.kind);
    expect(kinds.indexOf('dementia')).toBe(kinds.indexOf('plan') + 1);
  });
  it('follows the price list when it has a figure', () => {
    const s = withDementia(true);
    const price = priceOn(s, '2026-11-21');
    Object.values(s.prices).forEach((p) => { if (p.id === price.id) p.dementia = 900000; });
    expect(feeOf(priceOn(s, '2026-11-21'), 'dementia')).toBe(900000);
    expect(dementiaLine(s)).toMatchObject({ unit: 900000, amount: 900000 });
  });
  it('is not billed when the answer is no or missing', () => {
    expect(dementiaLine(withDementia(false))).toBeUndefined();
    expect(dementiaLine(withDementia(undefined))).toBeUndefined();
  });
  it('is not billed in a month of leave (the leave fee replaces the plan)', () => {
    const s = withDementia(true);
    const ms = s.members.m1.memberships.at(-1)!;
    ms.leaves = [{ month: PERIOD, at: `${T}T10:00`, by: 'staff:s1' }];
    const lines = runLinesFor(s, s.members.m1, PERIOD, T);
    expect(lines.some((l) => l.label === 'inv.line.leave')).toBe(true);
    expect(lines.some((l) => l.kind === 'dementia')).toBe(false);
  });
});

// ---------- round 15, phase 2: custom plans on the invoice ----------
describe('a custom plan on the invoice run', () => {
  const FLEX8: PlanDef = { id: 'plan_1', name: 'Flex 8', nameId: 'Fleks 8', kind: 'days', quota: 8, active: true };
  const onPlan1 = (retired = false, plans: Record<string, number> = { plan_1: 2_000_000 }): ClubState => {
    const s = seed();
    s.club.settings.plans = [{ ...FLEX8, active: !retired }];
    Object.values(s.prices).forEach((p) => { p.plans = plans; });
    s.members.m1.plans = [{ from: '2020-01-01', plan: 'plan_1', by: 'staff:s9' }];
    return s;
  };
  const planLine = (s: ClubState, period = PERIOD) => runLinesFor(s, s.members.m1, period, T).find((l) => l.kind === 'plan' && l.id.startsWith('plan-'))!;
  it('bills the catalogue price as one plan line with the plan-name label', () => {
    expect(planLine(onPlan1())).toMatchObject({ id: `plan-${PERIOD}`, label: 'inv.line.plan', params: { month: PERIOD, plan: 'Flex 8', planId: 'Fleks 8' }, qty: 1, unit: 2_000_000, amount: 2_000_000 });
    expect(runLinesFor(onPlan1(), onPlan1().members.m1, PERIOD, T).filter((l) => l.kind === 'plan')).toHaveLength(1);
  });
  it('prorates a partial month exactly like Flex', () => {
    const custom = onPlan1();
    custom.members.m1.memberships.at(-1)!.start = '2026-11-12';
    const flex = structuredClone(custom);
    flex.members.m1.plans = [{ from: '2020-01-01', plan: 'flex', by: 'staff:s9' }];
    Object.values(flex.prices).forEach((p) => { p.flex = 2_000_000; });
    const a = planLine(custom).amount;
    expect(a).toBeLessThan(2_000_000);
    expect(a).toBe(planLine(flex).amount);
  });
  it('a price change from next month bills the old price this month and the new one from the 1st', () => {
    const s = onPlan1();
    const cur = priceOn(s, T);
    const r = execute(s, 'prices.set', { flex: cur.flex, gold: cur.gold, extra: cur.extra, plans: { plan_1: 2_400_000 }, from: '2026-12-01' }, getUser({ [s.clubId]: s }, 's9')!, { today: T, nowMin: 600 }, 'bp1');
    expect(planLine(r.state, '2026-11').amount).toBe(2_000_000);
    expect(planLine(r.state, '2026-12').amount).toBe(2_400_000);
  });
  it('a retired plan still bills; a plan with no price in force bills Rp 0', () => {
    expect(planLine(onPlan1(true)).amount).toBe(2_000_000);
    expect(planLine(onPlan1(false, {})).amount).toBe(0);
  });
  it('an extra day on a custom days plan is charged at the club extra-day price', () => {
    const s = onPlan1();
    const days = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
    s.attendance = {};
    for (const d of days) s.attendance[`${d}:m1`] = { id: `${d}:m1`, clubId: s.clubId, createdAt: `${d}T09:00`, createdBy: 'staff:s1', date: d, memberId: 'm1', checkIn: { at: `${d}T09:00`, by: 'staff:s1', method: 'manual' } } as never;
    const x = runLinesFor(s, s.members.m1, '2026-11', T).find((l) => l.kind === 'extraDay')!;
    expect(x).toMatchObject({ qty: 1, unit: priceOn(s, '2026-11-21').extra, dates: ['2026-10-13'] });
  });
});
