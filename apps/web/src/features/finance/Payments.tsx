// Payments (design ScrPay): "Sync Xero now", tiles, the payment list with partial or full refunds, and the manual-payment form.
import { useMemo, useState } from 'react';
import { memberName, rp, ym } from '@cp/shared';
import { invoicePeriod, paymentsBoard, type PaymentView } from '@cp/shared/rules/finance';
import { Button, EmptyState, Eyebrow, PageHead, usePaged } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { PaymentForm, RefundForm } from './forms';
import { matches, methodLabel } from './lib';
import { Badge, HAIR, Hero, HeroHead, NumberTabs, PGroup, PagerBar, PillBtn, SearchField, hrow, prow, rowSub, rowTitle } from './parts';

export function Payments() {
  const s = useClub();
  const t = useT();
  const act = useAct();
  const { fmonth } = useFmt();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const [q, setQ] = useState('');
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const board = useMemo(() => paymentsBoard(s, today), [s, today]);

  const hits = useMemo(
    () => board.rows.filter((r) => matches(q, r.member ? memberName(r.member) : '', ...r.allocations.map((a) => a.invoiceId), r.p.ref, r.p.bank, s.familyContacts[r.allocations[0]?.invoice?.payerFamilyId || '']?.name)),
    [board.rows, q, s.familyContacts],
  );
  const paged = usePaged(hits, 15, q);
  const tiles: { id: string; label: string; value: number; sub: string; short?: string }[] = [
    { id: 'today', label: t('finance.pay.tileToday'), value: board.today.n, sub: rp(board.today.sum) },
    { id: 'month', label: t('finance.pay.tileMonth', { month: fmonth(ym(today)) }), value: board.month.n, sub: rp(board.month.sum) },
    { id: 'xero', label: t('finance.pay.tileXero'), value: board.xeroPending, sub: '', short: '' },
    { id: 'refunds', label: t('finance.pay.tileRefunds'), value: board.refunds.n, sub: rp(board.refunds.sum), short: rp(board.refunds.sum) },
  ];
  const sync = () => act('xero.sync', {}, { ok: t('finance.toast.xeroSynced') });

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 18 : 'clamp(18px, 2.8vw, 36px)' }}>
      <PageHead eyebrow={t('finance.pay.eyebrow')} title={t('nav.payments')}
        right={<Button variant="secondary" size={isPhone ? 44 : 48} icon="sync" onClick={sync} style={{ padding: '0 18px' }}>{t('finance.pay.sync')}</Button>} />

      <NumberTabs cols={isPhone ? 2 : 4} maxWidth={isPhone ? 480 : 820}
        items={tiles.map((x) => ({ key: x.id, testId: `pay-tile-${x.id}`, label: x.label, value: x.value, sub: (isPhone ? x.short ?? x.sub : x.sub) || undefined }))} />

      {isPhone ? (
        // round 6, phone: the search bar on its own, the payments as a grouped list, the manual-payment form as its own group
        <>
          <SearchField value={q} onChange={setQ} label={t('finance.pay.search')} placeholder={t('finance.pay.search')} />
          <PGroup title={t('finance.pay.listTitle')} meta={q && hits.length !== board.rows.length ? t('finance.bill.matches', { n: hits.length, of: board.rows.length }) : undefined} pad={0} gap={0}>
            {paged.rows.map((r, i) => <PaymentRow key={r.p.id} pv={r} first={i === 0} refunding={refundFor === r.p.id} onRefund={() => setRefundFor(r.p.id)} onClose={() => setRefundFor(null)} />)}
            {!hits.length ? <EmptyState icon={q ? 'search_off' : 'payments'} title={q ? t('common.noResults') : t('finance.pay.empty')} /> : null}
            <PagerBar paged={paged} label={t('finance.pay.listTitle')} />
          </PGroup>
          <PGroup title={t('finance.pay.manualTitle')}><PaymentForm /></PGroup>
        </>
      ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'flex-start' }}>
        <Hero style={{ flex: '1 1 480px' }}>
          <HeroHead title={t('finance.pay.listTitle')} right={<SearchField value={q} onChange={setQ} label={t('finance.pay.search')} placeholder={t('finance.pay.search')} width="min(240px, 100%)" />} />
          {q && hits.length !== board.rows.length ? <div style={{ fontSize: 13, color: '#6B6259', paddingBottom: 8 }}>{t('finance.bill.matches', { n: hits.length, of: board.rows.length })}</div> : null}
          {paged.rows.map((r) => <PaymentRow key={r.p.id} pv={r} refunding={refundFor === r.p.id} onRefund={() => setRefundFor(r.p.id)} onClose={() => setRefundFor(null)} />)}
          {!hits.length ? <div style={{ borderTop: HAIR }}><EmptyState icon={q ? 'search_off' : 'payments'} title={q ? t('common.noResults') : t('finance.pay.empty')} /></div> : null}
          <PagerBar paged={paged} label={t('finance.pay.listTitle')} />
        </Hero>
        <Hero visible style={{ flex: '0 1 400px', width: '100%', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Eyebrow>{t('finance.pay.manualTitle')}</Eyebrow>
          <PaymentForm />
        </Hero>
      </div>
      )}
    </div>
  );
}

