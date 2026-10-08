// The daily report page (management) against the 5-member seed: the summary line and sections of a past day, a log waiting for approval marked, By member (rows and the
// wide table), moving between days, a closed day, and Indonesian with no raw keys.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSeed } from '@cp/shared';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { DailyReport } from './DailyReport';

let root: Root | null = null;
let host: HTMLElement | null = null;
let width = 0; // jsdom has no layout: the report asks its container how wide it is
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  width = 0;
});

const T = '2026-10-21';
function open(lang: 'en' | 'id' = 'en') {
  const state = buildSeed().citra;
  useSession.setState({ lang, club: 'citra', user: { kind: 'staff', id: 's9', name: 'Ega', role: 'mgmt', clubId: 'citra', clubs: ['citra'] } });
  useReplica.setState({ club: 'citra', userId: 's9', confirmed: state, view: state, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
}
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/report" element={<><Where />{ui}</>} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>); });
}
const text = () => document.body.textContent || '';
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const heads = () => Array.from(document.querySelectorAll('h2')).map((h) => h.textContent);
const tab = (re: RegExp) => Array.from(document.querySelectorAll('[role="tab"]')).find((b) => re.test(b.textContent || ''));
const where = () => document.querySelector('[data-testid="where"]')?.textContent;

describe('the daily report page', () => {
  it('a past day: the date, the one summary line and the sections', async () => {
    open();
    await show(<DailyReport />, '/report?date=2026-10-20');
    expect(document.querySelector('h1')?.textContent).toBe('Daily report');
    expect(text()).toContain('Tuesday 20 October 2026');
    expect(document.querySelector('[data-testid="report-line"]')?.textContent).toMatch(/^4 came · 4 lunches · 8 checks · \d+ photos$/);
    expect(heads()).toEqual(['Who came', 'Activities', 'Lunch and tea', 'Health checks', 'Mood and notes', 'Duties', 'Also this day']); // the last: a new enquiry that day
    // the programme: the second person's log waits for approval, so one person is not marked in each session
    const first = document.querySelector('[data-session="10:30"]')!;
    expect(first.textContent).toContain('Batik painting');
    expect(first.textContent).toContain('3 joined');
    expect(first.textContent).toContain('1 not marked');
    expect(text()).toContain('Rawon'); // the menu
    expect(document.querySelector('[data-testid="report-eaten"]')?.textContent).toContain('All 3');
    expect(text()).toContain('Pending approval'); // the log (and its note) waiting for management, marked
    expect(Array.from(document.querySelectorAll('button')).some((b) => /Show all/.test(b.textContent || ''))).toBe(false); // five members: nothing to fold
  });

  it('By member: one row per member who came; the wide screen gets the table', async () => {
    open();
    await show(<DailyReport />, '/report?date=2026-10-19');
    await click(tab(/By member/));
    expect(where()).toContain('view=members');
    expect(document.querySelectorAll('[data-member]').length).toBe(5);
    expect(text()).toContain('10:08–16:05');
    expect(text()).toContain('Ate all');
    expect(text()).toContain('147/92'); // Hendra’s arrival check (a Watch value)
    expect(text()).not.toContain('Arrival check'); // the table header is for the wide screen only
    await act(async () => { root!.unmount(); });
    host!.remove();
    width = 1200;
    await show(<DailyReport />, '/report?date=2026-10-19&view=members');
    expect(text()).toContain('Arrival check');
    expect(document.querySelectorAll('[data-member]').length).toBe(5);
    await click(document.querySelector('[data-member="m1"]'));
    expect(where()).toBe('/members/m1');
  });

  it('‹ and › move between open days and Today comes back', async () => {
    open();
    await show(<DailyReport />, '/report?date=2026-10-19');
    await click(document.querySelector('[aria-label="Previous open day"]'));
    expect(where()).toBe('/report?date=2026-10-16');
    expect(text()).toContain('Friday 16 October 2026');
    await click(document.querySelector('[aria-label="Next open day"]'));
    expect(where()).toBe('/report?date=2026-10-19');
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Today'));
    expect(where()).toBe('/report');
    expect(text()).toContain('live to 09:58'); // today is live
    expect(document.querySelector('[aria-label="Next open day"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Today')).toBe(false);
  });

  it('a closed day says so and shows no sections', async () => {
    open();
    await show(<DailyReport />, '/report?date=2026-08-17');
    expect(text()).toContain('Independence Day (national holiday)');
    expect(heads()).toEqual([]);
    expect(document.querySelector('[role="tablist"]')).toBeNull();
  });

  it('in Indonesian every label is translated (no raw keys)', async () => {
    open('id');
    await show(<DailyReport />, '/report?date=2026-10-14');
    expect(document.querySelector('h1')?.textContent).toBe('Laporan harian');
    expect(heads().slice(0, 6)).toEqual(['Yang hadir', 'Aktivitas', 'Makan siang dan teh', 'Cek kesehatan', 'Suasana hati dan catatan', 'Tugas rutin']);
    expect(text()).toMatch(/\d+ hadir/);
    expect(text()).toContain('Siaga 1'); // the Alert reading of that day
    expect(text()).not.toMatch(/\breport\.\w+/);
    await click(tab(/Per anggota/));
    expect(text()).not.toMatch(/\breport\.\w+/);
  });
});
