// Round 8: "Ask the club to change the plan" and "Ask for leave", the two bronze text links under a parent's plan (Billing's Plans list and the parent's
// profile). The billing contact sends them; everyone else reads who to ask. A request waiting for the club shows with a way to withdraw it.
import { useState } from 'react';
import { isPrimaryFor, displayName, isDaysPlan, planLabel, planQuota, priceOn, rp, suspensionOf, type Member, type Plan } from '@cp/shared';
import { pendingPlanRequest } from '@cp/shared/actions/planRequests';
import { activePlans } from '@cp/shared/rules/members';
import { billingContactOf, planSummary } from '@cp/shared/rules/family';
import { Icon } from '../../components/ui';
import { planPriceText } from '../members/planPriceText';
import { useAct } from '../../lib/act';
import { Chips, F, FamSheet, TextLink } from './kit';
import { useFamilyCtx } from './useFamily';
import { useFamilyLeave } from './LeaveSection';

/**
 * Under one parent's plan: the leave months and a membership on hold (quiet lines), a pending plan request (with Withdraw), the two links.
 * `quiet` leaves out the "ask <name>" line for someone who is not the billing contact (Billing already says who looks after billing).
 */
export function PlanAsk({ m, quiet }: { m: Member; quiet?: boolean }) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const act = useAct();
  const [ask, setAsk] = useState(false);
  const [pick, setPick] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const canAsk = !!user && isPrimaryFor(s, user.id, m.id);
  const leave = useFamilyLeave({ s, m, today: now.today, t, fmt, act, canEdit: canAsk });
  if (!user) return null;
  const p = planSummary(s, m, now.today);
  const hold = suspensionOf(s, m.id, now.today);
  const line = { fontSize: 14, lineHeight: '20px', color: F.text } as const;
  const name = displayName(m);
  const lang = fmt.lang;
  const name_ = (pl: Plan) => planLabel(s, pl, lang);
  // the family can ask for any other active plan of the catalogue (a retired plan is not offered)
  const choices = activePlans(s).filter((d) => d.id !== p.plan);
  const to: Plan = choices.find((d) => d.id === pick)?.id ?? choices[0]?.id ?? (p.plan === 'flex' ? 'gold' : 'flex');
  const next = new Date(Date.UTC(+now.today.slice(0, 4), +now.today.slice(5, 7), 1)).toISOString().slice(0, 10);
  const price = priceOn(s, next);
  const pending = canAsk ? pendingPlanRequest(s, m.id) : undefined;
  const payer = billingContactOf(s, m.id);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await act('planChange.request', { memberId: m.id, to }, { ok: t('family.planAskSent') });
      if (r.ok) setAsk(false);
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="plan-ask" data-member={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {hold ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...line, color: F.rust }} data-testid="plan-hold">
          <Icon name="pause_circle" size={18} fill={1} color={F.rust} style={{ marginTop: 1 }} />
          <span>{t(hold.told ? 'family.onHoldTold' : 'family.onHold', { no: hold.number, a: rp(hold.balance), n: name, d: fmt.fds(hold.stopOn) })}</span>
        </div>
      ) : null}
      {p.ended ? (
        <div style={{ ...line, color: F.muted }}>{t('family.endedPlan')}</div>
      ) : (
        <>
          {leave.rows}
          {pending ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...line }} data-testid="plan-request">
              <Icon name="hourglass_top" size={18} color={F.ochre} style={{ marginTop: 1 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{t('family.planAsked', { plan: name_(pending.to), d: fmt.fds(pending.from) })}</span>
            </div>
          ) : null}
          {canAsk ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px' }}>
              {pending ? (pending.createdBy === `family:${user.id}`
                ? <TextLink onClick={() => void act('planChange.withdraw', { requestId: pending.id }, { ok: t('family.planWithdrawn') })} testId="plan-withdraw">{t('family.planWithdraw')}</TextLink> : null)
                : <TextLink onClick={() => { setPick(null); setAsk(true); }} testId="plan-ask-link">{t('fme.askPlan')}</TextLink>}
              {leave.link}
            </div>
          ) : !quiet && payer ? <div style={{ ...line, color: F.muted }}>{t('fme.askWho', { n: payer.name })}</div> : null}
          {leave.sheet}
          {canAsk ? (
            <FamSheet open={ask} onClose={() => setAsk(false)} title={t('family.planAskTitle', { name, plan: name_(to) })} testId="plan-sheet" action={{ label: t('fam.send'), onClick: () => void send(), disabled: busy }}>
              {choices.length > 1 ? <Chips label={t('family.planPick')} testId="plan-pick" items={choices.map((d) => ({ value: d.id, label: name_(d.id) }))} value={to} onChange={setPick} /> : null}
              <div style={{ fontSize: 15, lineHeight: '22px', color: F.soft }}>{isDaysPlan(s, to)
                ? t('family.planAskBodyFlex', { plan: name_(to), q: planQuota(s, to) ?? s.club.settings.flexQuota, p: planPriceText(s, to, next, t, fmt.fds), x: rp(price.extra), d: fmt.fdl(next) })
                : t('family.planAskBodyGold', { plan: name_(to), p: planPriceText(s, to, next, t, fmt.fds), d: fmt.fdl(next) })}</div>
            </FamSheet>
          ) : null}
        </>
      )}
    </div>
  );
}
