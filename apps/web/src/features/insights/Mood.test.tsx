// Insights › Mood tab (management): the lift line, a dropping member linking to the check-on sheet, and ?tab=mood opening the tab.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { produce } from 'immer';
import { buildSeed, moodId } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Insights } from './index';

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

const T = '2026-10-21';
function open() {
  const state = produce(buildSeed().citra, (d) => {
    d.moodMarks = {};
    const put = (date: string, memberId: string, moment: 'arrival' | 'departure', face: 1 | 2 | 3 | 4 | 5) => {
      const id = moodId(date, memberId, moment);
      d.moodMarks[id] = { id, clubId: d.clubId, createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, time: '10:00', moment, face, by: 'staff:s1' };
    };
    put('2026-10-19', 'm2', 'arrival', 4); put('2026-10-19', 'm2', 'departure', 5);
    put('2026-10-20', 'm2', 'arrival', 3); put('2026-10-20', 'm2', 'departure', 4);
    put('2026-10-21', 'm2', 'arrival', 2); put('2026-10-21', 'm2', 'departure', 3);
  });
  useSession.setState({ lang: 'en', club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
}
async function show(url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/insights" element={<Insights />} /></Routes></MemoryRouter>); });
}

describe('Insights › Mood', () => {
  it('?tab=mood opens the tab with the lift line and the dropping member', async () => {
    open();
    await show('/insights?tab=mood');
    expect(document.querySelector('[data-testid="mood-lift"]')?.textContent).toBe('The club lifts mood by 1 on average');
    const link = document.querySelector('a[data-member="m2"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/today?checkOn=m2');
    expect(link.textContent).toContain('4 → 3 → 2');
  });
});
