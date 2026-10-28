// Step 4, plan and first day: Flex or Gold with this month's price, the one-time registration fee, and the first day (the next open Mondays,
// or any open day).
import { useMemo } from 'react';
import { dayStatus, feeOf, isDaysPlan, planLabel, planQuota, priceOn, rp, type Plan } from '@cp/shared';
import { activePlans } from '@cp/shared/rules/members';
import { startMondays } from '@cp/shared/rules/enquiries';
import { DateField } from '../../../components/ui';
import { useFmt, useLang } from '../../../lib/i18n';
import { planPriceText } from '../planPriceText';
import { tn } from '../../mgmt/common';
import { Sec, StackChip, type StepProps } from './parts';

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

export function PlanStep({ p }: { p: StepProps }) {
  const { st, set, t, s, today } = p;
  const { fds } = useFmt();
  const lang = useLang();
  const price = priceOn(s, today);
  const mondays = useMemo(() => startMondays(s, today, 4), [s, today]);
  const pick = (plan: Plan) => set({ plan });
  return (
    <>
      <Sec p={p} label={t('enq.plan')}>
        <div style={row} role="radiogroup" aria-label={t('enq.plan')}>
          {activePlans(s).map((d) => (
            <StackChip key={d.id} selected={st.plan === d.id} label={planLabel(s, d.id, lang)} sub={`${planPriceText(s, d.id, today, t, fds)} · ${d.kind === 'days' ? tn(t, 'enq.jn_visits', planQuota(s, d.id) ?? s.club.settings.flexQuota) : t('mgmt.plUnlimited').toLowerCase()}`} onClick={() => pick(d.id)} />
          ))}
        </div>
        {p.err('plan') ? <div role="alert" style={{ color: '#9A3D24', fontSize: 14 }}>{p.err('plan')}</div> : null}
        {st.plan ? <div style={{ fontSize: 14, lineHeight: '21px', color: '#5E5852' }}>{isDaysPlan(s, st.plan) ? t('profile.planNoteFlex', { plan: planLabel(s, st.plan, lang), q: planQuota(s, st.plan) ?? s.club.settings.flexQuota, p: rp(price.extra) }) : t('profile.planNoteGold', { plan: planLabel(s, st.plan, lang) })}</div> : null}
        <div data-testid="join-reg-fee" style={{ fontSize: 14, lineHeight: '21px', padding: '10px 14px', borderRadius: 14, background: p.native ? '#FFFFFF' : 'var(--fill, #F4F4F5)' }}>{t('enq.jn_regFee', { price: rp(feeOf(price, 'registration')) })}</div>
      </Sec>
      <Sec p={p} label={t('enq.start')}>
        <div style={row} role="radiogroup" aria-label={t('enq.start')}>
          {mondays.map((m) => <StackChip key={m} selected={st.start === m} label={fds(m).replace(/,/g, '')} onClick={() => set({ start: m })} />)}
        </div>
        <DateField label={t('enq.otherDate')} value={st.start} min={today} onChange={(v) => set({ start: v })} disabledDate={(d) => !dayStatus(s, d).open} error={p.err('start')} />
      </Sec>
    </>
  );
}
