// Round 8 family Photos tab and monthly memories story (pure): the family's photos as a flat list per day with a filter, the memory cards for the
// carousel, and which slides of the story have something to say. Everything is built on the family selectors, so only approved things appear.
import type { ClubState, Face, ISODate, Member, Photo, YM } from '../types';
import { live } from '../util';
import { cameOn } from './activity';
import { isFamilyActivityPic, isFamilyPhoto, monthRecap, recapMonths, type MonthRecap } from './family';

// ---------- photos by day, with a filter ----------
export type PhotoGroup = 'meals' | 'activities' | 'portraits';
export type PhotoFilter = 'all' | PhotoGroup;
/** The chips, in order (round 14: Meals / Activities / Portraits). */
export const PHOTO_GROUPS: PhotoGroup[] = ['meals', 'activities', 'portraits'];
/** Which chip a photo belongs to: the lunch and tea table (Meals), the member's own and arrival pictures (Portraits), everything else, group and session pictures (Activities). */
export const photoGroupOf = (p: Pick<Photo, 'kind'>): PhotoGroup => (p.kind === 'lunch' ? 'meals' : p.kind === 'solo' || p.kind === 'arrival' ? 'portraits' : 'activities');
/** The order of a day's pictures inside the feed: portraits, then the activities, then the meals. */
const DAY_ORDER: PhotoGroup[] = ['portraits', 'activities', 'meals'];

/** An approved lunch or tea picture is the family's on the days one of `who` came to the club (like an activity picture). */
export const isFamilyLunchPic = (s: ClubState, p: Photo, who: string[]) => p.kind === 'lunch' && p.visibility === 'visible' && !!p.mediaId && cameOn(s, who, p.date);

export interface FamPhotoDay { date: ISODate; photos: Photo[] }
const rank = (p: Photo) => DAY_ORDER.indexOf(photoGroupOf(p));
const byTime = (a: Photo, b: Photo) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1);

/** Every day the family has pictures of (newest first), each day's pictures flat: portraits, activities (group and session pictures), meals; each by time. Videos included. */
export function famPhotoDays(s: ClubState, who: string[]): FamPhotoDay[] {
  const mine = live(s.photos).filter((p) => (isFamilyPhoto(p) && p.memberIds.some((id) => who.includes(id))) || isFamilyActivityPic(s, p, who) || isFamilyLunchPic(s, p, who));
  const byDate = new Map<ISODate, Photo[]>();
  for (const p of mine) (byDate.get(p.date) || byDate.set(p.date, []).get(p.date)!).push(p);
  return Array.from(byDate.keys()).sort().reverse().map((date) => ({ date, photos: byDate.get(date)!.sort((a, b) => rank(a) - rank(b) || byTime(a, b)) }));
}
/** The days that have at least one picture of the filter's kind, with only those pictures. */
export const filterPhotoDays = (days: FamPhotoDay[], f: PhotoFilter): FamPhotoDay[] =>
  f === 'all' ? days : days.map((d) => ({ date: d.date, photos: d.photos.filter((p) => photoGroupOf(p) === f) })).filter((d) => d.photos.length);
/** The chips worth showing: kinds the family has at least one picture of, in chip order. */
export const groupsPresent = (days: FamPhotoDay[]): PhotoGroup[] => PHOTO_GROUPS.filter((g) => days.some((d) => d.photos.some((p) => photoGroupOf(p) === g)));

// ---------- posts (KC round 9: the Photos tab as a feed) ----------
/** One post of the feed: the pictures of one session (or the lunch table, or one parent's own pictures) on a day, swiped sideways. */
export interface PhotoPost { key: string; group: PhotoGroup; activity: string | null; photos: Photo[]; /** the first and last picture's time */ from: string; to: string }
/**
 * A day's pictures as posts: one per activity (its group and activity pictures together), one for the lunch table, one per parent (or pair) for their
 * own pictures. Inside a post the pictures go by time; the posts go newest first (like a feed), by their latest picture.
 */
export function famPhotoPosts(photos: Photo[]): PhotoPost[] {
  const map = new Map<string, PhotoPost>();
  for (const p of photos) {
    const g = photoGroupOf(p);
    const key = g === 'meals' ? 'lunch' : g === 'portraits' ? `solo:${[...p.memberIds].sort().join('+')}` : p.activity ? `act:${p.activity}` : `${g}:${p.time}`;
    const post = map.get(key) ?? map.set(key, { key, group: g, activity: g === 'meals' || g === 'portraits' ? null : p.activity ?? null, photos: [], from: p.time, to: p.time }).get(key)!;
    post.photos.push(p);
  }
  return Array.from(map.values())
    .map((x) => { const ph = [...x.photos].sort(byTime); return { ...x, photos: ph, from: ph[0].time, to: ph[ph.length - 1].time }; })
    .sort((a, b) => (a.to > b.to ? -1 : a.to < b.to ? 1 : a.key < b.key ? -1 : 1));
}

