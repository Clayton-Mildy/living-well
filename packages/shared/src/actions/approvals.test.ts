// Round 5, management approves everything staff enter: the gate on daily logs, family notes, readings, the menu; what families see meanwhile
// (projectForFamily and the client rules); the bulk hub actions (one action per batch, stale ids skipped); and the per-type selectors.
import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { buildSeed, execute, getUser, projectForFamily, actionItems, unreadUpdates, toMin, DomainError, type ClubState } from '../index';
import { approvalCounts, approvalHistory, approvalTotal, approvedDayMenu, approvedVersion, pendingItems } from '../rules/approvals';
import { latestLog, sharedNoteOf, servedLunch } from '../rules/family';
import { menuOn } from '../rules/kitchen';

const T = '2026-10-21';
const clock = { today: T, nowMin: toMin('10:00') };
let n = 0;
const fresh = (): ClubState => buildSeed().citra;
const as = (s: ClubState, id: string) => getUser({ [s.clubId]: s }, id)!;
const run = (s: ClubState, name: string, input: unknown, uid: string, clk = clock) => execute(s, name, input, as(s, uid), clk, `ap${++n}`);
const fails = (s: ClubState, name: string, input: unknown, uid: string, code: string) => {
  try { run(s, name, input, uid); } catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code); return; }
  throw new Error(`expected ${name} to fail with ${code}`);
};
const logIn = { mood: 'calm', lunch: 'all', joined: 'yes', communicative: 'normal', content: 'normal', note: '' };
const LOG = `log-m10-${T}`;
const famLogs = (s: ClubState, uid: string) => Object.values(projectForFamily(s, uid).dailyLogs).filter((l) => l.date === T);

