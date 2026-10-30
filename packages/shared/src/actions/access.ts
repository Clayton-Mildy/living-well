// Round 16 (KC): Admin › Roles. Only the Owner sets what each role opens (Hidden / View / Edit per menu item) and which of a role's changes wait for the Owner.
import type { Draft } from 'immer';
import type { ClubState } from '../types';
import { defineAction, isOwner } from './framework';
import { GRID_ROLES, MENU_KEYS, defaultLevel, type AccessLevel, type GridRole, type OwnerKind } from '../rules/access';
import { bad, bool, obj, oneOf } from '../rules/mgmtParse';

const LEVELS: AccessLevel[] = ['off', 'view', 'edit'];
const KINDS: OwnerKind[] = ['pricing', 'holidays', 'budget'];
const S = (d: Draft<ClubState>) => d as unknown as ClubState;

export const accessActions = [
  defineAction<{ role: GridRole; key: string; level: AccessLevel }>({
    name: 'access.set',
    can: (u) => isOwner(u),
    parse: (raw) => {
      const o = obj(raw);
      const key = typeof o.key === 'string' && MENU_KEYS.includes(o.key) ? o.key : bad('key');
      return { role: oneOf(o.role, GRID_ROLES), key, level: oneOf(o.level, LEVELS) };
    },
    run(d, input) {
      const settings = S(d).club.settings;
      const access = (settings.access ??= {});
      const mine = (access[input.role] ??= {});
      if (input.level === defaultLevel(input.role, input.key)) delete mine[input.key]; else mine[input.key] = input.level;
      if (!Object.keys(mine).length) delete access[input.role];
    },
  }),
  defineAction<{ role: GridRole; kind: OwnerKind; on: boolean }>({
    name: 'access.setOwnerApproval',
    can: (u) => isOwner(u),
    parse: (raw) => {
      const o = obj(raw);
      return { role: oneOf(o.role, GRID_ROLES), kind: oneOf(o.kind, KINDS), on: bool(o.on) };
    },
    run(d, input) {
      const settings = S(d).club.settings;
      const all = (settings.ownerApproval ??= {});
      (all[input.role] ??= {})[input.kind] = input.on;
    },
  }),
];
