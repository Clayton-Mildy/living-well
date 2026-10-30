import { describe, it, expect } from 'vitest';
import { balanceOf, buildSeed, execute, getUser, updatesFor, DomainError, familyUserIds, type ClubState } from '../index';
import { dayInfo } from '../rules/calendar';
import { coversOn } from '../rules/kitchenOps';
import { famDay } from '../rules/famCalendar';
import { projectForFamily } from '../project';

const T = '2026-10-21'; // Wednesday
const clock = { today: T, nowMin: 10 * 60 };
let n = 0;
const mid = () => `ce${++n}`;
const seed = () => buildSeed().citra;
const user = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, user(s, uid), clock, mid());
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const req = { memberId: 'm46', kind: 'birthday', title: "Opa Budi's 80th birthday", date: '2026-11-05', from: '15:00', to: '17:00', roomId: 'room-garden-room', guests: 12, cateringNote: 'Chocolate cake, no nuts' };
// the demo state already holds a few of these (seeded), so find ours by what is new
const created = (before: ClubState, after: ClubState) => Object.keys(after.celebrations).filter((k) => !(k in before.celebrations));

describe('celebrations (actions)', () => {
  it('lobby requests (requested + one notification to management); management confirms at once', () => {
    const s = seed();
    const r = run(s, 'celebration.request', req, 's1');
    const [id] = created(s, r.state);
    expect(r.state.celebrations[id]).toMatchObject({ status: 'requested', memberId: 'm46', guests: 12, requestedBy: 'staff:s1' });
    const told = updatesFor(r.state, user(r.state, 's9')).filter((x) => x.kind === 'celeb.notif.requested');
    expect(told).toHaveLength(1);
    const m = run(s, 'celebration.request', req, 's9');
    const [mid2] = created(s, m.state);
    expect(m.state.celebrations[mid2]).toMatchObject({ status: 'confirmed', decidedBy: 'staff:s9' });
    expect(m.state.celebrations[mid2].decidedAt).toBeTruthy();
    expect(updatesFor(m.state, user(m.state, 's9')).some((x) => x.kind === 'celeb.notif.requested')).toBe(false);
  });
  it('the activity team requests too: it comes back requested and management is told (Prepare on a birthday)', () => {
    const s = seed();
    const r = run(s, 'celebration.request', req, 's5');
    const [id] = created(s, r.state);
    expect(r.state.celebrations[id]).toMatchObject({ status: 'requested', memberId: 'm46', requestedBy: 'staff:s5' });
    expect(updatesFor(r.state, user(r.state, 's9')).filter((x) => x.kind === 'celeb.notif.requested')).toHaveLength(1);
    fails(r.state, 'celebration.decide', { celebrationId: id, status: 'confirmed' }, 's5', 'err.forbidden');
  });
  it('validates and refuses what the front desk cannot hold', () => {
    const s = seed();
    fails(s, 'celebration.request', { ...req, guests: 201 }, 's1', 'err.invalid');
    fails(s, 'celebration.request', { ...req, guests: -1 }, 's1', 'err.invalid');
    fails(s, 'celebration.request', { ...req, title: '' }, 's1', 'err.invalid');
    fails(s, 'celebration.request', { ...req, kind: 'party' }, 's1', 'err.invalid');
    fails(s, 'celebration.request', { ...req, memberId: 'nope' }, 's1', 'err.notFound');
    fails(s, 'celebration.request', { ...req, date: '2026-10-20' }, 's1', 'mgmt.err.venuePast');
    for (const uid of ['s8', 's10', 'f1']) expect(() => run(s, 'celebration.request', req, uid)).toThrow('err.forbidden');
  });
  it('a request clashing with a venue booking is refused and nothing is saved', () => {
    const s = seed();
    const before = Object.keys(s.celebrations);
    fails(s, 'celebration.request', { ...req, date: '2026-10-24', roomId: 'room-lounge', from: '10:00', to: '11:00' }, 's1', 'mgmt.err.venueClash'); // v1, whole club
    expect(Object.keys(s.celebrations)).toEqual(before);
    fails(s, 'celebration.request', { ...req, date: '2026-10-30' }, 's1', 'mgmt.err.venueClosed');
  });
  it('only management decides; confirming tells the front desk and the member family; confirmed holds the room', () => {
    const s = seed();
    const r = run(s, 'celebration.request', req, 's1');
    const [id] = created(s, r.state);
    fails(r.state, 'celebration.decide', { celebrationId: id, status: 'confirmed' }, 's1', 'err.forbidden');
    const d = run(r.state, 'celebration.decide', { celebrationId: id, status: 'confirmed' }, 's9');
    expect(d.state.celebrations[id]).toMatchObject({ status: 'confirmed', decidedBy: 'staff:s9' });
    expect(updatesFor(d.state, user(d.state, 's1')).some((x) => x.kind === 'celeb.notif.decided')).toBe(true);
    const fam = familyUserIds(d.state, 'm46');
    expect(fam.length).toBeGreaterThan(0);
    for (const f of fam) {
      const got = updatesFor(d.state, user(d.state, f)).filter((x) => x.kind === 'celeb.notif.family');
      expect(got).toHaveLength(1);
      expect(got[0].link).toBe('/calendar');
    }
    // deciding twice is refused; declining notifies only the front desk
    fails(d.state, 'celebration.decide', { celebrationId: id, status: 'declined' }, 's9', 'celeb.err.decided');
    const no = run(r.state, 'celebration.decide', { celebrationId: id, status: 'declined', reason: 'Room is being painted' }, 's9');
    expect(no.state.celebrations[id]).toMatchObject({ status: 'declined', declineReason: 'Room is being painted' });
    for (const f of fam) expect(updatesFor(no.state, user(no.state, f)).some((x) => x.kind === 'celeb.notif.family')).toBe(false);
    const toLobby = updatesFor(no.state, user(no.state, 's1')).map((x) => x.kind);
    expect(toLobby).toContain('celeb.notif.declined');
    expect(toLobby).not.toContain('celeb.notif.decided');
    // a confirmed celebration blocks a venue booking, and the other way round
    const sat = run(s, 'celebration.request', { ...req, date: '2026-11-14' }, 's9').state; // a Saturday with no programme, where a private event may also be booked (round 14: the seed programmes 7 Nov)
    fails(sat, 'venue.book', { org: 'X', contactName: 'Y', phone: '', guests: 5, roomId: 'room-garden-room', date: '2026-11-14', from: '16:00', to: '18:00' }, 's9', 'mgmt.err.venueClash');
    fails(d.state, 'celebration.request', { ...req, memberId: 'm1' }, 's1', 'mgmt.err.venueClash');
    const other = run(r.state, 'celebration.request', { ...req, memberId: 'm1' }, 's1'); // while it is only requested, the slot is free
    expect(other.state.celebrations[other.result.celebrationId as string]).toMatchObject({ memberId: 'm1', status: 'requested' });
  });
  it('lobby editing a confirmed celebration sends it back to requested; cancel works once', () => {
    const s = seed();
    const c = run(s, 'celebration.request', req, 's9');
    const [id] = created(s, c.state);
    const u = run(c.state, 'celebration.update', { celebrationId: id, guests: 20 }, 's1');
    expect(u.state.celebrations[id]).toMatchObject({ status: 'requested', guests: 20 });
    expect(updatesFor(u.state, user(u.state, 's9')).some((x) => x.kind === 'celeb.notif.requested')).toBe(true);
    const m = run(c.state, 'celebration.update', { celebrationId: id, guests: 20, to: '17:30' }, 's9');
    expect(m.state.celebrations[id]).toMatchObject({ status: 'confirmed', guests: 20, to: '17:30' });
    fails(c.state, 'celebration.update', { celebrationId: id, date: '2026-10-24', roomId: 'room-lounge', from: '10:00', to: '11:00' }, 's1', 'mgmt.err.venueClash');
    // management cancelling a confirmed one tells the member's family; the front desk cancelling tells management only
    const byMgmt = run(c.state, 'celebration.cancel', { celebrationId: id }, 's9');
    for (const f of familyUserIds(byMgmt.state, 'm46')) expect(updatesFor(byMgmt.state, user(byMgmt.state, f)).filter((n) => n.kind === 'celeb.notif.cancelled' && n.link === '/calendar')).toHaveLength(1);
    const x = run(c.state, 'celebration.cancel', { celebrationId: id }, 's1');
    expect(updatesFor(x.state, user(x.state, 's9')).some((n) => n.kind === 'celeb.notif.cancelled')).toBe(true);
    for (const f of familyUserIds(x.state, 'm46')) expect(updatesFor(x.state, user(x.state, f)).some((n) => n.kind === 'celeb.notif.cancelled')).toBe(false);
    expect(x.state.celebrations[id].status).toBe('cancelled');
    fails(x.state, 'celebration.cancel', { celebrationId: id }, 's1', 'celeb.err.decided');
  });
  it('kitchen covers include confirmed guests; the calendar shows requested to staff only', () => {
    const s = seed();
    const date = req.date;
    const base = coversOn(s, date);
    const r = run(s, 'celebration.request', req, 's1');
    const [id] = created(s, r.state);
    expect(coversOn(r.state, date)).toMatchObject({ celebration: 0, total: base.total });
    expect(dayInfo(r.state, date, 'staff').items.find((i) => i.kind === 'celebration')).toMatchObject({ celebrationId: id, note: 'requested' });
    expect(dayInfo(r.state, date, 'family').items.some((i) => i.kind === 'celebration')).toBe(false);
    const d = run(r.state, 'celebration.decide', { celebrationId: id, status: 'confirmed' }, 's9');
    expect(coversOn(d.state, date)).toMatchObject({ celebration: 12, total: base.total + 12 });
    expect(dayInfo(d.state, date, 'family').items.find((i) => i.kind === 'celebration')).toMatchObject({ celebrationId: id });
    expect(dayInfo(d.state, date, 'staff').items.find((i) => i.kind === 'celebration')?.note).toBeUndefined();
    const row = famDay(d.state, ['m46'], date, T, 600).rows.find((x) => x.kind === 'celebration');
    expect(row).toMatchObject({ celebrationId: id, time: '15:00' });
    expect(famDay(d.state, ['m1'], date, T, 600).rows.some((x) => x.kind === 'celebration')).toBe(false);
    // the family projection holds it only once confirmed
    expect(Object.keys(projectForFamily(r.state, 'f1').celebrations)).not.toContain(id);
  });
});

