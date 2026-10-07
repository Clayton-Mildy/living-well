// The Approvals screen (management): one tab per kind with its count, rows with checkboxes, bulk Approve (N) / Reject (N) as one action,
// a reason for a rejection, and the staff-side "Pending approval" marker.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { PendingMark } from '../../components/PendingMark';
import { Reviews } from './Reviews';

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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { approved: 2, rejected: 2, skipped: [] as string[], conflicts: [] as string[] } }));
function openClub() {
  const state = buildSeed().citra;
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent || '') || re.test(b.getAttribute('aria-label') || ''));
const tab = (name: RegExp) => Array.from(document.querySelectorAll('[role="tab"]')).find((b) => name.test(b.textContent || ''));

describe('Approvals', () => {
  it('has a tab for every kind with its count, and opens on the first one with something waiting', async () => {
    openClub();
    await show(<Reviews />);
    const labels = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent);
    expect(labels).toEqual(['Profile · 2', 'Care log · 2', 'Health · 1', 'Photos · 0', 'Menu · 1', 'Stock · 3', 'History']);
    expect(tab(/^Profile/)?.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelectorAll('[data-cr]')).toHaveLength(2); // a change to approve and a health edit applied at once
    expect(document.body.textContent).toContain('Acknowledge');
  });

  it('selects every row of a tab and approves them with one action; a row can also be approved alone', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Care log/));
    const rows = document.querySelectorAll('[data-approval]');
    expect(rows).toHaveLength(2);
    expect(btn(/Approve \(0\)/)).toBeTruthy();
    await click(btn(/Select all \(2\)/));
    expect(btn(/Approve \(2\)/)).toBeTruthy();
    expect(document.body.textContent).toContain('2 selected');
    await click(btn(/Approve \(2\)/));
    expect(actMock).toHaveBeenCalledTimes(1);
    const [name, input] = actMock.mock.calls[0] as [string, { type: string; ids: string[] }];
    expect(name).toBe('approval.approve');
    expect(input.type).toBe('logs');
    expect(input.ids).toHaveLength(2);
    // one row alone
    actMock.mockClear();
    await click(rows[0].querySelector('button[aria-label*="Select"], [role="checkbox"]'));
    await click(btn(/Clear selection/));
    const approveOne = Array.from(rows[0].querySelectorAll('button')).find((b) => /Approve$/.test(b.textContent || ''));
    await click(approveOne);
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'logs', ids: [(input.ids)[0]] });
  });

  it('a rejection asks for one reason for everything selected, then sends one action', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Health/));
    await click(btn(/Select all \(1\)/));
    await click(btn(/Reject \(1\)/));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('Why is it not approved?');
    // no reason: nothing is sent
    await click(Array.from(dialog!.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || '')));
    expect(actMock).not.toHaveBeenCalled();
    expect(dialog!.textContent).toContain('Please add a note');
    const ta = dialog!.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'Re-measure please');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(Array.from(dialog!.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || '')));
    expect(actMock).toHaveBeenCalledTimes(1);
    expect(actMock.mock.calls[0][0]).toBe('approval.reject');
    expect(actMock.mock.calls[0][1]).toMatchObject({ type: 'readings', reason: 'Re-measure please' });
  });

  it('shows a row\'s old → new values in its full view and lists handled entries only in History', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Care log/));
    const edit = Array.from(document.querySelectorAll('[data-approval]')).find((r) => r.textContent?.includes('(edit)'))!;
    await click(Array.from(edit.querySelectorAll('button')).find((b) => /View$/.test(b.textContent || '')));
    expect(edit.textContent).toContain('Mood');
    await click(tab(/^History/));
    expect(document.body.textContent).toContain('Stock request'); // the seeded, already approved stock requests
    expect(document.querySelectorAll('[data-approval]')).toHaveLength(0);
  });
});

describe('the marker staff see on their own entries', () => {
  it('says Pending approval on a waiting entry, the reason on a rejected one, and nothing on an approved one', async () => {
    openClub();
    await show(<div>
      <PendingMark row={{ approval: { status: 'pending', by: 'staff:s5', at: '2026-10-21T10:00' } }} />
      <PendingMark row={{ approval: { status: 'pending', by: 'staff:s5', at: '2026-10-21T10:00', prev: { a: 1 } } }} />
      <PendingMark row={{ approval: { status: 'rejected', by: 'staff:s5', at: '2026-10-21T10:00', reason: 'Wrong day' } }} />
      <PendingMark row={{ approval: { status: 'approved', by: 'staff:s5', at: '2026-10-21T10:00' } }} />
      <PendingMark row={{}} />
    </div>);
    const marks = Array.from(document.querySelectorAll('[data-testid="approval-mark"]')).map((m) => m.textContent);
    expect(marks).toEqual(['Pending approval', 'Pending approval · edit', 'Rejected: Wrong day']);
  });
});
