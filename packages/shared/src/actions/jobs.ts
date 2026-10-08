// Scheduled work run by the server every 15 s as the system user (scheduled broadcasts, invoice run, simulated syncs…).
// Feature modules register job functions with registerJob(); 'jobs.tick' runs them all inside one mutation.
import type { Draft } from 'immer';
import type { ClubState, Member } from '../types';
import { defineAction, DomainError, type Ctx } from './framework';
import { currentMembership, isPendingRow, memberShort, primaryContact } from '../rules/core';
import { stopsDue, suspensions } from '../rules/billing';
import { leaveOverrunMonth } from '../rules/leave';
import { finalInvoiceFor } from '../rules/members';
import { addDays, rp } from '../util';

type Job = (d: Draft<ClubState>, ctx: Ctx) => void;
const JOBS: Record<string, Job> = {};
export const registerJob = (name: string, fn: Job) => { JOBS[name] = fn; };
export const jobsActions = [
  defineAction<Record<string, never>>({
    name: 'jobs.tick',
    can: (u) => u.id === 'system',
    run(d, _i, ctx) {
      for (const fn of Object.values(JOBS)) fn(d, ctx);
    },
  }),
];

// ---------- the daily membership job (the brochure's terms) ----------
// An invoice still unpaid on the 1st (after its due month) puts the membership on hold until it is paid (read from the invoices, nothing is stored; here the
// club is told once). Still unpaid on the 3rd, and no word from the family (no call note on the invoice), the membership stops (re-registration, with its fee again). A member with 2 months of leave in a row who is not
// confirmed back is taken to have resigned at the start of the month after. Management and the billing contact are told each time.
const toldAlready = (d: Draft<ClubState>, kind: string, refId: string) => Object.values(d.notifications).some((n) => !n.deletedAt && n.kind.startsWith(kind) && n.ref?.id === refId);

registerJob('membership.daily', (d, ctx) => {
  try {
    const s = d as unknown as ClubState;
    const today = ctx.today;
    // 1. on hold: tell once, on the first run after the hold begins
    for (const [memberId, sus] of Object.entries(suspensions(s, today))) {
      if (toldAlready(d, 'finance.notif.suspended', sus.invoiceId)) continue;
      const m = d.members[memberId];
      const name = memberShort(m);
      const params = { name, number: sus.number, amount: rp(sus.balance), date: sus.stopOn };
      const tail = sus.told ? 'Told' : ''; // the family gave notice: no stop date to warn about
      ctx.notify({ toRoles: ['mgmt', 'finance'], kind: `finance.notif.suspended${tail}`, params, link: `/members/${memberId}`, memberId, severity: 'attention', ref: { type: 'invoice', id: sus.invoiceId } });
      const payer = primaryContact(s, memberId);
      if (payer) ctx.notify({ toUsers: [payer.id], kind: `finance.notif.suspended${tail}Family`, params, link: '/billing', memberId, severity: 'attention', ref: { type: 'invoice', id: sus.invoiceId } });
      ctx.feed({ icon: 'pause_circle', key: 'finance.feed.suspended', params: { name, number: sus.number }, memberId });
    }
    // 2. stopped: unpaid on the stop day
    for (const x of stopsDue(s, today)) {
      const m = d.members[x.memberId];
      const cur = currentMembership(m);
      const lastDay = addDays(x.since, -1) < cur.start ? cur.start : addDays(x.since, -1); // the day before the hold began
      cur.lastDay = lastDay; cur.endReason = 'unpaid'; cur.endNote = x.number; cur.endedBy = 'system'; cur.endedAt = ctx.nowDT;
      for (const r of Object.values(d.planChangeRequests)) if (r.memberId === m.id && r.status === 'pending') { r.status = 'declined'; r.decidedBy = 'system'; r.decidedAt = ctx.nowDT; }
      const fin = finalInvoiceFor(s, m as Member, lastDay, today); // extra days no invoice has billed yet
      if (fin) d.invoices[fin.number] = { id: fin.number, clubId: ctx.clubId, createdAt: ctx.nowDT, createdBy: 'system', ...fin };
      const name = memberShort(m);
      const params = { name, number: x.number, amount: rp(x.balance) };
      ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'finance.notif.stopped', params, link: `/members/${m.id}`, memberId: m.id, severity: 'attention', ref: { type: 'invoice', id: x.invoiceId } });
      const payer = primaryContact(s, m.id);
      if (payer) ctx.notify({ toUsers: [payer.id], kind: 'finance.notif.stoppedFamily', params, link: '/billing', memberId: m.id, severity: 'attention', ref: { type: 'invoice', id: x.invoiceId } });
      ctx.feed({ icon: 'person_off', key: 'finance.feed.stopped', params: { name, number: x.number }, memberId: m.id });
    }
    // 3. leave that ran out: 2 months in a row and no word for the next one
    for (const m of Object.values(d.members)) {
      if (m.deletedAt || isPendingRow(m)) continue;
      const month = leaveOverrunMonth(m as Member, today);
      if (!month) continue;
      const cur = currentMembership(m);
      const lastDay = addDays(`${month}-01`, -1) < cur.start ? cur.start : addDays(`${month}-01`, -1);
      cur.lastDay = lastDay; cur.endReason = 'leaveOverrun'; cur.endedBy = 'system'; cur.endedAt = ctx.nowDT;
      const name = memberShort(m);
      ctx.notify({ toRoles: ['mgmt', 'finance'], kind: 'family.notif.leaveOverrun', params: { name, month }, link: `/members/${m.id}`, memberId: m.id, severity: 'attention' });
      const payer = primaryContact(s, m.id);
      if (payer) ctx.notify({ toUsers: [payer.id], kind: 'family.notif.leaveOverrunFamily', params: { name, month }, link: '/billing', memberId: m.id, severity: 'attention' });
      ctx.feed({ icon: 'person_off', key: 'family.feed.leaveOverrun', params: { name, month }, memberId: m.id });
    }
  } catch (e) {
    if (!(e instanceof DomainError)) console.error('membership.daily job failed', e);
  }
});
