import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, dayStatus, sessionsOn, scheduleVersionFor, projectForFamily, live, DomainError, type ClubState } from '../index';
import { DRAFT_ID, builderBase, builderDays, dayInfo, extraTimeIssue, nextMonday, normalizeDays, pendingVersions, publishedVersions, returnedVersion, slotChanged, suggestExtraTime, weekView, weeklyCell, withPendingDay, type Days } from '../rules/calendar';
import { pendingItems } from '../rules/approvals';
import { nowNext, dayPlan, roundProgress, roundsOf } from '../rules/activity';
import { guestOn } from '../rules/guests';

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
const note = (s: ClubState, kind: string) => live(s.notifications).filter((x) => x.kind === kind);
/** The published week with one cell changed. */
const withCell = (s: ClubState, w: 1 | 2 | 3 | 4 | 5, slot: '10:30' | '13:30', cell: Days[1]['10:30']): Days => {
  const d = builderDays(s);
  d[w][slot] = cell;
  return d;
};
const ANGKLUNG = { activityId: 'act-angklung', staffId: 's6', roomId: 'room-music' };

describe('schedule.saveDraft', () => {
  it('stores a draft (next Monday by default) and leaves the published schedule alone', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.saveDraft', { days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's9');
    const draft = r.state.scheduleVersions[DRAFT_ID];
    expect(draft).toMatchObject({ status: 'draft', effectiveFrom: '2026-10-26', submittedBy: 'staff:s9' });
    expect(draft.days[3]['10:30']).toEqual(ANGKLUNG);
    expect(sessionsOn(r.state, '2026-10-21')[0].cell?.activityId).toBe('act-keroncong');
    expect(builderDays(r.state)[3]['10:30']).toEqual(ANGKLUNG);
    expect(builderBase(r.state)[3]['10:30']?.activityId).toBe('act-keroncong');
    // saving again replaces it; an explicit date sticks
    const r2 = run(r.state, 'schedule.saveDraft', { days: withCell(s0, 4, '13:30', ANGKLUNG), effectiveFrom: '2026-11-04' }, 's9');
    expect(r2.state.scheduleVersions[DRAFT_ID]).toMatchObject({ effectiveFrom: '2026-11-04', createdBy: 'staff:s9', submittedBy: 'staff:s9' });
    expect(Object.values(r2.state.scheduleVersions).filter((v) => v.status === 'draft')).toHaveLength(1);
  });

  it('keeps empty slots (clear this slot) and validates the catalog', () => {
    const s0 = fresh();
    const cleared = run(s0, 'schedule.saveDraft', { days: withCell(s0, 3, '10:30', null) }, 's9').state;
    expect(cleared.scheduleVersions[DRAFT_ID].days[3]['10:30']).toBeNull();
    fails(s0, 'schedule.saveDraft', { days: withCell(s0, 1, '10:30', { ...ANGKLUNG, activityId: 'act-ghost' }) }, 's9', 'cal.err.badActivity');
    fails(s0, 'schedule.saveDraft', { days: withCell(s0, 1, '10:30', { ...ANGKLUNG, roomId: 'room-ghost' }) }, 's9', 'cal.err.badRoom');
    fails(s0, 'schedule.saveDraft', { days: withCell(s0, 1, '10:30', { ...ANGKLUNG, staffId: 's8' }) }, 's9', 'cal.err.badTeacher'); // the nurse does not teach
    fails(s0, 'schedule.saveDraft', { days: { 1: {} } }, 's9', 'err.invalid');
    fails(s0, 'schedule.saveDraft', {}, 's9', 'err.invalid');
  });

  it('teachers come from staff with the activity role, not fixed ids', () => {
    // a new activity teacher can be scheduled once added to staff
    let s = fresh();
    s = { ...s, staff: { ...s.staff, s11: { ...s.staff.s5, id: 's11', name: 'Mira Putri', knownAs: 'Kak Mira' } } };
    const ok = run(s, 'schedule.saveDraft', { days: withCell(s, 2, '10:30', { ...ANGKLUNG, staffId: 's11' }) }, 's9').state;
    expect(ok.scheduleVersions[DRAFT_ID].days[2]['10:30']?.staffId).toBe('s11');
    s = { ...s, staff: { ...s.staff, s11: { ...s.staff.s11, active: false } } };
    fails(s, 'schedule.saveDraft', { days: withCell(s, 2, '10:30', { ...ANGKLUNG, staffId: 's11' }) }, 's9', 'cal.err.inactiveTeacher');
  });

  it('a deactivated activity cannot be newly placed, but stays where it already is', () => {
    let s = step(fresh(), 'activity.upsert', { id: 'act-angklung', name: 'Angklung ensemble', roomId: 'room-music', active: false }, 's9');
    fails(s, 'schedule.saveDraft', { days: withCell(s, 3, '10:30', ANGKLUNG) }, 's9', 'cal.err.inactiveActivity');
    s = step(s, 'activity.upsert', { id: 'act-keroncong', name: 'Keroncong sing-along', roomId: 'room-music', active: false }, 's9');
    run(s, 'schedule.saveDraft', { days: builderDays(s) }, 's9'); // unchanged cells are fine
  });

  it('is permissioned: management and (round 14) the activity team; the catalog stays management only', () => {
    const s = fresh();
    const days = withCell(s, 3, '10:30', ANGKLUNG);
    run(s, 'schedule.saveDraft', { days }, 's9');
    run(s, 'schedule.saveDraft', { days }, 's5');
    for (const uid of ['s1', 's8', 's3', 's10', 'f1']) fails(s, 'schedule.saveDraft', { days }, uid, 'err.forbidden');
    for (const uid of ['s5', 's6']) fails(s, 'activity.upsert', { name: 'Tai chi', roomId: 'room-garden' }, uid, 'err.forbidden');
  });
});

