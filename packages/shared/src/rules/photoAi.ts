// KC round 7, "shoot first, sort later": the SIMULATED AI that links a shot taken with the quick camera. The demo has no real model: every suggestion is a pure,
// deterministic function of the photo's id and image id plus the club's state (who is in the club at that minute, the session running, the role of the person
// shooting), so the browser (optimistic) and the server agree, a test can pin it, and a real model can replace `analyzePhoto` later without touching anything
// else (it returns the same `PhotoAi` the screens and actions already read). Everything the AI says is a suggestion: the person who took the shot fixes it
// in Drafts and sends it. Pure functions over ClubState; no clock reads (callers pass `today` and `nowMin`).
import type { ClubState, DT, ISODate, Member, Photo, PhotoAi, Role } from '../types';
import { MAX_LUNCH_PHOTOS, lunchPhotoIds, teaPhotoIds } from './kitchen';
import { LOG_BACK_DAYS, curAct, faceSuggestable, hashOf, logDateOk, logsOn, pictureSessions } from './activity';
import { attOf } from './attendance';
import { dayStatus, isPendingRow } from './core';
import { live, rng, sortBy, toHM, toMin } from '../util';

/** Shots within this many milliseconds of the previous one share a burst key (the camera sets it: a photo's time is only kept to the minute). */
export const BURST_GAP_MS = 3000;
/** A face the AI is less sure of than this is marked "check this". */
export const CHECK_BELOW = 0.85;
/** The most faces one shot is given. */
export const MAX_FACES = 3;
/** Before this time a kitchen shot is lunch, from it on afternoon tea. */
export const TEA_FROM = '14:00';

