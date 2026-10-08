import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, lobbyGroups, type ClubState, type Consent } from '../index';
import { alsoToday, checkoutCandidates, departureStatus, faceOptedOut, faceRecognisable, goneHomeRows, latestFaceConsent, manualCandidates, memberMatchesQuery, nextFaceArrival, visitInfo } from './lobby';

const T = '2026-10-21';
const clubs = buildSeed();
const base: ClubState = clubs.citra;
const consent = (granted: boolean, at: string): Consent => ({ kind: 'face', granted, by: 'family:f1', byName: 'Maria Wijaya', at, via: 'staff' });
const run = (s: ClubState, name: string, input: unknown, userId: string, nowMin = 600) => execute(s, name, input, getUser(clubs, userId)!, { today: T, nowMin }, `r${Math.random()}`).state;
const checkIn = (s: ClubState, memberId: string, method: 'face' | 'manual' = 'manual') => run(s, 'attendance.checkIn', { memberId, method }, 's1');

describe('lobby groups (drop-in: who is in, who has gone home, who has not come yet)', () => {
  it('the seed morning: three in the club (newest first), nobody gone home, two members not in yet by usual arrival', () => {
    const g = lobbyGroups(base, T);
    expect(g.inClub.map((r) => r.m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(g.goneHome).toEqual([]);
    expect(g.others.map((r) => [r.m.id, r.m.usualArrival])).toEqual([['m46', '10:05'], ['m1', '10:05']]);
    expect(Object.keys(g).sort()).toEqual(['goneHome', 'inClub', 'others']); // no expected / to-arrive / away lists
  });
  it('rows exist only once someone checks in; checking out moves them to gone home', () => {
    expect(Object.keys(base.attendance).filter((k) => k.startsWith(T))).toHaveLength(3);
    const s = run(checkIn(base, 'm46'), 'attendance.checkOut', { memberId: 'm2' }, 's1');
    const g = lobbyGroups(s, T);
    expect(g.inClub.map((r) => r.m.id)).toEqual(['m46', 'm10', 'm20']);
    expect(g.goneHome.map((r) => r.m.id)).toEqual(['m2']);
    expect(g.others.map((r) => r.m.id)).toEqual(['m1']);
  });
});

describe('face-recognition opt-out', () => {
  it('the latest face consent decides; none recorded means not opted out', () => {
    const m = base.members.m1;
    expect(latestFaceConsent(m)).toBe(true);
    expect(faceOptedOut(m)).toBe(false);
    expect(faceOptedOut({ consents: [consent(true, '2025-01-01T09:00'), consent(false, '2026-01-01T09:00')] })).toBe(true);
    expect(faceOptedOut({ consents: [consent(false, '2025-01-01T09:00'), consent(true, '2026-01-01T09:00')] })).toBe(false);
    expect(faceOptedOut({ consents: [{ ...consent(false, '2026-01-01T09:00'), kind: 'data' }] })).toBe(false); // data consent is separate
    expect(latestFaceConsent({ consents: [] })).toBeUndefined();
  });
  it('recognisable needs enrolment and no opt-out', () => {
    expect(faceRecognisable(base.members.m1)).toBe(true);
    expect(faceRecognisable({ ...base.members.m1, face: { enrolled: false } })).toBe(false);
    expect(faceRecognisable({ ...base.members.m1, consents: [consent(false, '2026-10-01T09:00')] })).toBe(false);
  });
  it('"Simulate next arrival" picks Oma Lina first, skips opted-out members, and says why when nobody is left', () => {
    expect(nextFaceArrival(base, T)).toEqual({ id: 'm1' });
    const linaOut = produce(base, (d) => { d.members.m1.consents.push(consent(false, '2026-10-10T09:00')); });
    expect(nextFaceArrival(linaOut, T)).toEqual({ id: 'm46' });
    const bothOut = produce(linaOut, (d) => { d.members.m46.consents.push(consent(false, '2026-10-10T09:00')); });
    expect(nextFaceArrival(bothOut, T)).toEqual({ none: 'byName' });
    let all = base;
    for (const id of ['m1', 'm46']) all = checkIn(all, id);
    expect(nextFaceArrival(all, T)).toEqual({ none: 'everyoneIn' });
  });
  it('once Oma Lina is in, the earliest usual arrival of those left goes first', () => {
    expect(nextFaceArrival(checkIn(base, 'm1', 'face'), T)).toEqual({ id: 'm46' });
  });
  it('picks only from members who are not in the club yet (never an unenrolled face)', () => {
    const unenrolled = produce(base, (d) => { d.members.m1.face = { enrolled: false }; });
    expect(nextFaceArrival(unenrolled, T)).toEqual({ id: 'm46' });
  });
});

describe('Flex visits (10 a month, counted from actual check-ins) and Gold', () => {
  it('Oma Lina has 10 visits this month: checking in today is visit 11, an extra day', () => {
    expect(visitInfo(base, base.members.m1, T)).toEqual({ flex: true, n: 11, quota: 10, extra: true });
  });
  it('one visit fewer: visit 10 is inside the plan; earlier in the month there is room', () => {
    const nine = produce(base, (d) => { delete d.attendance['2026-10-20:m1']; });
    expect(visitInfo(nine, nine.members.m1, T)).toEqual({ flex: true, n: 10, quota: 10, extra: false });
    const early = produce(base, (d) => { for (const day of ['2026-10-19', '2026-10-20', '2026-10-16', '2026-10-14']) delete d.attendance[`${day}:m1`]; });
    expect(visitInfo(early, early.members.m1, T)).toEqual({ flex: true, n: 7, quota: 10, extra: false });
  });
  it('a member already in today counts once: Bambang is on visit 8 of 10', () => {
    expect(visitInfo(base, base.members.m10, T)).toEqual({ flex: true, n: 8, quota: 10, extra: false });
  });
  it('the count starts again each month', () => {
    expect(visitInfo(base, base.members.m1, '2026-11-04')).toEqual({ flex: true, n: 1, quota: 10, extra: false });
  });
  it('Gold is unlimited: never extra, no quota', () => {
    for (const id of ['m46', 'm2', 'm20']) expect(visitInfo(base, base.members[id], T)).toMatchObject({ flex: false, quota: null, extra: false });
  });
});

describe('manual check-in list and search', () => {
  it('lists every active member not in yet, in usual-arrival order; search by name, family name or phone', () => {
    const all = manualCandidates(base, T);
    expect(all.map((r) => r.m.id)).toEqual(['m46', 'm1']); // the other three are already in the club
    expect(manualCandidates(base, T, 'lina').map((r) => r.m.id)).toEqual(['m1']);
    expect(manualCandidates(base, T, '  LiNa ').map((r) => r.m.id)).toEqual(['m1']);
    expect(manualCandidates(base, T, 'WIJAYA').map((r) => r.m.id).sort()).toEqual(['m1', 'm46']);
    expect(manualCandidates(base, T, 'maria').map((r) => r.m.id).sort()).toEqual(['m1', 'm46']); // family name
    expect(manualCandidates(base, T, '812 1090').map((r) => r.m.id).sort()).toEqual(['m1', 'm46']); // phone digits
    expect(manualCandidates(base, T, 'zzz')).toEqual([]);
    expect(manualCandidates(base, T, '12')).toEqual([]); // too few digits to be a phone number, and no name has them
  });
  it('a member leaves the list when checked in and returns when the check-in is undone', () => {
    const s = checkIn(base, 'm1');
    expect(manualCandidates(s, T).map((r) => r.m.id)).toEqual(['m46']);
    expect(manualCandidates(s, T, 'lina')).toEqual([]);
    expect(manualCandidates(run(s, 'attendance.undoCheckIn', { memberId: 'm1' }, 's1'), T, 'lina').map((r) => r.m.id)).toEqual(['m1']);
  });
  it('never lists pending, ended or already-in members; nothing on a closed day', () => {
    const hidden = produce(base, (d) => { d.members.m1.review = { status: 'pending', crId: 'c' }; d.members.m46.memberships[0].lastDay = '2026-10-20'; });
    expect(manualCandidates(hidden, T)).toEqual([]);
    expect(manualCandidates(base, '2026-10-24')).toEqual([]); // Saturday
    expect(manualCandidates(base, '2026-10-30')).toEqual([]); // closed event
  });
  it('each row shows the usual arrival time the screen prints ("Usually arrives around 10:05")', () => {
    expect(manualCandidates(base, T).map((r) => r.m.usualArrival)).toEqual(['10:05', '10:05']);
  });
});

describe('check-out list and gone-home list (the check-out mode of Arrivals)', () => {
  it('the check-out list is the members in the club, newest arrival first; gone home starts empty', () => {
    expect(checkoutCandidates(base, T).map((r) => r.m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(goneHomeRows(base, T)).toEqual([]);
  });
  it('search finds in-club members by name, family contact name and phone digits, and trims or ignores case', () => {
    expect(checkoutCandidates(base, T, '  HENDRA ').map((r) => r.m.id)).toEqual(['m2']);
    expect(checkoutCandidates(base, T, 'cynthia').map((r) => r.m.id)).toEqual(['m2']); // Opa Hendra's daughter
    expect(checkoutCandidates(base, T, '815 1294').map((r) => r.m.id)).toEqual(['m2']); // her phone digits
    expect(checkoutCandidates(base, T, 'zzz')).toEqual([]);
    expect(checkoutCandidates(base, T, '12')).toEqual([]); // too few digits to be a phone number
    expect(checkoutCandidates(base, T, '  ').map((r) => r.m.id)).toEqual(['m10', 'm2', 'm20']); // only spaces: no filter
  });
  it('members who are not in yet are not on the check-out list; checking in adds them, checking out moves them to gone home', () => {
    expect(checkoutCandidates(base, T, 'lina')).toEqual([]);
    const s = run(checkIn(base, 'm1'), 'attendance.checkOut', { memberId: 'm2' }, 's1');
    expect(checkoutCandidates(s, T).map((r) => r.m.id)).toEqual(['m1', 'm10', 'm20']);
    expect(goneHomeRows(s, T).map((r) => r.m.id)).toEqual(['m2']);
    expect(goneHomeRows(s, T, 'hendra').map((r) => r.m.id)).toEqual(['m2']);
    expect(goneHomeRows(s, T, 'bambang')).toEqual([]); // still in the club, so not gone home
    expect(checkoutCandidates(s, T, 'hendra')).toEqual([]);
  });
  it('undoing the check-out puts the member back on the check-out list', () => {
    const out = run(base, 'attendance.checkOut', { memberId: 'm2' }, 's1');
    const back = run(out, 'attendance.undoCheckOut', { memberId: 'm2' }, 's1');
    expect(checkoutCandidates(back, T).map((r) => r.m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(goneHomeRows(back, T)).toEqual([]);
  });
  it('the three lists never share a member (every active member is in exactly one)', () => {
    const s = run(checkIn(base, 'm46'), 'attendance.checkOut', { memberId: 'm20' }, 's1');
    const ids = [...manualCandidates(s, T), ...checkoutCandidates(s, T), ...goneHomeRows(s, T)].map((r) => r.m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(5);
  });
  it('memberMatchesQuery: an empty query matches everyone, punctuation-only too', () => {
    expect(memberMatchesQuery(base, base.members.m1, '')).toBe(true);
    expect(memberMatchesQuery(base, base.members.m1, ' - ')).toBe(true);
    expect(memberMatchesQuery(base, base.members.m1, 'budi')).toBe(false);
  });
});

describe('departure status', () => {
  it('done with the reading, waiting when asked, missing otherwise; auto-waiting from the departure time only with an arrival reading', () => {
    expect(departureStatus(base, 'm10', T, 600)).toEqual({ kind: 'missing' });
    const asked = run(base, 'attendance.askDeparture', { memberId: 'm10' }, 's1');
    expect(departureStatus(asked, 'm10', T, 600)).toEqual({ kind: 'waiting', since: '10:00' });
    // 15:45: Bambang has an arrival reading (queued automatically), Hendra has none yet
    expect(departureStatus(base, 'm10', T, 15 * 60 + 45)).toEqual({ kind: 'waiting', since: '15:30' });
    expect(departureStatus(base, 'm2', T, 15 * 60 + 45)).toEqual({ kind: 'missing' });
    const done = produce(base, (d) => { d.readings.hdep = { id: 'hdep', clubId: 'citra', createdAt: `${T}T16:00`, createdBy: 'staff:s8', memberId: 'm10', date: T, time: '16:00', kind: 'departure', sys: 120, dia: 78, pulse: 70, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [] }; });
    const st = departureStatus(done, 'm10', T, 16 * 60);
    expect(st.kind).toBe('done');
    expect(st.kind === 'done' && st.reading.sys).toBe(120);
    expect(departureStatus(base, 'm46', T, 600)).toEqual({ kind: 'missing' }); // not in the club
  });
  it('a departure check the nurse skipped is not "waiting"', () => {
    const s = produce(run(base, 'attendance.askDeparture', { memberId: 'm10' }, 's1'), (d) => { d.attendance[`${T}:m10`].dismissed.push({ at: '10:05', by: 'staff:s8', kind: 'departure', reason: 'x' }); });
    expect(departureStatus(s, 'm10', T, 610)).toEqual({ kind: 'missing' });
  });
});

describe('also today (guests only)', () => {
  it('trial and visit guests booked for the date', () => {
    const a = alsoToday(base, T);
    expect(Object.keys(a).sort()).toEqual(['guests']); // no away, late or absent rows: nobody is expected
    expect(a.guests.map((g) => [g.id, g.kind, g.time])).toEqual([['g-e1', 'trial', undefined], ['g-e2', 'visit', '14:00']]); // the trial is a day pass with no time
  });
  it('a cancelled guest visit is not listed; a no-show stays listed; another date lists its own guests', () => {
    const s = produce(base, (d) => { d.guestVisits['g-e1'].status = 'cancelled'; d.guestVisits['g-e2'].status = 'noShow'; });
    expect(alsoToday(s, T).guests.map((g) => [g.id, g.status])).toEqual([['g-e2', 'noShow']]);
    expect(alsoToday(base, '2026-10-22').guests).toEqual([]);
  });
  it('a trial guest has no time (lunch and a nurse check come with the pass): trials without a time are listed first, then visits by time', () => {
    const visit = JSON.parse(JSON.stringify(base.guestVisits['g-e2']));
    const s = produce(base, (d) => {
      delete (d.guestVisits['g-e1'] as { time?: string }).time; // the trial pass: no time
      d.guestVisits['g-e1'].lunch = true;
      d.guestVisits['g-e1'].healthCheck = true;
      d.guestVisits['gz'] = { ...visit, id: 'gz', name: 'Ibu Early', time: '09:00' };
    });
    expect(alsoToday(s, T).guests.map((g) => [g.id, g.time])).toEqual([['g-e1', undefined], ['gz', '09:00'], ['g-e2', '14:00']]);
  });
  it('guests are not members: checking one in does not touch the member lists', () => {
    const s = run(base, 'guest.checkIn', { guestId: 'g-e1' }, 's1');
    expect(lobbyGroups(s, T).inClub.map((r) => r.m.id)).toEqual(['m10', 'm2', 'm20']);
    expect(alsoToday(s, T).guests.find((g) => g.id === 'g-e1')?.checkIn?.at).toBe('10:00');
  });
});
