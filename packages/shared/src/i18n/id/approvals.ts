// approvals strings (ID).
import type { Same } from '../ns';
import type { approvals as EN } from '../en/approvals';
export const approvals: Same<typeof EN> = {
  pending: 'Menunggu persetujuan', pendingEdit: 'Menunggu persetujuan · ubahan', rejectedMark: 'Ditolak', rejectedWhy: 'Ditolak: {reason}',
  waitingShort: 'Menunggu persetujuan manajemen.', familiesSeeEarlier: 'Keluarga masih melihat versi sebelumnya.',
  menuWaiting: 'Menu mulai {date} menunggu persetujuan manajemen. Sampai saat itu keluarga masih melihat menu sebelumnya.', menuNeeds: 'Manajemen menyetujui perubahan menu sebelum keluarga melihatnya.',
  sub: 'Apa yang dicatat tim tetap tersembunyi dari keluarga sampai Anda menyetujuinya.',
  'tab.profile': 'Profil', 'tab.logs': 'Catatan harian', 'tab.readings': 'Kesehatan', 'tab.photos': 'Foto', 'tab.menu': 'Menu', 'tab.stock': 'Stok', 'tab.history': 'Riwayat', pagerRows: 'Halaman persetujuan', tabsLabel: 'Jenis persetujuan',
  'none.profile': 'Tidak ada perubahan profil untuk disetujui', 'none.profileSub': 'Anggota baru dan perubahan dari staf lain muncul di sini, juga perubahan kesehatan yang langsung berlaku.',
  'none.logs': 'Tidak ada catatan harian untuk disetujui', 'none.logsSub': 'Catatan harian dan catatan untuk keluarga dari tim muncul di sini sebelum keluarga bisa melihatnya.',
  'none.readings': 'Tidak ada hasil ukur kesehatan untuk disetujui', 'none.readingsSub': 'Hasil ukur yang disimpan perawat muncul di sini sebelum keluarga bisa melihatnya.',
  'none.menu': 'Tidak ada perubahan menu untuk disetujui', 'none.menuSub': 'Menu mingguan atau perubahan satu hari dari dapur muncul di sini sebelum keluarga bisa melihatnya.',
  'none.stock': 'Tidak ada permintaan stok untuk disetujui', 'none.stockSub': 'Permintaan dari tim muncul di sini. Supervisor dapur dan keuangan juga bisa menyetujuinya di layar Stok.',
  'mode.item': 'Per item', 'mode.person': 'Per orang', modeLabel: 'Tampilkan persetujuan', personWaiting: '{n} menunggu', approveAllFor: 'Setujui semua ({n})', approvedAllFor: '{n} disetujui untuk {name}.', groupPhotos: 'Foto bersama & aktivitas', otherSection: 'Lainnya · menu, stok, dan cuti', 'none.all': 'Tidak ada yang menunggu persetujuan', 'none.history': 'Belum ada yang ditangani',
  historySub: 'Catatan yang disetujui atau ditolak',
  groupLabel: '{kind} {who}',
  'kind.cr': 'Perubahan', 'kind.flag': 'Sudah berlaku, tinjau', 'kind.log': 'Catatan harian', 'kind.note': 'Catatan untuk keluarga', 'kind.reading': 'Hasil ukur kesehatan', 'kind.version': 'Menu mingguan', 'kind.dayMenu': 'Menu satu hari', 'kind.stock': 'Permintaan stok', 'kind.photo': 'Foto',
  isNew: 'Baru', isEdit: 'Ubahan', editOf: '{kind} (ubahan)',
  sentBy: '{who} · {when}', view: 'Lihat', hide: 'Sembunyikan', approveOne: 'Setujui', rejectOne: 'Tolak', checkRow: 'Pilih {n}',
  'sum.menuVersion': 'Menu mingguan mulai {date}', 'sum.menuChanges': '{n} perubahan', 'sum.menuSame': 'Hidangan sama, tanggal mulai baru', 'sum.dayMenu': 'Menu untuk {date}', 'sum.stock': '{item} · {qty} {unit}',
  was: 'Sebelumnya', now: 'Sekarang', noPrev: 'Catatan baru', none: 'Tidak ada', plus: 'Ditambah', minus: 'Dihapus', area: 'Untuk', section: 'Pos anggaran', requestedBy: 'Diminta oleh', noteLabel: 'Catatan untuk keluarga', pinned: 'Disematkan', staffNoteHidden: 'Catatan khusus staf tetap pribadi.',
  fromTemplate: 'Mengikuti menu mingguan',
  rejectTitleOne: 'Tolak catatan ini', rejectTitleN: 'Tolak {n} catatan', rejectSub: 'Keluarga tidak pernah melihat catatan yang ditolak. Pembuat catatan diberi tahu beserta alasan Anda.', rejectReasonOne: 'Mengapa tidak disetujui?', rejectReasonN: 'Mengapa tidak disetujui?',
  approvedOne: 'Disetujui. Keluarga sekarang bisa melihatnya.', approvedN: '{n} disetujui. Keluarga sekarang bisa melihatnya.', approvedStaffOne: 'Disetujui.', approvedStaffN: '{n} disetujui.',
  rejectedOne: 'Ditolak. Pembuat catatan diberi tahu.', rejectedN: '{n} ditolak. Pembuat catatan diberi tahu.',
  skippedN: '{n} dilewati: sudah ditangani atau tidak lagi menunggu.', conflictN: '{n} tidak bisa diterapkan karena datanya sudah berubah. Buka satu per satu.', nothingDone: 'Tidak ada yang perlu dilakukan: catatan itu sudah ditangani.',
  'notif.rejected.logs': 'Manajemen tidak menyetujui {n} catatan harian Anda: {reason}', 'notif.rejected.readings': 'Manajemen tidak menyetujui {n} hasil ukur kesehatan Anda: {reason}', 'notif.rejected.menu': 'Manajemen tidak menyetujui {n} perubahan menu Anda: {reason}',
  // KC round 7: perubahan perpanjangan yang dicatat meja depan
  'tab.renewals': 'Perpanjangan', 'none.renewals': 'Tidak ada perubahan perpanjangan untuk disetujui', 'none.renewalsSub': 'Perubahan yang dicatat meja depan setelah menelepon keluarga (naik paket, turun paket, cuti, berhenti) muncul di sini.', 'kind.renewal': 'Perpanjangan',
  'sum.renewalUpgrade': 'Naik ke Gold mulai {month}', 'sum.renewalDowngrade': 'Turun ke Flex mulai {month}', 'sum.renewalLeave': 'Cuti di {months}', 'sum.renewalStop': 'Berhenti · hari terakhir {date}',
  renewalChange: 'Perubahan', renewalMonth: 'Bulan', renewalReason: 'Alasan', 'notif.rejected.renewals': 'Manajemen tidak menyetujui {n} perubahan perpanjangan Anda: {reason}',
  // round 13: pembayaran yang dicatat meja depan
  'tab.payments': 'Pembayaran', 'none.payments': 'Tidak ada pembayaran untuk dikonfirmasi', 'none.paymentsSub': 'Tunai dan transfer bank yang dicatat meja depan muncul di sini sampai keuangan atau manajemen mengonfirmasinya.', 'kind.payment': 'Pembayaran',
  'sum.payment': '{amount} {method} · {invoice} · dicatat {who}', 'notif.rejected.payments': 'Keuangan tidak mengonfirmasi {n} catatan pembayaran Anda: {reason}',
  // round 13: permintaan cuti staf (keputusan yang sama dengan Orang → Cuti)
  'tab.leave': 'Cuti', 'none.leave': 'Tidak ada permintaan cuti untuk diputuskan', 'none.leaveSub': 'Cuti yang diajukan staf muncul di sini sampai manajemen menjawab.', 'kind.leave': 'Permintaan cuti',
  'sum.leave': '{range} · {days} · {reason} · sisa {left} dari {n}', 'sum.leaveDays': '{n} hari', 'sum.leaveDay': '1 hari', approveAllLeave: 'Setujui semua',
  rejectSubLeave: 'Staf diberi tahu bahwa permintaannya ditolak, beserta catatan Anda jika ada.', rejectReasonLeave: 'Catatan untuk {name} (opsional)', rejectLeaveTitle: 'Tolak permintaan cuti ini',
  // round 14 (B1): jadwal mingguan dan perubahan satu hari dari tim aktivitas
  'tab.programme': 'Program', 'none.programme': 'Tidak ada perubahan program untuk disetujui', 'none.programmeSub': 'Jadwal mingguan atau perubahan satu hari dari tim aktivitas muncul di sini sebelum orang lain melihatnya.',
  'kind.programme': 'Jadwal mingguan', 'kind.day': 'Program satu hari', 'sum.programmeFrom': 'Mulai {date}', 'sum.programmeSame': 'Sesi sama, tanggal mulai baru', 'sum.programmeDay': 'Program {date}',
  'notif.rejected.programme': 'Manajemen tidak menyetujui {n} perubahan program Anda: {reason}', conflictProgramme: '{n} tidak disetujui: hari itu sudah berubah di kalender sejak dikirim. Kembalikan agar tim aktivitas bisa mengirim ulang.',
};
