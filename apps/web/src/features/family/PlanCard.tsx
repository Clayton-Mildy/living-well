// The plan card (Flex visits bar with extra visits, or Gold) and the invoice card (open invoices, empty state).
import { useState } from 'react';
import { isPrimaryFor, memberShort, paidDate, priceOn, rp, type Member } from '@cp/shared';
import { pendingPlanRequest, planName } from '@cp/shared/actions/planRequests';
import { billingContactOf, historyRows, invoiceRows, nextIssueDate, openInvoiceRows, openTotal, planSummary } from '@cp/shared/rules/family';
import { Button, Icon, Sheet, StatusBadge } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFamilyCtx } from './useFamily';
import { Cap, fcard, heroBlock, linkBtn } from './parts';

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
  const text = { fontSize: 15, lineHeight: '22px', color: '#5E5852' } as const;
  return (
    <div style={fcard('', 14)} data-testid="plan-card" data-member={m.id}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Cap>{prefix}{label}</Cap>
        <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C' }}>{title}</div>
      </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: '22px' }}><Icon name="hourglass_top" size={20} color="#7A5510" />{t('family.planAsked', { plan: planName(pending.to), d: fmt.fds(pending.from) })}</div>
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
          <div style={{ fontSize: 15, lineHeight: '24px' }}>{to === 'gold'
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
  /** Sits inside the member card (hairline above, no card of its own). */
  bare?: boolean;
}
export function InvoiceCard({ m, showName, noPay, onPay, onDetails, onBilling, bare }: InvProps) {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { today } = now;
  const prefix = showName ? `${memberShort(m)} · ` : '';
  const rows = invoiceRows(s, [m.id], today);
  const open = openInvoiceRows(rows);
  const primary = !!user && isPrimaryFor(s, user.id, m.id);
  const contact = billingContactOf(s, m.id);

  const wrap = (extra: object) => (bare ? { ...heroBlock, ...extra } : fcard('', 12, extra));
  // ----- no invoice yet: never crash -----
  if (!rows.length) {
    const day = s.club.settings.issueDay;
    const od = fmt.lang === 'en' ? `${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}` : String(day);
    return (
      <div style={wrap({})} data-testid="invoice-card" data-empty="1">
        <Cap>{prefix}{t('nav.billing')}</Cap>
        <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 300, letterSpacing: '-0.3px', color: '#2B231C' }}>{t('family.invNone')}</span>
        <span className="cp-hide-phone" style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('family.invNoneSub', { od, d: day, date: fmt.fdy(nextIssueDate(s, today)) })}</span>
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
  const canPay = open.length > 0 && primary && !noPay;
  return (
    <div style={wrap({})} data-testid="invoice-card" data-member={m.id} data-open={open.length}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px 16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Cap>{prefix}{label}</Cap>
          <div style={{ fontSize: 'clamp(26px, 6vw, 30px)', lineHeight: 1.15, fontWeight: 300, letterSpacing: '-0.6px', fontVariantNumeric: 'tabular-nums', color: '#1E1A16' }}>{rp(amount)}</div>
          <div style={{ fontSize: 14, color: badge === 'overdue' ? '#9A3D24' : '#6B6259', lineHeight: 1.4 }}>{sub}</div>
        </div>
        {badge !== 'outstanding' ? <StatusBadge kind={badge} /> : null}
      </div>
      {canPay ? <Button size={56} full icon="account_balance" onClick={() => onPay(open.map((r) => r.inv.id))}>{t('family.payVA')}</Button> : null}
      {open.length && !primary ? <div style={{ fontSize: 15, lineHeight: '22px', color: '#5E5852' }}>{t('family.billingBy', { n: contact?.name || '', m: memberShort(m) })}</div> : null}
      <div style={{ display: 'flex', gap: 'clamp(12px, 4vw, 24px)', flexWrap: 'wrap', margin: '-6px 0 -6px -4px' }}>
        {single || !open.length ? <button type="button" onClick={() => onDetails(latest.inv.id)} style={linkBtn}>{t('family.viewDetails')}</button> : null}
        <button type="button" onClick={onBilling} style={linkBtn}>{t('family.seeBilling')}</button>
      </div>
    </div>
  );
}