describe('schedule.publish', () => {
  it('publishes a dated version: today and the past keep their schedule', () => {
    const s0 = fresh();
    let s = step(s0, 'schedule.saveDraft', { days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's9');
    const r = run(s, 'schedule.publish', { effectiveFrom: '2026-10-26' }, 's9');
    s = r.state;
    const v = s.scheduleVersions[r.result.versionId as string];
    expect(v).toMatchObject({ status: 'published', effectiveFrom: '2026-10-26', publishedBy: 'staff:s9', publishedAt: '2026-10-21T10:00' });
    expect(s.scheduleVersions[DRAFT_ID]).toBeUndefined();
    expect(sessionsOn(s, '2026-10-21')[0].cell?.activityId).toBe('act-keroncong'); // today unchanged
    expect(sessionsOn(s, '2026-10-19')[0].cell?.activityId).toBe('act-angklung'); // history unchanged (Monday, as before)
    expect(sessionsOn(s, '2026-10-28')[0].cell).toEqual(ANGKLUNG); // next Wednesday follows the new version
    expect(sessionsOn(s, '2026-10-26')[0].cell?.activityId).toBe('act-angklung'); // Monday is unchanged content
    expect(scheduleVersionFor(s, '2026-10-25')?.effectiveFrom).toBe('2024-07-01');
    expect(scheduleVersionFor(s, '2026-10-26')?.id).toBe(v.id);
    expect(builderDays(s)[3]['10:30']).toEqual(ANGKLUNG); // the builder now starts from the new version
  });

  it('defaults to the next Monday and accepts any future date', () => {
    const s0 = fresh();
    const days = withCell(s0, 5, '13:30', { activityId: 'act-memory', staffId: 's5', roomId: 'room-lounge' });
    const a = run(s0, 'schedule.publish', { days }, 's9');
    expect(a.state.scheduleVersions[a.result.versionId as string].effectiveFrom).toBe('2026-10-26');
    const b = run(s0, 'schedule.publish', { effectiveFrom: '2026-11-04', days }, 's9');
    expect(b.result.effectiveFrom).toBe('2026-11-04');
    const c = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-22', days }, 's9'); // tomorrow
    expect(c.result.effectiveFrom).toBe('2026-10-22');
    expect(nextMonday('2026-10-26')).toBe('2026-11-02'); // strictly after
    expect(nextMonday('2027-03-03')).toBe('2027-03-08');
  });

  it('KC round 7: this week’s plan can be edited: a publish takes effect from today, and earlier days keep the version they had', () => {
    const s0 = fresh();
    const days = withCell(s0, 4, '10:30', { activityId: 'act-memory', staffId: 's5', roomId: 'room-lounge' }); // Thursday morning of this week
    const r = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-21', days }, 's9'); // today
    const s = r.state;
    expect(r.result.effectiveFrom).toBe('2026-10-21');
    expect(s.scheduleVersions[r.result.versionId as string]).toMatchObject({ status: 'published', effectiveFrom: '2026-10-21' });
    expect(sessionsOn(s, '2026-10-22')[0].cell?.activityId).toBe('act-memory'); // Thursday, tomorrow: follows the new version
    expect(sessionsOn(s, '2026-10-21')[1].cell?.activityId).toBe('act-batik'); // today's cell was not touched
    expect(scheduleVersionFor(s, '2026-10-20')?.effectiveFrom).toBe('2024-07-01'); // yesterday keeps the version it had
    expect(scheduleVersionFor(s, '2026-10-21')?.id).toBe(r.result.versionId);
    // the week view: the current week is editable (from today), a week that is over is not
    expect(weekView(s, '2026-10-19', clock.today)).toMatchObject({ editable: true });
    expect(weekView(s, '2026-10-12', clock.today)).toMatchObject({ editable: false });
    expect(note(s, 'cal.notif.schedulePublished')).toHaveLength(1);
  });

  it('refuses the past, an empty draft, and a publish that changes nothing', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-20', days }, 's9', 'cal.err.futureOnly'); // yesterday
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-01', days }, 's9', 'cal.err.futureOnly');
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-26' }, 's9', 'cal.err.noDraft');
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days: builderDays(s0) }, 's9', 'err.noChanges');
    fails(s0, 'schedule.publish', { effectiveFrom: 'next monday', days }, 's9', 'err.invalid');
  });

  it('later versions stack: each date uses the latest version in force on it', () => {
    const s0 = fresh();
    let s = step(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's9');
    const second = withCell(s, 3, '10:30', { activityId: 'act-yoga', staffId: 's6', roomId: 'room-garden-room' });
    s = step(s, 'schedule.publish', { effectiveFrom: '2026-11-09', days: second }, 's9');
    expect(sessionsOn(s, '2026-10-28')[0].cell?.activityId).toBe('act-angklung');
    expect(sessionsOn(s, '2026-11-11')[0].cell?.activityId).toBe('act-yoga');
    expect(sessionsOn(s, '2026-10-21')[0].cell?.activityId).toBe('act-keroncong');
    // republishing the second version's days for a date after it changes nothing
    fails(s, 'schedule.publish', { effectiveFrom: '2026-12-01', days: second }, 's9', 'err.noChanges');
  });

  it('tells staff roles and every family with app access', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's9');
    const ns = note(r.state, 'cal.notif.schedulePublished');
    expect(ns).toHaveLength(1);
    expect(ns[0].toRoles).toEqual(expect.arrayContaining(['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt']));
    expect(new Set(ns[0].toUsers)).toEqual(new Set(['f1', 'f2', 'fm2_0', 'fm2_1', 'fm10_0', 'fm20_0']));
    expect(ns[0]).toMatchObject({ params: { date: '26/10/2026' }, link: '/calendar' });
    expect(Object.values(r.state.activity).some((a) => a.key === 'cal.feed.schedulePublished')).toBe(true);
    // the family projection carries the published versions only (the draft stays internal)
    const withDraft = step(r.state, 'schedule.saveDraft', { days: withCell(r.state, 1, '10:30', null) }, 's9');
    expect(Object.values(projectForFamily(withDraft, 'f1').scheduleVersions).every((v) => v.status === 'published')).toBe(true);
  });

  it('clearing a slot never breaks Today: sessions skip empty cells and Now/Next copes with none', () => {
    const s0 = fresh();
    const both = builderDays(s0);
    both[3]['10:30'] = null;
    both[3]['13:30'] = null;
    const s = step(s0, 'schedule.publish', { effectiveFrom: '2026-10-22', days: both }, 's9');
    const wed = '2026-10-28';
    expect(sessionsOn(s, wed).map((x) => x.cell)).toEqual([null, null]);
    expect(dayPlan(s, wed).map((x) => x.kind)).toEqual(['lunch', 'tea']);
    expect(nowNext(s, wed, 600).phase).toBe('none');
    const one = withCell(s0, 3, '10:30', null);
    const s2 = step(s0, 'schedule.publish', { effectiveFrom: '2026-10-22', days: one }, 's9');
    expect(nowNext(s2, wed, 600)).toMatchObject({ phase: 'next', current: { time: '13:30' } });
  });

  it('is permissioned and date-independent', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    for (const uid of ['s1', 's8', 's3', 's10', 'f1']) fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, uid, 'err.forbidden');
    const later = { today: '2027-03-03', nowMin: 600 };
    const r = run(s0, 'schedule.publish', { days }, 's9', later);
    expect(r.result.effectiveFrom).toBe('2027-03-08');
    expect(normalizeDays(undefined)[1]['10:30']).toBeNull();
  });
});

describe('schedule.publish notify toggle and weekly versions', () => {
  it('notify:false publishes the version and the feed line but tells nobody; the default tells everyone', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    const quiet = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days, notify: false }, 's9');
    expect(quiet.state.scheduleVersions[quiet.result.versionId as string].status).toBe('published');
    expect(note(quiet.state, 'cal.notif.schedulePublished')).toHaveLength(0);
    expect(Object.values(quiet.state.activity).some((a) => a.key === 'cal.feed.schedulePublished')).toBe(true);
    expect(note(run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days, notify: true }, 's9').state, 'cal.notif.schedulePublished')).toHaveLength(1);
    expect(note(run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, 's9').state, 'cal.notif.schedulePublished')).toHaveLength(1);
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days, notify: 'no' }, 's9', 'err.invalid');
  });

  it('publishing from a later week’s Monday leaves the weeks before it on their own version', () => {
    const s0 = fresh();
    const s = step(s0, 'schedule.publish', { effectiveFrom: '2026-11-09', days: withCell(s0, 4, '10:30', ANGKLUNG) }, 's9');
    const before = weekView(s, '2026-11-02', clock.today);
    const from = weekView(s, '2026-11-09', clock.today);
    const after = weekView(s, '2026-11-16', clock.today);
    expect(before.versions.map((v) => v.effectiveFrom)).toEqual(['2024-07-01']);
    expect(from.versions.map((v) => v.effectiveFrom)).toEqual(['2026-11-09']);
    expect(after.versions.map((v) => v.effectiveFrom)).toEqual(['2026-11-09']); // a version applies until a newer one starts
    expect(before.base[4]['10:30']?.activityId).not.toBe('act-angklung');
    expect(from.base[4]['10:30']).toEqual(ANGKLUNG);
    expect(after.base[4]['10:30']).toEqual(ANGKLUNG);
  });

  it('a draft saved for a week shows in that week only, and publishing it needs no new input', () => {
    const s0 = fresh();
    const s = step(s0, 'schedule.saveDraft', { days: withCell(s0, 3, '10:30', ANGKLUNG), effectiveFrom: '2026-11-09' }, 's9');
    const here = weekView(s, '2026-11-09', clock.today);
    expect(here.draftHere).toBe(true);
    expect(here.changes).toEqual([{ w: 3, slot: '10:30' }]);
    expect(here.days[3]['10:30']).toEqual(ANGKLUNG);
    const elsewhere = weekView(s, '2026-11-16', clock.today);
    expect(elsewhere.draftHere).toBe(false);
    expect(elsewhere.changes).toEqual([]);
    expect(elsewhere.otherDraft).toEqual({ monday: '2026-11-09', changes: 1 });
    const out = run(s, 'schedule.publish', { effectiveFrom: '2026-11-09' }, 's9');
    expect(out.state.scheduleVersions[out.result.versionId as string].days[3]['10:30']).toEqual(ANGKLUNG);
  });

  it('a cell that an earlier version already had stays valid after its activity is switched off', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    let s = step(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, 's9');
    s = step(s, 'activity.upsert', { id: 'act-angklung', name: 'Angklung ensemble', roomId: 'room-music', active: false }, 's9');
    // an old week is shown, edited elsewhere and saved again: the unchanged Angklung cell is not re-validated
    run(s, 'schedule.saveDraft', { days, effectiveFrom: '2026-11-09' }, 's9');
    fails(s, 'schedule.saveDraft', { days: withCell(s, 4, '10:30', ANGKLUNG), effectiveFrom: '2026-11-09' }, 's9', 'cal.err.inactiveActivity');
  });
});

