// The plan card (Flex visits bar with extra visits, or Gold), shown in family Billing. Invoices have their own list there.
import { useState } from 'react';
import { isPrimaryFor, memberShort, priceOn, rp, suspensionOf, type Member } from '@cp/shared';
import { pendingPlanRequest, planName } from '@cp/shared/actions/planRequests';
import { planSummary } from '@cp/shared/rules/family';
import { Button, Group, Icon, Sheet } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useFamilyCtx } from './useFamily';
import { useLeaveUi } from './LeaveSection';
import { Cap, fcard } from './parts';

interface PlanProps {
  m: Member;
  showName: boolean;
}
/** Flex: "N of 10 visits used" with the bar, and the extra visits (Rp each, billed next month). Gold: come any open day. All counted from check-ins. */
export function PlanCard({ m, showName }: PlanProps) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const act = useAct();
  const { isPhone } = useDevice();
  const [ask, setAsk] = useState(false);
  const p = planSummary(s, m, now.today);
  const flex = p.plan === 'flex';
  // KC round 6: leave (cuti) and an unpaid invoice (the brochure's terms): the billing contact asks for leave beside "Ask to switch plan"
  const leave = useLeaveUi({ s, m, today: now.today, t, fmt, act, canEdit: !!user && isPrimaryFor(s, user.id, m.id) });
  const hold = suspensionOf(s, m.id, now.today);
  const month = fmt.fmonth(p.month);
  const invoiceMonth = fmt.fmonth(p.invoiceMonth);
  const prefix = showName ? `${memberShort(m)} · ` : '';
  const label = flex ? t('family.planLabel', { m: month }) : t('family.planGoldLabel', { m: month });
  const title = flex ? t('family.visitsUsed', { n: p.used, q: p.quota ?? 0, m: month }) : t('family.goldTitle');
  const segs = flex ? Array.from({ length: Math.max(1, p.quota ?? 0) }, (_, i) => i < p.used) : [];
  const text = { fontSize: 15, lineHeight: '22px', color: '#5E5852' } as const;
  const rest = (
    <>
      {flex ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segs.length},minmax(0,1fr))`, gap: 4 }} role="img" aria-label={title}>
            {segs.map((on, i) => <span key={i} style={{ height: 10, borderRadius: 999, background: on ? '#75624B' : '#F0EAE1' }} />)}
          </div>
          {p.extra.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="extra-visits">
              <div style={{ ...text, fontWeight: 500, color: '#24201C' }}>{t(p.extra.length > 1 ? 'family.visitsExtraN' : 'family.visitsExtra', { n: p.extra.length, p: rp(p.price * p.extra.length), m: invoiceMonth })}</div>
              <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('family.extraDates', { d: p.extra.map((d) => fmt.fds(d)).join(', ') })}</div>
            </div>
          ) : null}
          <div className="cp-hide-phone" style={text}>{t('family.extraRule', { p: rp(p.price), m: invoiceMonth })}</div>
        </>
      ) : (
        <div style={text}>{t('family.goldVisits', { n: p.used, m: month })}</div>
      )}
      {hold ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...text, color: '#9A3D24' }} data-testid="plan-hold">
          <Icon name="pause_circle" size={20} fill={1} color="#9A3D24" style={{ marginTop: 1 }} />
          <span>{t(hold.told ? 'family.onHoldTold' : 'family.onHold', { no: hold.number, a: rp(hold.balance), n: memberShort(m), d: fmt.fds(hold.stopOn) })}</span>
        </div>
      ) : null}
      {p.ended ? <div style={text}>{t('family.endedPlan')}</div> : <>{leave.rows}{planRequest()}{leave.sheet}</>}
    </>
  );
  // round 6, phone: the plan is one thing, so one flat group with its label outside (like the iPhone Settings), not a shadowed card
  if (isPhone) {
    return (
      <div data-testid="plan-card" data-member={m.id}>
        <Group title={`${prefix}${label}`} gap={14}>
          <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C' }}>{title}</div>
          {rest}
        </Group>
      </div>
    );
  }
  return (
    <div style={fcard('', 14)} data-testid="plan-card" data-member={m.id}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Cap>{prefix}{label}</Cap>
        <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C' }}>{title}</div>
      </div>
      {rest}
    </div>
  );
  // the primary contact can ask to switch plan from the 1st of next month; finance or management confirms it
  function planRequest() {
    if (!user || !isPrimaryFor(s, user.id, m.id)) return null;
    const pending = pendingPlanRequest(s, m.id);
    if (pending) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="plan-request">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: '22px' }}><Icon name="hourglass_top" size={20} color="#7A5510" />{t('family.planAsked', { plan: planName(pending.to), d: fmt.fds(pending.from) })}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pending.createdBy === `family:${user.id}` ? <Button variant="ghost" size={44} onClick={() => act('planChange.withdraw', { requestId: pending.id }, { ok: t('family.planWithdrawn') })}>{t('family.planWithdraw')}</Button> : null}
            {leave.button}
          </div>
        </div>
      );
    }
    const to = flex ? 'gold' : 'flex';
    const next = new Date(Date.UTC(+now.today.slice(0, 4), +now.today.slice(5, 7), 1)).toISOString().slice(0, 10);
    const price = priceOn(s, next);
    return (
      <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size={44} icon="sell" onClick={() => setAsk(true)}>{flex ? t('family.planAskGold') : t('family.planAskFlex')}</Button>
          {leave.button}
        </div>
        <Sheet open={ask} onClose={() => setAsk(false)} title={t('family.planAskTitle', { name: memberShort(m), plan: planName(to) })}
          footer={<Button size={56} full onClick={async () => { const r = await act('planChange.request', { memberId: m.id, to }, { ok: t('family.planAskSent') }); if (r.ok) setAsk(false); }}>{t('family.planAskSend')}</Button>}>
          <div style={{ fontSize: 15, lineHeight: '24px' }}>{to === 'gold'
            ? t('family.planAskBodyGold', { p: rp(price.gold), d: fmt.fdl(next) })
            : t('family.planAskBodyFlex', { q: s.club.settings.flexQuota, p: rp(price.flex), x: rp(price.extra), d: fmt.fdl(next) })}</div>
        </Sheet>
      </>
    );
  }
}
