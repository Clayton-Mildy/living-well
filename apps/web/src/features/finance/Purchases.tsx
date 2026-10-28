// Spending > Items (KC 28 Oct): every item bought in the page's period, one row per receipt line, so management can recap what was bought
// in each category. A search on the item or brand, Bought at and Category dropdowns; the rows come grouped by category with each subtotal.
// Approved and waiting receipts both count (waiting ones are marked); a row opens its receipt.
import { useMemo, useState } from 'react';
import { actorName, rp, type ISODate, type Receipt, type ReceiptSource, type SpendCategory } from '@cp/shared';
import { filterPurchases, linesTotal, purchases, purchasesByCategory, RECEIPT_SOURCES, SPEND_CATEGORIES, type Purchase } from '@cp/shared/rules/purchasing';
import { sectionName } from '@cp/shared/rules/finance';
import { EmptyState, Icon, ImageOpen, Select, Sheet } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { mediaUrl } from '../../lib/media';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { HAIR, Hero, HeroHead, PGroup, SearchField, hrow, prow } from './parts';

export const OCHRE = '#7A5510'; // waiting for finance (text only, no tints)
const FIRST = 20; // rows shown per category before "Show all"
const MUTED = '#6B6259';
type TFn = ReturnType<typeof useT>;
/** A row's name: the item, or what a whole receipt (no item lines) or the rest of a total (shipping) stands for, so the rows add up to Summary. */
const rowName = (t: TFn, p: Purchase) => (p.kind ? t(`purchasing.pu.${p.kind}`) : p.line.name);
const qtyText = (p: Purchase) => (p.kind ? '' : `${p.line.qty} ${p.line.unit} × ${rp(p.line.unitPrice)}`);

