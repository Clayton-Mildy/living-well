// The directory's categories: a retired or missing category falls to Other.
import { describe, it, expect } from 'vitest';
import { groupKeyOf, groupKeys, OTHER, ratingChanges, ratingOf, sortContacts, VENUES } from './directory';
import type { ClubSettings } from '../types';

const st = (groups: NonNullable<ClubSettings['directoryGroups']>) => ({ directoryGroups: groups }) as ClubSettings;
const A = { id: 'dgrp_1', name: 'AC and electrical', active: true };
const O = { id: 'dgrp_2', name: 'Other', active: true };

describe('directory groups', () => {
  it('an active category keeps its contacts; none, retired or unknown go to Other', () => {
    const s = st([A, O, { id: 'dgrp_3', name: 'Old', active: false }]);
    expect(groupKeyOf(s, { groupId: 'dgrp_1' })).toBe('dgrp_1');
    expect(groupKeyOf(s, {})).toBe('dgrp_2');
    expect(groupKeyOf(s, { groupId: 'dgrp_3' })).toBe('dgrp_2');
    expect(groupKeyOf(s, { groupId: 'zzz' })).toBe('dgrp_2');
    expect(groupKeys(s)).toEqual(['dgrp_1', VENUES, 'dgrp_2']) // round 21: Field trip venues just before Other;
  });
  it('without a category named Other the built-in bucket comes last', () => {
    const s = st([A]);
    expect(groupKeyOf(s, {})).toBe(OTHER);
    expect(groupKeys(s)).toEqual(['dgrp_1', VENUES, OTHER]);
    expect(groupKeyOf({} as ClubSettings, {})).toBe(OTHER);
  });
});

describe('round 21: rating order', () => {
  const c = (name: string, stars: number[]) => ({ id: name, clubId: 'citra', createdAt: '', createdBy: 'staff:s9', kind: 'service' as const, name, what: '', phone: '+62811', public: false, ...(stars.length ? { ratings: stars.map((x, i) => ({ id: `${name}${i}`, stars: x as 1 | 2 | 3 | 4 | 5, at: '2026-10-01T10:00', by: 'staff:s9' as const })) } : {}) });
  it('11 Nov (KC): the rating is the newest entry; best first, then the name; unrated last', () => {
    const list = [c('A unrated', []), c('B low', [4, 2]), c('C top', [3, 5]), c('D four', [5, 4])];
    expect(ratingOf(list[2])).toEqual({ stars: 5, n: 2 });
    expect(ratingOf(list[1])).toEqual({ stars: 2, n: 2 });
    expect(ratingOf(list[0])).toBeNull();
    expect(sortContacts([c('Z', [4]), ...list]).map((x) => x.name)).toEqual(['C top', 'D four', 'Z', 'B low', 'A unrated']);
  });
  it('the changes read newest first, each with the stars it changed from', () => {
    expect(ratingChanges(c('X', [5, 4, 2])).map((r) => [r.from, r.stars])).toEqual([[4, 2], [5, 4], [null, 5]]);
    expect(ratingChanges(c('Y', []))).toEqual([]);
  });
});
