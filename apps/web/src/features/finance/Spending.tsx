// Spending (round 14 phase 2): where the money went, from the approved receipts and the ones waiting for finance (KC 28 Oct). A period
// (this month, last month, 3 months or From and To) shared by two tabs. Summary: the total, and the same money by Category, Item, Brand
// or Vendor, each row with a thin bar for its share of the biggest; an item opens a sheet with its unit price over every purchase as a chart,
// then the purchases. Items (KC 28 Oct, was the Purchases page): every item bought, see ./Purchases. Finance and management only.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rp, type ISODate } from '@cp/shared';
import { itemPurchases, spending, spendWindow, type SpendPeriod, type SpendRow, type ItemRow } from '@cp/shared/rules/purchasing';
import { DateField, EmptyState, PageHead, Segmented, Sheet } from '../../components/ui';
import { TrendChart } from '../../components/ui/TrendChart';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { HAIR, Hero, PGroup, prow } from './parts';
import { OCHRE, PurchaseItems } from './Purchases';

type View = 'category' | 'item' | 'brand' | 'vendor';
type Tab = 'summary' | 'items';
const PERIODS: SpendPeriod[] = ['month', 'lastMonth', '3m', 'custom'];
const VIEWS: View[] = ['category', 'item', 'brand', 'vendor'];
const VIEW_KEY = { category: 'byCategory', item: 'byItem', brand: 'byBrand', vendor: 'byVendor' } as const;
const RUST = '#9A3D24', GREEN = '#2F5A40'; // a dearer price reads rust, a cheaper one green (text only, no tints)

/** Picking one end of a custom window keeps From on or before To: the other end follows. */
export function editWindow(w: { from: ISODate; to: ISODate }, part: 'from' | 'to', date: ISODate): { from: ISODate; to: ISODate } {
  if (!date) return w;
  return part === 'from' ? { from: date, to: date > w.to ? date : w.to } : { from: date < w.from ? date : w.from, to: date };
}

export function Spending() {
  const t = useT();
  const { today } = useNow();
  const { device, isPhone, isLaptop } = useDevice();
  const [period, setPeriod] = useState<SpendPeriod>('month');
  const [custom, setCustom] = useState(() => spendWindow('month', today));
  // /spending?tab=items opens the Items tab (a search result, an old Purchases link)
  const [sp, setSp] = useSearchParams();
  const tab: Tab = sp.get('tab') === 'items' ? 'items' : 'summary';
  const setTab = (x: Tab) => { const p = new URLSearchParams(sp); if (x === 'items') p.set('tab', 'items'); else p.delete('tab'); setSp(p, { replace: true }); };

  const win = spendWindow(period, today, custom);
  const tabs = <Segmented<Tab> label={t('nav.spending')} cols={2} value={tab} onChange={setTab} items={[{ value: 'summary', label: t('purchasing.sp.summary') }, { value: 'items', label: t('purchasing.sp.items') }]} />;
  const periods = <Segmented<SpendPeriod> label={t('purchasing.sp.period')} cols={4} value={period} onChange={setPeriod} items={PERIODS.map((p) => ({ value: p, label: t(`purchasing.sp.${p}`) }))} />;
  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20, boxSizing: 'border-box', minWidth: 0 }}>
      <PageHead title={t('nav.spending')} />
      {/* phone: the period, then Summary | Items; wider (KC 28 Oct): one bar, Summary | Items on the left and the period on the right, wrapping when narrow */}
      {isPhone ? <>{periods}{tabs}</> : (
        <div data-testid="sp-bar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px' }}>
          <div style={{ flex: '1 1 260px', maxWidth: isLaptop ? 360 : undefined, minWidth: 0 }}>{tabs}</div>
          <div style={{ flex: '2 1 420px', maxWidth: isLaptop ? 560 : undefined, minWidth: 0, marginLeft: 'auto' }}>{periods}</div>
        </div>
      )}
      {period === 'custom' ? (
        <div data-testid="sp-custom" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, ...(isPhone ? {} : { width: '100%', maxWidth: 560, marginLeft: 'auto' }) }}>
          <DateField compact label={t('health.rangeFrom')} value={custom.from} max={today} onChange={(d) => setCustom(editWindow(custom, 'from', d))} />
          <DateField compact label={t('health.rangeTo')} value={custom.to} max={today} onChange={(d) => setCustom(editWindow(custom, 'to', d))} />
        </div>
      ) : null}
      {tab === 'items' ? <PurchaseItems from={win.from} to={win.to} /> : <Summary from={win.from} to={win.to} />}
    </div>
  );
}

