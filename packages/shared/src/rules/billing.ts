// Invoices, payments, refunds, invoice run preview, due-date rule.
import type { ClubState, Invoice, InvoiceLine, ISODate, Member, PriceVersion, YM } from '../types';
import { activeOn, isOpen, openDaysInMonth, planOn, primaryContact, isPendingRow } from './core';
import { extraDaysFor } from './attendance';
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

// ---------- due date ----------
/** The 27th; if closed (weekend/holiday) roll to the next weekday, unless that crosses into next month: then the Friday before. */
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

/** Lines a member would be billed for `period` (issued on the 15th). */
export function runLinesFor(s: ClubState, m: Member, period: YM, today: ISODate): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const price = priceOn(s, `${period}-15`);
  const billed = billedPlanMonths(s, m.id);
  if (!billed.has(period) && activeOn(m, `${period}-15`)) {
    const plan = planOn(m, `${period}-15`).plan;
    const open = openDaysInMonth(s, period);
    const active = open.filter((d) => activeOn(m, d));
    const full = plan === 'gold' ? price.gold : price.flex;
    const amount = active.length >= open.length || !open.length ? full : Math.round((full * active.length) / open.length / 1000) * 1000;
    lines.push({ id: `plan-${period}`, kind: 'plan', label: plan === 'gold' ? 'inv.line.gold' : 'inv.line.flex', params: { month: period }, qty: 1, unit: amount, amount, refMonth: period });
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
