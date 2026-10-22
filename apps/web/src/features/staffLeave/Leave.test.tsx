// Staff leave (round 13): a staff member's own balance and requests (Account, Tasks), and management's Leave tab in People.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { MyLeave } from './MyLeave';
import { LeaveTab } from './LeaveTab';

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

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: {} }));
function openClub(id: string, role: string, lang: 'en' | 'id' = 'en') {
  const state = buildSeed().citra;
  actMock.mockClear();
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id, name: id, role, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: id, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
  return state;
}
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const textOf = (b: HTMLElement) => { const c = b.cloneNode(true) as HTMLElement; c.querySelectorAll('.ms').forEach((x) => x.remove()); return (c.textContent ?? '').trim(); };
const button = (label: string, within: ParentNode = document) => Array.from(within.querySelectorAll<HTMLElement>('button')).find((b) => textOf(b) === label);
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe('MyLeave (staff)', () => {
  it('Caca sees 4 of 5 days left this year, 2 waiting, her pending request with Cancel, and can cancel it', async () => {
    openClub('s1', 'lobby');
    await show(<MyLeave />);
    expect(document.body.textContent).toContain('4 of 5 days left this year');
    expect(document.body.textContent).toContain('2 waiting');
    expect(document.body.textContent).toContain('Taking my mother to a check-up in Bandung');
    expect(document.body.textContent).toContain('Waiting');
    expect(button('Ask for leave')).toBeTruthy();
    await click(button('Cancel request'));
    expect(actMock).toHaveBeenCalledWith('leave.cancel', { requestId: 'lv-3' });
  });
  it('Dinar has 3 of 5 left and nothing to cancel (her leave is approved)', async () => {
    openClub('s5', 'activity');
    await show(<MyLeave />);
    expect(document.body.textContent).toContain('3 of 5 days left this year');
    expect(document.body.textContent).not.toContain('waiting');
    expect(button('Cancel request')).toBeUndefined();
    expect(document.body.textContent).toContain('Approved');
  });
  it('Ask for leave opens the sheet; Send stays off until the days and a reason are filled in', async () => {
    openClub('s5', 'activity');
    await show(<MyLeave />);
    await click(button('Ask for leave'));
    const dlg = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dlg).toBeTruthy();
    expect(button('Send', dlg)?.getAttribute('aria-disabled') === 'true' || (button('Send', dlg) as HTMLButtonElement).disabled).toBe(true);
  });
  it('Indonesian: translated', async () => {
    openClub('s1', 'lobby', 'id');
    await show(<MyLeave />);
    expect(document.body.textContent).toContain('Sisa cuti tahun ini 4 dari 5 hari');
    expect(button('Ajukan cuti')).toBeTruthy();
  });
});

describe('LeaveTab (management, People)', () => {
  it('Ega sees Caca’s balance, the pending request with Approve and Decline, and Approve calls leave.decide', async () => {
    const s = openClub('s9', 'mgmt');
    await show(<LeaveTab staff={s.staff.s1} />);
    const txt = document.body.textContent ?? '';
    expect(txt).toContain('4 of 5 days left this year');
    expect(txt).toContain('Taking my mother to a check-up in Bandung');
    expect(button('Decline')).toBeTruthy();
    await click(button('Approve'));
    expect(actMock).toHaveBeenCalledWith('leave.decide', { requestId: 'lv-3', approve: true });
  });
  it('Decline asks for an optional note first, then calls leave.decide with it', async () => {
    const s = openClub('s9', 'mgmt');
    await show(<LeaveTab staff={s.staff.s1} />);
    await click(button('Decline'));
    expect(actMock).not.toHaveBeenCalled();
    const dlg = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const input = dlg.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
    await act(async () => {
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, 'We are short that week');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(button('Decline', dlg));
    expect(actMock).toHaveBeenCalledWith('leave.decide', { requestId: 'lv-3', approve: false, note: 'We are short that week' });
  });
  it('a person with decided requests shows them under this year; Chef Agus’s declined one carries the note', async () => {
    const s = openClub('s9', 'mgmt');
    await show(<LeaveTab staff={s.staff.s3} />);
    expect(document.body.textContent).toContain('Declined');
    expect(document.body.textContent).toContain('Menu tasting that day; please pick another day');
    expect(button('Approve')).toBeUndefined();
  });
});
