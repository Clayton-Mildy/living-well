// KC round 7: recurring tasks per role (management's checklist), ticking them off, and management's settings for the general duties. See rules/tasks.ts.
// Management sets the tasks (`task.saveTemplate`, `task.archiveTemplate`); the role's staff (or management, for people without a login) tick them off
// (`task.done`, with a photo when the task asks for one) and take it back (`task.undo`). Management also switches a general duty off and sets its time
// (`duty.configure`). Nothing here waits for approval.
import { z } from 'zod';
import type { ClubState, HM, ISODate, TaskTemplate, Weekday } from '../types';
import { DomainError, defineAction, hasRole, isMgmt, isStaff, nameOfUser, roleOf, type ActionDef } from './framework';
import { DUTY_IDS, TASK_ROLES, LAST_DAY, doneId, doneOf, periodOf, templateShows } from '../rules/tasks';
import { mediaIdOf } from './members';

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DomainError('err.invalid', { field: r.error.issues[0]?.path.join('.') || '' });
  return r.data;
}
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const templateSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(120),
  role: z.enum(TASK_ROLES as [string, ...string[]]),
  every: z.enum(['daily', 'weekly', 'monthly']),
  weekday: z.number().int().min(1).max(5).nullish(),
  dayOfMonth: z.number().int().refine((n) => (n >= 1 && n <= 28) || n === LAST_DAY).nullish(),
  dueBy: hm.nullish().or(z.literal('')),
  proof: z.enum(['none', 'photo']),
  active: z.boolean(),
});
type TemplateInput = z.infer<typeof templateSchema>;

const doneSchema = z.object({ templateId: z.string().min(1).max(80), photoMediaId: z.string().nullish(), note: z.string().trim().max(300).nullish() });
const undoSchema = z.object({ templateId: z.string().min(1).max(80), period: z.string().min(1).max(10) });
// off: switch the duty off/on; dueBy: set its time, '' or null = back to the default; a key left out stays as it is
const dutySchema = z.object({ id: z.enum(DUTY_IDS as [string, ...string[]]), off: z.boolean().optional(), dueBy: hm.nullish().or(z.literal('')) });

