// Round 13, lead history: the History view of Enquiries (six months, the cohort of each) and the timeline on a lead card. Rendered against the roster seed on 21 Oct.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, type ClubState } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Enquiries } from './Enquiries';

vi.mock('../../shell/demoAccounts', () => ({ useDemoLogin: () => true, useDemoAccounts: () => [] }));

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

function openClub(lang: 'en' | 'id' = 'en') {
  const state: ClubState = buildSeed(T, 598, { roster: true }).citra;
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement, path = '/enquiries') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>); });
}
const q = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
const click = async (el: Element | undefined) => { expect(el, 'element to click').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const tab = (name: string) => q('[role="tab"]').find((b) => b.textContent?.trim() === name);

describe('lead history', () => {
  it('a lead card on the board shows the timeline of its moves', async () => {
    openClub();
    await show(<Enquiries />);
    const e1 = document.querySelector('[data-lead="e1"]')!;
    expect(e1.querySelector('[data-timeline="e1"]')?.textContent).toBe('New 8 Oct · Trial 12 Oct');
    expect(document.querySelector('[data-lead="e9"] [data-timeline]')?.textContent).toMatch(/^New 28 Sept? · Visit 1 Oct · Lost 8 Oct$/);
  });

  it('History lists six months newest first, each with its cohort; the leads open on a tap', async () => {
    openClub();
    await show(<Enquiries />);
    await click(tab('History'));
    const groups = q('section[aria-label]');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['October 2026', 'September 2026', 'August 2026', 'July 2026', 'June 2026', 'May 2026']);
    expect(groups[0].textContent).toContain('4 opened'); // e1, e2, e3 and e5
    expect(groups[0].textContent).toContain('Chose another place 1'); // Ibu Nyoman Sari, lost on 8 Oct
    expect(groups[0].textContent).toMatch(/Joined2 · 38%/); // the two members who started in October; 38% of the three months before
    expect(groups[0].textContent).toContain('of leads opened in the 3 months before');
    expect(groups[0].textContent?.match(/%/g)).toHaveLength(1); // only the Joined row carries a percentage
    expect(groups[1].textContent).not.toContain('Chose another place');
    expect(document.querySelector('[data-stage]')).toBeNull(); // the board is hidden
    const toggle = Array.from(groups[0].querySelectorAll('button')).find((b) => /^Leads \(4\)$/.test(b.textContent ?? ''));
    await click(toggle);
    const rows = q('[data-hist-lead]');
    expect(rows.map((r) => r.getAttribute('data-hist-lead')).sort()).toEqual(['e1', 'e2', 'e3', 'e5']);
    await click(rows.find((r) => r.getAttribute('data-hist-lead') === 'e1'));
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    // back on Leads the board returns
    await act(async () => { document.querySelector<HTMLElement>('[role="dialog"] [aria-label="Close"]')?.click(); });
    await click(tab('Leads'));
    expect(q('[data-stage]').length).toBeGreaterThan(0);
  });

  it('reads in Indonesian and opens on ?view=history', async () => {
    openClub('id');
    await show(<Enquiries />, '/enquiries?view=history');
    expect(q('section[aria-label]')[0].textContent).toContain('4 masuk');
    expect(tab('Riwayat')?.getAttribute('aria-selected')).toBe('true');
  });
});
