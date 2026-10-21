// What a family receives (project.ts): a family's own parents' mood marks (round 12), never another family's.
import { describe, it, expect } from 'vitest';
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
});
