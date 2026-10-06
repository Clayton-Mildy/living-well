// A row of filter chips (with counts). On phones it is one dropdown, so the first screen shows the list, not the filters.
import type { CSSProperties } from 'react';
import { useDevice } from '../../hooks/useDevice';
import { Select } from './Select';

export interface FilterOption<V extends string> { value: V; label: string; count?: number }

export function FilterChips<V extends string>({ label, options, value, onChange, style }: { label: string; options: FilterOption<V>[]; value: V; onChange: (v: V) => void; style?: CSSProperties }) {
  const { isPhone } = useDevice();
  const text = (o: FilterOption<V>) => (o.count === undefined ? o.label : `${o.label} · ${o.count}`);
  if (isPhone) return <div style={style}><Select ariaLabel={label} value={value} onChange={onChange} options={options.map((o) => ({ value: o.value, label: text(o) }))} /></div>;
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} className="cp-chip"
            style={{ height: 44, padding: '0 16px', borderRadius: 999, border: on ? '1px solid #282828' : '1px solid #CAB8A2', background: on ? '#282828' : '#FFFFFF', color: on ? '#FFFFFF' : '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
            {text(o)}
          </button>
        );
      })}
    </div>
  );
}
