import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed } from '../seed';
import { daysBetween } from '../util';
import type { CareCall, ClubState } from '../types';
import { checkOnList, checkOnThreshold, usualGapDays } from './checkOn';

const T = '2026-10-21';
const seed = buildSeed().citra;
const quiet = (s: ClubState, id: string, days: number) => produce(s, (d) => { for (const k of Object.keys(d.attendance)) if (d.attendance[k].memberId === id && daysBetween(d.attendance[k].date, T) < days) delete d.attendance[k]; });
const call = (memberId: string, date: string, extra: Partial<CareCall> = {}): CareCall => ({ id: 'cc-' + memberId + date, clubId: seed.clubId, createdAt: date + 'T10:00', createdBy: 'staff:s1', memberId, date, at: date + 'T10:00', by: 'staff:s1', contactName: 'X', phone: '+62 811', outcome: 'noAnswer', ...extra });
const withCall = (s: ClubState, c: CareCall) => produce(s, (d) => { d.careCalls[c.id] = c; });
const listed = (s: ClubState, id: string) => checkOnList(s, T).find((r) => r.member.id === id);

describe('check on', () => {
  it('threshold clamps', () => {
    expect(checkOnThreshold(null)).toBe(14);
    expect(checkOnThreshold(2)).toBe(10);
    expect(checkOnThreshold(6)).toBe(12);
    expect(checkOnThreshold(20)).toBe(14);
  });
  it('usual gap is null with fewer than three visits, never NaN', () => {
    const s = produce(seed, (d) => { for (const k of Object.keys(d.attendance)) if (d.attendance[k].memberId === 'm2') delete d.attendance[k]; });
    expect(usualGapDays(s, 'm2', T)).toBeNull();
    expect(checkOnList(quiet(s, 'm2', 1), T).find((r) => r.member.id === 'm2')?.threshold).toBe(14);
  });
  it('lists a daily member after 10 quiet days, not after 5', () => {
    expect(listed(quiet(seed, 'm1', 5), 'm1')).toBeUndefined();
    expect(listed(quiet(seed, 'm1', 11), 'm1')).toMatchObject({ daysSince: 12, threshold: 10 }); // the 10th is a Saturday: last seen Friday the 9th;
  });
  it('a fixed "not seen for" replaces the automatic threshold for everyone', () => {
    const eight = quiet(seed, 'm1', 7); // last seen a week ago (the 14th)
    expect(listed(eight, 'm1')).toBeUndefined(); // automatic: never under 10
    expect(checkOnList(eight, T, 7).find((r) => r.member.id === 'm1')).toMatchObject({ daysSince: 7, threshold: 7 });
    expect(checkOnList(quiet(seed, 'm1', 19), T, 30).find((r) => r.member.id === 'm1')).toBeUndefined(); // 20 days: under 30
    expect(checkOnList(quiet(seed, 'm1', 19), T).find((r) => r.member.id === 'm1')).toBeDefined(); // but automatic lists it
  });
  it('a fixed number still skips a member checked in today or joined under 14 days ago', () => {
    expect(checkOnList(seed, T, 7).find((r) => r.member.id === 'm1')).toBeUndefined();
    const fresh = produce(quiet(seed, 'm1', 11), (d) => { const cur = d.members.m1.memberships[d.members.m1.memberships.length - 1]; cur.start = '2026-10-10'; });
    expect(checkOnList(fresh, T, 7).find((r) => r.member.id === 'm1')).toBeUndefined();
  });
  it('sorts by days since the last visit, longest first', () => {
    const rows = checkOnList(quiet(quiet(seed, 'm1', 12), 'm46', 16), T);
    const days = rows.map((r) => r.daysSince);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });
  it('a member who checked in today is never listed', () => {
    expect(listed(seed, 'm1')).toBeUndefined();
  });
  it('a call with checkAgainOn later than today hides the member; a call older than the threshold does not', () => {
    const base = quiet(seed, 'm1', 11);
    expect(listed(withCall(base, call('m1', '2026-10-14', { checkAgainOn: '2026-10-25' })), 'm1')).toBeUndefined();
    expect(listed(withCall(base, call('m1', '2026-10-05', { checkAgainOn: '2026-10-21' })), 'm1')?.lastCall?.outcome).toBe('noAnswer');
    expect(listed(withCall(base, call('m1', '2026-10-20')), 'm1')).toBeUndefined(); // called yesterday
    expect(listed(withCall(base, call('m1', '2026-10-10')), 'm1')).toBeDefined(); // 11 days ago: past the threshold of 10
  });
  it('members on leave, on hold, or joined < 14 days ago are not listed', () => {
    const base = quiet(seed, 'm20', 30); // m20 has an overdue invoice
    expect(listed(base, 'm20')).toBeUndefined();
    const leave = produce(quiet(seed, 'm1', 11), (d) => { const cur = d.members.m1.memberships[d.members.m1.memberships.length - 1]; cur.leaves = [{ month: '2026-10' } as never]; });
    expect(listed(leave, 'm1')).toBeUndefined();
    const fresh = produce(quiet(seed, 'm1', 11), (d) => { const cur = d.members.m1.memberships[d.members.m1.memberships.length - 1]; cur.start = '2026-10-10'; });
    expect(listed(fresh, 'm1')).toBeUndefined();
  });
  it('the demo seed has one quiet member waiting and one already called', () => {
    const demo = buildSeed(T, 598, { roster: true }).citra;
    const rows = checkOnList(demo, T);
    expect(rows.map((r) => [r.member.id, r.daysSince])).toEqual([['m90', 22]]);
    const calls = Object.values(demo.careCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ memberId: 'm57', outcome: 'travelling', date: '2026-10-14', checkAgainOn: '2026-10-26', by: 'staff:s1' });
    expect(checkOnList(produce(demo, (d) => { d.careCalls = {}; }), T).map((r) => r.member.id)).toEqual(['m90', 'm57']); // without the call, Endang is on the list too
    expect(Object.values(demo.moodMarks).some((m) => m.memberId === 'm90' && m.date > '2026-09-29')).toBe(false);
    expect(Object.values(demo.attendance).some((a) => a.memberId === 'm57' && a.date > '2026-10-01')).toBe(false);
  });
});
