// Family Calendar, Month view: a soft grey panel with a 7-column grid of rounded cells. A day a parent came shows that day's best family photo under a dark
// scrim; closed days and holidays are ochre; weekends fade. Round 8d: the selected day keeps its own look (its photo, ochre or white) and gets a ring (2px white
// gap, 2.5px ink) with its number in a small ink circle; today's number sits in a bronze circle, so today and the selection never look alike and a selected today shows
// both. The ‹ month › row is the page's (PeriodNav).
// Round 8c, on a laptop (the prototype's desktop): the weekday NAMES (Mon … Sun) over wider cells (aspect 1.15, radius 14, 6px gaps), the day number top left.
import { useMemo } from 'react';
import type { ISODate, Photo, YM } from '@cp/shared';
import { addDays, displayName, type Member } from '@cp/shared';
import { famMonth, type FamMonthCell } from '@cp/shared/rules/famCalendar';
import { PhotoImg } from '../../../components/ui';
import { useFamilyCtx } from '../useFamily';
import { F, useFamWide } from '../kit';
import { nameList, SELECT_RING } from './bits';
import { CameFaces } from '../ParentSwitch';

const WEEK_REF = '2026-10-12'; // a Monday: only used to get the narrow weekday letters in the language

export function MonthPanel({ month, who, faces, date, onPick }: { month: YM; who: string[]; /** round 11: several parents — a day shows tiny faces for who came */ faces?: boolean; date: ISODate; onPick: (d: ISODate) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const { today } = now;
  const wide = useFamWide();
  const whoKey = who.join(',');
  const cells = useMemo(() => famMonth(s, who, month, today), [s, whoKey, month, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const letters = Array.from({ length: 7 }, (_, i) => fmt.fd(addDays(WEEK_REF, i), { weekday: wide ? 'short' : 'narrow' }));
  const names = nameList(fmt.lang, who.map((id) => displayName(s.members[id])).filter(Boolean), 'disjunction');
  const stateLabel = (c: FamMonthCell) => (c.state === 'closed' ? t('cal.stClosed') : c.state === 'holiday' ? t('cal.stHoliday') : c.state === 'weekend' ? t('cal.stWeekend') : '');
  const cameOf = (c: FamMonthCell): Member[] => (faces ? c.came.map((id) => s.members[id]).filter(Boolean) : []);
  const label = (c: FamMonthCell) => [fmt.fdl(c.date), stateLabel(c), faces && c.came.length ? `${nameList(fmt.lang, cameOf(c).map(displayName))} ${t('fcal.cameDay')}` : c.visited ? t('fcal.cameDay') : ''].filter(Boolean).join(' · ');

  return (
    <div data-testid="cal-month" style={{ background: F.fill, borderRadius: 26, padding: wide ? 16 : 12, display: 'flex', flexDirection: 'column', gap: wide ? 8 : 6, margin: wide ? 0 : '0 -6px' }}>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: wide ? 6 : 0, textAlign: wide ? 'left' : 'center', fontSize: 12, fontWeight: wide ? 600 : 500, color: F.muted }}>
        {letters.map((l, i) => <span key={i} style={wide ? { paddingLeft: 10 } : undefined}>{l}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: wide ? 8 : 6 }}>
        {cells.map((c, i) => c ? <Cell key={c.date} c={c} faces={cameOf(c)} sel={c.date === date} today={c.date === today} label={label(c)} onPick={onPick} wide={wide} /> : <span key={'b' + i} aria-hidden="true" />)}
      </div>
      <span style={{ fontSize: wide ? 13 : 12, color: F.muted, padding: wide ? '4px 6px 0' : '4px 2px 0', lineHeight: 1.4 }}>{t('fcal.legend', { names })}</span>
    </div>
  );
}

function Cell({ c, faces, sel, today, label, onPick, wide }: { c: FamMonthCell; faces: Member[]; sel: boolean; today: boolean; label: string; onPick: (d: ISODate) => void; wide: boolean }) {
  const { t } = useFamilyCtx();
  const photo: Photo | null = c.photo;
  const shut = c.state === 'closed' || c.state === 'holiday';
  const weekend = c.state === 'weekend';
  const bg = photo ? F.sand : shut ? F.ochreBg : weekend ? 'transparent' : '#FFFFFF';
  const fg = photo ? '#FFFFFF' : shut ? F.ochre : F.text;
  // the number: plain; in an ink circle when selected; in a bronze circle on today
  const disc = today ? F.bronze : sel ? F.ink : null;
  const size = wide ? 24 : 22;
  return (
    <button type="button" onClick={() => onPick(c.date)} aria-label={today ? `${label} · ${t('common.today')}` : label} aria-pressed={sel} aria-current={today ? 'date' : undefined} data-testid="cal-cell" data-date={c.date} data-photo={photo ? '1' : '0'} data-state={c.state} data-visited={c.visited ? '1' : '0'} data-came={c.came.length ? c.came.join(',') : undefined} data-today={today ? '1' : '0'} className="cp-press"
      style={{ position: 'relative', zIndex: sel ? 1 : 0, aspectRatio: wide ? '1.15' : '1', border: 'none', borderRadius: wide ? 14 : 12, padding: 0, overflow: 'hidden', background: bg, boxShadow: sel ? SELECT_RING : 'none', opacity: weekend && !sel ? 0.4 : 1, cursor: 'pointer', color: fg, display: 'flex', alignItems: wide ? 'flex-start' : 'flex-end', justifyContent: 'flex-start', minWidth: 0 }}>
      {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><PhotoImg photo={photo} /></span> : null}
      {photo ? <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,16,.32)' }} /> : null}
      {faces.length ? <span style={{ position: 'absolute', top: wide ? 8 : 4, right: wide ? 8 : 4, display: 'flex' }}><CameFaces members={faces} size={wide ? 16 : 12} /></span>
        : c.visited && !photo ? <span aria-hidden="true" style={{ position: 'absolute', top: wide ? 10 : 6, right: wide ? 10 : 6, width: 6, height: 6, borderRadius: 999, background: F.bronze }} /> : null}
      <span style={{ position: 'relative', margin: wide ? 6 : 4, minWidth: size, height: size, boxSizing: 'border-box', padding: disc ? '0 4px' : '0 2px', borderRadius: 999, background: disc ?? 'transparent', color: disc ? '#FFFFFF' : fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: wide ? 14 : 13, lineHeight: 1, fontWeight: sel || today ? 700 : 500, fontVariantNumeric: 'tabular-nums', textShadow: photo && !disc ? '0 1px 2px rgba(0,0,0,.5)' : 'none' }}>{Number(c.date.slice(8))}</span>
    </button>
  );
}
