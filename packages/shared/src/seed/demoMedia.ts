// KC round 7: real demo pictures for the seed. Free Unsplash scenes (activities, food, club moments) are saved in
// apps/web/public/demo/ (see SOURCES.md there). A seeded record points at one with a media id `md_demo_<name>`; the web app shows it from `/demo/<name>.jpg`
// (`mediaUrl` in apps/web/src/lib/media.ts). The id has the shape of an uploaded one (`md_` + letters, digits, `_`, `-`), so every action that takes a
// media id (the activity editor saving an activity as it is, a review, a photo) accepts it.
// Pure and deterministic: pick by a number the caller derives from the date and the activity, never from the clock or Math.random.

export const DEMO_MEDIA_PREFIX = 'md_demo_';
/** The media id of a demo picture file (`act-batik-1` -> `md_demo_act-batik-1`). */
export const demoMediaId = (name: string): string => DEMO_MEDIA_PREFIX + name;
const NOTA = DEMO_MEDIA_PREFIX + 'nota-';
/** KC 28 Oct: a seeded receipt's picture, a nota the server draws from the receipt's own data (GET /api/demo/nota/:receiptId), so it matches the numbers. */
export const notaMediaId = (receiptId: string): string => NOTA + receiptId;
/** Where a demo media id is served from (`/demo/act-batik-1.jpg`, a drawn nota from the API); undefined for an uploaded picture. */
export const demoMediaPath = (id: string): string | undefined =>
  id.startsWith(NOTA) ? `/api/demo/nota/${encodeURIComponent(id.slice(NOTA.length))}` : id.startsWith(DEMO_MEDIA_PREFIX) ? `/demo/${id.slice(DEMO_MEDIA_PREFIX.length)}.jpg` : undefined;

/** KC round 9: a free Unsplash portrait as the profile picture of each parent a demo family account follows (the faces are stock, the records made up).
 * The family's Today shows it until staff take a newer photo of that parent on their own. */
export const MEMBER_PORTRAITS: Readonly<Record<string, string>> = {
  m1: 'portrait-lina',
  m46: 'portrait-budi',
  m2: 'portrait-hendra',
  m10: 'portrait-bambang',
  m20: 'portrait-tjahjadi',
  // KC round 13: free Unsplash stock faces for the 40 roster members (m51..m90), matched to each one's title and age
  m51: 'portrait-m51',
  m52: 'portrait-m52',
  m53: 'portrait-m53',
  m54: 'portrait-m54',
  m55: 'portrait-m55',
  m56: 'portrait-m56',
  m57: 'portrait-m57',
  m58: 'portrait-m58',
  m59: 'portrait-m59',
  m60: 'portrait-m60',
  m61: 'portrait-m61',
  m62: 'portrait-m62',
  m63: 'portrait-m63',
  m64: 'portrait-m64',
  m65: 'portrait-m65',
  m66: 'portrait-m66',
  m67: 'portrait-m67',
  m68: 'portrait-m68',
  m69: 'portrait-m69',
  m70: 'portrait-m70',
  m71: 'portrait-m71',
  m72: 'portrait-m72',
  m73: 'portrait-m73',
  m74: 'portrait-m74',
  m75: 'portrait-m75',
  m76: 'portrait-m76',
  m77: 'portrait-m77',
  m78: 'portrait-m78',
  m79: 'portrait-m79',
  m80: 'portrait-m80',
  m81: 'portrait-m81',
  m82: 'portrait-m82',
  m83: 'portrait-m83',
  m84: 'portrait-m84',
  m85: 'portrait-m85',
  m86: 'portrait-m86',
  m87: 'portrait-m87',
  m88: 'portrait-m88',
  m89: 'portrait-m89',
  m90: 'portrait-m90',
};
/** The media id of a member's demo portrait, or undefined for a member without one. */
export const portraitId = (memberId: string): string | undefined => (MEMBER_PORTRAITS[memberId] ? demoMediaId(MEMBER_PORTRAITS[memberId]) : undefined);

/** KC 28 Oct: a free Unsplash portrait for each demo carer (suster), by the carer's name (Mbak Wati looks after two members, so both show the same face). */
export const CARER_PORTRAITS: Readonly<Record<string, string>> = {
  'Mbak Sari': 'carer-sari',
  'Mbak Wati': 'carer-wati',
  'Mbak Yanti': 'carer-yanti',
  'Mbak Lastri': 'carer-lastri',
  'Pak Maman': 'carer-maman',
};
/** The media id of a demo carer's portrait, if there is one. */
export const carerPortraitId = (name: string): string | undefined => (CARER_PORTRAITS[name] ? demoMediaId(CARER_PORTRAITS[name]) : undefined);

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
/** Round 15: the picture a seeded dish carries in the dish library (the first of its pictures), or undefined for a dish without one. */
export const dishPicId = (dishId: string): string | undefined => { const l = DISH_PICS[dishId]; return l ? demoMediaId(l[0]) : undefined; };
/** The lunch pictures that fit a day's dishes, main dish first (at most one per dish; `n` picks among a dish's pictures). Empty when no dish has one. */
export const lunchPicIds = (dishIds: readonly string[], n: number): string[] =>
  dishIds.flatMap((d) => (DISH_PICS[d] ? [demoMediaId(at(DISH_PICS[d], n))] : []));

/** Afternoon tea pictures (for the kitchen's tea photos): a teapot, a tray of kue and a tea table. */
export const TEA_PICS: readonly string[] = ['food-teh', 'food-kue', 'club-tea-1'];
export const teaPicId = (n: number): string => demoMediaId(at(TEA_PICS, n));

/** Round 14 (D): a made-up stock signature (drawn by a script, not a photo) for the seeded form that is Signed and waits for the countersign. */
export const SIGNATURE_PIC = demoMediaId('signature-1');
