// The enquiries board in a club with many leads: search by the senior's or the contact's name, paged columns, the review dialog where
// Approve goes straight on to Join (plan and first day), and the trial dialog (a day pass: a day only). Rendered against the seed with extra leads,
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

describe('approve means join', () => {
  it('Review form: Approve and join goes on to the plan and first day in the same dialog (management creates the member)', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    const e1 = document.querySelector<HTMLElement>('[data-lead="e1"]')!;
    expect(button('Join', e1)).toBeUndefined(); // no separate Join next to a form that waits for review
    expect(button('Review form', e1)).toBeTruthy();
    await click(button('Review form', e1));
    const d = dialog()!;
    expect(d.textContent).toContain('Step 1 of 2');
    expect(button('Approve form', d)).toBeUndefined();
    await click(button('Approve and join', d));
    expect(dialog()!.textContent).toContain('Step 2 of 2 · Plan and first day');
    expect(dialog()!.textContent).toContain('This creates the member record and Melinda’s family login.');
    expect(dialog()!.textContent).not.toContain('Your request goes to management');
    expect(button('Approve and create member · Flex', dialog()!)).toBeTruthy();
    await click(Array.from(dialog()!.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Gold/.test(r.textContent ?? '')));
    expect(button('Approve and create member · Gold', dialog()!)).toBeTruthy();
    await click(button('Back to the form', dialog()!));
    expect(dialog()!.textContent).toContain('Step 1 of 2');
  });
  it('front desk: the same flow, but it says the request goes to management', async () => {
    openClub('lobby');
    await show(<Enquiries />);
    await click(button('Review form', document.querySelector<HTMLElement>('[data-lead="e1"]')!));
    await click(button('Approve and join', dialog()!));
    expect(dialog()!.textContent).toContain('Your request goes to management.');
    expect(button('Approve and send to management · Flex', dialog()!)).toBeTruthy();
    expect(button(/^Approve and create member/, dialog()!)).toBeUndefined();
  });
  it('a deep link (?review=e1) opens the form for review; Indonesian has no raw keys', async () => {
    openClub('mgmt', 0, 'id');
    await show(<Enquiries />, '/enquiries?review=e1');
    const d = dialog()!;
    expect(d.textContent).toContain('Langkah 1 dari 2');
    await click(button('Setujui dan gabungkan', d));
    expect(dialog()!.textContent).toContain('Langkah 2 dari 2 · Paket dan hari pertama');
    expect(button('Setujui dan buat anggota · Flex', dialog()!)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b(?:enq|mgmt|form)\.[A-Za-z]/);
  });
});

describe('a trial is a day pass', () => {
  it('book a trial: a day and the allergies only; no time, no lunch or health check switches', async () => {
    openClub('mgmt');
    await show(<Enquiries />);
    const e2 = document.querySelector<HTMLElement>('[data-lead="e2"]')!;
    await click(button('Book trial', e2));
    const d = dialog()!;
    expect(d.textContent).toContain('Lunch and a health check are included.');
    expect(d.textContent).not.toMatch(/Another time|Trial lunch|Health check/);
    expect(d.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(button('Pick a day', d)).toBeTruthy();
    const day = Array.from(d.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => /^Thu 22 Oct/.test(r.textContent ?? ''));
    await click(day);
    expect(button('Book trial · Thu 22 Oct', d)).toBeTruthy(); // enabled with a day alone
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
