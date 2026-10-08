// Renewals (KC round 7): the small texts both the list and the follow-up sheet use.
import type { FollowUp, FollowUpOutcome, Plan } from '@cp/shared';
import type { RenewalRow } from '@cp/shared/rules/renewals';
import type { TFn } from '../../lib/i18n';

type Fmt = { fmonth: (m: string, y?: boolean) => string; fd: (d: string, o: Intl.DateTimeFormatOptions) => string };

export const planLabel = (t: TFn, p: Plan) => t(`renewals.plan.${p}`);
export const outcomeLabel = (t: TFn, o: FollowUpOutcome) => t(`renewals.outcome.${o}`);
export const callsText = (t: TFn, n: number) => (n === 1 ? t('renewals.calls1') : t('renewals.callsN', { n }));
const short = { day: 'numeric', month: 'short' } as const;

/** "Leave Nov, Dec" · "Stops 31 Oct" · "No answer · 2 calls" · "Upgrade to Gold": what the family decided, in a few words. Empty when nobody was reached. */
export function outcomeText(t: TFn, fmt: Fmt, f: FollowUp | undefined): string {
  if (!f?.outcome) return '';
  if (f.status === 'rejected') return t('renewals.meta.rejected');
  switch (f.outcome) {
    case 'leave': return t('renewals.meta.leave', { months: (f.leaveMonths ?? []).map((m) => fmt.fmonth(m)).join(', ') });
    case 'stop': return t('renewals.meta.stop', { date: f.lastDay ? fmt.fd(f.lastDay, short) : '' });
    case 'noAnswer':
    case 'callBack': return `${t(`renewals.meta.${f.outcome}`)} · ${callsText(t, f.calls.length)}`;
    default: return t(`renewals.meta.${f.outcome}`);
  }
}

/** The one meta line of a row: plan · family contact · the latest outcome (or "Asked in the app"). */
export function rowMeta(t: TFn, fmt: Fmt, r: RenewalRow): { text: string; rejected: boolean } {
  const outcome = r.asked ? t('renewals.askedApp') : outcomeText(t, fmt, r.f);
  return { text: [planLabel(t, r.plan), r.contact ? r.contact.name : t('renewals.noContact'), outcome].filter(Boolean).join(' · '), rejected: !r.asked && r.f?.status === 'rejected' };
}
