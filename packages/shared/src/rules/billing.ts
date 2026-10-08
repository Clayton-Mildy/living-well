// Invoices, payments, refunds, invoice run preview, due-date rule.
import type { ClubState, Invoice, InvoiceLine, ISODate, Member, PriceVersion, YM } from '../types';
import { activeOn, currentMembership, isOpen, membershipStatus, openDaysInMonth, planOn, primaryContact, isPendingRow } from './core';
import { extraDaysFor } from './attendance';
import { onLeaveIn } from './leave';
import { addDays, addMonths, dow, live, sortBy, sum, ym } from '../util';

export type InvoiceStatus = 'void' | 'paid' | 'partial' | 'outstanding' | 'overdue';

export const invoiceTotal = (inv: Invoice) => sum(inv.lines.map((l) => l.amount));
export function paidOn(s: ClubState, invoiceId: string) {
  const paid = sum(live(s.payments).flatMap((p) => p.allocations.filter((a) => a.invoiceId === invoiceId).map((a) => a.amount)));
  const refunded = sum(live(s.refunds).filter((r) => r.invoiceId === invoiceId).map((r) => r.amount));
  return paid - refunded;
}
export const balanceOf = (s: ClubState, inv: Invoice) => (inv.voided ? 0 : invoiceTotal(inv) - paidOn(s, inv.id));
export function invoiceStatus(s: ClubState, inv: Invoice, today: ISODate): InvoiceStatus {
  if (inv.voided) return 'void';
  const bal = balanceOf(s, inv);
  if (bal <= 0) return 'paid';
  if (today > inv.dueDate) return 'overdue';
  return paidOn(s, inv.id) > 0 ? 'partial' : 'outstanding';
}
export const paidDate = (s: ClubState, invoiceId: string): ISODate | undefined =>
  sortBy(live(s.payments).filter((p) => p.allocations.some((a) => a.invoiceId === invoiceId)), (p) => p.receivedOn).pop()?.receivedOn;

export const invoicesOf = (s: ClubState, memberId: string) => sortBy(live(s.invoices).filter((i) => i.memberId === memberId), (i) => i.issueDate + i.number);
export const openInvoicesOf = (s: ClubState, memberId: string, today: ISODate) =>
  invoicesOf(s, memberId).filter((i) => ['outstanding', 'overdue', 'partial'].includes(invoiceStatus(s, i, today)));
/** Unallocated money on a member's account (overpayments). */
export const accountCredit = (s: ClubState, memberId: string) =>
  sum(live(s.payments).filter((p) => p.memberId === memberId).map((p) => p.amount - sum(p.allocations.map((a) => a.amount))));

/** Allocate an amount: chosen invoice first, then oldest due open invoices. */
export function allocate(s: ClubState, memberId: string, amount: number, today: ISODate, preferId?: string) {
  const open = openInvoicesOf(s, memberId, today);
  const order = preferId ? [open.find((i) => i.id === preferId), ...open.filter((i) => i.id !== preferId)].filter(Boolean) as Invoice[] : sortBy(open, (i) => i.dueDate);
  const out: { invoiceId: string; amount: number }[] = [];
  let left = amount;
  for (const inv of order) {
    if (left <= 0) break;
    const take = Math.min(left, balanceOf(s, inv));
    if (take > 0) { out.push({ invoiceId: inv.id, amount: take }); left -= take; }
  }
  return { allocations: out, credit: left };
}

// ---------- prices ----------
export function priceOn(s: ClubState, date: ISODate): PriceVersion {
  const v = sortBy(live(s.prices).filter((p) => p.from <= date), (p) => p.from).pop();
  return v || sortBy(live(s.prices), (p) => p.from)[0];
}
/** The brochure's fees, used when a price list (an older one, a draft) has no figure for one of them. */
export const FEE_DEFAULTS = { registration: 2_500_000, trial: 450_000, leave: 250_000 } as const;
export type Fee = keyof typeof FEE_DEFAULTS;
/** One-time registration fee, the 2-day trial and a month of leave, from a price list. */
export const feeOf = (p: Pick<PriceVersion, Fee> | undefined, k: Fee): number => p?.[k] ?? FEE_DEFAULTS[k];
/** The day a period's invoice run is issued (the 21st). */
export const issueDateOf = (s: ClubState, period: YM): ISODate => `${period}-${String(s.club.settings.issueDay).padStart(2, '0')}`;

// ---------- due date ----------
/** The 28th (a week after the 21st); if closed (weekend/holiday) roll to the next weekday, unless that crosses into next month: then the Friday before. */
export function dueDateFor(s: ClubState, period: YM): ISODate {
  const due = `${period}-${String(s.club.settings.dueDay).padStart(2, '0')}`;
  if (isOpen(s, due)) return due;
  let d = due;
  for (let i = 0; i < 7; i++) {
    d = addDays(d, 1);
    if (ym(d) !== period) break;
    if (isOpen(s, d)) return d;
  }
  d = due;
  while (dow(d) !== 5 || !isOpen(s, d)) d = addDays(d, -1);
  return d;
}

