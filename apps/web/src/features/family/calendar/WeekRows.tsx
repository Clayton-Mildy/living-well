// Family Calendar, List view on a laptop: the week as five rows (weekday and number, what is on, a dot when a parent came) instead of five tiles, so the
// left column says something about each day. Same testid and states as the phone's tiles: `cal-day` with data-date and data-state. Round 8d: a row keeps its own
// look when selected (a ring, its number in an ink circle); today's weekday reads "Today" in bronze.
import { memberShort } from '@cp/shared';
import type { ISODate } from '@cp/shared';
import { eventTitle } from '@cp/shared/rules/calendar';
import { activityLabel } from '@cp/shared/rules/family';
import type { FamDay } from '@cp/shared/rules/famCalendar';
import { F } from '../kit';
import { SELECT_RING } from './bits';
import { useFamilyCtx } from '../useFamily';
import { nameList } from './bits';

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function WeekRows({ days, date, onPick }: { days: FamDay[]; date: ISODate; onPick: (d: ISODate) => void }) {
  const { s, t, fmt, now } = useFamilyCtx();
  const line = (d: FamDay): string => {
    if (d.banner) {
      if (d.banner.kind === 'weekend') return t('fcal.weekend');
      return d.banner.title ? cap(eventTitle({ title: d.banner.title, titleId: d.banner.titleId }, fmt.lang)) : t('fcal.closed');
    }
    const names = d.rows.filter((r) => r.kind === 'session' && r.activityId).map((r) => activityLabel(s, r.activityId, fmt.lang));
    return Array.from(new Set(names)).join(' · ') || t('fcal.nothing');
  };
  return (
    <div role="group" aria-label={t('cal.weekNav')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {days.map((d) => {
        const sel = d.date === date;
        const shut = d.state === 'closed' || d.state === 'holiday';
        const today = d.date === now.today;
        const came = d.came.length > 0;
        const label = [fmt.fdl(d.date), shut ? (d.state === 'holiday' ? t('cal.stHoliday') : t('cal.stClosed')) : '', came ? t('fcal.cameDay') : '', today ? t('common.today') : ''].filter(Boolean).join(' · ');
        const fg = shut ? F.ochre : F.text;
        return (
          <button key={d.date} type="button" onClick={() => onPick(d.date)} aria-label={label} aria-pressed={sel} aria-current={today ? 'date' : undefined} data-testid="cal-day" data-date={d.date} data-state={shut ? d.state : 'open'} data-today={today ? '1' : '0'} className="cp-fam-press"
            style={{ position: 'relative', zIndex: sel ? 1 : 0, minHeight: 62, border: 'none', borderRadius: 16, background: shut ? F.ochreBg : F.fill, color: fg, boxShadow: sel ? SELECT_RING : 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px 8px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ width: 48, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: today ? 700 : 500, opacity: today ? 1 : 0.8, color: today && !shut ? F.bronze : undefined }}>{today ? t('common.today') : fmt.fd(d.date, { weekday: 'short' })}</span>
              <span style={{ minWidth: 32, height: 32, borderRadius: 999, background: sel ? F.ink : 'transparent', color: sel ? '#FFFFFF' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: 1, fontWeight: sel || today ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{Number(d.date.slice(8))}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{line(d)}</span>
              {came ? <span style={{ fontSize: 13, color: F.muted }}>{t('fcal.joinedDay', { n: nameList(fmt.lang, d.came.map((id) => memberShort(s.members[id])).filter(Boolean)) })}</span> : null}
            </span>
            {came ? <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: F.bronze, flex: 'none' }} /> : null}
          </button>
        );
      })}
    </div>
  );
}
