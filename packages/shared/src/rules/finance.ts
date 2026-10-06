// Finance selectors and rules that go beyond rules/billing.ts and rules/budget.ts (those two files are owned by the coordinator).
// Corrections made here instead of there:
//  - runPlan(): account credit is applied once. billing.runLinesFor() adds a credit line from accountCredit(), which never shrinks
//    after the credit has been used, so every later run would use the same credit again. creditApplied() nets it off.
//  - budgetWeekOf(): a request that is receipted in a later week stops counting as committed in its own week
//    (budgetWeek() only looks at receipts dated inside the same week, so the money would be counted twice).
//  - runPlan(): extra days are billed by date, not by month. runLinesFor() bills "the previous month" once and then marks the whole
//    month as billed, so a run released early (before the month is over) would lose every extra visit that comes after it.
import type { Bank, ClubState, DT, FamilyContact, Invoice, InvoiceLine, ISODate, Member, Payment, Receipt, Refund, SectionId, YM } from '../types';
import { addDays, addMonths, daysInMonth, diffDays, live, sortBy, sum, toMin, weekStart, ym } from '../util';
import { accountCredit, balanceOf, dueDateFor, invoiceStatus, invoiceTotal, paidDate, paidOn, priceOn, runDone, runPreview, type InvoiceStatus, type RunPreviewRow } from './billing';
import { extraDaysFor } from './attendance';
import { weeklyLimit } from './budget';
import { nextOpenDay, primaryContact } from './core';

// ---------- virtual accounts ----------
export const BANKS: Bank[] = ['BCA', 'Mandiri', 'BNI', 'BRI', 'Permata'];
/** DOKU virtual-account prefix per bank (design: pre = { BCA: '3901', … }). */
export const BANK_PREFIX: Record<Bank, string> = { BCA: '3901', Mandiri: '8950', BNI: '8492', BRI: '1290', Permata: '8856' };
/**
 * One virtual account per invoice, derived from the member's own number and the period.
 * Member VA = '8808' + 12 digits. The 12 digits are shifted by a prime step per month, so the number is
 * deterministic, 16 digits like the member's, and different for every period.
 */
export function invoiceVa(memberVa: string, period: YM): string {
  const digits = (memberVa || '').replace(/\D/g, '');
  const head = digits.slice(0, 4) || '8808';
  const tail = Number(digits.slice(4).padStart(12, '0'));
  const [y, m] = period.split('-').map(Number);
  const step = ((y - 2000) * 12 + m) * 1000003;
  return head + String((tail + step) % 1e12).padStart(12, '0');
}
/** The same account as seen through one bank: the bank's prefix replaces the first four digits. */
export const bankVa = (bank: Bank, va: string) => BANK_PREFIX[bank] + va.replace(/\D/g, '').slice(4);
/** '3901001203440000' -> '3901 0012 0344 0000' */
export const groupVa = (va: string) => va.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

// ---------- time ----------
/** Minutes since 1970 for a club wall-clock DT, to compare two stamps. */
export const dtMinutes = (d: DT) => diffDays('1970-01-01', d.slice(0, 10)) * 1440 + toMin(d.slice(11, 16));
/** A pending Xero item flips to synced this many demo minutes after it was created. */
export const XERO_DELAY_MIN = 2;

// ---------- invoices ----------
export const invoicePeriod = (inv: Invoice): YM => inv.period || ym(inv.issueDate);
export const daysLate = (inv: Invoice, today: ISODate) => Math.max(0, diffDays(inv.dueDate, today));
/** Who looks after billing for this invoice today: the member's primary contact (the invoice itself remembers who it was issued to). */
export const payerOf = (s: ClubState, inv: Invoice): FamilyContact | undefined => primaryContact(s, inv.memberId) || s.familyContacts[inv.payerFamilyId];

export interface InvoiceView {
  inv: Invoice;
  member: Member | undefined;
  payer: FamilyContact | undefined;
  status: InvoiceStatus;
  total: number;
  paid: number;
  balance: number;
  late: number;
}
export function invoiceView(s: ClubState, inv: Invoice, today: ISODate): InvoiceView {
  return { inv, member: s.members[inv.memberId], payer: payerOf(s, inv), status: invoiceStatus(s, inv, today), total: invoiceTotal(inv), paid: paidOn(s, inv.id), balance: balanceOf(s, inv), late: daysLate(inv, today) };
}
const byMember = (v: InvoiceView) => (v.member?.firstName || '') + v.inv.number;
export const invoiceViews = (s: ClubState, today: ISODate, includeVoid = false): InvoiceView[] =>
  live(s.invoices).filter((i) => includeVoid || !i.voided).map((i) => invoiceView(s, i, today));

