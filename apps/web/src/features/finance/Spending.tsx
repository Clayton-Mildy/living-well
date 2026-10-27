// Spending (round 14 phase 2): where the money went, from the approved receipts. A period (calendar months ending today, or From and To),
// the total, and the same money by Category, Item, Brand or Vendor, each row with a thin bar for its share of the biggest.
// An item opens a sheet: its unit price over every purchase as a chart, then the purchases. Finance and management only (the nav and the route map).
import { useMemo, useState } from 'react';
import { rp, type ISODate } from '@cp/shared';
import { itemPurchases, spending, spendWindow, type SpendPeriod, type SpendRow, type ItemRow } from '@cp/shared/rules/purchasing';
import { DateField, EmptyState, PageHead, Segmented, Sheet } from '../../components/ui';
import { TrendChart } from '../../components/ui/TrendChart';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { PGroup, prow } from './parts';

type View = 'category' | 'item' | 'brand' | 'vendor';
const PERIODS: SpendPeriod[] = ['month', '3m', '6m', 'custom'];
const VIEWS: View[] = ['category', 'item', 'brand', 'vendor'];
const VIEW_KEY = { category: 'byCategory', item: 'byItem', brand: 'byBrand', vendor: 'byVendor' } as const;
const RUST = '#9A3D24', GREEN = '#2F5A40'; // a dearer price reads rust, a cheaper one green (text only, no tints)

/** Picking one end of a custom window keeps From on or before To: the other end follows. */
export function editWindow(w: { from: ISODate; to: ISODate }, part: 'from' | 'to', date: ISODate): { from: ISODate; to: ISODate } {
  if (!date) return w;
  return part === 'from' ? { from: date, to: date > w.to ? date : w.to } : { from: date < w.from ? date : w.from, to: date };
}

export function Spending() {
  const s = useClub();
  const t = useT();
  const { today } = useNow();
  const { device, isPhone } = useDevice();
  const [period, setPeriod] = useState<SpendPeriod>('month');
  const [custom, setCustom] = useState(() => spendWindow('month', today));
  const [view, setView] = useState<View>('category');
  const [open, setOpen] = useState<ItemRow | null>(null);

  const win = spendWindow(period, today, custom);
  const data = useMemo(() => spending(s, win.from, win.to), [s, win.from, win.to]);
  const list: SpendRow[] = data[VIEW_KEY[view]];
  const biggest = list[0]?.amount || 1; // rows come sorted by amount, largest first

  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20, maxWidth: 760, boxSizing: 'border-box' }}>
      <PageHead title={t('nav.spending')} />
      <Segmented<SpendPeriod> label={t('nav.spending')} cols={4} value={period} onChange={setPeriod} items={PERIODS.map((p) => ({ value: p, label: t(`purchasing.sp.${p}`) }))} />
      {period === 'custom' ? (
        <div data-testid="sp-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
          <DateField compact label={t('health.rangeFrom')} value={custom.from} max={today} onChange={(d) => setCustom(editWindow(custom, 'from', d))} />
          <DateField compact label={t('health.rangeTo')} value={custom.to} max={today} onChange={(d) => setCustom(editWindow(custom, 'to', d))} />
        </div>
      ) : null}

      {data.total <= 0 && !list.length ? (
        <EmptyState icon="shopping_cart" title={t('purchasing.sp.empty')} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0 4px' }}>
            <span style={{ fontSize: 14, color: '#6B6259' }}>{t('purchasing.sp.spent')}</span>
            <span data-testid="sp-total" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 500, letterSpacing: '-0.5px', color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{rp(data.total)}</span>
          </div>
          <Segmented<View> label={t('purchasing.sp.byCategory')} cols={4} value={view} onChange={setView} items={VIEWS.map((v) => ({ value: v, label: t(`purchasing.sp.${VIEW_KEY[v]}`) }))} />
          {list.length ? ( // receipts from before itemising have no items or brands: those views are empty while the total still counts them
            <PGroup pad={0} gap={0} label={t(`purchasing.sp.${VIEW_KEY[view]}`)}>
              {list.map((r, i) => <Row key={r.key} r={r} first={i === 0} share={r.amount / biggest} view={view} onOpen={view === 'item' ? () => setOpen(r as ItemRow) : undefined} />)}
            </PGroup>
          ) : null}
        </>
      )}
      <ItemSheet item={open} from={win.from} to={win.to} onClose={() => setOpen(null)} />
    </div>
  );
}

