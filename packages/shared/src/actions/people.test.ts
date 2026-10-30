import { describe, it, expect } from 'vitest';
import { isMgmt, isOwner, hasRole, roleOf, updatesFor, buildSeed, execute, getUser, findByPhone, live, activeStaff, actionItems, DomainError, type ClubState } from '../index';
import { dutyReminders } from '../rules/tasks';
import { contractState, hoursLabel, minutesBetween, staffList, staffRating, staffTimeFor } from '../rules/mgmt';

const T = '2026-10-21';
const clock = { today: T, nowMin: 10 * 60 + 5 }; // 10:05
let n = 0;
const mid = () => `p${++n}`;
const seed = () => buildSeed().citra;
const user = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid = 's9', clk = clock) => execute(s, name, input, user(s, uid), clk, mid());
const fails = (s: ClubState, name: string, input: unknown, code: string, uid = 's9', clk = clock) => {
  try {
    run(s, name, input, uid, clk);
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const newStaff = { name: 'Wulan Sari', knownAs: 'Bu Wulan', role: 'kitchen', title: 'Kitchen helper', phone: '0811 2201 7788', hr: { contract: 'pkwt', start: '2026-11-01', end: '2027-10-31', salary: 4800000, allowance: 480000, bank: 'BNI', account: '1234 5678 90', ktpLast4: '4411', ktpOnFile: true, signed: true } };

describe('the Owner (round 16)', () => {
  it('Benjamin Cass is seeded as the owner with app access, and counts as management', () => {
    const s = seed();
    expect(s.staff.s11).toMatchObject({ name: 'Benjamin Cass', role: 'owner', appAccess: true, supervisor: true, hr: { salary: 35000000 } });
    expect(isOwner(user(s, 's11'))).toBe(true);
    expect(isOwner(user(s, 's9'))).toBe(false);
    expect(isMgmt(user(s, 's11'))).toBe(true);
    expect(hasRole(user(s, 's11'), 'mgmt')).toBe(true);
    expect(hasRole(user(s, 's11'), 'finance')).toBe(false);
    expect(roleOf(user(s, 's11'))).toBe('owner');
  });
  it('a notification for management is listed for the Owner', () => {
    const s = seed();
    s.notifications['nt-own'] = { id: 'nt-own', clubId: s.clubId, createdAt: `${T}T09:00`, createdBy: 'system', toUsers: [], toRoles: ['mgmt'], kind: 'x', params: {}, severity: 'info', action: false, readBy: [] } as never;
    expect(updatesFor(s, user(s, 's11')).map((n) => n.id)).toContain('nt-own');
  });
  it('management cannot touch the Owner\'s staff row; the Owner edits himself', () => {
    const s = seed();
    fails(s, 'staff.update', { staffId: 's11', hr: { salary: 1 } }, 'err.forbidden', 's9');
    fails(s, 'staff.deactivate', { staffId: 's11' }, 'err.forbidden', 's9');
    fails(s, 'staff.setAppAccess', { staffId: 's11', on: false }, 'err.forbidden', 's9');
    fails(s, 'hrNote.add', { staffId: 's11', kind: 'note', text: 'x' }, 'err.forbidden', 's9');
    fails(s, 'staffTime.upsert', { staffId: 's11', date: T, kind: 'worked', from: '08:00', to: '17:00' }, 'err.forbidden', 's9');
    expect(run(s, 'staff.update', { staffId: 's11', hr: { salary: 36000000 } }, 's11').state.staff.s11.hr.salary).toBe(36000000);
  });
  it('the Owner gets the same duty reminders as management', () => {
    const s = seed();
    const now = 23 * 60;
    const ids = (id: string) => actionItems(s, user(s, id), T, now).map((x) => x.id).sort();
    expect(ids('s11').filter((x) => x !== 'approvals:owner')).toEqual(ids('s9')); // round 16: plus his own owner-approvals item (the seeded staff training day)
    expect(ids('s11')).toContain('approvals:owner');
    // (management's own duties ring no bell today, so this pins the mapping rather than a count)
    for (const r of dutyReminders(s, 'mgmt', T, now)) expect(ids('s11')).toContain(r.id);
  });
  it('only the Owner gives the Owner role', () => {
    const s = seed();
    fails(s, 'staff.update', { staffId: 's1', role: 'owner' }, 'err.forbidden', 's9');
    expect(run(s, 'staff.update', { staffId: 's1', role: 'owner' }, 's11').state.staff.s1.role).toBe('owner');
    fails(s, 'staff.update', { staffId: 's11', role: 'mgmt' }, 'err.forbidden', 's9');
  });
});

describe('staff records', () => {
  it('management adds a staff member with a full record', () => {
    const s = seed();
    const r = run(s, 'staff.create', newStaff);
    const id = r.result.staffId as string;
    expect(id).toBe('s12'); // round 16: s11 is Benjamin Cass, the Owner
    expect(r.state.staff[id]).toMatchObject({
      name: 'Wulan Sari', knownAs: 'Bu Wulan', role: 'kitchen', title: 'Kitchen helper', phone: '+6281122017788', active: true, appAccess: false, supervisor: false, rateable: false, extraClubIds: [], createdBy: 'staff:s9',
      hr: { contract: 'pkwt', start: '2026-11-01', end: '2027-10-31', salary: 4800000, allowance: 480000, bank: 'BNI', account: '1234567890', ktpLast4: '4411', ktpOnFile: true, signed: true },
    });
    expect(activeStaff(r.state).map((x) => x.id)).toContain('s12');
    expect(Object.values(r.state.activity).some((a) => a.key === 'people.feed.added' && a.params.name === 'Wulan Sari')).toBe(true);
    // minimal input gets sensible defaults
    const min = run(s, 'staff.create', { name: 'Budi', role: 'nurse', title: 'Nurse', phone: '+62 811 9000 111', hr: { contract: 'pkwtt' } });
    expect(min.state.staff.s12).toMatchObject({ rateable: true, hr: { contract: 'pkwtt', end: null, start: T, salary: 0, bank: 'BCA', ktpOnFile: false, signed: false } });
    // app access can be switched on when adding
    expect(run(s, 'staff.create', { ...newStaff, appAccess: true }).state.staff.s12.appAccess).toBe(true);
  });
  it('validation: role, phone, contract dates, KTP, unique phone', () => {
    const s = seed();
    fails(s, 'staff.create', { ...newStaff, name: ' ' }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, role: 'ceo' }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, phone: '123' }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, end: null } }, 'people.err.endRequired'); // fixed term needs an end
    fails(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, end: '2026-10-31' } }, 'people.err.endBeforeStart');
    fails(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, ktpLast4: '12' } }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, bank: 'Monzo' } }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, salary: -1 } }, 'err.invalid');
    fails(s, 'staff.create', { ...newStaff, phone: '+62 811-2201-3345' }, 'people.err.phoneTaken'); // Caca's number
    fails(s, 'staff.create', { ...newStaff, phone: '+62 812 1090 4471' }, 'people.err.phoneTaken'); // Maria's number: one login per number
    // a permanent contract has no end date
    expect(run(s, 'staff.create', { ...newStaff, hr: { ...newStaff.hr, contract: 'pkwtt' } }).state.staff.s11.hr.end).toBeNull();
  });
  it('only management may manage staff', () => {
    const s = seed();
    for (const uid of ['s1', 's8', 's10', 's5', 'f1']) {
      expect(() => run(s, 'staff.create', newStaff, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staff.update', { staffId: 's6', name: 'X' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staff.deactivate', { staffId: 's6' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staff.setAppAccess', { staffId: 's6', on: true }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'hrNote.add', { staffId: 's6', kind: 'note', text: 'x' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staffTime.upsert', { staffId: 's6', date: T, kind: 'leave' }, uid)).toThrow('err.forbidden');
    }
  });
  it('edit profile, contract, KTP, pay and bank; know-as can be cleared', () => {
    const s = seed();
    const r = run(s, 'staff.update', { staffId: 's10', title: 'Head of finance', knownAs: null, phone: '0811 2201 9999', rateable: true, hr: { salary: 5200000, bank: 'Mandiri', account: '9988 7766 55', ktpLast4: '0042', ktpOnFile: true, end: '2027-03-31', signed: true } });
    const st = r.state.staff.s10;
    expect(st).toMatchObject({ title: 'Head of finance', phone: '+6281122019999', rateable: true, name: 'Fransiska Tan' });
    expect(st.knownAs).toBeUndefined();
    expect(st.hr).toMatchObject({ salary: 5200000, bank: 'Mandiri', account: '9988776655', ktpLast4: '0042', ktpOnFile: true, end: '2027-03-31', allowance: s.staff.s10.hr.allowance, contract: 'pkwt' });
    // changing to a permanent contract clears the end date
    expect(run(r.state, 'staff.update', { staffId: 's10', hr: { contract: 'pkwtt' } }).state.staff.s10.hr.end).toBeNull();
    fails(s, 'staff.update', { staffId: 's10', hr: { end: '2020-01-01' } }, 'people.err.endBeforeStart');
    fails(s, 'staff.update', { staffId: 's10', phone: '+62 811-2201-3345' }, 'people.err.phoneTaken');
    fails(s, 'staff.update', { staffId: 'ghost', name: 'x' }, 'err.notFound');
    fails(s, 'staff.update', { staffId: 's9', role: 'lobby' }, 'people.err.ownRole'); // cannot demote yourself
    expect(run(s, 'staff.update', { staffId: 's10', role: 'nurse' }).state.staff.s10.role).toBe('nurse');
    // keeping your own phone is fine
    expect(run(s, 'staff.update', { staffId: 's10', phone: '+62 811-2201-3354' }).state.staff.s10.phone).toBe('+6281122013354');
  });
  it('round 7: management sets, changes and removes a staff photo; only a real media id is accepted', () => {
    const s = seed();
    expect(s.staff.s10.photoMediaId).toBeUndefined();
    const a = run(s, 'staff.update', { staffId: 's10', photoMediaId: 'md_staffphoto0001' });
    expect(a.state.staff.s10.photoMediaId).toBe('md_staffphoto0001');
    expect(a.state.staff.s10).toMatchObject({ name: 'Fransiska Tan', title: s.staff.s10.title }); // nothing else changed
    const b = run(a.state, 'staff.update', { staffId: 's10', photoMediaId: 'md_staffphoto0002' });
    expect(b.state.staff.s10.photoMediaId).toBe('md_staffphoto0002');
    expect(run(b.state, 'staff.update', { staffId: 's10', title: 'Head of finance' }).state.staff.s10.photoMediaId).toBe('md_staffphoto0002'); // other edits keep it
    expect(run(b.state, 'staff.update', { staffId: 's10', photoMediaId: null }).state.staff.s10.photoMediaId).toBeUndefined();
    expect(run(b.state, 'staff.update', { staffId: 's10', photoMediaId: '' }).state.staff.s10.photoMediaId).toBeUndefined();
    fails(s, 'staff.update', { staffId: 's10', photoMediaId: 'not-a-media-id' }, 'err.invalid');
    fails(s, 'staff.update', { staffId: 's10', photoMediaId: 42 }, 'err.invalid');
    for (const uid of ['s1', 's8', 's5']) expect(() => run(s, 'staff.update', { staffId: 's10', photoMediaId: 'md_staffphoto0001' }, uid)).toThrow('err.forbidden');
  });
  it('contract dates warn before they end', () => {
    expect(contractState({ end: null }, T)).toEqual({ kind: 'permanent' });
    expect(contractState({ end: '2026-10-21' }, T)).toEqual({ kind: 'soon', days: 0 });
    expect(contractState({ end: '2026-11-20' }, T)).toEqual({ kind: 'soon', days: 30 });
    expect(contractState({ end: '2026-11-21' }, T)).toEqual({ kind: 'ok', days: 31 });
    expect(contractState({ end: '2026-10-01' }, T)).toEqual({ kind: 'ended', days: 20 });
    // a staff contract ending within 30 days is a "needs action" item for management, linking to the record
    const r = run(seed(), 'staff.update', { staffId: 's6', hr: { end: '2026-11-10' } });
    const item = actionItems(r.state, user(r.state, 's9'), T, 600).find((i) => i.id === 'contract:s6');
    expect(item).toMatchObject({ link: '/hr?staff=s6', params: { name: 'Dimas Wibowo', date: '2026-11-10' } });
  });
  it('deactivate and reactivate: they stop signing in and disappear from active lists; not yourself', () => {
    const s = seed();
    expect(getUser({ citra: s }, 's5')?.kind).toBe('staff');
    const r = run(s, 'staff.deactivate', { staffId: 's5', reason: 'Resigned' });
    expect(r.state.staff.s5.active).toBe(false);
    expect(getUser({ citra: r.state }, 's5')).toBeNull();
    expect(findByPhone({ citra: r.state }, '+62 811-2201-3349')).toMatchObject({ ok: false });
    expect(activeStaff(r.state).map((x) => x.id)).not.toContain('s5');
    expect(staffList(r.state).map((x) => x.id).slice(-1)).toEqual(['s5']); // inactive listed last
    fails(r.state, 'staff.deactivate', { staffId: 's5' }, 'err.noChanges');
    const back = run(r.state, 'staff.reactivate', { staffId: 's5' });
    expect(getUser({ citra: back.state }, 's5')?.kind).toBe('staff');
    fails(back.state, 'staff.reactivate', { staffId: 's5' }, 'err.noChanges');
    fails(s, 'staff.deactivate', { staffId: 's9' }, 'people.err.selfDeactivate');
    // access cannot be turned on for someone who has left
    fails(r.state, 'staff.setAppAccess', { staffId: 's5', on: true }, 'people.err.inactive');
    const off = run(r.state, 'staff.setAppAccess', { staffId: 's5', on: false }).state;
    fails(off, 'staff.setAppAccess', { staffId: 's5', on: true }, 'people.err.inactive');
  });
  it('app access: a staff member can sign in once it is on, and not after it is off', () => {
    const s = run(seed(), 'staff.setAppAccess', { staffId: 's10', on: false }).state; // Fransiska: no app access
    expect(getUser({ citra: s }, 's10')).toBeNull();
    expect(findByPhone({ citra: s }, '+62 811-2201-3354')).toMatchObject({ ok: false, reason: 'noAccess' });
    const on = run(s, 'staff.setAppAccess', { staffId: 's10', on: true });
    const u = getUser({ citra: on.state }, 's10')!;
    expect(u.kind).toBe('staff');
    expect(u.kind === 'staff' && u.staff.role).toBe('finance');
    expect(findByPhone({ citra: on.state }, '0811 2201 3354')).toMatchObject({ ok: true });
    fails(on.state, 'staff.setAppAccess', { staffId: 's10', on: true }, 'err.noChanges');
    expect(getUser({ citra: run(on.state, 'staff.setAppAccess', { staffId: 's10', on: false }).state }, 's10')).toBeNull();
    fails(s, 'staff.setAppAccess', { staffId: 's9', on: false }, 'people.err.selfAccess');
    // a new staff member with access can sign in at once
    const created = run(s, 'staff.create', { ...newStaff, appAccess: true });
    expect(getUser({ citra: created.state }, 's11')?.kind).toBe('staff');
  });
});

