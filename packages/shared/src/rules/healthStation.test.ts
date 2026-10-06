// Health station selectors: queue, care flags, family recipients, trends and sparklines. Seed: Wed 21 Oct 2026, 09:58.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, toMin, bpStatus, type ClubState } from '../index';
import {
  alertRecipients, careFlagsOf, guestsInClub, headSpark, headlineValue, inRange, membersInClub, monthlyNeeds, queueName, readingSummary, recentFlagged, roundField, sparkPaths, stationQueue, trendCharts, trendRows, arrivalSystolic, lastOfKind,
  daySummary, dueNow, filterRows, inClubCount, kindChoices, memberReadingsOn, memberTrend, nameMatches, neighbourDay, readingDays, readingsOnDay, rowName, stationRows, suggestKind,
} from './healthStation';

const T = '2026-10-21';
const clubs = buildSeed();
const s = clubs.citra;
const tweak = (x: ClubState, fn: (d: ClubState) => void) => produce(x, fn);
const hm = (x: string) => toMin(x);

describe('who is in the club', () => {
  it('members who checked in and have not left, newest check-in first; nobody who has not checked in', () => {
    expect(membersInClub(s, T).map((x) => [x.m.id, x.a.checkIn!.at])).toEqual([['m10', '09:48'], ['m2', '09:40'], ['m20', '09:38']]);
    expect(membersInClub(s, '2026-10-22')).toEqual([]);
    const gone = tweak(s, (d) => { d.attendance[`${T}:m2`].checkOut = { at: '09:50', by: 'staff:s1', method: 'manual' } as never; });
    expect(membersInClub(gone, T).map((x) => x.m.id)).toEqual(['m10', 'm20']);
    const pending = tweak(s, (d) => { d.members.m20.review = { status: 'pending', crId: 'c' }; });
    expect(membersInClub(pending, T).map((x) => x.m.id)).toEqual(['m10', 'm2']);
  });
  it('guests count once the lobby has checked them in, until they leave', () => {
    expect(guestsInClub(s, T)).toEqual([]);
    const in1 = tweak(s, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; });
    expect(guestsInClub(in1, T).map((g) => g.id)).toEqual(['g-e1']);
    const out = tweak(in1, (d) => { d.guestVisits['g-e1'].checkOut = { at: '12:00', by: 'staff:s1' }; });
    expect(guestsInClub(out, T)).toEqual([]);
  });
});

