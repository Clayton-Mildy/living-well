// Round 17 (KC, point 9): a call about few visits. The front desk and management phone the family of a member who came fewer than 5 days this month and log what
// they said: reached, no answer, or staying. Staff only (the family never gets `visitCalls`). The list itself is read from the visits (rules/fewVisits.ts).
//   visitCall.log { memberId, outcome, note? }
import type { VisitCall } from '../types';
import { defineAction, hasRole } from './framework';
import { requireMember } from './helpers';
import { obj, oneOf, str } from '../rules/mgmtParse';
import { VISIT_CALL_NOTE_MAX, VISIT_CALL_OUTCOMES } from '../rules/fewVisits';
import { ym } from '../util';

export const visitCallActions = [
  defineAction<{ memberId: string; outcome: VisitCall['outcome']; note?: string }>({
    name: 'visitCall.log',
    can: (u) => hasRole(u, 'lobby', 'mgmt'),
    parse(raw) {
      const r = obj(raw);
      const note = str(r.note, VISIT_CALL_NOTE_MAX);
      return { memberId: str(r.memberId, 80, { required: true, field: 'memberId' }), outcome: oneOf(r.outcome, VISIT_CALL_OUTCOMES, 'outcome'), ...(note ? { note } : {}) };
    },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx);
      d.visitCalls ??= {};
      const id = ctx.id('vcall');
      d.visitCalls[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId: m.id, month: ym(ctx.today), outcome: input.outcome, ...(input.note ? { note: input.note } : {}), by: ctx.actor, at: ctx.nowDT };
      ctx.result.id = id;
    },
  }),
];
