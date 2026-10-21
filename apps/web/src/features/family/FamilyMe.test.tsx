// Round 8: the Me tab, Billing and Contacts render against the seed (a smoke test with the numbers that matter: what is due, who pays, the asks).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, projectForFamily } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyMe } from './FamilyMe';
import { FamilyBilling } from './FamilyBilling';
import { FamilyContacts } from './FamilyContacts';
import { PlanAsk } from './PlanCard';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
// the family pages switch to their desktop layout from 1024px (jsdom's default width): the phone / tablet tests run at 800
beforeEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 800; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
function open(familyId: string, lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const full = buildSeed().citra;
  const view = projectForFamily(full, familyId);
  const acts: { name: string; input: unknown }[] = [];
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async (name: string, input: unknown) => { acts.push({ name, input }); return { ok: true as const, result: {} }; }) as never });
  return { view, acts };
}
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
const text = () => document.body.textContent || '';
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;

describe('family Me', () => {
  it('the account card, the parents with where they are, billing, contacts, a health-alerts switch per parent, and the account list', async () => {
    const { acts } = open('f1');
    await show(<FamilyMe />, '/me');
    expect(q('[data-testid="me-account"]')?.textContent).toContain('Maria Wijaya');
    expect(q('[data-testid="me-account"]')?.textContent).toContain('pays the bills');
    expect(q('[data-testid="me-parents"]')?.textContent).toContain('Oma Lina');
    expect(q('[data-testid="me-parents"]')?.textContent).toContain('Opa Budi');
    expect(q('[data-testid="me-billing"]')?.textContent).toMatch(/Rp [\d.]+ due/);
    expect(document.querySelectorAll('[role="switch"]')).toHaveLength(2);
    expect(text()).toContain('Health alerts · Oma Lina');
    for (const id of ['me-language', 'me-details', 'me-password', 'me-signout']) expect(q(`[data-testid="${id}"]`)).toBeTruthy();
    await act(async () => { (document.querySelector('[role="switch"]') as HTMLButtonElement).click(); });
    expect(acts.at(-1)).toMatchObject({ name: 'family.setHealthAlerts', input: { memberId: 'm1', on: false } });
    await act(async () => { q('[data-testid="me-language"]')!.click(); });
    expect(acts.at(-1)).toMatchObject({ name: 'account.updateFamily', input: { familyId: 'f1', lang: 'id' } });
  });

  it('the details sheet sends the new name for approval', async () => {
    open('f1');
    await show(<FamilyMe />, '/me');
    await act(async () => { q('[data-testid="me-details"]')!.click(); });
    expect(q('[data-testid="details-sheet"]')).toBeTruthy();
    expect(text()).toContain('Your mobile number');
  });

  it('someone who does not pay sees who pays', async () => {
    open('f2');
    await show(<FamilyMe />, '/me');
    expect(q('[data-testid="me-billing"]')?.textContent).toContain('Maria pays');
    expect(q('[data-testid="me-account"]')?.textContent).not.toContain('pays the bills');
  });
});

describe('family Billing', () => {
  it('the payer sees what is to pay with the bank, the virtual account and both parents’ plans with their asks', async () => {
    open('f1');
    await show(<FamilyBilling />, '/billing');
    expect(q('[data-testid="billing-total"]')?.getAttribute('data-state')).toBe('due');
    expect(q('[data-testid="open-total"]')?.textContent).toMatch(/^Rp [\d.]+$/);
    expect(q('[data-testid="billing-due-line"]')?.textContent).toMatch(/^To pay · due /);
    expect(document.querySelectorAll('[role="radio"][data-bank]')).toHaveLength(5);
    expect(q('[data-testid="va-number"]')?.textContent).toMatch(/^3901 /);
    expect(q('[data-testid="simulate-pay"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="plan-card"]')).toHaveLength(2);
    expect(q('[data-testid="plan-card"][data-member="m1"]')?.textContent).toContain('visits used in October');
    expect(q('[data-testid="plan-card"][data-member="m46"]')?.textContent).toContain('Any open day');
    expect(document.querySelectorAll('[data-testid="plan-ask-link"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-testid="leave-ask"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-testid="invoice-row"][data-status="outstanding"]').length).toBe(2);
    expect(document.querySelectorAll('[data-testid="invoice-row"]').length).toBeLessThanOrEqual(6);
  });

  it('pay (demo) sends every open invoice together', async () => {
    const { acts } = open('f1');
    await show(<FamilyBilling />, '/billing');
    await act(async () => { (q('[data-testid="simulate-pay"]') as HTMLButtonElement).click(); });
    expect(acts.at(-1)?.name).toBe('payment.simulateVa');
    expect((acts.at(-1)?.input as { invoiceIds: string[] }).invoiceIds).toHaveLength(2);
  });

  it('a family member who does not pay: no pay controls, no asks, who looks after billing', async () => {
    open('f2');
    await show(<FamilyBilling />, '/billing');
    expect(q('[data-testid="billing-pay"]')).toBeNull();
    expect(q('[data-testid="plan-ask-link"]')).toBeNull();
    expect(q('[data-testid="payer-note"]')?.textContent).toContain('Maria Wijaya looks after billing');
    expect(document.querySelectorAll('[data-testid="invoice-row"]').length).toBeGreaterThan(0);
  });

  it('an overdue invoice shows as overdue, in Indonesian without raw keys', async () => {
    open('fm20_0', 'id');
    await show(<FamilyBilling />, '/billing');
    expect(q('[data-testid="billing-total"]')?.getAttribute('data-state')).toBe('overdue');
    expect(q('[data-testid="billing-due-line"]')?.textContent).toContain('Terlambat');
    expect(text()).not.toMatch(/\b(fme|family|fam)\.[a-z]/i);
  });

  it('asking the club to change the plan: the sheet sends planChange.request', async () => {
    const { acts } = open('f1');
    await show(<PlanAsk m={useReplica.getState().view!.members.m1} />, '/profile');
    await act(async () => { q('[data-testid="plan-ask-link"]')!.click(); });
    expect(q('[data-testid="plan-sheet"]')).toBeTruthy();
    const send = Array.from(document.querySelectorAll('[data-testid="plan-sheet"] button')).find((b) => b.textContent === 'Send') as HTMLButtonElement;
    await act(async () => { send.click(); });
    expect(acts.at(-1)).toMatchObject({ name: 'planChange.request', input: { memberId: 'm1', to: 'gold' } });
  });
});

