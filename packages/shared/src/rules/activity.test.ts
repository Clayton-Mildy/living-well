import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { actionItems, buildSeed, execute, getUser, live, type ClubState } from '../index';
import {
  FIXED_SLOTS, GENERAL_ACTIVITY, NORMAL_LOG, SESSION_MIN, activityName, attendedOn, cogSummary, curAct, dayPlan, faceOptedOut, faceSuggestable, faceTagging, fmtDuration, hashOf,
  LUNCH_AMOUNTS, cameOn, defaultRound, inClubMembers, joinedOf, logsOn, lunchLabelKey, roundMarked, roundProgress, roundsOf, isPendingPhoto, pictureDays, pictureSessions, sessionPhotos, sessionPictures, libraryPhotos, logDateOk, logDates, logDeviations, logId, logOf, nowNext, pendingLogMembers, pendingPhotos, photoActivities, photoCountByMember, photoDays, roomName, searchMembers, sentToday, sortByPhotoCount, suggestedFaces, toneOf,
} from './activity';

const T = '2026-10-21'; // Wednesday: 10:30 Keroncong (Dinar), 13:30 Batik (Kak Dimas)
const fresh = (): ClubState => buildSeed().citra;
const min = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3);

describe('dayPlan and Now/Next', () => {
  it('lists sessions plus lunch and tea in time order', () => {
    const plan = dayPlan(fresh(), T);
    expect(plan.map((x) => `${x.time} ${x.kind}`)).toEqual(['10:30 session', '12:00 lunch', '13:30 session', '15:00 tea']);
    expect(plan[0]).toMatchObject({ activity: { name: 'Keroncong sing-along' }, room: { name: 'Music room' }, staff: { id: 's5' } });
    expect(FIXED_SLOTS.map((f) => f.time)).toEqual(['12:00', '15:00']);
  });

  it('Now / Next follow the clock, with the 75-minute session length', () => {
    const s = fresh();
    expect(nowNext(s, T, min('09:58'))).toMatchObject({ phase: 'next', current: { time: '10:30' } });
    expect(nowNext(s, T, min('10:30'))).toMatchObject({ phase: 'now', current: { time: '10:30' } });
    expect(nowNext(s, T, min('10:30') + SESSION_MIN - 1)).toMatchObject({ phase: 'now' });
    expect(nowNext(s, T, min('11:45'))).toMatchObject({ phase: 'next', current: { time: '13:30' } }); // 10:30 + 75
    expect(nowNext(s, T, min('13:45'))).toMatchObject({ phase: 'now', current: { time: '13:30' } });
    expect(nowNext(s, T, min('14:44'))).toMatchObject({ phase: 'now' });
    expect(nowNext(s, T, min('14:45'))).toMatchObject({ phase: 'done', current: undefined }); // the old design showed the 10:30 session again here
    expect(nowNext(s, T, min('16:00')).phase).toBe('done');
  });

  it('"later today" has only future items and never repeats the hero session', () => {
    const s = fresh();
    expect(nowNext(s, T, min('09:58')).later.map((x) => x.time)).toEqual(['12:00', '13:30', '15:00']);
    expect(nowNext(s, T, min('10:45')).later.map((x) => x.time)).toEqual(['12:00', '13:30', '15:00']);
    expect(nowNext(s, T, min('12:05')).later.map((x) => x.time)).toEqual(['15:00']); // lunch has started, batik is the hero
    expect(nowNext(s, T, min('13:40')).later.map((x) => x.time)).toEqual(['15:00']);
    expect(nowNext(s, T, min('15:10')).later).toEqual([]);
  });

  it('closed days, weekends and outings have no plan; empty slots are skipped', () => {
    const s = fresh();
    expect(dayPlan(s, '2026-10-24')).toEqual([]); // Saturday
    expect(dayPlan(s, '2026-10-30')).toEqual([]); // closed
    expect(dayPlan(s, '2026-10-29')).toEqual([]); // outing
    expect(nowNext(s, '2026-10-24', 600)).toEqual({ phase: 'none', current: undefined, later: [] });
    const cleared = produce(s, (d) => { d.scheduleVersions['sched-2024-07'].days[3]['10:30'] = null; });
    expect(dayPlan(cleared, T).map((x) => x.time)).toEqual(['12:00', '13:30', '15:00']);
    expect(nowNext(cleared, T, 600)).toMatchObject({ phase: 'next', current: { time: '13:30' } });
    const none = produce(s, (d) => { d.scheduleVersions['sched-2024-07'].days[3] = { '10:30': null, '13:30': null }; });
    expect(nowNext(none, T, 600).phase).toBe('none');
    expect(dayPlan(none, T).map((x) => x.kind)).toEqual(['lunch', 'tea']);
    expect(dayPlan(produce(s, (d) => { d.scheduleVersions = {}; }), T).map((x) => x.kind)).toEqual(['lunch', 'tea']); // no schedule yet: no crash
  });

  it('curAct: the running or next session, else the last of the day, else the outing, else general', () => {
    const s = fresh();
    expect(curAct(s, T, min('09:58'))).toMatchObject({ kind: 'session', phase: 'next', name: 'Keroncong sing-along' });
    expect(curAct(s, T, min('12:30'))).toMatchObject({ kind: 'session', phase: 'next', name: 'Batik painting' });
    expect(curAct(s, T, min('15:00'))).toMatchObject({ kind: 'session', phase: 'done', name: 'Batik painting' });
    expect(curAct(s, '2026-10-29', 600)).toMatchObject({ kind: 'outing' });
    expect(curAct(s, '2026-10-29', 600).name).toMatch(/^Outing/);
    expect(curAct(s, '2026-10-24', 600)).toEqual({ kind: 'general', name: GENERAL_ACTIVITY });
  });

  it('names follow the language when nameId exists', () => {
    const s = fresh();
    expect(activityName(s.activities['act-keroncong'], 'en')).toBe('Keroncong sing-along');
    expect(activityName(s.activities['act-keroncong'], 'id')).toBe('Bernyanyi keroncong');
    expect(roomName(s.rooms['room-music'], 'id')).toBe('Ruang musik');
    expect(activityName({ name: 'Tai chi' }, 'id')).toBe('Tai chi');
    expect(activityName(undefined, 'en')).toBe('');
  });
});

