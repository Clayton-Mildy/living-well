// Round 8: the family Photos tab (memories carousel, filter chips, days, viewer) and the monthly memories story, against the seed.
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSeed, projectForFamily } from '@cp/shared';
import { monthRecap, visitDays } from '@cp/shared/rules/family';
import { useReplica } from '../../store/replica';
import { useSession } from '../../store/session';
import { FamilyPhotos } from './FamilyPhotos';
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

const T = '2026-10-21';
function open(familyId: string, lang: 'en' | 'id' = 'en') {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ } // the member switcher is remembered per user
  const seed = buildSeed().citra;
  for (const p of Object.values(seed.photos)) if (!p.mediaId) p.mediaId = `md_test_${p.id}`; // KC round 9: families only see real pictures; give the seed's placeholders one
  const view = projectForFamily(seed, familyId);
  useSession.setState({ lang, club: 'citra', user: { kind: 'family', id: familyId, name: 'Maria', clubId: 'citra' } as never });
  useReplica.setState({ club: 'citra', userId: familyId, confirmed: view, view, rev: 0, pending: [], status: 'ready', clock: { today: T, startMin: 598, realStart: Date.now(), offset: 0 }, act: (async () => ({ ok: true as const, result: {} })) as never });
  return view;
}
function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; }
async function show(ui: ReactElement, url: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    // the screen under test lives at the starting path; anywhere else the app navigates to shows where it went
    root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path={url.split('?')[0]} element={ui} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
  });
}
const text = () => document.body.textContent || '';
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const qa = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };
const press = async (key: string) => { await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }); };
const slide = () => q('[data-testid="memories-story"]')?.getAttribute('data-slide');
const next = () => click(q('[data-testid="story-next"]'));
// round 8b: the story's own clock and the viewer's drag, on a fake clock (frames included) and with pointer events
const clock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const ptr = async (type: 'pointerdown' | 'pointermove' | 'pointerup', el: Element | null, x: number, y: number) => {
  const E = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  await act(async () => { el!.dispatchEvent(new E(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'touch' } as PointerEventInit)); });
};
const story = () => q('[data-testid="memories-story"]');
const fill = () => Number(/scaleX\(([\d.]+)\)/.exec(q('[data-bar="now"]')!.style.transform)![1]);

