// KC round 7: real demo pictures for the seed. Free Unsplash scenes (activities, food, club moments; never a member's portrait) are saved in
// apps/web/public/demo/ (see SOURCES.md there). A seeded record points at one with a media id `md_demo_<name>`; the web app shows it from `/demo/<name>.jpg`
// (`mediaUrl` in apps/web/src/lib/media.ts). The id has the shape of an uploaded one (`md_` + letters, digits, `_`, `-`), so every action that takes a
// media id (the activity editor saving an activity as it is, a review, a photo) accepts it.
// Pure and deterministic: pick by a number the caller derives from the date and the activity, never from the clock or Math.random.

export const DEMO_MEDIA_PREFIX = 'md_demo_';
/** The media id of a demo picture file (`act-batik-1` -> `md_demo_act-batik-1`). */
export const demoMediaId = (name: string): string => DEMO_MEDIA_PREFIX + name;
/** Where a demo media id is served from (`/demo/act-batik-1.jpg`); undefined for an uploaded picture. */
export const demoMediaPath = (id: string): string | undefined => (id.startsWith(DEMO_MEDIA_PREFIX) ? `/demo/${id.slice(DEMO_MEDIA_PREFIX.length)}.jpg` : undefined);

const at = <T,>(list: readonly T[], n: number): T => list[((Math.floor(n) % list.length) + list.length) % list.length];

/** Pictures of each catalogue activity. The first is the activity's own picture (Activity.photoMediaId); session pictures rotate through all of them. */
export const ACTIVITY_PICS: Readonly<Record<string, readonly string[]>> = {
  'act-angklung': ['act-angklung-1', 'act-angklung-2'],
  'act-keroncong': ['act-keroncong-1', 'act-karaoke-1'],
  'act-line': ['act-line-1', 'act-yoga-2'],
  'act-batik': ['act-batik-1', 'act-batik-2'],
  'act-yoga': ['act-yoga-1', 'act-yoga-2'],
  'act-garden': ['act-garden-1', 'act-garden-2'],
  'act-memory': ['act-memory-1', 'act-memory-2'], // club-tea-1 is kept for the afternoon tea photos only
  'act-mahjong': ['act-mahjong-1', 'act-mahjong-2'],
  'act-cooking': ['act-cooking-1', 'act-cooking-2'],
  'act-reading': ['act-reading-1', 'act-reading-2'],
  'act-karaoke': ['act-karaoke-1', 'club-chat-1'],
  'act-talk': ['act-talk-1', 'club-chat-1'],
};
/** The media id of an activity's own picture, or undefined for an activity without demo pictures. */
export const activityPicId = (activityId: string): string | undefined => { const l = ACTIVITY_PICS[activityId]; return l ? demoMediaId(l[0]) : undefined; };
/** A session picture of an activity, rotating with `n` (different `n` give different pictures); undefined for an activity without demo pictures. */
export const sessionPicId = (activityId: string, n: number): string | undefined => { const l = ACTIVITY_PICS[activityId]; return l ? demoMediaId(at(l, n)) : undefined; };

/** Pictures of the lunch dishes by dish id (the main dishes; sides and fruit have none). */
export const DISH_PICS: Readonly<Record<string, readonly string[]>> = {
  'dish-ayam-bakar': ['food-ayam-bakar'],
  'dish-rawon': ['food-rawon'],
  'dish-sop-ikan': ['food-sop-ikan'],
  'dish-tumis-buncis': ['food-tumis'],
  'dish-semur-tahu': ['food-tahu'],
  'dish-gado-gado': ['food-gado'],
  'dish-soto-bening': ['food-soto-1', 'food-soto-2'],
};
/** The lunch pictures that fit a day's dishes, main dish first (at most one per dish; `n` picks among a dish's pictures). Empty when no dish has one. */
export const lunchPicIds = (dishIds: readonly string[], n: number): string[] =>
  dishIds.flatMap((d) => (DISH_PICS[d] ? [demoMediaId(at(DISH_PICS[d], n))] : []));

/** Afternoon tea pictures (for the kitchen's tea photos): a teapot, a tray of kue and a tea table. */
export const TEA_PICS: readonly string[] = ['food-teh', 'food-kue', 'club-tea-1'];
export const teaPicId = (n: number): string => demoMediaId(at(TEA_PICS, n));