describe('calendarEvent', () => {
  it('adds a closure: the day is closed (nobody can check in there) and everyone is told', () => {
    const s0 = fresh();
    expect(dayStatus(s0, '2026-10-26').open).toBe(true);
    const r = run(s0, 'calendarEvent.create', { date: '2026-10-26', kind: 'closed', title: 'Water maintenance', titleId: 'Perawatan air' }, 's9');
    const ev = r.state.calendarEvents[r.result.eventId as string];
    expect(ev).toMatchObject({ date: '2026-10-26', kind: 'closed', title: 'Water maintenance', titleId: 'Perawatan air' });
    expect(ev.endDate).toBeUndefined();
    const st = dayStatus(r.state, '2026-10-26');
    expect(st.open).toBe(false);
    expect(st.open === false && st.reason).toBe('closed');
    const ns = note(r.state, 'cal.notif.added_closed');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ params: { date: '26/10/2026' }, link: '/calendar' });
    expect(ns[0].toUsers).toContain('f1');
    expect(ns[0].toRoles).toContain('lobby');
    expect(Object.values(r.state.activity).some((a) => a.key === 'cal.feed.added_closed')).toBe(true);
  });

  it('notify:false changes the calendar and the feed but tells nobody (create, update and delete)', () => {
    const s0 = fresh();
    const c = run(s0, 'calendarEvent.create', { date: '2026-11-10', kind: 'closed', title: 'Deep cleaning', notify: false }, 's9');
    expect(note(c.state, 'cal.notif.added_closed')).toHaveLength(0);
    expect(Object.values(c.state.activity).some((a) => a.key === 'cal.feed.added_closed')).toBe(true);
    expect(dayStatus(c.state, '2026-11-10').open).toBe(false);
    const id = c.result.eventId as string;
    const u = run(c.state, 'calendarEvent.update', { eventId: id, title: 'Deep cleaning day', notify: false }, 's9');
    expect(u.state.calendarEvents[id].title).toBe('Deep cleaning day');
    expect(note(u.state, 'cal.notif.changed_closed')).toHaveLength(0);
    const d = run(u.state, 'calendarEvent.delete', { eventId: id, notify: false }, 's9');
    expect(d.state.calendarEvents[id].deletedAt).toBeTruthy();
    expect(note(d.state, 'cal.notif.removed_closed')).toHaveLength(0);
    // on by default, and explicitly on
    expect(note(run(s0, 'calendarEvent.create', { date: '2026-11-10', kind: 'closed', title: 'x', notify: true }, 's9').state, 'cal.notif.added_closed')).toHaveLength(1);
    expect(note(run(c.state, 'calendarEvent.update', { eventId: id, title: 'y' }, 's9').state, 'cal.notif.changed_closed')).toHaveLength(1);
    expect(note(run(c.state, 'calendarEvent.delete', { eventId: id }, 's9').state, 'cal.notif.removed_closed')).toHaveLength(1);
    fails(s0, 'calendarEvent.create', { date: '2026-11-10', kind: 'closed', title: 'x', notify: 'false' }, 's9', 'err.invalid');
  });

  it('drop-in: closing today stops new check-ins, and nothing else needs cancelling', () => {
    const s0 = fresh();
    const closed = run(s0, 'calendarEvent.create', { date: '2026-10-21', kind: 'closed', title: 'Water cut', titleId: 'Air mati' }, 's9').state;
    expect(dayStatus(closed, '2026-10-21').open).toBe(false);
    fails(closed, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1', 'err.closedDay'); // Oma Lina drops in: not today
    run(s0, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1'); // ... but on an open day she can
    // people who were already checked in keep their visit (and their log); no booking, leave or notice rows exist to touch
    expect(closed.attendance['2026-10-21:m2'].checkIn).toEqual(s0.attendance['2026-10-21:m2'].checkIn);
    expect(Object.keys(closed).filter((k) => k === 'bookings' || k === 'dayNotices')).toEqual([]);
    // reopening (deleting the closure) lets members check in again
    const evId = Object.keys(closed.calendarEvents).find((k) => closed.calendarEvents[k].title === 'Water cut')!;
    const open = run(closed, 'calendarEvent.delete', { eventId: evId }, 's9').state;
    expect(dayStatus(open, '2026-10-21').open).toBe(true);
    run(open, 'attendance.checkIn', { memberId: 'm1', method: 'manual' }, 's1');
  });

  it('holidays can span days; outings keep their times and take the day\u2019s activities away', () => {
    const s0 = fresh();
    const h = run(s0, 'calendarEvent.create', { date: '2026-11-02', endDate: '2026-11-04', kind: 'holiday', title: 'Long weekend' }, 's9').state;
    const id = Object.keys(h.calendarEvents).find((k) => h.calendarEvents[k].title === 'Long weekend')!;
    expect(h.calendarEvents[id].endDate).toBe('2026-11-04');
    expect(dayStatus(h, '2026-11-03').open).toBe(false);
    expect(dayStatus(h, '2026-11-05').open).toBe(true);
    const o = run(s0, 'calendarEvent.create', { date: '2026-10-28', kind: 'outing', title: 'Outing: museum', from: '09:00', to: '14:00' }, 's9');
    expect(o.state.calendarEvents[o.result.eventId as string]).toMatchObject({ kind: 'outing', from: '09:00', to: '14:00' });
    expect(sessionsOn(o.state, '2026-10-28')).toEqual([]); // no activities on an outing day
    // times only mean something for outings
    const c = run(s0, 'calendarEvent.create', { date: '2026-11-10', kind: 'closed', title: 'Closed', from: '09:00', to: '10:00' }, 's9');
    expect(c.state.calendarEvents[c.result.eventId as string].from).toBeUndefined();
  });

  it('validates dates, times and titles', () => {
    const s = fresh();
    const base = { date: '2026-11-10', kind: 'outing', title: 'Trip' };
    fails(s, 'calendarEvent.create', { ...base, date: '2026-10-20' }, 's9', 'cal.err.pastDate');
    fails(s, 'calendarEvent.create', { ...base, endDate: '2026-11-09' }, 's9', 'cal.err.endBeforeStart');
    fails(s, 'calendarEvent.create', { ...base, endDate: '2027-03-10' }, 's9', 'cal.err.rangeTooLong');
    fails(s, 'calendarEvent.create', { ...base, from: '09:00' }, 's9', 'cal.err.timeBoth');
    fails(s, 'calendarEvent.create', { ...base, from: '15:00', to: '09:00' }, 's9', 'cal.err.timeOrder');
    fails(s, 'calendarEvent.create', { ...base, from: '9am', to: '2pm' }, 's9', 'err.invalid');
    fails(s, 'calendarEvent.create', { ...base, title: '   ' }, 's9', 'err.invalid');
    fails(s, 'calendarEvent.create', { ...base, kind: 'party' }, 's9', 'err.invalid');
    run(s, 'calendarEvent.create', { ...base, date: '2026-10-21' }, 's9'); // today is fine (an emergency closure)
  });

  it('edits and deletes events; past events are left alone', () => {
    const s0 = fresh();
    const u = run(s0, 'calendarEvent.update', { eventId: 'ev-closed-1030', title: 'Club closed: first-aid refresher', titleId: null }, 's9');
    expect(u.state.calendarEvents['ev-closed-1030']).toMatchObject({ title: 'Club closed: first-aid refresher', date: '2026-10-30', kind: 'closed' });
    expect(u.state.calendarEvents['ev-closed-1030'].titleId).toBeUndefined();
    const moved = run(s0, 'calendarEvent.update', { eventId: 'ev-outing-1029', date: '2026-10-28', from: '08:00', to: '14:00' }, 's9').state;
    expect(moved.calendarEvents['ev-outing-1029']).toMatchObject({ date: '2026-10-28', from: '08:00', to: '14:00' });
    // an outing turned into a closure drops its times
    const toClosed = run(s0, 'calendarEvent.update', { eventId: 'ev-outing-1029', kind: 'closed', title: 'Closed', from: null, to: null }, 's9').state;
    expect(toClosed.calendarEvents['ev-outing-1029'].from).toBeUndefined();
    expect(note(toClosed, 'cal.notif.changed_closed')).toHaveLength(1);
    fails(s0, 'calendarEvent.update', { eventId: 'ev-outing-1029', date: '2026-10-01' }, 's9', 'cal.err.pastDate');
    fails(s0, 'calendarEvent.update', { eventId: 'nope', title: 'x' }, 's9', 'err.notFound');
    const d = run(s0, 'calendarEvent.delete', { eventId: 'ev-closed-1030' }, 's9').state;
    expect(d.calendarEvents['ev-closed-1030'].deletedAt).toBeTruthy();
    expect(dayStatus(d, '2026-10-30').open).toBe(true);
    expect(note(d, 'cal.notif.removed_closed')).toHaveLength(1);
    fails(d, 'calendarEvent.delete', { eventId: 'ev-closed-1030' }, 's9', 'err.notFound');
    // an event whose last day has passed cannot be changed
    const later = { today: '2026-11-02', nowMin: 600 };
    fails(s0, 'calendarEvent.update', { eventId: 'ev-closed-1030', title: 'x' }, 's9', 'cal.err.pastEvent', later);
    fails(s0, 'calendarEvent.delete', { eventId: 'ev-closed-1030' }, 's9', 'cal.err.pastEvent', later);
  });

  it('a multi-day event that has started can still be edited (end it early)', () => {
    const s = step(fresh(), 'calendarEvent.create', { date: '2026-10-22', endDate: '2026-10-28', kind: 'closed', title: 'Renovation' }, 's9');
    const id = Object.keys(s.calendarEvents).find((k) => s.calendarEvents[k].title === 'Renovation')!;
    const mid = { today: '2026-10-26', nowMin: 600 };
    const r = run(s, 'calendarEvent.update', { eventId: id, endDate: '2026-10-27' }, 's9', mid);
    expect(r.state.calendarEvents[id]).toMatchObject({ date: '2026-10-22', endDate: '2026-10-27' });
  });

  it('management only', () => {
    const s = fresh();
    const input = { date: '2026-11-10', kind: 'closed', title: 'x' };
    for (const uid of ['s5', 's1', 's8', 's3', 's10', 'f1']) {
      fails(s, 'calendarEvent.create', input, uid, 'err.forbidden');
      fails(s, 'calendarEvent.update', { eventId: 'ev-closed-1030', title: 'x' }, uid, 'err.forbidden');
      fails(s, 'calendarEvent.delete', { eventId: 'ev-closed-1030' }, uid, 'err.forbidden');
    }
  });

  it('any month: events work in other months and years', () => {
    const clk = { today: '2027-06-10', nowMin: 600 };
    const r = run(fresh(), 'calendarEvent.create', { date: '2027-06-17', kind: 'holiday', title: 'Eid' }, 's9', clk);
    expect(dayStatus(r.state, '2027-06-17')).toMatchObject({ open: false, reason: 'holiday' });
    expect(note(r.state, 'cal.notif.added_holiday')[0].params.date).toBe('17/06/2027');
  });
});

