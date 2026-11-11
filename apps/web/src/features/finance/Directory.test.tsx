// Round 15 (phase 2), Task 6: the Contacts directory grouped by category, each contact with a 44 px call link; an editable category list.
// The action is mocked; the screen runs against the seed.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Directory } from './Directory';

const h = vi.hoisted(() => ({ act: vi.fn() }));
vi.mock('../../lib/act', () => ({ useAct: () => h.act }));

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => { h.act.mockReset(); h.act.mockResolvedValue({ ok: true, result: {} }); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});

async function show(edit?: (s: ClubState) => void, who: { id: string; role: 'finance' | 'lobby' | 'nurse' } = { id: 's10', role: 'finance' }, lang: 'en' | 'id' = 'en') {
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: who.id, name: 'Staff', role: who.role, clubId: 'citra', clubs: ['citra'] } });
  const state = buildSeed().citra;
  edit?.(state);
  useReplica.setState({ club: 'citra', userId: who.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Directory /></MemoryRouter>); });
}
const textOf = (b: Element) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (label: string | RegExp) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => (typeof label === 'string' ? textOf(b) === label : label.test(textOf(b))));
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const typeInto = async (el: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const headings = () => Array.from(document.querySelectorAll('h2[data-dir-group]')).map((h2) => h2.textContent);
/** The names listed under one heading (to the next heading). */
const under = (title: string) => {
  const all = Array.from(document.querySelectorAll<HTMLElement>('h2[data-dir-group], [data-dir-row]'));
  const at = all.findIndex((e) => e.tagName === 'H2' && e.textContent === title);
  const out: string[] = [];
  for (const e of all.slice(at + 1)) { if (e.tagName === 'H2') break; out.push(e.getAttribute('data-dir-row')!); }
  return out;
};
const pickOption = async (trigger: Element | null, label: string) => {
  await click(trigger);
  await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.getAttribute('aria-label') === label));
};
const groupSelect = () => document.querySelector<HTMLElement>('[role="combobox"][aria-label="Category"]');

describe('Directory: grouped by category', () => {
  it('lists "AC and electrical" with both AC vendors, each with a tel: call link of at least 44 px', async () => {
    await show();
    expect(headings()[0]).toBe('AC and electrical');
    expect(under('AC and electrical')).toEqual(['Dingin Jaya AC Service', 'Kemang Teknik AC']);
    for (const n of ['Dingin Jaya AC Service', 'Kemang Teknik AC']) {
      const a = document.querySelector<HTMLAnchorElement>(`a[aria-label="Call ${n}"]`)!;
      expect(a.getAttribute('href')).toMatch(/^tel:\+62\d+$/);
      expect(parseInt(a.style.height, 10)).toBeGreaterThanOrEqual(44);
    }
    expect(headings()).toEqual(['AC and electrical', 'Medical', 'Groceries', 'Cleaning', 'Activity materials', 'Field trip venues']); // only the groups that have contacts (round 21: the seeded trip venues)
    expect(under('Medical')).toContain('dr. Melinda Kusumo');
  });

  it('the Category dropdown narrows to one group; All categories brings the rest back', async () => {
    await show();
    await pickOption(groupSelect(), 'AC and electrical');
    expect(headings()).toEqual(['AC and electrical']);
    expect(document.querySelectorAll('[data-dir-row]')).toHaveLength(2);
    await pickOption(groupSelect(), 'All categories');
    expect(headings().length).toBe(6);
  });

  it('search narrows within the groups', async () => {
    await show();
    await typeInto(document.querySelector<HTMLInputElement>('input[type="search"], input[aria-label="Search contacts"]')!, 'kemang teknik');
    expect(headings()).toEqual(['AC and electrical']);
    expect(under('AC and electrical')).toEqual(['Kemang Teknik AC']);
  });

  it('a contact in a retired category shows under Other, and the category leaves the dropdown', async () => {
    await show((s) => { s.club.settings = structuredClone(s.club.settings); s.club.settings.directoryGroups!.find((g) => g.name === 'AC and electrical')!.active = false; });
    expect(headings()).not.toContain('AC and electrical');
    expect(headings().at(-1)).toBe('Other');
    expect(under('Other')).toEqual(['Dingin Jaya AC Service', 'Kemang Teknik AC']);
    await click(groupSelect());
    const opts = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((o) => o.getAttribute('aria-label'));
    expect(opts).toContain('Other');
    expect(opts).not.toContain('AC and electrical');
  });

  it('a contact with no category shows under Other (one Other heading, even with a club category of that name)', async () => {
    await show((s) => { delete s.directory.d7.groupId; });
    expect(under('Other')).toEqual(['Ikan Laut Jaya']);
    expect(headings().filter((x) => x === 'Other')).toHaveLength(1);
  });

  it('shows the Indonesian wording of a category in Indonesian', async () => {
    await show(undefined, undefined, 'id');
    expect(headings()[0]).toBe('AC dan listrik');
    expect(document.querySelector('a[aria-label="Telepon Kemang Teknik AC"]')).toBeTruthy();
  });

  it('staff who do not keep the directory see the public contacts grouped, with call links, and no editing', async () => {
    await show(undefined, { id: 's8', role: 'nurse' });
    expect(headings()).toEqual(['Medical']);
    expect(document.querySelectorAll('a[href^="tel:"]').length).toBe(4);
    expect(button('Categories')).toBeUndefined();
    expect(groupSelect()).toBeNull(); // one group only: nothing to choose
  });
});

