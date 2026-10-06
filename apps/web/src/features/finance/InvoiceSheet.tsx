// Invoice detail: lines, payments, refunds, status, due date and virtual account.
// Staff (finance, management, and the profile's Plan tab): adjust or credit, void with a reason, remind, call notes, record a payment, refund.
// Family: the payer (primary contact) can pay by virtual account; the demo button simulates the bank's confirmation.
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { actorName, fmtPhone, isPrimaryFor, memberName, rp, sortBy, live, type Bank, type Invoice } from '@cp/shared';
import { BANKS, bankVa, groupVa, invoicePeriod, invoiceView, paymentView, refundsOfInvoice } from '@cp/shared/rules/finance';
import { Avatar, Button, Chip, Drawer, Eyebrow, Icon, Note, Sheet, StatusBadge, TextField, FONT_BODY, FONT_SMALL } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { copyText, lineLabel, methodLabel, money, stampOf } from './lib';
import { AdjustForm, PaymentForm, RefundForm } from './forms';
import { Badge, caps } from './parts';
import { memberPhoto } from '../../lib/media';

export function InvoiceSheet({ invoiceId, open, onClose, audience }: { invoiceId: string; open: boolean; onClose: () => void; audience: 'staff' | 'family' }) {
  const s = useClub();
  const t = useT();
  const { fmonth } = useFmt();
  const { isPhone } = useDevice();
  const inv = open ? s?.invoices[invoiceId] : undefined;
  if (!open || !inv) return null;
  const title = audience === 'family' ? t('family.invL', { p: fmonth(invoicePeriod(inv), true) }) : t('finance.inv.title', { number: inv.number });
  const body = <InvoiceBody inv={inv} audience={audience} onClose={onClose} />;
  if (audience === 'staff' && !isPhone) {
    return (
      <Drawer open onClose={onClose} label={title} width={480}>
        <h2 style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{title}</h2>
        {body}
      </Drawer>
    );
  }
  return <Sheet open onClose={onClose} title={title}>{body}</Sheet>;
}

