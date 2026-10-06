// Directory actions: suppliers, doctors and services. Finance, management and the lobby keep the list; families see the public entries.
import type { DirectoryContact, User } from '../types';
import { defineAction, hasRole, type ActionDef } from './framework';
import { bool, obj, oneOf, optText, pickId, text, bad } from '../rules/financeInput';
import { e164 } from '../util';

const KINDS = ['doctor', 'service', 'supplier'] as const;
const keeps = (u: User) => hasRole(u, 'finance', 'mgmt', 'lobby');
/** A phone number with at least six digits, stored as E.164 (+62…). */
const phone = (v: unknown): string => {
  const p = e164(text(v, 40));
  return p.replace(/\D/g, '').length >= 6 ? p : bad();
};

export const directoryActions: ActionDef[] = [
  defineAction<{ kind: DirectoryContact['kind']; name: string; what: string; whatId?: string; phone: string; public: boolean }>({
    name: 'directory.add',
    can: keeps,
    parse: (raw) => {
      const o = obj(raw);
      return { kind: oneOf(o.kind, KINDS), name: text(o.name, 120), what: text(o.what, 160), whatId: optText(o.whatId, 160), phone: phone(o.phone), public: bool(o.public) };
    },
    run(d, input, ctx) {
      const id = ctx.id('dir');
      d.directory[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, kind: input.kind, name: input.name, what: input.what, ...(input.whatId ? { whatId: input.whatId } : {}), phone: input.phone, public: input.public };
      ctx.result.id = id;
    },
  }),
  defineAction<{ id: string; kind?: DirectoryContact['kind']; name?: string; what?: string; whatId?: string | null; phone?: string; public?: boolean }>({
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
      };
      return out;
    },
    run(d, input, ctx) {
      const c = d.directory[input.id];
      if (!c || c.deletedAt) ctx.fail('err.notFound');
      if (input.kind) c.kind = input.kind;
      if (input.name) c.name = input.name;
      if (input.what) c.what = input.what;
      if (input.whatId === null) delete c.whatId;
      else if (input.whatId) c.whatId = input.whatId;
      if (input.phone) c.phone = input.phone;
      if (input.public !== undefined) c.public = input.public;
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
