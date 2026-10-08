// Health station actions: readings (save, edit, void) and the reminders around them (add, dismiss).
// Nurse and management only. Health data applies at once (no review gate); every correction keeps an audit trail.
// The club is drop-in: a member can be checked at any time (checked in or not, still here or gone home), so a reading only needs an
// active membership. Trial guests are different: they are checked while they are in the club.
import type { Draft } from 'immer';
import type { Attendance, ClubState, GuestVisit, Health, HealthLimits, HM, LimitKey, Member, QueueKind, QuickNote, Reading, User } from '../types';
import { DomainError, defineAction, hasRole, nameOfUser, type ActionDef, type Ctx } from './framework';
import { ensureAttendance, requireMember, shortOf } from './helpers';
import { attId } from '../rules/attendance';
import { activeOn, isPendingRow, memberShort } from '../rules/core';
import { LIMIT_KEYS, LIMIT_RANGE, evaluateReading, lastBefore, limitOrderOk, limitsFor, limitsOf, todayReading, validReadings, worst } from '../rules/health';
import {
  MONTHLY_FIELDS, READING_FIELDS, VITAL_FIELDS, alertRecipients, headlineValue, inRange, monthlyNeeds, readingSummary, roundField, stationQueue, type ReadingField,
} from '../rules/healthStation';
import { READING_KEYS } from '../rules/approvals';
import { markPending, needsApproval, priorOf } from './approvalGate';
import { toHM, toMin } from '../util';

export type ReadingKind = Reading['kind'];
export type EditReason = 'typo' | 'deviceError' | 'remeasured' | 'other';
export type VoidReason = NonNullable<Reading['voided']>['reason'];
export type DismissReason = 'declined' | 'notNeeded' | 'leftEarly' | 'other';
export type NumericValues = Partial<Record<ReadingField, number>>;

export interface ReadingSaveInput extends NumericValues {
  memberId?: string;
  guestId?: string;
  kind: ReadingKind;
  noteKeys: QuickNote[];
  note?: string;
  shared: boolean;
  tellFamily: boolean;
  recheck: boolean;
  deferMonthly: boolean;
  source: Reading['source'];
}
export interface ReadingEditInput { readingId: string; values: NumericValues; reason: EditReason; note?: string }
export interface ReadingVoidInput { readingId: string; reason: VoidReason; note?: string; withMonthly?: boolean }
export interface QueueAddInput { memberId: string; kind: 'spot' | 'departure' | 'recheck'; note?: string }
export interface QueueDismissInput { memberId?: string; guestId?: string; kind: QueueKind; reason: DismissReason }

const KINDS: ReadingKind[] = ['arrival', 'departure', 'recheck', 'spot', 'monthly'];
const QUICK_NOTES: QuickNote[] = ['rested', 'medsTaken', 'dizzy', 'headache', 'rightArm'];
const EDIT_REASONS: EditReason[] = ['typo', 'deviceError', 'remeasured', 'other'];
const VOID_REASONS: VoidReason[] = ['wrongPerson', 'deviceError', 'duplicate', 'other'];
const DISMISS_REASONS: DismissReason[] = ['declined', 'notNeeded', 'leftEarly', 'other'];
const QUEUE_KINDS: QueueKind[] = ['arrival', 'departure', 'recheck', 'monthly', 'spot'];

const nurseOrMgmt = (u: User) => hasRole(u, 'nurse', 'mgmt');
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined);

/** One plausible number, rounded as the station shows it; throws the field's own range message. */
function num(raw: unknown, f: ReadingField): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!inRange(f, n)) throw new DomainError('health.err.range.' + f);
  return roundField(f, n);
}
function numbers(raw: unknown): NumericValues {
  const o = rec(raw);
  const out: NumericValues = {};
  for (const f of READING_FIELDS) {
    const n = num(o[f], f);
    if (n !== undefined) out[f] = n;
  }
  return out;
}
const hasAny = (v: NumericValues, fields: ReadingField[]) => fields.some((f) => v[f] !== undefined);
const pick = (v: NumericValues, fields: ReadingField[]): NumericValues => Object.fromEntries(fields.filter((f) => v[f] !== undefined).map((f) => [f, v[f]])) as NumericValues;
function checkBp(v: NumericValues) {
  if ((v.sys !== undefined) !== (v.dia !== undefined)) throw new DomainError('health.err.bpPair');
  if (v.sys !== undefined && v.dia !== undefined && v.dia >= v.sys) throw new DomainError('health.err.diaSys');
}