describe('queue', () => {
  it('sorts by due time, with "later" kept apart and the reading list newest first', () => {
    const q = stationQueue(s, T, hm('09:58'));
    expect(q.todo.map((x) => [x.personId, x.kind, x.due, x.since])).toEqual([['m20', 'arrival', '09:38', '09:38'], ['m2', 'arrival', '09:40', '09:40']]);
    expect(q.later).toEqual([]);
    expect(q.done.map((r) => [r.memberId, r.kind, r.time])).toEqual([['m10', 'arrival', '09:55']]);
    expect(queueName(q.todo[0])).toBe('Opa Tjahjadi');
  });

  it('leaves out people who are not in the club: nobody who has not checked in is queued, and nobody who has gone home', () => {
    const gone = tweak(s, (d) => { d.attendance[`${T}:m2`].checkOut = { at: '09:50', by: 'staff:s1', method: 'manual' } as never; });
    expect(stationQueue(gone, T, hm('10:00')).todo.map((x) => x.personId)).toEqual(['m20']);
  });

  it('a departure request is hidden by a removal made after it, and a newer request shows again', () => {
    const base = tweak(s, (d) => { d.readings['x-arr'] = { id: 'x-arr', clubId: 'citra', createdAt: `${T}T09:50`, createdBy: 'staff:s8', memberId: 'm2', date: T, time: '09:50', kind: 'arrival', sys: 120, dia: 80, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [] }; });
    const asked = tweak(base, (d) => { d.attendance[`${T}:m2`].departureAsked = { at: '11:00', by: 'staff:s1' }; });
    expect(stationQueue(asked, T, hm('11:01')).todo.map((x) => x.kind)).toEqual(['arrival', 'departure']); // Tjahjadi first, by due time
    const removed = tweak(asked, (d) => { d.attendance[`${T}:m2`].dismissed.push({ at: '11:05', by: 'staff:s8', kind: 'departure', reason: 'notNeeded' }); });
    expect(stationQueue(removed, T, hm('11:06')).todo.map((x) => x.personId)).toEqual(['m20']);
    expect(stationQueue(removed, T, hm('15:45')).todo.some((x) => x.personId === 'm2' && x.kind === 'departure')).toBe(true); // the 15:30 rule is a new request: an earlier removal does not cancel it
    const again = tweak(removed, (d) => { d.attendance[`${T}:m2`].departureAsked = { at: '11:30', by: 'staff:s1' }; });
    expect(stationQueue(again, T, hm('11:31')).todo.some((x) => x.personId === 'm2' && x.kind === 'departure')).toBe(true);
  });

  it('puts a lobby request and the 15:30 rule together: the earlier time is the due time', () => {
    const asked = tweak(s, (d) => { d.attendance[`${T}:m10`].departureAsked = { at: '15:40', by: 'staff:s1' }; });
    expect(stationQueue(asked, T, hm('15:45')).todo.find((x) => x.kind === 'departure')?.due).toBe('15:30');
    const early = tweak(s, (d) => { d.attendance[`${T}:m10`].departureAsked = { at: '10:20', by: 'staff:s1' }; });
    expect(stationQueue(early, T, hm('10:21')).todo.find((x) => x.kind === 'departure')?.due).toBe('10:20');
  });

  it('keeps today’s monthly readings in the Done list so they can be corrected, newest first', () => {
    const r = execute(s, 'reading.save', { memberId: 'm20', kind: 'arrival', sys: 129, dia: 72, pulse: 71, spo2: 96, temp: 36.8, glucose: 150, weight: 54.5, noteKeys: [], shared: false, tellFamily: false, recheck: false, deferMonthly: false, source: 'keypad' }, getUser(clubs, 's8')!, { today: T, nowMin: hm('10:05') }, 'q');
    expect(stationQueue(r.state, T, hm('10:06')).done.map((x) => [x.memberId, x.kind])).toEqual([['m20', 'arrival'], ['m20', 'monthly'], ['m10', 'arrival']]);
  });

  it('monthly "needs" follow the month of the date', () => {
    expect(monthlyNeeds(s, 'm20', T)).toEqual({ glucose: true, weight: true, any: true });
    expect(monthlyNeeds(s, 'm2', T)).toEqual({ glucose: false, weight: false, any: false });
    expect(monthlyNeeds(s, 'm2', '2026-11-03').any).toBe(true);
    expect(monthlyNeeds(s, 'm2', '2026-10-30').any).toBe(false);
  });
});

