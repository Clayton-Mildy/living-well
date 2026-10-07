// The three number tabs at the top of Arrivals (Prototype v3): Not in yet / In the club / Gone home, each a big light number over a label
// with a 2px underline (ink when selected). They replace the old Check in | Check out switch and the two count tiles:
//   in   = members not in yet (the check-in list),  out = members in the club (the check-out list),  gone = who has gone home.
// Arrow keys move between the tabs. The content below is the tab panel (Arrivals sets its id). The tabs keep "Check in" / "Check out"
// at the start of their accessible names, and the number carries the old tile test ids (tile-inClub, tile-goneHome).
import { useRef, type KeyboardEvent } from 'react';
import type { TFn } from '../../lib/i18n';

export type Mode = 'in' | 'out' | 'gone';
export const TAB_ID = (m: Mode) => `arrivals-tab-${m}`;
export const PANEL_ID = 'arrivals-panel';
const ORDER: Mode[] = ['in', 'out', 'gone'];
const LABEL: Record<Mode, string> = { in: 'lobby.notInYet', out: 'lobby.inClub', gone: 'lobby.goneHome' };
/** The verb a tab starts its accessible name with ("Check in · Not in yet (2)"); Gone home has none. */
const VERB: Record<Mode, string | null> = { in: 'lobby.checkIn', out: 'lobby.checkOut', gone: null };
const TILE_ID: Record<Mode, string> = { in: 'tile-notIn', out: 'tile-inClub', gone: 'tile-goneHome' };

export function ModeToggle({ t, mode, counts, onChange }: { t: TFn; mode: Mode; counts: Record<Mode, number>; onChange: (m: Mode) => void }) {
  const refs = useRef<Record<Mode, HTMLButtonElement | null>>({ in: null, out: null, gone: null });
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ORDER.indexOf(mode);
    const next: Mode | null = e.key === 'ArrowRight' ? ORDER[Math.min(i + 1, ORDER.length - 1)]
      : e.key === 'ArrowLeft' ? ORDER[Math.max(i - 1, 0)]
      : e.key === 'End' ? ORDER[ORDER.length - 1]
      : e.key === 'Home' ? ORDER[0] : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={t('lobby.modeAria')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(8px, 2vw, 32px)', maxWidth: 640 }}>
      {ORDER.map((k) => {
        const on = k === mode;
        const label = t(LABEL[k]);
        const verb = VERB[k];
        return (
          <button key={k} ref={(el) => { refs.current[k] = el; }} type="button" role="tab" id={TAB_ID(k)} aria-selected={on} aria-controls={PANEL_ID} tabIndex={on ? 0 : -1}
            aria-label={`${verb ? `${t(verb)} · ` : ''}${label} (${counts[k]})`} onClick={() => onChange(k)} onKeyDown={move} data-mode={k}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0, minHeight: 44, padding: '0 0 12px', border: 'none', borderBottom: `2px solid ${on ? '#2B231C' : '#E6DDD1'}`, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#1E1A16', transition: 'border-color .15s' }}>
            <span data-testid={TILE_ID[k]} style={{ fontSize: 'clamp(32px, 3.8vw, 44px)', lineHeight: 1, fontWeight: 300, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', color: on ? '#2B231C' : '#8A8078' }}>{counts[k]}</span>
            <span style={{ fontSize: 13, lineHeight: 1.3, fontWeight: on ? 600 : 400, color: on ? '#1E1A16' : '#8A8078', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
