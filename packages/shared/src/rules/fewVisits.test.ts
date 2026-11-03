// Round 17: the few-visits alert — the alert day follows the notice deadline; who is flagged on a given day; the three phases.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import type { ClubState } from '../types';
import { FEW_DAY, withFewVisits } from './testFewVisits';
import { fewVisitMembers, fewVisitsAlertDay, fewVisitsSettings, fewVisitsState, fewVisitsWindow } from './fewVisits';
import { translate } from '../i18n';

const ids = (s = withFewVisits(), today = FEW_DAY) => fewVisitMembers(s, today).map((r) => r.memberId);

describe('alert day', () => {
  it('is two days before the notice deadline of the next month (15 Nov, 16 Dec, 13 Feb)', () => {
    const s = withFewVisits();
    expect(fewVisitsAlertDay(s, '2026-11')).toBe('2026-11-15');
    expect(fewVisitsAlertDay(s, '2026-12')).toBe('2026-12-16');
    expect(fewVisitsAlertDay(s, '2027-02')).toBe('2027-02-13');
  });
  it('follows the notice period and the club setting', () => {
    const s = produce(withFewVisits(), (d) => { d.club.settings.noticeDays = 7; });
    expect(fewVisitsAlertDay(s, '2026-11')).toBe('2026-11-22');
    const t = produce(withFewVisits(), (d) => { d.club.settings.fewVisits = { below: 5, daysBeforeDeadline: 5 }; });
    expect(fewVisitsAlertDay(t, '2026-11')).toBe('2026-11-12');
  });
  it('the settings default to 5 and 2', () => {
    expect(fewVisitsSettings(withFewVisits())).toEqual({ below: 5, daysBeforeDeadline: 2 });
  });
});

describe('who is flagged', () => {
  it('fewer than 5 visit days this month: not called first, then fewest visits first', () => {
    const rows = fewVisitMembers(withFewVisits(), FEW_DAY);
    expect(rows.map((r) => r.memberId)).toEqual(['fv6', 'fv4', 'fv2', 'fv3', 'fv1', 'fv5']); // fv2 and fv3 both came 3 times: name order · Joko was called: last
    expect(rows.map((r) => r.visits)).toEqual([0, 2, 3, 3, 4, 1]);
    expect(rows.find((r) => r.memberId === 'fv2')).toMatchObject({ visits: 3, last: '2026-11-04', called: false });
    expect(rows.find((r) => r.memberId === 'fv6')?.last).toBeUndefined();
    expect(rows.find((r) => r.memberId === 'fv5')).toMatchObject({ visits: 1, called: true });
  });
  it('5 visits is not flagged; 4 is flagged only while below is 5', () => {
    const s = withFewVisits();
    expect(ids(s)).toContain('fv1'); // 4 visits
    const five = produce(s, (d) => { d.attendance['2026-11-06:fv1'] = { ...d.attendance['2026-11-06:m1'], id: '2026-11-06:fv1', memberId: 'fv1' }; });
    expect(ids(five)).not.toContain('fv1');
    const below4 = produce(s, (d) => { d.club.settings.fewVisits = { below: 4, daysBeforeDeadline: 2 }; });
    expect(ids(below4)).not.toContain('fv1');
    expect(ids(below4)).toContain('fv2'); // 3 visits
  });
  it('only counts the visits up to today', () => {
    const s = produce(withFewVisits(), (d) => { d.attendance['2026-11-20:fv6'] = { ...d.attendance['2026-11-06:m1'], id: '2026-11-20:fv6', memberId: 'fv6', date: '2026-11-20' }; });
    expect(fewVisitMembers(s, FEW_DAY).find((r) => r.memberId === 'fv6')?.visits).toBe(0);
  });
  it('an undone check-in is not a visit', () => {
    const s = produce(withFewVisits(), (d) => { delete d.attendance['2026-11-04:fv5'].checkIn; });
    expect(fewVisitMembers(s, FEW_DAY).find((r) => r.memberId === 'fv5')?.visits).toBe(0);
  });
});

describe('who is left out', () => {
  const cases: [string, (d: ClubState) => void][] = [
    ['on leave in November', (d) => { d.members.fv2.memberships[0].leaves = [{ month: '2026-11', at: '2026-10-01T09:00', by: 'staff:s1' }]; }],
    ['started on 10 Nov', (d) => { d.members.fv2.memberships[0].start = '2026-11-10'; d.members.fv2.plans[0].from = '2026-11-10'; }],
    ['a stop recorded for December', (d) => { d.members.fv2.memberships[0].lastDay = '2026-12-10'; }],
    ['leave asked for December', (d) => { d.members.fv2.memberships[0].leaves = [{ month: '2026-12', at: '2026-11-10T09:00', by: 'family:f1' }]; }],
    ['a pending plan change from December', (d) => { d.planChangeRequests.pc1 = { id: 'pc1', clubId: d.clubId, createdAt: '2026-11-10T09:00', createdBy: 'family:f1', memberId: 'fv2', to: 'gold', from: '2026-12-01', status: 'pending' }; }],
    ['ended on 5 Nov', (d) => { d.members.fv2.memberships[0].lastDay = '2026-11-05'; }],
    ['deleted', (d) => { d.members.fv2.deletedAt = '2026-11-10T09:00'; }],
  ];
  it.each(cases)('%s', (_n, change) => {
    const before = ids();
    expect(before).toContain('fv2');
    expect(ids(produce(withFewVisits(), change))).toEqual(before.filter((x) => x !== 'fv2'));
  });
});

describe('called', () => {
  it('is true when a call is logged for the member and the month, and not for another month', () => {
    const s = produce(withFewVisits(), (d) => { d.visitCalls['vc-fv5'].month = '2026-10'; });
    expect(fewVisitMembers(s, FEW_DAY).find((r) => r.memberId === 'fv5')?.called).toBe(false);
  });
});

describe('phase', () => {
  it('before on 14 Nov, open 15 to 17 Nov, closed from 18 Nov', () => {
    const s = withFewVisits();
    expect(fewVisitsState(s, '2026-11-14')).toMatchObject({ month: '2026-11', alertDay: '2026-11-15', deadline: '2026-11-17', phase: 'before' });
    for (const d of ['2026-11-15', '2026-11-16', '2026-11-17']) expect(fewVisitsState(s, d).phase).toBe('open');
    expect(fewVisitsState(s, '2026-11-18').phase).toBe('closed');
    expect(fewVisitsState(s, '2026-11-30').phase).toBe('closed');
  });
  it('carries the rows and how many were called', () => {
    const st = fewVisitsState(withFewVisits(), FEW_DAY);
    expect(st.rows).toHaveLength(6);
    expect(st.called).toBe(1);
  });
});

describe('window and wording', () => {
  it('the window matches the full state without building the rows', () => {
    const s = withFewVisits();
    for (const d of ['2026-11-04', FEW_DAY, '2026-11-25']) {
      const { rows: _r, called: _c, ...w } = fewVisitsState(s, d);
      expect(fewVisitsWindow(s, d)).toEqual(w);
    }
  });
  it('the notice has singular forms ("1 member came 1 time")', () => {
    expect(translate('en', 'renewals.few.notif', { n: 1, max: 1, d: '17 Nov' })).toBe('1 member came 1 time or fewer this month · plan changes close 17 Nov');
    expect(translate('en', 'renewals.few.notif', { n: 6, max: 4, d: '17 Nov' })).toBe('6 members came 4 times or fewer this month · plan changes close 17 Nov');
  });
});
