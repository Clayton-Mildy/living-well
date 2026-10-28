// Family contact actions (all gated for non-management staff) and the family's own document upload (gated).
// A contact belongs to a member through a link; the billing flag (primary) and app access live on the link, per member.
import type { Draft } from 'immer';
import type { ChangeRequest, ClubState, DocType, FamilyLink, HM, Lang, MemberDocument, MemberRegistration, Relation } from '../types';
import { e164 } from '../util';
import { defineAction, hasRole, isFamily, DomainError, type ActionDef, type Ctx } from './framework';
import { carrySigning, shortOf } from './helpers';
import { isPendingRow, linksOfMember, displayName } from '../rules/core';
import { DOC_TYPES, RELATIONS, SIM_FILE, docIdFor, firstWord, isHM, isPhone, lastContactId, lastLinkId, nextContactId, nextLinkId } from '../rules/members';
import { editable, makePrimary, mediaIdOf, obj, oneOf, parseNanny, phoneTaken, txt } from './members';

const frontDesk = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'mgmt');
const badCode = (code: string) => new DomainError(code);
const feed = (ctx: Ctx, d: Draft<ClubState>, memberId: string, icon: string, key: string, extra: Record<string, string | number> = {}) =>
  ctx.feed({ icon, key: `members.feed.${key}`, params: { name: shortOf(d, memberId), ...extra }, memberId });
const note = (o: Record<string, unknown>) => { const n = txt(o.note, 400); return n ? { note: n } : {}; };

/** The live (not removed) link of a contact to a member. */
export const linkOf = (s: ClubState | Draft<ClubState>, familyId: string, memberId: string): FamilyLink | undefined =>
  Object.values(s.familyLinks as ClubState['familyLinks']).find((l) => l.familyId === familyId && l.memberId === memberId && !l.deletedAt && l.review?.status !== 'rejected');
const linkFor = (d: Draft<ClubState>, familyId: string, memberId: string, ctx: Ctx): Draft<FamilyLink> => {
  const l = linkOf(d, familyId, memberId);
  if (!l) ctx.fail('members.err.notLinked');
  if (isPendingRow(l)) ctx.fail('members.err.contactPending');
  return d.familyLinks[l.id];
};
const contactTarget = (familyId: string, memberId?: string) => ({ type: 'familyContact' as const, id: familyId, ...(memberId ? { memberId } : {}) });
const linkTarget = (s: ClubState, familyId: string, memberId: string) => ({ type: 'familyLink' as const, id: linkOf(s, familyId, memberId)?.id || '', memberId });

const parsePerson = (o: Record<string, unknown>) => {
  const name = txt(o.name, 80);
  if (name.length < 2) throw badCode('members.err.contactRequired');
  const raw = txt(o.phone, 30);
  if (!raw) throw badCode('members.err.phoneRequired');
  const phone = e164(raw);
  if (!isPhone(phone)) throw badCode('members.err.phoneInvalid');
  return { name, phone };
};

interface AddContact { memberId: string; name: string; phone: string; relation: Relation; primary: boolean; appAccess: boolean; note?: string }
interface LinkContact { memberId: string; familyId: string; relation: Relation; primary: boolean; appAccess: boolean; note?: string }
interface UpdateContact { familyId: string; memberId?: string; name?: string; phone?: string; relation?: Relation; lang?: Lang; /** null removes it */ photoMediaId?: string | null; note?: string }

/** Welcome the contact (they see it when they first sign in). */
function welcomeContact(d: Draft<ClubState>, familyId: string, memberId: string, ctx: Ctx) {
  ctx.notify({ toUsers: [familyId], kind: 'members.notif.contactAdded', params: { name: displayName(d.members[memberId]) }, link: '/today', memberId });
}
function activateLink(d: Draft<ClubState>, l: Draft<FamilyLink>, ctx: Ctx) {
  const c = d.familyContacts[l.familyId];
  if (c && !c.activatedAt && l.appAccess) c.activatedAt = ctx.nowDT;
}

