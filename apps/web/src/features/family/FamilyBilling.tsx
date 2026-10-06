// Family Billing (design ScrFbill 1943–1962): every open invoice (overdue included) with a total, pay one or all, history, invoice detail.
// Only a member's primary contact pays; everyone else sees who does. "Demo: simulate payment received" calls payment.simulateVa.
import { useCallback, useState } from 'react';
import { isPrimaryFor, memberName, memberShort, paidDate, rp, type Bank, type Member } from '@cp/shared';
import {
  BANKS, billingContactOf, combinedVa, historyRows, invoiceRows, nextIssueDate, openInvoiceRows, openTotal, planSummary, type InvRow,
} from '@cp/shared/rules/family';
import { Avatar, Button, Icon, StatusBadge, chipStyle, FONT_BODY } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useDevice } from '../../hooks/useDevice';
import { say } from '../../store/ui';
import { InvoiceSheet } from '../finance/InvoiceSheet';
import { Cap, FamSwitch, H1, fcard } from './parts';
import { PaySheet } from './sheets';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';
import { memberPhoto } from '../../lib/media';

export function FamilyBilling() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { isPhone } = useDevice();
  const act = useAct();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const [bank, setBank] = useState<Bank>('BCA');
  const [pay, setPay] = useState<string[] | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closePay = useCallback(() => setPay(null), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  if (!user || !who.length) return null;
  const { today } = now;
  const members = who.map((id) => s.members[id]).filter(Boolean);
  const rows = invoiceRows(s, who, today);
  const open = openInvoiceRows(rows);
  const hist = historyRows(rows);
  const primaryOf = (id: string) => isPrimaryFor(s, user.id, id);
  const payable = open.filter((r) => primaryOf(r.member.id));
  const overdue = open.filter((r) => r.status === 'overdue');
  const total = openTotal(open);
  const day = s.club.settings.issueDay;
  const od = fmt.lang === 'en' ? `${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}` : String(day);
  const va = combinedVa(payable.map((r) => r.inv.va), bank);
  const copy = () => { try { void navigator.clipboard.writeText(va.replace(/\s/g, '')); } catch { /* clipboard blocked */ } say(t('family.copied')); };
  const simulate = async () => {
    if (busy || !payable.length) return;
    setBusy(true);
    await act('payment.simulateVa', { invoiceIds: payable.map((r) => r.inv.id), bank }, { ok: t('family.paidT', { n: user.contact.firstName }) });
    setBusy(false);
  };
  // people who look after billing when it isn't this user
  const payers = Array.from(new Set(members.filter((m) => !primaryOf(m.id)).map((m) => billingContactOf(s, m.id)?.name).filter(Boolean) as string[]));
  // plan and visits this month, counted from check-ins; extra visits (Flex, 11th and later) are billed on next month's invoice
  const planLine = (m: Member) => {
    const p = planSummary(s, m, today);
    return p.plan === 'flex' ? `${t('family.planFlex')} · ${t('family.visitsUsed', { n: p.used, q: p.quota ?? 0, m: fmt.fmonth(p.month) })}` : t('family.planGoldLine');
  };
  const extraLine = (m: Member) => {
    const p = planSummary(s, m, today);
    return p.extra.length ? t(p.extra.length > 1 ? 'family.visitsExtraN' : 'family.visitsExtra', { n: p.extra.length, p: rp(p.price * p.extra.length), m: fmt.fmonth(p.invoiceMonth) }) : '';
  };
  const lineText = (r: InvRow) => r.inv.lines.map((l) => ({ id: l.id, k: t(l.label, { ...(l.params || {}), month: l.params?.month ? fmt.fmonth(String(l.params.month), true) : '' }), v: rp(l.amount) }));
  const badgeOf = (r: InvRow) => (r.status === 'paid' ? 'paid' : r.status === 'overdue' ? 'overdue' : r.status === 'partial' ? 'partial' : 'outstanding') as 'paid' | 'overdue' | 'partial' | 'outstanding';
  const subOf = (r: InvRow) => (r.status === 'paid' ? t('family.histPaid', { no: r.inv.number, d: fmt.fds(paidDate(s, r.inv.id) || r.inv.issueDate) })
    : r.status === 'partial' ? `${r.inv.number} · ${t('family.partPaid', { a: rp(r.paid), t: rp(r.total) })}` : t('family.histDue', { no: r.inv.number, d: fmt.fds(r.inv.dueDate) }));
  const first = members[0];
  return (
    <div style={{ padding: famPad(isPhone), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 2 : 6 }}>
        <Cap>{multi && members.length > 1 ? t('family.billEyebrowMulti') : memberName(first)}</Cap>
        <H1>{t('nav.billing')}</H1>
      </div>
      {multi ? <FamSwitch label={t('family.switcher')} value={sel} onChange={setSel} items={[...choices.map((id) => ({ key: id, label: memberShort(s.members[id]) })), { key: 'both', label: choices.length > 2 ? t('family.everyone') : t('family.both') }]} /> : null}

      {!rows.length ? (
        <div style={fcard('20px 18px', 12)} data-testid="billing-empty">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#8A755B' }}><Icon name="receipt_long" size={26} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{t('family.invNone')}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('family.invNoneSub', { od, d: day, date: fmt.fdy(nextIssueDate(s, today)) })}</span>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length && !open.length ? (
        <div style={fcard('18px', 8)} data-testid="billing-allpaid">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 999, background: '#E6EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#3D6B4F' }}><Icon name="check_circle" size={28} fill={1} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>{t('family.invAllPaid')}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('family.invAllPaidSub')}</span>
            </div>
          </div>
        </div>
      ) : null}

      {open.length ? (
        <div style={fcard('18px', 12, { border: '2px solid #75624B', boxShadow: '0 8px 24px rgba(117,98,75,0.08)' })} data-testid="billing-total">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <Cap>{payable.length > 1 ? t('family.payTogether') : t('family.billTotal')}</Cap>
            <span style={{ fontSize: 24, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }} data-testid="open-total">{rp(total)}</span>
          </div>
          <span className="cp-hide-phone" style={{ fontSize: 16, lineHeight: '24px' }}>{overdue.length ? t('family.billTotalSub', { n: open.length, o: overdue.length }) : t('family.billTotalSubOk', { n: open.length })}</span>
          {payable.length > 1 ? (
            <>
              <span className="cp-hide-phone" style={{ fontSize: 16, lineHeight: '24px', color: '#6A6967' }}>{t('family.payTogetherNote', { list: payable.map((r) => `${memberShort(r.member)} ${rp(r.balance)}`).join(' + ') })}</span>
              <div role="radiogroup" aria-label={t('family.bank')} className={isPhone ? 'scroll-x' : undefined} style={{ display: 'flex', flexWrap: isPhone ? 'nowrap' : 'wrap', gap: isPhone ? 6 : 8, ...(isPhone ? { scrollbarWidth: 'none' } : {}) }}>
                {BANKS.map((b) => {
                  const c = chipStyle(bank === b, false);
                  return <button key={b} type="button" role="radio" aria-checked={bank === b} onClick={() => setBank(b)} className="cp-chip" style={{ flex: 'none', height: 44, padding: '0 18px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter' }}>{b}</button>;
                })}
              </div>
              <div style={{ padding: 14, borderRadius: 18, background: '#F4F0EE', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <Cap>{t('family.comboVa')}</Cap>
                  <span style={{ fontSize: 20, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{va}</span>
                </div>
                <Button variant="secondary" size={44} icon="content_copy" onClick={copy}>{t('common.copy')}</Button>
              </div>
              <span className="cp-hide-phone" style={{ fontSize: 16, lineHeight: '24px', color: '#6A6967' }}>{t('family.autoConfirm')}</span>
              <button type="button" className="cp-btn" onClick={simulate} disabled={busy} style={{ height: 48, borderRadius: 999, border: '1px dashed #8A755B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('family.simPay')}</button>
            </>
          ) : null}
        </div>
      ) : null}

      {open.map((r) => (
        <div key={r.inv.id} style={fcard('18px', 12)} data-testid="open-invoice" data-invoice={r.inv.id} data-status={r.status}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={memberName(r.member)} tone={r.member.photoTone} src={memberPhoto(r.member)} size={48} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{memberName(r.member)}</span>
              <span className="cp-hide-phone" style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{planLine(r.member)}</span>
              {extraLine(r.member) ? <span style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }} data-testid="billing-extra">{extraLine(r.member)}</span> : null}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Cap>{fmt.fmonth(r.period, true)}</Cap>
              <span style={{ fontSize: 28, lineHeight: '34px', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{rp(r.balance)}</span>
              <span style={{ fontSize: 16, color: r.status === 'overdue' ? '#AF4B2F' : '#6A6967', lineHeight: 1.4 }}>{r.status === 'overdue' ? `${t('family.invOverdueSub', { d: fmt.fds(r.inv.dueDate) })} · ${r.inv.number}` : subOf(r)}</span>
            </div>
            <StatusBadge kind={badgeOf(r)} />
          </div>
          {r.inv.lines.length > 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lineText(r).map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #EFECEA', fontSize: 16, lineHeight: 1.4 }}>
                  <span>{l.k}</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.v}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {primaryOf(r.member.id) ? <Button size={48} icon="account_balance" onClick={() => setPay([r.inv.id])} style={{ flex: '1 1 180px' }}>{t('family.payOne')}</Button> : null}
            <Button variant="secondary" size={48} onClick={() => setDetail(r.inv.id)} style={{ flex: '1 1 120px' }}>{t('family.viewDetails')}</Button>
          </div>
        </div>
      ))}

      {payers.map((n) => (
        <div key={n} style={{ padding: '14px 16px', borderRadius: 18, background: '#F4F0EE', fontSize: 16, lineHeight: '24px' }} data-testid="payer-note">{t('family.payerNote', { n })}</div>
      ))}

      {hist.length ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }} data-testid="billing-history">
          <div style={{ padding: '16px 18px 10px' }}><Cap>{t('family.history')}</Cap></div>
          {hist.map((r) => (
            <button key={r.inv.id} type="button" onClick={() => setDetail(r.inv.id)} aria-label={t('family.viewInvoice', { no: r.inv.number })} className="h-row" data-history={r.inv.id}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 18px', border: 'none', borderTop: '1px solid #EFECEA', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter', minHeight: 64 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{fmt.fmonth(r.period, true)}{members.length > 1 ? ` · ${memberShort(r.member)}` : ''}</span>
                <span style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{subOf(r)}</span>
              </div>
              <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{rp(r.total)}</span>
              <StatusBadge kind={badgeOf(r)} small />
            </button>
          ))}
        </div>
      ) : null}

      <PaySheet invoiceIds={pay || []} open={!!pay} onClose={closePay} />
      {detail ? <InvoiceSheet invoiceId={detail} open onClose={closeDetail} audience="family" /> : null}
    </div>
  );
}
