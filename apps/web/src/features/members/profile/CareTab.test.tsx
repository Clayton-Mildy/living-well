// The Care tab for the family audience (round 14): the mood counts and each day's chip are the daily moods from the faces, as staff see them; the old mood words are gone.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, dailyMood, projectForFamily, type ClubState } from '@cp/shared';
import { visitDays } from '@cp/shared/rules/family';
import { useReplica } from '../../../store/replica';
import { useSession } from '../../../store/session';
import { useT, useFmt } from '../../../lib/i18n';
import { useAct } from '../../../lib/act';
import { CareTab } from './CareTab';
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
});

function Harness({ state }: { state: ClubState }) {
  const t = useT();
  const fmt = useFmt();
  const doAct = useAct();
  const p = { s: state, m: state.members.m1, today: T, nowMin: 600, t, fmt, lang: 'en', audience: 'family', family: true, role: 'lobby', mgmt: false, pending: [], mine: [], act: doAct, canEdit: false, isPhone: false } as unknown as P;
  return <CareTab p={p} />;
}

describe('Care tab (family audience)', () => {
  it('counts the daily moods of the last 4 weeks by face and shows the day’s face on a care day (no old mood words)', async () => {
    const view = projectForFamily(buildSeed().citra, 'f1');
    useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'family', id: 'f1', name: 'Maria', clubId: 'citra' } as never });
    useReplica.setState({ club: 'citra', userId: 'f1', confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<MemoryRouter><Harness state={view} /></MemoryRouter>); });
    const text = document.body.textContent || '';
    const last = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    const word = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Low', 1: 'Upset' }[dailyMood(view, 'm1', last)!.face];
    expect(text).toContain(word);
    expect(text).not.toMatch(/Cheerful|Calm|Quiet/);
    expect(document.querySelector(`[data-testid="care-day"][data-date="${last}"]`)?.textContent).toContain(word);
  });
});
