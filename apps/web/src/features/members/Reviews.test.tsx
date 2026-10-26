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
    const labels = Array.from(document.querySelectorAll('[role="tablist"][aria-label="Approval types"] [role="tab"]')).map((t) => t.textContent);
    expect(labels).toEqual(['Profile · 2', 'Care log · 2', 'Health · 1', 'Photos · 0', 'Menu · 1', 'Programme · 1', 'Stock · 3', 'Renewals · 1', 'Payments · 0', 'Leave · 1', 'History']);
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
    // round 13: with nothing selected both bar buttons are off; with two selected the label carries the count
    expect(btn(/Approve \(0\)/)!.getAttribute('aria-disabled')).toBe('true');
    expect(btn(/Reject \(0\)/)!.getAttribute('aria-disabled')).toBe('true');
    await click(btn(/Select all \(2\)/));
    expect(btn(/Approve \(2\)/)!.textContent).toContain('2');
    expect(btn(/Approve \(2\)/)!.getAttribute('aria-disabled')).toBeNull();
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

  it('Leave tab: the waiting request with dates, days, reason and balance; Approve sends one hub action', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Leave/));
    const rows = document.querySelectorAll('[data-approval][data-type="leave"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Caca');
    expect(rows[0].textContent).toContain('2 days');
    expect(rows[0].textContent).toContain('Taking my mother to a check-up in Bandung');
    expect(rows[0].textContent).toContain('4 of 5 left');
    await click(Array.from(rows[0].querySelectorAll('button')).find((b) => /Approve$/.test(b.textContent || '')));
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'leave', ids: ['lv-3'] });
  });

  it('Leave tab: "Approve all" approves every waiting request in one action', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Leave/));
    await click(btn(/Approve all/));
    expect(actMock).toHaveBeenCalledTimes(1);
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'leave', ids: ['lv-3'] });
  });

  it('Leave tab: Reject opens a sheet where the note is optional and sends the decline with it (or without)', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Leave/));
    const row = document.querySelector('[data-approval="lv-3"]')!;
    await click(Array.from(row.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || '')));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Note for Caca (optional)');
    await click(Array.from(dialog.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || ''))); // no note: still sent
    expect(actMock).toHaveBeenCalledTimes(1);
    expect(actMock.mock.calls[0]).toEqual(['approval.reject', { type: 'leave', ids: ['lv-3'], reason: '' }]);
    actMock.mockClear();
    await click(Array.from(row.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || '')));
    const d2 = document.querySelector('[role="dialog"]')!;
    const ta = d2.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'We are short that week');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(Array.from(d2.querySelectorAll('button')).find((b) => /Reject$/.test(b.textContent || '')));
    expect(actMock.mock.calls[0]).toEqual(['approval.reject', { type: 'leave', ids: ['lv-3'], reason: 'We are short that week' }]);
  });

  it('Leave tab opens from the bell link, shows the empty state when none wait, and History lists decided requests', async () => {
    openClub();
    const v0 = useReplica.getState().view!;
    // no request waits; the declined one was answered a moment ago, so it heads the History list
    const left = Object.fromEntries(Object.entries(v0.leaveRequests).filter(([k]) => k !== 'lv-3').map(([k, r]) => [k, k === 'lv-4' ? { ...r, decidedAt: '2026-10-21T09:59' } : r]));
    useReplica.setState({ view: { ...v0, leaveRequests: left } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter initialEntries={['/reviews?tab=leave']}><Reviews /></MemoryRouter>); });
    expect(tab(/^Leave/)?.getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).toContain('No leave requests to decide');
    await click(tab(/^History/));
    expect(document.querySelector('[data-history="leave:leave:lv-4"]')?.textContent).toContain('Rejected');
  });

  it('shows a row\'s old → new values in its full view and lists handled entries only in History', async () => {
    openClub();
    await show(<Reviews />);
    await click(tab(/^Care log/));
    const edit = Array.from(document.querySelectorAll('[data-approval]')).find((r) => r.textContent?.includes('(edit)'))!;
    await click(Array.from(edit.querySelectorAll('button')).find((b) => /View$/.test(b.textContent || '')));
    expect(edit.textContent).toContain('Mood');
    await click(tab(/^History/));
    expect(document.body.textContent).toMatch(/Approved · Ega/); // handled entries (round 7: the seed's recent photo approvals come first, the older stock requests further back)
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
  it('per person (KC round 6): one card per member with everything about them, group photos and "Other" apart, and Approve all', async () => {
    openClub();
    try { localStorage.removeItem('cp.approvals.mode'); } catch { /* none */ }
    await show(<Reviews />);
    const modes = Array.from(document.querySelectorAll('[role="tablist"][aria-label="Show approvals"] [role="tab"]')).map((t) => t.textContent);
    expect(modes).toEqual(['Per item', 'Per person']);
    await act(async () => { (document.querySelector('[data-mode="person"]') as HTMLButtonElement).click(); });
    expect(document.querySelector('[data-testid="approvals-by-person"]')).not.toBeNull();
    expect(document.querySelector('[role="tablist"][aria-label="Approval types"]')).toBeNull(); // the type tabs belong to "Per item"
    const cards = Array.from(document.querySelectorAll('[data-person]')).filter((c) => !['group-photos', 'other'].includes(c.getAttribute('data-person') || ''));
    expect(cards.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-person="other"]')?.textContent).toContain('Other · menu, stock and leave');
    const first = cards[0] as HTMLElement;
    const allBtn = Array.from(first.querySelectorAll('button')).find((b) => /Approve all \(\d+\)$/.test(b.textContent || ''))!; // the icon's ligature text comes first
    expect(allBtn).toBeTruthy();
    await act(async () => { allBtn.click(); });
    expect(actMock.mock.calls.map((c) => c[0]).some((n) => ['review.approve', 'review.acknowledge', 'approval.approve', 'photo.approve'].includes(n))).toBe(true);
  });
});
