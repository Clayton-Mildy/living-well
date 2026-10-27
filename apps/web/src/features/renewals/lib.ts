// Renewals (KC round 7): the small texts both the list and the follow-up sheet use.
import { rp, type FlexMonth, type FollowUpOutcome, type Plan, type YM } from '@cp/shared';
import type { UnpaidRow } from '@cp/shared/rules/unpaid';
import type { TFn } from '../../lib/i18n';

type Fmt = { fd: (d: string, o: Intl.DateTimeFormatOptions) => string };

export const planLabel = (t: TFn, p: Plan) => t(`renewals.plan.${p}`);
export const outcomeLabel = (t: TFn, o: FollowUpOutcome) => t(`renewals.outcome.${o}`);

/** "4 of 10 days" for a Flex member (plus the extra days), "12 days" for Gold: this month's visits, as the follow-up sheet shows them. */
export function usageText(t: TFn, plan: Plan, fm: FlexMonth): string {
  return plan === 'flex' || fm.quota !== null
    ? `${t('renewals.usageFlex', { used: Math.min(fm.used, fm.quota ?? fm.used), quota: fm.quota ?? 0 })}${fm.extra ? t('renewals.usageExtra', { n: fm.extra }) : ''}`
    : t('renewals.usageGold', { n: fm.used });
}

/** Round 14: a recorded change in words: "Upgrade to Gold", "Stop", "Leave · Dec, Jan" (a leave says which months). */
export function changeText(t: TFn, fmt: Fmt, outcome: FollowUpOutcome, leaveMonths?: YM[]): string {
  return outcome === 'leave' && leaveMonths?.length ? `${outcomeLabel(t, outcome)} · ${leaveMonths.map((m) => fmt.fd(`${m}-01`, { month: 'short' })).join(', ')}` : outcomeLabel(t, outcome);
}

/** "Rp 2.700.000 · 9 days late" */
export const lateLine = (t: TFn, r: UnpaidRow) => t('unpaid.amountLate', { amount: rp(r.owed), late: r.daysLate === 1 ? t('unpaid.late1') : t('unpaid.lateN', { n: r.daysLate }) });
/** The next date that acts on the membership: the hold still to start, the stop still to come, or the hold that has begun. */
export function nextDateText(t: TFn, fd: Fmt['fd'], r: UnpaidRow, today: string, told: boolean): string {
  const dm = { day: 'numeric', month: 'short' } as const;
  if (today < r.suspendOn) return t('unpaid.suspendOn', { d: fd(r.suspendOn, dm) });
  if (!told && today < r.stopOn) return t('unpaid.stopOn', { d: fd(r.stopOn, dm) });
  return t('unpaid.onHold', { d: fd(r.suspendOn, dm) });
}

