// Year view (round 14, B3): twelve mini-months. A day is a 28 px cell: closed in light grey, open on white, a weekend that opened because it was programmed
// outlined in ink; up to three dots sit under the number (an event or booking, a celebration, a birthday). Tapping a month header opens that month, tapping
// a day opens the day. Shared by the staff and the family calendar (the caller picks the audience when it builds `year`). 2 months per row on a phone, 3 on a
// tablet, 4 on a laptop. Round 15: under the months, the year's closed or away days as a list (holidays, closures, outings); a row opens its first day.
// Round 15 follow-up: those days are also circled in their legend colour inside the months (a ring round the number), with a small key under the months,
// and the list is grouped under month headers: a date block, the title, the kind as a dot and its name, and the length.
import { addDays, type ISODate, type YM } from '@cp/shared';
import { eventTitle, monthGrid, type ClosedSpan, type YearDay, type YearDot } from '@cp/shared/rules/calendar';
import { Icon } from '../../components/ui';
import { HAIR } from '../members/lib';
import { useDevice } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { KIND } from './lib';

const DOT: Record<YearDot, string> = { event: KIND.closed.dot, celebration: KIND.celebration.dot, birthday: KIND.birthday.dot };
const COLS = { phone: 2, tablet: 3, laptop: 4 } as const;
type Circled = ClosedSpan['kind'];
/** every day a closure, holiday or outing covers -> its kind (a closure or holiday wins over an outing on the same day) */
function circledDays(spans: ClosedSpan[] | undefined): Map<ISODate, Circled> {
  const out = new Map<ISODate, Circled>();
  for (const c of spans ?? []) {
    for (let d = c.from, n = 0; d <= c.to && n < 366; d = addDays(d, 1), n++) {
      if (c.kind === 'outing' && out.has(d)) continue;
      out.set(d, c.kind);
    }
  }
  return out;
}

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
  const { lang, fdl, fd, fmonth } = useFmt();
  const { device } = useDevice();
  const circled = circledDays(closed);
  const byMonth = (() => {
    const m = new Map<YM, ClosedSpan[]>();
    for (const c of closed ?? []) { const k = c.from.slice(0, 7) as YM; m.set(k, [...(m.get(k) ?? []), c]); }
    return Array.from(m, ([month, spans]) => ({ month, spans })); // the spans arrive sorted by start
  })();
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
                const ring = circled.get(d);
                return (
                  <button key={d} type="button" className="cp-press" onClick={() => onPickDay(d)} data-testid="year-day" data-date={d} data-state={x.state} data-closed={ring} aria-label={`${fdl(d)} · ${open ? t('cal.stOpen', hours) : t('cal.stClosed')}${ring ? ` · ${t(`cal.k_${ring}`)}` : ''}`}
                    style={{ boxSizing: 'border-box', minWidth: 0, height: 34, padding: 0, borderRadius: 6, border: 'none', background: open ? '#FFFFFF' : 'transparent', boxShadow: x.state === 'weekendOpen' ? 'inset 0 0 0 1.5px #24201C' : 'none', color: open || ring ? '#24201C' : '#A8A29B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', fontFamily: 'Inter' }}>
                    <span style={{ width: 22, height: 22, boxSizing: 'border-box', borderRadius: 999, boxShadow: ring ? `inset 0 0 0 2px ${KIND[ring].dot}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: '14px', fontWeight: isToday ? 800 : 500, textDecoration: isToday ? 'underline' : 'none', fontVariantNumeric: 'tabular-nums' }}>{Number(d.slice(8))}</span>
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
        <>
          <div data-testid="year-legend" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', padding: '0 4px', fontSize: 12, lineHeight: '16px', color: '#6B6259' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', gap: 3 }}><Ring color={KIND.holiday.dot} /><Ring color={KIND.closed.dot} /></span>{t('cal.closedShort')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ display: 'inline-flex' }}><Ring color={KIND.outing.dot} /></span>{t('cal.k_outing')}</span>
          </div>
          <section aria-label={t('cal.closedYear', { y: year })} data-testid="year-closed" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, padding: '4px 4px 0', fontSize: 15, fontWeight: 600, color: '#24201C' }}>{t('cal.closedYear', { y: year })}</h3>
            {byMonth.map(({ month, spans }) => (
              <div key={month} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h4 data-testid="year-closed-month" style={{ margin: 0, padding: '0 4px', fontSize: 13, lineHeight: '18px', fontWeight: 600, color: '#6B6259' }}>{fmonth(month)}</h4>
                <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '0 10px', display: 'flex', flexDirection: 'column' }}>
                  {spans.map((c, i) => {
                    const range = c.to !== c.from;
                    const wd = (d: ISODate) => fd(d, { weekday: 'short' }).replace(/\.$/, '');
                    return (
                      <button key={c.from + c.title} type="button" className="cp-press" onClick={() => onPickDay(c.from)} data-testid="year-closed-row" data-date={c.from} data-kind={c.kind}
                        style={{ minHeight: 52, padding: '8px 0', border: 'none', borderTop: i ? HAIR : 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
                        <span data-testid="year-closed-date" style={{ flex: 'none', width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontSize: range ? 17 : 22, lineHeight: '24px', fontWeight: 600 }}>{range ? `${+c.from.slice(8)}–${+c.to.slice(8)}` : +c.from.slice(8)}</span>
                          <span style={{ fontSize: 11, lineHeight: '14px', fontWeight: 500, color: '#6B6259', whiteSpace: 'nowrap' }}>{range ? `${wd(c.from)}–${wd(c.to)}` : wd(c.from)}</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 15, fontWeight: 500, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventTitle(c, lang)}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '18px', color: '#6B6259' }}>
                            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: KIND[c.kind].dot, flex: 'none' }} />
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(`cal.k_${c.kind}`)}</span>
                          </span>
                        </span>
                        {c.days > 1 ? <span style={{ flex: 'none', fontSize: 13, lineHeight: '18px', color: '#6B6259', whiteSpace: 'nowrap' }}>{t('cal.nDays', { n: c.days })}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

/** a legend swatch: a small ring in a closed-day colour */
const Ring = ({ color }: { color: string }) => <span style={{ width: 14, height: 14, boxSizing: 'border-box', borderRadius: 999, boxShadow: `inset 0 0 0 2px ${color}` }} />;
