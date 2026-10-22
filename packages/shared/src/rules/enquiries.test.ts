// Round 13: the lead history rules: a lead's moves, the cohort funnel for a period and the months the History view lists.
import { describe, it, expect } from 'vitest';
import { buildSeed } from '../seed';
import type { ClubState, Enquiry, LeadMove } from '../types';
import { leadFunnel, leadHistory, leadMonths, openedAt } from './enquiries';

const mv = (stage: LeadMove['stage'], at: string, extra: Partial<LeadMove> = {}): LeadMove => ({ stage, at, by: 'staff:s1', ...extra });
const lead = (id: string, stage: Enquiry['stage'], history: LeadMove[], extra: Partial<Enquiry> = {}): Enquiry => ({
  id, clubId: 'citra', createdAt: history[0].at, createdBy: 'staff:s1', senior: { title: 'Oma', name: id }, contact: { name: 'C', relation: 'daughter', phone: '+6281200000000' }, source: 'referral', stage, history, ...extra,
});
const state = (...leads: Enquiry[]): ClubState => {
  const s = buildSeed().citra;
  s.enquiries = Object.fromEntries(leads.map((e) => [e.id, e]));
  return s;
};

describe('lead history', () => {
  it('a row without a history reads as one new move at createdAt; openedAt is its date', () => {
    const e = lead('a', 'new', [mv('new', '2026-10-08T11:00')]);
    delete e.history;
    expect(leadHistory(e)).toEqual([{ stage: 'new', at: '2026-10-08T11:00', by: 'staff:s1' }]);
    expect(openedAt(e)).toBe('2026-10-08');
  });
});

describe('leadFunnel (a cohort: the leads opened in the period and how far each got)', () => {
  const s = state(
    lead('a', 'new', [mv('new', '2026-10-02T10:00')]),
    lead('b', 'visit', [mv('new', '2026-10-03T10:00'), mv('visit', '2026-10-04T10:00', { date: '2026-10-07' })]),
    lead('c', 'trial', [mv('new', '2026-10-05T10:00'), mv('trial', '2026-10-06T10:00', { date: '2026-10-09' })]),
    lead('d', 'lost', [mv('new', '2026-10-06T10:00'), mv('visit', '2026-10-07T10:00'), mv('lost', '2026-10-12T10:00', { reason: 'price' })], { lost: { reason: 'price', prevStage: 'visit' } }),
    lead('e', 'lost', [mv('new', '2026-09-28T10:00'), mv('lost', '2026-10-02T10:00', { reason: 'distance' })], { lost: { reason: 'distance', prevStage: 'new' } }),
    lead('f', 'new', [mv('new', '2026-09-01T10:00'), mv('visit', '2026-09-02T10:00'), mv('new', '2026-09-03T10:00', { undo: true })], { archivedAt: '2026-09-20T10:00' }),
  );
  s.members.m1.review = undefined;
  s.enquiries.g = lead('g', 'joined', [mv('new', '2026-10-01T10:00'), mv('visit', '2026-10-02T10:00'), mv('trial', '2026-10-03T10:00'), mv('joined', '2026-10-04T10:00')], { memberId: 'm1' });

  it('counts the cohort by the first move and how far each lead got, joined only for an approved member', () => {
    const f = leadFunnel(s, '2026-10-01', '2026-10-31');
    expect(f).toMatchObject({ opened: 5, visit: 4, trial: 2, joined: 1, lost: 1 });
    expect(f.leads.map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'd', 'g']);
    expect(f.lostReasons).toMatchObject({ price: 1, distance: 0 });
    expect(f.conversion).toBeCloseTo(1 / 5);
  });
  it('opened counts every lead of the cohort (leads and opened agree), including an archived lead in its own month', () => {
    const f = leadFunnel(s, '2026-10-01', '2026-10-31');
    expect(f.opened).toBe(f.leads.length);
    const sep = leadFunnel(s, '2026-09-01', '2026-09-30');
    expect(sep.leads.map((e) => e.id).sort()).toEqual(['e', 'f']);
    expect(sep).toMatchObject({ opened: 2, visit: 1, trial: 0, joined: 0, lost: 1 });
    expect(sep.lostReasons.distance).toBe(1);
  });
  it('never exceeds the opened count at any step, and an empty period has a null conversion and no NaN', () => {
    for (const [from, to] of [['2026-10-01', '2026-10-31'], ['2026-09-01', '2026-09-30'], ['2026-10-05', '2026-10-06']]) {
      const f = leadFunnel(s, from, to);
      expect(f.trial).toBeLessThanOrEqual(f.visit);
      expect(f.joined).toBeLessThanOrEqual(f.trial);
      expect(f.visit).toBeLessThanOrEqual(f.opened);
    }
    const none = leadFunnel(s, '2020-01-01', '2020-01-31');
    expect(none).toMatchObject({ opened: 0, visit: 0, trial: 0, joined: 0, lost: 0, conversion: null });
    expect(JSON.stringify(none)).not.toContain('NaN');
  });
  it('a pending join and a deleted lead are not counted as joined / not opened', () => {
    const p = state(lead('p', 'joined', [mv('new', '2026-10-01T10:00'), mv('joined', '2026-10-02T10:00')], { memberId: 'm1' }), lead('q', 'new', [mv('new', '2026-10-01T10:00')], { deletedAt: '2026-10-02T10:00' }));
    p.members.m1.review = { status: 'pending', crId: 'cr1' };
    expect(leadFunnel(p, '2026-10-01', '2026-10-31')).toMatchObject({ opened: 1, joined: 0 });
  });
});

describe('leadMonths', () => {
  it('lists six months, newest first, each with its own funnel', () => {
    const s = state(lead('a', 'new', [mv('new', '2026-10-02T10:00')]), lead('b', 'new', [mv('new', '2026-05-30T10:00')]));
    const m = leadMonths(s, '2026-10-22', 6);
    expect(m.map((x) => x.month)).toEqual(['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
    expect(m[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(m.map((x) => x.funnel.opened)).toEqual([1, 0, 0, 0, 0, 1]);
  });
});
