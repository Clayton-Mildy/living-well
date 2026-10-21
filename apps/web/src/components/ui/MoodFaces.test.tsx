// The five-face mood row (round 12): great first, one tap reports the face, the chosen one is marked.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../store/session';
import { MoodFaces } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});
function mount(el: React.ReactElement) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
}

describe('MoodFaces', () => {
  it('renders five faces, great first, and reports the tap', () => {
    const on = vi.fn(); mount(<MoodFaces value={null} onChange={on} name="t" />);
    const radios = host!.querySelectorAll('[role=radio]'); expect(radios).toHaveLength(5);
    expect(radios[0].getAttribute('data-face')).toBe('5'); expect(radios[4].getAttribute('data-face')).toBe('1');
    act(() => (radios[1] as HTMLButtonElement).click()); expect(on).toHaveBeenCalledWith(4);
  });
  it('marks the chosen face', () => {
    mount(<MoodFaces value={3} onChange={() => {}} name="t" />);
    expect(host!.querySelector('[role=radio][aria-checked=true]')?.getAttribute('data-face')).toBe('3');
    expect(host!.querySelectorAll('[role=radio][aria-checked=true]')).toHaveLength(1);
  });
  it('names each face for a screen reader and shows labels only when asked', () => {
    mount(<MoodFaces value={null} onChange={() => {}} name="t" />);
    expect(host!.querySelector('[data-face="5"]')?.getAttribute('aria-label')).toBe('Great');
    expect(host!.textContent).not.toContain('Great');
    act(() => { root!.render(<MoodFaces value={null} onChange={() => {}} name="t" labels />); });
    expect(host!.textContent).toContain('Great');
  });
});