/** The Items tab of Spending: the filters, the summary (in a rail on a laptop) and the rows by category, for the window the page picked. */
export function PurchaseItems({ from, to }: { from: ISODate; to: ISODate }) {
  const s = useClub();
  const t = useT();
  const { isPhone, isLaptop } = useDevice();
  const [q, setQ] = useState('');
  const [source, setSource] = useState<ReceiptSource | ''>('');
  const [category, setCategory] = useState<SpendCategory | ''>('');
  const [all, setAll] = useState<Set<SpendCategory>>(new Set());
  const [open, setOpen] = useState<Purchase | null>(null);

  const rows = useMemo(() => purchases(s, from, to), [s, from, to]);
  const hits = useMemo(() => filterPurchases(rows, { q, source, category }), [rows, q, source, category]);
  const groups = useMemo(() => purchasesByCategory(hits), [hits]);
  const total = hits.reduce((a, p) => a + p.line.amount, 0);
  const waiting = hits.reduce((a, p) => a + (p.waiting ? p.line.amount : 0), 0);
  const filtered = !!(q.trim() || source || category);
  // the recap rail (laptop) counts the period with the search and source applied, but every category, so one can be picked from it
  const recap = useMemo(() => (isLaptop ? purchasesByCategory(filterPurchases(rows, { q, source })) : []), [isLaptop, rows, q, source]);

  // phone and tablet: the count on the left, the total on the right; the laptop's rail stacks them
  const summary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: isLaptop ? 0 : '0 4px' }}>
      <div style={isLaptop ? { display: 'flex', flexDirection: 'column-reverse', gap: 2 } : { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 14, color: '#6B6259' }}>{t('purchasing.nItems', { n: hits.filter((p) => !p.kind).length })}</span>
        <span data-testid="pu-total" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 500, letterSpacing: '-0.5px', color: '#24201C', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(total)}</span>
      </div>
      {waiting ? <span data-testid="pu-waiting" style={{ alignSelf: isLaptop ? 'flex-start' : 'flex-end', fontSize: 13, color: OCHRE }}>{t('purchasing.pu.waitingSum', { amount: rp(waiting) })}</span> : null}
    </div>
  );
  const more = (g: { category: SpendCategory; rows: Purchase[] }, shown: number, style: React.CSSProperties) => (shown < g.rows.length ? (
    <button type="button" className="cp-press" onClick={() => setAll(new Set(all).add(g.category))}
      style={{ ...style, border: 'none', borderTop: HAIR, textAlign: 'left', minHeight: 44, width: '100%', background: 'transparent', color: 'var(--accent, #75624B)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>
      {t('purchasing.pu.showAll', { n: g.rows.length })}
    </button>
  ) : null);
  const list = groups.map((g) => {
    const shown = all.has(g.category) ? g.rows : g.rows.slice(0, FIRST);
    const name = t(`purchasing.cat.${g.category}`);
    // phone: a flat grouped list; tablet and laptop: a card per category, the laptop's rows in columns
    if (isPhone) {
      return (
        <PGroup key={g.category} title={name} meta={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{rp(g.amount)}</span>} label={name} pad={0} gap={0}>
          {shown.map((p, i) => <Row key={p.key} p={p} first={i === 0} onOpen={() => setOpen(p)} />)}
          {more(g, shown.length, prow(false))}
        </PGroup>
      );
    }
    return (
      <Hero key={g.category}>
        <section aria-label={name}>
          <HeroHead title={name} right={<span data-testid="pu-subtotal" style={{ fontSize: 16, fontWeight: 500, color: '#24201C', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{rp(g.amount)}</span>} />
          {isLaptop ? <ColsHead /> : null}
          {shown.map((p) => (isLaptop ? <ColsRow key={p.key} p={p} onOpen={() => setOpen(p)} /> : <WideRow key={p.key} p={p} onOpen={() => setOpen(p)} />))}
          {more(g, shown.length, { padding: '10px 0' })}
        </section>
      </Hero>
    );
  });
  const empty = <EmptyState icon={filtered ? 'search_off' : 'shopping_bag'} title={filtered ? t('common.noResults') : t('purchasing.pu.empty')} />;

  return (
    <>
      {/* phone: search, then the two dropdowns side by side; wider: one row, the search on its own line when the dropdowns would be cut */}
      <div data-testid="pu-filters" style={isPhone ? { display: 'flex', flexDirection: 'column', gap: 8 } : { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={isPhone ? undefined : { flex: '2 1 300px', minWidth: 0, display: 'flex' }}>
          <SearchField value={q} onChange={setQ} label={t('purchasing.pu.search')} placeholder={t('purchasing.pu.search')} width="100%" />
        </div>
        <div style={isPhone ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 } : { flex: '1 1 400px', minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
          <Select<ReceiptSource | 'all'> ariaLabel={t('purchasing.boughtAt')} value={source || 'all'} onChange={(v) => setSource(v === 'all' ? '' : v)}
            options={[{ value: 'all', label: t('purchasing.pu.allSources') }, ...RECEIPT_SOURCES.map((x) => ({ value: x, label: t(`purchasing.src.${x}`) }))]} />
          <Select<SpendCategory | 'all'> ariaLabel={t('purchasing.category')} value={category || 'all'} onChange={(v) => setCategory(v === 'all' ? '' : v)}
            options={[{ value: 'all', label: t('purchasing.allCategories') }, ...SPEND_CATEGORIES.map((c) => ({ value: c, label: t(`purchasing.cat.${c}`) }))]} />
        </div>
      </div>

      {isLaptop ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 28, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{hits.length ? list : empty}</div>
          <aside data-testid="pu-rail" aria-label={t('purchasing.sp.byCategory')} style={{ position: 'sticky', top: 24 }}>
            <Hero>
              <div style={{ padding: '14px 0 12px' }}>{summary}</div>
              {recap.map((g) => {
                const on = category === g.category;
                return (
                  <button key={g.category} type="button" aria-pressed={on} onClick={() => setCategory(on ? '' : g.category)} className="h-row cp-bleed"
                    style={{ ...hrow, padding: '11px 0', display: 'flex', flexDirection: 'column', gap: 5, width: '100%', border: 'none', borderTop: HAIR, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: 'inherit' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, lineHeight: '20px', fontWeight: on ? 600 : 400, color: '#24201C' }}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t(`purchasing.cat.${g.category}`)}</span>
                      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{rp(g.amount)}</span>
                    </span>
                    <span aria-hidden="true" style={{ height: 4, borderRadius: 999, background: 'var(--track, #E8E8EB)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${Math.max(2, Math.round((g.amount / (recap[0]?.amount || 1)) * 100))}%`, height: '100%', borderRadius: 999, background: on || !category ? '#24201C' : '#B9B2AA' }} />
                    </span>
                  </button>
                );
              })}
            </Hero>
          </aside>
        </div>
      ) : hits.length ? (
        <>
          {summary}
          {list}
        </>
      ) : empty}
      <ReceiptSheet p={open} onClose={() => setOpen(null)} />
    </>
  );
}

// laptop: Date · Item · Supplier · Qty × price · Amount
const COLS = '64px minmax(0, 2fr) minmax(0, 1.6fr) minmax(0, 1.1fr) 116px';
const colHead: React.CSSProperties = { fontSize: 12, fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#6B6259' };

function ColsHead() {
  const t = useT();
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 14, padding: '0 0 8px' }}>
      <span style={colHead}>{t('purchasing.pu.date')}</span>
      <span style={colHead}>{t('purchasing.item')}</span>
      <span style={colHead}>{t('purchasing.boughtAt')}</span>
      <span style={colHead}>{t('purchasing.qty')}</span>
      <span style={{ ...colHead, textAlign: 'right' }}>{t('purchasing.amount')}</span>
    </div>
  );
}

function ColsRow({ p, onOpen }: { p: Purchase; onOpen: () => void }) {
  const t = useT();
  const { fd } = useFmt();
  const l = p.line;
  const sub: React.CSSProperties = { fontSize: 13, lineHeight: '18px', color: '#6B6259' };
  return (
    <button type="button" data-testid="pu-row" onClick={onOpen} className="h-row cp-bleed"
      style={{ ...hrow, padding: '11px 0', display: 'grid', gridTemplateColumns: COLS, gap: 14, alignItems: 'baseline', width: '100%', border: 'none', borderTop: HAIR, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: 'inherit' }}>
      <span style={{ fontSize: 14, color: '#6B6259', fontVariantNumeric: 'tabular-nums' }}>{fd(p.date, { day: 'numeric', month: 'short' })}</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 15, lineHeight: '21px', color: p.kind ? MUTED : '#24201C', overflowWrap: 'anywhere' }}>{rowName(t, p)}</span>
        {l.brand || p.waiting ? <span style={sub}>{l.brand}{l.brand && p.waiting ? ' · ' : ''}{p.waiting ? <span style={{ color: OCHRE, fontWeight: 500 }}>{t('purchasing.pu.waiting')}</span> : null}</span> : null}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 14, lineHeight: '20px', color: '#24201C', overflowWrap: 'anywhere' }}>{p.supplier}</span>
        <span style={sub}>{t(`purchasing.src.${p.source}`)}</span>
      </span>
      <span style={{ fontSize: 14, color: '#24201C', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{qtyText(p) || '—'}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: '#24201C', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>{rp(l.amount)}</span>
    </button>
  );
}

/** Tablet: the phone's two lines, inset in the category card. */
function WideRow({ p, onOpen }: { p: Purchase; onOpen: () => void }) {
  return (
    <button type="button" data-testid="pu-row" onClick={onOpen} className="h-row cp-bleed"
      style={{ ...hrow, padding: '12px 0', display: 'block', width: '100%', border: 'none', borderTop: HAIR, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: 'inherit' }}>
      <RowText p={p} />
    </button>
  );
}

function Row({ p, first, onOpen }: { p: Purchase; first: boolean; onOpen: () => void }) {
  return (
    <button type="button" data-testid="pu-row" className="cp-press" onClick={onOpen}
      style={prow(first, { display: 'flex', flexDirection: 'column', gap: 2, minHeight: 44, width: '100%', boxSizing: 'border-box', textAlign: 'left', border: 'none', fontFamily: 'Inter', color: 'inherit', cursor: 'pointer' })}>
      <RowText p={p} />
    </button>
  );
}

/** Item · brand and the amount, then date · supplier · source · qty × price, and Waiting when finance hasn't approved it yet. */
function RowText({ p }: { p: Purchase }) {
  const t = useT();
  const { fd } = useFmt();
  const l = p.line;
  return (
    <>
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', color: p.kind ? MUTED : '#24201C', minWidth: 0, overflowWrap: 'anywhere' }}>{rowName(t, p)}{l.brand ? ` · ${l.brand}` : ''}</span>
        <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, color: '#24201C', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{rp(l.amount)}</span>
      </span>
      <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: '18px', color: '#6B6259', minWidth: 0, overflowWrap: 'anywhere' }}>
        {[fd(p.date, { day: 'numeric', month: 'short' }), p.supplier, t(`purchasing.src.${p.source}`), qtyText(p)].filter(Boolean).join(' · ')}
        {p.waiting ? <span style={{ color: OCHRE, fontWeight: 500 }}> · {t('purchasing.pu.waiting')}</span> : null}
      </span>
    </>
  );
}

