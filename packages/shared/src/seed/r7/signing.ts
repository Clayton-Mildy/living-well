// Round 14 (D) seed: online signing of the membership form. Oma Lina's form was sent to Maria for signing yesterday morning (Caca), so the family app has one waiting.
// The roster only: the first member with a billing contact also has a form Signed by that contact yesterday afternoon, so management has a countersign waiting.
// That form carries no signature picture (the demo has no uploaded one; the signed view prints without it). Each snapshot is built as Send builds it, on the day it was sent. No random draws.
import type { ClubState, ISODate, Signing } from '../../types';
import { applicationDataOf } from '../../rules/applicationForm';
import { primaryContact } from '../../rules/core';
import { formDoc, signerOf } from '../../rules/signing';
import { addDays, live } from '../../util';

/** The form of `memberId` as Send leaves it (Draft, then Sent by Caca, at the same minute); undefined when the member has no membership form document. */
function sent(s: ClubState, memberId: string, T: ISODate): Signing | undefined {
  const m = s.members[memberId];
  const doc = m ? formDoc(m) : undefined;
  if (!doc || !signerOf(s, memberId)) return undefined;
  const day = addDays(T, -1);
  const at = `${day}T09:30`;
  const sig: Signing = {
    status: 'sent', meterai: 'e', form: applicationDataOf(s, memberId, day),
    steps: [{ status: 'draft', at, by: 'staff:s1' }, { status: 'sent', at, by: 'staff:s1' }],
  };
  doc.signing = sig;
  return sig;
}

export function seedSigning(s: ClubState, T: ISODate): void {
  sent(s, 'm1', T);
  if (!s.members.m51) return; // the roster only
  const pick = live(s.members).filter((m) => m.id !== 'm1' && !!formDoc(m) && !!primaryContact(s, m.id)).sort((a, b) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : 1))[0];
  const sig = pick ? sent(s, pick.id, T) : undefined;
  if (!pick || !sig) return;
  const signer = signerOf(s, pick.id)!;
  sig.status = 'signed';
  sig.signerName = signer.name;
  sig.steps.push({ status: 'signed', at: `${addDays(T, -1)}T16:00`, by: `family:${signer.id}` });
}
