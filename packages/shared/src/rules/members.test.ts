// Members rules: ids, names, status from check-ins, search, the final invoice maths (extra visits by date) and the form validators.
import { describe, it, expect } from 'vitest';
import { buildSeed, type Attendance, type ClubState, type Invoice, type Member, type Photo } from '../index';
import { addMonths } from '../util';
import {
  DOC_TYPES, billedExtraDates, docIdFor, endingOn, faceConsent, faceReady, finalInvoiceFor, finalInvoiceLines, firstOfNextMonth, formatVa, genderOf, isHM, isISO, isPhone, isNewMember, lastContactId, lastLinkId, lastMemberId,
  matchesQuery, memberStatus, nextContactId, nextLinkId, nextMemberId, nextMonday, openBalance, plainName, splitName, tabForSection, unbilledExtraMonths, validateNewMember,
  documentTypes, pendingReviewsFor, allPendingReviews, appliedReviews, handledReviews, lastVisits, memberRows, pendingPhotoCount, pendingPhotos, photoReviewKind, subStart, subEnd, sortMemberRows,
} from './members';
import type { MemberRow } from './members';

const T = '2026-10-21';
const T2 = '2026-10-22';
const seed = () => buildSeed().citra;

describe('names and ids', () => {
  it('splits a full name the way the form does and joins it back', () => {
    expect(splitName('Siu Lan Tjandra')).toEqual({ firstName: 'Siu Lan', lastName: 'Tjandra' });
    expect(splitName('Budi')).toEqual({ firstName: 'Budi', lastName: 'Budi' });
    expect(splitName('  Lina   Wijaya ')).toEqual({ firstName: 'Lina', lastName: 'Wijaya' });
    expect(plainName({ firstName: 'Budi', lastName: 'Budi' })).toBe('Budi');
    expect(plainName({ firstName: 'Siu Lan', lastName: 'Tjandra' })).toBe('Siu Lan Tjandra');
    expect(genderOf('Oma')).toBe('f');
    expect(genderOf('Ibu')).toBe('f');
    expect(genderOf('Opa')).toBe('m');
    expect(genderOf('Bapak')).toBe('m');
  });

  it('allocates member, contact and link ids from the state', () => {
    const s = seed();
    expect(nextMemberId(s)).toBe('m47');
    expect(lastMemberId({ members: { ...s.members, m47: s.members.m1 } })).toBe('m47');
    expect(nextContactId(s, 'm10')).toBe('fm10_1');
    expect(nextContactId(s, 'm47')).toBe('fm47_0');
    expect(lastContactId(s, 'm10')).toBe('fm10_0');
    expect(nextLinkId(s, 'f1', 'm10')).toBe('f1:m10');
    expect(nextLinkId(s, 'f1', 'm1')).toBe('f1:m1#2');
    expect(lastLinkId(s, 'f1', 'm1')).toBe('f1:m1');
    expect(lastLinkId({ familyLinks: { ...s.familyLinks, 'f1:m1#2': s.familyLinks['f1:m1'] } }, 'f1', 'm1')).toBe('f1:m1#2');
    expect(docIdFor('m1', 'nannyKtp')).toBe('m1-doc-nktp');
    expect(formatVa('880812034400000000')).toBe('8808 1203 4400 0000 00');
  });
});

describe('dates and formats', () => {
  it('validates times, dates and phones', () => {
    expect(isHM('10:05')).toBe(true);
    expect(isHM('24:00')).toBe(false);
    expect(isHM('9:5')).toBe(false);
    expect(isISO('2026-02-29')).toBe(false);
    expect(isISO('2028-02-29')).toBe(true);
    expect(isISO('26-10-21')).toBe(false);
    expect(isPhone('+6281210904471')).toBe(true);
    expect(isPhone('0812')).toBe(false);
  });
  it('first of next month and the next Monday follow the date given', () => {
    expect(firstOfNextMonth('2026-10-21')).toBe('2026-11-01');
    expect(firstOfNextMonth('2026-12-31')).toBe('2027-01-01');
    expect(nextMonday('2026-10-21')).toBe('2026-10-26');
    expect(nextMonday('2026-10-26')).toBe('2026-11-02');
  });
});

