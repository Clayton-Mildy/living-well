// Round 8 (family Me, Billing, Contacts): small pure helpers. What a contact pays and who pays the rest, short amounts ("Rp 2,7 jt"),
// the front desk's weekdays, and the public contacts grouped the way the Contacts page lists them.
import type { ClubState, DirectoryContact, FamilyContact, ISODate } from '../types';
import { isPrimaryFor } from './core';
import { billingContactOf, invoiceRows, openInvoiceRows, openTotal, type InvRow } from './family';
import { live, sortBy } from '../util';

/** "Rp 2,7 jt" / "Rp 3,95 jt" / "Rp 650 rb" / "Rp 0": the compact amount of the invoice list (Indonesian short forms in both languages). */
export function rpShort(n: number): string {
  const a = Math.abs(Math.round(n));
  const sign = n < 0 ? '-' : '';
  const dec = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');
  if (a >= 1_000_000) return `${sign}Rp ${dec(a / 1_000_000)} jt`;
  if (a >= 1_000) return `${sign}Rp ${dec(a / 1_000)} rb`;
  return `${sign}Rp ${a}`;
}

export interface FamilyBill {
  /** every invoice of the members (void left out), any status */
  rows: InvRow[];
  /** invoices still to pay (including overdue and part paid), oldest due date first */
  open: InvRow[];
  /** the open invoices of the members this contact pays for (the primary contact) */
  payable: InvRow[];
  /** this contact pays for at least one of the members */
  pays: boolean;
  /** what the dark card adds up: the invoices this contact pays, or (when nobody here is theirs) all the open ones for information */
  shown: InvRow[];
  total: number;
  overdue: boolean;
  /** the oldest due date among `shown` */
  firstDue: ISODate | null;
  /** the contacts who look after billing for the members this contact does not pay for (one entry each) */
  payers: FamilyContact[];
}
export function familyBill(s: ClubState, familyId: string, memberIds: string[], today: ISODate): FamilyBill {
  const rows = invoiceRows(s, memberIds, today);
  const open = openInvoiceRows(rows);
  const payable = open.filter((r) => isPrimaryFor(s, familyId, r.member.id));
  const pays = memberIds.some((id) => isPrimaryFor(s, familyId, id));
  const shown = pays ? payable : open;
  const seen = new Set<string>();
  const payers: FamilyContact[] = [];
  for (const id of memberIds) {
    if (isPrimaryFor(s, familyId, id)) continue;
    const c = billingContactOf(s, id);
    if (c && c.id !== familyId && !seen.has(c.id)) { seen.add(c.id); payers.push(c); }
  }
  return { rows, open, payable, pays, shown, total: openTotal(shown), overdue: shown.some((r) => r.status === 'overdue'), firstDue: shown[0]?.inv.dueDate ?? null, payers };
}

/** The Contacts page's groups: the doctors, then the hospital and pharmacy (services), then any other public contact; each in name order. */
export interface ContactGroup { kind: DirectoryContact['kind']; items: DirectoryContact[] }
export function familyContactGroups(s: ClubState): ContactGroup[] {
  const pub = live(s.directory).filter((d) => d.public);
  return (['doctor', 'service', 'supplier'] as const)
    .map((kind) => ({ kind, items: sortBy(pub.filter((d) => d.kind === kind), (d) => d.name) }))
    .filter((g) => g.items.length);
}