function Row({ r, first, share, view, onOpen }: { r: SpendRow; first: boolean; share: number; view: View; onOpen?: () => void }) {
  const t = useT();
  const label = view === 'category' ? t(`purchasing.cat.${r.key}`) : r.label;
  const item = view === 'item' ? (r as ItemRow) : null;
  const pct = item?.change != null ? Math.round(Math.abs(item.change) * 100) : 0;
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', color: '#24201C', minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        <span data-testid="sp-amount" style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, color: '#24201C', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{rp(r.amount)}</span>
      </div>
      {item ? (
        <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: '18px', color: '#6B6259', minWidth: 0 }}>
          <span>{t('purchasing.sp.itemMeta', { qty: item.qty, unit: item.unit, price: rp(item.avgUnitPrice) })}</span>
          {item.change != null && pct > 0 ? <span style={{ color: item.change > 0 ? RUST : GREEN, fontWeight: 500 }}>{item.change > 0 ? '▲' : '▼'} {pct} %</span> : null}
        </div>
      ) : null}
      <div aria-hidden="true" style={{ height: 4, borderRadius: 999, background: 'var(--track, #E8E8EB)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, Math.round(share * 100))}%`, height: '100%', borderRadius: 999, background: '#24201C' }} />
      </div>
    </>
  );
  const style = prow(first, { display: 'flex', flexDirection: 'column', gap: 5, minHeight: 44, boxSizing: 'border-box', width: '100%', textAlign: 'left', border: 'none', fontFamily: 'Inter', color: 'inherit' });
  return onOpen
    ? <button type="button" data-testid="sp-row" className="cp-press" onClick={onOpen} style={{ ...style, cursor: 'pointer' }}>{body}</button>
    : <div data-testid="sp-row" style={style}>{body}</div>;
}

/** One item: its unit price over every purchase in the period as a chart, then the purchases, newest first. */
function ItemSheet({ item, from, to, onClose }: { item: ItemRow | null; from: ISODate; to: ISODate; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const { fd } = useFmt();
  const buys = useMemo(() => (item ? itemPurchases(s, item.key, from, to) : []), [s, item, from, to]);
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.label ?? ''}>
      {item ? (
        <>
          <TrendChart height={150} from={from} to={to} format={rp} ariaLabel={`${item.label}: ${t('purchasing.unitPrice')}`}
            series={[{ key: 'price', label: t('purchasing.unitPrice'), tone: 'ink', points: buys.map((b) => ({ date: b.date, value: b.unitPrice })) }]} empty={t('purchasing.sp.empty')} />
          <PGroup title={t('purchasing.sp.purchases')} pad={0} gap={0}>
            {[...buys].reverse().map((b, i) => (
              <div key={`${b.receiptId}-${i}`} data-testid="sp-purchase" style={prow(i === 0, { display: 'flex', flexDirection: 'column', gap: 2 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, lineHeight: '21px', color: '#24201C' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{b.supplier}</span>
                  <span style={{ flex: 'none', color: '#6B6259' }}>{fd(b.date, { day: 'numeric', month: 'short' })}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>
                  {b.brand ? `${b.brand} · ` : ''}{b.qty} × {rp(b.unitPrice)} = {rp(b.amount)}
                </div>
              </div>
            ))}
          </PGroup>
        </>
      ) : null}
    </Sheet>
  );
}
