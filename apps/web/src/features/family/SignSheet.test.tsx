// Round 14 (D), the family side of signing: Me → Documents counts the forms waiting for this user's signature, the membership form row on the parent's profile
// offers Read and sign to the signer only, and the sheet (read, sign, confirm) uploads the drawn signature and calls signing.sign. `sign=1` opens it once.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, projectForFamily, type ClubState, type Signing } from '@cp/shared';
import { applicationDataOf } from '@cp/shared/rules/applicationForm';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { useAct } from '../../lib/act';
import { FamilyMe } from './FamilyMe';
import { DocsSection } from './profile/sections';
import type { PCtx } from './profile/sections';
import { useFamilyCtx } from './useFamily';

vi.mock('../../lib/media', async (orig) => ({ ...(await orig<typeof import('../../lib/media')>()), uploadMedia: async () => 'md_signaturetest00001' }));

const T = '2026-10-21';
let root: Root | null = null;
let host: HTMLElement | null = null;
const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: {} }));
// jsdom draws nothing: a recording 2D context and a canvas that "encodes" a PNG blob
const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(), arc: vi.fn(), fill: vi.fn(), scale: vi.fn(), fillRect: vi.fn() } as Record<string, unknown>;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  (window as unknown as { innerWidth: number }).innerWidth = 800;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  actMock.mockClear();
  vi.restoreAllMocks();
});

const sent = (): Signing => ({ status: 'sent', meterai: 'e', steps: [{ status: 'draft', at: '2026-10-20T09:00', by: 'staff:s1' }, { status: 'sent', at: '2026-10-20T09:05', by: 'staff:s1' }] });
/** The seed with Oma Lina's membership form in the given signing state (the form snapshot is taken as Send does). */
function stateWith(make: (() => Signing) | null = sent): ClubState {
  return produce(buildSeed().citra, (d) => {
    if (!make) return;
    const doc = d.members.m1.documents.find((x) => x.type === 'membershipForm')!;
    doc.signing = { ...make(), form: applicationDataOf(d as ClubState, 'm1', T) };
  });
}
function open(familyId: string, state: ClubState) {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const view = projectForFamily(state, familyId);
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock as never });
}
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname + l.search}</span>; }
/** The documents section as the parent's profile renders it. */
function Docs() {
  const { s, t, fmt, now, user } = useFamilyCtx();
  const doAct = useAct();
  const p: PCtx = { s, m: s.members.m1, t, fmt, today: now.today, userId: user!.id, act: doAct, go: () => {} };
  return <DocsSection p={p} id="docs" />;
}
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}<Where /></MemoryRouter>); });
}
/** Me, with the profile standing in as a bare route (the real Me is gone once the page changes, and its member switcher would eat `?member=`). */
const me = <Routes><Route path="/me" element={<FamilyMe />} /><Route path="/profile" element={<span />} /></Routes>;
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const text = () => document.body.textContent || '';
const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
const btn = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
/** React listens for the native pointer events; jsdom builds them from a plain Event with the coordinates added. */
function ptr(type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1, button: 0 });
  act(() => { document.querySelector('canvas')!.dispatchEvent(e); });
}
const stroke = () => { ptr('pointerdown', 10, 10); ptr('pointermove', 40, 30); ptr('pointermove', 80, 20); ptr('pointerup', 80, 20); };
const typeCode = async (v: string) => {
  const input = q('[data-testid="sign-code"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('family signing: Me → Documents', () => {
  it('counts the forms waiting for this user and opens the first parent’s Documents with the sign sheet', async () => {
    open('f1', stateWith());
    await show(me, '/me');
    const row = q('[data-testid="me-docs"]')!;
    expect(row.textContent).toContain('Documents');
    expect(row.textContent).toContain('1');
    await click(row);
    expect(q('[data-testid="where"]')!.textContent).toBe('/profile?member=m1&sign=1');
  });

  it('shows no count when nothing waits, and still opens the first parent’s Documents', async () => {
    open('f1', stateWith(null));
    await show(me, '/me');
    const row = q('[data-testid="me-docs"]')!;
    expect(row.textContent).not.toMatch(/\d/);
    await click(row);
    expect(q('[data-testid="where"]')!.textContent).toBe('/profile?member=m1&sec=docs');
  });

  it('counts nothing for a family user who is not the signer', async () => {
    open('f2', stateWith());
    await show(me, '/me');
    expect(q('[data-testid="me-docs"]')!.textContent).not.toMatch(/\d/);
  });
});

