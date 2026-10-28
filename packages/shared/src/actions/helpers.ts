// Small helpers shared by action modules.
import type { Draft } from 'immer';
import type { Attendance, ClubState, DT, ISODate, MemberDocument, Signing } from '../types';
import type { Ctx } from './framework';
import { attId } from '../rules/attendance';
import { live } from '../util';
import { displayName, primaryContact } from '../rules/core';
import { applicationDataOf } from '../rules/applicationForm';
import { formDoc } from '../rules/signing';

export function ensureAttendance(d: Draft<ClubState>, date: ISODate, memberId: string, ctx: Ctx): Draft<Attendance> {
  const id = attId(date, memberId);
  if (!d.attendance[id]) d.attendance[id] = { id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor, memberId, date, queueAdds: [], dismissed: [], edits: [] };
  return d.attendance[id];
}
/** Family users (ids) who should hear about a member: approved links with app access. */
export function familyUserIds(d: Draft<ClubState> | ClubState, memberId: string, opts: { healthAlerts?: boolean } = {}): string[] {
  return live(d.familyLinks as ClubState['familyLinks'])
    .filter((l) => l.memberId === memberId && l.appAccess && (!l.review || l.review.status === 'approved') && (!opts.healthAlerts || l.healthAlerts))
    .map((l) => l.familyId);
}
export const shortOf = (d: Draft<ClubState> | ClubState, memberId: string) => (d.members[memberId] ? displayName(d.members[memberId]) : memberId);
export function requireMember(d: Draft<ClubState>, memberId: string, ctx: Ctx) {
  const m = d.members[memberId];
  if (!m || m.deletedAt) ctx.fail('err.notFound');
  return m;
}

/** Round 14 (D), R-F1: the older document actions (request, staff upload, family upload) replace a whole document. On the membership form they refuse while its
 *  signing is under way or done (Sent and later), and keep a Draft signing on the new document instead of dropping it. Returns what to spread onto it. */
export function carrySigning(doc: MemberDocument | undefined, ctx: Ctx): { signing?: Signing } {
  const sig = doc?.type === 'membershipForm' ? doc.signing : undefined;
  if (!sig) return {};
  if (sig.status !== 'draft') ctx.fail('sign.err.notNow');
  return { signing: sig };
}

/** Round 15 (R5): the family member present signed the form at registration. The membership form gets a signing that is already Signed in person:
 *  Draft, Sent and Signed all at the creation time (Draft and Sent by the staff user, Signed by the billing contact, who is the signer), the form as it is
 *  at creation, and e-Meterai as the route, so the countersign and the stamp follow exactly as after an online signature. Call it once the member, the
 *  contact and the link exist. No signature given: nothing changes. */
/** `signedAt`: when the family signed, if it was earlier than now (on the online form, KC 28 Oct). */
export function signAtRegistration(d: Draft<ClubState>, memberId: string, signatureMediaId: string | undefined, ctx: Ctx, signedAt?: DT): void {
  if (!signatureMediaId) return;
  const signer = primaryContact(d as ClubState, memberId);
  const doc = d.members[memberId] && formDoc(d.members[memberId]);
  if (!signer || !doc) return ctx.fail('sign.err.noSigner');
  const at = ctx.nowDT;
  doc.signing = {
    status: 'signed', meterai: 'e', form: applicationDataOf(d as ClubState, memberId, ctx.today), signerId: signer.id, signerName: signer.name, signatureMediaId,
    steps: [{ status: 'draft', at: signedAt ?? at, by: ctx.actor }, { status: 'sent', at: signedAt ?? at, by: ctx.actor }, { status: 'signed', at: signedAt ?? at, by: `family:${signer.id}` }],
  } as Signing;
}