describe('the gate: daily logs', () => {
  it('a teacher\'s log is pending; the family neither sees it nor hears about it; management\'s own log is approved at once', () => {
    const r = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn, note: 'Enjoyed the garden.' }, 's5');
    expect(r.state.dailyLogs[LOG].approval).toMatchObject({ status: 'pending', by: 'staff:s5' });
    expect(r.state.dailyLogs[LOG].approval!.prev).toBeUndefined();
    expect(famLogs(r.state, 'fm10_0')).toEqual([]);
    expect(unreadUpdates(r.state, as(r.state, 'fm10_0')).filter((x) => x.kind.startsWith('activity.notif.log') && x.createdAt === `${T}T10:00`)).toEqual([]);
    expect(latestLog(r.state, 'm10', T)?.date).not.toBe(T); // even on the full state, the family rule skips it
    const mg = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn }, 's9');
    expect(mg.state.dailyLogs[LOG].approval).toBeUndefined();
    expect(famLogs(mg.state, 'fm10_0')).toHaveLength(1);
    expect(mg.state.notifications && Object.values(mg.state.notifications).some((x) => x.kind === 'activity.notif.logSaved' && x.createdAt === `${T}T10:00`)).toBe(true);
  });

  it('an edit of an approved log keeps the earlier values for families until approved', () => {
    let s = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn, note: 'First version.' }, 's5').state;
    s = run(s, 'approval.approve', { type: 'logs', ids: [LOG] }, 's9').state;
    expect(famLogs(s, 'fm10_0')[0]).toMatchObject({ note: 'First version.', mood: 'calm' });
    const e = run(s, 'log.save', { memberId: 'm10', date: T, ...logIn, mood: 'quiet', note: 'Second version.' }, 's5');
    expect(e.state.dailyLogs[LOG]).toMatchObject({ mood: 'quiet', note: 'Second version.', approval: { status: 'pending', prev: { mood: 'calm', note: 'First version.' } } });
    expect(famLogs(e.state, 'fm10_0')[0]).toMatchObject({ mood: 'calm', note: 'First version.' }); // what the family keeps seeing
    expect(famLogs(e.state, 'fm10_0')[0].approval).toBeUndefined();
    expect(latestLog(e.state, 'm10', T)).toMatchObject({ note: 'First version.' });
    // another edit while it waits keeps the same earlier version
    const e2 = run(e.state, 'log.save', { memberId: 'm10', date: T, ...logIn, mood: 'agitated', note: 'Third.' }, 's5');
    expect(e2.state.dailyLogs[LOG].approval!.prev).toMatchObject({ note: 'First version.' });
    // approving tells the family "updated"; rejecting puts the first version back
    const ok = run(e.state, 'approval.approve', { type: 'logs', ids: [LOG] }, 's9');
    expect(famLogs(ok.state, 'fm10_0')[0]).toMatchObject({ note: 'Second version.', mood: 'quiet' });
    expect(Object.values(ok.state.notifications).some((x) => x.kind === 'activity.notif.logUpdated' && x.createdAt === `${T}T10:00`)).toBe(true);
    const no = run(e.state, 'approval.reject', { type: 'logs', ids: [LOG], reason: 'Please check the note' }, 's9');
    expect(no.state.dailyLogs[LOG]).toMatchObject({ mood: 'calm', note: 'First version.', approval: { status: 'rejected', reason: 'Please check the note', proposed: { note: 'Second version.' } } });
    expect(famLogs(no.state, 'fm10_0')[0]).toMatchObject({ note: 'First version.' });
  });

  it('a rejected new log is never shown to the family, the author is told why, and writing it again sends it back for approval', () => {
    const s0 = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn }, 's5').state;
    const no = run(s0, 'approval.reject', { type: 'logs', ids: [LOG], reason: 'Wrong day' }, 's9');
    expect(no.state.dailyLogs[LOG].approval).toMatchObject({ status: 'rejected', reason: 'Wrong day', decidedBy: 'staff:s9' });
    expect(famLogs(no.state, 'fm10_0')).toEqual([]);
    const told = unreadUpdates(no.state, as(no.state, 's5')).find((x) => x.kind === 'approvals.notif.rejected.logs');
    expect(told).toMatchObject({ params: { n: 1, reason: 'Wrong day' }, link: '/log' });
    const again = run(no.state, 'log.save', { memberId: 'm10', date: T, ...logIn, note: 'Fixed' }, 's5');
    expect(again.state.dailyLogs[LOG].approval).toMatchObject({ status: 'pending' });
    expect(again.state.dailyLogs[LOG].approval!.reason).toBeUndefined();
  });
});

describe('the gate: family notes', () => {
  it('a family note by staff is hidden until approved; staff-only notes need nothing; a rejected new note is gone', () => {
    const a = run(fresh(), 'note.add', { memberId: 'm10', visibility: 'family', text: 'Likes the garden.' }, 's5');
    const id = a.result.noteId as string;
    expect(a.state.memberNotes[id].approval).toMatchObject({ status: 'pending' });
    expect(Object.keys(projectForFamily(a.state, 'fm10_0').memberNotes)).not.toContain(id);
    expect(sharedNoteOf(a.state, 'm10')?.id).not.toBe(id); // the client rule on a full state agrees
    const staff = run(fresh(), 'note.add', { memberId: 'm10', visibility: 'staff', text: 'Private.' }, 's5');
    expect(staff.state.memberNotes[staff.result.noteId as string].approval).toBeUndefined();
    const ok = run(a.state, 'approval.approve', { type: 'logs', ids: [id] }, 's9');
    expect(Object.keys(projectForFamily(ok.state, 'fm10_0').memberNotes)).toContain(id);
    // editing an approved note: the family keeps the old text
    const ed = run(ok.state, 'note.edit', { noteId: id, text: 'Likes the garden and tea.' }, 's5');
    expect(projectForFamily(ed.state, 'fm10_0').memberNotes[id].text).toBe('Likes the garden.');
    expect(projectForFamily(run(ed.state, 'approval.approve', { type: 'logs', ids: [id] }, 's9').state, 'fm10_0').memberNotes[id].text).toBe('Likes the garden and tea.');
    const no = run(a.state, 'approval.reject', { type: 'logs', ids: [id], reason: 'Too personal' }, 's9');
    expect(no.state.memberNotes[id].deletedAt).toBeTruthy();
    expect(Object.keys(projectForFamily(no.state, 'fm10_0').memberNotes)).not.toContain(id);
  });
});

