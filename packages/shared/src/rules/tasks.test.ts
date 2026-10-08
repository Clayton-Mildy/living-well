import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, live, type ClubState, type DailyLog, type Photo } from '../index';
import { actionItems } from '../notify';
import { dayPlan, pictureSessions, roundProgress, type SessionItem } from './activity';
import { guestsOn } from './attendance';
import { renewalsLeft } from './renewals';
import { approvalTotal } from './approvals';
import { DUTIES, countsOn, customTasks, doneId, doneOf, dueDateOf, dutiesOf, dutyById, dutyDueBy, dutyReminders, dutyState, openTaskCount, periodOf, roleRange, roleSummary, spanOf, teamRange, teamSummary, templateShows } from './tasks';

const T = '2026-10-21'; // Wed
const clubs = buildSeed();
const base: ClubState = clubs.citra;
const NOW = 598; // 09:58, the demo start
const at = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3);
const find = <X extends { id: string }>(a: X[], id: string) => a.find((x) => x.id === id);
const closeOn = (s: ClubState, date: string): ClubState => produce(s, (d) => { d.calendarEvents.ev1 = { id: 'ev1', clubId: s.clubId, createdAt: '', createdBy: 'system', date, kind: 'closed', title: 'Closed' }; });
const run = (s: ClubState, name: string, input: unknown, uid: string, nowMin: number) => execute(s, name, input, getUser({ [s.clubId]: s }, uid)!, { today: T, nowMin }, `r${Math.random()}`).state;

describe('periods and due days', () => {
  it('a daily task counts for the date, a weekly one for its Monday, a monthly one for the month', () => {
    expect(periodOf({ every: 'daily' }, T)).toBe(T);
    expect(periodOf({ every: 'weekly' }, T)).toBe('2026-10-19');
    expect(periodOf({ every: 'weekly' }, '2026-10-25')).toBe('2026-10-19'); // Sunday belongs to the week that ends on it
    expect(periodOf({ every: 'monthly' }, T)).toBe('2026-10');
    expect(doneId('t1', '2026-10')).toBe('td-t1-2026-10');
  });

  it('weekly is due on its weekday, monthly on its day; a closed due day moves to the next open day', () => {
    expect(dueDateOf(base, { every: 'daily' }, T)).toBe(T);
    expect(dueDateOf(base, { every: 'weekly', weekday: 5 }, T)).toBe('2026-10-23');
    expect(dueDateOf(base, { every: 'weekly', weekday: 1 }, T)).toBe('2026-10-19');
    expect(dueDateOf(base, { every: 'monthly', dayOfMonth: 15 }, T)).toBe('2026-10-15');
    expect(dueDateOf(base, { every: 'monthly', dayOfMonth: 31 }, T)).toBe('2026-10-29'); // the last open day (30 Oct the club is closed, 31 Oct is a Saturday)
    expect(dueDateOf(base, { every: 'monthly', dayOfMonth: 1 }, '2026-11-10')).toBe('2026-11-02'); // 1 Nov is a Sunday
    const closedFri = closeOn(base, '2026-10-23');
    expect(dueDateOf(closedFri, { every: 'weekly', weekday: 5 }, T)).toBe('2026-10-22'); // nothing open after it: the last open day before
  });
});

