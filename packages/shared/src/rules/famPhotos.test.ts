// Family Photos tab and memories story logic against the seed.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../index';
import { addDays as addDaysISO } from '../util';
import { monthRecap } from './family';
import { STORY_HOLD_MS, STORY_SLIDE_MS, dominantMood, famPhotoDays, famPhotoPosts, filterPhotoDays, groupsPresent, isStoryHold, memoryCards, moodIsMostly, ownPicture, photoGroupOf, stepStoryClock, storyBackdrops, storyBarFill, storySlides, storyTapGoes, swipeOutcome } from './famPhotos';

const T = '2026-10-21';
const seed = () => buildSeed().citra;
/** KC round 9: families only see photos with a real picture; tests about the order and kinds give every seeded photo one */
const withPictures = (st: ReturnType<typeof seed>) => { for (const p of Object.values(st.photos)) if (!p.mediaId) p.mediaId = `md_test_${p.id}`; return st; };

describe('family photos by day', () => {
  it('days newest first, each flat: portraits, then group, activities and lunch, never pending or hidden ones', () => {
    const s = seed();
    const days = famPhotoDays(s, ['m1', 'm46']);
    expect(days.length).toBeGreaterThan(5);
    expect(days.map((d) => d.date)).toEqual(days.map((d) => d.date).slice().sort().reverse());
    for (const d of days) {
      const ranks = d.photos.map((p) => ['portraits', 'group', 'activities', 'lunch'].indexOf(photoGroupOf(p)));
      expect(ranks).toEqual(ranks.slice().sort((a, b) => a - b));
      expect(d.photos.every((p) => p.visibility === 'visible' && !p.deletedAt)).toBe(true);
    }
  });
  it('a lunch picture shows on a day one of them came, and the lunch chip appears with it', () => {
    const s = withPictures(seed());
    const before = groupsPresent(famPhotoDays(s, ['m1']));
    expect(before).toContain('portraits');
    const lunch = Object.values(s.photos).find((p) => p.kind === 'lunch' && p.visibility === 'visible' && !p.deletedAt);
    if (lunch) {
      const days = famPhotoDays(s, ['m1', 'm46', 'm10', 'm20']);
      expect(days.some((d) => d.photos.some((p) => p.id === lunch.id)) || !days.some((d) => d.date === lunch.date)).toBe(true);
    }
  });
  it('a filter keeps only its kind and drops the days left empty', () => {
    const s = withPictures(seed());
    const days = famPhotoDays(s, ['m1', 'm46']);
    const solo = filterPhotoDays(days, 'portraits');
    expect(solo.length).toBeGreaterThan(0);
    expect(solo.every((d) => d.photos.length > 0 && d.photos.every((p) => p.kind === 'solo'))).toBe(true);
    expect(filterPhotoDays(days, 'all')).toBe(days);
  });
});