describe('the gate: health readings', () => {
  const flags = { noteKeys: [], shared: true, tellFamily: true, recheck: false, deferMonthly: false, source: 'keypad' as const };
  const reading = { memberId: 'm20', kind: 'arrival', sys: 160, dia: 95, pulse: 80, spo2: 96, temp: 36.6, ...flags };
  const famReadings = (s: ClubState, uid: string) => Object.values(projectForFamily(s, uid).readings).filter((r) => r.date === T);

  it('the nurse\'s reading is pending and hidden; the alert reaches the nurses at once, the family when approved', () => {
    const r = run(fresh(), 'reading.save', reading, 's8');
    const id = r.result.readingId as string;
    expect(r.state.readings[id]).toMatchObject({ status: 'alert', approval: { status: 'pending', by: 'staff:s8', defer: { tell: true, share: true, overall: 'alert' } } });
    expect(famReadings(r.state, 'fm20_0')).toEqual([]);
    expect(Object.values(r.state.notifications).some((x) => x.kind === 'health.notif.alert' && x.toRoles.includes('nurse'))).toBe(true);
    expect(Object.values(r.state.notifications).some((x) => x.kind.startsWith('health.notif.fam.') && x.createdAt === `${T}T10:00`)).toBe(false);
    expect(r.state.readings[id].familyTold).toBeUndefined();
    const ok = run(r.state, 'approval.approve', { type: 'readings', ids: [id] }, 's9');
    expect(famReadings(ok.state, 'fm20_0')).toHaveLength(1);
    expect(unreadUpdates(ok.state, as(ok.state, 'fm20_0')).some((n) => n.kind === 'health.notif.fam.alert' && n.link === '/health')).toBe(true); // the family's bell (the club tells them on WhatsApp, simulated)
    expect(Object.keys(ok.state.messages)).toHaveLength(0); // Messages is gone
    expect(ok.state.readings[id].familyTold?.by).toBe('s8');
    // management's own reading tells the family at once, with no mark
    const mg = run(fresh(), 'reading.save', reading, 's9');
    expect(mg.state.readings[mg.result.readingId as string].approval).toBeUndefined();
    expect(mg.state.readings[mg.result.readingId as string].familyTold).toMatchObject({ by: 's9' });
    expect(unreadUpdates(mg.state, as(mg.state, 'fm20_0')).some((n) => n.kind === 'health.notif.fam.alert')).toBe(true);
  });

  it('a correction waits too: families keep the approved values; rejecting restores them; a rejected new reading counts for nothing', () => {
    const r = run(fresh(), 'reading.save', { ...reading, sys: 122, dia: 78, tellFamily: false, shared: false }, 's8');
    const id = r.result.readingId as string;
    const ok = run(r.state, 'approval.approve', { type: 'readings', ids: [id] }, 's9').state;
    const ed = run(ok, 'reading.edit', { readingId: id, values: { sys: 130, dia: 80 }, reason: 'typo' }, 's8');
    expect(ed.state.readings[id]).toMatchObject({ sys: 130, approval: { status: 'pending', prev: { sys: 122, dia: 78 } } });
    expect(famReadings(ed.state, 'fm20_0')[0]).toMatchObject({ sys: 122, dia: 78 });
    const no = run(ed.state, 'approval.reject', { type: 'readings', ids: [id], reason: 'Re-measure' }, 's9');
    expect(no.state.readings[id]).toMatchObject({ sys: 122, dia: 78, approval: { status: 'rejected', proposed: { sys: 130 } } });
    expect(famReadings(no.state, 'fm20_0')[0]).toMatchObject({ sys: 122 });
    // a new reading that is turned down is voided (the arrival check is due again) and never reaches the family
    const fresh2 = run(fresh(), 'reading.save', { ...reading, tellFamily: false, shared: false }, 's8');
    const rid = fresh2.result.readingId as string;
    const gone = run(fresh2.state, 'approval.reject', { type: 'readings', ids: [rid], reason: 'Wrong person' }, 's9');
    expect(gone.state.readings[rid].voided).toMatchObject({ reason: 'other', note: 'Wrong person' });
    expect(famReadings(gone.state, 'fm20_0')).toEqual([]);
    expect(approvalTotal(gone.state)).toBe(approvalTotal(fresh()));
  });

  it('a monthly reading saved with an arrival is approved and rejected together with it and listed once', () => {
    const r = run(fresh(), 'reading.save', { ...reading, glucose: 120, weight: 60, tellFamily: false, shared: false }, 's8');
    const list = pendingItems(r.state, 'readings').filter((x) => x.at.startsWith(T));
    expect(list).toHaveLength(1);
    const monthly = r.result.monthlyId as string;
    expect(r.state.readings[monthly].approval).toMatchObject({ status: 'pending', companionOf: r.result.readingId });
    const ok = run(r.state, 'approval.approve', { type: 'readings', ids: [r.result.readingId as string] }, 's9');
    expect(ok.state.readings[monthly].approval).toMatchObject({ status: 'approved' });
    expect(approvalHistory(ok.state).filter((h) => h.type === 'readings' && h.at.startsWith(T))).toHaveLength(1);
  });
});

