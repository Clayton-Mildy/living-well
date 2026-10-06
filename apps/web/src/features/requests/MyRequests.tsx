// "My requests": stock, budget and receipt requests I sent, with status, and edit or cancel while they are still pending.
import { useMemo, useState } from 'react';
import { fmtN, live, parseN, rp, type BudgetRequest, type Receipt, type StockRequest } from '@cp/shared';
import { canEditStock, canReceiveStock } from '@cp/shared/rules/kitchenOps';
import { Button, Card, CardHead, ChipGroup, Dialog, EmptyState, Icon, Pager, TextField, usePaged, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { BadgePill, ConfirmDialog, OutlineButton, StockBadge, TextButton, useResetOn } from '../kitchen/parts';
import { StockEditDialog } from '../kitchen/Stock';
import { areaLabel, unitLabel, useQty } from '../kitchen/StockForm';
import { budgetCancelInput, budgetEditInput, hasAction, receiptEditInput, receiptVoidInput, sectionName, sectionsOf } from './finance';

type Mine =
  | { type: 'stock'; id: string; at: string; open: boolean; k: StockRequest }
  | { type: 'budget'; id: string; at: string; open: boolean; b: BudgetRequest }
  | { type: 'receipt'; id: string; at: string; open: boolean; r: Receipt };

export function MyRequests() {
  const t = useT();
  const { isPhone } = useDevice();
  const lang = useLang();
  const { fds } = useFmt();
  const fmtQty = useQty();
  const s = useClub();
  const act = useAct();
  const { user, id: me } = useMe();
  const [editStock, setEditStock] = useState<StockRequest | null>(null);
  const [editBudget, setEditBudget] = useState<BudgetRequest | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [cancel, setCancel] = useState<Mine | null>(null);
  const rows = useMemo<Mine[]>(() => {
    if (!me) return [];
    const all: Mine[] = [
      ...live(s.stockRequests).filter((k) => k.requestedBy === me).map((k): Mine => ({ type: 'stock', id: k.id, at: k.createdAt, open: k.status === 'requested', k })),
      ...live(s.budgetRequests).filter((b) => b.requestedBy === me).map((b): Mine => ({ type: 'budget', id: b.id, at: b.createdAt, open: b.status === 'pending', b })),
      ...live(s.receipts).filter((r) => r.by === me).map((r): Mine => ({ type: 'receipt', id: r.id, at: r.createdAt, open: (r.status === 'submitted' || r.status === 'rejected') && !r.voidedAt, r })),
    ];
    return all.sort((a, b) => (a.open === b.open ? (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) : a.open ? -1 : 1));
  }, [s.stockRequests, s.budgetRequests, s.receipts, me]);
  const paged = usePaged(rows, 8);
  if (!user) return null;
  const waiting = rows.filter((x) => x.open && !(x.type === 'receipt' && x.r.status === 'rejected')).length;
  const day = (at: string) => fds(at.slice(0, 10));
  const doCancel = async () => {
    if (!cancel) return;
    const r = cancel.type === 'stock' ? await act('stock.cancel', { id: cancel.id }, { ok: t('requests.mine.cancelled') })
      : cancel.type === 'budget' ? await act('budget.cancel', budgetCancelInput(cancel.id), { ok: t('requests.mine.cancelled') })
      : await act('receipt.void', receiptVoidInput(cancel.id), { ok: t('requests.mine.cancelled') });
    if (r.ok) setCancel(null);
  };
  const titleOf = (x: Mine) => x.type === 'stock' ? `${x.k.item} · ${fmtQty(x.k.qty)} ${unitLabel(t, x.k.unit)}` : x.type === 'budget' ? `${x.b.item} · ${rp(x.b.amount)}` : `${x.r.supplier} · ${rp(x.r.amount)}`;
  const subOf = (x: Mine) => x.type === 'stock' ? `${t('requests.mine.stock')} · ${areaLabel(t, x.k.area)} · ${day(x.at)}`
    : x.type === 'budget' ? `${t('requests.mine.budget')} · ${sectionName(s, x.b.sectionId, lang)} · ${day(x.at)}`
    : `${t('requests.mine.receipt')} · ${sectionName(s, x.r.sectionId, lang)} · ${day(x.at)}`;
  const iconOf = (x: Mine) => (x.type === 'stock' ? 'inventory_2' : x.type === 'budget' ? 'pie_chart' : 'receipt_long');
  const badge = (x: Mine) => {
    if (x.type === 'stock') return <StockBadge status={x.k.status} />;
    if (x.type === 'budget') {
      const m = { pending: ['pending', 'waiting'], approved: ['paid', 'approved'], rejected: ['overdue', 'rejected'], cancelled: ['void', 'cancelled'] } as const;
      const [kind, key] = m[x.b.status];
      return <BadgePill kind={kind} label={t('requests.mine.s_' + key)} />;
    }
    if (x.r.voidedAt) return <BadgePill kind="void" label={t('requests.mine.s_cancelled')} />;
    const m = { submitted: ['pending', 'withFinance'], approved: ['paid', 'approved'], rejected: ['overdue', 'rejected'] } as const;
    const [kind, key] = m[x.r.status];
    return <BadgePill kind={kind} label={t('requests.mine.s_' + key)} />;
  };
  const note = (x: Mine) => (x.type === 'stock' && x.k.status === 'rejected' && x.k.note ? x.k.note : x.type === 'budget' && x.b.status === 'rejected' && x.b.note ? x.b.note : x.type === 'receipt' && x.r.status === 'rejected' && x.r.note ? x.r.note : '');
  return (
    <Card>
      <CardHead title={t('requests.mine.title')} meta={waiting ? t('requests.mine.waiting', { n: waiting }) : undefined} />
      {paged.rows.map((x) => (
        <div key={x.type + x.id} data-testid="my-request" data-type={x.type} data-open={x.open ? 'yes' : 'no'} style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 12, flexWrap: 'wrap', padding: isPhone ? '9px 14px' : '12px 20px', borderTop: '1px solid #EFECEA', minHeight: isPhone ? 56 : 64 }}>
          <span aria-hidden="true" className="cp-hide-phone" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={iconOf(x)} size={20} color="#75624B" /></span>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{titleOf(x)}</span>
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{subOf(x)}</span>
            {note(x) ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>“{note(x)}”</span> : null}
          </div>
          {badge(x)}
          {x.type === 'stock' && canEditStock(user, x.k) ? (
            <>
              <OutlineButton icon="edit" onClick={() => setEditStock(x.k)}>{t('common.edit')}</OutlineButton>
              <TextButton color="#AF4B2F" onClick={() => setCancel(x)}>{t('requests.mine.cancel')}</TextButton>
            </>
          ) : null}
          {x.type === 'stock' && canReceiveStock(user, x.k) ? (
            <OutlineButton icon="inventory" onClick={() => void act('stock.receive', { id: x.id }, { ok: t('kitchen.stock.receivedToast', { item: x.k.item }) })}>{t('kitchen.stock.receive')}</OutlineButton>
          ) : null}
          {x.type === 'budget' && x.open ? (
            <>
              {hasAction('budget.edit') ? <OutlineButton icon="edit" onClick={() => setEditBudget(x.b)}>{t('common.edit')}</OutlineButton> : null}
              {hasAction('budget.cancel') ? <TextButton color="#AF4B2F" onClick={() => setCancel(x)}>{t('requests.mine.cancel')}</TextButton> : null}
            </>
          ) : null}
          {x.type === 'receipt' && x.open ? (
            <>
              {hasAction('receipt.edit') ? <OutlineButton icon="edit" onClick={() => setEditReceipt(x.r)}>{t(x.r.status === 'rejected' ? 'requests.mine.fixSend' : 'common.edit')}</OutlineButton> : null}
              {hasAction('receipt.void') && x.r.status === 'submitted' ? <TextButton color="#AF4B2F" onClick={() => setCancel(x)}>{t('requests.mine.cancel')}</TextButton> : null}
            </>
          ) : null}
        </div>
      ))}
      {!rows.length ? <EmptyState icon="inbox" title={t('requests.mine.empty')} sub={t('requests.mine.emptySub')} /> : null}
      <div style={{ padding: paged.pages > 1 ? '8px 20px 12px' : 0, borderTop: paged.pages > 1 ? '1px solid #EFECEA' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('requests.mine.title')} /></div>

      <StockEditDialog k={editStock} onClose={() => setEditStock(null)} />
      <BudgetEditDialog b={editBudget} onClose={() => setEditBudget(null)} />
      <ReceiptEditDialog r={editReceipt} onClose={() => setEditReceipt(null)} />
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title={t('requests.mine.cancelTitle')} body={cancel ? t('requests.mine.cancelAsk', { what: titleOf(cancel) }) : null} confirmLabel={t('requests.mine.cancel')} cancelLabel={t('requests.mine.keep')} onConfirm={doCancel} />
    </Card>
  );
}

