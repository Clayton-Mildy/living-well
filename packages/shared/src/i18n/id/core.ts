// Shell-level strings (ID). Typed against EN so keys stay in sync.
import type { Same } from '../ns';
import type * as EN from '../en/core';

export const common: Same<typeof EN.common> = {
  updating: 'Versi baru siap. Memuat ulang…', somethingWrong: 'Terjadi kesalahan.', reload: 'Muat ulang',
  close: 'Tutup', cancel: 'Batal', save: 'Simpan', saveChanges: 'Simpan perubahan', share: 'Bagikan', copy: 'Salin', edit: 'Ubah', delete: 'Hapus', remove: 'Hapus', add: 'Tambah',
  confirm: 'Konfirmasi', back: 'Kembali', backToday: 'Kembali ke Hari ini', seeAll: 'Lihat semua', today: 'Hari ini', tomorrow: 'Besok', yesterday: 'Kemarin', done: 'Selesai', search: 'Cari',
  all: 'Semua', none: 'Tidak ada', yes: 'Ya', no: 'Tidak', other: 'Lainnya', loading: 'Memuat…', retry: 'Coba lagi', undo: 'Urungkan', next: 'Berikutnya', previous: 'Sebelumnya', continue: 'Lanjut',
  staffOnly: 'Hanya staf', sharedFam: 'Dibagikan ke keluarga', submitReview: 'Kirim untuk ditinjau', pendingReview: 'Menunggu tinjauan', pendingApproval: 'Menunggu persetujuan',
  reviewNote: 'Perubahan Anda dikirim ke manajemen untuk disetujui. Sampai saat itu, data yang sekarang tetap berlaku.', changesLogged: 'Perubahan dicatat dengan nama Anda dan waktunya.',
  required: 'Wajib', optional: 'Opsional', notSet: 'Belum diisi', empty: 'Belum ada apa-apa', more: 'Lainnya', less: 'Lebih sedikit', show: 'Tampilkan', hide: 'Sembunyikan', call: 'Telepon', open: 'Buka',
  noResults: 'Tidak ada yang cocok', demo: 'Demo', reason: 'Alasan', note: 'Catatan', date: 'Tanggal', time: 'Jam', name: 'Nama', phone: 'Nomor ponsel (WhatsApp)', amount: 'Jumlah',
  clubClosed: 'Klub tutup', clubClosedSub: 'Klub tutup hari ini. Kami buka lagi pada {date}.', weekendSub: 'Akhir pekan: klub buka lagi pada {date}.',
  and: 'dan', by: 'oleh {name}', at: 'pukul {time}', minutesAgo: '{n} menit lalu', justNow: 'baru saja',
  // UI kit (Select, DateField, TimeField, Pager, CameraCapture, media)
  pickOne: 'Pilih…', pickDate: 'Pilih tanggal', pickMonth: 'Pilih bulan', pickTime: 'Pilih jam', searchHere: 'Cari…', clear: 'Hapus',
  prevMonth: 'Bulan sebelumnya', nextMonth: 'Bulan berikutnya', prevYear: 'Tahun sebelumnya', nextYear: 'Tahun berikutnya', prevYears: 'Tahun-tahun sebelumnya', nextYears: 'Tahun-tahun berikutnya',
  chooseMonth: 'Pilih bulan', chooseYear: 'Pilih tahun', hour: 'Jam', minute: 'Menit',
  pages: 'Halaman', pagePrev: 'Halaman sebelumnya', pageNext: 'Halaman berikutnya', pageOf: 'Halaman {page} dari {pages}', pageGo: 'Halaman {n}',
  camera: 'Kamera', cameraStarting: 'Menyalakan kamera…', cameraDenied: 'Akses kamera diblokir. Izinkan di pengaturan peramban Anda, atau pilih foto.',
  cameraNone: 'Kamera tidak ditemukan. Pilih foto saja.', takePhoto: 'Ambil foto', retake: 'Ulangi', usePhoto: 'Pakai foto', choosePhoto: 'Pilih foto',
  uploadInstead: 'Unggah foto', switchCamera: 'Ganti kamera', photoPreview: 'Pratinjau foto', processing: 'Menyiapkan foto…',
  mediaType: 'Gunakan foto JPEG, PNG, atau WebP.', mediaTooBig: 'Foto terlalu besar (maks. 5 MB).', mediaFailed: 'Foto tidak dapat diunggah.', docTooBig: 'Berkas terlalu besar (maks. 10 MB).', docType: 'Gunakan foto atau berkas PDF.',
};
export const status: Same<typeof EN.status> = {
  normal: 'Normal', watch: 'Pantau', alert: 'Waspada', paid: 'Lunas', outstanding: 'Belum dibayar', overdue: 'Terlambat', pending: 'Belum dicek', partial: 'Dibayar sebagian', void: 'Dibatalkan',
  approved: 'Disetujui', rejected: 'Ditolak', requested: 'Diminta', received: 'Diterima', declined: 'Ditolak', cancelled: 'Dibatalkan', open: 'Terbuka', answered: 'Dijawab', closed: 'Ditutup',
  suspended: 'Ditangguhkan · belum dibayar', onLeave: 'Cuti · {month}',
};
export const nav: Same<typeof EN.nav> = {
  arrivals: 'Kedatangan', enquiries: 'Calon anggota', members: 'Anggota', health: 'Cek kesehatan', readings: 'Hasil ukur', today: 'Hari ini', camera: 'Kamera', log: 'Catatan harian',
  menu: 'Menu', feedback: 'Masukan', stock: 'Stok', billing: 'Tagihan', payments: 'Pembayaran', budget: 'Anggaran', receipts: 'Kuitansi', overview: 'Ringkasan', broadcast: 'Siaran',
  calendar: 'Kalender dan jadwal', calShort: 'Kalender', people: 'SDM', photos: 'Foto', healthF: 'Kesehatan', venue: 'Venue', more: 'Lainnya', directory: 'Direktori', contacts: 'Kontak',
  surveys: 'Survei', plans: 'Paket dan harga', reviews: 'Persetujuan', requests: 'Permintaan',
  g_front: 'Resepsionis', g_care: 'Perawatan', g_kitchen: 'Dapur', g_finance: 'Keuangan', g_club: 'Klub', allModules: 'Semua modul',
  s_overview: 'Beranda', s_arrivals: 'Datang', s_enquiries: 'Calon', s_members: 'Anggota', s_health: 'Cek', s_readings: 'Tren', s_today: 'Hari ini', s_camera: 'Kamera',
  s_log: 'Catatan', s_menu: 'Menu', s_feedback: 'Masukan', s_stock: 'Stok', s_billing: 'Tagihan', s_payments: 'Bayar', s_budget: 'Anggaran', s_receipts: 'Kuitansi', s_directory: 'Kontak',
  s_calendar: 'Kalender', s_calShort: 'Kalender', s_photos: 'Foto', s_healthF: 'Kesehatan', s_more: 'Lainnya', s_requests: 'Permintaan', s_reviews: 'Persetujuan', s_contacts: 'Kontak',
  // KC round 7
  renewals: 'Perpanjangan', tasks: 'Tugas', guests: 'Pengisi acara', insights: 'Insight kunjungan', memories: 'Kenangan', report: 'Laporan harian', s_report: 'Laporan', s_renewals: 'Perpanjang', s_tasks: 'Tugas', s_guests: 'Pengisi', s_insights: 'Insight', s_memories: 'Kenangan',
};
export const roles: Same<typeof EN.roles> = {
  lobby: 'Lobi', nurse: 'Perawat', activity: 'Pengajar aktivitas', kitchen: 'Dapur & F&B', finance: 'Keuangan', mgmt: 'Manajemen', family: 'Keluarga', housekeeping: 'Kebersihan', driver: 'Sopir',
  lands_lobby: 'Papan kedatangan', lands_nurse: 'Pos kesehatan', lands_activity: 'Aktivitas hari ini', lands_kitchen: 'Menu hari ini', lands_finance: 'Papan tagihan', lands_mgmt: 'Papan kedatangan',
  lands_family: 'Halaman hari ini', lands_housekeeping: 'Permintaan', lands_driver: 'Permintaan', billing: 'tagihan',
};
export const login: Same<typeof EN.login> = {
  signIn: 'Masuk', welcome: 'Selamat datang', loginSub: 'Satu akses masuk untuk tim klub dan keluarga. Gunakan nama pengguna dan kata sandi Anda.',
  username: 'Nama pengguna', password: 'Kata sandi', showPassword: 'Tampilkan kata sandi', hidePassword: 'Sembunyikan kata sandi',
  errEmpty: 'Masukkan nama pengguna dan kata sandi Anda.', errInvalid: 'Nama pengguna atau kata sandi salah. Periksa keduanya, lalu coba lagi.',
  pending: 'Akses Anda menunggu persetujuan klub. Kami akan mengabari lewat WhatsApp.', noAccess: 'Akun ini belum punya akses aplikasi. Minta klub mengaktifkannya.',
  forgot: 'Lupa kata sandi? Minta manajer klub untuk mengatur ulang.', demoHint: 'Demo: nama depan huruf kecil · kata sandi {pw}',
  demoAccounts: 'Akun demo', demoAccountsSub: 'Ketuk akun untuk masuk tanpa kata sandi.', tagline: 'Menambah tahun dalam hidup, dan hidup dalam setiap tahun.',
  philosophy: 'Lebih banyak keramahan, bukan rumah sakit', photoPh: 'Foto: anggota bersama keluarga di ruang taman', footer: 'Klub Living Well Seniors Communities · buka Senin sampai Jumat, 08.30–16.30', photoAlt: 'Seorang anggota bersama putrinya, tersenyum bersama',
  club: 'CitraPremier | Premium Seniors Club',
  signInSection: 'Masuk', usernameFixed: 'Nama pengguna tidak dapat diubah.', changePassword: 'Ubah kata sandi', currentPassword: 'Kata sandi saat ini', newPassword: 'Kata sandi baru',
  confirmPassword: 'Ulangi kata sandi baru', passwordHint: 'Minimal {n} karakter.', errCurrent: 'Kata sandi saat ini salah.', errShort: 'Gunakan minimal {n} karakter.',
  errLong: 'Gunakan paling banyak {n} karakter.', errSame: 'Pilih kata sandi yang berbeda dari yang sekarang.', errMismatch: 'Kedua kata sandi baru tidak sama.', passwordChanged: 'Kata sandi Anda sudah diubah.',
  resetPassword: 'Atur ulang kata sandi', resetConfirm: 'Kembalikan kata sandi {name} ke kata sandi bawaan?', resetDone: 'Kata sandi {name} dikembalikan ke bawaan ({pw}).',
};
export const shell: Same<typeof EN.shell> = {
  account: 'Akun', signOut: 'Keluar', language: 'Bahasa', languageName: 'Bahasa · Language', profile: 'Data Anda', yourName: 'Nama Anda', yourPhone: 'Nomor ponsel Anda',
  profileSaved: 'Data Anda tersimpan.', profileSubmitted: 'Dikirim ke klub untuk disetujui. Data lama tetap berlaku sampai saat itu.', clubhouse: 'Klub', switchClub: 'Ganti klub',
  clubNote: '{m} anggota · {s} staf', openingNote: 'Buka 2027', notifications: 'Notifikasi', needsAction: 'Perlu tindakan', updates: 'Kabar terbaru', markAllRead: 'Tandai semua sudah dibaca',
  nothingAction: 'Tidak ada yang perlu Anda tangani saat ini.', nothingUpdates: 'Belum ada kabar.', bell: 'Notifikasi, {n} baru', live: 'Langsung',
  offline: 'Sedang offline. Perubahan akan tersinkron saat koneksi kembali.', reconnecting: 'Menyambung ulang…', changeFailed: 'Gagal disimpan: {reason}', menu: 'Menu',
};
export const notif: Same<typeof EN.notif> = {
  checkedIn: '{name} check-in pukul {time}.', checkedOut: '{name} check-out pukul {time}.', newPhotos: '{n} foto baru {name}.', logSaved: 'Catatan harian {name} sudah ada: {mood}.',
  paymentReceived: 'Pembayaran diterima dari {name} untuk {invoice}.', reviewSubmitted: '{who} mengirim perubahan untuk ditinjau ({section}).', reviewFlagged: '{who} mengubah data kesehatan ({section}). Sudah berlaku; mohon ditinjau.',
  reviewApproved: 'Perubahan Anda disetujui ({section}).', reviewRejected: 'Perubahan Anda tidak disetujui ({section}): {note}', reviewReverted: 'Manajemen membatalkan perubahan Anda ({section}).',
  'act.review': 'Perubahan untuk ditinjau: {name} · {section}', 'act.reviewFlagged': 'Perubahan kesehatan sudah berlaku, mohon ditinjau: {name} · {section}', 'act.alertReading': 'Hasil ukur waspada: {name} · {value}',
  'act.contract': 'Kontrak berakhir {date}: {name}', 'act.complaint': 'Masukan makanan terbuka: {name} · {dish}', 'act.overdue': 'Tagihan terlambat: {name} · {number}', 'act.budgetApprove': 'Permintaan anggaran untuk disetujui: {item}',
  'act.receiptApprove': 'Kuitansi untuk disetujui: {supplier}', 'act.vendorApprove': 'Tagihan pemasok untuk disetujui: {supplier}', 'act.invoiceRun': 'Penerbitan tagihan {month} sudah waktunya', 'act.stockApprove': 'Permintaan stok untuk disetujui: {item} ({qty})',
  'act.planRequest': '{name}: keluarga minta pindah ke paket {plan} mulai {date}', 'act.guestTrial': 'Tamu uji coba datang {time}: {name}', 'act.guestTrialDay': 'Hari uji coba hari ini: {name}', 'act.photosReview': 'Foto menunggu persetujuan Anda: {n}', 'act.approvalsLogs': 'Catatan harian dan catatan menunggu persetujuan: {n}', 'act.approvalsReadings': 'Hasil ukur kesehatan menunggu persetujuan: {n}', 'act.approvalsMenu': 'Perubahan menu menunggu persetujuan: {n}', 'act.guestVisit': 'Kunjungan pukul {time}: {name}', 'act.readyCheckout': 'Cek pulang selesai: {name} siap pulang',
  'act.queue': '{n} menunggu di pos kesehatan', 'act.logs': '{n} catatan harian belum ditulis', 'act.allergen': 'Bentrok alergi saat makan siang: {name} · {dish}',
  'act.invoiceDue': 'Tagihan untuk dibayar: {name} · {number}', 'act.invoiceOverdue': 'Tagihan terlambat: {name} · {number}', 'act.survey': 'Ceritakan pengalaman Anda: {title}', 'act.docRequested': 'Dokumen diminta untuk {name}',
};
export const feed: Same<typeof EN.feed> = {
  planRequested: '{name}: keluarga meminta pindah ke paket {plan}', planWithdrawn: '{name}: keluarga membatalkan permintaan ganti paket',
  checkedIn: '{name} check-in', checkedOut: '{name} check-out', memberCreatedForm: 'Data anggota dibuat dari formulir keanggotaan', reading: 'Hasil ukur {name}: {value}',
  reviewApproved: 'Perubahan disetujui ({section})', reviewReverted: 'Perubahan dibatalkan ({section})',
};
export const err: Same<typeof EN.err> = {
  planRequestPending: 'Permintaan ganti paket sudah menunggu konfirmasi klub.', planRequestEnding: 'Keanggotaan ini akan berakhir, jadi paket tidak bisa diganti.', planRequestDone: 'Klub sudah memproses permintaan ini.',
  unknownAction: 'Tindakan itu tidak tersedia.', forbidden: 'Anda tidak punya izin untuk itu.', notFound: 'Data itu sudah tidak ada.', noChanges: 'Tidak ada yang berubah.',
  reviewNotPending: 'Perubahan ini sudah ditangani.', reviewConflict: 'Data sudah berubah sejak dikirim ({fields}). Tinjau lagi atau tetap setujui.', noteRequired: 'Mohon tambahkan catatan.',
  memberPending: 'Anggota ini masih menunggu persetujuan manajemen.', memberNotActive: 'Keanggotaan ini tidak aktif hari ini.', alreadyCheckedIn: 'Sudah check-in.',
  alreadyCheckedOut: 'Sudah check-out.', notCheckedIn: 'Belum check-in.', network: 'Tidak terhubung ke server klub.', invalid: 'Mohon periksa kolom yang ditandai.', closedDay: 'Klub tutup pada hari itu.',
  suspended: 'Keanggotaan ditangguhkan: invoice {number} ({amount}) belum dibayar. Check-in lagi setelah dibayar.', onLeave: '{name} sedang cuti pada {month}.',
  leaveLate: 'Cuti untuk {month} harus diajukan tertulis 14 hari sebelum akhir bulan sebelumnya: paling lambat {deadline}. Tanggal itu sudah lewat.', leaveAlready: 'Sudah ada cuti untuk {month}.',
  leaveMax: 'Cuti paling lama {max} bulan berturut-turut.', leaveEnding: 'Keanggotaan ini akan atau sudah berakhir, jadi cuti tidak bisa diajukan.', leaveLocked: 'Cuti ini sudah dikonfirmasi: bisa dibatalkan sampai {deadline}.',
};
export const review: Same<typeof EN.review> = {
  newMember: 'Anggota baru', conversion: 'Calon bergabung', details: 'Data diri', plan: 'Paket', docsConsent: 'Dokumen dan persetujuan', family: 'Kontak keluarga', allergies: 'Alergi', medicines: 'Obat', care: 'Petunjuk perawatan',
};
export const demo: Same<typeof EN.demo> = {
  pill: 'Demo', title: 'Alat demo', guided: 'Demo terpandu', guidedTitle: 'Hari Oma Lina', progress: '{n} dari {total} langkah selesai', switchAccount: 'Ganti akun',
  's1.title': 'Check-in wajah di pintu', 's1.sub': 'Oma Lina datang. Kamera pintu mengenalinya, lobi mengonfirmasi, dan Maria serta Daniel langsung dikabari. Ini kunjungan ke-11 di bulan Oktober, jadi dihitung sebagai hari tambahan.', 's1.run': 'Buka lobi',
  's2.title': 'Cek kesehatan: tensi sedikit tinggi', 's2.sub': 'Ns. Dewi membaca PC-303: 152/94. Ia mencatat lengan kanan, membagikannya ke keluarga, dan menjadwalkan cek ulang.', 's2.run': 'Buka pos kesehatan',
  's3.title': 'Foto sendiri dan foto bersama', 's3.sub': 'Dinar memotret saat keroncong. Ega menyetujuinya di Tinjauan, lalu setiap keluarga hanya melihat anggotanya sendiri.', 's3.run': 'Ambil foto',
  's4.title': 'Foto makan siang dari dapur', 's4.sub': 'Chef Agus mengunggah makan siang hari ini; setelah disetujui manajemen, keluarga melihatnya di halaman Hari ini; rencana alergi ikan Bapak Bambang ada di papan dapur.', 's4.run': 'Unggah foto makan siang',
  's5.title': 'Catatan harian: makan setengah', 's5.sub': 'Dinar menulis catatan Oma Lina. Catatan ini muncul di “Dari tim” pada halaman Hari ini milik Maria.', 's5.run': 'Tulis catatan',
  's6.title': 'Cek pulang dan waktu pulang', 's6.sub': 'Tensi kedua sebelum pulang (134/84), lalu lobi melakukan check-out. Keluarga dikabari.', 's6.run': 'Check-out',
  's7.title': 'Maria membuka Hari ini', 's7.sub': 'Maria membaca kabar hari ini, catatan tim, dan foto-foto di halaman Hari ini.', 's7.run': 'Buka Hari ini milik Maria',
  's8.title': 'Maria melihat kunjungan tambahan', 's8.sub': 'Paket Flex mencakup 10 kunjungan per bulan. Oma Lina sudah memakai 10 kunjungan di Oktober, jadi hari ini menjadi hari tambahan (Rp 650.000) di tagihan November.', 's8.run': 'Buka paket Maria',
  's9.title': 'Tagihan November, dibayar via virtual account', 's9.sub': 'Keuangan menerbitkan tagihan November lebih awal, termasuk hari tambahan hari ini. Maria membayar lewat virtual account DOKU; tersinkron ke Xero.', 's9.run': 'Terbitkan dan bayar', 's9.alt': 'Tampilkan papan keuangan',
  's10.title': 'Papan langsung manajemen', 's10.sub': 'Ega mulai di Kedatangan: siapa yang ada di klub sekarang, dengan Tinjauan dan lonceng yang menunjukkan apa yang menunggunya.', 's10.run': 'Buka Kedatangan',
  's11.title': 'Atur harga hari tambahan', 's11.sub': 'Harga dari brosur sudah masuk. Hanya harga hari tambahan yang masih contoh. Ega mengatur harga yang sebenarnya; berlaku mulai penerbitan tagihan berikutnya.', 's11.run': 'Buka paket dan harga',
  reset: 'Atur ulang data demo', resetDone: 'Data demo diatur ulang ke 09.58.', resetConfirm: 'Atur ulang semua perubahan di demo ini? Semua pengguna aplikasi ikut melihat pengaturan ulang.', designSystem: 'Sistem desain', clock: 'Jam klub',
};
export const inv: Same<typeof EN.inv> = {
  'line.flex': 'Paket Flex · {month}', 'line.gold': 'Paket Gold · {month}', 'line.extra': 'Hari tambahan · {month} ({n})', 'line.credit': 'Saldo akun', 'line.venue': 'Sewa venue', 'line.leave': 'Cuti · {month}', 'line.registration': 'Biaya pendaftaran',
};
