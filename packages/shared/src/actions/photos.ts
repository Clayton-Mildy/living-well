// Photo actions: taking a photo (activity teachers and management) and the management review of what teachers take.
// A photo taken by anyone but management starts as `pending`: families never see it (the family projection only includes `visible`)
// until management approves it. Management's own photos publish at once. Families are told only when a photo becomes visible, and
// on approval only if the approver left "notify" on.
import { z } from 'zod';
import type { Draft } from 'immer';
import type { ClubState, ISODate, Photo } from '../types';
import { DomainError, defineAction, hasRole, isMgmt, type Ctx } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { isPendingRow } from '../rules/core';
import { LOG_BACK_DAYS, curAct, hashOf, logDateOk, pictureSessions, toneOf } from '../rules/activity';
import { announceLunchPhoto } from './kitchen';
import { uniq } from '../util';

const mgmtOnly = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'mgmt');
/** a member's profile photo can also be taken at the front desk or the health station (pending until management approves) */
const photoTakers = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'activity', 'mgmt', 'lobby', 'nurse');

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  return r.data;
}

/** The names a feed line shows for a list of members: the first three, then "+n". */
export const namesOf = (d: Draft<ClubState> | ClubState, ids: string[]) => ids.slice(0, 3).map((id) => shortOf(d, id)).join(', ') + (ids.length > 3 ? ` +${ids.length - 3}` : '');

/**
 * Tell the families of the tagged members that photos arrived: one notification per family user group, however many photos.
 * A single photo reads "New photo of {name}"; several read "{n} new photos of {name}" (a video in the mix makes it "photos and videos").
 * Two parents of one household get one notification between them.
 */
export function notifyNewPhotos(d: Draft<ClubState>, ctx: Ctx, items: { photo: { id: string; media: 'photo' | 'video' }; memberIds: string[] }[]) {
  const perUser = new Map<string, { ids: string[]; photos: Map<string, 'photo' | 'video'> }>();
  for (const it of items) {
    for (const mid of it.memberIds) {
      for (const u of familyUserIds(d, mid)) {
        const e = perUser.get(u) || perUser.set(u, { ids: [], photos: new Map() }).get(u)!;
        if (!e.ids.includes(mid)) e.ids.push(mid);
        e.photos.set(it.photo.id, it.photo.media);
      }
    }
  }
  const groups = new Map<string, { users: string[]; ids: string[]; photos: [string, 'photo' | 'video'][] }>();
  for (const [u, e] of perUser) {
    const photos = Array.from(e.photos.entries());
    const k = e.ids.join(',') + '|' + photos.map(([id]) => id).join(',');
    const g = groups.get(k) || { users: [], ids: e.ids, photos };
    g.users.push(u);
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    const n = g.photos.length;
    const video = g.photos.some(([, m]) => m === 'video');
    const name = g.ids.map((id) => shortOf(d, id)).join(', ');
    const kind = n === 1 ? (video ? 'activity.notif.newVideo' : 'activity.notif.newPhoto') : video ? 'activity.notif.newMedia' : 'activity.notif.newPhotos';
    ctx.notify({ toUsers: g.users, kind, params: n === 1 ? { name } : { name, n }, link: '/photos', memberId: g.ids[0], ref: { type: 'photo', id: g.photos[0][0] } });
  }
}
/** One photo, for the given members (also used when a visible photo gains new tags). */
export const notifyPhotoFamilies = (d: Draft<ClubState>, ctx: Ctx, memberIds: string[], p: { id: string; media: 'photo' | 'video' }) =>
  notifyNewPhotos(d, ctx, [{ photo: p, memberIds }]);

const feedFor = (d: Draft<ClubState>, ctx: Ctx, p: Pick<Photo, 'kind' | 'media' | 'memberIds' | 'activity'>) => {
  // an activity picture is of the session, not of people: its feed line names the activity
  if (p.kind === 'activity') { ctx.feed({ icon: 'photo_camera', key: 'activity.feed.activityPhoto', params: { activity: p.activity || '' } }); return; }
  const kindKey = p.kind === 'group' ? (p.media === 'video' ? 'groupVideo' : 'groupPhoto') : p.media === 'video' ? 'video' : 'photo';
  ctx.feed({ icon: p.media === 'video' ? 'videocam' : 'photo_camera', key: 'activity.feed.' + kindKey, params: { names: namesOf(d, p.memberIds) }, memberId: p.kind === 'solo' ? p.memberIds[0] : undefined });
};

