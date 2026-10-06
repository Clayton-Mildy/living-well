// Tab bar (design: segmented pill). Tablet and laptop scroll sideways with edge fades and arrow buttons; a phone gets one swipeable row of compact pills
// (no arrows, a soft fade on the right edge, the active tab scrolled into view).
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui';

export interface TabItem { key: string; label: string; dot?: boolean }

export function ScrollTabs({ tabs, current, onChange, wrap, label, pendingLabel, leftLabel, rightLabel, phone }: { tabs: TabItem[]; current: string; onChange: (k: string) => void; wrap: boolean; label: string; pendingLabel: string; leftLabel: string; rightLabel: string; phone?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    el?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [tabs.length, wrap]);
  useEffect(() => {
    if (wrap) return;
    const el = ref.current;
    const on = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && on) {
      const l = on.offsetLeft - 44, r = on.offsetLeft + on.offsetWidth + 44;
      if (l < el.scrollLeft) el.scrollTo({ left: Math.max(0, l), behavior: 'smooth' });
      else if (r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r - el.clientWidth, behavior: 'smooth' });
    }
    update();
  }, [current, wrap]);
  const arrow = (dir: -1 | 1) => (
    <button type="button" aria-label={dir < 0 ? leftLabel : rightLabel} onClick={() => ref.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })}
      style={{ position: 'absolute', top: 0, bottom: 0, [dir < 0 ? 'left' : 'right']: 0, width: 52, border: 'none', borderRadius: dir < 0 ? '999px 0 0 999px' : '0 999px 999px 0', background: `linear-gradient(to ${dir < 0 ? 'right' : 'left'}, #F4F0EE 55%, rgba(244,240,238,0))`, color: '#75624B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: dir < 0 ? 'flex-start' : 'flex-end', padding: '0 8px', zIndex: 2 }}>
      <Icon name={dir < 0 ? 'chevron_left' : 'chevron_right'} size={24} />
    </button>
  );
  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <div ref={ref} role="tablist" aria-label={label} className="scroll-x" style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 4, padding: phone ? 3 : 4, borderRadius: wrap ? 24 : 999, background: '#F4F0EE', overflowX: wrap ? 'visible' : 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((b) => {
          const sel = b.key === current;
          return (
            <button key={b.key} type="button" role="tab" aria-selected={sel} aria-label={b.dot ? `${b.label}, ${pendingLabel}` : undefined} onClick={() => onChange(b.key)} data-tab={b.key}
              style={{ flex: 'none', height: phone ? 38 : 44, padding: phone ? '0 14px' : '0 18px', borderRadius: 999, border: 'none', background: sel ? '#FFFFFF' : 'transparent', boxShadow: sel ? '0 1px 3px rgba(40,30,20,0.12)' : 'none', color: '#282828', fontSize: phone ? 15 : 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Inter' }}>
              {b.label}
              {b.dot ? <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: '#7A5510' }} /> : null}
            </button>
          );
        })}
      </div>
      {!wrap && !phone && edge.l ? arrow(-1) : null}
      {!wrap && !phone && edge.r ? arrow(1) : null}
      {phone && edge.r ? <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 32, borderRadius: '0 999px 999px 0', background: 'linear-gradient(to left, #F4F0EE 25%, rgba(244,240,238,0))', pointerEvents: 'none' }} /> : null}
    </div>
  );
}
