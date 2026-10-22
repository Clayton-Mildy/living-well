// Round 13: the four numbers the Month report leads with — revenue collected, active members, mood index, enquiry → joined — each with its value, its change since the
// period before, and a six-month line (tap it to read a month). Phone 2×2, wide 4 across. The tile's number is the selected period's own; the line is the six whole months
// before the period's end. The label, number and change open the screen behind them; the line is its own tap target, so the two never fight.
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { rp } from '@cp/shared';
import { isPartialMonth, type Delta, type MonthReport, type HeroTrend } from '@cp/shared/rules/monthReport';
import { TrendChart } from '../../components/ui';
import { useFmt, useT } from '../../lib/i18n';
import { pct, signed } from './OwnerSummary';
import { MUTED, tone } from './parts';

const one = (n: number) => String(Math.round(n * 10) / 10);
const pts = (n: number) => `${Math.round(n * 100)} pt`;
const count = (n: number) => String(n);
/** Rupiah in millions for the line's readout ("Rp 139,5 jt"): the compact readout is one short line. */
const jt = (n: number) => `Rp ${one(n / 1e6).replace('.', ',')} jt`;

type Key = 'collected' | 'active' | 'index' | 'conversion';
interface Spec { key: Key; label: string; d: Delta<number | null>; show: (n: number | null) => string; diff: (n: number) => string; to: string; sub?: string; soFar?: boolean }

export function HeroTiles({ r, trend, wide, today }: { r: MonthReport; trend: HeroTrend; wide: boolean; today: string }) {
  const t = useT();
  const fmt = useFmt();
  const go = useNavigate();
  const mon = (m: string) => fmt.fd(`${m}-01`, { month: 'short' });
  const span = `${mon(trend.months[0])}–${mon(trend.months[trend.months.length - 1])}`;
  const dash = (f: (n: number) => string) => (n: number | null) => (n === null ? '—' : f(n));
  // a partial month ("This month" today) has no honest comparison with the whole month before: say "so far" where the revenue change would be
  const partial = isPartialMonth(r.period);
  // "so far this month" is only true when the period runs from the 1st of the current month to a day in it; any other partial range just says "so far"
  const thisMonth = r.period.from === `${today.slice(0, 7)}-01` && r.period.to.slice(0, 7) === today.slice(0, 7);
  const specs: Spec[] = [
    { key: 'collected', label: t('month.heroCollected'), d: r.hero.collected, show: dash(rp), diff: rp, to: '/payments', soFar: partial },
    { key: 'active', label: t('month.heroActive'), d: r.hero.active, show: dash(count), diff: count, to: '/members' },
    { key: 'index', label: t('month.heroMood'), d: r.hero.index, show: dash(one), diff: one, to: '/insights?tab=mood' },
    { key: 'conversion', label: t('month.heroConversion'), d: r.hero.conversion, show: (n) => pct(n), diff: pts, to: '/enquiries?view=history', sub: r.hero.conversion.cur !== null ? t('month.leadsCaption') : undefined },
  ];
  const fmtOf = { collected: jt, active: count, index: one, conversion: (v: number) => pct(v) };
  const tile: CSSProperties = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: wide ? '14px 16px' : '12px 14px' };
  return (
    <section aria-label={t('month.hero')}>
      <div data-grid style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: wide ? 12 : 8 }}>
        {specs.map((x) => {
          const diff = x.soFar ? t(thisMonth ? 'month.heroSoFar' : 'month.heroSoFarAny') : signed(x.d.diff, x.diff);
          // a month with nothing to say is left out of the line; the range stays the six months so the others keep their places
          const points = trend.months.flatMap((m, i) => { const v = trend[x.key][i]; return v === null ? [] : [{ date: `${m}-15`, value: v }]; });
          return (
            <div key={x.key} data-tile={x.key} className="cp-grey" style={{ ...tile, background: 'var(--fill, #F4F4F5)', borderRadius: 16 }}>
              <button type="button" onClick={() => go(x.to)} className="h-row cp-tap-self"
                style={{ boxSizing: 'border-box', border: 'none', background: 'transparent', padding: 0, margin: 0, textAlign: 'left', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 44, color: '#24201C', fontFamily: 'Inter' }}>
                <span style={{ fontSize: 13, lineHeight: '18px', color: MUTED }}>{x.label}</span>
                <span style={{ fontSize: wide ? 24 : 20, fontWeight: 300, lineHeight: '30px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{x.show(x.d.cur)}</span>
                <span data-delta style={{ fontSize: 13, lineHeight: '18px', color: diff && !x.soFar ? tone(x.d) : MUTED, minHeight: 18 }}>{diff}</span>
                {x.sub ? <span style={{ fontSize: 12, lineHeight: '16px', color: MUTED }}>{x.sub}</span> : null}
              </button>
              <div style={{ marginTop: 'auto' }}><TrendChart compact height={36} from={`${trend.months[0]}-15`} to={`${trend.months[trend.months.length - 1]}-15`} dateLabel={(d) => fmt.fd(d, { month: 'long', year: 'numeric' })} series={[{ key: x.key, label: x.label, points }]} format={fmtOf[x.key]}
                ariaLabel={t('month.trendAria', { label: x.label })} caption={span} empty={t('month.trendNone')} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