// ---------- invoice run ----------
export interface RunPreviewRow {
  member: Member;
  payerId: string;
  lines: InvoiceLine[];
  total: number;
  skipped?: string;
}
const billedPlanMonths = (s: ClubState, memberId: string) =>
  new Set(live(s.invoices).filter((i) => i.memberId === memberId && !i.voided).flatMap((i) => i.lines.filter((l) => l.kind === 'plan').map((l) => l.refMonth || i.period)));
const billedExtraMonths = (s: ClubState, memberId: string) =>
  new Set(live(s.invoices).filter((i) => i.memberId === memberId && !i.voided).flatMap((i) => i.lines.filter((l) => l.kind === 'extraDay').map((l) => l.refMonth)));

/**
 * Does this member's current membership still owe its one-time registration fee? It is billed on the first invoice of a membership (a new member,
 * or one who came back after the membership stopped), so: not already on an invoice, and no monthly invoice yet since the membership began.
 */
export function registrationDue(s: ClubState, m: Member): boolean {
  const cur = currentMembership(m);
  if (!cur) return false;
  const mine = live(s.invoices).filter((i) => i.memberId === m.id && !i.voided);
  if (mine.some((i) => i.lines.some((l) => l.id === `reg-${cur.start}`))) return false;
  return !mine.some((i) => i.kind === 'monthly' && i.issueDate >= cur.start);
}

/** Lines a member would be billed for `period` (issued on the 21st). */
export function runLinesFor(s: ClubState, m: Member, period: YM, today: ISODate): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const issue = issueDateOf(s, period);
  const price = priceOn(s, issue);
  const billed = billedPlanMonths(s, m.id);
  if (!billed.has(period) && activeOn(m, issue)) {
    if (onLeaveIn(m, period)) {
      // a month of leave (cuti) costs the leave fee instead of the plan
      const fee = feeOf(price, 'leave');
      lines.push({ id: `leave-${period}`, kind: 'plan', label: 'inv.line.leave', params: { month: period }, qty: 1, unit: fee, amount: fee, refMonth: period });
    } else {
      const plan = planOn(m, issue).plan;
      const open = openDaysInMonth(s, period);
      const active = open.filter((d) => activeOn(m, d));
      const full = plan === 'gold' ? price.gold : price.flex;
      const amount = active.length >= open.length || !open.length ? full : Math.round((full * active.length) / open.length / 1000) * 1000;
      lines.push({ id: `plan-${period}`, kind: 'plan', label: plan === 'gold' ? 'inv.line.gold' : 'inv.line.flex', params: { month: period }, qty: 1, unit: amount, amount, refMonth: period });
    }
    if (registrationDue(s, m)) {
      const fee = feeOf(price, 'registration');
      lines.push({ id: `reg-${currentMembership(m).start}`, kind: 'adjustment', label: 'inv.line.registration', qty: 1, unit: fee, amount: fee });
    }
  }
  const prev = addMonths(period, -1);
  if (!billedExtraMonths(s, m.id).has(prev)) {
    const extra = extraDaysFor(s, m, prev, today);
    if (extra.length) lines.push({ id: `extra-${prev}`, kind: 'extraDay', label: 'inv.line.extra', params: { month: prev, n: extra.length }, qty: extra.length, unit: price.extra, amount: extra.length * price.extra, refMonth: prev, dates: extra });
  }
  for (const c of live(s.pendingCharges).filter((c) => c.memberId === m.id && !c.invoiceId)) {
    lines.push({ id: `charge-${c.id}`, kind: 'adjustment', label: c.label, qty: 1, unit: c.amount, amount: c.amount });
  }
  const credit = accountCredit(s, m.id);
  if (credit > 0 && lines.length) lines.push({ id: 'credit', kind: 'credit', label: 'inv.line.credit', qty: 1, unit: -credit, amount: -Math.min(credit, sum(lines.map((l) => l.amount))) });
  return lines;
}
export function runPreview(s: ClubState, period: YM, today: ISODate): RunPreviewRow[] {
  return sortBy(live(s.members).filter((m) => !isPendingRow(m)), (m) => m.firstName).map((m) => {
    const payer = primaryContact(s, m.id);
    const lines = runLinesFor(s, m, period, today);
    return { member: m, payerId: payer?.id || '', lines, total: sum(lines.map((l) => l.amount)), skipped: !payer ? 'noPayer' : !lines.length ? 'nothingToBill' : undefined };
  });
}
export const runDone = (s: ClubState, period: YM) => live(s.invoiceRuns).some((r) => r.period === period);
export const nextInvoiceNumber = (_s: ClubState, period: YM, memberId: string) =>
  `INV-${period.slice(2, 4)}${period.slice(5, 7)}-${memberId.replace(/\D/g, '').padStart(3, '0')}`;

