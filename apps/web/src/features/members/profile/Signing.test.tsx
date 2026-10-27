// Round 14 (D), staff side of online signing: the membership form row on the Documents tab (status badge and timeline, Send for signing / Resend,
// Physical meterai, View signed form; none of it for a nurse or the family) and the Approvals → Signing tab (Countersign, View, Reject with a reason).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed, type Actor, type ClubState, type Role, type SignStep, type Signing } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useUi } from '../../../store/ui';
import { useT, useFmt } from '../../../lib/i18n';
import { useAct } from '../../../lib/act';
import { Reviews } from '../Reviews';
import { DocsTab } from './DocsTab';
import type { P } from './types';

vi.mock('../../../lib/media', async (orig) => ({ ...(await orig<typeof import('../../../lib/media')>()), uploadDocument: async () => ({ mediaId: 'md_physicalscan000001', fileName: 'signed-scan.jpg' }) }));

const T = '2026-10-21';
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
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const actMock = vi.fn(async (_name: string, _input: unknown) => ({ ok: true as const, result: { approved: 1, rejected: 1, skipped: [] as string[], conflicts: [] as string[] } }));
const step = (status: Signing['status'], at: string, by: Actor = 'staff:s1'): SignStep => ({ status, at, by });
const sent: Signing = { status: 'sent', meterai: 'e', steps: [step('draft', '2026-10-20T09:00'), step('sent', '2026-10-20T09:05')] };
function withSigning(state: ClubState, signing?: Signing): ClubState {
  const m = state.members.m1;
  m.documents = m.documents.map((d) => (d.type === 'membershipForm' ? { ...d, signing } : d));
  return state;
}
const signed = (): Signing => ({
  status: 'signed', meterai: 'e', signatureMediaId: 'md_signaturetest00001', signerName: 'Maria Wijaya',
  steps: [...sent.steps, step('signed', '2026-10-21T08:30', 'family:f1')],
});

function Harness({ state, as, family }: { state: ClubState; as: Role; family?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const doAct = useAct();
  const p = { s: state, m: state.members.m1, today: T, nowMin: 600, t, fmt, lang: 'en', audience: family ? 'family' : 'staff', family: !!family, role: as, mgmt: as === 'mgmt', pending: [], mine: [], act: doAct, canEdit: true } as unknown as P;
  return <DocsTab p={p} />;
}
function setup(state: ClubState, as: Role, family = false) {
  const uid = family ? 'f1' : as === 'mgmt' ? 's9' : 's1';
  actMock.mockClear();
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: 'Caca', role: as, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: actMock });
}
async function mount(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
async function docs(state: ClubState, as: Role = 'lobby', family = false) {
  setup(state, as, family);
  await mount(<Harness state={state} as={as} family={family} />);
}
const buttons = () => Array.from(document.querySelectorAll<HTMLElement>('button'));
const btn = (label: string) => buttons().find((b) => (b.textContent ?? '').replace(/^[a-z_]+(?=[A-Z])/, '').trim() === label || b.getAttribute('aria-label') === label); // the icon's name leads the text
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe('Documents tab: signing, front desk', () => {
  it('Send for signing calls signing.send and says the (simulated) WhatsApp link went to the billing contact', async () => {
    await docs(buildSeed().citra);
    await click(btn('Send for signing'));
    expect(actMock).toHaveBeenCalledWith('signing.send', { memberId: 'm1' });
    expect(useUi.getState().toast?.text).toBe('WhatsApp link sent to Maria Wijaya (simulated)');
  });

  it('a sent form says Sent and offers Resend; its timeline lists Draft and Sent with the time and who', async () => {
    await docs(withSigning(buildSeed().citra, sent));
    expect(btn('Send for signing')).toBeUndefined();
    expect(btn('Resend')).toBeTruthy();
    expect(document.querySelector('[data-testid="sign-badge"]')?.textContent).toContain('Sent');
    expect(document.querySelector('[data-testid="sign-trail"]')).toBeNull(); // collapsed until opened
    await click(document.querySelector('[data-testid="sign-badge"]'));
    const rows = Array.from(document.querySelectorAll('[data-testid="sign-trail"] [data-status]'));
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['draft', 'sent', 'signed', 'countersigned', 'stamped']);
    expect(rows[0].textContent).toContain('Draft');
    expect(rows[0].textContent).toContain('09:00');
    expect(rows[1].textContent).toContain('Sent');
    expect(rows[1].textContent).toContain('09:05');
    expect(rows[2].textContent).not.toMatch(/\d\d:\d\d/); // not reached yet
    await click(btn('Resend'));
    expect(actMock).toHaveBeenCalledWith('signing.send', { memberId: 'm1' });
  });

  it('once the family signed there is no Send or Physical meterai; View signed form opens the form with the signature', async () => {
    await docs(withSigning(buildSeed().citra, signed()));
    expect(btn('Send for signing')).toBeUndefined();
    expect(btn('Resend')).toBeUndefined();
    expect(btn('Physical meterai')).toBeUndefined();
    expect(document.querySelector('[data-testid="sign-badge"]')?.textContent).toContain('Signed by family');
    await click(btn('View signed form'));
    expect(document.querySelector('[data-testid="application-form"] [data-field="signature"]')).toBeTruthy();
  });

  it('a stamped e-Meterai form shows its serial and opens the signed form, not an old paper scan', async () => {
    const sig: Signing = { ...signed(), status: 'stamped', meteraiSerial: 'EM-0001-2026', countersignerName: 'Ega', steps: [...signed().steps, step('countersigned', '2026-10-21T09:00', 'staff:s9'), step('stamped', '2026-10-21T09:01', 'system')] };
    const s = withSigning(buildSeed().citra, sig);
    s.members.m1.documents = s.members.m1.documents.map((d) => (d.type === 'membershipForm' ? { ...d, mediaId: 'md_oldpaperscan000001', fileName: 'old.jpg', status: 'onFile' as const } : d));
    await docs(s);
    expect(document.body.textContent).toContain('EM-0001-2026');
    expect(btn('View')).toBeUndefined(); // the old scan is not the record
    await click(btn('View signed form'));
    expect(document.querySelector('[data-testid="application-form"] [data-field="signature"]')).toBeTruthy();
  });

  it('Physical meterai opens the print view and a scan goes to signing.physical with its media id; the row then reads Physical meterai', async () => {
    await docs(buildSeed().citra);
    expect(document.querySelector('[data-testid="physical-scan"]')).toBeNull();
    await click(btn('Physical meterai'));
    expect(document.querySelector('[data-testid="application-form"]')).toBeTruthy(); // printed for the paper
    expect(actMock).not.toHaveBeenCalled();
    const input = document.querySelector<HTMLInputElement>('[data-testid="physical-scan"] input[data-testid="doc-file"]')!;
    expect(input).toBeTruthy();
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'signed-scan.jpg', { type: 'image/jpeg' })] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(actMock).toHaveBeenCalledWith('signing.physical', { memberId: 'm1', mediaId: 'md_physicalscan000001', fileName: 'signed-scan.jpg' });
  });

  it('a physical-meterai form reads Stamped · Physical meterai and its record is the scan', async () => {
    const s = withSigning(buildSeed().citra, { status: 'stamped', meterai: 'physical', steps: [step('stamped', '2026-10-21T09:10')] });
    s.members.m1.documents = s.members.m1.documents.map((d) => (d.type === 'membershipForm' ? { ...d, mediaId: 'md_physicalscan000001', fileName: 'signed-scan.jpg', status: 'onFile' as const } : d));
    await docs(s);
    expect(document.querySelector('[data-testid="sign-badge"]')?.textContent).toContain('Physical meterai');
    expect(btn('View signed form')).toBeUndefined();
    expect(btn('View')).toBeTruthy();
    expect(btn('Send for signing')).toBeUndefined();
  });

  it('a nurse sees the status but no Send or Physical meterai; neither does the family', async () => {
    await docs(withSigning(buildSeed().citra, sent), 'nurse');
    expect(btn('Resend')).toBeUndefined();
    expect(btn('Send for signing')).toBeUndefined();
    expect(btn('Physical meterai')).toBeUndefined();
    expect(document.querySelector('[data-testid="sign-badge"]')?.textContent).toContain('Sent');
    await act(async () => { root?.unmount(); });
    host?.remove();
    await docs(buildSeed().citra, 'lobby', true);
    expect(btn('Send for signing')).toBeUndefined();
    expect(btn('Physical meterai')).toBeUndefined();
  });
});

