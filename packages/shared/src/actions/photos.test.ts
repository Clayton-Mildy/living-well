import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, live, DomainError, type ClubState } from '../index';
import { pendingPhotos, sentToday } from '../rules/activity';

const clock = { today: '2026-10-21', nowMin: 600 }; // Wed 21 Oct, 10:00
let n = 0;
const fresh = (): ClubState => buildSeed().citra;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, as(s, uid), clk, `t${++n}`);
const step = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => run(s, name, input, uid, clk).state;
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const note = (s: ClubState, kind: string) => live(s.notifications).filter((x) => x.kind === kind && x.createdAt.startsWith('2026-10-21T10:00'));
const feedKeys = (s: ClubState) => Object.values(s.activity).filter((a) => a.at.startsWith('2026-10-21T10:00')).map((a) => a.key);
const famPhotos = (s: ClubState, uid: string) => Object.keys(projectForFamily(s, uid).photos);
/** A teacher (Dinar, s5) takes a photo; returns the new state and the photo id. */
const take = (s: ClubState, input: object, uid = 's5', clk = clock) => { const r = run(s, 'photo.take', input, uid, clk); return { s: r.state, id: r.result.photoId as string }; };

describe('photo.take', () => {
  it('a teacher’s solo photo is pending: nobody is told, families do not see it, the image id is kept', () => {
    const r = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo', mediaId: 'abc123-DEF_45.x' }, 's5');
    const p = r.state.photos[r.result.photoId as string];
    expect(p).toMatchObject({ date: '2026-10-21', time: '10:00', kind: 'solo', media: 'photo', memberIds: ['m10'], takenBy: 's5', visibility: 'pending', mediaId: 'abc123-DEF_45.x', activity: 'Keroncong sing-along' });
    expect(p.approved).toBeUndefined();
    expect([0, 1, 2, 3, 4]).toContain(p.tone);
    expect(r.result).toMatchObject({ visibility: 'pending' });
    expect(note(r.state, 'activity.notif.newPhoto')).toHaveLength(0);
    expect(feedKeys(r.state)).not.toContain('activity.feed.photo');
    expect(famPhotos(r.state, 'fm10_0')).not.toContain(p.id);
    expect(pendingPhotos(r.state).map((x) => x.id)).toEqual([p.id]);
    expect(sentToday(r.state, '2026-10-21').map((x) => x.id)).toContain(p.id); // the teacher still sees what she sent
  });

  it('management’s own photo publishes at once: the family is told and the feed shows it; notify:false keeps it quiet', () => {
    const r = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo' }, 's9');
    const p = r.state.photos[r.result.photoId as string];
    expect(p).toMatchObject({ visibility: 'visible', takenBy: 's9' });
    const ns = note(r.state, 'activity.notif.newPhoto');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toUsers: ['fm10_0'], params: { name: 'Bapak Bambang' }, link: '/photos', ref: { type: 'photo', id: p.id } });
    expect(feedKeys(r.state)).toContain('activity.feed.photo');
    expect(famPhotos(r.state, 'fm10_0')).toContain(p.id);
    const quiet = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo', notify: false }, 's9');
    expect(quiet.state.photos[quiet.result.photoId as string].visibility).toBe('visible');
    expect(note(quiet.state, 'activity.notif.newPhoto')).toHaveLength(0);
    // notify is ignored for teachers: nothing is sent before approval either way
    expect(note(run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo', notify: true }, 's5').state, 'activity.notif.newPhoto')).toHaveLength(0);
  });

  it('a group video: duration from the input or a deterministic 8–20 s; one message per household once it is visible', () => {
    const r = run(fresh(), 'photo.take', { kind: 'group', memberIds: ['m1', 'm46', 'm2'], media: 'video' }, 's9');
    const p = r.state.photos[r.result.photoId as string];
    expect(p.media).toBe('video');
    expect(p.durationSec).toBeGreaterThanOrEqual(8);
    expect(p.durationSec).toBeLessThanOrEqual(20);
    const a = execute(fresh(), 'photo.take', { kind: 'group', memberIds: ['m1', 'm46', 'm2'], media: 'video' }, as(fresh(), 's9'), clock, 'mx');
    const b = execute(fresh(), 'photo.take', { kind: 'group', memberIds: ['m1', 'm46', 'm2'], media: 'video' }, as(fresh(), 's9'), clock, 'mx');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
    const ns = note(r.state, 'activity.notif.newVideo');
    expect(ns).toHaveLength(2); // Maria and Daniel (both parents) in one, Hendra's family in the other
    expect(ns.find((x) => x.toUsers.includes('f1'))).toMatchObject({ toUsers: ['f1', 'f2'], params: { name: 'Oma Lina, Opa Budi' } });
    expect(ns.find((x) => x.toUsers.includes('fm2_0'))?.toUsers).toEqual(['fm2_0', 'fm2_1']);
    const v = run(fresh(), 'photo.take', { kind: 'group', memberIds: ['m10', 'm2'], media: 'video', durationSec: 31 }, 's5');
    expect(v.state.photos[v.result.photoId as string]).toMatchObject({ durationSec: 31, visibility: 'pending' });
  });

  it('a real recorded clip (it has a file) keeps its own length, and has none when the device could not read it (the length is only invented for a simulated video)', () => {
    const real = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'video', durationSec: 12, mediaId: 'md_clip1' }, 's5');
    expect(real.state.photos[real.result.photoId as string]).toMatchObject({ media: 'video', durationSec: 12, mediaId: 'md_clip1', visibility: 'pending' });
    const unknown = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'video', mediaId: 'md_clip2' }, 's5');
    const p = unknown.state.photos[unknown.result.photoId as string];
    expect(p).toMatchObject({ media: 'video', mediaId: 'md_clip2', visibility: 'pending' });
    expect(p.durationSec).toBeUndefined();
    const photo = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo', durationSec: 12 }, 's5');
    expect(photo.state.photos[photo.result.photoId as string].durationSec).toBeUndefined(); // a photo never has a length
    // management's own clip publishes at once
    const mgmt = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'video', durationSec: 5, mediaId: 'md_clip3' }, 's9');
    expect(mgmt.state.photos[mgmt.result.photoId as string]).toMatchObject({ visibility: 'visible', mediaId: 'md_clip3' });
  });

  it('tags with the activity given (id or name), else follows the day', () => {
    const byId = take(fresh(), { kind: 'solo', memberIds: ['m2'], media: 'photo', activity: 'act-batik' });
    expect(byId.s.photos[byId.id].activity).toBe('Batik painting');
    const byName = take(fresh(), { kind: 'solo', memberIds: ['m2'], media: 'photo', activity: 'Tea in the garden' });
    expect(byName.s.photos[byName.id].activity).toBe('Tea in the garden');
    const afternoon = take(fresh(), { kind: 'solo', memberIds: ['m2'], media: 'photo' }, 's5', { today: '2026-10-21', nowMin: 15 * 60 + 30 });
    expect(afternoon.s.photos[afternoon.id].activity).toBe('Batik painting'); // last session of the day
    const weekend = take(fresh(), { kind: 'solo', memberIds: ['m2'], media: 'photo' }, 's5', { today: '2026-10-24', nowMin: 600 });
    expect(weekend.s.photos[weekend.id].activity).toBe('Club activities');
    const outing = take(fresh(), { kind: 'group', memberIds: ['m2'], media: 'photo' }, 's5', { today: '2026-10-29', nowMin: 600 });
    expect(outing.s.photos[outing.id].activity).toMatch(/^Outing/);
  });

  it('validates tags and the image id', () => {
    const s = fresh();
    fails(s, 'photo.take', { kind: 'solo', memberIds: ['m2', 'm10'], media: 'photo' }, 's5', 'activity.err.soloOne');
    fails(s, 'photo.take', { kind: 'group', memberIds: [], media: 'photo' }, 's5', 'err.invalid');
    fails(s, 'photo.take', { kind: 'group', memberIds: ['ghost'], media: 'photo' }, 's5', 'err.notFound');
    fails(s, 'photo.take', { kind: 'selfie', memberIds: ['m2'], media: 'photo' }, 's5', 'err.invalid');
    fails(s, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'gif' }, 's5', 'err.invalid');
    fails(s, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo', mediaId: '../etc/passwd' }, 's5', 'err.invalid');
    fails(s, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo', mediaId: '' }, 's5', 'err.invalid');
  });

  it('is permissioned: activity and management only', () => {
    const s = fresh();
    for (const uid of ['s5', 's6', 's9']) run(s, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo' }, uid);
    for (const uid of ['s3', 's10', 'f1']) fails(s, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo' }, uid, 'err.forbidden'); // the lobby and the nurse may take profile photos (pending)
  });

  it('works on any date', () => {
    const clk = { today: '2027-02-10', nowMin: 700 };
    const r = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo' }, 's5', clk);
    expect(r.state.photos[r.result.photoId as string]).toMatchObject({ date: '2027-02-10', time: '11:40', visibility: 'pending' });
  });
});

describe('photo.approve', () => {
  it('approves a batch: visible + approved, the feed shows each photo, each family is told once with the count', () => {
    let s = fresh();
    const a = take(s, { kind: 'solo', memberIds: ['m10'], media: 'photo' }); s = a.s;
    const b = take(s, { kind: 'group', memberIds: ['m10', 'm2'], media: 'photo' }); s = b.s;
    const c = take(s, { kind: 'solo', memberIds: ['m2'], media: 'video' }); s = c.s;
    expect(pendingPhotos(s)).toHaveLength(3);
    const r = run(s, 'photo.approve', { photoIds: [a.id, b.id, c.id], notify: true }, 's9', { today: '2026-10-21', nowMin: 640 });
    expect(r.result).toMatchObject({ approved: 3, skipped: 0, photoIds: [a.id, b.id, c.id] });
    for (const id of [a.id, b.id, c.id]) expect(r.state.photos[id]).toMatchObject({ visibility: 'visible', approved: { at: '2026-10-21T10:40', by: 's9' } });
    expect(pendingPhotos(r.state)).toHaveLength(0);
    expect(famPhotos(r.state, 'fm10_0')).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(famPhotos(r.state, 'fm10_0')).not.toContain(c.id); // not his
    const at = (kind: string) => live(r.state.notifications).filter((x) => x.kind === kind && x.createdAt === '2026-10-21T10:40');
    // Bambang's family: 2 photos (a and b) in one notification; Hendra's family: a group photo and a video in one
    const nb = at('activity.notif.newPhotos');
    expect(nb).toHaveLength(1);
    expect(nb[0]).toMatchObject({ toUsers: ['fm10_0'], params: { name: 'Bapak Bambang', n: 2 }, link: '/photos' });
    const nh = at('activity.notif.newMedia');
    expect(nh).toHaveLength(1);
    expect(nh[0]).toMatchObject({ toUsers: ['fm2_0', 'fm2_1'], params: { name: 'Opa Hendra', n: 2 } });
    expect(at('activity.notif.newPhoto')).toHaveLength(0);
    const keys = Object.values(r.state.activity).filter((x) => x.at === '2026-10-21T10:40').map((x) => x.key).sort();
    expect(keys).toEqual(['activity.feed.groupPhoto', 'activity.feed.photo', 'activity.feed.video']);
  });

  it('one photo reads "new photo of"; notify:false approves without telling anyone; notify defaults to on', () => {
    const { s, id } = take(fresh(), { kind: 'solo', memberIds: ['m10'], media: 'photo' });
    const quiet = run(s, 'photo.approve', { photoIds: [id], notify: false }, 's9');
    expect(quiet.state.photos[id].visibility).toBe('visible');
    expect(live(quiet.state.notifications).filter((x) => x.kind.startsWith('activity.notif.new') && x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
    expect(famPhotos(quiet.state, 'fm10_0')).toContain(id);
    const loud = run(s, 'photo.approve', { photoIds: [id] }, 's9');
    const ns = note(loud.state, 'activity.notif.newPhoto');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toUsers: ['fm10_0'], params: { name: 'Bapak Bambang' }, ref: { type: 'photo', id } });
  });

  it('skips photos somebody already handled, fails when none is pending, and rejects unknown ids', () => {
    let s = fresh();
    const a = take(s, { kind: 'solo', memberIds: ['m10'], media: 'photo' }); s = a.s;
    const b = take(s, { kind: 'solo', memberIds: ['m2'], media: 'photo' }); s = b.s;
    s = step(s, 'photo.reject', { photoIds: [b.id], reason: 'Blurry' }, 's9');
    const r = run(s, 'photo.approve', { photoIds: [a.id, b.id] }, 's9');
    expect(r.result).toMatchObject({ approved: 1, skipped: 1, photoIds: [a.id] });
    expect(r.state.photos[b.id].visibility).toBe('removed'); // the rejected one stays rejected
    fails(r.state, 'photo.approve', { photoIds: [a.id] }, 's9', 'activity.err.notPending'); // already approved
    fails(s, 'photo.approve', { photoIds: [b.id] }, 's9', 'activity.err.notPending');
    fails(s, 'photo.approve', { photoIds: ['ghost'] }, 's9', 'err.notFound');
    fails(s, 'photo.approve', { photoIds: [] }, 's9', 'err.invalid');
    fails(s, 'photo.approve', {}, 's9', 'err.invalid');
    // seeded photos are visible already: nothing to approve
    const seeded = live(fresh().photos).find((p) => p.visibility === 'visible')!;
    fails(fresh(), 'photo.approve', { photoIds: [seeded.id] }, 's9', 'activity.err.notPending');
  });

  it('a lunch photo goes through the kitchen announcement, and only when notify is on', () => {
    const s0 = produce(fresh(), (d) => {
      d.photos['p-lunch'] = { id: 'p-lunch', clubId: 'citra', createdAt: '2026-10-21T10:00', createdBy: 'staff:s7', date: '2026-10-21', time: '10:00', kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [], tone: 3, takenBy: 's7', visibility: 'pending' };
    });
    expect(famPhotos(s0, 'fm10_0')).not.toContain('p-lunch');
    const loud = run(s0, 'photo.approve', { photoIds: ['p-lunch'], notify: true }, 's9');
    expect(loud.state.photos['p-lunch']).toMatchObject({ visibility: 'visible', approved: { by: 's9' } });
    const ln = live(loud.state.notifications).filter((x) => x.kind === 'kitchen.notif.lunchPhoto' && x.createdAt === '2026-10-21T10:00');
    expect(ln).toHaveLength(1);
    expect(ln[0].toUsers).toEqual(expect.arrayContaining(['fm10_0', 'fm2_0']));
    expect(live(loud.state.notifications).filter((x) => x.kind.startsWith('activity.notif.new') && x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
    const quiet = run(s0, 'photo.approve', { photoIds: ['p-lunch'], notify: false }, 's9');
    expect(quiet.state.photos['p-lunch'].visibility).toBe('visible');
    expect(live(quiet.state.notifications).filter((x) => x.kind === 'kitchen.notif.lunchPhoto' && x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
  });

  it('management only', () => {
    const { s, id } = take(fresh(), { kind: 'solo', memberIds: ['m10'], media: 'photo' });
    for (const uid of ['s5', 's6', 's1', 's8', 's3', 's10', 'f1', 'fm10_0']) fails(s, 'photo.approve', { photoIds: [id] }, uid, 'err.forbidden');
    run(s, 'photo.approve', { photoIds: [id] }, 's9');
  });
});

describe('photo.reject', () => {
  it('removes the photo with the reason, tells the teacher once, and families never saw it', () => {
    let s = fresh();
    const a = take(s, { kind: 'solo', memberIds: ['m10'], media: 'photo' }); s = a.s;
    const b = take(s, { kind: 'solo', memberIds: ['m2'], media: 'photo' }); s = b.s;
    const r = run(s, 'photo.reject', { photoIds: [a.id, b.id], reason: 'other:Blurry, please retake' }, 's9', { today: '2026-10-21', nowMin: 640 });
    expect(r.result).toMatchObject({ rejected: 2, skipped: 0 });
    for (const id of [a.id, b.id]) {
      expect(r.state.photos[id]).toMatchObject({ visibility: 'removed', moderated: { by: 's9', reason: 'Blurry, please retake', at: '2026-10-21T10:40' } });
      expect(r.state.photos[id].deletedAt).toBeTruthy();
      expect(r.state.photos[id].approved).toBeUndefined();
    }
    expect(pendingPhotos(r.state)).toHaveLength(0);
    expect(famPhotos(r.state, 'fm10_0')).not.toContain(a.id);
    const ns = live(r.state.notifications).filter((x) => x.kind.startsWith('activity.notif.photo') && x.createdAt === '2026-10-21T10:40');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ kind: 'activity.notif.photosRejected', toUsers: ['s5'], params: { n: 2, reason: 'Blurry, please retake' }, link: '/camera?tab=library' });
    expect(live(r.state.notifications).some((x) => x.kind.startsWith('activity.notif.new') && x.createdAt === '2026-10-21T10:40')).toBe(false); // families are told nothing
    // one photo: the singular kind with the name
    const one = run(s, 'photo.reject', { photoIds: [a.id], reason: 'Duplicate' }, 's9');
    expect(live(one.state.notifications).find((x) => x.kind === 'activity.notif.photoRejected')).toMatchObject({ toUsers: ['s5'], params: { name: 'Bapak Bambang', reason: 'Duplicate' } });
    expect(one.state.photos[b.id].visibility).toBe('pending'); // the other is untouched
  });

  it('validates, skips handled photos, and is management only', () => {
    let s = fresh();
    const a = take(s, { kind: 'solo', memberIds: ['m10'], media: 'photo' }); s = a.s;
    fails(s, 'photo.reject', { photoIds: [a.id], reason: '  ' }, 's9', 'err.invalid');
    fails(s, 'photo.reject', { photoIds: [a.id] }, 's9', 'err.invalid');
    fails(s, 'photo.reject', { photoIds: [], reason: 'x' }, 's9', 'err.invalid');
    fails(s, 'photo.reject', { photoIds: ['ghost'], reason: 'x' }, 's9', 'err.notFound');
    for (const uid of ['s5', 's1', 's8', 'f1']) fails(s, 'photo.reject', { photoIds: [a.id], reason: 'x' }, uid, 'err.forbidden');
    const done = step(s, 'photo.reject', { photoIds: [a.id], reason: 'x' }, 's9');
    fails(done, 'photo.reject', { photoIds: [a.id], reason: 'x' }, 's9', 'activity.err.notPending');
    const visible = live(fresh().photos).find((p) => p.visibility === 'visible')!;
    fails(fresh(), 'photo.reject', { photoIds: [visible.id], reason: 'x' }, 's9', 'activity.err.notPending'); // a visible photo is hidden or removed, not rejected
  });

  it('a teacher cannot bring back a photo management rejected, but management can', () => {
    const { s, id } = take(fresh(), { kind: 'solo', memberIds: ['m10'], media: 'photo' });
    const rej = step(s, 'photo.reject', { photoIds: [id], reason: 'Privacy' }, 's9');
    fails(rej, 'photo.restore', { photoId: id }, 's5', 'err.forbidden');
    expect(run(rej, 'photo.restore', { photoId: id }, 's9').state.photos[id].visibility).toBe('visible');
  });
});

describe('moderating pending photos', () => {
  it('hiding is refused (nothing is visible yet); removing keeps it pending so undo returns it to the review', () => {
    const { s, id } = take(fresh(), { kind: 'solo', memberIds: ['m10'], media: 'photo' });
    fails(s, 'photo.hide', { photoId: id, reason: 'blurry' }, 's5', 'activity.err.photoPending');
    const gone = run(s, 'photo.remove', { photoId: id, reason: 'wrong person' }, 's5').state;
    expect(gone.photos[id]).toMatchObject({ visibility: 'pending', moderated: { by: 's5', reason: 'wrong person' } });
    expect(gone.photos[id].deletedAt).toBeTruthy();
    expect(pendingPhotos(gone)).toHaveLength(0); // soft-deleted rows leave every list
    fails(gone, 'photo.retag', { photoId: id, memberIds: ['m10'] }, 's5', 'err.notFound');
    const back = run(gone, 'photo.restore', { photoId: id }, 's5').state;
    expect(back.photos[id].visibility).toBe('pending'); // never straight to the families
    expect(back.photos[id].deletedAt).toBeUndefined();
    expect(back.photos[id].moderated).toBeUndefined();
    expect(pendingPhotos(back).map((p) => p.id)).toEqual([id]);
    fails(s, 'photo.restore', { photoId: id }, 's5', 'activity.err.notHidden'); // a pending photo that is not removed has nothing to restore
    // management removing a pending photo: the teacher cannot undo it
    const mgmtGone = step(s, 'photo.remove', { photoId: id, reason: 'privacy' }, 's9');
    fails(mgmtGone, 'photo.restore', { photoId: id }, 's5', 'err.forbidden');
  });

  it('retagging a pending photo does not tell anyone; the new family is told when it is approved', () => {
    const { s, id } = take(fresh(), { kind: 'solo', memberIds: ['m10'], media: 'photo' });
    const r = run(s, 'photo.retag', { photoId: id, memberIds: ['m10', 'm2'] }, 's5');
    expect(r.state.photos[id]).toMatchObject({ kind: 'group', visibility: 'pending' });
    expect(note(r.state, 'activity.notif.newPhoto')).toHaveLength(0);
    const ok = run(r.state, 'photo.approve', { photoIds: [id] }, 's9');
    expect(note(ok.state, 'activity.notif.newPhoto').flatMap((x) => x.toUsers).sort()).toEqual(['fm10_0', 'fm2_0', 'fm2_1']);
  });
});

describe('photo.addActivity (KC round 7: activity pictures)', () => {
  const add = (s: ClubState, input: object, uid = 's5', clk = clock) => { const r = run(s, 'photo.addActivity', input, uid, clk); return { s: r.state, id: r.result.photoId as string, r }; };
  const KERO = { date: '2026-10-21', activity: 'Keroncong sing-along' };

  it('a teacher’s picture of a session has no member tags, is pending, and tells nobody', () => {
    const { s, id, r } = add(fresh(), { ...KERO, mediaId: 'md_act1' });
    expect(s.photos[id]).toMatchObject({ kind: 'activity', media: 'photo', memberIds: [], activity: 'Keroncong sing-along', date: '2026-10-21', time: '10:00', takenBy: 's5', visibility: 'pending', mediaId: 'md_act1' });
    expect(r.result).toMatchObject({ visibility: 'pending' });
    expect(live(s.notifications).filter((n) => n.createdAt.startsWith('2026-10-21T10:00'))).toHaveLength(0);
    expect(pendingPhotos(s).map((p) => p.id)).toEqual([id]);
    expect(famPhotos(s, 'fm10_0')).not.toContain(id);
  });

  it('management’s own is visible at once, and the feed names the activity; the activity id works as well as its name', () => {
    const { s, id } = add(fresh(), { date: '2026-10-21', activity: 'act-batik' }, 's9');
    expect(s.photos[id]).toMatchObject({ kind: 'activity', visibility: 'visible', activity: 'Batik painting', memberIds: [] });
    expect(Object.values(s.activity).find((a) => a.key === 'activity.feed.activityPhoto')).toMatchObject({ params: { activity: 'Batik painting' } });
  });

  it('can be for a past open day of the last 7 days, not for the future, an older day, a closed day, or an activity that is not on that day’s plan', () => {
    const s = fresh();
    expect(add(s, { date: '2026-10-20', activity: 'Batik painting' }).s.photos).toBeTruthy();
    const old = add(s, { date: '2026-10-14', activity: 'Keroncong sing-along' });
    expect(old.s.photos[old.id]).toMatchObject({ date: '2026-10-14', time: '10:00', visibility: 'pending' }); // the day it is for, the time it was added
    fails(s, 'photo.addActivity', { date: '2026-10-13', activity: 'Batik painting' }, 's5', 'activity.err.picDate'); // 8 days back
    fails(s, 'photo.addActivity', { date: '2026-10-22', activity: 'Gardening club' }, 's5', 'activity.err.picDate'); // tomorrow
    fails(s, 'photo.addActivity', { date: '2026-10-17', activity: 'Batik painting' }, 's5', 'activity.err.picSession'); // a Saturday: no sessions
    fails(s, 'photo.addActivity', { date: '2026-10-20', activity: 'Keroncong sing-along' }, 's5', 'activity.err.picSession'); // that day was Batik and Memory games
    fails(s, 'photo.addActivity', { date: '2026-10-21', activity: 'Nope' }, 's5', 'activity.err.picSession');
    fails(s, 'photo.addActivity', { date: 'yesterday', activity: 'Batik painting' }, 's5', 'err.invalid');
    fails(s, 'photo.addActivity', { date: '2026-10-21', activity: 'Keroncong sing-along', mediaId: '../x' }, 's5', 'err.invalid');
  });

  it('is permissioned: activity and management only', () => {
    const s = fresh();
    for (const uid of ['s5', 's6', 's9']) run(s, 'photo.addActivity', { date: '2026-10-21', activity: 'Batik painting' }, uid);
    for (const uid of ['s3', 's10', 'f1']) fails(s, 'photo.addActivity', { date: '2026-10-21', activity: 'Batik painting' }, uid, 'err.forbidden');
  });

  it('approving tells no family (nobody is tagged) but shows it to the families of members who came that day; the feed names the activity', () => {
    const s0 = fresh();
    const { s, id } = add(s0, KERO);
    const ok = run(s, 'photo.approve', { photoIds: [id], notify: true }, 's9');
    expect(ok.state.photos[id]).toMatchObject({ visibility: 'visible', approved: { by: 's9' } });
    expect(live(ok.state.notifications).filter((n) => n.kind.startsWith('activity.notif.new'))).toHaveLength(0);
    expect(Object.values(ok.state.activity).some((a) => a.key === 'activity.feed.activityPhoto' && a.params?.activity === 'Keroncong sing-along')).toBe(true);
    // Bambang (m10) and Hendra (m2) checked in on the 21st; Oma Lina (m1) and Opa Budi (m46) did not
    expect(s0.attendance['2026-10-21:m10']?.checkIn).toBeTruthy();
    expect(s0.attendance['2026-10-21:m1']?.checkIn).toBeUndefined();
    expect(s0.attendance['2026-10-21:m46']?.checkIn).toBeUndefined();
    expect(famPhotos(ok.state, 'fm10_0')).toContain(id);
    expect(famPhotos(ok.state, 'fm2_0')).toContain(id);
    expect(famPhotos(ok.state, 'f1')).not.toContain(id);
    expect(famPhotos(ok.state, 'f2')).not.toContain(id);
    // still waiting: nobody
    expect(famPhotos(s, 'fm10_0')).not.toContain(id);
  });

  it('a family sees the picture for a past day only if one of its members came that day; a hidden or rejected one is gone for everyone', () => {
    const s0 = fresh();
    const day = '2026-10-20';
    const att = (m: string) => !!s0.attendance[`${day}:${m}`]?.checkIn;
    const came = ['m10', 'm2', 'm1', 'm46'].filter(att);
    expect(came.length).toBeGreaterThan(0); // the seed has members on that day…
    const a = add(s0, { date: day, activity: 'Batik painting' }, 's9'); // management: visible at once
    // each family sees it exactly when one of its members was checked in that day
    const fam = (uid: string, mids: string[]) => famPhotos(a.s, uid).includes(a.id) === mids.some(att);
    expect([fam('fm10_0', ['m10']), fam('fm2_0', ['m2']), fam('f1', ['m1', 'm46'])]).toEqual([true, true, true]);
    // hidden from families: nobody
    const hidden = run(a.s, 'photo.hide', { photoId: a.id, reason: 'privacy' }, 's9').state;
    for (const uid of ['fm10_0', 'fm2_0', 'f1']) expect(famPhotos(hidden, uid)).not.toContain(a.id);
  });

  it('a member-tagged photo of the same activity is not an activity picture, and an activity picture appears for the family without member stubs', () => {
    const g = take(fresh(), { kind: 'group', memberIds: ['m10', 'm2'], media: 'photo', activity: 'Keroncong sing-along' }, 's9');
    const a = add(g.s, KERO, 's9');
    const proj = projectForFamily(a.s, 'fm10_0');
    expect(Object.keys(proj.photos)).toEqual(expect.arrayContaining([g.id, a.id]));
    expect(proj.photos[a.id].memberIds).toEqual([]);
  });

  it('rejecting tells the teacher per session with a link back to it, and the picture is gone for the families', () => {
    const a = add(fresh(), KERO);
    const b = add(a.s, KERO);
    let s = b.s;
    const c = add(s, { date: '2026-10-21', activity: 'Batik painting' }); s = c.s;
    const one = run(s, 'photo.reject', { photoIds: [c.id], reason: 'Blurry' }, 's9');
    const n1 = note(one.state, 'activity.notif.activityPhotoRejected');
    expect(n1).toHaveLength(1);
    expect(n1[0]).toMatchObject({ toUsers: ['s5'], params: { activity: 'Batik painting', reason: 'Blurry' }, link: '/camera?tab=activity&date=2026-10-21&act=Batik%20painting', ref: { type: 'photo', id: c.id } });
    expect(one.state.photos[c.id]).toMatchObject({ visibility: 'removed', moderated: { by: 's9', reason: 'Blurry' } });
    // two of one session in one go: one notice with the count; another session's separately
    const two = run(s, 'photo.reject', { photoIds: [b.id, c.id], reason: 'other: too dark' }, 's9');
    const many = note(two.state, 'activity.notif.activityPhotosRejected');
    expect(many).toHaveLength(0);
    expect(note(two.state, 'activity.notif.activityPhotoRejected').map((x) => x.params.activity).sort()).toEqual(['Batik painting', 'Keroncong sing-along']);
    expect(note(two.state, 'activity.notif.photoRejected')).toHaveLength(0); // not the member-photo notice
    const both = run(s, 'photo.reject', { photoIds: [a.id, b.id], reason: 'Duplicate' }, 's9');
    expect(note(both.state, 'activity.notif.activityPhotosRejected')[0]).toMatchObject({ params: { activity: 'Keroncong sing-along', n: 2, reason: 'Duplicate' }, link: '/camera?tab=activity&date=2026-10-21&act=Keroncong%20sing-along' });
  });
});
