// Health station: who is due what (the corrected queue logic, now shown as chips, not as a queue), the member list of the station,
// care flags, family recipients, trends and the record by day.
// New file (rules/health.ts is owned by the coordinator). `stationQueue` is a drop-in superset of `nurseQueue`:
//  - a second re-check works (pending = `recheckDueAt` is set, which the actions clear when the re-check is saved);
//  - a departure check does not need an arrival reading when the arrival check was removed from the queue;
//  - trial guests can be re-checked (`GuestVisit.recheckDueAt`) and removed (`healthDismissed`);
//  - removing an item only hides requests made before that moment, so a later request shows up again;
//  - "monthly due" also covers weight, and the Done list includes monthly readings so they can be corrected.
import type { Attendance, ClubState, FamilyContact, FamilyLink, GuestVisit, Health, HM, ISODate, Member, Mobility, Diet, FoodAllergen, QueueKind, Reading, YM, HealthLimits } from '../types';
import { guestsOn } from './attendance';
import { activeOn, contactsOfMember, isPendingRow, memberName, membershipStatus } from './core';
import { DEFAULT_LIMITS, bpStatus, gluStatus, monthlyDue, pulseStatus, readingsOf, spo2Status, tempStatus, validReadings, weightDue, worst, type NurseQueue, type QueueItem } from './health';
import { addDays, live, sortBy, toHM, toMin, ym } from '../util';

// ---------- fields and plausible ranges (shared by the action's validation and the station's inputs) ----------
export type ReadingField = 'sys' | 'dia' | 'pulse' | 'spo2' | 'temp' | 'glucose' | 'weight' | 'grip';
export const READING_FIELDS: ReadingField[] = ['sys', 'dia', 'pulse', 'spo2', 'temp', 'glucose', 'weight', 'grip'];
export const VITAL_FIELDS: ReadingField[] = ['sys', 'dia', 'pulse', 'spo2', 'temp'];
export const MONTHLY_FIELDS: ReadingField[] = ['glucose', 'weight', 'grip'];
/** Plausible values a person can have: anything outside is a typing or device mistake, not a result. */
export const READING_RANGES: Record<ReadingField, [number, number]> = {
  sys: [50, 260], dia: [30, 160], pulse: [25, 220], spo2: [50, 100], temp: [30, 43], glucose: [20, 700], weight: [20, 250], grip: [1, 99],
};
export const READING_DECIMALS: Record<ReadingField, 0 | 1> = { sys: 0, dia: 0, pulse: 0, spo2: 0, temp: 1, glucose: 0, weight: 1, grip: 1 };
/** Normal bands drawn on the trend charts (the thresholds themselves live in rules/health.ts). */
export const NORMAL_BANDS = { bp: [100, 139], pulse: [60, 100], spo2: [95, 100], temp: [36, 37.4], glucose: [70, 180] } as const;

export const roundField = (f: ReadingField, v: number) => (READING_DECIMALS[f] ? Math.round(v * 10) / 10 : Math.round(v));
export const inRange = (f: ReadingField, v: number) => Number.isFinite(v) && v >= READING_RANGES[f][0] && v <= READING_RANGES[f][1];

// ---------- monthly checks ----------
/** Which monthly measurements are still due this month (by the date's month, never a fixed one). */
export function monthlyNeeds(s: ClubState, memberId: string, date: ISODate) {
  const glucose = monthlyDue(s, memberId, date);
  const weight = weightDue(s, memberId, date);
  return { glucose, weight, any: glucose || weight };
}

// ---------- the queue ----------
const lastOf = <T>(a: T[]): T | undefined => a[a.length - 1];

