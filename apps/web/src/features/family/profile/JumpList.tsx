// A parent's profile on a laptop: the jump chips as a vertical list of sections down the left (sticky), the one in view lit. Text only (no icons), so the
// buttons read exactly like the chips' ("Overview", "Health", ...). Phones and tablets keep the chip row (ChipRow).
import { F } from '../kit';

export function JumpList<V extends string>({ items, value, onChange, label, testId }: { items: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string; testId?: string }) {
  return (
    <div role="group" aria-label={label} data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" aria-pressed={on} aria-current={on ? 'location' : undefined} onClick={() => onChange(c.value)} data-value={c.value} className={on ? undefined : 'cp-fam-press'}
            style={{ height: 38, padding: '0 12px', border: 'none', borderRadius: 10, background: on ? F.fill : 'transparent', color: on ? F.ink : F.text, fontSize: 14, fontWeight: on ? 600 : 500, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
