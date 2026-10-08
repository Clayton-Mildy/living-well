// Members actions: create (gated), details/documents/consent/plan (gated), health (applied now, reviewed after),
// requests, notes, ending and reactivating a membership. Management is never gated.
// Review policy: gate = waits for management; flag = applies now, reviewed afterwards; management always applies at once.
import type { Draft } from 'immer';
import type {
  Actor, ChangeRequest, ClubState, DocType, Diet, DrugAllergy, FoodAllergen, ISODate, HM, Invoice, Member, MemberDocument, Medicine, MedTiming, Mobility, Plan,
  PlanEntry, ReviewSection, Title, EndReason, Consent, MemberRegistration,
} from '../types';
import { e164, toMin } from '../util';
import { defineAction, hasRole, isMgmt, actorOf, DomainError, type ActionDef, type Ctx } from './framework';
import { requireMember, shortOf, familyUserIds } from './helpers';
import { clearApproval, markPending, needsApproval, priorOf } from './approvalGate';
import { NOTE_KEYS } from '../rules/approvals';
import { currentMembership, isOpen, isPendingRow, membershipStatus, memberShort, nextOpenDay, planOn, primaryContact, actorName } from '../rules/core';
import { paidOn } from '../rules/billing';
import { cleanRegistration, validateRegistration } from '../rules/applicationForm';
import {
  DEFAULT_SIM, DIETS, DOC_TYPES, END_REASONS, FOODS, MED_TIMINGS, MOBILITIES, RELATIONS, SIM_FILE, TITLES, docIdFor,
  finalInvoiceFor, firstOfNextMonth, firstWord, genderOf, isHM, isISO, nextContactId, nextMemberId, lastMemberId, nextMemberNumber, splitName,
  validateNewMember, vaFor, consentOf, type NewMemberInput,
} from '../rules/members';
import type { LeadHealth } from '../rules/enquiries';

// ---------- shared helpers (family.ts reuses them) ----------
const bad = (code: string, params?: Record<string, string | number>): never => { throw new DomainError(code, params); };
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : bad('err.invalid'));
export const txt = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const oneOf = <T extends string>(v: unknown, list: readonly T[], code = 'err.invalid'): T => ((list as readonly string[]).includes(v as string) ? (v as T) : bad(code));
const strList = (v: unknown, max = 120, cap = 30): string[] => (Array.isArray(v) ? v.map((x) => txt(x, max)).filter(Boolean).slice(0, cap) : []);
const enumList = <T extends string>(v: unknown, list: readonly T[]): T[] => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is T => (list as readonly string[]).includes(x as string)))) : []);
/** dd/mm/yyyy: the same in English and Indonesian, safe inside stored notification text. */
export const dmy = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const staffIdOf = (a: Actor) => (a.startsWith('staff:') ? a.slice(6) : '');
/** Full name of an actor (consent records keep who and when). */
export const fullNameOf = (d: Draft<ClubState> | ClubState, a: Actor): string => {
  if (a.startsWith('staff:')) return d.staff[a.slice(6)]?.name || a;
  if (a.startsWith('family:')) return d.familyContacts[a.slice(7)]?.name || a;
  return actorName(d as ClubState, a);
};
const optionalNote = (raw: Record<string, unknown>) => { const n = txt(raw.note, 400); return n ? { note: n } : {}; };

const mgmtOnly = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'mgmt');
const frontDesk = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'mgmt');
const planPeople = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'finance', 'mgmt');
const clinical = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'nurse', 'mgmt');

/** A member that can be edited: exists, approved and not ended. */
export function editable(d: Draft<ClubState>, id: string, ctx: Ctx): Draft<Member> {
  const m = requireMember(d, id, ctx);
  if (isPendingRow(m)) ctx.fail('err.memberPending');
  if (membershipStatus(m, ctx.today) === 'ended') ctx.fail('members.err.memberEnded');
  return m;
}
const feed = (ctx: Ctx, d: Draft<ClubState>, memberId: string, icon: string, key: string, extra: Record<string, string | number> = {}) =>
  ctx.feed({ icon, key: `members.feed.${key}`, params: { name: shortOf(d, memberId), ...extra }, memberId });