describe('Approvals → Signing', () => {
  const dialogReject = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button')).find((b) => (b.textContent ?? '').replace(/^[a-z_]+(?=[A-Z])/, '') === 'Reject');
  async function approvals(extra?: (s: ClubState) => void) {
    const state = withSigning(buildSeed().citra, signed());
    extra?.(state);
    setup(state, 'mgmt');
    await mount(<Reviews />);
    await click(Array.from(document.querySelectorAll('[role="tab"]')).find((b) => /^Signing/.test(b.textContent || '')));
  }

  it('lists the signed form as one row: member, signer, when; Countersign approves it', async () => {
    await approvals();
    const rows = document.querySelectorAll('[data-approval][data-type="signing"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Lina Wijaya');
    expect(rows[0].textContent).toContain('Membership form');
    expect(rows[0].textContent).toContain('Maria Wijaya');
    expect(btn('Approve')).toBeUndefined();
    await click(btn('Countersign'));
    expect(actMock).toHaveBeenCalledWith('approval.approve', { type: 'signing', ids: ['m1'] });
  });

  it('View opens the form with the family signature on it', async () => {
    await approvals();
    expect(document.querySelector('[data-testid="application-form"]')).toBeNull();
    await click(btn('View'));
    expect(document.querySelector('[data-testid="application-form"] [data-field="signature"]')).toBeTruthy();
  });

  it('Reject asks why (the form goes back to Draft) and sends the reason', async () => {
    await approvals();
    await click(btn('Reject'));
    expect(document.body.textContent).toContain('Send this form back');
    const reason = document.querySelector<HTMLTextAreaElement>('textarea[name="rejectReason"]')!;
    expect(reason).toBeTruthy();
    await click(dialogReject());
    expect(actMock).not.toHaveBeenCalled(); // a reason is required
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => { set.call(reason, 'The signature is hard to read'); reason.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(dialogReject());
    expect(actMock).toHaveBeenCalledWith('approval.reject', { type: 'signing', ids: ['m1'], reason: 'The signature is hard to read' });
  });
});
