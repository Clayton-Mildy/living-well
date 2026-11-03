// Round 18 seed: the fuller terms v1 and Oma Sri Rahayu, who has just joined (the roster only), with Ratna, who has not signed in yet.
import { describe, it, expect } from 'vitest';
import { buildSeed, DEMO_START_MIN, DEMO_TODAY, live, membershipStatus, ym, type ClubState } from '../index';
import { needsTerms, termsBlocks, termsText } from '../rules/terms';
import { registrationDue, runDone, runLinesFor } from '../rules/billing';
import { linksOfFamily } from '../rules/core';

const build = (T = DEMO_TODAY, roster = true) => buildSeed(T, DEMO_START_MIN, { roster }).citra;
const regInvoices = (s: ClubState) => live(s.invoices).filter((i) => i.memberId === 'm_sri' && !i.voided && i.lines.some((l) => l.label === 'inv.line.registration'));

describe('round 18 seed', () => {
  const s = build();

  it('Ratna meets the first-sign-in page; every other contact but Sinta has agreed', () => {
    expect(s.familyContacts.f_ratna).toMatchObject({ username: 'ratna', name: 'Ratna Rahayu' });
    expect(s.familyContacts.f_ratna.activatedAt?.slice(0, 10)).toBe(s.members.m_sri.memberships[0].start);
    expect(needsTerms(s, s.familyContacts.f_ratna)).toBe('first');
    const others = live(s.familyContacts).filter((c) => c.id !== 'f_ratna' && c.id !== 'f_sinta');
    expect(others.every((c) => needsTerms(s, c) === null)).toBe(true);
    expect(linksOfFamily(s, 'f_ratna')).toEqual([expect.objectContaining({ memberId: 'm_sri', relation: 'daughter', primary: true, appAccess: true })]);
    expect(live(s.familyContacts).filter((c) => c.username === 'ratna')).toHaveLength(1);
  });

  it('Oma Sri: active on Flex since 2 open days ago, a signed form, no photo, one visit (today) and the welcome sent', () => {
    const m = s.members.m_sri;
    expect(m.memberships[0].start).toBe('2026-10-19'); // Monday; the demo day is Wednesday 21 October
    expect(membershipStatus(m, DEMO_TODAY)).toBe('active');
    expect(m.plans).toEqual([expect.objectContaining({ plan: 'flex' })]);
    expect(m.photoMediaId).toBeUndefined();
    expect(m.documents.find((d) => d.type === 'membershipForm')).toMatchObject({ status: 'onFile' });
    expect(live(s.attendance).filter((a) => a.memberId === 'm_sri').map((a) => a.date)).toEqual([DEMO_TODAY]);
    expect(live(s.notifications).find((n) => n.kind === 'members.notif.welcome' && n.memberId === 'm_sri')).toMatchObject({ toUsers: ['f_ratna'], params: { name: 'Oma Sri', date: '19/10/2026' } });
  });

  it('the demo day is the 21st: the run issued this morning bills her first invoice, with the registration fee, unpaid; the next run does not bill the fee again', () => {
    const inv = regInvoices(s);
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ period: '2026-10', payerFamilyId: 'f_ratna', issueDate: DEMO_TODAY });
    expect(live(s.payments).some((p) => p.memberId === 'm_sri')).toBe(false);
    expect(s.invoiceRuns['run-2026-10'].invoiceIds).toContain(inv[0].id);
    expect(registrationDue(s, s.members.m_sri)).toBe(false);
    expect(runLinesFor(s, s.members.m_sri, '2026-11', DEMO_TODAY).map((l) => l.label)).toEqual(['inv.line.flex']);
  });

  it('between runs (3 November) the fee is pending: no invoice yet, and the next run bills it once with her first plan fee', () => {
    const T = '2026-11-03';
    const s2 = build(T);
    const m = s2.members.m_sri;
    expect(m.memberships[0].start).toBe('2026-10-30');
    expect(regInvoices(s2)).toHaveLength(0);
    expect(live(s2.invoices).some((i) => i.memberId === 'm_sri')).toBe(false);
    expect(runDone(s2, ym(T))).toBe(false);
    expect(registrationDue(s2, m)).toBe(true);
    expect(runLinesFor(s2, m, ym(T), T).filter((l) => l.label === 'inv.line.registration')).toHaveLength(1);
  });

  it('the terms: 14 sections, every placeholder filled in both languages', () => {
    for (const lang of ['en', 'id'] as const) {
      const text = termsText(s, lang);
      expect(text).not.toContain('{');
      expect(termsBlocks(text).filter((b) => b.kind === 'h')).toHaveLength(14);
    }
    expect(termsText(s, 'en')).toContain(`issued on day ${s.club.settings.issueDay} of that month`);
    expect(termsText(s, 'en')).toContain('up to 2 months in a row');
    expect(s.club.settings.terms).toHaveLength(1);
  });

  it('the small seed has neither Oma Sri nor Ratna', () => {
    const small = build(DEMO_TODAY, false);
    expect(small.members.m_sri).toBeUndefined();
    expect(small.familyContacts.f_ratna).toBeUndefined();
    expect(Object.keys(small.members)).toHaveLength(5);
  });
});