describe('family Contacts', () => {
  it('the front desk with WhatsApp and call, then the public doctors and services with a call button each', async () => {
    open('f1');
    await show(<FamilyContacts />, '/contacts');
    expect(q('[data-testid="front-desk"]')?.textContent).toContain('CitraPremier front desk');
    expect(q('[data-testid="front-desk"]')?.textContent).toMatch(/Mon–Fri 08:30–16:30/);
    expect((q('[data-testid="wa-club"]') as HTMLAnchorElement).href).toMatch(/^https:\/\/wa\.me\/\d+$/);
    expect(q('[data-testid="call-club"]')?.getAttribute('href')).toMatch(/^tel:\+?\d+$/);
    expect(Array.from(document.querySelectorAll('[data-testid="contact-group"]')).map((g) => g.getAttribute('data-kind'))).toEqual(['doctor', 'service']);
    expect(text()).toContain('dr. Andreas Wirawan');
    expect(text()).not.toContain('Sayur Segar'); // internal suppliers stay with the club
  });
});

describe('family Me, Billing and Contacts on a laptop (two columns)', () => {
  const was = window.innerWidth;
  afterEach(() => { (window as unknown as { innerWidth: number }).innerWidth = was; });
  const laptop = () => { (window as unknown as { innerWidth: number }).innerWidth = 1440; };

  it('Me on a laptop: titled "Me" like the sidebar, one column of at most 640px; the health alerts sit with Billing and Contacts', async () => {
    open('f1');
    laptop();
    await show(<FamilyMe />, '/me');
    expect(document.querySelector('h1')?.textContent).toBe('Me');
    expect(q('[data-testid="me-links"]')?.querySelectorAll('[role="switch"]')).toHaveLength(2);
    expect(q('[data-testid="me-links"]')?.textContent).toContain('Billing');
    expect((q('[data-testid="me-account"]')?.parentElement as HTMLElement).style.maxWidth).toBe('640px');
  });

  it('Billing: the 420px card on the left, the plans and invoices on the right (8 rows a page); the "‹ Me" link is there too', async () => {
    open('f1');
    laptop();
    await show(<FamilyBilling />, '/billing');
    expect(q('[data-testid="billing-total"]')).toBeTruthy();
    expect(q('[data-testid="fam-back"]')?.textContent).toContain('Me'); // Billing is pushed from Me, so it has its way back on every width
    expect(q('[data-testid="billing-total"]')?.parentElement?.contains(q('[data-testid="billing-plans"]'))).toBe(false); // two columns: the card alone on the left
    expect(document.querySelectorAll('[data-testid="plan-card"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-testid="invoice-row"]').length).toBeGreaterThan(6);
    expect(document.querySelectorAll('[data-testid="invoice-row"]').length).toBeLessThanOrEqual(8);
  });

  it('Contacts: the front desk across the top, the emergency line and the directory groups in two columns; the "‹ Me" link is there too', async () => {
    open('f1');
    laptop();
    await show(<FamilyContacts />, '/contacts');
    expect(q('[data-testid="front-desk"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="contact-group"]')).toHaveLength(2);
    expect(q('[data-testid="fam-back"]')?.textContent).toContain('Me');
    expect(q('[data-testid="contacts-emergency"]')).toBeTruthy();
  });
});
