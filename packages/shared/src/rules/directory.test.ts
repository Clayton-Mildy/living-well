// The directory's categories: a retired or missing category falls to Other.
import { describe, it, expect } from 'vitest';
import { groupKeyOf, groupKeys, OTHER } from './directory';
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
    expect(groupKeys(s)).toEqual(['dgrp_1', 'dgrp_2']);
  });
  it('without a category named Other the built-in bucket comes last', () => {
    const s = st([A]);
    expect(groupKeyOf(s, {})).toBe(OTHER);
    expect(groupKeys(s)).toEqual(['dgrp_1', OTHER]);
    expect(groupKeyOf({} as ClubSettings, {})).toBe(OTHER);
  });
});