/** Members in the club on a date: checked in and not yet checked out (approved members only). A member who has not checked in is simply not here. */
export function membersInClub(s: ClubState, date: ISODate): { m: Member; a: Attendance }[] {
  const out: { m: Member; a: Attendance }[] = [];
  for (const a of live(s.attendance)) {
    if (a.date !== date || !a.checkIn || a.checkOut) continue;
    const m = s.members[a.memberId];
    if (m && !m.deletedAt && !isPendingRow(m)) out.push({ m, a });
  }
  return sortBy(out, (x) => x.a.checkIn!.at, -1);
}
/** Guests (trial and visit) who have checked in and not left. */
export const guestsInClub = (s: ClubState, date: ISODate): GuestVisit[] => guestsOn(s, date).filter((g) => g.checkIn && !g.checkOut);
const lastAdd = (a: Attendance, kind: QueueKind) => lastOf(a.queueAdds.filter((q) => q.kind === kind));

/** When a re-check was asked for: the flagged reading's time, or the nurse's own "add" (whichever is later). */
function recheckAskedAt(a: Attendance, recheckMin: number): HM {
  const fromReading = toHM(toMin(a.recheckDueAt!) - recheckMin);
  const added = lastAdd(a, 'recheck');
  return added && toMin(added.at) > toMin(fromReading) ? added.at : fromReading;
}

/**
 * Everything that is due for someone in the club on `date`, now or later today: the arrival check, a re-check, a departure check,
 * a monthly check that was put off, and spot checks that were asked for. Sorted by due time. This is what the station shows as chips
 * on a member's row; `stationQueue` and `dueNow` are views of it.
 */
function dueItems(s: ClubState, date: ISODate, nowMin: number): QueueItem[] {
  const items: QueueItem[] = [];
  const st = s.club.settings;
  const depFrom = toMin(st.departureFrom);
  const today = validReadings(s).filter((r) => r.date === date);
  for (const { m, a } of membersInClub(s, date)) {
    const since = a.checkIn!.at;
    const mine = today.filter((r) => r.memberId === m.id);
    const arr = lastOf(mine.filter((r) => r.kind === 'arrival'));
    const dep = lastOf(mine.filter((r) => r.kind === 'departure'));
    const gone = (kind: QueueKind, from: HM) => a.dismissed.some((x) => x.kind === kind && toMin(x.at) >= toMin(from));
    const base = { person: { type: 'member' as const, m }, personId: m.id, since };
    const needs = monthlyNeeds(s, m.id, date);
    const arrivalSkipped = gone('arrival', since);
    if (!arr && !arrivalSkipped) items.push({ ...base, key: 'arrival:' + m.id, kind: 'arrival', due: since, monthly: needs.any });
    const checked = !!arr || arrivalSkipped;
    if (checked && a.recheckDueAt && !gone('recheck', recheckAskedAt(a, st.recheckMin))) {
      items.push({ ...base, key: 'recheck:' + m.id, kind: 'recheck', due: a.recheckDueAt, monthly: false, note: lastAdd(a, 'recheck')?.note });
    }
    // two ways to ask for it: the lobby (departureAsked) and the club's standing rule (from `departureFrom`). It is due at the earlier
    // request; a removal hides it only if it came after the latest request, so the 15:30 rule is not cancelled by an earlier removal
    const asks = [a.departureAsked ? toMin(a.departureAsked.at) : null, nowMin >= depFrom ? depFrom : null].filter((x): x is number => x !== null);
    if (checked && !dep && asks.length && !gone('departure', toHM(Math.max(...asks)))) {
      items.push({ ...base, key: 'departure:' + m.id, kind: 'departure', due: toHM(Math.min(...asks)), monthly: false, note: lastAdd(a, 'departure')?.note });
    }
    if (arr && a.monthlyDeferred && needs.any && !gone('monthly', arr.time)) items.push({ ...base, key: 'monthly:' + m.id, kind: 'monthly', due: arr.time, monthly: true });
    for (const q of a.queueAdds) {
      if (q.kind !== 'spot' || gone('spot', q.at)) continue;
      if (mine.some((r) => r.kind === 'spot' && toMin(r.time) >= toMin(q.at))) continue;
      items.push({ ...base, key: `spot:${m.id}:${q.at}`, kind: 'spot', due: q.at, monthly: false, note: q.note });
    }
  }
  // someone the nurse checked before the lobby checked them in, with a re-check still to do: the re-check is due whether or not they are checked in
  for (const a of live(s.attendance)) {
    if (a.date !== date || a.checkIn || a.checkOut || !a.recheckDueAt) continue;
    const m = s.members[a.memberId];
    if (!m || !activeOn(m, date)) continue;
    const mine = today.filter((r) => r.memberId === m.id);
    const arr = lastOf(mine.filter((r) => r.kind === 'arrival'));
    if (!arr || a.dismissed.some((x) => x.kind === 'recheck' && toMin(x.at) >= toMin(recheckAskedAt(a, st.recheckMin)))) continue;
    items.push({ person: { type: 'member', m }, personId: m.id, since: arr.time, key: 'recheck:' + m.id, kind: 'recheck', due: a.recheckDueAt, monthly: false });
  }
  for (const gv of guestsOn(s, date)) {
    if (!gv.checkIn || gv.checkOut) continue;
    const mine = today.filter((r) => r.guestId === gv.id);
    const base = { person: { type: 'guest' as const, g: gv }, personId: gv.id, since: gv.checkIn.at, monthly: false };
    const arrived = mine.some((r) => r.kind === 'arrival');
    if (gv.healthCheck && !arrived && !gv.healthDismissed) items.push({ ...base, key: 'arrival:' + gv.id, kind: 'arrival', due: gv.checkIn.at });
    if (gv.recheckDueAt && (arrived || gv.healthDismissed)) items.push({ ...base, key: 'recheck:' + gv.id, kind: 'recheck', due: gv.recheckDueAt });
  }
  const name = (q: QueueItem) => (q.person.type === 'member' ? q.person.m.firstName : q.person.g.name);
  return sortBy(items, (q) => q.due + name(q));
}