function PaymentRow({ pv, refunding, onRefund, onClose, first }: { pv: PaymentView; refunding: boolean; onRefund: () => void; onClose: () => void; first?: boolean }) {
  const t = useT();
  const { fds, fmonth } = useFmt();
  const { today } = useNow();
  const { isPhone } = useDevice();
  const { p, member } = pv;
  const periods = Array.from(new Set(pv.allocations.map((a) => (a.invoice ? fmonth(invoicePeriod(a.invoice), true) : '')).filter(Boolean)));
  const numbers = pv.allocations.map((a) => a.invoiceId);
  const sub = [
    numbers.join(', ') || t('finance.pay.creditOnly'),
    periods.length === 1 ? periods[0] : '',
    methodLabel(t, p),
    p.ref ? t('finance.pay.ref', { ref: p.ref }) : '',
    pv.credit > 0 && numbers.length ? t('finance.pay.creditPart', { amount: rp(pv.credit) }) : '',
  ].filter(Boolean).join(' · ');
  // round 6, phone: name and amount, the what-it-paid line, then the date, a quiet Xero status and a Refund pill
  if (isPhone) {
    return (
      <div style={{ ...prow(first), display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ ...rowTitle, fontSize: 16, minWidth: 0 }}>{member ? memberName(member) : p.memberId}</span>
          <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, textAlign: 'right' }}>{p.foreign ? `${p.foreign.ccy} ${p.foreign.amount} · ` : ''}{rp(p.amount)}</span>
        </div>
        <span style={{ ...rowSub, fontSize: 13 }}>{sub}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 24 }}>
          <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{p.receivedOn === today ? t('common.today') : fds(p.receivedOn)}{p.receivedAt ? `, ${p.receivedAt}` : ''}</span>
          {p.xero === 'synced' ? <Badge kind="paid" label={t('finance.xero.synced')} /> : <Badge kind="pending" label={t('finance.xero.pending')} />}
          {pv.refundable > 0 && !refunding ? (
            <span style={{ marginLeft: 'auto' }}>
              <PillBtn label={`${t('finance.pay.refund')} ${member ? memberName(member) : ''} ${numbers.join(' ')}`.trim()} onClick={onRefund}>{t('finance.pay.refund')}</PillBtn>
            </span>
          ) : null}
        </div>
        {pv.refunds.map((r) => (
          <span key={r.id} style={{ fontSize: 13, color: '#9A3D24', lineHeight: 1.4 }}>
            {t('finance.pay.refundedLine', { amount: rp(r.amount), date: fds(r.createdAt.slice(0, 10)), reason: r.reason || t('finance.pay.noReason') })}{r.creditNote ? ` · ${t('finance.pay.creditNoteTag')}` : ''}
          </span>
        ))}
        {refunding ? <RefundForm pv={pv} onClose={onClose} /> : null}
      </div>
    );
  }
  return (
    <div style={{ ...hrow, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px 14px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={rowTitle}>{member ? memberName(member) : p.memberId}</span>
          <span style={rowSub}>{sub}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>{p.foreign ? `${p.foreign.ccy} ${p.foreign.amount} · ` : ''}{rp(p.amount)}</span>
            <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{p.receivedOn === today ? t('common.today') : fds(p.receivedOn)}{p.receivedAt ? `, ${p.receivedAt}` : ''}</span>
          </div>
          {p.xero === 'synced' ? <Badge kind="paid" label={t('finance.xero.synced')} /> : <Badge kind="pending" label={t('finance.xero.pending')} />}
        </div>
        {pv.refundable > 0 && !refunding ? (
          <button type="button" onClick={onRefund} aria-label={`${t('finance.pay.refund')} ${member ? memberName(member) : ''} ${numbers.join(' ')}`.trim()}
            style={{ height: 40, padding: '0 6px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('finance.pay.refund')}</button>
        ) : null}
      </div>
      {pv.refunds.map((r) => (
        <span key={r.id} style={{ fontSize: 14, color: '#9A3D24', lineHeight: 1.4 }}>
          {t('finance.pay.refundedLine', { amount: rp(r.amount), date: fds(r.createdAt.slice(0, 10)), reason: r.reason || t('finance.pay.noReason') })}{r.creditNote ? ` · ${t('finance.pay.creditNoteTag')}` : ''}
        </span>
      ))}
      {refunding ? <RefundForm pv={pv} onClose={onClose} /> : null}
    </div>
  );
}
