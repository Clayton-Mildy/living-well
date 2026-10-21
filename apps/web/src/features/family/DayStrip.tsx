// The day strip (round 8): the last days as 44px circles with the weekday above. A day the parent came is filled with that day's best picture (a scrim keeps the
// number readable), the day being read is ink, today has a ring; KC round 10: only days they came are shown (plus today, a grey outline when they stayed home).
// KC round 9: the day ahead goes last ("Tomorrow", or Monday after a Friday) as a dashed circle, so families can see tomorrow's plan.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ISODate } from '@cp/shared';
import type { StripDay } from '@cp/shared/rules/family';
import { addDays } from '@cp/shared';
import { DateField, Icon, PhotoImg } from '../../components/ui';
import { F } from './kit';
import { useFamilyCtx } from './useFamily';

const SCRIM = 'rgba(28,22,16,.4)';
const BRONZE = 'linear-gradient(160deg, #B3A28A 0%, #75624B 100%)';

/**
 * `picker`: the calendar button, last in the row (a day older than the strip).
 * `tiles` (round 8c, the laptop under Today's picture): six rounded grey tiles, the day's circle and its weekday side by side; the day being read is a
 * darker tile.
 */
export function DayStrip({ days, selected, onPick, picker, tiles }: { days: StripDay[]; selected: ISODate; onPick: (d: ISODate) => void; picker?: ReactNode; tiles?: boolean }) {
  const { t, fmt, now } = useFamilyCtx();
  /** "Tomorrow", or the day's name when the next open day is further away (Monday after a Friday) */
  const planWord = (d: ISODate) => (d === addDays(now.today, 1) ? t('common.tomorrow') : fmt.fd(d, { weekday: 'short' }).replace(/\.$/, ''));
  if (tiles) {
    return (
      <div role="group" aria-label={t('family.storyStrip')} data-testid="day-strip" data-layout="tiles" style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: 6 }}>
        {days.map((d) => {
          const on = d.date === selected;
          const isToday = d.date === now.today;
          const photo = !on && d.visited && d.photo?.mediaId ? d.photo : null;
          const filled = !on && d.visited;
          const ahead = !!d.plan && !on;
          return (
            <button key={d.date} type="button" data-date={d.date} data-selected={on} data-visited={d.visited} data-plan={d.plan || undefined} aria-pressed={on} aria-current={isToday ? 'date' : undefined} aria-label={d.plan ? `${planWord(d.date)} · ${fmt.fdl(d.date)}` : fmt.fdl(d.date)} onClick={() => onPick(d.date)} className="cp-fam-press"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', border: 'none', borderRadius: 16, background: on ? F.press : '#F7F7F8', cursor: 'pointer', fontFamily: 'Inter', minWidth: 0 }}>
              <span style={{ position: 'relative', width: 40, height: 40, borderRadius: 999, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                background: on ? F.ink : filled ? BRONZE : '#FFFFFF', color: on || filled ? '#FFFFFF' : '#8A8078', fontSize: 14, fontWeight: 600,
                boxShadow: isToday && !on ? `0 0 0 2px #F7F7F8, 0 0 0 3.5px ${F.bronze}` : !on && !filled && !ahead ? `inset 0 0 0 1.5px ${F.line}` : 'none', border: ahead ? `1.5px dashed ${F.bronze}` : undefined, boxSizing: 'border-box' }}>
                {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={photo} /></span> : null}
                {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SCRIM }} /> : null}
                <span style={{ position: 'relative', fontVariantNumeric: 'tabular-nums', textShadow: filled ? '0 1px 2px rgba(0,0,0,.4)' : 'none' }}>{+d.date.slice(8, 10)}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: F.soft, whiteSpace: 'nowrap' }}>{d.plan ? planWord(d.date) : fmt.fd(d.date, { weekday: 'short' }).replace(/\.$/, '')}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="group" aria-label={t('family.storyStrip')} data-testid="day-strip" style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length + (picker ? 1 : 0)}, minmax(0, 1fr))`, gap: 4, padding: '0 4px' }}>
      {days.map((d) => {
        const on = d.date === selected;
        const isToday = d.date === now.today;
        const label = isToday ? t('common.today') : d.plan ? planWord(d.date) : fmt.fd(d.date, { weekday: 'short' }).replace(/\.$/, '');
        const photo = !on && d.visited && d.photo?.mediaId ? d.photo : null;
        const filled = !on && d.visited;
        const ahead = !!d.plan && !on;
        return (
          <button key={d.date} type="button" data-date={d.date} data-selected={on} data-visited={d.visited} data-plan={d.plan || undefined} aria-pressed={on} aria-current={isToday ? 'date' : undefined} aria-label={d.plan ? `${planWord(d.date)} · ${fmt.fdl(d.date)}` : fmt.fdl(d.date)} onClick={() => onPick(d.date)} className="cp-press"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'Inter', minWidth: 0 }}>
            <span style={{ fontSize: 12, lineHeight: '14px', color: on ? F.ink : F.muted, fontWeight: on ? 600 : 500 }}>{label}</span>
            <span style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              background: on ? F.ink : filled ? BRONZE : 'transparent', color: on || filled ? '#FFFFFF' : ahead ? F.bronze : '#8A8078', fontSize: 15, fontWeight: 600,
              boxShadow: isToday && !on ? `0 0 0 2px #FFFFFF, 0 0 0 3.5px ${F.bronze}` : !on && !filled && !ahead ? `inset 0 0 0 1.5px ${F.line}` : 'none', border: ahead ? `1.5px dashed ${F.bronze}` : undefined, boxSizing: 'border-box' }}>
              {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={photo} /></span> : null}
              {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SCRIM }} /> : null}
              <span style={{ position: 'relative', fontVariantNumeric: 'tabular-nums', textShadow: filled ? '0 1px 2px rgba(0,0,0,.4)' : 'none' }}>{+d.date.slice(8, 10)}</span>
            </span>
          </button>
        );
      })}
      {picker ? <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ height: 14 }} />{picker}</span> : null}
    </div>
  );
}

