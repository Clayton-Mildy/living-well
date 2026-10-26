import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, updatesFor, DomainError, familyUserIds, type ClubState } from '../index';
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
    const sat = run(s, 'celebration.request', { ...req, date: '2026-11-07' }, 's9').state; // a Saturday, where a private event may also be booked
    fails(sat, 'venue.book', { org: 'X', contactName: 'Y', phone: '', guests: 5, roomId: 'room-garden-room', date: '2026-11-07', from: '16:00', to: '18:00' }, 's9', 'mgmt.err.venueClash');
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