describe('Directory: categories sheet', () => {
  const open = async (who?: { id: string; role: 'finance' | 'lobby' }) => { await show(undefined, who); await click(button('Categories')); return document.querySelector('[role="dialog"]')!; };

  it('lists the categories; Add category sends directory.setGroup with the names', async () => {
    const dlg = await open({ id: 's1', role: 'lobby' });
    expect(textOf(dlg)).toContain('Plumbing');
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Add category'));
    await typeInto(dlg.querySelector<HTMLInputElement>('input[aria-label="Name"], input')!, 'Pest control');
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act).toHaveBeenCalledTimes(1);
    expect(h.act.mock.calls[0][0]).toBe('directory.setGroup');
    expect(h.act.mock.calls[0][1]).toMatchObject({ name: 'Pest control', active: true });
    expect(h.act.mock.calls[0][1].id).toBeUndefined();
  });

  it('Edit renames a category keeping its id; the Active switch retires it', async () => {
    const dlg = await open();
    await click(dlg.querySelector('[aria-label="Edit category Plumbing"]'));
    await typeInto(dlg.querySelector<HTMLInputElement>('input')!, 'Plumbing and water');
    await click(dlg.querySelector('[role="switch"]'));
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act.mock.calls[0][0]).toBe('directory.setGroup');
    expect(h.act.mock.calls[0][1]).toMatchObject({ id: 'dgrp_2', name: 'Plumbing and water', nameId: 'Perpipaan', active: false });
  });
});

