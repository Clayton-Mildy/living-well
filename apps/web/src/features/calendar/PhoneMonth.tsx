// Phone month view: a compact grid of day cells with coloured dots only (no event text). Tapping a day selects it; the day's items list under the grid.
// The colour key is collapsed behind a small "Key" toggle. Tablet and laptop use the larger grid in Calendar.tsx.
// Round 6 (native look): one flat white group, borderless cells like the iPhone Calendar (the number sits in a circle: today ringed in green, the selected day filled).
import { useId, useMemo, useState } from 'react';
import { addMonths, type ISODate, type YM } from '@cp/shared';
import { monthGrid, type CalKind, type DayInfo } from '@cp/shared/rules/calendar';
import { Button, Icon } from '../../components/ui';
import { useT, useFmt } from '../../lib/i18n';
import { KIND, MON_FIRST, dayState, weekdayName } from './lib';

const DOT_ORDER: CalKind[] = ['closed', 'holiday', 'outing', 'venue', 'guest', 'activity'];
const MAX_DOTS = 4;

export function PhoneMonth({ month, onMonth, today, sel, onSelect, info, hours, legend }: {
  month: YM;
  onMonth: (m: YM) => void;
  today: ISODate;
  sel: string | null;
  /** `on`: the day was already selected (tapping it again clears it) */
  onSelect: (date: ISODate, on: boolean) => void;
  info: (date: ISODate) => DayInfo;
  hours: { open: string; close: string };
  legend: [CalKind, string][];
}) {
  const t = useT();
  const { lang, fdl, fmonth } = useFmt();
  const [key, setKey] = useState(false);
  const keyId = useId();
  const cells = useMemo(() => monthGrid(month), [month]);
  const nav = (dir: 1 | -1, label: string) => (
    <button type="button" className="cp-press" onClick={() => onMonth(addMonths(month, dir))} aria-label={label} style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: '#F3EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#75624B', padding: 0, flex: 'none' }}>
      <Icon name={dir === 1 ? 'chevron_right' : 'chevron_left'} size={22} />
    </button>
  );
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '10px 8px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {nav(-1, t('cal.prevMonth'))}
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C', textAlign: 'center' }}>{fmonth(month, true)}</h2>
        {nav(1, t('cal.nextMonth'))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2 }}>
        {MON_FIRST.map((w) => <div key={w} style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: '20px', color: '#6B6259' }}>{weekdayName(lang, w, 'short')}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={'b' + i} aria-hidden="true" />;
          const x = info(d);
          const st = dayState(t, x, hours);
          const on = sel === d;
          const isToday = d === today;
          const shut = !x.open;
          const hol = x.state === 'holiday';
          const kinds = DOT_ORDER.filter((k) => x.items.some((it) => it.kind === k)).slice(0, MAX_DOTS);
          return (
            <button key={d} type="button" className="cp-press" onClick={() => onSelect(d, on)} aria-label={`${fdl(d)} · ${st.label}`} aria-pressed={on} data-date={d}
              style={{ boxSizing: 'border-box', minWidth: 0, height: 48, padding: 0, borderRadius: 10, border: 'none', background: 'transparent', opacity: shut && !hol && !isToday && !on ? 0.55 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: on ? '#24201C' : isToday ? '#EAF1EC' : hol ? '#FBEDE8' : 'transparent', boxShadow: isToday && !on ? 'inset 0 0 0 1.5px #3D6B4F' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: isToday || on ? 700 : 500, lineHeight: '20px', color: on ? '#FFFFFF' : isToday ? '#2F5A40' : hol ? '#9A3D24' : shut ? '#6B6259' : '#24201C', fontVariantNumeric: 'tabular-nums' }}>{Number(d.slice(8))}</span>
              <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 7 }}>
                {kinds.map((k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 999, background: KIND[k].dot }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="cp-press" onClick={() => setKey((v) => !v)} aria-expanded={key} aria-controls={keyId} style={{ height: 44, padding: '0 12px 0 10px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'Inter' }}>
          <Icon name="info" size={20} />{t('cal.key')}<Icon name={key ? 'expand_less' : 'expand_more'} size={20} />
        </button>
        {month !== today.slice(0, 7) ? <Button variant="ghost" size={44} onClick={() => onMonth(today.slice(0, 7) as YM)}>{t('cal.thisMonth')}</Button> : null}
      </div>
      {key ? (
        <div id={keyId} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '0 6px 6px', fontSize: 'max(14px, var(--cp-small, 0px))', lineHeight: 1.4 }}>
          {legend.map(([k, label]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: KIND[k].dot }} />{label}</span>)}
        </div>
      ) : null}
    </div>
  );
}
