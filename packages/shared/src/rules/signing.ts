// Round 14 (D): online signing of the membership form. Pure reads: where the form stands, who may sign it and the timeline shown on the document row.
import type { ClubState, DT, FamilyContact, Actor, Member, MemberDocument, SignStatus, Signing } from '../types';
import { primaryContact } from './core';

export const SIGN_STATUSES: SignStatus[] = ['draft', 'sent', 'signed', 'countersigned', 'stamped'];

/** The member's membership form document, if it has one. */
export const formDoc = (m: Member): MemberDocument | undefined => m.documents.find((d) => d.type === 'membershipForm');
export const signingOf = (m: Member): Signing | undefined => formDoc(m)?.signing;

/** The timeline of the form. e-Meterai: all five statuses in order, the reached ones with the latest step's time and person, the rest bare. Physical: only the steps recorded. */
export function signTrail(sig: Signing): { status: SignStatus; at?: DT; by?: Actor }[] {
  const last = (st: SignStatus) => [...sig.steps].reverse().find((x) => x.status === st);
  if (sig.meterai === 'physical') return sig.steps.map((x) => ({ status: x.status, at: x.at, by: x.by }));
  const reached = SIGN_STATUSES.indexOf(sig.status);
  return SIGN_STATUSES.map((status, i) => {
    const step = i <= reached ? last(status) : undefined;
    return step ? { status, at: step.at, by: step.by } : { status };
  });
}

/** The one person who signs the form: the billing (primary) contact. */
export const signerOf = (s: ClubState, memberId: string): FamilyContact | undefined => primaryContact(s, memberId);
export const canSign = (s: ClubState, memberId: string, familyId: string): boolean => signerOf(s, memberId)?.id === familyId;

/** "+6281210904471" → "+62 ••• 4471": where the code "was sent" without showing the whole number. */
export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const cc = d.startsWith('62') ? '62' : d.slice(0, 2);
  return `+${cc} ••• ${d.slice(-4)}`;
}