/** Spouse is two-way: setting one side sets the other and clears any earlier partner. */
export function setSpouse(d: Draft<ClubState>, memberId: string, spouseId: string | null) {
  const m = d.members[memberId];
  const old = m.spouseId;
  if (old && old !== spouseId && d.members[old]?.spouseId === memberId) d.members[old].spouseId = null;
  if (spouseId) {
    const sp = d.members[spouseId];
    const sp2 = sp.spouseId;
    if (sp2 && sp2 !== memberId && d.members[sp2]?.spouseId === spouseId) d.members[sp2].spouseId = null;
    sp.spouseId = memberId;
  }
  m.spouseId = spouseId;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Make one link the member's primary billing contact; every other link of that member loses the flag. */
export function makePrimary(d: Draft<ClubState>, memberId: string, linkIdKept: string) {
  for (const l of Object.values(d.familyLinks)) if (l.memberId === memberId && !l.deletedAt) l.primary = l.id === linkIdKept;
}
/** Is a phone already used by a live contact or a staff member? */
export function phoneTaken(d: Draft<ClubState> | ClubState, phone: string, exceptContactId?: string) {
  return Object.values(d.familyContacts).some((c) => !c.deletedAt && c.id !== exceptContactId && c.phone === phone) || Object.values(d.staff).some((x) => !x.deletedAt && x.phone === phone);
}

/** Management-side review for actions the framework cannot diff (the change lands on another row): hold the request until approved. */
function holdForReview(d: Draft<ClubState>, ctx: Ctx, spec: { action: string; input: unknown; section: ReviewSection; target: ChangeRequest['target'] }): boolean {
  if (isMgmt(ctx.user) || ctx.actor !== actorOf(ctx.user)) return false; // management, or the approval replay
  for (const c of Object.values(d.changeRequests)) if (c.status === 'pending' && c.section === spec.section && c.target.id === spec.target.id && c.submittedBy === ctx.actor) c.status = 'superseded';
  const crId = ctx.id('cr');
  d.changeRequests[crId] = { id: crId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: 'approval', op: 'update', action: spec.action, input: spec.input, section: spec.section, target: spec.target, changes: [], status: 'pending', submittedBy: ctx.actor } as ChangeRequest;
  ctx.notify({ toRoles: ['mgmt'], kind: 'notif.reviewSubmitted', params: { who: actorName(d as ClubState, ctx.actor), section: spec.section }, link: '/reviews', memberId: spec.target.memberId, severity: 'attention', ref: { type: 'changeRequest', id: crId } });
  ctx.result.changeRequestId = crId;
  ctx.result.held = true;
  return true;
}

/** Everything that happens once a new member is approved (or created by management): contact access, spouse link, welcome. Members drop in, so nothing is booked. */
export function activateMember(d: Draft<ClubState>, memberId: string, ctx: Ctx) {
  const m = d.members[memberId];
  if (!m) return;
  for (const l of Object.values(d.familyLinks)) {
    if (l.memberId !== memberId || l.deletedAt) continue;
    const c = d.familyContacts[l.familyId];
    if (c && !c.activatedAt && l.appAccess) c.activatedAt = ctx.nowDT;
  }
  if (m.spouseId && d.members[m.spouseId] && !d.members[m.spouseId].spouseId) d.members[m.spouseId].spouseId = memberId;
  const start = currentMembership(m).start;
  const to = familyUserIds(d, memberId);
  if (to.length) ctx.notify({ toUsers: to, kind: 'members.notif.welcome', params: { name: memberShort(m), date: dmy(start) }, link: '/today', memberId });
}

// ---------- parse: add member ----------
const parseNanny = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const o = obj(v);
  const name = txt(o.name, 80);
  if (!name) bad('members.err.nannyNameRequired');
  const phone = txt(o.phone, 30);
  return { name, ...(phone ? { phone: e164(phone) } : {}) };
};
const parseDrugs = (v: unknown): DrugAllergy[] => {
  const out: DrugAllergy[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    if (typeof x !== 'string') continue;
    if (['penicillin', 'sulfa', 'aspirin', 'ibuprofen'].includes(x) && !out.includes(x as DrugAllergy)) out.push(x as DrugAllergy);
    else if (x.startsWith('other:') && x.slice(6).trim() && !out.includes(`other:${x.slice(6).trim().slice(0, 60)}`)) out.push(`other:${x.slice(6).trim().slice(0, 60)}` as DrugAllergy);
  }
  return out;
};
const parseMeds = (v: unknown): { id?: string; name: string; dose: string; timing: MedTiming; note?: string }[] =>
  (Array.isArray(v) ? v : []).slice(0, 30).map((x) => {
    const o = obj(x);
    const name = txt(o.name, 80);
    if (!name) bad('members.err.medNameRequired');
    return { ...(typeof o.id === 'string' && o.id ? { id: o.id } : {}), name, dose: txt(o.dose, 60), timing: MED_TIMINGS.includes(o.timing as MedTiming) ? (o.timing as MedTiming) : 'asPrescribed', ...(txt(o.note, 160) ? { note: txt(o.note, 160) } : {}) };
  });

/** Conditions, allergies, mobility and diet as Add member sends them (no medicines): also used when a lead joins. */
export function parseHealthBasics(v: unknown): LeadHealth {
  const h = obj(v ?? {});
  return {
    conditions: strList(h.conditions), diabetic: !!h.diabetic, food: enumList(h.food, FOODS), foodOther: txt(h.foodOther, 80), drugs: parseDrugs(h.drugs),
    mobility: MOBILITIES.includes(h.mobility as Mobility) ? (h.mobility as Mobility) : null, diet: enumList(h.diet, DIETS),
  };
}

/** The new-member input plus the extra answers of the paper application form (Panggilan, RT/RW, phones, the care questions, the ID ticks). */
export type NewMemberFull = NewMemberInput & { registration?: MemberRegistration };
/** The answers of the application form, cleaned and checked; undefined when none were given. */
export function parseRegistration(v: unknown): MemberRegistration | undefined {
  const reg = cleanRegistration(v);
  const issues = validateRegistration(reg);
  if (issues.length) bad(issues[0].code, issues[0].params);
  return reg;
}

function parseNewMember(raw: unknown): NewMemberFull {
  const o = obj(raw);
  const h = obj(o.health ?? {});
  const c = obj(o.contact ?? {});
  const cons = obj(o.consent ?? {});
  const plan: Plan = o.plan === 'gold' ? 'gold' : 'flex';
  const photo = mediaIdOf(o.photoMediaId);
  const registration = parseRegistration(o.registration);
  const input: NewMemberFull = {
    ...(photo ? { photoMediaId: photo } : {}),
    title: oneOf(o.title, TITLES),
    name: txt(o.name, 80),
    dob: txt(o.dob, 10),
    address: txt(o.address, 200),
    usualArrival: txt(o.usualArrival, 5),
    nanny: parseNanny(o.nanny),
    spouseId: typeof o.spouseId === 'string' && o.spouseId ? o.spouseId : null,
    plan,
    start: txt(o.start, 10),
    contact: { ...(typeof c.existingId === 'string' && c.existingId ? { existingId: c.existingId } : {}), name: txt(c.name, 80), phone: c.phone ? e164(txt(c.phone, 30)) : '', relation: oneOf(c.relation ?? 'daughter', RELATIONS), primary: c.primary !== false },
    health: {
      conditions: strList(h.conditions), diabetic: !!h.diabetic, food: enumList(h.food, FOODS), foodOther: txt(h.foodOther, 80), drugs: parseDrugs(h.drugs),
      mobility: MOBILITIES.includes(h.mobility as Mobility) ? (h.mobility as Mobility) : null, diet: enumList(h.diet, DIETS), meds: parseMeds(h.meds).map(({ name, dose, timing }) => ({ name, dose, timing })),
    },
    careInstructions: txt(o.careInstructions, 1000),
    docs: enumList(o.docs, DOC_TYPES).filter((x) => x !== 'membershipForm'), // the signed registration form is attached below, never just ticked
    formMediaId: mediaIdOf(o.formMediaId) ?? '',
    formFileName: txt(o.formFileName, 120) || 'registration-form',
    consent: { data: cons.data === true, face: cons.face !== false },
    ...(registration ? { registration } : {}),
    ...optionalNote(o),
  };
  const issues = validateNewMember(input); // clock-dependent checks run in `run`
  if (issues.length) bad(issues[0].code, issues[0].params);
  return input;
}

