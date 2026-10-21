// Quick camera drafts (KC round 7, "shoot first, sort later"). Activity, kitchen and management shoot with a button on every page; each shot becomes a DRAFT
// (`visibility: 'draft'`) that only the person who took it can see. The simulated AI (`rules/photoAi.ts`) suggests what the shot is: people (and who), a picture of the
// session running, or food. The taker fixes what is wrong (`photo.editDraft`), deletes the bad ones (`photo.deleteDraft`) and sends the rest in one go
// (`photo.sendDrafts`): each becomes the real photo it was filed as, with the same rules as before: management's are visible at once and tell the families,
// everyone else's wait in Approvals. Until then a draft is in no library, no family page, no approval list and no duty count.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { ClubState, ISODate, Photo, PhotoAi } from '../types';
import { DomainError, defineAction, hasRole, isMgmt, isStaff, original, type Ctx } from './framework';
import { requireMember } from './helpers';
import { announceLunchPhoto, ensureDayMenu } from './kitchen';
import { feedFor, notifyNewPhotos } from './photos';
import { isPendingRow } from '../rules/core';
import { LOG_BACK_DAYS, curAct, hashOf, logDateOk, pictureSessions, toneOf, type CurAct } from '../rules/activity';
import { analyzePhoto, bestOfBurst, draftKindOf, draftKindsFor, draftMeal, sendProblem, TEA_FROM, type DraftKind } from '../rules/photoAi';
import { daysBetween, toMin, uniq } from '../util';

/** How long after sending the person who sent photos can still take them back (`photo.unsend`). */
const UNSEND_MIN = 10;
const draftTakers = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'activity', 'mgmt', 'kitchen');
const MEDIA_ID = /^[A-Za-z0-9_.-]{1,100}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  return r.data;
}

const captureSchema = z.object({
  media: z.enum(['photo', 'video']),
  /** the uploaded image or clip (POST /api/media) */
  mediaId: z.string().regex(MEDIA_ID).optional(),
  durationSec: z.number().int().min(1).max(600).optional(),
  /** the camera's key for shots taken within a few seconds of each other (BURST_GAP_MS) */
  burst: z.string().regex(/^[A-Za-z0-9_.-]{1,60}$/).optional(),
});
type CaptureInput = z.infer<typeof captureSchema>;

const editSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['people', 'scene', 'food']),
  /** people: who is in it (the whole list, replacing the AI's) */
  memberIds: z.array(z.string().min(1)).max(60).optional(),
  /** people and scene: the session (its name or catalogue id); '' clears it */
  activity: z.string().trim().max(120).optional(),
  /** scene: the day of the session (today or one of the last LOG_BACK_DAYS days) */
  date: z.string().regex(ISO).optional(),
  /** food */
  meal: z.enum(['lunch', 'tea']).optional(),
});
type EditInput = z.infer<typeof editSchema>;

const idsSchema = z.object({ id: z.string().min(1).optional(), ids: z.array(z.string().min(1)).min(1).max(200).optional() }).refine((x) => !!x.id || !!x.ids);
const sendSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200), notify: z.boolean().optional() });

/** My draft by id: it must exist and be mine (anyone else's is "not found" to them: a draft is private). Null when it is no longer a draft (sent or deleted elsewhere). */
function myDraft(d: Draft<ClubState>, id: string, ctx: Ctx): Draft<Photo> | null {
  const p = d.photos[id];
  if (!p) ctx.fail('err.notFound');
  if (p.takenBy !== ctx.user.id) ctx.fail('err.notFound');
  return p.visibility === 'draft' && !p.deletedAt ? p : null;
}

/** What a draft is filed under, from the AI's suggestion and the session at the moment of the shot. */
function fileUnder(ai: PhotoAi, cur: CurAct): Pick<Photo, 'kind' | 'memberIds'> & { activity?: string } {
  if (ai.kind === 'food') return { kind: 'lunch', memberIds: [], activity: ai.meal ?? 'lunch' };
  if (ai.kind === 'scene') return { kind: 'activity', memberIds: [], ...(cur.kind === 'session' ? { activity: cur.name } : {}) };
  const ids = uniq(ai.faces.flatMap((f) => (f.memberId ? [f.memberId] : [])));
  return { kind: ids.length === 1 ? 'solo' : 'group', memberIds: ids, ...(cur.kind === 'general' ? {} : { activity: cur.name }) };
}

/** Re-mark which shot of a burst is the best (after one joins or leaves it). Reads the plain base state to find the mates, so only they become drafts. */
function markBest(d: Draft<ClubState>, takerId: string, burst: string, extra?: Draft<Photo>) {
  const base = original(d)?.photos ?? {};
  const ids = Object.values(base).filter((p) => p.visibility === 'draft' && !p.deletedAt && p.takenBy === takerId && p.ai?.burst === burst).map((p) => p.id);
  if (extra && !ids.includes(extra.id)) ids.push(extra.id);
  const shots = ids.map((id) => d.photos[id]).filter((p) => p.visibility === 'draft' && !p.deletedAt);
  const best = bestOfBurst(shots as Photo[]);
  for (const p of shots) if (p.ai) { if (p.id === best) p.ai.best = true; else delete p.ai.best; }
}