describe('status', () => {
  const visit = (s: ClubState, date: string, memberId: string, over: Partial<Attendance> = {}): ClubState => ({
    ...s, attendance: { ...s.attendance, [`${date}:${memberId}`]: { id: `${date}:${memberId}`, clubId: 'citra', createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [], ...over } },
  });
  it('shows where the member is today, and the lifecycle. Nobody is "expected": not arrived means not here', () => {
    const s = seed();
    expect(memberStatus(s, s.members.m10, T)).toEqual({ key: 'in', at: '09:48' });
    // not checked in yet: simply off, with the informational usual arrival ("Usually arrives around 10:05")
    expect(memberStatus(s, s.members.m1, T)).toEqual({ key: 'off', usual: '10:05' });
    expect(memberStatus(s, s.members.m1, '2026-10-24').key).toBe('closed'); // Saturday
    expect(memberStatus(s, s.members.m1, '2026-10-22')).toEqual({ key: 'off', usual: '10:05' }); // any open day: drop in
    expect(memberStatus(s, { ...s.members.m1, usualArrival: '' }, T)).toEqual({ key: 'off' }); // no usual arrival on file
    const here = visit(s, T, 'm1');
    expect(memberStatus(here, here.members.m1, T)).toEqual({ key: 'in', at: '10:00' });
    const home = visit(s, T, 'm1', { checkOut: { at: '15:40', by: 'staff:s1', method: 'manual' } });
    expect(memberStatus(home, home.members.m1, T)).toEqual({ key: 'home', at: '15:40' });
    const pending: Member = { ...s.members.m1, review: { status: 'pending', crId: 'x' } };
    expect(memberStatus(s, pending, T).key).toBe('pending');
    const ending: Member = { ...s.members.m1, memberships: [{ start: '2025-03-03', lastDay: '2026-10-28' }] };
    expect(endingOn(ending, T)).toBe('2026-10-28');
    expect(memberStatus(s, ending, '2026-10-29').key).toBe('ended');
    expect(endingOn(ending, '2026-10-29')).toBeUndefined();
    expect(memberStatus(s, { ...s.members.m1, memberships: [{ start: '2026-11-02' }] }, T)).toEqual({ key: 'upcoming', on: '2026-11-02' });
  });
  it('new member for 30 days from the first start', () => {
    const m = { memberships: [{ start: '2026-10-01' }] } as Member;
    expect(isNewMember(m, '2026-10-30')).toBe(true);
    expect(isNewMember(m, '2026-10-31')).toBe(false);
    expect(isNewMember({ memberships: [{ start: '2020-01-01' }, { start: '2026-10-01' }] } as Member, T)).toBe(false); // reactivating does not re-tag
  });
});

describe('search', () => {
  it('matches names, family names and phones in local or international form', () => {
    const s = seed();
    expect(matchesQuery(s, s.members.m10, 'laras')).toBe(true);
    expect(matchesQuery(s, s.members.m10, '0816-1436')).toBe(true);
    expect(matchesQuery(s, s.members.m10, '62 816 1436 6582')).toBe(true);
    expect(matchesQuery(s, s.members.m10, '12')).toBe(false); // too short to be a phone fragment
    expect(matchesQuery(s, s.members.m1, 'daniel')).toBe(true);
    expect(matchesQuery(s, s.members.m1, 'purnomo')).toBe(false);
  });
});

describe('face consent', () => {
  it('opt-out stops recognition; missing records count as consent only when enrolled', () => {
    const s = seed();
    expect(faceConsent(s.members.m1)).toBe(true);
    expect(faceReady(s.members.m1)).toBe(true);
    const out: Member = { ...s.members.m1, consents: s.members.m1.consents.map((c) => (c.kind === 'face' ? { ...c, granted: false } : c)) };
    expect(faceConsent(out)).toBe(false);
    expect(faceReady(out)).toBe(false);
    expect(faceReady({ ...s.members.m1, face: { enrolled: false } })).toBe(false);
  });
});

