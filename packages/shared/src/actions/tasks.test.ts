import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, DomainError, type ClubState } from '../index';
import { customTasks, doneOf, dutyById, dutyDueBy, dutyIsOn, dutiesOf, DUTIES } from '../rules/tasks';
import { accessOf, menuKeys, roleDraft, type AccessLevel, type GridRole } from '../rules/access';
const dutyIdOf = (role: string) => (DUTIES.find((d) => d.role === role) ?? DUTIES[0]).id;

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

  it('is for the role’s own staff, or management; not for families or other roles', () => {
    const s = fresh();
    fails(s, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's8', 'err.forbidden'); // the nurse cannot tick the lobby's task
    fails(s, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 'f1', 'err.forbidden');
    fails(s, 'task.done', { templateId: 'task-ghost' }, 's1', 'err.notFound');
    const mat = step(s, 'task.done', { templateId: 'task-activity-materials' }, 's9'); // Ega ticks for the activity teachers
    expect(mat.taskDone[`td-task-activity-materials-${T}`].by).toBe('s9');
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
  const input = { title: 'Wipe the handrails', role: 'lobby', every: 'daily', dueBy: '11:00', proof: 'photo', active: true };

  it('management adds a task for a role; it shows at once for that role', () => {
    const r = run(fresh(), 'task.saveTemplate', input, 's9');
    const id = r.result.id as string;
    expect(r.state.taskTemplates[id]).toMatchObject({ ...input, createdBy: 'staff:s9' });
    expect(r.state.taskTemplates[id].weekday).toBeUndefined();
    expect(customTasks(r.state, 'lobby', T, T, 600).map((i) => i.template.title)).toContain('Wipe the handrails');
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

// KC (tasks-view-edit): the Tasks cell on Admin › Roles. View: see and complete one's own duties and tasks. Edit: also create tasks for one's own team,
// and edit or archive the ones one made. Hidden: no Tasks. Every non-management role starts at View; Management keeps full control.
describe('Tasks on View or Edit (Admin › Roles)', () => {
  const input = { title: 'Water the lobby plants', role: 'lobby', every: 'daily', proof: 'none', active: true };
  /** Benjamin (the Owner) sets the role's Tasks cell and saves the role. */
  const setTasks = (s: ClubState, role: GridRole, level: AccessLevel) => {
    const d = roleDraft(s, role);
    return step(s, 'access.setRole', { role, levels: { ...d.levels, tasks: level }, approvals: d.approvals }, 's11');
  };
  // one of each role's own tasks that is open on Wed 21 Oct at 10:00
  const OWN: [GridRole, string, string, Record<string, string>][] = [
    ['lobby', 's1', 'task-lobby-photo', { photoMediaId: MEDIA }], ['nurse', 's8', 'task-nurse-firstaid', {}], ['activity', 's5', 'task-activity-materials', {}],
    ['kitchen', 's2', 'task-kitchen-deep', {}], ['finance', 's10', 'task-finance-bank', {}],
  ];

  it('every non-management role starts at View: ticks its own task off and takes it back, but cannot set tasks', () => {
    const s0 = fresh();
    for (const [role, uid, id, extra] of OWN) {
      expect(accessOf(s0, role, 'tasks')).toBe('view');
      expect(menuKeys(s0, role)).toContain('tasks');
      const r = run(s0, 'task.done', { templateId: id, ...extra }, uid);
      const period = r.result.period as string;
      expect(r.state.taskDone[`td-${id}-${period}`].by).toBe(uid);
      expect(step(r.state, 'task.undo', { templateId: id, period }, uid).taskDone[`td-${id}-${period}`]).toBeUndefined();
      fails(s0, 'task.saveTemplate', { ...input, role }, uid, 'err.forbidden');
      fails(s0, 'task.archiveTemplate', { id }, uid, 'err.forbidden');
      fails(s0, 'duty.configure', { id: dutyIdOf(role), off: true }, uid, 'err.forbidden');
    }
  });

  it('Tasks on Edit: Caca creates a Front desk task, edits and archives her own', () => {
    const s0 = setTasks(fresh(), 'lobby', 'edit');
    expect(s0.club.settings.access?.lobby).toEqual({ tasks: 'edit' });
    const r = run(s0, 'task.saveTemplate', input, 's1');
    const id = r.result.id as string;
    expect(r.state.taskTemplates[id]).toMatchObject({ ...input, createdBy: 'staff:s1' });
    const e = step(r.state, 'task.saveTemplate', { ...input, id, title: 'Water the plants' }, 's1');
    expect(e.taskTemplates[id]).toMatchObject({ title: 'Water the plants', createdBy: 'staff:s1' });
    expect(step(e, 'task.archiveTemplate', { id }, 's1').taskTemplates[id].deletedAt).toBeTruthy();
    // still ticks her own tasks off
    expect(run(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1').result.period).toBe(T);
  });

  it('Tasks on Edit gives no more than her own team: a kitchen task, moving hers to the kitchen, Ega\'s task or duty times are forbidden', () => {
    const s0 = setTasks(fresh(), 'lobby', 'edit');
    fails(s0, 'task.saveTemplate', { ...input, role: 'kitchen' }, 's1', 'err.forbidden');
    const r = run(s0, 'task.saveTemplate', input, 's1');
    fails(r.state, 'task.saveTemplate', { ...input, id: r.result.id, role: 'kitchen' }, 's1', 'err.forbidden');
    expect(s0.taskTemplates['task-lobby-desk'].createdBy).toBe('staff:s9');
    fails(s0, 'task.saveTemplate', { ...input, id: 'task-lobby-desk' }, 's1', 'err.forbidden');
    fails(s0, 'task.archiveTemplate', { id: 'task-lobby-desk' }, 's1', 'err.forbidden');
    fails(s0, 'duty.configure', { id: dutyIdOf('lobby'), off: true }, 's1', 'err.forbidden');
    fails(s0, 'task.saveTemplate', { ...input, role: 'nurse' }, 's8', 'err.forbidden'); // the nurse is still on View
    // back to View: her own task is management's now
    fails(setTasks(r.state, 'lobby', 'view'), 'task.archiveTemplate', { id: r.result.id }, 's1', 'err.forbidden');
  });

  it('Tasks Hidden: no Tasks menu, and ticking off is refused', () => {
    const s0 = setTasks(fresh(), 'lobby', 'off');
    expect(menuKeys(s0, 'lobby')).not.toContain('tasks');
    fails(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's1', 'err.viewOnly');
    fails(s0, 'task.saveTemplate', input, 's1', 'err.forbidden');
  });

  it('a "Create tasks" switch saved before reads as Edit; saving the role drops it', () => {
    const s0 = fresh();
    s0.club.settings.taskCreate = { lobby: true };
    expect(accessOf(s0, 'lobby', 'tasks')).toBe('edit');
    expect(roleDraft(s0, 'lobby').levels.tasks).toBe('edit');
    expect(run(s0, 'task.saveTemplate', input, 's1').state.taskTemplates).toBeTruthy();
    const kept = setTasks(s0, 'lobby', 'edit');
    expect(kept.club.settings.taskCreate).toBeUndefined();
    expect(accessOf(kept, 'lobby', 'tasks')).toBe('edit');
    const view = setTasks(s0, 'lobby', 'view');
    expect(view.club.settings.taskCreate).toBeUndefined();
    expect(view.club.settings.access?.lobby).toBeUndefined();
    expect(accessOf(view, 'lobby', 'tasks')).toBe('view');
  });

  it('management is unchanged: Edit by default, any role, any task, duty settings', () => {
    const s0 = setTasks(fresh(), 'lobby', 'edit');
    expect(accessOf(s0, 'mgmt', 'tasks')).toBe('edit');
    const r = run(s0, 'task.saveTemplate', { ...input, role: 'kitchen' }, 's9');
    expect(r.state.taskTemplates[r.result.id as string].role).toBe('kitchen');
    const c = run(s0, 'task.saveTemplate', input, 's1');
    expect(step(c.state, 'task.saveTemplate', { ...input, id: c.result.id, title: 'Ega renamed it' }, 's9').taskTemplates[c.result.id as string].title).toBe('Ega renamed it');
    expect(step(s0, 'task.archiveTemplate', { id: 'task-kitchen-deep' }, 's9').taskTemplates['task-kitchen-deep'].deletedAt).toBeTruthy();
    expect(step(s0, 'duty.configure', { id: dutyIdOf('lobby'), off: true }, 's9').club.settings.duties?.[dutyIdOf('lobby')]?.off).toBe(true);
    expect(run(s0, 'task.done', { templateId: 'task-lobby-photo', photoMediaId: MEDIA }, 's9').result.period).toBe(T); // ticks for a team
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
