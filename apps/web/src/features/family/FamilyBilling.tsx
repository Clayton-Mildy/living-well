// Round 8 (the "CitraPremier Family App" prototype): Billing, a page pushed from Me. One dark card with what is to pay (pay by virtual account when this
// contact is the payer, who looks after billing when not), then each parent's plan with its asks, then the invoices. An invoice opens its detail sheet.
// Round 8c, on a laptop the dark card is a 420px column on the left, Plans and Invoices the lists on the right. Round 8d: the sidebar has no Billing item any more
// (it is pushed from Me), so the "‹ Me" link shows on every width.
import { Fragment, useState, type ReactNode } from 'react';
import { memberName, displayName, paidDate, rp, type Bank, type Member } from '@cp/shared';
import { BANKS, combinedVa, historyRows, isOpenStatus, nextIssueDate, planSummary, type InvRow } from '@cp/shared/rules/family';
import { familyBill, rpShort } from '@cp/shared/rules/familyMe';
import { Avatar, Icon } from '../../components/ui';
import { useAct } from '../../lib/act';
import { memberPhoto } from '../../lib/media';
import { say } from '../../store/ui';
import { InvoiceSheet } from '../finance/InvoiceSheet';
import { BackLink, Cap, Cols, F, FamPage, HAIR, List, PageTitle, StatusDot, TextLink, useBack, useFamWide } from './kit';
import { PlanAsk } from './PlanCard';
import { useFamilyCtx, useFamilySel } from './useFamily';

const SAND = '#D9CDBF';
const ROW_PAGE = 6;
const ROW_PAGE_WIDE = 8; // a laptop has the room for a few more rows per page

