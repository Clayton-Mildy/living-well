// Calendar (design ScrCal): list and month views with a day detail, a management events editor, and the weekly schedule builder for activity and management.
// The list shows the next 3 days; clicking a date in the month opens that week in the weekly schedule. Families see the same calendar read-only
// (venue bookings never show the client). Weekday names, month names and labels follow the language.
import { Fragment, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, addMonths, dow, ym, type CalendarEvent, type ISODate, type Slot, type Weekday } from '@cp/shared';
import { dayInfo, monthGrid, mondayOf, nextDays, nextMonday, weekEditable, type CalKind, type DayItem } from '@cp/shared/rules/calendar';
import { Button, Icon, PageHead } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { say } from '../../store/ui';
import { DayBlock } from './DayBlock';
import { EventEditor } from './EventEditor';
import { ScheduleBuilder, type CellRequest } from './ScheduleBuilder';
import { PhoneMonth } from './PhoneMonth';
import { KIND, MON_FIRST, dayState, itemText, weekdayName } from './lib';

type View = 'list' | 'month';
const LIST_DAYS = 3;

export function Calendar() {
  const t = useT();
  const { lang, fdl, fmonth } = useFmt();
  const { device, isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const { role } = useMe();
  const navigate = useNavigate();
  const family = role === 'family';
  const audience = family ? 'family' : 'staff';
  const isMgmt = role === 'mgmt';
  const canBuild = role === 'mgmt' || role === 'activity';
  const [view, setView] = useState<View>('list');
  const [month, setMonth] = useState(() => ym(today));
  const [sel, setSel] = useState<string | null>(null);
  const [week, setWeek] = useState<ISODate>(() => mondayOf(today));
  const [focus, setFocus] = useState<ISODate | null>(null);
  const [req, setReq] = useState<CellRequest | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<null | { event?: CalendarEvent; date?: string }>(null);
  const hours = { open: s.club.settings.open, close: s.club.settings.close };

  const days = useMemo(() => nextDays(s, today, LIST_DAYS, audience), [s, today, audience]);
  const cells = useMemo(() => monthGrid(month), [month]);
  const info = (d: string) => dayInfo(s, d, audience);
  const selInfo = sel && ym(sel) === month ? info(sel) : null;
  const onEdit = (id: string) => { const e = s.calendarEvents[id]; if (e) setEditor({ event: e }); };
  const showBuilder = () => requestAnimationFrame(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  /** A date in the month: that week opens in the weekly schedule (a Saturday or Sunday opens the week it ends). */
  const openWeek = (date: ISODate, scroll = true) => { setWeek(mondayOf(date)); setFocus(date); setReq(null); if (scroll) showBuilder(); };
  /** "Edit activity" on a day's item: that week, with the slot's editor open. A week that has started can't change, so the first week that can is shown. */
  const editActivity = (it: DayItem, date: ISODate) => {
    const wk = mondayOf(date);
    const target = weekEditable(wk, today) ? wk : nextMonday(today);
    if (target !== wk) say(t('cal.editFromWeek', { date: fdl(target) }), { icon: 'info' });
    const w = dow(date) as Weekday;
    setWeek(target);
    setFocus(addDays(target, w - 1));
    setReq({ w, slot: (it.time || '10:30') as Slot, n: Date.now() });
    showBuilder();
  };
  const legend: [CalKind, string][] = [['activity', t('cal.k_activity')], ['outing', t('cal.k_outing')], ['venue', t(family ? 'cal.k_private' : 'cal.k_venue')], ...(family ? [] : ([['guest', t('cal.k_guest')]] as [CalKind, string][])), ['holiday', t('cal.k_holiday')], ['closed', t('cal.k_closed')]];

  const tab = (v: View, icon: string, label: string) => {
    const on = view === v;
    return (
      <button key={v} type="button" role="tab" aria-selected={on} onClick={() => setView(v)} style={{ height: 38, padding: isPhone ? '0 14px 0 10px' : '0 18px 0 14px', borderRadius: 999, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', color: '#24201C', fontSize: 14, fontWeight: on ? 600 : 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
        <Icon name={icon} size={18} />{label}
      </button>
    );
  };

  const tabs = <div role="tablist" aria-label={t('cal.view')} style={{ display: 'flex', padding: 4, borderRadius: 999, background: '#EDE5DA', alignSelf: 'flex-start' }}>{tab('list', 'view_agenda', t('cal.vList'))}{tab('month', 'calendar_month', t('cal.vMonth'))}</div>;

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(18px, 2.8vw, 32px)', maxWidth: 1240 }}>
        {family ? (
          <button type="button" onClick={() => navigate('/today')} style={{ alignSelf: 'flex-start', height: 44, padding: '0 16px 0 10px', margin: isPhone ? '-6px 0 -10px -10px' : '-6px 0 -8px -10px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Inter' }}>
            <Icon name="arrow_back" size={20} />{t('common.today')}
          </button>
        ) : null}
        {isPhone ? (
          // phone: a compact header; the view tabs and the small "Add event" button share one row (no full-width pin over the grid)
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PageHead size={28} eyebrow={t('cal.openHours', hours)} title={family ? t('cal.titleFamily') : t('nav.calendar')} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {tabs}
              {isMgmt ? <span style={{ marginLeft: 'auto' }}><Button size={44} icon="add" style={{ padding: '0 14px 0 10px' }} onClick={() => setEditor({ date: sel || today })}>{t('cal.addEvent')}</Button></span> : null}
            </div>
          </div>
        ) : (
          <PageHead size={40} eyebrow={t('cal.openHours', hours)} title={family ? t('cal.titleFamily') : t('nav.calendar')} right={tabs} />
        )}
        {isMgmt && !isPhone ? <div><Button icon="add" onClick={() => setEditor({ date: sel || today })}>{t('cal.addEvent')}</Button></div> : null}

        {view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? 10 : 12 }}>
            {days.map((d) => <DayBlock key={d.date} s={s} info={d} today={today} canEdit={isMgmt} onEdit={onEdit} onEditActivity={canBuild ? editActivity : undefined} />)}
            <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 10 : 12, flexWrap: 'wrap' }}>
              <Button variant="secondary" size={isPhone ? 44 : 48} icon="calendar_month" onClick={() => setView('month')}>{t('cal.seeMonth')}</Button>
            </div>
          </div>
        ) : (
          <>
            {isPhone ? (
              <PhoneMonth month={month} onMonth={(m) => { setMonth(m); setSel(null); }} today={today} sel={sel} info={info} hours={hours} legend={legend}
                onSelect={(d, on) => { setSel(on ? null : d); if (canBuild) openWeek(d, false); }} />
            ) : (
            <div style={{ background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, boxShadow: 'var(--card-shadow)', padding: '20px clamp(16px, 2.4vw, 28px) 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setMonth(addMonths(month, -1)); setSel(null); }} aria-label={t('cal.prevMonth')} style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#24201C', padding: 0 }}><Icon name="chevron_left" size={22} /></button>
                <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C', minWidth: 200, textAlign: 'center' }}>{fmonth(month, true)}</h2>
                <button type="button" onClick={() => { setMonth(addMonths(month, 1)); setSel(null); }} aria-label={t('cal.nextMonth')} style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#24201C', padding: 0 }}><Icon name="chevron_right" size={22} /></button>
                {month !== ym(today) ? <Button variant="ghost" size={44} onClick={() => { setMonth(ym(today)); setSel(null); }}>{t('cal.thisMonth')}</Button> : null}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 'max(14px, var(--cp-body, 0px))', lineHeight: 1.4 }}>
                  {legend.map(([k, label]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: KIND[k].dot }} />{label}</span>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 }}>
                {MON_FIRST.map((w) => <div key={w} style={{ fontSize: 12, fontWeight: 600, color: '#6B6259', textAlign: 'center', padding: '4px 0', lineHeight: 1.4 }}>{weekdayName(lang, w, 'short')}</div>)}
                {cells.map((d, i) => {
                  if (!d) return <div key={'b' + i} aria-hidden="true" />;
                  const x = info(d);
                  const st = dayState(t, x, hours);
                  const on = sel === d;
                  const isToday = d === today;
                  const shut = !x.open;
                  const hol = x.state === 'holiday';
                  const lines = x.items.filter((it) => it.kind !== 'closed' && it.kind !== 'holiday').slice(0, 3).map((it) => ({ dot: KIND[it.kind].dot, bg: KIND[it.kind].bg, fg: KIND[it.kind].fg, text: itemText(s, it, t, lang, x.weekend).title.split(' with ')[0].split(':')[0], key: it.key }));
                  return (
                    <button key={d} type="button" onClick={() => { setSel(on ? null : d); if (canBuild) openWeek(d); }} aria-label={`${fdl(d)} · ${st.label}`} aria-pressed={on} data-date={d}
                      style={{ minHeight: 100, padding: 8, borderRadius: 8, border: isToday ? '2px solid #3D6B4F' : shut ? '1px solid #F0EAE1' : '1px solid #E9E1D6', background: isToday ? '#EAF1EC' : hol ? '#FBEDE8' : shut ? '#F5F5F3' : '#FFFFFF', opacity: shut && !hol && !isToday ? 0.6 : 1, boxShadow: on ? '0 0 0 3px #24201C' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 4, textAlign: 'left', cursor: 'pointer', color: '#24201C', minWidth: 0, overflow: 'hidden', fontFamily: 'Inter' }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: isToday ? '#2F5A40' : shut ? '#6B6259' : '#24201C', lineHeight: 1.4 }}>{Number(d.slice(8))}</span>
                        <span style={{ fontSize: 12, color: '#5E5852', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hol ? t('cal.holiday') : x.weekend ? '' : shut ? t('cal.closedShort') : ''}</span>
                      </span>
                      {lines.map((l) => (
                        <Fragment key={l.key}>
                          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, lineHeight: '16px', minWidth: 0, padding: '2px 6px', borderRadius: 6, background: l.bg, color: l.fg, fontWeight: 500 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.text}</span>
                          </span>
                        </Fragment>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>
            )}
            {selInfo ? <DayBlock s={s} info={selInfo} today={today} canEdit={isMgmt} onEdit={onEdit} onEditActivity={canBuild ? editActivity : undefined} /> : null}
            {(isMgmt && selInfo && selInfo.date >= today) || (isPhone && canBuild && selInfo) ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {isMgmt && selInfo && selInfo.date >= today ? <Button variant="secondary" size={isPhone ? 44 : 48} icon="add" onClick={() => setEditor({ date: selInfo.date })}>{t('cal.addEventOn', { date: fdl(selInfo.date) })}</Button> : null}
                {isPhone && canBuild && selInfo ? <Button variant="secondary" size={44} icon="event_note" onClick={() => openWeek(selInfo.date)}>{t('cal.openWeek')}</Button> : null}
              </div>
            ) : null}
          </>
        )}

        {canBuild ? <div ref={builderRef} style={{ scrollMarginTop: 12 }}><ScheduleBuilder week={week} onWeek={(m) => { setWeek(m); setFocus(null); setReq(null); }} focusDate={focus} request={req} /></div> : null}
      </div>
      {isMgmt ? <EventEditor open={!!editor} onClose={() => setEditor(null)} event={editor?.event} date={editor?.date} /> : null}
    </>
  );
}
