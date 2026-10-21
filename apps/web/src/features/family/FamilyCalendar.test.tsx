// Round 8b: the family Calendar's header (the title is always "Calendar", the period is its own ‹ › row) and its laptop layout (the week as five rows).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { buildSeed, projectForFamily } from '@cp/shared';
import { visitDays } from '@cp/shared/rules/family';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyCalendar } from './FamilyCalendar';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
// the family pages switch to their desktop layout from 1024px (jsdom's default width): the phone / tablet tests run at 800
beforeEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 800; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

const T = '2026-10-21';
function open(lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
  const view = projectForFamily(buildSeed().citra, 'f1');
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: 'f1', name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: 'f1', confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
}
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>); });
}
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const click = async (id: string) => { await act(async () => { (q(id) as HTMLElement).click(); }); };

describe('family calendar header', () => {
  it('the title is "Calendar" in both views; Month names the period in its own row, and "This month" appears only away from this month', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar?view=month');
    expect(document.querySelector('h1')?.textContent).toBe('Calendar');
    expect(q('cal-month-label')?.textContent).toBe('October 2026');
    expect(q('cal-this-month')).toBeNull();
    await click('cal-next-month');
    expect(document.querySelector('h1')?.textContent).toBe('Calendar');
    expect(q('cal-month-label')?.textContent).toBe('November 2026');
    expect(q('cal-this-month')?.textContent).toBe('This month');
    await click('cal-this-month');
    expect(q('cal-month-label')?.textContent).toBe('October 2026');
    expect(q('cal-this-month')).toBeNull();
  });
  it('List: the week is the period, "This week" is the way back, Indonesian has no raw keys', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar');
    expect(document.querySelector('h1')?.textContent).toBe('Calendar');
    expect(q('cal-week')?.textContent).toBe('19 – 23 Oct');
    expect(q('cal-this-week')).toBeNull();
    await click('cal-next-week');
    expect(q('cal-week')?.textContent).toBe('26 – 30 Oct');
    expect(q('cal-this-week')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="cal-day"]')).toHaveLength(5);
    await act(async () => { root?.unmount(); });
    host?.remove();
    open('id');
    await show(<FamilyCalendar />, '/calendar');
    expect(document.querySelector('h1')?.textContent).toBe('Kalender');
    expect(document.body.textContent).not.toMatch(/\b(fcal|cal|nav)\.[a-zA-Z_]/);
  });
  it('on a laptop the week is five rows with the same testids', async () => {
    open();
    const was = window.innerWidth;
    (window as unknown as { innerWidth: number }).innerWidth = 1440;
    try {
      await show(<FamilyCalendar />, '/calendar');
      const days = document.querySelectorAll('[data-testid="cal-day"]');
      expect(days).toHaveLength(5);
      expect(Array.from(days).map((d) => d.getAttribute('data-date'))).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
      expect(days[2].getAttribute('aria-pressed')).toBe('true'); // today is the selected day
      expect(q('cal-agenda')?.getAttribute('data-date')).toBe(T);
    } finally { (window as unknown as { innerWidth: number }).innerWidth = was; }
  });
});

describe('round 11: the parent switch and who came', () => {
  const view = () => useReplica.getState().view!;
  const tile = (d: string) => document.querySelector(`[data-testid="cal-day"][data-date="${d}"]`) as HTMLElement;
  it('List: with both parents a day says who came; one parent chosen shows their visits alone and their name under the title', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar');
    expect(q('parent-switch')?.getAttribute('data-tone')).toBe('page');
    expect(q('title-who')).toBeNull();
    const lina = visitDays(view(), 'm1', T), budi = visitDays(view(), 'm46', T);
    for (const d of ['2026-10-19', '2026-10-20', '2026-10-21']) {
      const came = [lina.includes(d) ? 'm1' : '', budi.includes(d) ? 'm46' : ''].filter(Boolean).join(',');
      expect(tile(d).getAttribute('data-came') ?? '').toBe(came);
      if (came) expect(tile(d).getAttribute('aria-label')).toMatch(/came to the club/);
    }
    await act(async () => { (document.querySelector('button[data-member="m46"]') as HTMLElement).click(); });
    expect(q('title-who')?.textContent).toBe('Opa Budi Wijaya');
    for (const d of ['2026-10-19', '2026-10-20', '2026-10-21']) {
      expect(tile(d).getAttribute('data-came')).toBeNull(); // one parent: the bronze dot, no faces
      expect(tile(d).getAttribute('data-visited')).toBe(budi.includes(d) ? 'true' : null);
    }
  });
  it('Month: cells carry who came, and the switch narrows them', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar?view=month');
    const lina = visitDays(view(), 'm1', T);
    const both = Array.from(document.querySelectorAll('[data-testid="cal-cell"][data-came]'));
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((c) => (c.getAttribute('data-came') || '').split(',').every((id) => ['m1', 'm46'].includes(id)))).toBe(true);
    await act(async () => { (document.querySelector('button[data-member="m1"]') as HTMLElement).click(); });
    const visited = Array.from(document.querySelectorAll('[data-testid="cal-cell"][data-visited="1"]')).map((c) => c.getAttribute('data-date'));
    expect(visited.length).toBeGreaterThan(0);
    expect(visited.every((d) => lina.includes(d!))).toBe(true);
  });
});

