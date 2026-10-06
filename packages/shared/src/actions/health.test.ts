// Health station actions: readings, corrections, the nurse queue. Seed: Wed 21 Oct 2026, 09:58; Hendra and Tjahjadi waiting, Bambang already checked.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { DEFAULT_LIMITS, buildSeed, execute, getUser, actionItems, unreadUpdates, updatesFor, nurseQueue, monthlyDue, todayReading, live, toMin, translate, type ClubState } from '../index';
import { dueNow, stationQueue } from '../rules/healthStation';
import type { ReadingSaveInput } from './health';

const T = '2026-10-21';
const at = (hm: string) => ({ today: T, nowMin: toMin(hm) });
const clubs = buildSeed();
const seed = clubs.citra;
const user = (id: string) => getUser(clubs, id)!;
const nurse = user('s8');
const flags = { noteKeys: [], shared: false, tellFamily: false, recheck: false, deferMonthly: false, source: 'device' as const };
const arrival = (memberId: string, v: Partial<ReadingSaveInput> = {}): ReadingSaveInput => ({ memberId, kind: 'arrival', sys: 128, dia: 80, pulse: 74, spo2: 97, temp: 36.6, ...flags, ...v });
const save = (s: ClubState, input: ReadingSaveInput, hm = '10:05', who = nurse, id = 'm' + Math.random().toString(36).slice(2, 8)) => execute(s, 'reading.save', input, who, at(hm), id);
const tweak = (s: ClubState, fn: (d: ClubState) => void) => produce(s, fn);
const kinds = (s: ClubState, hm: string) => stationQueue(s, T, toMin(hm)).todo.map((x) => `${x.kind}:${x.personId}`);

