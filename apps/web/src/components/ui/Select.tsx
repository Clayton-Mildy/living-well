// Select: the custom dropdown that replaces every native <select>. A combobox button that opens a listbox
// (floating under the field on tablet and laptop, a bottom sheet on phone), searchable when the list is long.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE } from 'react';
import { useT } from '../../lib/i18n';
import { FONT_BODY, FONT_SMALL, Icon } from './index';
import { FieldFrame, PopLayer, triggerStyle, useFieldIds } from './field';

export interface SelectOption<T extends string = string> { value: T; label: string; hint?: string }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Select<T extends string>({ label, value, onChange, options, placeholder, error, disabled, searchable, ariaLabel, hint, id }: {
  label?: string; value: T | ''; onChange: (v: T) => void; options: SelectOption<T>[]; placeholder?: string; error?: string | false; disabled?: boolean;
  /** show a search box; by default only when the list has more than 8 options */
  searchable?: boolean; ariaLabel?: string; hint?: string; id?: string;
}) {
  const t = useT();
  const ids = useFieldIds(id);
  const trigger = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const typed = useRef({ s: '', at: 0 });
  const showSearch = searchable ?? options.length > 8;
  const shown = useMemo(() => { const q = norm(query.trim()); return q ? options.filter((o) => norm(o.label).includes(q) || (o.hint ? norm(o.hint).includes(q) : false)) : options; }, [options, query]);
  const selected = options.find((o) => o.value === value);
  const title = label || ariaLabel || placeholder || t('common.pickOne');

  const openIt = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (o: SelectOption<T>) => { setOpen(false); if (o.value !== value) onChange(o.value); };
  useEffect(() => { if (open) (searchRef.current ?? listRef.current)?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (!open) return; listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [open, active, shown.length]);
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, shown.length - 1))); }, [shown.length]);
  useEffect(() => { if (open && query) setActive(0); }, [open, query]);

  const onTriggerKey = (e: RKE<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openIt(); }
  };
  const onListKey = (e: RKE<HTMLElement>) => {
    const n = shown.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(n - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, n - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = shown[active]; if (o) pick(o); }
    else if (!showSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      // type-ahead on a plain list
      const now = Date.now();
      typed.current = { s: (now - typed.current.at > 700 ? '' : typed.current.s) + e.key.toLowerCase(), at: now };
      const i = shown.findIndex((o) => norm(o.label).startsWith(typed.current.s));
      if (i >= 0) setActive(i);
    }
  };

  const labelled = label ? ids.label : undefined;
  const described = error || hint ? ids.msg : undefined;
  return (
    <FieldFrame ids={ids} label={label} error={error} hint={hint}>
      <button ref={trigger} id={ids.trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? ids.list : undefined}
        aria-labelledby={labelled} aria-label={label ? undefined : title} aria-describedby={described} aria-invalid={error ? true : undefined}
        disabled={disabled} onClick={() => (open ? setOpen(false) : openIt())} onKeyDown={onTriggerKey}
        style={triggerStyle({ error: !!error, disabled, open })}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? undefined : '#6A6967' }}>{selected ? selected.label : placeholder || t('common.pickOne')}</span>
        <Icon name="expand_more" size={22} color="#6A6967" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>
      <PopLayer open={open} onClose={() => setOpen(false)} anchorRef={trigger} title={title} menu minWidth={220} maxHeight={showSearch ? 380 : 320}>
        {showSearch ? (
          <div style={{ padding: 10, borderBottom: '1px solid #EFECEA', position: 'relative', flex: 'none' }}>
            <Icon name="search" size={20} color="#6A6967" style={{ position: 'absolute', left: 24, top: 23 }} />
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onListKey} placeholder={t('common.searchHere')} aria-label={t('common.search')}
              aria-controls={ids.list} aria-activedescendant={shown[active] ? `${ids.list}-${active}` : undefined} autoComplete="off"
              style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid #8A755B', padding: '0 12px 0 38px', fontSize: 16, fontFamily: 'Inter', outline: 'none', background: '#FFFFFF', color: '#282828' }} />
          </div>
        ) : null}
        <div ref={listRef} id={ids.list} role="listbox" aria-label={title} tabIndex={showSearch ? -1 : 0} onKeyDown={showSearch ? undefined : onListKey}
          aria-activedescendant={!showSearch && shown[active] ? `${ids.list}-${active}` : undefined} style={{ overflowY: 'auto', padding: 6, outline: 'none', minHeight: 0 }}>
          {shown.length === 0 ? <div role="status" style={{ padding: '14px 12px', fontSize: FONT_BODY, color: '#6A6967' }}>{t('common.noResults')}</div> : null}
          {shown.map((o, i) => {
            const sel = o.value === value;
            return (
              <div key={o.value} id={`${ids.list}-${i}`} data-idx={i} role="option" aria-selected={sel} aria-label={o.label} aria-describedby={o.hint ? `${ids.list}-${i}-h` : undefined}
                onMouseDown={(e) => e.preventDefault()} onMouseMove={() => { if (active !== i) setActive(i); }} onClick={() => pick(o)}
                style={{ minHeight: 48, padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: i === active ? '#F4F0EE' : 'transparent', fontSize: 16, fontWeight: sel ? 600 : 400 }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ lineHeight: 1.35 }}>{o.label}</span>
                  {o.hint ? <span id={`${ids.list}-${i}-h`} style={{ fontSize: FONT_SMALL, fontWeight: 400, color: '#6A6967', lineHeight: 1.35 }}>{o.hint}</span> : null}
                </span>
                {sel ? <Icon name="check" size={20} color="#75624B" /> : null}
              </div>
            );
          })}
        </div>
      </PopLayer>
    </FieldFrame>
  );
}
