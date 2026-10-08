// The printed Membership Application Form: four A4 pages (the brochure images as backgrounds) with the answers placed on their lines, the Print button,
// Escape closing only the form, a blank line for anything not answered, and the print CSS (one sheet per page, the app hidden).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@cp/shared';
import { applicationDataOf, applicationDataFromInput, type ApplicationFormData } from '@cp/shared/rules/applicationForm';
import { useSession } from '../../store/session';
import { ApplicationForm } from './ApplicationForm';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function show(data: ApplicationFormData, onClose = () => {}, lang: 'en' | 'id' = 'en') {
  useSession.setState({ lang });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<ApplicationForm data={data} onClose={onClose} />); });
}
const page = (n: number) => document.querySelectorAll('[data-testid="form-page"]')[n - 1];
const field = (n: number, k: string) => page(n).querySelector(`[data-field="${k}"]`);

describe('ApplicationForm', () => {
  const s = buildSeed().citra;
  it('is four pages, each with its brochure page as the background', async () => {
    await show(applicationDataOf(s, 'm1', T));
    expect(document.querySelectorAll('[data-testid="form-page"]')).toHaveLength(4);
    for (const n of [1, 2, 3, 4]) expect(page(n).querySelector('img.cp-print-bg')?.getAttribute('src')).toBe(`/forms/application-${n}.jpg`);
    expect(page(2).querySelectorAll('[data-field]')).toHaveLength(0); // terms only: the initials stay blank
  });
  it('puts every value of page 1 on its own line, positioned as a share of the page', async () => {
    await show(applicationDataOf(s, 'm1', T));
    expect(field(1, 'name')?.textContent).toBe('Lina Wijaya');
    expect(field(1, 'nickname')?.textContent).toBe('Oma Lina');
    expect(field(1, 'marital')?.textContent).toBe('Menikah');
    expect(field(1, 'kinRelation')?.textContent).toBe('Putri');
    const name = (field(1, 'name') as HTMLElement).style;
    expect(name.left).toMatch(/%$/); // percentages, not pixels, so it scales to any page size
    expect(parseFloat(name.left)).toBeCloseTo((386 / 1654) * 100, 1);
    expect(name.top).toMatch(/%$/);
    expect(name.width).toMatch(/%$/);
    for (const k of ['idGuarantor', 'idMember', 'idCarer']) expect(field(1, k)).not.toBeNull(); // the three ticks
    expect(field(1, 'date')?.textContent).toBe('21 Oktober 2026');
  });
  it('writes the signer on pages 1, 3 and 4 and the print date; the signature is left to the pen', async () => {
    await show(applicationDataOf(s, 'm1', T));
    expect(field(1, 'signer')?.textContent).toBe('Maria Wijaya');
    expect(field(3, 'signer')?.textContent).toBe('Maria Wijaya');
    expect(field(3, 'date')?.textContent).toBe('21 Oktober 2026');
    expect(field(4, 'saya')?.textContent).toBe('Maria Wijaya');
    expect(field(4, 'date')?.textContent).toBe('21 Oktober 2026');
    expect(field(4, 'signer')?.textContent).toBe('Maria Wijaya');
  });
  it('leaves a line blank when there is nothing to write, and a tick off when the ID is not in', async () => {
    const d = applicationDataFromInput(s, { name: 'Siti Rahma', dob: '', address: '', plan: 'flex', nanny: null, contact: { name: '', phone: '', relation: 'daughter', primary: true }, health: { conditions: [], food: [], foodOther: '', drugs: [] } }, T);
    await show(d);
    expect(field(1, 'name')?.textContent).toBe('Siti Rahma');
    expect(field(1, 'nickname')).toBeNull();
    expect(field(1, 'email')).toBeNull();
    expect(field(1, 'idGuarantor')).toBeNull();
    expect(field(1, 'signer')).toBeNull(); // no contact typed yet
  });
  it('keeps an email in its own case; everything else is written in capitals (the form asks for it)', async () => {
    await show(applicationDataOf(s, 'm1', T));
    expect((field(1, 'email') as HTMLElement).style.textTransform).toBe('none');
    expect((field(1, 'name') as HTMLElement).style.textTransform).toBe('uppercase');
  });
  it('a long answer shrinks (or wraps to two lines) instead of running off its line', async () => {
    const long = { ...applicationDataOf(s, 'm1', T), conditions: Array.from({ length: 8 }, (_, i) => `Condition number ${i + 1}`) };
    await show(long);
    const size = (k: string) => parseFloat(field(1, k)!.getAttribute('data-fit')!);
    expect(size('name')).toBe(1);
    expect(size('conditions')).toBeLessThan(1);
    expect((field(1, 'conditions') as HTMLElement).style.whiteSpace).toBe('normal');
  });
  it('Print calls window.print(); Escape and Close ask to close', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const close = vi.fn();
    await show(applicationDataOf(s, 'm1', T), close);
    const btn = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim().endsWith(label))!;
    await act(async () => { btn('Print').click(); });
    expect(print).toHaveBeenCalledTimes(1);
    await act(async () => { btn('Close').click(); });
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('the print CSS is A4 with no margin, one sheet per page, and hides the rest of the app', async () => {
    await show(applicationDataOf(s, 'm1', T));
    const css = document.querySelector('.cp-print-root style')?.textContent || '';
    expect(css).toMatch(/@page\s*\{\s*size:\s*A4;\s*margin:\s*0/);
    expect(css).toMatch(/@media print/);
    expect(css).toMatch(/body > \*:not\(\.cp-print-root\)\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.cp-print-sheet\s*\{[^}]*width:\s*210mm/);
    expect(css).toMatch(/break-after:\s*page/);
    expect(css).toMatch(/\.cp-print-bar\s*\{\s*display:\s*none/);
  });
  it('the bar is in the reader’s language; the form itself stays Indonesian', async () => {
    await show(applicationDataOf(s, 'm1', T), () => {}, 'id');
    expect(document.querySelector('.cp-print-bar h2')?.textContent).toBe('Formulir pendaftaran keanggotaan');
    expect(field(1, 'q2')?.textContent).toBe('Ya');
  });
});
