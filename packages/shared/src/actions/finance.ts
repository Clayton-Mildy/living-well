// Finance actions: invoice run, invoices, payments, refunds, Xero, budget, receipts, vendor invoices.
// Everything is pure and deterministic: ids come from ctx.id(), dates and times from ctx.today / ctx.now.
import { current, type Draft } from 'immer';
import type { Bank, BudgetSection, ClubState, DT, Invoice, Payment, Receipt, User, VendorInvoice, YM } from '../types';
import { defineAction, DomainError, hasRole, isFamily, isStaff, type ActionDef, type Ctx } from './framework';
import { registerJob } from './jobs';
import { requireMember, shortOf } from './helpers';
import { allocate, balanceOf, invoiceTotal, nextInvoiceNumber, paidOn, runDone } from '../rules/billing';
import { isPrimaryFor, primaryContact } from '../rules/core';
import { BANKS, XERO_DELAY_MIN, dtMinutes, invoiceVa, receiptOfRequest, refundableOn, runPlan } from '../rules/finance';
import { bool, idList, isoDate, obj, oneOf, optText, pickId, rupiah, rupiahOrZero, signedRupiah, text, yearMonth, bad } from '../rules/financeInput';
import { addDays, rp, uniq, weekStart, ym } from '../util';

const finMgmt = (u: User) => hasRole(u, 'finance', 'mgmt');
const anyStaff = (u: User) => isStaff(u);

type D = Draft<ClubState>;
const base = (ctx: Ctx, id: string) => ({ id, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: ctx.actor });
/** `id`, or `id-2`, `id-3`… when taken. */
const freeId = (coll: Record<string, unknown>, id: string) => {
  if (!coll[id]) return id;
  let n = 2;
  while (coll[`${id}-${n}`]) n++;
  return `${id}-${n}`;
};
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const nameKey = (s: string) => s.trim().toLowerCase();

const invoiceOf = (d: D, id: string, ctx: Ctx) => {
  const inv = d.invoices[id];
  if (!inv || inv.deletedAt) ctx.fail('err.notFound');
  return inv;
};
/** Who looks after billing for an invoice today: the member's primary contact (the invoice keeps who it was issued to, in case there is none). */
const payerIdOf = (d: D, inv: Pick<Invoice, 'memberId' | 'payerFamilyId'>) => primaryContact(d as unknown as ClubState, inv.memberId)?.id || inv.payerFamilyId;
const tellPayer = (d: D, ctx: Ctx, inv: Pick<Invoice, 'id' | 'payerFamilyId' | 'memberId'>, kind: string, params: Record<string, string | number>) =>
  ctx.notify({ toUsers: [payerIdOf(d, inv)], kind, params, link: '/billing', memberId: inv.memberId, ref: { type: 'invoice', id: inv.id } });
const tellFinance = (ctx: Ctx, kind: string, params: Record<string, string | number>, link: string, memberId?: string) =>
  ctx.notify({ toRoles: ['finance', 'mgmt'], kind, params, link, memberId });
const tellStaff = (ctx: Ctx, staffId: string, kind: string, params: Record<string, string | number>, link: string) => {
  if (staffId && staffId !== ctx.user.id) ctx.notify({ toUsers: [staffId], kind, params, link });
};

// ---------- Xero (simulated) ----------
/**
 * Flip "pending" to "synced". `all` flips everything now (the Sync button); otherwise only what has waited XERO_DELAY_MIN demo minutes (the job).
 * Invoices follow their payments: once nothing of theirs is waiting they become synced (paid) or awaiting payment (open).
 */
export function xeroSweep(d: D, ctx: Ctx, all: boolean): number {
  const ripe = (at: DT | undefined) => all || !at || dtMinutes(ctx.nowDT) - dtMinutes(at) >= XERO_DELAY_MIN;
  let n = 0;
  for (const p of Object.values(d.payments)) if (p.xero === 'pending' && ripe(p.createdAt)) { p.xero = 'synced'; n++; }
  for (const r of Object.values(d.refunds)) if (r.xero === 'pending' && ripe(r.createdAt)) { r.xero = 'synced'; n++; }
  for (const r of Object.values(d.receipts)) if (r.xero === 'pending' && ripe(r.decidedAt || r.createdAt)) { r.xero = 'synced'; n++; }
  for (const v of Object.values(d.vendorInvoices)) if (v.xero === 'pending' && ripe(v.decidedAt || v.createdAt)) { v.xero = 'synced'; n++; }
  const waitingPay = new Set<string>();
  for (const p of Object.values(d.payments)) if (p.xero === 'pending') for (const a of p.allocations) waitingPay.add(a.invoiceId);
  for (const r of Object.values(d.refunds)) if (r.xero === 'pending') waitingPay.add(r.invoiceId);
  for (const inv of Object.values(d.invoices)) {
    if (inv.xero !== 'pending' || waitingPay.has(inv.id)) continue;
    inv.xero = !inv.voided && balanceOf(d as unknown as ClubState, inv) > 0 ? 'awaitingPayment' : 'synced';
    n++;
  }
  return n;
}

