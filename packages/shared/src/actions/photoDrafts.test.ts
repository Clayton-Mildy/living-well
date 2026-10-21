import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, live, DomainError, type ClubState, type Photo } from '../index';
import { libraryPhotos, pendingPhotos, photoActivities, sentToday, sessionPhotos, sessionPictures } from '../rules/activity';
import { draftsOf } from '../rules/photoAi';
import { approvalTotal } from '../rules/approvals';
import { lunchPhotosOn, teaPhotosOn, visibleLunchPhotos } from '../rules/kitchen';

const T = '2026-10-21';
const clock = { today: T, nowMin: 600 }; // Wed 21 Oct, 10:00: Hendra (m2), Bambang (m10) and Tjahjadi (m20) are in; Keroncong sing-along (Dinar) is next at 10:30
let n = 0;
/** The demo club without Dinar's seeded drafts (they have their own test), so a test sees only the shots it takes. */
const fresh = (): ClubState => produce(buildSeed().citra, (d) => { for (const p of Object.values(d.photos)) if (p.visibility === 'draft') delete d.photos[p.id]; });
const seeded = (): ClubState => buildSeed().citra;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, as(s, uid), clk, `d${++n}`);
const step = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => run(s, name, input, uid, clk).state;
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const note = (s: ClubState, kind: string) => live(s.notifications).filter((x) => x.kind === kind && x.createdAt.startsWith(`${T}T10:00`));
const feedKeys = (s: ClubState) => Object.values(s.activity).filter((a) => a.at.startsWith(`${T}T10:00`)).map((a) => a.key);
const famPhotos = (s: ClubState, uid: string) => Object.keys(projectForFamily(s, uid).photos);
/** Take one shot with the quick camera; returns the new state and the draft. */
const shoot = (s: ClubState, uid: string, extra: object = {}) => { const r = run(s, 'photo.capture', { media: 'photo', mediaId: `md_${++n}`, ...extra }, uid); return { s: r.state, p: r.state.photos[r.result.photoId as string] }; };
/** Shoot until the AI files a shot under the wanted kind. */
const shootKind = (s: ClubState, uid: string, kind: 'people' | 'scene' | 'food') => {
  for (let i = 0; i < 60; i++) { const r = shoot(s, uid); if (r.p.ai!.kind === kind) return r; }
  throw new Error('no ' + kind + ' shot in 60 tries');
};

