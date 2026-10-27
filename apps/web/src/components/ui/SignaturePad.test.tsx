// The signature pad (round 14 d): a canvas drawn with pointer events; one PNG after each stroke, null while empty, and a Clear button.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../store/session';
import { SignaturePad } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
// jsdom draws nothing: a recording 2D context and a canvas that "encodes" a PNG blob
const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(), arc: vi.fn(), fill: vi.fn(), scale: vi.fn(), fillRect: vi.fn() } as Record<string, unknown>;
beforeEach(() => {
  Object.values(ctx).forEach((f) => { if (typeof f === 'function') (f as ReturnType<typeof vi.fn>).mockClear(); }); // the pad also sets lineWidth and the colours on it
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  vi.restoreAllMocks();
});
function mount(onChange: (b: Blob | null) => void) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(<SignaturePad onChange={onChange} label="Sign here" />); });
}
const canvas = () => host!.querySelector('canvas') as HTMLCanvasElement;
/** React listens for the native pointer events; jsdom builds them from a plain Event with the coordinates added. */
function ptr(type: string, x: number, y: number, pointerType = 'mouse') {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType, isPrimary: true, buttons: type === 'pointerup' ? 0 : 1, button: 0 });
  act(() => { canvas().dispatchEvent(e); });
}
const stroke = (pointerType = 'mouse') => { ptr('pointerdown', 10, 10, pointerType); ptr('pointermove', 40, 30, pointerType); ptr('pointermove', 80, 20, pointerType); ptr('pointerup', 80, 20, pointerType); };

describe('SignaturePad', () => {
  it('is a labelled, 180 px tall canvas that stops the page scrolling while drawing', () => {
    mount(() => {});
    expect(canvas().getAttribute('aria-label')).toBe('Sign here');
    expect(canvas().style.touchAction).toBe('none');
    expect(canvas().style.height).toBe('180px');
    expect(canvas().style.width).toBe('100%');
  });
  it('is empty at first: Clear is there but nothing was reported', () => {
    const on = vi.fn(); mount(on);
    expect(on).not.toHaveBeenCalled();
    const clear = Array.from(host!.querySelectorAll('button')).find((b) => b.textContent === 'Clear')!;
    expect(clear).toBeTruthy();
    expect(parseFloat(clear.style.minHeight)).toBeGreaterThanOrEqual(44);
  });
  it('a stroke ends with a PNG blob (mouse, touch and pen alike)', () => {
    for (const kind of ['mouse', 'touch', 'pen']) {
      const on = vi.fn(); mount(on);
      stroke(kind);
      expect(on).toHaveBeenCalledTimes(1);
      const blob = on.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(HTMLCanvasElement.prototype.setPointerCapture).toHaveBeenCalled();
      act(() => root!.unmount()); host!.remove(); root = null; host = null;
    }
  });
  it('moving without pressing draws nothing', () => {
    const on = vi.fn(); mount(on);
    ptr('pointermove', 30, 30); ptr('pointerup', 30, 30);
    expect(on).not.toHaveBeenCalled();
  });
  it('Clear wipes the canvas and reports null', () => {
    const on = vi.fn(); mount(on);
    stroke();
    on.mockClear();
    act(() => { Array.from(host!.querySelectorAll('button')).find((b) => b.textContent === 'Clear')!.click(); });
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(on).toHaveBeenCalledWith(null);
  });
  it('a late encode after Clear is dropped: the last report is null', () => {
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => { pending.push(cb); });
    const on = vi.fn(); mount(on);
    stroke();
    act(() => { Array.from(host!.querySelectorAll('button')).find((b) => b.textContent === 'Clear')!.click(); });
    act(() => { pending.forEach((cb) => cb(new Blob(['png'], { type: 'image/png' }))); }); // the encoder answers after Clear
    expect(on).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenLastCalledWith(null);
  });
  it('nothing is reported after the pad is gone', () => {
    const pending: BlobCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => { pending.push(cb); });
    const on = vi.fn(); mount(on);
    stroke();
    act(() => root!.unmount()); root = null;
    pending.forEach((cb) => cb(new Blob(['png'], { type: 'image/png' })));
    expect(on).not.toHaveBeenCalled();
  });
  it('a second pointer (another finger, a resting palm) neither draws nor ends the stroke', () => {
    const on = vi.fn(); mount(on);
    const p = (type: string, x: number, id: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { clientX: x, clientY: 20, pointerId: id, pointerType: 'touch', isPrimary: id === 1, buttons: 1, button: 0 });
      act(() => { canvas().dispatchEvent(e); });
    };
    p('pointerdown', 10, 1); p('pointermove', 30, 1);
    const lines = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length;
    p('pointerdown', 100, 2); p('pointermove', 120, 2); p('pointerup', 120, 2);
    expect((ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length).toBe(lines); // the second pointer drew nothing
    expect(on).not.toHaveBeenCalled(); // and its lift did not end the first stroke
    p('pointerup', 30, 1);
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('the placeholder goes as soon as the pen touches down', () => {
    mount(() => {});
    expect(host!.textContent).toContain('Sign here');
    ptr('pointerdown', 10, 10);
    expect(host!.textContent).not.toContain('Sign here');
  });
});
