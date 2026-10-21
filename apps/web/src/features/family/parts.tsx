// Small shared parts for the family screens (round 8 kept only what the redesigned screens still use; the look lives in kit.tsx).
import type { CSSProperties, ReactNode } from 'react';
import type { Health } from '@cp/shared';
import { BADGE } from '@cp/shared';
import { Icon, FONT_BODY } from '../../components/ui';
import { useT } from '../../lib/i18n';

/** Coloured pill with an icon (health result, invoice status). Wraps when the text is long. */
export function Pill({ icon, bg, fg, children, style, iconSize = 18 }: { icon: string; bg: string; fg: string; children: ReactNode; style?: CSSProperties; iconSize?: number }) {
  return (
    <span style={{ minHeight: 30, padding: '4px 12px 4px 8px', borderRadius: 12, background: bg, color: fg, fontSize: FONT_BODY, lineHeight: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <Icon name={icon} size={iconSize} fill={1} color={fg} />
      {children}
    </span>
  );
}
/** Health result as families read it: Normal, or a Watch / Alert line that says what the nurse is doing. */
export function HealthPill({ status, style }: { status: Health; style?: CSSProperties }) {
  const t = useT();
  const b = BADGE[status];
  return <Pill icon={b[0]} fg={b[1]} bg={b[2]} style={{ alignSelf: 'flex-start', ...style }}>{t('family.badge' + status[0].toUpperCase() + status.slice(1))}</Pill>;
}

export const durText = (sec?: number) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

/** Five tappable stars (survey). */
export function Stars({ value, onChange, size, group }: { value: number; onChange: (n: number) => void; size: 'big' | 'small'; group: string }) {
  const t = useT();
  const big = size === 'big';
  return (
    <div role="group" aria-label={group} style={{ display: 'flex', gap: big ? 6 : 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={t('family.starsAria', { n })} aria-pressed={n === value}
            className={on ? undefined : 'cp-fill'} style={{ width: big ? 52 : 44, height: big ? 52 : 44, borderRadius: 999, border: 'none', background: on ? '#2B231C' : '#F4F4F5', color: on ? '#FFFFFF' : '#A89C8E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'background-color .15s' }}>
            <Icon name="star" size={big ? 30 : 24} fill={on ? 1 : 0} />
          </button>
        );
      })}
    </div>
  );
}