describe('the selected day keeps its own look (round 8d)', () => {
  const cell = (d: string) => document.querySelector(`[data-testid="cal-cell"][data-date="${d}"]`) as HTMLElement;
  const ring = (el: Element) => /4\.5px/.test((el as HTMLElement).style.boxShadow);
  const view = () => useReplica.getState().view!;

  it('Month: a selected photo day still shows its photo and gets a ring; nothing else is ringed; the number sits in an ink circle', async () => {
    open();
    const photoDay = visitDays(view(), 'm1', T).filter((d) => d < T).pop()!;
    await show(<FamilyCalendar />, `/calendar?view=month&date=${photoDay}`);
    const c = cell(photoDay);
    expect(c.getAttribute('aria-pressed')).toBe('true');
    expect(c.getAttribute('data-photo')).toBe('1'); // the photo is not hidden by the selection
    expect(c.querySelector('img, [style*="background-image"]') || c.querySelector('span[aria-hidden="true"]')).toBeTruthy();
    expect(ring(c)).toBe(true);
    expect(c.style.zIndex).toBe('1');
    expect(c.style.background).not.toMatch(/43, 35, 28|2b231c/i); // the cell itself is not ink
    expect(Array.from(document.querySelectorAll('[data-testid="cal-cell"]')).filter(ring)).toHaveLength(1);
    const num = Array.from(c.querySelectorAll('span')).find((x) => x.textContent === String(Number(photoDay.slice(8))))!;
    expect(num.style.background).toMatch(/43, 35, 28|2b231c/i);
  });

  it('Month: a selected plain day stays white, a selected closed day stays ochre, and today is marked apart from the selection', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar?view=month&date=2026-10-23');
    expect(cell('2026-10-23').style.background).toMatch(/255, 255, 255|#fff/i);
    expect(ring(cell('2026-10-23'))).toBe(true);
    // today: its number is in a bronze circle, no ring while another day is selected
    expect(cell(T).getAttribute('data-today')).toBe('1');
    expect(ring(cell(T))).toBe(false);
    const todayNum = Array.from(cell(T).querySelectorAll('span')).find((x) => x.textContent === '21')!;
    expect(todayNum.style.background).toMatch(/117, 98, 75|75624b/i);
    await act(async () => { root?.unmount(); });
    host?.remove();
    open();
    await show(<FamilyCalendar />, '/calendar?view=month&date=2026-10-30'); // the club is closed that day
    const closed = cell('2026-10-30');
    expect(closed.getAttribute('data-state')).toMatch(/closed|holiday/);
    expect(closed.style.background).toMatch(/246, 236, 214|f6ecd6/i);
    expect(ring(closed)).toBe(true);
    await act(async () => { root?.unmount(); });
    host?.remove();
    open();
    await show(<FamilyCalendar />, `/calendar?view=month&date=${T}`); // selected and today: the ring and the bronze number together
    expect(ring(cell(T))).toBe(true);
    expect(cell(T).getAttribute('data-today')).toBe('1');
    expect(cell(T).getAttribute('aria-current')).toBe('date');
  });

  it('List: the week tile keeps its grey, gets the ring and an ink number circle; today’s weekday reads "Today"', async () => {
    open();
    await show(<FamilyCalendar />, '/calendar?date=2026-10-30');
    const tile = document.querySelector('[data-testid="cal-day"][data-date="2026-10-30"]') as HTMLElement;
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(ring(tile)).toBe(true);
    expect(tile.style.background).toMatch(/246, 236, 214|f6ecd6/i); // closed: ochre stays
    expect(document.querySelectorAll('[data-testid="cal-day"]')).toHaveLength(5);
    expect(Array.from(document.querySelectorAll('[data-testid="cal-day"]')).filter(ring)).toHaveLength(1);
    await act(async () => { root?.unmount(); });
    host?.remove();
    open();
    await show(<FamilyCalendar />, `/calendar?date=${T}`);
    const today = document.querySelector(`[data-testid="cal-day"][data-date="${T}"]`) as HTMLElement;
    expect(today.textContent).toContain('Today');
    expect(ring(today)).toBe(true); // selected today shows both
  });

  it('on a laptop the week rows do the same, and the title carries the club’s opening hours above it', async () => {
    open();
    const was = window.innerWidth;
    (window as unknown as { innerWidth: number }).innerWidth = 1440;
    try {
      await show(<FamilyCalendar />, '/calendar?date=2026-10-30');
      const row = document.querySelector('[data-testid="cal-day"][data-date="2026-10-30"]') as HTMLElement;
      expect(ring(row)).toBe(true);
      expect(row.style.background).toMatch(/246, 236, 214|f6ecd6/i);
      expect(document.querySelector('h1')?.textContent).toBe('Calendar');
      expect(document.body.textContent).toMatch(/Open Monday to Friday · \d\d:\d\d–\d\d:\d\d/);
    } finally { (window as unknown as { innerWidth: number }).innerWidth = was; }
  });
});