describe('activity.upsert and room.upsert', () => {
  it('an activity has a picture (KC round 6): management sets it with the activity, changes it, and null removes it', () => {
    const s0 = fresh();
    const r = run(s0, 'activity.upsert', { name: 'Tai chi', roomId: 'room-garden', photoMediaId: 'md_taichi0001' }, 's9');
    const id = r.result.activityId as string;
    expect(r.state.activities[id].photoMediaId).toBe('md_taichi0001');
    const s1 = step(r.state, 'activity.upsert', { id, name: 'Tai chi', roomId: 'room-garden', photoMediaId: 'md_taichi0002' }, 's9');
    expect(s1.activities[id].photoMediaId).toBe('md_taichi0002');
    const s2 = step(s1, 'activity.upsert', { id, name: 'Tai chi', roomId: 'room-garden' }, 's9'); // not given: unchanged
    expect(s2.activities[id].photoMediaId).toBe('md_taichi0002');
    const s3 = step(s2, 'activity.upsert', { id, name: 'Tai chi', roomId: 'room-garden', photoMediaId: null }, 's9');
    expect(s3.activities[id].photoMediaId).toBeUndefined();
    fails(s0, 'activity.upsert', { name: 'Yoga', roomId: 'room-garden', photoMediaId: 'not-a-media-id' }, 's9', 'err.invalid');
  });

  it('adds and edits activities (name, Indonesian name, icon, room, active)', () => {
    const s0 = fresh();
    const r = run(s0, 'activity.upsert', { name: 'Tai chi', nameId: 'Tai chi pagi', icon: 'self_improvement', roomId: 'room-garden' }, 's9');
    const a = r.state.activities[r.result.activityId as string];
    expect(a).toMatchObject({ name: 'Tai chi', nameId: 'Tai chi pagi', icon: 'self_improvement', roomId: 'room-garden', active: true });
    const e = run(r.state, 'activity.upsert', { id: a.id, name: 'Tai chi in the garden', nameId: null, roomId: 'room-garden-room', active: false }, 's9').state.activities[a.id];
    expect(e).toMatchObject({ name: 'Tai chi in the garden', roomId: 'room-garden-room', active: false, icon: 'self_improvement' });
    expect(e.nameId).toBeUndefined();
    // defaults
    const d = run(s0, 'activity.upsert', { name: 'Origami', roomId: 'room-lounge' }, 's9');
    expect(d.state.activities[d.result.activityId as string]).toMatchObject({ icon: 'interests', active: true });
  });

  it('rejects duplicates, unknown rooms and bad input', () => {
    const s = fresh();
    fails(s, 'activity.upsert', { name: ' angklung ENSEMBLE ', roomId: 'room-music' }, 's9', 'cal.err.dupName');
    fails(s, 'activity.upsert', { name: 'Origami', roomId: 'room-ghost' }, 's9', 'cal.err.badRoom');
    fails(s, 'activity.upsert', { id: 'act-ghost', name: 'Origami', roomId: 'room-lounge' }, 's9', 'err.notFound');
    fails(s, 'activity.upsert', { name: '', roomId: 'room-lounge' }, 's9', 'err.invalid');
    fails(s, 'activity.upsert', { name: 'Origami', roomId: 'room-lounge', icon: 'Not An Icon' }, 's9', 'err.invalid');
    run(s, 'activity.upsert', { id: 'act-batik', name: 'Batik painting', roomId: 'room-studio' }, 's9'); // keeping its own name is fine
  });

  it('room "Other": a room typed as free text is added to the catalog, or an existing one with that name is reused', () => {
    const s0 = fresh();
    const r = run(s0, 'activity.upsert', { name: 'Tai chi', roomOther: 'Terrace' }, 's9');
    const a = r.state.activities[r.result.activityId as string];
    const room = r.state.rooms[a.roomId];
    expect(room).toMatchObject({ name: 'Terrace', venue: false, createdBy: 'staff:s9' });
    expect(r.result).toMatchObject({ roomId: room.id, roomCreated: true });
    // the same text again (any case, or the Indonesian name) reuses it
    const again = run(r.state, 'activity.upsert', { name: 'Stretching', roomOther: ' terrace ' }, 's9');
    expect(again.state.activities[again.result.activityId as string].roomId).toBe(room.id);
    expect(Object.values(again.state.rooms).filter((x) => x.name === 'Terrace')).toHaveLength(1);
    expect(again.result.roomCreated).toBeUndefined();
    const lounge = run(s0, 'activity.upsert', { name: 'Origami', roomOther: 'LOUNGE' }, 's9');
    expect(lounge.state.activities[lounge.result.activityId as string].roomId).toBe('room-lounge');
    // an edit can move an activity into a typed room
    const moved = run(s0, 'activity.upsert', { id: 'act-batik', name: 'Batik painting', roomOther: 'Courtyard' }, 's9');
    expect(moved.state.rooms[moved.state.activities['act-batik'].roomId].name).toBe('Courtyard');
    // one of the two is needed; a duplicate name still fails before anything is created
    fails(s0, 'activity.upsert', { name: 'Tai chi' }, 's9', 'err.invalid');
    fails(s0, 'activity.upsert', { name: 'Tai chi', roomOther: '   ' }, 's9', 'err.invalid');
    fails(s0, 'activity.upsert', { name: 'Angklung ensemble', roomOther: 'Terrace' }, 's9', 'cal.err.dupName');
  });

  it('rooms: management only; activities: activity teachers too', () => {
    const s = fresh();
    const r = run(s, 'room.upsert', { name: 'Terrace', nameId: 'Teras', venue: true }, 's9');
    expect(r.state.rooms[r.result.roomId as string]).toMatchObject({ name: 'Terrace', nameId: 'Teras', venue: true });
    const e = run(r.state, 'room.upsert', { id: r.result.roomId as string, name: 'Sun terrace', nameId: null, venue: false }, 's9').state.rooms[r.result.roomId as string];
    expect(e).toMatchObject({ name: 'Sun terrace', venue: false });
    expect(e.nameId).toBeUndefined();
    fails(s, 'room.upsert', { name: 'Terrace' }, 's5', 'err.forbidden');
    fails(s, 'room.upsert', { name: 'Terrace' }, 's1', 'err.forbidden');
    fails(s, 'room.upsert', { name: 'lounge' }, 's9', 'cal.err.dupName');
    fails(s, 'room.upsert', { id: 'room-ghost', name: 'X' }, 's9', 'err.notFound');
    for (const uid of ['s1', 's8', 's3', 's10', 'f1']) fails(s, 'activity.upsert', { name: 'Origami', roomId: 'room-lounge' }, uid, 'err.forbidden');
  });
});