export const familyActions: ActionDef[] = [
  defineAction<AddContact>({
    name: 'family.addContact',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      const p = parsePerson(o);
      return { memberId: txt(o.memberId, 60), ...p, relation: oneOf(o.relation ?? 'other', RELATIONS), primary: o.primary === true, appAccess: o.appAccess !== false, ...note(o) };
    },
    review: { policy: 'gate', section: 'family', op: 'create', target: (i, s) => ({ type: 'familyContact', id: lastContactId(s, i.memberId), memberId: i.memberId }) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      if (phoneTaken(d, input.phone)) ctx.fail('members.err.phoneInUse');
      const id = nextContactId(d, m.id);
      d.familyContacts[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, name: input.name, firstName: firstWord(input.name), phone: input.phone };
      const lid = nextLinkId(d, id, m.id);
      d.familyLinks[lid] = { id: lid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, familyId: id, memberId: m.id, relation: input.relation, primary: input.primary, appAccess: input.appAccess, healthAlerts: true };
      ctx.result.familyId = id;
      feed(ctx, d, m.id, 'person_add', 'contactAdded', { who: input.name });
      if (ctx.review !== 'gate') {
        // management: no review, so the contact is active at once
        if (input.primary) makePrimary(d, m.id, lid);
        activateLink(d, d.familyLinks[lid], ctx);
        if (input.appAccess) welcomeContact(d, id, m.id, ctx);
      }
    },
    afterApprove(d, cr: ChangeRequest, ctx) {
      const row = cr.createdRows?.find((r) => r.coll === 'familyLinks');
      const l = row ? d.familyLinks[row.id] : undefined;
      if (!l) return;
      activateLink(d, l, ctx);
      if (l.primary) makePrimary(d, l.memberId, l.id);
      if (l.appAccess) welcomeContact(d, l.familyId, l.memberId, ctx);
    },
  }),

  defineAction<LinkContact>({
    name: 'family.linkContact',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      return { memberId: txt(o.memberId, 60), familyId: txt(o.familyId, 60), relation: oneOf(o.relation ?? 'other', RELATIONS), primary: o.primary === true, appAccess: o.appAccess !== false, ...note(o) };
    },
    review: { policy: 'gate', section: 'family', op: 'create', target: (i, s) => ({ type: 'familyLink', id: lastLinkId(s, i.familyId, i.memberId), memberId: i.memberId }) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const c = d.familyContacts[input.familyId];
      if (!c || c.deletedAt || isPendingRow(c)) ctx.fail('members.err.contactNotFound');
      if (linkOf(d, input.familyId, m.id)) ctx.fail('members.err.alreadyLinked');
      const lid = nextLinkId(d, input.familyId, m.id);
      d.familyLinks[lid] = { id: lid, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, familyId: input.familyId, memberId: m.id, relation: input.relation, primary: input.primary, appAccess: input.appAccess, healthAlerts: true };
      feed(ctx, d, m.id, 'link', 'contactLinked', { who: c.name });
      if (ctx.review !== 'gate') {
        if (input.primary) makePrimary(d, m.id, lid);
        activateLink(d, d.familyLinks[lid], ctx);
        if (input.appAccess) welcomeContact(d, input.familyId, m.id, ctx);
      }
    },
    afterApprove(d, cr: ChangeRequest, ctx) {
      const row = cr.createdRows?.find((r) => r.coll === 'familyLinks');
      const l = row ? d.familyLinks[row.id] : undefined;
      if (!l) return;
      activateLink(d, l, ctx);
      if (l.primary) makePrimary(d, l.memberId, l.id);
      if (l.appAccess) welcomeContact(d, l.familyId, l.memberId, ctx);
    },
  }),

  defineAction<UpdateContact>({
    name: 'family.updateContact',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      const out: UpdateContact = { familyId: txt(o.familyId, 60), ...(txt(o.memberId, 60) ? { memberId: txt(o.memberId, 60) } : {}) };
      if (o.name !== undefined) { const n = txt(o.name, 80); if (n.length < 2) throw badCode('members.err.contactRequired'); out.name = n; }
      if (o.phone !== undefined) { const p = e164(txt(o.phone, 30)); if (!p) throw badCode('members.err.phoneRequired'); if (!isPhone(p)) throw badCode('members.err.phoneInvalid'); out.phone = p; }
      if (o.relation !== undefined) { out.relation = oneOf(o.relation, RELATIONS); if (!out.memberId) throw badCode('err.invalid'); }
      if (o.lang !== undefined) out.lang = oneOf(o.lang, ['en', 'id'] as const);
      if (o.photoMediaId !== undefined) out.photoMediaId = mediaIdOf(o.photoMediaId) ?? null;
      if (out.name === undefined && out.phone === undefined && out.relation === undefined && out.lang === undefined && out.photoMediaId === undefined) throw badCode('err.noChanges');
      return { ...out, ...note(o) };
    },
    // name, mobile, language and picture live on the contact; the relationship lives on the link to the member
    review: { policy: 'gate', section: 'family', op: 'update', target: (i, s) => (i.name !== undefined || i.phone !== undefined || i.lang !== undefined || i.photoMediaId !== undefined || !i.memberId ? contactTarget(i.familyId, i.memberId) : linkTarget(s, i.familyId, i.memberId)) },
    run(d, input, ctx) {
      const c = d.familyContacts[input.familyId];
      if (!c || c.deletedAt) ctx.fail('members.err.contactNotFound');
      if (isPendingRow(c)) ctx.fail('members.err.contactPending');
      if (input.memberId) editable(d, input.memberId, ctx);
      let changed = false;
      if (input.name !== undefined && input.name !== c.name) { c.name = input.name; c.firstName = firstWord(input.name); changed = true; }
      if (input.phone !== undefined && input.phone !== c.phone) {
        if (phoneTaken(d, input.phone, c.id)) ctx.fail('members.err.phoneInUse');
        c.phone = input.phone; changed = true;
      }
      if (input.lang !== undefined && input.lang !== c.lang) { c.lang = input.lang; changed = true; }
      if (input.photoMediaId !== undefined && (input.photoMediaId ?? undefined) !== c.photoMediaId) {
        if (input.photoMediaId) c.photoMediaId = input.photoMediaId; else delete c.photoMediaId;
        changed = true;
      }
      if (input.relation !== undefined && input.memberId) {
        const l = linkFor(d, c.id, input.memberId, ctx);
        if (l.relation !== input.relation) { l.relation = input.relation; changed = true; }
      }
      if (!changed) ctx.fail('err.noChanges');
      if (input.memberId) feed(ctx, d, input.memberId, 'edit', 'contactUpdated', { who: c.name });
    },
  }),

  defineAction<{ memberId: string; familyId: string; note?: string }>({
    name: 'family.unlinkContact',
    can: (u) => frontDesk(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), familyId: txt(o.familyId, 60), ...note(o) }; },
    review: { policy: 'gate', section: 'family', op: 'update', target: (i, s) => linkTarget(s, i.familyId, i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const l = linkFor(d, input.familyId, m.id, ctx);
      const rest = linksOfMember(d as unknown as ClubState, m.id).filter((x) => x.id !== l.id);
      if (!rest.length) ctx.fail('members.err.lastContact');
      const wasPrimary = l.primary;
      l.deletedAt = ctx.nowDT;
      // the billing flag moves to the next contact; a contact with no members left is removed (their phone is free again)
      if (wasPrimary && !rest.some((x) => x.primary && !isPendingRow(x))) {
        const next = rest.find((x) => !isPendingRow(x)) || rest[0];
        makePrimary(d, m.id, next.id);
      }
      const c = d.familyContacts[l.familyId];
      if (c && !Object.values(d.familyLinks).some((x) => x.familyId === c.id && !x.deletedAt)) c.deletedAt = ctx.nowDT;
      feed(ctx, d, m.id, 'person_remove', 'contactUnlinked', { who: c?.name || '' });
    },
  }),

  defineAction<{ memberId: string; familyId: string; note?: string }>({
    name: 'family.setPrimary',
    can: (u) => frontDesk(u),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), familyId: txt(o.familyId, 60), ...note(o) }; },
    review: { policy: 'gate', section: 'family', op: 'update', target: (i, s) => linkTarget(s, i.familyId, i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const l = linkFor(d, input.familyId, m.id, ctx);
      if (l.primary) ctx.fail('err.noChanges');
      makePrimary(d, m.id, l.id);
      feed(ctx, d, m.id, 'receipt_long', 'primaryChanged', { who: d.familyContacts[l.familyId]?.name || '' });
    },
  }),

  defineAction<{ memberId: string; familyId: string; appAccess: boolean; note?: string }>({
    name: 'family.setAppAccess',
    can: (u) => frontDesk(u),
    parse: (raw) => { const o = obj(raw); if (typeof o.appAccess !== 'boolean') throw badCode('err.invalid'); return { memberId: txt(o.memberId, 60), familyId: txt(o.familyId, 60), appAccess: o.appAccess, ...note(o) }; },
    review: { policy: 'gate', section: 'family', op: 'update', target: (i, s) => linkTarget(s, i.familyId, i.memberId) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const l = linkFor(d, input.familyId, m.id, ctx);
      if (l.appAccess === input.appAccess) ctx.fail('err.noChanges');
      l.appAccess = input.appAccess;
      const c = d.familyContacts[l.familyId];
      if (input.appAccess) {
        activateLink(d, l, ctx);
        ctx.notify({ toUsers: [l.familyId], kind: 'members.notif.appInvite', params: { name: displayName(m) }, link: '/today', memberId: m.id });
      }
      feed(ctx, d, m.id, input.appAccess ? 'smartphone' : 'phonelink_erase', input.appAccess ? 'appAccessOn' : 'appAccessOff', { who: c?.name || '' });
    },
  }),

  // ----- the family uploads a document: simulated file pick, then it waits for review -----
  defineAction<{ memberId: string; type: DocType; fileName?: string; mediaId?: string }>({
    name: 'document.upload',
    can: (u, i) => isFamily(u) && u.kind === 'family' && u.memberIds.includes(i.memberId),
    parse: (raw) => { const o = obj(raw); const type = oneOf(o.type, DOC_TYPES); const mediaId = mediaIdOf(o.mediaId); return { memberId: txt(o.memberId, 60), type, fileName: txt(o.fileName, 120) || SIM_FILE[type], ...(mediaId ? { mediaId } : {}) }; },
    review: { policy: 'gate', section: 'docsConsent', op: 'update', target: (i) => ({ type: 'document', id: i.memberId, memberId: i.memberId }) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      if (input.type === 'nannyKtp' && !m.nanny) ctx.fail('members.err.noNanny');
      const i = m.documents.findIndex((q) => q.type === input.type);
      const keep = carrySigning(i >= 0 ? m.documents[i] : undefined, ctx);
      const doc: MemberDocument = { id: docIdFor(m.id, input.type), type: input.type, status: 'onFile', fileName: input.fileName || SIM_FILE[input.type], ...(input.mediaId ? { mediaId: input.mediaId } : {}), on: ctx.today, via: 'family', by: ctx.actor, ...keep };
      if (i >= 0) m.documents[i] = doc; else m.documents.push(doc);
      feed(ctx, d, m.id, 'upload_file', 'docUploaded', { type: input.type, by: ctx.actor });
    },
  }),

  // ----- round 8: the family edits a parent's personal and contact details; it waits for the club (gated, section "details") -----
  defineAction<{ memberId: string; patch: FamilyDetailsPatch }>({
    name: 'family.updateDetails',
    can: (u, i) => u.kind === 'family' && u.memberIds.includes(i.memberId),
    parse: (raw) => {
      const o = obj(raw);
      const p = obj(o.patch);
      const patch: FamilyDetailsPatch = {};
      if (p.address !== undefined) patch.address = txt(p.address, 200);
      if (p.usualArrival !== undefined) { const v = txt(p.usualArrival, 5); if (v && !isHM(v)) throw badCode('members.err.arrivalInvalid'); patch.usualArrival = v; }
      if (p.nanny !== undefined) patch.nanny = parseNanny(p.nanny);
      for (const k of FAMILY_REG_KEYS) if (p[k] !== undefined) patch[k] = txt(p[k], k === 'email' ? 120 : 60);
      if (!Object.keys(patch).length) throw badCode('err.noChanges');
      return { memberId: txt(o.memberId, 60), patch };
    },
    review: { policy: 'gate', section: 'details', op: 'update', target: (i) => ({ type: 'member', id: i.memberId, memberId: i.memberId }) },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const p = input.patch;
      const fields: string[] = [];
      if (p.address !== undefined && (p.address || null) !== m.address) { m.address = p.address || null; fields.push('address'); }
      if (p.usualArrival !== undefined && p.usualArrival !== m.usualArrival) {
        const { open, close } = d.club.settings;
        if (p.usualArrival && (p.usualArrival < open || p.usualArrival >= close)) ctx.fail('members.err.arrivalHours', { open, close });
        m.usualArrival = p.usualArrival; fields.push('usualArrival');
      }
      if (p.nanny !== undefined) {
        // the family never sees the carer's NIK: the same person keeps it
        const old = m.nanny;
        const nik = old?.nik && p.nanny && old.name.trim().toLowerCase() === p.nanny.name.trim().toLowerCase() ? old.nik : undefined;
        const next = p.nanny ? { ...p.nanny, ...(nik ? { nik } : {}) } : null;
        if (JSON.stringify(next) !== JSON.stringify(old)) { m.nanny = next; fields.push('nanny'); }
      }
      const reg: MemberRegistration = { ...(m.registration || {}) };
      let regChanged = false;
      for (const k of FAMILY_REG_KEYS) {
        const v = p[k];
        if (v === undefined || (v || undefined) === reg[k]) continue;
        if (v) reg[k] = v; else delete reg[k];
        regChanged = true;
      }
      if (regChanged) { m.registration = reg; fields.push('registration'); }
      if (!fields.length) ctx.fail('err.noChanges');
      feed(ctx, d, m.id, 'edit', 'details', { fields: fields.join(','), by: ctx.actor });
    },
  }),

  // ----- round 8: the family's "Notifications" switch in Me = health alerts for that parent (their own link; no review) -----
  defineAction<{ memberId: string; on: boolean }>({
    name: 'family.setHealthAlerts',
    can: (u, i) => u.kind === 'family' && u.memberIds.includes(i.memberId),
    parse: (raw) => { const o = obj(raw); return { memberId: txt(o.memberId, 60), on: o.on === true }; },
    run(d, input, ctx) {
      const l = linkFor(d, ctx.user.id, input.memberId, ctx);
      if (l.healthAlerts === input.on) ctx.fail('err.noChanges');
      l.healthAlerts = input.on;
    },
  }),
];

/** Round 8: what a family may change on a parent's profile (the rest stays with the front desk). */
export interface FamilyDetailsPatch {
  address?: string; usualArrival?: HM | ''; nanny?: { name: string; phone?: string; photoMediaId?: string; note?: string } | null;
  nickname?: string; rtRw?: string; city?: string; postcode?: string; phone?: string; mobile?: string; email?: string;
}
const FAMILY_REG_KEYS = ['nickname', 'rtRw', 'city', 'postcode', 'phone', 'mobile', 'email'] as const;