describe('family signing: the sign sheet', () => {
  it('the signer sees Read and sign and the status trail; the sheet opens from the button', async () => {
    open('f1', stateWith());
    await show(<Docs />, '/profile?member=m1');
    expect(q('[data-testid="sign-badge"]')?.textContent).toContain('Sent');
    expect(q('[data-testid="sign-sheet"]')).toBeNull();
    await click(btn('Read and sign'));
    expect(q('[data-testid="sign-sheet"]')).toBeTruthy();
  });

  it('keeps Sign disabled until the form is read, a signature is drawn and 6 digits are typed; then uploads and calls signing.sign', async () => {
    open('f1', stateWith());
    await show(<Docs />, '/profile?member=m1&sign=1');
    expect(q('[data-testid="sign-sheet"]')).toBeTruthy(); // sign=1 opens it
    expect(q('[data-testid="where"]')!.textContent).toBe('/profile?member=m1'); // once: the flag is dropped
    expect(text()).toContain('We sent a code to +62 ••• 4471');
    expect(text()).toContain('Demo: any 6 digits');
    const go = () => q('[data-testid="sign-go"]') as HTMLButtonElement;
    expect(go().textContent).toBe('Sign');
    expect(go().disabled).toBe(true);

    // 1. read: the form view opens, then the check
    expect(q('[data-testid="sign-view"]')!.textContent).toContain('Read the form');
    await click(q('[data-testid="sign-view"]'));
    expect(q('[data-testid="application-form"]')).toBeTruthy();
    await click(q('[data-testid="application-form"] button'));
    expect(q('[data-testid="application-form"]')).toBeNull();
    await click(q('[data-testid="sign-read"]'));
    expect(go().disabled).toBe(true);
    // 2. sign
    stroke();
    await act(async () => {});
    expect(go().disabled).toBe(true);
    // 3. confirm: five digits are not enough, six are; letters are dropped
    await typeCode('12345');
    expect(go().disabled).toBe(true);
    await typeCode('12a3456');
    expect((q('[data-testid="sign-code"]') as HTMLInputElement).value).toBe('123456');
    expect(go().disabled).toBe(false);

    await click(go());
    await act(async () => {});
    expect(actMock).toHaveBeenCalledWith('signing.sign', { memberId: 'm1', signatureMediaId: 'md_signaturetest00001', otp: '123456' });
    expect(text()).toContain('Signed. The club will countersign it.');
  });

  it('a family user who is not the signer sees the status but no Read and sign, and sign=1 opens nothing', async () => {
    open('f2', stateWith());
    await show(<Docs />, '/profile?member=m1&sign=1');
    expect(q('[data-testid="sign-badge"]')?.textContent).toContain('Sent');
    expect(btn('Read and sign')).toBeUndefined();
    expect(q('[data-testid="sign-sheet"]')).toBeNull();
  });

  it('with the form already signed, sign=1 says so instead of showing the steps', async () => {
    const signed = (): Signing => ({ ...sent(), status: 'signed', signatureMediaId: 'md_signaturetest00001', signerName: 'Maria Wijaya', steps: [...sent().steps, { status: 'signed', at: '2026-10-21T08:30', by: 'family:f1' }] });
    open('f1', stateWith(signed));
    await show(<Docs />, '/profile?member=m1&sign=1');
    const sheet = q('[data-testid="sign-sheet"]')!;
    expect(sheet.textContent).toContain('This form is already signed');
    expect(sheet.textContent).toContain('Signed by family');
    expect(q('[data-testid="sign-go"]')).toBeNull();
    expect(btn('Read and sign')).toBeUndefined();
  });

  it('the trail names the club’s people to the family by their names, and the club itself where the replica lacks them', async () => {
    const odd = (): Signing => ({ ...sent(), steps: [{ status: 'draft', at: '2026-10-20T09:00', by: 'staff:s1' }, { status: 'sent', at: '2026-10-20T09:05', by: 'staff:s99' }] });
    open('f1', stateWith(odd));
    await show(<Docs />, '/profile?member=m1');
    await click(q('[data-testid="sign-badge"]'));
    const trail = q('[data-testid="sign-trail"]')!.textContent!;
    expect(trail).not.toContain('s99');
    expect(trail).not.toMatch(/\bs1\b/);
    expect(trail).toContain('the club');
  });
});
