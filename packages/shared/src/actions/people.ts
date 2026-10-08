// People: real staff records (profile, contract, KTP, pay, app access), HR notes and staff time entries. Management only.
import type { Draft } from 'immer';
import type { ClubState, ISODate, Staff, StaffHr, StaffRole, User } from '../types';
import { defineAction, isMgmt, type Ctx } from './framework';
import { BANKS, CONTRACTS, HR_NOTE_KINDS, STAFF_ROLES, TIME_KINDS, staffTimeId } from '../rules/mgmt';
import { bad, bool, hm, int, isoDate, nextNumId, obj, oneOf, phone, str } from '../rules/mgmtParse';
import { live } from '../util';
import { mediaIdOf } from './members';

const mgmtOnly = (u: User) => isMgmt(u);
const id80 = (v: unknown, field: string) => str(v, 80, { required: true, field });
const RATEABLE_ROLES: StaffRole[] = ['lobby', 'nurse', 'activity', 'driver'];
function need<T>(v: T | null | undefined | false, ctx: Ctx, code = 'err.notFound'): T {
  if (!v) ctx.fail(code);
  return v as T;
}

interface HrIn { contract?: StaffHr['contract']; start?: ISODate; end?: ISODate | null; signed?: boolean; ktpLast4?: string; ktpOnFile?: boolean; salary?: number; allowance?: number; bank?: StaffHr['bank']; account?: string; quote?: string }
const parseHr = (v: unknown): HrIn => {
  if (v === undefined || v === null) return {};
  const o = obj(v, 'hr');
  const out: HrIn = {};
  if (o.contract !== undefined) out.contract = oneOf(o.contract, CONTRACTS, 'hr.contract');
  if (o.start !== undefined) out.start = isoDate(o.start, 'hr.start');
  if (o.end !== undefined) out.end = o.end === null || o.end === '' ? null : isoDate(o.end, 'hr.end');
  if (o.signed !== undefined) out.signed = bool(o.signed);
  if (o.ktpLast4 !== undefined) {
    const k = str(o.ktpLast4, 4);
    if (k && !/^\d{4}$/.test(k)) bad('hr.ktpLast4');
    out.ktpLast4 = k;
  }
  if (o.ktpOnFile !== undefined) out.ktpOnFile = bool(o.ktpOnFile);
  if (o.salary !== undefined) out.salary = int(o.salary, 0, 1_000_000_000, 'hr.salary');
  if (o.allowance !== undefined) out.allowance = int(o.allowance, 0, 1_000_000_000, 'hr.allowance');
  if (o.bank !== undefined) out.bank = oneOf(o.bank, BANKS, 'hr.bank');
  if (o.account !== undefined) {
    const a = str(o.account, 24).replace(/[\s-]/g, '');
    if (a && !/^\d{6,20}$/.test(a)) bad('hr.account');
    out.account = a;
  }
  if (o.quote !== undefined) out.quote = str(o.quote, 200);
  return out;
};
interface CreateIn { name: string; knownAs?: string; role: StaffRole; title: string; phone: string; supervisor?: boolean; rateable?: boolean; appAccess?: boolean; hr: HrIn }
interface UpdateIn { staffId: string; name?: string; knownAs?: string | null; role?: StaffRole; title?: string; phone?: string; supervisor?: boolean; rateable?: boolean; /** round 7: the profile picture (an uploaded media id); null removes it */ photoMediaId?: string | null; hr: HrIn }

/** A phone number may sign in as only one person: staff and family contacts share the login lookup. */
function phoneTaken(d: Draft<ClubState>, ph: string, exceptStaffId?: string) {
  return live(d.staff as ClubState['staff']).some((x) => x.id !== exceptStaffId && x.phone === ph) || live(d.familyContacts as ClubState['familyContacts']).some((c) => c.phone === ph);
}
/** Contract rules: fixed-term (PKWT) needs an end date after the start; permanent (PKWTT) has none. */
function checkContract(hr: StaffHr, ctx: Ctx) {
  if (hr.contract === 'pkwtt') {
    hr.end = null;
    return;
  }
  if (!hr.end) ctx.fail('people.err.endRequired');
  if (hr.end < hr.start) ctx.fail('people.err.endBeforeStart');
}
function staffRow(d: Draft<ClubState>, id: string, ctx: Ctx) {
  const st = d.staff[id];
  if (!st || st.deletedAt || st.id === 'system') ctx.fail('err.notFound');
  return st;
}

