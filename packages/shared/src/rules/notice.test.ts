// Round 16: the notice period — a downgrade, stop or leave for a month must be asked noticeDays (default 14) before its 1st; an upgrade any time before the 1st.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type ClubState } from '../index';
import { changeKind, earliestMonth, noticeCheck, noticeDays, noticeDeadline } from './notice';

const seed = (): ClubState => buildSeed().citra;

describe('notice period', () => {
  it('defaults to 14 days before the 1st (December → 17 November)', () => {
    const s = seed();
    expect(noticeDays(s)).toBe(14);
    expect(noticeDeadline(s, '2026-12')).toBe('2026-11-17');
  });
  it('a downgrade is fine on the deadline day and too late the day after; the earliest month moves on', () => {
    const s = seed();
    expect(noticeCheck(s, 'downgrade', '2026-12', '2026-11-17')).toEqual({ ok: true });
    const late = noticeCheck(s, 'downgrade', '2026-12', '2026-11-18');
    expect(late).toEqual({ ok: false, code: 'err.noticeLate', params: { deadline: '2026-11-17', month: '2026-12', earliest: '2027-01', days: 14 } });
    expect(earliestMonth(s, 'downgrade', '2026-11-18')).toBe('2027-01');
    expect(earliestMonth(s, 'stop', '2026-11-17')).toBe('2026-12');
  });
  it('an upgrade needs no notice, only to be asked before the 1st', () => {
    const s = seed();
    expect(noticeCheck(s, 'upgrade', '2026-12', '2026-11-30')).toEqual({ ok: true });
    expect(noticeCheck(s, 'upgrade', '2026-12', '2026-12-01').ok).toBe(false);
    expect(earliestMonth(s, 'upgrade', '2026-11-30')).toBe('2026-12');
  });
  it('the club setting changes the deadline', () => {
    const s = produce(seed(), (d) => { d.club.settings.noticeDays = 7; });
    expect(noticeDeadline(s, '2026-12')).toBe('2026-11-24');
  });
  it('a cheaper (or equally priced) plan is a downgrade, a dearer one an upgrade', () => {
    const s = seed();
    const gold = Object.values(s.members).find((m) => m.plans.at(-1)?.plan === 'gold' && !m.deletedAt)!;
    const flex = Object.values(s.members).find((m) => m.plans.at(-1)?.plan === 'flex' && !m.deletedAt)!;
    expect(changeKind(s, gold, 'flex', '2026-12')).toBe('downgrade');
    expect(changeKind(s, flex, 'gold', '2026-12')).toBe('upgrade');
    const same = produce(s, (d) => { d.club.settings.plans = [{ id: 'plan_1', name: 'Gold Plus', kind: 'unlimited', active: true }]; for (const p of Object.values(d.prices)) p.plans = { plan_1: p.gold }; });
    expect(changeKind(same, gold, 'plan_1', '2026-12')).toBe('downgrade');
  });
  it('taking back a scheduled change (back to the plan in force before the month) needs no notice', () => {
    const s = seed();
    const flex = Object.values(s.members).find((m) => m.plans.at(-1)?.plan === 'flex' && !m.deletedAt)!;
    const up = produce(s, (d) => { d.members[flex.id].plans.push({ from: '2026-12-01', plan: 'gold', by: 'staff:s9' }); });
    expect(changeKind(up, up.members[flex.id], 'flex', '2026-12')).toBe('upgrade');
  });
});