describe('photo.capture', () => {
  it('a teacher’s shot is a private draft at the minute it was taken, with the session and the AI’s suggestion; nothing is told to anybody', () => {
    const { s, p } = shoot(fresh(), 's5');
    expect(p).toMatchObject({ date: T, time: '10:00', media: 'photo', takenBy: 's5', visibility: 'draft', createdBy: 'staff:s5' });
    expect(p.mediaId).toMatch(/^md_/);
    expect(p.ai).toMatchObject({ kind: expect.stringMatching(/people|scene/), at: `${T}T10:00` });
    expect(p.activity).toBe('Keroncong sing-along'); // the session coming up
    expect(p.kind).toBe(p.ai!.kind === 'scene' ? 'activity' : p.memberIds.length === 1 ? 'solo' : 'group');
    for (const id of p.memberIds) expect(['m2', 'm10', 'm20']).toContain(id); // only people who are in the club
    expect(Object.values(s.notifications).filter((x) => x.createdAt.startsWith(`${T}T10:00`))).toHaveLength(0);
    expect(feedKeys(s)).toEqual([]);
    expect(draftsOf(s, 's5').map((x) => x.id)).toEqual([p.id]);
    expect(draftsOf(s, 's6')).toEqual([]);
  });

  it('is deterministic (the browser and the server agree) and only the activity team, management and the kitchen may shoot', () => {
    const a = execute(fresh(), 'photo.capture', { media: 'photo', mediaId: 'md_x', burst: 'b1' }, as(fresh(), 's5'), clock, 'mx');
    const b = execute(fresh(), 'photo.capture', { media: 'photo', mediaId: 'md_x', burst: 'b1' }, as(fresh(), 's5'), clock, 'mx');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
    for (const uid of ['s9', 's2', 's3', 's6']) expect(() => run(fresh(), 'photo.capture', { media: 'photo' }, uid)).not.toThrow();
    for (const uid of ['s1', 's8', 's10', 'f1']) fails(fresh(), 'photo.capture', { media: 'photo' }, uid, 'err.forbidden');
    fails(fresh(), 'photo.capture', { media: 'gif' }, 's5', 'err.invalid');
  });

  it('the kitchen’s shot is food: lunch before 14:00, afternoon tea after; a clip keeps its length', () => {
    const lunch = shoot(fresh(), 's2').p;
    expect(lunch).toMatchObject({ kind: 'lunch', activity: 'lunch', memberIds: [], visibility: 'draft', ai: { kind: 'food', meal: 'lunch' } });
    const tea = run(fresh(), 'photo.capture', { media: 'photo' }, 's2', { today: T, nowMin: 15 * 60 + 5 });
    expect(tea.state.photos[tea.result.photoId as string]).toMatchObject({ kind: 'lunch', activity: 'tea', ai: { kind: 'food', meal: 'tea' } });
    const clip = shoot(fresh(), 's5', { media: 'video', durationSec: 9, mediaId: 'md_clip' }).p;
    expect(clip).toMatchObject({ media: 'video', durationSec: 9 });
  });

  it('shots of one burst: exactly one best, and deleting it hands the star to the next', () => {
    let s = fresh();
    const made: Photo[] = [];
    for (let i = 0; i < 6; i++) { const r = shoot(s, 's5', { burst: 'b' + (i < 3 ? 1 : 2) }); s = r.s; made.push(r.p); }
    const mine = (b: string) => draftsOf(s, 's5').filter((p) => p.ai?.burst === b);
    for (const b of ['b1', 'b2']) {
      const usable = mine(b).filter((p) => p.ai!.kind === 'people' && !p.ai!.blurry);
      expect(mine(b).filter((p) => p.ai!.best).length).toBe(usable.length >= 2 ? 1 : 0);
      const best = mine(b).find((p) => p.ai!.best);
      if (best) {
        s = step(s, 'photo.deleteDraft', { id: best.id }, 's5');
        const left = mine(b).filter((p) => p.ai!.kind === 'people' && !p.ai!.blurry);
        expect(mine(b).filter((p) => p.ai!.best).length).toBe(left.length >= 2 ? 1 : 0);
      }
    }
  });
});

