// Round 16: View screens. The front desk's default on Billing is View, Management's on Receipts is View: the screens read, the action buttons are gone.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { ScreenAccessProvider } from '../../lib/access';
import { Billing } from './Billing';
import { Receipts } from './Receipts';
import { InvoiceSheet } from './InvoiceSheet';

let root: Root | null = null;
let host: HTMLElement | null = null;
const T = '2026-10-21';
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
});
const WHO = {
  s1: { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] },
  s9: { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] },
};
function openAs(who: 's1' | 's9', edit?: (s: ClubState) => void) {
  const state: ClubState = buildSeed().citra;
  edit?.(state);
  useSession.setState({ lang: 'en', club: 'citra', user: WHO[who] });
  useReplica.setState({ club: 'citra', userId: who, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 600, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const buttons = () => Array.from(document.querySelectorAll<HTMLElement>('button'));
const hasButton = (re: RegExp) => buttons().some((b) => re.test(textOf(b)) || re.test(b.getAttribute('aria-label') ?? ''));

describe('Billing for the front desk (View)', () => {
  it('lists the invoices with the View only banner and no action buttons', async () => {
    openAs('s1');
    await show(<ScreenAccessProvider screenKey="billing"><Billing /></ScreenAccessProvider>);
    expect(document.querySelector('[data-testid="view-only"]')?.textContent).toContain('View only');
    expect(document.querySelectorAll('button[aria-label*=", INV-"]').length).toBeGreaterThan(0);
    // open a row: still no Remind, Save note, Issue invoice run
    await act(async () => { document.querySelector<HTMLElement>('button[aria-label*=", INV-"]')!.click(); });
    expect(document.querySelector('input[aria-label="Call note"]')).toBeNull();
    for (const re of [/^Send reminder/, /^Save note/, /^Issue/, /invoice run/i, /^Adjust/, /^Void/, /^Release/, /^Record/]) expect(hasButton(re), String(re)).toBe(false);
  });
  it('the invoice sheet opened on Billing hides Record payment, but on the member profile (Members: Edit) the desk still records', async () => {
    openAs('s1');
    await show(<ScreenAccessProvider screenKey="billing"><InvoiceSheet invoiceId="INV-2610-001" open onClose={() => {}} audience="staff" /></ScreenAccessProvider>);
    expect(hasButton(/^Record payment/)).toBe(false);
    await act(async () => { root!.render(<MemoryRouter><ScreenAccessProvider screenKey="members"><InvoiceSheet invoiceId="INV-2610-001" open onClose={() => {}} audience="staff" /></ScreenAccessProvider></MemoryRouter>); });
    expect(hasButton(/^Record payment/)).toBe(true);
  });
});

describe('Receipts for Management (View)', () => {
  const waiting = (s: ClubState) => { const r = Object.values(s.receipts).find((x) => !x.deletedAt)!; r.status = 'submitted'; r.supplier = 'Waiting Supplier'; };
  it('shows the receipts and the banner without Approve or Reject', async () => {
    openAs('s9', waiting);
    await show(<ScreenAccessProvider screenKey="receipts"><Receipts /></ScreenAccessProvider>);
    expect(document.body.textContent).toContain('Waiting Supplier');
    expect(document.querySelector('[data-testid="view-only"]')).toBeTruthy();
    expect(hasButton(/^Approve/)).toBe(false);
    expect(hasButton(/^Reject/)).toBe(false);
    expect(hasButton(/Snap a receipt/)).toBe(true); // filing a receipt stays open to everyone (the server allows it)
  });
  it('without the View cell (finance-style Edit) Approve is there', async () => {
    openAs('s9', (s) => { waiting(s); s.club.settings.access = { mgmt: { receipts: 'edit' } }; });
    await show(<ScreenAccessProvider screenKey="receipts"><Receipts /></ScreenAccessProvider>);
    expect(document.querySelector('[data-testid="view-only"]')).toBeNull();
    expect(hasButton(/^Approve/)).toBe(true);
  });
});