describe('the gate: the menu', () => {
  const D = '2026-10-23'; // Friday
  const row = (s: ClubState) => s.dayMenus[D];
  it('a day override by the kitchen waits: families keep the weekly menu; approving shows it; rejecting restores', () => {
    const base = menuOn(fresh(), D)!.lunch;
    const r = run(fresh(), 'dayMenu.override', { date: D, lunch: ['dish-rawon', 'dish-nasi-putih'] }, 's3');
    expect(row(r.state)).toMatchObject({ lunch: ['dish-rawon', 'dish-nasi-putih'], approval: { status: 'pending', prev: {} } });
    expect(menuOn(r.state, D)!.lunch).toEqual(['dish-rawon', 'dish-nasi-putih']); // the kitchen's own screens follow it
    const fam = projectForFamily(r.state, 'fm10_0');
    expect(menuOn(fam, D)!.lunch).toEqual(base);
    expect(fam.dayMenus[D]?.approval).toBeUndefined();
    expect(menuOn(r.state, D, { approvedOnly: true })!.lunch).toEqual(base);
    expect(approvedDayMenu(row(r.state)).lunch).toBeUndefined();
    const ok = run(r.state, 'approval.approve', { type: 'menu', ids: [D] }, 's9');
    expect(menuOn(projectForFamily(ok.state, 'fm10_0'), D)!.lunch).toEqual(['dish-rawon', 'dish-nasi-putih']);
    // edited again after approval: the approved override stays visible
    const ed = run(ok.state, 'dayMenu.override', { date: D, lunch: ['dish-gado-gado'] }, 's3');
    expect(menuOn(projectForFamily(ed.state, 'fm10_0'), D)!.lunch).toEqual(['dish-rawon', 'dish-nasi-putih']);
    // going back to what families already see leaves nothing to approve
    const back = run(ed.state, 'dayMenu.override', { date: D, lunch: ['dish-rawon', 'dish-nasi-putih'] }, 's3');
    expect(row(back.state).approval).toBeUndefined();
    const no = run(r.state, 'approval.reject', { type: 'menu', ids: [D], reason: 'Not this week' }, 's9');
    expect(menuOn(no.state, D)!.lunch).toEqual(base);
    expect(no.state.dayMenus[D]?.approval).toMatchObject({ status: 'rejected', reason: 'Not this week' });
    expect(servedLunch(r.state, r.state.members.m10, D)).toEqual(base); // the family's lunch line follows the approved menu
  });
});

