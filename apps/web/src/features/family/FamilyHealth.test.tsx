// Round 8: the family Health tab, Health history and a parent's profile render against the seed (a smoke test for crashes, raw keys and the main facts).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, projectForFamily } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyHealth } from './FamilyHealth';
import { FamilyHistory } from './FamilyHistory';
import { FamilyProfile } from './FamilyProfile';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
});
// the family pages switch to their desktop layout from 1024px (jsdom's default width): the phone / tablet tests run at 800
beforeEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 800; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
function open(familyId: string, lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const view = projectForFamily(buildSeed().citra, familyId);
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
}
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
const text = () => document.body.textContent || '';
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);

/** Run a render at a window width (the page's phone / tablet / laptop switch reads it), then put the width back. */
async function atWidth(w: number, run: () => Promise<void>) {
  const was = window.innerWidth;
  (window as unknown as { innerWidth: number }).innerWidth = w;
  try { await run(); } finally { (window as unknown as { innerWidth: number }).innerWidth = was; }
}

describe('family health', () => {
  it('Health: the first parent, a card with her latest blood pressure, four tiles, the parent switch for both parents (no "both")', async () => {
    open('f1');
    await show(<FamilyHealth />, '/health');
    expect(q('family-health')?.getAttribute('data-member-id')).toBe('m1');
    expect(q('health-hero')?.getAttribute('data-status')).toMatch(/normal|watch|alert/);
    expect(q('health-hero')?.textContent).toMatch(/\d{2,3}\/\d{2,3}/);
    expect(['pulse', 'spo2', 'glucose', 'weight'].every((k) => !!q(`health-tile-${k}`))).toBe(true);
    expect(document.querySelectorAll('button[aria-pressed][data-member]')).toHaveLength(2);
    expect(q('parent-switch')?.getAttribute('data-tone')).toBe('page');
    expect(q('all-parents')).toBeNull(); // round 11: Health shows one parent at a time
    expect(text()).toContain('Oma Lina’s profile and care');
  });
  it('Health: with two parents the chosen one’s name sits under the title; with one parent there is no name line and the title stays "Health"', async () => {
    open('f1');
    await show(<FamilyHealth />, '/health');
    expect(q('title-who')?.textContent).toBe('Oma Lina Wijaya');
    expect(document.querySelector('h1')?.textContent).toBe('Health');
    await act(async () => { root?.unmount(); });
    host?.remove();
    open('fm10_0');
    await show(<FamilyHealth />, '/health');
    expect(q('title-who')).toBeNull();
    expect(document.querySelector('h1')?.textContent).toBe('Health');
    expect(document.querySelectorAll('button[data-member]')).toHaveLength(0);
  });
  it('Health on a laptop: name chips by the title, the card, tiles and profile row on the left, the History inline on the right', async () => {
    open('f1');
    await atWidth(1440, async () => {
      await show(<FamilyHealth />, '/health');
      expect(document.querySelectorAll('button[data-member]')).toHaveLength(2); // the parents are name chips, not rings
      expect(document.querySelector('button[data-member="m1"]')?.textContent).toContain('Oma Lina');
      expect(q('title-who')).toBeNull();
      expect(q('history-inline')).toBeTruthy();
      expect(q('history-chart')).toBeTruthy();
      expect(q('history-metrics')).toBeTruthy();
      expect(q('history-range')).toBeTruthy();
      expect(document.querySelectorAll('[data-testid="history-reading"]').length).toBeGreaterThan(5);
      expect(q('history-summary')?.getAttribute('data-metric')).toBe('bp');
      expect(q('health-history')?.textContent).toBe('Open full page'); // the way to the History page
      expect(q('health-profile')).toBeTruthy();
      expect(q('health-hero')).toBeTruthy();
      // a tile picks the measurement in the inline History (no page change)
      await act(async () => { (q('health-tile-pulse') as HTMLElement).click(); });
      expect(q('history-summary')?.getAttribute('data-metric')).toBe('pulse');
    });
  });
  it('Health: a deep link picks the other parent', async () => {
    open('f1');
    await show(<FamilyHealth />, '/health?member=m46');
    expect(q('family-health')?.getAttribute('data-member-id')).toBe('m46');
    expect(text()).toContain('Opa Budi’s profile and care');
  });
  it('History: a metric, its range, the average, the chart and the readings with their grade', async () => {
    open('f1');
    await show(<FamilyHistory />, '/history?member=m1&metric=bp');
    expect(q('history-summary')?.getAttribute('data-metric')).toBe('bp');
    expect(Number(q('history-summary')?.getAttribute('data-count'))).toBeGreaterThan(10);
    expect(q('history-chart')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="history-reading"]').length).toBeGreaterThan(5);
    expect(text()).toContain('Health history');
    expect(text()).toContain('avg mmHg');
  });
  it('Profile: header, plan, health, care, visits, plan facts, family, documents, consents and notes; Edit and the jump chips', async () => {
    open('f1');
    await show(<FamilyProfile />, '/profile?member=m1&from=health');
    expect(text()).toContain('Oma Lina');
    for (const id of ['pf-plan-card', 'pf-personal', 'pf-care-list', 'pf-visit-tiles', 'pf-month', 'pf-plan', 'pf-family', 'pf-docs', 'pf-consents', 'pf-notes', 'pf-edit', 'pf-jump']) expect(q(id), id).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="pf-jump"] [data-value]')).toHaveLength(8);
    expect(q('pf-docs')?.querySelectorAll('[data-testid="pf-doc"]')).toHaveLength(5); // KTP, carer's KTP, family member's KTP (KC round 10), the signed form, the health photo
    expect(document.querySelectorAll('[data-testid="pf-consent"]')).toHaveLength(2);
    expect(q('pf-notes')?.querySelector('[data-pinned="true"]')).toBeTruthy(); // the pinned note comes first
    expect(q('pf-family')?.querySelector('a[href^="https://wa.me/"]')).toBeTruthy(); // Daniel's WhatsApp link (Maria is the one signed in)
    expect(q('pf-plan')?.textContent).toContain('Rp');
    expect(q('fam-back')?.textContent).toContain('Health');
    expect(q('pf-pending')).toBeNull();
  });
  it('Profile on a laptop: the sections are a vertical list on the left with Edit under it (one Edit, one list, same eight labels)', async () => {
    open('f1');
    await atWidth(1440, async () => {
      await show(<FamilyProfile />, '/profile?member=m1');
      expect(document.querySelectorAll('[data-testid="pf-jump"] button')).toHaveLength(8);
      expect(Array.from(document.querySelectorAll('[data-testid="pf-jump"] button')).map((b) => b.textContent)).toEqual(['Overview', 'Health', 'Care', 'Visits', 'Plan', 'Family', 'Documents', 'Notes']);
      expect(document.querySelectorAll('[data-testid="pf-edit"]')).toHaveLength(1);
      expect(document.querySelectorAll('[data-testid="fam-back"]')).toHaveLength(1);
      expect(q('pf-plan-card')).toBeTruthy();
    });
  });
  it('History on a laptop: the chart side and the readings list are both there', async () => {
    open('f1');
    await atWidth(1440, async () => {
      await show(<FamilyHistory />, '/history?member=m1&metric=bp');
      expect(q('history-chart')).toBeTruthy();
      expect(q('history-list')).toBeTruthy();
      expect(q('history-metrics')).toBeTruthy();
      expect(q('history-range')).toBeTruthy();
    });
  });
  it('Indonesian: no raw keys on the three screens', async () => {
    open('f1', 'id');
    await show(<FamilyHealth />, '/health');
    expect(text()).toContain('Kesehatan');
    expect(text()).not.toMatch(/\b(fhealth|health|profile|family|status)\.[a-zA-Z_]/);
    await act(async () => { root?.unmount(); });
    host?.remove();
    await show(<FamilyHistory />, '/history?member=m1&metric=weight');
    expect(text()).toContain('Riwayat kesehatan');
    expect(text()).not.toMatch(/\b(fhealth|health|profile|family|status)\.[a-zA-Z_]/);
    await act(async () => { root?.unmount(); });
    host?.remove();
    await show(<FamilyProfile />, '/profile?member=m1');
    expect(text()).toContain('Dokumen');
    expect(text()).not.toMatch(/\b(fhealth|health|profile|family|status|members)\.[a-zA-Z_]/);
  });
});