describe('notes and warnings', () => {
  it('add and delete (soft) with an audit trail; no future dates', () => {
    const s = seed();
    const r = run(s, 'hrNote.add', { staffId: 's6', kind: 'praise', text: 'Stayed late to help with the move' });
    const id = r.result.noteId as string;
    expect(r.state.hrNotes[id]).toMatchObject({ staffId: 's6', kind: 'praise', on: T, text: 'Stayed late to help with the move', createdBy: 'staff:s9' });
    expect(live(r.state.hrNotes).filter((x) => x.staffId === 's6').map((x) => x.kind).sort()).toEqual(['praise']);
    const dated = run(s, 'hrNote.add', { staffId: 's6', kind: 'warning', text: 'Late again', on: '2026-10-19' });
    expect(dated.state.hrNotes[dated.result.noteId as string].on).toBe('2026-10-19');
    fails(s, 'hrNote.add', { staffId: 's6', kind: 'warning', text: 'x', on: '2026-10-22' }, 'people.err.futureDate');
    fails(s, 'hrNote.add', { staffId: 's6', kind: 'gossip', text: 'x' }, 'err.invalid');
    fails(s, 'hrNote.add', { staffId: 's6', kind: 'note', text: ' ' }, 'err.invalid');
    fails(s, 'hrNote.add', { staffId: 'ghost', kind: 'note', text: 'x' }, 'err.notFound');
    const del = run(r.state, 'hrNote.delete', { noteId: id });
    expect(del.state.hrNotes[id].deletedAt).toBe('2026-10-21T10:05');
    expect(live(del.state.hrNotes).some((x) => x.id === id)).toBe(false);
    fails(del.state, 'hrNote.delete', { noteId: id }, 'err.notFound');
  });
});