describe('Directory: the contact form picks a category', () => {
  it('Edit sends groupId when the category changes, and nothing about it when it does not', async () => {
    await show();
    await click(document.querySelector('[aria-label="Edit Kemang Teknik AC"]'));
    let dlg = document.querySelector('[role="dialog"]')!;
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect('groupId' in h.act.mock.calls[0][1]).toBe(false);
    h.act.mockClear();
    await click(document.querySelector('[aria-label="Edit Kemang Teknik AC"]'));
    dlg = document.querySelector('[role="dialog"]')!;
    const combo = Array.from(dlg.querySelectorAll('[role="combobox"]')).find((c) => document.getElementById(c.getAttribute('aria-labelledby') ?? '')?.textContent === 'Category')!;
    expect(textOf(combo)).toContain('AC and electrical');
    await pickOption(combo, 'Plumbing');
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Save'));
    expect(h.act.mock.calls[0][1]).toMatchObject({ id: 'd15', groupId: 'dgrp_2' });
  });

  it('a supplier keeps its spending category in its own select', async () => {
    await show();
    await click(document.querySelector('[aria-label="Edit Kemang Teknik AC"]'));
    const dlg = document.querySelector('[role="dialog"]')!;
    const labels = Array.from(dlg.querySelectorAll('[role="combobox"]')).map((c) => document.getElementById(c.getAttribute('aria-labelledby') ?? '')?.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Category', 'Spending category']));
  });
});

describe('round 21: field trip venues', () => {
  const addVenue = (s: ClubState) => {
    s.directory.dv1 = { id: 'dv1', clubId: s.clubId, createdAt: '2026-10-01T10:00', createdBy: 'staff:s9', kind: 'venue', name: 'Rumah Batik Palbatu', what: '', phone: '+6281277881122', public: false, contactPerson: 'Ibu Sari', address: 'Jl. Palbatu 4, Tebet', photoMediaIds: ['md_venueone0001', 'md_venuetwo0002'] };
    const trip = Object.values(s.calendarEvents).find((e) => e.kind === 'outing')!;
    trip.venueId = 'dv1';
    return trip;
  };
  it('venues list under their own heading, just before Other', async () => {
    await show(addVenue);
    const hs = headings();
    expect(hs).toContain('Field trip venues');
    const o = hs.indexOf('Other');
    expect(hs.indexOf('Field trip venues')).toBe(o < 0 ? hs.length - 1 : o - 1);
    expect(document.querySelector('[data-dir-row="Rumah Batik Palbatu"]')!.textContent).toContain('Ibu Sari');
  });
  it('a venue opens on a sheet with its pictures and the trips held there', async () => {
    let title = '';
    await show((s) => { title = addVenue(s).title; });
    await click(document.querySelector('[data-dir-open="Rumah Batik Palbatu"]'));
    const sheet = document.querySelector('[role="dialog"]')!;
    expect(sheet.querySelectorAll('[data-testid="venue-pic"]')).toHaveLength(2);
    expect(sheet.textContent).toContain('Trips here');
    expect(sheet.textContent).toContain(title);
    expect(sheet.textContent).toContain('Ibu Sari');
  });
  it('the form for a venue asks for the contact person and the address, not what they do or a category', async () => {
    await show();
    await click(button('Add a contact'));
    const dlg = document.querySelector('[role="dialog"]')!;
    await click(Array.from(dlg.querySelectorAll('button')).find((b) => textOf(b) === 'Field trip venue'));
    const labels = Array.from(dlg.querySelectorAll('label > span:first-child')).map((x) => x.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Trading name', 'Contact person', 'Address']));
    expect(labels).not.toContain('What they do');
    expect(Array.from(dlg.querySelectorAll('[role="combobox"]'))).toHaveLength(0);
    expect(dlg.textContent).toContain('Pictures (staff only)');
  });
});

describe('round 21: ratings', () => {
  const rate = (st: ClubState, id: string, stars: number[]) => { st.directory[id].ratings = stars.map((x, i) => ({ id: `${id}r${i}`, stars: x as 1 | 2 | 3 | 4 | 5, at: '2026-10-0' + (i + 1) + 'T10:00', by: 'staff:s9' as const, ...(i === 0 ? { note: 'Fixed it fast' } : {}) })); };
  it('11 Nov (KC): a rated row shows its one rating; the best rated comes first under its heading', async () => {
    await show((st) => { rate(st, 'd14', [4, 5]); rate(st, 'd15', [3, 2]); });
    const names = Array.from(document.querySelectorAll('[data-dir-row]')).map((r) => r.getAttribute('data-dir-row'));
    const a = names.indexOf(document.querySelector('[data-dir-row] [data-rating="5"]')!.closest('[data-dir-row]')!.getAttribute('data-dir-row'));
    const b = names.indexOf(document.querySelector('[data-dir-row] [data-rating="2"]')!.closest('[data-dir-row]')!.getAttribute('data-dir-row'));
    expect(a).toBeLessThan(b);
    expect(document.querySelector('[data-rating="5"]')!.textContent).toBe('5');
  });
  it('the sheet shows the rating now and its changes (old → new, why, who); Change saves other stars with an optional why; the same stars say so', async () => {
    await show((st) => rate(st, 'd15', [3, 2]));
    await click(document.querySelector('[data-dir-open="Kemang Teknik AC"]'));
    const sheet = document.querySelector('[role="dialog"]')!;
    expect(sheet.querySelector('[data-rating-now]')?.getAttribute('data-rating-now')).toBe('2');
    expect(Array.from(sheet.querySelectorAll('[data-change]')).map((x) => x.getAttribute('data-change'))).toEqual(['3>2', '>3']);
    expect(sheet.querySelector('[data-rating-row="d15r0"]')!.textContent).toContain('Fixed it fast');
    expect(sheet.querySelectorAll('[aria-label="Remove rating"]')).toHaveLength(0);
    await click(Array.from(sheet.querySelectorAll('button')).find((b) => textOf(b) === 'Change'));
    await click(Array.from(sheet.querySelectorAll('button')).find((b) => textOf(b) === 'Save rating'));
    expect(sheet.textContent).toContain('That is the rating already. Pick other stars.');
    expect(h.act).not.toHaveBeenCalledWith('directory.rate', expect.anything(), expect.anything());
    await click(sheet.querySelector('button[aria-label="4 stars"]'));
    await typeInto(sheet.querySelector<HTMLInputElement>('input[name="ratingNote"]')!, 'On time');
    await click(Array.from(sheet.querySelectorAll('button')).find((b) => textOf(b) === 'Save rating'));
    expect(h.act).toHaveBeenCalledWith('directory.rate', { contactId: 'd15', stars: 4, note: 'On time' }, expect.anything());
  });
});