// ---------- invoice run ----------
/** Issue the invoices of one run. Everything is worked out first and written afterwards, so a failure leaves nothing half done. */
function issueRun(d: D, ctx: Ctx, period: YM, auto: boolean) {
  const s = current(d) as ClubState;
  const plan = runPlan(s, period, ctx.today);
  if (!plan.issue.length) ctx.fail('finance.err.nothingToIssue');
  const taken = new Set(Object.keys(s.invoices));
  const invoices: Invoice[] = plan.issue.map((row) => {
    const first = nextInvoiceNumber(s, period, row.member.id);
    let number = first;
    for (let n = 2; taken.has(number); n++) number = `${first}-${n}`;
    taken.add(number);
    return {
      ...base(ctx, number), number, memberId: row.member.id, payerFamilyId: row.payerId, kind: 'monthly', period, issueDate: ctx.today, dueDate: plan.dueDate,
      ...(plan.early ? { releasedEarly: true } : {}), lines: row.lines, va: invoiceVa(row.member.billing.va, period), xero: 'awaitingPayment', reminders: [], callNotes: [],
    };
  });
  const runId = freeId(d.invoiceRuns, `run-${period}`);
  for (const inv of invoices) {
    d.invoices[inv.id] = inv;
    // pending charges that went onto this invoice are settled by it
    for (const l of inv.lines) if (l.id.startsWith('charge-')) {
      const c = d.pendingCharges[l.id.slice('charge-'.length)];
      if (c) c.invoiceId = inv.id;
    }
  }
  d.invoiceRuns[runId] = {
    ...base(ctx, runId), period, issueDate: ctx.today, invoiceIds: invoices.map((i) => i.id),
    skipped: plan.skipped.filter((r) => r.skipped === 'noPayer').map((r) => ({ memberId: r.member.id, reason: 'noPayer' })),
    ...(plan.early ? { early: true } : {}), ...(auto ? { auto: true } : {}),
  };
  for (const inv of invoices) {
    const name = shortOf(d, inv.memberId);
    const amount = rp(invoiceTotal(inv));
    tellPayer(d, ctx, inv, 'finance.notif.invoiceIssued', { name, number: inv.number, amount });
    ctx.feed({ icon: 'receipt_long', key: 'finance.feed.invoiceIssued', params: { name, number: inv.number, amount }, memberId: inv.memberId });
  }
  ctx.result.runId = runId;
  ctx.result.invoiceIds = invoices.map((i) => i.id);
  ctx.result.count = invoices.length;
  ctx.result.total = plan.total;
  ctx.result.early = plan.early;
}

// ---------- payments ----------
const METHODS = ['dokuVa', 'bankTransferSgd', 'revolut', 'cash', 'other'] as const;
function addPayment(d: D, ctx: Ctx, p: { memberId: string; amount: number; method: Payment['method']; ref?: string; bank?: Bank; foreign?: Payment['foreign']; allocations: Payment['allocations'] }): Payment {
  const id = ctx.id('pay');
  const pay: Payment = {
    ...base(ctx, id), memberId: p.memberId, method: p.method, amount: p.amount,
    ...(p.foreign ? { foreign: p.foreign } : {}), ...(p.ref ? { ref: p.ref } : {}), ...(p.bank ? { bank: p.bank } : {}),
    receivedOn: ctx.today, receivedAt: ctx.now, allocations: p.allocations, xero: 'pending', by: ctx.actor,
  };
  d.payments[id] = pay;
  // an invoice this payment settles waits for Xero to hear about it
  for (const a of p.allocations) {
    const inv = d.invoices[a.invoiceId];
    if (inv && balanceOf(d as unknown as ClubState, inv) <= 0) inv.xero = 'pending';
  }
  return pay;
}
const payerName = (d: D, familyId: string) => d.familyContacts[familyId]?.name || '';

// ---------- budget / receipts helpers ----------
const sectionOf = (d: D, id: string, ctx: Ctx): Draft<BudgetSection> => {
  const sec = d.budgetSections[id];
  if (!sec || sec.deletedAt) ctx.fail('err.notFound');
  return sec;
};
const requestOf = (d: D, id: string, ctx: Ctx) => {
  const b = d.budgetRequests[id];
  if (!b || b.deletedAt) ctx.fail('err.notFound');
  return b;
};
const receiptOf = (d: D, id: string, ctx: Ctx): Draft<Receipt> => {
  const r = d.receipts[id];
  if (!r || r.deletedAt || r.voidedAt) ctx.fail('err.notFound');
  return r;
};
const vendorOf = (d: D, id: string, ctx: Ctx): Draft<VendorInvoice> => {
  const v = d.vendorInvoices[id];
  if (!v || v.deletedAt) ctx.fail('err.notFound');
  return v;
};
const requesterLink = (d: D, staffId: string) => {
  const role = d.staff[staffId]?.role;
  return role === 'finance' || role === 'mgmt' ? '/budget' : '/requests';
};
/** A linked budget request must be approved, in the receipt's section, and not already receipted. */
function checkLink(d: D, ctx: Ctx, requestId: string | undefined, sectionId: string, selfId?: string) {
  if (!requestId) return;
  const b = d.budgetRequests[requestId];
  const other = receiptOfRequest(current(d) as ClubState, requestId);
  if (!b || b.deletedAt || b.status !== 'approved' || b.sectionId !== sectionId || (other && other.id !== selfId)) ctx.fail('finance.err.requestNotLinkable');
}
function checkDirectory(d: D, ctx: Ctx, id: string | undefined) {
  if (id && (!d.directory[id] || d.directory[id].deletedAt)) ctx.fail('err.notFound');
}
const noteName = (fileDate: string) => `nota_${fileDate.slice(8)}${fileDate.slice(5, 7)}.jpg`;

