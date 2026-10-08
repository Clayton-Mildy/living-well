// New stock request (design "New request" card), used on the Stock screen and in the Requests screen.
import { useState } from 'react';
import type { StockRequest } from '@cp/shared';
import { KNOWN_UNITS, STOCK_AREAS, defaultSectionFor } from '@cp/shared/rules/kitchenOps';
import { GROUP_HEAD, Note } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useLang, type TFn } from '../../lib/i18n';
import { useAct } from '../../lib/act';
import { useClub } from '../../store/replica';
import { ChoiceChip, PillButton, bronzeInput, cardLabel, useResetOn } from './parts';

export const areaLabel = (t: TFn, a: StockRequest['area']) => t('kitchen.area.' + a);
export const unitLabel = (t: TFn, u: string) => (KNOWN_UNITS.includes(u) ? t('kitchen.unit.' + u) : u);
export const useQty = () => {
  const lang = useLang();
  return (n: number) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 2 });
};
export const parseQty = (v: string) => Number(v.trim().replace(',', '.'));

export interface StockPrefill { item: string; qty: number; unit: string; area: StockRequest['area'] }

export function StockForm({ defaultArea, onSent, prefill, title }: { defaultArea: StockRequest['area']; onSent?: () => void; prefill?: StockPrefill | null; title?: string }) {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const act = useAct();
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [area, setArea] = useState<StockRequest['area']>(defaultArea);
  const [busy, setBusy] = useState(false);
  useResetOn(prefill, () => {
    if (!prefill) return;
    setItem(prefill.item); setQty(String(prefill.qty)); setUnit(prefill.unit); setArea(prefill.area);
  });
  const sectionId = defaultSectionFor(s, area);
  const n = parseQty(qty);
  const ok = !!item.trim() && Number.isFinite(n) && n > 0 && !!unit.trim() && !!sectionId;
  const send = async () => {
    if (!ok || busy || !sectionId) return;
    setBusy(true);
    const r = await act('stock.request', { item, qty: n, unit, area, sectionId }, { ok: t('kitchen.stock.sent') });
    setBusy(false);
    if (r.ok) { setItem(''); setQty(''); setUnit('pcs'); onSent?.(); }
  };
  // round 6, phone: the title sits outside a flat white group; item, then quantity | unit as plain rows with hairlines, soft pill chips, and a full-width send pill
  if (isPhone) {
    const line: React.CSSProperties = { ...bronzeInput, height: 50, border: 'none', borderRadius: 0, padding: '0 16px', background: 'transparent', width: '100%' };
    const chip = (on: boolean): React.CSSProperties => ({ height: 36, flex: 'none', padding: '0 14px', borderRadius: 999, border: 'none', background: on ? '#24201C' : '#F3EEE8', color: on ? '#FFFFFF' : '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap' });
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ padding: '0 16px' }}><div style={GROUP_HEAD}>{title ?? t('kitchen.stock.new')}</div></div>
        <div style={{ background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('kitchen.stock.item')} aria-label={t('kitchen.stock.item')} maxLength={80} style={line} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #EFEAE3' }}>
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('kitchen.stock.qty')} aria-label={t('kitchen.stock.qty')} inputMode="decimal" maxLength={8} style={line} />
            <input value={unitLabel(t, unit)} onChange={(e) => setUnit(e.target.value)} placeholder={t('kitchen.stock.unit')} aria-label={t('kitchen.stock.unit')} maxLength={24} style={{ ...line, borderLeft: '1px solid #EFEAE3' }} />
          </div>
          <div className="scroll-x" style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid #EFEAE3', scrollbarWidth: 'none' }} role="group" aria-label={t('kitchen.stock.unit')}>
            {KNOWN_UNITS.map((u) => (
              <button key={u} type="button" className="cp-press" aria-pressed={unit === u} onClick={() => setUnit(u)} style={chip(unit === u)}>{t('kitchen.unit.' + u)}</button>
            ))}
          </div>
          <div className="scroll-x" style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid #EFEAE3', scrollbarWidth: 'none' }} role="group" aria-label={t('kitchen.stock.area')}>
            {STOCK_AREAS.map((a) => (
              <button key={a} type="button" className="cp-press" aria-pressed={area === a} onClick={() => setArea(a)} style={chip(area === a)}>{areaLabel(t, a)}</button>
            ))}
          </div>
          {/* a grid, not a flex column: a growing flex item in a column collapses to its text height */}
          <div style={{ padding: '4px 16px 16px', display: 'grid', gap: 10 }}>
            <PillButton on={ok && !busy} onClick={send} height={50}>{t('kitchen.stock.send')}</PillButton>
            {!sectionId ? <Note tone="ochre" icon="info">{t('kitchen.stock.noSection')}</Note> : null}
          </div>
        </div>
      </section>
    );
  }
  return (
    <div className="cp-card-pad" style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={cardLabel}>{title ?? t('kitchen.stock.new')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('kitchen.stock.item')} aria-label={t('kitchen.stock.item')} maxLength={80} style={{ ...bronzeInput, flex: '2 1 220px' }} />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('kitchen.stock.qty')} aria-label={t('kitchen.stock.qty')} inputMode="decimal" maxLength={8} style={{ ...bronzeInput, flex: '1 1 120px' }} />
        <input value={unitLabel(t, unit)} onChange={(e) => setUnit(e.target.value)} placeholder={t('kitchen.stock.unit')} aria-label={t('kitchen.stock.unit')} maxLength={24} style={{ ...bronzeInput, flex: '1 1 120px' }} />
      </div>
      {/* phone: the unit and section chips are one scrolling row each, not a wrapped wall */}
      <div className={isPhone ? 'scroll-x' : undefined} style={{ display: 'flex', flexWrap: isPhone ? 'nowrap' : 'wrap', gap: 6, ...(isPhone ? { margin: '0 -16px', padding: '0 16px', scrollbarWidth: 'none' } : {}) }} role="group" aria-label={t('kitchen.stock.unit')}>
        {KNOWN_UNITS.map((u) => (
          <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}
            style={{ height: isPhone ? 38 : 44, flex: 'none', padding: '0 14px', borderRadius: 12, border: unit === u ? '1px solid #24201C' : '1px solid #DCD3C8', background: unit === u ? '#24201C' : '#FFFFFF', color: unit === u ? '#FFFFFF' : '#24201C', fontSize: 'max(14px, var(--cp-body, 0px))', cursor: 'pointer', fontFamily: 'Inter' }}>
            {t('kitchen.unit.' + u)}
          </button>
        ))}
      </div>
      <div className={isPhone ? 'scroll-x' : undefined} style={{ display: 'flex', flexWrap: isPhone ? 'nowrap' : 'wrap', gap: isPhone ? 6 : 8, alignItems: 'center', ...(isPhone ? { margin: '0 -16px', padding: '0 16px', scrollbarWidth: 'none' } : {}) }} role="group" aria-label={t('kitchen.stock.area')}>
        {STOCK_AREAS.map((a) => <ChoiceChip key={a} label={areaLabel(t, a)} selected={area === a} onClick={() => setArea(a)} />)}
        {isPhone ? null : <><div style={{ flex: 1 }} /><PillButton on={ok && !busy} onClick={send}>{t('kitchen.stock.send')}</PillButton></>}
      </div>
      {isPhone ? <PillButton on={ok && !busy} onClick={send}>{t('kitchen.stock.send')}</PillButton> : null}
      {!sectionId ? <Note tone="ochre" icon="info">{t('kitchen.stock.noSection')}</Note> : null}
    </div>
  );
}
