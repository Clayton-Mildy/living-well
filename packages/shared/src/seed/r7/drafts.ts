// KC round 7 seed: the quick camera's Drafts. Dinar (s5) has been shooting since she arrived, so her Drafts screen is not empty in the demo: five shots from this morning,
// all before the demo starts (09:58). Each has the (simulated) AI's suggestion on it, written by hand here so the demo shows every chip: a clean group photo, a picture of
// the coming session, and a burst of one member where the first shot is blurry and unsure ("Check", "Blurry?"), the second has a face the AI could not name, and the
// last has the best smile (the star). Pictures are the free demo scenes in apps/web/public/demo (hands and tiles, never a member's portrait: FACE_FREE below; a draft that names a member keeps to the same rule as the sent photos). Nothing here is sent: drafts are private.
import type { ClubState, ISODate, Photo, PhotoAi } from '../../types';
import { curAct } from '../../rules/activity';
import { isOpen } from '../../rules/core';
import { toMin } from '../../util';
import { activityPicId, demoMediaId } from '../demoMedia';

/** The demo pictures with no face in them: the only ones a seeded draft that names a member may use (a stranger's face must not carry a member's name). */
export const FACE_FREE = ['act-batik-2', 'act-mahjong-2'] as const;

export function seedDrafts(s: ClubState, T: ISODate): void {
  const by = 's5';
  if (!s.staff[by] || !isOpen(s, T)) return;
  const mem = (id: string) => !!s.members[id] && !s.members[id].deletedAt;
  if (!['m20', 'm2', 'm10'].every(mem)) return;
  const sessionAt = (time: string) => { const c = curAct(s, T, toMin(time)); return c.kind === 'session' ? c : undefined; };
  const put = (n: number, time: string, over: Partial<Photo> & { ai: PhotoAi }) => {
    const id = `p-draft-${n}`;
    s.photos[id] = { id, clubId: s.clubId, createdAt: `${T}T${time}`, createdBy: `staff:${by}`, date: T, time, kind: 'group', media: 'photo', memberIds: [], tone: n % 5, takenBy: by, visibility: 'draft', ...over };
  };
  const ai = (a: Omit<PhotoAi, 'at'>, time: string): PhotoAi => ({ ...a, at: `${T}T${time}` });
  const early = sessionAt('09:44');

  // the people shots are morning moments before the programme starts, so they carry no session ("Other shots"); only the room picture is the coming session's
  // a clean group photo: two members, both recognised with confidence
  put(1, '09:44', { kind: 'group', memberIds: ['m20', 'm2'], mediaId: demoMediaId(FACE_FREE[1]),
    ai: ai({ kind: 'people', faces: [{ memberId: 'm20', confidence: 0.94 }, { memberId: 'm2', confidence: 0.91 }], smile: 0.86 }, '09:44') });
  // a picture of the coming session (the room before it starts)
  const act = early?.session?.activity;
  put(2, '09:46', { kind: 'activity', memberIds: [], ...(early ? { activity: early.name } : {}), mediaId: (act && activityPicId(act.id)) || demoMediaId('act-talk-1'), ai: ai({ kind: 'scene', faces: [] }, '09:46') });
  // one member in three shots a moment apart: a blurry unsure one, a face the AI could not name, and the best smile
  const burst = 'b-seed-1';
  put(3, '09:49', { kind: 'solo', memberIds: ['m10'], mediaId: demoMediaId(FACE_FREE[0]),
    ai: ai({ kind: 'people', faces: [{ memberId: 'm10', confidence: 0.78 }], smile: 0.35, blurry: true, burst }, '09:49') });
  put(4, '09:49', { kind: 'solo', memberIds: ['m10'], mediaId: demoMediaId(FACE_FREE[0]),
    ai: ai({ kind: 'people', faces: [{ memberId: 'm10', confidence: 0.9 }, { confidence: 0.81 }], smile: 0.62, burst }, '09:49') });
  put(5, '09:49', { kind: 'solo', memberIds: ['m10'], mediaId: demoMediaId(FACE_FREE[0]),
    ai: ai({ kind: 'people', faces: [{ memberId: 'm10', confidence: 0.96 }], smile: 0.93, best: true, burst }, '09:49') });
}