const FAMILY_KIND: Record<Health, string> = { normal: 'health.notif.fam.normal', watch: 'health.notif.fam.watch', alert: 'health.notif.fam.alert' };
const severityOf = (h: Health) => (h === 'alert' ? 'urgent' : h === 'watch' ? 'attention' : 'info') as 'urgent' | 'attention' | 'info';

/**
 * Tell the family now: remember on the reading who was told (the club tells them on WhatsApp; the demo simulates that, and the family's bell shows the update).
 * `nurseId` is who took the reading (not necessarily who approved it).
 */
function tellFamily(d: Draft<ClubState>, ctx: Ctx, m: Member, row: Draft<Reading>, nurseId: string): string[] {
  const contacts = alertRecipients(d as unknown as ClubState, m.id).map((x) => x.contact);
  if (contacts.length) {
    row.familyTold = { at: ctx.nowDT, by: nurseId, familyIds: contacts.map((c) => c.id) };
    row.shared = true;
  }
  return contacts.map((c) => c.firstName);
}

/**
 * Everything the family hears about a reading: being told (tell family: recorded on the reading), and the bell update (shared or told). For a nurse's reading this runs when
 * management approves it; for management's own reading, at once. Returns the first names told.
 */
export function noticeFamilies(d: Draft<ClubState>, ctx: Ctx, row: Draft<Reading>, o: { tell: boolean; share: boolean; overall: Health; companion?: Reading }): string[] {
  if (!row.memberId) return [];
  const m = d.members[row.memberId];
  if (!m) return [];
  const s = d as unknown as ClubState;
  const shown: Partial<Reading> = { ...row, ...(o.companion ? pick(o.companion as NumericValues, MONTHLY_FIELDS) : {}) };
  const told = o.tell ? tellFamily(d, ctx, m, row, row.takenBy) : [];
  if (o.share || told.length) {
    row.shared = true;
    const ids = alertRecipients(s, m.id).map((x) => x.contact.id);
    if (ids.length) ctx.notify({ toUsers: ids, kind: FAMILY_KIND[o.overall], params: { name: memberShort(m), time: row.time, value: readingSummary(shown) }, link: '/health', memberId: m.id, severity: severityOf(o.overall), ref: { type: 'reading', id: row.id } });
  }
  return told;
}

