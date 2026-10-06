// Stock requests (design ScrKstock): request, approve or decline (declined requests are kept), edit or cancel before approval,
// mark received (requester or an approver). Requests from every section are listed; filters show counts.
import { useMemo, useState } from 'react';
import { actorName, type StockRequest } from '@cp/shared';
import { STOCK_AREAS, canApproveStock, canEditStock, canReceiveStock } from '@cp/shared/rules/kitchenOps';
import { Button, Dialog, EmptyState, PageHead, Pager, Segmented, Select, TextField, ChipGroup, usePaged, FONT_BODY } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { ConfirmDialog, FilterChip, OutlineButton, PillButton, StockBadge, TextButton, useResetOn } from './parts';
import { StockForm, areaLabel, parseQty, unitLabel, useQty, type StockPrefill } from './StockForm';
import { useStockList } from './vals';

type AreaFilter = 'all' | StockRequest['area'];
type StatusFilter = 'all' | StockRequest['status'];
const STATUSES: StockRequest['status'][] = ['requested', 'approved', 'received', 'rejected', 'cancelled'];

export function Stock() {
  const t = useT();
  const { fds } = useFmt();
  const { device, isPhone } = useDevice();
  const { user, role } = useMe();
  const s = useClub();
  const act = useAct();
  const fmtQty = useQty();
  const list = useStockList();
  const [area, setArea] = useState<AreaFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [decline, setDecline] = useState<StockRequest | null>(null);
  const [edit, setEdit] = useState<StockRequest | null>(null);
  const [cancel, setCancel] = useState<StockRequest | null>(null);
  const [prefill, setPrefill] = useState<StockPrefill | null>(null);
  const matches = (k: StockRequest, a: AreaFilter, st: StatusFilter) => (a === 'all' || k.area === a) && (st === 'all' || k.status === st);
  const rows = useMemo(() => list.filter((k) => matches(k, area, status)), [list, area, status]);
  const paged = usePaged(rows, 10, `${area}|${status}`); // a new filter starts again on page 1
  const areaCount = (a: AreaFilter) => list.filter((k) => matches(k, a, status)).length;
  const statusCount = (st: StatusFilter) => list.filter((k) => matches(k, area, st)).length;
  if (!user) return null;
  const who = (id: string | undefined) => (id ? actorName(s, id) : '');

  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 18, maxWidth: 900 }}>
      <PageHead eyebrow={t('kitchen.stock.eyebrow')} title={t('kitchen.stock.title')} />
      <StockForm defaultArea={role === 'kitchen' || role === 'mgmt' ? 'kitchen' : 'housekeeping'} prefill={prefill} />

      {isPhone ? (
        // phone: the two filters are two dropdowns side by side, not two rows of chips
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Select ariaLabel={t('kitchen.stock.filterArea')} value={area} onChange={setArea}
            options={(['all', ...STOCK_AREAS] as AreaFilter[]).map((a) => ({ value: a, label: `${a === 'all' ? t('common.all') : areaLabel(t, a)} · ${areaCount(a)}` }))} />
          <Select ariaLabel={t('kitchen.stock.filterStatus')} value={status} onChange={setStatus}
            options={[{ value: 'all' as StatusFilter, label: `${t('common.all')} · ${statusCount('all')}` }, ...STATUSES.map((st) => ({ value: st as StatusFilter, label: `${t('kitchen.stock.s_' + st)} · ${statusCount(st)}` }))]} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t('kitchen.stock.filterArea')}>
            {(['all', ...STOCK_AREAS] as AreaFilter[]).map((a) => (
              <FilterChip key={a} selected={area === a} onClick={() => setArea(a)} label={`${a === 'all' ? t('common.all') : areaLabel(t, a)} · ${areaCount(a)}`} />
            ))}
          </div>
          <Segmented<StatusFilter> label={t('kitchen.stock.filterStatus')} value={status} onChange={setStatus}
            items={[{ value: 'all', label: t('common.all'), count: statusCount('all') }, ...STATUSES.map((st) => ({ value: st as StatusFilter, label: t('kitchen.stock.s_' + st), count: statusCount(st) }))]} />
        </>
      )}

      <div style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden' }}>
        {paged.rows.map((k) => {
          const mine = canEditStock(user, k);
          const approve = canApproveStock(user, k);
          const receive = canReceiveStock(user, k);
          const decided = k.status === 'approved' || k.status === 'received' ? t('kitchen.stock.approvedBy', { name: who(k.decidedBy) }) : k.status === 'rejected' ? t('kitchen.stock.declinedBy', { name: who(k.decidedBy) }) : '';
          return (
            <div key={k.id} data-testid="stock-row" data-id={k.id} data-status={k.status} style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 12, flexWrap: 'wrap', padding: isPhone ? '10px 14px' : '14px 20px', borderTop: '1px solid #EFECEA', minHeight: isPhone ? 56 : 68 }}>
              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{k.item} · {fmtQty(k.qty)} {unitLabel(t, k.unit)}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{areaLabel(t, k.area)} · {who(k.requestedBy)} · {fds(k.createdAt.slice(0, 10))}{decided ? ' · ' + decided : ''}</span>
                {k.status === 'rejected' && k.note ? <span style={{ fontSize: FONT_BODY, lineHeight: 1.4 }}>“{k.note}”</span> : null}
              </div>
              <StockBadge status={k.status} />
              {approve ? (
                <>
                  <TextButton color="#AF4B2F" onClick={() => setDecline(k)}>{t('kitchen.stock.decline')}</TextButton>
                  <PillButton height={44} pad="0 16px" onClick={() => void act('stock.approve', { id: k.id }, { ok: t('kitchen.stock.approvedToast', { item: k.item, name: who(k.requestedBy) }) })}>{t('kitchen.stock.approve')}</PillButton>
                </>
              ) : null}
              {mine ? (
                <>
                  <OutlineButton icon="edit" onClick={() => setEdit(k)}>{t('common.edit')}</OutlineButton>
                  <TextButton color="#AF4B2F" onClick={() => setCancel(k)}>{t('kitchen.stock.cancel')}</TextButton>
                </>
              ) : null}
              {k.status === 'requested' && !approve ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.stock.waiting')}</span> : null}
              {receive ? <OutlineButton onClick={() => void act('stock.receive', { id: k.id }, { ok: t('kitchen.stock.receivedToast', { item: k.item }) })}>{t('kitchen.stock.receive')}</OutlineButton> : null}
              {k.status === 'rejected' && k.requestedBy === user.id ? <TextButton onClick={() => { setPrefill({ item: k.item, qty: k.qty, unit: k.unit, area: k.area }); document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('kitchen.stock.again')}</TextButton> : null}
            </div>
          );
        })}
        {!rows.length ? <EmptyState icon="inventory_2" title={t('kitchen.stock.empty')} sub={t('kitchen.stock.emptySub')} /> : null}
      </div>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.stock.title')} />

      <DeclineDialog k={decline} onClose={() => setDecline(null)} />
      <StockEditDialog k={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title={t('kitchen.stock.cancelTitle')} body={cancel ? t('kitchen.stock.cancelAsk', { item: cancel.item }) : null} confirmLabel={t('kitchen.stock.cancel')} cancelLabel={t('kitchen.stock.keep')}
        onConfirm={async () => { if (!cancel) return; const r = await act('stock.cancel', { id: cancel.id }, { ok: t('kitchen.stock.cancelled', { item: cancel.item }) }); if (r.ok) setCancel(null); }} />
    </div>
  );
}

