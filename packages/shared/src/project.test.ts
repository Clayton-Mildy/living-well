// What a family receives (project.ts): a family's own parents' mood marks (round 12), never another family's.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, live, projectForFamily } from './index';

describe('projectForFamily: mood marks', () => {
  const s = buildSeed(DEMO_TODAY, DEMO_START_MIN, { roster: true }).citra;
  const view = projectForFamily(s, 'f1');
  const marks = live(view.moodMarks);

  it("carries Oma Lina's marks and no mark for a member outside the family", () => {
    expect(marks.some((m) => m.memberId === 'm1')).toBe(true);
    expect(marks.every((m) => ['m1', 'm46'].includes(m.memberId))).toBe(true);
    expect(live(s.moodMarks).some((m) => m.memberId === 'm20')).toBe(true); // the seed has them; the projection leaves them out
    expect(marks.some((m) => m.memberId === 'm20')).toBe(false);
  });
  it('leaves staff-only care calls out', () => {
    expect(view.careCalls).toEqual({});
  });
  it('leaves staff-only unpaid follow-ups out', () => {
    expect(live(s.unpaidFollowUps).length).toBeGreaterThan(0);
    expect(view.unpaidFollowUps).toEqual({});
  });
});

describe('projectForFamily: members tagged in a photo', () => {
  it('another family\'s member is a stub without their carer; the family\'s own parent keeps theirs', () => {
    const base = buildSeed(DEMO_TODAY, DEMO_START_MIN, { roster: true }).citra;
    const pid = Object.keys(base.photos)[0];
    const s = produce(base, (d) => {
      d.photos[pid].visibility = 'visible';
      delete d.photos[pid].deletedAt;
      d.photos[pid].memberIds = ['m1', 'm20'];
      d.members.m20.registration = { mobile: '0812 0000 1111', email: 'x@y.id', city: 'Jakarta' };
      d.members.m20.spouseId = 'm21';
      d.members.m20.limits = { sys: { watch: 1, alert: 2 } } as never;
      const ms20 = d.members.m20.memberships[d.members.m20.memberships.length - 1];
      ms20.endReason = 'moved' as never; ms20.endNote = 'moving to Bali'; ms20.endedBy = 'staff:u1' as never; ms20.leaves = [{ month: '2026-12', at: '2026-10-01T09:00', by: 'staff:u1', note: 'surgery' } as never];
      d.members.m20.plans[d.members.m20.plans.length - 1].requestId = 'cr_secret';
      d.members.m1.memberships[d.members.m1.memberships.length - 1].endNote = 'own note';
      d.members.m20.nanny = { name: 'Mbak Rina', phone: '+6281200000000', nik: '3175014507850009', note: 'agency', photoMediaId: 'md_otherfamily01' };
    });
    const view = projectForFamily(s, 'f1');
    expect(view.members.m20).toBeTruthy();
    const stub = view.members.m20;
    expect(stub.nanny).toBeNull();
    expect(stub.registration).toBeUndefined();
    expect(stub.spouseId).toBeNull();
    expect(stub.limits).toBeUndefined();
    expect(stub.usualArrival).toBe('');
    expect(stub.sim.sys).toBe(0);
    expect(stub.face.enrolled).toBe(false);
    expect(stub.firstName).toBe(s.members.m20.firstName); // what a photo shows stays
    expect(stub.photoMediaId).toBe(s.members.m20.photoMediaId);
    // another family's membership end details and plan requests stay out; the dates the rules need stay
    const ms = stub.memberships[stub.memberships.length - 1];
    expect(ms.start).toBe(s.members.m20.memberships[s.members.m20.memberships.length - 1].start);
    expect(ms.endNote).toBeUndefined();
    expect(ms.endReason).toBeUndefined();
    expect(ms.endedBy).toBeUndefined();
    expect(ms.leaves).toBeUndefined();
    expect(stub.plans.length).toBe(s.members.m20.plans.length);
    expect(stub.plans.every((p) => p.requestId === undefined)).toBe(true);
    expect(JSON.stringify(stub)).not.toMatch(/moving to Bali|surgery|cr_secret/);
    expect(view.members.m1.memberships[view.members.m1.memberships.length - 1].endNote).toBe('own note');
    expect(view.members.m1.nanny?.name).toBeTruthy();
    expect(view.members.m1.registration).toEqual(s.members.m1.registration);
    expect(view.members.m1.spouseId).toBe(s.members.m1.spouseId);
  });
});
