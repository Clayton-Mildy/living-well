// KC round 7 seed: tasks. Runs after the main seed (and the roster), so every staff row already exists.
// Management's recurring tasks for each role, and what was ticked off: on the last open days, in the last weeks and months, and a few things today before
// the demo starts (09:58). Left open on purpose: the lobby picture, the housekeeping rounds (nobody there has a login; Ega ticks for them), the weekly bank
// reconciliation (its Monday has passed, so it shows as overdue). Proof photos have no picture in the seed: the screen shows the tone placeholder.
import type { ClubState, HM, ISODate, StaffRole, TaskEvery, TaskTemplate, Weekday } from '../../types';
import { addDays, rng, toHM, toMin, weekStart, ym, addMonths } from '../../util';
import { isOpen } from '../../rules/core';
import { doneId, dueDateOf, periodOf } from '../../rules/tasks';
import { teaPicId } from '../demoMedia';

interface Def {
  id: string;
  title: string;
  role: StaffRole;
  every: TaskEvery;
  weekday?: Weekday;
  dayOfMonth?: number;
  dueBy?: HM;
  proof?: 'photo';
  /** who ticks it off (staff ids) */
  by: string[];
  /** when it is usually ticked off */
  window: [HM, HM];
  /** ticked off today, before the demo starts */
  today?: { at: HM; by?: string; note?: string };
  /** a note that goes with some of the past ticks */
  note?: string;
}

const DEFS: Def[] = [
  { id: 'task-lobby-desk', title: 'Set up the welcome desk', role: 'lobby', every: 'daily', dueBy: '08:30', by: ['s1'], window: ['08:05', '08:28'], today: { at: '08:22' } },
  { id: 'task-lobby-photo', title: 'Photo of the tidy lobby', role: 'lobby', every: 'daily', proof: 'photo', by: ['s1'], window: ['09:00', '10:20'] },
  { id: 'task-nurse-pc303', title: 'Check the PC-303 battery and cuff', role: 'nurse', every: 'daily', by: ['s8'], window: ['08:15', '09:30'], today: { at: '08:41' } },
  { id: 'task-nurse-firstaid', title: 'Restock the first-aid kit', role: 'nurse', every: 'weekly', weekday: 5, by: ['s8'], window: ['14:00', '15:30'] },
  { id: 'task-nurse-thermo', title: 'Calibrate the thermometer', role: 'nurse', every: 'monthly', dayOfMonth: 1, by: ['s8'], window: ['08:45', '09:30'] },
  { id: 'task-activity-room', title: 'Set up the activity room', role: 'activity', every: 'daily', proof: 'photo', by: ['s5', 's6'], window: ['08:20', '09:40'], today: { at: '08:47', by: 's5' } },
  { id: 'task-activity-materials', title: 'Prepare tomorrow’s materials', role: 'activity', every: 'daily', dueBy: '16:00', by: ['s5', 's6'], window: ['15:00', '15:55'] },
  { id: 'task-kitchen-fridge', title: 'Fridge temperature log', role: 'kitchen', every: 'daily', proof: 'photo', by: ['s2', 's3'], window: ['07:55', '08:40'], note: 'Fridge 3°C, freezer −18°C', today: { at: '08:12', by: 's2', note: 'Fridge 3°C, freezer −18°C' } },
  { id: 'task-kitchen-deep', title: 'Deep clean the kitchen', role: 'kitchen', every: 'weekly', weekday: 5, by: ['s2', 's3'], window: ['15:30', '16:15'] },
  { id: 'task-hk-toilets', title: 'Toilets checked', role: 'housekeeping', every: 'daily', dueBy: '10:00', proof: 'photo', by: ['s4'], window: ['09:00', '09:55'] },
  { id: 'task-hk-dining', title: 'Dining room clean after lunch', role: 'housekeeping', every: 'daily', dueBy: '13:30', proof: 'photo', by: ['s4'], window: ['13:00', '13:28'] },
  { id: 'task-driver-car', title: 'Car check: tyres, fuel, clean', role: 'driver', every: 'daily', dueBy: '07:30', by: ['s7'], window: ['07:00', '07:28'], today: { at: '07:18' } },
  { id: 'task-finance-bank', title: 'Bank reconciliation', role: 'finance', every: 'weekly', weekday: 1, by: ['s10'], window: ['10:00', '15:00'] },
  { id: 'task-mgmt-walk', title: 'Walk through the club', role: 'mgmt', every: 'daily', by: ['s9'], window: ['08:30', '09:30'] },
];

