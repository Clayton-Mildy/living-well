// Round 13: the front desk records cash or a transfer on an open invoice; it waits for finance, who confirm it on Payments.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { InvoiceSheet } from './InvoiceSheet';
import { Payments } from './Payments';
import { Billing } from './Billing';

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
/** Caca records Rp 1.000.000 cash on Oma Lina's October invoice (or not), then `who` looks at the club. */
function openAs(who: 's1' | 's10', recorded: boolean) {
  let state: ClubState = buildSeed().citra;
  if (recorded) state = execute(state, 'payment.record', { memberId: 'm1', amount: 1_000_000, method: 'cash', invoiceId: 'INV-2610-001' }, getUser({ citra: state }, 's1')!, { today: T, nowMin: 600 }, 'desk1').state;
  const user = who === 's1' ? { kind: 'staff' as const, id: 's1', name: 'Caca', role: 'lobby' as const, clubId: 'citra', clubs: ['citra'] } : { kind: 'staff' as const, id: 's10', name: 'Fransiska', role: 'finance' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
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
const button = (label: string | RegExp) => buttons().find((b) => { const x = textOf(b); return typeof label === 'string' ? x === label : label.test(x); });

describe('the front desk records a payment', () => {
  it('Record payment offers cash and bank transfer only', async () => {
    openAs('s1', false);
    await show(<InvoiceSheet invoiceId="INV-2610-001" open onClose={() => {}} audience="staff" />);
    const record = button('Record payment');
    expect(record).toBeTruthy();
    expect(button('Void invoice') ?? button(/^Void/)).toBeUndefined(); // the desk gets no other invoice actions
    await act(async () => { record!.click(); });
    const group = document.querySelector<HTMLElement>('[role="group"][aria-label="Paid by"]')!;
    expect(Array.from(group.querySelectorAll('button')).map(textOf)).toEqual(['Cash', 'Bank transfer']);
  });
  it('a waiting payment reads "Recorded by Caca, waiting for finance" and cannot be refunded', async () => {
    openAs('s1', true);
    await show(<InvoiceSheet invoiceId="INV-2610-001" open onClose={() => {}} audience="staff" />);
    expect(document.body.textContent).toContain('Recorded by Caca, waiting for finance');
    expect(document.body.textContent).toContain('Waiting for finance');
    expect(button('Record payment')).toBeUndefined(); // nobody records it twice
    expect(button(/^Refund/)).toBeUndefined();
  });
  it('the Invoices list says "waiting for finance" on an invoice whose only payment is waiting, and not on the others', async () => {
    openAs('s1', true);
    await show(<Billing />);
    const meta = (num: string) => Array.from(document.querySelectorAll<HTMLElement>('button[aria-label$=", ' + num + '"]')).map((b) => b.textContent ?? '');
    expect(meta('INV-2610-001').join('|')).toContain('waiting for finance');
    const others = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label*=", INV-"]')).filter((b) => !(b.getAttribute('aria-label') ?? '').endsWith('INV-2610-001'));
    expect(others.length).toBeGreaterThan(0);
    expect(others.some((b) => (b.textContent ?? '').includes('waiting for finance'))).toBe(false);
  });
  it('finance sees "Waiting for you · 1" on Payments with Confirm', async () => {
    openAs('s10', true);
    await show(<Payments />);
    expect(document.body.textContent).toContain('Waiting for you · 1');
    expect(button(/^Confirm/)).toBeTruthy();
    expect(button(/^Reject/)).toBeTruthy();
  });
});
