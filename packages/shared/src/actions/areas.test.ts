import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { buildSeed, getUser, allActions, execute, canRun, areaOf, isUnmapped, DomainError } from '../index';
import type { ClubState } from '../types';

const FIXTURE = new URL('./__fixtures__/can-matrix.json', import.meta.url);
const clock = { today: '2026-10-21', nowMin: 600 };
const SEED_USER: Record<string, string> = { lobby: 's1', kitchen: 's2', activity: 's5', nurse: 's8', mgmt: 's9', finance: 's10', owner: 's11' };
const seed = () => buildSeed().citra;
const user = (c: ClubState, role: string) => getUser({ [c.clubId]: c }, SEED_USER[role])!;
const withAccess = (c: ClubState, access: NonNullable<ClubState['club']['settings']['access']>): ClubState => ({ ...c, club: { ...c.club, settings: { ...c.club.settings, access } } });

describe('action areas', () => {
  // Run once, before execute changed, to pin what `can` said for every (action, role): then commit the JSON and leave this skipped.
  it.skip('generate', () => {
    const c = seed();
    const out: Record<string, Record<string, boolean>> = {};
    for (const d of allActions()) {
      out[d.name] = {};
      for (const role of Object.keys(SEED_USER)) {
        try { out[d.name][role] = !!d.can(user(c, role), {}, c); } catch { out[d.name][role] = false; }
      }
    }
    writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n');
  });

  it('round 17: the club rules belong to Settings, not Plans', () => {
    expect(areaOf('club.updateSettings')).toBe('settings');
    expect(areaOf('club.setPlan')).toBe('plans');
  });

  it('round 17: publishing terms belongs to Settings; agreeing stays the family\'s own', () => {
    expect(areaOf('terms.publish')).toBe('settings');
    expect(isUnmapped('terms.publish')).toBe(false);
    expect(areaOf('terms.agree')).toBeNull();
    expect(isUnmapped('terms.agree')).toBe(true);
  });

  it('every action has an area or is unmapped', () => {
    const missing = allActions().map((d) => d.name).filter((n) => !areaOf(n) && !isUnmapped(n));
    expect(missing).toEqual([]);
  });

  it('with default access, canRun equals the old can, except Management no longer acts in Receipts', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, Record<string, boolean>>;
    const c = seed();
    const diffs: string[] = [];
    for (const d of allActions()) {
      if (!fixture[d.name]) continue; // round 16: actions added after the matrix was pinned (access.*) have no old `can` to compare
      for (const role of Object.keys(SEED_USER)) {
        const want = areaOf(d.name) === 'receipts' && role === 'mgmt' ? false : fixture[d.name][role];
        if (canRun(d.name, user(c, role), {}, c) !== want) diffs.push(`${d.name} ${role}`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it('Ega cannot approve receipts; Fransiska can', () => {
    const c = seed();
    expect(() => execute(c, 'receipt.approve', { receiptId: 'x' }, user(c, 'mgmt'), clock, 'a1')).toThrow('err.viewOnly');
    expect(canRun('receipt.approve', user(c, 'finance'), {}, c)).toBe(true);
  });

  it('a granted Edit beyond the default lets the role do what the menu\'s role does', () => {
    const c = withAccess(seed(), { lobby: { budget: 'edit', payments: 'edit' } });
    const caca = user(c, 'lobby');
    expect(canRun('budget.setLimit', caca, {}, c)).toBe(true); // finance's can, through the Budget grant
    expect(canRun('budget.setLimit', caca, {}, seed())).toBe(false);
  });

  it('an explicit View refuses in a cell the role owns; a never-set Hidden cell leaves `can` alone', () => {
    const c = withAccess(seed(), { finance: { payments: 'view', stock: 'view' }, mgmt: { contacts: 'view' } });
    const fr = user(c, 'finance');
    expect(canRun('payment.record', fr, {}, c)).toBe(false);
    expect(canRun('payment.record', user(c, 'lobby'), {}, c)).toBe(true); // Caca: payments never set, Hidden by default
    expect(canRun('stock.approve', fr, {}, c)).toBe(false);
    expect(canRun('stock.approve', user(c, 'kitchen'), {}, c)).toBe(true);
    expect(canRun('directory.add', user(c, 'mgmt'), {}, c)).toBe(false);
    expect(canRun('directory.add', user(c, 'lobby'), {}, c)).toBe(true);
  });

  it('directory.* actions follow the Contacts cell, and a Directory cell stored before round 19 still counts', () => {
    const legacy = withAccess(seed(), { mgmt: { directory: 'view' }, lobby: { directory: 'edit' } });
    expect(canRun('directory.add', user(legacy, 'mgmt'), {}, legacy)).toBe(false);
    expect(canRun('directory.add', user(legacy, 'lobby'), {}, legacy)).toBe(true);
    const now = withAccess(seed(), { lobby: { contacts: 'view' } });
    expect(canRun('directory.add', user(now, 'lobby'), {}, now)).toBe(false);
  });

  it('Hidden or View refuses with err.viewOnly', () => {
    const c = withAccess(seed(), { lobby: { renewals: 'off' } });
    const caca = user(c, 'lobby');
    expect(canRun('followUp.record', caca, {}, c)).toBe(false);
    try { execute(c, 'followUp.record', { memberId: 'm1', month: '2026-10', outcome: 'continue' }, caca, clock, 'a2'); expect.unreachable(); } catch (e) { expect((e as DomainError).code).toBe('err.viewOnly'); }
  });

  it('the Owner is never area-checked', () => {
    const c = withAccess(seed(), { mgmt: { receipts: 'off' } });
    expect(canRun('receipt.approve', user(c, 'owner'), {}, c)).toBe(true);
  });
});
