// Directory actions: suppliers, doctors and services. Finance, management and the lobby keep the list; families see the public entries.
import type { ClubSettings, DirectoryContact, DirectoryGroup, GeoPoint, SpendCategory, User } from '../types';
import { cleanGeo } from '../rules/geo';
import { defineAction, hasRole, type ActionDef } from './framework';
import { bool, obj, oneOf, optText, pickId, text, bad } from '../rules/financeInput';
import { SPEND_CATEGORIES } from '../rules/purchasing';
import { e164 } from '../util';
import { nextNumId } from '../rules/mgmtParse';

const KINDS = ['doctor', 'service', 'supplier', 'venue'] as const;
const MAX_PICS = 10;
/** Round 21: the pictures of a venue (media ids), at most 10. */
const pics = (v: unknown): string[] => { if (!Array.isArray(v) || v.length > MAX_PICS) return bad(); return v.map((x) => { const id = text(x, 80); return /^md_[A-Za-z0-9_-]{8,}$/.test(id) ? id : bad(); }); };
const optGeo = (v: unknown): GeoPoint | null | undefined => (v === undefined ? undefined : v === null ? null : (cleanGeo(v) ?? bad()));
const keeps = (u: User) => hasRole(u, 'finance', 'mgmt', 'lobby');
/** A phone number with at least six digits, stored as E.164 (+62…). */
const phone = (v: unknown): string => {
  const p = e164(text(v, 40));
  return p.replace(/\D/g, '').length >= 6 ? p : bad();
};

/** A group the contact may be put in: it exists and is active. */
const usable = (st: ClubSettings, id: string): boolean => !!st.directoryGroups?.some((g) => g.id === id && g.active);
const optGroup = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : text(v, 40));

