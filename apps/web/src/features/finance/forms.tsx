// Forms used in more than one place: record a payment, refund a payment, add an adjustment.
import { useEffect, useMemo, useState } from 'react';
import { balanceOf, memberShort, rp, sortBy, type Invoice } from '@cp/shared';
import { invoicePeriod, invoiceViews, type PaymentView } from '@cp/shared/rules/finance';
import { Button, Chip, Note, TextField, Toggle, chipStyle, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useAct } from '../../lib/act';
import { useFmt, useT } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { digits, matches } from './lib';
import { RpField, SearchField, dangerStrip, fieldLabel } from './parts';

const MANUAL = ['bankTransferSgd', 'revolut', 'cash', 'other'] as const;
type Manual = (typeof MANUAL)[number];

/** Record a payment received outside the virtual account. With `fixed`, the invoice is already chosen (invoice sheet). */
export function PaymentForm({ fixed, onDone }: { fixed?: Invoice; onDone?: () => void }) {
  const s = useClub();
  const t = useT();
  const { fmonth } = useFmt();
  const { today } = useNow();
  const act = useAct();
  const [q, setQ] = useState('');
  const [invId, setInvId] = useState<string | null>(fixed?.id ?? null);
  const [method, setMethod] = useState<Manual>('bankTransferSgd');
  const [amt, setAmt] = useState(fixed ? String(Math.max(0, balanceOf(s, fixed))) : '');
  const [ccy, setCcy] = useState<'SGD' | 'EUR'>('SGD');
  const [fx, setFx] = useState('');
  const [ref, setRef] = useState('');

  // every invoice that can still take a payment, whole list: search narrows it, nothing is cut off
  const open = useMemo(
    () => sortBy(invoiceViews(s, today).filter((v) => v.balance > 0), (v) => (v.member?.firstName || '') + v.inv.dueDate),
    [s, today],
  );
  const shown = open.filter((v) => matches(q, v.member ? `${v.member.title} ${v.member.firstName} ${v.member.lastName}` : '', v.inv.number, v.payer?.name));
  const sel = invId ? s.invoices[invId] : undefined;
  const balance = sel ? balanceOf(s, sel) : 0;
  const amount = digits(amt);
  const foreign = method === 'bankTransferSgd' || method === 'revolut';
  const needsRef = foreign;
  const ok = !!sel && amount > 0 && (!needsRef || !!ref.trim());
  const choose = (id: string) => { setInvId(id); setAmt(String(Math.max(0, balanceOf(s, s.invoices[id])))); };
  useEffect(() => { if (method === 'bankTransferSgd') setCcy('SGD'); }, [method]);

  const submit = async () => {
    if (!ok || !sel) return;
    const fxn = parseFloat(fx);
    const r = await act('payment.record', {
      memberId: sel.memberId, amount, method, invoiceId: sel.id, ...(ref.trim() ? { ref: ref.trim() } : {}), ...(foreign && fxn > 0 ? { foreign: { ccy, amount: fxn } } : {}),
    }, { ok: t('finance.toast.paymentRecorded', { name: memberShort(s.members[sel.memberId]) }) });
    if (r.ok) { if (!fixed) setInvId(null); setAmt(''); setRef(''); setFx(''); onDone?.(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!fixed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={fieldLabel}>{t('finance.pay.invoice')}</span>
          <SearchField value={q} onChange={setQ} label={t('finance.pay.findInvoice')} placeholder={t('finance.pay.findInvoice')} />
          <div role="radiogroup" aria-label={t('finance.pay.invoice')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 264, overflowY: 'auto', padding: 2 }}>
            {shown.map((v) => {
              const c = chipStyle(v.inv.id === invId, false);
              return (
                <button key={v.inv.id} type="button" role="radio" aria-checked={v.inv.id === invId} onClick={() => choose(v.inv.id)}
                  style={{ minHeight: 52, minWidth: 96, padding: '6px 14px', borderRadius: 16, border: c.bd, background: c.bg, color: c.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', fontFamily: 'Inter' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.4 }}>{v.member ? memberShort(v.member) : v.inv.memberId} · {fmonth(invoicePeriod(v.inv))}</span>
                  <span style={{ fontSize: FONT_SMALL, whiteSpace: 'nowrap', lineHeight: 1.4 }}>{rp(v.balance)}</span>
                </button>
              );
            })}
            {!shown.length ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, padding: '8px 4px' }}>{open.length ? t('common.noResults') : t('finance.pay.nothingOpen')}</span> : null}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={fieldLabel}>{t('finance.pay.paidBy')}</span>
        <div role="group" aria-label={t('finance.pay.paidBy')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MANUAL.map((m) => <Chip key={m} selected={method === m} onClick={() => setMethod(m)}>{t('finance.method.' + m)}</Chip>)}
        </div>
      </div>
      <RpField label={t('finance.pay.amountCredited')} ariaLabel={t('finance.pay.amountCredited')} value={amt} onChange={setAmt} hint={sel ? t('finance.pay.balanceHint', { amount: rp(balance) }) : undefined} />
      {sel && amount > balance ? <Note tone="ochre" icon="info">{t('finance.pay.overpay', { extra: rp(amount - balance) })}</Note> : null}
      {foreign ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {method === 'revolut' ? (
            <div role="group" aria-label={t('finance.pay.currency')} style={{ display: 'flex', gap: 8 }}>
              {(['SGD', 'EUR'] as const).map((c) => <Chip key={c} size={40} selected={ccy === c} onClick={() => setCcy(c)}>{c}</Chip>)}
            </div>
          ) : null}
          <RpField label={t('finance.pay.foreignAmount', { ccy })} ariaLabel={t('finance.pay.foreignAmount', { ccy })} prefix={ccy} decimal value={fx} onChange={setFx} placeholder="0.00" />
        </div>
      ) : null}
      <TextField label={t('finance.pay.reference')} value={ref} onChange={setRef} placeholder={needsRef ? t('finance.pay.refPlaceholder') : t('finance.pay.refOptional')} />
      <Button size={48} disabled={!ok} onClick={submit} full style={{ height: 52 }}>{t('finance.pay.record')}</Button>
    </div>
  );
}

