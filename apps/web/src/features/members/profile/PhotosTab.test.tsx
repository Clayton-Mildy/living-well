// Round 20: the profile's "Take photo" is there on an open day and gone on a closed day (photo.take refuses closed days).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, getUser, type ClubState } from '@cp/shared';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { PhotosTab } from './PhotosTab';
import type { P } from './types';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => { root?.unmount(); }); host?.remove(); root = null; host = null; document.body.innerHTML = ''; });

function Harness({ state, today }: { state: ClubState; today: string }) {
  const t = useT();
  const fmt = useFmt();
  const me = getUser({ [state.clubId]: state }, 's5')!;
  const p = { s: state, m: state.members.m1, today, nowMin: 600, t, fmt, lang: 'en', isPhone: false, family: false, mgmt: false, me, st: { key: 'active' }, act: async () => ({ ok: true, result: {} }) } as unknown as P;
  return <PhotosTab p={p} />;
}
async function show(today: (s: ClubState) => string) {
  const state = buildSeed().citra;
  const day = today(state);
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's5', name: 'Dinar', role: 'activity', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's5', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: day, startMin: 600, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Harness state={state} today={day} />); });
}
const takeButton = () => Array.from(host!.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Take photo'));

describe('PhotosTab take photo', () => {
  it('is offered on an open day', async () => {
    await show(() => '2026-10-21');
    expect(takeButton()).toBeTruthy();
  });
  it('is hidden on a closed day', async () => {
    await show((s) => s.calendarEvents['ev-closed-1030'].date);
    expect(takeButton()).toBeUndefined();
  });
});
