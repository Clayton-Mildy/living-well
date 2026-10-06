// The kit rendered in jsdom: open, pick with the mouse and the keyboard, paging. Wide layout (jsdom is 1024px wide), English.
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { DateField, MonthField, Pager, Select, TimeField, usePaged } from './index';

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => { (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove(); root = null; host = null;
  document.body.innerHTML = '';
});
async function show(ui: ReactElement) {
  useSession.setState({ lang: 'en' });
  useReplica.setState({ clock: { today: '2026-10-21', startMin: 598, realStart: Date.now(), offset: 0 } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
}
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const qa = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
const click = async (el: Element | null) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const key = async (el: Element | null, k: string, init: KeyboardEventInit = {}) => { await act(async () => { el!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); }); };
const option = (name: string) => qa('[role="option"]').find((o) => o.getAttribute('aria-label') === name || o.textContent === name) || null;

const METHODS = [{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank transfer', hint: 'Manual' }, { value: 'card', label: 'Card' }] as const;
function SelectDemo({ onChange, initial = '' }: { onChange?: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return <Select label="Method" value={v} onChange={(x) => { setV(x); onChange?.(x); }} options={[...METHODS]} placeholder="Pick one" />;
}

describe('Select', () => {
  it('is a labelled combobox that opens a listbox and picks with the mouse', async () => {
    const seen = vi.fn();
    await show(<SelectDemo onChange={seen} />);
    const cb = q('[role="combobox"]')!;
    expect(cb.getAttribute('aria-expanded')).toBe('false');
    expect(cb.textContent).toContain('Pick one');
    expect(document.querySelector('label')!.getAttribute('for')).toBe(cb.id);
    expect(cb.getAttribute('aria-labelledby')).toBe(document.querySelector('label')!.id);
    await click(cb);
    expect(cb.getAttribute('aria-expanded')).toBe('true');
    expect(qa('[role="listbox"] [role="option"]')).toHaveLength(3);
    expect(option('Bank transfer')!.getAttribute('aria-describedby')).toBeTruthy();
    await click(option('Bank transfer'));
    expect(seen).toHaveBeenCalledWith('bank');
    expect(q('[role="listbox"]')).toBeNull();
    expect(cb.textContent).toContain('Bank transfer');
  });
  it('works with the keyboard: arrows move, Enter picks, Escape closes without picking', async () => {
    const seen = vi.fn();
    await show(<SelectDemo onChange={seen} />);
    const cb = q('[role="combobox"]')!;
    await key(cb, 'ArrowDown');
    const list = q('[role="listbox"]')!;
    expect(list).toBeTruthy();
    expect(document.activeElement).toBe(list);
    await key(list, 'ArrowDown');
    await key(list, 'ArrowDown');
    expect(list.getAttribute('aria-activedescendant')).toBe(option('Card')!.id);
    await key(list, 'ArrowUp');
    await key(list, 'Enter');
    expect(seen).toHaveBeenCalledWith('bank');
    await key(cb, 'ArrowDown');
    await key(q('[role="listbox"]'), 'Escape');
    expect(q('[role="listbox"]')).toBeNull();
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it('marks the current value selected and starts on it', async () => {
    await show(<SelectDemo initial="card" />);
    await click(q('[role="combobox"]'));
    expect(option('Card')!.getAttribute('aria-selected')).toBe('true');
    expect(option('Cash')!.getAttribute('aria-selected')).toBe('false');
    expect(q('[role="listbox"]')!.getAttribute('aria-activedescendant')).toBe(option('Card')!.id);
  });
  it('shows a search box for long lists and filters ignoring case and accents', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: i === 3 ? 'Café Rina' : `Person ${i}` }));
    await show(<Select label="Who" value="" onChange={() => {}} options={many} />);
    await click(q('[role="combobox"]'));
    const search = q<HTMLInputElement>('input[type="search"]')!;
    expect(search).toBeTruthy();
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(search, 'cafe');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(qa('[role="option"]').map((o) => o.textContent)).toEqual(['Café Rina']);
  });
  it('shows no search box for a short list, and an error with role alert', async () => {
    await show(<Select label="Method" value="" onChange={() => {}} options={[...METHODS]} error="Pick a method" />);
    expect(q('[role="combobox"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(q('[role="alert"]')!.textContent).toContain('Pick a method');
    await click(q('[role="combobox"]'));
    expect(q('input[type="search"]')).toBeNull();
  });
  it('does not open when disabled', async () => {
    await show(<Select label="Method" value="" onChange={() => {}} options={[...METHODS]} disabled />);
    await click(q('[role="combobox"]'));
    expect(q('[role="listbox"]')).toBeNull();
  });
});

function DateDemo({ initial = '', ...rest }: { initial?: string; min?: string; max?: string; onChange?: (v: string) => void; disabledDate?: (d: string) => boolean }) {
  const [v, setV] = useState(initial);
  return <DateField label="Date" value={v} onChange={(x) => { setV(x); rest.onChange?.(x); }} min={rest.min} max={rest.max} disabledDate={rest.disabledDate} />;
}
const day = (d: string) => q(`[data-date="${d}"]`);

describe('DateField', () => {
  it('shows the chosen date, opens on its month and picks a day', async () => {
    const seen = vi.fn();
    await show(<DateDemo initial="2026-10-14" onChange={seen} />);
    const trigger = document.getElementById(document.querySelector('label')!.getAttribute('for')!)!;
    expect(trigger.textContent).toContain('Wed 14 Oct 2026');
    await click(trigger);
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-10');
    expect(qa('[role="grid"] [data-date]')).toHaveLength(31);
    expect(day('2026-10-14')!.getAttribute('aria-label')).toBe('Wednesday 14 October 2026');
    expect(day('2026-10-14')!.closest('[role="gridcell"]')!.getAttribute('aria-selected')).toBe('true');
    expect(day('2026-10-21')!.getAttribute('aria-current')).toBe('date'); // the demo clock's today
    await click(day('2026-10-27'));
    expect(seen).toHaveBeenCalledWith('2026-10-27');
    expect(q('[role="grid"]')).toBeNull();
    expect(trigger.textContent).toContain('Tue 27 Oct 2026');
  });
  it('goes to the previous and next month, and Today picks the demo clock day', async () => {
    const seen = vi.fn();
    await show(<DateDemo initial="2026-10-14" onChange={seen} />);
    await click(q('[aria-haspopup="dialog"]'));
    await click(q('[aria-label="Next month"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-11');
    await click(q('[aria-label="Previous month"]'));
    await click(q('[aria-label="Previous month"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-09');
    const todayBtn = qa('button').find((b) => b.textContent === 'Today')!;
    await click(todayBtn);
    expect(seen).toHaveBeenCalledWith('2026-10-21');
  });
  it('greys out days outside min/max and the ones the caller disables, and ignores clicks on them', async () => {
    const seen = vi.fn();
    await show(<DateDemo initial="2026-10-14" min="2026-10-10" max="2026-10-25" disabledDate={(d) => d === '2026-10-20'} onChange={seen} />);
    await click(q('[aria-haspopup="dialog"]'));
    for (const d of ['2026-10-09', '2026-10-26', '2026-10-20']) expect(day(d)!.getAttribute('aria-disabled')).toBe('true');
    expect(day('2026-10-10')!.getAttribute('aria-disabled')).toBeNull();
    expect(day('2026-10-25')!.getAttribute('aria-disabled')).toBeNull();
    await click(day('2026-10-20'));
    await click(day('2026-10-26'));
    expect(seen).not.toHaveBeenCalled();
    expect(q('[role="grid"]')).toBeTruthy(); // still open
    expect(q('[aria-label="Next month"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(q('[aria-label="Previous month"]')!.getAttribute('aria-disabled')).toBe('true');
  });
  it('moves the day with the arrow keys and picks it with Enter (a click on the focused button)', async () => {
    const seen = vi.fn();
    await show(<DateDemo initial="2026-10-14" onChange={seen} />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(document.activeElement).toBe(day('2026-10-14'));
    await key(document.activeElement, 'ArrowRight');
    expect(document.activeElement).toBe(day('2026-10-15'));
    await key(document.activeElement, 'ArrowDown');
    expect(document.activeElement).toBe(day('2026-10-22'));
    await key(document.activeElement, 'PageDown');
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-11');
    expect(document.activeElement).toBe(day('2026-11-22'));
    await key(document.activeElement, 'Escape');
    expect(q('[role="grid"]')).toBeNull();
    expect(seen).not.toHaveBeenCalled();
  });
  it('jumps decades through the month and year pickers (for birth dates)', async () => {
    const seen = vi.fn();
    await show(<DateDemo initial="" onChange={seen} />);
    await click(q('[aria-haspopup="dialog"]'));
    await click(q('[data-cal-title]')); // month picker
    await click(q('[data-cal-title]')); // year picker
    for (let i = 0; i < 5; i++) await click(q('[aria-label="Earlier years"]'));
    await click(q('[aria-label="1960"]'));
    await click(q('[aria-label="March 1960"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('1960-03');
    await click(day('1960-03-09'));
    expect(seen).toHaveBeenCalledWith('1960-03-09');
  });
  it('opens an empty field on startAt (a date of birth), and a chosen value wins over it', async () => {
    const seen = vi.fn();
    await show(<DateField label="Born" value="" onChange={seen} startAt="1950-06-15" max="2026-10-21" />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('1950-06');
    expect(document.activeElement).toBe(day('1950-06-15'));
    await click(day('1950-06-20'));
    expect(seen).toHaveBeenCalledWith('1950-06-20');
  });
  it('startAt does not apply once there is a value, is kept inside min/max, and an invalid one falls back to today', async () => {
    await show(<DateField label="Born" value="2001-02-03" onChange={() => {}} startAt="1950-06-15" />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2001-02');
    await act(async () => { root!.unmount(); }); host!.remove(); document.body.innerHTML = '';
    await show(<DateField label="Due" value="" onChange={() => {}} startAt="1950-06-15" min="2026-01-01" max="2026-12-31" />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-01');
    await act(async () => { root!.unmount(); }); host!.remove(); document.body.innerHTML = '';
    await show(<DateField label="Due" value="" onChange={() => {}} startAt="soon" />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(q('[role="grid"]')!.getAttribute('data-month')).toBe('2026-10');
  });
  it('can be cleared when clearable, and shows its placeholder when empty', async () => {
    const seen = vi.fn();
    function C() { const [v, setV] = useState('2026-10-14'); return <DateField label="Due" value={v} onChange={(x) => { setV(x); seen(x); }} clearable placeholder="No date" />; }
    await show(<C />);
    await click(q('[aria-haspopup="dialog"]'));
    await click(qa('button').find((b) => b.textContent === 'Clear')!);
    expect(seen).toHaveBeenCalledWith('');
    expect(q('[aria-haspopup="dialog"]')!.textContent).toContain('No date');
  });
});

describe('MonthField', () => {
  it('picks a month, and respects min and max', async () => {
    const seen = vi.fn();
    function M() { const [v, setV] = useState('2026-10'); return <MonthField label="Month" value={v} onChange={(x) => { setV(x); seen(x); }} min="2026-03" max="2026-12" />; }
    await show(<M />);
    const trigger = q('[aria-haspopup="dialog"]')!;
    expect(trigger.textContent).toContain('October 2026');
    await click(trigger);
    expect(q('[aria-label="February 2026"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(q('[aria-label="March 2026"]')!.getAttribute('aria-disabled')).toBeNull();
    await click(q('[aria-label="February 2026"]'));
    expect(seen).not.toHaveBeenCalled();
    await click(q('[aria-label="December 2026"]'));
    expect(seen).toHaveBeenCalledWith('2026-12');
    expect(trigger.textContent).toContain('December 2026');
  });
});

describe('TimeField', () => {
  const hour = (h: string) => qa('[role="listbox"][aria-label="Hour"] [role="option"]').find((o) => o.textContent === h)!;
  const minute = (m: string) => qa('[role="listbox"][aria-label="Minute"] [role="option"]').find((o) => o.textContent === m)!;
  it('picks an hour and a minute, keeping the minute when the hour changes', async () => {
    const seen = vi.fn();
    function T() { const [v, setV] = useState(''); return <TimeField label="From" value={v} onChange={(x) => { setV(x); seen(x); }} />; }
    await show(<T />);
    const trigger = q('[aria-haspopup="dialog"]')!;
    expect(trigger.textContent).toContain('Choose a time');
    await click(trigger);
    expect(qa('[role="listbox"][aria-label="Hour"] [role="option"]')).toHaveLength(24);
    expect(qa('[role="listbox"][aria-label="Minute"] [role="option"]')).toHaveLength(12);
    await click(hour('09'));
    expect(seen).toHaveBeenLastCalledWith('09:00');
    await click(minute('30'));
    expect(seen).toHaveBeenLastCalledWith('09:30');
    await click(hour('14'));
    expect(seen).toHaveBeenLastCalledWith('14:30');
    await click(qa('button').find((b) => b.textContent === 'Done')!);
    expect(q('[role="listbox"]')).toBeNull();
    expect(trigger.textContent).toContain('14:30');
  });
  it('closes hours and minutes outside min/max, and shows an off-grid value (the clock’s 09:58)', async () => {
    const seen = vi.fn();
    await show(<TimeField label="At" value="09:58" onChange={seen} min="08:30" max="16:30" />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(hour('07').getAttribute('aria-disabled')).toBe('true');
    expect(hour('08').getAttribute('aria-disabled')).toBeNull();
    expect(hour('17').getAttribute('aria-disabled')).toBe('true');
    expect(minute('58').getAttribute('aria-selected')).toBe('true');
    await click(hour('08')); // 08:58 is fine
    expect(seen).toHaveBeenLastCalledWith('08:58');
    await click(hour('16')); // 16:58 is after the max: the first valid minute instead
    expect(seen).toHaveBeenLastCalledWith('16:00');
    await click(hour('07'));
    expect(seen).toHaveBeenCalledTimes(2);
  });
  it('can be cleared when clearable and set; the button is not there otherwise', async () => {
    const seen = vi.fn();
    function T({ clearable }: { clearable?: boolean }) { const [v, setV] = useState('09:30'); return <TimeField label="Usual arrival" value={v} onChange={(x) => { setV(x); seen(x); }} clearable={clearable} />; }
    await show(<T />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(qa('button').find((b) => b.textContent === 'Clear')).toBeUndefined();
    await act(async () => { root!.unmount(); }); host!.remove(); document.body.innerHTML = '';
    await show(<T clearable />);
    const trigger = q('[aria-haspopup="dialog"]')!;
    expect(trigger.textContent).toContain('09:30');
    await click(trigger);
    await click(qa('button').find((b) => b.textContent === 'Clear')!);
    expect(seen).toHaveBeenCalledWith('');
    expect(q('[role="listbox"]')).toBeNull();
    expect(trigger.textContent).toContain('Choose a time');
    await click(trigger); // nothing to clear any more
    expect(qa('button').find((b) => b.textContent === 'Clear')).toBeUndefined();
  });
  it('honours a 15-minute step', async () => {
    await show(<TimeField label="At" value="" onChange={() => {}} step={15} />);
    await click(q('[aria-haspopup="dialog"]'));
    expect(qa('[role="listbox"][aria-label="Minute"] [role="option"]').map((o) => o.textContent)).toEqual(['00', '15', '30', '45']);
  });
});

function PagedDemo({ n, size = 10 }: { n: number; size?: number }) {
  const [q, setQ] = useState('');
  const all = Array.from({ length: n }, (_, i) => `row ${i + 1}`).filter((r) => r.includes(q));
  const p = usePaged(all, size, q);
  return (
    <div>
      <button data-search onClick={() => setQ('1')}>search</button>
      <ul>{p.rows.map((r) => <li key={r}>{r}</li>)}</ul>
      <span data-info>{`${p.page}/${p.pages}/${p.total}`}</span>
      <Pager page={p.page} pages={p.pages} onPage={p.setPage} label="Rows" />
    </div>
  );
}
describe('usePaged and Pager', () => {
  it('pages a list, moves with next/previous and numbered buttons, and disables the ends', async () => {
    await show(<PagedDemo n={25} />);
    expect(qa('li')).toHaveLength(10);
    expect(q('[data-info]')!.textContent).toBe('1/3/25');
    expect(q('nav')!.getAttribute('aria-label')).toBe('Rows');
    expect(q('[aria-label="Previous page"]')!.getAttribute('aria-disabled')).toBe('true');
    await click(q('[aria-label="Next page"]'));
    expect(qa('li')[0].textContent).toBe('row 11');
    await click(q('[aria-label="Page 3"]'));
    expect(qa('li').map((l) => l.textContent)).toEqual(['row 21', 'row 22', 'row 23', 'row 24', 'row 25']);
    expect(q('[aria-label="Page 3"]')!.getAttribute('aria-current')).toBe('page');
    expect(q('[aria-label="Next page"]')!.getAttribute('aria-disabled')).toBe('true');
    await click(q('[aria-label="Next page"]'));
    expect(q('[data-info]')!.textContent).toBe('3/3/25');
  });
  it('goes back to page 1 when the reset key (the search) changes', async () => {
    await show(<PagedDemo n={60} />);
    await click(q('[aria-label="Page 3"]'));
    expect(q('[data-info]')!.textContent).toBe('3/6/60');
    await click(q('[data-search]'));
    expect(q('[data-info]')!.textContent!.startsWith('1/')).toBe(true);
    expect(qa('li')[0].textContent).toBe('row 1');
  });
  it('renders nothing for a single page and keeps the page valid when the list shrinks', async () => {
    await show(<PagedDemo n={8} />);
    expect(q('nav')).toBeNull();
    expect(qa('li')).toHaveLength(8);
    await act(async () => { root!.render(<PagedDemo n={25} />); });
    await click(q('[aria-label="Page 3"]'));
    await act(async () => { root!.render(<PagedDemo n={12} />); });
    expect(q('[data-info]')!.textContent).toBe('2/2/12'); // page 3 no longer exists: the last page
    expect(qa('li')).toHaveLength(2);
  });
});