// ---------- memory cards (the carousel) ----------
export interface MemoryCard { key: string; memberId: string; month: YM; visits: number; photos: number; cover: Photo | null }
/** How many earlier months the carousel reaches back (besides the current one). */
export const CARD_MONTHS_BACK = 3;
/**
 * One card per parent for the current month when there is anything to show (a visit), then the earlier months (up to three back) with visits.
 * Newest month first; inside a month, the parents in the order given. Each card's cover is the month's best picture, but two cards never open on
 * the same one while another good picture is at hand (parents share the club's activity pictures).
 */
/**
 * KC round 9 ("the image for Oma should be Oma… don't put an activity image for people's image"): the pictures a card or slide that NAMES a person may show —
 * that person's own photos (solo, or a group they are tagged in), then pictures with no people in them (the lunch table of the days they came). Never an
 * activity picture of other people. Newest first; real pictures only.
 */
export function personPictures(s: ClubState, m: Member, month?: YM): Photo[] {
  const ps = famPhotoDays(s, [m.id]).filter((d) => !month || d.date.startsWith(month)).flatMap((d) => d.photos).filter((p) => p.media === 'photo' && !!p.mediaId);
  return [...ps.filter((p) => (p.kind === 'solo' || p.kind === 'group') && p.memberIds.includes(m.id)), ...ps.filter((p) => p.kind === 'lunch')];
}
/**
 * KC round 9: the parent's own picture for the top of Today: the newest photo staff took of them on their own (up to `upTo`), else their
 * profile picture (the demo's stock portrait), else the newest photo they are in with others; null without any.
 */
export function ownPicture(s: ClubState, m: Member, upTo: ISODate): Pick<Photo, 'mediaId' | 'tone' | 'media'> | null {
  const newest = (kind: Photo['kind']) => live(s.photos)
    .filter((p) => isFamilyPhoto(p) && p.kind === kind && p.media === 'photo' && p.memberIds.includes(m.id) && p.date <= upTo)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0] ?? null;
  const solo = newest('solo');
  if (solo) return solo;
  if (m.photoMediaId) return { mediaId: m.photoMediaId, tone: m.photoTone, media: 'photo' };
  return newest('group');
}
export function memoryCards(s: ClubState, parents: Member[], today: ISODate): MemoryCard[] {
  const found: { card: MemoryCard; best: Photo[] }[] = [];
  parents.forEach((m) => {
    for (const month of recapMonths(m, today).slice(0, CARD_MONTHS_BACK + 1)) {
      const r = monthRecap(s, m, month);
      if (r.visits.length) found.push({ card: { key: `${m.id}:${month}`, memberId: m.id, month, visits: r.visits.length, photos: r.photos, cover: null }, best: personPictures(s, m, month) });
    }
  });
  const order = (m: string) => parents.findIndex((x) => x.id === m);
  found.sort((a, b) => (a.card.month < b.card.month ? 1 : a.card.month > b.card.month ? -1 : order(a.card.memberId) - order(b.card.memberId)));
  const used = new Set<string>();
  const key = (p: Photo) => p.mediaId || p.id;
  return found.map(({ card, best }) => {
    const cover = best.find((p) => !used.has(key(p))) ?? best[0] ?? null;
    if (cover) used.add(key(cover));
    return { ...card, cover };
  });
}

// ---------- the story ----------
export type StorySlide = 'cover' | 'numbers' | 'favourite' | 'moods' | 'lunch' | 'note';
/** The daily face most visits had (round 14: from the face marks; a tie goes to the warmer one); null when no visit has one. */
export function dominantMood(r: Pick<MonthRecap, 'moods'>): Face | null {
  const n = new Map<Face, number>();
  for (const d of r.moods) if (d.mood) n.set(d.mood, (n.get(d.mood) || 0) + 1);
  return Array.from(n.keys()).sort((a, b) => n.get(b)! - n.get(a)! || b - a)[0] ?? null;
}
/** The newest of the team's kind notes of the month (the recap keeps them in date order). */
export const latestQuote = (r: Pick<MonthRecap, 'quotes'>) => r.quotes[r.quotes.length - 1] ?? null;
/** The slides that have something to say, in order; a month without visits has no story. */
export function storySlides(r: MonthRecap): StorySlide[] {
  if (!r.visits.length) return [];
  const out: StorySlide[] = ['cover', 'numbers'];
  if (r.favourites.length) out.push('favourite');
  if (dominantMood(r)) out.push('moods');
  if (r.lunch.of > 0) out.push('lunch');
  if (latestQuote(r)) out.push('note');
  return out;
}
/** True when one mood is more than half of the approved ones ("Mostly Good"); else the days were a mix. */
export function moodIsMostly(r: Pick<MonthRecap, 'moods'>): boolean {
  const mood = dominantMood(r);
  const total = r.moods.filter((d) => d.mood).length;
  return !!mood && r.moods.filter((d) => d.mood === mood).length * 2 > total;
}

