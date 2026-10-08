// The enquiries board in a club with many leads: search by the senior's or the contact's name, paged columns, the Join dialog (plan, first day
// and the signed paper registration form, which is required), and the trial dialog (a day pass: a day only). Rendered against the seed with extra leads,
// because the browser tests only reach the few leads the seed has.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Enquiries, leadMatches } from './Enquiries';

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

function openClub(as: 'mgmt' | 'lobby', extra = 0, lang: 'en' | 'id' = 'en') {
  const state: ClubState = buildSeed().citra;
  for (let i = 1; i <= extra; i++) {
    const id = `ex${i}`;
    state.enquiries[id] = { ...structuredClone(state.enquiries.e3), id, senior: { title: 'Oma', name: `Extra Lead ${i}` }, contact: { name: `Relative ${i}`, relation: 'daughter', phone: `+62812550000${String(i).padStart(2, '0')}` }, createdAt: `2026-10-20T10:${String(i).padStart(2, '0')}` };
  }
  const uid = as === 'mgmt' ? 's9' : 's1';
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: uid, name: as === 'mgmt' ? 'Ega' : 'Caca', role: as, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement, path = '/enquiries') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>); });
}
const q = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
const cards = (stage: string) => q(`[data-stage="${stage}"] [data-lead]`);
/** A button's visible text (icon glyph names such as "check" left out), or its aria-label. */
const textOf = (b: HTMLElement) => {
  const c = b.cloneNode(true) as HTMLElement;
  c.querySelectorAll('.ms').forEach((x) => x.remove());
  return (c.textContent ?? '').trim() || b.getAttribute('aria-label') || '';
};
const button = (label: string | RegExp, within: ParentNode = document) =>
  Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label || b.getAttribute('aria-label') === label : label.test(x); });
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
async function type(el: HTMLInputElement, v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const searchBox = () => document.querySelector<HTMLInputElement>('input[type="search"]')!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

describe('lead search', () => {
  it('matches the senior or the contact, any part, any case, ignoring accents', () => {
    const e = { senior: { title: 'Oma' as const, name: 'Siu Lan Tjandra' }, contact: { name: 'Melinda Tjandra', relation: 'daughter' as const, phone: '+6281277812290' } };
    for (const text of ['melinda', 'SIU', 'siu lan', 'lan tjandra', 'oma siu', 'tjandra', 'MELINDA tjandra']) expect(leadMatches(e, text), text).toBe(true);
    expect(leadMatches(e, 'zzz')).toBe(false);
    expect(leadMatches(e, 'siu kevin')).toBe(false); // every word has to match somewhere
    expect(leadMatches({ ...e, contact: { ...e.contact, name: 'Élodie Wijaya' } }, 'elodie')).toBe(true);
    expect(leadMatches(e, '   ')).toBe(true);
  });
  it('narrows every stage by the senior or the contact name and starts over when it is cleared', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    const counts = () => ['new', 'visit', 'trial', 'joined', 'lost'].map((k) => cards(k).length);
    expect(counts()).toEqual([1, 2, 1, 0, 1]);
    await type(searchBox(), 'melinda');
    expect(counts()).toEqual([0, 0, 1, 0, 0]);
    await type(searchBox(), 'HAMID');
    expect(counts()).toEqual([0, 1, 0, 0, 0]);
    await type(searchBox(), 'zzz');
    expect(counts()).toEqual([0, 0, 0, 0, 0]);
    expect(document.body.textContent).toContain('No match');
    await type(searchBox(), '');
    expect(counts()).toEqual([1, 2, 1, 0, 1]);
  });
  it('pages a long column (six a page) and the search goes back to page 1', async () => {
    openClub('mgmt', 13); // 14 leads in New
    await show(<Enquiries />);
    expect(cards('new')).toHaveLength(6);
    const nav = () => document.querySelector('[data-stage="new"] nav');
    expect(nav()).toBeTruthy();
    await click(button('Page 2'));
    expect(cards('new')).toHaveLength(6);
    await click(button('Page 3'));
    expect(cards('new')).toHaveLength(2);
    await type(searchBox(), 'extra lead');
    expect(cards('new')).toHaveLength(6); // back on page 1 with 13 matches
    await type(searchBox(), 'relative 12');
    expect(cards('new')).toHaveLength(1);
    expect(nav()).toBeNull();
  });
});

