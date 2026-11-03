// Round 17 (KC): the family's terms gate (first sign-in and "terms updated"), the shell showing it instead of the app, and the Me row.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, projectForFamily, type ClubState, type FamilyLink } from '@cp/shared';
import { memberPhoto } from '../../lib/media';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyShell } from '../../shell/FamilyShell';
import { FamilyMe } from './FamilyMe';
import { TermsGate } from './TermsGate';

let root: Root | null = null;
let host: HTMLElement | null = null;
const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const saved = { scrollHeight: Object.getOwnPropertyDescriptor(proto, 'scrollHeight'), clientHeight: Object.getOwnPropertyDescriptor(proto, 'clientHeight') };
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
});
beforeEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 800; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  for (const k of ['scrollHeight', 'clientHeight'] as const) { if (saved[k]) Object.defineProperty(proto, k, saved[k]!); else delete proto[k]; }
});

const T = '2026-10-21';
const T1 = { version: 1, en: '# Plans and visits\nYour parent comes on the days of the plan.\n- Notice {noticeDays} days\n- Invoice on the {issueDay}', id: '', publishedAt: '2026-10-01T09:00', publishedBy: 's9' };
const T2 = { version: 2, en: '# Plans and visits (new)\nChanged.', id: '', publishedAt: '2026-10-20T09:00', publishedBy: 's9' };

/** Terms v1 published, every login agreed on 2 October except Sinta Halim (daughter of Opa Hendra), who has a login and no agreement. */
function club(...terms: (typeof T1)[]): ClubState {
  return produce(buildSeed().citra, (d) => {
    d.club.settings.terms = terms;
    for (const c of Object.values(d.familyContacts)) if (c.username) c.termsAgreed = { version: 1, at: '2026-10-02T10:00' };
    d.familyContacts.f_sinta = { id: 'f_sinta', clubId: d.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', username: 'sinta', name: 'Sinta Halim', firstName: 'Sinta', phone: '+6281200000099', lang: 'en', activatedAt: '2026-10-01T09:00' };
    d.familyLinks['f_sinta:m2'] = { id: 'f_sinta:m2', clubId: d.clubId, createdAt: '2026-10-01T09:00', createdBy: 'system', familyId: 'f_sinta', memberId: 'm2', relation: 'daughter', primary: false, appAccess: true, healthAlerts: true } satisfies FamilyLink;
  });
}
function open(familyId: string, full: ClubState, lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const view = projectForFamily(full, familyId);
  const acts: { name: string; input: unknown }[] = [];
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'x', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async (name: string, input: unknown) => { acts.push({ name, input }); return { ok: true as const, result: {} }; }) as never });
  return { view, acts };
}
async function show(ui: ReactElement, url = '/') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
/** jsdom has no layout: give every element a scroll height and a visible height. */
function layout(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => clientHeight });
}
const text = () => document.body.textContent || '';
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const agree = () => q('[data-testid="terms-agree"]') as HTMLButtonElement;
async function scrollTo(top: number) {
  const box = q('[data-testid="terms-scroll"]')!;
  Object.defineProperty(box, 'scrollTop', { configurable: true, value: top });
  await act(async () => { box.dispatchEvent(new Event('scroll', { bubbles: true })); });
}

