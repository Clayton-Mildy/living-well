// Enquiries (leads), visits and trials, the public membership form, and joining a lead as a member.
// Lobby and management run the lead actions; the family fills the form through the public /api/form routes as the system user.
import type { Draft } from 'immer';
import type {
  Actor, ChangeRequest, ClubState, DrugAllergy, Enquiry, FamilyContact, FoodAllergen, FormRequest, GuestVisit, Member, MembershipForm, Plan, User,
} from '../types';
import { defineAction, hasRole, isMgmt, actorOf, type Ctx, DomainError } from './framework';
import { familyUserIds, requireMember, shortOf } from './helpers';
import { dayStatus, nextOpenDay, primaryContact } from '../rules/core';
import {
  ALL_RELATIONS, DIETS, DRUGS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, TITLES, bookingDayCheck, completeForm, contactFromLead, enquiryForm, formByToken, formErrors, formIsEditable,
  formLink, formMemberPatch, linkFromLead, memberFromLead, sanitizeForm, seniorName, type EnqStage,
} from '../rules/enquiries';
import { arr, bool, dm, hash8, hm, int, isoDate, nextNumId, obj, oneOf, phone, str } from '../rules/mgmtParse';
import { e164, live, sortBy } from '../util';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
const system = (u: User) => u.id === 'system';
const S = (d: Draft<ClubState>) => d as unknown as ClubState;
const NEXT_KINDS = ['callBack', 'sendPrices', 'visit', 'trial', 'followUp', 'starts', 'custom'] as const;

// ---------- parsing ----------
const parseSenior = (v: unknown) => {
  const o = obj(v, 'senior');
  return { title: oneOf(o.title, TITLES, 'senior.title'), name: str(o.name, 80, { required: true, field: 'senior.name' }) };
};
const parseContact = (v: unknown) => {
  const o = obj(v, 'contact');
  return { name: str(o.name, 80, { required: true, field: 'contact.name' }), relation: oneOf(o.relation, ALL_RELATIONS, 'contact.relation'), phone: phone(o.phone, 'contact.phone') };
};
const parseNext = (v: unknown): Enquiry['next'] | undefined => {
  if (v === undefined || v === null) return undefined;
  const o = obj(v, 'next');
  return { kind: oneOf(o.kind, NEXT_KINDS, 'next.kind'), ...(o.date ? { date: isoDate(o.date, 'next.date') } : {}), ...(o.time ? { time: hm(o.time, 'next.time') } : {}), ...(o.text ? { text: str(o.text, 200) } : {}) };
};
const drugAllergy = (x: unknown): DrugAllergy => {
  if (typeof x === 'string' && x.startsWith('other:') && x.slice(6).trim()) return `other:${x.slice(6).trim().slice(0, 60)}` as DrugAllergy;
  return oneOf(x, DRUGS, 'drugs');
};
const id60 = (v: unknown, field: string) => str(v, 80, { required: true, field });

