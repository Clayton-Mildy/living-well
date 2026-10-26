// Round 14: the check-in confirm shows who the member comes with (the carer's picture and "with {name}"), only when there is a carer.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { MatchedPanel } from './FaceCard';

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
});

async function mountPanel(nanny: NonNullable<ReturnType<typeof buildSeed>['citra']['members']['m1']['nanny']> | null) {
  const state = buildSeed().citra;
  state.members.m1.nanny = nanny;
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's1', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const t = ((k: string, p?: Record<string, string>) => (k === 'lobby.withNanny' ? `with ${p?.n}` : k)) as never;
  await act(async () => { root!.render(<MatchedPanel t={t} m={state.members.m1} plan="Flex" flags={[]} onConfirm={() => {}} onReject={() => {}} face={null} onFace={() => {}} />); });
}

describe('MatchedPanel carer line', () => {
  it('shows the carer with a picture that opens full size', async () => {
    await mountPanel({ name: 'Mbak Sari', photoMediaId: 'md_nannyphoto0001' });
    expect(document.querySelector('[data-testid=with-nanny]')?.textContent).toBe('with Mbak Sari');
    (document.querySelector('[data-testid=with-nanny] button') as HTMLElement).click();
    await act(async () => {});
    expect(document.querySelector<HTMLImageElement>('[data-testid=image-lightbox-img]')?.getAttribute('src')).toContain('md_nannyphoto0001');
  });
  it('shows the initials without a picture, and nothing without a carer', async () => {
    await mountPanel({ name: 'Mbak Sari' });
    expect(document.querySelector('[data-testid=with-nanny]')?.textContent).toBe('Swith Mbak Sari'); // the avatar's initial, then the line
    expect(document.querySelector('[data-testid=with-nanny] button')).toBeNull();
    await act(async () => { root?.unmount(); });
    host?.remove();
    await mountPanel(null);
    expect(document.querySelector('[data-testid=with-nanny]')).toBeNull();
  });
});