// ---------- take ----------
const takeSchema = z.object({
  kind: z.enum(['solo', 'group']),
  memberIds: z.array(z.string().min(1)).min(1).max(60),
  activity: z.string().trim().max(120).optional(),
  media: z.enum(['photo', 'video']),
  durationSec: z.number().int().min(1).max(600).optional(),
  /** the uploaded image (POST /api/media): without it the design's tone placeholder shows */
  mediaId: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).optional(),
  /** management only: tell the families straight away (default). Teachers' photos tell nobody until they are approved. */
  notify: z.boolean().optional(),
});
type TakeInput = z.infer<typeof takeSchema>;

/** KC round 7: a picture of a session itself (no member tags), for today or one of the last LOG_BACK_DAYS days. */
const activitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** the activity's name (or its catalog id): it must be on that day's plan */
  activity: z.string().trim().min(1).max(120),
  mediaId: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).optional(),
});
type ActivityInput = z.infer<typeof activitySchema>;

const approveSchema = z.object({ photoIds: z.array(z.string().min(1)).min(1).max(200), notify: z.boolean().optional() });
const rejectSchema = z.object({ photoIds: z.array(z.string().min(1)).min(1).max(200), reason: z.string().trim().min(1).max(200) });

/** Plain text of a stored reason: a free-text reason may carry the "other:" prefix the moderation sheets use. */
const plainReason = (r: string) => (r.startsWith('other:') ? r.slice(6).trim() : r);

export const photoActions = [
  defineAction<TakeInput>({
    name: 'photo.take',
    can: (u) => photoTakers(u),
    parse: (raw) => parseWith(takeSchema, raw),
    run(d, input, ctx) {
      const ids = uniq(input.memberIds);
      for (const id of ids) {
        const m = requireMember(d, id, ctx);
        if (isPendingRow(m)) ctx.fail('err.memberPending');
      }
      if (input.kind === 'solo' && ids.length !== 1) ctx.fail('activity.err.soloOne');
      const pid = ctx.id('p');
      const cur = curAct(d as unknown as ClubState, ctx.today, ctx.nowMin);
      const given = input.activity ? d.activities[input.activity]?.name ?? input.activity : undefined;
      // a real clip (it has a file) whose length the device could not read has none; only the old simulated video invents one
      const durationSec = input.media === 'video' ? input.durationSec ?? (input.mediaId ? undefined : 8 + (hashOf(pid) % 13)) : undefined;
      const visibility: Photo['visibility'] = isMgmt(ctx.user) ? 'visible' : 'pending';
      d.photos[pid] = {
        id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date: ctx.today, time: ctx.now, kind: input.kind, media: input.media,
        ...(durationSec ? { durationSec } : {}), activity: given || cur.name, memberIds: ids, tone: toneOf(pid), takenBy: ctx.user.id, visibility,
        ...(input.mediaId ? { mediaId: input.mediaId } : {}),
      };
      if (visibility === 'visible') {
        if (input.notify !== false) notifyPhotoFamilies(d, ctx, ids, { id: pid, media: input.media });
        feedFor(d, ctx, { kind: input.kind, media: input.media, memberIds: ids });
      }
      ctx.result.photoId = pid;
      ctx.result.visibility = visibility;
    },
  }),

  // An activity picture: of the session, not of people. Activity teachers wait for management's approval; management's own are visible at once.
  defineAction<ActivityInput>({
    name: 'photo.addActivity',
    can: (u) => hasRole(u, 'activity', 'mgmt'),
    parse: (raw) => parseWith(activitySchema, raw),
    run(d, input, ctx) {
      if (!logDateOk(ctx.today, input.date)) ctx.fail('activity.err.picDate', { n: LOG_BACK_DAYS });
      const view = d as unknown as ClubState;
      const given = d.activities[input.activity]?.name ?? input.activity;
      const session = pictureSessions(view, input.date).find((x) => x.activity?.name === given);
      if (!session) ctx.fail('activity.err.picSession');
      const pid = ctx.id('p');
      const visibility: Photo['visibility'] = isMgmt(ctx.user) ? 'visible' : 'pending';
      d.photos[pid] = {
        id: pid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, date: input.date as ISODate, time: ctx.now, kind: 'activity', media: 'photo',
        activity: given, memberIds: [], tone: toneOf(pid), takenBy: ctx.user.id, visibility,
        ...(input.mediaId ? { mediaId: input.mediaId } : {}),
      };
      if (visibility === 'visible') feedFor(d, ctx, d.photos[pid]);
      ctx.result.photoId = pid;
      ctx.result.visibility = visibility;
    },
  }),

  defineAction<{ photoIds: string[]; notify?: boolean }>({
    name: 'photo.approve',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(approveSchema, raw),
    run(d, input, ctx) {
      const todo: Draft<Photo>[] = [];
      for (const id of uniq(input.photoIds)) {
        const p = d.photos[id];
        if (!p) ctx.fail('err.notFound');
        if (p.visibility === 'pending' && !p.deletedAt) todo.push(p); // one that somebody else already handled is skipped
      }
      if (!todo.length) ctx.fail('activity.err.notPending');
      approvePhotoRows(d, ctx, todo, input.notify !== false);
      ctx.result.approved = todo.length;
      ctx.result.photoIds = todo.map((p) => p.id);
      ctx.result.skipped = uniq(input.photoIds).length - todo.length;
    },
  }),

  defineAction<{ photoIds: string[]; reason: string }>({
    name: 'photo.reject',
    can: (u) => mgmtOnly(u),
    parse: (raw) => parseWith(rejectSchema, raw),
    run(d, input, ctx) {
      const todo: Draft<Photo>[] = [];
      for (const id of uniq(input.photoIds)) {
        const p = d.photos[id];
        if (!p) ctx.fail('err.notFound');
        if (p.visibility === 'pending' && !p.deletedAt) todo.push(p);
      }
      if (!todo.length) ctx.fail('activity.err.notPending');
      rejectPhotoRows(d, ctx, todo, input.reason);
      ctx.result.rejected = todo.length;
      ctx.result.photoIds = todo.map((p) => p.id);
      ctx.result.skipped = uniq(input.photoIds).length - todo.length;
    },
  }),
];

