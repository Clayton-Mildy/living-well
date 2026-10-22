// ImageLightbox (round 13, every picture opens full size): opens with its src, closes on the X, on a tap outside the picture and on Escape; ImageOpen wraps a thumbnail.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../store/session';
import { ImageLightbox, ImageOpen } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  await new Promise((r) => setTimeout(r, 60)); // useBackClose takes its history entry back after a beat
});
async function mount(el: React.ReactElement) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
const q = (sel: string) => document.querySelector<HTMLElement>(sel);

describe('ImageLightbox', () => {
  it('shows the picture full screen', async () => {
    await mount(<ImageLightbox src="/media/scan.jpg" alt="KTP" onClose={() => {}} />);
    expect(q('[data-testid=image-lightbox]')?.getAttribute('role')).toBe('dialog');
    const img = q('[data-testid=image-lightbox-img]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/media/scan.jpg');
    expect(img.alt).toBe('KTP');
  });
  it('closes on the X (a 44 px target) and on a tap outside the picture, but not on the picture', async () => {
    const onClose = vi.fn();
    await mount(<ImageLightbox src="/media/a.jpg" onClose={onClose} />);
    const x = q('[data-testid=image-lightbox-close]') as HTMLButtonElement;
    expect(x.getAttribute('aria-label')).toBe('Close');
    expect(x.style.width).toBe('44px');
    expect(x.style.height).toBe('44px');
    await act(async () => { q('[data-testid=image-lightbox-img]')!.click(); });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { x.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { q('[data-testid=image-lightbox]')!.click(); });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    await mount(<ImageLightbox src="/media/a.jpg" onClose={onClose} />);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ImageOpen', () => {
  it('opens the lightbox from the thumbnail and closes it again', async () => {
    await mount(<ImageOpen src="/media/id.jpg" label="Open the ID card"><img src="/media/id.jpg" alt="" width={72} /></ImageOpen>);
    expect(q('[data-testid=image-lightbox]')).toBeNull();
    await act(async () => { (document.querySelector('button[aria-label="Open the ID card"]') as HTMLElement).click(); });
    expect(q('[data-testid=image-lightbox-img]')?.getAttribute('src')).toBe('/media/id.jpg');
    await act(async () => { (q('[data-testid=image-lightbox-close]') as HTMLElement).click(); });
    expect(q('[data-testid=image-lightbox]')).toBeNull();
  });
  it('renders the thumbnail bare when there is nothing to open', async () => {
    await mount(<ImageOpen src={undefined} label="Open"><span data-testid="thumb">x</span></ImageOpen>);
    expect(q('[data-testid=thumb]')).not.toBeNull();
    expect(document.querySelector('button')).toBeNull();
  });
});