/** An uploaded media id (`md_…` from POST /api/media), or undefined when none was given. */
export function mediaIdOf(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const id = txt(v, 80);
  if (!/^md_[A-Za-z0-9_-]{8,}$/.test(id)) bad('err.invalid');
  return id;
}

// ---------- parse: details patch ----------
export interface DetailsPatch {
  title?: Title; name?: string; dob?: ISODate; address?: string; /** '' clears it */ usualArrival?: HM | ''; nanny?: { name: string; phone?: string } | null; spouseId?: string | null;
  /** the profile picture; null removes it */ photoMediaId?: string | null;
  /** the answers of the paper application form, all of them as they should be now; null clears them */ registration?: MemberRegistration | null;
}
function parseDetailsPatch(raw: unknown): DetailsPatch {
  const p = obj(raw);
  const out: DetailsPatch = {};
  if (p.title !== undefined) out.title = oneOf(p.title, TITLES);
  if (p.name !== undefined) { const n = txt(p.name, 80); if (n.length < 2) bad('members.err.nameRequired'); out.name = n; }
  if (p.dob !== undefined) { const v = txt(p.dob, 10); if (!isISO(v)) bad('members.err.dobInvalid'); out.dob = v; }
  if (p.address !== undefined) out.address = txt(p.address, 200);
  if (p.usualArrival !== undefined) { const v = txt(p.usualArrival, 5); if (v && !isHM(v)) bad('members.err.arrivalInvalid'); out.usualArrival = v; }
  if (p.nanny !== undefined) out.nanny = parseNanny(p.nanny);
  if (p.spouseId !== undefined) out.spouseId = p.spouseId === null || p.spouseId === '' ? null : txt(p.spouseId, 60);
  if (p.photoMediaId !== undefined) out.photoMediaId = mediaIdOf(p.photoMediaId) ?? null;
  if (p.registration !== undefined) out.registration = p.registration === null ? null : (parseRegistration(p.registration) ?? null);
  return out;
}
/** Arrival time must fall inside the club's opening hours. */
function checkArrival(d: Draft<ClubState>, hm: HM, ctx: Ctx) {
  const { open, close } = d.club.settings;
  if (toMin(hm) < toMin(open) || toMin(hm) >= toMin(close)) ctx.fail('members.err.arrivalHours', { open, close });
}
function newMemberId(d: Draft<ClubState>) { return nextMemberId(d); }

// ---------- actions ----------
const target = (memberId: string) => ({ type: 'member' as const, id: memberId, memberId });