/** What is due now (its time has come) on `date` at `nowMin`: the nurse's badge and the "needs action" item count these. */
export const dueNow = (s: ClubState, date: ISODate, nowMin: number): QueueItem[] => dueItems(s, date, nowMin).filter((q) => toMin(q.due) <= nowMin);

/** Due now, due later today (e.g. re-check at 10:23), and today's readings. Kept for the badge and the notification; the station itself lists everyone. */
export function stationQueue(s: ClubState, date: ISODate, nowMin: number): NurseQueue {
  const sorted = dueItems(s, date, nowMin);
  const done = sortBy(validReadings(s).filter((r) => r.date === date), (r) => r.time + (r.kind === 'monthly' ? '0' : '1') + r.id, -1);
  return { todo: sorted.filter((q) => toMin(q.due) <= nowMin), later: sorted.filter((q) => toMin(q.due) > nowMin), done };
}
export const queueName = (q: QueueItem) => (q.person.type === 'member' ? `${q.person.m.title} ${q.person.m.firstName}` : q.person.g.name);

// ---------- the station's list: every active member, the ones in the club today first ----------
export type Presence = 'in' | 'gone' | 'no'; // in the club now · checked in today and gone home · not in today
export interface StationRow {
  key: string; // `member:<id>` or `guest:<id>`
  person: QueueItem['person'];
  personId: string;
  presence: Presence;
  since?: HM; // checked in at
  left?: HM; // checked out at
  /** What is due for this person today, now or later (the arrival check, a re-check at 10:20, the departure check, a put-off monthly check). */
  due: QueueItem[];
  dueNow: QueueItem[];
  /** Glucose and weight still to measure this month (members only). */
  needs: { glucose: boolean; weight: boolean; any: boolean };
  /** Today's valid readings, newest first (so a re-check shows above the arrival check). */
  today: Reading[];
  /** The last valid reading ever (today's if there is one): the one with a blood pressure when there is one, otherwise any. */
  last?: Reading;
}
export const rowName = (r: StationRow) => (r.person.type === 'member' ? memberName(r.person.m) : r.person.g.name);

