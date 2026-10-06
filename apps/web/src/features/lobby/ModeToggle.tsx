// The Check in | Check out switch at the top of Arrivals. Two tabs (arrow keys move between them) that each show a count:
// members who have not come in yet / members in the club now. The content below is the tab panel (Arrivals sets its id).
import { useRef, type KeyboardEvent } from 'react';
import { FONT_BODY, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';

export type Mode = 'in' | 'out';
export const TAB_ID = (m: Mode) => `arrivals-tab-${m}`;
export const PANEL_ID = 'arrivals-panel';
const ITEMS: { value: Mode; icon: string; key: string }[] = [
  { value: 'in', icon: 'login', key: 'lobby.checkIn' },
  { value: 'out', icon: 'logout', key: 'lobby.checkOut' },
];

export function ModeToggle({ t, mode, counts, onChange }: { t: TFn; mode: Mode; counts: Record<Mode, number>; onChange: (m: Mode) => void }) {
  const refs = useRef<Record<Mode, HTMLButtonElement | null>>({ in: null, out: null });
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next: Mode | null = e.key === 'ArrowRight' || e.key === 'End' ? 'out' : e.key === 'ArrowLeft' || e.key === 'Home' ? 'in' : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={t('lobby.modeAria')} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#E8E1D8', width: '100%', maxWidth: 440 }}>
      {ITEMS.map((it) => {
        const on = it.value === mode;
        return (
          <button key={it.value} ref={(el) => { refs.current[it.value] = el; }} type="button" role="tab" id={TAB_ID(it.value)} aria-selected={on} aria-controls={PANEL_ID} tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.value)} onKeyDown={move} data-mode={it.value} className="cp-mode"
            style={{ flex: 1, minWidth: 0, height: 52, padding: '0 14px', borderRadius: 999, border: 'none', background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: 17, fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter', transition: 'background .15s, box-shadow .15s' }}>
            <Icon name={it.icon} size={22} color={on ? '#75624B' : '#6A6967'} fill={on ? 1 : 0} />
            {t(it.key)}
            <span style={{ minWidth: 26, height: 26, padding: '0 8px', borderRadius: 999, background: on ? '#F4F0EE' : 'transparent', color: on ? '#282828' : '#6A6967', fontSize: FONT_BODY, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{counts[it.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