describe('reading.save', () => {
  it('Hendra arrival 164/98: Alert, real author, re-check in 15 min, family told in their language', () => {
    const r = save(seed, arrival('m2', { sys: 164, dia: 98, pulse: 84, spo2: 96, temp: 36.7, noteKeys: ['rested'], note: '  sat down first ', tellFamily: true, recheck: true }));
    const row = r.state.readings[r.result.readingId as string];
    expect(row).toMatchObject({ kind: 'arrival', memberId: 'm2', date: T, time: '10:05', status: 'alert', takenBy: 's8', noteKeys: ['rested'], note: 'sat down first', shared: true, source: 'device' });
    expect(row.familyTold).toEqual({ at: `${T}T10:05`, by: 's8', familyIds: ['fm2_0', 'fm2_1'] });
    expect(r.state.attendance[`${T}:m2`].recheckDueAt).toBe('10:20');
    expect(r.result).toMatchObject({ status: 'alert', told: ['Cynthia', 'Stephanie'], deferred: false, recheckAt: '10:20' });
    // a nurse-thread message for each contact (Cynthia reads Indonesian), marked unread for the family
    const sent = live(r.state.messages).filter((m) => m.kind === 'healthAlert' && m.at.startsWith(T));
    expect(sent).toHaveLength(2);
    const cynthia = sent.find((m) => r.state.threads[m.threadId].familyId === 'fm2_0')!;
    expect(r.state.threads[cynthia.threadId]).toMatchObject({ topic: 'nurse', memberId: 'm2', lastSeq: 3, familyReadSeq: 2, staffReadSeq: 3 });
    expect(cynthia.from).toBe('staff:s8');
    expect(cynthia.text).toContain('Halo Cynthia');
    expect(cynthia.text).toContain('164/98 mmHg');
    expect(cynthia.text).toContain('10:20');
    expect(cynthia.ref).toEqual({ type: 'reading', id: row.id });
    // updates: the family bell, the nurses; management gets the derived "Needs action" item
    expect(unreadUpdates(r.state, user('fm2_0')).some((n) => n.kind === 'health.notif.fam.alert' && n.severity === 'urgent')).toBe(true);
    expect(updatesFor(r.state, nurse).some((n) => n.kind === 'health.notif.alert')).toBe(true);
    expect(actionItems(r.state, user('s9'), T, toMin('10:05')).some((i) => i.id === 'alert:' + row.id)).toBe(true);
    expect(Object.values(r.state.activity).some((a) => a.key === 'health.feed.alertTold' && a.memberId === 'm2' && a.params.value === '164/98')).toBe(true);
  });

  it('takes the numbers at the top level or inside a `values` object', () => {
    const flat = save(seed, arrival('m2', { sys: 140, dia: 88 }));
    const nested = save(seed, { memberId: 'm2', kind: 'arrival', values: { sys: 140, dia: 88, pulse: 74, spo2: 97, temp: 36.6 }, ...flags } as never);
    const pick = (r: typeof flat) => { const x = r.state.readings[r.result.readingId as string]; return [x.sys, x.dia, x.pulse, x.spo2, x.temp, x.status]; };
    expect(pick(nested)).toEqual([140, 88, 74, 97, 36.6, 'watch']);
    expect(pick(flat).slice(0, 2)).toEqual([140, 88]);
  });

  it('is written by the real user, not a fixed nurse; management may save too', () => {
    const r = save(seed, arrival('m2'), '10:05', user('s9'));
    expect(r.state.readings[r.result.readingId as string].takenBy).toBe('s9');
    expect(r.state.readings[r.result.readingId as string].createdBy).toBe('staff:s9');
  });

  it('pulse is flagged: 55 and 105 Watch, 35, 45 and 125 Alert, 74 Normal', () => {
    const status = (pulse: number) => {
      const r = save(seed, arrival('m2', { pulse }));
      return r.state.readings[r.result.readingId as string].status;
    };
    expect([55, 105, 35, 45, 125, 74].map(status)).toEqual(['watch', 'watch', 'alert', 'alert', 'alert', 'normal']);
  });

  it('monthly values are saved as their own monthly row; monthly is no longer due; weight is judged against the last one', () => {
    const r = save(seed, arrival('m20', { sys: 129, dia: 72, pulse: 71, spo2: 96, temp: 36.8, glucose: 196, weight: 60.2, grip: 16 }));
    const mon = r.state.readings[r.result.monthlyId as string];
    expect(mon).toMatchObject({ kind: 'monthly', memberId: 'm20', glucose: 196, weight: 60.2, grip: 16, date: T, time: '10:05', status: 'watch', shared: false });
    expect(r.state.readings[r.result.readingId as string].glucose).toBeUndefined();
    expect(r.state.readings[r.result.readingId as string].status).toBe('normal');
    expect(r.result.status).toBe('watch');
    expect(monthlyDue(r.state, 'm20', T)).toBe(false);
    expect(r.state.attendance[`${T}:m20`].monthlyDeferred).toBeFalsy();
    expect(r.result.deferred).toBe(false);
    // weight 60.2 kg is 5+ kg from the September 54.x kg → Watch even with a normal glucose
    const w = save(seed, arrival('m20', { glucose: 120, weight: 60.2 }));
    expect(w.state.readings[w.result.monthlyId as string].status).toBe('watch');
  });

  it('left empty while monthly is due: saved anyway, deferred, and it returns as its own queue item', () => {
    const r = save(seed, arrival('m20'));
    expect(r.result.deferred).toBe(true);
    expect(r.state.attendance[`${T}:m20`].monthlyDeferred).toBe(true);
    expect(r.result.monthlyId).toBeUndefined();
    expect(kinds(r.state, '10:06')).toEqual(['arrival:m2', 'monthly:m20']);
    // doing the monthly check later completes it and clears the item
    const m = save(r.state, { memberId: 'm20', kind: 'monthly', glucose: 150, weight: 54.2, ...flags }, '10:30');
    expect(m.state.readings[m.result.readingId as string]).toMatchObject({ kind: 'monthly', glucose: 150, weight: 54.2 });
    expect(m.state.attendance[`${T}:m20`].monthlyDeferred).toBe(false);
    expect(kinds(m.state, '10:31')).toEqual(['arrival:m2']);
    expect(stationQueue(m.state, T, toMin('10:31')).done.map((x) => `${x.kind}:${x.memberId}`)).toEqual(['monthly:m20', 'arrival:m20', 'arrival:m10']);
  });

  it('"Do monthly later" with only glucose entered keeps the rest due; nothing entered when monthly is not due defers nothing', () => {
    const r = save(seed, arrival('m20', { glucose: 150, deferMonthly: true }));
    expect(r.result.deferred).toBe(true);
    expect(r.state.readings[r.result.monthlyId as string]).toMatchObject({ glucose: 150 });
    expect(kinds(r.state, '10:06')).toContain('monthly:m20');
    const h = save(seed, arrival('m2')); // Hendra's monthly check was done on 1 Oct and is not due
    expect(h.result.deferred).toBe(false);
    expect(h.state.attendance[`${T}:m2`].monthlyDeferred).toBeFalsy();
  });

  it('glucose can be measured again in the same month', () => {
    const r = save(seed, arrival('m20', { glucose: 150, weight: 54 }));
    expect(() => save(r.state, { memberId: 'm20', kind: 'monthly', glucose: 160, ...flags }, '10:30')).not.toThrow();
  });

  it('takes the month from the clock: on 3 Nov the monthly check is due again for Hendra', () => {
    const nov = tweak(seed, (d) => {
      d.attendance['2026-11-03:m2'] = { id: '2026-11-03:m2', clubId: 'citra', createdAt: '2026-11-03T09:40', createdBy: 'staff:s1', memberId: 'm2', date: '2026-11-03', checkIn: { at: '09:40', by: 'staff:s1', method: 'face' }, queueAdds: [], dismissed: [], edits: [] } as never; // a check-in row records who and when, nothing about who brought them
    });
    const q = stationQueue(nov, '2026-11-03', toMin('10:00'));
    expect(q.todo.map((x) => [x.kind, x.personId, x.monthly])).toEqual([['arrival', 'm2', true]]);
    const r = execute(nov, 'reading.save', arrival('m2'), nurse, { today: '2026-11-03', nowMin: toMin('10:05') }, 'mn');
    expect(Object.values(r.state.readings).find((x) => x.date === '2026-11-03')).toMatchObject({ date: '2026-11-03', time: '10:05' });
    expect(r.state.attendance['2026-11-03:m2'].monthlyDeferred).toBe(true);
  });

  it('refuses implausible numbers, half a blood pressure, and a missing one', () => {
    expect(() => save(seed, arrival('m2', { sys: 300 }))).toThrow('health.err.range.sys');
    expect(() => save(seed, arrival('m2', { temp: 50 }))).toThrow('health.err.range.temp');
    expect(() => save(seed, arrival('m2', { spo2: 20 }))).toThrow('health.err.range.spo2');
    expect(() => save(seed, arrival('m2', { glucose: 5 }))).toThrow('health.err.range.glucose');
    expect(() => save(seed, arrival('m2', { sys: 120, dia: 130 }))).toThrow('health.err.diaSys');
    expect(() => save(seed, arrival('m2', { dia: undefined }))).toThrow('health.err.bpPair');
    expect(() => save(seed, { memberId: 'm2', kind: 'arrival', pulse: 70, ...flags })).toThrow('health.err.bpRequired');
    expect(() => save(seed, { memberId: 'm2', kind: 'monthly', ...flags })).toThrow('health.err.needValue');
    expect(() => save(seed, { memberId: 'm2', kind: 'spot', ...flags })).toThrow('health.err.needValue');
    expect(() => save(seed, { ...arrival('m2'), guestId: 'g-e1' })).toThrow('err.invalid');
    expect(() => save(seed, { kind: 'arrival', sys: 120, dia: 80, ...flags })).toThrow('err.invalid');
  });

  it('only nurse and management may save', () => {
    for (const who of ['s1', 's3', 's5', 's10', 'fm2_0']) expect(() => save(seed, arrival('m2'), '10:05', user(who))).toThrow('err.forbidden');
  });

  it('arrival and departure are taken once a day, whoever is in the club', () => {
    expect(() => save(seed, arrival('m10'))).toThrow('health.err.alreadyTaken'); // Bambang's arrival was saved at 09:55
    const dep = save(seed, { memberId: 'm10', kind: 'departure', sys: 130, dia: 82, pulse: 70, ...flags }, '15:35');
    expect(() => save(dep.state, { memberId: 'm10', kind: 'departure', sys: 130, dia: 82, pulse: 70, ...flags }, '15:36')).toThrow('health.err.alreadyTaken');
  });

  it('anyone with a running membership can be checked at any time: not checked in yet, or already gone home', () => {
    // Lina has not been checked in by the lobby: the reading is saved all the same, and nothing is changed in the attendance
    const r = save(seed, arrival('m1', { sys: 126, dia: 78, pulse: 70 }));
    expect(r.state.readings[r.result.readingId as string]).toMatchObject({ memberId: 'm1', kind: 'arrival', date: T, status: 'normal' });
    expect(r.state.attendance[`${T}:m1`]).toBeUndefined();
    expect(r.state.members.m1.memberships).toEqual(seed.members.m1.memberships);
    // Hendra went home at 10:00 and is still checked
    const gone = tweak(seed, (d) => { d.attendance[`${T}:m2`].checkOut = { at: '10:00', by: 'staff:s1', method: 'manual' } as never; });
    expect(save(gone, arrival('m2')).state.readings).not.toBe(gone.readings);
    // but an ended membership, a membership that has not started, and a member waiting for approval are not
    const ended = tweak(seed, (d) => { d.members.m1.memberships[0].lastDay = '2026-10-01'; });
    expect(() => save(ended, arrival('m1'))).toThrow('err.memberNotActive');
    const upcoming = tweak(seed, (d) => { d.members.m1.memberships[0].start = '2026-11-02'; });
    expect(() => save(upcoming, arrival('m1'))).toThrow('err.memberNotActive');
    const pending = tweak(seed, (d) => { d.members.m1.review = { status: 'pending', crId: 'c' }; });
    expect(() => save(pending, arrival('m1'))).toThrow('err.memberPending');
  });

  it('a re-check asked for someone who is not checked in is kept on that day’s attendance row and shows as due', () => {
    const r = save(seed, arrival('m1', { sys: 164, dia: 98, pulse: 84, recheck: true }));
    expect(r.result).toMatchObject({ status: 'alert', recheckAt: '10:20' });
    const a = r.state.attendance[`${T}:m1`];
    expect(a).toMatchObject({ memberId: 'm1', date: T, recheckDueAt: '10:20' });
    expect(a.checkIn).toBeUndefined();
    expect(stationQueue(r.state, T, at('10:10').nowMin).later.map((x) => `${x.kind}:${x.personId}:${x.due}`)).toEqual(['recheck:m1:10:20']);
    expect(dueNow(r.state, T, at('10:25').nowMin).map((x) => `${x.kind}:${x.personId}`)).toContain('recheck:m1');
    // saving the re-check closes the request
    const re = save(r.state, { memberId: 'm1', kind: 'recheck', sys: 130, dia: 80, pulse: 72, ...flags }, '10:22');
    expect(re.state.attendance[`${T}:m1`].recheckDueAt).toBeUndefined();
    expect(dueNow(re.state, T, at('10:25').nowMin).some((x) => x.personId === 'm1')).toBe(false);
  });

  it('monthly values for someone who is not checked in are saved, and there is no put-off flag to keep', () => {
    const r = save(seed, arrival('m1', { glucose: 118, weight: 52 }));
    expect(live(r.state.readings).filter((x) => x.memberId === 'm1' && x.date === T).map((x) => x.kind).sort()).toEqual(['arrival', 'monthly']);
    const later = save(seed, arrival('m1'));
    expect(later.result.deferred).toBe(true);
    expect(later.state.attendance[`${T}:m1`]).toBeUndefined();
  });

  it('shared notes notify the family; telling the family without a flagged result still posts a plain message', () => {
    const r = save(seed, arrival('m10', { kind: 'recheck', shared: true }), '10:05');
    const n = unreadUpdates(r.state, user('fm10_0')).find((x) => x.kind.startsWith('health.notif.fam.'));
    expect(n).toMatchObject({ kind: 'health.notif.fam.normal', link: '/health', memberId: 'm10', severity: 'info' });
    const t = save(seed, arrival('m2', { tellFamily: true }));
    const msg = live(t.state.messages).filter((m) => m.at === `${T}T10:05`);
    expect(msg).toHaveLength(2);
    expect(msg.every((m) => m.kind === 'healthAlert')).toBe(true); // the chat shows every nurse update with the "Health update" header
    expect(Object.values(t.state.activity).some((a) => a.key === 'health.feed.normalTold')).toBe(true);
  });

  it('nobody is told when no contact has health alerts on', () => {
    const quiet = tweak(seed, (d) => { d.familyLinks['fm2_0:m2'].healthAlerts = false; d.familyLinks['fm2_1:m2'].healthAlerts = false; });
    const r = save(quiet, arrival('m2', { sys: 164, dia: 98, tellFamily: true }));
    expect(r.result.told).toEqual([]);
    expect(r.state.readings[r.result.readingId as string].familyTold).toBeUndefined();
    expect(live(r.state.messages).filter((m) => m.kind === 'healthAlert' && m.at.startsWith(T))).toHaveLength(0);
  });

  it('is deterministic: the same mutation id gives the same ids and patches', () => {
    const a = execute(seed, 'reading.save', arrival('m2', { sys: 164, dia: 98, tellFamily: true, recheck: true }), nurse, at('10:05'), 'same');
    const b = execute(buildSeed().citra, 'reading.save', arrival('m2', { sys: 164, dia: 98, tellFamily: true, recheck: true }), getUser(buildSeed(), 's8')!, at('10:05'), 'same');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
  });

  it('trial guest: saved with guestId, re-check supported, nobody to tell, Alert reaches the nurses and management', () => {
    const inClub = tweak(seed, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; });
    expect(kinds(inClub, '10:40')).toContain('arrival:g-e1');
    const r = execute(inClub, 'reading.save', { guestId: 'g-e1', kind: 'arrival', sys: 166, dia: 99, pulse: 80, spo2: 96, temp: 36.8, ...flags, tellFamily: true, recheck: true }, nurse, at('10:40'), 'mg');
    const row = r.state.readings[r.result.readingId as string];
    expect(row).toMatchObject({ memberId: null, guestId: 'g-e1', kind: 'arrival', status: 'alert', takenBy: 's8' });
    expect(r.state.guestVisits['g-e1'].recheckDueAt).toBe('10:55');
    expect(live(r.state.messages).filter((m) => m.at.startsWith(T) && m.kind === 'healthAlert')).toHaveLength(0);
    expect(stationQueue(r.state, T, toMin('10:41')).later.map((x) => `${x.kind}:${x.personId}`)).toEqual(['recheck:g-e1']);
    expect(updatesFor(r.state, user('s9')).some((n) => n.kind === 'health.notif.guestAlert')).toBe(true);
    expect(() => execute(inClub, 'reading.save', { guestId: 'g-e1', kind: 'monthly', glucose: 100, ...flags }, nurse, at('10:40'), 'mg2')).toThrow('health.err.guestKind');
    // not checked in yet → refused
    expect(() => execute(seed, 'reading.save', { guestId: 'g-e1', kind: 'arrival', sys: 120, dia: 80, ...flags }, nurse, at('10:20'), 'mg3')).toThrow('err.notCheckedIn');
  });
});

