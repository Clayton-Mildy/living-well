// Unpaid tab of Next month (round 14): an overdue invoice is a row with its days late, a tap opens the sheet, and recording "promised" calls unpaid.call.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, toMin, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Renewals } from './index';
import { UnpaidList } from './UnpaidList';

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
});

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: {} }));
function openClub(uid = 's10', role = 'finance', name = 'Gabriel', state: ClubState = buildSeed().citra) {
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name, role, clubId: 'citra', clubs: ['citra'] } as never });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function show(ui: ReactElement, at = '/renewals') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));

describe('Unpaid list', () => {
  it('shows the overdue invoice with what is owed, the days late, the next date and that nobody has called yet', async () => {
    openClub();
    await show(<UnpaidList />);
    const row = document.querySelector('[data-unpaid="INV-2609-020"]')!;
    expect(row.textContent).toContain('Opa Tjahjadi');
    expect(row.querySelector('[data-testid="unpaid-late"]')?.textContent).toMatch(/3\.950\.000 · 23 days late/);
    expect(row.querySelector('[data-testid="unpaid-next"]')?.textContent).toBe('On hold since 1 Oct');
    expect(row.querySelector('[data-testid="unpaid-last"]')?.textContent).toBe('Not called yet');
    expect(row.querySelector('a[href^="tel:"]')).toBeTruthy();
    expect(row.querySelector('a[href*="wa.me"]')).toBeTruthy();
  });

  it('a tap opens the sheet; "Promised" needs a day, and Save calls unpaid.call with it', async () => {
    openClub();
    await show(<UnpaidList />);
    await click(btn(/Open Opa Tjahjadi/));
    expect(document.body.textContent).toContain('Unpaid · Opa Tjahjadi');
    expect(document.body.textContent).toContain('No calls yet');
    await click(btn(/^Promised$/));
    expect(btn(/Save call/)?.hasAttribute('disabled') || btn(/Save call/)?.getAttribute('aria-disabled') === 'true').toBe(true); // no day yet
    await click(document.querySelector('[aria-haspopup="dialog"]'));
    await click(document.querySelector('[data-date="2026-10-23"]'));
    await click(btn(/Save call/));
    expect(actMock).toHaveBeenCalledWith('unpaid.call', { invoiceId: 'INV-2609-020', outcome: 'promised', promisedOn: '2026-10-23' });
  });

  it('Record payment opens the payment form on that invoice', async () => {
    openClub();
    await show(<UnpaidList />);
    await click(btn(/Open Opa Tjahjadi/));
    await click(btn(/Record payment/));
    expect(document.body.textContent).toContain('Paid by'); // the payment form's method row
  });

  it('a call shows as the last outcome, and an invoice that is paid leaves the list', async () => {
    const s = buildSeed().citra;
    const called = execute(s, 'unpaid.call', { invoiceId: 'INV-2609-020', outcome: 'promised', promisedOn: '2026-10-23' }, getUser({ citra: s }, 's10')!, { today: '2026-10-21', nowMin: toMin('09:58') }, 'u1').state;
    openClub('s10', 'finance', 'Gabriel', called);
    await show(<UnpaidList />);
    expect(document.querySelector('[data-testid="unpaid-last"]')?.textContent).toBe('Promised for 23 Oct');
    const paid = execute(called, 'payment.record', { memberId: 'm20', method: 'cash', amount: 3_950_000, invoiceId: 'INV-2609-020' }, getUser({ citra: called }, 's10')!, { today: '2026-10-21', nowMin: toMin('09:58') }, 'u2').state;
    await act(async () => { useReplica.setState({ confirmed: paid, view: paid }); });
    expect(document.querySelector('[data-unpaid]')).toBeNull();
    expect(document.body.textContent).toContain('No unpaid invoices');
  });

  it('Next month opens on the Unpaid tab from ?tab=unpaid, without the month switcher', async () => {
    openClub();
    await show(<Renewals />, '/renewals?tab=unpaid');
    expect(Array.from(document.querySelectorAll('[role="tab"]')).find((x) => /Unpaid/.test(x.textContent || ''))?.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-unpaid]')).toBeTruthy();
    expect(btn(/Later month/)).toBeFalsy();
  });
});