// KC round 7: "activity can be changed for this week including today, there might be sudden changes in each day"
describe('schedule.changeDay (one day only)', () => {
  const MEMORY = { activityId: 'act-memory', staffId: 's5', roomId: 'room-lounge' };
  const BATIK = { activityId: 'act-batik', staffId: 's6', roomId: 'room-studio' }; // Wednesday 13:30 in the weekly plan
  const TODAY = '2026-10-21';
  const FAMILIES = ['f1', 'f2', 'fm2_0', 'fm2_1', 'fm10_0', 'fm20_0'];

  it('changes today for that day only: the weekly plan and other days stay, teachers and families are told', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY, note: 'Kak Dimas is off sick' }, 's9');
    const s = r.state;
    expect(sessionsOn(s, TODAY)[1].cell).toEqual(MEMORY);
    expect(sessionsOn(s, TODAY)[0].cell?.activityId).toBe('act-keroncong'); // 10:30 untouched
    expect(sessionsOn(s, '2026-10-28')[1].cell?.activityId).toBe('act-batik'); // next Wednesday follows the weekly plan
    expect(weeklyCell(s, TODAY, '13:30')).toEqual(BATIK);
    expect(s.scheduleDays[TODAY]).toMatchObject({ date: TODAY, note: 'Kak Dimas is off sick', slots: { '13:30': MEMORY } });
    expect(slotChanged(s, TODAY, '13:30')).toBe(true);
    expect(slotChanged(s, TODAY, '10:30')).toBe(false);
    // Today (the teacher's hero) and the calendar follow it; staff see "Changed" and the note, families only the new session
    expect(nowNext(s, TODAY, 600).later.some((x) => x.kind === 'session' && x.activity?.id === 'act-memory')).toBe(true);
    const staff = dayInfo(s, TODAY, 'staff').items.find((i) => i.time === '13:30')!;
    expect(staff).toMatchObject({ activityId: 'act-memory', changed: true, note: 'Kak Dimas is off sick' });
    const fam = dayInfo(s, TODAY, 'family').items.find((i) => i.time === '13:30')!;
    expect(fam.activityId).toBe('act-memory');
    expect(fam.changed).toBeUndefined();
    expect(fam.note).toBeUndefined();
    const ns = note(s, 'cal.notif.dayChanged');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toRoles: ['activity'], params: { date: TODAY, slot: '13:30', name: 'Memory games' }, link: '/calendar' });
    expect(new Set(ns[0].toUsers)).toEqual(new Set(FAMILIES));
    expect(Object.values(s.activity).some((a) => a.key === 'cal.feed.dayChanged')).toBe(true);
  });

  it('refuses a day that has passed, a closed day and an outing day; changes nothing when nothing changes', () => {
    const s = fresh();
    fails(s, 'schedule.changeDay', { date: '2026-10-20', slot: '10:30', cell: MEMORY }, 's9', 'cal.err.pastDay');
    fails(s, 'schedule.changeDay', { date: '2026-10-24', slot: '10:30', cell: MEMORY }, 's9', 'cal.err.dayClosed'); // Saturday
    fails(s, 'schedule.changeDay', { date: '2026-10-30', slot: '10:30', cell: MEMORY }, 's9', 'cal.err.dayClosed'); // club closed
    fails(s, 'schedule.changeDay', { date: '2026-10-29', slot: '10:30', cell: MEMORY }, 's9', 'cal.err.dayOuting');
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: BATIK }, 's9', 'err.noChanges'); // the weekly plan already runs
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: { ...MEMORY, activityId: 'act-ghost' } }, 's9', 'cal.err.badActivity');
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: { ...MEMORY, staffId: 's8' } }, 's9', 'cal.err.badTeacher'); // the nurse does not teach
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '15:00', cell: MEMORY }, 's9', 'cal.err.badSlot'); // not a session time that day (an extra session is added with schedule.addSession)
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '3pm', cell: MEMORY }, 's9', 'err.invalid');
  });

  it('a cell equal to the weekly plan takes the change away, and a day with nothing changed is deleted', () => {
    let s = step(fresh(), 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY, note: 'Swap' }, 's9');
    s = step(s, 'schedule.changeDay', { date: TODAY, slot: '10:30', cell: null }, 's9'); // no 10:30 session today
    expect(Object.keys(s.scheduleDays[TODAY].slots).sort()).toEqual(['10:30', '13:30']);
    expect(sessionsOn(s, TODAY)[0].cell).toBeNull();
    expect(dayInfo(s, TODAY, 'staff').noSession).toEqual([{ slot: '10:30', changed: true }]);
    expect(dayInfo(s, TODAY, 'family').noSession).toEqual([]);
    s = step(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: BATIK }, 's9'); // same as the weekly plan
    expect(Object.keys(s.scheduleDays[TODAY].slots)).toEqual(['10:30']);
    expect(sessionsOn(s, TODAY)[1].cell).toEqual(BATIK);
    const back = run(s, 'schedule.changeDay', { date: TODAY, slot: '10:30', cell: { activityId: 'act-keroncong', staffId: 's5', roomId: 'room-music' } }, 's9');
    expect(back.state.scheduleDays[TODAY]).toBeUndefined(); // empty overrides are deleted
    expect(note(back.state, 'cal.notif.dayBack')).toHaveLength(2); // one for each slot that went back to the plan
  });

  it('"tell" is a toggle: off still changes the day and leaves a feed entry, but nobody is notified', () => {
    const r = run(fresh(), 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY, notify: false }, 's9');
    expect(sessionsOn(r.state, TODAY)[1].cell).toEqual(MEMORY);
    expect(note(r.state, 'cal.notif.dayChanged')).toHaveLength(0);
    expect(Object.values(r.state.activity).some((a) => a.key === 'cal.feed.dayChanged')).toBe(true);
  });

  it('is for management and the activity team, like the weekly schedule', () => {
    const s = fresh();
    for (const uid of ['s1', 's8', 's3', 's10', 'f1']) {
      fails(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, uid, 'err.forbidden');
      fails(s, 'schedule.resetDay', { date: '2026-10-23' }, uid, 'err.forbidden');
    }
  });

  it('schedule.resetDay puts one slot or the whole day back to the weekly plan', () => {
    let s = step(fresh(), 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's9');
    s = step(s, 'schedule.changeDay', { date: TODAY, slot: '10:30', cell: MEMORY }, 's9');
    const one = run(s, 'schedule.resetDay', { date: TODAY, slot: '13:30' }, 's9');
    expect(Object.keys(one.state.scheduleDays[TODAY].slots)).toEqual(['10:30']);
    expect(note(one.state, 'cal.notif.dayBack')).toHaveLength(1);
    const all = run(s, 'schedule.resetDay', { date: TODAY, notify: false }, 's9').state;
    expect(all.scheduleDays[TODAY]).toBeUndefined();
    expect(sessionsOn(all, TODAY).map((x) => x.cell?.activityId)).toEqual(['act-keroncong', 'act-batik']);
    expect(note(all, 'cal.notif.dayBackAll')).toHaveLength(0);
    fails(all, 'schedule.resetDay', { date: TODAY }, 's9', 'err.noChanges');
    fails(one.state, 'schedule.resetDay', { date: TODAY, slot: '13:30' }, 's9', 'err.noChanges');
    fails(s, 'schedule.resetDay', { date: '2026-10-20' }, 's9', 'cal.err.pastDay');
  });

  it('the demo seed has one sudden change (the teacher is off sick, Karaoke instead) on an open day after today', () => {
    const s = fresh();
    const days = Object.values(s.scheduleDays).filter((d) => d.date > TODAY);
    const sick = days.find((d) => d.note);
    expect(sick).toMatchObject({ date: '2026-10-23', slots: { '13:30': { activityId: 'act-karaoke' } }, note: 'Kak Dimas is off sick' });
    expect(sessionsOn(s, '2026-10-23')[1].cell?.activityId).toBe('act-karaoke');
  });
});

