// Enquiries (leads), visits and trials, and joining a lead as a member.
// Registration is on paper: lobby and management type the key details in and attach the signed paper form (a photo or PDF uploaded to /api/media) when the lead joins.
import type { Draft } from 'immer';
import type { ClubState, DrugAllergy, Enquiry, FamilyContact, FoodAllergen, GuestVisit, Plan, User } from '../types';
import { defineAction, hasRole, DomainError, type Ctx } from './framework';
import { familyUserIds, shortOf } from './helpers';
import { dayStatus, nextOpenDay } from '../rules/core';
import { FEE_DEFAULTS, priceOn } from '../rules/billing';
import {
  ALL_RELATIONS, DIETS, DRUGS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, TITLES, bookingDayCheck, contactFromLead, linkFromLead, memberFromLead, seniorName, trialDays, type EnqStage, type LeadDetails,
} from '../rules/enquiries';
import { parseHealthBasics, parseRegistration } from './members';
import { arr, bool, dm, hm, isoDate, nextNumId, obj, oneOf, phone, str } from '../rules/mgmtParse';
import { e164, live, sortBy } from '../util';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
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
/** The second day of a trial (a trial is 2 consecutive days): a copy of the first day's row on the next open day, kept in step with it. */
function upsertSecondDay(d: Draft<ClubState>, first: Draft<GuestVisit>, date: string) {
  const id = `${first.id}-2`;
  const row = d.guestVisits[id];
  if (!row || row.deletedAt || row.checkIn || row.status !== 'booked') {
    d.guestVisits[id] = { ...JSON.parse(JSON.stringify(first)), id, date, status: 'booked' };
    delete d.guestVisits[id].checkIn; delete d.guestVisits[id].checkOut;
  } else Object.assign(row, JSON.parse(JSON.stringify(first)), { id, date, status: 'booked' });
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
/** `formMediaId` and `formFileName`: the signed paper registration form, uploaded first (POST /api/media). */
interface ConvertIn extends LeadDetails { enquiryId: string; plan: Plan; start: string; formMediaId: string; formFileName: string }

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
      // the brochure's trial: 2 consecutive open days (day 1 is the row the lead keeps; day 2 follows it)
      const [day1, day2] = trialDays(S(d), i.date);
      const g1 = upsertGuest(d, ctx, e, 'trial', { date: day1, food: i.food, drugs: i.drugs, mobility: i.mobility, diet: i.diet });
      upsertSecondDay(d, g1, day2);
      e.stage = 'trial';
      e.next = { kind: 'trial', date: day1 };
      const name = seniorName(e);
      const days = `${dm(day1)} + ${dm(day2)}`;
      ctx.result.days = [day1, day2];
      ctx.result.price = priceOn(S(d), day1).trial ?? FEE_DEFAULTS.trial;
      ctx.feed({ icon: 'waving_hand', key: 'enq.feed.trialBooked', params: { name, date: days } });
      const kind = i.food === null ? 'enq.notif.trialLunchUnknown' : i.food.length ? 'enq.notif.trialLunchAllergy' : 'enq.notif.trialLunch';
      ctx.notify({ toRoles: ['kitchen'], kind, params: { name, date: days }, link: '/today', severity: kind === 'enq.notif.trialLunch' ? 'info' : 'attention' });
      ctx.notify({ toRoles: ['nurse'], kind: 'enq.notif.trialHealth', params: { name, date: days }, link: '/today' });
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
      const mediaId = typeof o.formMediaId === 'string' ? o.formMediaId.trim() : '';
      if (!mediaId) throw new DomainError('enq.err.formRequired');
      if (!/^md_[A-Za-z0-9_-]{8,}$/.test(mediaId)) throw new DomainError('err.invalid');
      // KC round 6: the application form's answers, typed in when joining (optional), so the printed form and the profile have them
      const dob = o.dob ? isoDate(o.dob, 'dob') : '';
      const address = str(o.address, 200);
      const registration = parseRegistration(o.registration);
      return {
        enquiryId: id60(o.enquiryId, 'enquiryId'), plan, start: isoDate(o.start, 'start'), formMediaId: mediaId, formFileName: str(o.formFileName, 120) || 'registration-form',
        ...(dob ? { dob } : {}), ...(address ? { address } : {}), ...(o.health !== undefined ? { health: parseHealthBasics(o.health) } : {}), ...(registration ? { registration } : {}),
      };
    },
    run(d, i, ctx) {
      const s = S(d);
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost' || e.archivedAt) ctx.fail('enq.err.notOpen');
      if (i.start < ctx.today) ctx.fail('enq.err.startPast');
      if (!dayStatus(s, i.start).open) ctx.fail('err.closedDay');
      if (i.dob && i.dob > ctx.today) ctx.fail('members.err.dobInvalid');
      const memberId = nextNumId(d.members, 'm');
      const num = Number(memberId.slice(1));
      const ph = e164(e.contact.phone);
      const existing: FamilyContact | undefined = live(s.familyContacts).find((c) => c.phone === ph);
      const contactId = existing?.id ?? `f${memberId}_0`;
      const gate = ctx.review === 'gate';
      d.members[memberId] = memberFromLead({
        id: memberId, contactId, enquiry: e as unknown as Enquiry, plan: i.plan, start: i.start, today: ctx.today, nowDT: ctx.nowDT, actor: ctx.actor, vaIndex: num, photoTone: num % 5,
        form: { mediaId: i.formMediaId, fileName: i.formFileName }, details: { dob: i.dob, address: i.address, health: i.health, registration: i.registration },
      });
      if (!existing) d.familyContacts[contactId] = contactFromLead({ id: contactId, enquiry: e as unknown as Enquiry, nowDT: ctx.nowDT, actor: ctx.actor, activated: !gate });
      const link = linkFromLead({ contactId, memberId, enquiry: e as unknown as Enquiry, nowDT: ctx.nowDT, actor: ctx.actor });
      d.familyLinks[link.id] = link;
      if (gate) {
        e.prevStage = e.stage;
        if (e.next) e.prevNext = JSON.parse(JSON.stringify(e.next));
      }
      e.stage = 'joined';
      e.memberId = memberId;
      e.next = { kind: 'starts', date: i.start };
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
      ctx.feed({ icon: 'undo', key: 'enq.feed.joinRejected', params: { name: seniorName(e) } });
    },
  }),
];
