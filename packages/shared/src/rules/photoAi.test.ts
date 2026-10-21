import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type ClubState, type Photo } from '../index';
import { BURST_GAP_MS, CHECK_BELOW, analyzePhoto, bestOfBurst, draftNotes, draftsOf, inClubAt, sendProblem, type PhotoShot } from './photoAi';

const T = '2026-10-21'; // Wednesday: 10:30 Keroncong (Dinar), 13:30 Batik (Kak Dimas); at 10:00 Hendra (m2), Bambang (m10) and Tjahjadi (m20) are in
const fresh = (): ClubState => buildSeed().citra;
const shot = (id: string, time = '10:00', extra: Partial<PhotoShot> = {}): PhotoShot => ({ id, date: T, time, media: 'photo', mediaId: 'md_' + id, ...extra });
const ai = (s: ClubState, id: string, role: 'activity' | 'kitchen' | 'mgmt' = 'activity', time = '10:00') => analyzePhoto(s, shot(id, time), role, T, 600);
const ids = (n: number) => Array.from({ length: n }, (_, i) => 'p_s5-x_' + i);

describe('analyzePhoto (the simulated AI)', () => {
  it('is deterministic: the same photo and state always give the same suggestion, and a different photo can differ', () => {
    const s = fresh();
    expect(ai(s, 'p_a_1')).toEqual(ai(s, 'p_a_1'));
    expect(new Set(ids(60).map((id) => JSON.stringify(ai(s, id)))).size).toBeGreaterThan(10);
  });

  it('about 35% scenes and 10% blurry; people shots have 1 to 3 faces and a smile score; every confidence is 0.72 to 0.98', () => {
    const s = fresh();
    const all = ids(600).map((id) => ai(s, id));
    const scenes = all.filter((x) => x.kind === 'scene').length / all.length;
    expect(scenes).toBeGreaterThan(0.27);
    expect(scenes).toBeLessThan(0.43);
    const blurry = all.filter((x) => x.blurry).length / all.length;
    expect(blurry).toBeGreaterThan(0.05);
    expect(blurry).toBeLessThan(0.16);
    for (const x of all) {
      if (x.kind === 'scene') { expect(x.faces).toEqual([]); expect(x.smile).toBeUndefined(); continue; }
      expect(x.kind).toBe('people');
      expect(x.faces.length).toBeGreaterThanOrEqual(1);
      expect(x.faces.length).toBeLessThanOrEqual(3);
      expect(x.smile).toBeGreaterThanOrEqual(0.3);
      expect(x.smile).toBeLessThanOrEqual(1);
      for (const f of x.faces) { expect(f.confidence).toBeGreaterThanOrEqual(0.72); expect(f.confidence).toBeLessThanOrEqual(0.98); }
    }
    expect(all.some((x) => x.faces.some((f) => f.confidence < CHECK_BELOW))).toBe(true);
  });

  it('faces come only from members in the club at that minute, once, and only a member who allows face tagging is named', () => {
    const s = produce(fresh(), (d) => { d.members.m2.consents.push({ kind: 'face', granted: false, by: 'staff:s1', byName: 'Caca', at: '2099-01-01T00:00', via: 'staff' }); }); // Hendra opts out
    const here = inClubAt(s, T, 600).map((m) => m.id);
    expect(here).toEqual(['m10', 'm2', 'm20']);
    let unnamed = 0;
    for (const x of ids(300).map((id) => ai(s, id)).filter((a) => a.kind === 'people')) {
      const named = x.faces.flatMap((f) => (f.memberId ? [f.memberId] : []));
      expect(new Set(named).size).toBe(named.length);
      for (const id of named) { expect(here).toContain(id); expect(id).not.toBe('m2'); }
      unnamed += x.faces.filter((f) => !f.memberId).length;
    }
    expect(unnamed).toBeGreaterThan(0); // Hendra's face is there, with no name
    // before anyone arrived (08:00) nobody can be in the shot: with a session coming it is a scene
    expect(analyzePhoto(s, shot('p_early', '08:00'), 'activity', T, 480)).toMatchObject({ kind: 'scene', faces: [] });
    expect(inClubAt(s, T, 9 * 60 + 39).map((m) => m.id)).toEqual(['m20']); // Tjahjadi came at 09:38, Hendra at 09:40
  });

  it('prefers members marked as joined in the running session', () => {
    const s = produce(fresh(), (d) => {
      d.dailyLogs['log-m20-' + T] = { id: 'log-m20-' + T, clubId: 'citra', createdAt: T + 'T09:50', createdBy: 'staff:s5', memberId: 'm20', date: T, status: 'saved', by: 's5', edits: [], sessions: { '10:30': 'joined' } } as never;
    });
    const singles = ids(400).map((id) => analyzePhoto(s, shot(id, '10:35'), 'activity', T, 635)).filter((x) => x.kind === 'people' && x.faces.length === 1);
    expect(singles.length).toBeGreaterThan(20);
    expect(singles.every((x) => x.faces[0].memberId === 'm20')).toBe(true);
  });

  it('the kitchen only shoots food: lunch before 14:00, afternoon tea after', () => {
    const s = fresh();
    for (const id of ids(30)) {
      expect(analyzePhoto(s, shot(id, '11:58'), 'kitchen', T, 718)).toMatchObject({ kind: 'food', faces: [], meal: 'lunch' });
      expect(analyzePhoto(s, shot(id, '13:59'), 'kitchen', T, 839).meal).toBe('lunch');
      expect(analyzePhoto(s, shot(id, '14:00'), 'kitchen', T, 840).meal).toBe('tea');
      expect(analyzePhoto(s, shot(id, '15:10'), 'kitchen', T, 910)).toMatchObject({ kind: 'food', meal: 'tea' });
    }
  });

  it('a burst key is kept, and the sharpest smile of a burst is the best (blurry shots never are; a lone shot has none)', () => {
    const s = fresh();
    expect(analyzePhoto(s, shot('p_b_1', '10:00', { burst: 'b1' }), 'activity', T, 600).burst).toBe('b1');
    expect(BURST_GAP_MS).toBe(3000);
    const mk = (id: string, smile: number, blurry = false): Pick<Photo, 'id' | 'ai'> => ({ id, ai: { kind: 'people', faces: [], smile, ...(blurry ? { blurry: true } : {}), burst: 'b', at: T + 'T10:00' } });
    expect(bestOfBurst([mk('a', 0.5), mk('b', 0.9), mk('c', 0.7)])).toBe('b');
    expect(bestOfBurst([mk('a', 0.9, true), mk('b', 0.6), mk('c', 0.4)])).toBe('b');
    expect(bestOfBurst([mk('a', 0.8), mk('b', 0.8)])).toBe('a'); // the earlier shot wins a tie
    expect(bestOfBurst([mk('a', 0.8)])).toBeUndefined();
    expect(bestOfBurst([mk('a', 0.8, true), mk('b', 0.5, true)])).toBeUndefined();
  });
});

