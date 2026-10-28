// Round 15, phase 2: the plan catalogue. Flex and Gold are virtual entries; custom plans are stored in the club settings.
import { describe, it, expect } from 'vitest';
import { buildSeed, type ClubState, type PlanDef } from '../index';
import { isDaysPlan, isPlanId, planDef, planDefs, planLabel, planOf, planPrice, planQuota } from './plans';
import { planPriceInfo, priceOn } from './billing';

const T = '2026-10-21';
const FLEX8: PlanDef = { id: 'plan_1', name: 'Flex 8', nameId: 'Fleks 8', kind: 'days', quota: 8, active: true };
const PRIVATE: PlanDef = { id: 'plan_2', name: 'Private', kind: 'unlimited', active: false };
const withPlans = (...plans: PlanDef[]): ClubState => {
  const s = structuredClone(buildSeed().citra);
  s.club.settings.plans = plans;
  return s;
};

describe('planDefs', () => {
  it('lists Flex (days, the club quota), Gold (unlimited), then the catalogue in order', () => {
    const s = withPlans(FLEX8, PRIVATE);
    expect(planDefs(s).map((p) => p.id)).toEqual(['flex', 'gold', 'plan_1', 'plan_2']);
    expect(planDefs(s)[0]).toMatchObject({ id: 'flex', kind: 'days', quota: s.club.settings.flexQuota, active: true });
    expect(planDefs(s)[1]).toMatchObject({ id: 'gold', kind: 'unlimited', active: true });
    expect(planDefs(s)[1].quota).toBeUndefined();
    expect(planDef(s, 'plan_2')).toEqual(PRIVATE);
    expect(planDef(s, 'plan_9')).toBeUndefined();
  });
  it('is just Flex and Gold when the club has no catalogue', () => {
    expect(planDefs(withPlans()).map((p) => p.id)).toEqual(['flex', 'gold']);
    const s = structuredClone(buildSeed().citra);
    delete s.club.settings.plans;
    expect(planDefs(s).map((p) => p.id)).toEqual(['flex', 'gold']);
  });
  it('Flex follows the club quota setting', () => {
    const s = withPlans();
    s.club.settings.flexQuota = 7;
    expect(planDef(s, 'flex')!.quota).toBe(7);
    expect(planQuota(s, 'flex')).toBe(7);
  });
});

describe('plan helpers', () => {
  const s = withPlans(FLEX8, PRIVATE);
  it('days plans have a quota, unlimited plans none', () => {
    expect([isDaysPlan(s, 'flex'), isDaysPlan(s, 'gold'), isDaysPlan(s, 'plan_1'), isDaysPlan(s, 'plan_2')]).toEqual([true, false, true, false]);
    expect([planQuota(s, 'gold'), planQuota(s, 'plan_1'), planQuota(s, 'plan_2')]).toEqual([null, 8, null]);
    expect(planQuota(s, 'plan_9')).toBeNull();
    expect(isDaysPlan(s, 'plan_9')).toBe(false);
  });
  it('prices: Flex and Gold from the list, a custom plan from PriceVersion.plans, Rp 0 when it has none', () => {
    const p = { ...priceOn(s, T), plans: { plan_1: 2_000_000 } };
    expect([planPrice(p, 'flex'), planPrice(p, 'gold'), planPrice(p, 'plan_1'), planPrice(p, 'plan_2')]).toEqual([p.flex, p.gold, 2_000_000, 0]);
    expect(planPrice({ ...p, plans: undefined }, 'plan_1')).toBe(0);
  });
  it('labels follow the language and fall back to the English name', () => {
    expect([planLabel(s, 'plan_1', 'en'), planLabel(s, 'plan_1', 'id'), planLabel(s, 'plan_2', 'id'), planLabel(s, 'flex', 'id'), planLabel(s, 'gold', 'en')]).toEqual(['Flex 8', 'Fleks 8', 'Private', 'Flex', 'Gold']);
    expect(planLabel(s, 'plan_9', 'en')).toBe('plan_9');
  });
});

describe('planOf', () => {
  it('accepts Flex, Gold and any active catalogue plan', () => {
    const s = withPlans(FLEX8, PRIVATE);
    expect(['flex', 'gold', 'plan_1'].map((p) => planOf(s, p))).toEqual(['flex', 'gold', 'plan_1']);
  });
  it('refuses a retired, an unknown or a malformed id with the invalid-input code (or the one asked for)', () => {
    const s = withPlans(FLEX8, PRIVATE);
    for (const bad of ['plan_2', 'plan_9', 'platinum', '', null, undefined, 7]) expect(() => planOf(s, bad)).toThrow('err.invalid');
    expect(() => planOf(s, 'plan_2', 'members.err.planInvalid')).toThrow('members.err.planInvalid');
    expect(isPlanId('plan_1') && isPlanId('gold') && !isPlanId('plan_') && !isPlanId('planet')).toBe(true);
  });
});

describe('planPriceInfo (a plan priced from a future date)', () => {
  it('is the price in force; else the first later price with its start date; else 0', () => {
    const s = withPlans(FLEX8, PRIVATE);
    const base = Object.values(s.prices)[0];
    s.prices['price-later'] = { ...base, id: 'price-later', from: '2026-11-01', plans: { plan_1: 2_100_000 } };
    s.prices['price-later2'] = { ...base, id: 'price-later2', from: '2026-12-01', plans: { plan_1: 2_300_000 } };
    expect(planPriceInfo(s, 'plan_1', T)).toEqual({ price: 2_100_000, from: '2026-11-01' });
    expect(planPriceInfo(s, 'plan_1', '2026-11-05')).toEqual({ price: 2_100_000 });
    expect(planPriceInfo(s, 'plan_1', '2026-12-05')).toEqual({ price: 2_300_000 });
    expect(planPriceInfo(s, 'plan_2', T)).toEqual({ price: 0 });
    expect(planPriceInfo(s, 'flex', T)).toEqual({ price: priceOn(s, T).flex });
  });
});
