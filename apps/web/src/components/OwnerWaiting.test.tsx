// Owner approvals inline (KC): a waiting price request shows what changes; the Owner approves or rejects it on Plans and in Approvals › Owner, Management can only withdraw.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, execute, getUser, priceOn, live } from '@cp/shared';
import { useReplica } from '../store/replica';
import { useSession } from '../store/session';
import { Plans } from '../features/mgmt/Plans';
import { Reviews } from '../features/members/Reviews';

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
const clock = { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 };
const actMock = vi.fn();
let n = 0;
function open(who: 's9' | 's11') {
  const seeded = structuredClone(buildSeed().citra);
  const cur = priceOn(seeded, '2026-11-05');
  // Ega asks for new Flex and Gold prices; the rest stay as they are
  const asked = execute(seeded, 'prices.set', { flex: cur.flex + 200_000, gold: cur.gold + 300_000, extra: cur.extra, from: '2026-11-05' }, getUser({ citra: seeded }, 's9')!, { today: clock.today, nowMin: clock.startMin }, `ow${++n}`);
  expect(asked.reviewed).toBe('owner');
  const state = asked.state;
  const user = who === 's9' ? { kind: 'staff' as const, id: 's9', name: 'Ega', role: 'mgmt' as const, clubId: 'citra', clubs: ['citra'] }
    : { kind: 'staff' as const, id: 's11', name: 'Benjamin Cass', role: 'owner' as const, clubId: 'citra', clubs: ['citra'] };
  useSession.setState({ lang: 'en', club: 'citra', user });
  actMock.mockReset();
  useReplica.setState({ club: 'citra', userId: user.id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock, act: actMock } as never);
  actMock.mockImplementation(async (name: string, input: unknown) => {
    const view = useReplica.getState().view!;
    try {
      const r = execute(view, name, input, getUser({ citra: view }, who)!, { today: clock.today, nowMin: clock.startMin }, `ow${++n}`);
      useReplica.setState({ view: r.state } as never);
      return { ok: true, result: r.result, reviewed: r.reviewed };
    } catch (e) { return { ok: false, code: (e as { code: string }).code, params: {} }; }
  });
  return { cur };
}
async function show(ui: ReactElement, width: number, path = '/plans') {
  (window as { innerWidth: number }).innerWidth = width;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>); });
}
const button = (re: RegExp) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => re.test(b.textContent?.trim() || ''));
const click = async (el: Element | undefined | null) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe.each([['phone', 390], ['wide', 1280]])('owner requests inline (%s)', (_n, width) => {
  it('the Owner sees the changed prices on Plans and Approve applies them', async () => {
    const { cur } = open('s11');
    await show(<Plans />, width);
    const box = document.querySelector('[data-owner-request]')!;
    const lines = Array.from(box.querySelectorAll('[data-testid="owner-changes"] > div')).map((r) => r.textContent);
    expect(lines).toHaveLength(2); // Flex and Gold only
    expect(lines[0]).toContain('Flex');
    expect(lines[0]).toContain(`${(cur.flex + 200_000).toLocaleString('id-ID')}`);
    expect(lines[1]).toContain('Gold');
    expect(button(/^Reject$/)).toBeTruthy();
    await click(button(/^Approve$/));
    expect(actMock.mock.calls[0][0]).toBe('review.approve');
    expect(priceOn(useReplica.getState().view!, '2026-11-05').flex).toBe(cur.flex + 200_000);
    expect(document.querySelector('[data-owner-request]')).toBeNull();
  });
  it('Management sees Withdraw and no Approve or Reject', async () => {
    open('s9');
    await show(<Plans />, width);
    expect(button(/^Withdraw$/)).toBeTruthy();
    expect(button(/^Approve$/)).toBeUndefined();
    expect(button(/^Reject$/)).toBeUndefined();
    expect(document.querySelectorAll('[data-testid="owner-changes"] > div')).toHaveLength(2);
  });
  it('Reject on Plans asks why, then sends the request back', async () => {
    open('s11');
    await show(<Plans />, width);
    await click(button(/^Reject$/));
    const dialog = document.querySelector('[role="dialog"]')!;
    const ta = dialog.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'Too high'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(Array.from(dialog.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent?.trim() || '')));
    expect(actMock.mock.calls[0][0]).toBe('approval.reject');
    expect(live(useReplica.getState().view!.prices).some((p) => p.from === '2026-11-05')).toBe(false);
  });
  it('the Owner tab card shows the change rows when opened', async () => {
    open('s11');
    await show(<Reviews />, width, '/reviews?tab=owner');
    const card = document.querySelector('[data-type="owner"]')!;
    expect(card).toBeTruthy();
    const row = Array.from(document.querySelectorAll('[data-type="owner"]')).find((r) => /New prices/.test(r.textContent || ''))!;
    await click(Array.from(row.querySelectorAll('button')).find((b) => /View$/.test(b.textContent?.trim() || '')));
    const text = row.textContent || '';
    expect(text).toContain('Flex');
    expect(text).toContain('Gold');
    expect(text.indexOf('Flex')).toBeLessThan(text.indexOf('Requested by'));
  });
});
