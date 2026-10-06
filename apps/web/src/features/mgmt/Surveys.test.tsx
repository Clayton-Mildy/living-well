// Surveys: who gets it. Every family with the app, the families of chosen members, or chosen contacts (searchable, paged); the count follows
// and is shown before sending. (The seed has six family contacts with the app and five members they belong to.)
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Surveys } from './Surveys';

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
function openClub(club: 'citra' | 'adina' = 'citra', lang: 'en' | 'id' = 'en') {
  const state = buildSeed()[club];
  useSession.setState({ lang, club, user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club, userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim() || b.getAttribute('aria-label') || ''; };
const button = (label: string | RegExp) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label || b.getAttribute('aria-label') === label : label.test(x); });
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const count = () => document.querySelector('[data-testid="survey-count"]')?.textContent;
const picked = () => document.querySelector('[data-testid="survey-picked"]')?.textContent;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
const row = (name: RegExp) => rows().find((r) => name.test(r.textContent ?? ''));
async function type(el: HTMLInputElement, v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const search = () => document.querySelector<HTMLInputElement>('[data-testid="survey-audience"] input[type="search"]')!;

describe('survey recipients', () => {
  it('every family with the app is the default, and the count is on the page before sending', async () => {
    openClub();
    await show(<Surveys />);
    expect(count()).toBe('Goes to 6 families');
    expect(button('Send to 6 families')).toBeTruthy();
    expect(document.querySelector('[data-testid="survey-audience"]')!.textContent).toContain('All families with the app');
    expect(rows()).toHaveLength(0); // nothing to pick from in this mode
  });
  it('families of chosen members: nobody until someone is picked; a shared family counts once; search narrows the list', async () => {
    openClub();
    await show(<Surveys />);
    await click(button('Families of chosen members'));
    expect(count()).toBe('Goes to 0 families');
    expect(picked()).toBe('0 members chosen');
    expect(button(/^Send to 0 families/)?.getAttribute('aria-disabled')).toBe('true');
    expect(rows()).toHaveLength(5);
    await type(search(), 'lina');
    expect(rows()).toHaveLength(1);
    await click(row(/Oma Lina Wijaya/));
    expect(count()).toBe('Goes to 2 families'); // Maria and Daniel
    expect(picked()).toBe('1 member chosen');
    await type(search(), '');
    await click(row(/Opa Budi Wijaya/)); // the same two contacts
    expect(count()).toBe('Goes to 2 families');
    await click(row(/Opa Hendra Gunawan/));
    expect(count()).toBe('Goes to 4 families');
    expect(picked()).toBe('3 members chosen');
    await click(button('Clear selection'));
    expect(count()).toBe('Goes to 0 families');
    await type(search(), 'zzz');
    expect(document.body.textContent).toContain('Nobody matches your search.');
  });
  it('chosen people: six contacts over two pages; select all in the list; the picks of the other choice are kept', async () => {
    openClub();
    await show(<Surveys />);
    await click(button('Families of chosen members'));
    await click(row(/Opa Hendra Gunawan/));
    await click(button('Chosen people'));
    expect(count()).toBe('Goes to 0 families'); // the member picks do not count here
    expect(rows()).toHaveLength(5); // five a page
    expect(document.querySelector('[data-testid="survey-audience"] nav')).toBeTruthy();
    await click(button('Next page') ?? button('Page 2'));
    expect(rows()).toHaveLength(1);
    await click(row(/Yohana Lim/));
    expect(count()).toBe('Goes to 1 family');
    expect(picked()).toBe('1 person chosen');
    await type(search(), 'gunawan');
    expect(rows()).toHaveLength(2);
    await click(button('Select all in the list'));
    expect(count()).toBe('Goes to 3 families');
    await click(button('Families of chosen members'));
    expect(count()).toBe('Goes to 2 families'); // Opa Hendra's two contacts
  });
  it('an empty clubhouse has nobody to send to', async () => {
    openClub('adina');
    await show(<Surveys />);
    expect(document.body.textContent).toContain('No family has the app yet, so there is nobody to send to.');
    expect(button(/^Send to 0 families/)?.getAttribute('aria-disabled')).toBe('true');
  });
  it('Indonesian: the choices and the count are translated', async () => {
    openClub('citra', 'id');
    await show(<Surveys />);
    expect(document.body.textContent).toContain('Siapa yang menerima');
    expect(count()).toBe('Dikirim ke 6 keluarga');
    await click(button('Orang pilihan'));
    expect(picked()).toBe('0 orang dipilih');
    expect(document.body.textContent).not.toMatch(/\bmgmt\.[A-Za-z]/);
  });
});
