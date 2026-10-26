// ftoday strings (ID): family Today (round 8).
import type { Same } from '../ns';
import type { ftoday as EN } from '../en/ftoday';

export const ftoday: Same<typeof EN> = {
  // header and the parent switch
  bothParents: 'Kedua orang tua', everyone: 'Semua',
  // the laptop's page heading (round 8c); morning and afternoon are family.goodMorning / goodAfternoon
  backToday: 'Kembali ke hari ini',
  goodEvening: 'Selamat malam, {n}',
  // the hero: one row per parent, the single card
  rowHere: '{n} sedang di klub', rowWentHome: '{n} sudah pulang', rowCame: '{n} datang pada {d}', notYet: '{n} sedang tidak di klub', homeToday: '{n} di rumah hari ini',
  since: 'Sejak {t}', nowWhat: '{a} sekarang', lastVisitDay: 'kunjungan terakhir {d}',
  photoFromF: 'foto dari {d}, kunjungan terakhirnya', photoFromM: 'foto dari {d}, kunjungan terakhirnya', profileAria: 'Buka profil {n}', railAria: 'Hari ini sejauh ini: {n} dari {m} langkah',
  // the day's list
  next: 'Berikutnya', today: 'Hari ini', thatDay: 'Hari itu', wasOn: 'Yang berlangsung', wasOnToday: 'Di klub hari ini',
  lvOpen: 'Buka hari itu', lvPhotosN: '{n} foto', lvPhotosOne: '1 foto', lvSessions: 'Ikut {a}',
  // KC round 9: hari berikutnya
  plan: 'Rencana', planTomorrow: 'Rencana besok', planOn: 'Rencana {d}', planTitleTomorrow: 'Besok di klub', planTitleDay: '{d} di klub', planOpen: 'Buka {from}–{to}', heroOpen: 'Tampilkan seluruh foto', heroPlanGold: 'Paket Gold', heroPlanFlex: 'Paket Flex · {n} dari {q} terpakai', heroPlanFlexExtra: 'Paket Flex · {q} dari {q} terpakai, +{x} ekstra', viewCalendar: 'Lihat kalender', whoAria: 'Hari siapa', heroFold: 'Kecilkan foto lagi', heroSwipeHint: 'Geser untuk melihat foto terbaru', planLunchSafe: 'Dapur mencatat alergi {a} {n}; menu {day} aman.', planLunchAlt: '{d} pada {day} tidak aman untuk alergi {a} {n}, jadi dapur akan menyiapkan {x} sebagai gantinya.', lastVisit: 'Kunjungan terakhir', viewImage: 'Lihat foto', viewImages: 'Lihat {n} foto',
  // the daily log (round 8b; 8d: every round, always in this order)
  dlTitle: 'Catatan harian', dlMood: 'Suasana hati', dlLunch: 'Makan siang', dlActivities: 'Kegiatan', dlNote: 'Catatan tim',
  dlNone: 'Belum dicatat', dlNonePast: 'Tidak dicatat', dlJoinedS: 'Ikut serta', dlSatOutS: 'Tidak ikut',
  dlAte_all: 'Habis', dlAte_most: 'Hampir habis', dlAte_half: 'Setengah porsi', dlAte_little: 'Sedikit', dlAte_none: 'Tidak makan',
  // the health section (round 8d)
  hcTitle: 'Kesehatan', hcOpen: 'Buka Kesehatan', hcOpenFor: 'Kesehatan {n}', hcNone: 'Tidak ada cek kesehatan hari itu', hcNoneToday: 'Belum ada cek kesehatan hari ini',
  hcBy: 'diperiksa oleh {n}', hcKind_arrival: 'Saat tiba', hcKind_departure: 'Sebelum pulang', hcKind_recheck: 'Cek ulang', hcKind_spot: 'Cek sewaktu-waktu', hcKind_monthly: 'Cek bulanan',
  // photos, note, survey
  allN: 'Semua {n}', noteAbout: 'Tentang {n}', surveyTitle: 'Survei singkat',
  // lunch feedback
  fbRow: 'Sampaikan ke dapur soal makan siang', fbSubToday: '{dish} hari ini', fbSubDay: '{dish} · {d}', fbSubNone: 'Ceritakan bagaimana makan siangnya', fbSent: 'Terkirim · dapur akan membalas di sini', fbReplied: 'Dapur sudah membalas',
  fbTitle: 'Masukan makan siang', fbLine: '{what} · {d}. Dapur membalas di sini, di aplikasi.', fbPh: 'Bagaimana makan siang {n}?', fbChange: 'Ubah hari atau menu',
  // the notifications sheet
  allCaught: 'Belum ada yang baru.', showMore: 'Tampilkan lebih banyak',
  nt_arrived: 'Tiba di klub', nt_home: 'Sudah pulang', nt_photos: 'Foto baru', nt_note: 'Catatan dari tim', nt_health: 'Cek kesehatan', nt_billing: 'Tagihan', nt_survey: 'Survei singkat',
  nt_document: 'Dokumen', nt_kitchen: 'Dapur', nt_calendar: 'Kalender klub', nt_plan: 'Paket', nt_club: 'Dari klub',
  moodIs: 'Suasana: {face}', arrivedMood: 'Tiba dengan perasaan {face}', healthMood: 'Cek kesehatan, perasaan {face}', homeMood: 'Pulang dengan perasaan {face}',
};
