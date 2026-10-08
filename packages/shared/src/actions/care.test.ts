import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, live, DomainError, type ClubState } from '../index';

const clock = { today: '2026-10-21', nowMin: 600 }; // Wed 21 Oct, 10:00
let n = 0;
const fresh = (): ClubState => buildSeed().citra;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, as(s, uid), clk, `t${++n}`);
const step = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => run(s, name, input, uid, clk).state;
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string, clk = clock) => {
  try { run(s, name, input, uid, clk); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const base = { mood: 'calm', lunch: 'all', joined: 'yes', communicative: 'normal', content: 'normal', note: '' };
let apN = 0;
/** management approves logs / notes (families hear about them only then) */
const approve = (s: ClubState, ids: string[], clk = clock) => execute(s, 'approval.approve', { type: 'logs', ids }, as(s, 's9'), clk, `ap${++apN}`);
const note = (s: ClubState, kind: string) => live(s.notifications).filter((x) => x.kind === kind);

describe('log.save', () => {
  it('saves Bambang as quiet / ate most and tells his family once', () => {
    const s0 = fresh();
    const r = run(s0, 'log.save', { memberId: 'm10', date: '2026-10-21', ...base, mood: 'quiet', lunch: 'most', joined: 'satOut', communicative: 'withdrawn', content: 'low', note: 'Quiet morning, enjoyed the tea.', staffNote: 'Watch his appetite.' }, 's5');
    const l = r.state.dailyLogs['log-m10-2026-10-21'];
    expect(l).toMatchObject({ memberId: 'm10', date: '2026-10-21', mood: 'quiet', lunch: 'most', joined: 'satOut', communicative: 'withdrawn', content: 'low', note: 'Quiet morning, enjoyed the tea.', staffNote: 'Watch his appetite.', status: 'saved', by: 's5', edits: [], createdBy: 'staff:s5' });
    expect(r.result).toMatchObject({ logId: 'log-m10-2026-10-21', edited: false });
    // a teacher's log waits for approval: families neither see it nor hear about it
    expect(l.approval).toMatchObject({ status: 'pending', by: 'staff:s5' });
    expect(r.result.pending).toBe(true);
    expect(note(r.state, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
    const ap = approve(r.state, ['log-m10-2026-10-21']);
    expect(ap.state.dailyLogs['log-m10-2026-10-21'].approval).toMatchObject({ status: 'approved', decidedBy: 'staff:s9' });
    const ns = note(ap.state, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toUsers: ['fm10_0'], memberId: 'm10', link: '/today', ref: { type: 'dailyLog', id: 'log-m10-2026-10-21' } });
    expect(Object.values(r.state.activity).some((a) => a.key === 'activity.feed.log' && a.memberId === 'm10')).toBe(true);
  });

  it('stores every mood, lunch amount and observation as entered', () => {
    let s = fresh();
    for (const mood of ['cheerful', 'calm', 'quiet', 'agitated'])
      for (const lunch of ['all', 'most', 'half', 'little', 'none']) {
        s = step(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, mood, lunch }, 's5');
        expect(s.dailyLogs['log-m2-2026-10-21']).toMatchObject({ mood, lunch });
      }
    s = step(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, mood: 'unsettled', joined: 'satOut', communicative: 'withdrawn', content: 'low' }, 's5');
    expect(s.dailyLogs['log-m2-2026-10-21']).toMatchObject({ mood: 'agitated', joined: 'satOut', communicative: 'withdrawn', content: 'low' });
    s = step(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, joined: 'yes', communicative: 'normal', content: 'normal' }, 's5');
    expect(s.dailyLogs['log-m2-2026-10-21']).toMatchObject({ joined: 'yes', communicative: 'normal', content: 'normal' });
  });

  it('records edits and uses the "updated" notification the second time', () => {
    let s = step(fresh(), 'log.save', { memberId: 'm20', date: '2026-10-21', ...base }, 's5');
    expect(s.dailyLogs['log-m20-2026-10-21'].edits).toEqual([]);
    s = approve(s, ['log-m20-2026-10-21']).state; // management has approved it: families have seen it
    const r = run(s, 'log.save', { memberId: 'm20', date: '2026-10-21', ...base, mood: 'cheerful', note: 'Sang along.' }, 's9', { today: '2026-10-21', nowMin: 640 });
    s = r.state;
    expect(r.result.edited).toBe(true);
    expect(s.dailyLogs['log-m20-2026-10-21']).toMatchObject({ mood: 'cheerful', note: 'Sang along.', by: 's5' });
    expect(s.dailyLogs['log-m20-2026-10-21'].edits).toEqual([{ at: '2026-10-21T10:40', by: 's9' }]);
    expect(note(s, 'activity.notif.logUpdated')).toHaveLength(1); // management's own edit is approved at once
    expect(s.dailyLogs['log-m20-2026-10-21'].approval).toBeUndefined();
    // a blank staff note clears it; omitting it keeps it
    s = step(s, 'log.save', { memberId: 'm20', date: '2026-10-21', ...base, staffNote: 'Internal' }, 's5');
    expect(s.dailyLogs['log-m20-2026-10-21'].staffNote).toBe('Internal');
    s = step(s, 'log.save', { memberId: 'm20', date: '2026-10-21', ...base }, 's5');
    expect(s.dailyLogs['log-m20-2026-10-21'].staffNote).toBe('Internal');
    s = step(s, 'log.save', { memberId: 'm20', date: '2026-10-21', ...base, staffNote: '' }, 's5');
    expect(s.dailyLogs['log-m20-2026-10-21'].staffNote).toBeUndefined();
  });

  it('edits yesterday and up to 7 days back, not further, never the future', () => {
    const s = fresh();
    const y = run(s, 'log.save', { memberId: 'm2', date: '2026-10-20', ...base, mood: 'cheerful', lunch: 'most', note: 'Late edit.' }, 's5');
    expect(y.state.dailyLogs['log-m2-2026-10-20']).toMatchObject({ mood: 'cheerful', lunch: 'most', note: 'Late edit.' });
    expect(y.state.dailyLogs['log-m2-2026-10-20'].edits).toHaveLength(1);
    run(s, 'log.save', { memberId: 'm2', date: '2026-10-14', ...base }, 's5'); // exactly 7 days back
    fails(s, 'log.save', { memberId: 'm2', date: '2026-10-13', ...base }, 's5', 'activity.err.dateRange');
    fails(s, 'log.save', { memberId: 'm2', date: '2026-10-22', ...base }, 's5', 'activity.err.dateRange');
  });

  it('only for members who were checked in that day', () => {
    fails(fresh(), 'log.save', { memberId: 'm1', date: '2026-10-21', ...base }, 's5', 'activity.err.notAttended'); // Oma Lina has not arrived yet
    fails(fresh(), 'log.save', { memberId: 'nobody', date: '2026-10-21', ...base }, 's5', 'err.notFound');
  });

  it('drop-in: whoever checked in that day can be logged, including members who already went home', () => {
    const row = (id: string, hm: string) => ({ id: `2026-10-21:${id}`, clubId: 'citra', createdAt: '2026-10-21T09:00', createdBy: 'staff:s1', memberId: id, date: '2026-10-21', checkIn: { at: hm, by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] }) as unknown as ClubState['attendance'][string];
    const s = produce(fresh(), (d) => {
      d.attendance['2026-10-21:m1'] = row('m1', '10:05'); // Oma Lina dropped in a moment ago (nobody was expecting her)
      d.attendance['2026-10-21:m2'].checkOut = { at: '10:20', by: 'staff:s1', method: 'manual' }; // Opa Hendra has already left
    });
    expect(run(s, 'log.save', { memberId: 'm1', date: '2026-10-21', ...base }, 's5').state.dailyLogs['log-m1-2026-10-21']).toMatchObject({ status: 'saved', memberId: 'm1' });
    expect(run(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base }, 's5').state.dailyLogs['log-m2-2026-10-21']).toMatchObject({ status: 'saved', memberId: 'm2' });
    const all = run(s, 'log.saveAllNormal', { date: '2026-10-21' }, 's5');
    expect(new Set(all.result.memberIds as string[])).toEqual(new Set(['m1', 'm2', 'm10', 'm20']));
  });

  it('is permissioned: activity, nurse and management may write; others may not', () => {
    const s = fresh();
    for (const uid of ['s5', 's6', 's8', 's9']) run(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base }, uid);
    for (const uid of ['s1', 's3', 's10', 'f1', 'fm2_0']) fails(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base }, uid, 'err.forbidden');
  });

  it('validates the input', () => {
    const s = fresh();
    fails(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, mood: 'ecstatic' }, 's5', 'err.invalid');
    fails(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, lunch: 'lots' }, 's5', 'err.invalid');
    fails(s, 'log.save', { memberId: 'm2', date: 'yesterday', ...base }, 's5', 'err.invalid');
    fails(s, 'log.save', { memberId: 'm2', date: '2026-02-30', ...base }, 's5', 'err.invalid');
    fails(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, note: 'x'.repeat(601) }, 's5', 'err.invalid');
  });

  it('works on any date: nothing is tied to October 2026', () => {
    const clk = { today: '2027-02-10', nowMin: 700 };
    const s = produce(fresh(), (d) => {
      d.attendance['2027-02-10:m2'] = { id: '2027-02-10:m2', clubId: 'citra', createdAt: '2027-02-10T09:00', createdBy: 'staff:s1', memberId: 'm2', date: '2027-02-10', checkIn: { at: '09:40', by: 'staff:s1', method: 'face' }, queueAdds: [], dismissed: [], edits: [] } as unknown as typeof d.attendance[string];
    });
    const r = run(s, 'log.save', { memberId: 'm2', date: '2027-02-10', ...base, mood: 'cheerful' }, 's5', clk);
    expect(r.state.dailyLogs['log-m2-2027-02-10'].mood).toBe('cheerful');
    fails(s, 'log.save', { memberId: 'm2', date: '2027-02-03', ...base }, 's5', 'activity.err.notAttended', clk);
    fails(s, 'log.save', { memberId: 'm2', date: '2027-02-02', ...base }, 's5', 'activity.err.dateRange', clk);
  });

  it('is deterministic: same mutation id gives the same patches on client and server', () => {
    const a = execute(fresh(), 'log.save', { memberId: 'm10', date: '2026-10-21', ...base }, as(fresh(), 's5'), clock, 'mx');
    const b = execute(fresh(), 'log.save', { memberId: 'm10', date: '2026-10-21', ...base }, as(fresh(), 's5'), clock, 'mx');
    expect(JSON.stringify(a.patches)).toEqual(JSON.stringify(b.patches));
  });
});