export const healthActions: ActionDef[] = [
  // ---------- save a reading ----------
  defineAction<ReadingSaveInput>({
    name: 'reading.save',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const memberId = str(i.memberId);
      const guestId = str(i.guestId);
      if (!memberId === !guestId) throw new DomainError('err.invalid');
      const kind = oneOf(i.kind, KINDS);
      if (!kind) throw new DomainError('err.invalid');
      const v = numbers({ ...rec(i.values), ...i }); // the numbers sit at the top level; a nested `values` object (as the build guide words it) is accepted too
      checkBp(v);
      if ((kind === 'arrival' || kind === 'departure' || kind === 'recheck') && v.sys === undefined) throw new DomainError('health.err.bpRequired');
      if (kind === 'spot' && !hasAny(v, READING_FIELDS)) throw new DomainError('health.err.needValue');
      if (kind === 'monthly' && !hasAny(v, MONTHLY_FIELDS)) throw new DomainError('health.err.needValue');
      const noteKeys = Array.isArray(i.noteKeys) ? QUICK_NOTES.filter((k) => (i.noteKeys as unknown[]).includes(k)) : [];
      const note = str(i.note)?.slice(0, 500);
      return {
        ...v, ...(memberId ? { memberId } : {}), ...(guestId ? { guestId } : {}), kind, noteKeys, ...(note ? { note } : {}),
        shared: i.shared === true, tellFamily: i.tellFamily === true, recheck: i.recheck === true, deferMonthly: i.deferMonthly === true, source: oneOf(i.source, ['device', 'keypad', 'mixed'] as const) ?? 'keypad',
      };
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const settings = d.club.settings;
      const today = ctx.today;
      let m: Draft<Member> | undefined;
      let a: Draft<Attendance> | undefined;
      let guest: Draft<GuestVisit> | undefined;
      if (input.memberId) {
        m = requireMember(d, input.memberId, ctx);
        if (isPendingRow(m)) ctx.fail('err.memberPending');
        if (!activeOn(m, today)) ctx.fail('err.memberNotActive');
        a = d.attendance[attId(today, m.id)]; // none yet when the nurse checks someone the lobby has not checked in
      } else {
        guest = d.guestVisits[input.guestId!];
        if (!guest || guest.deletedAt || guest.date !== today || guest.status === 'cancelled') ctx.fail('err.notFound');
        if (!guest.checkIn) ctx.fail('err.notCheckedIn');
        if (guest.checkOut) ctx.fail('err.alreadyCheckedOut');
        if (input.kind === 'monthly' || input.kind === 'departure') ctx.fail('health.err.guestKind');
      }
      const mine = validReadings(s).filter((r) => r.date === today && (m ? r.memberId === m.id : r.guestId === guest!.id));
      if ((input.kind === 'arrival' || input.kind === 'departure') && mine.some((r) => r.kind === input.kind)) ctx.fail('health.err.alreadyTaken');

      const vitals = pick(input, VITAL_FIELDS);
      const monthly = pick(input, MONTHLY_FIELDS);
      const needs = m ? monthlyNeeds(s, m.id, today) : { glucose: false, weight: false, any: false };
      const prevWeight = m ? lastBefore(s, m.id, today, 'weight')?.weight : undefined;
      // monthly values ride in the main row for a monthly check and for guests; otherwise they are saved as their own monthly row
      const inMain = input.kind === 'monthly' || !!guest;
      const base = { clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m ? m.id : null, ...(guest ? { guestId: guest.id } : {}), date: today, time: ctx.now, takenBy: ctx.user.id, source: input.source, edits: [] };
      const main: Reading = { id: ctx.id('h'), ...base, kind: input.kind, ...vitals, ...(inMain ? monthly : {}), status: 'normal', noteKeys: input.noteKeys, ...(input.note ? { note: input.note } : {}), shared: input.shared };
      const L = limitsFor(s, m); // a member's own limits first, the club's for the rest (guests: the club's)
      main.status = evaluateReading(main, prevWeight, L);
      let companion: Reading | undefined;
      if (m && !inMain && hasAny(monthly, MONTHLY_FIELDS)) {
        companion = { id: ctx.id('h'), ...base, kind: 'monthly', ...monthly, status: evaluateReading(monthly, prevWeight, L), noteKeys: [], shared: false };
      }
      const overall = worst([main.status, companion?.status ?? 'normal']);
      d.readings[main.id] = main;
      if (companion) d.readings[companion.id] = companion;
      const row = d.readings[main.id];

      // re-check: due `recheckMin` from now; saving the re-check itself closes the request
      let recheckAt: HM | undefined;
      if (input.recheck) {
        recheckAt = toHM(ctx.nowMin + settings.recheckMin);
        if (m) ensureAttendance(d, today, m.id, ctx).recheckDueAt = recheckAt;
        else if (guest) guest.recheckDueAt = recheckAt;
      } else if (input.kind === 'recheck') {
        if (a) delete a.recheckDueAt;
        else if (guest) delete guest.recheckDueAt;
      }
      // monthly checks never block the vitals: left empty while due, they stay in the queue as their own item
      let deferred = false;
      if (m && (input.kind === 'arrival' || input.kind === 'monthly')) {
        const stillDue = (needs.glucose && monthly.glucose === undefined) || (needs.weight && monthly.weight === undefined);
        if (input.kind === 'arrival') deferred = stillDue && (input.deferMonthly || (monthly.glucose === undefined && monthly.weight === undefined));
        else deferred = stillDue && input.deferMonthly;
        // the put-off flag lives on the day's attendance row; someone who is not checked in has no reminder to keep (their row still shows the monthly chip)
        if (a?.checkIn) { if (deferred) a.monthlyDeferred = true; else if (input.kind === 'monthly') a.monthlyDeferred = false; }
      }

      // family: a reading by the nurse waits for management's approval, and so does everything the family would hear about it
      // (management's own reading tells them at once). Staff alerts below are never held back.
      const gated = !!m && needsApproval(ctx);
      const shown: Partial<Reading> = { ...main, ...(companion ? pick(companion as NumericValues, MONTHLY_FIELDS) : {}) };
      let told: string[] = [];
      if (gated) {
        markPending(row, ctx, undefined, { tell: input.tellFamily, share: input.shared || input.tellFamily, overall, ...(companion ? { companionId: companion.id } : {}) });
        if (companion) { markPending(d.readings[companion.id], ctx, undefined); d.readings[companion.id].approval!.companionOf = row.id; }
      } else if (m && (input.tellFamily || input.shared)) told = noticeFamilies(d, ctx, row, { tell: input.tellFamily, share: input.shared, overall, companion });
      // the nurses and management hear about Alerts (management also gets the derived "Needs action" item)
      if (overall === 'alert') {
        if (m) ctx.notify({ toRoles: ['nurse'], kind: 'health.notif.alert', params: { name: memberShort(m), value: headlineValue(shown) }, link: `/readings?member=${m.id}`, memberId: m.id, severity: 'urgent', ref: { type: 'reading', id: main.id } });
        else ctx.notify({ toRoles: ['nurse', 'mgmt'], kind: 'health.notif.guestAlert', params: { name: guest!.name, value: headlineValue(shown) }, link: '/today', severity: 'urgent', ref: { type: 'reading', id: main.id } });
      }
      ctx.feed({ icon: 'monitor_heart', key: `health.feed.${overall}${told.length ? 'Told' : ''}`, params: { name: m ? shortOf(d, m.id) : guest!.name, value: headlineValue(shown) }, ...(m ? { memberId: m.id } : {}) });
      Object.assign(ctx.result, { readingId: main.id, ...(companion ? { monthlyId: companion.id } : {}), status: overall, told, deferred, ...(gated ? { pending: true } : {}), ...(recheckAt ? { recheckAt } : {}) });
    },
  }),

  // ---------- correct a reading ----------
  defineAction<ReadingEditInput>({
    name: 'reading.edit',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const readingId = str(i.readingId);
      if (!readingId) throw new DomainError('err.invalid');
      const reason = oneOf(i.reason, EDIT_REASONS);
      if (!reason) throw new DomainError('health.err.reasonRequired');
      const values = numbers(i.values);
      // a correction may change one of the two blood pressure numbers: the pair is checked against the saved row in run()
      if (values.sys !== undefined && values.dia !== undefined && values.dia >= values.sys) throw new DomainError('health.err.diaSys');
      const note = str(i.note)?.slice(0, 500);
      return { readingId, values, reason, ...(note ? { note } : {}) };
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const r = d.readings[input.readingId];
      if (!r || r.deletedAt) ctx.fail('err.notFound');
      if (r.voided) ctx.fail('health.err.alreadyVoided');
      // a correction by the nurse waits for approval; families keep seeing the approved values until then
      const gated = !!r.memberId && needsApproval(ctx);
      const before = gated ? priorOf(r, READING_KEYS) : undefined;
      const row = r as unknown as Record<ReadingField, number | undefined>;
      const from: Record<string, number | null> = {};
      const fields: string[] = [];
      for (const f of READING_FIELDS) {
        const nv = input.values[f];
        if (nv === undefined || row[f] === nv) continue;
        from[f] = row[f] ?? null;
        fields.push(f);
        row[f] = nv;
      }
      if (!fields.length) ctx.fail('err.noChanges');
      if ((r.sys === undefined) !== (r.dia === undefined)) ctx.fail('health.err.bpPair');
      if (r.sys !== undefined && r.dia !== undefined && r.dia >= r.sys) ctx.fail('health.err.diaSys');
      const prevWeight = r.memberId ? lastBefore(s, r.memberId, r.date, 'weight')?.weight : undefined;
      r.status = evaluateReading(r, prevWeight, limitsFor(s, r.memberId));
      if (r.source === 'device') r.source = 'mixed';
      r.edits.push({ at: ctx.nowDT, by: ctx.user.id, fields, reason: input.reason, ...(input.note ? { note: input.note } : {}), from });
      if (gated) markPending(r, ctx, before);
      const name = r.memberId ? shortOf(d, r.memberId) : d.guestVisits[r.guestId || '']?.name || '';
      ctx.feed({ icon: 'edit', key: 'health.feed.edited', params: { name }, ...(r.memberId ? { memberId: r.memberId } : {}) });
      Object.assign(ctx.result, { readingId: r.id, status: r.status, ...(gated ? { pending: true } : {}) });
    },
  }),

  // ---------- remove a reading ----------
  defineAction<ReadingVoidInput>({
    name: 'reading.void',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const readingId = str(i.readingId);
      if (!readingId) throw new DomainError('err.invalid');
      const reason = oneOf(i.reason, VOID_REASONS);
      if (!reason) throw new DomainError('health.err.reasonRequired');
      const note = str(i.note)?.slice(0, 500);
      if (reason === 'other' && !note) throw new DomainError('err.noteRequired');
      return { readingId, reason, ...(note ? { note } : {}), withMonthly: i.withMonthly === true };
    },
    run(d, input, ctx) {
      const r = d.readings[input.readingId];
      if (!r || r.deletedAt) ctx.fail('err.notFound');
      if (r.voided) ctx.fail('health.err.alreadyVoided');
      const stamp = { at: ctx.nowDT, by: ctx.user.id, reason: input.reason, ...(input.note ? { note: input.note } : {}) };
      r.voided = stamp;
      let withMonthly = false;
      if (input.withMonthly && r.kind !== 'monthly') {
        const twin = Object.values(d.readings).find((x) => x !== r && !x.deletedAt && !x.voided && x.kind === 'monthly' && x.date === r.date && x.time === r.time && x.memberId === r.memberId && x.guestId === r.guestId);
        if (twin) { twin.voided = { ...stamp }; withMonthly = true; }
      }
      // the queue follows the correction (today's readings only): a re-check this reading asked for goes with it, and a re-check or
      // monthly check that was removed as a mistake is asked for again
      const today = r.date === ctx.today;
      const a = r.memberId && today ? d.attendance[attId(r.date, r.memberId)] : undefined;
      const g = r.guestId && today ? d.guestVisits[r.guestId] : undefined;
      const askedFor = toHM(toMin(r.time) + d.club.settings.recheckMin);
      if (a?.recheckDueAt && a.recheckDueAt === askedFor) delete a.recheckDueAt;
      if (g?.recheckDueAt && g.recheckDueAt === askedFor) delete g.recheckDueAt;
      if (r.kind === 'recheck' && input.reason !== 'duplicate' && today) {
        const other = Object.values(d.readings).some((x) => x !== r && !x.deletedAt && !x.voided && x.kind === 'recheck' && x.date === r.date && (r.memberId ? x.memberId === r.memberId : x.guestId === r.guestId));
        if (!other && a && !a.recheckDueAt) a.recheckDueAt = ctx.now;
        if (!other && g && !g.recheckDueAt) g.recheckDueAt = ctx.now;
      }
      if (a && r.kind === 'monthly' && monthlyNeeds(d as unknown as ClubState, r.memberId!, r.date).any) a.monthlyDeferred = true;
      // the family was told: tell them it was a mistake (the demo shows it as an update in their bell)
      if (r.memberId && r.familyTold) {
        const m = d.members[r.memberId];
        if (m) ctx.notify({ toUsers: r.familyTold.familyIds, kind: 'health.notif.fam.void', params: { name: memberShort(m) }, link: '/health', memberId: m.id, severity: 'attention' });
      }
      const name = r.memberId ? shortOf(d, r.memberId) : d.guestVisits[r.guestId || '']?.name || '';
      ctx.feed({ icon: 'delete', key: 'health.feed.voided', params: { name }, ...(r.memberId ? { memberId: r.memberId } : {}) });
      Object.assign(ctx.result, { readingId: r.id, withMonthly });
    },
  }),

  // ---------- the nurse adds someone to the queue ----------
  defineAction<QueueAddInput>({
    name: 'queue.add',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const memberId = str(i.memberId);
      const kind = oneOf(i.kind, ['spot', 'departure', 'recheck'] as const);
      if (!memberId || !kind) throw new DomainError('err.invalid');
      const note = str(i.note)?.slice(0, 200);
      return { memberId, kind, ...(note ? { note } : {}) };
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const today = ctx.today;
      const m = requireMember(d, input.memberId, ctx);
      const a0 = d.attendance[attId(today, m.id)];
      if (!a0?.checkIn) ctx.fail('err.notCheckedIn');
      if (a0.checkOut) ctx.fail('err.alreadyCheckedOut');
      const q = stationQueue(s, today, ctx.nowMin);
      const pending = [...q.todo, ...q.later].find((x) => x.personId === m.id && x.kind === input.kind);
      const checked = !!todayReading(s, m.id, today, 'arrival') || a0.dismissed.some((x) => x.kind === 'arrival');
      if (input.kind !== 'spot' && !checked) ctx.fail('health.err.noArrival');
      const a = ensureAttendance(d, today, m.id, ctx);
      if (input.kind === 'spot') {
        if (pending) ctx.fail('health.err.alreadyQueued');
      } else if (input.kind === 'departure') {
        if (todayReading(s, m.id, today, 'departure')) ctx.fail('health.err.alreadyTaken');
        if (pending) ctx.fail('health.err.alreadyQueued');
        a.departureAsked = { at: ctx.now, by: ctx.actor };
      } else {
        if (pending && toMin(pending.due) <= ctx.nowMin) ctx.fail('health.err.alreadyQueued');
        a.recheckDueAt = ctx.now; // due now (a re-check that was waiting for later comes forward)
      }
      a.queueAdds.push({ at: ctx.now, by: ctx.actor, kind: input.kind, ...(input.note ? { note: input.note } : {}) });
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: input.kind === 'departure' ? 'departureAsked' : 'queueAdd', note: input.kind + (input.note ? `: ${input.note}` : '') });
      ctx.feed({ icon: 'playlist_add', key: 'health.feed.queueAdd', params: { name: memberShort(m) }, memberId: m.id });
    },
  }),

  // ---------- the nurse takes someone out of the queue ----------
  defineAction<QueueDismissInput>({
    name: 'queue.dismiss',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const memberId = str(i.memberId);
      const guestId = str(i.guestId);
      if (!memberId === !guestId) throw new DomainError('err.invalid');
      const kind = oneOf(i.kind, QUEUE_KINDS);
      if (!kind) throw new DomainError('err.invalid');
      const reason = oneOf(i.reason, DISMISS_REASONS);
      if (!reason) throw new DomainError('health.err.reasonRequired');
      return { ...(memberId ? { memberId } : {}), ...(guestId ? { guestId } : {}), kind, reason };
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const id = (input.memberId ?? input.guestId)!;
      const q = stationQueue(s, ctx.today, ctx.nowMin);
      if (![...q.todo, ...q.later].some((x) => x.personId === id && x.kind === input.kind)) ctx.fail('health.err.notInQueue');
      if (input.guestId) {
        const g = d.guestVisits[id];
        if (input.kind === 'arrival') g.healthDismissed = { at: ctx.nowDT, by: ctx.user.id, reason: input.reason };
        else if (input.kind === 'recheck') delete g.recheckDueAt;
        else ctx.fail('health.err.guestKind');
        ctx.feed({ icon: 'playlist_remove', key: 'health.feed.dismissed', params: { name: g.name } });
        return;
      }
      const m = requireMember(d, id, ctx);
      const a = ensureAttendance(d, ctx.today, id, ctx);
      a.dismissed.push({ at: ctx.now, by: ctx.actor, kind: input.kind, reason: input.reason });
      a.edits.push({ at: ctx.nowDT, by: ctx.actor, what: 'dismiss', note: `${input.kind}: ${input.reason}` });
      ctx.feed({ icon: 'playlist_remove', key: 'health.feed.dismissed', params: { name: memberShort(m) }, memberId: m.id });
    },
  }),

  // ---------- when a reading counts as Watch or Alert ----------
  defineAction<{ limits: HealthLimits }>({
    name: 'health.setLimits',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const out = parseLimits(rec(rec(raw).limits), LIMIT_KEYS);
      return { limits: out as HealthLimits };
    },
    run(d, i, ctx) {
      const before = limitsOf(d as unknown as ClubState);
      if (LIMIT_KEYS.every((k) => before[k].watch === i.limits[k].watch && before[k].alert === i.limits[k].alert)) ctx.fail('err.noChanges');
      d.club.settings.limits = i.limits;
      // every saved reading is graded again with the new limits (a member's own limits still come first); lists, records, trends and the family's view follow
      const regraded = regrade(d, () => true);
      ctx.result.regraded = regraded;
      ctx.feed({ icon: 'tune', key: 'health.feed.limits', params: { name: nameOfUser(ctx.user) } });
    },
  }),

  // ---------- one member's own limits (KC round 7): the keys given replace the club's for them; null clears them ----------
  defineAction<{ memberId: string; limits: Partial<HealthLimits> | null }>({
    name: 'health.setMemberLimits',
    can: (u) => nurseOrMgmt(u),
    parse(raw) {
      const i = rec(raw);
      const memberId = str(i.memberId);
      if (!memberId) throw new DomainError('err.invalid');
      if (i.limits === null || i.limits === undefined) return { memberId, limits: null };
      const src = rec(i.limits);
      const given = LIMIT_KEYS.filter((k) => src[k] !== undefined && src[k] !== null);
      return { memberId, limits: given.length ? parseLimits(src, given) : null };
    },
    run(d, i, ctx) {
      const m = requireMember(d, i.memberId, ctx);
      const was = m.limits as Partial<HealthLimits> | undefined;
      const norm = (l?: Partial<HealthLimits> | null) => LIMIT_KEYS.map((k) => (l?.[k] ? `${l[k]!.watch}/${l[k]!.alert}` : '-')).join('|');
      if (norm(was) === norm(i.limits)) ctx.fail('err.noChanges');
      if (i.limits) m.limits = i.limits; else delete m.limits;
      // this member's saved readings are graded again with the new limits
      const regraded = regrade(d, (r) => r.memberId === m.id);
      ctx.result.regraded = regraded;
      ctx.feed({ icon: 'tune', key: i.limits ? 'health.feed.memberLimits' : 'health.feed.memberLimitsClear', params: { name: nameOfUser(ctx.user), member: shortOf(d, m.id) }, memberId: m.id });
    },
  }),
];

