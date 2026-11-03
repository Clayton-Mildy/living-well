// Round 17 seed: the terms and conditions (version 1, English and Indonesian), every seeded family contact has agreed to it except Sinta Halim (the demo contact who
// meets the first-sign-in gate), and a handful of active members who came fewer than 5 days this month, with one call already logged (Caca reached Opa Hendra's family).
// Fixed values, no random draws; the same ids for 5 and 45 members. Runs before the mood marks (which are written for every visit left).
import type { ClubState, FamilyContact, ISODate, TermsVersion } from '../../types';
import { e164, live, ym } from '../../util';

export const TERMS_V1_EN = `# Plans and visits
- Flex covers {flexQuota} visit days a month; Gold covers every open day. Other plans are listed under Plans in the app.
- A visit day starts when the front desk checks the member in and ends at check-out.
- Visit days do not carry over to the next month.
# Monthly billing
- Each month's invoice is issued on day {issueDay} of that month and is due on day {dueDay}.
- Fees for extra days, pick-up, field trips and celebration extras are added to the next invoice.
- An invoice that stays unpaid puts the membership on hold, and the club may end it after we have tried to reach the family.
# Changing or stopping a plan
- Plan changes and stopping must be asked for at least {noticeDays} days before the month they start. Later requests apply from the month after.
- Leave (cuti) is asked for in the app or at the front desk and is billed at the leave fee while the place is kept.
# Pick-up and field trips
- Pick-up is a monthly service with its own price. Field trips are optional and charged only to the members who went.
# Birthdays and celebrations
- The club celebrates birthdays and anniversaries with the family. Extras such as a cake are agreed with the family first and billed on the next invoice.
# Photos and privacy
- Staff take photos of the day. Families see only photos of their own parent; faces of other members are never shared with a family.
- Face check-in uses a photo kept only to recognise the member at the door.
# Health information
- Readings (blood pressure, temperature, weight) and care notes are kept for the member's care and shared with the family contacts the member has listed.
- Tell us about changes in medicine, allergies or diagnosis so the care plan stays right.
# Agreeing
- By tapping Agree and continue you confirm that you have read these terms for yourself and the member you are family for.`;

export const TERMS_V1_ID = `# Paket dan kunjungan
- Flex mencakup {flexQuota} hari kunjungan sebulan; Gold mencakup setiap hari buka. Paket lain ada di menu Paket di aplikasi.
- Satu hari kunjungan dimulai saat resepsionis mencatat kedatangan anggota dan berakhir saat pulang.
- Hari kunjungan tidak dibawa ke bulan berikutnya.
# Tagihan bulanan
- Tagihan setiap bulan terbit pada tanggal {issueDay} bulan itu dan jatuh tempo pada tanggal {dueDay}.
- Biaya hari tambahan, antar-jemput, wisata dan tambahan perayaan dimasukkan ke tagihan berikutnya.
- Tagihan yang belum dibayar membuat keanggotaan ditahan, dan klub dapat mengakhirinya setelah mencoba menghubungi keluarga.
# Mengubah atau berhenti
- Perubahan paket dan berhenti harus diminta paling lambat {noticeDays} hari sebelum bulan berlaku. Permintaan yang lebih lambat berlaku mulai bulan sesudahnya.
- Cuti diminta lewat aplikasi atau di meja depan dan ditagih sebesar biaya cuti selama tempat tetap disimpan.
# Antar-jemput dan wisata
- Antar-jemput adalah layanan bulanan dengan harga sendiri. Wisata bersifat pilihan dan hanya ditagihkan kepada anggota yang ikut.
# Ulang tahun dan perayaan
- Klub merayakan ulang tahun dan hari jadi bersama keluarga. Tambahan seperti kue disepakati dengan keluarga lebih dulu dan ditagih pada tagihan berikutnya.
# Foto dan privasi
- Staf memotret kegiatan harian. Keluarga hanya melihat foto orang tuanya sendiri; wajah anggota lain tidak pernah dibagikan kepada keluarga.
- Absen wajah memakai foto yang disimpan hanya untuk mengenali anggota di pintu.
# Informasi kesehatan
- Hasil pemeriksaan (tekanan darah, suhu, berat badan) dan catatan perawatan disimpan untuk perawatan anggota dan dibagikan kepada kontak keluarga yang didaftarkan anggota.
- Beri tahu kami bila obat, alergi atau diagnosis berubah agar rencana perawatan tetap tepat.
# Persetujuan
- Dengan menekan Setuju dan lanjutkan, Anda menyatakan telah membaca syarat ini untuk diri Anda dan anggota yang menjadi keluarga Anda.`;