describe('profile changes: families keep the earlier values until a health edit is acknowledged', () => {
  it('a nurse\'s allergy edit applies at once for staff; the family projection shows the earlier allergies until acknowledged, and not at all if reverted', () => {
    const r = run(fresh(), 'members.setAllergies', { memberId: 'm1', food: ['shellfish', 'peanuts'], foodOther: '', drugs: [] }, 's8');
    expect(r.reviewed).toBe('flag');
    expect(r.state.members.m1.health.food).toEqual(['shellfish', 'peanuts']);
    expect(projectForFamily(r.state, 'f1').members.m1.health.food).toEqual(['shellfish']);
    const cr = Object.values(r.state.changeRequests).find((c) => c.action === 'members.setAllergies')!;
    const ack = run(r.state, 'approval.approve', { type: 'profile', ids: [cr.id] }, 's9');
    expect(ack.state.changeRequests[cr.id].status).toBe('acknowledged');
    expect(projectForFamily(ack.state, 'f1').members.m1.health.food).toEqual(['shellfish', 'peanuts']);
    const rev = run(r.state, 'approval.reject', { type: 'profile', ids: [cr.id], reason: 'Not confirmed by the doctor' }, 's9');
    expect(rev.state.changeRequests[cr.id].status).toBe('reverted');
    expect(rev.state.members.m1.health.food).toEqual(['shellfish']);
    expect(projectForFamily(rev.state, 'f1').members.m1.health.food).toEqual(['shellfish']);
  });
});