// ======================================================================================================
export const financeActions: ActionDef[] = [
  // ---------- invoice run ----------
  defineAction<{ period: YM; early?: boolean }>({
    name: 'run.issue',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { period: yearMonth(o.period), early: bool(o.early) }; },
    run(d, input, ctx) {
      if (input.period > ym(addDays(`${ym(ctx.today)}-28`, 7))) ctx.fail('finance.err.periodTooFar');
      issueRun(d, ctx, input.period, false);
    },
  }),

  // ---------- invoices ----------
  defineAction<{ invoiceId: string; label: string; amount: number }>({
    name: 'invoice.adjust',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { invoiceId: text(o.invoiceId, 80), label: text(o.label, 120), amount: signedRupiah(o.amount) }; },
    run(d, input, ctx) {
      const inv = invoiceOf(d, input.invoiceId, ctx);
      if (inv.voided) ctx.fail('finance.err.invoiceVoid');
      const total = invoiceTotal(inv as Invoice);
      const paid = paidOn(d as unknown as ClubState, inv.id);
      // a credit can't take the invoice below what was already paid: money paid is returned with a refund
      if (input.amount < 0 && total + input.amount < paid) ctx.fail('finance.err.creditTooLarge', { max: rp(Math.max(0, total - paid)) });
      inv.lines.push({ id: ctx.id('ln'), kind: input.amount > 0 ? 'adjustment' : 'credit', label: input.label, qty: 1, unit: input.amount, amount: input.amount });
      const params = { name: shortOf(d, inv.memberId), number: inv.number, label: input.label, amount: (input.amount < 0 ? '−' : '') + rp(Math.abs(input.amount)) };
      tellPayer(d, ctx, inv, 'finance.notif.adjusted', params);
      ctx.feed({ icon: 'edit_note', key: 'finance.feed.adjusted', params, memberId: inv.memberId });
    },
  }),
  defineAction<{ invoiceId: string; reason: string }>({
    name: 'invoice.void',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { invoiceId: text(o.invoiceId, 80), reason: text(o.reason, 300) }; },
    run(d, input, ctx) {
      const inv = invoiceOf(d, input.invoiceId, ctx);
      if (inv.voided) ctx.fail('finance.err.alreadyVoid');
      if (paidOn(d as unknown as ClubState, inv.id) > 0) ctx.fail('finance.err.voidPaid');
      inv.voided = { at: ctx.nowDT, by: ctx.actor, reason: input.reason };
      // charges that went onto this invoice are free to be billed again
      for (const c of Object.values(d.pendingCharges)) if (c.invoiceId === inv.id) delete c.invoiceId;
      const params = { name: shortOf(d, inv.memberId), number: inv.number };
      tellPayer(d, ctx, inv, 'finance.notif.voided', params);
      ctx.feed({ icon: 'block', key: 'finance.feed.voided', params, memberId: inv.memberId });
    },
  }),
  defineAction<{ invoiceId: string }>({
    name: 'invoice.remind',
    can: finMgmt,
    parse: (raw) => ({ invoiceId: text(obj(raw).invoiceId, 80) }),
    run(d, input, ctx) {
      const inv = invoiceOf(d, input.invoiceId, ctx);
      if (inv.voided) ctx.fail('finance.err.invoiceVoid');
      const balance = balanceOf(d as unknown as ClubState, inv as Invoice);
      if (balance <= 0) ctx.fail('finance.err.invoicePaid');
      inv.reminders.push({ at: ctx.nowDT, by: ctx.actor });
      // simulated WhatsApp: the reminder carries the virtual account number
      const params = { name: shortOf(d, inv.memberId), number: inv.number, amount: rp(balance) };
      tellPayer(d, ctx, inv, 'finance.notif.reminder', params);
      ctx.feed({ icon: 'notifications', key: 'finance.feed.reminder', params, memberId: inv.memberId });
      ctx.result.to = payerName(d, payerIdOf(d, inv));
    },
  }),
  defineAction<{ invoiceId: string; text: string }>({
    name: 'invoice.callNote',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { invoiceId: text(o.invoiceId, 80), text: text(o.text, 500) }; },
    run(d, input, ctx) {
      invoiceOf(d, input.invoiceId, ctx).callNotes.push({ at: ctx.nowDT, by: ctx.actor, text: input.text });
    },
  }),

  // ---------- payments ----------
  defineAction<{ memberId: string; amount: number; method: Payment['method']; ref?: string; invoiceId?: string; foreign?: { ccy: 'SGD' | 'EUR'; amount: number } }>({
    name: 'payment.record',
    can: finMgmt,
    parse: (raw) => {
      const o = obj(raw);
      let foreign: { ccy: 'SGD' | 'EUR'; amount: number } | undefined;
      if (o.foreign !== undefined && o.foreign !== null) {
        const f = obj(o.foreign);
        if (typeof f.amount !== 'number' || !Number.isFinite(f.amount) || f.amount <= 0 || f.amount > 1e9) bad();
        foreign = { ccy: oneOf(f.ccy, ['SGD', 'EUR'] as const), amount: Math.round((f.amount as number) * 100) / 100 };
      }
      return { memberId: text(o.memberId, 80), amount: rupiah(o.amount), method: oneOf(o.method, METHODS), ref: optText(o.ref, 120), invoiceId: optText(o.invoiceId, 80), foreign };
    },
    run(d, input, ctx) {
      requireMember(d, input.memberId, ctx);
      const s = current(d) as ClubState;
      if (input.invoiceId) {
        const inv = s.invoices[input.invoiceId];
        if (!inv || inv.deletedAt || inv.memberId !== input.memberId) ctx.fail('err.notFound');
        if (inv.voided) ctx.fail('finance.err.invoiceVoid');
        if (balanceOf(s, inv) <= 0) ctx.fail('finance.err.invoicePaid');
      }
      // the chosen invoice first, then the oldest due; what is left over stays on the account as credit
      const { allocations, credit } = allocate(s, input.memberId, input.amount, ctx.today, input.invoiceId);
      const pay = addPayment(d, ctx, { memberId: input.memberId, amount: input.amount, method: input.method, ref: input.ref, foreign: input.foreign, allocations });
      const numbers = allocations.map((a) => a.invoiceId).join(', ') || '—';
      const name = shortOf(d, input.memberId);
      const amount = rp(input.amount);
      const payer = primaryContact(s, input.memberId);
      tellFinance(ctx, 'notif.paymentReceived', { name: payer?.name || name, invoice: numbers, amount }, '/payments', input.memberId);
      if (payer) ctx.notify({ toUsers: [payer.id], kind: 'finance.notif.paid', params: { name, invoice: numbers, amount }, link: '/billing', memberId: input.memberId, ref: { type: 'payment', id: pay.id } });
      ctx.feed({ icon: 'payments', key: 'finance.feed.pay_' + input.method, params: { name, number: numbers, amount }, memberId: input.memberId });
      ctx.result.paymentId = pay.id;
      ctx.result.credit = credit;
      ctx.result.allocations = allocations.length;
    },
  }),
  defineAction<{ invoiceIds: string[]; bank: Bank }>({
    name: 'payment.simulateVa',
    // finance or management on a family's behalf, or the primary billing contact of every member whose invoice is being paid
    can: (u, input, s) =>
      finMgmt(u) ||
      (isFamily(u) && Array.isArray(input?.invoiceIds) && input.invoiceIds.length > 0 && input.invoiceIds.every((id) => { const i = s.invoices[id]; return !!i && !i.deletedAt && isPrimaryFor(s, u.id, i.memberId); })),
    parse: (raw) => { const o = obj(raw); return { invoiceIds: idList(o.invoiceIds), bank: o.bank === undefined ? 'BCA' : oneOf(o.bank, BANKS) }; },
    run(d, input, ctx) {
      const s = current(d) as ClubState;
      const byMember = new Map<string, Invoice[]>();
      for (const id of input.invoiceIds) {
        const inv = s.invoices[id];
        if (!inv || inv.deletedAt) ctx.fail('err.notFound');
        if (inv.voided || balanceOf(s, inv) <= 0) continue; // already settled: nothing to pay
        byMember.set(inv.memberId, [...(byMember.get(inv.memberId) || []), inv]);
      }
      if (!byMember.size) ctx.fail('finance.err.nothingToPay');
      const paidIds: string[] = [];
      let total = 0;
      for (const [memberId, invs] of byMember) {
        // one DOKU virtual-account payment per member, covering the invoices chosen for that member
        const allocations = invs.map((inv) => ({ invoiceId: inv.id, amount: balanceOf(s, inv) }));
        const amount = allocations.reduce((t, a) => t + a.amount, 0);
        const pay = addPayment(d, ctx, { memberId, amount, method: 'dokuVa', bank: input.bank, allocations });
        const numbers = invs.map((i) => i.number).join(', ');
        const name = shortOf(d, memberId);
        const who = payerName(d, payerIdOf(d, invs[0])) || name;
        tellFinance(ctx, 'notif.paymentReceived', { name: who, invoice: numbers, amount: rp(amount) }, '/payments', memberId);
        // the payer hears it too: the receipt goes out on WhatsApp (demo)
        for (const fid of uniq(invs.map((i) => payerIdOf(d, i)))) ctx.notify({ toUsers: [fid], kind: 'finance.notif.paid', params: { name, invoice: numbers, amount: rp(amount) }, link: '/billing', memberId, ref: { type: 'payment', id: pay.id } });
        ctx.feed({ icon: 'payments', key: 'finance.feed.pay_dokuVa', params: { name, number: numbers, amount: rp(amount) }, memberId });
        paidIds.push(pay.id);
        total += amount;
      }
      ctx.result.paymentIds = paidIds;
      ctx.result.total = total;
    },
  }),
  defineAction<{ paymentId: string; invoiceId: string; amount: number; reason: string; creditNote: boolean }>({
    name: 'refund.record',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { paymentId: text(o.paymentId, 80), invoiceId: text(o.invoiceId, 80), amount: rupiah(o.amount), reason: text(o.reason, 300), creditNote: bool(o.creditNote) }; },
    run(d, input, ctx) {
      const pay = d.payments[input.paymentId];
      if (!pay || pay.deletedAt) ctx.fail('err.notFound');
      const inv = invoiceOf(d, input.invoiceId, ctx);
      if (!pay.allocations.some((a) => a.invoiceId === inv.id)) ctx.fail('finance.err.noAllocation');
      const max = refundableOn(current(d) as ClubState, pay.id, inv.id);
      if (input.amount > max) ctx.fail('finance.err.refundTooMuch', { max: rp(max) });
      const id = ctx.id('rf');
      d.refunds[id] = { ...base(ctx, id), paymentId: pay.id, invoiceId: inv.id, amount: input.amount, creditNote: input.creditNote, reason: input.reason, xero: 'pending' };
      // with a credit note the invoice total drops by the same amount, so it stays settled; without one it re-opens
      if (input.creditNote) inv.lines.push({ id: ctx.id('ln'), kind: 'credit', label: 'finance.line.creditNote', params: { reason: input.reason }, qty: 1, unit: -input.amount, amount: -input.amount });
      inv.xero = 'pending'; // the refund goes to Xero as a credit note
      const params = { name: shortOf(d, inv.memberId), invoice: inv.number, amount: rp(input.amount) };
      tellFinance(ctx, 'finance.notif.refundIssued', params, '/payments', inv.memberId);
      tellPayer(d, ctx, inv, 'finance.notif.refund', params);
      ctx.feed({ icon: 'undo', key: 'finance.feed.refund', params: { name: params.name, number: inv.number, amount: params.amount }, memberId: inv.memberId });
      ctx.result.refundId = id;
    },
  }),
  defineAction<Record<string, never>>({
    name: 'xero.sync',
    can: finMgmt,
    parse: () => ({}),
    run(d, _input, ctx) {
      ctx.result.synced = xeroSweep(d, ctx, true);
    },
  }),

  // ---------- budget ----------
  defineAction<{ sectionId: string; item: string; amount: number }>({
    name: 'budget.request',
    can: anyStaff, // always pending, including finance and management: someone with the authority approves it
    parse: (raw) => { const o = obj(raw); return { sectionId: text(o.sectionId, 80), item: text(o.item, 120), amount: rupiah(o.amount) }; },
    run(d, input, ctx) {
      const sec = sectionOf(d, input.sectionId, ctx);
      const id = ctx.id('br');
      d.budgetRequests[id] = { ...base(ctx, id), sectionId: sec.id, item: input.item, amount: input.amount, weekStart: weekStart(ctx.today), requestedBy: ctx.user.id, status: 'pending' };
      ctx.feed({ icon: 'pie_chart', key: 'finance.feed.budgetRequested', params: { item: input.item, amount: rp(input.amount), section: sec.name } });
      ctx.result.requestId = id;
    },
  }),
  defineAction<{ id: string; item?: string; amount?: number; sectionId?: string }>({
    name: 'budget.edit',
    can: (u, input, s) => finMgmt(u) || (isStaff(u) && s.budgetRequests[input?.id]?.requestedBy === u.id),
    parse: (raw) => {
      const o = obj(raw);
      return { id: pickId(o, 'requestId', 'budgetRequestId'), item: optText(o.item, 120), amount: o.amount === undefined ? undefined : rupiah(o.amount), sectionId: optText(o.sectionId, 80) };
    },
    run(d, input, ctx) {
      const b = requestOf(d, input.id, ctx);
      if (b.status !== 'pending') ctx.fail('finance.err.notPending');
      if (input.sectionId) b.sectionId = sectionOf(d, input.sectionId, ctx).id;
      if (input.item) b.item = input.item;
      if (input.amount) b.amount = input.amount;
    },
  }),
  defineAction<{ id: string }>({
    name: 'budget.cancel',
    can: (u, input, s) => isStaff(u) && s.budgetRequests[input?.id]?.requestedBy === u.id, // the requester, while it is pending
    parse: (raw) => ({ id: pickId(obj(raw), 'requestId', 'budgetRequestId') }),
    run(d, input, ctx) {
      const b = requestOf(d, input.id, ctx);
      if (b.status !== 'pending') ctx.fail('finance.err.notPending');
      b.status = 'cancelled';
    },
  }),
  defineAction<{ id: string }>({
    name: 'budget.approve',
    can: finMgmt,
    parse: (raw) => ({ id: pickId(obj(raw), 'requestId', 'budgetRequestId') }),
    run(d, input, ctx) {
      const b = requestOf(d, input.id, ctx);
      if (b.status !== 'pending') ctx.fail('finance.err.notPending');
      b.status = 'approved';
      b.decidedBy = ctx.actor;
      b.decidedAt = ctx.nowDT;
      tellStaff(ctx, b.requestedBy, 'finance.notif.budgetApproved', { item: b.item, amount: rp(b.amount) }, requesterLink(d, b.requestedBy));
      ctx.feed({ icon: 'pie_chart', key: 'finance.feed.budgetApproved', params: { item: b.item, amount: rp(b.amount) } });
    },
  }),
  defineAction<{ id: string; note: string }>({
    name: 'budget.reject',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { id: pickId(o, 'requestId', 'budgetRequestId'), note: text(o.note, 300) }; },
    run(d, input, ctx) {
      const b = requestOf(d, input.id, ctx);
      if (b.status !== 'pending') ctx.fail('finance.err.notPending');
      b.status = 'rejected';
      b.decidedBy = ctx.actor;
      b.decidedAt = ctx.nowDT;
      b.note = input.note;
      tellStaff(ctx, b.requestedBy, 'finance.notif.budgetRejected', { item: b.item, note: input.note }, requesterLink(d, b.requestedBy));
    },
  }),
  defineAction<{ sectionId: string; weekly: number; fromWeek: string }>({
    name: 'budget.setLimit',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { sectionId: text(o.sectionId, 80), weekly: rupiahOrZero(o.weekly), fromWeek: isoDate(o.fromWeek) }; },
    run(d, input, ctx) {
      const sec = sectionOf(d, input.sectionId, ctx);
      const from = weekStart(input.fromWeek); // limits always start on a Monday
      const at = sec.limits.find((l) => l.fromWeek === from);
      if (at) at.weekly = input.weekly;
      else sec.limits.push({ fromWeek: from, weekly: input.weekly });
      sec.limits.sort((a, b) => (a.fromWeek < b.fromWeek ? -1 : a.fromWeek > b.fromWeek ? 1 : 0));
    },
  }),
  defineAction<{ name: string; nameId?: string; weekly: number }>({
    name: 'budget.addSection',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { name: text(o.name, 60), nameId: optText(o.nameId, 60), weekly: rupiahOrZero(o.weekly) }; },
    run(d, input, ctx) {
      const taken = Object.values(d.budgetSections).filter((x) => !x.deletedAt).flatMap((x) => [nameKey(x.name), x.nameId ? nameKey(x.nameId) : '']);
      if (taken.includes(nameKey(input.name)) || (input.nameId && taken.includes(nameKey(input.nameId)))) ctx.fail('finance.err.sectionExists');
      const id = freeId(d.budgetSections, slug(input.name) || 'section');
      d.budgetSections[id] = { ...base(ctx, id), name: input.name, ...(input.nameId ? { nameId: input.nameId } : {}), limits: [{ fromWeek: weekStart(ctx.today), weekly: input.weekly }] };
      ctx.result.sectionId = id;
    },
  }),
  defineAction<{ id: string; name: string; nameId?: string }>({
    name: 'budget.renameSection',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { id: pickId(o, 'sectionId'), name: text(o.name, 60), nameId: optText(o.nameId, 60) }; },
    run(d, input, ctx) {
      const sec = sectionOf(d, input.id, ctx);
      const others = Object.values(d.budgetSections).filter((x) => !x.deletedAt && x.id !== sec.id).flatMap((x) => [nameKey(x.name), x.nameId ? nameKey(x.nameId) : '']);
      if (others.includes(nameKey(input.name)) || (input.nameId && others.includes(nameKey(input.nameId)))) ctx.fail('finance.err.sectionExists');
      sec.name = input.name;
      if (input.nameId) sec.nameId = input.nameId;
      else delete sec.nameId;
    },
  }),

  // ---------- receipts ----------
  defineAction<{ date: string; supplier: string; directoryId?: string; amount: number; sectionId: string; budgetRequestId?: string; fileName?: string; mediaId?: string }>({
    name: 'receipt.add',
    can: anyStaff, // submitted for approval, including by finance and management
    parse: (raw) => {
      const o = obj(raw);
      return { date: isoDate(o.date), supplier: text(o.supplier, 120), directoryId: optText(o.directoryId, 80), amount: rupiah(o.amount), sectionId: text(o.sectionId, 80), budgetRequestId: optText(o.budgetRequestId, 80), fileName: optText(o.fileName, 120), mediaId: optText(o.mediaId, 60) };
    },
    run(d, input, ctx) {
      if (input.date > ctx.today) ctx.fail('finance.err.futureDate');
      const sec = sectionOf(d, input.sectionId, ctx);
      checkDirectory(d, ctx, input.directoryId);
      checkLink(d, ctx, input.budgetRequestId, sec.id);
      const id = ctx.id('rc');
      d.receipts[id] = {
        ...base(ctx, id), date: input.date, supplier: input.supplier, ...(input.directoryId ? { directoryId: input.directoryId } : {}), amount: input.amount, sectionId: sec.id,
        ...(input.budgetRequestId ? { budgetRequestId: input.budgetRequestId } : {}), fileName: input.fileName || noteName(ctx.today), ...(input.mediaId ? { mediaId: input.mediaId } : {}), by: ctx.user.id, status: 'submitted', xero: 'notSent',
      };
      ctx.feed({ icon: 'receipt_long', key: 'finance.feed.receiptAdded', params: { supplier: input.supplier, amount: rp(input.amount), section: sec.name } });
      ctx.result.receiptId = id;
    },
  }),
  defineAction<{ id: string; date?: string; supplier?: string; directoryId?: string | null; amount?: number; sectionId?: string; budgetRequestId?: string | null }>({
    name: 'receipt.edit',
    // the person who submitted it while it is waiting (or after a rejection), and finance or management at any time
    can: (u, input, s) => finMgmt(u) || (isStaff(u) && s.receipts[input?.id]?.by === u.id),
    parse: (raw) => {
      const o = obj(raw);
      return {
        id: pickId(o, 'receiptId'), date: o.date === undefined ? undefined : isoDate(o.date), supplier: optText(o.supplier, 120), amount: o.amount === undefined ? undefined : rupiah(o.amount), sectionId: optText(o.sectionId, 80),
        directoryId: o.directoryId === null ? null : optText(o.directoryId, 80), budgetRequestId: o.budgetRequestId === null ? null : optText(o.budgetRequestId, 80),
      };
    },
    run(d, input, ctx) {
      const r = receiptOf(d, input.id, ctx);
      const mine = r.by === ctx.user.id && !hasRole(ctx.user, 'finance', 'mgmt');
      if (mine && r.status === 'approved') ctx.fail('finance.err.alreadyApproved');
      const sectionId = input.sectionId ? sectionOf(d, input.sectionId, ctx).id : r.sectionId;
      const date = input.date ?? r.date;
      if (date > ctx.today) ctx.fail('finance.err.futureDate');
      const link = input.budgetRequestId === undefined ? r.budgetRequestId : input.budgetRequestId || undefined;
      checkLink(d, ctx, link, sectionId, r.id);
      if (input.directoryId) checkDirectory(d, ctx, input.directoryId);
      r.sectionId = sectionId;
      r.date = date;
      if (input.supplier) r.supplier = input.supplier;
      if (input.amount) r.amount = input.amount;
      if (input.directoryId === null) delete r.directoryId;
      else if (input.directoryId) r.directoryId = input.directoryId;
      if (link) r.budgetRequestId = link;
      else delete r.budgetRequestId;
      if (mine && r.status === 'rejected') { r.status = 'submitted'; delete r.note; delete r.decidedBy; delete r.decidedAt; } // corrected and sent again
    },
  }),
  defineAction<{ id: string }>({
    name: 'receipt.void',
    // your own receipt while it is waiting; finance and management can void any
    can: (u, input, s) => finMgmt(u) || (isStaff(u) && s.receipts[input?.id]?.by === u.id && s.receipts[input?.id]?.status === 'submitted'),
    parse: (raw) => ({ id: pickId(obj(raw), 'receiptId') }),
    run(d, input, ctx) {
      receiptOf(d, input.id, ctx).voidedAt = ctx.nowDT;
    },
  }),
  defineAction<{ id: string }>({
    name: 'receipt.approve',
    can: finMgmt,
    parse: (raw) => ({ id: pickId(obj(raw), 'receiptId') }),
    run(d, input, ctx) {
      const r = receiptOf(d, input.id, ctx);
      if (r.status !== 'submitted') ctx.fail('finance.err.notPending');
      r.status = 'approved';
      r.decidedBy = ctx.actor;
      r.decidedAt = ctx.nowDT;
      r.xero = 'pending'; // goes to Xero now
      tellStaff(ctx, r.by, 'finance.notif.receiptApproved', { supplier: r.supplier, amount: rp(r.amount) }, requesterLink(d, r.by));
      ctx.feed({ icon: 'receipt_long', key: 'finance.feed.receiptApproved', params: { supplier: r.supplier, amount: rp(r.amount) } });
    },
  }),
  defineAction<{ id: string; note: string }>({
    name: 'receipt.reject',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { id: pickId(o, 'receiptId'), note: text(o.note, 300) }; },
    run(d, input, ctx) {
      const r = receiptOf(d, input.id, ctx);
      if (r.status !== 'submitted') ctx.fail('finance.err.notPending');
      r.status = 'rejected';
      r.decidedBy = ctx.actor;
      r.decidedAt = ctx.nowDT;
      r.note = input.note;
      tellStaff(ctx, r.by, 'finance.notif.receiptRejected', { supplier: r.supplier, note: input.note }, requesterLink(d, r.by));
    },
  }),

  // ---------- vendor invoices ----------
  defineAction<{ supplier: string; directoryId?: string; number: string; amount: number; due: string; sectionId: string }>({
    name: 'vendorInvoice.add',
    can: finMgmt,
    parse: (raw) => {
      const o = obj(raw);
      return { supplier: text(o.supplier, 120), directoryId: optText(o.directoryId, 80), number: text(o.number, 60), amount: rupiah(o.amount), due: isoDate(o.due), sectionId: text(o.sectionId, 80) };
    },
    run(d, input, ctx) {
      const sec = sectionOf(d, input.sectionId, ctx);
      checkDirectory(d, ctx, input.directoryId);
      if (Object.values(d.vendorInvoices).some((v) => !v.deletedAt && nameKey(v.supplier) === nameKey(input.supplier) && nameKey(v.number) === nameKey(input.number))) ctx.fail('finance.err.duplicateInvoice');
      const id = ctx.id('vi');
      d.vendorInvoices[id] = { ...base(ctx, id), supplier: input.supplier, ...(input.directoryId ? { directoryId: input.directoryId } : {}), number: input.number, amount: input.amount, due: input.due, sectionId: sec.id, status: 'toApprove', xero: 'notSent' };
      ctx.result.vendorInvoiceId = id;
    },
  }),
  defineAction<{ id: string; supplier?: string; directoryId?: string | null; number?: string; amount?: number; due?: string; sectionId?: string }>({
    name: 'vendorInvoice.edit',
    can: finMgmt,
    parse: (raw) => {
      const o = obj(raw);
      return {
        id: pickId(o, 'vendorInvoiceId'), supplier: optText(o.supplier, 120), number: optText(o.number, 60), amount: o.amount === undefined ? undefined : rupiah(o.amount), due: o.due === undefined ? undefined : isoDate(o.due),
        sectionId: optText(o.sectionId, 80), directoryId: o.directoryId === null ? null : optText(o.directoryId, 80),
      };
    },
    run(d, input, ctx) {
      const v = vendorOf(d, input.id, ctx);
      if (v.status === 'paid') ctx.fail('finance.err.vendorPaid');
      const supplier = input.supplier ?? v.supplier;
      const number = input.number ?? v.number;
      if (Object.values(d.vendorInvoices).some((x) => !x.deletedAt && x.id !== v.id && nameKey(x.supplier) === nameKey(supplier) && nameKey(x.number) === nameKey(number))) ctx.fail('finance.err.duplicateInvoice');
      if (input.sectionId) v.sectionId = sectionOf(d, input.sectionId, ctx).id;
      if (input.directoryId) checkDirectory(d, ctx, input.directoryId);
      v.supplier = supplier;
      v.number = number;
      if (input.amount) v.amount = input.amount;
      if (input.due) v.due = input.due;
      if (input.directoryId === null) delete v.directoryId;
      else if (input.directoryId) v.directoryId = input.directoryId;
      // changed after a rejection: back in the queue to approve
      if (v.status === 'rejected') { v.status = 'toApprove'; delete v.note; delete v.decidedBy; delete v.decidedAt; }
    },
  }),
  defineAction<{ id: string }>({
    name: 'vendorInvoice.approve',
    can: finMgmt,
    parse: (raw) => ({ id: pickId(obj(raw), 'vendorInvoiceId') }),
    run(d, input, ctx) {
      const v = vendorOf(d, input.id, ctx);
      if (v.status !== 'toApprove') ctx.fail('finance.err.notPending');
      v.status = 'approved';
      v.decidedBy = ctx.actor;
      v.decidedAt = ctx.nowDT;
      v.xero = 'pending'; // sent to Xero for payment
      ctx.feed({ icon: 'request_quote', key: 'finance.feed.vendorApproved', params: { supplier: v.supplier, number: v.number } });
    },
  }),
  defineAction<{ id: string; note: string }>({
    name: 'vendorInvoice.reject',
    can: finMgmt,
    parse: (raw) => { const o = obj(raw); return { id: pickId(o, 'vendorInvoiceId'), note: text(o.note, 300) }; },
    run(d, input, ctx) {
      const v = vendorOf(d, input.id, ctx);
      if (v.status !== 'toApprove') ctx.fail('finance.err.notPending');
      v.status = 'rejected';
      v.decidedBy = ctx.actor;
      v.decidedAt = ctx.nowDT;
      v.note = input.note;
    },
  }),
  defineAction<{ id: string }>({
    name: 'vendorInvoice.markPaid',
    can: finMgmt,
    parse: (raw) => ({ id: pickId(obj(raw), 'vendorInvoiceId') }),
    run(d, input, ctx) {
      const v = vendorOf(d, input.id, ctx);
      if (v.status !== 'approved') ctx.fail('finance.err.notApproved');
      v.status = 'paid';
      v.paidOn = ctx.today;
      v.paidBy = ctx.actor;
      ctx.feed({ icon: 'paid', key: 'finance.feed.vendorPaid', params: { supplier: v.supplier, number: v.number } });
    },
  }),
  defineAction<{ id: string }>({
    name: 'vendorInvoice.delete',
    can: finMgmt,
    parse: (raw) => ({ id: pickId(obj(raw), 'vendorInvoiceId') }),
    run(d, input, ctx) {
      const v = vendorOf(d, input.id, ctx);
      if (v.status === 'paid') ctx.fail('finance.err.vendorPaid'); // a paid invoice stays on record
      v.deletedAt = ctx.nowDT;
    },
  }),
] as ActionDef[];

// ---------- scheduled work (runs every 15 s on the server, inside the shared jobs.tick) ----------
// A job must never throw: one failure would roll back every other job's work in the same tick.
registerJob('finance.xero', (d, ctx) => {
  try { xeroSweep(d, ctx, false); } catch { /* try again on the next tick */ }
});
registerJob('finance.run', (d, ctx) => {
  try {
    const s = d as unknown as ClubState;
    const period = ym(ctx.today);
    if (+ctx.today.slice(8) < s.club.settings.issueDay) return;
    if (!Object.keys(d.members).length || runDone(s, period)) return;
    issueRun(d, ctx, period, true);
  } catch (e) {
    if (!(e instanceof DomainError)) console.error('finance.run job failed', e);
  }
});
