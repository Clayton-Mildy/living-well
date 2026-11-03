// Round 17 (Admin › Roles): a plain checkbox, 44px target around a 22px box, ink when ticked, a dash when mixed (a group's tick-all).
// Round 18: `box` sets the box's size (Admin › Roles uses 18px).
import { Icon } from './index';

export function Checkbox({ checked, onChange, label, disabled, box = 22 }: { checked: boolean | 'mixed'; onChange: (next: boolean) => void; label: string; disabled?: boolean; box?: number }) {
  const on = checked !== false;
  return (
    <button type="button" role="checkbox" aria-checked={checked === 'mixed' ? 'mixed' : checked} aria-label={label} title={label} aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : () => onChange(checked !== true)} className="cp-press"
      style={{ width: 44, height: 44, flex: 'none', justifySelf: 'center', /* centred in a grid column (Admin › Roles' View / Edit) */ border: 'none', padding: 0, background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
      <span aria-hidden="true" style={{ width: box, height: box, borderRadius: Math.round(box * 0.27), boxSizing: 'border-box', border: on ? 'none' : '1.5px solid var(--outline, #C9C4BE)', background: on ? '#24201C' : '#FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon name={checked === 'mixed' ? 'remove' : 'check'} size={Math.round(box * 0.82)} weight={500} /> : null}
      </span>
    </button>
  );
}