// KC round 7: "add an extra activity session at any time" (one date, beside the two weekly sessions)
describe('extra sessions: schedule.addSession / editSession / removeSession', () => {
  const TODAY = '2026-10-21'; // Wednesday, 10:00
  const KARAOKE = { activityId: 'act-karaoke', staffId: 's6', roomId: 'room-music' };
  const MEMORY = { activityId: 'act-memory', staffId: 's5', roomId: 'room-lounge' };
  const FAMILIES = ['f1', 'f2', 'fm2_0', 'fm2_1', 'fm10_0', 'fm20_0'];
  const add = (s: ClubState, o: Record<string, unknown> = {}) => run(s, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE, ...o }, 's9');

  it('adds a session at any time of today: the day lists it in time order, teachers and families are told, the weekly plan stays', () => {
    const r = add(fresh(), { note: 'Birthday sing-along' });
    const s = r.state;
    expect(r.result).toMatchObject({ date: TODAY, time: '15:00' });
    expect(s.scheduleDays[TODAY]).toMatchObject({ date: TODAY, slots: {}, extra: [{ time: '15:00', cell: KARAOKE, note: 'Birthday sing-along' }] });
    expect(sessionsOn(s, TODAY).map((x) => `${x.slot}${x.extra ? '*' : ''}:${x.cell?.activityId}`)).toEqual(['10:30:act-keroncong', '13:30:act-batik', '15:00*:act-karaoke']);
    expect(weeklyCell(s, TODAY, '15:00')).toBeNull(); // an extra is not in the weekly plan
    expect(slotChanged(s, TODAY, '15:00')).toBe(false);
    const early = add(s, { time: '09:00', ...MEMORY }).state; // before the first weekly session
    expect(sessionsOn(early, TODAY).map((x) => x.slot)).toEqual(['09:00', '10:30', '13:30', '15:00']);
    expect(dayPlan(early, TODAY).filter((x) => x.kind === 'session').map((x) => x.time)).toEqual(['09:00', '10:30', '13:30', '15:00']);
    // the calendar: staff see the "Extra" flag and its note, families see an ordinary session
    expect(dayInfo(s, TODAY, 'staff').items.find((i) => i.time === '15:00')).toMatchObject({ extra: true, note: 'Birthday sing-along', activityId: 'act-karaoke' });
    const fam = dayInfo(s, TODAY, 'family').items.find((i) => i.time === '15:00')!;
    expect(fam.activityId).toBe('act-karaoke');
    expect(fam.extra).toBeUndefined();
    expect(fam.note).toBeUndefined();
    expect(dayInfo(s, TODAY, 'staff').noSession).toEqual([]);
    expect(projectForFamily(s, 'f1').scheduleDays[TODAY].extra).toEqual([{ time: '15:00', cell: KARAOKE }]); // the family's copy has no note
    const ns = note(s, 'cal.notif.extraAdded');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ toRoles: ['activity'], params: { date: TODAY, time: '15:00', name: 'Karaoke' }, link: '/calendar' });
    expect(new Set(ns[0].toUsers)).toEqual(new Set(FAMILIES));
    expect(Object.values(s.activity).some((a) => a.key === 'cal.feed.extraAdded')).toBe(true);
    // "tell" off: the session is added, the feed has it, nobody is notified
    expect(note(add(fresh(), { notify: false }).state, 'cal.notif.extraAdded')).toHaveLength(0);
    // a weekly one-day change on the same day keeps the extra
    const both = step(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's9');
    expect(both.scheduleDays[TODAY].extra).toHaveLength(1);
    const reset = step(both, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: { activityId: 'act-batik', staffId: 's6', roomId: 'room-studio' } }, 's9'); // back to the plan
    expect(reset.scheduleDays[TODAY]).toMatchObject({ slots: {}, extra: [{ time: '15:00' }] }); // the row stays for the extra
  });

  it('the demo seed has one extra session: tea-time karaoke at 15:00 on the next open day', () => {
    const s = fresh();
    const x = sessionsOn(s, '2026-10-22').find((e) => e.extra)!;
    expect(x).toMatchObject({ slot: '15:00', cell: { activityId: 'act-karaoke' } });
    expect(sessionsOn(s, '2026-10-22').map((e) => e.slot)).toEqual(['10:30', '13:30', '15:00']);
  });

  it('the time must be within the club’s hours, not a weekly time, and at least 30 minutes from another session', () => {
    const s = fresh();
    fails(s, 'schedule.addSession', { date: TODAY, time: '08:00', ...KARAOKE }, 's9', 'cal.err.sessionHours'); // opens 08:30
    fails(s, 'schedule.addSession', { date: TODAY, time: '16:15', ...KARAOKE }, 's9', 'cal.err.sessionHours'); // the last start is 16:00
    run(s, 'schedule.addSession', { date: TODAY, time: '08:30', ...KARAOKE }, 's9');
    run(s, 'schedule.addSession', { date: TODAY, time: '16:00', ...KARAOKE }, 's9');
    fails(s, 'schedule.addSession', { date: TODAY, time: '10:30', ...KARAOKE }, 's9', 'cal.err.sessionFixedTime');
    fails(s, 'schedule.addSession', { date: TODAY, time: '10:55', ...KARAOKE }, 's9', 'cal.err.sessionClash'); // 25 minutes after the 10:30 session
    fails(s, 'schedule.addSession', { date: TODAY, time: '10:05', ...KARAOKE }, 's9', 'cal.err.sessionClash');
    run(s, 'schedule.addSession', { date: TODAY, time: '11:00', ...KARAOKE }, 's9'); // exactly 30 minutes apart is fine
    run(s, 'schedule.addSession', { date: TODAY, time: '10:00', ...KARAOKE }, 's9');
    const one = add(s).state;
    fails(one, 'schedule.addSession', { date: TODAY, time: '15:20', ...MEMORY }, 's9', 'cal.err.sessionClash'); // another extra
    fails(one, 'schedule.addSession', { date: TODAY, time: '15:00', ...MEMORY }, 's9', 'cal.err.sessionClash');
    run(one, 'schedule.addSession', { date: TODAY, time: '15:30', ...MEMORY }, 's9');
    // a weekly slot with no session does not count as a session (but its time is still the weekly slot's)
    const none = step(s, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: null }, 's9');
    run(none, 'schedule.addSession', { date: TODAY, time: '13:45', ...KARAOKE }, 's9');
    fails(none, 'schedule.addSession', { date: TODAY, time: '13:30', ...KARAOKE }, 's9', 'cal.err.sessionFixedTime');
    expect(extraTimeIssue(s, TODAY, '10:50')).toMatchObject({ code: 'cal.err.sessionClash', params: { time: '10:30' } });
    expect(extraTimeIssue(s, TODAY, '15:00')).toBeNull();
    expect(suggestExtraTime(s, TODAY)).toBe('11:30');
    expect(suggestExtraTime(add(s, { time: '11:30' }).state, TODAY)).toBe('15:00');
  });

  it('only on an open day today or later; a valid activity and an active activity teacher; management and the activity team only', () => {
    const s = fresh();
    fails(s, 'schedule.addSession', { date: '2026-10-20', time: '15:00', ...KARAOKE }, 's9', 'cal.err.pastDay');
    fails(s, 'schedule.addSession', { date: '2026-10-24', time: '15:00', ...KARAOKE }, 's9', 'cal.err.dayClosed'); // Saturday
    fails(s, 'schedule.addSession', { date: '2026-10-30', time: '15:00', ...KARAOKE }, 's9', 'cal.err.dayClosed'); // the club is closed
    fails(s, 'schedule.addSession', { date: '2026-10-29', time: '15:00', ...KARAOKE }, 's9', 'cal.err.dayOuting');
    fails(s, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE, activityId: 'act-ghost' }, 's9', 'cal.err.badActivity');
    fails(s, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE, roomId: 'room-ghost' }, 's9', 'cal.err.badRoom');
    fails(s, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE, staffId: 's8' }, 's9', 'cal.err.badTeacher'); // the nurse does not teach
    fails(s, 'schedule.addSession', { date: TODAY, time: '3pm', ...KARAOKE }, 's9', 'err.invalid');
    const off = step(s, 'activity.upsert', { id: 'act-karaoke', name: 'Karaoke', roomId: 'room-music', active: false }, 's9');
    fails(off, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE }, 's9', 'cal.err.inactiveActivity');
    for (const uid of ['s1', 's8', 's3', 's10', 'f1']) {
      fails(s, 'schedule.addSession', { date: TODAY, time: '15:00', ...KARAOKE }, uid, 'err.forbidden');
      fails(s, 'schedule.editSession', { date: '2026-10-22', time: '15:00', ...KARAOKE }, uid, 'err.forbidden');
      fails(s, 'schedule.removeSession', { date: '2026-10-22', time: '15:00' }, uid, 'err.forbidden');
    }
  });

  it('edits an extra session: its activity, teacher, room, note and time; a note alone tells nobody; nothing changed is refused', () => {
    const s0 = add(fresh()).state;
    const e1 = run(s0, 'schedule.editSession', { date: TODAY, time: '15:00', ...MEMORY }, 's9');
    expect(e1.state.scheduleDays[TODAY].extra).toEqual([{ time: '15:00', cell: MEMORY }]);
    expect(note(e1.state, 'cal.notif.extraChanged')).toHaveLength(1);
    // moving its time (it may overlap its own old time, only other sessions count)
    const e2 = run(s0, 'schedule.editSession', { date: TODAY, time: '15:00', toTime: '15:10', ...KARAOKE }, 's9');
    expect(sessionsOn(e2.state, TODAY).map((x) => x.slot)).toEqual(['10:30', '13:30', '15:10']);
    expect(e2.result.time).toBe('15:10');
    fails(s0, 'schedule.editSession', { date: TODAY, time: '15:00', toTime: '13:50', ...KARAOKE }, 's9', 'cal.err.sessionClash'); // too close to the 13:30 session
    fails(s0, 'schedule.editSession', { date: TODAY, time: '15:00', toTime: '10:30', ...KARAOKE }, 's9', 'cal.err.sessionFixedTime');
    // a note alone: saved quietly (families never see notes)
    const e3 = run(s0, 'schedule.editSession', { date: TODAY, time: '15:00', ...KARAOKE, note: 'Bring the microphone' }, 's9');
    expect(e3.state.scheduleDays[TODAY].extra![0].note).toBe('Bring the microphone');
    expect(note(e3.state, 'cal.notif.extraChanged')).toHaveLength(0);
    fails(s0, 'schedule.editSession', { date: TODAY, time: '15:00', ...KARAOKE }, 's9', 'err.noChanges');
    fails(s0, 'schedule.editSession', { date: TODAY, time: '14:00', ...KARAOKE }, 's9', 'err.notFound'); // no extra at 14:00
    fails(s0, 'schedule.editSession', { date: TODAY, time: '10:30', ...KARAOKE }, 's9', 'err.notFound'); // a weekly session is edited with schedule.changeDay
    expect(note(run(s0, 'schedule.editSession', { date: TODAY, time: '15:00', ...MEMORY, notify: false }, 's9').state, 'cal.notif.extraChanged')).toHaveLength(0);
  });

  it('removes an extra session: the date goes back to the plan, teachers and families are told', () => {
    const s0 = add(fresh()).state;
    const r = run(s0, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9');
    expect(r.state.scheduleDays[TODAY]).toBeUndefined();
    expect(sessionsOn(r.state, TODAY).map((x) => x.slot)).toEqual(['10:30', '13:30']);
    const ns = note(r.state, 'cal.notif.extraRemoved');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ params: { date: TODAY, time: '15:00', name: 'Karaoke' } });
    // a day that also has a one-day change keeps its row; one extra of two leaves the other
    const two = add(step(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's9'), { time: '09:00' }).state;
    const one = step(two, 'schedule.removeSession', { date: TODAY, time: '09:00', notify: false }, 's9');
    expect(one.scheduleDays[TODAY]).toMatchObject({ slots: { '13:30': MEMORY }, extra: [{ time: '15:00' }] });
    const none = step(one, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9');
    expect(none.scheduleDays[TODAY].extra).toBeUndefined();
    expect(none.scheduleDays[TODAY].slots).toEqual({ '13:30': MEMORY });
    fails(none, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9', 'err.notFound');
    fails(s0, 'schedule.removeSession', { date: '2026-10-20', time: '15:00' }, 's9', 'cal.err.pastDay');
  });

  it('a round of the daily log for the extra session: people are marked in it, it counts in the progress, and it cannot move or go while marked', () => {
    const s0 = add(fresh()).state;
    expect(roundsOf(s0, TODAY).map((r) => `${r.id}:${r.kind}`)).toEqual(['morning:morning', '10:30:session', '13:30:session', '15:00:session']);
    const m = run(s0, 'log.mark', { date: TODAY, memberIds: ['m2', 'm10'], session: { slot: '15:00', value: 'joined' } }, 's5');
    expect(m.state.dailyLogs[`log-m2-${TODAY}`].sessions).toEqual({ '15:00': 'joined' });
    expect(m.state.dailyLogs[`log-m2-${TODAY}`].joined).toBe('yes');
    expect(roundProgress(m.state, TODAY, '15:00')).toMatchObject({ marked: 2, total: 3 });
    expect(roundProgress(m.state, TODAY, '10:30').marked).toBe(0); // its own marks, not the other sessions’
    const out = step(m.state, 'log.mark', { date: TODAY, memberIds: ['m2'], session: { slot: '15:00', value: 'satOut' } }, 's5');
    expect(out.dailyLogs[`log-m2-${TODAY}`].sessions).toEqual({ '15:00': 'satOut' });
    fails(m.state, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9', 'cal.err.sessionMarked');
    fails(m.state, 'schedule.editSession', { date: TODAY, time: '15:00', toTime: '15:30', ...KARAOKE }, 's9', 'cal.err.sessionMarked');
    run(m.state, 'schedule.editSession', { date: TODAY, time: '15:00', ...MEMORY }, 's9'); // the activity can still change
    // clear the marks and it can go
    let clear = step(m.state, 'log.mark', { date: TODAY, memberIds: ['m2', 'm10'], session: { slot: '15:00', value: null } }, 's5');
    clear = step(clear, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9');
    expect(sessionsOn(clear, TODAY)).toHaveLength(2);
    fails(clear, 'log.mark', { date: TODAY, memberIds: ['m2'], session: { slot: '15:00', value: 'joined' } }, 's5', 'activity.err.noSession'); // no such round any more
  });

  it('a guest host can lead an extra session; it cannot move or go while a guest is booked', () => {
    const s0 = add(fresh()).state;
    const b = run(s0, 'guest.book', { hostId: 'gh-ratna', date: TODAY, slot: '15:00' }, 's9'); // follows the extra's own activity
    expect(guestOn(b.state, TODAY, '15:00')?.host.id).toBe('gh-ratna');
    expect(b.state.guestSessions[b.result.sessionId as string]).toMatchObject({ slot: '15:00', activityId: 'act-karaoke' });
    expect(dayInfo(b.state, TODAY, 'staff').items.find((i) => i.time === '15:00')?.guest?.name).toBe('Bu Ratna');
    fails(b.state, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9', 'cal.err.sessionGuest');
    fails(b.state, 'schedule.editSession', { date: TODAY, time: '15:00', toTime: '15:30', ...KARAOKE }, 's9', 'cal.err.sessionGuest');
    // the guest teaches something else: the extra follows (an extra has no weekly plan to go back to)
    const other = run(s0, 'guest.book', { hostId: 'gh-ratna', date: TODAY, slot: '15:00', activityId: 'act-angklung' }, 's9').state;
    expect(sessionsOn(other, TODAY).find((x) => x.slot === '15:00')?.cell?.activityId).toBe('act-angklung');
    // cancelling the booking leaves the extra as it is, and it can be removed again
    const cancelled = step(b.state, 'guest.cancel', { id: b.result.sessionId }, 's9');
    expect(sessionsOn(cancelled, TODAY).find((x) => x.slot === '15:00')?.cell?.activityId).toBe('act-karaoke');
    step(cancelled, 'schedule.removeSession', { date: TODAY, time: '15:00' }, 's9');
    // a time with no session is not bookable
    fails(s0, 'guest.book', { hostId: 'gh-ratna', date: TODAY, slot: '09:00', activityId: 'act-karaoke' }, 's9', 'cal.err.badSlot');
  });
});

// round 14 (B1): the activity team builds the programme; every change it makes waits for Ega (management). Ruling 6: a day's edit waits in `pending`
// beside the live fields, which every rule keeps reading; Review Focus 5: an edit back to the live day clears it, an approval after the start date publishes from today.
describe('round 14: every programme change by the activity team waits for Ega', () => {
  const TODAY = '2026-10-21';
  const MEMORY = { activityId: 'act-memory', staffId: 's5', roomId: 'room-lounge' };
  const BATIK = { activityId: 'act-batik', staffId: 's6', roomId: 'room-studio' }; // Wednesday 13:30 in the weekly plan
  const KARAOKE = { activityId: 'act-karaoke', staffId: 's6', roomId: 'room-music' };
  const FAMILIES = ['f1', 'f2', 'fm2_0', 'fm2_1', 'fm10_0', 'fm20_0'];

  it('an s5 publish stores a pending version for Ega: management is told, families are not, and it is not in force', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's5');
    const id = r.result.versionId as string;
    expect(r.state.scheduleVersions[id]).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-26', submittedBy: 'staff:s5' });
    expect(r.state.scheduleVersions[id].publishedAt).toBeUndefined();
    expect(r.result.pending).toBe(true);
    expect(r.state.scheduleVersions[DRAFT_ID]).toBeUndefined();
    expect(publishedVersions(r.state).map((v) => v.id)).not.toContain(id);
    expect(pendingVersions(r.state).map((v) => v.id)).toEqual([id]);
    expect(sessionsOn(r.state, '2026-10-28')[0].cell?.activityId).toBe('act-keroncong'); // the published plan still runs
    const asked = note(r.state, 'cal.notif.programmeAsked');
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ toRoles: ['mgmt'], toUsers: [], params: { date: '26/10/2026' } });
    expect(note(r.state, 'cal.notif.schedulePublished')).toHaveLength(0);
    expect(projectForFamily(r.state, 'f1').scheduleVersions[id]).toBeUndefined();
    expect(pendingItems(r.state, 'programme')).toEqual([expect.objectContaining({ id, type: 'programme', sub: 'version', by: 'staff:s5' })]);
  });

  it('Ega approves a version: it is published (from today once its start date has passed) and everyone is told', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-22', days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's5');
    const id = r.result.versionId as string;
    const onTime = run(r.state, 'approval.approve', { type: 'programme', ids: [id] }, 's9');
    expect(onTime.result.approved).toBe(1);
    expect(onTime.state.scheduleVersions[id]).toMatchObject({ status: 'published', effectiveFrom: '2026-10-22', publishedBy: 'staff:s9', publishedAt: '2026-10-21T10:00', submittedBy: 'staff:s5' });
    expect(sessionsOn(onTime.state, '2026-10-28')[0].cell).toEqual(ANGKLUNG);
    const ns = note(onTime.state, 'cal.notif.schedulePublished');
    expect(ns).toHaveLength(1);
    expect(new Set(ns[0].toUsers)).toEqual(new Set(FAMILIES));
    expect(pendingItems(onTime.state, 'programme')).toEqual([]);
    // Review Focus 5: approved after its start date, it publishes from today
    const late = run(r.state, 'approval.approve', { type: 'programme', ids: [id] }, 's9', { today: '2026-10-26', nowMin: 600 });
    expect(late.state.scheduleVersions[id]).toMatchObject({ status: 'published', effectiveFrom: '2026-10-26' });
    expect(scheduleVersionFor(late.state, '2026-10-23')?.effectiveFrom).toBe('2024-07-01'); // the days that passed keep their plan
    // handled once
    expect(run(onTime.state, 'approval.approve', { type: 'programme', ids: [id] }, 's9').result.skipped).toEqual([id]);
  });

  it('Ega returns a version: rejected with the note, the teacher is told, and it can be loaded back into the draft', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    const r = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, 's5');
    const id = r.result.versionId as string;
    const j = run(r.state, 'approval.reject', { type: 'programme', ids: [id], reason: 'Keep Keroncong on Wednesday' }, 's9');
    expect(j.state.scheduleVersions[id]).toMatchObject({ status: 'rejected', rejectNote: 'Keep Keroncong on Wednesday' });
    expect(publishedVersions(j.state).map((v) => v.id)).not.toContain(id);
    expect(pendingItems(j.state, 'programme')).toEqual([]);
    expect(returnedVersion(j.state)?.id).toBe(id);
    const told = note(j.state, 'approvals.notif.rejected.programme');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ toUsers: ['s5'], link: '/calendar', params: { n: 1, reason: 'Keep Keroncong on Wednesday' } });
    // "Edit" loads it into the draft; sending it again replaces the returned one
    const again = step(j.state, 'schedule.saveDraft', { days, effectiveFrom: '2026-10-26' }, 's5');
    expect(builderDays(again)[3]['10:30']).toEqual(ANGKLUNG);
    const sent = step(again, 'schedule.publish', { effectiveFrom: '2026-10-26' }, 's5');
    expect(returnedVersion(sent)).toBeUndefined();
  });

  it('an s5 day change waits in `pending`: the live day, the calendar and families are untouched until Ega approves; a return leaves her note', () => {
    const s0 = fresh();
    const r = run(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY, note: 'Kak Dimas is off sick' }, 's5');
    expect(r.result.pending).toBe(true);
    expect(r.state.scheduleDays[TODAY]).toMatchObject({ slots: {}, pending: { slots: { '13:30': MEMORY }, note: 'Kak Dimas is off sick', by: 'staff:s5', at: '2026-10-21T10:00' } });
    expect(sessionsOn(r.state, TODAY)[1].cell).toEqual(BATIK);
    expect(dayInfo(r.state, TODAY, 'staff').items.find((i) => i.time === '13:30')?.activityId).toBe('act-batik');
    expect(withPendingDay(r.state, TODAY).scheduleDays[TODAY].slots).toEqual({ '13:30': MEMORY });
    expect(projectForFamily(r.state, 'f1').scheduleDays[TODAY]).not.toHaveProperty('pending');
    expect(note(r.state, 'cal.notif.dayChanged')).toHaveLength(0);
    expect(note(r.state, 'cal.notif.dayAsked')).toEqual([expect.objectContaining({ toRoles: ['mgmt'], params: { date: TODAY } })]);
    // a second edit builds on the first; management was told once
    const s = step(r.state, 'schedule.changeDay', { date: TODAY, slot: '10:30', cell: null }, 's5');
    expect(s.scheduleDays[TODAY].pending?.slots).toEqual({ '10:30': null, '13:30': MEMORY });
    expect(note(s, 'cal.notif.dayAsked')).toHaveLength(1);
    expect(pendingItems(s, 'programme')).toEqual([expect.objectContaining({ id: TODAY, sub: 'day', by: 'staff:s5' })]);
    // approve: merged into the live day, teachers and families are told
    const a = run(s, 'approval.approve', { type: 'programme', ids: [TODAY] }, 's9');
    expect(a.state.scheduleDays[TODAY]).toMatchObject({ slots: { '10:30': null, '13:30': MEMORY }, note: 'Kak Dimas is off sick' });
    expect(a.state.scheduleDays[TODAY].pending).toBeUndefined();
    expect(sessionsOn(a.state, TODAY).map((x) => x.cell)).toEqual([null, MEMORY]);
    const told = note(a.state, 'cal.notif.dayUpdated');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ toRoles: ['activity'], params: { date: TODAY } });
    expect(new Set(told[0].toUsers)).toEqual(new Set(FAMILIES));
    // return: pending goes, Ega's note stays for the teacher, the live day is as it was
    const j = run(s, 'approval.reject', { type: 'programme', ids: [TODAY], reason: 'Kak Dimas is back' }, 's9');
    expect(j.state.scheduleDays[TODAY].pending).toBeUndefined();
    expect(j.state.scheduleDays[TODAY].returned).toEqual({ note: 'Kak Dimas is back', by: 'staff:s9', at: '2026-10-21T10:00' });
    expect(sessionsOn(j.state, TODAY)[1].cell).toEqual(BATIK);
    expect(note(j.state, 'approvals.notif.rejected.programme')).toEqual([expect.objectContaining({ toUsers: ['s5'] })]);
    // her next edit starts a new request and clears the note
    const next = step(j.state, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's5');
    expect(next.scheduleDays[TODAY].returned).toBeUndefined();
    expect(next.scheduleDays[TODAY].pending?.slots).toEqual({ '13:30': MEMORY });
  });

  it('extra sessions and resets wait too; an edit that brings the day back to the live one clears `pending` (Review Focus 5)', () => {
    const s0 = fresh();
    const TOMORROW = '2026-10-22'; // the seed's tea-time karaoke at 15:00
    const added = run(s0, 'schedule.addSession', { date: TOMORROW, time: '11:30', ...MEMORY }, 's5');
    expect(added.result.pending).toBe(true);
    expect(added.state.scheduleDays[TOMORROW].extra?.map((x) => x.time)).toEqual(['15:00']);
    expect(added.state.scheduleDays[TOMORROW].pending?.extra?.map((x) => x.time)).toEqual(['11:30', '15:00']);
    expect(note(added.state, 'cal.notif.extraAdded')).toHaveLength(0);
    const removed = step(added.state, 'schedule.removeSession', { date: TOMORROW, time: '11:30' }, 's5');
    expect(removed.scheduleDays[TOMORROW].pending).toBeUndefined();
    expect(removed.scheduleDays[TOMORROW].extra?.map((x) => x.time)).toEqual(['15:00']);
    expect(pendingItems(removed, 'programme')).toEqual([]);
    // a day with no live change: back to the plan leaves no row at all
    const changed = step(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's5');
    expect(step(changed, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: BATIK }, 's5').scheduleDays[TODAY]).toBeUndefined();
    // a reset of the seed's sick-day change waits; the live change still runs
    const reset = step(s0, 'schedule.resetDay', { date: '2026-10-23' }, 's5');
    expect(reset.scheduleDays['2026-10-23'].pending?.slots).toEqual({});
    expect(sessionsOn(reset, '2026-10-23')[1].cell?.activityId).toBe('act-karaoke');
    expect(note(reset, 'cal.notif.dayBackAll')).toHaveLength(0);
  });

  it('management still changes the programme at once; the lobby is refused; events and the catalog stay management only', () => {
    const s0 = fresh();
    const day = run(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's9');
    expect(day.result.pending).toBeUndefined();
    expect(day.state.scheduleDays[TODAY]).toMatchObject({ slots: { '13:30': MEMORY } });
    expect(day.state.scheduleDays[TODAY].pending).toBeUndefined();
    const pub = run(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days: withCell(s0, 3, '10:30', ANGKLUNG) }, 's9');
    expect(pub.state.scheduleVersions[pub.result.versionId as string].status).toBe('published');
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    fails(s0, 'schedule.saveDraft', { days }, 's1', 'err.forbidden');
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, 's1', 'err.forbidden');
    fails(s0, 'schedule.changeDay', { date: TODAY, slot: '13:30', cell: MEMORY }, 's1', 'err.forbidden');
    fails(s0, 'schedule.addSession', { date: TODAY, time: '11:30', ...MEMORY }, 's1', 'err.forbidden');
    fails(s0, 'schedule.editSession', { date: '2026-10-22', time: '15:00', ...KARAOKE }, 's1', 'err.forbidden');
    fails(s0, 'schedule.removeSession', { date: '2026-10-22', time: '15:00' }, 's1', 'err.forbidden');
    fails(s0, 'schedule.resetDay', { date: '2026-10-23' }, 's1', 'err.forbidden');
    fails(s0, 'calendarEvent.create', { date: '2026-11-03', kind: 'closed', title: 'Training' }, 's5', 'err.forbidden');
    fails(s0, 'room.upsert', { name: 'Terrace' }, 's5', 'err.forbidden');
    fails(s0, 'approval.approve', { type: 'programme', ids: [TODAY] }, 's5', 'err.forbidden');
  });
});