describe('care flags and family', () => {
  it('lists allergies, mobility, diet and lunchtime medicines for a member', () => {
    expect(careFlagsOf(s.members.m1)).toEqual([{ kind: 'food', key: 'shellfish' }, { kind: 'mobility', key: 'walkingStick' }, { kind: 'lunchMed', name: 'Calcium + Vitamin D', dose: '1 tablet' }]);
    expect(careFlagsOf(s.members.m2)).toEqual([{ kind: 'mobility', key: 'walker' }, { kind: 'diet', key: 'lowSalt' }]);
    expect(careFlagsOf(s.members.m10)).toEqual([{ kind: 'food', key: 'seafood' }]);
    expect(careFlagsOf(s.members.m20)).toEqual([{ kind: 'mobility', key: 'walker' }, { kind: 'diet', key: 'softFood' }, { kind: 'lunchMed', name: 'Metformin', dose: '500 mg' }]);
    const odd = tweak(s, (d) => { d.members.m46.health.foodOther = ' kiwi '; d.members.m46.health.drugs = ['penicillin', 'other:latex']; });
    expect(careFlagsOf(odd.members.m46)).toEqual([{ kind: 'foodOther', text: 'kiwi' }, { kind: 'mobility', key: 'walkingStick' }, { kind: 'diet', key: 'lowSalt' }, { kind: 'drug', key: 'penicillin' }, { kind: 'drug', key: 'other:latex' }]);
  });
  it('shows a guest’s allergies and mobility, or says they are not known yet', () => {
    expect(careFlagsOf(s.guestVisits['g-e1'])).toEqual([{ kind: 'food', key: 'shellfish' }, { kind: 'mobility', key: 'walkingStick' }, { kind: 'drug', key: 'penicillin' }]);
    expect(careFlagsOf(s.guestVisits['g-e2'])).toEqual([{ kind: 'allergyUnknown' }]);
  });
  it('family who hear about health: approved link, app access, health alerts on', () => {
    expect(alertRecipients(s, 'm2').map((x) => x.contact.id)).toEqual(['fm2_0', 'fm2_1']);
    expect(alertRecipients(s, 'm1').map((x) => x.contact.id)).toEqual(['f1', 'f2']);
    const off = tweak(s, (d) => { d.familyLinks['fm2_1:m2'].healthAlerts = false; d.familyLinks['fm2_0:m2'].appAccess = false; });
    expect(alertRecipients(off, 'm2')).toEqual([]);
    const pending = tweak(s, (d) => { d.familyLinks['fm2_1:m2'].review = { status: 'pending', crId: 'c' }; });
    expect(alertRecipients(pending, 'm2').map((x) => x.contact.id)).toEqual(['fm2_0']);
  });
});