export const peopleActions = [
  defineAction<CreateIn>({
    name: 'staff.create',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return {
        name: str(o.name, 80, { required: true, field: 'name' }), ...(o.knownAs ? { knownAs: str(o.knownAs, 40) } : {}), role: oneOf(o.role, STAFF_ROLES, 'role'),
        title: str(o.title, 60, { required: true, field: 'title' }), phone: phone(o.phone, 'phone'), supervisor: bool(o.supervisor),
        ...(o.rateable !== undefined ? { rateable: bool(o.rateable) } : {}), appAccess: bool(o.appAccess), hr: parseHr(o.hr),
      };
    },
    run(d, i, ctx) {
      if (phoneTaken(d, i.phone)) ctx.fail('people.err.phoneTaken');
      const id = nextNumId(d.staff, 's');
      const hr: StaffHr = {
        contract: 'pkwt', start: ctx.today, end: null, signed: false, ktpLast4: '', ktpOnFile: false, salary: 0, allowance: 0, bank: 'BCA', account: '', ...i.hr,
      } as StaffHr;
      checkContract(hr, ctx);
      d.staff[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: i.name, ...(i.knownAs ? { knownAs: i.knownAs } : {}), role: i.role, title: i.title, phone: i.phone,
        supervisor: !!i.supervisor, rateable: i.rateable ?? RATEABLE_ROLES.includes(i.role), appAccess: !!i.appAccess, active: true, extraClubIds: [], hr,
      } satisfies Staff;
      ctx.result.staffId = id;
      ctx.feed({ icon: 'person_add', key: 'people.feed.added', params: { name: i.name } });
    },
  }),
  defineAction<UpdateIn>({
    name: 'staff.update',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return {
        staffId: id80(o.staffId, 'staffId'),
        ...(o.name !== undefined ? { name: str(o.name, 80, { required: true, field: 'name' }) } : {}),
        ...(o.knownAs !== undefined ? { knownAs: o.knownAs === null ? null : str(o.knownAs, 40) } : {}),
        ...(o.role !== undefined ? { role: oneOf(o.role, STAFF_ROLES, 'role') } : {}),
        ...(o.title !== undefined ? { title: str(o.title, 60, { required: true, field: 'title' }) } : {}),
        ...(o.phone !== undefined ? { phone: phone(o.phone, 'phone') } : {}),
        ...(o.supervisor !== undefined ? { supervisor: bool(o.supervisor) } : {}),
        ...(o.rateable !== undefined ? { rateable: bool(o.rateable) } : {}),
        ...(o.photoMediaId !== undefined ? { photoMediaId: mediaIdOf(o.photoMediaId) ?? null } : {}),
        hr: parseHr(o.hr),
      };
    },
    run(d, i, ctx) {
      const st = staffRow(d, i.staffId, ctx);
      if (i.role && i.role !== st.role && st.id === ctx.user.id) ctx.fail('people.err.ownRole');
      if (i.phone && i.phone !== st.phone && phoneTaken(d, i.phone, st.id)) ctx.fail('people.err.phoneTaken');
      if (i.name !== undefined) st.name = i.name;
      if (i.knownAs !== undefined) { if (i.knownAs) st.knownAs = i.knownAs; else delete st.knownAs; }
      if (i.role) st.role = i.role;
      if (i.title !== undefined) st.title = i.title;
      if (i.phone) st.phone = i.phone;
      if (i.supervisor !== undefined) st.supervisor = i.supervisor;
      if (i.rateable !== undefined) st.rateable = i.rateable;
      if (i.photoMediaId !== undefined) { if (i.photoMediaId) st.photoMediaId = i.photoMediaId; else delete st.photoMediaId; }
      Object.assign(st.hr, i.hr);
      if (i.hr.quote === '') delete st.hr.quote;
      checkContract(st.hr as StaffHr, ctx);
      ctx.feed({ icon: 'badge', key: 'people.feed.updated', params: { name: st.name } });
    },
  }),
  defineAction<{ staffId: string; reason?: string }>({
    name: 'staff.deactivate',
    can: mgmtOnly,
    parse: (raw) => ({ staffId: id80(obj(raw).staffId, 'staffId'), reason: str(obj(raw).reason, 200) }),
    run(d, i, ctx) {
      const st = staffRow(d, i.staffId, ctx);
      if (st.id === ctx.user.id) ctx.fail('people.err.selfDeactivate');
      if (!st.active) ctx.fail('err.noChanges');
      st.active = false;
      ctx.feed({ icon: 'person_off', key: 'people.feed.deactivated', params: { name: st.name } });
    },
  }),
  defineAction<{ staffId: string }>({
    name: 'staff.reactivate',
    can: mgmtOnly,
    parse: (raw) => ({ staffId: id80(obj(raw).staffId, 'staffId') }),
    run(d, i, ctx) {
      const st = staffRow(d, i.staffId, ctx);
      if (st.active) ctx.fail('err.noChanges');
      st.active = true;
      ctx.feed({ icon: 'person_check', key: 'people.feed.reactivated', params: { name: st.name } });
    },
  }),
  // Housekeeping and driver get Requests as their home screen once this is on.
  defineAction<{ staffId: string; on: boolean }>({
    name: 'staff.setAppAccess',
    can: mgmtOnly,
    parse: (raw) => ({ staffId: id80(obj(raw).staffId, 'staffId'), on: bool(obj(raw).on) }),
    run(d, i, ctx) {
      const st = staffRow(d, i.staffId, ctx);
      if (!i.on && st.id === ctx.user.id) ctx.fail('people.err.selfAccess');
      if (i.on && !st.active) ctx.fail('people.err.inactive');
      if (i.on && !st.phone) ctx.fail('people.err.phoneRequired');
      if (st.appAccess === i.on) ctx.fail('err.noChanges');
      st.appAccess = i.on;
      ctx.feed({ icon: i.on ? 'phone_iphone' : 'phonelink_erase', key: i.on ? 'people.feed.accessOn' : 'people.feed.accessOff', params: { name: st.name } });
    },
  }),

  // ----- notes and warnings -----
  defineAction<{ staffId: string; kind: (typeof HR_NOTE_KINDS)[number]; text: string; on?: ISODate }>({
    name: 'hrNote.add',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      return { staffId: id80(o.staffId, 'staffId'), kind: oneOf(o.kind, HR_NOTE_KINDS, 'kind'), text: str(o.text, 1000, { required: true, field: 'text' }), ...(o.on ? { on: isoDate(o.on, 'on') } : {}) };
    },
    run(d, i, ctx) {
      staffRow(d, i.staffId, ctx);
      const on = i.on ?? ctx.today;
      if (on > ctx.today) ctx.fail('people.err.futureDate');
      const id = ctx.id('hrn');
      d.hrNotes[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, staffId: i.staffId, kind: i.kind, on, text: i.text };
      ctx.result.noteId = id;
    },
  }),
  defineAction<{ noteId: string }>({
    name: 'hrNote.delete',
    can: mgmtOnly,
    parse: (raw) => ({ noteId: id80(obj(raw).noteId, 'noteId') }),
    run(d, i, ctx) {
      const n = need(d.hrNotes[i.noteId], ctx);
      if (n.deletedAt) ctx.fail('err.notFound');
      n.deletedAt = ctx.nowDT;
    },
  }),

  // ----- staff time (clock in / out, leave) -----
  defineAction<{ staffId: string; date: ISODate; kind: (typeof TIME_KINDS)[number]; from?: string; to?: string }>({
    name: 'staffTime.upsert',
    can: mgmtOnly,
    parse(raw) {
      const o = obj(raw);
      const kind = oneOf(o.kind, TIME_KINDS, 'kind');
      const from = o.from ? hm(o.from, 'from') : undefined;
      const to = o.to ? hm(o.to, 'to') : undefined;
      if (kind === 'worked' && !from) bad('from');
      if (from && to && to <= from) bad('to', 'people.err.timeOrder');
      return { staffId: id80(o.staffId, 'staffId'), date: isoDate(o.date, 'date'), kind, ...(kind === 'worked' ? { ...(from ? { from } : {}), ...(to ? { to } : {}) } : {}) };
    },
    run(d, i, ctx) {
      staffRow(d, i.staffId, ctx);
      if (i.kind === 'worked' && i.date > ctx.today) ctx.fail('people.err.futureDate');
      if (i.kind === 'worked' && i.date === ctx.today && i.from && i.from > ctx.now) ctx.fail('people.err.futureDate');
      const id = staffTimeId(i.staffId, i.date);
      const cur = d.staffTime[id];
      const row = { id, clubId: ctx.clubId, createdAt: cur?.createdAt ?? ctx.nowDT, createdBy: cur?.createdBy ?? ctx.actor, staffId: i.staffId, date: i.date, kind: i.kind, ...(i.from ? { from: i.from } : {}), ...(i.to ? { to: i.to } : {}) };
      d.staffTime[id] = row;
    },
  }),
  defineAction<{ staffId: string; date: ISODate }>({
    name: 'staffTime.remove',
    can: mgmtOnly,
    parse: (raw) => ({ staffId: id80(obj(raw).staffId, 'staffId'), date: isoDate(obj(raw).date, 'date') }),
    run(d, i, ctx) {
      const id = staffTimeId(i.staffId, i.date);
      const cur = need(d.staffTime[id], ctx);
      if (cur.deletedAt) ctx.fail('err.notFound');
      cur.deletedAt = ctx.nowDT;
    },
  }),
];