describe('re-check', () => {
  it('waits in "Later" until it is due, in the order of due time', () => {
    const r = save(seed, arrival('m2', { sys: 164, dia: 98, recheck: true }));
    const later = stationQueue(r.state, T, toMin('10:06')).later;
    expect(later.map((x) => [x.kind, x.personId, x.due])).toEqual([['recheck', 'm2', '10:20']]);
    expect(kinds(r.state, '10:06')).toEqual(['arrival:m20']);
    expect(kinds(r.state, '10:20')).toEqual(['arrival:m20', 'recheck:m2']);
  });

  it('a second re-check works: pending until it is saved, and saving it closes the request', () => {
    const r1 = save(seed, arrival('m2', { sys: 164, dia: 98, recheck: true }), '10:05');
    const r2 = save(r1.state, { memberId: 'm2', kind: 'recheck', sys: 152, dia: 92, pulse: 78, ...flags, recheck: true }, '10:21');
    expect(r2.state.attendance[`${T}:m2`].recheckDueAt).toBe('10:36');
    expect(stationQueue(r2.state, T, toMin('10:22')).later.map((x) => x.due)).toEqual(['10:36']);
    expect(nurseQueue(r2.state, T, toMin('10:40')).todo.some((x) => x.kind === 'recheck')).toBe(false); // the original selector hides the second one
    expect(kinds(r2.state, '10:40')).toContain('recheck:m2');
    const r3 = save(r2.state, { memberId: 'm2', kind: 'recheck', sys: 138, dia: 88, pulse: 74, ...flags }, '10:40');
    expect(r3.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    expect(kinds(r3.state, '10:41').some((k) => k.startsWith('recheck'))).toBe(false);
  });

  it('uses the club setting for the delay, not a fixed 15', () => {
    const slow = tweak(seed, (d) => { d.club.settings.recheckMin = 30; });
    const r = save(slow, arrival('m2', { recheck: true }));
    expect(r.state.attendance[`${T}:m2`].recheckDueAt).toBe('10:35');
  });
});

describe('reading.edit', () => {
  const bambang = () => todayReading(seed, 'm10', T, 'arrival')!;
  it('corrects values, recomputes the status, keeps the old values and the reason', () => {
    const r = execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 162 }, reason: 'typo' }, user('s9'), at('10:30'), 'e1');
    const row = r.state.readings[bambang().id];
    expect(row.sys).toBe(162);
    expect(row.status).toBe('alert');
    expect(row.edits).toEqual([{ at: `${T}T10:30`, by: 's9', fields: ['sys'], reason: 'typo', from: { sys: 122 } }]);
    expect(actionItems(r.state, user('s9'), T, toMin('10:30')).some((i) => i.id === 'alert:' + row.id)).toBe(true);
    const back = execute(r.state, 'reading.edit', { readingId: row.id, values: { sys: 122, spo2: 98 }, reason: 'deviceError', note: 'cuff slipped' }, nurse, at('10:40'), 'e2');
    expect(back.state.readings[row.id]).toMatchObject({ sys: 122, spo2: 98, status: 'normal', source: 'mixed' });
    expect(back.state.readings[row.id].edits[1]).toMatchObject({ fields: ['sys', 'spo2'], from: { sys: 162, spo2: 97 }, note: 'cuff slipped', by: 's8' });
  });
  it('needs a reason and a change; keeps blood pressure coherent; refuses removed readings and other roles', () => {
    expect(() => execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 130 } }, nurse, at('10:30'), 'x')).toThrow('health.err.reasonRequired');
    expect(() => execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 122 }, reason: 'typo' }, nurse, at('10:30'), 'x')).toThrow('err.noChanges');
    expect(() => execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 70 }, reason: 'typo' }, nurse, at('10:30'), 'x')).toThrow('health.err.diaSys');
    expect(() => execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 400 }, reason: 'typo' }, nurse, at('10:30'), 'x')).toThrow('health.err.range.sys');
    expect(() => execute(seed, 'reading.edit', { readingId: 'nope', values: { sys: 130 }, reason: 'typo' }, nurse, at('10:30'), 'x')).toThrow('err.notFound');
    expect(() => execute(seed, 'reading.edit', { readingId: bambang().id, values: { sys: 130 }, reason: 'typo' }, user('s1'), at('10:30'), 'x')).toThrow('err.forbidden');
    const gone = execute(seed, 'reading.void', { readingId: bambang().id, reason: 'duplicate' }, nurse, at('10:30'), 'v');
    expect(() => execute(gone.state, 'reading.edit', { readingId: bambang().id, values: { sys: 130 }, reason: 'typo' }, nurse, at('10:31'), 'x')).toThrow('health.err.alreadyVoided');
  });
});