describe('memories story (/memories)', () => {
  it('goes through the slides with real data: cover, numbers, favourite, moods, lunch, note, then closes', async () => {
    const view = open('f1');
    const recap = monthRecap(view, view.members.m1, '2026-10');
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    const story = q('[data-testid="memories-story"]')!;
    expect(story).toBeTruthy();
    expect(story.getAttribute('data-month')).toBe('2026-10');
    expect(story.getAttribute('data-member-id')).toBe('m1');
    // a: cover
    expect(slide()).toBe('cover');
    expect(q('[data-testid="story-big"]')?.textContent).toBe('October with Oma Lina');
    expect(q('[data-testid="story-sub"]')?.textContent).toBe(`${recap.visits.length} visits and ${recap.photos} photos so far this month.`);
    expect(q('[data-testid="story-count"]')?.textContent).toMatch(/^1 of [4-6]$/);
    // b: her month in numbers
    await next();
    expect(slide()).toBe('numbers');
    expect(text()).toContain('Her month in numbers');
    const nums = q('[data-testid="story-numbers"]')!.textContent!;
    expect(nums).toContain(`${recap.visits.length}visits`);
    expect(nums).toContain(`${recap.joined}sessions joined`);
    expect(nums).toContain(`${recap.photos}photos`);
    // c: her favourite
    await next();
    expect(slide()).toBe('favourite');
    expect(text()).toContain('Her favourite');
    expect(q('[data-testid="story-big"]')?.textContent).toMatch(/, \d+ times$/);
    // d: how the days felt, one dot per visit; only approved moods are coloured
    await next();
    expect(slide()).toBe('moods');
    const dots = qa('[data-testid="story-moods"] [data-date]');
    expect(dots).toHaveLength(recap.visits.length);
    expect(dots.map((d) => d.getAttribute('data-mood') || null)).toEqual(recap.moods.map((d) => d.mood));
    expect(q('[data-testid="story-big"]')?.textContent).toMatch(/^Mostly /);
    // e: lunch
    await next();
    expect(slide()).toBe('lunch');
    expect(q('[data-testid="story-big"]')?.textContent).toBe(`Finished lunch on ${recap.lunch.finished} of ${recap.lunch.of} days`);
    expect(q('[data-testid="story-lunch"]')!.children).toHaveLength(recap.lunch.of);
    // f: from the team
    await next();
    expect(slide()).toBe('note');
    expect(q('[data-testid="story-big"]')?.textContent).toBe(`“${recap.quotes[recap.quotes.length - 1].text}”`);
    expect(q('[data-testid="story-sub"]')?.textContent).toMatch(/ · \w{3} \d+ \w{3}$/);
    expect(q('[data-testid="story-count"]')?.textContent).toMatch(/^6 of 6$/);
    // the last slide's "next" closes the story: back to Photos when the page was opened directly
    await next();
    expect(q('[data-testid="memories-story"]')).toBeNull();
    expect(q('[data-testid="where"]')?.textContent).toBe('/photos');
  });

  it('left third goes back, ← → move, Esc closes; a mood dot opens that day on Today', async () => {
    open('f1');
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10&slide=1');
    expect(slide()).toBe('numbers'); // &slide=1 starts on the second slide
    await click(q('[data-testid="story-prev"]'));
    expect(slide()).toBe('cover');
    await click(q('[data-testid="story-prev"]'));
    expect(slide()).toBe('cover'); // the first slide has nothing before it
    await press('ArrowRight');
    await press('ArrowRight');
    expect(slide()).toBe('favourite');
    await press('ArrowLeft');
    expect(slide()).toBe('numbers');
    await press('ArrowRight'); await press('ArrowRight');
    expect(slide()).toBe('moods');
    const day = qa('[data-testid="story-moods"] [data-date]')[0].getAttribute('data-date')!;
    await click(q(`[data-testid="story-moods"] [data-date="${day}"]`));
    expect(q('[data-testid="where"]')?.textContent).toBe(`/today?date=${day}&member=m1`);
    expect(q('[data-testid="memories-story"]')).toBeNull();
  });

  it('Esc and the close button leave the story', async () => {
    open('f1');
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    await press('Escape');
    expect(q('[data-testid="memories-story"]')).toBeNull();
    expect(q('[data-testid="where"]')?.textContent).toBe('/photos');
  });

  it('a month she did not come shows a gentle line; with no month asked, the newest month with a visit', async () => {
    const view = open('f1');
    const bare = { ...view, attendance: Object.fromEntries(Object.entries(view.attendance).filter(([, a]) => !(a.memberId === 'm1' && a.date.startsWith('2026-10')))) };
    useReplica.setState({ confirmed: bare, view: bare });
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    expect(q('[data-testid="memories-story"]')).toBeNull();
    expect(q('[data-testid="memories-empty"]')?.textContent).toBe('Oma Lina didn’t come in October 2026.');
    await act(async () => { root!.unmount(); });
    host!.remove();
    await show(<FamilyMemories />, '/memories?member=m1');
    expect(q('[data-testid="memories-story"]')?.getAttribute('data-month')).toBe('2026-09');
  });

  it('the default is the first parent (or the one asked for), and pronouns follow the member', async () => {
    open('f1');
    await show(<FamilyMemories />, '/memories?member=m46');
    expect(q('[data-testid="family-memories"]')?.getAttribute('data-member-id')).toBe('m46');
    expect(q('[data-testid="memories-story"]')?.getAttribute('data-month')).toBe('2026-10');
    expect(q('[data-testid="story-big"]')?.textContent).toBe('October with Opa Budi');
    await next();
    expect(text()).toContain('His month in numbers');
  });

  it('share uses the share sheet when there is one, else copies a short text and says so', async () => {
    open('f1');
    const share = vi.fn(async (_d: ShareData) => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    await click(q('[data-testid="story-share"]'));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toMatchObject({ title: 'October with Oma Lina' });
    await act(async () => { root!.unmount(); });
    host!.remove();
    const writeText = vi.fn(async (_t: string) => {});
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    await click(q('[data-testid="story-share"]'));
    expect(writeText.mock.calls[0][0]).toContain('October with Oma Lina');
    expect(text()).toContain('Copied');
  });

  it('in Indonesian: her words, no raw keys', async () => {
    open('f1', 'id');
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    expect(q('[data-testid="story-big"]')?.textContent).toMatch(/^Oktober bersama /);
    expect(q('[data-testid="story-sub"]')?.textContent).toMatch(/kunjungan dan \d+ foto sejauh bulan ini\.$/);
    for (let k = 0; k < 5; k++) { await next(); expect(text()).not.toMatch(/\b(fphotos|family|common)\.[a-z]/i); }
    expect(slide()).toBe('note');
  });
});

describe('Photos tab', () => {
  it('a card per parent for this month first, then earlier months; a card opens the story', async () => {
    open('f1');
    await show(<FamilyPhotos />, '/photos');
    expect(q('h1')?.textContent).toBe('Photos');
    const cards = qa('[data-testid="memory-card"]');
    expect(cards.slice(0, 2).map((c) => [c.getAttribute('data-member-id'), c.getAttribute('data-month')])).toEqual([['m1', '2026-10'], ['m46', '2026-10']]);
    expect(cards.length).toBeGreaterThan(2);
    expect(cards[0].textContent).toMatch(/MemoriesOctober with Oma Lina\d+ visits · \d+ photos$/);
    await click(cards[1]);
    expect(q('[data-testid="memories-story"]')?.getAttribute('data-member-id')).toBe('m46');
    await press('Escape');
    expect(q('[data-testid="memories-story"]')).toBeNull();
    expect(q('[data-testid="photos-empty"]')).toBeNull();
  });

  it('round 11: the parent switch narrows the cards and the days to one parent, and the name sits under the title', async () => {
    const view = open('f1');
    await show(<FamilyPhotos />, '/photos');
    expect(q('[data-testid="parent-switch"]')?.getAttribute('data-tone')).toBe('page');
    expect(q('[data-testid="all-parents"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-testid="title-who"]')).toBeNull();
    await click(q('button[data-member="m46"]'));
    expect(q('[data-testid="title-who"]')?.textContent).toBe('Opa Budi Wijaya');
    expect(qa('[data-testid="memory-card"]').every((c) => c.getAttribute('data-member-id') === 'm46')).toBe(true);
    const days = qa('[data-testid="photo-day"]').map((d) => d.getAttribute('data-date'));
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((d) => visitDays(view, 'm46', T).includes(d!))).toBe(true); // only days Opa Budi came
    await click(q('[data-testid="all-parents"]'));
    expect(q('[data-testid="title-who"]')).toBeNull();
    expect(new Set(qa('[data-testid="memory-card"]').map((c) => c.getAttribute('data-member-id'))).size).toBe(2);
  });

  it('chips filter the days (a kind the family has none of is hidden); days page ten at a time', async () => {
    open('f1');
    await show(<FamilyPhotos />, '/photos');
    const chips = qa('[data-testid="photo-filter"] [data-value]').map((c) => c.getAttribute('data-value'));
    expect(chips[0]).toBe('all');
    expect(chips).toContain('portraits');
    expect(qa('[data-testid="photo-day"]')).toHaveLength(10);
    expect(q('[data-testid="photos-more"]')).toBeTruthy();
    await click(q('[data-testid="photos-more"]'));
    expect(qa('[data-testid="photo-day"]')).toHaveLength(20);
    await click(q('[data-testid="photo-filter"] [data-value="portraits"]'));
    const tiles = qa('[data-testid="photo-day"] [data-photo-id]');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((x) => x.getAttribute('data-kind') === 'solo')).toBe(true);
    await click(q('[data-testid="photo-filter"] [data-value="all"]'));
    expect(qa('[data-testid="photo-day"]')).toHaveLength(10); // paging starts over for a new filter
    const first = q('[data-testid="photo-day"]')!;
    expect(first.querySelector('h2')?.textContent).toMatch(/^(Today|\w+day \d+ \w{3})$/);
    expect(first.querySelector('[data-testid="select-day-start"]')?.textContent).toMatch(/^\d+ photos?/); // the day's header: the count is also the "select this day" button (KC round 10)
  });

  it('a tile opens the black viewer: "1 of N", label and "Today · time · name" for a family with two parents; ← → and Esc', async () => {
    open('f1');
    await show(<FamilyPhotos />, '/photos');
    await click(q('[data-testid="photo-filter"] [data-value="portraits"]'));
    const tile = q('[data-testid="photo-day"] [data-photo-id]')!;
    await click(tile);
    const viewer = q('[data-testid="family-viewer"]')!;
    expect(viewer).toBeTruthy();
    expect(viewer.getAttribute('data-photo-id')).toBe(tile.getAttribute('data-photo-id'));
    expect(q('[data-testid="viewer-count"]')?.textContent).toMatch(/^1 of \d+$/);
    expect(q('[data-testid="viewer-sub"]')?.textContent).toMatch(/ · \d\d:\d\d · (Oma Lina|Opa Budi)$/);
    expect(viewer.textContent).not.toMatch(/Hide|Remove|Tag/); // families get no staff actions
    await press('ArrowRight');
    expect(q('[data-testid="viewer-count"]')?.textContent).toMatch(/^2 of \d+$/);
    await click(q('[data-testid="viewer-prev"]'));
    expect(q('[data-testid="viewer-count"]')?.textContent).toMatch(/^1 of \d+$/);
    await press('Escape');
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); // KC round 9: it shrinks back into its tile first
    expect(q('[data-testid="family-viewer"]')).toBeNull();
  });

  it('one parent: one card per month, no names in the viewer, no raw keys in Indonesian', async () => {
    open('fm10_0', 'id');
    await show(<FamilyPhotos />, '/photos');
    expect(qa('[data-testid="memory-card"]').every((c) => c.getAttribute('data-member-id') === 'm10')).toBe(true);
    expect(qa('[data-testid="memory-card"]')[0].textContent).toMatch(/Oktober bersama .*kunjungan/);
    await click(q('[data-testid="photo-day"] [data-photo-id]'));
    expect(q('[data-testid="viewer-count"]')?.textContent).toMatch(/^1 dari \d+$/);
    expect(q('[data-testid="viewer-sub"]')?.textContent).toMatch(/^[^·]+ · \d\d:\d\d$/);
    expect(text()).not.toMatch(/\b(fphotos|family|common|activity)\.[a-z]/i);
  });

  it('no pictures at all: the empty state, no chips, no carousel', async () => {
    const view = open('f1');
    const bare = { ...view, photos: {} };
    useReplica.setState({ confirmed: bare, view: bare });
    await show(<FamilyPhotos />, '/photos');
    expect(q('[data-testid="photos-empty"]')?.textContent).toContain('No photos yet.');
    expect(q('[data-testid="photo-filter"]')).toBeNull();
    expect(qa('[data-testid="photo-day"]')).toHaveLength(0);
  });
});