const Section = ({ label, meta, children }: { label: ReactNode; meta?: ReactNode; children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span style={caps}>{label}</span>
      {meta ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{meta}</span> : null}
    </div>
    {children}
  </div>
);
const panel = { border: '1px solid #DBD7D6', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 } as const;

function InvoiceBody({ inv, audience, onClose }: { inv: Invoice; audience: 'staff' | 'family'; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const { fds, fdy, fmonth } = useFmt();
  const { today } = useNow();
  const { user, role } = useMe();
  const act = useAct();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const staff = audience === 'staff';
  // only finance and management act on invoices (the server enforces it; other staff just read the invoice)
  const canAct = staff && (role === 'finance' || role === 'mgmt');
  const [bank, setBank] = useState<Bank>('BCA');
  const [panelOpen, setPanel] = useState<null | 'pay' | 'adjust' | 'void'>(null);
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const v = invoiceView(s, inv, today);
  const m = v.member;
  const isOpen = v.balance > 0 && !inv.voided;
  const pays = sortBy(live(s.payments).filter((p) => p.allocations.some((a) => a.invoiceId === inv.id)), (p) => `${p.receivedOn}T${p.receivedAt || ''}${p.createdAt}`, -1).map((p) => paymentView(s, p));
  const refunds = refundsOfInvoice(s, inv.id);
  const primary = !staff && user?.kind === 'family' && isPrimaryFor(s, user.id, inv.memberId);
  const payerName = v.payer?.name || '';
  const va = bankVa(bank, inv.va);
  const timeline = sortBy([...inv.callNotes.map((c) => ({ at: c.at, by: c.by, text: c.text })), ...inv.reminders.map((r) => ({ at: r.at, by: r.by, text: t('finance.bill.reminderSent') }))], (x) => x.at, -1);
  const lastReminder = inv.reminders.length ? inv.reminders[inv.reminders.length - 1] : undefined;

  const copy = async () => say((await copyText(va)) ? t('family.copied') : t('finance.toast.copyFailed'));
  const simulate = async () => {
    const r = await act('payment.simulateVa', { invoiceIds: [inv.id], bank }, { ok: t('family.paidT', { n: v.payer?.firstName || payerName }) });
    if (r.ok) onClose();
  };
  const remind = () => act('invoice.remind', { invoiceId: inv.id }, { ok: (r) => t('finance.toast.reminder', { name: String(r.to || payerName) }) });
  const saveNote = async () => {
    if (!note.trim()) return;
    const r = await act('invoice.callNote', { invoiceId: inv.id, text: note.trim() }, { ok: t('finance.toast.noteSaved') });
    if (r.ok) setNote('');
  };
  const voidIt = async () => {
    if (!reason.trim()) return;
    const r = await act('invoice.void', { invoiceId: inv.id, reason: reason.trim() }, { ok: t('finance.toast.voided', { number: inv.number }) });
    if (r.ok) { setPanel(null); setReason(''); }
  };
  const toggle = (p: 'pay' | 'adjust' | 'void') => setPanel(panelOpen === p ? null : p);

  const statusDate = v.status === 'paid' ? t('finance.inv.paidOn', { date: fdy(paidDateOf(v.inv, pays) || today) }) : t('finance.inv.dueOn', { date: fdy(inv.dueDate) });
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={m ? memberName(m) : inv.memberId} tone={m?.photoTone} src={memberPhoto(m)} size={48} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4 }}>{m ? memberName(m) : inv.memberId}</span>
          <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{inv.number} · {fmonth(invoicePeriod(inv), true)}</span>
        </div>
        <StatusBadge kind={v.status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={caps}>{inv.voided ? t('finance.inv.voidedOn', { date: fdy(inv.voided.at.slice(0, 10)) }) : statusDate}</span>
          <span style={{ fontSize: 28, lineHeight: '34px', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', textDecoration: inv.voided ? 'line-through' : undefined }}>{rp(v.total)}</span>
          {!inv.voided && v.paid > 0 && v.balance > 0 ? <span style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.inv.balanceLeft', { paid: rp(v.paid), balance: rp(v.balance) })}</span> : null}
          {inv.releasedEarly && staff ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.inv.releasedEarly', { date: fds(inv.issueDate) })}</span> : <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.inv.issued', { date: fds(inv.issueDate) })}</span>}
        </div>
        {staff && payerName ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 0 }}>
            <span style={caps}>{t('finance.inv.billTo')}</span>
            <span style={{ fontSize: 16, lineHeight: 1.4, textAlign: 'right' }}>{payerName}</span>
            {v.payer?.phone ? <a href={`tel:${v.payer.phone}`} style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>{fmtPhone(v.payer.phone)}</a> : null}
          </div>
        ) : null}
      </div>
      {inv.voided ? <Note tone="cream" icon="block">{t('finance.inv.voidReason', { reason: inv.voided.reason, name: actorName(s, inv.voided.by) })}</Note> : null}
      {staff && m && !pathname.startsWith('/members/') ? (
        <div><Button variant="quiet" size={44} icon="person" onClick={() => { onClose(); navigate(`/members/${m.id}/plan`); }}>{t('finance.inv.openProfile')}</Button></div>
      ) : null}

      <Section label={t('finance.inv.lines')}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {inv.lines.map((l) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #EFECEA', fontSize: 16, lineHeight: 1.4 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span>{lineLabel(t, fmonth, l)}</span>
                {l.dates?.length ? <span style={{ fontSize: FONT_BODY, color: '#6A6967' }}>{l.dates.map(fds).join(' · ')}</span> : null}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: l.amount < 0 ? '#3D6B4F' : undefined }}>{money(l.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0 2px', borderTop: '1px solid #DBD7D6', fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
            <span>{t('finance.inv.total')}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(v.total)}</span>
          </div>
          {v.paid > 0 && !inv.voided ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 16, lineHeight: 1.4 }}><span>{t('finance.inv.paid')}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(-v.paid)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}><span>{t('finance.inv.balance')}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(Math.max(0, v.balance))}</span></div>
            </>
          ) : null}
        </div>
      </Section>

      {primary && isOpen ? (
        <Section label={t('family.sPay')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 16, lineHeight: 1.4 }}>{t('family.invL', { p: fmonth(invoicePeriod(inv), true) })} · {inv.number}</span>
            <span style={{ fontSize: 26, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(v.balance)}</span>
          </div>
          <BankPicker bank={bank} onBank={setBank} label={t('family.bank')} />
          <VaBox label={`${t('family.vaNumber')} · DOKU`} va={groupVa(va)} onCopy={copy} copyLabel={t('common.copy')} big />
          <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('family.autoConfirm')}</div>
          <button type="button" onClick={simulate} style={{ height: 48, borderRadius: 999, border: '1px dashed #8A755B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>{t('family.simPay')}</button>
        </Section>
      ) : null}
      {!staff && !primary && isOpen ? (
        <>
          <VaBox label={`${t('family.vaNumber')} · DOKU`} va={groupVa(va)} onCopy={copy} copyLabel={t('common.copy')} />
          <Note tone="cream" icon="info">{t('family.billingBy', { n: payerName || t('finance.inv.theContact'), m: m ? m.firstName : '' })}</Note>
        </>
      ) : null}
      {canAct && isOpen ? (
        <Section label={t('finance.inv.va')}>
          <BankPicker bank={bank} onBank={setBank} label={t('family.bank')} />
          <VaBox label={`${t('family.vaNumber')} · DOKU`} va={groupVa(va)} onCopy={copy} copyLabel={t('common.copy')} />
        </Section>
      ) : null}

      {pays.length || refunds.length ? (
        <Section label={t('finance.inv.payments')}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pays.map((pv) => {
              const a = pv.allocations.find((x) => x.invoiceId === inv.id)!;
              const rf = pv.refunds.filter((r) => r.invoiceId === inv.id);
              return (
                <div key={pv.p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: '1px solid #EFECEA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 16, lineHeight: 1.4 }}>{methodLabel(t, pv.p)}{pv.p.foreign ? ` · ${pv.p.foreign.ccy} ${pv.p.foreign.amount}` : ''}</span>
                      <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{fds(pv.p.receivedOn)}{pv.p.receivedAt ? `, ${pv.p.receivedAt}` : ''}{pv.p.ref ? ` · ${t('finance.pay.ref', { ref: pv.p.ref })}` : ''}</span>
                    </div>
                    <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(a.amount)}</span>
                    {canAct ? <Badge kind={pv.p.xero === 'synced' ? 'paid' : 'pending'} label={t(pv.p.xero === 'synced' ? 'finance.xero.synced' : 'finance.xero.pending')} /> : null}
                    {canAct && a.refundable > 0 && refundFor !== pv.p.id ? (
                      <button type="button" onClick={() => setRefundFor(pv.p.id)} style={{ height: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4 }}>{t('finance.pay.refund')}</button>
                    ) : null}
                  </div>
                  {rf.map((r) => (
                    <span key={r.id} style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>
                      {t('finance.pay.refundedLine', { amount: rp(r.amount), date: fds(r.createdAt.slice(0, 10)), reason: r.reason || t('finance.pay.noReason') })}{r.creditNote ? ` · ${t('finance.pay.creditNoteTag')}` : ''}
                    </span>
                  ))}
                  {canAct && refundFor === pv.p.id ? <RefundForm pv={pv} invoiceId={inv.id} onClose={() => setRefundFor(null)} /> : null}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {canAct && !inv.voided ? (
        <Section label={t('finance.inv.actions')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {isOpen ? <Button variant="secondary" size={44} icon="payments" onClick={() => toggle('pay')} style={{ padding: '0 16px' }}>{t('finance.inv.recordPayment')}</Button> : null}
            <Button variant="secondary" size={44} icon="edit_note" onClick={() => toggle('adjust')} style={{ padding: '0 16px' }}>{t('finance.inv.adjust')}</Button>
            {isOpen ? <Button variant="secondary" size={44} icon="notifications" onClick={remind} style={{ padding: '0 16px' }}>{t('finance.inv.remind')}</Button> : null}
            <Button variant="quiet" size={44} icon="block" onClick={() => toggle('void')} style={{ padding: '0 16px' }}>{t('finance.inv.void')}</Button>
          </div>
          {panelOpen === 'pay' ? <div style={panel}><PaymentForm fixed={inv} onDone={() => setPanel(null)} /></div> : null}
          {panelOpen === 'adjust' ? <div style={panel}><AdjustForm invoice={inv} onDone={() => setPanel(null)} /></div> : null}
          {panelOpen === 'void' ? (
            <div style={panel}>
              {v.paid > 0 ? (
                <Note tone="ochre" icon="info">{t('finance.inv.voidPaid')}</Note>
              ) : (
                <>
                  <Note tone="cream" icon="info">{t('finance.inv.voidHelp')}</Note>
                  <TextField label={t('finance.inv.voidWhy')} value={reason} onChange={setReason} maxLength={300} placeholder={t('finance.inv.voidEx')} />
                  <Button variant="danger" size={48} disabled={!reason.trim()} onClick={voidIt} full>{t('finance.inv.voidConfirm')}</Button>
                </>
              )}
            </div>
          ) : null}
        </Section>
      ) : null}

      {canAct ? (
        <Section label={t('finance.inv.callNotes')} meta={lastReminder ? t('finance.bill.lastReminder', { when: stampOf(lastReminder.at, fds) }) : undefined}>
          {timeline.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 14, background: '#F4F0EE', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, lineHeight: '22px' }}>{c.text}</span>
              <span style={{ fontSize: FONT_SMALL, color: '#6A6967', lineHeight: 1.4 }}>{actorName(s, c.by)} · {stampOf(c.at, fds)}</span>
            </div>
          ))}
          {!timeline.length ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('finance.inv.noNotes')}</span> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}><TextField value={note} onChange={setNote} placeholder={t('finance.bill.notePlaceholder')} name="invoice-call-note" onEnter={saveNote} /></div>
            <Button variant="secondary" size={48} onClick={saveNote} style={{ padding: '0 18px' }}>{t('finance.bill.saveNote')}</Button>
          </div>
        </Section>
      ) : null}
      {staff && !inv.voided && !isOpen && v.status === 'paid' ? <Eyebrow>{t('finance.inv.settled')}</Eyebrow> : null}
    </>
  );
}

const paidDateOf = (_inv: Invoice, pays: ReturnType<typeof paymentView>[]) => pays.map((p) => p.p.receivedOn).sort().pop();

function BankPicker({ bank, onBank, label }: { bank: Bank; onBank: (b: Bank) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {BANKS.map((b) => <Chip key={b} selected={bank === b} onClick={() => onBank(b)}>{b}</Chip>)}
    </div>
  );
}
function VaBox({ label, va, onCopy, copyLabel, big }: { label: string; va: string; onCopy: () => void; copyLabel: string; big?: boolean }) {
  return (
    <div style={{ padding: big ? 16 : 14, borderRadius: 18, background: '#F4F0EE', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={caps}>{label}</span>
        <span data-testid="va-number" style={{ fontSize: big ? 24 : 20, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{va}</span>
      </div>
      <button type="button" onClick={onCopy} style={{ height: 44, padding: '0 16px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <Icon name="content_copy" size={18} />{copyLabel}
      </button>
    </div>
  );
}
