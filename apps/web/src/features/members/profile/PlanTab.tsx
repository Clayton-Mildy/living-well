// Plan and billing tab (design ScrProfile plan): plan facts, a pending upgrade request (Apply / Decline for finance and management),
// the membership state, and the invoices. Invoices open the invoice sheet; Xero status is for staff only.
import { useState } from 'react';
import {
  currentMembership, flexMonth, invoiceStatus, invoicesOf, invoiceTotal, live, memberSince, planOn, paidDate, primaryContact, priceOn, rp, sortBy, ym, membershipStatus, memberShort,
} from '@cp/shared';
import { formatVa, openBalance } from '@cp/shared/rules/members';
import { Button, FONT_BODY, FONT_SMALL, Icon, Pager, Sheet, StatusBadge, TextField, Note, usePaged } from '../../../components/ui';
import { say } from '../../../store/ui';
import { InvoiceSheet } from '../../finance/InvoiceSheet';
import { cardStyle, endReasonLabel, listCardStyle } from '../lib';
import { planText } from '../reviewDiff';
import { Fact, ListHead, PendingBanner } from './parts';
import type { P } from './types';

export function PlanTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const [inv, setInv] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const plan = planOn(m, today);
  const price = priceOn(s, today);
  const invoices = sortBy(invoicesOf(s, m.id), (i) => i.issueDate + i.number, -1);
  const pagedInv = usePaged(invoices, 6, m.id);
  const prim = primaryContact(s, m.id);
  const req = live(s.planChangeRequests).find((r) => r.memberId === m.id && r.status === 'pending');
  const finance = !p.family && (p.role === 'finance' || p.role === 'mgmt');
  const next = m.plans.find((x) => x.from > today);
  const cur = currentMembership(m);
  const life = membershipStatus(m, today);
  const balance = openBalance(s, m.id, today);
  const spouse = m.spouseId ? s.members[m.spouseId] : undefined;
  const fm = flexMonth(s, m, ym(today), today);
  const since = memberSince(m);
  const xeroLabel = (x: string) => t('profile.xero.' + x);
  const apply = async () => { if (req) await p.act('planChange.apply', { requestId: req.id }, { ok: t('profile.planApplied'), reviewText: t('profile.sentForReview') }); };
  const decline = async () => {
    if (!declining) return;
    const r = await p.act('planChange.decline', { requestId: declining, ...(note.trim() ? { note: note.trim() } : {}) }, { ok: t('profile.planDeclined') });
    if (r.ok && r.result.held) say(t('profile.sentForReview'), { icon: 'hourglass_top' });
    if (r.ok) { setDeclining(null); setNote(''); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PendingBanner p={p} tab="plan" />
      {req ? (
        <Note tone="ochre" icon="upgrade">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600 }}>{t('profile.upgradeAsked', { f: t('profile.plan.' + plan.plan), to: t('profile.plan.' + req.to), d: fmt.fds(req.from) })}</span>
            {finance && !p.m.deletedAt ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size={44} icon="check" onClick={apply}>{t('profile.applyRequest')}</Button>
                <Button size={44} variant="secondary" icon="close" onClick={() => { setDeclining(req.id); setNote(''); }}>{t('profile.declineRequest')}</Button>
              </div>
            ) : <span style={{ fontWeight: 400 }}>{p.family ? t('profile.upgradeWithClub') : t('profile.upgradeFinance')}</span>}
          </div>
        </Note>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ ...cardStyle, gap: 10 }}>
          <div style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px' }}>{t('profile.planCard')}</div>
          <div style={{ fontSize: 28, lineHeight: '36px', letterSpacing: '-0.5px', color: '#9A836C' }}>{plan.plan === 'flex' ? t('profile.planFlexTitle', { q: s.club.settings.flexQuota }) : t('profile.planGoldTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Fact k={t('profile.fee')} first>{rp(price[plan.plan])}</Fact>
            <Fact k={t('profile.visits')}>{plan.plan === 'flex' ? t('profile.visitsFlex', { q: s.club.settings.flexQuota }) : t('profile.visitsGold')}</Fact>
            <Fact k={t('profile.visitsMonth', { m: fmt.fmonth(ym(today)) })}>
              {fm.quota === null ? t('profile.visitsMonthGold', { n: fm.used }) : t(fm.extra ? (fm.extra === 1 ? 'profile.visitsMonthExtraOne' : 'profile.visitsMonthExtra') : 'profile.visitsMonthFlex', { n: Math.min(fm.used, fm.quota), q: fm.quota, x: fm.extra })}
            </Fact>
            {plan.plan === 'flex' ? <Fact k={t('profile.extraDay')}>{t('profile.extraDayVal', { p: rp(price.extra) })}</Fact> : null}
            <Fact k={t('profile.billingContact')}>{prim ? prim.name : '—'}</Fact>
            <Fact k={t('profile.va')}>{m.billing.va ? formatVa(m.billing.va) : t('profile.vaLater')}</Fact>
            <Fact k={t('profile.since')}>{since ? fmt.fmonth(ym(since), true) : '—'}</Fact>
            {next ? <Fact k={t('profile.nextChange')}>{`${planText(t, next)} · ${t('profile.fromDate', { d: fmt.fdy(next.from) })}`}</Fact> : null}
            {spouse ? <Fact k={t('profile.couple')}>{t('profile.coupleVal', { n: prim?.firstName || t('profile.theBilling'), s: memberShort(spouse) })}</Fact> : null}
            {balance > 0 ? <Fact k={t('profile.balance')}><strong style={{ fontWeight: 600 }}>{rp(balance)}</strong></Fact> : null}
            {cur.lastDay ? <Fact k={t('profile.membership')}>{life === 'ended' ? t('profile.endedOn', { d: fmt.fdy(cur.lastDay) }) : t('profile.endsOn', { d: fmt.fdy(cur.lastDay) })}{cur.endReason ? ` · ${endReasonLabel(t, cur.endReason)}` : ''}</Fact> : null}
          </div>
        </div>
        <div style={listCardStyle}>
          <ListHead title={t('profile.invoices')} meta={p.family ? t('profile.invoicesMetaFamily') : t('profile.invoicesMeta')} />
          {pagedInv.rows.map((i) => {
            const st = invoiceStatus(s, i, today);
            const titleText = i.kind === 'final' ? t('profile.finalInvoice') : i.period ? fmt.fmonth(i.period, true) : i.number;
            const subText = `${i.number} · ${st === 'paid' ? t('profile.paidOn', { d: fmt.fds(paidDate(s, i.id) || i.issueDate) }) : t('profile.dueOn', { d: fmt.fds(i.dueDate) })}${p.family ? '' : ' · ' + xeroLabel(i.xero)}`;
            return (
              <button key={i.id} type="button" onClick={() => setInv(i.id)} className="h-row" aria-label={`${titleText} ${i.number}`} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', padding: '12px 20px', border: 'none', borderTop: '1px solid #EFECEA', background: '#FFFFFF', minHeight: 64, textAlign: 'left', cursor: 'pointer', color: '#282828', fontFamily: 'Inter' }}>
                <div style={{ flex: '1 1 150px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{titleText}</span>
                  <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{subText}</span>
                </div>
                {/* the amount, the status and the chevron stay together; on a narrow phone they drop under the title instead of squeezing it */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flex: 'none', marginLeft: 'auto' }}>
                  <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{rp(invoiceTotal(i))}</span>
                  <StatusBadge kind={st === 'partial' ? 'partial' : st} small />
                  <Icon name="chevron_right" size={20} color="#75624B" />
                </span>
              </button>
            );
          })}
          {!invoices.length ? <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.noInvoices')}</div> : null}
          {pagedInv.pages > 1 ? <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #EFECEA' }}><Pager page={pagedInv.page} pages={pagedInv.pages} onPage={pagedInv.setPage} label={t('profile.pagerInvoices')} /></div> : null}
          {invoices.length && balance > 0 ? <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #EFECEA', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.openStayPayable')}</div> : null}
        </div>
      </div>
      {inv ? <InvoiceSheet invoiceId={inv} open onClose={() => setInv(null)} audience={p.family ? 'family' : 'staff'} /> : null}
      <Sheet open={!!declining} onClose={() => setDeclining(null)} title={t('profile.declineTitle')}
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => setDeclining(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={decline}>{t('profile.declineRequest')}</Button></div>}>
        <TextField label={t('profile.declineNote')} value={note} onChange={setNote} multiline rows={3} hint={t('profile.declineHint')} />
      </Sheet>
    </div>
  );
}