/**
 * The picture behind each slide, in slide order: the cover the card showed (or the month's best), the favourite activity's picture, a lunch picture,
 * a picture of the day the note was written; the rest from the month's pictures. Real images first, and no picture twice while others are at hand.
 * Null when the family has no picture of the month (the slide shows a plain tone).
 */
export function storyBackdrops(s: ClubState, m: Member, r: MonthRecap, slides: StorySlide[], cover?: Photo | null): (Photo | null)[] {
  const mine = famPhotoDays(s, [m.id]).filter((d) => d.date.startsWith(r.month)).flatMap((d) => d.photos).filter((p) => p.media === 'photo' && !!p.mediaId);
  const key = (p: Photo) => p.mediaId || p.id;
  // KC round 9: the slides about the person (cover, numbers, moods, the team's note) show the person or no people; only the favourite activity's slide shows the activity
  const safe = personPictures(s, m, r.month);
  const used = new Set<string>();
  const pick = (...lists: Photo[][]): Photo | null => {
    const all = lists.flat();
    const p = all.find((x) => !used.has(key(x))) ?? all[0] ?? null;
    if (p) used.add(key(p));
    return p;
  };
  return slides.map((sl) => {
    if (sl === 'cover') return cover ? (used.add(key(cover)), cover) : pick(safe);
    if (sl === 'favourite') { const name = s.activities[r.favourites[0]?.activityId]?.name; return pick(mine.filter((p) => p.kind === 'activity' && !!name && p.activity === name), safe); }
    if (sl === 'lunch') return pick(mine.filter((p) => p.kind === 'lunch'), safe);
    if (sl === 'note') { const q = latestQuote(r); return pick(q ? safe.filter((p) => p.date === q.date) : [], safe); }
    return pick(safe);
  });
}

// ---------- story timing and gestures (round 8b: "the Instagram way") and the viewer's swipe ----------
/** How long each story slide shows before the next one starts. */
export const STORY_SLIDE_MS = 5000;
/** A press that lasts longer than this is a hold (pause and show the whole picture); a shorter one is a tap. */
export const STORY_HOLD_MS = 180;
/** A frame gap longer than this is treated as this long, so a stalled frame (a throttled tab) never skips a slide. */
export const STORY_MAX_STEP_MS = 100;
/** The left third of the story goes back, the rest goes on. */
export const storyTapGoes = (x: number, width: number): 'prev' | 'next' => (width > 0 && x < width / 3 ? 'prev' : 'next');
/** A press held this long is a hold. */
export const isStoryHold = (pressedMs: number) => pressedMs >= STORY_HOLD_MS;
/** Move the slide's clock by one frame: only while running, never by more than `STORY_MAX_STEP_MS`; `done` once the whole slide has shown. */
export function stepStoryClock(elapsed: number, dt: number, running: boolean, dur = STORY_SLIDE_MS): { elapsed: number; done: boolean } {
  if (!running || !(dt > 0)) return { elapsed, done: elapsed >= dur };
  const e = Math.min(dur, elapsed + Math.min(dt, STORY_MAX_STEP_MS));
  return { elapsed: e, done: e >= dur };
}
/** How full bar `k` is (0 to 1) while slide `idx` has shown `elapsed` of `dur`: earlier bars full, the current one filling, later ones empty. */
export const storyBarFill = (k: number, idx: number, elapsed: number, dur = STORY_SLIDE_MS) => (k < idx ? 1 : k === idx ? Math.max(0, Math.min(1, elapsed / dur)) : 0);

export type SwipeResult = 'next' | 'prev' | 'close' | 'stay';
/**
 * What a finished drag means in the photo viewer: sideways far enough (a quarter of the width) or quick enough goes to the next or previous picture
 * (a drag to the left shows the next); a quick or long pull down closes it; anything shorter springs back.
 */
export function swipeOutcome(dx: number, dy: number, ms: number, width: number): SwipeResult {
  const t = Math.max(1, ms);
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 && (dy > 110 || (dy > 50 && dy / t > 0.5)) ? 'close' : 'stay';
  const far = Math.abs(dx) > Math.max(40, width * 0.25), quick = Math.abs(dx) > 30 && Math.abs(dx) / t > 0.4;
  return far || quick ? (dx < 0 ? 'next' : 'prev') : 'stay';
}
