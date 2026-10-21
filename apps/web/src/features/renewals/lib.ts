// Renewals (KC round 7): the small texts both the list and the follow-up sheet use.
import type { FlexMonth, FollowUpOutcome, Plan } from '@cp/shared';
import { renewalStatus, type RenewalNext, type RenewalRow } from '@cp/shared/rules/renewals';
import type { TFn } from '../../lib/i18n';

type Fmt = { fmonth: (m: string, y?: boolean) => string; fd: (d: string, o: Intl.DateTimeFormatOptions) => string };

export const planLabel = (t: TFn, p: Plan) => t(`renewals.plan.${p}`);
export const outcomeLabel = (t: TFn, o: FollowUpOutcome) => t(`renewals.outcome.${o}`);
export const callsText = (t: TFn, n: number) => (n === 1 ? t('renewals.calls1') : t('renewals.callsN', { n }));
const short = { day: 'numeric', month: 'short' } as const;

/** "4 of 10 days" for a Flex member (plus the extra days), "12 days" for Gold: this month's visits, as the follow-up sheet and the list show them. */
export function usageText(t: TFn, plan: Plan, fm: FlexMonth): string {
  return plan === 'flex' || fm.quota !== null
    ? `${t('renewals.usageFlex', { used: Math.min(fm.used, fm.quota ?? fm.used), quota: fm.quota ?? 0 })}${fm.extra ? t('renewals.usageExtra', { n: fm.extra }) : ''}`
    : t('renewals.usageGold', { n: fm.used });
}

/** "6/10" (plus "+2" extra days) for a Flex member: the compact form for the phone's plan tag. */
export const usageShort = (fm: FlexMonth): string => (fm.quota === null ? '' : `${Math.min(fm.used, fm.quota)}/${fm.quota}${fm.extra ? `+${fm.extra}` : ''}`);

export type PillTone = 'linen' | 'sage' | 'ochre' | 'rust';
/** The Status column's pill (KC round 8d): where the follow-up stands. Green = stays or grows, amber = needs something, red = stops or was turned down, grey = nothing yet. */
export function statusLook(t: TFn, fmt: Fmt, r: RenewalRow): { key: string; label: string; tone: PillTone; icon?: string; pending: boolean } {
  const key = renewalStatus(r);
  const pending = r.f?.status === 'pending';
  // a leave says which months in the pill ("Leave · Dec, Jan"): the next step only gives the day it starts
  const outcome = key === 'new' || key === 'asked' || key === 'rejected' ? '' : key === 'leave' && r.f?.leaveMonths?.length ? `${outcomeLabel(t, key)} · ${r.f.leaveMonths.map((m) => fmt.fd(`${m}-01`, { month: 'short' })).join(', ')}` : outcomeLabel(t, key);
  if (pending) return { key, label: outcome, tone: 'ochre', icon: 'hourglass_top', pending };
  switch (key) {
    case 'new': return { key, label: t('renewals.status.new'), tone: 'linen', pending };
    case 'asked': return { key, label: t('renewals.status.asked'), tone: 'sage', icon: 'smartphone', pending };
    case 'rejected': return { key, label: t('renewals.status.rejected'), tone: 'rust', icon: 'block', pending };
    case 'noAnswer': return { key, label: outcome, tone: 'ochre', icon: 'phone_missed', pending };
    case 'continue': return { key, label: outcome, tone: 'sage', icon: 'check', pending };
    case 'upgrade': return { key, label: outcome, tone: 'sage', icon: 'trending_up', pending };
    case 'downgrade': return { key, label: outcome, tone: 'linen', icon: 'trending_down', pending };
    case 'leave': return { key, label: outcome, tone: 'linen', icon: 'pause_circle', pending };
    case 'stop': return { key, label: outcome, tone: 'rust', icon: 'stop_circle', pending };
  }
}

/** The Next step column, in words (management is the one who approves, so for her a waiting change reads "Approve"): "Call the family" · "Call again · 2 calls" · "Waiting for approval" · "Gold starts 1 Nov" · "Renews 1 Nov". Empty for a month that already started. */
export function nextText(t: TFn, fmt: Fmt, n: RenewalNext, mgmt = false): string {
  const date = n.date ? fmt.fd(n.date, short) : '';
  switch (n.kind) {
    case 'none': return '';
    case 'callAgain': return t('renewals.next.callAgain', { calls: callsText(t, n.calls ?? 0) });
    case 'approval': return t(mgmt ? 'renewals.next.approve' : 'renewals.next.approval');
    case 'planFrom': return t('renewals.next.planFrom', { plan: planLabel(t, n.plan ?? 'gold'), date });
    default: return t(`renewals.next.${n.kind}`, { date });
  }
}
