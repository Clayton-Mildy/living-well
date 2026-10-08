// Surveys: who gets it. Every family with the app, the families of chosen members, or chosen contacts (searchable, paged); the count follows
// and is shown before sending. (The seed has six family contacts with the app and five members they belong to.)
// Round 7: the page is Live | Drafts | Templates | Log; "New survey" opens the editor (blank or from a template); a survey opens in full.
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
/** New survey -> blank (or a template) -> the editor. */
async function openEditor(kind: 'family' | 'venue' = 'family') {
  await click(button(/^(New survey|Survei baru)$/));
  await click(document.querySelector<HTMLElement>(`[data-pick-survey="blank-${kind}"]`) ?? undefined);
}
const search = () => document.querySelector<HTMLInputElement>('[data-testid="survey-audience"] input[type="search"]')!;

describe('survey recipients', () => {
  it('every family with the app is the default, and the count is on the page before sending', async () => {
    openClub();
    await show(<Surveys />);
    await openEditor();
    expect(count()).toBe('Goes to 6 families');
    expect(button('Send to 6 families')).toBeTruthy();
    expect(document.querySelector('[data-testid="survey-audience"]')!.textContent).toContain('All families with the app');
    expect(rows()).toHaveLength(0); // nothing to pick from in this mode
  });
  it('families of chosen members: nobody until someone is picked; a shared family counts once; search narrows the list', async () => {
    openClub();
    await show(<Surveys />);
    await openEditor();
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
    await openEditor();
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
    await openEditor();
    expect(document.body.textContent).toContain('No family has the app yet, so there is nobody to send to.');
    expect(button(/^Send to 0 families/)?.getAttribute('aria-disabled')).toBe('true');
  });
  it('Indonesian: the choices and the count are translated', async () => {
    openClub('citra', 'id');
    await show(<Surveys />);
    await openEditor();
    expect(document.body.textContent).toContain('Siapa yang menerima');
    expect(count()).toBe('Dikirim ke 6 keluarga');
    await click(button('Orang pilihan'));
    expect(picked()).toBe('0 orang dipilih');
    expect(document.body.textContent).not.toMatch(/\bmgmt\.[A-Za-z]/);
  });
});

describe('survey templates, the log and venue surveys', () => {
  it('Live shows the family survey and the venue survey together, each with its numbers', async () => {
    openClub();
    await show(<Surveys />);
    const live = Array.from(document.querySelectorAll('[data-live]')).map((x) => x.getAttribute('data-live'));
    expect(live.sort()).toEqual(['sv1', 'svv1']);
    const text = document.body.textContent ?? '';
    expect(text).toContain('October check-in');
    expect(text).toContain('Venue rating');
    expect(text).toContain('2 of 3 answered'); // the venue survey: two answers, three rating links sent
    expect(text).toContain('3 of 4 answered'); // the family survey
  });
  it('the Log lists every survey sent, newest first; one opens with Summary, Responses and History', async () => {
    openClub();
    await show(<Surveys />);
    await click(button('Log'));
    const ids = Array.from(document.querySelectorAll('[data-survey]')).map((x) => x.getAttribute('data-survey'));
    expect(ids).toEqual(['sv1', 'svv1', 'sv0']);
    expect(document.querySelector('[data-survey="svv1"]')!.textContent).toContain('Sent 3 · 2 answered · 67%');
    await click(document.querySelector<HTMLElement>('[data-survey="svv1"]') ?? undefined);
    expect(button('Summary')).toBeTruthy();
    await click(button('Responses'));
    const resp = Array.from(document.querySelectorAll('[data-response]')).map((x) => x.textContent ?? '');
    expect(resp).toHaveLength(2);
    expect(resp[1]).toContain('Ratna Dewi');
    expect(resp[1]).toContain('4/5');
    expect(resp[1]).toContain('Was the room ready on time? · No');
    await click(button('History'));
    expect(Array.from(document.querySelectorAll('[data-log]')).map((x) => x.getAttribute('data-log'))).toEqual(['sent', 'created']); // newest first
    expect(document.body.textContent).toContain('Created from “Venue rating” by Ega');
  });
  it('Templates: the four seed templates; Use opens the editor with the template filled in (a venue survey has no audience)', async () => {
    openClub();
    await show(<Surveys />);
    await click(button('Templates'));
    expect(Array.from(document.querySelectorAll('[data-template]')).map((x) => x.getAttribute('data-template')).sort()).toEqual(['st1', 'st2', 'st3', 'st4']);
    const useBtns = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => textOf(b) === 'Use');
    expect(useBtns).toHaveLength(4);
    await click(useBtns[3]); // venue template comes last
    const title = Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((i) => i.value === 'Venue rating');
    expect(title).toBeTruthy();
    expect(document.querySelector('[data-testid="survey-audience"]')).toBeNull();
    expect(button('Make it live')).toBeTruthy();
    expect(document.body.textContent).toContain('Was the room ready on time?');
  });
  it('phone: a survey and the editor open as pushed screens, with the actions pinned under the editor', async () => {
    const was = window.innerWidth;
    (window as { innerWidth: number }).innerWidth = 390;
    try {
      openClub();
      await show(<Surveys />);
      await click(button('Log'));
      await click(document.querySelector<HTMLElement>('[data-survey="sv1"]') ?? undefined);
      expect(document.querySelector('[role="dialog"].cp-native')).toBeTruthy();
      expect(document.body.textContent).toContain('3 of 4 answered');
      await click(button('Surveys')); // the back button
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      await openEditor('venue');
      expect(document.querySelector('[role="dialog"].cp-native')).toBeTruthy();
      expect(button('Make it live')).toBeTruthy();
      expect(button('Save as template')).toBeTruthy();
      expect(document.querySelector('[data-testid="survey-audience"]')).toBeNull();
    } finally { (window as { innerWidth: number }).innerWidth = was; }
  });
  it('Indonesian: tabs and the log are translated', async () => {
    openClub('citra', 'id');
    await show(<Surveys />);
    expect(button('Riwayat')).toBeTruthy();
    await click(button('Riwayat'));
    expect(document.body.textContent).toContain('Terkirim 3 · 2 menjawab · 67%');
    expect(document.body.textContent).not.toMatch(/\bmgmt\.[A-Za-z]/);
  });
});
