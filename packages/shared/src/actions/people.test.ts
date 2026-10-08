import { describe, it, expect } from 'vitest';
import { buildSeed, execute, getUser, findByPhone, live, activeStaff, actionItems, DomainError, type ClubState } from '../index';
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
const newStaff = { name: 'Wulan Sari', knownAs: 'Bu Wulan', role: 'housekeeping', title: 'Housekeeping', phone: '0811 2201 7788', hr: { contract: 'pkwt', start: '2026-11-01', end: '2027-10-31', salary: 4800000, allowance: 480000, bank: 'BNI', account: '1234 5678 90', ktpLast4: '4411', ktpOnFile: true, signed: true } };

describe('staff records', () => {
  it('management adds a staff member with a full record', () => {
    const s = seed();
    const r = run(s, 'staff.create', newStaff);
    const id = r.result.staffId as string;
    expect(id).toBe('s11');
    expect(r.state.staff[id]).toMatchObject({
      name: 'Wulan Sari', knownAs: 'Bu Wulan', role: 'housekeeping', title: 'Housekeeping', phone: '+6281122017788', active: true, appAccess: false, supervisor: false, rateable: false, extraClubIds: [], createdBy: 'staff:s9',
      hr: { contract: 'pkwt', start: '2026-11-01', end: '2027-10-31', salary: 4800000, allowance: 480000, bank: 'BNI', account: '1234567890', ktpLast4: '4411', ktpOnFile: true, signed: true },
    });
    expect(activeStaff(r.state).map((x) => x.id)).toContain('s11');
    expect(Object.values(r.state.activity).some((a) => a.key === 'people.feed.added' && a.params.name === 'Wulan Sari')).toBe(true);
    // minimal input gets sensible defaults
    const min = run(s, 'staff.create', { name: 'Budi', role: 'nurse', title: 'Nurse', phone: '+62 811 9000 111', hr: { contract: 'pkwtt' } });
    expect(min.state.staff.s11).toMatchObject({ rateable: true, hr: { contract: 'pkwtt', end: null, start: T, salary: 0, bank: 'BCA', ktpOnFile: false, signed: false } });
    // app access can be switched on when adding
    expect(run(s, 'staff.create', { ...newStaff, appAccess: true }).state.staff.s11.appAccess).toBe(true);
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
      expect(() => run(s, 'staff.update', { staffId: 's4', name: 'X' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staff.deactivate', { staffId: 's4' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staff.setAppAccess', { staffId: 's4', on: true }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'hrNote.add', { staffId: 's4', kind: 'note', text: 'x' }, uid)).toThrow('err.forbidden');
      expect(() => run(s, 'staffTime.upsert', { staffId: 's4', date: T, kind: 'leave' }, uid)).toThrow('err.forbidden');
    }
  });
  it('edit profile, contract, KTP, pay and bank; know-as can be cleared', () => {
    const s = seed();
    const r = run(s, 'staff.update', { staffId: 's4', title: 'Head of housekeeping', knownAs: null, phone: '0811 2201 9999', rateable: true, hr: { salary: 5200000, bank: 'Mandiri', account: '9988 7766 55', ktpLast4: '0042', ktpOnFile: true, end: '2027-03-31', signed: true } });
    const st = r.state.staff.s4;
    expect(st).toMatchObject({ title: 'Head of housekeeping', phone: '+6281122019999', rateable: true, name: 'Siti Aminah' });
    expect(st.knownAs).toBeUndefined();
    expect(st.hr).toMatchObject({ salary: 5200000, bank: 'Mandiri', account: '9988776655', ktpLast4: '0042', ktpOnFile: true, end: '2027-03-31', allowance: 500000, contract: 'pkwt' });
    // changing to a permanent contract clears the end date
    expect(run(r.state, 'staff.update', { staffId: 's4', hr: { contract: 'pkwtt' } }).state.staff.s4.hr.end).toBeNull();
    fails(s, 'staff.update', { staffId: 's4', hr: { end: '2020-01-01' } }, 'people.err.endBeforeStart');
    fails(s, 'staff.update', { staffId: 's4', phone: '+62 811-2201-3345' }, 'people.err.phoneTaken');
    fails(s, 'staff.update', { staffId: 'ghost', name: 'x' }, 'err.notFound');
    fails(s, 'staff.update', { staffId: 's9', role: 'lobby' }, 'people.err.ownRole'); // cannot demote yourself
    expect(run(s, 'staff.update', { staffId: 's4', role: 'driver' }).state.staff.s4.role).toBe('driver');
    // keeping your own phone is fine
    expect(run(s, 'staff.update', { staffId: 's4', phone: '+62 811-2201-3348' }).state.staff.s4.phone).toBe('+6281122013348');
  });
  it('round 7: management sets, changes and removes a staff photo; only a real media id is accepted', () => {
    const s = seed();
    expect(s.staff.s4.photoMediaId).toBeUndefined();
    const a = run(s, 'staff.update', { staffId: 's4', photoMediaId: 'md_staffphoto0001' });
    expect(a.state.staff.s4.photoMediaId).toBe('md_staffphoto0001');
    expect(a.state.staff.s4).toMatchObject({ name: 'Siti Aminah', title: s.staff.s4.title }); // nothing else changed
    const b = run(a.state, 'staff.update', { staffId: 's4', photoMediaId: 'md_staffphoto0002' });
    expect(b.state.staff.s4.photoMediaId).toBe('md_staffphoto0002');
    expect(run(b.state, 'staff.update', { staffId: 's4', title: 'Head of housekeeping' }).state.staff.s4.photoMediaId).toBe('md_staffphoto0002'); // other edits keep it
    expect(run(b.state, 'staff.update', { staffId: 's4', photoMediaId: null }).state.staff.s4.photoMediaId).toBeUndefined();
    expect(run(b.state, 'staff.update', { staffId: 's4', photoMediaId: '' }).state.staff.s4.photoMediaId).toBeUndefined();
    fails(s, 'staff.update', { staffId: 's4', photoMediaId: 'not-a-media-id' }, 'err.invalid');
    fails(s, 'staff.update', { staffId: 's4', photoMediaId: 42 }, 'err.invalid');
    for (const uid of ['s1', 's8', 's5']) expect(() => run(s, 'staff.update', { staffId: 's4', photoMediaId: 'md_staffphoto0001' }, uid)).toThrow('err.forbidden');
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
  it('app access: housekeeping (s4) can sign in once it is on, and not after it is off', () => {
    const s = seed();
    expect(getUser({ citra: s }, 's4')).toBeNull();
    expect(findByPhone({ citra: s }, '+62 811-2201-3348')).toMatchObject({ ok: false, reason: 'noAccess' });
    const on = run(s, 'staff.setAppAccess', { staffId: 's4', on: true });
    const u = getUser({ citra: on.state }, 's4')!;
    expect(u.kind).toBe('staff');
    expect(u.kind === 'staff' && u.staff.role).toBe('housekeeping');
    expect(findByPhone({ citra: on.state }, '0811 2201 3348')).toMatchObject({ ok: true });
    fails(on.state, 'staff.setAppAccess', { staffId: 's4', on: true }, 'err.noChanges');
    expect(getUser({ citra: run(on.state, 'staff.setAppAccess', { staffId: 's4', on: false }).state }, 's4')).toBeNull();
    fails(s, 'staff.setAppAccess', { staffId: 's9', on: false }, 'people.err.selfAccess');
    // a new staff member with access can sign in at once
    const created = run(s, 'staff.create', { ...newStaff, appAccess: true });
    expect(getUser({ citra: created.state }, 's11')?.kind).toBe('staff');
  });
});

describe('notes and warnings', () => {
  it('add and delete (soft) with an audit trail; no future dates', () => {
    const s = seed();
    const r = run(s, 'hrNote.add', { staffId: 's4', kind: 'praise', text: 'Stayed late to help with the move' });
    const id = r.result.noteId as string;
    expect(r.state.hrNotes[id]).toMatchObject({ staffId: 's4', kind: 'praise', on: T, text: 'Stayed late to help with the move', createdBy: 'staff:s9' });
    expect(live(r.state.hrNotes).filter((x) => x.staffId === 's4').map((x) => x.kind).sort()).toEqual(['praise', 'warning']);
    const dated = run(s, 'hrNote.add', { staffId: 's4', kind: 'warning', text: 'Late again', on: '2026-10-19' });
    expect(dated.state.hrNotes[dated.result.noteId as string].on).toBe('2026-10-19');
    fails(s, 'hrNote.add', { staffId: 's4', kind: 'warning', text: 'x', on: '2026-10-22' }, 'people.err.futureDate');
    fails(s, 'hrNote.add', { staffId: 's4', kind: 'gossip', text: 'x' }, 'err.invalid');
    fails(s, 'hrNote.add', { staffId: 's4', kind: 'note', text: ' ' }, 'err.invalid');
    fails(s, 'hrNote.add', { staffId: 'ghost', kind: 'note', text: 'x' }, 'err.notFound');
    const del = run(r.state, 'hrNote.delete', { noteId: id });
    expect(del.state.hrNotes[id].deletedAt).toBe('2026-10-21T10:05');
    expect(live(del.state.hrNotes).some((x) => x.id === id)).toBe(false);
    fails(del.state, 'hrNote.delete', { noteId: id }, 'err.notFound');
    run(s, 'hrNote.delete', { noteId: 'hr-s4-1' });
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
    const driver = staffTimeFor(s, 's7', '2026-10');
    expect(driver.minutes).toBe(driver.worked * (9 * 60 + 15));
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
