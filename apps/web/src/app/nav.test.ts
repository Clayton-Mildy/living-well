import { describe, expect, it } from 'vitest';
import { NAVG, NAVS, phoneNav } from './nav';

// KC round 13 §15: every staff role's sidebar is sectioned; the sections hold exactly the role's items, and the phone bar is untouched
describe('nav groups', () => {
  it.each(['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt'] as const)('%s: the groups hold exactly the flat nav, each item once', (role) => {
    const grouped = NAVG[role].flatMap((g) => g[1].map((i) => i.key));
    expect([...grouped].sort()).toEqual(NAVS[role].map((i) => i.key).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(NAVG[role][0][0]).toBeNull(); // the role's own daily work comes first, untitled
    for (const [title] of NAVG[role].slice(1)) expect(title).toMatch(/^nav\.g_/);
  });
  it('the front desk phone bar keeps its round-6 order', () => {
    expect(phoneNav('lobby').items.map((i) => i.key)).toEqual(['today', 'enquiries', 'members', 'menu', 'more']);
  });
});
