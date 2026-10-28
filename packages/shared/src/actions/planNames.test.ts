// Round 15 fix wave: a plan has an English and an Indonesian name. Notices and the printed form carry both (like an invoice line); the Indonesian copy and the
// Indonesian form use the Indonesian one, and the copy never says "Paket Paket ...".
import { describe, it, expect } from 'vitest';
import { actionItems, buildSeed, execute, getUser, live, planLabel, planParams, translate, type ClubState } from '../index';
import { applicationDataFromInput, applicationDataOf } from '../rules/applicationForm';

const clubs = buildSeed();
const T = '2026-10-21';
const clock = { today: T, nowMin: 600 };
let n = 0;
const run = (s: ClubState, name: string, input: unknown, uid: string) => execute(s, name, input, getUser({ [s.clubId]: s }, uid)!, clock, `pn${++n}`);
/** Plan 1 is priced and has an Indonesian name that already starts with "Paket"; plan 2 has no Indonesian name. */
const world = (): ClubState => {
  const s = structuredClone(buildSeed().citra);
  s.club.settings.plans = [
    { id: 'plan_1', name: 'Saver 8', nameId: 'Paket Hemat 8', kind: 'days', quota: 8, active: true },
    { id: 'plan_2', name: 'Private', kind: 'unlimited', active: true },
  ];
  const price = Object.values(s.prices)[0];
  price.plans = { plan_1: 2_100_000, plan_2: 6_000_000 };
  return s;
};

describe('plan names on notices and the form', () => {
  it('planParams carries both names, the Indonesian one without a leading "Paket" (it falls back to the English name)', () => {
    const s = world();
    expect(planParams(s, 'plan_1')).toEqual({ plan: 'Saver 8', planId: 'Hemat 8' });
    expect(planParams(s, 'plan_2')).toEqual({ plan: 'Private', planId: 'Private' });
    expect(planParams(s, 'gold')).toEqual({ plan: 'Gold', planId: 'Gold' });
  });
  it('an invoice line in Indonesian never says "Paket Paket"', () => {
    const s = world();
    expect(translate('id', 'inv.line.plan', { month: '2026-10', ...planParams(s, 'plan_1') })).toBe('Paket Hemat 8 · 2026-10');
    expect(translate('en', 'inv.line.plan', { month: '2026-10', ...planParams(s, 'plan_1') })).toBe('Saver 8 plan · 2026-10');
  });
  it('the printed (Indonesian) form uses the Indonesian plan name, and the English one when there is none', () => {
    const s = world();
    s.members.m1.plans = [{ from: '2020-01-01', plan: 'plan_1', by: 'staff:s9' }];
    expect(applicationDataOf(s, 'm1', T).planName).toBe('Paket Hemat 8');
    const input = (plan: 'plan_1' | 'plan_2') => ({ name: 'Rosa Santoso', dob: '1947-05-02', address: 'Jl. Melati 3', plan, nanny: null, contact: { name: 'Dina', phone: '0812', relation: 'daughter' as const, primary: true }, health: { conditions: [], food: [], foodOther: '', drugs: [] } });
    expect(applicationDataFromInput(s, input('plan_1'), T).planName).toBe('Paket Hemat 8');
    expect(applicationDataFromInput(s, input('plan_2'), T).planName).toBe('Private');
    expect(planLabel(s, 'plan_1', 'en')).toBe('Saver 8');
  });
  it('the notice of a plan change says the English name in English and the Indonesian one in Indonesian', () => {
    const r = run(world(), 'members.changePlan', { memberId: 'm1', plan: 'plan_1', effective: '2026-11-01' }, 's9');
    const x = live(r.state.notifications).find((k) => k.kind === 'members.notif.planChanged')!;
    expect(x.params).toMatchObject({ plan: 'Saver 8', planId: 'Hemat 8', date: '2026-11-01' });
    expect(translate('en', x.kind, x.params)).toContain('changes to Saver 8 from');
    expect(translate('id', x.kind, x.params)).toContain('berubah ke Hemat 8 mulai');
    expect(translate('id', x.kind, x.params)).not.toMatch(/Paket Paket/i);
  });
  it('the family request (a staff action item and the activity line) carries both names too', () => {
    const r = run(world(), 'planChange.request', { memberId: 'm1', to: 'plan_1' }, 'f1');
    const item = actionItems(r.state, getUser(clubs, 's9')!, T, 600).find((x) => x.kind === 'notif.act.planRequest')!;
    expect(item.params).toMatchObject({ plan: 'Saver 8', planId: 'Hemat 8' });
    expect(translate('en', item.kind, item.params)).toContain('switch to Saver 8 from');
    expect(translate('id', item.kind, item.params)).toContain('pindah ke paket Hemat 8 mulai');
    const feed = Object.values(r.state.activity).find((a) => a.key === 'feed.planRequested')!;
    expect(feed.params).toMatchObject({ plan: 'Saver 8', planId: 'Hemat 8' });
    expect(translate('id', 'feed.planRequested', feed.params)).toContain('ke paket Hemat 8');
  });
});