/** Lower case without accents, so "Siu lán" finds "Siu Lan". */
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Every word typed must be part of the name (title, first name or family name, in any order). An empty search matches everybody. */
export function nameMatches(name: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(name);
  return words.every((w) => hay.includes(w));
}
export const filterRows = (rows: StationRow[], query: string) => (query.trim() ? rows.filter((r) => nameMatches(rowName(r), query)) : rows);

/**
 * The health station's list on `date` at `nowMin`: every active member (approved, membership running that day) plus the guests who are
 * in the club. In the club now first (anyone with something due now at the top, by due time), then the ones who went home, then everyone
 * else by first name. Nobody is left out: a member can be checked at any time, checked in or not.
 */
export function stationRows(s: ClubState, date: ISODate, nowMin: number): StationRow[] {
  const items = dueItems(s, date, nowMin);
  const byPerson = new Map<string, QueueItem[]>();
  for (const q of items) byPerson.set(q.personId, [...(byPerson.get(q.personId) ?? []), q]);
  const allValid = validReadings(s);
  const byMember = new Map<string, Reading[]>();
  for (const r of sortBy(allValid, (x) => x.date + x.time + x.id)) if (r.memberId) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);
  const guestToday = (id: string) => sortBy(allValid.filter((r) => r.guestId === id && r.date === date), (r) => r.time + r.id, -1);
  const rows: StationRow[] = [];
  for (const m of live(s.members)) {
    if (!activeOn(m, date)) continue;
    const a = s.attendance[`${date}:${m.id}`];
    const mine = byMember.get(m.id) ?? [];
    const today = mine.filter((r) => r.date === date).reverse();
    const due = byPerson.get(m.id) ?? [];
    const presence: Presence = a?.checkIn ? (a.checkOut ? 'gone' : 'in') : 'no';
    rows.push({
      key: 'member:' + m.id, person: { type: 'member', m }, personId: m.id, presence, since: a?.checkIn?.at, left: a?.checkOut?.at,
      due, dueNow: due.filter((q) => toMin(q.due) <= nowMin), needs: monthlyNeeds(s, m.id, date), today,
      last: lastOf(mine.filter((r) => r.sys != null)) ?? lastOf(mine),
    });
  }
  for (const g of guestsInClub(s, date)) {
    const due = byPerson.get(g.id) ?? [];
    const today = guestToday(g.id);
    rows.push({
      key: 'guest:' + g.id, person: { type: 'guest', g }, personId: g.id, presence: 'in', since: g.checkIn?.at,
      due, dueNow: due.filter((q) => toMin(q.due) <= nowMin), needs: { glucose: false, weight: false, any: false }, today, last: today.find((r) => r.sys != null) ?? today[0],
    });
  }
  const tier = (r: StationRow) => (r.presence === 'in' ? (r.dueNow.length ? 0 : 1) : r.presence === 'gone' ? 2 : 3);
  const first = (r: StationRow) => (r.dueNow.length ? r.dueNow[0].due : '');
  const nm = (r: StationRow) => fold(r.person.type === 'member' ? r.person.m.firstName + ' ' + r.person.m.lastName : r.person.g.name);
  return rows.sort((a, b) => tier(a) - tier(b) || (first(a) < first(b) ? -1 : first(a) > first(b) ? 1 : 0) || (nm(a) < nm(b) ? -1 : nm(a) > nm(b) ? 1 : 0));
}

/** How many of the listed people are in the club right now (members and guests). */
export const inClubCount = (rows: StationRow[]) => rows.filter((r) => r.presence === 'in').length;

/**
 * Which check to offer first when someone is opened (the nurse can change it):
 * the arrival check if there is no reading yet today (a monthly one alone does not count), a re-check if one is waiting,
 * the departure check once the departure time has come (or the lobby asked), otherwise a spot check.
 */
