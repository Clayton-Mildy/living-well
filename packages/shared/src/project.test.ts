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
      d.members.m20.nanny = { name: 'Mbak Rina', phone: '+6281200000000', nik: '3175014507850009', note: 'agency', photoMediaId: 'md_otherfamily01' };
    });
    const view = projectForFamily(s, 'f1');
    expect(view.members.m20).toBeTruthy();
    expect(view.members.m20.nanny).toBeNull();
    expect(view.members.m1.nanny?.name).toBeTruthy();
  });
});
