// Round 16: the simulated outbox — the contract and the invoices "emailed" to the family. Pure reads; the writes are in actions/emails.ts.
import type { ClubState, EmailRow } from '../types';
import { live, sortBy } from '../util';

/** A plausible email address (one @, a dot in the domain, no spaces). */
export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
/** The emails about one document or invoice, newest first. */
export const emailsFor = (s: ClubState, ref: EmailRow['ref']): EmailRow[] =>
  sortBy(live(s.emails || {}).filter((e) => e.ref.type === ref.type && e.ref.id === ref.id), (e) => e.sentAt + e.id, -1);
export const lastEmail = (s: ClubState, ref: EmailRow['ref']): EmailRow | undefined => emailsFor(s, ref)[0];
/** The contract emails of a member, newest first (whatever signing they were for). */
export const contractEmails = (s: ClubState, memberId: string): EmailRow[] =>
  sortBy(live(s.emails || {}).filter((e) => e.kind === 'contract' && e.memberId === memberId), (e) => e.sentAt + e.id, -1);
/** Every email about one member (contracts and invoices), newest first. */
export const emailsOfMember = (s: ClubState, memberId: string): EmailRow[] =>
  sortBy(live(s.emails || {}).filter((e) => e.memberId === memberId), (e) => e.sentAt + e.id, -1);
