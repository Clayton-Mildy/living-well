// Tab bar (prototype v3: quiet underline row). Tablet and laptop scroll sideways with edge fades and arrow buttons; a phone gets one swipeable row
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
      style={{ position: 'absolute', top: 0, bottom: 1, [dir < 0 ? 'left' : 'right']: 0, width: 48, border: 'none', background: `linear-gradient(to ${dir < 0 ? 'right' : 'left'}, #F5F5F3 55%, rgba(246,241,234,0))`, color: '#75624B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: dir < 0 ? 'flex-start' : 'flex-end', padding: 0, zIndex: 2 }}>
      <Icon name={dir < 0 ? 'chevron_left' : 'chevron_right'} size={22} />
    </button>
  );
  // v3 quiet underline tab row: 14-15px text, a 2px ink underline on the selected tab, one hairline under the row.
  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <div ref={ref} role="tablist" aria-label={label} className="scroll-x" style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: phone ? 20 : 28, borderBottom: '1px solid #E6DDD1', overflowX: wrap ? 'visible' : 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((b) => {
          const sel = b.key === current;
          return (
            <button key={b.key} type="button" role="tab" aria-selected={sel} aria-label={b.dot ? `${b.label}, ${pendingLabel}` : undefined} onClick={() => onChange(b.key)} data-tab={b.key}
              style={{ flex: 'none', height: phone ? 42 : 46, padding: 0, border: 'none', borderBottom: sel ? '2px solid #24201C' : '2px solid transparent', marginBottom: -1, background: 'transparent', color: sel ? '#24201C' : '#6B6259', fontSize: phone ? 14 : 15, fontWeight: sel ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter' }}>
              {b.label}
              {b.dot ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: '#7A5510' }} /> : null}
            </button>
          );
        })}
      </div>
      {!wrap && !phone && edge.l ? arrow(-1) : null}
      {!wrap && !phone && edge.r ? arrow(1) : null}
      {phone && edge.r ? <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 1, right: 0, width: 28, background: 'linear-gradient(to left, #F5F5F3 25%, rgba(246,241,234,0))', pointerEvents: 'none' }} /> : null}
    </div>
  );
}
