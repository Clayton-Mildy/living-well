import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { buildSeed } from '../seed';
import type { ClubState, FamilyContact } from '../types';
import { currentTerms, needsTerms, termsAgreement, termsBlocks, termsText } from './terms';

// the seed publishes version 1 (round 17); these tests start from a club with no terms
const base = () => produce(buildSeed().citra, (d) => { delete d.club.settings.terms; for (const c of Object.values(d.familyContacts)) delete c.termsAgreed; });
const v = (version: number, en: string, id = '') => ({ version, en, id, publishedAt: '2026-11-01T09:00', publishedBy: 's9' });
const withTerms = (s: ClubState, ...versions: ReturnType<typeof v>[]) => produce(s, (d) => { d.club.settings.terms = versions; });

describe('termsBlocks', () => {
  it('splits headings, bullets and paragraphs, skipping blank lines', () => {
    expect(termsBlocks('# A\n- b\nc\n\n  \n- d')).toEqual([{ kind: 'h', text: 'A' }, { kind: 'li', text: 'b' }, { kind: 'p', text: 'c' }, { kind: 'li', text: 'd' }]);
  });
});

describe('termsText', () => {
  it('fills the placeholders from the settings', () => {
    const s = withTerms(base(), v(1, 'Notice {noticeDays} days. Invoice on the {issueDay}, due on the {dueDay}, {flexQuota} visits.'));
    const t = produce(s, (d) => { d.club.settings.noticeDays = 10; });
    expect(termsText(t, 'en')).toBe(`Notice 10 days. Invoice on the ${t.club.settings.issueDay}, due on the ${t.club.settings.dueDay}, ${t.club.settings.flexQuota} visits.`);
  });
  it('round 18: fills the days of each kind; {noticeDays} is the stop days', () => {
    const s = produce(withTerms(base(), v(1, '{stopDays} {leaveDays} {downgradeDays} {noticeDays}')), (d) => { d.club.settings.notice = { downgrade: 7, stop: 30, leave: 14 }; });
    expect(termsText(s, 'en')).toBe('30 14 7 30');
  });
  it('round 19: fills {upgradeDays} and {leaveMaxMonths}', () => {
    const s = withTerms(base(), v(1, 'up {upgradeDays} · leave {leaveMaxMonths}'));
    expect(termsText(s, 'en')).toBe('up 1 · leave 2');
    const t = produce(s, (d) => { d.club.settings.notice = { downgrade: 14, stop: 14, leave: 14, upgrade: 5 }; d.club.settings.leaveMaxMonths = 3; });
    expect(termsText(t, 'en')).toBe('up 5 · leave 3');
  });
  it('uses the default notice period when none is set', () => {
    expect(termsText(withTerms(base(), v(1, '{noticeDays}')), 'en')).toBe('14');
  });
  it('Indonesian falls back to English when empty, and is used when present', () => {
    expect(termsText(withTerms(base(), v(1, 'English', '   ')), 'id')).toBe('English');
    const s = withTerms(base(), v(1, 'English', ''), v(2, 'English two', 'Bahasa dua'));
    expect(termsText(s, 'id')).toBe('Bahasa dua');
    expect(termsText(s, 'en')).toBe('English two');
  });
  it('is empty when no terms are published', () => {
    expect(currentTerms(base())).toBeUndefined();
    expect(termsText(base(), 'en')).toBe('');
  });
});

describe('needsTerms', () => {
  const maria = (s: ClubState): FamilyContact => s.familyContacts.f1;
  it('null without published terms', () => {
    expect(needsTerms(base(), maria(base()))).toBeNull();
  });
  it('first when never agreed, updated when agreed to an older version, null when current', () => {
    const s1 = withTerms(base(), v(1, 'x'));
    expect(needsTerms(s1, maria(s1))).toBe('first');
    const agreed = produce(s1, (d) => { d.familyContacts.f1.termsAgreed = { version: 1, at: '2026-11-01T10:00' }; });
    expect(needsTerms(agreed, agreed.familyContacts.f1)).toBeNull();
    const s2 = withTerms(agreed, v(1, 'x'), v(2, 'y'));
    expect(needsTerms(s2, s2.familyContacts.f1)).toBe('updated');
  });
});

describe('termsAgreement', () => {
  it('counts contacts with a username; notYet lists them with their members', () => {
    const s = produce(withTerms(base(), v(1, 'x')), (d) => {
      for (const c of Object.values(d.familyContacts)) if (c.username) c.termsAgreed = { version: 1, at: '2026-11-01T10:00' };
      delete d.familyContacts.f2.termsAgreed;
      d.familyContacts.fm2_0.termsAgreed = { version: 0, at: '2026-10-01T10:00' };
    });
    const withName = Object.values(s.familyContacts).filter((c) => c.username && !c.deletedAt);
    const r = termsAgreement(s);
    expect(r.total).toBe(withName.length);
    expect(r.agreed).toBe(withName.length - 2);
    expect(r.notYet.map((x) => x.contactId).sort()).toEqual(['f2', 'fm2_0']);
    expect(r.notYet.find((x) => x.contactId === 'f2')!.memberIds).toEqual(['m1', 'm46']);
  });
  it('nobody has agreed without published terms: 0 of total, everyone not yet', () => {
    const r = termsAgreement(base());
    expect(r.agreed).toBe(0);
    expect(r.notYet.length).toBe(r.total);
  });
});
