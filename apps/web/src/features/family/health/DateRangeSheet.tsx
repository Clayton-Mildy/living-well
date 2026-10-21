// Round 8 (the prototype's "Date range" sheet): quick ranges, the From / To boxes and one month calendar. Tap the first day, then the last;
// Done applies them. Days after today cannot be picked; the months run from the first reading to this month.
import { useState } from 'react';
import { addMonths, daysInMonth, ym, type ISODate } from '@cp/shared';
import { monthCells, pickDay, quickRanges, type RangePick } from '@cp/shared/rules/famHealth';
import { Icon } from '../../../components/ui';
import { F, FamSheet } from '../kit';
import { useFamilyCtx } from '../useFamily';

export function DateRangeSheet({ from, to, pick: start, today, firstDate, onClose, onApply }: {
  from: ISODate; to: ISODate; pick: 'from' | 'to'; today: ISODate; firstDate?: ISODate | null; onClose: () => void; onApply: (w: { from: ISODate; to: ISODate }) => void;
}) {
  const { t, fmt } = useFamilyCtx();
  const [st, setSt] = useState<RangePick>({ from, to, pick: start });
  const [month, setMonth] = useState(ym(start === 'from' ? from : to));
  const lo = firstDate && firstDate <= today ? ym(firstDate) : addMonths(ym(today), -12), hi = ym(today);
  const ready = !!st.from && !!st.to;
  const label = (d: ISODate | null) => (d ? fmt.fdy(d) : t('fhealth.pickDay'));
  const quick = quickRanges(today, firstDate);
  const apply = (w: { from: ISODate; to: ISODate }) => onApply(w);
  const cell = (d: number) => {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    const future = day > today;
    const edge = day === st.from || day === st.to;
    const inside = !!st.from && !!st.to && st.from !== st.to && day >= st.from && day <= st.to;
    const col = (monthCells(month).indexOf(d) % 7);
    const left = day === st.from || col === 0 || d === 1, right = day === st.to || col === 6 || d === daysInMonth(month);
    return (
      <span key={d} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: inside ? F.press : 'transparent', borderRadius: `${left ? 999 : 0}px ${right ? 999 : 0}px ${right ? 999 : 0}px ${left ? 999 : 0}px` }}>
        <button type="button" disabled={future} aria-pressed={edge} aria-label={fmt.fdl(day)} onClick={() => setSt((x) => pickDay(x, day))} data-day={day}
          style={{ width: 38, height: 38, border: 'none', borderRadius: 999, background: edge ? F.ink : 'transparent', color: edge ? '#FFFFFF' : F.text, fontSize: 15, fontWeight: edge ? 600 : 400, opacity: future ? 0.3 : 1, cursor: future ? 'default' : 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
          {d}
        </button>
      </span>
    );
  };
  const box = (which: 'from' | 'to', cap: string, d: ISODate | null) => (
    <button type="button" onClick={() => { setSt((x) => ({ ...x, pick: which })); const t0 = d ?? (which === 'from' ? st.to : st.from); if (t0) setMonth(ym(t0)); }} aria-pressed={st.pick === which}
      style={{ height: 48, borderRadius: 14, border: 'none', background: '#FFFFFF', boxShadow: st.pick === which ? `inset 0 0 0 2px ${F.ink}` : `inset 0 0 0 1px ${F.line}`, padding: '0 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', minWidth: 0 }}>
      <span style={{ fontSize: 11, color: F.muted, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>{cap}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: F.text, whiteSpace: 'nowrap' }}>{label(d)}</span>
    </button>
  );
  const arrow = (dir: -1 | 1) => {
    const next = addMonths(month, dir);
    const off = next < lo || next > hi;
    return (
      <button type="button" disabled={off} onClick={() => setMonth(next)} aria-label={t(dir < 0 ? 'common.prevMonth' : 'common.nextMonth')}
        style={{ width: 36, height: 36, border: 'none', borderRadius: 999, background: 'transparent', cursor: off ? 'default' : 'pointer', opacity: off ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <Icon name={dir < 0 ? 'chevron_left' : 'chevron_right'} size={24} color={F.bronze} />
      </button>
    );
  };
  const dows = Array.from({ length: 7 }, (_, i) => fmt.fd(`2024-01-0${i + 1}`, { weekday: 'narrow' }));
  return (
    <FamSheet open onClose={onClose} title={t('fhealth.dateRange')} testId="range-sheet" action={{ label: t('fam.done'), disabled: !ready, onClick: () => { if (st.from && st.to) apply({ from: st.from, to: st.to }); } }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={() => apply({ from: q.from, to: q.to })} data-quick={q.key} className="cp-press"
            style={{ height: 36, border: 'none', borderRadius: 999, background: F.fill, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', color: F.text, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {q.key === 'since' ? t('fhealth.qSince', { m: fmt.fmonth(q.month!) }) : t('fhealth.q' + q.key[0].toUpperCase() + q.key.slice(1))}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {box('from', t('health.rangeFrom'), st.from)}
        {box('to', t('health.rangeTo'), st.to)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px 0' }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: F.text }}>{fmt.fmonth(month, true)}</span>
        <span style={{ display: 'flex', gap: 6 }}>{arrow(-1)}{arrow(1)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 12, fontWeight: 500, color: F.muted }}>{dows.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
        {monthCells(month).map((d, i) => (d === null ? <span key={`e${i}`} /> : cell(d)))}
      </div>
      <span style={{ fontSize: 13, color: F.muted }}>{t(st.pick === 'from' ? 'fhealth.hintFrom' : 'fhealth.hintTo')}</span>
    </FamSheet>
  );
}