describe('the hub: one action per batch', () => {
  it('approves several logs, a note and a reading in separate typed batches; each is a single action with one result', () => {
    let s = fresh();
    s = run(s, 'log.saveAllNormal', { date: T }, 's5').state;
    const ids = pendingItems(s, 'logs').filter((x) => x.sub === 'log' && x.at.startsWith(T)).map((x) => x.id);
    expect(ids).toHaveLength(3);
    const r = run(s, 'approval.approve', { type: 'logs', ids }, 's9');
    expect(r.result).toMatchObject({ approved: 3, skipped: [] });
    expect(pendingItems(r.state, 'logs').filter((x) => x.at.startsWith(T))).toEqual([]);
    expect(Object.values(r.state.notifications).filter((x) => x.kind === 'activity.notif.logSaved' && x.createdAt === `${T}T10:00`)).toHaveLength(3);
  });

  it('items already handled, missing or stale are skipped and reported; a batch with nothing left changes nothing', () => {
    let s = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn }, 's5').state;
    s = run(s, 'log.save', { memberId: 'm2', date: T, ...logIn }, 's5').state;
    const first = run(s, 'approval.approve', { type: 'logs', ids: [LOG] }, 's9');
    const r = run(first.state, 'approval.approve', { type: 'logs', ids: [LOG, `log-m2-${T}`, 'log-nope'] }, 's9');
    expect(r.result).toMatchObject({ approved: 1, skipped: [LOG, 'log-nope'] });
    const none = run(r.state, 'approval.approve', { type: 'logs', ids: [LOG] }, 's9');
    expect(none.result).toMatchObject({ approved: 0, skipped: [LOG] });
    expect(none.patches).toEqual([]);
    const rej = run(first.state, 'approval.reject', { type: 'logs', ids: [LOG, `log-m2-${T}`], reason: 'Redo' }, 's9');
    expect(rej.result).toMatchObject({ rejected: 1, skipped: [LOG] });
  });

  it('a reject needs one reason for the whole batch, and only management may decide', () => {
    const s = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn }, 's5').state;
    fails(s, 'approval.reject', { type: 'logs', ids: [LOG], reason: '   ' }, 's9', 'err.noteRequired');
    fails(s, 'approval.reject', { type: 'logs', ids: [LOG] }, 's9', 'err.noteRequired');
    fails(s, 'approval.approve', { type: 'logs', ids: [LOG] }, 's5', 'err.forbidden');
    fails(s, 'approval.approve', { type: 'logs', ids: [LOG] }, 'fm10_0', 'err.forbidden');
    fails(s, 'approval.approve', { type: 'bogus', ids: [LOG] }, 's9', 'err.invalid');
    fails(s, 'approval.approve', { type: 'logs', ids: [] }, 's9', 'err.invalid');
  });

  it('rejecting several of one author\'s entries tells them once, with the reason', () => {
    const s = run(fresh(), 'log.saveAllNormal', { date: T }, 's5').state;
    const ids = pendingItems(s, 'logs').filter((x) => x.at.startsWith(T)).map((x) => x.id);
    const r = run(s, 'approval.reject', { type: 'logs', ids, reason: 'Check the facts' }, 's9');
    const told = unreadUpdates(r.state, as(r.state, 's5')).filter((x) => x.kind === 'approvals.notif.rejected.logs');
    expect(told).toHaveLength(1);
    expect(told[0].params).toEqual({ n: 3, reason: 'Check the facts' });
  });

  it('profile batch: approves a gated change, acknowledges an applied one; a stale one is reported, not forced', () => {
    const s = fresh();
    const r = run(s, 'approval.approve', { type: 'profile', ids: ['cr-seed-1', 'cr-seed-2'] }, 's9');
    expect(r.result).toMatchObject({ approved: 2, skipped: [], conflicts: [] });
    expect(r.state.changeRequests['cr-seed-1'].status).toBe('approved');
    expect(r.state.members.m10.usualArrival).toBe('09:30');
    expect(r.state.changeRequests['cr-seed-2'].status).toBe('acknowledged');
    // someone else changed the field since: the batch skips it as a conflict
    const moved = produce(s, (d) => { d.members.m10.usualArrival = '10:15'; });
    const c = run(moved, 'approval.approve', { type: 'profile', ids: ['cr-seed-1', 'cr-seed-2'] }, 's9');
    expect(c.result).toMatchObject({ approved: 1, conflicts: ['cr-seed-1'] });
    expect(c.state.changeRequests['cr-seed-1'].status).toBe('pending');
    // rejecting a gated change: the sender is told; the record stays as it was
    const j = run(s, 'approval.reject', { type: 'profile', ids: ['cr-seed-1'], reason: 'Please confirm' }, 's9');
    expect(j.state.changeRequests['cr-seed-1']).toMatchObject({ status: 'rejected', note: 'Please confirm' });
    expect(j.state.members.m10.usualArrival).toBe('09:48');
  });

  it('photos and stock go through the same hub, in one batch each', () => {
    const first = run(fresh(), 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo' }, 's5');
    const mine = first.result.photoId as string;
    const s = run(first.state, 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo' }, 's5').state;
    const ph = pendingItems(s, 'photos').map((x) => x.id);
    expect(ph).toHaveLength(2);
    const ok = run(s, 'approval.approve', { type: 'photos', ids: ph, notify: false }, 's9');
    expect(ok.result).toMatchObject({ approved: 2 });
    expect(Object.keys(projectForFamily(ok.state, 'fm10_0').photos)).toContain(mine);
    const no = run(s, 'approval.reject', { type: 'photos', ids: ph, reason: 'Blurry' }, 's9');
    expect(no.result).toMatchObject({ rejected: 2 });
    expect(Object.keys(projectForFamily(no.state, 'fm10_0').photos)).not.toContain(mine);
    // stock: k1 and k2 are requested; approving declines nobody else
    const st = run(fresh(), 'approval.approve', { type: 'stock', ids: ['k1', 'k2'] }, 's9');
    expect(st.result).toMatchObject({ approved: 2 });
    expect(st.state.stockRequests.k1).toMatchObject({ status: 'approved', decidedBy: 'staff:s9' });
    const sr = run(fresh(), 'approval.reject', { type: 'stock', ids: ['k1'], reason: 'Over budget' }, 's9');
    expect(sr.state.stockRequests.k1).toMatchObject({ status: 'rejected', note: 'Over budget' });
    expect(run(fresh(), 'approval.approve', { type: 'stock', ids: ['k3'] }, 's9').result).toMatchObject({ approved: 0, skipped: ['k3'] }); // already approved
  });
});

