// "My requests": stock, budget and receipt requests I sent, with status, and edit or cancel while they are still pending.
import { useMemo, useState } from 'react';
import { fmtN, live, parseN, rp, type BudgetRequest, type Receipt, type StockRequest } from '@cp/shared';
import { canEditStock, canReceiveStock } from '@cp/shared/rules/kitchenOps';
import { Button, ChipGroup, EmptyState, Icon, Pager, TextField, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { BadgePill, ConfirmDialog, OutlineButton, StockBadge, TextButton, useResetOn } from '../kitchen/parts';
import { StockEditDialog } from '../kitchen/Stock';
import { areaLabel, unitLabel, useQty } from '../kitchen/StockForm';
import { Badge, FormOverlay, Hero, HeroHead, PGroup, PillBtn, hrow, prow, rowSub, rowTitle } from '../finance/parts';
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
  // round 6, phone: a quiet status (dot and text) from the finance badge; wider screens keep the kitchen's chip
  const Pill = isPhone ? Badge : BadgePill;
  const STOCK_KIND = { requested: 'pending', approved: 'watch', received: 'paid', rejected: 'overdue', cancelled: 'void' } as const;
  const badge = (x: Mine) => {
    if (x.type === 'stock') return isPhone ? <Badge kind={STOCK_KIND[x.k.status]} label={t('kitchen.stock.s_' + x.k.status)} /> : <StockBadge status={x.k.status} />;
    if (x.type === 'budget') {
      const m = { pending: ['pending', 'waiting'], approved: ['paid', 'approved'], rejected: ['overdue', 'rejected'], cancelled: ['void', 'cancelled'] } as const;
      const [kind, key] = m[x.b.status];
      return <Pill kind={kind} label={t('requests.mine.s_' + key)} />;
    }
    if (x.r.voidedAt) return <Pill kind="void" label={t('requests.mine.s_cancelled')} />;
    const m = { submitted: ['pending', 'withFinance'], approved: ['paid', 'approved'], rejected: ['overdue', 'rejected'] } as const;
    const [kind, key] = m[x.r.status];
    return <Pill kind={kind} label={t('requests.mine.s_' + key)} />;
  };
  const note = (x: Mine) => (x.type === 'stock' && x.k.status === 'rejected' && x.k.note ? x.k.note : x.type === 'budget' && x.b.status === 'rejected' && x.b.note ? x.b.note : x.type === 'receipt' && x.r.status === 'rejected' && x.r.note ? x.r.note : '');
  // the row's actions (round 6, phone: 34px pills under the text; wider screens: the kitchen's outline and text buttons)
  const out = (key: string, icon: string, onClick: () => void, text: string) => (isPhone ? <PillBtn key={key} icon={icon} onClick={onClick}>{text}</PillBtn> : <OutlineButton key={key} icon={icon} onClick={onClick}>{text}</OutlineButton>);
  const txt = (key: string, onClick: () => void, text: string) => (isPhone ? <PillBtn key={key} tone="danger" onClick={onClick}>{text}</PillBtn> : <TextButton key={key} color="#9A3D24" onClick={onClick}>{text}</TextButton>);
  const actions = (x: Mine) => {
    const a: React.ReactNode[] = [];
    if (x.type === 'stock' && canEditStock(user, x.k)) { a.push(out('e', 'edit', () => setEditStock(x.k), t('common.edit'))); a.push(txt('c', () => setCancel(x), t('requests.mine.cancel'))); }
    if (x.type === 'stock' && canReceiveStock(user, x.k)) a.push(out('r', 'inventory', () => void act('stock.receive', { id: x.id }, { ok: t('kitchen.stock.receivedToast', { item: x.k.item }) }), t('kitchen.stock.receive')));
    if (x.type === 'budget' && x.open) {
      if (hasAction('budget.edit')) a.push(out('e', 'edit', () => setEditBudget(x.b), t('common.edit')));
      if (hasAction('budget.cancel')) a.push(txt('c', () => setCancel(x), t('requests.mine.cancel')));
    }
    if (x.type === 'receipt' && x.open) {
      if (hasAction('receipt.edit')) a.push(out('e', 'edit', () => setEditReceipt(x.r), t(x.r.status === 'rejected' ? 'requests.mine.fixSend' : 'common.edit')));
      if (hasAction('receipt.void') && x.r.status === 'submitted') a.push(txt('c', () => setCancel(x), t('requests.mine.cancel')));
    }
    return a;
  };
  const dialogs = (
    <>
      <StockEditDialog k={editStock} onClose={() => setEditStock(null)} />
      <BudgetEditDialog b={editBudget} onClose={() => setEditBudget(null)} />
      <ReceiptEditDialog r={editReceipt} onClose={() => setEditReceipt(null)} />
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title={t('requests.mine.cancelTitle')} body={cancel ? t('requests.mine.cancelAsk', { what: titleOf(cancel) }) : null} confirmLabel={t('requests.mine.cancel')} cancelLabel={t('requests.mine.keep')} onConfirm={doCancel} />
    </>
  );
  // round 6, phone: a grouped list (My requests over a flat group), a quiet row each: title, one meta line, status; the actions as pills under it
  if (isPhone) {
    return (
      <PGroup title={t('requests.mine.title')} meta={waiting ? t('requests.mine.waiting', { n: waiting }) : undefined} pad={0} gap={0}>
        {paged.rows.map((x, i) => {
          const a = actions(x);
          return (
            <div key={x.type + x.id} data-testid="my-request" data-type={x.type} data-open={x.open ? 'yes' : 'no'} style={{ ...prow(i === 0), display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ ...rowTitle, fontSize: 16 }}>{titleOf(x)}</span>
                  <span style={{ ...rowSub, fontSize: 13 }}>{subOf(x)}</span>
                  {note(x) ? <span style={{ fontSize: 14, lineHeight: 1.4, color: '#9A3D24' }}>“{note(x)}”</span> : null}
                </div>
                <span style={{ paddingTop: 2 }}>{badge(x)}</span>
              </div>
              {a.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{a}</div> : null}
            </div>
          );
        })}
        {!rows.length ? <EmptyState icon="inbox" title={t('requests.mine.empty')} /> : null}
        {paged.pages > 1 ? <div style={{ padding: '8px 0 4px', borderTop: '1px solid #F0EAE1' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('requests.mine.title')} /></div> : null}
        {dialogs}
      </PGroup>
    );
  }
  return (
    <Hero>
      <HeroHead title={t('requests.mine.title')} meta={waiting ? t('requests.mine.waiting', { n: waiting }) : undefined} />
      {paged.rows.map((x) => (
        <div key={x.type + x.id} data-testid="my-request" data-type={x.type} data-open={x.open ? 'yes' : 'no'} style={{ ...hrow, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span aria-hidden="true" className="cp-hide-phone" style={{ width: 46, height: 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={iconOf(x)} size={21} weight={300} color="#6E5A43" /></span>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={rowTitle}>{titleOf(x)}</span>
            <span style={rowSub}>{subOf(x)}</span>
            {note(x) ? <span style={{ fontSize: 14, lineHeight: 1.4, color: '#9A3D24' }}>“{note(x)}”</span> : null}
          </div>
          {badge(x)}
          {actions(x)}
        </div>
      ))}
      {!rows.length ? <EmptyState icon="inbox" title={t('requests.mine.empty')} /> : null}
      <div style={{ padding: paged.pages > 1 ? '8px 0 4px' : 0, borderTop: paged.pages > 1 ? '1px solid #F0EAE1' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('requests.mine.title')} /></div>

      {dialogs}
    </Hero>
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
    <FormOverlay open={!!b} onClose={onClose} eyebrow={t('requests.mine.budget')} title={t('requests.mine.editBudget')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!ok}>{t('common.saveChanges')}</Button></>}>
      <TextField label={t('requests.budget.itemLabel')} value={item} onChange={setItem} maxLength={80} autoFocus />
      <TextField label={t('requests.budget.amountLabel')} value={amt} onChange={(v) => setAmt(fmtN(v))} inputMode="numeric" prefix="Rp" />
      <ChipGroup<string> label={t('requests.budget.section')} value={sectionId} onChange={(v) => setSectionId(v as string)} options={sectionsOf(s).map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
    </FormOverlay>
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
    <FormOverlay open={!!r} onClose={onClose} eyebrow={t('requests.mine.receipt')} title={t('requests.mine.editReceipt')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!ok}>{t('common.saveChanges')}</Button></>}>
      <TextField label={t('requests.snap.supplier')} value={supplier} onChange={setSupplier} maxLength={80} autoFocus />
      <TextField label={t('requests.snap.amount')} value={amt} onChange={(v) => setAmt(fmtN(v))} inputMode="numeric" prefix="Rp" />
      <ChipGroup<string> label={t('requests.snap.section')} value={sectionId} onChange={(v) => setSectionId(v as string)} options={sectionsOf(s).map((x) => ({ value: x.id, label: sectionName(s, x.id, lang) }))} />
    </FormOverlay>
  );
}
