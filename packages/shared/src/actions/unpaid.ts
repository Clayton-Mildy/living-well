// Round 14: a call about an overdue invoice (Next month > Unpaid).
//   unpaid.call { invoiceId, outcome, promisedOn?, note? }
// The front desk, finance and management note what the family said: a promise (with the day), "says paid", a dispute, or no answer. The first call creates the
// invoice's follow-up row; the list itself is read from the invoices (rules/unpaid.ts), so paying takes the invoice off it.
import type { ClubState, UnpaidOutcome } from '../types';
import { defineAction, hasRole } from './framework';
import { obj, oneOf, txt } from './members';
import { shortOf } from './helpers';
import { isISO } from '../rules/members';
import { balanceOf } from '../rules/billing';
import { unpaidFollowUpId } from '../rules/unpaid';

export const UNPAID_OUTCOMES: UnpaidOutcome[] = ['promised', 'paid', 'disputed', 'noAnswer'];

export const unpaidActions = [
  defineAction<{ invoiceId: string; outcome: UnpaidOutcome; promisedOn?: string; note?: string }>({
    name: 'unpaid.call',
    can: (u) => hasRole(u, 'lobby', 'finance', 'mgmt'),
    parse: (raw) => {
      const o = obj(raw);
      const outcome = oneOf(o.outcome, UNPAID_OUTCOMES);
      const note = txt(o.note, 400);
      const promisedOn = txt(o.promisedOn, 10);
      return { invoiceId: txt(o.invoiceId, 80), outcome, ...(outcome === 'promised' ? { promisedOn } : {}), ...(note ? { note } : {}) };
    },
    run(d, input, ctx) {
      const s = d as unknown as ClubState;
      const inv = s.invoices[input.invoiceId];
      if (!inv || inv.deletedAt) ctx.fail('err.notFound');
      if (inv.voided) ctx.fail('finance.err.invoiceVoid');
      if (balanceOf(s, inv) <= 0) ctx.fail('finance.err.invoicePaid');
      if (input.outcome === 'promised' && (!isISO(input.promisedOn ?? '') || input.promisedOn! < ctx.today)) ctx.fail('unpaid.err.promiseDate');

      d.unpaidFollowUps ??= {};
      const id = unpaidFollowUpId(inv.id);
      const f = d.unpaidFollowUps[id] ?? (d.unpaidFollowUps[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, invoiceId: inv.id, memberId: inv.memberId, calls: [] });
      f.calls.push({ at: ctx.nowDT, by: ctx.actor, outcome: input.outcome, ...(input.promisedOn ? { promisedOn: input.promisedOn } : {}), ...(input.note ? { note: input.note } : {}) });
      ctx.feed({ icon: 'call', key: `unpaid.feed.${input.outcome}`, memberId: inv.memberId, params: { name: shortOf(d, inv.memberId), number: inv.number, date: input.promisedOn ?? '' } });
      ctx.result.followUpId = id;
    },
  }),
];