export function suggestKind(row: StationRow, nowMin: number, settings: { departureFrom: HM }): QueueKind {
  if (!row.today.some((r) => r.kind !== 'monthly')) return 'arrival';
  if (row.due.some((q) => q.kind === 'recheck')) return 'recheck';
  const member = row.person.type === 'member';
  const asked = member && row.presence === 'in' && row.due.some((q) => q.kind === 'departure');
  if (member && !row.today.some((r) => r.kind === 'departure') && (asked || (row.presence === 'in' && nowMin >= toMin(settings.departureFrom)))) return 'departure';
  return 'spot';
}

/** The checks the form offers for a person, and the ones that can not be taken again today (arrival and departure are once a day). */
export function kindChoices(row: StationRow): { kind: QueueKind; off: boolean }[] {
  const has = (k: QueueKind) => row.today.some((r) => r.kind === k);
  if (row.person.type === 'guest') return [{ kind: 'arrival', off: has('arrival') }, { kind: 'recheck', off: false }, { kind: 'spot', off: false }];
  return [
    { kind: 'arrival', off: has('arrival') }, { kind: 'recheck', off: false }, { kind: 'spot', off: false },
    { kind: 'departure', off: has('departure') }, { kind: 'monthly', off: !row.needs.any },
  ];
}

// ---------- the record by day ----------
/** Every valid reading of one day (everyone), newest first. */
export const readingsOnDay = (s: ClubState, date: ISODate): Reading[] => sortBy(validReadings(s).filter((r) => r.date === date), (r) => r.time + r.id, -1);
/** One person's readings of one day, newest first. */
export const memberReadingsOn = (s: ClubState, memberId: string, date: ISODate): Reading[] => readingsOf(s, memberId).filter((r) => r.date === date).reverse();
/** The days a member has readings, oldest first. */
export const readingDays = (rs: Reading[]): ISODate[] => Array.from(new Set(rs.map((r) => r.date))).sort();
/** The day with readings before / after `from` (never `from` itself), or null when there is none. */
export function neighbourDay(days: ISODate[], from: ISODate, dir: -1 | 1): ISODate | null {
  const list = dir === -1 ? days.filter((d) => d < from).reverse() : days.filter((d) => d > from);
  return list[0] ?? null;
}
/** A small summary of a day for its header: how many readings, how many people, how many Watch and Alert. */
export function daySummary(rs: Reading[]) {
  const people = new Set(rs.map((r) => r.memberId ?? r.guestId ?? r.id));
  return { readings: rs.length, people: people.size, watch: rs.filter((r) => r.status === 'watch').length, alert: rs.filter((r) => r.status === 'alert').length };
}

// ---------- who hears about a reading ----------
/** Family contacts who get health messages for a member: approved link with app access and health alerts on. */
export function alertRecipients(s: ClubState, memberId: string): { link: FamilyLink; contact: FamilyContact }[] {
  return contactsOfMember(s, memberId).filter(({ link, contact }) => link.appAccess && link.healthAlerts && !isPendingRow(link) && !isPendingRow(contact));
}

// ---------- care flags ----------
export type CareFlag =
  | { kind: 'food'; key: FoodAllergen }
  | { kind: 'foodOther'; text: string }
  | { kind: 'drug'; key: string }
  | { kind: 'mobility'; key: Mobility }
  | { kind: 'diet'; key: Diet }
  | { kind: 'lunchMed'; name: string; dose: string }
  | { kind: 'allergyUnknown' };