describe('trends', () => {
  it('lists members with readings, the worst status of the last four weeks first', () => {
    const rows = trendRows(s, T);
    expect(rows.map((r) => [r.m.id, r.worst])).toEqual([['m2', 'alert'], ['m20', 'watch'], ['m10', 'normal'], ['m46', 'normal'], ['m1', 'normal']]);
    expect(rows[0].last?.sys).toBeDefined();
    expect(rows[0].n).toBeGreaterThan(10);
    // after 28 days the September glucose no longer counts and Hendra's Alert is old news too
    expect(trendRows(s, '2026-11-20').map((r) => r.worst)).toEqual(['normal', 'normal', 'normal', 'normal', 'normal']);
  });
  it('leaves out ended and pending members', () => {
    const x = tweak(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-01'; d.members.m46.review = { status: 'pending', crId: 'c' }; });
    expect(trendRows(x, T).map((r) => r.m.id)).toEqual(['m2', 'm20', 'm10']);
  });
  it('builds six chart cards from the clock, not from a fixed month', () => {
    const rs = trendRows(s, T)[0].rs; // Hendra
    const charts = trendCharts(rs, T);
    expect(charts.map((c) => c.id)).toEqual(['bp', 'pulse', 'spo2', 'temp', 'glucose', 'weight']);
    const bp = charts[0];
    expect(bp.series[0].length).toBeGreaterThan(5);
    expect(bp.series[1].length).toBeGreaterThan(5);
    expect(bp.series[0].every((p) => p.d >= '2026-09-23' && p.d < T)).toBe(true);
    expect(bp.latest?.kind).toBe('arrival');
    expect(bp.latestStatus).toBe(bpStatus(bp.latest!.sys!, bp.latest!.dia!));
    expect(bp.series[0].some((p) => p.s === 'alert')).toBe(true); // 164/98 on 14 Oct
    const glu = charts[4];
    expect(glu.series[0].map((p) => p.d)).toEqual(['2026-09-23', '2026-10-01']);
    expect(glu.sinceMonth).toBe('2026-09');
    expect(charts[5].sinceMonth).toBe('2026-09');
    expect(charts[5].latestStatus).toBeNull();
    // four weeks later the blood pressure charts are empty but the monthly history stays
    const later = trendCharts(rs, '2026-12-01');
    expect(later[0].series[0]).toEqual([]);
    expect(later[0].latest).toBeUndefined();
    expect(later[4].series[0]).toHaveLength(2);
  });
  it('flags a high pulse on the pulse chart (new threshold)', () => {
    const rs = [{ id: 'a', date: '2026-10-19', time: '10:00', kind: 'arrival', pulse: 112, status: 'watch' }, { id: 'b', date: '2026-10-20', time: '10:00', kind: 'arrival', pulse: 72, status: 'normal' }] as never;
    const c = trendCharts(rs, T)[1];
    expect(c.series[0].map((p) => p.s)).toEqual(['watch', 'normal']);
    expect(c.latestStatus).toBe('normal');
    expect(c.latest?.pulse).toBe(72);
  });
  it('shows the last values before today and the last flagged blood pressure of the last two weeks', () => {
    expect(lastOfKind(s, 'm2', T, ['arrival'], 'sys')?.date).toBe('2026-10-20');
    expect(lastOfKind(s, 'm20', T, ['monthly'], 'glucose')).toMatchObject({ date: '2026-09-23', glucose: 196 });
    expect(recentFlagged(s, 'm2', T)).toMatchObject({ date: '2026-10-20', kind: 'departure', status: 'watch' });
    expect(recentFlagged(s, 'm2', '2026-11-10')).toBeUndefined();
    expect(recentFlagged(s, 'm20', T)).toBeUndefined();
    expect(arrivalSystolic(s, 'm2', T).length).toBeGreaterThan(10);
    expect(arrivalSystolic(s, 'm2', T, 7)).toHaveLength(5);
  });
});

describe('sparklines', () => {
  it('draws the design’s chart: shared dates on x, clamped y, normal band, dots and hot dots', () => {
    const p = sparkPaths([[{ d: '2026-10-01', v: 120, s: 'normal' }, { d: '2026-10-08', v: 170, s: 'alert' }], [{ d: '2026-10-08', v: 130, s: 'normal' }]], { lo: 80, hi: 180, bLo: 100, bHi: 139 });
    expect(p.line).toBe('M14.0 76.8 L586.0 17.8');
    expect(p.line2).toBe('M586.0 65.0');
    expect(p.dots.startsWith('M10.0 76.8a4 4')).toBe(true);
    expect(p.hot.startsWith('M582.0 17.8a4 4')).toBe(true);
    expect(p.bandY).toBe('54.4');
    expect(p.bandH).toBe('46.0');
    expect([p.from, p.to]).toEqual(['2026-10-01', '2026-10-08']);
  });
  it('centres a single point, copes with no data, and has no band when asked for none', () => {
    expect(sparkPaths([[{ d: '2026-10-01', v: 50 }]], { lo: 40, hi: 60 }).line).toBe('M300.0 65.0');
    const none = sparkPaths([[]], { lo: 0, hi: 1 });
    expect(none).toMatchObject({ line: '', line2: '', dots: '', hot: '', bandY: '0', bandH: '0', from: null, to: null });
  });
  it('the header chart splits normal and high systolic values', () => {
    const h = headSpark([120, 150, 130]);
    expect(h.line.split(' ').filter((x) => x.startsWith('L'))).toHaveLength(2);
    expect(h.dots.match(/M/g)).toHaveLength(2);
    expect(h.hot.match(/M/g)).toHaveLength(1);
    expect(headSpark([])).toMatchObject({ line: '', dots: '', hot: '' });
  });
});

describe('numbers and text', () => {
  it('knows what a person can plausibly have, and rounds as the station shows', () => {
    expect(inRange('sys', 164)).toBe(true);
    expect(inRange('sys', 300)).toBe(false);
    expect(inRange('temp', 36.6)).toBe(true);
    expect(inRange('spo2', Number.NaN)).toBe(false);
    expect(roundField('temp', 36.64)).toBe(36.6);
    expect(roundField('weight', 54.04)).toBe(54);
    expect(roundField('sys', 120.4)).toBe(120);
  });
  it('summarises a reading with neutral numbers and units', () => {
    expect(readingSummary({ sys: 164, dia: 98, pulse: 84, spo2: 96, temp: 36.7 })).toBe('164/98 mmHg · 84 bpm · SpO₂ 96% · 36.7 °C');
    expect(readingSummary({ glucose: 118, weight: 54, grip: 17 })).toBe('118 mg/dL · 54 kg · 17 kg grip');
    expect(headlineValue({ sys: 164, dia: 98 })).toBe('164/98');
    expect(headlineValue({ glucose: 250, weight: 54 })).toBe('250 mg/dL');
    expect(headlineValue({})).toBe('');
  });
});

// ---------- the station's list: everybody, no queue ----------
const rowsAt = (x: ClubState, hmm: string) => stationRows(x, T, hm(hmm));
const settings = s.club.settings;
const reading = (id: string, memberId: string, time: string, kind: 'arrival' | 'departure' | 'recheck' | 'spot' | 'monthly', over: object = {}) => ({
  id, clubId: 'citra', createdAt: `${T}T${time}`, createdBy: 'staff:s8', memberId, date: T, time, kind, sys: 120, dia: 80, pulse: 70, status: 'normal', takenBy: 's8', source: 'device', noteKeys: [], shared: false, edits: [], ...over,
}) as never;

describe('the station list', () => {
  it('has every active member: the ones in the club first (anyone with something due on top, by due time), then those who went home, then the rest by first name', () => {
    const rows = rowsAt(s, '09:58');
    expect(rows.map((r) => [r.personId, r.presence])).toEqual([['m20', 'in'], ['m2', 'in'], ['m10', 'in'], ['m46', 'no'], ['m1', 'no']]);
    expect(rows.map((r) => r.dueNow.map((q) => q.kind))).toEqual([['arrival'], ['arrival'], [], [], []]);
    expect(rowName(rows[0])).toBe('Opa Tjahjadi Lim');
    expect(inClubCount(rows)).toBe(3);
    // Hendra goes home: he moves behind those still in the club
    const gone = tweak(s, (d) => { d.attendance[`${T}:m2`].checkOut = { at: '10:00', by: 'staff:s1', method: 'manual' } as never; });
    expect(rowsAt(gone, '10:01').map((r) => [r.personId, r.presence, r.left])).toEqual([['m20', 'in', undefined], ['m10', 'in', undefined], ['m2', 'gone', '10:00'], ['m46', 'no', undefined], ['m1', 'no', undefined]]);
  });

  it('a re-check coming due puts the member on top; before that the chip is there but the order stays', () => {
    const asked = tweak(s, (d) => { d.readings['x-arr'] = reading('x-arr', 'm10', '09:55', 'arrival', { sys: 164, dia: 98, status: 'alert' }); d.attendance[`${T}:m10`].recheckDueAt = '10:10'; });
    const before = rowsAt(asked, '10:00');
    expect(before.map((r) => r.personId).slice(0, 3)).toEqual(['m20', 'm2', 'm10']);
    expect(before[2].due.map((q) => [q.kind, q.due])).toEqual([['recheck', '10:10']]);
    expect(before[2].dueNow).toEqual([]);
    const after = rowsAt(asked, '10:12');
    expect(after.map((r) => r.personId).slice(0, 3)).toEqual(['m20', 'm2', 'm10']); // arrival checks due since 09:38 and 09:40 are older than 10:10
    expect(after[2].dueNow.map((q) => q.kind)).toEqual(['recheck']);
    const cleared = tweak(asked, (d) => { d.attendance[`${T}:m20`].dismissed.push({ at: '10:01', by: 'staff:s8', kind: 'arrival', reason: 'declined' }); d.attendance[`${T}:m2`].dismissed.push({ at: '10:01', by: 'staff:s8', kind: 'arrival', reason: 'declined' }); });
    expect(rowsAt(cleared, '10:12').map((r) => r.personId).slice(0, 3)).toEqual(['m10', 'm2', 'm20']); // now only Bambang has something due: he is first, the others follow by name
  });

  it('shows what is due as items, the monthly glucose and weight apart, and today’s readings newest first with the last reading', () => {
    const rows = rowsAt(s, '09:58');
    const tj = rows.find((r) => r.personId === 'm20')!;
    expect(tj.needs).toEqual({ glucose: true, weight: true, any: true });
    expect(tj.today).toEqual([]);
    expect(tj.last).toMatchObject({ date: '2026-10-20', kind: 'departure' }); // the last reading with a blood pressure, from yesterday
    const bb = rows.find((r) => r.personId === 'm10')!;
    expect(bb.today.map((r) => [r.kind, r.time])).toEqual([['arrival', '09:55']]);
    expect(bb.last).toMatchObject({ date: T, time: '09:55' });
    const more = tweak(s, (d) => { d.readings['x-s'] = reading('x-s', 'm10', '10:20', 'spot'); d.readings['x-m'] = reading('x-m', 'm10', '10:25', 'monthly', { sys: undefined, dia: undefined, pulse: undefined, glucose: 120 }); });
    const b2 = rowsAt(more, '10:30').find((r) => r.personId === 'm10')!;
    expect(b2.today.map((r) => r.time)).toEqual(['10:25', '10:20', '09:55']);
    expect(b2.last).toMatchObject({ time: '10:20' }); // a reading with a blood pressure wins over the newer glucose-only one
  });

  it('leaves out members who are not active: ended, not started, waiting for approval', () => {
    const x = tweak(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-01'; d.members.m46.review = { status: 'pending', crId: 'c' }; });
    expect(rowsAt(x, '09:58').map((r) => r.personId)).toEqual(['m20', 'm2', 'm10']);
    const y = tweak(s, (d) => { d.members.m1.memberships[0].start = '2026-11-02'; });
    expect(rowsAt(y, '09:58').some((r) => r.personId === 'm1')).toBe(false);
    const ending = tweak(s, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-23'; });
    expect(rowsAt(ending, '09:58').some((r) => r.personId === 'm1')).toBe(true); // still a member until the last day
  });

  it('adds the guests who are in the club (with their arrival check), and no one else', () => {
    expect(rowsAt(s, '10:00').some((r) => r.person.type === 'guest')).toBe(false);
    const in1 = tweak(s, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; d.guestVisits['g-e1'].healthCheck = true; });
    const rows = rowsAt(in1, '10:40');
    const g = rows.find((r) => r.personId === 'g-e1')!;
    expect(g).toMatchObject({ presence: 'in', since: '10:35', key: 'guest:g-e1' });
    expect(g.dueNow.map((q) => q.kind)).toEqual(['arrival']);
    expect(rowName(g)).toBe('Oma Siu Lan Tjandra');
    expect(rows.slice(0, 3).map((r) => r.personId)).toEqual(['m20', 'm2', 'g-e1']); // due since 09:38, 09:40 and 10:35
  });
});

describe('searching the list', () => {
  it('finds by first name, family name or title, in any order, ignoring case and accents; an empty search is everybody', () => {
    const rows = rowsAt(s, '09:58');
    const ids = (q: string) => filterRows(rows, q).map((r) => r.personId);
    expect(ids('hendra')).toEqual(['m2']);
    expect(ids('GUNAWAN')).toEqual(['m2']);
    expect(ids('lim tjahjadi')).toEqual(['m20']);
    expect(ids('opa')).toEqual(['m20', 'm2', 'm46']);
    expect(ids('  ')).toHaveLength(5);
    expect(ids('')).toHaveLength(5);
    expect(ids('zzz')).toEqual([]);
    expect(ids('wijaya')).toEqual(['m46', 'm1']);
    expect(nameMatches('Oma Siu Lan Tjandra', 'siu lán')).toBe(true);
    expect(nameMatches('Opa Hendra Gunawan', 'hendra x')).toBe(false);
  });
});

describe('which check is suggested', () => {
  const row = (x: ClubState, id: string, hmm: string) => rowsAt(x, hmm).find((r) => r.personId === id)!;
  it('the arrival check when there is no reading yet today (a monthly one alone does not count)', () => {
    expect(suggestKind(row(s, 'm2', '10:00'), hm('10:00'), settings)).toBe('arrival');
    expect(suggestKind(row(s, 'm1', '10:00'), hm('10:00'), settings)).toBe('arrival'); // not checked in: still their first reading
    const monthlyOnly = tweak(s, (d) => { d.readings['x-m'] = reading('x-m', 'm20', '10:00', 'monthly', { sys: undefined, dia: undefined, pulse: undefined, glucose: 140 }); });
    expect(suggestKind(row(monthlyOnly, 'm20', '10:05'), hm('10:05'), settings)).toBe('arrival');
  });
  it('a re-check when one is waiting, the departure check from the departure time or when the lobby asked, otherwise a spot check', () => {
    const base = tweak(s, (d) => { d.readings['x-arr'] = reading('x-arr', 'm2', '09:50', 'arrival', { sys: 164, dia: 98, status: 'alert' }); });
    expect(suggestKind(row(base, 'm2', '10:00'), hm('10:00'), settings)).toBe('spot');
    expect(suggestKind(row(base, 'm10', '10:00'), hm('10:00'), settings)).toBe('spot'); // Bambang's arrival was saved at 09:55
    const re = tweak(base, (d) => { d.attendance[`${T}:m2`].recheckDueAt = '10:05'; });
    expect(suggestKind(row(re, 'm2', '10:00'), hm('10:00'), settings)).toBe('recheck'); // waiting, even before its time
    expect(suggestKind(row(re, 'm2', '10:06'), hm('10:06'), settings)).toBe('recheck');
    expect(suggestKind(row(base, 'm10', '15:30'), hm('15:30'), settings)).toBe('departure');
    expect(suggestKind(row(base, 'm10', '15:29'), hm('15:29'), settings)).toBe('spot');
    const asked = tweak(base, (d) => { d.attendance[`${T}:m10`].departureAsked = { at: '11:00', by: 'staff:s1' }; });
    expect(suggestKind(row(asked, 'm10', '11:01'), hm('11:01'), settings)).toBe('departure');
    const taken = tweak(asked, (d) => { d.readings['x-dep'] = reading('x-dep', 'm10', '11:05', 'departure'); });
    expect(suggestKind(row(taken, 'm10', '11:06'), hm('11:06'), settings)).toBe('spot');
    expect(suggestKind(row(re, 'm2', '15:40'), hm('15:40'), settings)).toBe('recheck'); // a flagged result still being followed comes before going home
  });
  it('never a departure check for a guest or for someone who is not in the club', () => {
    const in1 = tweak(s, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; d.readings['x-g'] = reading('x-g', null as never, '10:40', 'arrival', { memberId: null, guestId: 'g-e1' }); });
    expect(suggestKind(row(in1, 'g-e1', '15:40'), hm('15:40'), settings)).toBe('spot');
    const home = tweak(s, (d) => { d.readings['x-a'] = reading('x-a', 'm1', '10:00', 'arrival'); });
    expect(suggestKind(row(home, 'm1', '15:40'), hm('15:40'), settings)).toBe('spot'); // m1 never checked in
  });
  it('offers the checks that make sense: arrival and departure once a day, monthly only while glucose or weight is due, three for a guest', () => {
    const tj = kindChoices(row(s, 'm20', '10:00'));
    expect(tj).toEqual([{ kind: 'arrival', off: false }, { kind: 'recheck', off: false }, { kind: 'spot', off: false }, { kind: 'departure', off: false }, { kind: 'monthly', off: false }]);
    const bb = kindChoices(row(s, 'm10', '10:00'));
    expect(bb.find((k) => k.kind === 'arrival')!.off).toBe(true);
    expect(bb.find((k) => k.kind === 'monthly')!.off).toBe(true); // Bambang has no monthly check due
    const in1 = tweak(s, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; });
    expect(kindChoices(row(in1, 'g-e1', '10:40')).map((k) => k.kind)).toEqual(['arrival', 'recheck', 'spot']);
  });
});

