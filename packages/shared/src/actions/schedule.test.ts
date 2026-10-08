import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, dayStatus, sessionsOn, scheduleVersionFor, projectForFamily, live, DomainError, type ClubState } from '../index';
import { DRAFT_ID, builderBase, builderDays, dayInfo, nextMonday, normalizeDays, slotChanged, weekView, weeklyCell, type Days } from '../rules/calendar';
import { nowNext, dayPlan } from '../rules/activity';

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

  it('is permissioned: management only (KC round 6: activity teachers see the schedule but cannot change it)', () => {
    const s = fresh();
    const days = withCell(s, 3, '10:30', ANGKLUNG);
    run(s, 'schedule.saveDraft', { days }, 's9');
    for (const uid of ['s5', 's6', 's1', 's8', 's3', 's10', 'f1']) fails(s, 'schedule.saveDraft', { days }, uid, 'err.forbidden');
    for (const uid of ['s5', 's6']) {
      fails(s, 'schedule.publish', { effectiveFrom: '2026-10-26', days }, uid, 'err.forbidden');
      fails(s, 'activity.upsert', { name: 'Tai chi', roomId: 'room-garden' }, uid, 'err.forbidden');
    }
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

  it('refuses today and the past, an empty draft, and a publish that changes nothing', () => {
    const s0 = fresh();
    const days = withCell(s0, 3, '10:30', ANGKLUNG);
    fails(s0, 'schedule.publish', { effectiveFrom: '2026-10-21', days }, 's9', 'cal.err.futureOnly');
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
    fails(s, 'schedule.changeDay', { date: TODAY, slot: '15:00', cell: MEMORY }, 's9', 'err.invalid');
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

  it('is management only, like the weekly schedule', () => {
    const s = fresh();
    for (const uid of ['s5', 's6', 's1', 's8', 's3', 's10', 'f1']) {
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
