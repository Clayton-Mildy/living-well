// Directory actions: suppliers, doctors and services. Finance, management and the lobby keep the list; families see the public entries.
import type { ClubSettings, DirectoryContact, DirectoryGroup, SpendCategory, User } from '../types';
import { defineAction, hasRole, type ActionDef } from './framework';
import { bool, obj, oneOf, optText, pickId, text, bad } from '../rules/financeInput';
import { SPEND_CATEGORIES } from '../rules/purchasing';
import { e164 } from '../util';
import { nextNumId } from '../rules/mgmtParse';

const KINDS = ['doctor', 'service', 'supplier'] as const;
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
  defineAction<{ kind: DirectoryContact['kind']; name: string; what: string; whatId?: string; phone: string; public: boolean; category?: SpendCategory; groupId?: string }>({
    name: 'directory.add',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      return { kind: oneOf(o.kind, KINDS), name: text(o.name, 120), what: text(o.what, 160), whatId: optText(o.whatId, 160), phone: phone(o.phone), public: bool(o.public), category: o.category === undefined || o.category === null ? undefined : oneOf(o.category, SPEND_CATEGORIES), groupId: optGroup(o.groupId) };
    },
    run(d, input, ctx) {
      if (input.groupId && !usable(d.club.settings, input.groupId)) ctx.fail('err.invalid');
      const id = ctx.id('dir');
      d.directory[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: input.kind, name: input.name, what: input.what, ...(input.whatId ? { whatId: input.whatId } : {}), phone: input.phone, public: input.public, ...(input.category ? { category: input.category } : {}), ...(input.groupId ? { groupId: input.groupId } : {}) };
      ctx.result.id = id;
    },
  }),
  defineAction<{ id: string; kind?: DirectoryContact['kind']; name?: string; what?: string; whatId?: string | null; phone?: string; public?: boolean; category?: SpendCategory | null; groupId?: string | null }>({
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
] as ActionDef[];
