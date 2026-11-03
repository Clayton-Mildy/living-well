// Round 17 (KC): the terms and conditions. Versions live in the club settings (the last is current); a family contact agrees to a version, and until they have
// agreed to the current one the server refuses their other actions (`execute`). Placeholders in the text are filled from the settings so the terms never contradict the app.
import type { ClubState, FamilyContact, Lang, TermsVersion } from '../types';
import { live } from '../util';
import { isPendingRow, linksOfFamily } from './core';
import { noticeDays } from './notice';

/** The version families are asked to agree to, or undefined while none is published. */
export const currentTerms = (s: Pick<ClubState, 'club'>): TermsVersion | undefined => s.club.settings.terms?.at(-1);

/** `first`: never agreed; `updated`: agreed to an older version; null: up to date, or no terms published. Reads the contact the caller passes: use the live row in the state, not a signed-in snapshot. */
export function needsTerms(s: ClubState, contact: FamilyContact): 'first' | 'updated' | null {
  const cur = currentTerms(s);
  if (!cur) return null;
  if (!contact.termsAgreed) return 'first';
  return contact.termsAgreed.version === cur.version ? null : 'updated';
}

/** The current text in `lang` (Indonesian falls back to English when empty) with {noticeDays}, {issueDay}, {dueDay} and {flexQuota} filled in; '' when no terms are published. */
export function termsText(s: ClubState, lang: Lang): string {
  const cur = currentTerms(s);
  if (!cur) return '';
  const raw = lang === 'id' && cur.id.trim() ? cur.id : cur.en;
  const vars: Record<string, number> = { noticeDays: noticeDays(s), issueDay: s.club.settings.issueDay, dueDay: s.club.settings.dueDay, flexQuota: s.club.settings.flexQuota };
  return raw.replace(/\{(noticeDays|issueDay|dueDay|flexQuota)\}/g, (_m, k: string) => String(vars[k]));
}

export type TermsBlock = { kind: 'h' | 'li' | 'p'; text: string };
/** "# " starts a heading, "- " a bullet, any other non-empty line is a paragraph. */
export function termsBlocks(text: string): TermsBlock[] {
  const out: TermsBlock[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('# ')) out.push({ kind: 'h', text: t.slice(2).trim() });
    else if (t.startsWith('- ')) out.push({ kind: 'li', text: t.slice(2).trim() });
    else out.push({ kind: 'p', text: t });
  }
  return out;
}

/** Contacts who can sign in (they have a username): how many agreed to the current version, and who has not yet, with the members they are family for. */
export function termsAgreement(s: ClubState): { agreed: number; total: number; notYet: { contactId: string; memberIds: string[] }[] } {
  const cur = currentTerms(s);
  const contacts = live(s.familyContacts).filter((c) => c.username && !isPendingRow(c));
  const notYet = contacts
    .filter((c) => !cur || c.termsAgreed?.version !== cur.version)
    .map((c) => ({ contactId: c.id, memberIds: linksOfFamily(s, c.id).map((l) => l.memberId) }));
  return { agreed: contacts.length - notYet.length, total: contacts.length, notYet };
}
