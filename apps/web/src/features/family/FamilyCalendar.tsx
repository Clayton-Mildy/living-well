// Family Calendar (round 8, the "CitraPremier Family App" prototype): List | Month. The big title is always "Calendar" (List | Month on its right); the period
// (`‹ October 2026 ›`, or the week) is a row of its own below. List is the week's open days as tiles (round 8d: the selected day has a ring, today says "Today"); Month is a grey panel where the days a parent came show
// that day's best family photo. Either way the selected day's agenda follows (sessions, lunch and tea, who joined in, the pictures). On a laptop the month
// panel (or the week as five rows) sits LEFT and sticks while the day's agenda scrolls on the RIGHT (round 8c: 1.25fr / 1fr, the closure notice under the agenda).
// Round 11 (KC: the two-parent navigation): the shared parent switch on the title row (Both, or one parent's visits and agenda); with both chosen a day shows
// tiny faces for who came, one parent chosen shows their visits alone. On a phone the List | Month control is a full-width row under the title, since the
// title row holds the switch. `?date=YYYY-MM-DD` selects a day, `?view=month` opens the month.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, dayStatus, dow, isWeekday, memberName, displayName, nextOpenDay, ym, type ISODate, type Member, type Photo, type YM } from '@cp/shared';
import { eventTitle, mondayOf, upcomingClosures } from '@cp/shared/rules/calendar';
import { cameByDay, famDay, famRange, famWeek } from '@cp/shared/rules/famCalendar';
import { Icon } from '../../components/ui';
import { PhotoViewer } from '../activity/PhotoViewer';
import { Cols, F, FamPage, LargeTitle, Seg, useFamWide } from './kit';
import { useFamilyCtx, useFamilySel } from './useFamily';
import { CameFaces, ParentSwitch } from './ParentSwitch';
import { nameList } from './calendar/bits';
import { Agenda } from './calendar/Agenda';
import { SELECT_RING } from './calendar/bits';
import { MonthPanel } from './calendar/MonthPanel';
import { PeriodNav } from './calendar/PeriodNav';
import { WeekRows } from './calendar/WeekRows';

