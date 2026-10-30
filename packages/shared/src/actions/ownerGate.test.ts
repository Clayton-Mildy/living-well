// Round 16 (KC): Management's pricing, holiday and weekly-budget changes wait for the Owner (Benjamin, s11).
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, DomainError, live, actionItems, type ClubState } from '../index';
import { overviewStats } from '../rules/mgmt';
import { roleSummary } from '../rules/tasks';
import { pendingItems } from '../rules/approvals';
import { ownerKindOf, pendingOwnerRequests } from './ownerGate';

const clock = { today: '2026-10-21', nowMin: 600 };
const later = { today: '2026-10-27', nowMin: 600 };
const seeded = buildSeed().citra;
// the seed's own pending holiday (R7) is left out, so each test starts with no owner requests
const base: ClubState = { ...seeded, changeRequests: Object.fromEntries(Object.entries(seeded.changeRequests).filter(([, c]) => !['pricing', 'holiday', 'budget'].includes(c.section))) };
let n = 0;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, c = clock) => execute(s, name, input, as(s, uid), c, `og${++n}`);
const fails = (fn: () => unknown, code: string) => {
  try { fn(); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected to fail with ${code}`);
};
const EGA = 's9', OWNER = 's11', FRANSISKA = 's10';
const CLOSE = { date: '2026-11-04', kind: 'closed', title: 'Staff training day', titleId: 'Hari pelatihan staf' };
const eventsCount = (s: ClubState) => live(s.calendarEvents).length;

describe('owner gate', () => {
  it("Ega's closure waits for the Owner: no event, a pending holiday request, the Owner told", () => {
    const r = run(base, 'calendarEvent.create', CLOSE, EGA);
    expect(r.reviewed).toBe('owner');
    expect(eventsCount(r.state)).toBe(eventsCount(base));
    const id = r.result.changeRequestId as string;
    const cr = r.state.changeRequests[id];
    expect(cr).toMatchObject({ kind: 'approval', op: 'update', action: 'calendarEvent.create', section: 'holiday', target: { type: 'club', id: base.clubId }, changes: [], status: 'pending', submittedBy: 'staff:s9' });
    expect(pendingOwnerRequests(r.state, 'holiday').map((c) => c.id)).toEqual([id]);
    const note = Object.values(r.state.notifications).find((x) => x.kind === 'notif.ownerApproval');
    expect(note).toMatchObject({ toRoles: ['owner'], link: '/reviews' });
  });
  it('an outing applies at once', () => {
    const r = run(base, 'calendarEvent.create', { ...CLOSE, kind: 'outing', title: 'Outing: zoo' }, EGA);
    expect(r.reviewed).toBeUndefined();
    expect(eventsCount(r.state)).toBe(eventsCount(base) + 1);
  });
  it("the Owner's approval creates the event as Ega's; Ega cannot approve it herself", () => {
    const a = run(base, 'calendarEvent.create', CLOSE, EGA);
    const crId = a.result.changeRequestId as string;
    fails(() => run(a.state, 'review.approve', { crId }, EGA), 'err.forbidden');
    const b = run(a.state, 'review.approve', { crId }, OWNER);
    const ev = live(b.state.calendarEvents).find((e) => e.title === 'Staff training day');
    expect(ev).toMatchObject({ kind: 'closed', date: '2026-11-04', createdBy: 'staff:s9' });
    expect(b.state.changeRequests[crId].status).toBe('approved');
  });
  it('a rejection with a note leaves no event', () => {
    const a = run(base, 'calendarEvent.create', CLOSE, EGA);
    const crId = a.result.changeRequestId as string;
    fails(() => run(a.state, 'review.reject', { crId, note: 'No' }, EGA), 'err.forbidden');
    const b = run(a.state, 'review.reject', { crId, note: 'Pick a Friday' }, OWNER);
    expect(eventsCount(b.state)).toBe(eventsCount(base));
    expect(b.state.changeRequests[crId]).toMatchObject({ status: 'rejected', note: 'Pick a Friday' });
  });
  it('Ega withdraws her own request', () => {
    const a = run(base, 'calendarEvent.create', CLOSE, EGA);
    const crId = a.result.changeRequestId as string;
    const b = run(a.state, 'review.withdraw', { crId }, EGA);
    expect(b.state.changeRequests[crId].status).toBe('withdrawn');
    expect(pendingOwnerRequests(b.state)).toEqual([]);
  });
  it("Ega's prices are gated; Fransiska's weekly budget applies at once (her switch is off); the Owner's own apply", () => {
    const p = run(base, 'prices.set', { flex: 4_000_000, gold: 6_000_000, extra: 300_000, from: '2026-11-01' }, EGA);
    expect(p.reviewed).toBe('owner');
    expect(p.state.changeRequests[p.result.changeRequestId as string].section).toBe('pricing');
    expect(live(p.state.prices).length).toBe(live(base.prices).length);
    const b = run(base, 'budget.setLimit', { sectionId: 'fnb', weekly: 9_000_000, fromWeek: '2026-11-02' }, FRANSISKA);
    expect(b.reviewed).toBeUndefined();
    expect(b.state.budgetSections.fnb.limits.some((l) => l.fromWeek === '2026-11-02' && l.weekly === 9_000_000)).toBe(true);
    const g = run(base, 'budget.setLimit', { sectionId: 'fnb', weekly: 9_000_000, fromWeek: '2026-11-02' }, EGA);
    expect(g.reviewed).toBe('owner');
    expect(run(base, 'calendarEvent.create', CLOSE, OWNER).reviewed).toBeUndefined();
  });
  it('the switch off lets Management apply at once', () => {
    const off = run(base, 'access.setOwnerApproval', { role: 'mgmt', kind: 'holidays', on: false }, OWNER).state;
    const r = run(off, 'calendarEvent.create', CLOSE, EGA);
    expect(r.reviewed).toBeUndefined();
    expect(eventsCount(r.state)).toBe(eventsCount(base) + 1);
  });
  it('a request that no longer fits fails with the action’s own error and stays pending', () => {
    const a = run(base, 'calendarEvent.create', { ...CLOSE, date: '2026-10-26' }, EGA);
    const crId = a.result.changeRequestId as string;
    fails(() => run(a.state, 'review.approve', { crId }, OWNER, later), 'cal.err.pastDate'); // the day passed while it waited
    // the failed approval changed nothing: on a day it still fits, the same request is approved
    expect(run(a.state, 'review.approve', { crId }, OWNER).state.changeRequests[crId].status).toBe('approved');
    // removing a holiday the Owner removed himself in between
    const hol = live(base.calendarEvents).find((e) => e.kind === 'holiday' && e.date > clock.today)!;
    const d = run(base, 'calendarEvent.delete', { eventId: hol.id }, EGA);
    const gone = run(d.state, 'calendarEvent.delete', { eventId: hol.id }, OWNER).state;
    fails(() => run(gone, 'review.approve', { crId: d.result.changeRequestId }, OWNER), 'err.notFound');
    // the hub reports it as a conflict and leaves it waiting
    const h = run(gone, 'approval.approve', { type: 'owner', ids: [d.result.changeRequestId] }, OWNER);
    expect(h.result.conflicts).toEqual([d.result.changeRequestId]);
    expect(h.state.changeRequests[d.result.changeRequestId as string].status).toBe('pending');
  });
  it("a bad request fails at once (the dry run): nothing is stored", () => {
    fails(() => run(base, 'calendarEvent.create', { ...CLOSE, date: '2026-10-01' }, EGA), 'cal.err.pastDate');
  });
  it("the hub: 'profile' leaves owner requests out; 'owner' lists them and only the Owner acts on them", () => {
    const a = run(base, 'calendarEvent.create', CLOSE, EGA);
    const crId = a.result.changeRequestId as string;
    expect(pendingItems(a.state, 'profile').map((x) => x.id)).not.toContain(crId);
    expect(pendingItems(a.state, 'owner').map((x) => x.id)).toEqual([crId]);
    fails(() => run(a.state, 'approval.approve', { type: 'owner', ids: [crId] }, EGA), 'err.forbidden');
    expect(run(a.state, 'approval.approve', { type: 'profile', ids: [crId] }, EGA).result.skipped).toEqual([crId]);
    const b = run(a.state, 'approval.approve', { type: 'owner', ids: [crId] }, OWNER);
    expect(b.state.changeRequests[crId].status).toBe('approved');
  });
  it('ownerKindOf maps each action', () => {
    const hol = live(base.calendarEvents).find((e) => e.kind === 'holiday')!;
    const out = live(base.calendarEvents).find((e) => e.kind === 'outing')!;
    expect(ownerKindOf('club.setPlan', {}, base)).toBe('pricing');
    expect(ownerKindOf('club.updateSettings', {}, base)).toBe('pricing');
    expect(ownerKindOf('budget.addSection', {}, base)).toBe('budget');
    expect(ownerKindOf('budget.renameSection', {}, base)).toBe('budget');
    expect(ownerKindOf('calendarEvent.update', { eventId: out.id, kind: 'closed' }, base)).toBe('holidays');
    expect(ownerKindOf('calendarEvent.update', { eventId: hol.id, title: 'x' }, base)).toBe('holidays');
    expect(ownerKindOf('calendarEvent.update', { eventId: out.id, title: 'x' }, base)).toBeNull();
    expect(ownerKindOf('calendarEvent.delete', { eventId: out.id }, base)).toBeNull();
    expect(ownerKindOf('receipt.add', {}, base)).toBeNull();
  });
  it('the seed has Ega’s pending staff training day for the Owner', () => {
    const cr = pendingOwnerRequests(seeded, 'holiday')[0];
    expect(cr).toMatchObject({ action: 'calendarEvent.create', submittedBy: 'staff:s9', input: { kind: 'closed', title: 'Staff training day', titleId: 'Hari pelatihan staf', date: '2026-12-14' } });
    expect(Object.values(seeded.notifications).some((x) => x.kind === 'notif.ownerApproval' && x.ref?.id === cr.id)).toBe(true);
  });
  it('the seeded day is Mon 14 Dec for the 21 Oct and the 30 Oct anchors (moved by whole months)', () => {
    expect((pendingOwnerRequests(buildSeed('2026-10-30').citra, 'holiday')[0].input as { date: string }).date).toBe('2026-12-14');
  });
  it("Needs action: Ega gets no item for an owner request; Benjamin gets one 'Owner approvals waiting' item; his tile and duty count it", () => {
    const ega = actionItems(seeded, as(seeded, EGA), clock.today, clock.nowMin);
    expect(ega.some((x) => x.id === 'cr:cr-owner-training' || x.id === 'approvals:owner')).toBe(false);
    const ben = actionItems(seeded, as(seeded, OWNER), clock.today, clock.nowMin);
    expect(ben.find((x) => x.id === 'approvals:owner')).toMatchObject({ kind: 'notif.act.approvalsOwner', params: { n: 1 }, link: '/reviews?tab=owner' });
    expect(ben.some((x) => x.id === 'cr:cr-owner-training')).toBe(false);
    expect(overviewStats(seeded, clock.today, { owner: true }).reviews).toBe(overviewStats(seeded, clock.today).reviews + 1);
    const duty = (o: { owner?: boolean }) => roleSummary(seeded, 'mgmt', clock.today, clock.today, clock.nowMin, o).duties.find((d) => d.def.id === 'mgmt.approvals')!.parts[0].count!.total;
    expect(duty({ owner: true })).toBe(duty({}) + 1);
  });
});
