// The title picker: Oma / Opa / Ibu / Bapak, or Other with a free text (e.g. "Tante").
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useSession } from '../../../store/session';
import { TitleField } from './TitleField';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; });

let last = '';
function Harness({ start }: { start: string }) {
  const [v, setV] = useState(start);
  last = v;
  return <TitleField value={v} onChange={setV} error={v === '' ? 'needed' : undefined} />;
}
async function show(start: string) {
  useSession.setState({ lang: 'en' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Harness start={start} />); });
}
const chip = (name: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === name) as HTMLButtonElement;
const field = () => document.querySelector('input') as HTMLInputElement | null;
const type = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('TitleField', () => {
  it('shows the four presets and Other; a preset needs no text field', async () => {
    await show('Oma');
    expect(['Oma', 'Opa', 'Ibu', 'Bapak', 'Other'].map((n) => !!chip(n))).toEqual([true, true, true, true, true]);
    expect(chip('Oma').getAttribute('aria-pressed')).toBe('true');
    expect(field()).toBeNull();
    await act(async () => { chip('Bapak').click(); });
    expect(last).toBe('Bapak');
  });
  it('Other reveals a text field (max 20) and reports what is typed', async () => {
    await show('Oma');
    await act(async () => { chip('Other').click(); });
    expect(chip('Other').getAttribute('aria-pressed')).toBe('true');
    expect(field()).not.toBeNull();
    expect(field()!.maxLength).toBe(20);
    expect(field()!.placeholder).toBe('e.g. Tante');
    await type(field()!, 'Tante');
    expect(last).toBe('Tante');
    expect(chip('Other').getAttribute('aria-pressed')).toBe('true'); // stays on Other while the text is a custom title
    expect(chip('Oma').getAttribute('aria-pressed')).toBe('false');
  });
  it('opens on Other with the text when the value is not a preset, and tapping a preset hides it', async () => {
    await show('Tante');
    expect(field()!.value).toBe('Tante');
    await act(async () => { chip('Opa').click(); });
    expect(last).toBe('Opa');
    expect(field()).toBeNull();
  });
  it('an emptied Other field keeps the field open and shows the error', async () => {
    await show('Tante');
    await type(field()!, '');
    expect(last).toBe('');
    expect(field()).not.toBeNull();
    expect(document.body.textContent).toContain('needed');
  });
});