type View = 'list' | 'month';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function FamilyCalendar() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const { today, nowMin } = now;
  const [sp] = useSearchParams();
  const { choices, sel, who, setSel, multi } = useFamilySel();
  const whoKey = who.join(',');
  const range = useMemo(() => famRange(s, who, today), [s, whoKey, today]); // eslint-disable-line react-hooks/exhaustive-deps
  // the day to open on: today, or the next open day when it is a weekend
  const home: ISODate = isWeekday(today) ? today : nextOpenDay(s, today);
  const asked = sp.get('date');
  const askedDate = asked && ISO_DAY.test(asked) ? asked : null;
  const askedView = sp.get('view');
  const [view, setView] = useState<View>(askedView === 'month' ? 'month' : 'list');
  const [date, setDate] = useState<ISODate>(askedDate ?? home);
  const [month, setMonth] = useState<YM>(ym(askedDate ?? home));
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  // a link (a notification, the Today screen) can pick the day or the view
  useEffect(() => {
    if (askedDate) { setDate(askedDate); setMonth(ym(askedDate)); }
    if (askedView === 'month' || askedView === 'list') setView(askedView);
  }, [askedDate, askedView]);

  const day = useMemo(() => famDay(s, who, date, today, nowMin), [s, whoKey, date, today, nowMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = useMemo(() => upcomingClosures(s, today, 60)[0], [s, today]);
  const wide = useFamWide();
  const monday = mondayOf(date);
  const weekDays = useMemo(() => (wide ? famWeek(s, who, monday, today, nowMin) : []), [wide, s, whoKey, monday, today, nowMin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !who.length) return null;

  const week = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const came = cameByDay(s, who, today); // KC round 10: a dot on the days a parent came; round 11: who, as tiny faces when there are several parents
  const faces = (d: ISODate): Member[] => (who.length > 1 ? (came.get(d) ?? []).map((id) => s.members[id]).filter(Boolean) : []); // one parent chosen: the dot
  const switcher = multi ? <ParentSwitch tone="page" members={choices.map((id) => s.members[id]).filter(Boolean)} sel={sel} onPick={setSel} /> : undefined;
  const whoName = multi && sel !== 'both' && s.members[sel] ? memberName(s.members[sel]) : undefined;
  const currentWeek = monday === mondayOf(isWeekday(today) ? today : home);
  const canPrevWeek = addDays(monday, -3) >= `${range.min}-01`;
  const canNextWeek = addDays(monday, 7) <= `${range.max}-31`;
  const dayNo = (d: ISODate) => Number(d.slice(8));
  const weekLabel = t('cal.weekRange', { from: ym(week[0]) === ym(week[4]) ? String(dayNo(week[0])) : fmt.fd(week[0], { day: 'numeric', month: 'short' }), to: fmt.fd(week[4], { day: 'numeric', month: 'short' }) });

  const toList = () => { setView('list'); if (!isWeekday(date)) setDate(addDays(date, dow(date) === 6 ? 2 : 1)); };
  const toMonth = () => { setView('month'); setMonth(ym(date)); };
  const stepMonth = (dir: 1 | -1) => {
    const m = addMonths(month, dir);
    setMonth(m);
    setDate(m === ym(today) ? home : nextOpenDay(s, `${m}-01`, true));
  };
  const open = (photos: Photo[], startId: string) => setViewer({ photos, startId });

  const stateOf = (d: ISODate) => { const st = dayStatus(s, d); return st.open ? 'open' : st.reason; };

  const seg = (width: number | string) => <Seg label={t('cal.view')} width={width} value={view} onChange={(v) => (v === 'list' ? toList() : toMonth())} testId="cal-view" items={[{ value: 'list', label: t('fcal.vList') }, { value: 'month', label: t('fcal.vMonth') }]} />;
  const covered = next && date >= next.from && date <= next.to;
  const isMonth = view === 'month';
  const nav = isMonth ? (
    <PeriodNav label={fmt.fmonth(month, true)} labelTestId="cal-month-label"
      prev={{ label: t('cal.prevMonth'), onClick: () => stepMonth(-1), disabled: month <= range.min, testId: 'cal-prev-month' }}
      next={{ label: t('cal.nextMonth'), onClick: () => stepMonth(1), disabled: month >= range.max, testId: 'cal-next-month' }}
      back={month !== ym(today) ? { label: t('cal.thisMonth'), onClick: () => { setMonth(ym(today)); setDate(home); }, testId: 'cal-this-month' } : null} />
  ) : (
    <PeriodNav label={weekLabel} labelTestId="cal-week"
      prev={{ label: t('cal.prevWeek'), onClick: () => setDate(addDays(date, -7)), disabled: !canPrevWeek, testId: 'cal-prev-week' }}
      next={{ label: t('cal.nextWeek'), onClick: () => setDate(addDays(date, 7)), disabled: !canNextWeek, testId: 'cal-next-week' }}
      back={!currentWeek ? { label: t('cal.thisWeek'), onClick: () => setDate(home), testId: 'cal-this-week' } : null} />
  );
  const picker = isMonth ? (
    <MonthPanel month={month} who={who} faces={who.length > 1} date={date} onPick={setDate} />
  ) : wide ? (
    <WeekRows days={weekDays} date={date} onPick={setDate} />
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
      {week.map((d) => <Tile key={d} d={d} sel={d === date} isToday={d === today} state={stateOf(d)} visited={came.has(d)} faces={faces(d)} onPick={setDate} />)}
    </div>
  );
  const closure = !isMonth && next && !covered ? (
    <button type="button" onClick={() => setDate(next.from)} data-testid="cal-closure" aria-label={t('cal.famClosureLabel')} className="cp-press"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 16, border: 'none', background: F.ochreBg, color: F.ochre, fontSize: 14, lineHeight: '20px', textAlign: 'left', cursor: 'pointer', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}>
      <Icon name={next.kind === 'holiday' ? 'flag' : 'event_busy'} size={20} fill={1} color={F.ochre} style={{ flex: 'none' }} />
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <span style={{ fontWeight: 600 }}>{next.to === next.from ? t('cal.famClosedOn', { d: closureDay(fmt, next.from) }) : t('cal.famClosedRange', { a: closureDay(fmt, next.from), b: closureDay(fmt, next.to) })}</span>
        {' · '}{cap(eventTitle(next, fmt.lang))}
      </span>
    </button>
  ) : null;

  return (
    <FamPage testId="FamilyCalendar" gap={wide ? 22 : 16} wide>
      <LargeTitle eyebrow={wide ? t('cal.openHours', { open: s.club.settings.open, close: s.club.settings.close }) : undefined} sub={whoName}
        right={wide || !switcher ? <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{switcher}{seg(140)}</span> : switcher}>{t('nav.calShort')}</LargeTitle>
      {!wide && switcher ? seg('100%') : null}
      <Cols left="1.25fr" right="1fr" gap={32} stickyLeft>
        {[
          <div key="l" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nav}
            {picker}
          </div>,
          <div key="r" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Agenda day={day} onOpen={open} />
            {closure}
          </div>,
        ]}
      </Cols>
      {viewer ? <PhotoViewer photos={viewer.photos} startId={viewer.startId} onClose={closeViewer} audience="family" /> : null}
    </FamPage>
  );
}