// ---------- suspension and stop (the brochure's terms) ----------
// An invoice still unpaid on the 1st after its due month puts the membership on hold until it is paid; still unpaid on the 3rd, with no word from the family
// ("dan tidak ada pemberitahuan": finance has no call note on the invoice), it stops (re-registration, with its fee again).
// Nothing is stored for the hold: it is read from the invoices, so paying lifts it at once.
export interface Suspension {
  invoiceId: string;
  number: string;
  period?: YM;
  dueDate: ISODate;
  balance: number;
  /** first day of the hold */
  since: ISODate;
  /** the day the membership stops if the invoice is still unpaid */
  stopOn: ISODate;
  /** the family told finance (a call note is on the invoice): the terms stop a membership only when there was no word, so it stays on hold until paid */
  told: boolean;
}
/** When an unpaid invoice puts its member on hold, and when it stops the membership. */
export function suspendDatesFor(s: ClubState, inv: Pick<Invoice, 'dueDate'>): { since: ISODate; stopOn: ISODate } {
  const { suspendDay = 1, stopDay = 3 } = s.club.settings;
  const since = `${addMonths(ym(inv.dueDate), 1)}-${String(suspendDay).padStart(2, '0')}`;
  return { since, stopOn: addDays(since, Math.max(0, stopDay - suspendDay)) };
}
/** Debt from before a membership began (a member who came back after a stop) does not hold the new membership. */
const ofCurrentMembership = (m: Member, dueDate: ISODate) => dueDate >= (currentMembership(m)?.start ?? '');
/** Unpaid monthly invoices, oldest due first, with the days they act on. */
function unpaidMonthly(s: ClubState): (Suspension & { memberId: string })[] {
  const out: (Suspension & { memberId: string })[] = [];
  // what every invoice has been paid, in one pass (`balanceOf` per invoice scans all payments: with months of paid invoices that is slow inside the daily job)
  const paid = new Map<string, number>();
  for (const p of live(s.payments)) for (const a of p.allocations) paid.set(a.invoiceId, (paid.get(a.invoiceId) ?? 0) + a.amount);
  for (const r of live(s.refunds)) paid.set(r.invoiceId, (paid.get(r.invoiceId) ?? 0) - r.amount);
  for (const inv of live(s.invoices)) {
    if (inv.kind !== 'monthly' || inv.voided) continue;
    const balance = invoiceTotal(inv) - (paid.get(inv.id) ?? 0);
    if (balance > 0) out.push({ memberId: inv.memberId, invoiceId: inv.id, number: inv.number, period: inv.period, dueDate: inv.dueDate, balance, ...suspendDatesFor(s, inv), told: inv.callNotes.length > 0 });
  }
  return sortBy(out, (x) => x.dueDate + x.number);
}
/** Every member whose membership is on hold on `today` (an unpaid monthly invoice past its hold day), keyed by member id; the oldest invoice wins. */
export function suspensions(s: ClubState, today: ISODate): Record<string, Suspension> {
  // a finished (frozen) state never changes, so the screens' many calls (one per list row) share one pass over the invoices
  const frozen = Object.isFrozen(s);
  const hit = frozen ? holdCache.get(s)?.get(today) : undefined;
  if (hit) return hit;
  const out = suspensionsOf(s, today);
  if (frozen) holdCache.set(s, (holdCache.get(s) ?? new Map()).set(today, out));
  return out;
}
const holdCache = new WeakMap<ClubState, Map<ISODate, Record<string, Suspension>>>();
function suspensionsOf(s: ClubState, today: ISODate): Record<string, Suspension> {
  const out: Record<string, Suspension> = {};
  for (const { memberId, ...x } of unpaidMonthly(s)) {
    const m = s.members[memberId];
    if (!m || m.deletedAt || isPendingRow(m) || x.since > today || out[memberId] || membershipStatus(m, today) === 'ended' || !ofCurrentMembership(m, x.dueDate)) continue;
    out[memberId] = x;
  }
  return out;
}
export const suspensionOf = (s: ClubState, memberId: string, today: ISODate): Suspension | undefined => suspensions(s, today)[memberId];
/** Members whose unpaid invoice has reached the stop day: their membership ends (the daily job does it). */
export const stopsDue = (s: ClubState, today: ISODate): (Suspension & { memberId: string })[] => {
  const all = unpaidMonthly(s);
  const told = new Set(all.filter((x) => x.told).map((x) => x.memberId)); // the family gave notice about what it owes: held until paid, not stopped
  const seen = new Set<string>();
  return all.filter((x) => {
    const m = s.members[x.memberId];
    if (told.has(x.memberId)) return false;
    if (!m || m.deletedAt || isPendingRow(m) || x.stopOn > today || seen.has(x.memberId) || membershipStatus(m, today) === 'ended' || currentMembership(m).lastDay || !ofCurrentMembership(m, x.dueDate)) return false;
    seen.add(x.memberId);
    return true;
  });
};
