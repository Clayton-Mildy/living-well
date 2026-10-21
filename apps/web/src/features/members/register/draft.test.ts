// The registration draft kept on this device: one per lead (and one for a new member), cleared on submit, and never a crash when storage is blocked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@cp/shared';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft';
import { initialState } from './steps';

const T = '2026-10-21';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('registration draft', () => {
  const st = { ...initialState(buildSeed().citra, { kind: 'new' }, T), name: 'Ratna Dewi', dob: '1946-10-14' };
  it('is kept per lead: another lead and a new member start empty', () => {
    expect(draftKey({ kind: 'lead', id: 'e1' })).toBe('cp.reg.e1');
    expect(draftKey({ kind: 'new' })).toBe('cp.reg.new');
    saveDraft({ kind: 'lead', id: 'e1' }, st);
    expect(loadDraft({ kind: 'lead', id: 'e1' })?.name).toBe('Ratna Dewi');
    expect(loadDraft({ kind: 'lead', id: 'e2' })).toBeNull();
    expect(loadDraft({ kind: 'new' })).toBeNull();
  });
  it('clearDraft removes it; a broken draft reads as none', () => {
    saveDraft({ kind: 'new' }, st);
    expect(loadDraft({ kind: 'new' })?.dob).toBe('1946-10-14');
    clearDraft({ kind: 'new' });
    expect(loadDraft({ kind: 'new' })).toBeNull();
    localStorage.setItem('cp.reg.new', '{not json');
    expect(loadDraft({ kind: 'new' })).toBeNull();
  });
  it('a blocked localStorage never throws', () => {
    const boom = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom, clear: () => {} });
    expect(() => saveDraft({ kind: 'new' }, st)).not.toThrow();
    expect(loadDraft({ kind: 'new' })).toBeNull();
    expect(() => clearDraft({ kind: 'new' })).not.toThrow();
  });
});