/** What the AI needs to know about a shot (a Photo before it is stored): `burst` is the camera's key for shots taken a moment apart. */
export type PhotoShot = Pick<Photo, 'id' | 'date' | 'time' | 'media'> & { mediaId?: string; burst?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Members in the club at a minute of the day: checked in by then and not yet out. */
export function inClubAt(s: ClubState, date: ISODate, atMin: number): Member[] {
  return sortBy(live(s.members).filter((m) => {
    if (isPendingRow(m)) return false;
    const a = attOf(s, date, m.id);
    return !!a?.checkIn && toMin(a.checkIn.at) <= atMin && (!a.checkOut || toMin(a.checkOut.at) > atMin);
  }), (m) => m.id);
}

/** Fisher-Yates with the given random source (deterministic when `r` is). */
function shuffled<T>(list: T[], r: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * The AI's reading of one shot.
 * - kitchen: always `food`, lunch before 14:00 and afternoon tea after.
 * - everyone else: about 35% `scene` (a picture of the session running at the time) and 65% `people` (1 to 3 faces from the members who were in the club then,
 *   those marked as joined in the running session first). Only a member who allows face tagging gets a `memberId`; an opted-out (or not enrolled) member's face
 *   stays an unnamed face. Confidence 0.72 to 0.98; below 0.85 the screens say "check this". With no session running a shot cannot be a scene.
 * - about 10% of shots are `blurry`; a people shot has a `smile` score (the best of a burst is marked afterwards by `bestOfBurst`).
 */
export function analyzePhoto(s: ClubState, photo: PhotoShot, role: Role, today: ISODate, nowMin: number): PhotoAi {
  const at: DT = `${today}T${toHM(nowMin)}`;
  const r = rng(hashOf(`${photo.id}|${photo.mediaId ?? ''}`));
  const rKind = r(), rBlur = r(), rCount = r(), rSmile = r(); // always drawn in the same order, whatever kind it turns out to be
  const tail = { ...(rBlur < 0.1 ? { blurry: true } : {}), ...(photo.burst ? { burst: photo.burst } : {}), at };
  const shotMin = toMin(photo.time);
  if (role === 'kitchen') return { kind: 'food', faces: [], meal: shotMin < toMin(TEA_FROM) ? 'lunch' : 'tea', ...tail };

  const cur = curAct(s, photo.date, shotMin);
  const slot = cur.kind === 'session' ? cur.session?.slot : undefined;
  const logs = slot ? logsOn(s, photo.date) : undefined;
  const here = inClubAt(s, photo.date, shotMin);
  const joined = here.filter((m) => !!slot && logs?.get(m.id)?.sessions?.[slot] === 'joined');
  const rest = here.filter((m) => !joined.includes(m));
  const hasSession = cur.kind === 'session';
  const scene = hasSession && (rKind < 0.35 || !here.length);
  if (scene) return { kind: 'scene', faces: [], ...tail };

  const n = Math.min(here.length, rCount < 0.4 ? 1 : rCount < 0.75 ? 2 : MAX_FACES);
  const pick = [...shuffled(joined, r), ...shuffled(rest, r)].slice(0, n);
  const faces = pick.map((m) => ({ ...(faceSuggestable(m) ? { memberId: m.id } : {}), confidence: round2(0.72 + r() * 0.26) }));
  return { kind: 'people', faces, smile: round2(0.3 + rSmile * 0.7), ...tail };
}

/** The shot to keep from a burst: the highest smile among the sharp people shots (the earliest wins a tie); undefined when the burst has fewer than two usable shots. */
export function bestOfBurst(shots: Pick<Photo, 'id' | 'ai'>[]): string | undefined {
  const ok = shots.filter((x) => x.ai?.kind === 'people' && !x.ai.blurry);
  if (ok.length < 2) return undefined;
  return ok.reduce((a, b) => ((b.ai?.smile ?? 0) > (a.ai?.smile ?? 0) ? b : a)).id;
}

// ---------- drafts ----------
/** The shots a person took and has not sent yet, newest first. Nobody else ever sees them. */
export const draftsOf = (s: ClubState, staffId: string): Photo[] =>
  sortBy(live(s.photos).filter((p) => p.visibility === 'draft' && p.takenBy === staffId), (p) => p.date + p.time + p.id, -1);

/** What the Drafts screen shows about one draft. `ai` is true while the AI's suggestion stands (nobody has opened and saved it yet). */
export interface DraftNotes {
  ai: boolean;
  /** "check this": a face the AI is unsure of or could not name, or something it could not fill in */
  check: boolean;
  /** how many faces the AI saw but could not name (an opted-out member, or someone it did not know) */
  unknown: number;
  blurry: boolean;
  best: boolean;
  /** what is missing before it can be sent */
  needs: 'people' | 'session' | null;
}
export function draftNotes(p: Pick<Photo, 'kind' | 'memberIds' | 'activity' | 'ai'>): DraftNotes {
  const ai = p.ai;
  const live_ = !!ai && !ai.reviewed;
  const needs = (p.kind === 'solo' || p.kind === 'group') && !p.memberIds.length ? 'people' : p.kind === 'activity' && !p.activity ? 'session' : null;
  const unknown = live_ && ai!.kind === 'people' ? ai!.faces.filter((f) => !f.memberId).length : 0;
  const unsure = live_ && ai!.faces.some((f) => f.confidence < CHECK_BELOW);
  return { ai: live_, check: unknown > 0 || unsure || (live_ && !!needs), unknown, blurry: live_ && !!ai!.blurry, best: !!ai?.best, needs };
}

/** The mutually exclusive kinds the camera deals in. */
export type DraftKind = 'people' | 'scene' | 'food';
/** Which kinds a role may file a shot under: the activity team files people and sessions, the kitchen files food, management all of them. */
export const draftKindsFor = (role: Role | null | undefined): DraftKind[] => (role === 'kitchen' ? ['food'] : role === 'mgmt' ? ['people', 'scene', 'food'] : role === 'activity' ? ['people', 'scene'] : []);
/** The kind a draft is filed under now. */
export const draftKindOf = (p: Pick<Photo, 'kind'>): DraftKind => (p.kind === 'activity' ? 'scene' : p.kind === 'lunch' ? 'food' : 'people');
/** The meal of a food draft (stored in `activity`; anything but 'tea' is lunch). */
export const draftMeal = (p: Pick<Photo, 'activity'>): 'lunch' | 'tea' => (p.activity === 'tea' ? 'tea' : 'lunch');
/** Drafts that belong together on the screen: the same day and the same session (or meal). */
export const draftGroupKey = (p: Pick<Photo, 'date' | 'kind' | 'activity'>): string => `${p.date}|${p.kind === 'lunch' ? 'meal:' + (p.activity === 'tea' ? 'tea' : 'lunch') : p.activity || ''}`;

export interface SendProblem { code: string; params?: Record<string, string | number> }
/**
 * Why a draft cannot be sent right now (the same checks `photo.sendDrafts` makes), or null when it can.
 * people: somebody must be named and every name must be a member who is not still waiting for approval; scene: a session of a day in the last LOG_BACK_DAYS;
 * food: today's lunch or tea gallery with room for another.
 */
export function sendProblem(s: ClubState, p: Photo, today: ISODate): SendProblem | null {
  if (p.kind === 'activity') {
    if (!p.activity) return { code: 'drafts.err.needSession' };
    if (!logDateOk(today, p.date)) return { code: 'activity.err.picDate', params: { n: LOG_BACK_DAYS } };
    if (!pictureSessions(s, p.date).some((x) => x.activity?.name === p.activity)) return { code: 'activity.err.picSession' };
    return null;
  }
  if (p.kind === 'lunch') {
    if (p.date !== today) return { code: 'drafts.err.notToday' };
    if (!dayStatus(s, p.date).open) return { code: 'err.closedDay' };
    const tea = draftMeal(p) === 'tea';
    if ((tea ? teaPhotoIds(s, p.date) : lunchPhotoIds(s, p.date)).length >= MAX_LUNCH_PHOTOS) return { code: tea ? 'kitchen.err.tooManyTeaPhotos' : 'kitchen.err.tooManyPhotos', params: { n: MAX_LUNCH_PHOTOS } };
    return null;
  }
  if (!p.memberIds.length) return { code: 'drafts.err.needPeople' };
  if (p.memberIds.some((id) => !s.members[id] || s.members[id].deletedAt || isPendingRow(s.members[id]))) return { code: 'err.memberPending' };
  return null;
}
