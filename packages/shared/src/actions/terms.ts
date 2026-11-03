// Round 17 (KC): terms and conditions. Management and the Owner publish a new version (applies at once); every family login is told and has to agree again.
// A family user's other actions wait until they have agreed to the current version (see `execute`).
import type { Draft } from 'immer';
import type { ClubState } from '../types';
import { defineAction, isFamily, isMgmt, nameOfUser } from './framework';
import { bad, int, obj } from '../rules/mgmtParse';
import { currentTerms } from '../rules/terms';
import { isPendingRow } from '../rules/core';
import { live } from '../util';

export const TERMS_MAX = 20000;
const S = (d: Draft<ClubState>) => d as unknown as ClubState;
const text = (v: unknown, required: boolean): string => {
  if (v === undefined || v === null) return required ? bad('en') : '';
  if (typeof v !== 'string') return bad();
  const t = v.trim();
  if ((required && !t) || t.length > TERMS_MAX) return bad();
  return t;
};

export const termsActions = [
  defineAction<{ en: string; id: string }>({
    name: 'terms.publish',
    can: (u) => isMgmt(u),
    parse: (raw) => { const o = obj(raw); return { en: text(o.en, true), id: text(o.id, false) }; },
    run(d, input, ctx) {
      const settings = S(d).club.settings;
      const list = (settings.terms ??= []);
      const version = (list.at(-1)?.version ?? 0) + 1;
      list.push({ version, en: input.en, id: input.id, publishedAt: ctx.nowDT, publishedBy: ctx.user.id });
      const to = live(S(d).familyContacts).filter((c) => c.username && !isPendingRow(c)).map((c) => c.id);
      if (to.length) ctx.notify({ toUsers: to, kind: 'terms.notif.updated', params: { version, name: nameOfUser(ctx.user) }, link: '/me?terms=1', severity: 'attention' });
      ctx.result.version = version;
    },
  }),
  defineAction<{ version: number }>({
    name: 'terms.agree',
    can: (u) => isFamily(u),
    parse: (raw) => ({ version: int(obj(raw).version, 1, 1_000_000, 'version') }),
    run(d, input, ctx) {
      const cur = currentTerms(S(d));
      if (cur?.version !== input.version) ctx.fail('err.invalid');
      const fc = d.familyContacts[ctx.user.id];
      if (!fc) ctx.fail('err.notFound');
      fc.termsAgreed = { version: input.version, at: ctx.nowDT };
    },
  }),
];