describe('joining needs the signed paper registration form', () => {
  it('there is no online form on a lead: no Send form, Review form or form link, only Join', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    for (const id of ['e1', 'e2', 'e3', 'e5']) {
      const card = document.querySelector<HTMLElement>(`[data-lead="${id}"]`)!;
      for (const gone of ['Send form link', 'Review form', 'View form', 'Form link', 'Fill as family (demo)']) expect(button(gone, card), `${gone} on ${id}`).toBeUndefined();
      expect(card.textContent).not.toMatch(/Form (sent|opened|in progress|ready)/);
    }
    expect(button('Join', document.querySelector<HTMLElement>('[data-lead="e1"]')!)).toBeTruthy(); // the trial lead
  });
  it('the Join button stays off until a form is attached (management creates the member)', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    await click(button('Join', document.querySelector<HTMLElement>('[data-lead="e1"]')!));
    const d = dialog()!;
    expect(d.textContent).toContain('Signed registration form');
    expect(d.querySelector('[data-testid="paper-form"]')).toBeTruthy();
    expect(button('Take photo', d)).toBeTruthy();
    expect(button('Choose file', d)).toBeTruthy();
    expect(d.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('application/pdf');
    expect(d.textContent).not.toContain('Your request goes to management');
    const create = button('Create member · Flex', d)!;
    expect(create).toBeTruthy();
    expect(create.getAttribute('aria-disabled')).toBe('true'); // no form attached yet
    await click(Array.from(d.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Gold/.test(r.textContent ?? '')));
    expect(button('Create member · Gold', d)).toBeTruthy();
    expect(button('Create member · Gold', d)!.getAttribute('aria-disabled')).toBe('true');
  });
  it('front desk: the same dialog, but it says the request goes to management', async () => {
    openClub('lobby');
    await show(<Enquiries />);
    await click(button('Join', document.querySelector<HTMLElement>('[data-lead="e1"]')!));
    expect(dialog()!.textContent).toContain('Your request goes to management.');
    expect(button('Send to management · Flex', dialog()!)).toBeTruthy();
    expect(button(/^Create member/, dialog()!)).toBeUndefined();
  });
  it('moving a lead to Joined opens the same dialog; Indonesian has no raw keys', async () => {
    openClub('mgmt', 0, 'id');
    await show(<Enquiries />);
    await click(button('Bergabung', document.querySelector<HTMLElement>('[data-lead="e1"]')!));
    const d = dialog()!;
    expect(d.textContent).toContain('Formulir pendaftaran bertanda tangan');
    expect(button('Ambil foto', d)).toBeTruthy();
    expect(button('Pilih berkas', d)).toBeTruthy();
    expect(button('Buat anggota · Flex', d)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b(?:enq|mgmt|form|profile)\.[A-Za-z]/);
  });
});

describe('a trial is 2 days in a row, no time, no lunch or health check switches', () => {
  it('book a trial: a day and the allergies only; no time, no lunch or health check switches', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    const e2 = document.querySelector<HTMLElement>('[data-lead="e2"]')!;
    await click(button('Book trial', e2));
    const d = dialog()!;
    expect(d.textContent).not.toMatch(/Another time|Trial lunch|Health check/);
    expect(d.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(button('Pick a day', d)).toBeTruthy();
    const day = Array.from(d.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Thu 22 Oct/.test(r.textContent ?? ''));
    await click(day);
    expect(button('Book trial · Thu 22 Oct and Fri 23 Oct · Rp 450.000', d)).toBeTruthy(); // enabled with a day alone: 2 days in a row, with the trial price
  });
  it('book a visit: it still needs a time', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    await click(button('Book visit', document.querySelector<HTMLElement>('[data-lead="e3"]')!));
    const d = dialog()!;
    expect(d.textContent).toContain('Another time');
    const day = Array.from(d.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Thu 22 Oct/.test(r.textContent ?? ''));
    await click(day);
    expect(button(/^Book visit/, d)).toBeUndefined(); // no time yet
    expect(button('Pick a day and time', d)).toBeTruthy();
  });
});
