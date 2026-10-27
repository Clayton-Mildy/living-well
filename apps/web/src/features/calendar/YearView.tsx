// Year view (round 14, B3): twelve mini-months. A day is a 28 px cell: closed in light grey, open on white, a weekend that opened because it was programmed
// outlined in ink; up to three dots sit under the number (an event or booking, a celebration, a birthday). Tapping a month header opens that month, tapping
// a day opens the day. Shared by the staff and the family calendar (the caller picks the audience when it builds `year`). 2 months per row on a phone, 3 on a
// tablet, 4 on a laptop. Round 15: under the months, the year's closed or away days as a list (holidays, closures, outings); a row opens its first day.
import { type ISODate, type YM } from '@cp/shared';
import { eventTitle, monthGrid, type ClosedSpan, type YearDay, type YearDot } from '@cp/shared/rules/calendar';
import { Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { KIND } from './lib';

const DOT: Record<YearDot, string> = { event: KIND.closed.dot, celebration: KIND.celebration.dot, birthday: KIND.birthday.dot };
const COLS = { phone: 2, tablet: 3, laptop: 4 } as const;

export function YearView({ year, months, today, hours, onYear, onPickMonth, onPickDay, closed, minYear, maxYear }: {
  year: number;
  months: { month: YM; days: YearDay[] }[];
  today: ISODate;
  hours: { open: string; close: string };
  onYear: (year: number) => void;
  onPickMonth: (month: YM) => void;
  onPickDay: (date: ISODate) => void;
  /** round 15: the year's closed, holiday and outing days (closedDaysOfYear) */
  closed?: ClosedSpan[];
  /** the family can browse only so far */
  minYear?: number;
  maxYear?: number;
}) {
  const t = useT();
  const { lang, fdl, fds, fmonth } = useFmt();
  const { device } = useDevice();
  const step = (dir: 1 | -1, label: string, disabled: boolean) => (
    <button type="button" className="cp-press cp-fill" onClick={() => onYear(year + dir)} disabled={disabled} aria-label={label} data-testid={dir === 1 ? 'year-next' : 'year-prev'}
      style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'var(--fill, #F4F4F5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, color: '#24201C', padding: 0, flex: 'none' }}>
      <Icon name={dir === 1 ? 'chevron_right' : 'chevron_left'} size={22} />
    </button>
  );
  return (
    <div data-testid="year-view" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {step(-1, t('cal.prevYear'), minYear !== undefined && year <= minYear)}
        <h2 className="cp-serif" data-testid="year-label" style={{ margin: 0, minWidth: 88, textAlign: 'center', fontSize: 24, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{year}</h2>
        {step(1, t('cal.nextYear'), maxYear !== undefined && year >= maxYear)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS[device]}, minmax(0, 1fr))`, gap: 10 }}>
        {months.map((m) => (
          <section key={m.month} aria-label={fmonth(m.month)} className="cp-grey" style={{ minWidth: 0, background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '2px 6px 8px' }}>
            <button type="button" className="cp-press" onClick={() => onPickMonth(m.month)} data-testid="year-month" data-month={m.month}
              style={{ width: '100%', height: 44, padding: '0 4px', border: 'none', borderRadius: 10, background: 'transparent', color: '#24201C', fontSize: 15, fontWeight: 600, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>{fmonth(m.month)}</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
              {monthGrid(m.month).map((d, i) => {
                if (!d) return <div key={'b' + i} aria-hidden="true" />;
                const x = m.days[Number(d.slice(8)) - 1];
                const isToday = d === today;
                const open = x.state !== 'closed';
                return (
                  <button key={d} type="button" className="cp-press" onClick={() => onPickDay(d)} data-testid="year-day" data-date={d} data-state={x.state} aria-label={`${fdl(d)} · ${open ? t('cal.stOpen', hours) : t('cal.stClosed')}`}
                    style={{ boxSizing: 'border-box', minWidth: 0, height: 28, padding: 0, borderRadius: 6, border: 'none', background: open ? '#FFFFFF' : 'transparent', boxShadow: x.state === 'weekendOpen' ? 'inset 0 0 0 1.5px #24201C' : 'none', color: open ? '#24201C' : '#A8A29B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', fontFamily: 'Inter' }}>
                    <span style={{ fontSize: 12, lineHeight: '14px', fontWeight: isToday ? 800 : 500, textDecoration: isToday ? 'underline' : 'none', fontVariantNumeric: 'tabular-nums' }}>{Number(d.slice(8))}</span>
                    <span aria-hidden="true" style={{ display: 'flex', gap: 2, height: 4 }}>
                      {x.dots.slice(0, 3).map((k) => <span key={k} style={{ width: 4, height: 4, borderRadius: 999, background: DOT[k] }} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {closed?.length ? (
        <section aria-label={t('cal.closedYear', { y: year })} data-testid="year-closed" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 style={{ margin: 0, padding: '4px 4px 0', fontSize: 15, fontWeight: 600, color: '#24201C' }}>{t('cal.closedYear', { y: year })}</h3>
          <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '0 6px', display: 'flex', flexDirection: 'column' }}>
            {closed.map((c) => (
              <button key={c.from + c.title} type="button" className="cp-press" onClick={() => onPickDay(c.from)} data-testid="year-closed-row" data-date={c.from} data-kind={c.kind}
                style={{ minHeight: 44, padding: '6px 4px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
                <Icon name={KIND[c.kind].icon} size={20} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '20px' }}>{eventTitle(c, lang)}</span>
                  <span style={{ fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>{t(`cal.k_${c.kind}`)} · {c.to === c.from ? fds(c.from) : `${fds(c.from)} – ${fds(c.to)}`}{c.days > 1 ? ` · ${t('cal.nDays', { n: c.days })}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
