// Plans: five sections in order (Plans, Extra charges, One-off fees, Changes when edited, Next invoice preview); the Flex visits rule lives in the Flex card.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Plans } from './Plans';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
function openClub() {
  const state = buildSeed().citra;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement, width: number) {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={['/plans']}>{ui}</MemoryRouter>); });
}
const sections = () => Array.from(document.querySelectorAll<HTMLElement>('section[aria-label]')).map((x) => x.getAttribute('aria-label'));
const section = (name: string) => document.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const type = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const priceInput = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name} price in rupiah"]`)!;
const quotaInput = () => Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((i) => i.closest('label')?.textContent?.includes('Flex visits per month'))!;

describe.each([['phone', 390], ['wide', 1280]])('Plans sections (%s)', (_n, width) => {
  it('shows Plans, Extra charges, One-off fees and the preview in that order', async () => {
    openClub();
    await show(<Plans />, width);
    expect(sections()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Next invoice preview']);
    expect(section('Plans')!.contains(priceInput('Flex'))).toBe(true);
    expect(section('Plans')!.contains(priceInput('Gold'))).toBe(true);
    expect(section('Extra charges')!.contains(priceInput('Extra day'))).toBe(true);
    expect(section('Extra charges')!.contains(priceInput('Leave (cuti)'))).toBe(true);
    expect(section('One-off fees')!.contains(priceInput('Registration'))).toBe(true);
    expect(section('One-off fees')!.contains(priceInput('Trial'))).toBe(true);
    expect(section('Plans')!.contains(quotaInput())).toBe(true);
    expect(document.body.textContent).not.toContain('Club rules');
  });
  it('a visits edit adds Changes with the next-invoice note, no date and no notify switch', async () => {
    openClub();
    await show(<Plans />, width);
    expect(section('Changes')).toBeNull();
    await type(quotaInput(), '9');
    expect(sections()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Changes', 'Next invoice preview']);
    const ch = section('Changes')!;
    expect(ch.textContent).toContain('Takes effect from');
    expect(ch.textContent).toContain('On next month’s invoice');
    expect(ch.textContent).not.toContain('Notify the team');
    expect(ch.querySelector('input')).toBeNull();
  });
  it('a price edit adds Changes with the date field and Notify the team', async () => {
    openClub();
    await show(<Plans />, width);
    await type(priceInput('Flex'), '2.800.000');
    const ch = section('Changes')!;
    expect(ch.textContent).toContain('Notify the team');
    expect(ch.textContent).toContain('Takes effect from');
    expect(ch.querySelector('input, button[aria-haspopup], [role="button"]')).toBeTruthy();
  });
});
