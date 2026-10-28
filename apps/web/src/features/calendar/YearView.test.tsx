// Year view (round 14): twelve month headers, a tap on a day or a month header reports it, the seeded programmed Saturday is outlined.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@cp/shared';
import { closedDaysOfYear, yearView } from '@cp/shared/rules/calendar';
import { useSession } from '../../store/session';
import { YearView } from './YearView';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});
async function show(ui: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}

describe('YearView', () => {
  it('shows 12 month headers, marks the open Saturday, and a tap on a day or a month header reports it', async () => {
    useSession.setState({ lang: 'en' });
    const s = buildSeed().citra;
    const onPickDay = vi.fn();
    const onPickMonth = vi.fn();
    await show(<YearView year={2026} months={yearView(s, 2026, 'staff')} today="2026-10-21" hours={{ open: '08:30', close: '16:30' }} onYear={() => {}} onPickMonth={onPickMonth} onPickDay={onPickDay} />);
    const heads = Array.from(document.querySelectorAll('[data-testid="year-month"]')).map((b) => b.textContent);
    expect(heads).toEqual(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
    expect(document.querySelector('[data-testid="year-label"]')!.textContent).toBe('2026');
    const sat = document.querySelector<HTMLButtonElement>('button[data-date="2026-11-07"]')!;
    expect(sat.dataset.state).toBe('weekendOpen');
    expect(document.querySelector<HTMLButtonElement>('button[data-date="2026-11-14"]')!.dataset.state).toBe('closed');
    await act(async () => { sat.click(); });
    expect(onPickDay).toHaveBeenCalledWith('2026-11-07');
    await act(async () => { document.querySelectorAll<HTMLButtonElement>('[data-testid="year-month"]')[2].click(); });
    expect(onPickMonth).toHaveBeenCalledWith('2026-03');
  });

  it('lists the closed and away days of the year (the seeded closure and outing) and a row opens its first day', async () => {
    useSession.setState({ lang: 'en' });
    const s = buildSeed().citra;
    const onPickDay = vi.fn();
    await show(<YearView year={2026} months={yearView(s, 2026, 'staff')} closed={closedDaysOfYear(s, 2026)} today="2026-10-21" hours={{ open: '08:30', close: '16:30' }} onYear={() => {}} onPickMonth={() => {}} onPickDay={onPickDay} />);
    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="year-closed-row"]'));
    const closure = rows.find((r) => r.dataset.date === '2026-10-30')!;
    const outing = rows.find((r) => r.dataset.date === '2026-10-29')!;
    expect(closure.dataset.kind).toBe('closed');
    expect(closure.textContent).toContain('staff first-aid training');
    expect(closure.textContent).toContain('Club closed');
    expect(outing.dataset.kind).toBe('outing');
    expect(outing.textContent).toContain('Outing');
    expect(rows.map((r) => r.dataset.date)).toEqual([...rows.map((r) => r.dataset.date)].sort());
    await act(async () => { closure.click(); });
    expect(onPickDay).toHaveBeenCalledWith('2026-10-30');
  });

  it('round 15 follow-up: a closed or outing day is circled (data-closed), and the list is grouped under month headers with a date block, a kind dot and the length', async () => {
    useSession.setState({ lang: 'en' });
    const s = buildSeed().citra;
    await show(<YearView year={2026} months={yearView(s, 2026, 'staff')} closed={closedDaysOfYear(s, 2026)} today="2026-10-21" hours={{ open: '08:30', close: '16:30' }} onYear={() => {}} onPickMonth={() => {}} onPickDay={() => {}} />);
    const cell = (d: string) => document.querySelector<HTMLButtonElement>(`button[data-testid="year-day"][data-date="${d}"]`)!;
    expect(cell('2026-10-30').dataset.closed).toBe('closed'); // the seeded closure
    expect(cell('2026-10-29').dataset.closed).toBe('outing'); // the seeded outing
    expect(cell('2026-10-28').dataset.closed).toBeUndefined(); // an ordinary open day has no circle
    const list = document.querySelector('[data-testid="year-closed"]')!;
    const heads = Array.from(list.querySelectorAll('[data-testid="year-closed-month"]')).map((h) => h.textContent);
    expect(heads).toContain('October');
    expect([...heads].sort()).toEqual(heads.slice().sort()); // one header per month
    expect(new Set(heads).size).toBe(heads.length);
    const closure = list.querySelector('[data-testid="year-closed-row"][data-date="2026-10-30"]')!;
    expect(closure.querySelector('[data-testid="year-closed-date"]')!.textContent).toContain('30');
    expect(closure.querySelector('svg, .material-symbols-rounded')).toBeNull(); // no icon in a row
    expect(closure.textContent).toContain('Club closed');
    expect(legendText()).toContain('Closed');
    expect(legendText()).toContain('Outing');
  });
  it('round 15 follow-up: a two-day closure reads "14–15" and "2 days" on its row', async () => {
    useSession.setState({ lang: 'en' });
    const s = buildSeed().citra;
    await show(<YearView year={2026} months={yearView(s, 2026, 'staff')} closed={[{ from: '2026-05-14', to: '2026-05-15', kind: 'holiday', title: 'Ascension', days: 2 }]} today="2026-10-21" hours={{ open: '08:30', close: '16:30' }} onYear={() => {}} onPickMonth={() => {}} onPickDay={() => {}} />);
    const row = document.querySelector('[data-testid="year-closed-row"]')!;
    expect(row.querySelector('[data-testid="year-closed-date"]')!.textContent).toContain('14–15');
    expect(row.textContent).toContain('2 days');
    expect(document.querySelector('[data-testid="year-closed-month"]')!.textContent).toBe('May');
    expect(document.querySelector<HTMLButtonElement>('button[data-testid="year-day"][data-date="2026-05-15"]')!.dataset.closed).toBe('holiday');
  });
});
const legendText = () => document.querySelector('[data-testid="year-legend"]')?.textContent ?? '';