export interface BillingBoard {
  month: YM;
  paid: InvoiceView[];
  due: InvoiceView[];
  overdue: InvoiceView[];
  xero: InvoiceView[];
  /** the earliest due date among the invoices still to come (tile label: "due 27 Oct") */
  nextDue: ISODate | null;
  sums: { paid: number; due: number; overdue: number; xero: number };
}
/** The four billing tiles and their lists. Part-paid invoices are "due" (or "overdue") for what is left. */
export function billingBoard(s: ClubState, today: ISODate): BillingBoard {
  const all = invoiceViews(s, today);
  const month = ym(today);
  const paid = sortBy(all.filter((v) => v.status === 'paid' && invoicePeriod(v.inv) === month), (v) => (paidDate(s, v.inv.id) || v.inv.issueDate), -1);
  const due = sortBy(all.filter((v) => v.status === 'outstanding' || v.status === 'partial'), (v) => v.inv.dueDate + byMember(v));
  const overdue = sortBy(all.filter((v) => v.status === 'overdue'), (v) => v.inv.dueDate + byMember(v));
  const xero = sortBy(all.filter((v) => v.status === 'paid' && v.inv.xero === 'pending'), byMember);
  return {
    month, paid, due, overdue, xero, nextDue: due[0]?.inv.dueDate ?? null,
    sums: { paid: sum(paid.map((v) => v.total)), due: sum(due.map((v) => v.balance)), overdue: sum(overdue.map((v) => v.balance)), xero: sum(xero.map((v) => v.total)) },
  };
}

// ---------- payments ----------
export interface AllocationView { invoiceId: string; invoice: Invoice | undefined; amount: number; refunded: number; refundable: number }
export interface PaymentView {
  p: Payment;
  member: Member | undefined;
  refunds: Refund[];
  refunded: number;
  /** what the payment still stands for once refunds are taken off */
  net: number;
  /** received but not allocated to any invoice: account credit */
  credit: number;
  allocations: AllocationView[];
  refundable: number;
}
export const refundsOfPayment = (s: ClubState, paymentId: string) => sortBy(live(s.refunds).filter((r) => r.paymentId === paymentId), (r) => r.createdAt);
export const refundsOfInvoice = (s: ClubState, invoiceId: string) => sortBy(live(s.refunds).filter((r) => r.invoiceId === invoiceId), (r) => r.createdAt);
/** What of a payment's allocation to one invoice can still be refunded. */
export function refundableOn(s: ClubState, paymentId: string, invoiceId: string): number {
  const p = s.payments[paymentId];
  if (!p || p.deletedAt) return 0;
  const allocated = sum(p.allocations.filter((a) => a.invoiceId === invoiceId).map((a) => a.amount));
  const refunded = sum(live(s.refunds).filter((r) => r.paymentId === paymentId && r.invoiceId === invoiceId).map((r) => r.amount));
  return Math.max(0, allocated - refunded);
}
export function paymentView(s: ClubState, p: Payment): PaymentView {
  const refunds = refundsOfPayment(s, p.id);
  const refunded = sum(refunds.map((r) => r.amount));
  const allocations = p.allocations.map((a) => {
    const r = sum(refunds.filter((x) => x.invoiceId === a.invoiceId).map((x) => x.amount));
    return { invoiceId: a.invoiceId, invoice: s.invoices[a.invoiceId], amount: a.amount, refunded: r, refundable: Math.max(0, a.amount - r) };
  });
  return { p, member: s.members[p.memberId], refunds, refunded, net: p.amount - refunded, credit: p.amount - sum(p.allocations.map((a) => a.amount)), allocations, refundable: sum(allocations.map((a) => a.refundable)) };
}
const paymentStamp = (p: Payment) => `${p.receivedOn}T${p.receivedAt || '00:00'}`;
/** Newest first. */
export const paymentViews = (s: ClubState): PaymentView[] => sortBy(live(s.payments), (p) => paymentStamp(p) + p.createdAt + p.id, -1).map((p) => paymentView(s, p));