export const photoDraftActions = [
  // A shot from the quick camera: a draft with the AI's suggestion on it. Nothing is told to anybody.
  defineAction<CaptureInput>({
    name: 'photo.capture',
    can: (u) => draftTakers(u),
    parse: (raw) => parseWith(captureSchema, raw),
    run(d, input, ctx) {
      const view = d as unknown as ClubState;
      const pid = ctx.id('p');
      const cur = curAct(view, ctx.today, ctx.nowMin);
      const ai = analyzePhoto(view, { id: pid, date: ctx.today, time: ctx.now, media: input.media, mediaId: input.mediaId, burst: input.burst }, ctx.role, ctx.today, ctx.nowMin);
      const durationSec = input.media === 'video' ? input.durationSec ?? (input.mediaId ? undefined : 8 + (hashOf(pid) % 13)) : undefined;
      d.photos[pid] = {
        id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date: ctx.today, time: ctx.now, media: input.media, ...(durationSec ? { durationSec } : {}),
        tone: toneOf(pid), takenBy: ctx.user.id, visibility: 'draft', ...fileUnder(ai, cur), ai, ...(input.mediaId ? { mediaId: input.mediaId } : {}),
      };
      if (ai.burst) markBest(d, ctx.user.id, ai.burst, d.photos[pid]);
      ctx.result.photoId = pid;
      ctx.result.ai = ai.kind;
    },
  }),

  // Change what a draft is: the kind, who is in it, the session, the meal. The AI's suggestion stays on it (for the record) but is marked as looked at.
  defineAction<EditInput>({
    name: 'photo.editDraft',
    can: (u) => draftTakers(u),
    parse: (raw) => parseWith(editSchema, raw),
    run(d, input, ctx: Ctx) {
      const p = myDraft(d, input.id, ctx);
      if (!p) ctx.fail('drafts.err.gone');
      if (!draftKindsFor(ctx.role).includes(input.kind as DraftKind)) ctx.fail('err.forbidden');
      const view = d as unknown as ClubState;
      const was = draftKindOf(p);
      const resolve = (name: string | undefined) => (name ? d.activities[name]?.name ?? name : undefined);
      const keep = was === 'food' ? undefined : p.activity; // a session name carries over; a meal does not
      if (input.kind === 'people') {
        const ids = uniq(input.memberIds ?? (was === 'people' ? p.memberIds : []));
        for (const id of ids) if (isPendingRow(requireMember(d, id, ctx))) ctx.fail('err.memberPending');
        const activity = resolve(input.activity !== undefined ? input.activity : keep);
        p.kind = ids.length === 1 ? 'solo' : 'group';
        p.memberIds = ids;
        if (activity) p.activity = activity; else delete p.activity;
      } else if (input.kind === 'scene') {
        const date = (input.date ?? p.date) as ISODate;
        if (date > ctx.today || !logDateOk(ctx.today, date)) ctx.fail('activity.err.picDate', { n: LOG_BACK_DAYS });
        const activity = resolve(input.activity !== undefined ? input.activity : keep);
        if (activity && !pictureSessions(view, date).some((x) => x.activity?.name === activity)) ctx.fail('activity.err.picSession');
        p.kind = 'activity';
        p.memberIds = [];
        p.date = date;
        if (activity) p.activity = activity; else delete p.activity;
      } else {
        p.kind = 'lunch';
        p.memberIds = [];
        p.activity = input.meal ?? (was === 'food' ? draftMeal(p) : toMin(p.time) < toMin(TEA_FROM) ? 'lunch' : 'tea');
      }
      if (p.ai) p.ai.reviewed = true;
      if (p.ai?.burst) markBest(d, ctx.user.id, p.ai.burst);
    },
  }),

  // Throw drafts away. (They were never sent, so nothing else changes.)
  defineAction<{ ids: string[] }>({
    name: 'photo.deleteDraft',
    can: (u) => draftTakers(u),
    parse: (raw) => { const r = parseWith(idsSchema, raw); return { ids: uniq([...(r.id ? [r.id] : []), ...(r.ids ?? [])]) }; },
    run(d, input, ctx) {
      const gone: Draft<Photo>[] = [];
      for (const id of input.ids) {
        const p = myDraft(d, id, ctx);
        if (!p) continue;
        p.deletedAt = ctx.nowDT;
        gone.push(p);
      }
      if (!gone.length) ctx.fail('drafts.err.gone');
      for (const burst of uniq(gone.flatMap((p) => (p.ai?.burst ? [p.ai.burst] : [])))) markBest(d, ctx.user.id, burst);
      ctx.result.deleted = gone.length;
    },
  }),

  // Send drafts: each becomes the real photo it is filed as. One call for the whole batch. A draft that is not ready (nobody named, no session…) stays a draft and is
  // reported in `skipped`; nothing at all sent fails with the reason of the first one.
  defineAction<{ ids: string[]; notify?: boolean }>({
    name: 'photo.sendDrafts',
    can: (u) => draftTakers(u),
    parse: (raw) => { const r = parseWith(sendSchema, raw); return { ids: uniq(r.ids), ...(r.notify === undefined ? {} : { notify: r.notify }) }; },
    run(d, input, ctx: Ctx) {
      const view = d as unknown as ClubState;
      const mgmt = isMgmt(ctx.user);
      const todo: Draft<Photo>[] = [];
      for (const id of input.ids) { const p = myDraft(d, id, ctx); if (p) todo.push(p); }
      if (!todo.length) ctx.fail('drafts.err.gone');
      const sent: Draft<Photo>[] = [];
      const skipped: { id: string; code: string }[] = [];
      let firstProblem: { code: string; params?: Record<string, string | number> } | undefined;
      const forFamilies: { photo: { id: string; media: 'photo' | 'video' }; memberIds: string[] }[] = [];
      for (const p of todo) {
        const kind = draftKindOf(p);
        const problem = !draftKindsFor(ctx.role).includes(kind) ? { code: 'err.forbidden' } : sendProblem(view, p as Photo, ctx.today);
        if (problem) { skipped.push({ id: p.id, code: problem.code }); firstProblem ??= problem; continue; }
        if (kind === 'food') {
          const row = ensureDayMenu(d, p.date, ctx);
          const tea = draftMeal(p) === 'tea';
          const list = tea ? (row.teaPhotoIds ??= []) : (row.photoIds ??= []);
          list.push(p.id);
          p.activity = 'lunch';
          p.visibility = mgmt ? 'visible' : 'pending';
          if (mgmt) {
            p.approved = { at: ctx.nowDT, by: ctx.user.id };
            if (input.notify !== false) announceLunchPhoto(d, ctx, p.id);
            ctx.feed({ icon: tea ? 'local_cafe' : 'restaurant', key: tea ? 'kitchen.feed.teaPhoto' : 'kitchen.feed.lunchPhoto', params: { photoId: p.id } });
          } else ctx.feed({ icon: 'hourglass_top', key: tea ? 'kitchen.feed.teaPhotoPending' : 'kitchen.feed.lunchPhotoPending', params: { photoId: p.id } });
        } else {
          p.visibility = mgmt ? 'visible' : 'pending';
          if (mgmt) {
            feedFor(d, ctx, p);
            if (kind === 'people') forFamilies.push({ photo: { id: p.id, media: p.media }, memberIds: p.memberIds.slice() });
          }
        }
        p.sentAt = ctx.nowDT;
        sent.push(p);
      }
      if (!sent.length) ctx.fail(firstProblem!.code, firstProblem!.params);
      if (input.notify !== false) notifyNewPhotos(d, ctx, forFamilies); // management only: everyone else's wait for approval
      ctx.result.sent = sent.length;
      ctx.result.photoIds = sent.map((p) => p.id);
      ctx.result.skipped = skipped;
      ctx.result.pending = !mgmt;
    },
  }),

  // Take back photos that were just sent (the Undo on the "sent" toast): they return to Drafts as they were, and what the send told the families and
  // the feed is withdrawn. Only the sender (or management), and only within UNSEND_MIN minutes of the send.
  defineAction<{ ids: string[] }>({
    name: 'photo.unsend',
    can: (u) => isStaff(u),
    parse: (raw) => { const r = parseWith(idsSchema, raw); return { ids: uniq([...(r.id ? [r.id] : []), ...(r.ids ?? [])]) }; },
    run(d, input, ctx: Ctx) {
      const mgmt = isMgmt(ctx.user);
      const photos = input.ids.map((id) => d.photos[id] ?? ctx.fail('err.notFound'));
      for (const p of photos) {
        if ((p.visibility !== 'visible' && p.visibility !== 'pending') || p.deletedAt || !p.sentAt) ctx.fail('drafts.err.gone');
        if (!mgmt && p.createdBy !== ctx.actor) ctx.fail('err.forbidden');
        const ago = daysBetween(p.sentAt.slice(0, 10) as ISODate, ctx.today) * 1440 + ctx.nowMin - toMin(p.sentAt.slice(11, 16) as `${number}:${number}`);
        if (ago > UNSEND_MIN) ctx.fail('drafts.err.tooLate');
      }
      const ids = new Set(photos.map((p) => p.id));
      for (const p of photos) {
        p.visibility = 'draft';
        delete p.approved;
        delete p.sentAt;
        for (const row of Object.values(d.dayMenus)) {
          if (row.photoIds?.includes(p.id)) row.photoIds = row.photoIds.filter((x) => x !== p.id);
          if (row.teaPhotoIds?.includes(p.id)) row.teaPhotoIds = row.teaPhotoIds.filter((x) => x !== p.id);
        }
      }
      for (const n of Object.values(d.notifications)) if (n.ref?.type === 'photo' && ids.has(n.ref.id)) delete d.notifications[n.id];
      for (const a of Object.values(d.activity)) if (a.params.photoId !== undefined && ids.has(String(a.params.photoId))) delete d.activity[a.id];
      ctx.result.undone = photos.length;
    },
  }),
];