export const directoryActions: ActionDef[] = [
  defineAction<{ kind: DirectoryContact['kind']; name: string; what: string; whatId?: string; phone: string; public: boolean; category?: SpendCategory; groupId?: string; contactPerson?: string; address?: string; location?: GeoPoint; photoMediaIds?: string[] }>({
    name: 'directory.add',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      const kind = oneOf(o.kind, KINDS);
      const venue = kind === 'venue';
      // round 21: a venue needs the person to ask for and the address; what it is is optional (the heading says it)
      const contactPerson = venue ? text(o.contactPerson, 80) : optText(o.contactPerson, 80);
      const address = venue ? text(o.address, 200) : optText(o.address, 200);
      const location = optGeo(o.location);
      return {
        kind, name: text(o.name, 120), what: venue ? (optText(o.what, 160) ?? '') : text(o.what, 160), whatId: optText(o.whatId, 160), phone: phone(o.phone), public: venue ? false : bool(o.public),
        category: o.category === undefined || o.category === null ? undefined : oneOf(o.category, SPEND_CATEGORIES), groupId: venue ? undefined : optGroup(o.groupId),
        ...(contactPerson ? { contactPerson } : {}), ...(address ? { address } : {}), ...(location ? { location } : {}), ...(o.photoMediaIds !== undefined ? { photoMediaIds: pics(o.photoMediaIds) } : {}),
      };
    },
    run(d, input, ctx) {
      if (input.groupId && !usable(d.club.settings, input.groupId)) ctx.fail('err.invalid');
      const id = ctx.id('dir');
      d.directory[id] = {
        id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: input.kind, name: input.name, what: input.what, ...(input.whatId ? { whatId: input.whatId } : {}), phone: input.phone, public: input.public, ...(input.category ? { category: input.category } : {}), ...(input.groupId ? { groupId: input.groupId } : {}),
        ...(input.contactPerson ? { contactPerson: input.contactPerson } : {}), ...(input.address ? { address: input.address } : {}), ...(input.location ? { location: input.location } : {}), ...(input.photoMediaIds?.length ? { photoMediaIds: input.photoMediaIds } : {}),
      };
      ctx.result.id = id;
    },
  }),
  defineAction<{ id: string; kind?: DirectoryContact['kind']; name?: string; what?: string; whatId?: string | null; phone?: string; public?: boolean; category?: SpendCategory | null; groupId?: string | null; contactPerson?: string | null; address?: string | null; location?: GeoPoint | null; photoMediaIds?: string[] }>({
    name: 'directory.update',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      const out = {
        id: pickId(o, 'contactId'),
        kind: o.kind === undefined ? undefined : oneOf(o.kind, KINDS),
        name: o.name === undefined ? undefined : text(o.name, 120),
        what: o.what === undefined ? undefined : text(o.what, 160),
        // null (or empty text) clears the Indonesian wording
        whatId: o.whatId === null || o.whatId === '' ? null : optText(o.whatId, 160),
        phone: o.phone === undefined ? undefined : phone(o.phone),
        public: typeof o.public === 'boolean' ? o.public : undefined,
        // null clears what the supplier sells
        category: o.category === null ? null : o.category === undefined ? undefined : oneOf(o.category, SPEND_CATEGORIES),
        // null clears the directory category (the contact sits under Other)
        groupId: o.groupId === null ? null : optGroup(o.groupId),
        // round 21: null or empty text clears them
        contactPerson: o.contactPerson === undefined ? undefined : o.contactPerson === null || o.contactPerson === '' ? null : text(o.contactPerson, 80),
        address: o.address === undefined ? undefined : o.address === null || o.address === '' ? null : text(o.address, 200),
        location: optGeo(o.location),
        photoMediaIds: o.photoMediaIds === undefined ? undefined : pics(o.photoMediaIds),
      };
      return out;
    },
    run(d, input, ctx) {
      const c = d.directory[input.id];
      if (!c || c.deletedAt) ctx.fail('err.notFound');
      if (input.groupId && !usable(d.club.settings, input.groupId)) ctx.fail('err.invalid'); // an unknown or retired category cannot be chosen
      if (input.kind) c.kind = input.kind;
      if (input.name) c.name = input.name;
      if (input.what) c.what = input.what;
      if (input.whatId === null) delete c.whatId;
      else if (input.whatId) c.whatId = input.whatId;
      if (input.phone) c.phone = input.phone;
      if (input.public !== undefined) c.public = input.public;
      if (input.category === null) delete c.category;
      else if (input.category) c.category = input.category;
      if (input.groupId === null) delete c.groupId;
      else if (input.groupId) c.groupId = input.groupId;
      if (input.contactPerson === null) delete c.contactPerson; else if (input.contactPerson) c.contactPerson = input.contactPerson;
      if (input.address === null) delete c.address; else if (input.address) c.address = input.address;
      if (input.location === null) delete c.location; else if (input.location) c.location = input.location;
      if (input.photoMediaIds) { if (input.photoMediaIds.length) c.photoMediaIds = input.photoMediaIds; else delete c.photoMediaIds; }
      if (c.kind === 'venue') { c.public = false; delete c.groupId; if (!c.contactPerson || !c.address) ctx.fail('err.invalid'); } // round 21: a venue keeps its person and address, never public
    },
  }),
  // KC round 15 (phase 2): the directory's categories. The front desk, finance and management add, rename and retire them; a retired one leaves the pickers and its contacts show under Other.
  defineAction<{ id?: string; name: string; nameId?: string; active: boolean }>({
    name: 'directory.setGroup',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      const id = o.id === undefined ? undefined : text(o.id, 40);
      if (id !== undefined && !/^dgrp_\d+$/.test(id)) bad();
      return { ...(id ? { id } : {}), name: text(o.name, 60), nameId: optText(o.nameId, 60), active: bool(o.active, true) };
    },
    run(d, input, ctx) {
      const groups = (d.club.settings.directoryGroups ??= []);
      const def: DirectoryGroup = { id: input.id ?? nextNumId(Object.fromEntries(groups.map((g) => [g.id, g])), 'dgrp_'), name: input.name, ...(input.nameId ? { nameId: input.nameId } : {}), active: input.active };
      if (input.id) {
        const at = groups.findIndex((g) => g.id === input.id);
        if (at < 0) ctx.fail('err.notFound');
        if (JSON.stringify(groups[at]) === JSON.stringify(def)) ctx.fail('err.noChanges');
        groups[at] = def;
      } else groups.push(def);
      ctx.result.groupId = def.id;
    },
  }),
  defineAction<{ id: string }>({
    name: 'directory.delete',
    can: keeps,
    parse: (raw) => ({ id: pickId(obj(raw), 'contactId') }),
    run(d, input, ctx) {
      const c = d.directory[input.id];
      if (!c || c.deletedAt) ctx.fail('err.notFound');
      c.deletedAt = ctx.nowDT; // receipts and vendor invoices keep the supplier's name; the entry just leaves the lists
    },
  }),
  defineAction<{ id: string }>({
    name: 'directory.togglePublic',
    can: keeps,
    parse: (raw) => ({ id: pickId(obj(raw), 'contactId') }),
    run(d, input, ctx) {
      const c = d.directory[input.id];
      if (!c || c.deletedAt) ctx.fail('err.notFound');
      c.public = !c.public;
      ctx.result.public = c.public;
    },
  }),
  // 11 Nov (KC): a contact has one rating; rating it again changes it (other stars than now) and the change is logged with an optional why.
  // The log is fixed: nobody edits or removes an entry.
  defineAction<{ id: string; stars: 1 | 2 | 3 | 4 | 5; note?: string }>({
    name: 'directory.rate',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      const stars = Number(o.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) bad();
      const note = o.note === undefined || o.note === null ? undefined : String(o.note).trim();
      if (note !== undefined && note.length > 200) bad();
      return { id: pickId(o, 'contactId'), stars: stars as 1 | 2 | 3 | 4 | 5, ...(note ? { note } : {}) };
    },
    run(d, input, ctx) {
      const c = d.directory[input.id];
      if (!c || c.deletedAt) ctx.fail('err.notFound');
      if (c.ratings?.length && c.ratings[c.ratings.length - 1].stars === input.stars) ctx.fail('finance.dir.sameStars');
      const id = ctx.id('rate');
      (c.ratings ??= []).push({ id, stars: input.stars, ...(input.note ? { note: input.note } : {}), at: ctx.nowDT, by: ctx.actor });
      ctx.result.ratingId = id;
    },
  }),
] as ActionDef[];