describe('reading.void', () => {
  it('removes a reading with a reason: it leaves the trends and the Alerts, and the person is queued again', () => {
    const r = save(seed, arrival('m2', { sys: 164, dia: 98 }));
    const id = r.result.readingId as string;
    expect(kinds(r.state, '10:06')).toEqual(['arrival:m20']);
    const v = execute(r.state, 'reading.void', { readingId: id, reason: 'wrongPerson' }, nurse, at('10:10'), 'v1');
    expect(v.state.readings[id].voided).toEqual({ at: `${T}T10:10`, by: 's8', reason: 'wrongPerson' });
    expect(kinds(v.state, '10:11')).toEqual(['arrival:m20', 'arrival:m2']);
    expect(actionItems(v.state, user('s9'), T, toMin('10:11')).some((i) => i.id === 'alert:' + id)).toBe(false);
    expect(Object.values(v.state.activity).some((a) => a.key === 'health.feed.voided')).toBe(true);
    expect(() => execute(v.state, 'reading.void', { readingId: id, reason: 'duplicate' }, nurse, at('10:12'), 'v2')).toThrow('health.err.alreadyVoided');
  });
  it('"other" needs a note; unknown reasons are refused; only nurse and management', () => {
    const id = todayReading(seed, 'm10', T, 'arrival')!.id;
    expect(() => execute(seed, 'reading.void', { readingId: id, reason: 'other' }, nurse, at('10:10'), 'x')).toThrow('err.noteRequired');
    expect(execute(seed, 'reading.void', { readingId: id, reason: 'other', note: 'Cuff on the wrong arm' }, nurse, at('10:10'), 'x').state.readings[id].voided?.note).toBe('Cuff on the wrong arm');
    expect(() => execute(seed, 'reading.void', { readingId: id, reason: 'because' }, nurse, at('10:10'), 'x')).toThrow('health.err.reasonRequired');
    expect(() => execute(seed, 'reading.void', { readingId: id, reason: 'duplicate' }, user('fm10_0'), at('10:10'), 'x')).toThrow('err.forbidden');
  });
  it('can take the monthly values saved with it; the monthly check is due again', () => {
    const r = save(seed, arrival('m20', { glucose: 150, weight: 54.2 }));
    const id = r.result.readingId as string;
    const only = execute(r.state, 'reading.void', { readingId: id, reason: 'deviceError' }, nurse, at('10:10'), 'v1');
    expect(only.state.readings[r.result.monthlyId as string].voided).toBeUndefined();
    const both = execute(r.state, 'reading.void', { readingId: id, reason: 'wrongPerson', withMonthly: true }, nurse, at('10:10'), 'v2');
    expect(both.state.readings[r.result.monthlyId as string].voided).toMatchObject({ reason: 'wrongPerson' });
    expect(both.result.withMonthly).toBe(true);
    expect(monthlyDue(both.state, 'm20', T)).toBe(true);
  });
  it('a re-check or monthly check removed as a mistake is asked for again; a duplicate is not', () => {
    const r1 = save(seed, arrival('m2', { sys: 164, dia: 98, recheck: true }), '10:05');
    const r2 = save(r1.state, { memberId: 'm2', kind: 'recheck', sys: 150, dia: 92, pulse: 78, ...flags }, '10:21');
    expect(r2.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    const wrong = execute(r2.state, 'reading.void', { readingId: r2.result.readingId as string, reason: 'wrongPerson' }, nurse, at('10:25'), 'v1');
    expect(wrong.state.attendance[`${T}:m2`].recheckDueAt).toBe('10:25');
    expect(kinds(wrong.state, '10:26')).toContain('recheck:m2');
    const dup = execute(r2.state, 'reading.void', { readingId: r2.result.readingId as string, reason: 'duplicate' }, nurse, at('10:25'), 'v2');
    expect(dup.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    // a second valid re-check keeps the first one's removal from re-asking
    const r3 = save(r2.state, { memberId: 'm2', kind: 'recheck', sys: 148, dia: 90, pulse: 76, ...flags }, '10:30');
    const first = execute(r3.state, 'reading.void', { readingId: r2.result.readingId as string, reason: 'deviceError' }, nurse, at('10:31'), 'v3');
    expect(first.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    // the monthly check removed on its own comes back as a queue item
    const m = save(seed, arrival('m20', { glucose: 150, weight: 54.2 }), '10:05');
    const gone = execute(m.state, 'reading.void', { readingId: m.result.monthlyId as string, reason: 'deviceError' }, nurse, at('10:10'), 'v4');
    expect(gone.state.attendance[`${T}:m20`].monthlyDeferred).toBe(true);
    expect(kinds(gone.state, '10:11')).toContain('monthly:m20');
  });
  it('does not touch today’s queue when a reading from another day is removed', () => {
    const old = Object.values(seed.readings).find((x) => x.memberId === 'm2' && x.kind === 'recheck')!;
    const v = execute(seed, 'reading.void', { readingId: old.id, reason: 'wrongPerson' }, nurse, at('10:05'), 'v5');
    expect(v.state.readings[old.id].voided).toBeDefined();
    expect(v.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    expect(kinds(v.state, '10:06')).toEqual(['arrival:m20', 'arrival:m2']);
  });
  it('takes back a re-check it asked for, and tells a family that was told', () => {
    const r = save(seed, arrival('m2', { sys: 164, dia: 98, tellFamily: true, recheck: true }));
    const v = execute(r.state, 'reading.void', { readingId: r.result.readingId as string, reason: 'wrongPerson' }, nurse, at('10:12'), 'v1');
    expect(v.state.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
    const fixes = live(v.state.messages).filter((m) => m.at === `${T}T10:12`);
    expect(fixes).toHaveLength(2);
    expect(fixes.find((m) => v.state.threads[m.threadId].familyId === 'fm2_0')!.text).toContain('Koreksi');
    expect(fixes.find((m) => v.state.threads[m.threadId].familyId === 'fm2_1')!.kind).toBe('text');
    expect(unreadUpdates(v.state, user('fm2_0')).some((n) => n.kind === 'health.notif.fam.void')).toBe(true);
  });
});

describe('queue.add and queue.dismiss', () => {
  it('adds a spot check: it waits in the queue until a spot reading is saved', () => {
    const a = execute(seed, 'queue.add', { memberId: 'm10', kind: 'spot', note: 'Feeling dizzy' }, nurse, at('10:05'), 'q1');
    expect(a.state.attendance[`${T}:m10`].queueAdds).toEqual([{ at: '10:05', by: 'staff:s8', kind: 'spot', note: 'Feeling dizzy' }]);
    const it = stationQueue(a.state, T, toMin('10:06')).todo.find((x) => x.kind === 'spot')!;
    expect(it).toMatchObject({ personId: 'm10', due: '10:05', note: 'Feeling dizzy' });
    expect(() => execute(a.state, 'queue.add', { memberId: 'm10', kind: 'spot' }, nurse, at('10:06'), 'q2')).toThrow('health.err.alreadyQueued');
    const s = save(a.state, { memberId: 'm10', kind: 'spot', sys: 126, dia: 80, pulse: 70, ...flags }, '10:08');
    expect(kinds(s.state, '10:09').some((k) => k.startsWith('spot'))).toBe(false);
    expect(Object.values(a.state.activity).some((x) => x.key === 'health.feed.queueAdd' && x.memberId === 'm10')).toBe(true);
  });
  it('adds a departure check (sets departureAsked) and a re-check (due now) after the arrival check only', () => {
    const d = execute(seed, 'queue.add', { memberId: 'm10', kind: 'departure' }, nurse, at('11:00'), 'q1');
    expect(d.state.attendance[`${T}:m10`].departureAsked).toEqual({ at: '11:00', by: 'staff:s8' });
    expect(kinds(d.state, '11:01')).toContain('departure:m10');
    expect(() => execute(d.state, 'queue.add', { memberId: 'm10', kind: 'departure' }, nurse, at('11:02'), 'q2')).toThrow('health.err.alreadyQueued');
    const r = execute(seed, 'queue.add', { memberId: 'm10', kind: 'recheck' }, nurse, at('11:00'), 'q3');
    expect(r.state.attendance[`${T}:m10`].recheckDueAt).toBe('11:00');
    expect(kinds(r.state, '11:01')).toContain('recheck:m10');
    expect(() => execute(seed, 'queue.add', { memberId: 'm2', kind: 'departure' }, nurse, at('11:00'), 'q4')).toThrow('health.err.noArrival');
    expect(() => execute(seed, 'queue.add', { memberId: 'm2', kind: 'recheck' }, nurse, at('11:00'), 'q5')).toThrow('health.err.noArrival');
    expect(() => execute(seed, 'queue.add', { memberId: 'm1', kind: 'spot' }, nurse, at('11:00'), 'q6')).toThrow('err.notCheckedIn');
    expect(() => execute(seed, 'queue.add', { memberId: 'm10', kind: 'spot' }, user('s1'), at('11:00'), 'q7')).toThrow('err.forbidden');
  });
  it('a re-check that is waiting for later comes forward when the nurse adds it now', () => {
    const r = save(seed, arrival('m10', { kind: 'recheck', recheck: true }), '10:05');
    expect(stationQueue(r.state, T, toMin('10:06')).later.map((x) => x.due)).toEqual(['10:20']);
    const a = execute(r.state, 'queue.add', { memberId: 'm10', kind: 'recheck' }, nurse, at('10:07'), 'q1');
    expect(stationQueue(a.state, T, toMin('10:08')).todo.some((x) => x.kind === 'recheck' && x.due === '10:07')).toBe(true);
    expect(() => execute(a.state, 'queue.add', { memberId: 'm10', kind: 'recheck' }, nurse, at('10:09'), 'q2')).toThrow('health.err.alreadyQueued');
  });
  it('departure checks queue by themselves from the club setting, with no arrival needed once it was removed', () => {
    expect(kinds(seed, '15:29').some((k) => k.startsWith('departure'))).toBe(false);
    expect(kinds(seed, '15:30')).toContain('departure:m10');
    expect(kinds(seed, '15:30')).not.toContain('departure:m2'); // Hendra never had an arrival check
    const skipped = execute(seed, 'queue.dismiss', { memberId: 'm2', kind: 'arrival', reason: 'declined' }, nurse, at('10:00'), 'd1');
    expect(kinds(skipped.state, '15:30')).toContain('departure:m2');
    const late = tweak(seed, (d) => { d.club.settings.departureFrom = '14:00'; });
    expect(kinds(late, '14:00')).toContain('departure:m10');
  });
  it('a removal made before 15:30 does not cancel the standing departure rule; one made after it does', () => {
    const asked = execute(seed, 'queue.add', { memberId: 'm10', kind: 'departure' }, nurse, at('11:00'), 'q1');
    const gone = execute(asked.state, 'queue.dismiss', { memberId: 'm10', kind: 'departure', reason: 'notNeeded' }, nurse, at('11:05'), 'q2');
    expect(kinds(gone.state, '11:06').some((k) => k.startsWith('departure'))).toBe(false);
    expect(stationQueue(gone.state, T, toMin('15:31')).todo.find((x) => x.kind === 'departure')?.due).toBe('11:00');
    const after = execute(seed, 'queue.dismiss', { memberId: 'm10', kind: 'departure', reason: 'leftEarly' }, nurse, at('15:40'), 'q3');
    expect(kinds(after.state, '15:41').some((k) => k.startsWith('departure'))).toBe(false);
  });
  it('dismisses a pending item with a reason; adding again later shows it again', () => {
    const a = execute(seed, 'queue.add', { memberId: 'm10', kind: 'spot' }, nurse, at('10:05'), 'q1');
    const d = execute(a.state, 'queue.dismiss', { memberId: 'm10', kind: 'spot', reason: 'notNeeded' }, nurse, at('10:06'), 'q2');
    expect(d.state.attendance[`${T}:m10`].dismissed).toEqual([{ at: '10:06', by: 'staff:s8', kind: 'spot', reason: 'notNeeded' }]);
    expect(d.state.attendance[`${T}:m10`].edits.at(-1)).toMatchObject({ what: 'dismiss' });
    expect(kinds(d.state, '10:07').some((k) => k.startsWith('spot'))).toBe(false);
    const again = execute(d.state, 'queue.add', { memberId: 'm10', kind: 'spot', note: 'second look' }, nurse, at('10:20'), 'q3');
    expect(kinds(again.state, '10:21').filter((k) => k.startsWith('spot'))).toEqual(['spot:m10']);
    expect(Object.values(d.state.activity).some((x) => x.key === 'health.feed.dismissed')).toBe(true);
    // arrival dismissed → Tjahjadi leaves the queue
    const x = execute(seed, 'queue.dismiss', { memberId: 'm20', kind: 'arrival', reason: 'declined' }, nurse, at('10:00'), 'q4');
    expect(kinds(x.state, '10:01')).toEqual(['arrival:m2']);
  });
  it('refuses to dismiss what is not in the queue, unknown reasons, and other roles', () => {
    expect(() => execute(seed, 'queue.dismiss', { memberId: 'm10', kind: 'recheck', reason: 'declined' }, nurse, at('10:00'), 'x')).toThrow('health.err.notInQueue');
    expect(() => execute(seed, 'queue.dismiss', { memberId: 'm20', kind: 'arrival', reason: 'whatever' }, nurse, at('10:00'), 'x')).toThrow('health.err.reasonRequired');
    expect(() => execute(seed, 'queue.dismiss', { memberId: 'm20', kind: 'arrival', reason: 'declined' }, user('s1'), at('10:00'), 'x')).toThrow('err.forbidden');
  });
  it('trial guests can be removed from the queue and their re-check cancelled', () => {
    const inClub = tweak(seed, (d) => { d.guestVisits['g-e1'].checkIn = { at: '10:35', by: 'staff:s1' }; });
    const x = execute(inClub, 'queue.dismiss', { guestId: 'g-e1', kind: 'arrival', reason: 'declined' }, nurse, at('10:40'), 'g1');
    expect(x.state.guestVisits['g-e1'].healthDismissed).toEqual({ at: `${T}T10:40`, by: 's8', reason: 'declined' });
    expect(kinds(x.state, '10:41')).not.toContain('arrival:g-e1');
  });
});

describe('the corrected queue', () => {
  it('matches the original on the seed: Tjahjadi (monthly due) then Hendra; one reading done', () => {
    const q = stationQueue(seed, T, toMin('09:58'));
    expect(q.todo.map((x) => x.personId)).toEqual(nurseQueue(seed, T, toMin('09:58')).todo.map((x) => x.personId));
    expect(q.todo.map((x) => [x.personId, x.kind, x.monthly])).toEqual([['m20', 'arrival', true], ['m2', 'arrival', false]]);
    expect(q.later).toEqual([]);
    expect(q.done.map((x) => x.memberId)).toEqual(['m10']);
  });
  it('has real text for the messages in both languages (no raw keys)', () => {
    for (const k of ['health.msg.normal', 'health.msg.watch', 'health.msg.alert', 'health.msg.void', 'health.notif.fam.alert', 'health.feed.alertTold', 'health.err.range.sys', 'health.err.alreadyTaken']) {
      expect(translate('en', k)).not.toBe(k);
      expect(translate('id', k)).not.toBe(k);
      expect(translate('id', k)).not.toBe(translate('en', k));
    }
  });
});

describe('health.setLimits', () => {
  const lim = (patch: Record<string, unknown>) => ({ limits: { ...DEFAULT_LIMITS, ...patch } });
  it('the nurse sets when a reading is Watch or Alert; new readings use it', () => {
    const r = execute(seed, 'health.setLimits', lim({ sysHigh: { watch: 125, alert: 160 } }), nurse, at('10:00'), 'lim1');
    expect(r.state.club.settings.limits?.sysHigh).toEqual({ watch: 125, alert: 160 });
    const sv = save(r.state, arrival('m20', { sys: 128 }));
    expect(sv.result.status).toBe('watch');
    // saved readings are graded again: a 125–139 upper number that was Normal is Watch now
    const was = live(seed.readings).filter((x) => !x.voided && x.sys != null && x.sys >= 125 && x.sys < 140 && x.dia! < 90 && x.status === 'normal');
    expect(was.length).toBeGreaterThan(0);
    for (const x of was) expect(r.state.readings[x.id].status).not.toBe('normal');
    expect(r.result.regraded).toBeGreaterThan(0);
  });
  it('refuses limits out of order or out of range, and other roles', () => {
    expect(() => execute(seed, 'health.setLimits', lim({ sysHigh: { watch: 160, alert: 140 } }), nurse, at('10:00'), 'lim2')).toThrow('health.err.limitOrder');
    expect(() => execute(seed, 'health.setLimits', lim({ spo2Low: { watch: null, alert: null } }), nurse, at('10:00'), 'lim3')).toThrow('health.err.limitOrder');
    expect(() => execute(seed, 'health.setLimits', lim({ tempHigh: { watch: 50, alert: 51 } }), nurse, at('10:00'), 'lim4')).toThrow('health.err.limitRange');
    expect(() => execute(seed, 'health.setLimits', lim({ sysHigh: { watch: 130, alert: 160 } }), getUser(clubs, 's1')!, at('10:00'), 'lim5')).toThrow();
  });
});