export const taskActions: ActionDef[] = [
  // ---------- the general duties ----------
  defineAction<{ id: string; off?: boolean; dueBy?: string | null }>({
    name: 'duty.configure',
    can: (u) => isMgmt(u),
    parse: (raw) => {
      const r = parseWith(dutySchema, raw);
      return { id: r.id, ...(r.off !== undefined ? { off: r.off } : {}), ...(r.dueBy !== undefined ? { dueBy: r.dueBy || null } : {}) };
    },
    run: (d, i, ctx) => {
      const st = d.club.settings;
      const cur = st.duties?.[i.id] ?? {};
      const next: { off?: boolean; dueBy?: string } = { ...cur };
      if (i.off !== undefined) { if (i.off) next.off = true; else delete next.off; }
      if (i.dueBy !== undefined) { if (i.dueBy) next.dueBy = i.dueBy; else delete next.dueBy; }
      if ((next.off ?? false) === (cur.off ?? false) && next.dueBy === cur.dueBy) ctx.fail('err.noChanges');
      st.duties ??= {};
      if (next.off || next.dueBy) st.duties[i.id] = next as { off?: boolean; dueBy?: HM };
      else delete st.duties[i.id]; // back to the default: nothing to keep
      ctx.feed({ icon: next.off ? 'toggle_off' : i.off === false ? 'toggle_on' : 'schedule', key: `tasks.feed.duty.${i.id}`, params: { name: nameOfUser(ctx.user) } });
    },
  }),

  defineAction<TemplateInput>({
    name: 'task.saveTemplate',
    can: (u) => hasRole(u, 'mgmt'),
    parse: (raw) => parseWith(templateSchema, raw),
    run: (d, i, ctx) => {
      const prev = i.id ? d.taskTemplates[i.id] : undefined;
      if (i.id && (!prev || prev.deletedAt)) ctx.fail('err.notFound');
      if (i.every === 'weekly' && !i.weekday) ctx.fail('err.invalid', { field: 'weekday' });
      if (i.every === 'monthly' && !i.dayOfMonth) ctx.fail('err.invalid', { field: 'dayOfMonth' });
      const id = i.id ?? ctx.id('tt');
      const row: TaskTemplate = {
        id, clubId: ctx.clubId, createdAt: prev?.createdAt ?? ctx.nowDT, createdBy: prev?.createdBy ?? ctx.actor,
        title: i.title, role: i.role as TaskTemplate['role'], every: i.every,
        ...(i.every === 'weekly' ? { weekday: i.weekday as Weekday } : {}),
        ...(i.every === 'monthly' ? { dayOfMonth: i.dayOfMonth! } : {}),
        ...(i.dueBy ? { dueBy: i.dueBy } : {}),
        proof: i.proof, active: i.active,
      };
      d.taskTemplates[id] = row;
      ctx.result.id = id;
      ctx.feed({ icon: 'checklist', key: 'tasks.feed.saved', params: { title: i.title } });
    },
  }),

  defineAction<{ id: string }>({
    name: 'task.archiveTemplate',
    can: (u) => hasRole(u, 'mgmt'),
    parse: (raw) => parseWith(z.object({ id: z.string().min(1).max(80) }), raw),
    run: (d, i, ctx) => {
      const t = d.taskTemplates[i.id];
      if (!t || t.deletedAt) ctx.fail('err.notFound');
      t.deletedAt = ctx.nowDT; // what was ticked off before stays on record
      ctx.feed({ icon: 'inventory_2', key: 'tasks.feed.archived', params: { title: t.title } });
    },
  }),

  defineAction<{ templateId: string; photoMediaId?: string; note?: string }>({
    name: 'task.done',
    // the role's own staff, or management (for people without a login: housekeeping, the driver)
    can: (u, i, s) => {
      if (!isStaff(u)) return false;
      const t = s.taskTemplates?.[i.templateId];
      return !t || isMgmt(u) || roleOf(u) === t.role;
    },
    parse: (raw) => {
      const r = parseWith(doneSchema, raw);
      const photoMediaId = mediaIdOf(r.photoMediaId);
      return { templateId: r.templateId, ...(photoMediaId ? { photoMediaId } : {}), ...(r.note ? { note: r.note } : {}) };
    },
    run: (d, i, ctx) => {
      const t = d.taskTemplates[i.templateId];
      if (!t || t.deletedAt) ctx.fail('err.notFound');
      if (!templateShows(d as unknown as ClubState, t as TaskTemplate, ctx.today)) ctx.fail(t.active ? 'err.closedDay' : 'tasks.err.paused');
      if (t.proof === 'photo' && !i.photoMediaId) ctx.fail('tasks.err.photoNeeded');
      const period = periodOf(t, ctx.today);
      if (doneOf(d as unknown as ClubState, t.id, period)) ctx.fail('tasks.err.already');
      const id = doneId(t.id, period);
      d.taskDone[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor,
        templateId: t.id, period, date: ctx.today, at: ctx.now, by: ctx.user.id,
        ...(i.photoMediaId ? { photoMediaId: i.photoMediaId } : {}), ...(i.note ? { note: i.note } : {}),
      };
      ctx.result.period = period;
      ctx.feed({ icon: 'task_alt', key: 'tasks.feed.done', params: { name: nameOfUser(ctx.user), title: t.title } });
    },
  }),

  defineAction<{ templateId: string; period: string }>({
    name: 'task.undo',
    can: (u) => isStaff(u),
    parse: (raw) => parseWith(undoSchema, raw),
    run: (d, i, ctx) => {
      const id = doneId(i.templateId, i.period);
      const row = d.taskDone[id];
      if (!row || row.deletedAt) ctx.fail('err.notFound');
      // the person who ticked it, on the same day; management any time
      if (!isMgmt(ctx.user) && !(row.by === ctx.user.id && (row.date as ISODate) === ctx.today)) ctx.fail('err.forbidden');
      delete d.taskDone[id];
      const t = d.taskTemplates[i.templateId];
      ctx.feed({ icon: 'undo', key: 'tasks.feed.undone', params: { name: nameOfUser(ctx.user), title: t?.title ?? '' } });
    },
  }),
];