export const membersActions: ActionDef[] = [
  // ----- create -----
  defineAction<NewMemberFull>({
    name: 'members.create',
    can: (u) => frontDesk(u),
    parse: (raw) => parseNewMember(raw),
    review: { policy: 'gate', section: 'newMember', op: 'create', target: (_i, s) => { const id = lastMemberId(s); return { type: 'member', id, memberId: id }; } },
    run(d, input, ctx) {
      const issues = validateNewMember(input, ctx.today);
      if (issues.length) ctx.fail(issues[0].code, issues[0].params);
      if (input.usualArrival) checkArrival(d, input.usualArrival, ctx);
      if (!isOpen(d as unknown as ClubState, input.start)) ctx.fail('err.closedDay');
      if (input.spouseId && (!d.members[input.spouseId] || d.members[input.spouseId].deletedAt || isPendingRow(d.members[input.spouseId]))) ctx.fail('members.err.spouseInvalid');
      const id = newMemberId(d);
      const num = nextMemberNumber(d);
      const { firstName, lastName } = splitName(input.name);
      // contact: link an existing one, or create a new one (phone must be unused)
      let familyId = input.contact.existingId || '';
      if (familyId) {
        const ex = d.familyContacts[familyId];
        if (!ex || ex.deletedAt || isPendingRow(ex)) ctx.fail('members.err.contactNotFound');
      } else {
        const phone = e164(input.contact.phone);
        if (phoneTaken(d, phone)) ctx.fail('members.err.phoneInUse');
        familyId = nextContactId(d, id);
        d.familyContacts[familyId] = { id: familyId, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.contact.name, firstName: firstWord(input.contact.name), phone };
      }
      const lid = `${familyId}:${id}`;
      d.familyLinks[lid] = { id: lid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, familyId, memberId: id, relation: input.contact.relation, primary: input.contact.primary, appAccess: true, healthAlerts: true };
      const byName = fullNameOf(d, ctx.actor);
      const consents: Consent[] = [
        { kind: 'data', granted: true, by: ctx.actor, byName, at: ctx.nowDT, via: 'staff' },
        { kind: 'face', granted: input.consent.face, by: ctx.actor, byName, at: ctx.nowDT, via: 'staff' },
      ];
      const documents: MemberDocument[] = input.docs.filter((t) => t !== 'nannyKtp' || input.nanny).map((type) => ({ id: docIdFor(id, type), type, status: 'onFile', fileName: SIM_FILE[type], on: ctx.today, via: 'staff', by: ctx.actor }));
      // the signed paper registration form: the uploaded photo or PDF
      documents.push({ id: docIdFor(id, 'membershipForm'), type: 'membershipForm', status: 'onFile', mediaId: input.formMediaId, fileName: input.formFileName, on: ctx.today, via: 'staff', by: ctx.actor });
      d.members[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, title: input.title, firstName, lastName, gender: genderOf(input.title), dob: input.dob, ageYears: null,
        address: input.address || null, photoTone: (num - 1) % 5, ...(input.photoMediaId ? { photoMediaId: input.photoMediaId } : {}), memberships: [{ start: input.start }], plans: [{ from: input.start, plan: input.plan, by: ctx.actor }],
        usualArrival: input.usualArrival, nanny: input.nanny, spouseId: input.spouseId,
        health: {
          conditions: input.health.conditions, diabetic: input.health.diabetic, food: input.health.food, ...(input.health.foodOther ? { foodOther: input.health.foodOther } : {}), drugs: input.health.drugs,
          mobility: input.health.mobility, diet: input.health.diet, meds: input.health.meds.map((x, i) => ({ id: `${id}-med${i + 1}`, ...x })), cognitive: { summary: '' },
        },
        care: { instructions: input.careInstructions, by: ctx.actor, at: ctx.nowDT }, consents, documents, face: { enrolled: false }, billing: { va: vaFor(num - 1) }, sim: { ...DEFAULT_SIM },
        ...(input.registration ? { registration: input.registration } : {}),
      };
      ctx.result.memberId = id;
      ctx.result.familyId = familyId;
      feed(ctx, d, id, 'person_add', 'created');
      if (ctx.review !== 'gate') activateMember(d, id, ctx); // management: no review, so activate now
    },
    afterApprove(d, cr, ctx) {
      activateMember(d, cr.target.id, ctx);
    },
    afterReject(d, cr) {
      // nothing beyond the framework's soft delete was created before approval; drop the draft's feed entry too
      for (const [id, a] of Object.entries(d.activity)) if (a.memberId === cr.target.id) delete d.activity[id];
    },
  }),

  // ----- details / documents / consent / plan (gated) -----
  defineAction<{ memberId: string; patch: DetailsPatch; note?: string }>({
    name: 'members.updateDetails',
    can: (u) => frontDesk(u),
    parse: (raw) => { const o = obj(raw); const patch = parseDetailsPatch(o.patch); if (!Object.keys(patch).length) bad('err.noChanges'); return { memberId: txt(o.memberId, 60), patch, ...optionalNote(o) }; },
    review: { policy: 'gate', section: 'details', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const p = input.patch;
      const fields: string[] = [];
      if (p.title !== undefined && p.title !== m.title) { m.title = p.title; m.gender = genderOf(p.title); fields.push('title'); }
      if (p.name !== undefined) {
        const { firstName, lastName } = splitName(p.name);
        if (firstName !== m.firstName || lastName !== m.lastName) { m.firstName = firstName; m.lastName = lastName; fields.push('name'); }
      }
      if (p.dob !== undefined && p.dob !== m.dob) {
        if (p.dob > ctx.today) ctx.fail('members.err.dobInvalid');
        m.dob = p.dob; m.ageYears = null; fields.push('dob');
      }
      if (p.address !== undefined && (p.address || null) !== m.address) { m.address = p.address || null; fields.push('address'); }
      if (p.usualArrival !== undefined && p.usualArrival !== m.usualArrival) { if (p.usualArrival) checkArrival(d, p.usualArrival, ctx); m.usualArrival = p.usualArrival; fields.push('usualArrival'); }
      if (p.nanny !== undefined && !sameJson(p.nanny, m.nanny)) { m.nanny = p.nanny ? { ...p.nanny } : null; fields.push('nanny'); }
      if (p.spouseId !== undefined && p.spouseId !== m.spouseId) {
        if (p.spouseId) {
          const sp = d.members[p.spouseId];
          if (p.spouseId === m.id || !sp || sp.deletedAt || isPendingRow(sp)) ctx.fail('members.err.spouseInvalid');
        }
        setSpouse(d, m.id, p.spouseId); fields.push('spouseId');
      }
      if (p.photoMediaId !== undefined && (p.photoMediaId || undefined) !== m.photoMediaId) {
        if (p.photoMediaId) m.photoMediaId = p.photoMediaId; else delete m.photoMediaId;
        fields.push('photo');
      }
      if (p.registration !== undefined && !sameJson(cleanRegistration(p.registration), cleanRegistration(m.registration))) {
        if (p.registration) m.registration = { ...p.registration, ...(p.registration.ids ? { ids: { ...p.registration.ids } } : {}) }; else delete m.registration;
        fields.push('registration');
      }
      if (!fields.length) ctx.fail('err.noChanges');
      feed(ctx, d, m.id, 'edit', 'details', { fields: fields.join(','), by: ctx.actor });
    },
  }),
  defineAction<{ memberId: string; docs: { type: DocType; fileName: string | null; mediaId?: string }[]; note?: string }>({
    name: 'members.setDocuments',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      const docs = (Array.isArray(o.docs) ? o.docs : []).slice(0, 8).map((x) => { const r = obj(x); const mediaId = mediaIdOf(r.mediaId); return { type: oneOf(r.type, DOC_TYPES), fileName: r.fileName === null ? null : txt(r.fileName, 120) || bad('err.invalid'), ...(mediaId ? { mediaId } : {}) }; });
      if (!docs.length) bad('err.noChanges');
      return { memberId: txt(o.memberId, 60), docs, ...optionalNote(o) };
    },
    review: { policy: 'gate', section: 'docsConsent', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const types: string[] = [];
      for (const x of input.docs) {
        if (x.type === 'nannyKtp' && !m.nanny) ctx.fail('members.err.noNanny');
        const i = m.documents.findIndex((q) => q.type === x.type);
        if (x.fileName === null) { if (i >= 0) { m.documents.splice(i, 1); types.push(x.type); } continue; }
        const doc: MemberDocument = { id: docIdFor(m.id, x.type), type: x.type, status: 'onFile', fileName: x.fileName, ...(x.mediaId ? { mediaId: x.mediaId } : {}), on: ctx.today, via: 'staff', by: ctx.actor };
        if (i >= 0) m.documents[i] = doc; else m.documents.push(doc);
        types.push(x.type);
      }
      if (!types.length) ctx.fail('err.noChanges');
      feed(ctx, d, m.id, 'description', 'docs', { type: types.join(','), by: ctx.actor });
    },
  }),
  defineAction<{ memberId: string; data?: boolean; face?: boolean; via?: 'staff' | 'paper'; note?: string }>({
    name: 'members.setConsent',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      if (o.data === false) bad('members.err.consentRequired');
      if (o.data === undefined && o.face === undefined) bad('err.noChanges');
      return { memberId: txt(o.memberId, 60), ...(o.data === true ? { data: true } : {}), ...(typeof o.face === 'boolean' ? { face: o.face } : {}), via: o.via === 'paper' ? 'paper' : 'staff', ...optionalNote(o) };
    },
    review: { policy: 'gate', section: 'docsConsent', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const kinds: string[] = [];
      for (const kind of ['data', 'face'] as const) {
        const want = input[kind];
        if (want === undefined) continue;
        const cur = consentOf(m as Member, kind);
        if (cur && cur.granted === want) continue;
        const rec: Consent = { kind, granted: want, by: ctx.actor, byName: fullNameOf(d, ctx.actor), at: ctx.nowDT, via: input.via || 'staff' };
        const i = m.consents.findIndex((c) => c.kind === kind);
        if (i >= 0) m.consents[i] = rec; else m.consents.push(rec);
        kinds.push(kind);
      }
      if (!kinds.length) ctx.fail('err.noChanges');
      if (input.face === false) m.face = { enrolled: false }; // opted out: the stored face is dropped, the door camera skips them
      feed(ctx, d, m.id, 'verified_user', 'consent', { kinds: kinds.join(','), by: ctx.actor });
    },
  }),
  defineAction<{ memberId: string; plan: Plan; effective?: ISODate; note?: string }>({
    name: 'members.changePlan',
    can: (u) => planPeople(u),
    parse: (raw) => {
      const o = obj(raw);
      const plan: Plan = o.plan === 'gold' ? 'gold' : o.plan === 'flex' ? 'flex' : bad('members.err.planInvalid');
      const eff = txt(o.effective, 10);
      if (eff && !isISO(eff)) bad('members.err.effectiveInvalid');
      return { memberId: txt(o.memberId, 60), plan, ...(eff ? { effective: eff } : {}), ...optionalNote(o) };
    },
    review: { policy: 'gate', section: 'plan', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const effective = input.effective || firstOfNextMonth(ctx.today);
      if (effective < ctx.today) ctx.fail('members.err.effectiveInvalid');
      const cur = planOn(m as Member, effective);
      if (cur.plan === input.plan) ctx.fail('err.noChanges');
      addPlanEntry(m, { from: effective, plan: input.plan, by: ctx.actor }, ctx.today);
      for (const r of Object.values(d.planChangeRequests)) if (r.memberId === m.id && r.status === 'pending' && r.to === input.plan) { r.status = 'applied'; r.decidedBy = ctx.actor; r.decidedAt = ctx.nowDT; }
      feed(ctx, d, m.id, 'sell', 'plan', { plan: input.plan, from: effective, by: ctx.actor });
    },
  }),

  // ----- request a document from the family (not gated) -----
  defineAction<{ memberId: string; type: DocType }>({
    name: 'members.requestDocument',
    can: (u) => frontDesk(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), type: oneOf(o.type, DOC_TYPES) }; },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      if (input.type === 'nannyKtp' && !m.nanny) ctx.fail('members.err.noNanny');
      const i = m.documents.findIndex((q) => q.type === input.type);
      if (i >= 0 && m.documents[i].status === 'onFile') ctx.fail('members.err.alreadyOnFile');
      const doc: MemberDocument = { id: docIdFor(m.id, input.type), type: input.type, status: 'requested', on: ctx.today, by: ctx.actor };
      if (i >= 0) m.documents[i] = doc; else m.documents.push(doc);
      const p = primaryContact(d as unknown as ClubState, m.id);
      if (p) ctx.notify({ toUsers: [p.id], kind: 'members.notif.docRequested', params: { name: memberShort(m) }, link: `/health?member=${m.id}&tab=docs`, memberId: m.id });
      feed(ctx, d, m.id, 'upload_file', 'docRequested', { type: input.type });
    },
  }),

  // ----- health (applied now, reviewed afterwards) -----
  defineAction<{ memberId: string; food: FoodAllergen[]; foodOther: string; drugs: DrugAllergy[] }>({
    name: 'members.setAllergies',
    can: (u) => clinical(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), food: enumList(o.food, FOODS), foodOther: txt(o.foodOther, 80), drugs: parseDrugs(o.drugs) }; },
    review: { policy: 'flag', section: 'allergies', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const h = m.health;
      const changed = !sameJson(h.food, input.food) || (h.foodOther || '') !== input.foodOther || !sameJson(h.drugs, input.drugs);
      if (!changed) ctx.fail('err.noChanges');
      h.food = input.food;
      if (input.foodOther) h.foodOther = input.foodOther; else delete h.foodOther;
      h.drugs = input.drugs;
      feed(ctx, d, m.id, 'no_food', 'allergies', { by: ctx.actor });
      ctx.notify({ toRoles: ['nurse', 'kitchen'], kind: 'members.notif.allergies', params: { name: shortOf(d, m.id), who: actorName(d as ClubState, ctx.actor) }, link: `/members/${m.id}/health`, memberId: m.id, severity: 'attention' });
    },
  }),
  defineAction<{ memberId: string; meds: { id?: string; name: string; dose: string; timing: MedTiming; note?: string }[] }>({
    name: 'members.setMeds',
    can: (u) => clinical(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), meds: parseMeds(o.meds) }; },
    review: { policy: 'flag', section: 'medicines', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      let n = m.health.meds.reduce((mx, x) => Math.max(mx, Number(/med(\d+)$/.exec(x.id)?.[1] || 0)), 0);
      const meds: Medicine[] = input.meds.map((x) => ({ id: x.id && m.health.meds.some((q) => q.id === x.id) ? x.id : `${m.id}-med${++n}`, name: x.name, dose: x.dose, timing: x.timing, ...(x.note ? { note: x.note } : {}) }));
      if (sameJson(meds, m.health.meds)) ctx.fail('err.noChanges');
      m.health.meds = meds;
      feed(ctx, d, m.id, 'medication', 'meds', { by: ctx.actor });
      ctx.notify({ toRoles: ['nurse'], kind: 'members.notif.meds', params: { name: shortOf(d, m.id), who: actorName(d as ClubState, ctx.actor) }, link: `/members/${m.id}/health`, memberId: m.id, severity: 'attention' });
    },
  }),
  defineAction<{ memberId: string; text: string }>({
    name: 'members.setCareInstructions',
    can: (u) => clinical(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), text: txt(o.text, 1000) }; },
    review: { policy: 'flag', section: 'care', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      if (m.care.instructions === input.text) ctx.fail('err.noChanges');
      m.care = { instructions: input.text, by: ctx.actor, at: ctx.nowDT };
      feed(ctx, d, m.id, 'lock', 'care', { by: ctx.actor });
      ctx.notify({ toRoles: ['nurse'], kind: 'members.notif.care', params: { name: shortOf(d, m.id), who: actorName(d as ClubState, ctx.actor) }, link: `/members/${m.id}/health`, memberId: m.id });
    },
  }),
  defineAction<{ memberId: string; conditions: string[]; diabetic: boolean; mobility: Mobility | null; diet: Diet[] }>({
    name: 'members.setHealth',
    can: (u) => clinical(u),
    parse: (raw) => {
      const o = obj(raw);
      return { memberId: txt(o.memberId, 60), conditions: strList(o.conditions), diabetic: !!o.diabetic, mobility: MOBILITIES.includes(o.mobility as Mobility) ? (o.mobility as Mobility) : null, diet: enumList(o.diet, DIETS) };
    },
    review: { policy: 'flag', section: 'care', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const h = m.health;
      const changed = !sameJson(h.conditions, input.conditions) || h.diabetic !== input.diabetic || h.mobility !== input.mobility || !sameJson(h.diet, input.diet);
      if (!changed) ctx.fail('err.noChanges');
      h.conditions = input.conditions; h.diabetic = input.diabetic; h.mobility = input.mobility; h.diet = input.diet;
      feed(ctx, d, m.id, 'clinical_notes', 'health', { by: ctx.actor });
      ctx.notify({ toRoles: ['nurse', 'kitchen'], kind: 'members.notif.health', params: { name: shortOf(d, m.id), who: actorName(d as ClubState, ctx.actor) }, link: `/members/${m.id}/health`, memberId: m.id });
    },
  }),
  defineAction<{ memberId: string; summary: string }>({
    name: 'members.setCognitive',
    can: (u) => hasRole(u, 'nurse', 'activity', 'mgmt'),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), summary: txt(o.summary, 300) }; },
    review: { policy: 'flag', section: 'care', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      if (m.health.cognitive.summary === input.summary) ctx.fail('err.noChanges');
      // reviewedBy / reviewedOn record the editor and the day
      m.health.cognitive = { summary: input.summary, reviewedBy: staffIdOf(ctx.actor), reviewedOn: ctx.today };
      feed(ctx, d, m.id, 'psychology', 'cognitive', { by: ctx.actor });
    },
  }),

  // ----- plan requests -----
  defineAction<{ requestId: string; effective?: ISODate; note?: string }>({
    name: 'planChange.apply',
    can: (u) => planPeople(u),
    parse: (raw) => { const o = obj(raw); const eff = txt(o.effective, 10); if (eff && !isISO(eff)) bad('members.err.effectiveInvalid'); return { requestId: txt(o.requestId, 80), ...(eff ? { effective: eff } : {}), ...optionalNote(o) }; },
    review: { policy: 'gate', section: 'plan', op: 'update', target: (i, s) => target(s.planChangeRequests[i.requestId]?.memberId || '') },
    run(d, input, ctx) {
      const req = d.planChangeRequests[input.requestId];
      if (!req || req.deletedAt) ctx.fail('err.notFound');
      if (req.status !== 'pending') ctx.fail('members.err.requestNotPending');
      const m = editable(d, req.memberId, ctx);
      const effective = input.effective || (req.from < ctx.today ? ctx.today : req.from);
      if (effective < ctx.today) ctx.fail('members.err.effectiveInvalid');
      if (planOn(m as Member, effective).plan === req.to) ctx.fail('err.noChanges');
      addPlanEntry(m, { from: effective, plan: req.to, by: ctx.actor, requestId: req.id }, ctx.today);
      req.status = 'applied'; req.decidedBy = ctx.actor; req.decidedAt = ctx.nowDT;
      const asker = req.createdBy.startsWith('family:') ? req.createdBy.slice(7) : '';
      if (asker) ctx.notify({ toUsers: [asker], kind: 'members.notif.planApplied', params: { name: memberShort(m), plan: req.to, date: dmy(effective) }, link: `/health?member=${m.id}&tab=plan`, memberId: m.id });
      feed(ctx, d, m.id, 'sell', 'planApplied', { plan: req.to, from: effective, by: ctx.actor });
    },
  }),
  defineAction<{ requestId: string; note?: string }>({
    name: 'planChange.decline',
    can: (u) => planPeople(u),
    parse: (raw) => { const o = obj(raw); return { requestId: txt(o.requestId, 80), ...optionalNote(o) }; },
    // the change lands on the request row, not the member row, so the review request is held here rather than diffed by the framework
    run(d, input, ctx) {
      const req = d.planChangeRequests[input.requestId];
      if (!req || req.deletedAt) ctx.fail('err.notFound');
      if (req.status !== 'pending') ctx.fail('members.err.requestNotPending');
      const m = editable(d, req.memberId, ctx);
      if (holdForReview(d, ctx, { action: 'planChange.decline', input, section: 'plan', target: target(m.id) })) return;
      req.status = 'declined'; req.decidedBy = ctx.actor; req.decidedAt = ctx.nowDT;
      const asker = req.createdBy.startsWith('family:') ? req.createdBy.slice(7) : '';
      if (asker) ctx.notify({ toUsers: [asker], kind: 'members.notif.planDeclined', params: { name: memberShort(m) }, link: `/health?member=${m.id}&tab=plan`, memberId: m.id });
      feed(ctx, d, m.id, 'sell', 'planDeclined', { plan: req.to, by: ctx.actor });
    },
  }),

  // ----- end / cancel ending / reactivate (management) -----
  defineAction<{ memberId: string; lastDay: ISODate; reason: EndReason; note?: string }>({
    name: 'members.end',
    can: (u) => mgmtOnly(u),
    parse: (raw) => {
      const o = obj(raw);
      const lastDay = txt(o.lastDay, 10);
      if (!lastDay) bad('members.err.lastDayRequired');
      if (!isISO(lastDay)) bad('members.err.lastDayInvalid');
      return { memberId: txt(o.memberId, 60), lastDay, reason: oneOf(o.reason, END_REASONS, 'members.err.reasonRequired'), ...optionalNote(o) };
    },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (isPendingRow(m)) ctx.fail('err.memberPending');
      const cur = currentMembership(m);
      const life = membershipStatus(m as Member, ctx.today);
      if (life === 'ended') ctx.fail('members.err.alreadyEnded');
      if (cur.lastDay) ctx.fail('members.err.alreadyEnding');
      if (input.lastDay < ctx.today) ctx.fail('members.err.lastDayPast');
      if (input.lastDay < cur.start) ctx.fail('members.err.lastDayBeforeStart');
      if (!isOpen(d as unknown as ClubState, input.lastDay)) ctx.fail('err.closedDay');
      applyEnding(d, m, { lastDay: input.lastDay, reason: input.reason, note: input.note }, ctx);
    },
  }),
  defineAction<{ memberId: string }>({
    name: 'members.cancelEnding',
    can: (u) => mgmtOnly(u),
    parse: (raw) => ({ memberId: txt(obj(raw).memberId, 60) }),
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      const cur = currentMembership(m);
      if (!cur.lastDay || membershipStatus(m as Member, ctx.today) === 'ended') ctx.fail('members.err.notEnding');
      const at = cur.endedAt;
      // undo what the ending voided
      for (const i of Object.values(d.invoices)) {
        if (i.memberId === m.id && i.kind === 'final' && !i.voided && at && i.createdAt === at && paidOn(d as unknown as ClubState, i.id) <= 0) i.voided = { at: ctx.nowDT, by: ctx.actor, reason: 'endingCancelled' };
      }
      delete cur.lastDay; delete cur.endReason; delete cur.endNote; delete cur.endedBy; delete cur.endedAt;
      feed(ctx, d, m.id, 'undo', 'endingCancelled');
    },
  }),
  defineAction<{ memberId: string; start?: ISODate }>({
    name: 'members.reactivate',
    can: (u) => mgmtOnly(u),
    parse: (raw) => { const o = obj(raw); const s = txt(o.start, 10); if (s && !isISO(s)) bad('members.err.startInvalid'); return { memberId: txt(o.memberId, 60), ...(s ? { start: s } : {}) }; },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      if (membershipStatus(m as Member, ctx.today) !== 'ended') ctx.fail('members.err.notEnded');
      const start = input.start || nextOpenDay(d as unknown as ClubState, ctx.today, true);
      if (start < ctx.today || !isOpen(d as unknown as ClubState, start)) ctx.fail('members.err.startInvalid');
      m.memberships.push({ start });
      const to = familyUserIds(d, m.id);
      if (to.length) ctx.notify({ toUsers: to, kind: 'members.notif.reactivated', params: { name: memberShort(m), date: dmy(start) }, link: '/today', memberId: m.id });
      feed(ctx, d, m.id, 'person_check', 'reactivated', { from: start });
    },
  }),

  // ----- notes -----
  defineAction<{ memberId: string; visibility: 'staff' | 'family'; text: string; pinned?: boolean }>({
    name: 'note.add',
    can: (u) => hasRole(u, 'lobby', 'nurse', 'activity', 'mgmt'),
    parse: (raw) => {
      const o = obj(raw);
      const text = txt(o.text, 1000);
      if (!text) bad('err.noteRequired');
      const visibility = oneOf(o.visibility ?? 'staff', ['staff', 'family'] as const);
      return { memberId: txt(o.memberId, 60), visibility, text, ...(visibility === 'family' ? { pinned: o.pinned !== false } : {}) };
    },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const id = ctx.id('note');
      // a family-visible note by anyone but management waits for approval (families don't see it, and the note it would replace as the pinned one stays pinned until then)
      const gated = input.visibility === 'family' && needsApproval(ctx);
      if (input.visibility === 'family' && input.pinned && !gated) for (const n of Object.values(d.memberNotes)) if (n.memberId === m.id && n.visibility === 'family' && n.pinned) n.pinned = false;
      d.memberNotes[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, visibility: input.visibility, text: input.text, on: ctx.today, ...(input.visibility === 'family' && input.pinned ? { pinned: true } : {}) };
      if (gated) markPending(d.memberNotes[id], ctx, undefined);
      ctx.result.noteId = id;
      ctx.result.pending = gated;
      feed(ctx, d, m.id, input.visibility === 'family' ? 'group' : 'lock', input.visibility === 'family' ? 'noteShared' : 'noteStaff');
    },
  }),
  defineAction<{ noteId: string; text?: string; pinned?: boolean }>({
    name: 'note.edit',
    can: (u, i, s) => hasRole(u, 'lobby', 'nurse', 'activity', 'mgmt') && (isMgmt(u) || s.memberNotes[i.noteId]?.createdBy === actorOf(u)),
    parse: (raw) => {
      const o = obj(raw);
      const text = o.text === undefined ? undefined : txt(o.text, 1000);
      if (text === '') bad('err.noteRequired');
      if (text === undefined && typeof o.pinned !== 'boolean') bad('err.noChanges');
      return { noteId: txt(o.noteId, 80), ...(text !== undefined ? { text } : {}), ...(typeof o.pinned === 'boolean' ? { pinned: o.pinned } : {}) };
    },
    run(d, input, ctx) {
      const n = d.memberNotes[input.noteId];
      if (!n || n.deletedAt) ctx.fail('err.notFound');
      editable(d, n.memberId, ctx);
      const gated = n.visibility === 'family' && needsApproval(ctx);
      const before = n.visibility === 'family' ? priorOf(n, NOTE_KEYS) : undefined;
      let changed = false;
      if (input.text !== undefined && input.text !== n.text) { n.text = input.text; changed = true; }
      if (input.pinned !== undefined && n.visibility === 'family' && !!n.pinned !== input.pinned) {
        if (input.pinned && !gated) for (const o of Object.values(d.memberNotes)) if (o.memberId === n.memberId && o.visibility === 'family' && o.pinned && o.id !== n.id) o.pinned = false;
        n.pinned = input.pinned || undefined;
        changed = true;
      }
      if (!changed) ctx.fail('err.noChanges');
      n.editedAt = ctx.nowDT; n.editedBy = ctx.actor;
      if (gated) markPending(n, ctx, before);
      else if (n.visibility === 'family') {
        // management's edit approves the note; the pinned one it replaces steps aside
        if (n.approval?.status === 'pending' && n.pinned) for (const o of Object.values(d.memberNotes)) if (o.memberId === n.memberId && o.visibility === 'family' && o.pinned && o.id !== n.id) o.pinned = false;
        clearApproval(n);
      }
      ctx.result.pending = gated;
      feed(ctx, d, n.memberId, 'edit_note', 'noteEdited');
    },
  }),
  defineAction<{ noteId: string }>({
    name: 'note.delete',
    can: (u, i, s) => hasRole(u, 'lobby', 'nurse', 'activity', 'mgmt') && (isMgmt(u) || s.memberNotes[i.noteId]?.createdBy === actorOf(u)),
    parse: (raw) => ({ noteId: txt(obj(raw).noteId, 80) }),
    run(d, input, ctx) {
      const n = d.memberNotes[input.noteId];
      if (!n || n.deletedAt) ctx.fail('err.notFound');
      editable(d, n.memberId, ctx);
      n.deletedAt = ctx.nowDT;
      feed(ctx, d, n.memberId, 'delete', 'noteDeleted');
    },
  }),
];

