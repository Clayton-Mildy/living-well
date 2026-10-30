// Round 16: simulated emails to the family. Nothing leaves the server: an `emails` row records what was sent, to whom, about what.
//   sendEmail / emailInvoice / maybeEmailContract are helpers other actions call; email.resendContract { memberId } is the profile's Send again.
// The contract goes to the billing contact once the member is active and the membership form is fully signed (stamped), whichever comes second, and once per
// signing (Send again sends more). Invoices go to the invoice's payer when issued and when they move to a new billing contact.
import type { Draft } from 'immer';
import type { ClubState, EmailRow, Member } from '../types';
import { defineAction, hasRole, type ActionDef, type Ctx } from './framework';
import { requireMember, shortOf } from './helpers';
import { isPendingRow, membershipStatus, primaryContact } from '../rules/core';
import { formDoc } from '../rules/signing';
import { live, rp, sum } from '../util';

const frontDesk = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'mgmt');

export interface EmailIn { familyId: string; memberId: string; kind: EmailRow['kind']; subject: string; params: Record<string, string | number>; ref: EmailRow['ref'] }

/** Record one email to a family contact (status `noAddress` when they have no email on file). */
export function sendEmail(d: Draft<ClubState>, ctx: Ctx, e: EmailIn): EmailRow {
  d.emails ??= {};
  const c = d.familyContacts[e.familyId];
  const to = c?.email ?? '';
  const id = ctx.id('em');
  const row: EmailRow = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, to, toName: c?.name ?? '', familyId: e.familyId, memberId: e.memberId, kind: e.kind, subject: e.subject, params: e.params, ref: e.ref, sentAt: ctx.nowDT, sentBy: ctx.actor, status: to ? 'sent' : 'noAddress' };
  d.emails[id] = row;
  return row;
}

/** Email an invoice to its payer. */
export function emailInvoice(d: Draft<ClubState>, ctx: Ctx, invoiceId: string): EmailRow | undefined {
  const inv = d.invoices[invoiceId];
  if (!inv || !inv.payerFamilyId) return undefined;
  return sendEmail(d, ctx, { familyId: inv.payerFamilyId, memberId: inv.memberId, kind: 'invoice', subject: 'email.subj.invoice', params: { number: inv.number, amount: rp(sum(inv.lines.map((l) => l.amount))), name: shortOf(d, inv.memberId) }, ref: { type: 'invoice', id: inv.id } });
}

/** The ref a contract email carries: the member and the signing's last step, so each signing is sent once. */
const contractRef = (m: Member): EmailRow['ref'] | undefined => {
  const sig = formDoc(m)?.signing;
  const last = sig?.steps.at(-1)?.at;
  return sig && sig.status === 'stamped' && last ? { type: 'document', id: `${m.id}:${last}` } : undefined;
};

function emailContract(d: Draft<ClubState>, ctx: Ctx, m: Member, ref: EmailRow['ref']): EmailRow | undefined {
  const payer = primaryContact(d as unknown as ClubState, m.id);
  if (!payer) return undefined;
  const row = sendEmail(d, ctx, { familyId: payer.id, memberId: m.id, kind: 'contract', subject: 'email.subj.contract', params: { name: shortOf(d, m.id) }, ref });
  if (row.status === 'sent') ctx.result.emailedTo = row.to;
  return row;
}

/** Send the signed contract if the member is active, the form is stamped and this signing was not emailed yet. */
export function maybeEmailContract(d: Draft<ClubState>, memberId: string, ctx: Ctx): void {
  const m = d.members[memberId] as Member | undefined;
  if (!m || m.deletedAt || isPendingRow(m) || membershipStatus(m, ctx.today) === 'ended') return;
  const ref = contractRef(m);
  if (!ref || live(d.emails || {}).some((e) => e.kind === 'contract' && e.ref.id === ref.id)) return;
  emailContract(d, ctx, m, ref);
}

export const emailActions: ActionDef[] = [
  defineAction<{ memberId: string }>({
    name: 'email.resendContract',
    can: frontDesk,
    parse: (raw) => ({ memberId: String((raw as { memberId?: unknown })?.memberId ?? '').slice(0, 60) }),
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx) as Member;
      const ref = contractRef(m);
      if (!ref) ctx.fail('sign.err.notNow');
      if (!emailContract(d, ctx, m, ref!)) ctx.fail('members.err.noBillingContact');
    },
  }),
];
