// The Plan filter of "In the club" (round 15): a single-select chip row (All, then each active plan) with the count of members in the club on it.
// The same pill look as the laptop Members filters; on a phone the row scrolls sideways instead of wrapping.
import type { Plan } from '@cp/shared';

export interface PlanChip { value: Plan | 'all'; label: string; count: number }

export function PlanChips({ label, chips, value, onChange, scroll }: { label: string; chips: PlanChip[]; value: Plan | 'all'; onChange: (v: Plan | 'all') => void; scroll?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} data-testid="plan-chips"
      style={{ display: 'flex', flexWrap: scroll ? 'nowrap' : 'wrap', gap: 8, overflowX: scroll ? 'auto' : undefined, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {chips.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)} className={on ? 'cp-chip' : 'cp-chip cp-fill'}
            style={{ flex: 'none', height: 38, padding: '0 15px', borderRadius: 999, border: 'none', background: on ? '#24201C' : 'var(--fill, #F4F4F5)', color: on ? '#FFFFFF' : '#24201C', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            {c.label} · {c.count}
          </button>
        );
      })}
    </div>
  );
}