/** Watch and Alert for the given limits: plausible numbers, one decimal, Alert past Watch, each line needs at least one of the two. */
function parseLimits(src: Record<string, unknown>, keys: readonly LimitKey[]): Partial<HealthLimits> {
  const out: Partial<HealthLimits> = {};
  for (const k of keys) {
    const l = rec(src[k]);
    const [lo, hi] = LIMIT_RANGE[k];
    const one = (v: unknown) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < lo || n > hi) throw new DomainError('health.err.limitRange');
      return Math.round(n * 10) / 10;
    };
    const pair = { watch: one(l.watch), alert: one(l.alert) };
    if (!limitOrderOk(k, pair)) throw new DomainError('health.err.limitOrder');
    out[k] = pair;
  }
  return out;
}

/** Grade the saved readings again (those `pick`ed) with each member's effective limits; returns how many changed. */
function regrade(d: Draft<ClubState>, pick: (r: Draft<Reading>) => boolean): number {
  const s = d as unknown as ClubState;
  let n = 0;
  // each member's weights once, oldest first (`lastBefore` per reading scans every reading: with months of history that is millions of draft reads)
  const weights = new Map<string, { at: string; date: string; w: number }[]>();
  for (const r of Object.values(d.readings)) {
    if (r.deletedAt || r.voided || r.weight == null || !r.memberId) continue;
    const l = weights.get(r.memberId) ?? [];
    l.push({ at: r.date + r.time, date: r.date, w: r.weight });
    weights.set(r.memberId, l);
  }
  for (const l of weights.values()) l.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const prevWeight = (memberId: string, date: string) => { const l = weights.get(memberId); if (!l) return undefined; let i = l.length - 1; while (i >= 0 && l[i].date >= date) i--; return i >= 0 ? l[i].w : undefined; };
  for (const r of Object.values(d.readings)) {
    if (r.deletedAt || !pick(r)) continue;
    const prev = r.memberId ? prevWeight(r.memberId, r.date) : undefined;
    const st = evaluateReading(r as Reading, prev, limitsFor(s, r.memberId));
    if (st !== r.status) { r.status = st; n++; }
  }
  return n;
}