describe('what is due now', () => {
  it('dueNow is the "due now" part of the queue, from the badge to the needs-action item; later items wait', () => {
    expect(dueNow(s, T, hm('09:58')).map((q) => [q.personId, q.kind])).toEqual(stationQueue(s, T, hm('09:58')).todo.map((q) => [q.personId, q.kind]));
    expect(dueNow(s, T, hm('09:58')).map((q) => q.personId)).toEqual(['m20', 'm2']);
    const later = tweak(s, (d) => { d.attendance[`${T}:m10`].recheckDueAt = '10:20'; });
    expect(dueNow(later, T, hm('10:00')).some((q) => q.personId === 'm10')).toBe(false);
    expect(dueNow(later, T, hm('10:20')).some((q) => q.personId === 'm10' && q.kind === 'recheck')).toBe(true);
    expect(dueNow(s, '2026-10-22', hm('09:58'))).toEqual([]);
  });
});

describe('the record by day', () => {
  it('lists every valid reading of a date, newest first, without removed ones', () => {
    const d20 = readingsOnDay(s, '2026-10-20');
    expect(d20.length).toBeGreaterThan(5);
    expect(d20.every((r) => r.date === '2026-10-20')).toBe(true);
    expect(d20.map((r) => r.time + r.id)).toEqual(d20.map((r) => r.time + r.id).slice().sort().reverse());
    const removed = tweak(s, (d) => { d.readings[d20[0].id].voided = { at: `${T}T08:00`, by: 's8', reason: 'duplicate' }; });
    expect(readingsOnDay(removed, '2026-10-20')).toHaveLength(d20.length - 1);
    expect(readingsOnDay(s, '2026-10-17')).toEqual([]); // a Saturday
    expect(readingsOnDay(s, '2026-09-23').length).toBeGreaterThan(10); // a month ago
  });
  it('one member’s day, the days they have readings, and the nearest day before and after', () => {
    const hendra = memberReadingsOn(s, 'm2', '2026-10-20');
    expect(hendra.length).toBeGreaterThan(0);
    expect(hendra.every((r) => r.memberId === 'm2' && r.date === '2026-10-20')).toBe(true);
    const days = readingDays(trendRows(s, T).find((r) => r.m.id === 'm2')!.rs);
    expect(days[days.length - 1]).toBe('2026-10-20');
    expect(days).toEqual(days.slice().sort());
    expect(new Set(days).size).toBe(days.length);
    expect(neighbourDay(days, '2026-10-20', -1)).toBe(days[days.length - 2]);
    expect(neighbourDay(days, '2026-10-20', 1)).toBeNull();
    expect(neighbourDay(days, '2026-10-17', -1)).toBe('2026-10-16'); // a day without readings: the nearest day with some
    expect(neighbourDay(days, '2026-10-17', 1)).toBe('2026-10-19');
    expect(neighbourDay(days, '2000-01-01', -1)).toBeNull();
    expect(neighbourDay([], T, -1)).toBeNull();
  });
  it('summarises a day: readings, people, Watch and Alert', () => {
    const rs = readingsOnDay(s, '2026-10-14');
    const sum = daySummary(rs);
    expect(sum.readings).toBe(rs.length);
    expect(sum.people).toBe(new Set(rs.map((r) => r.memberId)).size);
    expect(sum.alert).toBeGreaterThan(0); // Hendra's 164/98 on 14 Oct
    expect(daySummary([])).toEqual({ readings: 0, people: 0, watch: 0, alert: 0 });
  });
  it('builds a member’s trend row even when the membership has ended (their old readings can still be opened from a day)', () => {
    const ended = tweak(s, (d) => { d.members.m2.memberships[0].lastDay = '2026-10-01'; });
    expect(trendRows(ended, T).some((r) => r.m.id === 'm2')).toBe(false);
    expect(memberTrend(ended, ended.members.m2, T)?.rs.length).toBeGreaterThan(10);
    expect(memberTrend(s, { ...s.members.m1, id: 'nobody' }, T)).toBeNull();
  });
});