describe('log.save as the Mood & notes round (KC round 7)', () => {
  it('saves mood and notes alone: lunch and sessions stay unmarked', () => {
    const s = step(fresh(), 'log.save', { memberId: 'm2', date: '2026-10-21', mood: 'cheerful', note: 'Sang along.' }, 's5');
    const l = s.dailyLogs['log-m2-2026-10-21'];
    expect(l).toMatchObject({ mood: 'cheerful', note: 'Sang along.', status: 'saved' });
    expect(l.lunch).toBeUndefined();
    expect(l.sessions).toBeUndefined();
    expect(l.joined).toBeUndefined();
  });

  it('is a new entry (not an edit) when only lunch was marked before, and keeps the lunch mark', () => {
    let s = step(fresh(), 'log.mark', { date: '2026-10-21', memberIds: ['m2'], lunch: 'half' }, 's5');
    const r = run(s, 'log.save', { memberId: 'm2', date: '2026-10-21', ...base, mood: 'quiet', lunch: undefined, joined: undefined }, 's5');
    s = r.state;
    expect(r.result.edited).toBe(false);
    expect(s.dailyLogs['log-m2-2026-10-21']).toMatchObject({ mood: 'quiet', lunch: 'half', edits: [] });
  });

  it('management completing the round tells the family "ready" once, then "updated"', () => {
    let s = step(fresh(), 'log.mark', { date: '2026-10-21', memberIds: ['m10'], lunch: 'all' }, 's9');
    expect(note(s, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(0); // a lunch mark is not "the log is ready"
    s = step(s, 'log.save', { memberId: 'm10', date: '2026-10-21', mood: 'calm', note: '' }, 's9');
    expect(note(s, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(1);
    s = step(s, 'log.save', { memberId: 'm10', date: '2026-10-21', mood: 'cheerful', note: 'Happy.' }, 's9');
    expect(note(s, 'activity.notif.logUpdated')).toHaveLength(1);
  });
});

describe('log.mark', () => {
  const T = '2026-10-21';
  it('the teacher marks lunch for several people at once: every row waits for approval and families hear nothing yet', () => {
    const r = run(fresh(), 'log.mark', { date: T, memberIds: ['m2', 'm10', 'm20'], lunch: 'all' }, 's5');
    expect(r.result).toMatchObject({ marked: 3, pending: true });
    for (const id of ['m2', 'm10', 'm20']) {
      const l = r.state.dailyLogs[`log-${id}-${T}`];
      expect(l).toMatchObject({ memberId: id, lunch: 'all', note: '', status: 'saved', by: 's5', edits: [] });
      expect(l.mood).toBeUndefined();
      expect(l.approval).toMatchObject({ status: 'pending', by: 'staff:s5' });
      expect(l.approval?.prev).toBeUndefined(); // brand new: families see nothing
    }
    expect(projectForFamily(r.state, 'fm2_0').dailyLogs[`log-m2-${T}`]).toBeUndefined();
    expect(note(r.state, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
    expect(Object.values(r.state.activity).filter((a) => a.key === 'activity.feed.markLunch')).toHaveLength(1); // one feed line for the whole round tap
    // management approves: families now see lunch, one notice each
    const ap = approve(r.state, ['log-m2-' + T]).state;
    expect(projectForFamily(ap, 'fm2_0').dailyLogs[`log-m2-${T}`]).toMatchObject({ lunch: 'all' });
  });

  it('management marks are approved at once and keep joined in step with the sessions', () => {
    let s = step(fresh(), 'log.mark', { date: T, memberIds: ['m2', 'm10'], session: { slot: '10:30', value: 'satOut' } }, 's9');
    expect(s.dailyLogs[`log-m2-${T}`]).toMatchObject({ sessions: { '10:30': 'satOut' }, joined: 'satOut' });
    expect(s.dailyLogs[`log-m2-${T}`].approval).toBeUndefined();
    s = step(s, 'log.mark', { date: T, memberIds: ['m2'], session: { slot: '13:30', value: 'joined' } }, 's9');
    expect(s.dailyLogs[`log-m2-${T}`]).toMatchObject({ sessions: { '10:30': 'satOut', '13:30': 'joined' }, joined: 'yes' });
    expect(projectForFamily(s, 'fm2_0').dailyLogs[`log-m2-${T}`]).toMatchObject({ sessions: { '10:30': 'satOut', '13:30': 'joined' } });
  });

  it('a person who did not check in that day fails the whole call; nothing is written', () => {
    fails(fresh(), 'log.mark', { date: T, memberIds: ['m2', 'm1'], lunch: 'all' }, 's5', 'activity.err.notAttended'); // Oma Lina has not arrived
    fails(fresh(), 'log.mark', { date: T, memberIds: ['ghost'], lunch: 'all' }, 's5', 'err.notFound');
  });

  it('a session that is not on the plan, a missing mark, a bad value, the date window and permissions are refused', () => {
    const none = produce(fresh(), (d) => { for (const v of Object.values(d.scheduleVersions)) for (const day of Object.values(v.days)) delete (day as Record<string, unknown>)['13:30']; });
    fails(none, 'log.mark', { date: T, memberIds: ['m2'], session: { slot: '13:30', value: 'joined' } }, 's5', 'activity.err.noSession');
    fails(fresh(), 'log.mark', { date: T, memberIds: ['m2'] }, 's5', 'err.invalid');
    fails(fresh(), 'log.mark', { date: T, memberIds: [], lunch: 'all' }, 's5', 'err.invalid');
    fails(fresh(), 'log.mark', { date: T, memberIds: ['m2'], lunch: 'lots' }, 's5', 'err.invalid');
    fails(fresh(), 'log.mark', { date: T, memberIds: ['m2'], session: { slot: '09:00', value: 'joined' } }, 's5', 'err.invalid');
    fails(fresh(), 'log.mark', { date: '2026-10-13', memberIds: ['m2'], lunch: 'all' }, 's5', 'activity.err.dateRange');
    for (const uid of ['s1', 's3', 's10', 'f1', 'fm2_0']) fails(fresh(), 'log.mark', { date: T, memberIds: ['m2'], lunch: 'all' }, uid, 'err.forbidden');
    for (const uid of ['s5', 's6', 's8', 's9']) run(fresh(), 'log.mark', { date: T, memberIds: ['m2'], lunch: 'all' }, uid);
  });

  it('tapping a different value changes it; null clears it, and a log cleared back to nothing disappears', () => {
    let s = step(fresh(), 'log.mark', { date: T, memberIds: ['m2'], lunch: 'all' }, 's5');
    s = step(s, 'log.mark', { date: T, memberIds: ['m2'], lunch: 'none' }, 's5');
    expect(s.dailyLogs[`log-m2-${T}`].lunch).toBe('none');
    s = step(s, 'log.mark', { date: T, memberIds: ['m2'], lunch: null }, 's5');
    expect(s.dailyLogs[`log-m2-${T}`].deletedAt).toBeTruthy();
    expect(live(s.dailyLogs).some((l) => l.id === `log-m2-${T}`)).toBe(false);
    s = step(s, 'log.mark', { date: T, memberIds: ['m2'], lunch: 'half' }, 's5'); // marking again brings a fresh row
    expect(s.dailyLogs[`log-m2-${T}`]).toMatchObject({ lunch: 'half' });
    expect(s.dailyLogs[`log-m2-${T}`].deletedAt).toBeUndefined();
  });

  it('"mark the rest" (onlyEmpty) leaves what is already marked alone', () => {
    let s = step(fresh(), 'log.mark', { date: T, memberIds: ['m10'], lunch: 'little' }, 's5');
    const r = run(s, 'log.mark', { date: T, memberIds: ['m2', 'm10', 'm20'], lunch: 'all', onlyEmpty: true }, 's5');
    s = r.state;
    expect(r.result.marked).toBe(2);
    expect(s.dailyLogs[`log-m10-${T}`].lunch).toBe('little');
    expect(s.dailyLogs[`log-m2-${T}`].lunch).toBe('all');
    // the mood round's "rest" sets the three observations
    const m = run(s, 'log.mark', { date: T, memberIds: ['m2'], mood: 'calm', communicative: 'normal', content: 'normal', onlyEmpty: true }, 's5');
    expect(m.state.dailyLogs[`log-m2-${T}`]).toMatchObject({ mood: 'calm', communicative: 'normal', content: 'normal', lunch: 'all' });
    expect(m.result.marked).toBe(1);
  });

  it('a mark on an approved log keeps what families saw (sessions included) until management approves the change', () => {
    let s = step(fresh(), 'log.mark', { date: T, memberIds: ['m2'], lunch: 'all', session: undefined }, 's5');
    s = approve(s, [`log-m2-${T}`]).state;
    s = step(s, 'log.mark', { date: T, memberIds: ['m2'], session: { slot: '10:30', value: 'joined' } }, 's5');
    const l = s.dailyLogs[`log-m2-${T}`];
    expect(l.approval).toMatchObject({ status: 'pending', prev: { lunch: 'all', note: '' } });
    const fam = projectForFamily(s, 'fm2_0').dailyLogs[`log-m2-${T}`];
    expect(fam).toMatchObject({ lunch: 'all' });
    expect(fam.sessions).toBeUndefined();
    s = approve(s, [`log-m2-${T}`]).state;
    expect(projectForFamily(s, 'fm2_0').dailyLogs[`log-m2-${T}`].sessions).toEqual({ '10:30': 'joined' });
  });

  it('works for a past day inside the window', () => {
    const r = run(fresh(), 'log.mark', { date: '2026-10-20', memberIds: ['m46'], lunch: 'most' }, 's6');
    expect(r.state.dailyLogs['log-m46-2026-10-20']).toMatchObject({ lunch: 'most' });
  });
});

describe('log.saveAllNormal', () => {
  it('saves only members present and not yet logged, and leaves written logs alone', () => {
    let s = step(fresh(), 'log.save', { memberId: 'm10', date: '2026-10-21', ...base, mood: 'quiet', lunch: 'half', note: 'Quiet today.' }, 's5');
    const r = run(s, 'log.saveAllNormal', { date: '2026-10-21' }, 's5');
    s = r.state;
    expect(r.result.saved).toBe(2);
    expect(new Set(r.result.memberIds as string[])).toEqual(new Set(['m2', 'm20']));
    expect(s.dailyLogs['log-m10-2026-10-21']).toMatchObject({ mood: 'quiet', lunch: 'half', note: 'Quiet today.', edits: [] });
    expect(s.dailyLogs['log-m2-2026-10-21']).toMatchObject({ mood: 'calm', lunch: 'all', joined: 'yes', communicative: 'normal', content: 'normal', note: '', status: 'saved' });
    expect(s.dailyLogs['log-m20-2026-10-21']).toMatchObject({ mood: 'calm', by: 's5' });
    expect(s.dailyLogs['log-m1-2026-10-21']).toBeUndefined(); // not here yet
    expect(s.dailyLogs['log-m46-2026-10-21']).toBeUndefined();
    expect(note(s, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(0); // all three wait for approval
    s = approve(s, ['log-m10-2026-10-21', 'log-m2-2026-10-21', 'log-m20-2026-10-21']).state;
    expect(note(s, 'activity.notif.logSaved').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(3); // Bambang's save + 2 bulk
    fails(s, 'log.saveAllNormal', { date: '2026-10-21' }, 's5', 'activity.err.nothingToLog');
  });

  it('defaults to today and respects the 7-day window', () => {
    const r = run(fresh(), 'log.saveAllNormal', {}, 's9');
    expect(r.result.saved).toBe(3);
    fails(fresh(), 'log.saveAllNormal', { date: '2026-10-13' }, 's5', 'activity.err.dateRange');
  });

  it('can catch up a past day without touching the logs already written', () => {
    const s = produce(fresh(), (d) => { delete d.dailyLogs['log-m2-2026-10-20']; });
    const r = run(s, 'log.saveAllNormal', { date: '2026-10-20' }, 's6');
    expect(r.result).toMatchObject({ saved: 1, memberIds: ['m2'] });
    expect(r.state.dailyLogs['log-m2-2026-10-20'].mood).toBe('calm');
    expect(r.state.dailyLogs['log-m46-2026-10-20']).toEqual(s.dailyLogs['log-m46-2026-10-20']);
  });

  it('is permissioned like log.save', () => {
    fails(fresh(), 'log.saveAllNormal', {}, 's1', 'err.forbidden');
    fails(fresh(), 'log.saveAllNormal', {}, 'f1', 'err.forbidden');
    run(fresh(), 'log.saveAllNormal', {}, 's8');
  });
});

describe('photo moderation', () => {
  const photoOf = (s: ClubState, mid: string) => live(s.photos).find((p) => p.visibility === 'visible' && p.kind === 'group' && p.memberIds.includes(mid))!;

  it('retag replaces the tags, turns solo photos into group photos, and only tells newly tagged families', () => {
    const s = fresh();
    const p = photoOf(s, 'm2');
    const before = p.memberIds;
    const add = ['m1', 'm10', 'm20', 'm2', 'm46'].find((id) => !before.includes(id))!; // someone not tagged yet (the seed's group photos differ)
    const r = run(s, 'photo.retag', { photoId: p.id, memberIds: [...before, add] }, 's5');
    expect(r.state.photos[p.id].memberIds).toEqual([...before, add]);
    const ns = note(r.state, 'activity.notif.newPhoto').filter((x) => x.createdAt === '2026-10-21T10:00');
    expect(ns).toHaveLength(1);
    expect(ns[0].memberId).toBe(add);
    const solo = live(s.photos).find((x) => x.kind === 'solo')!;
    const r2 = run(s, 'photo.retag', { photoId: solo.id, memberIds: [...solo.memberIds, 'm2', 'm10'] }, 's9');
    expect(r2.state.photos[solo.id].kind).toBe('group');
    // untag
    const r3 = run(r.state, 'photo.retag', { photoId: p.id, memberIds: before.slice(0, 1) }, 's5');
    expect(r3.state.photos[p.id].memberIds).toEqual(before.slice(0, 1));
    fails(s, 'photo.retag', { photoId: p.id, memberIds: before }, 's5', 'err.noChanges');
    fails(s, 'photo.retag', { photoId: p.id, memberIds: [] }, 's5', 'err.invalid');
    fails(s, 'photo.retag', { photoId: p.id, memberIds: ['ghost'] }, 's5', 'err.notFound');
    fails(s, 'photo.retag', { photoId: 'nope', memberIds: ['m2'] }, 's5', 'err.notFound');
    // KC round 6: an activity picture is about the session; it is never tagged with members
    const withAct = produce(s, (d) => { d.photos[p.id].kind = 'activity'; d.photos[p.id].memberIds = []; });
    fails(withAct, 'photo.retag', { photoId: p.id, memberIds: ['m2'] }, 's9', 'err.invalid');
  });

  it('hide keeps the photo for staff but removes it from the family view; restore brings it back', () => {
    const s = fresh();
    const p = photoOf(s, 'm1');
    const fam = (st: ClubState) => Object.keys(projectForFamily(st, 'f1').photos);
    expect(fam(s)).toContain(p.id);
    const h = run(s, 'photo.hide', { photoId: p.id, reason: 'blurry' }, 's9');
    expect(h.state.photos[p.id]).toMatchObject({ visibility: 'hidden', moderated: { by: 's9', reason: 'blurry', at: '2026-10-21T10:00' } });
    expect(fam(h.state)).not.toContain(p.id);
    expect(h.state.photos[p.id].deletedAt).toBeUndefined();
    expect(note(h.state, 'activity.notif.newPhoto').filter((x) => x.createdAt === '2026-10-21T10:00')).toHaveLength(0);
    fails(h.state, 'photo.hide', { photoId: p.id, reason: 'again' }, 's5', 'activity.err.alreadyHidden');
    fails(s, 'photo.hide', { photoId: p.id, reason: '  ' }, 's5', 'err.invalid');
    fails(s, 'photo.restore', { photoId: p.id }, 's5', 'activity.err.notHidden');
    const back = run(h.state, 'photo.restore', { photoId: p.id }, 's5').state;
    expect(back.photos[p.id].visibility).toBe('visible');
    expect(back.photos[p.id].moderated).toBeUndefined();
    expect(fam(back)).toContain(p.id);
  });

  it('remove is a soft delete with a reason, and can be undone with restore', () => {
    const s = fresh();
    const p = photoOf(s, 'm10');
    const r = run(s, 'photo.remove', { photoId: p.id, reason: 'wrong person' }, 's5').state;
    expect(r.photos[p.id]).toMatchObject({ visibility: 'removed', moderated: { by: 's5', reason: 'wrong person' } });
    expect(r.photos[p.id].deletedAt).toBeTruthy();
    expect(live(r.photos).some((x) => x.id === p.id)).toBe(false);
    expect(Object.keys(projectForFamily(r, 'fm10_0').photos)).not.toContain(p.id);
    fails(r, 'photo.hide', { photoId: p.id, reason: 'x' }, 's5', 'err.notFound');
    fails(r, 'photo.retag', { photoId: p.id, memberIds: ['m10'] }, 's5', 'err.notFound');
    const undone = run(r, 'photo.restore', { photoId: p.id }, 's5').state;
    expect(undone.photos[p.id]).toMatchObject({ visibility: 'visible' });
    expect(undone.photos[p.id].deletedAt).toBeUndefined();
  });

  it('only activity and management moderate', () => {
    const s = fresh();
    const p = photoOf(s, 'm2');
    for (const [name, input] of [['photo.hide', { photoId: p.id, reason: 'x' }], ['photo.remove', { photoId: p.id, reason: 'x' }], ['photo.retag', { photoId: p.id, memberIds: ['m2'] }], ['photo.restore', { photoId: p.id }]] as const)
      for (const uid of ['s1', 's8', 's3', 's10', 'f1', 'fm2_0']) fails(s, name, input, uid, 'err.forbidden');
  });
});
