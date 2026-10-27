// Enquiries (leads), visits and trials, and joining a lead as a member.
// Registration is on paper: lobby and management type the key details in and attach the signed paper form (a photo or PDF uploaded to /api/media) when the lead joins.
import type { Draft } from 'immer';
import type { ClubState, DrugAllergy, Enquiry, LeadMove, FamilyContact, FoodAllergen, GuestVisit, OnlineRegistration, Plan, User } from '../types';
import { defineAction, hasRole, DomainError, type Ctx } from './framework';
import { familyUserIds, shortOf } from './helpers';
import { dayStatus, nextOpenDay } from '../rules/core';
import { FEE_DEFAULTS, priceOn } from '../rules/billing';
import {
  ALL_RELATIONS, DIETS, DRUGS, ENQ_SOURCES, FOODS, LOST_REASONS, MOBILITIES, bookingDayCheck, contactFromLead, linkFromLead, memberFromLead, seniorName, trialDays, type EnqStage, type LeadDetails,
} from '../rules/enquiries';
import { parseCarer, parseHealthBasics, parseKtp, parseRegistration, titleOf, txt } from './members';
import { cleanRegistration } from '../rules/applicationForm';
import { FORM_LINK_DAYS, FORM_STEPS, enquiryByFormToken, formRevOf, formPath, formTokenOf, formLinkState } from '../rules/enquiries';
import { arr, bool, dm, hm, isoDate, nextNumId, obj, oneOf, phone, str } from '../rules/mgmtParse';
import { e164, live, sortBy, addDays } from '../util';

const lobbyOrMgmt = (u: User) => hasRole(u, 'lobby', 'mgmt');
/** The public form routes run as the system user (no sign-in: the link is the key). */
const system = (u: User) => u.id === 'system';
const S = (d: Draft<ClubState>) => d as unknown as ClubState;
/** A half-filled form's carer picture and note, as far as they look right (the form's own save only checks the shape). */
const nannyExtras = (nn: Record<string, unknown>) => {
  const photo = txt(nn.photoMediaId, 80);
  const note = txt(nn.note, 200);
  return { ...(/^md_[A-Za-z0-9_-]{8,}$/.test(photo) ? { photoMediaId: photo } : {}), ...(note ? { note } : {}) };
};
const NEXT_KINDS = ['callBack', 'sendPrices', 'visit', 'trial', 'followUp', 'starts', 'custom'] as const;