export function seedTasks(s: ClubState, T: ISODate): void {
  const r = rng(7101);
  const created = addDays(T, -75);
  const staffOk = (id: string) => !!s.staff[id];
  for (const d of DEFS) {
    const row: TaskTemplate = {
      id: d.id, clubId: s.clubId, createdAt: `${created}T09:00`, createdBy: 'staff:s9',
      title: d.title, role: d.role, every: d.every, proof: d.proof ?? 'none', active: true,
      ...(d.weekday ? { weekday: d.weekday } : {}), ...(d.dayOfMonth ? { dayOfMonth: d.dayOfMonth } : {}), ...(d.dueBy ? { dueBy: d.dueBy } : {}),
    };
    s.taskTemplates[d.id] = row;
  }
  const mark = (d: Def, date: ISODate, at: HM, by: string, note?: string) => {
    if (date < created || !staffOk(by)) return;
    const period = periodOf(d, date);
    const id = doneId(d.id, period);
    s.taskDone[id] = { id, clubId: s.clubId, createdAt: `${date}T${at}`, createdBy: `staff:${by}`, templateId: d.id, period, date, at, by, ...(note ? { note } : {}) };
  };
  const pick = <X,>(a: X[]) => a[Math.floor(r() * a.length)];
  const within = (w: [HM, HM]) => toHM(toMin(w[0]) + Math.round(r() * (toMin(w[1]) - toMin(w[0]))));

  // the last open days before today: daily tasks, now and then one missed
  const past: ISODate[] = [];
  for (let i = 1; past.length < 7 && i < 20; i++) if (isOpen(s, addDays(T, -i))) past.push(addDays(T, -i));
  for (const d of DEFS.filter((x) => x.every === 'daily')) {
    for (const [i, date] of past.entries()) {
      if (i > 0 && r() < 0.1) continue; // missed (yesterday is always done)
      mark(d, date, within(d.window), pick(d.by), d.note);
    }
    if (d.today) mark(d, T, d.today.at, d.today.by ?? d.by[0], d.today.note);
  }

  // weekly: the last four weeks on their due day; this week's stays open (the bank reconciliation's Monday has passed: overdue)
  for (const d of DEFS.filter((x) => x.every === 'weekly')) {
    for (let w = 1; w <= 4; w++) {
      const due = dueDateOf(s, d, addDays(weekStart(T), -7 * w));
      if (due < T) mark(d, due, within(d.window), pick(d.by));
    }
  }
  // monthly: the last three months, and this month's when its day is past
  for (const d of DEFS.filter((x) => x.every === 'monthly')) {
    for (let m = 3; m >= 0; m--) {
      const due = dueDateOf(s, d, `${addMonths(ym(T), -m)}-15`);
      if (due < T) mark(d, due, within(d.window), pick(d.by));
    }
  }
  seedTeaPhotos(s, T);
}

/** The kitchen's afternoon tea photo of most past club days (the duty "Photo of afternoon tea" is scored from these): a demo picture (teapot, kue, the tea table), approved. Today's is still to be taken. */
function seedTeaPhotos(s: ClubState, T: ISODate): void {
  const r = rng(7102); // its own stream, so the task ticks above stay as they were
  const cooks = ['s2', 's3'].filter((id) => !!s.staff[id]);
  if (!cooks.length) return;
  const cameDays = new Set(Object.values(s.attendance).filter((a) => a.checkIn).map((a) => a.date));
  for (let i = 1; i <= 190; i++) {
    const d = addDays(T, -i);
    const skip = r() < 0.22; // the odd day nobody took one
    if (skip || !isOpen(s, d) || !cameDays.has(d)) continue;
    const by = cooks[Math.floor(r() * cooks.length)];
    const time = toHM(15 * 60 + 2 + Math.floor(r() * 30));
    const id = `pt${d.slice(2).replace(/-/g, '')}1`;
    const mediaId = teaPicId(Math.floor(r() * 3));
    s.photos[id] = {
      id, clubId: s.clubId, createdAt: `${d}T${time}`, createdBy: `staff:${by}`, date: d, time, kind: 'lunch', media: 'photo', activity: 'lunch', memberIds: [],
      tone: 4, takenBy: by, visibility: 'visible', ...(d >= addDays(T, -7) ? { approved: { at: `${d}T${time}`, by: 's9' } } : {}), mediaId, // only the last week's approvals show in History
    };
    const row = s.dayMenus[d] ?? { id: d, clubId: s.clubId, createdAt: `${d}T07:00`, createdBy: 'staff:s3', date: d, allergyPlans: [] };
    row.teaPhotoIds = [id];
    s.dayMenus[d] = row;
  }
}
