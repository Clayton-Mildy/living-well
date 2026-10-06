// An empty clubhouse (Adina) shows zeros and clean empty states on every management screen: nothing is invented or left over from CitraPremier.
// Rendered against Adina's own club state, so it holds whatever the shell does when switching clubhouses.
// The Overview is not routed any more (management lands on Arrivals); its code is kept, and it is tested here as a component.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { Overview } from './Overview';
import { Broadcast } from './Broadcast';
import { Venue } from './Venue';
import { People } from './People';
import { Surveys } from './Surveys';
import { Plans } from './Plans';
import { Enquiries } from '../enquiries/Enquiries';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no ResizeObserver (the drag-and-drop board measures with it)
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

function openClub(club: 'adina' | 'citra') {
  const state = buildSeed()[club];
  useSession.setState({ lang: 'en', club, user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra', 'adina'] } });
  useReplica.setState({ club, userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
}
async function show(ui: ReactElement) {
  await act(async () => { root?.unmount(); });
  host?.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter>{ui}</MemoryRouter>); });
}
const body = () => host?.textContent ?? '';
const tile = (k: string) => host?.querySelector(`[data-testid="tile-${k}"]`)?.textContent;
const buttonLabels = () => Array.from(host?.querySelectorAll('button') ?? []).map((b) => b.textContent ?? '');

describe('Adina, an empty clubhouse', () => {
  it('overview: zeros, no leftovers, empty lists', async () => {
    openClub('adina');
    await show(<Overview />);
    expect(body()).toContain('Adina Seniors Clubhouse has no members or staff yet. Anything you add here stays separate from your other clubhouses.');
    for (const k of ['inClub', 'goneHome', 'visits', 'extra', 'review', 'checks', 'overdue', 'enq', 'photos', 'pay', 'unread', 'stock', 'venue']) expect(tile(k), k).toBe('0');
    expect(tile('logs')).toBe('0 / 0');
    expect(tile('survey')).toBe('No answers yet');
    for (const s of ['Nothing has happened yet today.', 'Nothing planned yet.', 'No requests from families right now.', 'No open enquiries.']) expect(body()).toContain(s);
    expect(body()).not.toMatch(/Oma Lina|Opa Hendra|Bambang|45 members/);
  });
  it('the same screen on CitraPremier has its own numbers, lists sorted and translated', async () => {
    openClub('citra');
    await show(<Overview />);
    expect([tile('inClub'), tile('goneHome'), tile('visits'), tile('extra')]).toEqual(['3', '0', '3', '0']);
    expect(body()).not.toMatch(/Expected|To arrive|expected/);
    expect(tile('enq')).toBe('4');
    expect([tile('review'), tile('checks'), tile('overdue'), tile('survey'), tile('photos'), tile('logs'), tile('lunch'), tile('pay'), tile('stock'), tile('venue'), tile('plans')])
      .toEqual(['1', '1', '1', '4.7 / 5', '0', '0 / 3', 'Not yet', '0', '3', '2', 'Sample']);
    expect(host?.querySelector('[data-tile="checks"]')?.textContent).toContain('All normal');
    expect(host?.querySelector('[data-tile="survey"]')?.textContent).toContain('3 answers');
    // Live today: today's activity, newest first
    expect(host?.querySelector('#ov-live button')?.textContent).toContain('Reading for Bapak Bambang: 122/73');
    // Coming up: by date, not in the order entered
    const up = Array.from(host?.querySelectorAll('#ov-up button') ?? []).map((b) => b.textContent ?? '');
    expect(up.length).toBeGreaterThan(3);
    expect(up[0]).toContain('PT Arunika Farma caregiver seminar');
    expect(up[1]).toContain('Kebun Raya Bogor');
    expect(up[2]).toContain('staff first-aid training');
    expect(up[3]).toContain('Bank Prima Nusantara');
    // enquiries show stage names, not keys
    const enq = host?.querySelector('#ov-enq')?.textContent ?? '';
    expect(enq).toContain('Oma Siu Lan Tjandra');
    expect(enq).toContain('Trial booked');
    expect(body()).not.toContain('has no members or staff yet');
  });
  it('people, venue, broadcast, surveys, plans and enquiries have empty states', async () => {
    openClub('adina');
    await show(<People />);
    expect(body()).toContain('No staff yet.');
    await show(<Venue />);
    expect(body()).toContain('No upcoming bookings.');
    await show(<Broadcast />);
    const labels = buttonLabels();
    for (const l of ['Families · 0', 'Enquiries · 0', 'Staff · 0']) expect(labels.some((x) => x.includes(l)), l).toBe(true);
    expect(body()).toContain('Nobody to message yet in this selection.');
    expect(body()).toContain('No broadcasts yet.');
    await show(<Surveys />);
    expect(body()).toContain('No family has the app yet, so there is nobody to send to.');
    expect(body()).not.toContain('Earlier surveys');
    await show(<Plans />);
    expect(body()).toContain('No members yet, so there is nothing to preview.');
    expect((host?.querySelector('input[aria-label="Flex price in rupiah"]') as HTMLInputElement).value).toBe('5.500.000');
    await show(<Enquiries />);
    expect(host?.querySelector('h1')?.textContent).toBe('Enquiries');
    expect(body().split('Drop a card here').length - 1).toBe(5);
  });
});