// ---------- parsing ----------
const parseSenior = (v: unknown) => {
  const o = obj(v, 'senior');
  return { title: titleOf(o.title, 'enq.err.titleRequired'), name: str(o.name, 80, { required: true, field: 'senior.name' }) };
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
export interface ConvertIn extends LeadDetails { enquiryId: string; plan: Plan; start: string; formMediaId: string; formFileName: string }

/** After a lead becomes a member (immediately for management, on approval for lobby): welcome message, visits closed. Members come on any open day, so nothing is booked. */
function finishJoin(d: Draft<ClubState>, memberId: string, input: ConvertIn, ctx: Ctx) {
  if (!d.members[memberId]) return;
  cancelPendingGuests(d, input.enquiryId, ctx.today);
  ctx.notify({ toUsers: familyUserIds(d, memberId), kind: 'enq.notif.welcome', params: { name: shortOf(d, memberId), date: dm(input.start) }, link: '/today', memberId });
}

/** Append a move to the lead's history (a row from before round 13 gets its first `new` move filled in first). */
function pushMove(e: Draft<Enquiry>, ctx: Ctx, stage: LeadMove['stage'], extra: Partial<Omit<LeadMove, 'stage' | 'at' | 'by'>> = {}) {
  e.history ??= [{ stage: 'new', at: e.createdAt, by: e.createdBy }];
  e.history.push({ stage, at: ctx.nowDT, by: ctx.actor, ...extra });
}
/** A booking move: booking the same stage again (a new day or time) updates the lead's last move instead of adding a second one. */
function bookMove(e: Draft<Enquiry>, ctx: Ctx, stage: 'visit' | 'trial', date: string) {
  const last = e.history?.at(-1);
  if (last && !last.undo && last.stage === stage) Object.assign(last, { at: ctx.nowDT, by: ctx.actor, date });
  else pushMove(e, ctx, stage, { date });
}
const STAGE_RANK: Record<Enquiry['stage'], number> = { new: 0, visit: 1, trial: 2, joined: 3, lost: 4 };

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
        history: [{ stage: 'new', at: ctx.nowDT, by: ctx.actor }],
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
      pushMove(e, ctx, i.stage, STAGE_RANK[i.stage] < STAGE_RANK[e.stage] ? { undo: true } : {});
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
      bookMove(e, ctx, 'visit', i.date);
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
      bookMove(e, ctx, 'trial', day1);
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
      pushMove(e, ctx, 'lost', { reason: i.reason, ...(i.note ? { note: i.note } : {}) });
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
      pushMove(e, ctx, e.stage, { undo: true });
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
        ...(o.nanny !== undefined ? { nanny: parseCarer(o.nanny) as OnlineRegistration['nanny'] } : {}),
        ...(o.ktp !== undefined ? { ktp: parseKtp(o.ktp) } : {}),
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
        form: { mediaId: i.formMediaId, fileName: i.formFileName }, details: { dob: i.dob, address: i.address, health: i.health, registration: i.registration, nanny: i.nanny, ktp: i.ktp },
      });
      if (!existing) d.familyContacts[contactId] = contactFromLead({ id: contactId, enquiry: e as unknown as Enquiry, nowDT: ctx.nowDT, actor: ctx.actor, activated: !gate });
      const link = linkFromLead({ contactId, memberId, enquiry: e as unknown as Enquiry, nowDT: ctx.nowDT, actor: ctx.actor });
      d.familyLinks[link.id] = link;
      if (gate) {
        e.prevStage = e.stage;
        if (e.next) e.prevNext = JSON.parse(JSON.stringify(e.next));
      }
      pushMove(e, ctx, 'joined');
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
      pushMove(e, ctx, e.stage, { undo: true });
      if (e.prevNext) e.next = e.prevNext;
      else delete e.next;
      delete e.memberId;
      delete e.prevStage;
      delete e.prevNext;
      ctx.feed({ icon: 'undo', key: 'enq.feed.joinRejected', params: { name: seniorName(e) } });
    },
  }),

  // ---------- KC round 10: the online registration link (a pre-fill for the paper form) ----------
  defineAction<{ enquiryId: string }>({
    name: 'enquiry.sendForm',
    can: (u) => lobbyOrMgmt(u),
    parse: (raw) => ({ enquiryId: id60(obj(raw).enquiryId, 'enquiryId') }),
    run(d, i, ctx) {
      const e = enq(d, i.enquiryId, ctx);
      if (e.stage === 'joined') ctx.fail('enq.err.alreadyMember');
      if (e.stage === 'lost' || e.archivedAt) ctx.fail('enq.err.notOpen');
      const state = formLinkState(e.form, ctx.nowDT);
      if (state === 'submitted') ctx.fail('enq.err.formDone');
      const expiresAt = `${addDays(ctx.today, FORM_LINK_DAYS)}T${ctx.now}`;
      if (e.form && state !== 'expired') {
        e.form.expiresAt = expiresAt; // sending again keeps the same link alive
      } else {
        let token = formTokenOf(`${ctx.clubId}|${e.id}|${ctx.mutationId}`);
        for (let n = 1; enquiryByFormToken(S(d), token); n++) token = formTokenOf(`${token}|${n}`);
        const old = e.form;
        e.form = { token, sentAt: ctx.nowDT, sentBy: ctx.actor, expiresAt };
        // an expired link's half-filled draft moves to the new link (a submitted one never gets here)
        if (old?.draft && old.savedAt) Object.assign(e.form, { draft: JSON.parse(JSON.stringify(old.draft)), step: old.step, savedAt: old.savedAt, rev: formRevOf(old) });
      }
      ctx.result.token = e.form.token;
      ctx.result.path = formPath(e.form.token);
      ctx.feed({ icon: 'send', key: 'enq.feed.formSent', params: { name: seniorName(e) } });
    },
  }),
  defineAction<{ token: string }>({
    name: 'enquiry.formOpen',
    can: (u, i, s) => system(u) && !!enquiryByFormToken(s, i.token),
    parse: (raw) => ({ token: str(obj(raw).token, 80, { required: true, field: 'token' }) }),
    run(d, i, ctx) {
      const e = enquiryByFormToken(S(d), i.token);
      if (!e) return ctx.fail('err.notFound');
      const f = d.enquiries[e.id].form!;
      if (formLinkState(f, ctx.nowDT) === 'sent') f.openedAt = ctx.nowDT;
    },
  }),
  // round 13 (KC): the family's half-filled form is saved through the link, so reopening it on any phone continues where they left off.
  // The answers are only checked for shape (a postcode half typed is fine); formSubmit still checks everything.
  defineAction<{ token: string; step: number; expect: number | null; draft: Partial<OnlineRegistration> }>({
    name: 'enquiry.formSave',
    can: (u, i, s) => system(u) && !!enquiryByFormToken(s, i.token),
    parse(raw) {
      const o = obj(raw);
      const dr = obj(o.draft, 'draft');
      const c = dr.contact === undefined ? {} : obj(dr.contact, 'contact');
      const h = dr.health === undefined || typeof dr.health !== 'object' ? undefined : parseHealthBasics(dr.health);
      const registration = dr.registration !== null && typeof dr.registration === 'object' ? cleanRegistration(dr.registration) : undefined;
      const nn = dr.nanny !== null && typeof dr.nanny === 'object' ? (dr.nanny as Record<string, unknown>) : null;
      const rawPhone = txt(c.phone, 40);
      const step = typeof o.step === 'number' && Number.isFinite(o.step) ? Math.min(FORM_STEPS, Math.max(1, Math.round(o.step))) : 1;
      return {
        token: str(o.token, 80, { required: true, field: 'token' }),
        step,
        expect: typeof o.expect === 'number' && Number.isInteger(o.expect) && o.expect > 0 ? o.expect : null, // the save counter this page last saw (null = it has seen none)
        draft: {
          ...(typeof dr.title === 'string' ? { title: txt(dr.title, 20) } : {}), ...(dr.name !== undefined ? { name: txt(dr.name, 80) } : {}),
          ...(typeof dr.dob === 'string' ? { dob: /^\d{4}-\d{2}-\d{2}$/.test(dr.dob) ? dr.dob : '' } : {}), ...(dr.address !== undefined ? { address: txt(dr.address, 200) } : {}),
          ...(dr.contact !== undefined ? { contact: { name: txt(c.name, 80), relation: ALL_RELATIONS.includes(c.relation as never) ? (c.relation as (typeof ALL_RELATIONS)[number]) : 'daughter', phone: rawPhone.replace(/\D/g, '').length >= 8 ? e164(rawPhone) : rawPhone } } : {}),
          ...(dr.plan === 'flex' || dr.plan === 'gold' ? { plan: dr.plan as Plan } : {}),
          ...(dr.nanny !== undefined ? { nanny: nn ? { name: txt(nn.name, 80), nik: txt(nn.nik, 24).replace(/\s/g, ''), ...nannyExtras(nn) } : null } : {}),
          ...(dr.ktp !== undefined && dr.ktp !== null ? { ktp: parseKtp(dr.ktp) } : {}), ...(h ? { health: h } : {}), ...(registration ? { registration } : {}),
          ...(dr.lang === 'id' || dr.lang === 'en' ? { lang: dr.lang } : {}),
        },
      };
    },
    run(d, i, ctx) {
      const e = enquiryByFormToken(S(d), i.token);
      if (!e) return ctx.fail('err.notFound');
      const row = d.enquiries[e.id];
      const state = formLinkState(row.form, ctx.nowDT);
      if (state === 'expired') ctx.fail('enq.err.formExpired');
      if (state === 'submitted') ctx.fail('enq.err.formDone');
      if (row.stage === 'joined' || row.stage === 'lost' || row.archivedAt) ctx.fail('enq.err.notOpen');
      const f = row.form!;
      const first = !f.savedAt;
      // the page sends the whole draft each time (so a cleared answer stays cleared); what it leaves out starts from the lead as the front desk typed it
      const next: OnlineRegistration = {
        title: row.senior.title, name: row.senior.name, dob: '', address: '', contact: { ...row.contact }, health: { conditions: [], diabetic: false, food: [], foodOther: '', drugs: [], mobility: null, diet: [] }, lang: 'en',
        ...i.draft,
      };
      const cur = formRevOf(f);
      ctx.result.draftRev = cur;
      ctx.result.savedAt = f.savedAt ?? null;
      if (f.draft && !first && f.step === i.step && JSON.stringify(f.draft) === JSON.stringify(next)) return; // nothing new: no write, no bump
      if (cur !== (i.expect ?? 0)) ctx.fail('enq.err.formConflict'); // saved from another phone since this page last looked: never overwrite unseen answers
      f.draft = next;
      f.step = i.step;
      f.savedAt = ctx.nowDT;
      f.rev = cur + 1;
      f.openedAt ??= ctx.nowDT;
      ctx.result.savedAt = ctx.nowDT;
      ctx.result.draftRev = cur + 1;
      if (first) ctx.feed({ icon: 'edit_note', key: 'enq.feed.formSaved', params: { name: seniorName(row) } });
    },
  }),
  defineAction<{ token: string; draft: OnlineRegistration }>({
    name: 'enquiry.formSubmit',
    can: (u, i, s) => system(u) && !!enquiryByFormToken(s, i.token),
    parse(raw) {
      const o = obj(raw);
      const dr = obj(o.draft, 'draft');
      const c = obj(dr.contact, 'contact');
      const h = parseHealthBasics(dr.health);
      const registration = parseRegistration(dr.registration);
      const plan = dr.plan ? oneOf(dr.plan, ['flex', 'gold'] as const, 'plan') : undefined;
      return {
        token: str(o.token, 80, { required: true, field: 'token' }),
        draft: {
          title: titleOf(dr.title, 'enq.err.titleRequired'), name: str(dr.name, 80, { required: true, field: 'name' }), dob: dr.dob ? isoDate(dr.dob, 'dob') : '', address: str(dr.address, 200),
          contact: { name: str(c.name, 80, { required: true, field: 'contact.name' }), relation: oneOf(c.relation, ALL_RELATIONS, 'contact.relation'), phone: phone(c.phone, 'contact.phone') },
          ...(plan ? { plan } : {}), ...(dr.nanny !== undefined ? { nanny: parseCarer(dr.nanny) as OnlineRegistration['nanny'] } : {}), ...(dr.ktp !== undefined ? { ktp: parseKtp(dr.ktp) } : {}), health: h, ...(registration ? { registration } : {}), lang: oneOf(dr.lang ?? 'en', ['en', 'id'] as const, 'lang'),
        },
      };
    },
    run(d, i, ctx) {
      const e = enquiryByFormToken(S(d), i.token);
      if (!e) return ctx.fail('err.notFound');
      const row = d.enquiries[e.id];
      const state = formLinkState(row.form, ctx.nowDT);
      if (state === 'expired') ctx.fail('enq.err.formExpired');
      if (state === 'submitted') ctx.fail('enq.err.formDone');
      if (row.stage === 'joined' || row.stage === 'lost' || row.archivedAt) ctx.fail('enq.err.notOpen');
      if (i.draft.dob && i.draft.dob > ctx.today) ctx.fail('members.err.dobInvalid');
      const f = row.form!;
      f.draft = i.draft;
      f.submittedAt = ctx.nowDT;
      f.filledBy = i.draft.contact.name;
      f.openedAt ??= ctx.nowDT;
      ctx.feed({ icon: 'assignment_turned_in', key: 'enq.feed.formSubmitted', params: { name: seniorName(row) } });
      ctx.notify({ toRoles: ['lobby', 'mgmt'], kind: 'enq.notif.formSubmitted', params: { name: seniorName(row), by: i.draft.contact.name }, link: `/enquiries?e=${row.id}` });
    },
  }),
];
