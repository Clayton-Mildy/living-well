// Step 4, plan and first day: Flex or Gold with this month's price, the one-time registration fee, and the first day (the next open Mondays,
// or any open day).
import { useMemo } from 'react';
import { dayStatus, feeOf, priceOn, rp, type Plan } from '@cp/shared';
import { startMondays } from '@cp/shared/rules/enquiries';
import { DateField } from '../../../components/ui';
import { useFmt } from '../../../lib/i18n';
import { tn } from '../../mgmt/common';
import { Sec, StackChip, type StepProps } from './parts';

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

export function PlanStep({ p }: { p: StepProps }) {
  const { st, set, t, s, today } = p;
  const { fds } = useFmt();
  const price = priceOn(s, today);
  const mondays = useMemo(() => startMondays(s, today, 4), [s, today]);
  const pick = (plan: Plan) => set({ plan });
  return (
    <>
      <Sec p={p} label={t('enq.plan')}>
        <div style={row} role="radiogroup" aria-label={t('enq.plan')}>
          <StackChip selected={st.plan === 'flex'} label={t('mgmt.plan_flex')} sub={`${rp(price.flex)} · ${tn(t, 'enq.jn_visits', s.club.settings.flexQuota)}`} onClick={() => pick('flex')} />
          <StackChip selected={st.plan === 'gold'} label={t('mgmt.plan_gold')} sub={`${rp(price.gold)} · ${t('mgmt.plUnlimited').toLowerCase()}`} onClick={() => pick('gold')} />
        </div>
        {p.err('plan') ? <div role="alert" style={{ color: '#9A3D24', fontSize: 14 }}>{p.err('plan')}</div> : null}
        {st.plan ? <div style={{ fontSize: 14, lineHeight: '21px', color: '#5E5852' }}>{st.plan === 'flex' ? t('profile.planNoteFlex', { q: s.club.settings.flexQuota, p: rp(price.extra) }) : t('profile.planNoteGold')}</div> : null}
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