describe('documents', () => {
  it('the nanny KTP is only listed when there is a nanny', () => {
    expect(documentTypes({ nanny: null })).toEqual(['ktp', 'membershipForm', 'healthInfo']);
    expect(documentTypes({ nanny: { name: 'Sari' } })).toEqual(DOC_TYPES);
  });
});

describe('final invoice maths', () => {
  const visit = (s: ClubState, date: string, memberId = 'm1'): ClubState => ({
    ...s, attendance: { ...s.attendance, [`${date}:${memberId}`]: { id: `${date}:${memberId}`, clubId: 'citra', createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] } },
  });
  const billed = (s: ClubState, dates: string[], over: Partial<Invoice> = {}): ClubState => ({
    ...s, invoices: { ...s.invoices, 'x-1': { id: 'x-1', clubId: 'citra', createdAt: '', createdBy: 'staff:s10', number: 'INV-X', memberId: 'm1', payerFamilyId: 'f1', kind: 'monthly', issueDate: '2026-10-15', dueDate: '2026-10-27', va: '', xero: 'draft', reminders: [], callNotes: [],
      lines: [{ id: 'extra-2026-10', kind: 'extraDay', label: 'inv.line.extra', qty: dates.length, unit: 650000, amount: dates.length * 650000, refMonth: '2026-10', dates }], ...over } },
  });
  it('months to look at: from the month before the last invoice run to the month of the last day', () => {
    const s = seed();
    const last = Object.values(s.invoiceRuns).map((r) => r.period).sort().at(-1)!;
    expect(unbilledExtraMonths(s, s.members.m1, '2026-10-29')[0]).toBe(addMonths(last, -1));
    expect(unbilledExtraMonths(s, s.members.m1, '2026-10-29').at(-1)).toBe('2026-10');
    expect(unbilledExtraMonths(s, s.members.m1, '2026-12-15').at(-1)).toBe('2026-12');
    // never before the membership started
    const joined: Member = { ...s.members.m1, memberships: [{ start: '2026-10-05' }] };
    expect(unbilledExtraMonths(s, joined, '2026-10-29')).toEqual(['2026-10']);
  });
  it('only Flex visits beyond the quota are billed: 10 of 10 visits is nothing, the 11th is an extra day', () => {
    const s = seed();
    expect(finalInvoiceLines(s, s.members.m1, '2026-10-29', T)).toEqual([]);
    expect(finalInvoiceFor(s, s.members.m1, '2026-10-29', T)).toBeNull();
    const v = visit(s, T);
    const lines = finalInvoiceLines(v, v.members.m1, '2026-10-29', T);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'extraDay', qty: 1, unit: 650000, amount: 650000, refMonth: '2026-10', dates: [T] });
    const inv = finalInvoiceFor(v, v.members.m1, '2026-10-29', T)!;
    expect(inv).toMatchObject({ kind: 'final', memberId: 'm1', number: 'INV-2610-001-F', issueDate: T, dueDate: '2026-11-12', xero: 'draft' });
    // Gold has no quota, so no extras
    const gold = visit(s, T, 'm46');
    expect(finalInvoiceFor(gold, gold.members.m46, '2026-10-29', T)).toBeNull();
  });
  it('is by date: a day already on an invoice is not billed again, a later one is; a voided invoice bills nothing', () => {
    const s = visit(visit(seed(), T), T2);
    expect(finalInvoiceLines(s, s.members.m1, '2026-10-29', T2)[0]).toMatchObject({ qty: 2, dates: [T, T2] });
    const one = billed(s, [T]);
    expect([...billedExtraDates(one, 'm1')]).toEqual([T]);
    expect(finalInvoiceLines(one, one.members.m1, '2026-10-29', T2)[0]).toMatchObject({ qty: 1, amount: 650000, dates: [T2] });
    const both = billed(s, [T, T2]);
    expect(finalInvoiceLines(both, both.members.m1, '2026-10-29', T2)).toEqual([]);
    const voided = billed(s, [T, T2], { voided: { at: `${T}T11:00`, by: 'staff:s9', reason: 'x' } });
    expect(billedExtraDates(voided, 'm1').size).toBe(0);
    expect(finalInvoiceLines(voided, voided.members.m1, '2026-10-29', T2)[0]).toMatchObject({ qty: 2 });
    // visits after the last day are not on the final invoice
    expect(finalInvoiceLines(s, s.members.m1, T, T2)[0]).toMatchObject({ qty: 1, dates: [T] });
  });
  it('the open balance sums open invoices only', () => {
    const s = seed();
    expect(openBalance(s, 'm1', T)).toBe(2700000);
    expect(openBalance(s, 'm2', T)).toBe(0);
    expect(openBalance(s, 'm20', T)).toBe(3950000 * 2); // the overdue September invoice and October's
  });
});