describe('selectors: counts, the derived items and the history', () => {
  it('the seed shows each type with something waiting; the total is the nav badge', () => {
    const s = fresh();
    const c = approvalCounts(s);
    expect(c.profile).toBe(2); // one waiting for approval, one applied at once
    expect(c.logs).toBe(2); // an edited log and a note for the family
    expect(c.readings).toBe(1);
    expect(c.menu).toBe(1);
    expect(c.stock).toBeGreaterThanOrEqual(2);
    expect(c.photos).toBe(0);
    expect(approvalTotal(s)).toBe(Object.values(c).reduce((a, b) => a + b, 0));
  });

  it('management gets one derived "needs action" item per type, not one per entry', () => {
    const s = run(fresh(), 'log.saveAllNormal', { date: T }, 's5').state;
    const items = actionItems(s, as(s, 's9'), T, toMin('10:00'));
    const logsItem = items.filter((i) => i.id === 'approvals:logs');
    expect(logsItem).toHaveLength(1);
    expect(logsItem[0]).toMatchObject({ kind: 'notif.act.approvalsLogs', params: { n: 5 }, link: '/reviews?tab=logs' });
    expect(items.filter((i) => i.id.startsWith('approvals:')).map((i) => i.id).sort()).toEqual(['approvals:logs', 'approvals:menu', 'approvals:readings', 'approvals:renewals']); // renewals: Caca's seeded upgrade
    expect(actionItems(s, as(s, 's5'), T, toMin('10:00')).some((i) => i.id.startsWith('approvals:'))).toBe(false); // staff do not get them
  });

  it('the history lists decided entries of every type, newest decision first, with the reason', () => {
    let s = run(fresh(), 'log.save', { memberId: 'm10', date: T, ...logIn }, 's5').state;
    s = run(s, 'approval.reject', { type: 'logs', ids: [LOG], reason: 'Redo it' }, 's9', { today: T, nowMin: toMin('10:10') }).state;
    s = run(s, 'approval.approve', { type: 'stock', ids: ['k1'] }, 's9', { today: T, nowMin: toMin('10:20') }).state;
    const h = approvalHistory(s);
    expect(h[0]).toMatchObject({ type: 'stock', id: 'k1', status: 'approved' });
    expect(h.find((x) => x.id === LOG)).toMatchObject({ type: 'logs', status: 'rejected', reason: 'Redo it', decidedBy: 'staff:s9', by: 'staff:s5' });
    expect(pendingItems(s, 'logs').some((x) => x.id === LOG)).toBe(false);
  });

  it('approvedVersion hides a new pending entry and a rejected new one, and shows the earlier values for a waiting edit', () => {
    const row = { a: 1, approval: undefined as import('../types').Approval | undefined };
    const mark = (approval: import('../types').Approval) => ({ ...row, approval });
    const base = { by: 'staff:s5' as const, at: `${T}T10:00` };
    expect(approvedVersion(row, ['a'])).toEqual(row);
    expect(approvedVersion(mark({ ...base, status: 'pending' }), ['a'])).toBeNull();
    expect(approvedVersion(mark({ ...base, status: 'pending', prev: { a: 0 } }), ['a'])).toMatchObject({ a: 0, approval: undefined });
    expect(approvedVersion(mark({ ...base, status: 'rejected' }), ['a'])).toBeNull();
    expect(approvedVersion(mark({ ...base, status: 'rejected', prev: { a: 0 } }), ['a'])).toMatchObject({ a: 1 });
  });
});