/** The receipt a row came from: its photo, who bought it where and when, its status, and every line (the tapped one in bold). */
function ReceiptSheet({ p, onClose }: { p: Purchase | null; onClose: () => void }) {
  const s = useClub();
  const t = useT();
  const { lang, fd } = useFmt();
  const r: Receipt | undefined = p ? s.receipts[p.receiptId] : undefined;
  const facts: [string, string][] = r ? [
    [t('finance.rc.date'), fd(r.date, { day: 'numeric', month: 'long', year: 'numeric' })],
    [t('purchasing.boughtAt'), `${t(`purchasing.src.${r.source ?? 'shop'}`)}${r.orderNo ? ` · ${t('purchasing.orderNo')} ${r.orderNo}` : ''}`],
    [t('finance.budget.section'), sectionName(s, r.sectionId, lang)],
    [t('purchasing.pu.boughtBy'), actorName(s, `staff:${r.by}`)],
  ] : [];
  return (
    <Sheet open={!!r} onClose={onClose} title={r?.supplier ?? ''}>
      {r && p ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KC 28 Oct: the receipt itself, large and whole (a tap opens it full size); a receipt saved without a photo says so */}
          {r.mediaId ? (
            <ImageOpen src={mediaUrl(r.mediaId)} label={`${t('common.openFull')} · ${r.supplier}`} style={{ width: '100%', borderRadius: 14 }}>
              <span className="cp-fill" style={{ display: 'flex', justifyContent: 'center', padding: 12, borderRadius: 14, background: 'var(--fill, #F4F4F5)' }}>
                <img src={mediaUrl(r.mediaId)} alt={t('purchasing.pu.photoOf', { supplier: r.supplier })} data-testid="pu-sheet-photo"
                  style={{ display: 'block', maxWidth: '100%', height: 'auto', maxHeight: 300, objectFit: 'contain', borderRadius: 4, boxShadow: '0 1px 3px rgba(36,32,28,.14)' }} />
              </span>
            </ImageOpen>
          ) : (
            <div data-testid="pu-sheet-nophoto" className="cp-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 72, borderRadius: 14, background: 'var(--fill, #F4F4F5)', color: MUTED, fontSize: 14 }}>
              <Icon name="hide_image" size={20} />{t('purchasing.pu.noPhoto')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span data-testid="pu-sheet-total" style={{ fontSize: 24, lineHeight: '30px', fontWeight: 500, color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{rp(r.amount)}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: p.waiting ? OCHRE : '#2F5A40' }}>{t(p.waiting ? 'purchasing.pu.waitingLong' : 'purchasing.pu.approved')}</span>
            </div>
          </div>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: HAIR, fontSize: 15, lineHeight: '21px' }}>
                <dt style={{ color: '#6B6259', flex: 'none', whiteSpace: 'nowrap' }}>{k}</dt>
                <dd style={{ margin: 0, color: '#24201C', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</dd>
              </div>
            ))}
          </dl>
          <PGroup title={r.lines?.length ? t('purchasing.nItems', { n: r.lines.length }) : undefined} pad={0} gap={0}>
            {!r.lines?.length ? <div data-testid="pu-sheet-whole" style={prow(true, { fontSize: 15, lineHeight: 1.4, color: MUTED })}>{t('purchasing.pu.wholeNote')}</div> : null}
            {(r.lines ?? []).map((l, i) => (
              <div key={l.id} data-testid="pu-sheet-line" aria-current={l.id === p.line.id ? 'true' : undefined} style={prow(i === 0, { display: 'flex', gap: 12, alignItems: 'baseline' })}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.35, color: '#24201C', fontWeight: l.id === p.line.id ? 600 : 400 }}>{l.name}{l.brand ? ` · ${l.brand}` : ''}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.4, color: '#6B6259' }}>{l.qty} {l.unit} × {rp(l.unitPrice)} · {t(`purchasing.cat.${l.category}`)}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: l.id === p.line.id ? 600 : 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(l.amount)}</span>
              </div>
            ))}
            {r.lines?.length && r.amount > linesTotal(r.lines) ? (
              <div data-testid="pu-sheet-extra" aria-current={p.kind === 'extra' ? 'true' : undefined} style={prow(false, { display: 'flex', gap: 12, alignItems: 'baseline' })}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.35, color: MUTED, fontWeight: p.kind === 'extra' ? 600 : 400 }}>{t('purchasing.pu.extra')}</span>
                <span style={{ fontSize: 15, fontWeight: p.kind === 'extra' ? 600 : 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rp(r.amount - linesTotal(r.lines))}</span>
              </div>
            ) : null}
          </PGroup>
        </div>
      ) : null}
    </Sheet>
  );
}
