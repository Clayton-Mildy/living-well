// Round 16: the notice period — a downgrade, stop or leave for a month must be asked noticeDays (default 14) before its 1st; an upgrade any time before the 1st.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, type ClubState } from '../index';
import { changeKind, earliestMonth, noticeCheck, noticeDays, noticeDeadline, noticeSettings } from './notice';

const seed = (): ClubState => buildSeed().citra;

describe('notice period', () => {
  it('defaults to 14 days before the 1st (December → 17 November)', () => {
    const s = seed();
    expect(noticeDays(s, 'stop')).toBe(14);
    expect(noticeDeadline(s, '2026-12', 'stop')).toBe('2026-11-17');
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
    expect(noticeDeadline(s, '2026-12', 'downgrade')).toBe('2026-11-24');
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
    expect(changeKind(up, up.members[flex.id], 'flex', '2026-12')).toBe('takeBack');
  });
});

describe('round 18: notice per kind of change', () => {
  it('no settings: 14 days for each kind', () => {
    expect(noticeSettings(seed())).toEqual({ downgrade: 14, stop: 14, leave: 14, upgrade: 1 });
  });
  it('an old club with only noticeDays 21 stored uses 21 for all three', () => {
    const s = produce(seed(), (d) => { d.club.settings.noticeDays = 21; delete d.club.settings.notice; });
    expect(noticeSettings(s)).toEqual({ downgrade: 21, stop: 21, leave: 21, upgrade: 1 }); // the old single value never applied to an upgrade
  });
  it('each kind has its own deadline and check', () => {
    const s = produce(seed(), (d) => { d.club.settings.notice = { downgrade: 7, stop: 30, leave: 14 }; });
    expect(noticeDeadline(s, '2026-12', 'downgrade')).toBe('2026-11-24');
    expect(noticeDeadline(s, '2026-12', 'stop')).toBe('2026-11-01');
    expect(noticeDeadline(s, '2026-12', 'leave')).toBe('2026-11-17');
    const today = '2026-11-05';
    const stop = noticeCheck(s, 'stop', '2026-12', today);
    expect(stop.ok).toBe(false);
    if (!stop.ok) expect(stop.params).toMatchObject({ days: 30, earliest: '2027-01', deadline: '2026-11-01' });
    expect(noticeCheck(s, 'leave', '2026-12', today).ok).toBe(true);
    expect(noticeCheck(s, 'downgrade', '2026-12', today).ok).toBe(true);
  });
});

describe('round 19: upgrade notice days', () => {
  const up5 = () => produce(seed(), (d) => { d.club.settings.notice = { downgrade: 14, stop: 14, leave: 14, upgrade: 5 }; });
  it('defaults to 1 day: December is asked by 30 Nov, as before', () => {
    expect(noticeSettings({ club: { settings: {} } } as unknown as ClubState).upgrade).toBe(1);
    expect(noticeDeadline(seed(), '2026-12', 'upgrade')).toBe('2026-11-30');
  });
  it('with 5 days an upgrade for December is late on 27 Nov and in time on 26 Nov', () => {
    const s = up5();
    expect(noticeCheck(s, 'upgrade', '2026-12', '2026-11-27')).toEqual({ ok: false, code: 'err.noticeLate', params: { deadline: '2026-11-26', month: '2026-12', earliest: '2027-01', days: 5 } });
    expect(noticeCheck(s, 'upgrade', '2026-12', '2026-11-26')).toEqual({ ok: true });
  });
  it('Review Focus 1: moving back to the plan in force the day before is a take-back, which needs no notice whatever the upgrade days', () => {
    const s = up5();
    const gold = Object.values(s.members).find((m) => m.plans.at(-1)?.plan === 'gold' && !m.deletedAt)!;
    const down = produce(s, (d) => { d.members[gold.id].plans.push({ from: '2026-12-01', plan: 'flex', by: 'staff:s9' }); }); // a downgrade scheduled for December
    expect(changeKind(down, down.members[gold.id], 'gold', '2026-12')).toBe('takeBack');
    expect(noticeCheck(down, 'takeBack', '2026-12', '2026-11-30').ok).toBe(true);
    expect(noticeCheck(down, 'takeBack', '2026-12', '2026-12-01').ok).toBe(false);
  });
});
