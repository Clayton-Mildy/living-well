// The membership plan catalogue (round 15, phase 2). Flex and Gold are virtual entries: their quota and prices stay in the club settings and the price list.
// Plans management adds are stored in `ClubSettings.plans` and priced in `PriceVersion.plans`.
import type { ClubState, Plan, PlanDef, PriceVersion } from '../types';
import { DomainError } from '../actions/framework';

/** Flex, Gold, then the catalogue in the order management made it. */
export function planDefs(s: ClubState): PlanDef[] {
  return [
    { id: 'flex', name: 'Flex', kind: 'days', quota: s.club.settings.flexQuota, active: true },
    { id: 'gold', name: 'Gold', kind: 'unlimited', active: true },
    ...(s.club.settings.plans ?? []),
  ];
}
export const planDef = (s: ClubState, plan: Plan): PlanDef | undefined => planDefs(s).find((p) => p.id === plan);
/** A plan with a visit quota (Flex, and a catalogue plan of the "days" kind). Unlimited plans never make extra days. */
export const isDaysPlan = (s: ClubState, plan: Plan): boolean => planDef(s, plan)?.kind === 'days';
/** Visits a month the plan includes; null = unlimited (or a plan that is not in the catalogue). */
export const planQuota = (s: ClubState, plan: Plan): number | null => {
  const d = planDef(s, plan);
  return d?.kind === 'days' ? d.quota ?? null : null;
};
/** The monthly price of a plan in a price list. A custom plan the list has no figure for is Rp 0. */
export const planPrice = (price: PriceVersion, plan: Plan): number => (plan === 'flex' ? price.flex : plan === 'gold' ? price.gold : price.plans?.[plan] ?? 0);
/** A plan's name in the language (the Indonesian name when there is one). An id the catalogue does not know shows as itself. */
export function planLabel(s: ClubState, plan: Plan, lang: 'en' | 'id'): string {
  const d = planDef(s, plan);
  return d ? (lang === 'id' && d.nameId ? d.nameId : d.name) : plan;
}
/**
 * Both names of a plan for a notice or a feed line, the way an invoice line carries them: `plan` is the English name, `planId` the Indonesian one (the English
 * name when there is none) for copy that already says "paket": a leading "Paket " is dropped so the copy never reads "Paket Paket Hemat 8".
 */
export function planParams(s: ClubState, plan: Plan): { plan: string; planId: string } {
  return { plan: planLabel(s, plan, 'en'), planId: planLabel(s, plan, 'id').replace(/^paket\s+/i, '') || planLabel(s, plan, 'en') };
}
/** The shape of a plan id: Flex, Gold or a catalogue plan (`plan_<n>`). Says nothing about whether the catalogue has it. */
export const isPlanId = (v: unknown): v is Plan => v === 'flex' || v === 'gold' || (typeof v === 'string' && /^plan_[A-Za-z0-9_]{1,40}$/.test(v));
/** A plan an action takes: any active plan of the catalogue. An unknown or retired id is refused with `code` (default: the invalid-input code). */
export function planOf(s: ClubState, raw: unknown, code = 'err.invalid'): Plan {
  if (!isPlanId(raw)) throw new DomainError(code);
  const d = planDef(s, raw);
  if (!d || !d.active) throw new DomainError(code);
  return raw;
}
