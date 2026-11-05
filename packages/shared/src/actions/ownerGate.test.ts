// Round 16 (KC): Management's pricing, holiday and weekly-budget changes wait for the Owner (Benjamin, s11).
import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, DomainError, live, actionItems, roleDraft, type ClubState } from '../index';
import { overviewStats } from '../rules/mgmt';
import { roleSummary } from '../rules/tasks';
import { pendingItems } from '../rules/approvals';
import { ownerKindOf, ownerWhat, ownerChanges, pendingOwnerRequests } from './ownerGate';
import { priceOn } from '../rules/billing';
import { rp } from '../util';
import { translate } from '../i18n';

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
    expect(note!.params.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // round 16 review: ISO, the bell formats it
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
    const off = run(base, 'access.setRole', { role: 'mgmt', levels: roleDraft(base, 'mgmt').levels, approvals: { ...roleDraft(base, 'mgmt').approvals, holidays: false } }, OWNER).state;
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
  it('round 17: the notice period from Ega waits for the Owner; the few-visits settings apply at once', () => {
    const a = run(base, 'club.updateSettings', { notice: { stop: 10 } }, EGA);
    expect(a.reviewed).toBe('owner');
    expect(a.state.club.settings.notice).toEqual(base.club.settings.notice);
    const crId = a.result.changeRequestId as string;
    expect(a.state.changeRequests[crId]).toMatchObject({ action: 'club.updateSettings', section: 'pricing', status: 'pending' });
    const b = run(a.state, 'review.approve', { crId }, OWNER);
    expect(b.state.club.settings.notice).toEqual({ downgrade: 14, stop: 10, leave: 14, upgrade: 1 });
    const f = run(base, 'club.updateSettings', { fewVisits: { below: 4, daysBeforeMonth: 18 } }, EGA);
    expect(f.reviewed).toBeUndefined();
    expect(f.state.club.settings.fewVisits).toEqual({ below: 4, daysBeforeMonth: 18 });
    expect(pendingOwnerRequests(f.state, 'pricing')).toHaveLength(0);
  });
  it('ownerKindOf maps each action', () => {
    const hol = live(base.calendarEvents).find((e) => e.kind === 'holiday')!;
    const out = live(base.calendarEvents).find((e) => e.kind === 'outing')!;
    expect(ownerKindOf('club.setPlan', {}, base)).toBe('pricing');
    expect(ownerKindOf('club.updateSettings', { notice: { leave: 20 } }, base)).toBe('pricing');
    expect(ownerKindOf('club.updateSettings', { flexQuota: 8 }, base)).toBe('pricing');
    expect(ownerKindOf('club.updateSettings', { notice: { upgrade: 3 } }, base)).toBe('pricing'); // round 19
    expect(ownerKindOf('club.updateSettings', { leaveMaxMonths: 3 }, base)).toBe('pricing');
    expect(ownerKindOf('club.updateSettings', { fewVisits: { below: 4, daysBeforeMonth: 18 } }, base)).toBeNull(); // round 17: the few-visits alert applies at once
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

describe('final review minor 2: a club-rules request says what it changes', () => {
  it('one notice kind: "Stop membership · 30 days" in the request and the bell; several: all three; Flex visits alone', () => {
    const r = run(base, 'club.updateSettings', { notice: { stop: 30 } }, EGA);
    const cr = r.state.changeRequests[r.result.changeRequestId as string];
    const w = ownerWhat(r.state, cr.action, cr.input);
    expect(translate('en', w.key, w.params)).toBe('Stop membership · 30 days');
    expect(translate('id', w.key, w.params)).toBe('Berhenti · 30 hari');
    const note = Object.values(r.state.notifications).find((x) => x.kind === 'notif.ownerApproval' && x.ref?.id === cr.id)!;
    expect(translate('en', String(note.params.whatKey), note.params)).toBe('Stop membership · 30 days');
    const many = ownerWhat(base, 'club.updateSettings', { notice: { downgrade: 21, leave: 30 } });
    expect(translate('en', many.key, many.params)).toBe('Notice · downgrade 21 · stop 14 · leave 30 · upgrade 1 days');
    const flex = ownerWhat(base, 'club.updateSettings', { flexQuota: 8 });
    expect(translate('en', flex.key, flex.params)).toBe('Flex · 8 visits a month');
  });
  it('round 19: "Upgrade · 3 days" and "Leave in a row · 3 months"', () => {
    const up = ownerWhat(base, 'club.updateSettings', { notice: { upgrade: 3 } });
    expect(translate('en', up.key, up.params)).toBe('Upgrade · 3 days');
    expect(translate('id', up.key, up.params)).toBe('Naik paket · 3 hari');
    const lm = ownerWhat(base, 'club.updateSettings', { leaveMaxMonths: 3 });
    expect(translate('en', lm.key, lm.params)).toBe('Leave in a row · 3 months');
    expect(translate('id', lm.key, lm.params)).toBe('Cuti berturut-turut · 3 bulan');
    const r = run(base, 'club.updateSettings', { leaveMaxMonths: 3 }, EGA);
    expect(r.reviewed).toBe('owner');
    expect(r.state.club.settings.leaveMaxMonths).toBeUndefined();
  });
});

describe('ownerChanges: what a request changes', () => {
  const cur = priceOn(base, '2026-11-01');
  const same = { flex: cur.flex, gold: cur.gold, extra: cur.extra };
  it('prices.set lists only the prices that differ, old to new', () => {
    const rows = ownerChanges(base, 'prices.set', { ...same, flex: cur.flex + 200_000, extra: cur.extra + 50_000, from: '2026-11-01' });
    expect(rows).toEqual([
      { label: 'approvals.owner.chg.flex', from: rp(cur.flex), to: rp(cur.flex + 200_000) },
      { label: 'approvals.owner.chg.extra', from: rp(cur.extra), to: rp(cur.extra + 50_000) },
    ]);
  });
  it('prices.set with every price equal lists nothing', () => {
    expect(ownerChanges(base, 'prices.set', { ...same, from: '2026-11-01' })).toEqual([]);
  });
  it('club.setPlan: a new plan lists name, type, days; an edit lists only what changed', () => {
    const added = ownerChanges(base, 'club.setPlan', { name: 'Flex 6', kind: 'days', quota: 6, active: true });
    expect(added).toEqual([{ label: 'approvals.owner.chg.name', to: 'Flex 6' }, { label: 'approvals.owner.chg.kind', to: 'approvals.owner.chg.kind_days' }, { label: 'approvals.owner.chg.quota', to: '6' }]);
    const s: ClubState = { ...base, club: { ...base.club, settings: { ...base.club.settings, plans: [{ id: 'plan_1', name: 'Flex 6', kind: 'days', quota: 6, active: true }] } } };
    expect(ownerChanges(s, 'club.setPlan', { id: 'plan_1', name: 'Flex 6', kind: 'days', quota: 8, active: true })).toEqual([{ label: 'approvals.owner.chg.quota', from: '6', to: '8' }]);
  });
  it('budget.setLimit: the weekly amount old to new', () => {
    const was = base.budgetSections.fnb.limits.filter((l) => l.fromWeek <= '2026-11-02').pop()!.weekly;
    expect(ownerChanges(base, 'budget.setLimit', { sectionId: 'fnb', weekly: was + 1_000_000, fromWeek: '2026-11-02' })).toEqual([{ label: base.budgetSections.fnb.name, from: rp(was), to: rp(was + 1_000_000) }]);
  });
});

describe('ownerChanges: closed days, holidays and budget names', () => {
  it('calendarEvent.create lists kind, date and title; a range lists Dates', () => {
    expect(ownerChanges(base, 'calendarEvent.create', CLOSE)).toEqual([
      { label: 'approvals.owner.chg.eventKind', to: 'cal.t_closed' },
      { label: 'approvals.owner.chg.date', to: 'date:2026-11-04' },
      { label: 'approvals.owner.chg.title', to: 'Staff training day' },
    ]);
    const rows = ownerChanges(base, 'calendarEvent.create', { ...CLOSE, kind: 'holiday', endDate: '2026-11-05' });
    expect(rows[0].to).toBe('cal.t_holiday');
    expect(rows[1]).toEqual({ label: 'approvals.owner.chg.dates', to: 'date:2026-11-04~2026-11-05' });
  });
  const made = () => { const a = run(base, 'calendarEvent.create', CLOSE, OWNER); return { s: a.state, eventId: a.result.eventId as string }; };
  it('calendarEvent.update lists only what changes', () => {
    const { s, eventId } = made();
    expect(ownerChanges(s, 'calendarEvent.update', { eventId, title: 'Training' })).toEqual([{ label: 'approvals.owner.chg.title', from: 'Staff training day', to: 'Training' }]);
    expect(ownerChanges(s, 'calendarEvent.update', { eventId, title: 'Staff training day', endDate: '2026-11-05' })).toEqual([{ label: 'approvals.owner.chg.dates', from: 'date:2026-11-04', to: 'date:2026-11-04~2026-11-05' }]);
  });
  it('calendarEvent.delete is one Remove row with kind, date and title', () => {
    const { s, eventId } = made();
    expect(ownerChanges(s, 'calendarEvent.delete', { eventId })).toEqual([{ label: 'approvals.owner.chg.remove', to: 'cal.t_closed|date:2026-11-04|Staff training day' }]);
  });
  it('budget.renameSection lists old name to new name', () => {
    const was = base.budgetSections.fnb.name;
    expect(ownerChanges(base, 'budget.renameSection', { sectionId: 'fnb', name: 'Food and drink' })).toEqual([{ label: 'approvals.owner.chg.name', from: was, to: 'Food and drink' }]);
  });
});