describe('photo.editDraft / photo.deleteDraft', () => {
  it('changes who is in a draft, the session, the meal; the suggestion stays on it but is marked as looked at', () => {
    const { s, p } = shootKind(fresh(), 's5', 'people');
    const e = step(s, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m10'] }, 's5');
    expect(e.photos[p.id]).toMatchObject({ kind: 'solo', memberIds: ['m10'], visibility: 'draft', activity: 'Keroncong sing-along', ai: { kind: 'people', reviewed: true } });
    expect(e.photos[p.id].ai!.faces).toEqual(p.ai!.faces);
    const g = step(e, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m10', 'm2'], activity: 'Batik painting' }, 's5');
    expect(g.photos[p.id]).toMatchObject({ kind: 'group', memberIds: ['m10', 'm2'], activity: 'Batik painting' });
    const scene = step(g, 'photo.editDraft', { id: p.id, kind: 'scene', activity: 'Batik painting' }, 's5');
    expect(scene.photos[p.id]).toMatchObject({ kind: 'activity', memberIds: [], activity: 'Batik painting', date: T });
    fails(g, 'photo.editDraft', { id: p.id, kind: 'scene', activity: 'Mahjong club' }, 's5', 'activity.err.picSession');
    fails(g, 'photo.editDraft', { id: p.id, kind: 'scene', activity: 'Batik painting', date: '2026-10-01' }, 's5', 'activity.err.picDate');
    fails(g, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['nobody'] }, 's5', 'err.notFound');
    fails(g, 'photo.editDraft', { id: p.id, kind: 'food' }, 's5', 'err.forbidden'); // the activity team does not file food
  });

  it('the kitchen files food only (lunch or tea); management may file anything', () => {
    const k = shoot(fresh(), 's3');
    const tea = step(k.s, 'photo.editDraft', { id: k.p.id, kind: 'food', meal: 'tea' }, 's3');
    expect(tea.photos[k.p.id]).toMatchObject({ kind: 'lunch', activity: 'tea', ai: { reviewed: true } });
    fails(k.s, 'photo.editDraft', { id: k.p.id, kind: 'people', memberIds: ['m2'] }, 's3', 'err.forbidden');
    const m = shoot(fresh(), 's9');
    expect(step(m.s, 'photo.editDraft', { id: m.p.id, kind: 'food' }, 's9').photos[m.p.id]).toMatchObject({ kind: 'lunch', activity: 'lunch' });
  });

  it('only the person who took a draft can edit or delete it; it is "not found" to anyone else', () => {
    const { s, p } = shoot(fresh(), 's5');
    fails(s, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m2'] }, 's6', 'err.notFound');
    fails(s, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m2'] }, 's9', 'err.notFound');
    fails(s, 'photo.deleteDraft', { id: p.id }, 's6', 'err.notFound');
    fails(s, 'photo.deleteDraft', { id: 'p_nothing' }, 's5', 'err.notFound');
    // moderation never touches a draft either
    fails(s, 'photo.remove', { photoId: p.id, reason: 'blurry' }, 's9', 'err.notFound');
    fails(s, 'photo.retag', { photoId: p.id, memberIds: ['m2'] }, 's9', 'err.notFound');
  });

  it('deleting drops it from the drafts; deleting twice says it is gone', () => {
    const a = shoot(fresh(), 's5');
    const b = shoot(a.s, 's5');
    const d = step(b.s, 'photo.deleteDraft', { ids: [a.p.id, b.p.id] }, 's5');
    expect(draftsOf(d, 's5')).toEqual([]);
    expect(d.photos[a.p.id].deletedAt).toBeTruthy();
    expect(run(b.s, 'photo.deleteDraft', { ids: [a.p.id, b.p.id] }, 's5').result.deleted).toBe(2);
    fails(d, 'photo.deleteDraft', { id: a.p.id }, 's5', 'drafts.err.gone');
    fails(d, 'photo.editDraft', { id: a.p.id, kind: 'people', memberIds: ['m2'] }, 's5', 'drafts.err.gone');
  });
});

describe('photo.sendDrafts', () => {
  it('a teacher’s people draft goes to Approvals as a pending photo: nobody is told, families do not see it', () => {
    const { s, p } = shootKind(fresh(), 's5', 'people');
    const ready = step(s, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m10'] }, 's5');
    const r = run(ready, 'photo.sendDrafts', { ids: [p.id] }, 's5');
    expect(r.result).toMatchObject({ sent: 1, photoIds: [p.id], skipped: [], pending: true });
    expect(r.state.photos[p.id]).toMatchObject({ kind: 'solo', memberIds: ['m10'], visibility: 'pending', takenBy: 's5', activity: 'Keroncong sing-along' });
    expect(r.state.photos[p.id].ai).toBeTruthy(); // the suggestion is kept for the record
    expect(pendingPhotos(r.state).map((x) => x.id)).toEqual([p.id]);
    expect(approvalTotal(r.state)).toBe(approvalTotal(ready) + 1);
    expect(sentToday(r.state, T).map((x) => x.id)).toContain(p.id);
    expect(note(r.state, 'activity.notif.newPhoto')).toHaveLength(0);
    expect(famPhotos(r.state, 'fm10_0')).not.toContain(p.id);
    expect(draftsOf(r.state, 's5')).toEqual([]);
    fails(r.state, 'photo.sendDrafts', { ids: [p.id] }, 's5', 'drafts.err.gone'); // already sent
  });

  it('management’s send is visible at once and tells the family; the whole batch in one call', () => {
    let s = fresh();
    const a = shoot(s, 's9'); s = a.s;
    const b = shoot(s, 's9'); s = b.s;
    s = step(s, 'photo.editDraft', { id: a.p.id, kind: 'people', memberIds: ['m10'] }, 's9');
    s = step(s, 'photo.editDraft', { id: b.p.id, kind: 'people', memberIds: ['m10', 'm2'] }, 's9');
    const r = run(s, 'photo.sendDrafts', { ids: [a.p.id, b.p.id] }, 's9');
    expect(r.result).toMatchObject({ sent: 2, pending: false });
    expect(r.state.photos[a.p.id].visibility).toBe('visible');
    expect(r.state.photos[b.p.id]).toMatchObject({ visibility: 'visible', kind: 'group' });
    const ns = note(r.state, 'activity.notif.newPhotos');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toUsers: ['fm10_0'], params: { n: 2 } });
    expect(famPhotos(r.state, 'fm10_0')).toEqual(expect.arrayContaining([a.p.id, b.p.id]));
    expect(feedKeys(r.state)).toContain('activity.feed.photo');
  });

  it('a picture of a session: pending for a teacher, visible for management; it counts as a session picture only once sent', () => {
    const { s, p } = shootKind(fresh(), 's5', 'scene');
    const session = { name: 'Keroncong sing-along' };
    expect(sessionPhotos(s, T, session)).toEqual([]);
    expect(sessionPictures(s, T, session)).toEqual([]);
    const r = run(s, 'photo.sendDrafts', { ids: [p.id] }, 's5');
    expect(r.state.photos[p.id]).toMatchObject({ kind: 'activity', activity: 'Keroncong sing-along', visibility: 'pending' });
    expect(sessionPhotos(r.state, T, session).map((x) => x.id)).toEqual([p.id]);
    expect(sessionPictures(r.state, T, session)).toMatchObject([{ state: 'pending' }]);
    const m = shootKind(fresh(), 's9', 'scene');
    const sent = step(m.s, 'photo.sendDrafts', { ids: [m.p.id] }, 's9');
    expect(sent.photos[m.p.id].visibility).toBe('visible');
    expect(sessionPictures(sent, T, session)).toMatchObject([{ state: 'approved' }]);
  });

  it('food: the kitchen’s lunch and tea drafts join the day’s galleries, pending; management’s are visible at once', () => {
    const l = shoot(fresh(), 's2');
    const t = shoot(l.s, 's2');
    const s = step(t.s, 'photo.editDraft', { id: t.p.id, kind: 'food', meal: 'tea' }, 's2');
    const r = run(s, 'photo.sendDrafts', { ids: [l.p.id, t.p.id] }, 's2');
    expect(r.result).toMatchObject({ sent: 2, pending: true });
    expect(lunchPhotosOn(r.state, T).map((x) => [x.id, x.visibility])).toEqual([[l.p.id, 'pending']]);
    expect(teaPhotosOn(r.state, T).map((x) => [x.id, x.visibility])).toEqual([[t.p.id, 'pending']]);
    expect(visibleLunchPhotos(r.state, T)).toEqual([]);
    expect(r.state.photos[l.p.id]).toMatchObject({ kind: 'lunch', activity: 'lunch', visibility: 'pending' });
    expect(pendingPhotos(r.state)).toHaveLength(2);
    const m = shoot(fresh(), 's9');
    const food = step(m.s, 'photo.editDraft', { id: m.p.id, kind: 'food' }, 's9');
    const done = step(food, 'photo.sendDrafts', { ids: [m.p.id] }, 's9');
    expect(visibleLunchPhotos(done, T).map((x) => x.id)).toEqual([m.p.id]);
    expect(done.photos[m.p.id].approved).toMatchObject({ by: 's9' });
    expect(note(done, 'kitchen.notif.lunchPhoto')).toHaveLength(1); // the families of today’s diners hear it once
  });

  it('a draft that is not ready stays a draft and is reported; if none is ready the call fails with the reason', () => {
    const a = shootKind(fresh(), 's5', 'people');
    const none = step(a.s, 'photo.editDraft', { id: a.p.id, kind: 'people', memberIds: [] }, 's5');
    fails(none, 'photo.sendDrafts', { ids: [a.p.id] }, 's5', 'drafts.err.needPeople');
    const b = shootKind(none, 's5', 'scene');
    const noSession = step(b.s, 'photo.editDraft', { id: b.p.id, kind: 'scene', activity: '' }, 's5');
    fails(noSession, 'photo.sendDrafts', { ids: [b.p.id] }, 's5', 'drafts.err.needSession');
    const ready = step(noSession, 'photo.editDraft', { id: a.p.id, kind: 'people', memberIds: ['m2'] }, 's5');
    const r = run(ready, 'photo.sendDrafts', { ids: [a.p.id, b.p.id] }, 's5');
    expect(r.result).toMatchObject({ sent: 1, skipped: [{ id: b.p.id, code: 'drafts.err.needSession' }] });
    expect(r.state.photos[b.p.id].visibility).toBe('draft');
    expect(draftsOf(r.state, 's5').map((x) => x.id)).toEqual([b.p.id]);
  });

  it('only the taker can send, and the kitchen cannot send people photos', () => {
    const { s, p } = shootKind(fresh(), 's5', 'people');
    const ready = step(s, 'photo.editDraft', { id: p.id, kind: 'people', memberIds: ['m2'] }, 's5');
    fails(ready, 'photo.sendDrafts', { ids: [p.id] }, 's6', 'err.notFound');
    fails(ready, 'photo.sendDrafts', { ids: [p.id] }, 's9', 'err.notFound');
    fails(ready, 'photo.sendDrafts', { ids: [p.id] }, 's2', 'err.notFound');
  });
});

describe('a draft never leaks', () => {
  it('is in no library, no family projection, no approval list, no session or lunch picture, and no photo count', () => {
    let s = fresh();
    const kinds: Photo[] = [];
    for (const [uid, k] of [['s5', 'people'], ['s5', 'scene'], ['s2', 'food']] as const) {
      const r = k === 'food' ? shoot(s, uid) : shootKind(s, uid, k);
      s = r.s;
      kinds.push(r.p);
    }
    // a people draft tagged with a member, to be sure the tag alone does not expose it
    s = step(s, 'photo.editDraft', { id: kinds[0].id, kind: 'people', memberIds: ['m10', 'm2'] }, 's5');
    const ids = kinds.map((x) => x.id);
    for (const p of live(s.photos)) if (ids.includes(p.id)) expect(p.visibility).toBe('draft');
    for (const id of ids) expect(libraryPhotos(s).some((x) => x.id === id)).toBe(false);
    expect(photoActivities(s)).toEqual(photoActivities(fresh()));
    expect(pendingPhotos(s)).toEqual([]);
    expect(approvalTotal(s)).toBe(approvalTotal(fresh()));
    expect(sentToday(s, T).some((x) => ids.includes(x.id))).toBe(false);
    expect(sessionPhotos(s, T, { name: 'Keroncong sing-along' })).toEqual([]);
    expect(sessionPictures(s, T, { name: 'Keroncong sing-along' })).toEqual([]);
    expect(lunchPhotosOn(s, T)).toEqual([]);
    expect(teaPhotosOn(s, T)).toEqual([]);
    for (const uid of ['fm10_0', 'fm2_0', 'f1']) for (const id of ids) expect(famPhotos(s, uid)).not.toContain(id);
    expect(Object.keys(projectForFamily(s, 'fm10_0').photos).sort()).toEqual(Object.keys(projectForFamily(fresh(), 'fm10_0').photos).sort());
    // nothing was told to anybody, and nothing was written to the club feed
    expect(Object.values(s.notifications).filter((x) => x.createdAt.startsWith(`${T}T10:00`))).toHaveLength(0);
    expect(feedKeys(s)).toEqual([]);
  });
});

describe('the demo seed', () => {
  it('Dinar has five drafts from this morning that nobody else sees and no family page shows', () => {
    const s = seeded();
    const mine = draftsOf(s, 's5');
    expect(mine.map((p) => p.id)).toEqual(['p-draft-5', 'p-draft-4', 'p-draft-3', 'p-draft-2', 'p-draft-1']);
    for (const p of mine) { expect(p.time < '09:58').toBe(true); expect(p.ai).toBeTruthy(); expect(p.mediaId).toMatch(/^md_demo_/); }
    expect(mine.filter((p) => p.ai!.best).map((p) => p.id)).toEqual(['p-draft-5']);
    expect(draftsOf(s, 's6')).toEqual([]);
    expect(pendingPhotos(s)).toEqual([]);
    expect(approvalTotal(s)).toBe(approvalTotal(fresh()));
    for (const uid of ['fm10_0', 'fm2_0', 'fm20_0', 'f1']) for (const p of mine) expect(famPhotos(s, uid)).not.toContain(p.id);
    // they can all be sent as they are: the two that need nothing, and the rest are sendable too
    const r = run(s, 'photo.sendDrafts', { ids: mine.map((p) => p.id) }, 's5');
    expect(r.result).toMatchObject({ sent: 5, skipped: [] });
  });
});

describe('photo.unsend', () => {
  const two = (uid: string) => {
    let s = fresh();
    const a = shootKind(s, uid, 'people'); s = a.s;
    const b = shootKind(s, uid, 'people'); s = b.s;
    s = step(s, 'photo.editDraft', { id: a.p.id, kind: 'people', memberIds: ['m10'] }, uid);
    s = step(s, 'photo.editDraft', { id: b.p.id, kind: 'people', memberIds: ['m10'] }, uid);
    return { s, ids: [a.p.id, b.p.id] };
  };

  it('a teacher’s two sent photos go back to drafts: no approval waiting, nothing told to a family', () => {
    const { s, ids } = two('s5');
    const sent = step(s, 'photo.sendDrafts', { ids }, 's5');
    expect(sent.photos[ids[0]].sentAt).toBe(`${T}T10:00`);
    const before = approvalTotal(s);
    expect(approvalTotal(sent)).toBe(before + 2);
    const r = run(sent, 'photo.unsend', { ids }, 's5', { today: T, nowMin: 605 });
    expect(r.result).toMatchObject({ undone: 2 });
    for (const id of ids) {
      expect(r.state.photos[id].visibility).toBe('draft');
      expect(r.state.photos[id].approved).toBeUndefined();
      expect(r.state.photos[id].sentAt).toBeUndefined();
    }
    expect(approvalTotal(r.state)).toBe(before);
    expect(pendingPhotos(r.state)).toEqual([]);
    expect(draftsOf(r.state, 's5').map((x) => x.id).sort()).toEqual([...ids].sort());
    expect(live(r.state.notifications).filter((x) => x.ref?.type === 'photo' && ids.includes(x.ref.id))).toEqual([]);
  });

  it('management’s visible people photos: the family notification and the feed line go with them', () => {
    const { s, ids } = two('s9');
    const sent = step(s, 'photo.sendDrafts', { ids }, 's9');
    expect(note(sent, 'activity.notif.newPhotos')).toHaveLength(1);
    expect(feedKeys(sent)).toContain('activity.feed.photo');
    const r = run(sent, 'photo.unsend', { ids }, 's9', { today: T, nowMin: 602 });
    expect(r.state.photos[ids[0]].visibility).toBe('draft');
    expect(famPhotos(r.state, 'fm10_0')).not.toContain(ids[0]);
    expect(note(r.state, 'activity.notif.newPhotos')).toHaveLength(0);
    expect(Object.values(r.state.notifications).filter((x) => x.ref?.type === 'photo' && ids.includes(x.ref.id))).toEqual([]);
    expect(Object.values(r.state.activity).filter((a) => ids.includes(String(a.params.photoId)))).toEqual([]);
  });

  it('a visible lunch photo leaves the day’s gallery and its announcement', () => {
    const m = shoot(fresh(), 's9');
    const food = step(m.s, 'photo.editDraft', { id: m.p.id, kind: 'food' }, 's9');
    const sent = step(food, 'photo.sendDrafts', { ids: [m.p.id] }, 's9');
    expect(sent.dayMenus[T].photoIds).toContain(m.p.id);
    expect(note(sent, 'kitchen.notif.lunchPhoto')).toHaveLength(1);
    const r = run(sent, 'photo.unsend', { ids: [m.p.id] }, 's9', { today: T, nowMin: 603 });
    expect(r.state.dayMenus[T].photoIds ?? []).not.toContain(m.p.id);
    expect(visibleLunchPhotos(r.state, T)).toEqual([]);
    expect(r.state.photos[m.p.id].visibility).toBe('draft');
    expect(note(r.state, 'kitchen.notif.lunchPhoto')).toHaveLength(0);
    expect(Object.values(r.state.activity).filter((a) => a.params.photoId === m.p.id)).toEqual([]);
  });

  it('more than 10 minutes later it is too late; ten exactly still works', () => {
    const { s, ids } = two('s5');
    const sent = step(s, 'photo.sendDrafts', { ids }, 's5');
    fails(sent, 'photo.unsend', { ids }, 's5', 'drafts.err.tooLate', { today: T, nowMin: 611 });
    expect(run(sent, 'photo.unsend', { ids }, 's5', { today: T, nowMin: 610 }).result).toMatchObject({ undone: 2 });
  });

  it('another teacher cannot take back my photos; a draft that was never sent cannot be unsent', () => {
    const { s, ids } = two('s5');
    const sent = step(s, 'photo.sendDrafts', { ids }, 's5');
    fails(sent, 'photo.unsend', { ids }, 's6', 'err.forbidden', { today: T, nowMin: 602 });
    fails(sent, 'photo.unsend', { ids }, 's2', 'err.forbidden');
    fails(s, 'photo.unsend', { ids }, 's5', 'drafts.err.gone');
  });

  it('a tea photo comes back as a tea draft, and sending it again files it under tea with the tea announcement', () => {
    const m = shoot(fresh(), 's9');
    const tea = step(m.s, 'photo.editDraft', { id: m.p.id, kind: 'food', meal: 'tea' }, 's9');
    const sent = step(tea, 'photo.sendDrafts', { ids: [m.p.id] }, 's9');
    expect(sent.dayMenus[T].teaPhotoIds).toContain(m.p.id);
    expect(note(sent, 'kitchen.notif.teaPhoto')).toHaveLength(1);
    const back = step(sent, 'photo.unsend', { ids: [m.p.id] }, 's9', { today: T, nowMin: 603 });
    expect(back.photos[m.p.id]).toMatchObject({ visibility: 'draft', activity: 'tea' });
    expect(back.dayMenus[T].teaPhotoIds ?? []).not.toContain(m.p.id);
    expect(note(back, 'kitchen.notif.teaPhoto')).toHaveLength(0);
    const again = step(back, 'photo.sendDrafts', { ids: [m.p.id] }, 's9');
    expect(again.dayMenus[T].teaPhotoIds).toContain(m.p.id);
    expect(again.dayMenus[T].photoIds ?? []).not.toContain(m.p.id);
    expect(note(again, 'kitchen.notif.teaPhoto')).toHaveLength(1);
    expect(note(again, 'kitchen.notif.lunchPhoto')).toHaveLength(0);
    expect(teaPhotosOn(again, T).map((x) => x.id)).toEqual([m.p.id]);
  });

  it('the 10 minutes run across midnight: sent 23:55, back at 00:04 works, at 00:06 it is too late', () => {
    const { s, ids } = two('s5');
    const sent = step(s, 'photo.sendDrafts', { ids }, 's5', { today: T, nowMin: 23 * 60 + 55 });
    const next = '2026-10-22';
    fails(sent, 'photo.unsend', { ids }, 's5', 'drafts.err.tooLate', { today: next, nowMin: 6 });
    expect(run(sent, 'photo.unsend', { ids }, 's5', { today: next, nowMin: 4 }).result).toMatchObject({ undone: 2 });
  });
});