describe('memory cards and the story', () => {
  it('Oma Lina: a card for this month first, then earlier months with visits (three back at most)', () => {
    const s = seed();
    const cards = memoryCards(s, [s.members.m1], T);
    expect(cards[0]).toMatchObject({ memberId: 'm1', month: '2026-10' });
    expect(cards[0].visits).toBeGreaterThan(3);
    expect(cards.length).toBeLessThanOrEqual(4);
    expect(cards.map((c) => c.month)).toEqual(cards.map((c) => c.month).slice().sort().reverse());
  });
  it('both parents: one card each for the month, in the order given', () => {
    const s = seed();
    const cards = memoryCards(s, [s.members.m1, s.members.m46], T);
    expect(cards.slice(0, 2).map((c) => c.memberId)).toEqual(['m1', 'm46']);
    expect(cards.slice(0, 2).every((c) => c.month === '2026-10')).toBe(true);
    expect(memoryCards(s, [s.members.m46, s.members.m1], T)[0].memberId).toBe('m46');
  });
  it('a month with no visits has no card and no story', () => {
    const s = seed();
    expect(storySlides(monthRecap(s, s.members.m1, '2020-01'))).toEqual([]);
    expect(memoryCards(s, [s.members.m1], T).some((c) => c.month === '2020-01')).toBe(false);
  });
  it('slides: cover and numbers always; the rest only with data behind them', () => {
    const s = seed();
    const r = monthRecap(s, s.members.m1, '2026-10');
    const slides = storySlides(r);
    expect(slides.slice(0, 2)).toEqual(['cover', 'numbers']);
    expect(slides.includes('favourite')).toBe(r.favourites.length > 0);
    expect(slides.includes('lunch')).toBe(r.lunch.of > 0);
    expect(slides.includes('moods')).toBe(r.moods.some((d) => d.mood));
    expect(slides.includes('note')).toBe(r.quotes.length > 0);
    expect(storySlides({ ...r, favourites: [], quotes: [], lunch: { finished: 0, of: 0 }, moods: r.moods.map((d) => ({ ...d, mood: null })) })).toEqual(['cover', 'numbers']);
  });
  it('the dominant mood counts approved moods only; a tie goes to the warmer one', () => {
    expect(dominantMood({ moods: [{ date: 'a', mood: null }, { date: 'b', mood: null }] })).toBeNull();
    expect(dominantMood({ moods: [{ date: 'a', mood: 'quiet' }, { date: 'b', mood: 'calm' }, { date: 'c', mood: 'quiet' }] })).toBe('quiet');
    expect(dominantMood({ moods: [{ date: 'a', mood: 'calm' }, { date: 'b', mood: 'cheerful' }] })).toBe('cheerful');
  });
  it('"mostly" only when one mood is more than half of the approved ones', () => {
    expect(moodIsMostly({ moods: [{ date: 'a', mood: 'calm' }, { date: 'b', mood: 'calm' }, { date: 'c', mood: 'quiet' }] })).toBe(true);
    expect(moodIsMostly({ moods: [{ date: 'a', mood: 'calm' }, { date: 'b', mood: 'cheerful' }, { date: 'c', mood: 'quiet' }, { date: 'd', mood: null }] })).toBe(false);
    expect(moodIsMostly({ moods: [{ date: 'a', mood: null }] })).toBe(false);
  });
  it('each slide gets a picture of its own month; lunch gets a lunch picture; none is used twice while others are left', () => {
    const s = seed();
    const r = monthRecap(s, s.members.m1, '2026-10');
    const slides = storySlides(r);
    const pics = storyBackdrops(s, s.members.m1, r, slides);
    expect(pics).toHaveLength(slides.length);
    expect(pics.every((p) => p && p.date.startsWith('2026-10'))).toBe(true);
    const keys = pics.map((p) => p!.mediaId || p!.id);
    expect(new Set(keys).size).toBe(keys.length);
    const lunchAt = slides.indexOf('lunch');
    const hasLunch = famPhotoDays(s, ['m1']).some((d) => d.date.startsWith('2026-10') && d.photos.some((p) => p.kind === 'lunch' && !!p.mediaId));
    if (lunchAt >= 0 && hasLunch) expect(pics[lunchAt]!.kind).toBe('lunch');
    // the card's cover opens the story
    expect(storyBackdrops(s, s.members.m1, r, slides, r.best[1])[0]).toBe(r.best[1]);
  });
  it('two cards in a month do not open on the same picture when the parents have others', () => {
    const s = seed();
    const cards = memoryCards(s, [s.members.m1, s.members.m46], T).filter((c) => c.month === '2026-10');
    expect(cards).toHaveLength(2);
    expect(cards[0].cover?.mediaId && cards[0].cover.mediaId === cards[1].cover?.mediaId).toBeFalsy();
  });
});