describe('round 16: birthday charges on their own invoice', () => {
  const confirmed = () => { const s = seed(); const r = run(s, 'celebration.request', req, 's9'); return { s: r.state, id: created(s, r.state)[0] }; };
  it('two charges become one CEL invoice to the billing contact, emailed; a later charge gets its own invoice', () => {
    let { s, id } = confirmed();
    s = run(s, 'celebration.addCharge', { celebrationId: id, item: 'Cake', amount: 350_000 }, 's1').state;
    s = run(s, 'celebration.addCharge', { celebrationId: id, item: 'Balloons', amount: 100_000 }, 's1').state;
    s = run(s, 'celebration.issueInvoice', { celebrationId: id }, 's10').state;
    const inv = s.invoices['CEL-2610-001'];
    expect(inv).toMatchObject({ kind: 'manual', memberId: 'm46', payerFamilyId: 'f1' });
    expect(inv.lines.map((l) => [l.kind, l.amount])).toEqual([['celebration', 350_000], ['celebration', 100_000]]);
    expect(s.celebrations[id].charges!.every((c) => c.invoiceId === 'CEL-2610-001')).toBe(true);
    expect(Object.values(s.emails).filter((e) => e.ref.id === 'CEL-2610-001')).toHaveLength(1);
    fails(s, 'celebration.removeCharge', { celebrationId: id, chargeId: s.celebrations[id].charges![0].id }, 's1', 'err.charged');
    fails(s, 'celebration.issueInvoice', { celebrationId: id }, 's10', 'err.nothingToBill');
    s = run(s, 'celebration.addCharge', { celebrationId: id, item: 'Photo print', amount: 75_000 }, 's1').state;
    s = run(s, 'celebration.issueInvoice', { celebrationId: id }, 's10').state;
    expect(s.invoices['CEL-2610-002'].lines).toHaveLength(1);
  });
  it('an uninvoiced charge can be removed; the front desk cannot issue the invoice', () => {
    let { s, id } = confirmed();
    s = run(s, 'celebration.addCharge', { celebrationId: id, item: 'Cake', amount: 350_000 }, 's1').state;
    s = run(s, 'celebration.removeCharge', { celebrationId: id, chargeId: s.celebrations[id].charges![0].id }, 's1').state;
    expect(s.celebrations[id].charges).toEqual([]);
    fails(s, 'celebration.issueInvoice', { celebrationId: id }, 's1', 'err.forbidden');
  });
  it('one VA payment covers the monthly invoice and the birthday invoice together', () => {
    let { s, id } = confirmed();
    s = run(s, 'celebration.addCharge', { celebrationId: id, item: 'Cake', amount: 350_000 }, 's1').state;
    s = run(s, 'celebration.issueInvoice', { celebrationId: id }, 's10').state;
    const monthly = Object.values(s.invoices).find((i) => i.memberId === 'm46' && i.kind === 'monthly' && balanceOf(s, i) > 0)!;
    expect(monthly).toBeTruthy();
    const r = run(s, 'payment.simulateVa', { invoiceIds: [monthly.id, 'CEL-2610-001'] }, 'f1');
    const pays = (r.result.paymentIds as string[]).map((p) => r.state.payments[p]);
    expect(pays).toHaveLength(1);
    expect(pays[0].allocations.map((a) => a.invoiceId).sort()).toEqual([monthly.id, 'CEL-2610-001'].sort());
  });
});

describe('round 16: celebrations with charges still to invoice (Billing)', () => {
  it('lists a celebration until all its charges are invoiced', async () => {
    const { celebrationsToInvoice } = await import('../rules/celebrations');
    const s0 = seed();
    const r = run(s0, 'celebration.request', req, 's9');
    const id = created(s0, r.state)[0];
    let s = run(r.state, 'celebration.addCharge', { celebrationId: id, item: 'Cake', amount: 350_000 }, 's1').state;
    expect(celebrationsToInvoice(s).map((x) => [x.c.id, x.amount])).toContainEqual([id, 350_000]);
    s = run(s, 'celebration.issueInvoice', { celebrationId: id }, 's10').state;
    expect(celebrationsToInvoice(s).map((x) => x.c.id)).not.toContain(id);
  });
});

describe('round 16: the charges line families see', () => {
  it('lists each charge with its price; free shows nothing', async () => {
    const { chargesLine } = await import('../rules/celebrations');
    expect(chargesLine({ charges: [] })).toBe('');
    expect(chargesLine({ charges: [{ id: 'a', item: 'Cake', amount: 350_000 }, { id: 'b', item: 'Balloons', amount: 100_000 }] })).toBe('Cake Rp 350.000 · Balloons Rp 100.000');
  });
});
