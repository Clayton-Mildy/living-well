import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, DomainError, type ClubState } from '../index';
import { customTasks, doneOf, dutyById, dutyDueBy, dutyIsOn, dutiesOf } from '../rules/tasks';

const T = '2026-10-21'; // Wed
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const fresh = (): ClubState => buildSeed().citra;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, getUser({ [s.clubId]: s }, uid)!, clk, `t${++n}`);
const step = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => run(s, name, input, uid, clk).state;
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const MEDIA = 'md_proof12345';

describe('task.done and task.undo', () => {
  it('ticks a task off for today with the proof photo; the tick shows who and when', () => {
    const s0 = fresh();
    fails(s0, 'task.done', { templateId: 'task-lobby-photo' }, 's1', 'tasks.err.photoNeeded'); // a photo task needs its photo
    const r = run(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA, note: 'Flowers fresh' }, 's1');
    expect(r.result.period).toBe(T);
    expect(r.state.taskDone[`td-task-lobby-photo-${T}`]).toMatchObject({ templateId: 'task-lobby-photo', period: T, date: T, at: '10:00', by: 's1', photoMediaId: MEDIA, note: 'Flowers fresh' });
    expect(doneOf(r.state, 'task-lobby-photo', T)).toBeTruthy();
    expect(Object.values(r.state.activity).some((a) => a.key === 'tasks.feed.done' && a.params.title === 'Photo of the tidy lobby')).toBe(true);
    fails(r.state, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1', 'tasks.err.already');
    fails(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: 'not-a-media-id' }, 's1', 'err.invalid');
  });

  it('is for the role’s own staff, or management (for people with no login); not for families or other roles', () => {
    const s = fresh();
    fails(s, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's8', 'err.forbidden'); // the nurse cannot tick the lobby's task
    fails(s, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 'f1', 'err.forbidden');
    fails(s, 'task.done', { templateId: 'task-ghost' }, 's1', 'err.notFound');
    const hk = step(s, 'task.done', { templateId: 'task-hk-toilets', photoMediaId: MEDIA }, 's9'); // Ega ticks for housekeeping
    expect(hk.taskDone[`td-task-hk-toilets-${T}`].by).toBe('s9');
  });

  it('a weekly task counts for its week, a monthly one for its month', () => {
    let s = step(fresh(), 'task.done', { templateId: 'task-nurse-firstaid' }, 's8');
    expect(s.taskDone['td-task-nurse-firstaid-2026-10-19']).toBeTruthy();
    s = step(s, 'task.done', { templateId: 'task-finance-bank' }, 's10');
    expect(s.taskDone['td-task-finance-bank-2026-10-19']).toBeTruthy();
    fails(s, 'task.done', { templateId: 'task-nurse-thermo' }, 's8', 'tasks.err.already'); // ticked off in the seed for October
    s = step(s, 'task.undo', { templateId: 'task-nurse-thermo', period: '2026-10' }, 's9');
    expect(step(s, 'task.done', { templateId: 'task-nurse-thermo' }, 's8').taskDone['td-task-nurse-thermo-2026-10']).toBeTruthy();
  });

  it('nothing to tick on a closed day or for a paused task', () => {
    const s = fresh();
    fails(s, 'task.done', { templateId: 'task-lobby-desk' }, 's1', 'err.closedDay', { today: '2026-10-24', nowMin: 600 }); // a Saturday
    const paused = step(s, 'task.saveTemplate', { id: 'task-lobby-photo', title: 'Photo of the tidy lobby', role: 'lobby', every: 'daily', proof: 'photo', active: false }, 's9');
    fails(paused, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1', 'tasks.err.paused');
  });

  it('undo: the person who ticked it, the same day; management any time; nobody else', () => {
    const s0 = fresh();
    const s = step(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1');
    const id = `td-task-lobby-photo-${T}`;
    fails(s, 'task.undo', { templateId: 'task-lobby-photo', period: T }, 's8', 'err.forbidden');
    fails(s, 'task.undo', { templateId: 'task-lobby-photo', period: T }, 's1', 'err.forbidden', { today: '2026-10-22', nowMin: 600 }); // another day
    expect(step(s, 'task.undo', { templateId: 'task-lobby-photo', period: T }, 's9', { today: '2026-10-22', nowMin: 600 }).taskDone[id]).toBeUndefined();
    const back = step(s, 'task.undo', { templateId: 'task-lobby-photo', period: T }, 's1');
    expect(back.taskDone[id]).toBeUndefined();
    expect(doneOf(back, 'task-lobby-photo', T)).toBeUndefined();
    expect(Object.values(back.activity).some((a) => a.key === 'tasks.feed.undone')).toBe(true);
    fails(back, 'task.undo', { templateId: 'task-lobby-photo', period: T }, 's1', 'err.notFound');
    // and it can be ticked again
    expect(step(back, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1').taskDone[id]).toBeTruthy();
  });
});

describe('task.saveTemplate and task.archiveTemplate', () => {
  const input = { title: 'Wipe the handrails', role: 'housekeeping', every: 'daily', dueBy: '11:00', proof: 'photo', active: true };

  it('management adds a task for a role; it shows at once for that role', () => {
    const r = run(fresh(), 'task.saveTemplate', input, 's9');
    const id = r.result.id as string;
    expect(r.state.taskTemplates[id]).toMatchObject({ ...input, createdBy: 'staff:s9' });
    expect(r.state.taskTemplates[id].weekday).toBeUndefined();
    expect(customTasks(r.state, 'housekeeping', T, T, 600).map((i) => i.template.title)).toContain('Wipe the handrails');
  });

  it('weekly needs its weekday, monthly its day (1–28 or the last open day); extra fields are dropped; editing keeps the row', () => {
    const s = fresh();
    fails(s, 'task.saveTemplate', { ...input, every: 'weekly' }, 's9', 'err.invalid');
    fails(s, 'task.saveTemplate', { ...input, every: 'monthly' }, 's9', 'err.invalid');
    fails(s, 'task.saveTemplate', { ...input, every: 'monthly', dayOfMonth: 30 }, 's9', 'err.invalid');
    fails(s, 'task.saveTemplate', { ...input, title: '  ' }, 's9', 'err.invalid');
    fails(s, 'task.saveTemplate', { ...input, role: 'family' }, 's9', 'err.invalid');
    const w = run(s, 'task.saveTemplate', { ...input, every: 'weekly', weekday: 2, dayOfMonth: 9, dueBy: '' }, 's9');
    const row = w.state.taskTemplates[w.result.id as string];
    expect(row).toMatchObject({ every: 'weekly', weekday: 2 });
    expect(row.dayOfMonth).toBeUndefined();
    expect(row.dueBy).toBeUndefined();
    const m = step(w.state, 'task.saveTemplate', { ...input, id: row.id, every: 'monthly', dayOfMonth: 31, active: false }, 's9');
    expect(m.taskTemplates[row.id]).toMatchObject({ every: 'monthly', dayOfMonth: 31, active: false, createdAt: row.createdAt });
    expect(m.taskTemplates[row.id].weekday).toBeUndefined();
    fails(s, 'task.saveTemplate', { ...input, id: 'task-ghost' }, 's9', 'err.notFound');
  });

  it('archiving hides a task but keeps what was ticked off; only management can set tasks', () => {
    const s0 = fresh();
    for (const uid of ['s1', 's8', 's5', 's2', 's10', 'f1']) {
      fails(s0, 'task.saveTemplate', input, uid, 'err.forbidden');
      fails(s0, 'task.archiveTemplate', { id: 'task-lobby-desk' }, uid, 'err.forbidden');
    }
    const s = step(s0, 'task.archiveTemplate', { id: 'task-lobby-desk' }, 's9');
    expect(s.taskTemplates['task-lobby-desk'].deletedAt).toBeTruthy();
    expect(s.taskDone[`td-task-lobby-desk-${T}`]).toBeTruthy();
    expect(customTasks(s, 'lobby', '2026-10-22', T, 600).map((i) => i.template.id)).not.toContain('task-lobby-desk'); // gone going forward
    expect(customTasks(s, 'lobby', T, T, 600).map((i) => i.template.id)).toContain('task-lobby-desk'); // today it was ticked: the record shows
    fails(s, 'task.archiveTemplate', { id: 'task-lobby-desk' }, 's9', 'err.notFound');
  });
});

describe('duty.configure', () => {
  const lunch = dutyById('kitchen.lunchPhoto')!;
  it('management switches a general duty off and on, and sets its time; the default comes back when the time is cleared', () => {
    const s0 = fresh();
    expect(dutyDueBy(s0, lunch)).toBe('12:30');
    const off = run(s0, 'duty.configure', { id: 'kitchen.lunchPhoto', off: true }, 's9');
    expect(off.state.club.settings.duties).toEqual({ 'kitchen.lunchPhoto': { off: true } });
    expect(dutyIsOn(off.state, 'kitchen.lunchPhoto')).toBe(false);
    expect(dutiesOf(off.state, 'kitchen', T, T, 13 * 60).map((d) => d.def.id)).not.toContain('kitchen.lunchPhoto');
    expect(Object.values(off.state.activity).some((a) => a.key === 'tasks.feed.duty.kitchen.lunchPhoto' && a.params.name === 'Ega')).toBe(true);
    const timed = step(off.state, 'duty.configure', { id: 'kitchen.lunchPhoto', off: false, dueBy: '13:15' }, 's9');
    expect(timed.club.settings.duties).toEqual({ 'kitchen.lunchPhoto': { dueBy: '13:15' } }); // off = false drops the flag
    expect(dutyDueBy(timed, lunch)).toBe('13:15');
    // a time on its own keeps the switch as it is; clearing it ('' or null) goes back to the default and drops the empty entry
    const both = step(timed, 'duty.configure', { id: 'kitchen.lunchPhoto', off: true }, 's9');
    expect(both.club.settings.duties!['kitchen.lunchPhoto']).toEqual({ off: true, dueBy: '13:15' });
    expect(step(both, 'duty.configure', { id: 'kitchen.lunchPhoto', dueBy: null }, 's9').club.settings.duties!['kitchen.lunchPhoto']).toEqual({ off: true });
    const back = step(timed, 'duty.configure', { id: 'kitchen.lunchPhoto', dueBy: '' }, 's9');
    expect(back.club.settings.duties).toEqual({});
    expect(dutyDueBy(back, lunch)).toBe('12:30');
  });

  it('only management; the duty must exist; the time must be a time; a change that changes nothing is refused', () => {
    const s = fresh();
    for (const uid of ['s1', 's2', 's8', 's5', 's10', 'f1']) fails(s, 'duty.configure', { id: 'kitchen.lunchPhoto', off: true }, uid, 'err.forbidden');
    fails(s, 'duty.configure', { id: 'kitchen.ghost', off: true }, 's9', 'err.invalid');
    fails(s, 'duty.configure', { id: 'kitchen.lunchPhoto', dueBy: '25:00' }, 's9', 'err.invalid');
    fails(s, 'duty.configure', { id: 'kitchen.lunchPhoto', dueBy: '9am' }, 's9', 'err.invalid');
    fails(s, 'duty.configure', { id: 'kitchen.lunchPhoto' }, 's9', 'err.noChanges');
    fails(s, 'duty.configure', { id: 'kitchen.lunchPhoto', off: false }, 's9', 'err.noChanges'); // already on
    const off = step(s, 'duty.configure', { id: 'nurse.arrival', off: true }, 's9');
    fails(off, 'duty.configure', { id: 'nurse.arrival', off: true }, 's9', 'err.noChanges');
  });
});