describe('story timing (round 8b)', () => {
  const start = async (url = '/memories?member=m1&month=2026-10') => { clock(); open('f1'); await show(<FamilyMemories />, url); };

  it('each slide plays five seconds while its bar fills, then the next starts; after the last one the story closes', async () => {
    await start();
    expect(slide()).toBe('cover');
    expect(fill()).toBeLessThan(0.05);
    await tick(2500);
    expect(fill()).toBeGreaterThan(0.4);
    expect(fill()).toBeLessThan(0.6);
    expect(slide()).toBe('cover');
    await tick(2700);
    expect(slide()).toBe('numbers');
    expect(fill()).toBeLessThan(0.1); // the new slide's bar starts empty…
    expect(qa('[data-bar="done"]')).toHaveLength(1); // …and the one before it is full
    expect(qa('[data-bar="next"]').length).toBeGreaterThan(0);
    for (const k of ['favourite', 'moods', 'lunch', 'note']) { await tick(5100); expect(slide()).toBe(k); }
    await tick(5100);
    expect(story()).toBeNull();
    expect(q('[data-testid="where"]')?.textContent).toBe('/photos');
  });

  it('press and hold pauses the clock and hides the overlay (the bars stay); letting go carries on, and does not count as a tap', async () => {
    await start();
    await tick(2000);
    const at = fill();
    const zone = q('[data-testid="story-next"]');
    await ptr('pointerdown', zone, 300, 400);
    await tick(100);
    expect(story()!.getAttribute('data-held')).toBe('false'); // not yet: a quick tap is still possible
    await tick(120);
    expect(story()!.getAttribute('data-held')).toBe('true');
    expect(story()!.getAttribute('data-paused')).toBe('true');
    expect(q('[data-testid="story-bars"]')).toBeTruthy(); // the bars stay
    expect((q('[data-testid="story-big"]')!.parentElement as HTMLElement).style.opacity).toBe('0'); // the text is gone
    await tick(8000);
    expect(slide()).toBe('cover');
    expect(Math.abs(fill() - at)).toBeLessThan(0.06); // it waited where it was
    await ptr('pointerup', zone, 300, 400);
    expect(story()!.getAttribute('data-held')).toBe('false');
    expect((q('[data-testid="story-big"]')!.parentElement as HTMLElement).style.opacity).toBe('1');
    await click(zone); // the click that ends a hold is dropped
    expect(slide()).toBe('cover');
    await tick(3200);
    expect(slide()).toBe('numbers'); // about 3 s were left of the slide
  });

  it('a quick tap goes on (right) or back (left) and restarts that slide’s five seconds', async () => {
    await start();
    await tick(3000);
    const zone = q('[data-testid="story-next"]');
    await ptr('pointerdown', zone, 300, 400);
    await tick(60);
    await ptr('pointerup', zone, 300, 400);
    await click(zone);
    expect(slide()).toBe('numbers');
    expect(fill()).toBeLessThan(0.05);
    await tick(3000);
    expect(slide()).toBe('numbers'); // the three seconds on the first slide don't count
    await tick(2200);
    expect(slide()).toBe('favourite');
    await click(q('[data-testid="story-prev"]'));
    expect(slide()).toBe('numbers');
    await click(q('[data-testid="story-prev"]'));
    expect(slide()).toBe('cover');
    await tick(3000);
    await click(q('[data-testid="story-prev"]')); // nothing before the first slide, but it plays again from the start
    expect(slide()).toBe('cover');
    expect(fill()).toBeLessThan(0.05);
    await tick(3000);
    expect(slide()).toBe('cover');
  });

  it('Space (or the pause button) pauses and plays; a hidden tab and an open share sheet wait too; the mood dots do not start a hold', async () => {
    await start();
    await press(' ');
    expect(story()!.getAttribute('data-paused')).toBe('true');
    await tick(6000);
    expect(slide()).toBe('cover');
    await click(q('[data-testid="story-pause"]'));
    expect(story()!.getAttribute('data-paused')).toBe('false');
    // the tab goes to the background
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(story()!.getAttribute('data-paused')).toBe('true');
    await tick(6000);
    expect(slide()).toBe('cover');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(story()!.getAttribute('data-paused')).toBe('false');
    // the share sheet is open until the family picks or cancels
    let done = () => {};
    vi.stubGlobal('navigator', { ...navigator, share: () => new Promise<void>((r) => { done = r; }) });
    await click(q('[data-testid="story-share"]'));
    expect(story()!.getAttribute('data-paused')).toBe('true');
    await tick(6000);
    expect(slide()).toBe('cover');
    await act(async () => { done(); });
    expect(story()!.getAttribute('data-paused')).toBe('false');
    await tick(5200);
    expect(slide()).toBe('numbers');
    // a dot: pressing it is not a hold, and it does not move the story on
    await press('ArrowRight'); await press('ArrowRight');
    expect(slide()).toBe('moods');
    const dot = qa('[data-testid="story-moods"] [data-date]')[0];
    await ptr('pointerdown', dot, 40, 600);
    await tick(400);
    expect(story()!.getAttribute('data-held')).toBe('false');
    await ptr('pointerup', dot, 40, 600);
    expect(slide()).toBe('moods');
  });

  it('with reduced motion the bar does not fill, but the story still moves on after five seconds', async () => {
    clock();
    open('f1');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: /reduce/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
    await show(<FamilyMemories />, '/memories?member=m1&month=2026-10');
    expect(fill()).toBe(1);
    await tick(2500);
    expect(fill()).toBe(1);
    expect(slide()).toBe('cover');
    await tick(2700);
    expect(slide()).toBe('numbers');
  });
});

