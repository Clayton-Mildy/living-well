// KC round 7 seed: guest hosts and one-day programme changes. Runs after the main seed (and the roster), so every staff row, room, activity and the weekly schedule already exist.
// Everything is relative to the demo day T and lands on open club days, so it holds for T = 21 Oct (tests) and for any other day.
//   hosts     Bu Ratna (angklung), Pak Hendro (keroncong), dr. Maya Sari (heart-health talk)
//   sessions  2 done in the last days (one invoice paid, one approved and waiting for finance) · 1 booked on the next open day (paid in advance) · 1 booked next week (to pay)
//   changes   the 13:30 session of the second open day after T becomes Karaoke ("Kak Dimas is off sick"); the booked talk changes the 13:30 session of its day
import type { ClubState, DT, GuestHost, GuestSession, ISODate, ScheduleCell, ScheduleDay, Slot, VendorInvoice, Weekday } from '../../types';
import { dayStatus } from '../../rules/core';
import { guestInvoiceNumber } from '../../rules/guests';
import { addDays, dow } from '../../util';
import { activityPicId } from '../demoMedia';

export function seedGuests(s: ClubState, T: ISODate): void {
  const C = s.clubId;
  const base = (id: string, createdAt: DT, createdBy = 'staff:s9') => ({ id, clubId: C, createdAt, createdBy: createdBy as `staff:${string}` });

  // ---- two activities the guests (and the sick-day cover) need ----
  if (!s.activities['act-karaoke']) s.activities['act-karaoke'] = { ...base('act-karaoke', '2024-06-01T09:00'), name: 'Karaoke', nameId: 'Karaoke', icon: 'music_note', roomId: 'room-music', active: true, photoMediaId: activityPicId('act-karaoke') };
  if (!s.activities['act-talk']) s.activities['act-talk'] = { ...base('act-talk', '2024-06-01T09:00'), name: 'Health talk', nameId: 'Penyuluhan kesehatan', icon: 'health_and_safety', roomId: 'room-lounge', active: true, photoMediaId: activityPicId('act-talk') };

  // ---- open club days around T (no closure, holiday, weekend or outing) ----
  const free = (d: ISODate) => { const st = dayStatus(s, d); return st.open && !st.outing; };
  const openAfter = (from: ISODate, n = 1): ISODate => { let d = from; let left = n; for (let i = 0; i < 90 && left > 0; i++) { d = addDays(d, 1); if (free(d)) left--; } return d; };
  const openFrom = (from: ISODate): ISODate => (free(from) ? from : openAfter(from));

  const weekly = (date: ISODate, slot: Slot): ScheduleCell | null => {
    const v = Object.values(s.scheduleVersions).filter((x) => x.status === 'published' && x.effectiveFrom <= date).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).pop();
    return v?.days[dow(date) as Weekday]?.[slot] ?? null;
  };
  /** One-day change of a slot (merged into the day's row). */
  const change = (date: ISODate, slot: Slot, cell: ScheduleCell, note?: string) => {
    const row: ScheduleDay = s.scheduleDays[date] ?? { ...base(date, `${addDays(T, -1)}T11:00`), date, slots: {} };
    row.slots[slot] = cell;
    if (note) row.note = note;
    s.scheduleDays[date] = row;
  };
  /** A guest leading `activityId` in a slot: the slot changes for that day unless the weekly plan already has that activity. */
  const lead = (date: ISODate, slot: Slot, activityId: string) => {
    const w = weekly(date, slot);
    if (w && w.activityId === activityId) return;
    change(date, slot, { activityId, staffId: w?.staffId ?? 's5', roomId: s.activities[activityId].roomId });
  };

  // ---- hosts ----
  const hosts: GuestHost[] = [
    { ...base('gh-ratna', addDays(T, -70) + 'T09:00'), name: 'Bu Ratna', kind: 'teacher', what: 'Angklung teacher', phone: '+6281290112201', fee: 750000, bank: { bank: 'BCA', account: '2840551163', holder: 'Ratna Wulandari' }, note: 'Brings her own angklung set. Likes the music room.', active: true },
    { ...base('gh-hendro', addDays(T, -70) + 'T09:10'), name: 'Pak Hendro', kind: 'entertainer', what: 'Keroncong singer', phone: '+6281380445590', fee: 900000, bank: { bank: 'Mandiri', account: '1240009876543', holder: 'Hendro Prasetyo' }, note: 'Needs a microphone and two chairs.', active: true },
    { ...base('gh-maya', addDays(T, -45) + 'T10:00'), name: 'dr. Maya Sari', kind: 'speaker', what: 'Talk on heart health', phone: '+6281118832267', fee: 1200000, bank: { bank: 'BNI', account: '0467721905', holder: 'Maya Sari' }, active: true },
  ];
  for (const h of hosts) s.guestHosts[h.id] = h;

  // ---- sessions ----
  // the two done ones are the latest days the weekly plan already has what the host does (angklung on Monday, keroncong on Wednesday), so history is untouched
  const PAIRS: [string, string, string, number][] = [['gh-ratna', 'act-angklung', 'Bu Ratna', 750000], ['gh-hendro', 'act-keroncong', 'Pak Hendro', 900000]];
  const past: { date: ISODate; slot: Slot; hostId: string; activityId: string; name: string; fee: number }[] = [];
  for (let i = 1; i <= 28 && past.length < 2; i++) {
    const date = addDays(T, -i);
    if (!free(date)) continue;
    for (const slot of ['10:30', '13:30'] as Slot[]) for (const [hostId, activityId, name, fee] of PAIRS) {
      if (past.length < 2 && weekly(date, slot)?.activityId === activityId) past.push({ date, slot, hostId, activityId, name, fee });
    }
  }
  const [p2, p1] = past; // p2: the latest (waiting for finance to pay), p1: the one before (paid)
  const d1 = openAfter(T, 1);
  const d2 = openAfter(T, 2);
  const nextWeek = openFrom(addDays(addDays(T, -((dow(T) + 6) % 7)), 7 + 2)); // Wednesday of next week (or the next open day)
  const sess = (id: string, hostId: string, date: ISODate, slot: Slot, activityId: string, fee: number, status: GuestSession['status'], extra: Partial<GuestSession> = {}): GuestSession => ({
    ...base(id, addDays(date, -6) + 'T10:00'), hostId, date, slot, activityId, fee, status, ...extra,
  });
  const invoice = (id: string, date: ISODate, supplier: string, amount: number, extra: Partial<VendorInvoice>): VendorInvoice => ({
    ...base(id, `${date}T16:30`), supplier, number: guestInvoiceNumber(s, date), amount, due: addDays(date, 7), sectionId: 'activities', status: 'approved', xero: 'pending', decidedBy: 'staff:s9', decidedAt: `${date}T16:30`, ...extra,
  });

  // done, paid
  if (p1) {
    const paidOn = [openAfter(p1.date), addDays(T, -1)].sort()[0];
    s.vendorInvoices['vi-gh-1'] = invoice('vi-gh-1', p1.date, p1.name, p1.fee, { status: 'paid', xero: 'synced', paidOn, paidBy: 'staff:s10' });
    s.guestSessions['gs-1'] = sess('gs-1', p1.hostId, p1.date, p1.slot, p1.activityId, p1.fee, 'done', { vendorInvoiceId: 'vi-gh-1' });
  }
  // done, approved and waiting for finance to pay
  if (p2) {
    s.vendorInvoices['vi-gh-2'] = invoice('vi-gh-2', p2.date, p2.name, p2.fee, { xero: 'synced' }); // already in Xero: a quiet tick has nothing to sweep
    s.guestSessions['gs-2'] = sess('gs-2', p2.hostId, p2.date, p2.slot, p2.activityId, p2.fee, 'done', { vendorInvoiceId: 'vi-gh-2' });
  }
  // booked: the next open day (the talk takes that day's afternoon slot), and next week. KC round 7: the fee is a payable from the booking, so it can be
  // paid before the session: dr. Maya is paid in advance, Pak Hendro's is still to pay (due on the day)
  const booked = (id: string, viId: string, date: ISODate, supplier: string, amount: number, paid: boolean) => {
    s.vendorInvoices[viId] = { ...invoice(viId, date, supplier, amount, paid ? { status: 'paid', xero: 'synced', paidOn: addDays(T, -1), paidBy: 'staff:s10' } : { xero: 'synced' }), createdAt: addDays(date, -6) + 'T10:00', decidedAt: addDays(date, -6) + 'T10:00', due: date };
    s.guestSessions[id].vendorInvoiceId = viId;
  };
  s.guestSessions['gs-3'] = sess('gs-3', 'gh-maya', d1, '13:30', 'act-talk', 1200000, 'booked', { note: 'Slides on the big screen in the lounge.' });
  booked('gs-3', 'vi-gh-3', d1, 'dr. Maya Sari', 1200000, true);
  lead(d1, '13:30', 'act-talk');
  s.guestSessions['gs-4'] = sess('gs-4', 'gh-hendro', nextWeek, '10:30', 'act-keroncong', 900000, 'booked');
  booked('gs-4', 'vi-gh-4', nextWeek, 'Pak Hendro', 900000, false);
  lead(nextWeek, '10:30', 'act-keroncong');

  // ---- a sudden change: the teacher is off sick, Karaoke instead (the cover is the other activity teacher) ----
  const w2 = weekly(d2, '13:30');
  if (w2) {
    const sick = s.staff[w2.staffId];
    const cover = w2.staffId === 's5' ? 's6' : 's5';
    change(d2, '13:30', { activityId: 'act-karaoke', staffId: cover, roomId: 'room-music' }, `${sick?.knownAs || sick?.name || 'The teacher'} is off sick`);
  }
}