/** Active members who come fewer than 5 days this month on the demo day (the roster ones join Endang, Hendrik and Rizal, who are quiet already). Their last three visits before today stay (the days the daily reports and charts already show), and today's (so the day's check-ins are untouched). */
export const FEW_VISITS_IDS = ['m2', 'm20', 'm46', 'm53', 'm54', 'm62'];
const KEPT_VISITS = 3;

/** Remove a member's visits on `days` with everything that hangs off them (readings, logs, photo tags), so nothing dangles. */
function dropDays(s: ClubState, memberId: string, days: Set<ISODate>): void {
  for (const [k, a] of Object.entries(s.attendance)) if (a.memberId === memberId && days.has(a.date)) delete s.attendance[k];
  for (const [k, r] of Object.entries(s.readings)) if (r.memberId === memberId && days.has(r.date) && r.kind !== 'monthly') delete s.readings[k];
  for (const [k, l] of Object.entries(s.dailyLogs)) if (l.memberId === memberId && days.has(l.date)) delete s.dailyLogs[k];
  for (const [k, p] of Object.entries(s.photos)) {
    if (!days.has(p.date) || !p.memberIds.includes(memberId)) continue;
    p.memberIds = p.memberIds.filter((id) => id !== memberId);
    if (!p.memberIds.length && p.kind === 'arrival') delete s.photos[k];
  }
  for (const [k, m] of Object.entries(s.moodMarks)) if (m.memberId === memberId && days.has(m.date)) delete s.moodMarks[k];
}

export function seedRound17(s: ClubState, T: ISODate): void {
  // terms v1, published by Ega on the seed's first day; every contact has agreed to it (at the later of the day they were added and the day it was published)
  const publishedAt = s.club.createdAt;
  const v1: TermsVersion = { version: 1, en: TERMS_V1_EN, id: TERMS_V1_ID, publishedAt, publishedBy: s.staff.s9 ? 's9' : 'system' };
  s.club.settings = { ...s.club.settings, terms: [v1] }; // a copy: SETTINGS is shared by every build
  for (const c of Object.values(s.familyContacts)) c.termsAgreed = { version: 1, at: c.createdAt > publishedAt ? c.createdAt : publishedAt };

  // Sinta Halim: Opa Hendra's second daughter, not primary. Her account was opened on 19 Oct and she has never signed in, so she meets the terms gate
  if (s.members.m2) {
    const at = '2026-10-19T10:00';
    const sinta: FamilyContact = {
      id: 'f_sinta', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', username: 'sinta', name: 'Sinta Halim', firstName: 'Sinta',
      phone: e164('+62 817-3340-9026'), lang: 'en', activatedAt: at,
    };
    s.familyContacts[sinta.id] = sinta;
    s.familyLinks['f_sinta:m2'] = { id: 'f_sinta:m2', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', familyId: sinta.id, memberId: 'm2', relation: 'daughter', primary: false, appAccess: true, healthAlerts: true };
  }

  // the few-visits list: these members came 3 days this month before today (4 with today), so they are on it
  const month = ym(T);
  for (const id of FEW_VISITS_IDS) {
    if (!s.members[id] || s.members[id].deletedAt) continue;
    const days = live(s.attendance).filter((a) => a.memberId === id && a.checkIn && ym(a.date) === month && a.date < T).map((a) => a.date).sort();
    // kept: a day with an Alert reading (Opa Hendra's 164/98 is on the health pages and the daily report), then the latest days
    const alert = new Set(live(s.readings).filter((r) => r.memberId === id && r.status === 'alert' && ym(r.date) === month).map((r) => r.date));
    const keep = new Set<ISODate>(days.filter((d) => alert.has(d)).slice(-KEPT_VISITS));
    for (const d of [...days].reverse()) if (keep.size < KEPT_VISITS) keep.add(d);
    const drop = new Set(days.filter((d) => !keep.has(d)));
    if (drop.size) dropDays(s, id, drop);
  }
  // Caca already phoned Opa Hendra's family: reached
  if (s.members.m2 && s.staff.s1) {
    const at = `${T}T09:25`;
    s.visitCalls ??= {};
    s.visitCalls['vcall-seed-1'] = { id: 'vcall-seed-1', clubId: s.clubId, createdAt: at, createdBy: 'staff:s1', memberId: 'm2', month, outcome: 'reached', note: "Cynthia says he'll come more after his check-up", by: 'staff:s1', at };
  }
}
