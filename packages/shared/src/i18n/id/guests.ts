// guests strings (ID).
import type { Same } from '../ns';
import type { guests as EN } from '../en/guests';

export const guests: Same<typeof EN> = {
  title: 'Pengisi acara',
  // screen
  sessions: 'Sesi', hosts: 'Pengisi', view: 'Tampilan', filter: 'Tampilkan', book: 'Jadwalkan tamu', addHost: 'Tambah pengisi', guest: 'Tamu',
  f_all: 'Semua', f_upcoming: 'Akan datang', f_toPay: 'Belum dibayar', f_paid: 'Lunas', f_cancelled: 'Dibatalkan',
  g_upcoming: 'Akan datang', g_toPay: 'Belum dibayar', g_paid: 'Lunas', g_cancelled: 'Dibatalkan',
  st_booked: 'Terjadwal', st_cancelled: 'Dibatalkan', st_paid: 'Lunas', st_toPay: 'Belum dibayar',
  late: 'Harinya sudah lewat: tandai selesai', overdue: 'Sesi ini pada {date}. Tandai selesai setelah tamu mengajar atau tampil.',
  issue_closed: 'Klub tutup pada hari itu', issue_outing: 'Hari itu diganti jalan-jalan', issue_noSession: 'Jam itu sekarang tidak ada sesi',
  empty: 'Belum ada sesi tamu.', emptyHosts: 'Belum ada pengisi acara.', noSessionsHost: 'Belum ada sesi.', inactive: 'Tidak aktif', owes: '{amount} belum dibayar',
  withGuest: 'bersama {name} · tamu', hint: 'Pengisi acara',
  // kinds
  k_teacher: 'Pengajar', k_entertainer: 'Penghibur', k_speaker: 'Pembicara', k_other: 'Lainnya',
  // session
  when: 'Kapan', status: 'Status', fee: 'Honor', invoice: 'Tagihan', note: 'Catatan', dueOn: 'jatuh tempo {date}', paidOn: 'dibayar {date}', waitingFinance: 'Keuangan bisa membayar ini sebelum atau sesudah sesi.',
  markDone: 'Tandai selesai', markPaid: 'Tandai lunas', whatsapp: 'WhatsApp {name}', keep: 'Pertahankan', cancelBooking: 'Batalkan jadwal', cancelAsk: 'Batalkan {name} pada {date}? Jam itu kembali ke jadwal mingguan.',
  doneToast: 'Ditandai selesai. Keuangan sekarang bisa membayar {name}.', paidToast: '{name} ditandai lunas.', cancelledToast: 'Jadwal dibatalkan.',
  // book sheet
  bookTitle: 'Jadwalkan tamu', editTitle: 'Ubah jadwal', host: 'Pengisi', pickHost: 'Pilih pengisi', newHost: 'Pengisi baru', date: 'Tanggal', session: 'Sesi', pickActivity: 'Pilih kegiatan',
  errDay: 'Pilih hari buka, hari ini atau setelahnya, tanpa jalan-jalan.', takenBy: 'Sudah dijadwalkan: {name}', changesSlot: 'Ini mengubah kegiatan pukul {slot} pada {date}. Guru dan keluarga dikabari.',
  notePh: 'Contoh: perlu mikrofon', bookBtn: 'Jadwalkan', booked: '{name} dijadwalkan pada {date}.', saved: 'Jadwal disimpan.',
  // host
  addHostBtn: 'Tambah pengisi', editHost: 'Ubah pengisi', name: 'Nama', kind: 'Jenis', what: 'Keahlian', whatPh: 'Contoh: Pengajar angklung', phone: 'Telepon', usualFee: 'Honor biasa per sesi',
  bank: 'Bank', account: 'Nomor rekening', holder: 'Nama pemilik rekening', bankDetails: 'Bank', contact: 'Kontak', active: 'Aktif', activeSub: 'Pengisi yang tidak aktif tidak bisa dijadwalkan.',
  tSessions: 'Sesi', tPaid: 'Dibayar', tOwed: 'Belum dibayar', bookHost: 'Jadwalkan {name}', archive: 'Arsipkan pengisi', archiveAsk: 'Arsipkan {name}? Sesi lamanya tetap tercatat.',
  hostAdded: '{name} ditambahkan.', hostSaved: '{name} disimpan.', hostArchived: '{name} diarsipkan.',
  // notifications, feed and errors (guests.ts)
  'notif.booked': '{name} akan memandu {activity} pada {date} pukul {slot}.', 'notif.cancelled': '{name} tidak jadi datang pada {date} pukul {slot}.',
  'notif.toPay': '{name} sudah dipesan: {amount} perlu dibayar ({number}). Bisa dibayar sebelum sesi.', 'notif.paidCancelled': 'Sesi {name} dibatalkan padahal sudah dibayar ({amount}): minta uangnya kembali, atau simpan untuk sesi lain.',
  'feed.booked': 'Tamu dijadwalkan: {name} · {date} {slot}', 'feed.cancelled': 'Tamu dibatalkan: {name} · {date} {slot}', 'feed.done': 'Sesi tamu selesai: {name} · {date} {slot}',
  'err.dupHost': '“{name}” sudah menjadi pengisi acara.', 'err.hostInactive': '{name} tidak aktif. Aktifkan dulu.', 'err.slotTaken': 'Sudah ada tamu lain pada sesi itu.',
  'err.needActivity': 'Pilih kegiatan yang akan dipandu tamu.', 'err.hostBooked': '{name} masih punya jadwal. Batalkan atau tandai selesai dulu.',
  'err.notBooked': 'Jadwal ini sudah tidak terbuka.', 'err.notYet': 'Bisa ditandai selesai pada harinya.',
};
