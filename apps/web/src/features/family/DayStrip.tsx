// The day strip (KC round 7): a swipeable row of the member's visit days, newest on the right, each a rounded thumbnail of that day's best
// photo (or a warm tone tile) with the weekday and the day number; today is always there. A calendar button jumps further back.
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ISODate } from '@cp/shared';
import type { StripDay } from '@cp/shared/rules/family';
import { DateField, Icon, PhotoImg, photoBg } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useFamilyCtx } from './useFamily';

const TILE_W = 56;
const TILE_H = 68;

export function DayStrip({ days, selected, tone, onPick }: { days: StripDay[]; selected: ISODate; tone: number; onPick: (d: ISODate) => void }) {
  const { t, fmt, now } = useFamilyCtx();
  const { isPhone } = useDevice();
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // keep the selected day in view (a quiet jump the first time, a smooth glide afterwards); `inline` only: the page itself never scrolls
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!el) return;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [selected, days.length]);
  const bleed = isPhone ? 16 : 0;
  return (
    <div role="group" aria-label={t('family.storyStrip')} data-testid="day-strip" style={{ margin: `0 -${bleed}px` }}>
      <div ref={box} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: `6px ${bleed || 4}px 8px`, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
        {days.map((d, i) => {
          const on = d.date === selected;
          const newMonth = i === 0 || d.date.slice(0, 7) !== days[i - 1].date.slice(0, 7);
          const isToday = d.date === now.today;
          const label = fmt.fd(d.date, { weekday: 'short' }).replace(/\.$/, '');
          return (
            <Fragment key={d.date}>
            {newMonth ? <span aria-hidden="true" style={{ flex: 'none', alignSelf: 'flex-start', height: TILE_H, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#A89C8E', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{fmt.fd(d.date, { month: 'short' }).replace(/\.$/, '')}</span> : null}
            <button type="button" data-date={d.date} data-selected={on} aria-current={on ? 'date' : undefined} aria-label={fmt.fdl(d.date)} onClick={() => onPick(d.date)} className="cp-press"
              style={{ flex: 'none', width: TILE_W + 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'Inter', scrollSnapAlign: 'center' }}>
              <span style={{ width: TILE_W, height: TILE_H, borderRadius: 18, overflow: 'hidden', position: 'relative', display: 'block', flex: 'none',
                background: d.visited ? photoBg(d.photo?.tone ?? tone) : 'transparent', border: d.visited ? 'none' : '1.5px dashed #D3C7B8', opacity: on || d.visited ? 1 : 0.9,
                boxShadow: on ? '0 0 0 2px #FFFFFF, 0 0 0 4px #24201C' : 'none', transition: 'box-shadow .15s' }}>
                {d.photo ? <PhotoImg photo={d.photo} /> : null}
                {/* how many photos the day has, so a tile still says something before real pictures load (or in a demo without them) */}
                {d.visited && d.count > 0 ? (
                  <span aria-hidden="true" style={{ position: 'absolute', right: 5, bottom: 5, display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px 1px 4px', borderRadius: 999, background: 'rgba(36,32,28,0.55)', color: '#FFFFFF', fontSize: 11, lineHeight: '16px', fontWeight: 600 }}>
                    <Icon name="photo_camera" size={11} fill={1} color="#FFFFFF" />{d.count}
                  </span>
                ) : null}
                {!d.visited ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="today" size={22} color="#A89C8E" weight={300} /></span> : null}
              </span>
              <span style={{ fontSize: 12, lineHeight: '14px', color: on ? '#24201C' : '#8A8078', fontWeight: on ? 600 : 500 }}>{isToday ? t('common.today') : label}</span>
              <span style={{ fontSize: 16, lineHeight: '18px', color: on ? '#24201C' : '#6B6259', fontWeight: on ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>{+d.date.slice(8, 10)}</span>
            </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The calendar button: a round icon over a real DateField (invisible, same tap area) limited to the days the member came and today, so the
 * date picker, its keyboard handling and its phone sheet are the app's own.
 */
export function DayPicker({ value, visits, today, onPick }: { value: ISODate; visits: Set<ISODate>; today: ISODate; onPick: (d: ISODate) => void }) {
  const { t } = useFamilyCtx();
  const [focus, setFocus] = useState(false);
  const min = Array.from(visits).sort()[0] || today;
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flex: 'none', borderRadius: 999, background: '#F3EEE8', boxShadow: focus ? '0 0 0 2px #FFFFFF, 0 0 0 4px #24201C' : 'none' }}
      onFocusCapture={() => setFocus(true)} onBlurCapture={() => setFocus(false)} data-testid="day-picker">
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <Icon name="calendar_month" size={22} color="#75624B" />
      </span>
      <div style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden', borderRadius: 999 }}>
        <DateField ariaLabel={t('family.storyPickDay')} value={value} onChange={(v) => { if (v) onPick(v); }} min={min < today ? min : today} max={today} disabledDate={(d) => d !== today && !visits.has(d)} />
      </div>
    </div>
  );
}