describe('draft notes and what can be sent', () => {
  const draft = (over: Partial<Photo>): Photo => ({ id: 'p1', clubId: 'citra', createdAt: T + 'T10:00', createdBy: 'staff:s5', date: T, time: '10:00', kind: 'group', media: 'photo', memberIds: ['m2'], tone: 0, takenBy: 's5', visibility: 'draft', ...over });
  it('"check" for a face the AI could not name or is unsure of, until a person has saved it', () => {
    const sure = { kind: 'people' as const, faces: [{ memberId: 'm2', confidence: 0.95 }], at: T + 'T10:00' };
    expect(draftNotes(draft({ ai: sure }))).toMatchObject({ ai: true, check: false, unknown: 0 });
    expect(draftNotes(draft({ ai: { ...sure, faces: [{ memberId: 'm2', confidence: 0.8 }] } })).check).toBe(true);
    expect(draftNotes(draft({ ai: { ...sure, faces: [{ memberId: 'm2', confidence: 0.95 }, { confidence: 0.9 }] } }))).toMatchObject({ check: true, unknown: 1 });
    expect(draftNotes(draft({ ai: { ...sure, faces: [{ confidence: 0.8 }], reviewed: true } }))).toMatchObject({ ai: false, check: false, unknown: 0 });
    expect(draftNotes(draft({ ai: { ...sure, blurry: true, best: true } }))).toMatchObject({ blurry: true, best: true });
    expect(draftNotes(draft({ memberIds: [], ai: undefined })).needs).toBe('people');
    expect(draftNotes(draft({ kind: 'activity', memberIds: [] })).needs).toBe('session');
  });

  it('sendProblem: names are needed for people, a real session for a scene, today and room for food', () => {
    const s = fresh();
    expect(sendProblem(s, draft({}), T)).toBeNull();
    expect(sendProblem(s, draft({ memberIds: [] }), T)).toMatchObject({ code: 'drafts.err.needPeople' });
    expect(sendProblem(s, draft({ kind: 'activity', memberIds: [], activity: 'Keroncong sing-along' }), T)).toBeNull();
    expect(sendProblem(s, draft({ kind: 'activity', memberIds: [] }), T)).toMatchObject({ code: 'drafts.err.needSession' });
    expect(sendProblem(s, draft({ kind: 'activity', memberIds: [], activity: 'Keroncong sing-along', date: '2026-10-12' }), T)).toMatchObject({ code: 'activity.err.picDate', params: { n: 7 } });
    expect(sendProblem(s, draft({ kind: 'activity', memberIds: [], activity: 'Mahjong club' }), T)).toMatchObject({ code: 'activity.err.picSession' });
    expect(sendProblem(s, draft({ kind: 'lunch', memberIds: [], activity: 'lunch' }), T)).toBeNull();
    expect(sendProblem(s, draft({ kind: 'lunch', memberIds: [], activity: 'tea', date: '2026-10-20' }), T)).toMatchObject({ code: 'drafts.err.notToday' });
    expect(draftsOf(s, 's5').map((p) => p.id)).toEqual(['p-draft-5', 'p-draft-4', 'p-draft-3', 'p-draft-2', 'p-draft-1']); // Dinar's seeded shots from this morning, newest first
    expect(draftsOf(s, 's6')).toEqual([]);
  });
});
