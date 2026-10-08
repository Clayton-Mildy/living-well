// Shared visual parts for the family screens, copied from the design markup (ScrFamily / OvSheet / ScrFphotos / ScrFbill).
import type { CSSProperties, ReactNode } from 'react';
import type { Health, Photo } from '@cp/shared';
import { BADGE } from '@cp/shared';
import { Icon, FONT_BODY, photoBg } from '../../components/ui';
import { useT } from '../../lib/i18n';

/** Prototype v3 card: white, hairline warm border, 28px radius, lifted shadow. The padding and gap breathe with the screen width. */
export const SOFT_SHADOW = '0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)';
export const fcard = (_pad: string, gap: number, extra: CSSProperties = {}): CSSProperties => ({
  background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 20, boxShadow: SOFT_SHADOW, padding: 'clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: `clamp(12px, 3.4vw, ${gap + 4}px)`, ...extra,
});
/** The member card: roomier than the others (design: padding clamp(20px, 3.4cqi, 36px), 26px gaps). */
export const heroCard = (extra: CSSProperties = {}): CSSProperties => fcard('', 22, { padding: 'clamp(20px, 3.4vw, 36px)', gap: 'clamp(16px, 3.4vw, 26px)', ...extra });
/** A hairline-separated block inside a hero card. */
export const heroBlock: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 'clamp(16px, 3vw, 24px)', borderTop: '1px solid #F0EAE1' };
export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 style={{ margin: 0, fontSize: 22, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.4px', color: '#2B231C' }}>{children}</h2>
);
export const H1 = ({ children }: { children: ReactNode }) => (
  <h1 style={{ margin: 0, fontSize: 'clamp(32px, 7vw, 44px)', lineHeight: 1.05, fontWeight: 400, letterSpacing: '-1.2px', color: '#2B231C' }}>{children}</h1>
);
/** Eyebrow label (v3: 12px, 2px tracking, #6E5A43). */
export const Cap = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, lineHeight: '18px', color: '#6E5A43', ...style }}>{children}</div>
);
/** A bronze text link that is a button (keeps its accessible name; looks like the prototype's "Profile" / "Send" links). */
export const linkBtn: CSSProperties = { border: 'none', background: 'transparent', padding: '0 4px', minHeight: 44, color: '#75624B', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'Inter', flex: 'none' };
export const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 15, lineHeight: '22px', color: '#24201C', ...style }}>{children}</div>
);
export const Small = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4, ...style }}>{children}</div>
);

/** Quiet member tabs: text with a 2px underline (design: tablist aria-label="Parent"). */
export function FamSwitch({ items, value, onChange, label, segmented }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string; segmented?: boolean }) {
  // round 6, phone: an iOS segmented control instead of the underline tabs
  if (segmented) {
    return (
      <div role="tablist" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 2, padding: 3, borderRadius: 11, background: '#EAE6E0' }}>
        {items.map((b) => {
          const sel = b.key === value;
          return (
            <button key={b.key} type="button" role="tab" aria-selected={sel} onClick={() => onChange(b.key)}
              style={{ minWidth: 0, height: 36, padding: '0 6px', borderRadius: 9, border: 'none', background: sel ? '#FFFFFF' : 'transparent', boxShadow: sel ? '0 1px 3px rgba(40,30,20,0.14)' : 'none', fontSize: 15, fontWeight: sel ? 600 : 500, color: sel ? '#1E1A16' : '#5E5852', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Inter', transition: 'background-color .15s' }}>
              {b.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: 'clamp(20px, 6vw, 28px)', borderBottom: '1px solid #E6DDD1', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {items.map((b) => {
        const sel = b.key === value;
        return (
          <button key={b.key} type="button" role="tab" aria-selected={sel} onClick={() => onChange(b.key)}
            style={{ padding: '10px 0 12px', marginBottom: -1, border: 'none', borderBottom: `2px solid ${sel ? '#2B231C' : 'transparent'}`, background: 'transparent', fontSize: 16, fontWeight: sel ? 600 : 400, color: sel ? '#1E1A16' : '#6B6259', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
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

/** Where the member is today: a dot and one line, bold lead-in then the quiet remainder (design: "Not at the club yet. Usually arrives around 10:05."). */
export function StatusBanner({ dot, text, sub }: { dot: string; text: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, lineHeight: '22px' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: dot, flex: 'none', marginTop: 7 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 500, color: '#24201C' }}>{text}</span>
        {sub ? <>{' '}<span style={{ color: '#6B6259' }}>{sub}</span></> : null}
      </span>
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
        <button key={p.id} type="button" onClick={() => onOpen(p)} aria-label={label(p)} data-photo-id={p.id} className="cp-press"
          style={{ aspectRatio: '1', borderRadius: 10, border: 'none', background: photoBg(p.tone), position: 'relative', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 6, bottom: 6, height: sm ? 22 : 24, padding: sm ? '0 7px' : '0 8px', borderRadius: 999, background: '#FFFFFF', color: '#24201C', fontSize: sm ? 12 : 13, fontWeight: 500, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
          {p.media === 'video' ? (
            <>
              <span aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: 999, background: 'rgba(40,40,40,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="play_arrow" size={28} fill={1} color="#FFFFFF" />
              </span>
              <span style={{ position: 'absolute', right: 6, bottom: 6, height: 24, padding: '0 8px', borderRadius: 8, background: '#24201C', color: '#FFFFFF', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center' }}>{durText(p.durationSec)}</span>
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
            style={{ width: big ? 52 : 44, height: big ? 52 : 44, borderRadius: big ? 14 : 12, border: on ? '1px solid #75624B' : '1px solid #E4DACD', background: on ? '#F3EEE8' : '#FFFFFF', color: on ? '#75624B' : '#8A755B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name="star" size={big ? 30 : 24} fill={on ? 1 : 0} />
          </button>
        );
      })}
    </div>
  );
}