describe('reviews', () => {
  it('maps a section to the tab that shows it and lists requests by state', () => {
    expect(tabForSection('details')).toBe('overview');
    expect(tabForSection('docsConsent')).toBe('docs');
    expect(tabForSection('allergies')).toBe('health');
    expect(tabForSection('plan')).toBe('plan');
    expect(tabForSection('family')).toBe('family');
    const s = seed();
    expect(pendingReviewsFor(s, 'm10').map((c) => c.id)).toEqual(['cr-seed-1']);
    expect(pendingReviewsFor(s, 'm1')).toEqual([]);
    expect(allPendingReviews(s)).toHaveLength(1);
    expect(appliedReviews(s).map((c) => c.id)).toEqual(['cr-seed-2']); // the nurse's care change that was applied at once
    expect(handledReviews(s)).toEqual([]);
  });
});

describe('validateNewMember', () => {
  const ok = { name: 'Siti Rahma', dob: '1946-03-12', usualArrival: '10:00', plan: 'flex' as const, start: '2026-10-26', contact: { name: 'Rudi', phone: '+6281340007777', relation: 'son' as const, primary: true }, formMediaId: 'md_testregistrationform01', consent: { data: true, face: true } };
  it('accepts a complete form and reports each field when it is not', () => {
    expect(validateNewMember(ok, T)).toEqual([]);
    expect(validateNewMember({}, T).map((i) => i.field).sort()).toEqual(['consentData', 'contact', 'dob', 'form', 'name', 'plan', 'start']); // the usual arrival is optional; the signed paper form is required
    expect(validateNewMember({ ...ok, formMediaId: '' }, T)[0]).toMatchObject({ field: 'form', code: 'members.err.formRequired' });
    expect(validateNewMember({ ...ok, name: 'A' }, T)[0]).toEqual({ field: 'name', code: 'members.err.nameRequired', params: undefined });
    expect(validateNewMember({ ...ok, dob: '2015-01-01' }, T)[0].code).toBe('members.err.dobInvalid'); // age 11
    expect(validateNewMember({ ...ok, usualArrival: '' }, T)).toEqual([]);
    expect(validateNewMember({ ...ok, usualArrival: '25:61' }, T)[0]).toMatchObject({ field: 'usualArrival', code: 'members.err.arrivalInvalid' });
    expect(validateNewMember({ ...ok, start: '2026-10-24' }, T)[0].field).toBe('start');
    expect(validateNewMember({ ...ok, contact: { ...ok.contact, phone: '12' } }, T)[0]).toMatchObject({ field: 'phone', code: 'members.err.phoneInvalid' });
    expect(validateNewMember({ ...ok, nanny: { name: ' ' } }, T)[0].field).toBe('nannyName');
    // without a clock the date-relative checks are skipped (action parse)
    expect(validateNewMember({ ...ok, dob: '2030-01-01', start: '2020-01-01' })).toEqual([]);
  });
});