/**
 * One open day of the week: the weekday over the day number. Round 8d: the tile keeps its own look (grey, or ochre for a closure or holiday); the selected day gets a ring
 * (2px white gap, 2.5px ink) and its number in a small ink circle; today's weekday reads "Today" in bronze, so today and the selection never look alike.
 */
function Tile({ d, sel, isToday, state, visited, faces = [], onPick }: { d: ISODate; sel: boolean; isToday: boolean; state: string; /** KC round 10: a parent came that day (a bronze dot under the number) */ visited?: boolean; /** round 11: who came, as tiny faces (several parents) */ faces?: Member[]; onPick: (d: ISODate) => void }) {
  const { t, fmt } = useFamilyCtx();
  const shut = state === 'closed' || state === 'holiday';
  const who = faces.length ? `${nameList(fmt.lang, faces.map(displayName))} ${t('fcal.cameAria')}` : visited ? t('fcal.cameAria') : '';
  const label = [fmt.fdl(d), shut ? (state === 'holiday' ? t('cal.stHoliday') : t('cal.stClosed')) : '', isToday ? t('common.today') : '', who].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={() => onPick(d)} aria-label={label} aria-pressed={sel} aria-current={isToday ? 'date' : undefined} data-testid="cal-day" data-date={d} data-state={state} data-today={isToday ? '1' : '0'} data-visited={visited || undefined} data-came={faces.length ? faces.map((m) => m.id).join(',') : undefined} className="cp-press"
      style={{ position: 'relative', zIndex: sel ? 1 : 0, height: 68, minWidth: 0, border: 'none', borderRadius: 16, background: shut ? F.ochreBg : F.fill, color: shut ? F.ochre : F.text, boxShadow: sel ? SELECT_RING : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
      <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, opacity: isToday ? 1 : 0.8, color: isToday && !shut ? F.bronze : undefined }}>{isToday ? t('common.today') : fmt.fd(d, { weekday: 'short' })}</span>
      <span style={{ minWidth: 28, height: 28, borderRadius: 999, background: sel ? F.ink : 'transparent', color: sel ? '#FFFFFF' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, fontWeight: sel || isToday ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{Number(d.slice(8))}</span>
      {faces.length ? <span style={{ height: 14, marginTop: -2, display: 'flex' }}><CameFaces members={faces} size={14} /></span> : <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: visited ? F.bronze : 'transparent', marginTop: -1 }} />}
    </button>
  );
}

function closureDay(fmt: ReturnType<typeof useFamilyCtx>['fmt'], d: ISODate) {
  return fmt.fd(d, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/,/g, '');
}
