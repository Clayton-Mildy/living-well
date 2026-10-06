import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, actionItems, unreadUpdates, DomainError } from '../index';

const clock = { today: '2026-10-21', nowMin: 600 };
const fresh = () => buildSeed();
describe('action framework', () => {
  it('check-in is deterministic: same mutation id → same ids and patches', () => {
    const a = fresh(), b = fresh();
    const u = getUser(a, 's1')!;
    const r1 = execute(a.citra, 'attendance.checkIn', { memberId: 'm1', escort: { kind: 'family', familyId: 'f1' }, method: 'face' }, u, clock, 'mx');
    const r2 = execute(b.citra, 'attendance.checkIn', { memberId: 'm1', escort: { kind: 'family', familyId: 'f1' }, method: 'face' }, getUser(b, 's1')!, clock, 'mx');
    expect(JSON.stringify(r1.patches)).toEqual(JSON.stringify(r2.patches));
    expect(r1.state.attendance['2026-10-21:m1'].checkIn?.at).toBe('10:00');
    expect(unreadUpdates(r1.state, getUser(a, 'f1')!).some((n) => n.kind === 'notif.checkedIn')).toBe(true);
  });
  it('permissions are enforced', () => {
    const c = fresh();
    expect(() => execute(c.citra, 'review.approve', { crId: 'cr-seed-1' }, getUser(c, 's1')!, clock, 'm1')).toThrow(DomainError);
    expect(() => execute(c.citra, 'attendance.checkIn', { memberId: 'm1', escort: { kind: 'nanny' }, method: 'manual' }, getUser(c, 'f1')!, clock, 'm2')).toThrow('err.forbidden');
  });
  it('family profile edit is gated: pending request, data unchanged; approval applies it', () => {
    const c = fresh();
    const maria = getUser(c, 'f1')!;
    const r = execute(c.citra, 'account.updateFamily', { familyId: 'f1', name: 'Maria W. Wijaya' }, maria, clock, 'm3');
    expect(r.reviewed).toBe('gate');
    expect(r.state.familyContacts.f1.name).toBe('Maria Wijaya');
    const crId = r.result.changeRequestId as string;
    expect(r.state.changeRequests[crId].changes).toEqual([{ field: 'name', from: 'Maria Wijaya', to: 'Maria W. Wijaya' }]);
    expect(actionItems(r.state, getUser(c, 's9')!, clock.today, clock.nowMin).some((i) => i.id === 'cr:' + crId)).toBe(true);
    const r2 = execute(r.state, 'review.approve', { crId }, getUser(c, 's9')!, clock, 'm4');
    expect(r2.state.familyContacts.f1.name).toBe('Maria W. Wijaya');
    expect(r2.state.changeRequests[crId].status).toBe('approved');
    expect(actionItems(r2.state, getUser(c, 's9')!, clock.today, clock.nowMin).some((i) => i.id === 'cr:' + crId)).toBe(false);
  });
  it('approval detects conflicts when the data moved on', () => {
    const c = fresh();
    const r = execute(c.citra, 'account.updateFamily', { familyId: 'f1', name: 'A' }, getUser(c, 'f1')!, clock, 'm5');
    const crId = r.result.changeRequestId as string;
    const moved = { ...r.state, familyContacts: { ...r.state.familyContacts, f1: { ...r.state.familyContacts.f1, name: 'B' } } };
    expect(() => execute(moved, 'review.approve', { crId }, getUser(c, 's9')!, clock, 'm6')).toThrow('err.reviewConflict');
  });
});
