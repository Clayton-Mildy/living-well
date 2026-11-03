// Round 16 (KC): Admin › Roles. Only the Owner sets what each role opens and which of a role's changes wait for the Owner.
// Round 17: one save per role. The screen sends the whole draft (every menu's View / Edit / off and the three approval switches); only cells that differ from the default are stored.
import type { Draft } from 'immer';
import type { ClubState } from '../types';
import { defineAction, isOwner, nameOfUser } from './framework';
import { GRID_ROLES, MENU_KEYS, OWNER_KINDS, isDefaultCell, ownerApprovalOn, type AccessLevel, type GridRole, type OwnerKind } from '../rules/access';
import { bad, obj, oneOf } from '../rules/mgmtParse';

const LEVELS: AccessLevel[] = ['off', 'view', 'edit'];
const S = (d: Draft<ClubState>) => d as unknown as ClubState;

export const accessActions = [
  defineAction<{ role: GridRole; levels: Record<string, AccessLevel>; approvals: Record<OwnerKind, boolean> }>({
    name: 'access.setRole',
    can: (u) => isOwner(u),
    parse: (raw) => {
      const o = obj(raw);
      const lv = obj(o.levels, 'levels');
      const ap = obj(o.approvals, 'approvals');
      if (Object.keys(lv).length !== MENU_KEYS.length || Object.keys(ap).length !== OWNER_KINDS.length) bad('levels');
      const levels: Record<string, AccessLevel> = {};
      for (const k of MENU_KEYS) levels[k] = oneOf(lv[k], LEVELS, k);
      const approvals = {} as Record<OwnerKind, boolean>;
      for (const kind of OWNER_KINDS) approvals[kind] = typeof ap[kind] === 'boolean' ? (ap[kind] as boolean) : bad(kind);
      return { role: oneOf(o.role, GRID_ROLES), levels, approvals };
    },
    run(d, input, ctx) {
      const settings = S(d).club.settings;
      const mine: Record<string, AccessLevel> = {};
      for (const k of MENU_KEYS) if (!isDefaultCell(input.role, k, input.levels[k])) mine[k] = input.levels[k];
      const access = (settings.access ??= {});
      if (Object.keys(mine).length) access[input.role] = mine; else delete access[input.role];
      if (!Object.keys(access).length) delete settings.access;
      // a switch at its default (on for Management, off for the others) is not stored; the default is read with the role's own entry cleared
      const own = (settings.ownerApproval ??= {});
      delete own[input.role];
      const kept: Partial<Record<OwnerKind, boolean>> = {};
      for (const kind of OWNER_KINDS) if (input.approvals[kind] !== ownerApprovalOn(S(d), input.role, kind)) kept[kind] = input.approvals[kind];
      if (Object.keys(kept).length) own[input.role] = kept;
      if (!Object.keys(own).length) delete settings.ownerApproval;
      (settings.accessChanged ??= {})[input.role] = { by: ctx.user.id, at: ctx.nowDT };
      ctx.notify({ toRoles: [input.role], kind: 'mgmt.access.notif.changed', params: { name: nameOfUser(ctx.user) }, link: '/today' });
    },
  }),
];