function DeclineDialog({ k, onClose }: { k: StockRequest | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [note, setNote] = useState('');
  const ok = note.trim().length > 0;
  const go = async () => {
    if (!k || !ok) return;
    const r = await act('stock.reject', { id: k.id, note }, { ok: t('kitchen.stock.declinedToast', { item: k.item }) });
    if (r.ok) { setNote(''); onClose(); }
  };
  return (
    <Dialog open={!!k} onClose={() => { setNote(''); onClose(); }} eyebrow={k?.item} title={t('kitchen.stock.declineTitle')} maxWidth={520}
      footer={<><Button variant="secondary" onClick={() => { setNote(''); onClose(); }}>{t('common.cancel')}</Button><Button variant="danger" onClick={go} disabled={!ok}>{t('kitchen.stock.decline')}</Button></>}>
      <TextField label={t('kitchen.stock.declineWhy')} value={note} onChange={setNote} multiline rows={3} maxLength={240} autoFocus placeholder={t('kitchen.stock.declinePh')} />
      <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.stock.declineKept')}</span>
    </Dialog>
  );
}

export function StockEditDialog({ k, onClose }: { k: StockRequest | null; onClose: () => void }) {
  const t = useT();
  const act = useAct();
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [area, setArea] = useState<StockRequest['area']>('kitchen');
  useResetOn(k?.id ?? '', () => { if (k) { setItem(k.item); setQty(String(k.qty)); setUnit(k.unit); setArea(k.area); } });
  const n = parseQty(qty);
  const ok = !!item.trim() && Number.isFinite(n) && n > 0 && !!unit.trim();
  const go = async () => {
    if (!k || !ok) return;
    const r = await act('stock.edit', { id: k.id, item, qty: n, unit, area }, { ok: t('kitchen.stock.edited') });
    if (r.ok) onClose();
  };
  return (
    <Dialog open={!!k} onClose={onClose} eyebrow={t('kitchen.stock.title')} title={t('kitchen.stock.editTitle')} maxWidth={560}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} disabled={!ok}>{t('common.saveChanges')}</Button></>}>
      <TextField label={t('kitchen.stock.item')} value={item} onChange={setItem} maxLength={80} autoFocus />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}><TextField label={t('kitchen.stock.qty')} value={qty} onChange={setQty} inputMode="decimal" maxLength={8} /></div>
        <div style={{ flex: '1 1 140px' }}><TextField label={t('kitchen.stock.unit')} value={unit} onChange={setUnit} maxLength={24} /></div>
      </div>
      <ChipGroup<StockRequest['area']> label={t('kitchen.stock.area')} value={area} onChange={(v) => setArea(v as StockRequest['area'])} options={STOCK_AREAS.map((a) => ({ value: a, label: areaLabel(t, a) }))} />
    </Dialog>
  );
}