/** Ending a membership once the last day is checked: the last day and reason on the membership, the family's open plan requests declined, a final invoice for extra days
 *  never billed, the contact told, the feed. Used by members.end and by the renewals follow-up (actions/renewals.ts). */
export function applyEnding(d: Draft<ClubState>, m: Draft<Member>, input: { lastDay: ISODate; reason: EndReason; note?: string }, ctx: Ctx) {
  const cur = currentMembership(m);
  cur.lastDay = input.lastDay;
  cur.endReason = input.reason;
  if (input.note) cur.endNote = txt(input.note, 400);
  cur.endedBy = ctx.actor;
  cur.endedAt = ctx.nowDT;
  for (const r of Object.values(d.planChangeRequests)) if (r.memberId === m.id && r.status === 'pending') { r.status = 'declined'; r.decidedBy = ctx.actor; r.decidedAt = ctx.nowDT; }
  // final invoice: only extra days that were never billed (open invoices stay payable as they are)
  const inv = finalInvoiceFor(d as unknown as ClubState, m as Member, input.lastDay, ctx.today);
  if (inv) {
    const row: Invoice = { id: inv.number, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, ...inv };
    d.invoices[row.id] = row;
    ctx.result.finalInvoice = { number: inv.number, total: inv.lines.reduce((t, l) => t + l.amount, 0) };
  }
  const p = primaryContact(d as unknown as ClubState, m.id);
  if (p) ctx.notify({ toUsers: [p.id], kind: 'members.notif.ending', params: { name: memberShort(m), date: dmy(input.lastDay) }, link: '/today', memberId: m.id });
  feed(ctx, d, m.id, 'archive', 'ending', { reason: input.reason, date: input.lastDay });
}

/** Insert a plan entry keeping the list ordered by date; scheduled changes on or after the new date are replaced. */
export function addPlanEntry(m: Draft<Member>, entry: PlanEntry, today: ISODate) {
  const keep = m.plans.filter((p) => p.from < entry.from || p.from <= today).filter((p) => p.from !== entry.from).map((p) => ({ ...p }));
  m.plans = [...keep, entry].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
