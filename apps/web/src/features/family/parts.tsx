// Shared visual parts for the family screens, copied from the design markup (ScrFamily / OvSheet / ScrFphotos / ScrFbill).
import type { CSSProperties, ReactNode } from 'react';
import type { Health, Photo } from '@cp/shared';
import { BADGE } from '@cp/shared';
import { Icon, FONT_BODY, FONT_SMALL, photoBg } from '../../components/ui';
import { useT } from '../../lib/i18n';

/** White card used all over the family pages (border #DBD7D6, 24px radius). */
// phone (global.css): --cp-fpad / --cp-fgap make the roomy cards tighter, so the key numbers sit higher on the first screen
export const fcard = (pad: string, gap: number, extra: CSSProperties = {}): CSSProperties => ({
  background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, padding: pad.split(' ')[0] === '16px' && !pad.includes(' ') ? pad : `var(--cp-fpad, ${pad})`, display: 'flex', flexDirection: 'column', gap: `min(${gap}px, var(--cp-fgap, ${gap}px))`, ...extra,
});
export const SOFT_SHADOW = '0 8px 24px rgba(117,98,75,0.06)';
export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{children}</h2>
);
export const H1 = ({ children }: { children: ReactNode }) => (
  <h1 style={{ margin: 0, fontSize: 30, lineHeight: '38px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{children}</h1>
);
/** 13px caps label (design label style). */
export const Cap = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', ...style }}>{children}</div>
);
export const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 16, lineHeight: '22px', color: '#282828', ...style }}>{children}</div>
);
export const Small = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, ...style }}>{children}</div>
);

/** The pill switcher: one tab per member plus "Both" (design: tablist aria-label="Parent"). */
export function FamSwitch({ items, value, onChange, label }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#F4F0EE' }}>
      {items.map((b) => {
        const sel = b.key === value;
        return (
          <button key={b.key} type="button" role="tab" aria-selected={sel} onClick={() => onChange(b.key)}
            style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 999, border: 'none', background: sel ? '#FFFFFF' : 'transparent', boxShadow: sel ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

/** Coloured pill with an icon (health result, invoice status). Wraps when the text is long. */
export function Pill({ icon, bg, fg, children, style, iconSize = 18 }: { icon: string; bg: string; fg: string; children: ReactNode; style?: CSSProperties; iconSize?: number }) {
  return (
    <span style={{ minHeight: 30, padding: '4px 12px 4px 8px', borderRadius: 16, background: bg, color: fg, fontSize: FONT_BODY, lineHeight: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
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

/** Banner under the member's name: where they are today (design `st`). */
export function StatusBanner({ icon, bg, fg, text, sub, compact }: { icon: string; bg: string; fg: string; text: ReactNode; sub?: ReactNode; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 12, padding: compact ? '10px 12px' : '12px 14px', borderRadius: 16, background: bg }}>
      <Icon name={icon} size={compact ? 22 : 26} fill={1} color={fg} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600, color: fg }}>{text}</span>
        {sub ? <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#282828' }}>{sub}</span> : null}
      </div>
    </div>
  );
}

export const durText = (sec?: number) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

/** A grid of photo tiles (3 across). Tapping a tile opens the viewer. */
export function PhotoGrid({ photos, onOpen, label, size = 'md' }: { photos: Photo[]; onOpen: (p: Photo) => void; label: (p: Photo) => string; size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
      {photos.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={label(p)} data-photo-id={p.id}
          style={{ aspectRatio: '1', borderRadius: 14, border: 'none', background: photoBg(p.tone), position: 'relative', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 6, bottom: 6, height: sm ? 22 : 24, padding: sm ? '0 7px' : '0 8px', borderRadius: 999, background: '#FFFFFF', color: '#282828', fontSize: sm ? 12 : 13, fontWeight: 500, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
          {p.media === 'video' ? (
            <>
              <span aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="play_arrow" size={28} fill={1} color="#FFFFFF" />
              </span>
              <span style={{ position: 'absolute', right: 6, bottom: 6, height: 24, padding: '0 8px', borderRadius: 999, background: '#282828', color: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>{durText(p.durationSec)}</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}

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
            style={{ width: big ? 52 : 44, height: big ? 52 : 44, borderRadius: big ? 14 : 12, border: on ? '1px solid #75624B' : '1px solid #DBD7D6', background: on ? '#F4F0EE' : '#FFFFFF', color: on ? '#75624B' : '#8A755B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="star" size={big ? 30 : 24} fill={on ? 1 : 0} />
          </button>
        );
      })}
    </div>
  );
}