// ---------- helpers ----------
function enq(d: Draft<ClubState>, id: string, ctx: Ctx) {
  const e = d.enquiries[id];
  if (!e || e.deletedAt) ctx.fail('err.notFound');
  return e;
}
/** A form request by token or id (explicit Ctx type so TypeScript narrows after ctx.fail). */
function formOr(d: Draft<ClubState>, ctx: Ctx, pick: { token?: string; id?: string }) {
  const f = pick.id ? d.formRequests[pick.id] : Object.values(d.formRequests).find((x) => !x.deletedAt && x.token === pick.token);
  if (!f || f.deletedAt) ctx.fail('err.notFound');
  return f;
}
function need<T>(v: T | null | undefined | false, ctx: Ctx, code = 'err.notFound'): T {
  if (!v) ctx.fail(code);
  return v as T;
}
const guestsOf = (d: Draft<ClubState>, enquiryId: string) => Object.values(d.guestVisits).filter((g) => !g.deletedAt && g.enquiryId === enquiryId);
/** Cancel visits/trials that haven't happened yet (the lead moved on, was lost, archived or joined). */
function cancelPendingGuests(d: Draft<ClubState>, enquiryId: string, from: string, kinds?: GuestVisit['kind'][]) {
  for (const g of guestsOf(d, enquiryId)) if (g.status === 'booked' && !g.checkIn && g.date >= from && (!kinds || kinds.includes(g.kind))) g.status = 'cancelled';
}
/** A visit has a day and a time; a trial is a day pass (lunch and the health check are always included), so it has a day only. */
function upsertGuest(d: Draft<ClubState>, ctx: Ctx, e: Draft<Enquiry>, kind: 'visit' | 'trial', f: Partial<GuestVisit> & { date: string }) {
  let g = guestsOf(d, e.id).find((x) => x.kind === kind && x.status === 'booked' && !x.checkIn);
  if (!g) {
    let id = `g-${e.id}${kind === 'visit' ? '-v' : ''}`;
    if (d.guestVisits[id]) id = ctx.id('g');
    d.guestVisits[id] = {
      id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, enquiryId: e.id, kind, date: f.date, ...(kind === 'visit' && f.time ? { time: f.time } : {}), name: seniorName(e), escortName: e.contact.name,
      lunch: kind === 'trial', healthCheck: kind === 'trial', food: null, drugs: [], mobility: null, diet: [], status: 'booked',
    };
    g = d.guestVisits[id];
  }
  Object.assign(g, f, { name: seniorName(e), escortName: e.contact.name });
  if (kind === 'trial') {
    delete g.time;
    g.lunch = true;
    g.healthCheck = true;
  }
  return g;
}
/** What the lead's next step is, from the visit or trial still booked (else a generic step for its stage). */
function nextFor(d: Draft<ClubState>, stage: EnqStage, enquiryId: string, today: string): Enquiry['next'] {
  const kind = stage === 'trial' ? 'trial' : 'visit';
  const g = sortBy(guestsOf(d, enquiryId).filter((x) => x.kind === kind && x.status === 'booked' && !x.checkIn && x.date >= today), (x) => x.date + (x.time ?? ''))[0];
  if (g && (stage === 'visit' || stage === 'trial')) return { kind: g.kind, date: g.date, ...(g.time ? { time: g.time } : {}) };
  return stage === 'new' ? { kind: 'callBack' } : { kind };
}

// ---------- leads ----------
interface CreateIn { senior: Enquiry['senior']; contact: Enquiry['contact']; source: Enquiry['source']; notes?: string; next?: Enquiry['next'] }
interface UpdateIn { enquiryId: string; senior?: Enquiry['senior']; contact?: Enquiry['contact']; source?: Enquiry['source']; notes?: string; next?: Enquiry['next'] | null }
interface ConvertIn { enquiryId: string; plan: Plan; start: string }

/** After a lead becomes a member (immediately for management, on approval for lobby): welcome message, visits closed. Members come on any open day, so nothing is booked. */
function finishJoin(d: Draft<ClubState>, memberId: string, input: ConvertIn, ctx: Ctx) {
  if (!d.members[memberId]) return;
  cancelPendingGuests(d, input.enquiryId, ctx.today);
  ctx.notify({ toUsers: familyUserIds(d, memberId), kind: 'enq.notif.welcome', params: { name: shortOf(d, memberId), date: dm(input.start) }, link: '/today', memberId });
}