describe('list rows: last visit', () => {
  const checkIn = (s: ClubState, date: string, memberId: string): ClubState => ({
    ...s, attendance: { ...s.attendance, [`${date}:${memberId}`]: { id: `${date}:${memberId}`, clubId: 'citra', createdAt: `${date}T10:00`, createdBy: 'staff:s1', memberId, date, checkIn: { at: '10:00', by: 'staff:s1', method: 'manual' }, queueAdds: [], dismissed: [], edits: [] } },
  });
  it('is the latest check-in day up to today, per member', () => {
    let s = seed();
    s = checkIn(checkIn(s, '2026-10-12', 'm5'), '2026-10-19', 'm5');
    s = checkIn(s, '2026-11-02', 'm5'); // a day after today never counts
    const last = lastVisits(s, T);
    expect(last.m5).toBe('2026-10-19');
    // today's check-in counts as the last visit (the row shows "in the club" for it)
    expect(lastVisits(s, T).m10).toBe(T);
    expect(lastVisits(checkIn(s, T2, 'm5'), T).m5).toBe('2026-10-19');
  });
  it('ignores rows with no check-in and members who never came', () => {
    const s = seed();
    const noIn: ClubState = { ...s, attendance: { ...s.attendance, '2026-10-20:m47x': { id: '2026-10-20:m47x', clubId: 'citra', createdAt: '', createdBy: 'staff:s1', memberId: 'm47x', date: '2026-10-20', queueAdds: [], dismissed: [], edits: [] } } };
    expect(lastVisits(noIn, T).m47x).toBeUndefined();
  });
  it('memberRows carries lastVisit and leaves it out when the member never visited', () => {
    const s = seed();
    const ever = Object.fromEntries(Object.values(s.attendance).filter((a) => a.checkIn && a.date <= T).map((a) => [a.memberId, true]));
    for (const r of memberRows(s, T)) expect(r.lastVisit !== undefined).toBe(!!ever[r.m.id]);
    const row = memberRows(s, T).find((r) => r.m.id === 'm10')!;
    expect(row.lastVisit).toBe(T);
    expect(row.st).toEqual({ key: 'in', at: '09:48' });
  });
});

describe('photo review', () => {
  const photo = (id: string, over: Partial<Photo>): Photo => ({ id, clubId: 'citra', createdAt: '2026-10-21T10:00', createdBy: 'staff:s5', date: T, time: '10:00', kind: 'solo', media: 'photo', memberIds: ['m1'], tone: 1, takenBy: 's5', visibility: 'pending', ...over });
  const withPhotos = (s: ClubState, ps: Photo[]): ClubState => ({ ...s, photos: { ...s.photos, ...Object.fromEntries(ps.map((p) => [p.id, p])) } });
  it('lists only live photos that wait for approval, newest first', () => {
    const s = withPhotos(seed(), [
      photo('pa', { createdAt: '2026-10-21T09:50' }),
      photo('pb', { createdAt: '2026-10-21T10:30', kind: 'group', memberIds: ['m1', 'm10'] }),
      photo('pc', { visibility: 'visible' }),
      photo('pd', { visibility: 'hidden' }),
      photo('pe', { visibility: 'removed' }),
      photo('pf', { deletedAt: '2026-10-21T11:00' }),
      photo('pg', { createdAt: '2026-10-20T15:00', kind: 'lunch', memberIds: [] }),
    ]);
    expect(pendingPhotos(s).map((p) => p.id)).toEqual(['pb', 'pa', 'pg']);
    expect(pendingPhotoCount(s)).toBe(3);
  });
  it('the seed has nothing waiting; a visible photo is not counted', () => {
    expect(pendingPhotoCount(seed())).toBe(0);
    expect(pendingPhotoCount(withPhotos(seed(), [photo('pv', { visibility: 'visible' })]))).toBe(0);
  });
  it('names the kind of a pending photo for the review grid', () => {
    expect(photoReviewKind({ kind: 'lunch' })).toBe('lunch');
    expect(photoReviewKind({ kind: 'group' })).toBe('group');
    expect(photoReviewKind({ kind: 'arrival' })).toBe('arrival');
    expect(photoReviewKind({ kind: 'solo' })).toBe('solo');
    expect(photoReviewKind({ kind: 'activity' })).toBe('activity'); // KC round 7: a picture of a session, no members
  });
});

