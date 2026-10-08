// KC round 7: guest hosts — people from outside the club who are invited and paid to lead a session.
// A guest is booked for one date + slot (`GuestSession`); its fee becomes a vendor invoice at booking, so finance can pay before or after the
// performance, and the payment state is always read from that invoice (never stored twice).
import type { ClubState, GuestHost, GuestHostKind, GuestSession, ISODate, Slot, VendorInvoice } from '../types';
import { dayStatus } from './core';
import { sessionsOn } from './kitchen';
import { live, sortBy, sum } from '../util';

export const GUEST_KINDS: GuestHostKind[] = ['teacher', 'entertainer', 'speaker', 'other'];
export const GUEST_KIND_ICON: Record<GuestHostKind, string> = { teacher: 'school', entertainer: 'theater_comedy', speaker: 'record_voice_over', other: 'person' };

/** The guest host booked for a session (not cancelled), with their record. */
export function guestOn(s: ClubState, date: ISODate, slot: Slot): { session: GuestSession; host: GuestHost } | null {
  const g = live(s.guestSessions || {}).find((x) => x.date === date && x.slot === slot && x.status !== 'cancelled');
  const host = g && s.guestHosts?.[g.hostId];
  return g && host ? { session: g, host } : null;
}

/** Every guest session of a host, newest first. */
export const sessionsOfHost = (s: ClubState, hostId: string): GuestSession[] =>
  sortBy(live(s.guestSessions || {}).filter((x) => x.hostId === hostId), (x) => x.date + x.slot).reverse();

// ---------- hosts ----------
/** Hosts that are not archived, active ones first, then by name. */
export const hostsList = (s: ClubState): GuestHost[] =>
  sortBy(live(s.guestHosts || {}), (h) => (h.active ? '0' : '1') + h.name.toLowerCase());
/** Hosts that can be booked. */
export const bookableHosts = (s: ClubState): GuestHost[] => hostsList(s).filter((h) => h.active);
export const hostOf = (s: ClubState, id: string): GuestHost | undefined => {
  const h = s.guestHosts?.[id];
  return h && !h.deletedAt ? h : undefined;
};
/** The host record of a session even when the host was archived since (history keeps the name). */
export const hostOfSession = (s: ClubState, g: Pick<GuestSession, 'hostId'>): GuestHost | undefined => s.guestHosts?.[g.hostId];

// ---------- payment ----------
export type GuestPay = 'none' | 'toPay' | 'paid';
/** The vendor invoice of a session (made when it was booked, KC round 7; undefined for a cancelled unpaid one or when finance deleted it). */
export const invoiceOfSession = (s: ClubState, g: Pick<GuestSession, 'vendorInvoiceId'>): VendorInvoice | undefined => {
  const v = g.vendorInvoiceId ? s.vendorInvoices?.[g.vendorInvoiceId] : undefined;
  return v && !v.deletedAt ? v : undefined;
};
/** none: nothing to pay (no invoice, withdrawn, or cancelled before paying) · toPay: finance has not paid yet · paid: finance marked the invoice paid. A booked session can be paid before it takes place. */
export function payStateOf(s: ClubState, g: GuestSession): GuestPay {
  if (g.status === 'cancelled') return invoiceOfSession(s, g)?.status === 'paid' ? 'paid' : 'none';
  const v = invoiceOfSession(s, g);
  if (v?.status === 'paid') return 'paid';
  return v?.status === 'rejected' ? 'none' : 'toPay'; // no invoice (finance deleted it) still leaves the fee to pay
}
/** What is paid or owed: the invoice amount (finance may have corrected it), else the booked fee. */
export const feeOfSession = (s: ClubState, g: GuestSession): number => invoiceOfSession(s, g)?.amount ?? g.fee;

/** The next vendor invoice number for a guest session on `date`: GH-YYMM-001, GH-YYMM-002 … (unique across all vendor invoices). */
export function guestInvoiceNumber(s: Pick<ClubState, 'vendorInvoices'>, date: ISODate): string {
  const prefix = `GH-${date.slice(2, 4)}${date.slice(5, 7)}-`;
  const numbers = new Set(live(s.vendorInvoices || {}).map((v) => v.number));
  let n = live(s.vendorInvoices || {}).filter((v) => v.number.startsWith(prefix)).length + 1;
  while (numbers.has(prefix + String(n).padStart(3, '0'))) n++;
  return prefix + String(n).padStart(3, '0');
}

// ---------- lists ----------
export interface GuestLists {
  /** booked, oldest first (a booked session whose date has passed is first: it needs "Mark as done"); each may already be paid */
  upcoming: GuestSession[];
  /** everything not paid yet, booked or done, oldest first (finance can pay before the performance) */
  toPay: GuestSession[];
  /** everything paid, booked or done, newest first */
  paid: GuestSession[];
  /** cancelled, newest first */
  cancelled: GuestSession[];
  /** done and not paid yet / done and paid: with `upcoming`, every session once (the "All" view) */
  doneToPay: GuestSession[];
  donePaid: GuestSession[];
}
export function guestLists(s: ClubState): GuestLists {
  const all = live(s.guestSessions || {});
  const asc = (a: GuestSession[]) => sortBy(a, (x) => x.date + x.slot);
  const desc = (a: GuestSession[]) => asc(a).reverse();
  const done = all.filter((x) => x.status === 'done');
  return {
    upcoming: asc(all.filter((x) => x.status === 'booked')),
    toPay: asc(all.filter((x) => payStateOf(s, x) === 'toPay')),
    paid: desc(all.filter((x) => payStateOf(s, x) === 'paid')),
    cancelled: desc(all.filter((x) => x.status === 'cancelled')),
    doneToPay: asc(done.filter((x) => payStateOf(s, x) !== 'paid')),
    donePaid: desc(done.filter((x) => payStateOf(s, x) === 'paid')),
  };
}
/** Total still to pay to guest hosts. */
export const owedTotal = (s: ClubState): number => sum(guestLists(s).toPay.map((g) => feeOfSession(s, g)));

/** Why a booked session may not happen as planned: the club is closed, an outing replaces the day, or the slot has no session any more. */
export type GuestIssue = 'closed' | 'outing' | 'noSession';
export function guestIssue(s: ClubState, g: GuestSession): GuestIssue | null {
  if (g.status !== 'booked') return null;
  const st = dayStatus(s, g.date);
  if (!st.open) return 'closed';
  if (st.outing) return 'outing';
  return sessionsOn(s, g.date).find((x) => x.slot === g.slot)?.cell ? null : 'noSession';
}

export interface HostTotals {
  /** sessions that took place */
  sessions: number;
  /** booked and still to come (or to be marked done) */
  upcoming: number;
  paid: number;
  owed: number;
}
export function hostTotals(s: ClubState, hostId: string): HostTotals {
  const mine = sessionsOfHost(s, hostId);
  const money = (pay: GuestPay) => sum(mine.filter((g) => payStateOf(s, g) === pay).map((g) => feeOfSession(s, g)));
  return { sessions: mine.filter((g) => g.status === 'done').length, upcoming: mine.filter((g) => g.status === 'booked').length, paid: money('paid'), owed: money('toPay') };
}
