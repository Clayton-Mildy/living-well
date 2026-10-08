// Plan and billing tab (design ScrProfile plan): plan facts, a pending upgrade request (Apply / Decline for finance and management),
// the membership state, and the invoices. Invoices open the invoice sheet; Xero status is for staff only.
import { useState } from 'react';
import {
  currentMembership, flexMonth, invoiceStatus, invoicesOf, invoiceTotal, live, memberSince, planOn, paidDate, primaryContact, priceOn, rp, sortBy, ym, membershipStatus, memberShort, suspensionOf,
} from '@cp/shared';
import { formatVa, openBalance } from '@cp/shared/rules/members';
import { Button, Group, Icon, Pager, SectionLabel, Sheet, StatusBadge, TextField, Note, usePaged } from '../../../components/ui';
import { say } from '../../../store/ui';
import { InvoiceSheet } from '../../finance/InvoiceSheet';
import { useLeaveUi } from '../../family/LeaveSection';
import { cardStyle, endReasonLabel, HAIR } from '../lib';
import { planText } from '../reviewDiff';
import { Fact, ListCard, PendingBanner } from './parts';
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
  // KC round 6 (the brochure's terms): finance and management record a month of leave the family asked for in writing; an unpaid invoice puts the membership on hold
  const leave = useLeaveUi({ s, m, today, t, fmt, act: p.act, canEdit: finance && !m.deletedAt, staff: true });
  const hold = suspensionOf(s, m.id, today);
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
  const planTitle = (
    <div style={{ fontSize: 26, lineHeight: '34px', letterSpacing: '-0.5px', color: '#2B231C' }}>{plan.plan === 'flex' ? t('profile.planFlexTitle', { q: s.club.settings.flexQuota }) : t('profile.planGoldTitle')}</div>
  );
  const facts = (
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
  );
  const leaveBlock = leave.rows || leave.button ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 4px', borderTop: HAIR }} data-testid="plan-leave">
      {leave.rows}
      {leave.button ? <div>{leave.button}</div> : null}
    </div>
  ) : null;
  const ph = p.isPhone; // round 6, phone (staff and family): the plan and the invoices are iOS grouped sections
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ph ? 14 : 16 }}>
      <PendingBanner p={p} tab="plan" />
      {hold ? (
        <Note tone="rust" icon="pause_circle">
          <span data-testid="plan-hold" style={{ fontWeight: 500 }}>{t(hold.told ? 'family.onHoldTold' : 'family.onHold', { no: hold.number, a: rp(hold.balance), n: memberShort(m), d: fmt.fds(hold.stopOn) })}</span>
        </Note>
      ) : null}
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
      <div style={ph ? { display: 'flex', flexDirection: 'column', gap: 14 } : { display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px, 3vw, 36px)', alignItems: 'flex-start' }}>
        {ph ? <Group title={t('profile.planCard')} pad="14px 16px 12px" gap={8}>{planTitle}{facts}{leaveBlock}</Group> : (
          <div style={{ ...cardStyle, flex: '1 1 380px', minWidth: 0, gap: 8 }}>
            <SectionLabel>{t('profile.planCard')}</SectionLabel>
            {planTitle}
            {facts}
            {leaveBlock}
          </div>
        )}
        <ListCard phone={ph} title={t('profile.invoices')} style={{ flex: '1 1 420px', minWidth: 0 }}>
          {pagedInv.rows.map((i, ix) => {
            const st = invoiceStatus(s, i, today);
            const titleText = i.kind === 'final' ? t('profile.finalInvoice') : i.period ? fmt.fmonth(i.period, true) : i.number;
            const subText = `${i.number} · ${st === 'paid' ? t('profile.paidOn', { d: fmt.fds(paidDate(s, i.id) || i.issueDate) }) : t('profile.dueOn', { d: fmt.fds(i.dueDate) })}${p.family ? '' : ' · ' + xeroLabel(i.xero)}`;
            return (
              <button key={i.id} type="button" onClick={() => setInv(i.id)} className="h-row cp-bleed" aria-label={`${titleText} ${i.number}`} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', padding: '14px 0', border: 'none', borderTop: ph && !ix ? 'none' : HAIR, background: '#FFFFFF', minHeight: 64, textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
                <div style={{ flex: '1 1 150px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{titleText}</span>
                  <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{subText}</span>
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
          {!invoices.length ? <div style={{ padding: ph ? '14px 0' : '14px 0 20px', borderTop: ph ? 'none' : HAIR, fontSize: 15, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.noInvoices')}</div> : null}
          {pagedInv.pages > 1 ? <div style={{ padding: '12px 0 16px', borderTop: HAIR }}><Pager page={pagedInv.page} pages={pagedInv.pages} onPage={pagedInv.setPage} label={t('profile.pagerInvoices')} /></div> : null}
        </ListCard>
      </div>
      {leave.sheet}
      {inv ? <InvoiceSheet invoiceId={inv} open onClose={() => setInv(null)} audience={p.family ? 'family' : 'staff'} /> : null}
      <Sheet open={!!declining} onClose={() => setDeclining(null)} title={t('profile.declineTitle')}
        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => setDeclining(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={decline}>{t('profile.declineRequest')}</Button></div>}>
        <TextField label={t('profile.declineNote')} value={note} onChange={setNote} multiline rows={3} hint={t('profile.declineHint')} />
      </Sheet>
    </div>
  );
}