describe('subscription start and end (month to month)', () => {
  const mem = (memberships: Member['memberships']): Member => ({ ...seed().members.m1, memberships });
  it('subStart is the current membership start', () => {
    expect(subStart(mem([{ start: '2025-03-12' }]))).toBe('2025-03-12');
    expect(subStart(mem([{ start: '2024-01-02', lastDay: '2024-06-30' }, { start: '2025-02-03' }]))).toBe('2025-02-03');
  });
  it('a running membership renews at the end of this month', () => {
    expect(subEnd(mem([{ start: '2025-03-12' }]), '2026-10-21')).toEqual({ on: '2026-10-31', kind: 'renews' });
    expect(subEnd(mem([{ start: '2025-03-12' }]), '2026-02-10')).toEqual({ on: '2026-02-28', kind: 'renews' });
    expect(subEnd(mem([{ start: '2025-03-12' }]), '2028-02-10')).toEqual({ on: '2028-02-29', kind: 'renews' });
  });
  it('a membership that starts later renews at the end of its start month', () => {
    expect(subEnd(mem([{ start: '2026-11-04' }]), '2026-10-21')).toEqual({ on: '2026-11-30', kind: 'renews' });
  });
  it('an ending membership ends on its last day (today included), an ended one has ended', () => {
    expect(subEnd(mem([{ start: '2025-03-12', lastDay: '2026-10-28' }]), '2026-10-21')).toEqual({ on: '2026-10-28', kind: 'ends' });
    expect(subEnd(mem([{ start: '2025-03-12', lastDay: '2026-10-21' }]), '2026-10-21')).toEqual({ on: '2026-10-21', kind: 'ends' });
    expect(subEnd(mem([{ start: '2025-03-12', lastDay: '2026-09-30' }]), '2026-10-21')).toEqual({ on: '2026-09-30', kind: 'ended' });
  });
  it('memberRows carries both and sortMemberRows orders by them, name first, dateless last', () => {
    const rows = memberRows(seed(), T);
    for (const r of rows) {
      if (r.pending) { expect(r.subStart).toBeUndefined(); continue; }
      expect(r.subStart).toBe(subStart(r.m));
      expect(r.subEnd).toEqual(subEnd(r.m, T));
    }
    expect(sortMemberRows(rows, 'name')).toBe(rows);
    const dated = rows.filter((r) => r.subStart);
    const asc = sortMemberRows(rows, 'startOld');
    const desc = sortMemberRows(rows, 'startNew');
    expect(asc).toHaveLength(rows.length);
    const sa = asc.map((r) => r.subStart).filter(Boolean) as string[];
    expect(sa).toEqual([...sa].sort());
    expect(sa).toHaveLength(dated.length);
    const sd = desc.map((r) => r.subStart).filter(Boolean) as string[];
    expect(sd).toEqual([...sa].reverse());
    const se = sortMemberRows(rows, 'endSoon').map((r) => r.subEnd?.on).filter(Boolean) as string[];
    expect(se).toEqual([...se].sort());
  });
  it('dateless rows go last and ties keep the name order', () => {
    const base = memberRows(seed(), T)[0];
    const mk = (id: string, start?: string): MemberRow => ({ ...base, m: { ...base.m, id }, subStart: start, subEnd: undefined });
    const out = sortMemberRows([mk('a'), mk('b', '2025-01-01'), mk('c', '2025-01-01'), mk('d', '2024-01-01')], 'startOld');
    expect(out.map((r) => r.m.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(sortMemberRows([mk('a'), mk('b', '2025-01-01'), mk('c', '2025-01-01'), mk('d', '2026-01-01')], 'startNew').map((r) => r.m.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});