export interface PaymentsBoard {
  rows: PaymentView[];
  today: { n: number; sum: number };
  month: { n: number; sum: number };
  xeroPending: number;
  refunds: { n: number; sum: number };
}
/** Totals are net of refunds: a payment that was refunded in full no longer counts. */
export function paymentsBoard(s: ClubState, today: ISODate): PaymentsBoard {
  const rows = paymentViews(s);
  const counted = rows.filter((r) => r.net > 0);
  const m = ym(today);
  const t = counted.filter((r) => r.p.receivedOn === today && r.p.method === 'dokuVa');
  const mo = counted.filter((r) => ym(r.p.receivedOn) === m);
  const refunds = live(s.refunds).filter((r) => ym(r.createdAt.slice(0, 10)) === m);
  return {
    rows,
    today: { n: t.length, sum: sum(t.map((r) => r.net)) },
    month: { n: mo.length, sum: sum(mo.map((r) => r.net)) },
    xeroPending: live(s.payments).filter((p) => p.xero === 'pending').length + live(s.refunds).filter((r) => r.xero === 'pending').length,
    refunds: { n: refunds.length, sum: sum(refunds.map((r) => r.amount)) },
  };
}

// ---------- account credit ----------
/** Credit already used: negative "Account credit" lines on invoices that are not void. */
export const creditApplied = (s: ClubState, memberId: string) =>
  sum(live(s.invoices).filter((i) => i.memberId === memberId && !i.voided).flatMap((i) => i.lines.filter((l) => l.kind === 'credit' && l.label === 'inv.line.credit').map((l) => -l.amount)));
export const availableCredit = (s: ClubState, memberId: string) => Math.max(0, accountCredit(s, memberId) - creditApplied(s, memberId));

// ---------- invoice run ----------
export interface RunPlan {
  period: YM;
  rows: RunPreviewRow[];
  /** rows that will become invoices */
  issue: RunPreviewRow[];
  /** rows left out: no billing contact, or nothing to bill */
  skipped: RunPreviewRow[];
  total: number;
  /** the usual issue date for the period (the 15th) */
  usualDate: ISODate;
  issueDate: ISODate;
  dueDate: ISODate;
  /** before the usual issue date: "released early" */
  early: boolean;
  /** a run for this period already exists (a later run only picks up what was left out) */
  done: boolean;
  /** an early run: this month is not over yet, so its extra days so far are on the invoices and the rest follow on a later one */
  partialMonth: YM | null;
}
export const runUsualDate = (s: ClubState, period: YM): ISODate => `${period}-${String(s.club.settings.issueDay).padStart(2, '0')}`;
/** Extra-day dates already on invoices that are not void. */
export const billedExtraDates = (s: ClubState, memberId: string): Set<ISODate> =>
  new Set(live(s.invoices).filter((i) => i.memberId === memberId && !i.voided).flatMap((i) => i.lines.filter((l) => l.kind === 'extraDay').flatMap((l) => l.dates || [])));
/** A run also looks this many months back for extra days no invoice has billed yet (the visits that came after an early run). */
export const EXTRA_LOOKBACK = 3;
/** One "Extra days" line per month that still has unbilled extra dates, oldest first. */
export function extraLinesFor(s: ClubState, m: Member, period: YM, today: ISODate): InvoiceLine[] {
  const price = priceOn(s, `${period}-15`);
  const billed = billedExtraDates(s, m.id);
  const out: InvoiceLine[] = [];
  for (let k = EXTRA_LOOKBACK; k >= 1; k--) {
    const month = addMonths(period, -k);
    const dates = extraDaysFor(s, m, month, today).filter((d) => !billed.has(d));
    if (dates.length) out.push({ id: `extra-${month}`, kind: 'extraDay', label: 'inv.line.extra', params: { month, n: dates.length }, qty: dates.length, unit: price.extra, amount: dates.length * price.extra, refMonth: month, dates });
  }
  return out;
}
/** runPreview() with extra days billed by date and the account credit applied once (see the notes at the top of this file). */
export function runPlan(s: ClubState, period: YM, today: ISODate): RunPlan {
  const rows = runPreview(s, period, today).map((r) => {
    const rest = r.lines.filter((l) => l.kind !== 'extraDay' && !(l.kind === 'credit' && l.id === 'credit'));
    // plan line, then the extra days, then adjustments (the order of the invoice)
    const lines: InvoiceLine[] = [...rest.filter((l) => l.kind === 'plan'), ...extraLinesFor(s, r.member, period, today), ...rest.filter((l) => l.kind !== 'plan')];
    if (lines.length) {
      const credit = Math.min(availableCredit(s, r.member.id), sum(lines.map((l) => l.amount)));
      if (credit > 0) lines.push({ id: 'credit', kind: 'credit', label: 'inv.line.credit', qty: 1, unit: -credit, amount: -credit });
    }
    return { ...r, lines, total: sum(lines.map((l) => l.amount)), skipped: !r.payerId ? 'noPayer' : !lines.length ? 'nothingToBill' : undefined };
  });
  const issue = rows.filter((r) => !r.skipped);
  const usualDate = runUsualDate(s, period);
  // a run that is late enough for the usual due date to have passed gives families a week instead of invoices that are overdue on arrival
  const due = dueDateFor(s, period);
  const prev = addMonths(period, -1);
  return {
    period, rows, issue, skipped: rows.filter((r) => r.skipped), total: sum(issue.map((r) => r.total)), usualDate, issueDate: today,
    dueDate: due >= today ? due : nextOpenDay(s, addDays(today, 7), true), early: today < usualDate, done: runDone(s, period),
    partialMonth: ym(today) === prev && today < `${prev}-${String(daysInMonth(prev)).padStart(2, '0')}` ? prev : null,
  };
}
/** The period the next run is for: this month's once the issue day has come and no run exists, otherwise next month's. */
export function nextRunPeriod(s: ClubState, today: ISODate): YM {
  const m = ym(today);
  return +today.slice(8) >= s.club.settings.issueDay && !runDone(s, m) ? m : ym(addDays(`${m}-28`, 7));
}

