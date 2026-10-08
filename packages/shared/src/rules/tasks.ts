// KC round 7: a task tracker for each role, so nobody forgets something (a check, a picture, something to approve). Two kinds, both on the Tasks screen:
//  - general duties (first, and the important ones): the catalogue `DUTIES`, computed from the club's data for any date (see the section below). Nothing is stored for them;
//    management can switch one off and change its time (`ClubSettings.duties`).
//  - additional tasks: recurring tasks management sets for a role (`TaskTemplate`: daily, weekly or monthly, some needing a photo as proof). Ticking one stores a
//    `TaskDone` row (id `td-${templateId}-${period}`); the period is the date (daily), the Monday (weekly) or 'YYYY-MM' (monthly).
// Pure functions over ClubState (also called with an immer draft inside actions); no clock reads: callers pass `today` and `nowMin`.
import type { ClubState, DT, HM, ISODate, Staff, StaffRole, TaskDone, TaskTemplate, YM } from '../types';
import { addDays, daysInMonth, live, sortBy, toHM, toMin, weekStart, ym } from '../util';
import { isOpen, staffByRole } from './core';
import { guestsOn, lobbyGroups } from './attendance';
import { validReadings } from './health';
import { SESSION_MIN, attendedOn, pictureSessions, roundProgress, roundsOf, sessionPhotos } from './activity';
import { conflictsOn, dinersOn, lunchPhotosOn, teaPhotosOn } from './kitchen';
import { invoiceStatus } from './billing';
import { renewalMonth, renewalMembers, renewalsLeft } from './renewals';
import { approvalTotal } from './approvals';

/** Every staff role that can have tasks, in the order the Team view lists them. */
export const TASK_ROLES: StaffRole[] = ['lobby', 'nurse', 'activity', 'kitchen', 'housekeeping', 'driver', 'finance', 'mgmt'];
/** Material icon of each role (the Team view cards). */
export const TASK_ROLE_ICON: Record<StaffRole, string> = {
  lobby: 'support_agent', nurse: 'medical_services', activity: 'palette', kitchen: 'restaurant', housekeeping: 'cleaning_services', driver: 'directions_car', finance: 'payments', mgmt: 'badge',
};
/** The day of the month that means "the last open day" (monthly tasks). */
export const LAST_DAY = 31;

