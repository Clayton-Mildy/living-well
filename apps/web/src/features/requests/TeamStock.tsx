// "Team stock requests" (KC round 6): F&B has no Stock page any more, so the F&B supervisor approves or declines the kitchen's stock
// requests here, and marks approved ones received. Their own requests stay in "My requests"; management and finance keep the Stock page.
import { useMemo, useState } from 'react';
import { actorName, live, type StockRequest } from '@cp/shared';
import { STOCK_AREAS, canApproveStock, canReceiveStock, isStockApprover, sortStock } from '@cp/shared/rules/kitchenOps';
import { EmptyState, Icon, Pager, usePaged } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { OutlineButton, PillButton, StockBadge, TextButton } from '../kitchen/parts';
import { DeclineDialog } from '../kitchen/Stock';
import { areaLabel, unitLabel, useQty } from '../kitchen/StockForm';
import { Badge, Hero, HeroHead, PGroup, PillBtn, hrow, prow, rowSub, rowTitle } from '../finance/parts';

const STOCK_KIND = { requested: 'pending', approved: 'watch', received: 'paid', rejected: 'overdue', cancelled: 'void' } as const;

export function TeamStock() {
  const t = useT();
  const { isPhone } = useDevice();
  const { fds } = useFmt();
  const fmtQty = useQty();
  const s = useClub();
  const act = useAct();
  const { user } = useMe();
  const [decline, setDecline] = useState<StockRequest | null>(null);
  // what this approver can decide, then what they can mark received (not their own: those are in My requests)
  const rows = useMemo(() => (user ? sortStock(live(s.stockRequests).filter((k) => canApproveStock(user, k) || (canReceiveStock(user, k) && k.requestedBy !== user.id))) : []), [s.stockRequests, user]);
  const paged = usePaged(rows, 8);
  if (!user || !STOCK_AREAS.some((area) => isStockApprover(user, { area }))) return null;
  const waiting = rows.filter((k) => k.status === 'requested').length;
  const who = (k: StockRequest) => actorName(s, k.requestedBy);
  const title = (k: StockRequest) => `${k.item} · ${fmtQty(k.qty)} ${unitLabel(t, k.unit)}`;
  const sub = (k: StockRequest) => `${areaLabel(t, k.area)} · ${who(k)} · ${fds(k.createdAt.slice(0, 10))}`;
  const approve = (k: StockRequest) => void act('stock.approve', { id: k.id }, { ok: t('kitchen.stock.approvedToast', { item: k.item, name: who(k) }) });
  const receive = (k: StockRequest) => void act('stock.receive', { id: k.id }, { ok: t('kitchen.stock.receivedToast', { item: k.item }) });
  const actions = (k: StockRequest) => {
    if (k.status === 'requested') {
      return isPhone
        ? [<PillBtn key="a" tone="primary" onClick={() => approve(k)}>{t('kitchen.stock.approve')}</PillBtn>, <PillBtn key="d" tone="danger" onClick={() => setDecline(k)}>{t('kitchen.stock.decline')}</PillBtn>]
        : [<TextButton key="d" color="#9A3D24" onClick={() => setDecline(k)}>{t('kitchen.stock.decline')}</TextButton>, <PillButton key="a" height={44} pad="0 16px" onClick={() => approve(k)}>{t('kitchen.stock.approve')}</PillButton>];
    }
    return isPhone ? [<PillBtn key="r" icon="inventory" onClick={() => receive(k)}>{t('kitchen.stock.receive')}</PillBtn>] : [<OutlineButton key="r" icon="inventory" onClick={() => receive(k)}>{t('kitchen.stock.receive')}</OutlineButton>];
  };
  const empty = !rows.length ? <EmptyState icon="inventory_2" title={t('requests.team.empty')} /> : null;
  const dialog = <DeclineDialog k={decline} onClose={() => setDecline(null)} />;
  if (isPhone) {
    return (
      <PGroup title={t('requests.team.title')} meta={waiting ? t('requests.team.waiting', { n: waiting }) : undefined} pad={0} gap={0}>
        {paged.rows.map((k, i) => (
          <div key={k.id} data-testid="team-stock-row" data-id={k.id} data-status={k.status} style={{ ...prow(i === 0), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ ...rowTitle, fontSize: 16 }}>{title(k)}</span>
                <span style={{ ...rowSub, fontSize: 13 }}>{sub(k)}</span>
              </div>
              <span style={{ paddingTop: 2 }}><Badge kind={STOCK_KIND[k.status]} label={t('kitchen.stock.s_' + k.status)} /></span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions(k)}</div>
          </div>
        ))}
        {empty}
        {paged.pages > 1 ? <div style={{ padding: '8px 0 4px', borderTop: '1px solid #F0EAE1' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('requests.team.title')} /></div> : null}
        {dialog}
      </PGroup>
    );
  }
  return (
    <Hero>
      <HeroHead title={t('requests.team.title')} meta={waiting ? t('requests.team.waiting', { n: waiting }) : undefined} />
      {paged.rows.map((k) => (
        <div key={k.id} data-testid="team-stock-row" data-id={k.id} data-status={k.status} style={{ ...hrow, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="inventory_2" size={21} weight={300} color="#6E5A43" /></span>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={rowTitle}>{title(k)}</span>
            <span style={rowSub}>{sub(k)}</span>
          </div>
          <StockBadge status={k.status} />
          {actions(k)}
        </div>
      ))}
      {empty}
      <div style={{ padding: paged.pages > 1 ? '8px 0 4px' : 0, borderTop: paged.pages > 1 ? '1px solid #F0EAE1' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('requests.team.title')} /></div>
      {dialog}
    </Hero>
  );
}
