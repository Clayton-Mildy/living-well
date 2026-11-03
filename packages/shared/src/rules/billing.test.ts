// The invoice run's lines for a member: the dementia care fee (round 14, A2) on top of the plan line.
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, priceOn, sum, type ClubState, type PlanDef } from '../index';
import { FEE_DEFAULTS, feeOf, nextBill, pickupPrice, runLinesFor } from './billing';

const T = '2026-10-21';
const PERIOD = '2026-11';
// round 16: Ega's price changes would wait for the Owner (ownerGate.test.ts), so the switch is off
const seed = (): ClubState => { const s = structuredClone(buildSeed().citra); s.club.settings.ownerApproval = { mgmt: { pricing: false, holidays: false, budget: false } }; return s; };
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

describe('round 16: the pick-up fee', () => {
  const pickupLine = (s: ClubState, period = PERIOD) => runLinesFor(s, s.members.m1, period, T).find((l) => l.kind === 'pickup');
  it('a member with pick-up on is billed the default Rp 600.000 a month, or their own price', () => {
    expect(FEE_DEFAULTS.pickup).toBe(600_000);
    expect(FEE_DEFAULTS.fieldTrip).toBe(250_000);
    const s = seed();
    expect(pickupLine(s)).toBeUndefined();
    s.members.m1.pickup = { on: true };
    expect(pickupLine(s)).toMatchObject({ id: 'pickup-2026-11', kind: 'pickup', label: 'inv.line.pickup', amount: 600_000 });
    expect(pickupPrice(s, s.members.m1, '2026-11-21')).toEqual({ price: 600_000, custom: false });
    s.members.m1.pickup = { on: true, price: 450_000 };
    expect(pickupLine(s)?.amount).toBe(450_000);
    s.members.m1.pickup = { on: false, price: 450_000 };
    expect(pickupLine(s)).toBeUndefined();
  });
  it('no pick-up line in a month of leave, nor after the last day', () => {
    const s = seed();
    s.members.m1.pickup = { on: true };
    const cur = s.members.m1.memberships.at(-1)!;
    cur.leaves = [{ month: PERIOD, at: '2026-10-01T10:00', by: 'staff:s1' }];
    expect(pickupLine(s)).toBeUndefined();
    cur.leaves = [];
    cur.lastDay = '2026-11-10';
    expect(pickupLine(s, '2026-12')).toBeUndefined();
  });
});

describe('round 17: on your next bill', () => {
  const bare = () => { const s = seed(); s.pendingCharges = {}; return s; }; // the seed already bills Opa Budi's pick-up, cake and trip
  const trip = (s: ClubState, id: string, memberId: string, amount: number, invoiceId?: string) => {
    s.pendingCharges[id] = { id, clubId: s.clubId, createdAt: '2026-10-20T15:00:00', createdBy: 'staff:s1', memberId, amount, label: 'inv.line.fieldTrip', params: { title: 'Zoo', date: '2026-10-20' }, ...(invoiceId ? { invoiceId } : {}) } as never;
  };
  it('lists the un-invoiced charges and next month\'s pick-up fee, with a total', () => {
    const s = bare();
    s.members.m46.pickup = { on: true, price: 500_000 };
    trip(s, 'trip-e1-m46', 'm46', 250_000);
    const b = nextBill(s, 'm46', T);
    expect(b.items.map((i) => i.id).sort()).toEqual(['pickup', 'trip-e1-m46']);
    expect(b.items.find((i) => i.id === 'pickup')).toMatchObject({ label: 'inv.line.pickup', amount: 500_000 });
    expect(b.items.find((i) => i.id === 'trip-e1-m46')).toMatchObject({ label: 'inv.line.fieldTrip', params: { title: 'Zoo', date: '2026-10-20' }, amount: 250_000 });
    expect(b.total).toBe(750_000);
  });
  it('leaves out invoiced charges, other members\' charges and a pick-up that is off', () => {
    const s = bare();
    s.members.m46.pickup = { on: false, price: 500_000 };
    trip(s, 'trip-e1-m46', 'm46', 250_000, 'INV-2610-046');
    trip(s, 'trip-e1-m1', 'm1', 250_000);
    expect(nextBill(s, 'm46', T)).toEqual({ items: [], total: 0 });
  });
  it('has no pick-up item when next month is leave or after the last day', () => {
    const s = bare();
    s.members.m46.pickup = { on: true };
    expect(nextBill(s, 'm46', T).items.map((i) => i.amount)).toEqual([600_000]);
    const cur = s.members.m46.memberships.at(-1)!;
    cur.leaves = [{ month: '2026-11', at: '2026-10-01T10:00', by: 'staff:s1' }];
    expect(nextBill(s, 'm46', T).items).toEqual([]);
    cur.leaves = [];
    cur.lastDay = '2026-10-31';
    expect(nextBill(s, 'm46', T).items).toEqual([]);
  });
  // before the 21st the next invoice is this month's (issued on the 21st of the month itself), so the preview reads this month's run lines
  it('ending 30 Nov, today 4 Nov: November\'s pick-up is on the bill, as on the invoice', () => {
    const s = bare();
    s.members.m46.pickup = { on: true, price: 450_000 };
    trip(s, 'cel-cake-m46', 'm46', 350_000);
    s.members.m46.memberships.at(-1)!.lastDay = '2026-11-30';
    const today = '2026-11-04';
    const b = nextBill(s, 'm46', today);
    expect(b.items.map((i) => i.id)).toEqual(['pickup', 'cel-cake-m46']);
    expect(b.total).toBe(800_000);
    const inv = runLinesFor(s, s.members.m46, '2026-11', today).filter((l) => l.kind === 'pickup' || l.id.startsWith('charge-'));
    expect(b.total).toBe(sum(inv.map((l) => l.amount)));
  });
  it('on leave in November, today 4 Nov: no pick-up, as on the invoice', () => {
    const s = bare();
    s.members.m46.pickup = { on: true, price: 450_000 };
    s.members.m46.memberships.at(-1)!.leaves = [{ month: '2026-11', at: '2026-10-01T10:00', by: 'staff:s1' }];
    expect(nextBill(s, 'm46', '2026-11-04').items).toEqual([]);
    expect(runLinesFor(s, s.members.m46, '2026-11', '2026-11-04').some((l) => l.kind === 'pickup')).toBe(false);
  });
});
