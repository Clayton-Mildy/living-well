// The Documents tab: registration is on paper. Every document type has Upload / Replace (photo or file) and, when a file was uploaded, View
// (an image in a viewer, a PDF in a new tab); a seed document with no upload says "Paper copy on file". There is no "send form link" any more.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed, type ClubState, type Role } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { useAct } from '../../../lib/act';
import { DocsTab } from './DocsTab';
import type { P } from './types';

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

function Harness({ state, as, family }: { state: ClubState; as: Role; family?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const doAct = useAct();
  const p = { s: state, m: state.members.m1, today: T, nowMin: 600, t, fmt, lang: 'en', audience: family ? 'family' : 'staff', family: !!family, role: as, mgmt: as === 'mgmt', pending: [], mine: [], act: doAct, canEdit: true } as unknown as P;
  return <DocsTab p={p} />;
}
async function show(state: ClubState, as: Role = 'lobby', family = false) {
  const uid = family ? 'f1' : as === 'mgmt' ? 's9' : 's1';
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: uid, name: 'Caca', role: as, clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: uid, confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><Harness state={state} as={as} family={family} /></MemoryRouter>); });
}
const btn = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => (b.textContent ?? '').replace(/[a-z_]+$/, '').trim() === label || b.getAttribute('aria-label') === label);
const labels = () => Array.from(document.querySelectorAll<HTMLElement>('button')).map((b) => (b.textContent ?? '').trim());

describe('Documents tab (paper registration)', () => {
  it('a seed document without an upload says "Paper copy on file" and has nothing to open', async () => {
    const s = buildSeed().citra;
    expect(s.members.m1.documents.find((d) => d.type === 'membershipForm')).toMatchObject({ status: 'onFile', fileName: 'membership-form.pdf' });
    await show(s);
    expect(document.body.textContent).toContain('Paper copy on file');
    expect(btn('View')).toBeUndefined();
  });
  it('Upload / Replace takes a photo or a file for every document type; no online form link', async () => {
    await show(buildSeed().citra);
    const input = document.querySelectorAll('input[data-testid="doc-file"]');
    expect(input.length).toBeGreaterThanOrEqual(3);
    expect(input[0].getAttribute('accept')).toBe('image/*,application/pdf');
    expect(labels().filter((l) => /Replace|Upload/.test(l)).length).toBeGreaterThanOrEqual(3);
    expect(document.querySelectorAll('button[aria-label="Take photo"]').length).toBeGreaterThanOrEqual(3);
    expect(document.body.textContent).not.toMatch(/Send form link|form link|online form/i);
  });
  it('an uploaded image opens in a viewer; an uploaded PDF opens in a new tab', async () => {
    const s = buildSeed().citra;
    const m = s.members.m1;
    m.documents = m.documents.map((d) => (d.type === 'membershipForm' ? { ...d, mediaId: 'md_testregistrationform01', fileName: 'registration-form.jpg' } : d.type === 'ktp' ? { ...d, mediaId: 'md_testktpscan0000001', fileName: 'ktp.pdf' } : d));
    await show(s);
    const views = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => (b.textContent ?? '').trim() === 'View');
    expect(views).toHaveLength(2);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await act(async () => { views[0].click(); }); // ID card: a PDF
    expect(open).toHaveBeenCalledWith('/api/media/md_testktpscan0000001', '_blank', 'noopener');
    expect(document.querySelector('[data-testid="doc-image"]')).toBeNull();
    await act(async () => { views[1].click(); }); // the registration form: an image
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="doc-image"]')?.getAttribute('src')).toBe('/api/media/md_testregistrationform01');
  });
});