/** What the nurse must know before touching a person: allergies, mobility, diet, medicines taken at lunch. */
export function careFlagsOf(p: Member | GuestVisit): CareFlag[] {
  const out: CareFlag[] = [];
  if ('health' in p) {
    for (const key of p.health.food) out.push({ kind: 'food', key });
    if (p.health.foodOther?.trim()) out.push({ kind: 'foodOther', text: p.health.foodOther.trim() });
    if (p.health.mobility) out.push({ kind: 'mobility', key: p.health.mobility });
    for (const key of p.health.diet) out.push({ kind: 'diet', key });
    for (const key of p.health.drugs) out.push({ kind: 'drug', key });
    for (const x of p.health.meds) if (x.timing === 'lunchClub') out.push({ kind: 'lunchMed', name: x.name, dose: x.dose });
    return out;
  }
  if (p.food === null) out.push({ kind: 'allergyUnknown' });
  else for (const key of p.food) out.push({ kind: 'food', key });
  if (p.mobility) out.push({ kind: 'mobility', key: p.mobility });
  for (const key of p.diet) out.push({ kind: 'diet', key });
  for (const key of p.drugs) out.push({ kind: 'drug', key });
  return out;
}

// ---------- last values (for "Last 134/82 · Mon 19 Oct") ----------
/** Last valid reading before `date` of a kind that carries `field`. */
export const lastOfKind = (s: ClubState, memberId: string, date: ISODate, kinds: Reading['kind'][], field: keyof Reading) =>
  lastOf(readingsOf(s, memberId).filter((r) => r.date < date && kinds.includes(r.kind) && r[field] != null));
/** Latest earlier reading (within `days`) that was not Normal and has a blood pressure. */
export const recentFlagged = (s: ClubState, memberId: string, date: ISODate, days = 14) =>
  lastOf(readingsOf(s, memberId).filter((r) => r.date < date && r.date >= addDays(date, -days) && r.status !== 'normal' && r.sys != null));

// ---------- sparklines ----------
export const SPARK_W = 600;
export const SPARK_H = 130;
export interface SparkPoint { d: ISODate; v: number; s?: Health | null }
export interface SparkOpts { lo: number; hi: number; bLo?: number; bHi?: number }
export interface SparkPaths { line: string; line2: string; dots: string; hot: string; bandY: string; bandH: string; from: ISODate | null; to: ISODate | null }

