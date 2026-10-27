// Round 14 (D): online signing of the membership form (simulated WhatsApp link, simulated OTP, simulated e-Meterai).
//   signing.send     { memberId }                               front desk: snapshot the form and send it to the billing contact (Resend takes a new snapshot)
//   signing.sign     { memberId, signatureMediaId, otp }        the billing contact signs: a drawn signature and any 6 digits
//   signing.physical { memberId, mediaId, fileName? }           front desk: the paper route, a scan signed over a physical meterai goes straight to Stamped (gated like any document)
//   signing.stamp    { memberId, serial, at }                   the system only: the server affixes the e-Meterai to a countersigned form
// Countersigning (and sending a form back) is in actions/approvals.ts; the status moves are rules/signing.ts.
import type { Draft } from 'immer';
import type { ClubState, MemberDocument, Signing, SignStatus } from '../types';
import { defineAction, hasRole, isFamily, DomainError, type ActionDef, type Ctx } from './framework';
import { editable, mediaIdOf, obj, txt } from './members';
import { requireMember, shortOf } from './helpers';
import { displayName } from '../rules/core';
import { docIdFor, SIM_FILE } from '../rules/members';
import { applicationDataOf } from '../rules/applicationForm';
import { canSign, formDoc, signerOf } from '../rules/signing';

const frontDesk = (u: Parameters<typeof hasRole>[0]) => hasRole(u, 'lobby', 'mgmt');
const bad = (code: string): never => { throw new DomainError(code); };
const feed = (ctx: Ctx, d: Draft<ClubState>, memberId: string, icon: string, key: string, extra: Record<string, string | number> = {}) =>
  ctx.feed({ icon, key: `members.feed.${key}`, params: { name: shortOf(d, memberId), ...extra }, memberId });
const target = (memberId: string) => ({ type: 'member' as const, id: memberId, memberId });
const memberOf = (raw: unknown) => ({ memberId: txt(obj(raw).memberId, 60) });
const CLOSED: SignStatus[] = ['signed', 'countersigned', 'stamped'];

/** The member's membership form document, created (as a request) when the member has none yet. */
function docOf(d: Draft<ClubState>, memberId: string, ctx: Ctx): { doc: Draft<MemberDocument>; fresh: boolean } {
  const m = editable(d, memberId, ctx);
  const found = formDoc(m);
  if (found) return { doc: found as Draft<MemberDocument>, fresh: false };
  m.documents.push({ id: docIdFor(m.id, 'membershipForm'), type: 'membershipForm', status: 'requested', on: ctx.today, by: ctx.actor });
  return { doc: m.documents[m.documents.length - 1] as Draft<MemberDocument>, fresh: true };
}

export const signingActions: ActionDef[] = [
  defineAction<{ memberId: string }>({
    name: 'signing.send',
    can: (u) => frontDesk(u),
    parse: memberOf,
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const signer = signerOf(d as ClubState, m.id);
      if (!signer) return ctx.fail('sign.err.noSigner');
      const { doc } = docOf(d, m.id, ctx);
      const old = doc.signing;
      if (old && CLOSED.includes(old.status)) ctx.fail('sign.err.notNow');
      const sent = { status: 'sent' as const, at: ctx.nowDT, by: ctx.actor };
      const steps = old?.steps.length ? [...old.steps, sent] : [{ ...sent, status: 'draft' as const }, sent];
      doc.signing = { status: 'sent', meterai: 'e', form: applicationDataOf(d as ClubState, m.id, ctx.today), steps } as Signing;
      if (doc.status !== 'onFile') { doc.status = 'requested'; doc.on = ctx.today; doc.by = ctx.actor; }
      ctx.notify({ toUsers: [signer.id], kind: 'sign.notif.toSign', params: { name: displayName(m) }, link: `/profile?member=${m.id}&sign=1`, memberId: m.id });
      feed(ctx, d, m.id, 'draw', 'docRequested');
    },
  }),

  defineAction<{ memberId: string; signatureMediaId: string; otp: string }>({
    name: 'signing.sign',
    can: (u, i, s) => isFamily(u) && canSign(s, i.memberId, u.id),
    parse: (raw) => {
      const o = obj(raw);
      const otp = txt(o.otp, 12);
      if (!/^\d{6}$/.test(otp)) bad('err.invalid');
      const signatureMediaId = mediaIdOf(o.signatureMediaId) ?? bad('err.invalid');
      return { ...memberOf(o), signatureMediaId, otp };
    },
    run(d, input, ctx) {
      const m = editable(d, input.memberId, ctx);
      const sig = formDoc(m)?.signing as Draft<Signing> | undefined;
      if (!sig || sig.status !== 'sent') ctx.fail('sign.err.notNow');
      sig!.status = 'signed';
      sig!.signatureMediaId = input.signatureMediaId;
      sig!.signerName = signerOf(d as ClubState, m.id)?.name || '';
      sig!.steps.push({ status: 'signed', at: ctx.nowDT, by: ctx.actor });
      feed(ctx, d, m.id, 'draw', 'docUploaded');
    },
  }),

  defineAction<{ memberId: string; mediaId: string; fileName?: string }>({
    name: 'signing.physical',
    can: (u) => frontDesk(u),
    parse: (raw) => {
      const o = obj(raw);
      const mediaId = mediaIdOf(o.mediaId) ?? bad('err.invalid');
      const fileName = txt(o.fileName, 120);
      return { ...memberOf(o), mediaId, ...(fileName ? { fileName } : {}) };
    },
    review: { policy: 'gate', section: 'docsConsent', op: 'update', target: (i) => target(i.memberId) },
    run(d, input, ctx) {
      const { doc } = docOf(d, input.memberId, ctx);
      Object.assign(doc, { status: 'onFile', fileName: input.fileName || SIM_FILE.membershipForm, mediaId: input.mediaId, on: ctx.today, via: 'staff', by: ctx.actor });
      doc.signing = { status: 'stamped', meterai: 'physical', steps: [...(doc.signing?.steps || []), { status: 'stamped', at: ctx.nowDT, by: ctx.actor }] } as Signing;
      feed(ctx, d, input.memberId, 'description', 'docs', { type: 'membershipForm', by: ctx.actor });
    },
  }),

  defineAction<{ memberId: string; serial: string; at: string }>({
    name: 'signing.stamp',
    can: (u) => u.kind === 'staff' && u.id === 'system',
    parse: (raw) => {
      const o = obj(raw);
      const serial = txt(o.serial, 60);
      const at = txt(o.at, 16);
      if (!serial || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) bad('err.invalid');
      return { ...memberOf(o), serial, at };
    },
    run(d, input, ctx) {
      const m = requireMember(d, input.memberId, ctx); // not editable(): a form countersigned just before the membership ended must still be stamped
      const doc = formDoc(m) as Draft<MemberDocument> | undefined;
      const sig = doc?.signing;
      if (!doc || !sig || sig.status !== 'countersigned' || sig.meterai !== 'e') ctx.fail('sign.err.notNow');
      sig!.status = 'stamped';
      sig!.meteraiSerial = input.serial;
      sig!.steps.push({ status: 'stamped', at: input.at, by: 'system' });
      Object.assign(doc!, { status: 'onFile', on: input.at.slice(0, 10), via: 'form', by: 'system' });
      const signer = signerOf(d as ClubState, m.id);
      if (signer) ctx.notify({ toUsers: [signer.id], kind: 'sign.notif.stamped', params: { name: displayName(m) }, link: `/profile?member=${m.id}`, memberId: m.id });
      feed(ctx, d, m.id, 'description', 'docs', { type: 'membershipForm', by: 'system' });
    },
  }),
];