describe('family photo viewer drag (round 8b)', () => {
  const box = { left: 0, top: 0, right: 400, bottom: 700, x: 0, y: 0, width: 400, height: 700, toJSON() {} };
  const opened = async () => {
    clock();
    open('f1');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(box as DOMRect);
    await show(<FamilyPhotos />, '/photos');
    await click(q('[data-testid="photo-filter"] [data-value="portraits"]'));
    await click(q('[data-testid="photo-day"] [data-photo-id]'));
    return q('[data-testid="viewer-strip"]')!.parentElement as HTMLElement;
  };
  const count = () => q('[data-testid="viewer-count"]')!.textContent;
  const drag = async (stage: HTMLElement, from: [number, number], to: [number, number], ms: number) => {
    await ptr('pointerdown', stage, ...from);
    await ptr('pointermove', stage, ...to);
    await tick(ms);
    await ptr('pointerup', stage, ...to);
  };

  it('the strip holds the neighbours and follows the finger; a long or quick drag moves on, a short slow one springs back', async () => {
    const stage = await opened();
    expect(count()).toMatch(/^1 of /);
    expect(qa('[data-testid="viewer-strip"] [data-slide]').map((x) => x.getAttribute('data-slide'))).toEqual(['prev', 'cur', 'next']);
    await ptr('pointerdown', stage, 300, 300);
    await ptr('pointermove', stage, 240, 302);
    expect(q('[data-testid="viewer-strip"]')!.style.transform).toMatch(/-15%/); // 60 of 400 px
    await tick(600);
    await ptr('pointerup', stage, 240, 302);
    expect(count()).toMatch(/^1 of /); // short and slow: back it goes
    expect(q('[data-testid="viewer-strip"]')!.style.transform).toMatch(/translate3d\(0(px)?, ?0(px)?, ?0(px)?\)/);
    await drag(stage, [300, 300], [130, 300], 200); // 170 px to the left
    expect(count()).toMatch(/^2 of /);
    await drag(stage, [100, 300], [300, 300], 500); // 200 px to the right
    expect(count()).toMatch(/^1 of /);
    await drag(stage, [160, 300], [100, 300], 50); // a flick to the left
    expect(count()).toMatch(/^2 of /);
    await click(q('[data-testid="viewer-next"]')); // the click that ends a drag is not a tap…
    expect(count()).toMatch(/^2 of /);
    await tick(300);
    await click(q('[data-testid="viewer-next"]')); // …but a tap on the zone slides on too
    expect(count()).toMatch(/^3 of /);
  });

  it('a pull down closes the viewer; a short pull springs back; Esc and ← → still work', async () => {
    const stage = await opened();
    await drag(stage, [200, 200], [204, 240], 400); // 40 px down, slowly
    expect(q('[data-testid="family-viewer"]')).toBeTruthy();
    await drag(stage, [200, 100], [204, 300], 200);
    await tick(400);
    expect(q('[data-testid="family-viewer"]')).toBeNull();
  });

  it('a tablet or laptop has round ‹ › buttons at the sides; a phone swipes and taps', async () => {
    await opened();
    expect(count()).toMatch(/^1 of /);
    await click(q('[data-testid="viewer-arrow-next"]')); // jsdom's window is 1024 wide: a tablet
    expect(count()).toMatch(/^2 of /);
    await click(q('[data-testid="viewer-arrow-prev"]'));
    expect(count()).toMatch(/^1 of /);
    await act(async () => { root!.unmount(); });
    host!.remove();
    const w = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    try {
      await show(<FamilyPhotos />, '/photos');
      await click(q('[data-testid="photo-day"] [data-photo-id]'));
      expect(q('[data-testid="family-viewer"]')).toBeTruthy();
      expect(q('[data-testid="viewer-arrow-next"]')).toBeNull();
      expect(q('[data-testid="viewer-next"]')).toBeTruthy();
    } finally { Object.defineProperty(window, 'innerWidth', { value: w, configurable: true }); }
  });
});