describe('custom tasks', () => {
  it('daily ones show on every open day only; weekly ones all week until done; monthly ones all month', () => {
    const nurse = (date: string) => customTasks(base, 'nurse', date, T, NOW).map((i) => i.template.id);
    expect(nurse(T)).toEqual(['task-nurse-pc303', 'task-nurse-firstaid', 'task-nurse-thermo']);
    for (const d of ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23']) expect(nurse(d)).toContain('task-nurse-firstaid'); // visible all week
    expect(nurse('2026-10-26')).toContain('task-nurse-firstaid'); // the next week's own copy
    expect(nurse('2026-10-24')).toEqual([]); // Saturday: closed
    expect(nurse('2026-10-05')).toContain('task-nurse-thermo'); // monthly: all month
  });

  it('done state, overdue and what counts today', () => {
    const lobby = customTasks(base, 'lobby', T, T, NOW);
    const desk = find(lobby.map((i) => ({ id: i.template.id, i })), 'task-lobby-desk')!.i;
    expect(desk.done).toMatchObject({ by: 's1', at: '08:22', date: T });
    expect(desk.overdue).toBe(false);
    const photo = lobby.find((i) => i.template.id === 'task-lobby-photo')!;
    expect(photo.done).toBeUndefined();
    expect(photo.overdue).toBe(false); // no time set: due all day
    // a task with a time is overdue once the time has passed (housekeeping toilets, 10:00)
    const toilets = (nowMin: number) => customTasks(base, 'housekeeping', T, T, nowMin).find((i) => i.template.id === 'task-hk-toilets')!;
    expect(toilets(NOW).overdue).toBe(false);
    expect(toilets(at('10:01')).overdue).toBe(true);
    // weekly: not overdue before its day, overdue after it (the bank reconciliation's Monday has passed)
    const bank = customTasks(base, 'finance', T, T, NOW)[0];
    expect(bank).toMatchObject({ due: '2026-10-19', overdue: true });
    const firstAid = customTasks(base, 'nurse', T, T, NOW).find((i) => i.template.id === 'task-nurse-firstaid')!;
    expect(firstAid.due).toBe('2026-10-23');
    expect(firstAid.overdue).toBe(false);
    expect(countsOn(firstAid, T)).toBe(false); // not due yet: left out of today's progress
    // a monthly task ticked off this month stays done all month and starts again next month
    const thermo = (date: string) => customTasks(base, 'nurse', date, T, NOW).find((i) => i.template.id === 'task-nurse-thermo')!;
    expect(thermo(T).done).toBeTruthy();
    expect(thermo('2026-11-03').done).toBeUndefined();
  });

  it('ticking a weekly task shows it done on every day of its week', () => {
    const s = run(base, 'task.done', { templateId: 'task-nurse-firstaid' }, 's8', NOW);
    expect(doneOf(s, 'task-nurse-firstaid', '2026-10-19')).toMatchObject({ by: 's8', date: T });
    for (const d of ['2026-10-19', '2026-10-23']) expect(customTasks(s, 'nurse', d, T, NOW).find((i) => i.template.id === 'task-nurse-firstaid')!.done).toBeTruthy();
    expect(customTasks(s, 'nurse', '2026-10-26', T, NOW).find((i) => i.template.id === 'task-nurse-firstaid')!.done).toBeUndefined();
  });

  it('a paused template hides, but keeps showing for a period it was ticked off in; a template does not show before it was created', () => {
    const paused = produce(base, (d) => { d.taskTemplates['task-lobby-photo'].active = false; d.taskTemplates['task-lobby-desk'].active = false; });
    expect(customTasks(paused, 'lobby', T, T, NOW).map((i) => i.template.id)).toEqual(['task-lobby-desk']); // the desk was ticked today
    expect(templateShows(base, base.taskTemplates['task-lobby-desk'], '2026-01-05')).toBe(false); // before it existed
  });

  it('the seed: history of earlier days, and the housekeeping rounds nobody ticks (no login)', () => {
    const hk = roleSummary(base, 'housekeeping', T, T, NOW);
    expect(hk.people.map((p) => p.id)).toEqual(['s4']);
    expect(hk).toMatchObject({ customDone: 0, customTotal: 2, total: 0 }); // no general duties for housekeeping
    expect(roleSummary(base, 'housekeeping', '2026-10-20', T, NOW).customDone).toBe(2); // yesterday: both done
    expect(live(base.taskDone).some((d) => d.date === T && d.at >= '09:58')).toBe(false); // nothing seeded after the demo starts
  });
});

describe('general duties: from the data, for any day', () => {
  const duty = (s: ClubState, id: string, date = T, nowMin = NOW) => dutyState(s, dutyById(id)!, date, T, nowMin);
  const withCfg = (s: ClubState, duties: NonNullable<ClubState['club']['settings']['duties']>) => produce(s, (d) => { d.club.settings.duties = duties; });
  const user = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;

  it('closed days have none; the catalogue has a duty set for each role that has one', () => {
    expect(dutiesOf(closeOn(base, T), 'lobby', T, T, at('16:00'))).toEqual([]);
    expect(customTasks(closeOn(base, T), 'lobby', T, T, NOW)).toEqual([]);
    expect(new Set(DUTIES.map((d) => d.role))).toEqual(new Set(['activity', 'kitchen', 'nurse', 'lobby', 'finance', 'mgmt'])); // housekeeping and the driver: additional tasks only
    expect(new Set(DUTIES.map((d) => d.id)).size).toBe(DUTIES.length);
  });

  it('a day duty is late once its time has come, and done when the data shows it (the lunch photo, with who and when)', () => {
    expect(duty(base, 'kitchen.lunchPhoto', T, at('12:29'))).toMatchObject({ status: 'open', late: 0 });
    const late = duty(base, 'kitchen.lunchPhoto', T, at('12:30'));
    expect(late).toMatchObject({ status: 'late', done: 0, total: 1, late: 1 });
    expect(late.parts[0]).toMatchObject({ due: '12:30', done: false, link: '/today' });
    const s = run(base, 'menu.postLunchPhoto', { date: T, mediaId: 'md_lunch12345', notify: false }, 's2', at('12:10'));
    expect(duty(s, 'kitchen.lunchPhoto', T, at('13:00'))).toMatchObject({ status: 'done', done: 1, late: 0 });
    expect(duty(s, 'kitchen.lunchPhoto', T, at('13:00')).parts[0]).toMatchObject({ by: 's2', at: '12:10' });
    // the tea photo is its own duty, due at 15:15
    expect(duty(s, 'kitchen.teaPhoto', T, at('15:14')).status).toBe('open');
    expect(duty(s, 'kitchen.teaPhoto', T, at('15:15')).status).toBe('late');
    const tea = run(s, 'menu.postLunchPhoto', { date: T, meal: 'tea', notify: false }, 's3', at('15:05'));
    expect(duty(tea, 'kitchen.teaPhoto', T, at('15:20'))).toMatchObject({ status: 'done' });
    expect(duty(tea, 'kitchen.lunchPhoto', T, at('15:20')).parts[0].at).toBe('12:10'); // a tea photo is not a lunch photo
  });

  it('activity: a picture and a joined mark for each session, each due when its session ends; lunch and mood follow the daily log rounds', () => {
    const sessions = pictureSessions(base, T);
    const pics = duty(base, 'activity.pictures', T, at('11:50'));
    expect(pics.parts.map((p) => [p.activityId, p.due, p.done])).toEqual(sessions.map((x) => [x.activity!.id, x.time === '10:30' ? '11:45' : '14:45', false]));
    expect(pics).toMatchObject({ total: sessions.length, late: 1 }); // the first session has ended, the second has not
    const first = sessions[0].activity!;
    const withPhoto = produce(base, (d) => {
      d.photos.px = { id: 'px', clubId: d.clubId, createdAt: `${T}T11:00`, createdBy: 'staff:s5', date: T, time: '11:00', kind: 'activity', media: 'photo', activity: first.name, memberIds: [], tone: 1, takenBy: 's5', visibility: 'pending' } as Photo;
    });
    expect(duty(withPhoto, 'activity.pictures', T, at('11:50')).parts[0]).toMatchObject({ done: true, by: 's5', at: '11:00' });
    expect(duty(withPhoto, 'activity.pictures', T, at('11:50')).late).toBe(0);
    // joined marks: one part per session, counted by roundProgress
    const joined = duty(base, 'activity.joined', T, at('12:00'));
    const slot = dayPlan(base, T).find((x): x is SessionItem => x.kind === 'session' && x.slot === '10:30')!;
    expect(joined.parts[0]).toMatchObject({ key: 'joined:10:30', activityId: slot.activity!.id, due: '11:45', done: false, count: { done: 0, total: roundProgress(base, T, '10:30').total }, link: '/log?round=10:30' });
    const mark = (st: ClubState, patch: Partial<DailyLog>) => produce(st, (d) => {
      for (const id of ['m2', 'm10', 'm20']) {
        const row = { id: `log-${id}-${T}`, clubId: d.clubId, createdAt: `${T}T10:50`, createdBy: 'staff:s5', memberId: id, date: T, note: '', status: 'saved', by: 's5', edits: [], ...patch } as DailyLog;
        d.dailyLogs[row.id] = { ...d.dailyLogs[row.id], ...row };
      }
    });
    expect(duty(mark(base, { sessions: { '10:30': 'joined' } }), 'activity.joined', T, at('12:00')).parts[0]).toMatchObject({ done: true, count: { done: 3, total: 3 } });
    expect(duty(base, 'activity.lunch', T, at('13:29')).status).toBe('open');
    expect(duty(base, 'activity.lunch', T, at('13:30'))).toMatchObject({ status: 'late', parts: [{ count: { done: 0, total: 3 } }] });
    expect(duty(mark(base, { lunch: 'all' }), 'activity.lunch', T, at('14:00')).status).toBe('done');
    expect(duty(base, 'activity.mood', T, at('15:00')).status).toBe('late');
    expect(duty(mark(base, { mood: 'calm' }), 'activity.mood', T, at('15:30')).status).toBe('done');
  });

  it('nurse and front desk: the checks, the check-outs and the guests, counted from the readings and the attendance', () => {
    const arrival = duty(base, 'nurse.arrival', T, at('10:30'));
    expect(arrival).toMatchObject({ status: 'late', total: 1 });
    expect(arrival.parts[0].count!.total).toBe(3); // three members have come
    expect(duty(base, 'nurse.departure', T, at('16:00')).status).toBe('open'); // due 16:15
    let s = base;
    for (const id of ['m2', 'm10', 'm20']) s = run(s, 'attendance.checkOut', { memberId: id }, 's1', at('15:40'));
    expect(duty(s, 'lobby.checkout', T, at('15:45'))).toMatchObject({ status: 'done' });
    expect(duty(base, 'lobby.checkout', T, at('16:30')).status).toBe('late'); // closing time
    // each booked guest is a part, due half an hour before the visit (a trial: from opening)
    const guests = guestsOn(base, T).filter((g) => g.status === 'booked');
    const gd = duty(base, 'lobby.guests', T, NOW);
    expect(gd.total).toBe(guests.length);
    expect(gd.parts.every((p) => p.link === '/today' && p.bell?.id.startsWith('guest:'))).toBe(true);
    // renewals: from the 20th, counted by the renewal rules; today only
    const ren = duty(base, 'lobby.renewals');
    expect(ren.parts[0]).toMatchObject({ done: renewalsLeft(base, T) === 0, link: '/renewals' });
    expect(dutiesOf(buildSeed('2026-10-19').citra, 'lobby', '2026-10-19', '2026-10-19', NOW).some((d) => d.def.id === 'lobby.renewals')).toBe(false);
  });

  it('finance and management: waiting work is counted for today only; the invoice run follows the issue day', () => {
    expect(duty(base, 'finance.overdue').parts[0].count!.total).toBe(1);
    expect(duty(base, 'mgmt.approvals').parts[0]).toMatchObject({ done: approvalTotal(base) === 0, link: '/reviews' });
    expect(duty(base, 'finance.run').parts[0].link).toBe('/today?run=1');
    // chasing the overdue invoice (a reminder or a note today) ticks it
    const chased = produce(base, (d) => { const inv = Object.values(d.invoices).find((i) => i.number === 'INV-2609-020')!; inv.callNotes.push({ at: `${T}T10:00`, by: 'staff:s10', text: 'Called' }); });
    expect(duty(chased, 'finance.overdue').status).toBe('done');
  });

  it('a past day is worked out from the data; what only the live state can tell shows as "past", not as missed', () => {
    const y = '2026-10-20';
    expect(duty(base, 'lobby.checkout', y)).toMatchObject({ status: 'done' }); // everyone left that day
    expect(duty(base, 'nurse.arrival', y).status).toBe('done');
    expect(duty(base, 'activity.mood', y).status).toBe('done');
    expect(duty(base, 'finance.overdue', y)).toMatchObject({ status: 'past', parts: [] });
    expect(duty(base, 'mgmt.approvals', y).status).toBe('past');
    expect(duty(base, 'lobby.renewals', y).status).toBe('past');
    // a duty not done on a past day is late (missed), and a picture added later for that day counts
    const miss = duty(base, 'kitchen.lunchPhoto', y, NOW);
    const photo = produce(base, (d) => {
      d.photos.pl = { id: 'pl', clubId: d.clubId, createdAt: `${y}T12:20`, createdBy: 'staff:s3', date: y, time: '12:20', kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [], tone: 3, takenBy: 's3', visibility: 'visible' } as Photo;
      d.dayMenus[y] = { ...(d.dayMenus[y] ?? { id: y, clubId: d.clubId, createdAt: '', createdBy: 'system', date: y, allergyPlans: [] }), photoIds: ['pl'] };
    });
    expect(duty(photo, 'kitchen.lunchPhoto', y, NOW).status).toBe('done');
    expect(['late', 'done']).toContain(miss.status); // missed unless the seed has a photo
    expect(duty(base, 'kitchen.lunchPhoto', '2026-10-22', NOW).status).toBe('none'); // a coming day: nothing yet
  });

  it('management can switch a duty off and retime it: it leaves the tracker, the bell and the badge', () => {
    expect(dutyDueBy(base, dutyById('kitchen.lunchPhoto')!)).toBe('12:30');
    const s = withCfg(base, { 'kitchen.lunchPhoto': { dueBy: '13:00' }, 'kitchen.teaPhoto': { off: true } });
    expect(dutyDueBy(s, dutyById('kitchen.lunchPhoto')!)).toBe('13:00');
    expect(duty(s, 'kitchen.lunchPhoto', T, at('12:45')).status).toBe('open');
    expect(duty(s, 'kitchen.lunchPhoto', T, at('13:00')).status).toBe('late');
    expect(dutiesOf(s, 'kitchen', T, T, at('15:30')).map((d) => d.def.id)).toEqual(['kitchen.lunchPhoto', 'kitchen.allergy']);
    expect(duty(s, 'kitchen.teaPhoto', T, at('15:30')).status).toBe('none');
    expect(dutyReminders(s, 'kitchen', T, at('15:30')).map((r) => r.id)).toEqual(['duty:kitchen.lunchPhoto:lunchPhoto']);
    // a session duty keeps its own times unless a time is set: then that time is the deadline for every session
    const set = withCfg(base, { 'activity.pictures': { dueBy: '15:30' } });
    expect(duty(set, 'activity.pictures', T, at('12:00')).late).toBe(0);
    expect(duty(set, 'activity.pictures', T, at('15:30')).late).toBe(2);
    // off also takes it out of the past days and the week
    const off = withCfg(base, { 'nurse.arrival': { off: true } });
    expect(duty(off, 'nurse.arrival', '2026-10-20').status).toBe('none');
    const [from, to] = spanOf('week', T);
    expect(roleRange(off, 'nurse', from, to, T, NOW).duties.map((d) => d.def.id)).toEqual(['nurse.departure']);
  });

  it('the bell: one reminder per late part for the person on duty, gone when done, and nobody else gets it', () => {
    const kitchen = user(base, 's2');
    const ids = (s: ClubState, u = kitchen, nowMin = NOW) => actionItems(s, u, T, nowMin).map((i) => i.id);
    expect(ids(base, kitchen, at('12:29'))).not.toContain('duty:kitchen.lunchPhoto:lunchPhoto');
    expect(actionItems(base, kitchen, T, at('12:31')).find((i) => i.id === 'duty:kitchen.lunchPhoto:lunchPhoto')).toMatchObject({ kind: 'tasks.notif.act.lunchPhoto', link: '/today', severity: 'attention' });
    const posted = run(base, 'menu.postLunchPhoto', { date: T, notify: false }, 's2', at('12:35'));
    expect(ids(posted, kitchen, at('12:40'))).not.toContain('duty:kitchen.lunchPhoto:lunchPhoto'); // clears itself
    // nobody else is told: not the lobby, not the nurse, not management
    for (const uid of ['s1', 's8', 's9', 's10']) expect(ids(base, user(base, uid), at('12:31'))).not.toContain('duty:kitchen.lunchPhoto:lunchPhoto');
    // the activity round items are the duty reminders now (same ids as before), one for each late session picture
    const act = actionItems(base, user(base, 's5'), T, at('15:05'));
    expect(act.filter((i) => i.id.startsWith('round:')).map((i) => `${i.id}:${i.params.n}`)).toEqual(['round:mood:3', 'round:13:30:3', 'round:lunch:3', 'round:10:30:3']);
    expect(act.filter((i) => i.id.startsWith('duty:pic:'))).toHaveLength(2);
    expect(act.find((i) => i.id.startsWith('duty:pic:'))).toMatchObject({ kind: 'tasks.notif.act.picture', link: expect.stringContaining('/camera?tab=activity&date=' + T) });
    // switched off: gone
    const off = produce(base, (d) => { d.club.settings.duties = { 'activity.pictures': { off: true }, 'activity.mood': { off: true } }; });
    const left = actionItems(off, user(off, 's5'), T, at('15:05')).map((i) => i.id);
    expect(left.some((i) => i.startsWith('duty:pic:'))).toBe(false);
    expect(left).not.toContain('round:mood');
    // the front desk's guest and renewal reminders are duties too (ids and messages as before); management keeps the plain items
    const lobby = actionItems(base, user(base, 's1'), T, at('10:00'));
    expect(lobby.some((i) => i.id.startsWith('guest:'))).toBe(true);
    expect(lobby.find((i) => i.kind === 'renewals.notif.act.followUp')).toMatchObject({ params: { n: renewalsLeft(base, T) }, link: '/renewals' });
    expect(actionItems(base, user(base, 's9'), T, at('10:00')).some((i) => i.kind === 'renewals.notif.act.followUp')).toBe(true);
  });
});

describe('a role’s day, a week and a month', () => {
  it('the day: duty score and additional tasks apart; the badge counts late duties and tasks due', () => {
    const lobby = roleSummary(base, 'lobby', T, T, NOW);
    expect(lobby.people.map((p) => p.id)).toEqual(['s1']);
    expect(lobby).toMatchObject({ role: 'lobby', done: 0, customDone: 1, customTotal: 2 }); // the desk is ticked; the lobby photo is open
    expect(lobby.total).toBe(lobby.duties.reduce((n, d) => n + d.parts.length, 0));
    expect(lobby.late).toBeGreaterThan(0); // the trial day from opening, the renewals from 09:00
    expect(openTaskCount(base, 'lobby', T, NOW)).toBe(lobby.late + 1);
    expect(roleSummary(base, 'housekeeping', T, T, NOW)).toMatchObject({ total: 0, done: 0, customTotal: 2, customDone: 0 });
    expect(roleSummary(base, 'housekeeping', '2026-10-20', T, NOW).customDone).toBe(2); // yesterday: both done
    // the team lists the roles that have duties or tasks; a past day too
    expect(teamSummary(base, T, T, NOW).map((r) => r.role)).toEqual(['lobby', 'nurse', 'activity', 'kitchen', 'housekeeping', 'driver', 'finance', 'mgmt']);
    const past = roleSummary(base, 'kitchen', '2026-10-20', T, NOW);
    expect(past.duties.length).toBeGreaterThan(0);
    expect(past.customDone).toBe(past.customTotal);
  });

  it('a week or a month adds the days up: parts done of all, today only what is done or late, today-only duties left out', () => {
    const [wFrom, wTo] = spanOf('week', T);
    expect([wFrom, wTo]).toEqual(['2026-10-19', '2026-10-25']);
    expect(spanOf('month', T)).toEqual(['2026-10-01', '2026-10-31']);
    expect(spanOf('day', T)).toEqual([T, T]);
    const nurse = roleRange(base, 'nurse', wFrom, wTo, T, NOW);
    // Mon, Tue and today: each day has an arrival check part; today's departure is not due yet and is not counted
    const arr = nurse.duties.find((d) => d.def.id === 'nurse.arrival')!;
    const dep = nurse.duties.find((d) => d.def.id === 'nurse.departure')!;
    expect(arr.total).toBe(2); // Monday and Tuesday: today's is not late yet
    expect(arr.done).toBe(2);
    expect(dep.total).toBe(2);
    const late = roleRange(base, 'nurse', wFrom, wTo, T, at('17:00'));
    expect(late.duties.find((d) => d.def.id === 'nurse.arrival')!.total).toBe(3); // 10:30 has passed: today's counts, and is not done
    const fin = roleRange(base, 'finance', wFrom, wTo, T, NOW);
    expect(fin.duties.find((d) => d.def.id === 'finance.overdue')).toMatchObject({ na: true });
    expect(teamRange(base, wFrom, wTo, T, NOW).map((r) => r.role)).toContain('mgmt');
    // additional tasks: each task of a period once
    expect(roleRange(base, 'nurse', wFrom, wTo, T, NOW).customTotal).toBeGreaterThan(0);
  });
});