describe('terms gate, first sign-in', () => {
  it('welcomes Sinta with the parent photo; Agree waits for the end of the text, then sends terms.agree for version 1', async () => {
    layout(1000, 300);
    const { acts, view } = open('f_sinta', club(T1));
    await show(<TermsGate kind="first" />);
    expect(q('[data-testid="terms-welcome"]')?.textContent).toContain('Welcome, Sinta');
    expect(q('[data-testid="terms-welcome"]')?.textContent).toContain("You're family for Opa Hendra");
    const photo = memberPhoto(view.members.m2)!;
    expect(photo).toBeTruthy();
    expect(q('[data-testid="terms-welcome"]')!.innerHTML).toContain(photo);
    // the text, with the placeholders filled
    expect(q('[data-testid="terms-scroll"]')?.textContent).toContain('Plans and visits');
    expect(q('[data-testid="terms-scroll"]')?.textContent).toContain('Notice 14 days');
    expect(agree().disabled).toBe(true);
    expect(text()).toContain('Scroll to the end to continue');
    await scrollTo(100);
    expect(agree().disabled).toBe(true);
    await scrollTo(692); // 692 + 300 >= 1000 - 8
    expect(agree().disabled).toBe(false);
    expect(text()).not.toContain('Scroll to the end to continue');
    await act(async () => { agree().click(); });
    expect(acts.at(-1)).toEqual({ name: 'terms.agree', input: { version: 1 } });
  });

  it('text that fits without scrolling enables Agree at once (nothing to scroll)', async () => {
    layout(240, 300);
    open('f_sinta', club(T1));
    await show(<TermsGate kind="first" />);
    expect(agree().disabled).toBe(false);
    expect(text()).not.toContain('Scroll to the end to continue');
  });

  it('a failed agree says why under the button, and Agree can be tapped again', async () => {
    layout(240, 300);
    open('f_sinta', club(T1));
    useReplica.setState({ act: (async () => ({ ok: false as const, code: 'err.invalid', params: {} })) as never });
    await show(<TermsGate kind="first" />);
    await act(async () => { agree().click(); });
    const hint = q('[data-testid="terms-hint"]')!;
    expect(hint.getAttribute('role')).toBe('alert');
    expect(hint.textContent).not.toBe('');
    expect(hint.textContent).not.toBe('err.invalid'); // a translated message, not the code
    expect(agree().disabled).toBe(false);
  });

  it('EN / ID switches the language before agreeing and saves it on the contact', async () => {
    layout(240, 300);
    const { acts } = open('f_sinta', club(T1));
    await show(<TermsGate kind="first" />);
    const id = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === 'ID')!;
    await act(async () => { id.click(); });
    expect(useSession.getState().lang).toBe('id');
    expect(acts.at(-1)).toEqual({ name: 'account.updateFamily', input: { familyId: 'f_sinta', lang: 'id' } });
  });

  it('the Sign out link signs out and goes to the sign-in page', async () => {
    layout(1000, 300);
    open('f_sinta', club(T1));
    const signOut = vi.fn();
    useSession.setState({ signOut } as never);
    await show(<TermsGate kind="first" />);
    await act(async () => { q('[data-testid="terms-signout"]')!.click(); });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('terms gate, terms updated', () => {
  it('Maria after version 2 sees "Terms updated" and no welcome, and agrees to version 2', async () => {
    layout(1000, 300);
    const { acts } = open('f1', club(T1, T2));
    await show(<TermsGate kind="updated" />);
    expect(text()).toContain('Terms updated');
    expect(text()).not.toContain('Welcome');
    expect(q('[data-testid="terms-welcome"]')).toBeNull();
    expect(q('[data-testid="terms-scroll"]')?.textContent).toContain('Plans and visits (new)');
    await scrollTo(700);
    await act(async () => { agree().click(); });
    expect(acts.at(-1)).toEqual({ name: 'terms.agree', input: { version: 2 } });
  });

  it('shows the Indonesian text when the app is in Indonesian and the club wrote one', async () => {
    layout(240, 300);
    open('f1', club(T1, { ...T2, id: '# Syarat baru\nBerubah.' }), 'id');
    await show(<TermsGate kind="updated" />);
    expect(q('[data-testid="terms-scroll"]')?.textContent).toContain('Syarat baru');
    expect(text()).toContain('Syarat diperbarui');
  });
});

describe('the family shell', () => {
  it('shows the gate instead of the app until the contact has agreed', async () => {
    layout(1000, 300);
    open('f_sinta', club(T1));
    await show(<FamilyShell />);
    expect(q('[data-testid="terms-gate"]')).toBeTruthy();
    expect(q('[data-testid="fam-sidebar"]')).toBeNull();
  });
  it('shows the gate as "updated" for a contact who agreed to an older version', async () => {
    layout(1000, 300);
    open('f1', club(T1, T2));
    await show(<FamilyShell />);
    expect(q('[data-testid="terms-gate"]')?.getAttribute('data-kind')).toBe('updated');
  });
  it('shows the app when the contact agreed to the current version, or no terms are published', async () => {
    open('f1', club(T1));
    await show(<FamilyShell />);
    expect(q('[data-testid="terms-gate"]')).toBeNull();
    expect(q('[data-testid="fam-sidebar"]')).toBeTruthy(); // the tablet's sidebar stands for the app
    await act(async () => { root?.unmount(); });
    host?.remove();
    open('f_sinta', produce(club(T1), (d) => { delete d.club.settings.terms; }));
    await show(<FamilyShell />);
    expect(q('[data-testid="terms-gate"]')).toBeNull();
  });
});

describe('family Me, Terms and conditions', () => {
  it('a row opens the terms ending with when and what version Maria agreed to', async () => {
    layout(1000, 300);
    open('f1', club(T1));
    await show(<FamilyMe />, '/me');
    const row = q('[data-testid="me-terms"]')!;
    expect(row.textContent).toContain('Terms and conditions');
    await act(async () => { row.click(); });
    const sheet = q('[data-testid="terms-sheet"]')!;
    expect(sheet.textContent).toContain('Notice 14 days');
    expect(sheet.textContent).toMatch(/You agreed on 2 Oct · version 1$/);
  });
  it('?terms=1 (the notification link) opens the sheet', async () => {
    open('f1', club(T1));
    await show(<FamilyMe />, '/me?terms=1');
    expect(q('[data-testid="terms-sheet"]')).toBeTruthy();
  });
  it('no row while the club has published no terms', async () => {
    open('f1', produce(club(T1), (d) => { delete d.club.settings.terms; }));
    await show(<FamilyMe />, '/me');
    expect(q('[data-testid="me-terms"]')).toBeNull();
  });
});
