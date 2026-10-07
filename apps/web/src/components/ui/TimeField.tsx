// TimeField: hour and minute lists in a popover (bottom sheet on phone). Replaces every <input type="time">. Values are 'HH:MM' ('' = empty).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE } from 'react';
import { useT } from '../../lib/i18n';
import { Icon } from './index';
import { FieldFrame, PopLayer, triggerStyle, useFieldIds } from './field';
import { firstAllowedInHour, isHM, minuteChoices, timeAllowed, type HM } from './dates';

const p2 = (n: number) => String(n).padStart(2, '0');

function Column({ label, items, selected, onPick }: { label: string; items: { n: number; ok: boolean }[]; selected: number | null; onPick: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const focusAt = (i: number) => (ref.current?.querySelectorAll<HTMLElement>('[role="option"]')[i])?.focus();
  // open on the chosen value
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'center' }); }, []);
  const onKey = (e: RKE<HTMLDivElement>) => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="option"]') || []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(Math.min(els.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(els.length - 1); }
  };
  const firstTab = selected === null ? items.findIndex((x) => x.ok) : -1;
  return (
    <div ref={ref} role="listbox" aria-label={label} onKeyDown={onKey} style={{ flex: 1, minWidth: 0, maxHeight: 232, overflowY: 'auto', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((x, i) => {
        const on = x.n === selected;
        return (
          <div key={x.n} role="option" aria-selected={on} aria-disabled={!x.ok || undefined} tabIndex={on || i === firstTab ? 0 : -1} data-v={p2(x.n)}
            onClick={() => { if (x.ok) onPick(x.n); }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && x.ok) { e.preventDefault(); onPick(x.n); } }} className={on || !x.ok ? undefined : 'h-cream'}
            style={{ minHeight: 44, flex: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontVariantNumeric: 'tabular-nums', cursor: x.ok ? 'pointer' : 'not-allowed', background: on ? '#75624B' : undefined, color: on ? '#FFFFFF' : x.ok ? '#24201C' : '#B5B0AC', fontWeight: on ? 600 : 400 }}>
            {p2(x.n)}
          </div>
        );
      })}
    </div>
  );
}

/** Pick a time. `min`/`max` are inclusive 'HH:MM'; `step` is the minute grid (default 5; a value off the grid, like the clock's 09:58, stays selectable). */
export function TimeField({ label, value, onChange, min, max, step = 5, error, placeholder, disabled, ariaLabel, hint, id, clearable }: {
  label?: string; value: string; onChange: (v: HM) => void; min?: HM; max?: HM; step?: number; error?: string | false; placeholder?: string; disabled?: boolean; ariaLabel?: string; hint?: string; id?: string;
  /** show "Clear" while a time is set, so an optional time can be emptied again (onChange('')) */
  clearable?: boolean;
}) {
  const t = useT();
  const ids = useFieldIds(id);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const has = isHM(value);
  const h = has ? +value.slice(0, 2) : null, m = has ? +value.slice(3, 5) : null;
  const minutes = useMemo(() => minuteChoices(step, m ?? undefined), [step, m]);
  const title = label || ariaLabel || t('common.pickTime');
  const hours = Array.from({ length: 24 }, (_, n) => ({ n, ok: firstAllowedInHour(n, minutes, min, max) !== null }));
  const mins = minutes.map((n) => ({ n, ok: h === null ? true : timeAllowed(`${p2(h)}:${p2(n)}`, min, max) }));

  const pickHour = (n: number) => {
    // keep the minute when it still fits in the new hour, else the first minute that does
    const keep = m !== null && timeAllowed(`${p2(n)}:${p2(m)}`, min, max) ? `${p2(n)}:${p2(m)}` : firstAllowedInHour(n, minutes, min, max);
    if (keep) onChange(keep);
  };
  const pickMinute = (n: number) => {
    if (h !== null) { onChange(`${p2(h)}:${p2(n)}`); return; }
    const first = hours.find((x) => timeAllowed(`${p2(x.n)}:${p2(n)}`, min, max));
    if (first) onChange(`${p2(first.n)}:${p2(n)}`);
  };

  return (
    <FieldFrame ids={ids} label={label} error={error} hint={hint}>
      <button ref={trigger} id={ids.trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={label ? `${ids.label} ${ids.value}` : undefined} aria-label={label ? undefined : `${title}${has ? ', ' + value : ''}`}
        aria-describedby={error || hint ? ids.msg : undefined} aria-invalid={error ? true : undefined} disabled={disabled} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }} style={triggerStyle({ error: !!error, disabled, open })}>
        <Icon name="schedule" size={22} color="#5E5852" />
        <span id={ids.value} style={{ flex: 1, minWidth: 0, fontVariantNumeric: 'tabular-nums', color: has ? undefined : '#5E5852' }}>{has ? value : placeholder || t('common.pickTime')}</span>
        <Icon name="expand_more" size={22} color="#5E5852" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>
      <PopLayer open={open} onClose={() => setOpen(false)} anchorRef={trigger} title={title} minWidth={240} maxHeight={380}>
        <div style={{ display: 'flex', gap: 8, padding: 8 }}>
          <Column label={t('common.hour')} items={hours} selected={h} onPick={pickHour} />
          <Column label={t('common.minute')} items={mins} selected={m} onPick={pickMinute} />
        </div>
        <div style={{ padding: '4px 12px 12px', display: 'flex', justifyContent: clearable && has ? 'space-between' : 'flex-end', gap: 8 }}>
          {clearable && has ? (
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="h-cream" style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: 'transparent', color: '#75624B', fontSize: 15, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'Inter' }}>{t('common.clear')}</button>
          ) : null}
          <button type="button" onClick={() => setOpen(false)} className="h-bronze" style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{t('common.done')}</button>
        </div>
      </PopLayer>
    </FieldFrame>
  );
}