export const enquiriesActions = [
  defineAction<CreateIn>({
    name: 'enquiry.create',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { senior: parseSenior(o.senior), contact: parseContact(o.contact), source: oneOf(o.source, ENQ_SOURCES, 'source'), notes: str(o.notes, 1000), next: parseNext(o.next) };
    },
    run(d, i, ctx) {
      const id = nextNumId(d.enquiries, 'e');
      d.enquiries[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, senior: i.senior, contact: i.contact, source: i.source, stage: 'new',
        next: i.next ?? { kind: 'callBack', date: nextOpenDay(S(d), ctx.today) }, ...(i.notes ? { notes: i.notes } : {}),
      };
      ctx.result.enquiryId = id;
      ctx.feed({ icon: 'contact_phone', key: 'enq.feed.leadAdded', params: { name: seniorName(i) } });
      ctx.notify({ toRoles: ['mgmt'], kind: 'enq.notif.newLead', params: { name: seniorName(i) }, link: '/enquiries' });
    },
  }),
  defineAction<UpdateIn>({
    name: 'enquiry.update',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return {
        enquiryId: id60(o.enquiryId, 'enquiryId'),
        ...(o.senior !== undefined ? { senior: parseSenior(o.senior) } : {}),
        ...(o.contact !== undefined ? { contact: parseContact(o.contact) } : {}),
        ...(o.source !== undefined ? { source: oneOf(o.source, ENQ_SOURCES, 'source') } : {}),
        ...(o.notes !== undefined ? { notes: str(o.notes, 1000) } : {}),
        ...(o.next !== undefined ? { next: o.next === null ? null : parseNext(o.next) } : {}),
      };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (i.senior) e.senior = i.senior;
      if (i.contact) e.contact = i.contact;
      if (i.source) e.source = i.source;
      if (i.notes !== undefined) { if (i.notes) e.notes = i.notes; else delete e.notes; }
      if (i.next !== undefined) { if (i.next) e.next = i.next; else delete e.next; }
      for (const g of guestsOf(d, e.id)) if (g.status === 'booked') { g.name = seniorName(e); g.escortName = e.contact.name; }
    },
  }),
  defineAction<{ enquiryId: string; stage: 'new' | 'visit' | 'trial' }>({
    name: 'enquiry.move',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), stage: oneOf(o.stage, ['new', 'visit', 'trial'] as const, 'stage') };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost') ctx.fail('enq.err.reopenFirst');
      if (e.stage === i.stage) ctx.fail('err.noChanges');
      // going back drops the bookings of the stages the lead leaves
      if (i.stage === 'new') cancelPendingGuests(d, e.id, ctx.today);
      else if (i.stage === 'visit') cancelPendingGuests(d, e.id, ctx.today, ['trial']);
      e.stage = i.stage;
      e.next = nextFor(d, i.stage, e.id, ctx.today);
      ctx.feed({ icon: 'swap_horiz', key: 'enq.feed.moved_' + i.stage, params: { name: seniorName(e) } });
    },
  }),
  defineAction<{ enquiryId: string; date: string; time: string }>({
    name: 'enquiry.bookVisit',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), date: isoDate(o.date, 'date'), time: hm(o.time, 'time') };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage !== 'new' && e.stage !== 'visit') ctx.fail('enq.err.notOpen');
      const chk = bookingDayCheck(S(d), 'visit', i.date, i.time, ctx.today, ctx.now);
      if (!chk.ok) ctx.fail(chk.code, chk.params);
      upsertGuest(d, ctx, e, 'visit', { date: i.date, time: i.time });
      e.stage = 'visit';
      e.next = { kind: 'visit', date: i.date, time: i.time };
      ctx.feed({ icon: 'meeting_room', key: 'enq.feed.visitBooked', params: { name: seniorName(e), date: dm(i.date), time: i.time } });
    },
  }),
  // A trial is a day pass: lunch and the health check are always included and it has no time, so the booking is a day plus what the kitchen and the nurse need to know.
  defineAction<{ enquiryId: string; date: string; food: FoodAllergen[] | null; drugs: DrugAllergy[]; mobility: GuestVisit['mobility']; diet: GuestVisit['diet'] }>({
    name: 'enquiry.bookTrial',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return {
        enquiryId: id60(o.enquiryId, 'enquiryId'), date: isoDate(o.date, 'date'),
        food: o.food === null || o.food === undefined ? null : arr(o.food, (x) => oneOf(x, FOODS, 'food')), drugs: arr(o.drugs, drugAllergy),
        mobility: o.mobility === null || o.mobility === undefined ? null : oneOf(o.mobility, MOBILITIES, 'mobility'), diet: arr(o.diet, (x) => oneOf(x, DIETS, 'diet')),
      };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost') ctx.fail('enq.err.notOpen');
      const chk = bookingDayCheck(S(d), 'trial', i.date, undefined, ctx.today, ctx.now);
      if (!chk.ok) ctx.fail(chk.code, chk.params);
      upsertGuest(d, ctx, e, 'trial', { date: i.date, food: i.food, drugs: i.drugs, mobility: i.mobility, diet: i.diet });
      e.stage = 'trial';
      e.next = { kind: 'trial', date: i.date };
      const name = seniorName(e);
      ctx.feed({ icon: 'waving_hand', key: 'enq.feed.trialBooked', params: { name, date: dm(i.date) } });
      const kind = i.food === null ? 'enq.notif.trialLunchUnknown' : i.food.length ? 'enq.notif.trialLunchAllergy' : 'enq.notif.trialLunch';
      ctx.notify({ toRoles: ['kitchen'], kind, params: { name, date: dm(i.date) }, link: '/today', severity: kind === 'enq.notif.trialLunch' ? 'info' : 'attention' });
      ctx.notify({ toRoles: ['nurse'], kind: 'enq.notif.trialHealth', params: { name, date: dm(i.date) }, link: '/today' });
    },
  }),
  defineAction<{ enquiryId: string; reason: (typeof LOST_REASONS)[number]; note: string }>({
    name: 'enquiry.markLost',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), reason: oneOf(o.reason, LOST_REASONS, 'reason'), note: str(o.note, 500) };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost') ctx.fail('err.noChanges');
      e.lost = { reason: i.reason, ...(i.note ? { note: i.note } : {}), prevStage: e.stage };
      e.stage = 'lost';
      delete e.next;
      cancelPendingGuests(d, e.id, ctx.today);
      ctx.feed({ icon: 'block', key: 'enq.feed.lost', params: { name: seniorName(e) } });
    },
  }),
  defineAction<{ enquiryId: string; stage?: 'new' | 'visit' | 'trial' }>({
    name: 'enquiry.reopen',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), ...(o.stage ? { stage: oneOf(o.stage, ['new', 'visit', 'trial'] as const, 'stage') } : {}) };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage !== 'lost') ctx.fail('enq.err.notLost');
      e.stage = i.stage ?? 'new';
      delete e.lost;
      e.next = nextFor(d, e.stage, e.id, ctx.today);
      delete e.archivedAt;
      ctx.feed({ icon: 'undo', key: 'enq.feed.reopened', params: { name: seniorName(e) } });
    },
  }),
  defineAction<{ enquiryId: string; restore?: boolean }>({
    name: 'enquiry.archive',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), restore: bool(o.restore) };
    },
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (i.restore) {
        if (!e.archivedAt) ctx.fail('err.noChanges');
        delete e.archivedAt;
        return;
      }
      if (e.archivedAt) ctx.fail('err.noChanges');
      e.archivedAt = ctx.nowDT;
      cancelPendingGuests(d, e.id, ctx.today);
      ctx.feed({ icon: 'inventory_2', key: 'enq.feed.archived', params: { name: seniorName(e) } });
    },
  }),

  // ---------- the membership form ----------
  defineAction<{ target: { type: 'enquiry' | 'member'; id: string } }>({
    name: 'form.send',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      const t = obj(o.target, 'target');
      return { target: { type: oneOf(t.type, ['enquiry', 'member'] as const, 'target.type'), id: id60(t.id, 'target.id') } };
    },
    run(d, i, ctx) {
      const s = S(d);
      let to = '';
      let name = '';
      let memberId: string | undefined;
      if (i.target.type === 'enquiry') {
        const e = enq(d, i.target.id, ctx);
        if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
        if (e.stage === 'lost') ctx.fail('enq.err.notOpen');
        to = e.contact.phone;
        name = seniorName(e);
      } else {
        const m = requireMember(d, i.target.id, ctx);
        to = primaryContact(s, m.id)?.phone || '';
        name = shortOf(d, m.id);
        memberId = m.id;
      }
      if (!to) ctx.fail('enq.err.noPhone');
      const existing = sortBy(live(s.formRequests).filter((f) => f.target.type === i.target.type && f.target.id === i.target.id), (f) => f.createdAt).pop();
      if (existing && formIsEditable(existing)) {
        d.formRequests[existing.id].sentTo = to;
        ctx.result.token = existing.token;
        ctx.result.link = formLink(existing.token);
        ctx.result.formId = existing.id;
        return;
      }
      if (existing?.status === 'submitted') ctx.fail('enq.err.formReady');
      if (existing?.status === 'approved' && i.target.type === 'enquiry') ctx.fail('enq.err.formApproved');
      let token = hash8(`${ctx.clubId}:${ctx.mutationId}:${i.target.type}:${i.target.id}`);
      for (let n = 1; live(s.formRequests).some((f) => f.token === token); n++) token = hash8(`${token}:${n}`);
      const base = `fr-${i.target.id}`;
      const id = d.formRequests[base] ? ctx.id('fr') : base;
      d.formRequests[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, token, target: i.target, sentTo: to, status: 'sent' };
      if (i.target.type === 'enquiry') d.enquiries[i.target.id].formToken = token;
      ctx.result.token = token;
      ctx.result.link = formLink(token);
      ctx.result.formId = id;
      ctx.feed({ icon: 'send', key: 'enq.feed.formSent', params: { name }, memberId });
    },
  }),
  defineAction<{ token: string }>({
    name: 'form.open',
    can: (u, i, s) => system(u) && !!formByToken(s, i.token),
    parse: (raw) => ({ token: str(obj(raw).token, 80, { required: true, field: 'token' }) }),
    run(d, i, ctx) {
      const f = formOr(d, ctx, { token: i.token });
      if (f.status === 'sent') f.status = 'opened';
    },
  }),
  defineAction<{ token: string; step: number; draft: Partial<MembershipForm> }>({
    name: 'form.saveDraft',
    can: (u, i, s) => system(u) && !!formByToken(s, i.token),
    parse(raw) {
      const o = obj(raw);
      return { token: str(o.token, 80, { required: true, field: 'token' }), step: int(o.step ?? 0, 0, 6, 'step'), draft: sanitizeForm(o.draft) };
    },
    run(d, i, ctx) {
      const f = formOr(d, ctx, { token: i.token });
      if (!formIsEditable(f as unknown as FormRequest)) ctx.fail('form.err.locked');
      f.draft = i.draft;
      f.step = i.step;
      f.status = 'draft';
    },
  }),
  defineAction<{ token: string; data: Partial<MembershipForm> }>({
    name: 'form.submit',
    can: (u, i, s) => system(u) && !!formByToken(s, i.token),
    parse(raw) {
      const o = obj(raw);
      return { token: str(o.token, 80, { required: true, field: 'token' }), data: sanitizeForm(o.data) };
    },
    run(d, i, ctx) {
      const s = S(d);
      const f = formOr(d, ctx, { token: i.token });
      if (!formIsEditable(f as unknown as FormRequest)) ctx.fail('form.err.locked');
      const errs = formErrors(i.data, ctx.today);
      if (errs.length) ctx.fail('form.err.' + errs[0].key, { step: errs[0].step });
      const data = completeForm(i.data, ctx.nowDT);
      f.data = data;
      f.status = 'submitted';
      f.submittedAt = ctx.nowDT;
      delete f.draft;
      delete f.step;
      delete f.returnNote;
      if (f.target.type === 'enquiry') {
        ctx.feed({ icon: 'assignment_turned_in', key: 'enq.feed.formSubmitted', params: { name: `${data.title} ${data.name}` } });
        return;
      }
      // an existing member's form: documents and consent change only once management approves
      const m = requireMember(d, f.target.id, ctx);
      const contact = Object.values(d.familyContacts).find((c) => !c.deletedAt && c.phone === f.sentTo) ?? primaryContact(s, m.id);
      const by: Actor = contact ? `family:${contact.id}` : 'system';
      const patch = formMemberPatch(m as unknown as Member, data, by, ctx.today, ctx.nowDT);
      for (const cr of Object.values(d.changeRequests)) if (cr.status === 'pending' && cr.action === 'form.applyMember' && (cr.input as { token?: string })?.token === i.token) cr.status = 'superseded';
      const crId = ctx.id('cr');
      d.changeRequests[crId] = {
        id: crId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: by, kind: 'approval', op: 'update', action: 'form.applyMember', input: { token: i.token }, section: 'docsConsent',
        target: { type: 'member', id: m.id, memberId: m.id },
        changes: [{ field: 'documents', from: JSON.parse(JSON.stringify(m.documents)), to: patch.documents }, { field: 'consents', from: JSON.parse(JSON.stringify(m.consents)), to: patch.consents }],
        status: 'pending', submittedBy: by,
      } as ChangeRequest;
      ctx.notify({ toRoles: ['mgmt'], kind: 'notif.reviewSubmitted', params: { who: data.contact.name, section: 'docsConsent' }, link: '/reviews', memberId: m.id, severity: 'attention', ref: { type: 'changeRequest', id: crId } });
      ctx.feed({ icon: 'assignment_turned_in', key: 'enq.feed.formSubmitted', params: { name: shortOf(d, m.id) }, memberId: m.id });
    },
  }),
  defineAction<{ formId: string }>({
    name: 'form.approve',
    can: (u) => lobbyOrMgmt(u),
    parse: (raw) => ({ formId: id60(obj(raw).formId, 'formId') }),
    run(d, i, ctx) {
      const f = formOr(d, ctx, { id: i.formId });
      const data = need(f.status === 'submitted' && f.data, ctx, 'enq.err.notReady');
      // a lead's form is approved by joining: the same step asks for the plan and the first day and creates the member (enquiry.convert), so there is no approved-but-not-a-member state
      if (f.target.type === 'enquiry') ctx.fail('enq.err.approveViaJoin');
      if (f.target.type === 'member') {
        if (!isMgmt(ctx.user)) ctx.fail('enq.err.inReviews');
        applyMemberForm(d, f as unknown as FormRequest, ctx, null);
        for (const cr of Object.values(d.changeRequests)) {
          if (cr.status === 'pending' && cr.action === 'form.applyMember' && (cr.input as { token?: string })?.token === f.token) {
            cr.status = 'approved';
            cr.reviewedBy = ctx.actor;
            cr.reviewedAt = ctx.nowDT;
          }
        }
      }
      f.status = 'approved';
      f.reviewedBy = ctx.actor;
      ctx.feed({ icon: 'task_alt', key: 'enq.feed.formApproved', params: { name: `${data.title} ${data.name}` }, memberId: f.target.type === 'member' ? f.target.id : undefined });
    },
  }),
  defineAction<{ formId: string; note: string }>({
    name: 'form.return',
    can: (u) => lobbyOrMgmt(u),
    parse(raw) {
      const o = obj(raw);
      return { formId: id60(o.formId, 'formId'), note: str(o.note, 500, { required: true, field: 'note' }) };
    },
    run(d, i, ctx) {
      const f = formOr(d, ctx, { id: i.formId });
      const data = need(f.status === 'submitted' && f.data, ctx, 'enq.err.notReady');
      const name = `${data.title} ${data.name}`;
      f.draft = data;
      f.step = 6;
      delete f.data;
      delete f.submittedAt;
      f.status = 'returned';
      f.returnNote = i.note;
      f.reviewedBy = ctx.actor;
      for (const cr of Object.values(d.changeRequests)) {
        if (cr.status === 'pending' && cr.action === 'form.applyMember' && (cr.input as { token?: string })?.token === f.token) {
          cr.status = 'withdrawn';
          cr.note = i.note;
        }
      }
      ctx.feed({ icon: 'undo', key: 'enq.feed.formReturned', params: { name }, memberId: f.target.type === 'member' ? f.target.id : undefined });
    },
  }),
  // Applies an existing member's submitted form to their record. Run by management's approval in Reviews.
  defineAction<{ token: string }>({
    name: 'form.applyMember',
    can: (u) => isMgmt(u),
    parse: (raw) => ({ token: str(obj(raw).token, 80, { required: true, field: 'token' }) }),
    run(d, i, ctx) {
      const f = formOr(d, ctx, { token: i.token });
      if (f.target.type !== 'member') ctx.fail('err.notFound');
      need(f.status === 'submitted' && f.data, ctx, 'enq.err.notReady');
      applyMemberForm(d, f as unknown as FormRequest, ctx, ctx.actor);
      f.status = 'approved';
      f.reviewedBy = actorOf(ctx.user);
    },
  }),

  // ---------- joining ----------
  defineAction<ConvertIn>({
    name: 'enquiry.convert',
    can: (u) => lobbyOrMgmt(u),
    review: {
      policy: 'gate',
      section: 'conversion',
      op: 'create',
      target: (i, s) => ({ type: 'enquiry', id: i.enquiryId, memberId: s.enquiries[i.enquiryId]?.memberId }),
    },
    parse(raw) {
      const o = obj(raw);
      const plan = oneOf(o.plan, ['flex', 'gold'] as const, 'plan');
      return { enquiryId: id60(o.enquiryId, 'enquiryId'), plan, start: isoDate(o.start, 'start') };
    },
    run(d, i, ctx) {
      const s = S(d);
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost' || e.archivedAt) ctx.fail('enq.err.notOpen');
      if (i.start < ctx.today) ctx.fail('enq.err.startPast');
      if (!dayStatus(s, i.start).open) ctx.fail('err.closedDay');
      const form = enquiryForm(s, e);
      const fd = form && (form.status === 'submitted' || form.status === 'approved') && form.data ? (form.data as MembershipForm) : null;
      const memberId = nextNumId(d.members, 'm');
      const num = Number(memberId.slice(1));
      const ph = e164(fd?.contact.phone || e.contact.phone);
      const existing: FamilyContact | undefined = live(s.familyContacts).find((c) => c.phone === ph);
      const contactId = existing?.id ?? `f${memberId}_0`;
      const gate = ctx.review === 'gate';
      d.members[memberId] = memberFromLead({
        id: memberId, contactId, enquiry: e as unknown as Enquiry, form: fd, plan: i.plan, start: i.start, today: ctx.today, nowDT: ctx.nowDT, actor: ctx.actor, vaIndex: num, photoTone: num % 5,
      });
      if (!existing) d.familyContacts[contactId] = contactFromLead({ id: contactId, enquiry: e as unknown as Enquiry, form: fd, nowDT: ctx.nowDT, actor: ctx.actor, activated: !gate });
      const link = linkFromLead({ contactId, memberId, enquiry: e as unknown as Enquiry, form: fd, nowDT: ctx.nowDT, actor: ctx.actor });
      d.familyLinks[link.id] = link;
      if (gate) {
        e.prevStage = e.stage;
        if (e.next) e.prevNext = JSON.parse(JSON.stringify(e.next));
      }
      e.stage = 'joined';
      e.memberId = memberId;
      e.next = { kind: 'starts', date: i.start };
      if (form && form.status === 'submitted') {
        d.formRequests[form.id].status = 'approved';
        d.formRequests[form.id].reviewedBy = ctx.actor;
      }
      ctx.result.memberId = memberId;
      ctx.result.familyId = contactId;
      ctx.feed({ icon: 'person_add', key: gate ? 'enq.feed.joinPending' : 'enq.feed.joined', params: { name: shortOf(d, memberId), plan: i.plan, date: dm(i.start) }, memberId });
      if (!gate) finishJoin(d, memberId, i, ctx);
    },
    afterApprove(d, cr, ctx) {
      const i = cr.input as ConvertIn;
      const memberId = cr.target.memberId || cr.createdRows?.find((r) => r.coll === 'members')?.id;
      if (!memberId) return;
      finishJoin(d, memberId, i, ctx);
      ctx.feed({ icon: 'person_add', key: 'enq.feed.joined', params: { name: shortOf(d, memberId), plan: i.plan, date: dm(i.start) }, memberId });
      const e = d.enquiries[i.enquiryId];
      if (e) { delete e.prevStage; delete e.prevNext; }
    },
    afterReject(d, cr, ctx) {
      const i = cr.input as ConvertIn;
      const e = d.enquiries[i.enquiryId];
      if (!e || e.stage !== 'joined') return;
      e.stage = e.prevStage ?? 'new';
      if (e.prevNext) e.next = e.prevNext;
      else delete e.next;
      delete e.memberId;
      delete e.prevStage;
      delete e.prevNext;
      // joining approved the family's form with it: the form goes back to "ready to review" so the lead is not left with an approved form and no member
      const forms = Object.values(d.formRequests).filter((x) => !x.deletedAt && x.target.type === 'enquiry' && x.target.id === e.id);
      const f = sortBy(forms, (x) => x.createdAt).pop();
      if (f && f.status === 'approved' && f.data) {
        f.status = 'submitted';
        delete f.reviewedBy;
      }
      ctx.feed({ icon: 'undo', key: 'enq.feed.joinRejected', params: { name: seniorName(e) } });
    },
  }),
];

/** Put a submitted form's documents and consent on the member's record. */
function applyMemberForm(d: Draft<ClubState>, f: FormRequest, ctx: Ctx, by: Actor | null) {
  const m = d.members[f.target.id];
  if (!m || m.deletedAt || !f.data) throw new DomainError('err.notFound');
  const contact = Object.values(d.familyContacts).find((c) => !c.deletedAt && c.phone === f.sentTo);
  const actor: Actor = by ?? (contact ? `family:${contact.id}` : 'system');
  const patch = formMemberPatch(m as unknown as Member, f.data, actor, ctx.today, ctx.nowDT);
  m.documents = patch.documents;
  m.consents = patch.consents;
}