describe('staff time', () => {
  it('clock in and out, edit a day, leave and sick days, remove', () => {
    const s = seed();
    const inn = run(s, 'staffTime.upsert', { staffId: 's1', date: T, kind: 'worked', from: '08:02' });
    expect(inn.state.staffTime['st-s1-2026-10-21']).toMatchObject({ kind: 'worked', from: '08:02', staffId: 's1', date: T });
    expect(inn.state.staffTime['st-s1-2026-10-21'].to).toBeUndefined();
    const out = run(inn.state, 'staffTime.upsert', { staffId: 's1', date: T, kind: 'worked', from: '08:02', to: '10:00' });
    expect(out.state.staffTime['st-s1-2026-10-21'].to).toBe('10:00');
    // editing a past day (a corrected clock-out) replaces that day's entry
    const fix = run(s, 'staffTime.upsert', { staffId: 's1', date: '2026-10-20', kind: 'worked', from: '08:00', to: '16:30' });
    expect(fix.state.staffTime['st-s1-2026-10-20']).toMatchObject({ from: '08:00', to: '16:30', createdAt: s.staffTime['st-s1-2026-10-20'].createdAt });
    expect(live(fix.state.staffTime).filter((x) => x.staffId === 's1' && x.date === '2026-10-20')).toHaveLength(1);
    const sick = run(s, 'staffTime.upsert', { staffId: 's1', date: '2026-10-20', kind: 'sick', from: '08:00', to: '09:00' });
    expect(sick.state.staffTime['st-s1-2026-10-20']).toMatchObject({ kind: 'sick' });
    expect(sick.state.staffTime['st-s1-2026-10-20'].from).toBeUndefined();
    // leave booked ahead is fine; working in the future is not
    expect(run(s, 'staffTime.upsert', { staffId: 's1', date: '2026-10-28', kind: 'leave' }).state.staffTime['st-s1-2026-10-28'].kind).toBe('leave');
    fails(s, 'staffTime.upsert', { staffId: 's1', date: '2026-10-28', kind: 'worked', from: '08:00' }, 'people.err.futureDate');
    fails(s, 'staffTime.upsert', { staffId: 's1', date: T, kind: 'worked', from: '11:00' }, 'people.err.futureDate'); // later than now
    fails(s, 'staffTime.upsert', { staffId: 's1', date: T, kind: 'worked' }, 'err.invalid');
    fails(s, 'staffTime.upsert', { staffId: 's1', date: T, kind: 'worked', from: '09:00', to: '08:00' }, 'people.err.timeOrder');
    fails(s, 'staffTime.upsert', { staffId: 'ghost', date: T, kind: 'leave' }, 'err.notFound');
    const rm = run(s, 'staffTime.remove', { staffId: 's1', date: '2026-10-20' });
    expect(live(rm.state.staffTime).some((x) => x.id === 'st-s1-2026-10-20')).toBe(false);
    fails(rm.state, 'staffTime.remove', { staffId: 's1', date: '2026-10-20' }, 'err.notFound');
    // a removed day can be entered again
    expect(run(rm.state, 'staffTime.upsert', { staffId: 's1', date: '2026-10-20', kind: 'off' }).state.staffTime['st-s1-2026-10-20'].deletedAt).toBeUndefined();
  });
  it('month summaries add up worked hours', () => {
    const s = seed();
    const m = staffTimeFor(s, 's1', '2026-10');
    expect(m.worked).toBe(m.rows.length);
    expect(m.minutes).toBe(m.worked * 9 * 60);
    expect(hoursLabel(minutesBetween('08:00', '16:30'))).toBe('8:30');
    expect(minutesBetween('08:00', undefined)).toBe(0);
  });
});

describe('ratings from surveys', () => {
  it('pooled over every survey that asked about the person; none for people never asked', () => {
    const s = seed();
    expect(staffRating(s, 's1')).toMatchObject({ avg: 5, n: 6 });
    expect(staffRating(s, 's1')!.surveys.map((x) => x.id)).toEqual(['sv1', 'sv0']);
    expect(staffRating(s, 's6')).toMatchObject({ avg: 4.7, n: 3, surveys: [{ id: 'sv1', n: 3 }] });
    expect(staffRating(s, 's9')).toBeNull();
  });
});