/** The trend chart's paths (design `spark`): shared x positions by date, y clamped inside the chart. */
export function sparkPaths(series: SparkPoint[][], o: SparkOpts): SparkPaths {
  const W = SPARK_W, H = SPARK_H;
  const all = series.flat();
  const dates = Array.from(new Set(all.map((p) => p.d))).sort();
  const xs = (d: ISODate) => (dates.length > 1 ? 14 + dates.indexOf(d) * ((W - 28) / (dates.length - 1)) : W / 2);
  const y = (v: number) => Math.max(6, Math.min(H - 6, H - 6 - ((v - o.lo) / (o.hi - o.lo)) * (H - 12)));
  const c = (cx: number, cy: number) => 'M' + (cx - 4).toFixed(1) + ' ' + cy.toFixed(1) + 'a4 4 0 1 0 8 0a4 4 0 1 0 -8 0';
  const line = (s: SparkPoint[]) => s.map((p, i) => (i ? 'L' : 'M') + xs(p.d).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  return {
    line: series[0] ? line(series[0]) : '',
    line2: series[1] ? line(series[1]) : '',
    dots: all.filter((p) => !p.s || p.s === 'normal').map((p) => c(xs(p.d), y(p.v))).join(''),
    hot: all.filter((p) => p.s && p.s !== 'normal').map((p) => c(xs(p.d), y(p.v))).join(''),
    bandY: o.bHi ? y(o.bHi).toFixed(1) : '0',
    bandH: o.bHi ? (y(o.bLo ?? 0) - y(o.bHi)).toFixed(1) : '0',
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

/** The small systolic chart in the station header (design `tr`): 200 × 48, normal band 100–139. */
export function headSpark(sys: number[]) {
  const y = (v: number) => Math.max(2, Math.min(46, 46 - ((v - 90) / 90) * 44));
  const xs = (i: number) => (sys.length > 1 ? 6 + i * (188 / (sys.length - 1)) : 100);
  const circ = (cx: number, cy: number) => `M${(cx - 2.6).toFixed(1)} ${cy.toFixed(1)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
  return {
    bandY: y(139).toFixed(1),
    bandH: (y(100) - y(139)).toFixed(1),
    line: sys.map((v, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' '),
    dots: sys.map((v, i) => (v < 140 ? circ(xs(i), y(v)) : '')).join(''),
    hot: sys.map((v, i) => (v >= 140 ? circ(xs(i), y(v)) : '')).join(''),
  };
}
/** Arrival systolic values of the last `days` days before `date` (header chart). */
export const arrivalSystolic = (s: ClubState, memberId: string, date: ISODate, days = 28) =>
  readingsOf(s, memberId).filter((r) => r.kind === 'arrival' && r.sys != null && r.date < date && r.date >= addDays(date, -days)).map((r) => r.sys!);

// ---------- trends (Readings screen) ----------
export interface TrendRow { m: Member; rs: Reading[]; worst: Health; last?: Reading; n: number }
const RANK: Record<Health, number> = { alert: 0, watch: 1, normal: 2 };
/** One member's trend row (worst status of the last `days` days, the last reading with a blood pressure), or null when there are no readings. */
export function memberTrend(s: ClubState, m: Member, today: ISODate, days = 28): TrendRow | null {
  const rs = readingsOf(s, m.id);
  if (!rs.length) return null;
  const rec = rs.filter((r) => r.date >= addDays(today, -days));
  return { m, rs, worst: rec.length ? worst(rec.map((r) => r.status)) : 'normal', last: lastOf(rs.filter((r) => r.sys != null)), n: rec.length };
}
/** Members with readings, worst status of the last `days` days first. Ended and pending members are left out. */
export function trendRows(s: ClubState, today: ISODate, days = 28): TrendRow[] {
  const out: TrendRow[] = [];
  for (const m of live(s.members)) {
    if (isPendingRow(m) || membershipStatus(m, today) === 'ended') continue;
    const row = memberTrend(s, m, today, days);
    if (row) out.push(row);
  }
  return out.sort((a, b) => RANK[a.worst] - RANK[b.worst] || (a.m.firstName < b.m.firstName ? -1 : a.m.firstName > b.m.firstName ? 1 : 0));
}

export type ChartId = 'bp' | 'pulse' | 'spo2' | 'temp' | 'glucose' | 'weight';
export interface ChartSpec { id: ChartId; series: SparkPoint[][]; opts: SparkOpts; latest?: Reading; latestStatus: Health | null; sinceMonth?: YM }
/**
 * The six chart cards of a member: BP (arrival solid, departure dashed), pulse, SpO₂, temperature over the last `days` days;
 * glucose and weight over every monthly measurement (whichever reading carries them).
 */
export function trendCharts(rs: Reading[], today: ISODate, days = 28, L: HealthLimits = DEFAULT_LIMITS): ChartSpec[] {
  const since = addDays(today, -days);
  const rec = rs.filter((r) => r.date >= since);
  const arr = rec.filter((r) => r.kind === 'arrival');
  const dep = rec.filter((r) => r.kind === 'departure');
  const pt = (r: Reading, k: keyof Reading, fn?: (r: Reading) => Health): SparkPoint => ({ d: r.date, v: r[k] as number, s: fn ? fn(r) : null });
  const withField = (a: Reading[], k: keyof Reading) => a.filter((r) => r[k] != null);
  const glu = withField(rs, 'glucose');
  const wts = withField(rs, 'weight');
  const wv = wts.map((r) => r.weight!);
  const bpS = (r: Reading) => bpStatus(r.sys!, r.dia!, L);
  const specs: ChartSpec[] = [
    { id: 'bp', series: [withField(arr, 'sys').map((r) => pt(r, 'sys', bpS)), withField(dep, 'sys').map((r) => pt(r, 'sys', bpS))], opts: { lo: 80, hi: 180, bLo: NORMAL_BANDS.bp[0], bHi: NORMAL_BANDS.bp[1] }, latest: lastOf(withField(arr, 'sys')), latestStatus: null },
    { id: 'pulse', series: [withField(arr, 'pulse').map((r) => pt(r, 'pulse', (x) => pulseStatus(x.pulse!, L)))], opts: { lo: 40, hi: 120, bLo: NORMAL_BANDS.pulse[0], bHi: NORMAL_BANDS.pulse[1] }, latest: lastOf(withField(arr, 'pulse')), latestStatus: null },
    { id: 'spo2', series: [withField(arr, 'spo2').map((r) => pt(r, 'spo2', (x) => spo2Status(x.spo2!, L)))], opts: { lo: 85, hi: 100, bLo: NORMAL_BANDS.spo2[0], bHi: NORMAL_BANDS.spo2[1] }, latest: lastOf(withField(arr, 'spo2')), latestStatus: null },
    { id: 'temp', series: [withField(arr, 'temp').map((r) => pt(r, 'temp', (x) => tempStatus(x.temp!, L)))], opts: { lo: 35, hi: 39, bLo: NORMAL_BANDS.temp[0], bHi: NORMAL_BANDS.temp[1] }, latest: lastOf(withField(arr, 'temp')), latestStatus: null },
    { id: 'glucose', series: [glu.map((r) => pt(r, 'glucose', (x) => gluStatus(x.glucose!, L)))], opts: { lo: 60, hi: 260, bLo: NORMAL_BANDS.glucose[0], bHi: NORMAL_BANDS.glucose[1] }, latest: lastOf(glu), latestStatus: null, sinceMonth: glu[0] ? ym(glu[0].date) : undefined },
    { id: 'weight', series: [wts.map((r) => pt(r, 'weight'))], opts: { lo: wv.length ? Math.min(...wv) - 3 : 40, hi: wv.length ? Math.max(...wv) + 3 : 80, bLo: 0, bHi: 0 }, latest: lastOf(wts), latestStatus: null, sinceMonth: wts[0] ? ym(wts[0].date) : undefined },
  ];
  return specs.map((c) => ({ ...c, latestStatus: chartStatus(c.id, L, c.latest) }));
}
/** Status badge of a chart's latest value (weight has none: it is judged against the previous weight). */
function chartStatus(id: ChartId, L: HealthLimits, r?: Reading): Health | null {
  if (!r) return null;
  switch (id) {
    case 'bp': return bpStatus(r.sys!, r.dia!, L);
    case 'pulse': return pulseStatus(r.pulse!, L);
    case 'spo2': return spo2Status(r.spo2!, L);
    case 'temp': return tempStatus(r.temp!, L);
    case 'glucose': return gluStatus(r.glucose!, L);
    default: return null;
  }
}

// ---------- plain-text summary of a reading (messages, notifications; language-neutral numbers and units) ----------
/** "164/98 mmHg · 84 bpm · SpO₂ 96% · 36.7 °C" */
export function readingSummary(r: Partial<Reading>): string {
  return [
    r.sys != null && r.dia != null ? `${r.sys}/${r.dia} mmHg` : '',
    r.pulse != null ? `${r.pulse} bpm` : '',
    r.spo2 != null ? `SpO₂ ${r.spo2}%` : '',
    r.temp != null ? `${r.temp} °C` : '',
    r.glucose != null ? `${r.glucose} mg/dL` : '',
    r.weight != null ? `${r.weight} kg` : '',
    r.grip != null ? `${r.grip} kg grip` : '',
  ].filter(Boolean).join(' · ');
}
/** The one number a feed line or alert shows: "164/98", or glucose / weight for monthly readings. */
export const headlineValue = (r: Partial<Reading>) =>
  r.sys != null && r.dia != null ? `${r.sys}/${r.dia}` : r.glucose != null ? `${r.glucose} mg/dL` : r.spo2 != null ? `${r.spo2}%` : r.temp != null ? `${r.temp} °C` : r.weight != null ? `${r.weight} kg` : r.pulse != null ? `${r.pulse} bpm` : '';
