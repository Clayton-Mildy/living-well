// TrendChart in jsdom: hover and tap show the date and the value, the arrow keys step through the points, Escape and leaving put it away.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { useState } from 'react';
import { TrendChart, TrendRangeControl, rangeValue, windowOf, type TrendSeries } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove(); root = null; host = null;
  document.body.innerHTML = '';
});
async function show(ui: ReactElement, lang: 'en' | 'id' = 'en') {
  useSession.setState({ lang });
  useReplica.setState({ clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const chart = () => document.querySelector<HTMLElement>('[role="group"]')!;
const tip = () => document.querySelector<HTMLElement>('[data-testid="trend-tip"]');
const live = () => document.querySelector<HTMLElement>('[aria-live="polite"]')!.textContent;
// React derives onPointerLeave from pointerout (to nowhere), so leaving is dispatched as that
const pointer = async (type: string, x: number, pointerType = 'mouse') => {
  const native = type === 'pointerleave' ? 'pointerout' : type;
  await act(async () => { chart().dispatchEvent(new PointerEvent(native, { bubbles: true, clientX: x, clientY: 20, pointerType, relatedTarget: null, buttons: native === 'pointermove' && pointerType !== 'mouse' ? 1 : 0 })); });
};
const key = async (k: string) => { await act(async () => { chart().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }); };

const sys: TrendSeries = { key: 'a', label: 'Arrival', points: [
  { date: '2026-10-01', time: '09:10', value: 128, status: 'normal', text: '128/80 mmHg' },
  { date: '2026-10-14', time: '09:12', value: 164, status: 'alert', text: '164/98 mmHg', note: 'Dizzy on arrival' },
  { date: '2026-10-20', time: '09:30', value: 134, status: 'watch', text: '134/82 mmHg' },
] };
const dep: TrendSeries = { key: 'd', label: 'Departure', dashed: true, tone: 'muted', points: [{ date: '2026-10-14', time: '15:40', value: 150, status: 'watch', text: '150/90 mmHg' }] };
const props = { from: '2026-10-01', to: '2026-10-21', unit: 'mmHg', ariaLabel: 'Trend of Blood pressure', band: { from: 100, to: 139 } };

describe('TrendChart', () => {
  it('draws one svg with the axis, and shows nothing until it is touched', async () => {
    await show(<TrendChart series={[sys]} {...props} />);
    expect(document.querySelectorAll('svg')).toHaveLength(1);
    expect(chart().getAttribute('aria-label')).toBe('Trend of Blood pressure');
    expect(tip()).toBeNull();
    expect(live()).toBe('');
    expect(document.querySelector('svg')!.textContent).toContain('1 Oct'); // first date label (a short axis)
  });
  it('hover snaps to the nearest reading and the card tells the date, time, value and grade; leaving puts it away', async () => {
    await show(<TrendChart series={[sys, dep]} {...props} legend />);
    await pointer('pointermove', 9999);
    expect(tip()!.textContent).toContain('Tue 20 Oct 2026 · 09:30');
    expect(tip()!.textContent).toContain('134/82 mmHg');
    expect(tip()!.textContent).toContain('Watch');
    await pointer('pointermove', 0);
    expect(tip()!.textContent).toContain('Thu 1 Oct 2026 · 09:10');
    expect(tip()!.textContent).toContain('Normal');
    await pointer('pointerleave', 0);
    expect(tip()).toBeNull();
  });
  it('two readings on one day: the card shows both, each with its own time and the nurse’s note', async () => {
    await show(<TrendChart series={[sys, dep]} {...props} describe={(d) => (d === '2026-10-14' ? 'Came by taxi' : undefined)} />);
    const before = document.querySelectorAll('circle').length;
    // the 14th at 09:12 is the second target; step there with the keys
    await act(async () => { chart().focus(); });
    await key('ArrowLeft'); // the last reading
    await key('ArrowLeft'); // the departure check of the 14th
    expect(tip()!.textContent).toContain('Wed 14 Oct 2026 · 15:40');
    expect(tip()!.textContent).toContain('Arrival 09:12');
    expect(tip()!.textContent).toContain('164/98 mmHg');
    expect(tip()!.textContent).toContain('Alert');
    expect(tip()!.textContent).toContain('150/90 mmHg');
    expect(tip()!.textContent).toContain('Dizzy on arrival');
    expect(tip()!.textContent).toContain('Came by taxi');
    expect(document.querySelectorAll('circle').length).toBeGreaterThan(before); // the highlighted dots
  });
  it('the keyboard steps with the arrows, Home and End, and Escape hides; the text is read out in a live region', async () => {
    await show(<TrendChart series={[sys]} {...props} />);
    await act(async () => { chart().focus(); });
    expect(chart().tabIndex).toBe(0);
    await key('ArrowRight');
    expect(live()).toContain('Tue 20 Oct 2026 · 09:30');
    expect(live()).toContain('134/82 mmHg');
    await key('ArrowLeft');
    expect(live()).toContain('Wed 14 Oct 2026 · 09:12');
    await key('ArrowLeft');
    await key('ArrowLeft'); // stays on the first
    expect(live()).toContain('Thu 1 Oct 2026');
    await key('End');
    expect(live()).toContain('20 Oct');
    await key('Home');
    expect(live()).toContain('1 Oct');
    await key('Escape');
    expect(tip()).toBeNull();
    expect(live()).toBe('');
  });
  it('a tap or drag with a finger shows the card and stays until a tap outside', async () => {
    await show(<TrendChart series={[sys]} {...props} />);
    await pointer('pointerdown', 9999, 'touch');
    expect(tip()!.textContent).toContain('20 Oct');
    await pointer('pointermove', 0, 'touch');
    expect(tip()!.textContent).toContain('1 Oct');
    await pointer('pointerleave', 0, 'touch'); // lifting the finger does not hide it
    expect(tip()).not.toBeNull();
    await act(async () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(tip()).toBeNull();
  });
  it('keeps the card inside the chart, and speaks the reader’s language', async () => {
    await show(<TrendChart series={[sys]} {...props} />, 'id');
    await pointer('pointermove', 9999);
    expect(tip()!.textContent).toContain('Sel 20 Okt 2026');
    expect(tip()!.textContent).toContain('Pantau');
    expect(parseFloat(tip()!.style.left)).toBeGreaterThanOrEqual(2);
  });
  it('the compact chart has no card: its readout is a line under the chart, which shows the caption until touched', async () => {
    await show(<TrendChart compact height={44} series={[sys]} {...props} caption="Systolic, last 4 weeks" />);
    expect(document.body.textContent).toContain('Systolic, last 4 weeks');
    await pointer('pointermove', 9999);
    expect(tip()).toBeNull();
    expect(document.body.textContent).toContain('Tue 20 Oct');
    expect(document.body.textContent).toContain('134/82 mmHg');
    expect(document.body.textContent).not.toContain('Systolic, last 4 weeks');
  });
  it('bars: a count per day; empty ranges show the empty text', async () => {
    const bars: TrendSeries = { key: 'n', label: 'Visits', points: [{ date: '2026-10-05', value: 12 }, { date: '2026-10-06', value: 18 }] };
    await show(<TrendChart kind="bars" series={[bars]} from="2026-10-01" to="2026-10-10" ariaLabel="Visits per day" />);
    expect(document.querySelectorAll('svg rect').length).toBeGreaterThanOrEqual(2);
    await pointer('pointermove', 9999);
    expect(tip()!.textContent).toContain('Tue 6 Oct 2026');
    expect(tip()!.textContent).toContain('18');
    await act(async () => { root!.render(<TrendChart series={[bars]} from="2026-09-01" to="2026-09-10" ariaLabel="Visits per day" empty="Nothing here" />); });
    expect(document.body.textContent).toContain('Nothing here');
    expect(document.querySelectorAll('svg')).toHaveLength(0);
  });
});

describe('TrendRangeControl', () => {
  function Host({ seen }: { seen: { from: string; to: string }[] }) {
    const [v, setV] = useState(() => rangeValue('3m'));
    seen.push(windowOf(v, '2026-10-21', '2026-04-22'));
    return <TrendRangeControl value={v} onChange={setV} today="2026-10-21" firstDate="2026-04-22" />;
  }
  const tab = (name: string) => [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => b.textContent === name)!;
  it('1W / 1M / 3M / 6M / All and Custom; Custom opens From and To holding the range that was showing, and All closes them again', async () => {
    const seen: { from: string; to: string }[] = [];
    await show(<Host seen={seen} />);
    expect([...document.querySelectorAll('[role="tab"]')].map((b) => b.textContent)).toEqual(['1W', '1M', '3M', '6M', 'All', 'Custom']);
    expect(document.querySelector('[data-testid="range-custom"]')).toBeNull();
    await act(async () => { tab('Custom').click(); });
    const row = document.querySelector<HTMLElement>('[data-testid="range-custom"]')!;
    expect([...row.querySelectorAll('button')].map((b) => b.textContent!.replace('expand_more', ''))).toEqual(['23 Jul 2026', '21 Oct 2026']); // the 3M range, no weekday
    expect(row.textContent).toContain('From');
    expect(row.textContent).toContain('To');
    expect(seen[seen.length - 1]).toEqual({ from: '2026-07-23', to: '2026-10-21' });
    await act(async () => { tab('All').click(); });
    expect(document.querySelector('[data-testid="range-custom"]')).toBeNull();
    expect(seen[seen.length - 1]).toEqual({ from: '2026-04-22', to: '2026-10-21' });
  });
  it('speaks Indonesian', async () => {
    await show(<Host seen={[]} />, 'id');
    expect([...document.querySelectorAll('[role="tab"]')].map((b) => b.textContent)).toEqual(['1Mg', '1B', '3B', '6B', 'Semua', 'Kustom']);
    await act(async () => { tab('Kustom').click(); });
    expect(document.querySelector('[data-testid="range-custom"]')!.textContent).toContain('Dari');
    expect(document.querySelector('[data-testid="range-custom"]')!.textContent).toContain('Sampai');
  });
});
