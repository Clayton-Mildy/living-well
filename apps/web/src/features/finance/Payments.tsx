// Payments (design ScrPay): "Sync Xero now", tiles, the payment list with partial or full refunds, and the manual-payment form.
import { useMemo, useState } from 'react';
import { memberName, rp, ym } from '@cp/shared';
import { invoicePeriod, paymentsBoard, type PaymentView } from '@cp/shared/rules/finance';
import { Button, Card, CardHead, EmptyState, PageHead, usePaged, FONT_BODY } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useAct } from '../../lib/act';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { PaymentForm, RefundForm } from './forms';
import { matches, methodLabel } from './lib';
import { Badge, PagerBar, SearchField, caps } from './parts';

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
    { id: 'xero', label: t('finance.pay.tileXero'), value: board.xeroPending, sub: t('finance.pay.xeroSub'), short: '' },
    { id: 'refunds', label: t('finance.pay.tileRefunds'), value: board.refunds.n, sub: `${rp(board.refunds.sum)} · ${t('finance.pay.refundsSub')}`, short: rp(board.refunds.sum) },
  ];
  const sync = () => act('xero.sync', {}, { ok: t('finance.toast.xeroSynced') });

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20, maxWidth: 1180 }}>
      <PageHead eyebrow={t('finance.pay.eyebrow')} title={t('nav.payments')}
        right={<Button variant="secondary" size={48} icon="sync" onClick={sync} style={{ padding: '0 18px' }}>{t('finance.pay.sync')}</Button>} />

      <div className="cp-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {tiles.map((x) => (
          <div key={x.id} data-testid={`pay-tile-${x.id}`} className="cp-tile" style={{ padding: '16px 18px', borderRadius: 20, background: '#FFFFFF', border: '1px solid #DBD7D6', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{x.label}</span>
            <span className="cp-tile-n" style={{ fontSize: 32, lineHeight: '36px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{x.value}</span>
            {(isPhone ? x.short ?? x.sub : x.sub) ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{isPhone ? x.short ?? x.sub : x.sub}</span> : null}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <Card>
            <CardHead title={t('finance.pay.listTitle')} meta={q && hits.length !== board.rows.length ? t('finance.bill.matches', { n: hits.length, of: board.rows.length }) : t('finance.pay.newest')} />
            <div style={{ padding: '0 20px 12px' }}><SearchField value={q} onChange={setQ} label={t('finance.pay.search')} placeholder={t('finance.pay.search')} /></div>
            {paged.rows.map((r) => <PaymentRow key={r.p.id} pv={r} refunding={refundFor === r.p.id} onRefund={() => setRefundFor(r.p.id)} onClose={() => setRefundFor(null)} />)}
            {!hits.length ? <div style={{ borderTop: '1px solid #EFECEA' }}><EmptyState icon={q ? 'search_off' : 'payments'} title={q ? t('common.noResults') : t('finance.pay.empty')} /></div> : null}
            <PagerBar paged={paged} label={t('finance.pay.listTitle')} />
          </Card>
        </div>
        <div style={{ flex: '1 1 360px', minWidth: 0, background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={caps}>{t('finance.pay.manualTitle')}</span>
          <div className="cp-hide-phone" style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{t('finance.pay.manualSub')}</div>
          <PaymentForm />
        </div>
      </div>
    </div>
  );
}

function PaymentRow({ pv, refunding, onRefund, onClose }: { pv: PaymentView; refunding: boolean; onRefund: () => void; onClose: () => void }) {
  const t = useT();
  const { fds, fmonth } = useFmt();
  const { today } = useNow();
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', borderTop: '1px solid #EFECEA' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{member ? memberName(member) : p.memberId}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{sub}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{p.foreign ? `${p.foreign.ccy} ${p.foreign.amount} · ` : ''}{rp(p.amount)}</span>
          <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{p.receivedOn === today ? t('common.today') : fds(p.receivedOn)}{p.receivedAt ? `, ${p.receivedAt}` : ''}</span>
        </div>
        {p.xero === 'synced' ? <Badge kind="paid" label={t('finance.xero.synced')} /> : <Badge kind="pending" label={t('finance.xero.pending')} />}
        {pv.refundable > 0 && !refunding ? (
          <button type="button" onClick={onRefund} aria-label={`${t('finance.pay.refund')} ${member ? memberName(member) : ''} ${numbers.join(' ')}`.trim()}
            style={{ height: 44, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: '#75624B', fontSize: FONT_BODY, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('finance.pay.refund')}</button>
        ) : null}
      </div>
      {pv.refunds.map((r) => (
        <span key={r.id} style={{ fontSize: FONT_BODY, color: '#AF4B2F', lineHeight: 1.4 }}>
          {t('finance.pay.refundedLine', { amount: rp(r.amount), date: fds(r.createdAt.slice(0, 10)), reason: r.reason || t('finance.pay.noReason') })}{r.creditNote ? ` · ${t('finance.pay.creditNoteTag')}` : ''}
        </span>
      ))}
      {refunding ? <RefundForm pv={pv} onClose={onClose} /> : null}
    </div>
  );
}