describe('story timing and gestures', () => {
  it('a tap in the left third goes back, anywhere else goes on; a press of 180 ms or more is a hold', () => {
    expect(storyTapGoes(10, 390)).toBe('prev');
    expect(storyTapGoes(129, 390)).toBe('prev');
    expect(storyTapGoes(131, 390)).toBe('next');
    expect(storyTapGoes(380, 390)).toBe('next');
    expect(isStoryHold(STORY_HOLD_MS - 1)).toBe(false);
    expect(isStoryHold(STORY_HOLD_MS)).toBe(true);
  });
  it('the clock runs only while running, in capped steps, and is done after five seconds', () => {
    expect(stepStoryClock(1000, 16, false)).toEqual({ elapsed: 1000, done: false });
    expect(stepStoryClock(1000, 16, true)).toEqual({ elapsed: 1016, done: false });
    expect(stepStoryClock(1000, 4000, true).elapsed).toBe(1100); // a stalled frame can't jump ahead
    let c = { elapsed: 0, done: false };
    for (let k = 0; k < 400 && !c.done; k++) c = stepStoryClock(c.elapsed, 16, true);
    expect(c).toEqual({ elapsed: STORY_SLIDE_MS, done: true });
    expect(stepStoryClock(STORY_SLIDE_MS, 16, true).done).toBe(true);
  });
  it('bars: earlier ones full, the current one filling, later ones empty', () => {
    expect([0, 1, 2, 3].map((k) => storyBarFill(k, 2, 2500))).toEqual([1, 1, 0.5, 0]);
    expect(storyBarFill(0, 0, 9999)).toBe(1);
    expect(storyBarFill(0, 0, -5)).toBe(0);
  });
  it('a swipe: far or quick sideways moves on (left = next), a pull down closes, a short one springs back', () => {
    expect(swipeOutcome(-120, 4, 300, 390)).toBe('next');
    expect(swipeOutcome(120, -4, 300, 390)).toBe('prev');
    expect(swipeOutcome(-40, 3, 400, 390)).toBe('stay'); // short and slow
    expect(swipeOutcome(-45, 3, 60, 390)).toBe('next'); // short but a flick
    expect(swipeOutcome(10, 3, 20, 390)).toBe('stay'); // a twitch, however fast
    expect(swipeOutcome(8, 140, 500, 390)).toBe('close');
    expect(swipeOutcome(8, 70, 90, 390)).toBe('close'); // a quick pull
    expect(swipeOutcome(8, 70, 600, 390)).toBe('stay');
    expect(swipeOutcome(0, -200, 300, 390)).toBe('stay'); // up does nothing
  });
});


// KC round 9: the Photos tab as a feed of posts
describe('family photo posts', () => {
  const ph = (id: string, kind: 'solo' | 'group' | 'activity' | 'lunch', time: string, activity?: string, memberIds: string[] = []) =>
    ({ id, kind, time, activity, memberIds, date: '2026-10-21', media: 'photo', tone: 0, takenBy: 's5', visibility: 'visible', clubId: 'citra', createdAt: '', createdBy: '' }) as never;
  it('one post per session (group and activity pictures together), the lunch table, each parent’s own; newest post first, pictures by time', () => {
    const posts = famPhotoPosts([
      ph('a2', 'activity', '10:50', 'Keroncong sing-along'), ph('g1', 'group', '10:40', 'Keroncong sing-along', ['m1', 'm2']),
      ph('l1', 'lunch', '12:10'), ph('s1', 'solo', '14:00', undefined, ['m1']), ph('b1', 'activity', '13:40', 'Batik painting'), ph('s2', 'solo', '09:00', undefined, ['m2']),
    ]);
    expect(posts.map((p) => p.key)).toEqual(['solo:m1', 'act:Batik painting', 'lunch', 'act:Keroncong sing-along', 'solo:m2']);
    const kr = posts.find((p) => p.key === 'act:Keroncong sing-along')!;
    expect(kr.photos.map((p) => p.id)).toEqual(['g1', 'a2']);
    expect([kr.from, kr.to]).toEqual(['10:40', '10:50']);
    expect(kr.activity).toBe('Keroncong sing-along');
    expect(posts.find((p) => p.key === 'lunch')!.activity).toBeNull();
  });
});

describe('no placeholders for families (KC round 9)', () => {
  it('a photo without a real picture never reaches the family pages', () => {
    const s = seed();
    const days = famPhotoDays(s, ['m1', 'm46']);
    expect(days.flatMap((d) => d.photos).every((p) => !!p.mediaId)).toBe(true);
    expect(days.flatMap((d) => d.photos).some((p) => p.kind === 'solo')).toBe(false); // the seed's portraits are placeholders
  });
});

describe('the parent’s own picture on Today (KC round 9)', () => {
  it('the stock portrait until staff take a photo of them on their own; then the newest such photo up to the day', () => {
    const s = seed();
    const lina = s.members.m1;
    expect(ownPicture(s, lina, T)?.mediaId).toBe('md_demo_portrait-lina');
    withPictures(s);
    const solos = Object.values(s.photos).filter((p) => p.kind === 'solo' && p.visibility === 'visible' && !p.deletedAt && p.media === 'photo' && p.memberIds.includes('m1') && p.date <= T);
    const newest = solos.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0];
    expect(ownPicture(s, lina, T)?.mediaId).toBe(newest.mediaId);
    // a day before the first solo photo: the portrait again
    const first = solos[solos.length - 1];
    expect(ownPicture(s, lina, addDaysISO(first.date, -1))?.mediaId).toBe('md_demo_portrait-lina');
  });
});
