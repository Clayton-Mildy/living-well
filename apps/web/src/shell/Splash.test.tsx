// The family app's opening screen (KC's splash option 3, 9 Nov; built with the Living Well look, 10 Nov): gold, the white star, the white wordmark at the foot.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules(); // the splash shows once per page load: each test is a fresh load
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = '#FFFFFF';
  document.head.appendChild(m);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  vi.useRealTimers();
});
const load = async () => (await import('./Splash')).Splash;
const splash = () => host.querySelector<HTMLElement>('[data-testid="splash"]');
const bar = () => document.head.querySelector('meta[name="theme-color"]')!.getAttribute('content');
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('Splash', () => {
  it('shows the gold screen with the white star and the white wordmark, and colours the browser bar gold', async () => {
    const Splash = await load();
    act(() => root.render(<Splash ready={false} />));
    const el = splash()!;
    expect(el).toBeTruthy();
    expect(el.getAttribute('style')).toContain('rgb(207, 165, 80)');
    expect(el.getAttribute('aria-label')).toBe('CitraPremier by Living Well Seniors Communities');
    expect(Array.from(el.querySelectorAll('img')).map((i) => i.getAttribute('src'))).toEqual(['/brand-mark-white.svg', '/brand-wordmark-white.svg']);
    expect(bar()).toBe('#CFA550');
  });
  it('stays at least 0.9 s even when the data is already there, then fades and goes; the bar colour comes back', async () => {
    const Splash = await load();
    act(() => root.render(<Splash ready />));
    wait(800);
    expect(splash()?.dataset.phase).toBe('show');
    wait(200);
    expect(splash()?.dataset.phase).toBe('fade');
    wait(400);
    expect(splash()).toBeNull();
    expect(bar()).toBe('#FFFFFF');
  });
  it('waits for the data, but never longer than 3 s', async () => {
    const Splash = await load();
    act(() => root.render(<Splash ready={false} />));
    wait(2000);
    expect(splash()?.dataset.phase).toBe('show');
    act(() => root.render(<Splash ready />));
    expect(splash()?.dataset.phase).toBe('fade');
    act(() => root.unmount());
    vi.resetModules();
    root = createRoot(host);
    const Again = await load();
    act(() => root.render(<Again ready={false} />));
    wait(3000);
    expect(splash()?.dataset.phase).toBe('fade');
  });
  it('shows once per page load', async () => {
    const Splash = await load();
    act(() => root.render(<Splash ready />));
    wait(1000);
    wait(400);
    expect(splash()).toBeNull();
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Splash ready />));
    expect(splash()).toBeNull();
  });
});
