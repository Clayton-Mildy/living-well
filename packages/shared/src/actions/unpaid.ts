// Round 14: a call about an overdue invoice (Next month > Unpaid).
//   unpaid.call { invoiceId, outcome, promisedOn?, note? }
// The front desk, finance and management note what the family said: a promise (with the day), "says paid", a dispute, or no answer. The first call creates the
// invoice's follow-up row (and, when the family spoke, an invoice call note); the list itself is read from the invoices (rules/unpaid.ts), so paying takes the invoice off it.
import type { ClubState, UnpaidOutcome } from '../types';
import { defineAction, hasRole } from './framework';
import { obj, oneOf, txt } from './members';
import { shortOf } from './helpers';
import { isISO } from '../rules/members';
import { balanceOf } from '../rules/billing';
import { unpaidFollowUpId } from '../rules/unpaid';

export const UNPAID_OUTCOMES: UnpaidOutcome[] = ['promised', 'paid', 'disputed', 'noAnswer'];

const NOTE_LABEL: Record<UnpaidOutcome, string> = { promised: 'Promised to pay', paid: 'Says it is paid', disputed: 'Disputes the invoice', noAnswer: 'No answer' };
/** the invoice call note of a call: "Promised to pay on 2026-10-23: the daughter transfers after payday" (stored text, so not translated) */
const noteText = (outcome: UnpaidOutcome, promisedOn?: string, note?: string) => `${NOTE_LABEL[outcome]}${promisedOn ? ` on ${promisedOn}` : ''}${note ? `: ${note}` : ''}`;

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
      // what the family said is also a call note on the invoice (the shape Billing writes), because the stop rule reads those: a family that gave word is held until it pays,
      // not stopped. "No answer" is no word, so it leaves no note. Same time and person as the call: the sheet's history shows the pair once.
      if (input.outcome !== 'noAnswer') inv.callNotes.push({ at: ctx.nowDT, by: ctx.actor, text: noteText(input.outcome, input.promisedOn, input.note) });
      ctx.feed({ icon: 'call', key: `unpaid.feed.${input.outcome}`, memberId: inv.memberId, params: { name: shortOf(d, inv.memberId), number: inv.number, date: input.promisedOn ?? '' } });
      ctx.result.followUpId = id;
    },
  }),
];