describe('faces', () => {
  it('opted-out members are never suggested, but are still in the club list to tag by name', () => {
    let s = fresh();
    expect(inClubMembers(s, T).map((m) => m.id)).toEqual(['m10', 'm2', 'm20']); // Bambang, Hendra, Tjahjadi by first name
    expect(suggestedFaces(inClubMembers(s, T))).toEqual(['m10', 'm2', 'm20']);
    s = produce(s, (d) => { d.members.m10.consents.find((c) => c.kind === 'face')!.granted = false; });
    const people = inClubMembers(s, T);
    expect(people.map((m) => m.id)).toContain('m10');
    expect(faceOptedOut(s.members.m10)).toBe(true);
    expect(faceTagging(s.members.m10)).toBe('optOut');
    expect(suggestedFaces(people)).toEqual(['m2', 'm20']);
    // not enrolled: not suggested either
    s = produce(s, (d) => { d.members.m20.face.enrolled = false; });
    expect(faceTagging(s.members.m20)).toBe('notEnrolled');
    expect(faceSuggestable(s.members.m20)).toBe(false);
    expect(suggestedFaces(inClubMembers(s, T))).toEqual(['m2']);
    // the latest consent record wins
    const regranted = produce(s, (d) => { d.members.m10.consents.push({ kind: 'face', granted: true, by: 'staff:s1', byName: 'Caca', at: '2099-01-01T00:00', via: 'staff' }); });
    expect(faceOptedOut(regranted.members.m10)).toBe(false);
    expect(faceTagging({ ...s.members.m1, consents: [] } as never)).toBe('on'); // no record = not opted out
  });
});