function BudgetEditDialog({ b, onClose }: { b: BudgetRequest | null; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const [item, setItem] = useState('');
  const [amt, setAmt] = useState('');
  const [sectionId, setSectionId] = useState('');
  useResetOn(b?.id ?? '', () => { if (b) { setItem(b.item); setAmt(fmtN(b.amount)); setSectionId(b.sectionId); } });
  const ok = !!item.trim() && parseN(amt) > 0 && !!sectionId;
  const go = async () => {
    if (!b || !ok) return;
    const r = await act('budget.edit', budgetEditInput(b.id, { item, amount: parseN(amt), sectionId }), { ok: t('requests.mine.saved') });
    if (r.ok) onClose();
  };
  return (
    <Dialog open={!!b} onClose={onClose} eyebrow={t('requests.mine.budget')} title={t('requests.mine.editBudget')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!ok}>{t('common.saveChanges')}</Button></>}>
      <TextField label={t('requests.budget.itemLabel')} value={item} onChange={setItem} maxLength={80} autoFocus />
      <TextField label={t('requests.budget.amountLabel')} value={amt} onChange={(v) => setAmt(fmtN(v))} inputMode="numeric" prefix="Rp" />
      <ChipGroup<string> label={t('requests.budget.section')} value={sectionId} onChange={(v) => setSectionId(v as string)} options={sectionsOf(s).map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
    </Dialog>
  );
}

function ReceiptEditDialog({ r, onClose }: { r: Receipt | null; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useClub();
  const act = useAct();
  const [supplier, setSupplier] = useState('');
  const [amt, setAmt] = useState('');
  const [sectionId, setSectionId] = useState('');
  useResetOn(r?.id ?? '', () => { if (r) { setSupplier(r.supplier); setAmt(fmtN(r.amount)); setSectionId(r.sectionId); } });
  const ok = !!supplier.trim() && parseN(amt) > 0 && !!sectionId;
  const go = async () => {
    if (!r || !ok) return;
    const res = await act('receipt.edit', receiptEditInput(r.id, { supplier, amount: parseN(amt), sectionId }), { ok: t('requests.mine.saved') });
    if (res.ok) onClose();
  };
  return (
    <Dialog open={!!r} onClose={onClose} eyebrow={t('requests.mine.receipt')} title={t('requests.mine.editReceipt')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!ok}>{t('common.saveChanges')}</Button></>}>
      <TextField label={t('requests.snap.supplier')} value={supplier} onChange={setSupplier} maxLength={80} autoFocus />
      <TextField label={t('requests.snap.amount')} value={amt} onChange={(v) => setAmt(fmtN(v))} inputMode="numeric" prefix="Rp" />
      <ChipGroup<string> label={t('requests.snap.section')} value={sectionId} onChange={(v) => setSectionId(v as string)} options={sectionsOf(s).map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
    </Dialog>
  );
}