// ---------- budget ----------
/** The receipt (not void, not rejected) that settles a budget request, if any. */
export const receiptOfRequest = (s: ClubState, requestId: string): Receipt | undefined =>
  live(s.receipts).find((r) => r.budgetRequestId === requestId && !r.voidedAt && r.status !== 'rejected');
/** budgetWeek() with requests linked to a receipt in any week left out of "committed". */
export function budgetWeekOf(s: ClubState, sectionId: SectionId, anyDay: ISODate) {
  const ws = weekStart(anyDay);
  const we = addDays(ws, 6);
  const counted = live(s.receipts).filter((r) => r.sectionId === sectionId && !r.voidedAt && r.status !== 'rejected');
  const receipts = counted.filter((r) => r.date >= ws && r.date <= we);
  const linked = new Set(counted.map((r) => r.budgetRequestId).filter(Boolean));
  const requests = live(s.budgetRequests).filter((b) => b.sectionId === sectionId && b.weekStart === ws);
  const approved = requests.filter((b) => b.status === 'approved' && !linked.has(b.id));
  const pending = requests.filter((b) => b.status === 'pending');
  const adjustments = live(s.budgetAdjustments).filter((a) => a.sectionId === sectionId && a.weekStart === ws);
  const spent = sum(receipts.map((r) => r.amount)) + sum(adjustments.map((a) => a.amount));
  const committed = sum(approved.map((b) => b.amount));
  const limit = weeklyLimit(s, sectionId, ws);
  return { weekStart: ws, weekEnd: we, limit, spent, committed, used: spent + committed, left: limit - spent - committed, pct: limit > 0 ? Math.round(((spent + committed) / limit) * 100) : 0, pending, approved, receipts, adjustments, requests: sortBy(requests, (b) => b.createdAt + b.id, -1) };
}
/** First and last week (Mondays) the switcher can show: the oldest week with a limit, request or receipt, up to next week. */
export function budgetRange(s: ClubState, today: ISODate): { first: ISODate; last: ISODate } {
  const dates = [
    ...live(s.budgetSections).flatMap((b) => b.limits.map((l) => weekStart(l.fromWeek))),
    ...live(s.budgetRequests).map((b) => b.weekStart),
    ...live(s.receipts).map((r) => weekStart(r.date)),
  ];
  const cur = weekStart(today);
  return { first: dates.length ? dates.sort()[0] : cur, last: addDays(cur, 7) };
}
export const sectionName = (s: ClubState, id: SectionId, lang: 'en' | 'id') => {
  const sec = s.budgetSections[id];
  return sec ? (lang === 'id' && sec.nameId ? sec.nameId : sec.name) : id;
};
/** Sections in the order they were created; the three seeded ones share a timestamp, so they keep the design's order (F&B, Activities, Operations). */
const SEEDED_ORDER = ['fnb', 'activities', 'operations'];
const rank = (id: string) => { const i = SEEDED_ORDER.indexOf(id); return i < 0 ? 99 : i; };
export const activeSections = (s: ClubState) => sortBy(live(s.budgetSections), (b) => `${b.createdAt}|${String(rank(b.id)).padStart(2, '0')}|${b.id}`);

// ---------- receipts and vendor invoices ----------
export const receiptsList = (s: ClubState) => sortBy(live(s.receipts).filter((r) => !r.voidedAt), (r) => r.date + r.createdAt + r.id, -1);
export const vendorInvoicesList = (s: ClubState) => sortBy(live(s.vendorInvoices), (v) => v.due + v.number);

// ---------- misc ----------
/** Money from a user's text: digits only (Rp amounts are whole rupiah). */
export const rpFromText = (v: string) => +(String(v).replace(/\D/g, '') || 0);
