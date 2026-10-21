// KC round 10 ("when we press long, it should select, and multi-select to save in bulk"): the pieces the photo tiles share for selecting pictures.
// `pressProps` turns a tile into a long-press target (450 ms, cancelled by a move or a scroll; the click that follows a long press is swallowed);
// `SelectMark` is the ring / check drawn on a tile while selecting; `tileSelectStyle` keeps the phone from showing its own "save image" callout.
import type { CSSProperties, MouseEvent as RME, PointerEvent as RPE } from 'react';
import type { Photo } from '@cp/shared';
import { Icon } from '../../components/ui';

/** What the Photos screen hands its tiles: whether selecting is on, which pictures are in, and how to toggle or start. */
export interface PhotoSelect {
  on: boolean;
  has: (id: string) => boolean;
  toggle: (p: Photo) => void;
  /** a long press on a tile: start selecting with this picture */
  start: (p: Photo) => void;
}

const HOLD_MS = 450;
const MOVE_PX = 10;
interface Press { t: number; x: number; y: number; fired: boolean }
const presses = new WeakMap<Element, Press>();
const clear = (el: Element) => { const st = presses.get(el); if (st) { clearTimeout(st.t); if (!st.fired) presses.delete(el); } };

/** Pointer handlers for a long press. Spread them on the tile's button after its own onClick (the click after a long press is swallowed here). */
export function pressProps(onLong: () => void, enabled = true) {
  if (!enabled) return {};
  return {
    onPointerDown(e: RPE<HTMLElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.currentTarget;
      clear(el);
      const st: Press = { t: 0, x: e.clientX, y: e.clientY, fired: false };
      st.t = window.setTimeout(() => { st.fired = true; try { navigator.vibrate?.(10); } catch { /* not everywhere */ } onLong(); }, HOLD_MS);
      presses.set(el, st);
    },
    onPointerMove(e: RPE<HTMLElement>) {
      const st = presses.get(e.currentTarget);
      if (st && !st.fired && Math.hypot(e.clientX - st.x, e.clientY - st.y) > MOVE_PX) { clearTimeout(st.t); presses.delete(e.currentTarget); }
    },
    onPointerUp(e: RPE<HTMLElement>) { clear(e.currentTarget); },
    onPointerCancel(e: RPE<HTMLElement>) { clearTimeout(presses.get(e.currentTarget)?.t); presses.delete(e.currentTarget); },
    onContextMenu(e: RME<HTMLElement>) { e.preventDefault(); }, // the phone's own long-press menu (or the mouse's) stays out of the way
    onClickCapture(e: RME<HTMLElement>) {
      const st = presses.get(e.currentTarget);
      if (st?.fired) { e.preventDefault(); e.stopPropagation(); presses.delete(e.currentTarget); }
    },
  };
}

/** No text selection or image callout on a tile that can be long-pressed. */
export const tileSelectStyle: CSSProperties = { WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' };

/** The ring (not selected) or ink check (selected) at a tile's top right (`left` when something else sits there, like a post's count), plus a light wash over a selected picture. */
export function SelectMark({ selected, size = 24, left }: { selected: boolean; size?: number; left?: boolean }) {
  return (
    <>
      {selected ? <span aria-hidden="true" data-testid="tile-selected" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.28)', boxShadow: 'inset 0 0 0 3px #FFFFFF', pointerEvents: 'none' }} /> : null}
      <span aria-hidden="true" data-testid="tile-mark" data-selected={selected || undefined}
        style={{ position: 'absolute', top: left ? 10 : 8, [left ? 'left' : 'right']: left ? 10 : 8, width: size, height: size, borderRadius: 999, background: selected ? '#24201C' : 'rgba(20,16,12,.25)', boxShadow: selected ? '0 0 0 2px #FFFFFF' : 'inset 0 0 0 2px #FFFFFF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {selected ? <Icon name="check" size={Math.round(size * 0.7)} color="#FFFFFF" /> : null}
      </span>
    </>
  );
}