/** Approve pending photos (the Approvals hub and photo.approve): visible to families, who are told unless `notify` is off. */
export function approvePhotoRows(d: Draft<ClubState>, ctx: Ctx, todo: Draft<Photo>[], notify: boolean) {
  const forFamilies: { photo: { id: string; media: 'photo' | 'video' }; memberIds: string[] }[] = [];
  for (const p of todo) {
    p.visibility = 'visible';
    p.approved = { at: ctx.nowDT, by: ctx.user.id };
    if (p.kind === 'lunch') {
      if (notify) announceLunchPhoto(d, ctx, p.id); // the kitchen tells the families of the people who had lunch
      continue;
    }
    feedFor(d, ctx, p);
    if (notify) forFamilies.push({ photo: { id: p.id, media: p.media }, memberIds: p.memberIds.slice() });
  }
  notifyNewPhotos(d, ctx, forFamilies);
}

/** Reject pending photos with a reason: a soft delete the teachers cannot undo; each teacher hears once. */
export function rejectPhotoRows(d: Draft<ClubState>, ctx: Ctx, todo: Draft<Photo>[], rawReason: string) {
  const reason = plainReason(rawReason) || rawReason;
  for (const p of todo) {
    p.visibility = 'removed';
    p.moderated = { at: ctx.nowDT, by: ctx.user.id, reason };
    p.deletedAt = ctx.nowDT;
  }
  const byTaker = new Map<string, Draft<Photo>[]>();
  for (const p of todo) if (p.takenBy !== ctx.user.id && d.staff[p.takenBy] && !d.staff[p.takenBy].deletedAt) (byTaker.get(p.takenBy) || byTaker.set(p.takenBy, []).get(p.takenBy)!).push(p);
  for (const [who, all] of byTaker) {
    // an activity picture is told per session (the bell links back to that session, where the teacher can upload another); member photos are told as before
    const sessions = new Map<string, Draft<Photo>[]>();
    const ps: Draft<Photo>[] = [];
    for (const p of all) {
      if (p.kind !== 'activity') { ps.push(p); continue; }
      const k = `${p.date}|${p.activity || ''}`;
      (sessions.get(k) || sessions.set(k, []).get(k)!).push(p);
    }
    for (const sp of sessions.values()) {
      const f = sp[0];
      ctx.notify({ toUsers: [who], kind: sp.length === 1 ? 'activity.notif.activityPhotoRejected' : 'activity.notif.activityPhotosRejected', params: { activity: f.activity || '', n: sp.length, reason }, link: `/camera?tab=activity&date=${f.date}&act=${encodeURIComponent(f.activity || '')}`, ref: { type: 'photo', id: f.id } });
    }
    if (!ps.length) continue;
    const ids = uniq(ps.flatMap((p) => p.memberIds));
    ctx.notify({ toUsers: [who], kind: ps.length === 1 ? 'activity.notif.photoRejected' : 'activity.notif.photosRejected', params: { name: namesOf(d, ids), n: ps.length, reason }, link: '/camera?tab=library', memberId: ids[0], ref: { type: 'photo', id: ps[0].id } });
  }
}