/** Refund part or all of a payment, optionally with a credit note. Opens under the payment row or the invoice's payment line. */
export function RefundForm({ pv, invoiceId, onClose }: { pv: PaymentView; invoiceId?: string; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const choices = pv.allocations.filter((a) => a.refundable > 0 && (!invoiceId || a.invoiceId === invoiceId));
  const [invId, setInvId] = useState(choices[0]?.invoiceId || '');
  const cur = choices.find((a) => a.invoiceId === invId) || choices[0];
  const [amt, setAmt] = useState(String(cur?.refundable || ''));
  const [reason, setReason] = useState('');
  const [credit, setCredit] = useState(false);
  const amount = digits(amt);
  const max = cur?.refundable || 0;
  const ok = !!cur && amount > 0 && amount <= max && !!reason.trim();
  if (!cur) return null;
  const pick = (id: string) => { setInvId(id); setAmt(String(choices.find((a) => a.invoiceId === id)?.refundable || '')); };
  const submit = async () => {
    if (!ok) return;
    const r = await act('refund.record', { paymentId: pv.p.id, invoiceId: cur.invoiceId, amount, reason: reason.trim(), creditNote: credit }, { ok: t('finance.toast.refunded', { amount: rp(amount) }) });
    if (r.ok) onClose();
  };
  return (
    <div style={{ ...dangerStrip, flexDirection: 'column', gap: 12 }}>
      {choices.length > 1 ? (
        <div role="group" aria-label={t('finance.refund.invoice')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {choices.map((a) => <Chip key={a.invoiceId} size={40} selected={a.invoiceId === cur.invoiceId} onClick={() => pick(a.invoiceId)}>{a.invoiceId} · {rp(a.refundable)}</Chip>)}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <RpField ariaLabel={t('finance.refund.amount')} value={amt} onChange={setAmt} hint={t('finance.refund.upTo', { max: rp(max) })} />
        </div>
        <div style={{ flex: '2 1 220px', minWidth: 0 }}>
          <TextField value={reason} onChange={setReason} placeholder={t('finance.refund.reason')} name="refund-reason" hint={undefined} />
        </div>
      </div>
      <Toggle on={credit} onClick={() => setCredit(!credit)} label={t('finance.refund.creditNote')} sub={t('finance.refund.creditNoteSub')} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" size={48} onClick={onClose} style={{ padding: '0 18px' }}>{t('common.cancel')}</Button>
        <Button variant="danger" size={48} disabled={!ok} onClick={submit} style={{ padding: '0 20px' }}>{amount === max ? t('finance.refund.full') : t('finance.refund.partial', { amount: rp(amount) })}</Button>
      </div>
    </div>
  );
}

/** A charge or a credit on one invoice. */
export function AdjustForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const t = useT();
  const act = useAct();
  const [kind, setKind] = useState<'charge' | 'credit'>('charge');
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const amount = digits(amt);
  const ok = !!label.trim() && amount > 0;
  const submit = async () => {
    if (!ok) return;
    const r = await act('invoice.adjust', { invoiceId: invoice.id, label: label.trim(), amount: kind === 'credit' ? -amount : amount }, { ok: t('finance.toast.adjusted', { number: invoice.number }) });
    if (r.ok) { setLabel(''); setAmt(''); onDone(); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="group" aria-label={t('finance.adjust.kind')} style={{ display: 'flex', gap: 8 }}>
        <Chip selected={kind === 'charge'} onClick={() => setKind('charge')}>{t('finance.adjust.charge')}</Chip>
        <Chip selected={kind === 'credit'} onClick={() => setKind('credit')}>{t('finance.adjust.credit')}</Chip>
      </div>
      <TextField label={t('finance.adjust.label')} value={label} onChange={setLabel} placeholder={kind === 'charge' ? t('finance.adjust.chargeEx') : t('finance.adjust.creditEx')} maxLength={120} />
      <RpField label={t('finance.adjust.amount')} ariaLabel={t('finance.adjust.amount')} value={amt} onChange={setAmt} />
      <Button size={48} disabled={!ok} onClick={submit} full>{kind === 'charge' ? t('finance.adjust.addCharge') : t('finance.adjust.addCredit')}</Button>
    </div>
  );
}