/** The Summary tab: the total (and what of it waits for finance), then the money by Category, Item, Brand or Vendor. */
function Summary({ from, to }: { from: ISODate; to: ISODate }) {
  const s = useClub();
  const t = useT();
  const { isPhone, isLaptop } = useDevice();
  const [view, setView] = useState<View>('category');
  const [open, setOpen] = useState<ItemRow | null>(null);
  const data = useMemo(() => spending(s, from, to), [s, from, to]);
  const list: SpendRow[] = data[VIEW_KEY[view]];
  const biggest = list[0]?.amount || 1; // rows come sorted by amount, largest first
  const sheet = <ItemSheet item={open} from={from} to={to} onClose={() => setOpen(null)} />;
  if (data.total <= 0 && !list.length) return <><EmptyState icon="shopping_cart" title={t('purchasing.sp.empty')} />{sheet}</>;

  // phone and tablet: the count line over the list; laptop: the same numbers in a rail on the right, as on the Items tab
  const total = <span data-testid="sp-total" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 500, letterSpacing: '-0.5px', color: '#24201C', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(data.total)}</span>;
  const waiting = data.waiting ? <span data-testid="sp-waiting" style={{ fontSize: 13, color: OCHRE }}>{t('purchasing.pu.waitingSum', { amount: rp(data.waiting) })}</span> : null;
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20, minWidth: 0 }}>
      <Segmented<View> label={t('purchasing.sp.byCategory')} cols={4} value={view} onChange={setView} items={VIEWS.map((v) => ({ value: v, label: t(`purchasing.sp.${VIEW_KEY[v]}`) }))} />
      {list.length ? ( // receipts from before itemising have no items or brands: those views are empty while the total still counts them
        <PGroup pad={0} gap={0} label={t(`purchasing.sp.${VIEW_KEY[view]}`)}>
          {list.map((r, i) => <Row key={r.key} r={r} first={i === 0} share={r.amount / biggest} view={view} onOpen={view === 'item' ? () => setOpen(r as ItemRow) : undefined} />)}
        </PGroup>
      ) : null}
    </div>
  );
  if (isLaptop) {
    // how many categories, items, brands and vendors the period has; a tap shows that list
    const fact = (v: View) => (
      <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className="h-row cp-bleed"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', padding: '10px 0', border: 'none', borderTop: HAIR, background: 'transparent', fontSize: 14, lineHeight: '20px', fontFamily: 'Inter', color: '#24201C', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: view === v ? '#24201C' : '#6B6259', fontWeight: view === v ? 600 : 400 }}>{t(`purchasing.sp.n_${v}`)}</span>
        <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{data[VIEW_KEY[v]].length}</span>
      </button>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 28, alignItems: 'start' }}>
        {body}
        <aside data-testid="sp-rail" aria-label={t('purchasing.sp.spent')} style={{ position: 'sticky', top: 24 }}>
          <Hero>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 0 12px' }}>
              <span style={{ fontSize: 14, color: '#6B6259' }}>{t('purchasing.sp.spent')}</span>
              {total}
              {waiting}
            </div>
            {VIEWS.map(fact)}
          </Hero>
        </aside>
        {sheet}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 20, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, alignSelf: 'stretch' }}>
          <span style={{ fontSize: 14, color: '#6B6259' }}>{t('purchasing.sp.spent')}</span>
          {total}
        </div>
        {waiting}
      </div>
      {body}
      {sheet}
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
