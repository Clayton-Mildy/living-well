// The plan card (Flex visits bar with extra visits, or Gold) and the invoice card (open invoices, empty state).
import { useState } from 'react';
import { isPrimaryFor, memberShort, paidDate, priceOn, rp, type Member } from '@cp/shared';
import { pendingPlanRequest, planName } from '@cp/shared/actions/planRequests';
import { billingContactOf, historyRows, invoiceRows, nextIssueDate, openInvoiceRows, openTotal, planSummary } from '@cp/shared/rules/family';
import { Button, FONT_BODY, Icon, Sheet, StatusBadge } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFamilyCtx } from './useFamily';
import { Cap, fcard } from './parts';

interface PlanProps {
  m: Member;
  showName: boolean;
}
/** Flex: "N of 10 visits used" with the bar, and the extra visits (Rp each, billed next month). Gold: come any open day. All counted from check-ins. */
export function PlanCard({ m, showName }: PlanProps) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const act = useAct();
  const [ask, setAsk] = useState(false);
  const p = planSummary(s, m, now.today);
  const flex = p.plan === 'flex';
  const month = fmt.fmonth(p.month);
  const invoiceMonth = fmt.fmonth(p.invoiceMonth);
  const prefix = showName ? `${memberShort(m)} · ` : '';
  const label = flex ? t('family.planLabel', { m: month }) : t('family.planGoldLabel', { m: month });
  const title = flex ? t('family.visitsUsed', { n: p.used, q: p.quota ?? 0, m: month }) : t('family.goldTitle');
  const segs = flex ? Array.from({ length: Math.max(1, p.quota ?? 0) }, (_, i) => i < p.used) : [];
  const text = { fontSize: 16, lineHeight: '22px', color: '#282828' } as const;
  return (
    <div style={fcard('20px 18px', 14)} data-testid="plan-card" data-member={m.id}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Cap>{prefix}{label}</Cap>
        <div style={{ fontSize: 24, lineHeight: '32px', letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</div>
      </div>
      {flex ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${segs.length},minmax(0,1fr))`, gap: 4 }} role="img" aria-label={title}>
            {segs.map((on, i) => <span key={i} style={{ height: 12, borderRadius: 999, background: on ? '#75624B' : '#EFECEA' }} />)}
          </div>
          <div className="cp-hide-phone" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: FONT_BODY, color: '#282828', lineHeight: 1.4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 999, background: '#75624B' }} />{t('family.used')}</span>
          </div>
          {p.extra.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="extra-visits">
              <div style={{ ...text, fontWeight: 500 }}>{t(p.extra.length > 1 ? 'family.visitsExtraN' : 'family.visitsExtra', { n: p.extra.length, p: rp(p.price * p.extra.length), m: invoiceMonth })}</div>
              <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('family.extraDates', { d: p.extra.map((d) => fmt.fds(d)).join(', ') })}</div>
            </div>
          ) : null}
          <div className="cp-hide-phone" style={text}>{t('family.extraRule', { p: rp(p.price), m: invoiceMonth })}</div>
        </>
      ) : (
        <div style={text}>{t('family.goldVisits', { n: p.used, m: month })}</div>
      )}
      {p.ended ? <div style={text}>{t('family.endedPlan')}</div> : planRequest()}
    </div>
  );
  // the primary contact can ask to switch plan from the 1st of next month; finance or management confirms it
  function planRequest() {
    if (!user || !isPrimaryFor(s, user.id, m.id)) return null;
    const pending = pendingPlanRequest(s, m.id);
    if (pending) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="plan-request">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: '22px' }}><Icon name="hourglass_top" size={20} color="#7A5510" />{t('family.planAsked', { plan: planName(pending.to), d: fmt.fds(pending.from) })}</div>
          {pending.createdBy === `family:${user.id}` ? <div><Button variant="ghost" size={44} onClick={() => act('planChange.withdraw', { requestId: pending.id }, { ok: t('family.planWithdrawn') })}>{t('family.planWithdraw')}</Button></div> : null}
        </div>
      );
    }
    const to = flex ? 'gold' : 'flex';
    const next = new Date(Date.UTC(+now.today.slice(0, 4), +now.today.slice(5, 7), 1)).toISOString().slice(0, 10);
    const price = priceOn(s, next);
    return (
      <>
        <div><Button variant="secondary" size={44} icon="sell" onClick={() => setAsk(true)}>{flex ? t('family.planAskGold') : t('family.planAskFlex')}</Button></div>
        <Sheet open={ask} onClose={() => setAsk(false)} title={t('family.planAskTitle', { name: memberShort(m), plan: planName(to) })}
          footer={<Button size={56} full onClick={async () => { const r = await act('planChange.request', { memberId: m.id, to }, { ok: t('family.planAskSent') }); if (r.ok) setAsk(false); }}>{t('family.planAskSend')}</Button>}>
          <div style={{ fontSize: 16, lineHeight: '24px' }}>{to === 'gold'
            ? t('family.planAskBodyGold', { p: rp(price.gold), d: fmt.fdl(next) })
            : t('family.planAskBodyFlex', { q: s.club.settings.flexQuota, p: rp(price.flex), x: rp(price.extra), d: fmt.fdl(next) })}</div>
        </Sheet>
      </>
    );
  }
}

interface InvProps {
  m: Member;
  showName: boolean;
  /** Both mode: the pay button lives on the parent's own card. */
  noPay?: boolean;
  onPay: (ids: string[]) => void;
  onDetails: (invoiceId: string) => void;
  onBilling: () => void;
}
export function InvoiceCard({ m, showName, noPay, onPay, onDetails, onBilling }: InvProps) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { today } = now;
  const prefix = showName ? `${memberShort(m)} · ` : '';
  const rows = invoiceRows(s, [m.id], today);
  const open = openInvoiceRows(rows);
  const primary = !!user && isPrimaryFor(s, user.id, m.id);
  const contact = billingContactOf(s, m.id);

  // ----- no invoice yet: never crash -----
  if (!rows.length) {
    const day = s.club.settings.issueDay;
    const od = fmt.lang === 'en' ? `${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}` : String(day);
    return (
      <div style={fcard('20px 18px', 12)} data-testid="invoice-card" data-empty="1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#8A755B' }}><Icon name="receipt_long" size={26} /></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <Cap>{prefix}{t('nav.billing')}</Cap>
            <span style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{t('family.invNone')}</span>
            <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('family.invNoneSub', { od, d: day, date: fmt.fdy(nextIssueDate(s, today)) })}</span>
          </div>
        </div>
      </div>
    );
  }

  const latest = open.length ? open[0] : historyRows(rows)[0];
  const overdue = open.filter((r) => r.status === 'overdue');
  const single = open.length === 1;
  const badge = overdue.length ? 'overdue' : open.some((r) => r.status === 'partial') ? 'partial' : open.length ? 'outstanding' : 'paid';
  const label = open.length > 1 ? t('family.invOpen') : t('family.invL', { p: fmt.fmonth(latest.period, true) });
  const amount = open.length ? openTotal(open) : latest.total;
  const sub = !open.length ? t('family.paidOn', { d: fmt.fds(paidDate(s, latest.inv.id) || latest.inv.issueDate) })
    : overdue.length ? t('family.invOverdueSub', { d: fmt.fds(overdue[0].inv.dueDate) })
    : single ? (latest.status === 'partial' ? t('family.partPaid', { a: rp(latest.paid), t: rp(latest.total) }) : t('family.dueOn', { d: fmt.fds(latest.inv.dueDate) }))
    : t('family.invOpenSub', { n: open.length, d: fmt.fds(open[0].inv.dueDate) });
  return (
    <div style={fcard('20px 18px', 12)} data-testid="invoice-card" data-member={m.id} data-open={open.length}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Cap>{prefix}{label}</Cap>
          <div style={{ fontSize: 26, lineHeight: '32px', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{rp(amount)}</div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{sub}</div>
        </div>
        <StatusBadge kind={badge} />
      </div>
      {open.length && primary && !noPay ? <Button size={48} full icon="account_balance" onClick={() => onPay(open.map((r) => r.inv.id))}>{t('family.payVA')}</Button> : null}
      {open.length && !primary ? <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('family.billingBy', { n: contact?.name || '', m: memberShort(m) })}</div> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {single || !open.length ? <Button variant="secondary" size={44} onClick={() => onDetails(latest.inv.id)}>{t('family.viewDetails')}</Button> : null}
        <Button variant="ghost" size={44} onClick={onBilling}>{t('family.seeBilling')}</Button>
      </div>
    </div>
  );
}