/**
 * The day picker: a real DateField (invisible, same tap area) under a visible face, limited to the days the member came and today, so the date
 * picker, its keyboard handling and its phone sheet are the app's own. `chip` (round 8, Today's header): a frosted "📅 Tue 13 Oct" chip floating
 * on the day's picture; without it, a round grey calendar button.
 */
export function DayPicker({ value, visits, today, onPick, chip }: { value: ISODate; visits: Set<ISODate>; today: ISODate; onPick: (d: ISODate) => void; chip?: string }) {
  const { t } = useFamilyCtx();
  const [focus, setFocus] = useState(false);
  const min = Array.from(visits).sort()[0] || today;
  const ring = focus ? (chip ? '0 0 0 2px #FFFFFF' : '0 0 0 2px #FFFFFF, 0 0 0 4px #24201C') : 'none';
  const box: CSSProperties = chip
    ? { pointerEvents: 'auto', position: 'relative', height: 36, padding: '0 14px 0 10px', flex: 'none', borderRadius: 999, background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: ring }
    : { position: 'relative', width: 44, height: 44, flex: 'none', borderRadius: 999, background: F.fill, boxShadow: ring };
  return (
    <div style={box} onFocusCapture={() => setFocus(true)} onBlurCapture={() => setFocus(false)} data-testid="day-picker">
      {chip ? (
        <span aria-hidden="true" style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 6, color: '#FFFFFF', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <Icon name="calendar_today" size={18} color="#FFFFFF" />{chip}
        </span>
      ) : (
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Icon name="calendar_month" size={22} color={F.text} />
        </span>
      )}
      <div style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden', borderRadius: 999 }}>
        <DateField ariaLabel={t('family.storyPickDay')} value={value} onChange={(v) => { if (v) onPick(v); }} min={min < today ? min : today} max={today} disabledDate={(d) => d !== today && !visits.has(d)} />
      </div>
    </div>
  );
}
