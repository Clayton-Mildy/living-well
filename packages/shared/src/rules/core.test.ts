// Display names: the nickname (Panggilan) is what staff and family call a member.
import { describe, it, expect } from 'vitest';
import type { Member } from '../index';
import { displayFull, displayName, initials, memberName, memberShort } from './core';

describe('displayName', () => {
  const m = { title: 'Oma', firstName: 'Giok Nio', lastName: 'Oei', registration: { nickname: 'Nio' } } as Member;
  it('prefers the nickname', () => {
    expect(displayName(m)).toBe('Oma Nio');
    expect(displayFull(m)).toBe('Oma Giok Nio Oei');
    expect(displayFull({ ...m, registration: undefined })).toBeNull();
    expect(displayName({ ...m, registration: undefined })).toBe(memberShort(m));
  });
  it('does not double the title when the nickname already has it', () => {
    const lina = { title: 'Oma', firstName: 'Lina', lastName: 'Wijaya', registration: { nickname: 'Oma Lina' } } as Member;
    expect(displayName(lina)).toBe('Oma Lina');
    expect(displayName({ ...lina, registration: { nickname: 'Pak Bambang' } })).toBe('Pak Bambang');
    expect(displayName({ ...lina, registration: { nickname: '  ' } })).toBe('Oma Lina');
  });
});

describe('initials', () => {
  it('works with any title: given a member it uses the first and last name, never the title', () => {
    expect(initials({ title: 'Tante', firstName: 'Lily', lastName: 'Tan' })).toBe('LT');
    expect(initials({ title: 'Oma', firstName: 'Giok Nio', lastName: 'Oei' })).toBe('GO');
    expect(initials({ title: 'Tante', firstName: 'Lily', lastName: 'Lily' })).toBe('L');
    expect(initials(memberName({ title: 'Oma', firstName: 'Lina', lastName: 'Wijaya' }))).toBe('LW'); // a plain name still strips the presets
    expect(memberName({ title: 'Tante', firstName: 'Lily', lastName: 'Tan' })).toBe('Tante Lily Tan');
  });
});