export function FamilyBilling() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { all, choices } = useFamilySel();
  const act = useAct();
  const back = useBack('/me');
  const [bank, setBank] = useState<Bank>('BCA');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const wide = useFamWide();
  if (!user || !all.length) return null;
  const { today } = now;
  const b = familyBill(s, user.id, all, today);
  const plans = (choices.length ? choices : all).map((id) => s.members[id]).filter(Boolean) as Member[];
  // open invoices first (oldest due date first), then the paid ones, newest first
  const list: InvRow[] = [...b.open, ...historyRows(b.rows).filter((r) => !isOpenStatus(r.status))];
  const year = today.slice(0, 4);
  const limit = pages * (wide ? ROW_PAGE_WIDE : ROW_PAGE);

  // ----- the dark card -----
  const state = !b.rows.length ? 'empty' : !b.shown.length ? 'paid' : b.overdue ? 'overdue' : 'due';
  const nextDate = fmt.fd(nextIssueDate(s, today), { day: 'numeric', month: 'long' });
  const dueLine = state === 'empty' ? t('family.invNone') : state === 'paid' ? t('fme.nothingToPay')
    : state === 'overdue' ? t('fme.overdueDue', { d: fmt.fdl(b.firstDue!) }) : t('fme.toPayDue', { d: fmt.fdl(b.firstDue!) });
  const forLine = state === 'empty' ? t('fme.firstInvoice', { d: nextDate }) : state === 'paid' ? t('fme.nextInvoice', { d: nextDate })
    : b.shown.length === 1 ? t('fme.forOne', { n: displayName(b.shown[0].member), m: fmt.fmonth(b.shown[0].period) }) : t('fme.forMany', { n: b.shown.length });
  const va = b.payable.length ? combinedVa(b.payable.map((r) => r.inv.va), bank) : '';
  const copy = () => { try { void navigator.clipboard.writeText(va.replace(/\s/g, '')); } catch { /* clipboard blocked */ } say(t('family.copied')); };
  const simulate = async () => {
    if (busy || !b.payable.length) return;
    setBusy(true);
    try { await act('payment.simulateVa', { invoiceIds: b.payable.map((r) => r.inv.id), bank }, { ok: t('family.paidT', { n: user.contact.firstName }) }); } finally { setBusy(false); }
  };

  // ----- plans -----
  const planRow = (m: Member, i: number) => {
    const p = planSummary(s, m, today);
    const flex = p.plan === 'flex';
    const extra = flex && !p.ended ? (p.extra.length ? t(p.extra.length > 1 ? 'family.visitsExtraN' : 'family.visitsExtra', { n: p.extra.length, p: rp(p.price * p.extra.length), m: fmt.fmonth(p.invoiceMonth) })
      : p.left === 0 ? t('fme.nextExtra', { p: rp(p.price), m: fmt.fmonth(p.invoiceMonth) }) : '') : '';
    return (
      <div key={m.id} data-testid="plan-card" data-member={m.id} data-plan={p.plan} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderTop: i ? HAIR : 'none' }}>
        <Avatar name={memberName(m)} tone={m.photoTone} src={memberPhoto(m)} size={36} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{t('fme.planName', { n: displayName(m), p: t(flex ? 'family.planFlex' : 'family.planGold') })}</span>
          <span style={{ fontSize: 13, color: F.muted }} data-testid="plan-line">{p.ended ? t('fme.ended') : flex ? t('family.visitsUsed', { n: p.used, q: p.quota ?? 0, m: fmt.fmonth(p.month) }) : t('fme.anyOpenDay')}</span>
          {extra ? <span style={{ fontSize: 13, fontWeight: 500, color: F.ochre }} data-testid="extra-visits">{extra}</span> : null}
          <div style={{ marginTop: 4 }}><PlanAsk m={m} quiet={!b.pays} /></div>
        </div>
      </div>
    );
  };

  // ----- invoices -----
  const dm = (d: string) => fmt.fd(d, { day: 'numeric', month: 'short' }); // "28 Oct": short enough to keep the row on two lines
  const subOf = (r: InvRow) => (r.status === 'paid' ? t('family.histPaid', { no: r.inv.number, d: dm(paidDate(s, r.inv.id) || r.inv.issueDate) })
    : r.status === 'partial' ? `${r.inv.number} · ${t('family.partPaid', { a: rp(r.paid), t: rp(r.total) })}` : t('family.histDue', { no: r.inv.number, d: dm(r.inv.dueDate) }));
  const stOf = (r: InvRow) => (r.status === 'paid' ? { c: F.sage, l: t('status.paid') } : r.status === 'overdue' ? { c: F.rust, l: t('status.overdue') }
    : r.status === 'partial' ? { c: F.ochre, l: t('fme.partPaid') } : { c: F.rust, l: t('fme.due') });
  const invRow = (r: InvRow, i: number) => {
    const st = stOf(r);
    const title = `${displayName(r.member)} · ${fmt.fmonth(r.period, r.period.slice(0, 4) !== year)}`;
    return (
      <button key={r.inv.id} type="button" onClick={() => setDetail(r.inv.id)} className="cp-fam-press" data-testid="invoice-row" data-invoice={r.inv.id} data-status={r.status} data-history={r.inv.id}
        aria-label={`${title}, ${r.inv.number}`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 'none', borderTop: i ? HAIR : 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: F.text, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{title}</span>
          <span style={{ fontSize: 13, color: F.muted, overflowWrap: 'anywhere' }}>{subOf(r)}</span>
        </span>
        <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rpShort(r.status === 'paid' ? r.total : r.balance)}</span>
        <span style={{ flex: 'none', minWidth: 62, display: 'flex', justifyContent: 'flex-end' }}><StatusDot color={st.c} size={13}>{st.l}</StatusDot></span>
      </button>
    );
  };

  const card = (
      <div data-testid="billing-total" data-state={state} style={{ borderRadius: 26, background: F.ink, color: '#FFFFFF', padding: wide ? 24 : 20, display: 'flex', flexDirection: 'column', gap: wide ? 16 : 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: state === 'overdue' ? '#F2A58C' : SAND }} data-testid="billing-due-line">{dueLine}</span>
          <span style={{ fontSize: wide ? 44 : 40, lineHeight: 1.05, fontWeight: 300, letterSpacing: wide ? '-1.3px' : '-1.2px', fontVariantNumeric: 'tabular-nums' }} data-testid="open-total">{rp(b.total)}</span>
          <span style={{ fontSize: 13, color: SAND }}>{forLine}</span>
        </div>
        {b.payable.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="billing-pay">
            <div role="radiogroup" aria-label={t('family.bank')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BANKS.map((k) => {
                const on = bank === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setBank(k)} className="cp-press" data-bank={k}
                    style={{ height: 36, padding: '0 14px', border: 'none', borderRadius: 999, background: on ? '#FFFFFF' : 'rgba(255,255,255,.1)', color: on ? F.ink : '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>{k}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,.08)' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12, color: '#BBA88F', letterSpacing: '1px', fontWeight: 600 }}>{t('fme.vaLabel', { b: bank.toUpperCase() })}</span>
                <span style={{ fontSize: 19, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }} data-testid="va-number">{va}</span>
              </span>
              <button type="button" onClick={copy} className="cp-fill cp-press" style={{ flex: 'none', height: 36, padding: '0 14px', border: 'none', borderRadius: 999, background: '#FFFFFF', color: F.ink, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <Icon name="content_copy" size={18} color={F.ink} />{t('common.copy')}
              </button>
            </div>
            <button type="button" onClick={() => void simulate()} disabled={busy} className="cp-press" data-testid="simulate-pay"
              style={{ height: 44, borderRadius: 999, border: '1px dashed rgba(255,255,255,.4)', background: 'transparent', color: F.sand, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>{t('family.simPay')}</button>
          </div>
        ) : null}
        {b.payers.map((p) => <div key={p.id} style={{ fontSize: 14, lineHeight: '20px', color: SAND }} data-testid="payer-note">{t('family.payerNote', { n: p.name })}</div>)}
      </div>
  );

  const plansBlock = (
    <Block wide={wide} title={t('fme.plans')}>
      <List testId="billing-plans">{plans.map(planRow)}</List>
    </Block>
  );
  const invoicesBlock = list.length ? (
    <Block wide={wide} title={t('fme.invoices')}>
      <List testId="billing-invoices">{list.slice(0, limit).map(invRow)}</List>
      {list.length > limit ? <TextLink onClick={() => setPages(pages + 1)} testId="billing-more" style={{ alignSelf: 'center' }}>{t('fme.showMore')}</TextLink> : null}
    </Block>
  ) : null;

  // a laptop: what is to pay on the left (420px), the plans and the invoices on the right
  return (
    <FamPage testId="FamilyBilling" gap={wide ? 22 : 14} wide style={wide ? { maxWidth: 1100 } : undefined}>
      <BackLink label={t('nav.me')} onClick={back} />
      <PageTitle>{t('nav.billing')}</PageTitle>
      <Cols left="420px" right="1fr" gap={32}>
        {[<Fragment key="l">{card}{wide ? null : plansBlock}</Fragment>, <Fragment key="r">{wide ? plansBlock : null}{invoicesBlock}</Fragment>]}
      </Cols>

      {detail ? <InvoiceSheet invoiceId={detail} open onClose={() => setDetail(null)} audience="family" /> : null}
    </FamPage>
  );
}

/** A titled block; on a laptop its caption sits close to its list (the page's own gaps are wider there). */
function Block({ wide, title, children }: { wide: boolean; title: string; children: ReactNode }) {
  return wide
    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Cap>{title}</Cap>{children}</div>
    : <><Cap>{title}</Cap>{children}</>;
}
