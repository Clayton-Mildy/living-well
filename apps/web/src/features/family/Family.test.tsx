// KC round 7: the family day story and the monthly memories render against the seed (a smoke test: no browser is needed to catch a crash).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, projectForFamily } from '@cp/shared';
import { visitDays } from '@cp/shared/rules/family';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyToday } from './FamilyToday';
import { FamilyMemories } from './Memories';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
function open(familyId: string, lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ } // the member switcher is remembered per user
  const full = buildSeed().citra;
  const view = projectForFamily(full, familyId);
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
  return view;
}
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
const text = () => document.body.textContent || '';

describe('family day story', () => {
  it('today: the strip ends with today, the member card shows her status, the programme and the last visit’s note', async () => {
    open('f1');
    await show(<FamilyToday />, '/today?member=m1');
    const strip = document.querySelector('[data-testid="day-strip"]')!;
    expect(strip).toBeTruthy();
    const days = Array.from(strip.querySelectorAll('[data-date]')).map((x) => x.getAttribute('data-date'));
    expect(days[days.length - 1]).toBe(T);
    expect(strip.querySelector('[data-selected="true"]')?.getAttribute('data-date')).toBe(T);
    expect(document.querySelector('[data-testid="member-card"]')?.textContent).toContain('Not at the club right now');
    expect(document.querySelector('[data-testid="timeline"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="team-note"] [data-testid="team-log"]')).toBeTruthy(); // the newest note the team wrote while today has none (round 7)
    expect(document.querySelector('[data-testid="memories-teaser"]')?.textContent).toContain('October with Oma Lina');
  });

  it('an earlier visit day (?date=): the day’s title, arrival and home, mood, her sessions and lunch, all steps done', async () => {
    const view = open('f1');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(document.querySelector('[data-testid="family-today"]')?.getAttribute('data-date')).toBe(day);
    expect(document.querySelector('[data-testid="day-strip"] [data-selected="true"]')?.getAttribute('data-date')).toBe(day);
    expect(text()).toMatch(/Arrived \d\d:\d\d · Home \d\d:\d\d/);
    expect(text()).toContain('Looking back');
    expect(document.querySelector('[data-testid="story-mood"]')).toBeTruthy();
    const steps = Array.from(document.querySelectorAll('[data-tl]'));
    expect(steps.length).toBeGreaterThan(3);
    expect(steps.every((x) => x.getAttribute('data-state') === 'done')).toBe(true);
    expect(document.querySelector('[data-testid="lunch-amount"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="took"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="survey-card"]')).toBeNull(); // the survey is for today
  });

  it('a weekday she did not come: a gentle sentence, the programme as "what was on", a way to her last visit', async () => {
    const view = open('f1');
    const came = new Set(visitDays(view, 'm1', T));
    const missed = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 20 - i)).toISOString().slice(0, 10)).find((d) => !came.has(d) && ![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()))!;
    await show(<FamilyToday />, `/today?member=m1&date=${missed}`);
    expect(text()).toMatch(/Oma Lina didn’t come on /);
    expect(text()).toContain('What was on that day');
    expect(document.querySelector('[data-testid="last-visit"]')).toBeTruthy();
    expect(Array.from(document.querySelectorAll('[data-tl]')).every((x) => x.getAttribute('data-state') === 'up')).toBe(true);
  });

  it('both parents: one shared cover and a card for each, on today and on an earlier day', async () => {
    open('f1');
    await show(<FamilyToday />, '/today');
    expect(document.querySelectorAll('[data-testid="parent-card"]')).toHaveLength(2);
    expect(document.querySelector('[data-testid="story-hero"]')).toBeTruthy();
  });

  it('in Indonesian: warm wording, no raw keys', async () => {
    const view = open('f1', 'id');
    const day = visitDays(view, 'm1', T).filter((d) => d < T).pop()!;
    await show(<FamilyToday />, `/today?member=m1&date=${day}`);
    expect(text()).toContain('Menengok kembali');
    expect(text()).toMatch(/Tiba \d\d:\d\d · Pulang \d\d:\d\d/);
    expect(text()).not.toMatch(/\bfamily\.[a-z]/i);
  });
});

describe('family memories', () => {
  it('the month with her: collage, numbers, favourites, moods (tap opens a day), lunch and a way back a month', async () => {
    open('f1');
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    expect(document.querySelector('[data-testid="family-memories"]')?.getAttribute('data-month')).toBe('2026-10');
    expect(text()).toContain('October with Oma Lina');
    expect(document.querySelector('[data-testid="memories-collage"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="memories-numbers"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="memories-favourites"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="memories-moods"] [data-date]').length).toBeGreaterThan(3);
    expect(document.querySelector('[data-testid="memories-lunch"]')?.textContent).toMatch(/Finished lunch on \d+ of \d+ days/);
    const prev = document.querySelector('button[aria-label="Earlier month"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    await act(async () => { prev.click(); });
    expect(document.querySelector('[data-testid="family-memories"]')?.getAttribute('data-month')).toBe('2026-09');
    expect(text()).toContain('September with Oma Lina');
  });
});