// ---------- periods and due dates ----------
/** The period a task counts for on a date: the date itself (daily), the Monday of its week (weekly) or 'YYYY-MM' (monthly). */
export const periodOf = (t: Pick<TaskTemplate, 'every'>, date: ISODate): string => (t.every === 'daily' ? date : t.every === 'weekly' ? weekStart(date) : ym(date));
export const doneId = (templateId: string, period: string) => `td-${templateId}-${period}`;
/** The done mark of a task for a period, if there is one. */
export function doneOf(s: Pick<ClubState, 'taskDone'>, templateId: string, period: string): TaskDone | undefined {
  const d = s.taskDone?.[doneId(templateId, period)];
  return d && !d.deletedAt ? d : undefined;
}
const monthEnd = (m: YM): ISODate => `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;
const lastOf = <T>(a: T[]): T | undefined => a[a.length - 1];

/** The last day of the period a date falls in. */
export function periodEnd(t: Pick<TaskTemplate, 'every'>, date: ISODate): ISODate {
  return t.every === 'daily' ? date : t.every === 'weekly' ? addDays(weekStart(date), 6) : monthEnd(ym(date));
}
/** The club day a task is due, within the period of `date`. Daily: that day. Weekly: its weekday. Monthly: its day of the month (31 = the last open day).
 *  A due day on which the club is closed moves to the next open day of the period (or, when none is left, the last open day before it). */
export function dueDateOf(s: ClubState, t: Pick<TaskTemplate, 'every' | 'weekday' | 'dayOfMonth'>, date: ISODate): ISODate {
  if (t.every === 'daily') return date;
  const first = t.every === 'weekly' ? weekStart(date) : `${ym(date)}-01`;
  const last = periodEnd(t, date);
  const open: ISODate[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) if (isOpen(s, d)) open.push(d);
  let want: ISODate;
  if (t.every === 'weekly') want = addDays(first, (t.weekday ?? 1) - 1);
  else if (t.dayOfMonth === LAST_DAY) return lastOf(open) ?? last;
  else want = `${ym(date)}-${String(Math.min(t.dayOfMonth ?? 1, daysInMonth(ym(date)))).padStart(2, '0')}`;
  return open.find((d) => d >= want) ?? lastOf(open) ?? want;
}

// ---------- custom tasks ----------
export interface TaskItem {
  template: TaskTemplate;
  period: string;
  /** the day it is due (for daily tasks, the date itself) */
  due: ISODate;
  done?: TaskDone;
  /** not done and past its time: its due time today, or its due day has passed */
  overdue: boolean;
}

/** Does the template apply on a date: live and active, the club is open, and the date is not before it was created. */
export function templateShows(s: ClubState, t: TaskTemplate, date: ISODate): boolean {
  if (t.deletedAt || !t.active || !isOpen(s, date)) return false;
  return periodEnd(t, date) >= t.createdAt.slice(0, 10);
}
/** Not done and past its time: today after its `dueBy`, or after its due day (also for every earlier day). */
export const isOverdue = (due: ISODate, dueBy: HM | undefined, done: unknown, today: ISODate, nowMin: number): boolean =>
  !done && (today > due || (today === due && !!dueBy && nowMin > toMin(dueBy)));

/** One template as it stands for the period of `date`. */
export function taskItem(s: ClubState, t: TaskTemplate, date: ISODate, today: ISODate, nowMin: number): TaskItem {
  const period = periodOf(t, date);
  const done = doneOf(s, t.id, period);
  const due = dueDateOf(s, t, date);
  return { template: t, period, due, done, overdue: isOverdue(due, t.dueBy, done, today, nowMin) };
}
const EVERY_ORDER = { daily: 0, weekly: 1, monthly: 2 } as const;
/** The custom tasks of a role on a date: daily ones for every open day, weekly and monthly ones for every open day of their week or month (until done).
 *  A paused or archived template still shows if it was ticked off for the period (so the record stays). */
export function customTasks(s: ClubState, role: StaffRole, date: ISODate, today: ISODate, nowMin: number): TaskItem[] {
  if (!isOpen(s, date)) return [];
  const out: TaskItem[] = [];
  for (const t of Object.values(s.taskTemplates ?? {})) {
    if (t.role !== role) continue;
    if (!templateShows(s, t, date) && !doneOf(s, t.id, periodOf(t, date))) continue;
    out.push(taskItem(s, t, date, today, nowMin));
  }
  return sortBy(out, (i) => `${EVERY_ORDER[i.template.every]}|${i.template.dueBy ?? '99:99'}|${i.template.title}|${i.template.id}`);
}
/** Counts toward the day's progress: ticked off, or already due on that day (a Friday task is not "late" on Wednesday). */
export const countsOn = (i: TaskItem, date: ISODate) => !!i.done || i.due <= date;

/** Route of a role's own nav: the role's home screen lives at /today. */
const HOME: Partial<Record<StaffRole, string>> = { lobby: 'arrivals', mgmt: 'arrivals', nurse: 'hchecks', kitchen: 'menu', finance: 'billing' };
const linkTo = (role: StaffRole, key: string, query = '') => (HOME[role] === key ? '/today' : '/' + key) + query;

// ---------- general duties (KC round 7) ----------
// "By task I mean a reminder for a general task": what each role must do every day, as a tracker. The catalogue `DUTIES` is fixed; each duty is computed from the
// club's data for ANY date (so past days, weeks and months can be scored too). Management (Ega) can switch a duty off and change its time (`ClubSettings.duties`,
// action `duty.configure`). A duty that is late reaches the person on duty as a bell reminder (`dutyReminders`, used by notify.ts) and counts in the nav badge.
// A duty is made of parts: a session duty has one part per session, a guest duty one per guest, the others a single part (with a "3 of 8" count).
export type DutyEvery = 'day' | 'session' | 'guest';

/** One thing to do inside a duty (a session picture, a guest to check in, the lunch photo…). */
export interface DutyPart {
  key: string;
  /** full i18n key (the duty's `partKey` or `titleKey`) with `params` */
  titleKey: string;
  params: Record<string, string | number>;
  /** the activity the part is about (the screen shows its name in the reader's language) */
  activityId?: string;
  done: boolean;
  /** people marked / checked of the people to do (a "3 left" badge while open) */
  count?: { done: number; total: number };
  /** when it becomes late (the duty's time: configured, else its natural time) */
  due: HM;
  /** who did it and when, when the data says (a photo's taker) */
  by?: string;
  at?: HM;
  /** where to do it: a route of the role's own nav */
  link: string;
  /** the bell reminder; missing = the duty's own `bellKind` (or none) */
  bell?: { id: string; kind: string; params: Record<string, string | number>; at?: HM };
}
type PartIn = Omit<DutyPart, 'titleKey' | 'due'> & { due?: HM };

export interface DutyDef {
  /** 'role.name', also the key in `ClubSettings.duties` */
  id: string;
  role: StaffRole;
  icon: string;
  /** the duty's name (Manage, Team) */
  titleKey: string;
  /** the name of one part (Mine), when it differs: "Picture of {activity}" */
  partKey?: string;
  every: DutyEvery;
  /** its time when management has not set one; null = each part has its own natural time (the end of its session, the guest's visit) */
  defaultDue: ((s: ClubState) => HM) | null;
  /** only the live state can tell (waiting approvals…): past days show "—", week and month leave it out */
  todayOnly?: boolean;
  /** the bell message of a late part, when the part brings none of its own: params are the part's plus `n` (people still to do) */
  bellKind?: string;
  /** the parts on a date, empty = nothing to do (hidden). Times are natural ones; the configured time is applied by `dutyState`. */
  parts(s: ClubState, date: ISODate, nowMin: number): PartIn[];
}

const endOf = (time: HM): HM => toHM(toMin(time) + SESSION_MIN);
const stub = (key: string, o: Omit<PartIn, 'key' | 'params'> & { params?: Record<string, string | number> }): PartIn => ({ key, params: {}, ...o });
const attendedRows = (s: ClubState, date: ISODate) => { const g = lobbyGroups(s, date); return [...g.inClub, ...g.goneHome].map((r) => ({ m: r.m, a: r.a! })); }; // checked in today (also those gone home)
const guestDue = (s: ClubState, g: { time?: HM }): HM => toHM(Math.max(toMin(s.club.settings.open), toMin(g.time || s.club.settings.open) - 30)); // as the bell always did: half an hour before a visit
const CHASE_DAYS = 3;
const lastOfDT = (a: { at: string }[]) => a.reduce<string>((m, x) => (x.at > m ? x.at : m), '');

export const DUTIES: DutyDef[] = [
  // ----- activity -----
  {
    id: 'activity.pictures', role: 'activity', icon: 'photo_camera', titleKey: 'tasks.duty.activity.pictures', partKey: 'tasks.part.picture', every: 'session', defaultDue: null,
    parts: (s, date) => {
      if (!attendedOn(s, date).length) return [];
      return pictureSessions(s, date).map((x) => {
        const first = sessionPhotos(s, date, x.activity)[0];
        const name = x.activity?.name ?? '';
        return stub('pic:' + (x.activity?.id ?? x.slot), {
          params: { activity: name, time: x.time }, activityId: x.activity?.id, done: !!first, due: endOf(x.time), by: first?.takenBy, at: first?.time,
          link: `/camera?tab=activity&date=${date}&act=${encodeURIComponent(name)}`,
          bell: { id: 'duty:pic:' + (x.activity?.id ?? x.slot), kind: 'tasks.notif.act.picture', params: { activity: name, time: x.time }, at: x.time },
        });
      });
    },
  },
  {
    id: 'activity.joined', role: 'activity', icon: 'groups', titleKey: 'tasks.duty.activity.joined', partKey: 'tasks.part.joined', every: 'session', defaultDue: null,
    parts: (s, date) => roundsOf(s, date).filter((r) => r.kind === 'session').flatMap((r) => {
      const { marked, total } = roundProgress(s, date, r);
      if (!total) return [];
      return [stub('joined:' + r.id, {
        params: { activity: r.session?.activity?.name ?? '', time: r.time }, activityId: r.session?.activity?.id, done: marked >= total, count: { done: marked, total }, due: endOf(r.time), link: '/log?round=' + r.id,
        bell: { id: 'round:' + r.id, kind: 'activity.notif.act.session', params: { n: total - marked, time: r.time }, at: r.time },
      })];
    }),
  },
  {
    id: 'activity.lunch', role: 'activity', icon: 'restaurant', titleKey: 'tasks.duty.activity.lunch', every: 'day', defaultDue: () => '13:30',
    parts: (s, date) => {
      const { marked, total } = roundProgress(s, date, 'lunch');
      return total ? [stub('lunch', { done: marked >= total, count: { done: marked, total }, link: '/log?round=lunch', bell: { id: 'round:lunch', kind: 'activity.notif.act.lunch', params: { n: total - marked, time: '12:00' }, at: '12:00' } })] : [];
    },
  },
  {
    id: 'activity.mood', role: 'activity', icon: 'edit_note', titleKey: 'tasks.duty.activity.mood', every: 'day', defaultDue: () => '15:00',
    parts: (s, date) => {
      const { marked, total } = roundProgress(s, date, 'mood');
      return total ? [stub('mood', { done: marked >= total, count: { done: marked, total }, link: '/log?round=mood', bell: { id: 'round:mood', kind: 'activity.notif.act.mood', params: { n: total - marked, time: '15:00' }, at: '15:00' } })] : [];
    },
  },

  // ----- kitchen (F&B) -----
  {
    id: 'kitchen.lunchPhoto', role: 'kitchen', icon: 'add_a_photo', titleKey: 'tasks.duty.kitchen.lunchPhoto', every: 'day', defaultDue: () => '12:30', bellKind: 'tasks.notif.act.lunchPhoto',
    parts: (s, date) => {
      if (!dinersOn(s, date).length) return [];
      const first = lunchPhotosOn(s, date)[0];
      return [stub('lunchPhoto', { done: !!first, by: first?.takenBy, at: first?.time, link: linkTo('kitchen', 'menu') })];
    },
  },
  {
    id: 'kitchen.teaPhoto', role: 'kitchen', icon: 'local_cafe', titleKey: 'tasks.duty.kitchen.teaPhoto', every: 'day', defaultDue: () => '15:15', bellKind: 'tasks.notif.act.teaPhoto',
    parts: (s, date) => {
      if (!dinersOn(s, date).length) return [];
      const first = teaPhotosOn(s, date)[0];
      return [stub('teaPhoto', { done: !!first, by: first?.takenBy, at: first?.time, link: linkTo('kitchen', 'menu') })];
    },
  },
  {
    // the bell already warns per clash (urgent, from the morning), so this one only tracks
    id: 'kitchen.allergy', role: 'kitchen', icon: 'no_food', titleKey: 'tasks.duty.kitchen.allergy', every: 'day', defaultDue: () => '11:30',
    parts: (s, date) => {
      const c = conflictsOn(s, date);
      if (!c.length) return [];
      const planned = c.filter((x) => x.plan).length;
      return [stub('allergy', { done: planned >= c.length, count: { done: planned, total: c.length }, link: linkTo('kitchen', 'menu') })];
    },
  },

  // ----- nurse -----
  {
    id: 'nurse.arrival', role: 'nurse', icon: 'monitor_heart', titleKey: 'tasks.duty.nurse.arrival', every: 'day', defaultDue: () => '10:30', bellKind: 'tasks.notif.act.arrival',
    parts: (s, date) => {
      const rows = attendedRows(s, date);
      const guests = guestsOn(s, date).filter((g) => g.status === 'booked' && g.checkIn && g.healthCheck);
      const total = rows.length + guests.length;
      if (!total) return [];
      const rs = validReadings(s).filter((r) => r.date === date && r.kind === 'arrival');
      const people = new Set(rs.map((r) => r.memberId));
      const visitors = new Set(rs.map((r) => r.guestId));
      const done = rows.filter(({ m, a }) => people.has(m.id) || a.dismissed.some((x) => x.kind === 'arrival')).length + guests.filter((g) => visitors.has(g.id) || g.healthDismissed).length;
      return [stub('arrival', { done: done >= total, count: { done, total }, link: linkTo('nurse', 'hchecks') })];
    },
  },
  {
    id: 'nurse.departure', role: 'nurse', icon: 'logout', titleKey: 'tasks.duty.nurse.departure', every: 'day', defaultDue: () => '16:15', bellKind: 'tasks.notif.act.departure',
    parts: (s, date) => {
      const from = toMin(s.club.settings.departureFrom);
      const rs = new Set(validReadings(s).filter((r) => r.date === date && r.kind === 'departure').map((r) => r.memberId));
      // someone who went home before the departure time needed no check; everyone else (also those still in the club) does
      const rows = attendedRows(s, date).filter(({ m, a }) => rs.has(m.id) || a.dismissed.some((x) => x.kind === 'departure') || !a.checkOut || toMin(a.checkOut.at) >= from);
      if (!rows.length) return [];
      const done = rows.filter(({ m, a }) => rs.has(m.id) || a.dismissed.some((x) => x.kind === 'departure')).length;
      return [stub('departure', { done: done >= rows.length, count: { done, total: rows.length }, link: linkTo('nurse', 'hchecks') })];
    },
  },

  // ----- front desk -----
  {
    id: 'lobby.checkout', role: 'lobby', icon: 'logout', titleKey: 'tasks.duty.lobby.checkout', every: 'day', defaultDue: (s) => s.club.settings.close, bellKind: 'tasks.notif.act.checkout',
    parts: (s, date) => {
      const rows = attendedRows(s, date);
      const done = rows.filter(({ a }) => !!a.checkOut).length;
      return rows.length ? [stub('checkout', { done: done >= rows.length, count: { done, total: rows.length }, link: linkTo('lobby', 'arrivals') })] : [];
    },
  },
  {
    id: 'lobby.guests', role: 'lobby', icon: 'person_add', titleKey: 'tasks.duty.lobby.guests', partKey: 'tasks.part.guest', every: 'guest', defaultDue: null,
    parts: (s, date) => guestsOn(s, date).filter((g) => g.status === 'booked').map((g) => stub('guest:' + g.id, {
      params: { name: g.name, time: g.time || '' }, done: !!g.checkIn, due: guestDue(s, g), by: g.checkIn ? g.checkIn.by.replace(/^staff:/, '') : undefined, at: g.checkIn?.at, link: linkTo('lobby', 'arrivals'),
      bell: { id: 'guest:' + g.id, kind: g.kind === 'trial' ? (g.time ? 'notif.act.guestTrial' : 'notif.act.guestTrialDay') : 'notif.act.guestVisit', params: { name: g.name, time: g.time || '' }, at: g.time || s.club.settings.open },
    })),
  },
  {
    // from the 20th: the month-end follow-up of the coming month (who still has no answer is `renewalsLeft`)
    id: 'lobby.renewals', role: 'lobby', icon: 'event_repeat', titleKey: 'tasks.duty.lobby.renewals', every: 'day', defaultDue: () => '09:00', todayOnly: true,
    parts: (s, date) => {
      const month = renewalMonth(date);
      const all = +date.slice(8) >= 20 ? renewalMembers(s, month).length : 0;
      if (!all) return [];
      const left = renewalsLeft(s, date, month);
      return [stub('renewals', { params: { month }, done: left === 0, count: { done: all - left, total: all }, link: '/renewals', bell: { id: 'renewals:' + month, kind: 'renewals.notif.act.followUp', params: { n: left, month } } })];
    },
  },

  // ----- finance -----
  {
    id: 'finance.overdue', role: 'finance', icon: 'error', titleKey: 'tasks.duty.finance.overdue', every: 'day', defaultDue: () => '11:00', todayOnly: true,
    parts: (s, date) => {
      const od = live(s.invoices).filter((i) => invoiceStatus(s, i, date) === 'overdue');
      if (!od.length) return [];
      // chased = a reminder was sent or a call was noted in the last few days
      const since = addDays(date, -CHASE_DAYS);
      const chased = od.filter((i) => lastOfDT([...i.reminders, ...i.callNotes]).slice(0, 10) >= since).length;
      return [stub('overdue', { done: chased >= od.length, count: { done: chased, total: od.length }, link: linkTo('finance', 'billing', '?f=overdue') })];
    },
  },
  {
    id: 'finance.receipts', role: 'finance', icon: 'receipt_long', titleKey: 'tasks.duty.finance.receipts', every: 'day', defaultDue: () => '15:00', todayOnly: true,
    parts: (s) => {
      const n = live(s.receipts).filter((r) => r.status === 'submitted' && !r.voidedAt).length + live(s.vendorInvoices).filter((v) => v.status === 'toApprove').length;
      return [stub('receipts', { done: n === 0, ...(n ? { count: { done: 0, total: n } } : {}), link: '/receipts' })];
    },
  },
  {
    // from the issue day until it is run (and the rest of that day)
    id: 'finance.run', role: 'finance', icon: 'request_quote', titleKey: 'tasks.duty.finance.run', every: 'day', defaultDue: () => '12:00',
    parts: (s, date) => {
      const period = ym(date);
      if (+date.slice(8) < s.club.settings.issueDay || !live(s.members).length) return [];
      const run = live(s.invoiceRuns).find((r) => r.period === period);
      const ranOn = run?.createdAt.slice(0, 10);
      if (ranOn && ranOn < date) return [];
      const by = run?.createdBy.startsWith('staff:') ? run.createdBy.slice(6) : undefined;
      return [stub('run', { params: { month: period }, done: !!run, by, at: run?.createdAt.slice(11, 16), link: linkTo('finance', 'billing', '?run=1') })];
    },
  },

  // ----- management -----
  {
    id: 'mgmt.approvals', role: 'mgmt', icon: 'fact_check', titleKey: 'tasks.duty.mgmt.approvals', every: 'day', defaultDue: () => '16:00', todayOnly: true,
    parts: (s) => {
      const n = approvalTotal(s);
      return [stub('approvals', { done: n === 0, ...(n ? { count: { done: 0, total: n } } : {}), link: '/reviews' })];
    },
  },
];
export const DUTY_IDS = DUTIES.map((d) => d.id);
export const dutyById = (id: string): DutyDef | undefined => DUTIES.find((d) => d.id === id);
export const dutiesOfRole = (role: StaffRole): DutyDef[] => DUTIES.filter((d) => d.role === role);

// ----- management's settings -----
/** The settings of a duty (nothing set = on, at its natural time). */
export const dutyCfg = (s: Pick<ClubState, 'club'>, id: string): { off?: boolean; dueBy?: HM } => s.club.settings.duties?.[id] ?? {};
export const dutyIsOn = (s: Pick<ClubState, 'club'>, id: string): boolean => !dutyCfg(s, id).off;
/** The time a duty is due: management's, else its default (null: each part has its own time). */
export const dutyDueBy = (s: ClubState, def: DutyDef): HM | null => dutyCfg(s, def.id).dueBy ?? def.defaultDue?.(s) ?? null;

// ----- one duty on a date -----
export type DutyStatus = 'done' | 'late' | 'open' | 'none' | 'past';
export interface DutyState {
  def: DutyDef;
  parts: DutyPart[];
  /** parts done / parts */
  done: number;
  total: number;
  /** parts that are not done and past their time */
  late: number;
  /** done: every part done · late: one is late · open: waiting for its time · none: nothing to do that day · past: a past day the app cannot tell (needs today's state) */
  status: DutyStatus;
}
/** Not done, and past its time: its time today, or any time on an earlier day. Never on a coming day. */
export const partLate = (p: Pick<DutyPart, 'done' | 'due'>, date: ISODate, today: ISODate, nowMin: number): boolean =>
  !p.done && (date < today || (date === today && nowMin >= toMin(p.due)));

/** A duty on a date. The club being closed, the duty being off or a past day it cannot tell all give no parts. */
export function dutyState(s: ClubState, def: DutyDef, date: ISODate, today: ISODate, nowMin: number): DutyState {
  const none = (status: DutyStatus): DutyState => ({ def, parts: [], done: 0, total: 0, late: 0, status });
  if (!dutyIsOn(s, def.id) || date > today || !isOpen(s, date)) return none('none');
  if (def.todayOnly && date !== today) return none('past');
  const cfg = dutyCfg(s, def.id);
  const parts: DutyPart[] = def.parts(s, date, nowMin).map((p) => ({ ...p, titleKey: def.partKey ?? def.titleKey, due: cfg.dueBy ?? p.due ?? def.defaultDue?.(s) ?? '16:30' }));
  if (!parts.length) return none('none');
  const done = parts.filter((p) => p.done).length;
  const late = parts.filter((p) => partLate(p, date, today, nowMin)).length;
  return { def, parts, done, total: parts.length, late, status: done === parts.length ? 'done' : late ? 'late' : 'open' };
}
/** The duties of a role on a date that apply (off ones and empty ones are left out; a "past" one stays so the screens can show a dash). */
export function dutiesOf(s: ClubState, role: StaffRole, date: ISODate, today: ISODate, nowMin: number): DutyState[] {
  return dutiesOfRole(role).filter((d) => dutyIsOn(s, d.id)).map((d) => dutyState(s, d, date, today, nowMin)).filter((x) => x.status !== 'none');
}

// ----- the bell -----
export interface DutyReminder { id: string; kind: string; params: Record<string, string | number>; link: string; at: DT }
/** One reminder per late part of the role's duties today. It clears itself when the part is done (or the duty is switched off). Only the person on duty gets these. */
export function dutyReminders(s: ClubState, role: StaffRole, today: ISODate, nowMin: number): DutyReminder[] {
  const out: DutyReminder[] = [];
  for (const d of dutiesOf(s, role, today, today, nowMin)) {
    for (const p of d.parts) {
      if (!partLate(p, today, today, nowMin)) continue;
      const bell = p.bell ?? (d.def.bellKind ? { id: `duty:${d.def.id}:${p.key}`, kind: d.def.bellKind, params: { ...p.params, ...(p.count ? { n: p.count.total - p.count.done } : {}) } } : undefined);
      if (bell) out.push({ id: bell.id, kind: bell.kind, params: bell.params, link: p.link, at: `${today}T${bell.at ?? p.due}` });
    }
  }
  return out;
}

// ----- a role's day, a week, a month -----
export interface RoleSummary {
  role: StaffRole;
  /** active staff of the role */
  people: Staff[];
  duties: DutyState[];
  custom: TaskItem[];
  /** the duty score: parts done / parts, and the late ones */
  done: number;
  total: number;
  late: number;
  /** the additional (custom) tasks that count that day */
  customDone: number;
  customTotal: number;
  customOverdue: number;
}
/** A role's day: the duties with their score and the additional tasks (custom ones) that count that day. */
export function roleSummary(s: ClubState, role: StaffRole, date: ISODate, today: ISODate, nowMin: number): RoleSummary {
  const duties = dutiesOf(s, role, date, today, nowMin);
  const custom = customTasks(s, role, date, today, nowMin);
  const counted = custom.filter((i) => countsOn(i, date));
  return {
    role, people: staffByRole(s, role), duties, custom,
    done: duties.reduce((n, d) => n + d.done, 0), total: duties.reduce((n, d) => n + d.total, 0), late: duties.reduce((n, d) => n + d.late, 0),
    customDone: counted.filter((i) => i.done).length, customTotal: counted.length, customOverdue: counted.filter((i) => i.overdue).length,
  };
}
/** The Team view for a day: every role that has duties or additional tasks on the date. */
export function teamSummary(s: ClubState, date: ISODate, today: ISODate, nowMin: number): RoleSummary[] {
  return TASK_ROLES.map((r) => roleSummary(s, r, date, today, nowMin)).filter((r) => r.duties.length > 0 || r.custom.length > 0);
}

export type TeamSpan = 'day' | 'week' | 'month';
/** The first and last day of the day, week (Monday to Sunday) or month a date falls in. */
export function spanOf(span: TeamSpan, date: ISODate): [ISODate, ISODate] {
  if (span === 'day') return [date, date];
  if (span === 'week') return [weekStart(date), addDays(weekStart(date), 6)];
  return [`${ym(date)}-01`, monthEnd(ym(date))];
}
export interface DutyTotal {
  def: DutyDef;
  done: number;
  total: number;
  /** the app cannot tell this duty for these days (it needs today's live state) */
  na: boolean;
}
export interface RoleRange {
  role: StaffRole;
  people: Staff[];
  duties: DutyTotal[];
  done: number;
  total: number;
  customDone: number;
  customTotal: number;
}
/** A role over several days (the open days from `from` up to today): each duty's parts done of all, today's counted once they are done or late. Today-only duties are left out. */
export function roleRange(s: ClubState, role: StaffRole, from: ISODate, to: ISODate, today: ISODate, nowMin: number): RoleRange {
  const last = to < today ? to : today;
  const dates: ISODate[] = [];
  for (let d = from; d <= last; d = addDays(d, 1)) if (isOpen(s, d)) dates.push(d);
  const duties: DutyTotal[] = [];
  for (const def of dutiesOfRole(role)) {
    if (!dutyIsOn(s, def.id)) continue;
    if (def.todayOnly) { duties.push({ def, done: 0, total: 0, na: true }); continue; }
    let done = 0, total = 0;
    for (const date of dates) {
      for (const p of dutyState(s, def, date, today, nowMin).parts) {
        if (date === today && !p.done && !partLate(p, date, today, nowMin)) continue; // today's parts that are not yet due do not count against anyone
        total++;
        if (p.done) done++;
      }
    }
    if (total) duties.push({ def, done, total, na: false });
  }
  // additional tasks: every task of a period once (a weekly task ticked on Tuesday is one tick, not five), those due by the end of the span
  const seen = new Map<string, TaskItem>();
  for (const date of dates) for (const i of customTasks(s, role, date, today, nowMin)) if (!seen.has(i.template.id + '|' + i.period) && countsOn(i, last)) seen.set(i.template.id + '|' + i.period, i);
  const counted = Array.from(seen.values());
  const real = duties.filter((d) => !d.na);
  return {
    role, people: staffByRole(s, role), duties,
    done: real.reduce((n, d) => n + d.done, 0), total: real.reduce((n, d) => n + d.total, 0),
    customDone: counted.filter((i) => i.done).length, customTotal: counted.length,
  };
}
export const teamRange = (s: ClubState, from: ISODate, to: ISODate, today: ISODate, nowMin: number): RoleRange[] =>
  TASK_ROLES.map((r) => roleRange(s, r, from, to, today, nowMin)).filter((r) => r.duties.length > 0 || r.customTotal > 0);

/** Open work of a role that is due by now (the nav badge): late duty parts, and additional tasks due today or earlier that are not ticked off. */
export function openTaskCount(s: ClubState, role: StaffRole, today: ISODate, nowMin: number): number {
  const r = roleSummary(s, role, today, today, nowMin);
  return r.late + (r.customTotal - r.customDone);
}