describe('daily log helpers', () => {
  it('who was here, who is still to log, and the 7-day window', () => {
    const s = fresh();
    expect(attendedOn(s, T).map((m) => m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(attendedOn(s, '2026-10-20').map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm20', 'm46']); // drop-in: only people who checked in, Oma Lina (Flex) included
    expect(pendingLogMembers(s, T).map((m) => m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(pendingLogMembers(s, '2026-10-20')).toEqual([]);
    expect(logOf(s, 'm2', '2026-10-20')?.id).toBe(logId('m2', '2026-10-20'));
    expect(logOf(s, 'm2', T)).toBeUndefined();
    expect(logDateOk(T, T)).toBe(true);
    expect(logDateOk(T, '2026-10-14')).toBe(true);
    expect(logDateOk(T, '2026-10-13')).toBe(false);
    expect(logDateOk(T, '2026-10-22')).toBe(false);
    expect(logDates(s, T)).toEqual([T, '2026-10-20', '2026-10-19', '2026-10-16', '2026-10-15', '2026-10-14']); // weekends and the empty 21st-7 are skipped
  });

  it('drop-in: a member who went home is out of the club but still belongs in the day log', () => {
    const s = produce(fresh(), (d) => { d.attendance['2026-10-21:m2'].checkOut = { at: '10:20', by: 'staff:s1', method: 'manual' }; });
    expect(inClubMembers(s, T).map((m) => m.id).sort()).toEqual(['m10', 'm20']);
    expect(attendedOn(s, T).map((m) => m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(pendingLogMembers(s, T).map((m) => m.id)).toEqual(['m10', 'm2', 'm20']);
    // somebody who has not checked in (Oma Lina, a Flex member) is not in the day log at all
    expect(attendedOn(s, T).map((m) => m.id)).not.toContain('m1');
  });

  it('deviations list only what differs from normal, as field.value keys', () => {
    expect(logDeviations(NORMAL_LOG)).toEqual([]);
    expect(logDeviations({ ...NORMAL_LOG, mood: 'cheerful', lunch: 'most' })).toEqual(['mood.cheerful', 'lunch.most']);
    expect(logDeviations({ mood: 'agitated', lunch: 'little', joined: 'satOut', communicative: 'withdrawn', content: 'low' })).toEqual(['mood.agitated', 'lunch.little', 'joined.satOut', 'communicative.withdrawn', 'content.low']);
    // KC round 7: parts that are not marked yet are left out, and "didn't eat" is a deviation
    expect(logDeviations({})).toEqual([]);
    expect(logDeviations({ lunch: 'none', mood: 'calm' })).toEqual(['lunch.none']);
  });

  it('cognitive summary counts quiet and unsettled days among the last ten logs', () => {
    const s = fresh();
    const c = cogSummary(s, s.members.m10);
    expect(c.base).toBe('Mild memory loss');
    expect(c.isDefault).toBe(false);
    expect(c.days).toBeGreaterThan(0);
    expect(cogSummary(s, s.members.m2)).toMatchObject({ isDefault: true, base: '' });
    const noisy = produce(s, (d) => { for (const l of Object.values(d.dailyLogs)) if (l.memberId === 'm2') l.mood = 'quiet'; });
    expect(cogSummary(noisy, noisy.members.m2).quiet).toBe(10);
  });
});

describe('rounds of the daily log (KC round 7)', () => {
  const withLogs = (logs: Record<string, Partial<ClubState['dailyLogs'][string]>>) => produce(fresh(), (d) => {
    for (const [mid, l] of Object.entries(logs)) d.dailyLogs[logId(mid, T)] = { id: logId(mid, T), clubId: 'citra', createdAt: `${T}T10:00`, createdBy: 'staff:s5', memberId: mid, date: T, note: '', status: 'saved', by: 's5', edits: [], ...l } as never;
  });

  it('roundsOf: each session, lunch and mood & notes in time order; a slot without a session is skipped', () => {
    const s = fresh();
    expect(roundsOf(s, T).map((r) => `${r.time} ${r.kind}`)).toEqual(['10:30 session', '12:00 lunch', '13:30 session', '15:00 mood']);
    expect(roundsOf(s, T).map((r) => r.id)).toEqual(['10:30', 'lunch', '13:30', 'mood']);
    expect(roundsOf(s, T)[0].session?.activity?.name).toBeTruthy();
    const noAfternoon = produce(s, (d) => { for (const v of Object.values(d.scheduleVersions)) for (const day of Object.values(v.days)) delete (day as Record<string, unknown>)['13:30']; });
    expect(roundsOf(noAfternoon, T).map((r) => r.id)).toEqual(['10:30', 'lunch', 'mood']);
    expect(roundsOf(s, '2026-10-24').map((r) => r.id)).toEqual(['lunch', 'mood']); // Saturday: the club is closed, only the lunch and mood rounds remain
  });

  it('defaultRound follows the clock: first session before noon, lunch, second session from 13:30, mood & notes from 15:00', () => {
    const r = roundsOf(fresh(), T);
    expect(defaultRound(r, min('08:30'))).toBe('10:30');
    expect(defaultRound(r, min('11:59'))).toBe('10:30');
    expect(defaultRound(r, min('12:00'))).toBe('lunch');
    expect(defaultRound(r, min('13:29'))).toBe('lunch');
    expect(defaultRound(r, min('13:30'))).toBe('13:30');
    expect(defaultRound(r, min('14:59'))).toBe('13:30');
    expect(defaultRound(r, min('15:00'))).toBe('mood');
    const noMorning = roundsOf(produce(fresh(), (d) => { for (const v of Object.values(d.scheduleVersions)) for (const day of Object.values(v.days)) delete (day as Record<string, unknown>)['10:30']; }), T);
    expect(defaultRound(noMorning, min('09:00'))).toBe('lunch');
    expect(defaultRound(noMorning, min('14:00'))).toBe('13:30');
  });

  it('roundMarked and roundProgress count who is marked among everyone who checked in', () => {
    const s = withLogs({
      m2: { lunch: 'all', sessions: { '10:30': 'joined' }, joined: 'yes' },
      m10: { lunch: 'none', mood: 'quiet' },
    });
    expect(roundProgress(s, T, 'lunch')).toEqual({ marked: 2, total: 3 });
    expect(roundProgress(s, T, '10:30')).toEqual({ marked: 1, total: 3 });
    expect(roundProgress(s, T, '13:30')).toEqual({ marked: 0, total: 3 });
    expect(roundProgress(s, T, roundsOf(s, T).find((r) => r.id === 'mood')!)).toEqual({ marked: 1, total: 3 }); // also accepts the round itself
    expect(roundMarked(logOf(s, 'm2', T), 'mood')).toBe(false);
    expect(roundMarked(undefined, 'lunch')).toBe(false);
    expect(logsOn(s, T).get('m10')?.lunch).toBe('none');
    expect(roundProgress(s, '2026-10-24', 'lunch')).toEqual({ marked: 0, total: 0 });
  });

  it('the activity role is reminded once a round is over and people are still unmarked (lunch from 13:30, a session after it ends, mood & notes from 15:00)', () => {
    const s = withLogs({ m2: { lunch: 'all' }, m10: { lunch: 'all' } });
    const u = getUser({ [s.clubId]: s }, 's5')!;
    const items = (hm: string) => actionItems(s, u, T, min(hm)).filter((i) => i.id.startsWith('round:')).map((i) => `${i.id}:${i.params.n}`);
    expect(items('11:00')).toEqual([]); // the 10:30 session runs until 11:45
    expect(items('11:50')).toEqual(['round:10:30:3']);
    expect(items('13:00')).toEqual(['round:10:30:3']); // lunch is still going
    expect(items('13:35')).toEqual(['round:lunch:1', 'round:10:30:3']);
    expect(items('15:05')).toEqual(['round:mood:3', 'round:13:30:3', 'round:lunch:1', 'round:10:30:3']);
    expect(actionItems(s, u, T, min('15:05')).find((i) => i.id === 'round:mood')).toMatchObject({ kind: 'activity.notif.act.mood', link: '/log?round=mood' });
    expect(actionItems(s, getUser({ [s.clubId]: s }, 's1')!, T, min('15:05')).some((i) => i.id.startsWith('round:'))).toBe(false); // only the activity role
  });

  it('joined is derived from the session marks; lunch labels exist for every amount', () => {
    expect(joinedOf(undefined)).toBeUndefined();
    expect(joinedOf({})).toBeUndefined();
    expect(joinedOf({ '10:30': 'satOut' })).toBe('satOut');
    expect(joinedOf({ '10:30': 'satOut', '13:30': 'joined' })).toBe('yes');
    expect(LUNCH_AMOUNTS.map(lunchLabelKey)).toEqual(['family.lunch_all', 'family.lunch_most', 'family.lunch_half', 'family.lunch_little', 'activity.opt.lunch.none']);
  });
});

describe('photo library selectors', () => {
  it('filters by member, activity, date range and visibility; removed photos never show', () => {
    const s = fresh();
    const all = libraryPhotos(s);
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((p, i) => !i || all[i - 1].date + all[i - 1].time >= p.date + p.time)).toBe(true); // newest first
    const lina = libraryPhotos(s, { memberId: 'm1' });
    expect(lina.length).toBeGreaterThan(0);
    expect(lina.every((p) => p.memberIds.includes('m1'))).toBe(true);
    const range = libraryPhotos(s, { from: '2026-10-19', to: '2026-10-19' });
    expect(range.length).toBeGreaterThan(0);
    expect(range.every((p) => p.date === '2026-10-19')).toBe(true);
    const act = photoActivities(s)[0];
    expect(libraryPhotos(s, { activity: act }).every((p) => p.activity === act)).toBe(true);
    const hidden = produce(s, (d) => { d.photos[all[0].id].visibility = 'hidden'; d.photos[all[1].id].visibility = 'removed'; d.photos[all[1].id].deletedAt = '2026-10-21T09:00'; });
    expect(libraryPhotos(hidden, { visibility: 'hidden' }).map((p) => p.id)).toEqual([all[0].id]);
    expect(libraryPhotos(hidden, { visibility: 'visible' }).map((p) => p.id)).not.toContain(all[0].id);
    expect(libraryPhotos(hidden).map((p) => p.id)).toContain(all[0].id);
    expect(libraryPhotos(hidden).map((p) => p.id)).not.toContain(all[1].id);
  });

  it('groups by day (newest first) and, inside a day, by activity in time order', () => {
    const s = fresh();
    const days = photoDays(libraryPhotos(s));
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort().reverse());
    for (const d of days) {
      expect(d.count).toBe(d.groups.reduce((n, g) => n + g.photos.length, 0));
      expect(new Set(d.groups.map((g) => g.activity)).size).toBe(d.groups.length);
      for (const g of d.groups) expect(g.photos.every((p, i) => !i || g.photos[i - 1].time <= p.time)).toBe(true);
    }
  });

  it('"sent today" is the camera photos of the day (visible and waiting for approval), newest first', () => {
    let s = fresh();
    const mk = (n: number, input: object, uid = 's5') => { s = execute(s, 'photo.take', input, getUser({ citra: s }, uid)!, { today: T, nowMin: 600 + n }, 'mk' + n).state; };
    mk(1, { kind: 'solo', memberIds: ['m2'], media: 'photo' });
    mk(2, { kind: 'group', memberIds: ['m2', 'm10'], media: 'video' });
    mk(3, { kind: 'solo', memberIds: ['m10'], media: 'photo' }, 's9'); // management: visible at once
    expect(sentToday(s, T).map((p) => [p.time, p.visibility])).toEqual([['10:03', 'visible'], ['10:02', 'pending'], ['10:01', 'pending']]);
    expect(sentToday(s, '2026-10-22')).toEqual([]);
    // removed ones leave the list
    const gone = Object.values(s.photos).find((p) => p.time === '10:01')!;
    s = execute(s, 'photo.remove', { photoId: gone.id, reason: 'x' }, getUser({ citra: s }, 's5')!, { today: T, nowMin: 640 }, 'rm1').state;
    expect(sentToday(s, T).map((p) => p.time)).toEqual(['10:03', '10:02']);
  });

  it('pending photos: the reviewer queue is oldest first, and the library can filter on it', () => {
    let s = fresh();
    expect(pendingPhotos(s)).toEqual([]);
    const mk = (n: number, id: string) => { s = execute(s, 'photo.take', { kind: 'solo', memberIds: [id], media: 'photo' }, getUser({ citra: s }, 's5')!, { today: T, nowMin: 600 + n }, 'pk' + n).state; };
    mk(5, 'm2'); mk(6, 'm10');
    expect(pendingPhotos(s).map((p) => p.time)).toEqual(['10:05', '10:06']);
    expect(pendingPhotos(s).every(isPendingPhoto)).toBe(true);
    expect(libraryPhotos(s, { visibility: 'pending' }).map((p) => p.time)).toEqual(['10:06', '10:05']);
    expect(libraryPhotos(s, { visibility: 'visible' }).some(isPendingPhoto)).toBe(false);
    expect(libraryPhotos(s).filter(isPendingPhoto)).toHaveLength(2); // "all" includes them for staff
    expect(libraryPhotos(s, { visibility: 'pending', memberId: 'm2' })).toHaveLength(1);
  });

  it('searchMembers: every word of the query must match the name; accents and case are ignored', () => {
    const people = [{ title: 'Oma', firstName: 'Lina', lastName: 'Wijaya' }, { title: 'Opa', firstName: 'Hendra', lastName: 'Gunawan' }, { title: 'Bapak', firstName: 'José', lastName: 'Purnomo' }, { title: 'Oma', firstName: 'Siu Lan', lastName: 'Tjandra' }] as const;
    const names = (q: string) => searchMembers([...people], q).map((m) => m.firstName);
    expect(names('')).toEqual(['Lina', 'Hendra', 'José', 'Siu Lan']);
    expect(names('   ')).toHaveLength(4);
    expect(names('lin')).toEqual(['Lina']);
    expect(names('lan')).toEqual(['Siu Lan']); // "Lan" in the first name; "Lina" has no "lan" 
    expect(names('oma')).toEqual(['Lina', 'Siu Lan']);
    expect(names('opa gun')).toEqual(['Hendra']);
    expect(names('gun opa')).toEqual(['Hendra']); // word order does not matter
    expect(names('jose')).toEqual(['José']);
    expect(names('HENDRA')).toEqual(['Hendra']);
    expect(names('xyz')).toEqual([]);
    expect(names('oma wij')).toEqual(['Lina']);
  });

  it('solo photo list: members with no photo today come first, then those with one (pending counted), keeping the name order and the search', () => {
    let s = fresh();
    const mk = (n: number, input: object) => { s = execute(s, 'photo.take', input, getUser({ citra: s }, 's5')!, { today: T, nowMin: 600 + n }, 'sc' + n).state; };
    mk(1, { kind: 'solo', memberIds: ['m2'], media: 'photo' }); // pending
    mk(2, { kind: 'group', memberIds: ['m2', 'm10'], media: 'video' }); // a group photo counts for each member in it
    mk(3, { kind: 'solo', memberIds: ['m2'], media: 'photo' });
    const counts = photoCountByMember(sentToday(s, T));
    expect(counts).toEqual({ m2: 3, m10: 1 });
    const people = ['m1', 'm2', 'm10', 'm46'].map((id) => s.members[id]); // by first name, as the list is
    expect(sortByPhotoCount(people, counts).map((m) => m.id)).toEqual(['m1', 'm46', 'm10', 'm2']); // none first (in order), then 1, then 3
    expect(sortByPhotoCount(people, {}).map((m) => m.id)).toEqual(['m1', 'm2', 'm10', 'm46']); // nobody has one: unchanged
    // with a search the same order applies to the matches
    expect(sortByPhotoCount(searchMembers(people, 'opa'), counts).map((m) => m.id)).toEqual(sortByPhotoCount(people.filter((m) => m.title === 'Opa'), counts).map((m) => m.id));
    expect(photoCountByMember([{ memberIds: ['m1', 'm1'] }])).toEqual({ m1: 1 }); // a member tagged twice in one photo counts once
  });

  it('hash helpers are deterministic', () => {
    expect(hashOf('p_x_1')).toBe(hashOf('p_x_1'));
    expect(toneOf('abc')).toBeGreaterThanOrEqual(0);
    expect(toneOf('abc')).toBeLessThan(5);
    expect(fmtDuration(14)).toBe('0:14');
    expect(fmtDuration(75)).toBe('1:15');
    expect(fmtDuration(undefined)).toBe('0:00');
  });
});

describe('activity pictures (KC round 7)', () => {
  const clock = { today: T, nowMin: 10 * 60 + 45 };
  const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
  const run = (s: ClubState, name: string, input: unknown, uid: string, id: string) => execute(s, name, input, as(s, uid), clock, id);
  const kero = (s: ClubState) => live(s.activities).find((a) => a.name === 'Keroncong sing-along')!;

  it('a session shows its activity pictures only: not solo or group photos taken during it; staff also see the waiting ones, families only the approved', () => {
    let s = buildSeed().citra;
    const solo = run(s, 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo', activity: 'Keroncong sing-along' }, 's9', 'k1');
    s = solo.state;
    const mine = run(s, 'photo.addActivity', { date: T, activity: 'Keroncong sing-along' }, 's5', 'k2'); // a teacher's: waiting
    s = mine.state;
    const mgmt = run(s, 'photo.addActivity', { date: T, activity: 'Keroncong sing-along' }, 's9', 'k3'); // management's: visible at once
    s = mgmt.state;
    const act = kero(s);
    const staff = sessionPhotos(s, T, act).map((p) => p.id);
    expect(staff).toEqual([mine.result.photoId, mgmt.result.photoId].sort((a, b) => (s.photos[a as string].time + a < s.photos[b as string].time + b ? -1 : 1)));
    expect(staff).not.toContain(solo.result.photoId);
    expect(sessionPhotos(s, T, act, { familyOnly: true }).map((p) => p.id)).toEqual([mgmt.result.photoId]);
    expect(sessionPhotos(s, T, undefined)).toEqual([]);
    expect(sessionPhotos(s, '2000-01-01', act)).toEqual([]);
    expect(sessionPhotos(s, T, live(s.activities).find((a) => a.name === 'Batik painting'))).toEqual([]);
  });

  it('the sessions and days pictures can be added to: one per activity, the last 7 days, open days with a session only', () => {
    const s = buildSeed().citra;
    expect(pictureSessions(s, T).map((x) => `${x.time} ${x.activity?.name}`)).toEqual(['10:30 Keroncong sing-along', '13:30 Batik painting']);
    expect(pictureSessions(s, '2026-10-24')).toEqual([]); // a Saturday
    const days = pictureDays(s, T);
    expect(days[0]).toBe(T);
    expect(days.every((d) => d <= T && d >= '2026-10-14' && pictureSessions(s, d).length > 0)).toBe(true);
    expect(days).toEqual([...days].sort().reverse());
    expect(days).not.toContain('2026-10-24');
  });

  it('what the teacher sees of a session: each picture with its state; a rejected one stays with its reason, her own removal is gone', () => {
    let s = buildSeed().citra;
    const ids: string[] = [];
    for (const [i, uid] of ['s5', 's5', 's5', 's9'].entries()) { const r = run(s, 'photo.addActivity', { date: T, activity: 'Keroncong sing-along' }, uid, 'p' + i); s = r.state; ids.push(r.result.photoId as string); }
    s = run(s, 'photo.approve', { photoIds: [ids[0]], notify: false }, 's9', 'ok').state;
    s = run(s, 'photo.reject', { photoIds: [ids[1]], reason: 'Blurry' }, 's9', 'no').state;
    s = run(s, 'photo.remove', { photoId: ids[2], reason: 'duplicate' }, 's5', 'rm').state; // her own removal
    const got = sessionPictures(s, T, kero(s));
    expect(got.map((x) => [x.photo.id, x.state])).toEqual(expect.arrayContaining([[ids[0], 'approved'], [ids[1], 'rejected'], [ids[3], 'approved']]));
    expect(got.find((x) => x.photo.id === ids[1])?.reason).toBe('Blurry');
    expect(got.map((x) => x.photo.id)).not.toContain(ids[2]);
    s = run(s, 'photo.addActivity', { date: T, activity: 'Keroncong sing-along' }, 's5', 'again').state;
    expect(sessionPictures(s, T, kero(s)).filter((x) => x.state === 'pending')).toHaveLength(1); // "upload another"
  });

  it('the library can filter to activity pictures; cameOn says whether any of the members checked in', () => {
    let s = buildSeed().citra;
    s = run(s, 'photo.addActivity', { date: T, activity: 'Batik painting' }, 's9', 'l1').state;
    const only = libraryPhotos(s, { kind: 'activity' });
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((p) => p.kind === 'activity')).toBe(true);
    expect(libraryPhotos(s).length).toBeGreaterThan(only.length);
    expect(cameOn(s, ['m10'], T)).toBe(true);
    expect(cameOn(s, ['m1'], T)).toBe(false);
    expect(cameOn(s, ['m1', 'm10'], T)).toBe(true);
    expect(cameOn(s, [], T)).toBe(false);
  });
});
