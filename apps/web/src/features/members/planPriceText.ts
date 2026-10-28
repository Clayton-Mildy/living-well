// A plan's monthly price as a picker or card shows it: "Rp 2.100.000", or "From 1 Nov: Rp 2.100.000" for a plan whose only price starts later (round 15 fix wave).
import { planPriceInfo, rp, type ClubState, type ISODate, type Plan } from '@cp/shared';
import type { TFn } from '../../lib/i18n';

export function planPriceText(s: ClubState, plan: Plan, date: ISODate, t: TFn, fds: (d: ISODate) => string): string {
  const info = planPriceInfo(s, plan, date);
  return info.from ? t('plans.fromPrice', { date: fds(info.from), price: rp(info.price) }) : rp(info.price);
}
